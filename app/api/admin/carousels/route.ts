import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'published' | 'deleted'

async function ensureOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }

  return { user }
}

function normalizeStatus(value: string): StatusFilter {
  if (value === 'draft' || value === 'scheduled' || value === 'published' || value === 'deleted') return value
  return 'all'
}

export async function GET(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const url = new URL(req.url)
  const status = normalizeStatus((url.searchParams.get('status') || '').trim().toLowerCase())
  const workspaceId = (url.searchParams.get('workspaceId') || '').trim()
  const search = (url.searchParams.get('search') || '').trim().toLowerCase()
  const limitParam = Number(url.searchParams.get('limit') || '200')
  const daysParam = Number(url.searchParams.get('days') || '90')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 200
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 90
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = admin
    .from('carousels')
    .select('id, workspace_id, user_id, expert_id, topic, caption, provider_used, model_used, ig_post_id, published_at, scheduled_at, deleted_at, deleted_by, deleted_reason, created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  if (status === 'deleted') query = query.not('deleted_at', 'is', null)
  if (status === 'published') query = query.is('deleted_at', null).not('ig_post_id', 'is', null)
  if (status === 'scheduled') {
    query = query.is('deleted_at', null).is('ig_post_id', null).not('scheduled_at', 'is', null)
  }
  if (status === 'draft') {
    query = query.is('deleted_at', null).is('ig_post_id', null).is('scheduled_at', null)
  }

  const { data: rows, error } = await query
  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/carousels', method: 'GET', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao listar carrosséis' }, { status: 500 })
  }

  const workspaceIds = Array.from(new Set((rows || []).map((r) => r.workspace_id).filter(Boolean))) as string[]
  const expertIds = Array.from(new Set((rows || []).map((r) => r.expert_id).filter(Boolean))) as string[]
  const userIds = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean))) as string[]

  let workspaceMap: Record<string, { name: string; slug: string }> = {}
  if (workspaceIds.length) {
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, name, slug')
      .in('id', workspaceIds)
    workspaceMap = Object.fromEntries((workspaces || []).map((w) => [w.id, { name: w.name, slug: w.slug }]))
  }

  let expertMap: Record<string, { display_name: string; handle: string }> = {}
  if (expertIds.length) {
    const { data: experts } = await admin
      .from('experts')
      .select('id, display_name, handle')
      .in('id', expertIds)
    expertMap = Object.fromEntries((experts || []).map((e) => [e.id, { display_name: e.display_name, handle: e.handle }]))
  }

  let userMap: Record<string, { email: string }> = {}
  if (userIds.length) {
    const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (!usersError) {
      userMap = Object.fromEntries(
        (usersPage.users || [])
          .filter((u) => userIds.includes(u.id))
          .map((u) => [u.id, { email: u.email || '' }])
      )
    }
  }

  const carousels = (rows || []).map((r) => ({
    ...r,
    workspace: r.workspace_id ? workspaceMap[r.workspace_id] || null : null,
    expert: r.expert_id ? expertMap[r.expert_id] || null : null,
    user: r.user_id ? userMap[r.user_id] || null : null,
  }))

  const filtered = search
    ? carousels.filter((c) =>
        (c.topic || '').toLowerCase().includes(search) ||
        (c.caption || '').toLowerCase().includes(search) ||
        (c.user?.email || '').toLowerCase().includes(search)
      )
    : carousels

  return NextResponse.json({ carousels: filtered })
}

type CarouselAction =
  | 'cancel_schedule'
  | 'requeue_publish'
  | 'duplicate'
  | 'restore'
  | 'delete'

function isValidAction(value: unknown): value is CarouselAction {
  return (
    value === 'cancel_schedule' ||
    value === 'requeue_publish' ||
    value === 'duplicate' ||
    value === 'restore' ||
    value === 'delete'
  )
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const action = body.action

  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  if (!isValidAction(action)) {
    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  }

  const { data: current, error: loadError } = await admin
    .from('carousels')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadError || !current) {
    return NextResponse.json({ error: 'Carrossel não encontrado' }, { status: 404 })
  }

  if (action === 'cancel_schedule') {
    const { error } = await admin
      .from('carousels')
      .update({ scheduled_at: null })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) return NextResponse.json({ error: 'Falha ao cancelar agendamento' }, { status: 500 })
    return NextResponse.json({ ok: true, action })
  }

  if (action === 'requeue_publish') {
    const { error } = await admin
      .from('carousels')
      .update({
        ig_post_id: null,
        published_at: null,
        scheduled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) return NextResponse.json({ error: 'Falha ao reenfileirar publicação' }, { status: 500 })
    return NextResponse.json({ ok: true, action })
  }

  if (action === 'duplicate') {
    const { data: duplicated, error } = await admin
      .from('carousels')
      .insert({
        user_id: current.user_id,
        workspace_id: current.workspace_id,
        created_by: auth.user.id,
        expert_id: current.expert_id,
        topic: `${current.topic} (cópia admin)`,
        caption: current.caption,
        slides: current.slides,
        provider_used: current.provider_used,
        model_used: current.model_used,
        scheduled_at: null,
        ig_post_id: null,
        published_at: null,
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: 'Falha ao duplicar carrossel' }, { status: 500 })
    return NextResponse.json({ ok: true, action, duplicatedId: duplicated.id })
  }

  if (action === 'restore') {
    const { error } = await admin
      .from('carousels')
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_reason: '',
      })
      .eq('id', id)
      .not('deleted_at', 'is', null)

    if (error) return NextResponse.json({ error: 'Falha ao restaurar carrossel' }, { status: 500 })
    return NextResponse.json({ ok: true, action })
  }

  const { error } = await admin
    .from('carousels')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: auth.user.id,
      deleted_reason: 'admin_delete',
      scheduled_at: null,
    })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: 'Falha ao excluir carrossel' }, { status: 500 })
  return NextResponse.json({ ok: true, action })
}
