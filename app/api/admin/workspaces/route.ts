import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

type WorkspacePlan = 'starter' | 'pro' | 'agency'

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

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

function isValidPlan(value: unknown): value is WorkspacePlan {
  return value === 'starter' || value === 'pro' || value === 'agency'
}

export async function GET(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const url = new URL(req.url)
  const search = (url.searchParams.get('search') || '').trim()
  const plan = (url.searchParams.get('plan') || '').trim()
  const activeParam = (url.searchParams.get('active') || '').trim().toLowerCase()

  let query = admin
    .from('workspaces')
    .select('id, name, slug, plan, owner_id, active, created_at')
    .order('created_at', { ascending: false })

  if (search) query = query.ilike('name', `%${search}%`)
  if (plan && isValidPlan(plan)) query = query.eq('plan', plan)
  if (activeParam === 'true') query = query.eq('active', true)
  if (activeParam === 'false') query = query.eq('active', false)

  const { data, error } = await query

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/workspaces', method: 'GET', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao listar workspaces' }, { status: 500 })
  }

  return NextResponse.json({ workspaces: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const providedSlug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const plan = body.plan
  const ownerUserId = typeof body.ownerUserId === 'string' ? body.ownerUserId.trim() : ''

  if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 })
  if (!isValidPlan(plan)) {
    return NextResponse.json({ error: 'plan inválido (use starter|pro|agency)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const baseSlug = slugify(providedSlug || name) || 'workspace'

  let finalSlug = baseSlug
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await admin
      .from('workspaces')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle()
    if (!existing) break
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data: workspace, error } = await admin
    .from('workspaces')
    .insert({
      name,
      slug: finalSlug,
      plan,
      owner_id: ownerUserId || null,
      active: true,
    })
    .select('id, name, slug, plan, owner_id, active, created_at')
    .single()

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/workspaces', method: 'POST', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao criar workspace' }, { status: 500 })
  }

  if (ownerUserId) {
    await admin
      .from('workspace_members')
      .upsert(
        {
          workspace_id: workspace.id,
          user_id: ownerUserId,
          role: 'admin',
          invited_by: auth.user.id,
        },
        { onConflict: 'workspace_id,user_id' }
      )

    await admin
      .from('profiles')
      .update({ workspace_id: workspace.id })
      .eq('id', ownerUserId)
  }

  log({
    event: 'workspace.created',
    userId: auth.user.id,
    workspaceId: workspace.id,
    payload: { workspace_id: workspace.id, name: workspace.name, plan: workspace.plan },
  })

  return NextResponse.json({ workspace }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const workspaceId = typeof body.id === 'string' ? body.id.trim() : ''

  if (!workspaceId) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') updates.active = body.active
  if (isValidPlan(body.plan)) updates.plan = body.plan
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualização' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: workspace, error } = await admin
    .from('workspaces')
    .update(updates)
    .eq('id', workspaceId)
    .select('id, name, slug, plan, owner_id, active, created_at')
    .single()

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/workspaces', method: 'PATCH', error: error.message, workspace_id: workspaceId },
    })
    return NextResponse.json({ error: 'Falha ao atualizar workspace' }, { status: 500 })
  }

  return NextResponse.json({ workspace })
}
