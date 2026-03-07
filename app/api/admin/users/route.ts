import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

type UserRole = 'owner' | 'admin' | 'member'

function isValidRole(value: unknown): value is UserRole {
  return value === 'owner' || value === 'admin' || value === 'member'
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

export async function GET(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const url = new URL(req.url)
  const roleFilter = (url.searchParams.get('role') || '').trim()
  const workspaceId = (url.searchParams.get('workspaceId') || '').trim()
  const search = (url.searchParams.get('search') || '').trim().toLowerCase()

  let query = admin
    .from('profiles')
    .select('id, role, workspace_id, created_at')
    .order('created_at', { ascending: false })

  if (isValidRole(roleFilter)) query = query.eq('role', roleFilter)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data: profiles, error } = await query
  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/users', method: 'GET', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao listar usuários' }, { status: 500 })
  }

  const { data: authUsersRes, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (authErr) {
    return NextResponse.json({ error: `Falha ao listar auth users: ${authErr.message}` }, { status: 500 })
  }

  const authMap = Object.fromEntries(
    (authUsersRes.users || []).map((u) => [u.id, { email: u.email || '', created_at: u.created_at || null }])
  )

  const workspaceIds = Array.from(new Set((profiles || []).map((p) => p.workspace_id).filter(Boolean))) as string[]
  let workspaceMap: Record<string, { name: string; slug: string }> = {}
  if (workspaceIds.length) {
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, name, slug')
      .in('id', workspaceIds)
    workspaceMap = Object.fromEntries((workspaces || []).map((w) => [w.id, { name: w.name, slug: w.slug }]))
  }

  const users = (profiles || []).map((p) => ({
    id: p.id,
    role: p.role as UserRole,
    workspace_id: p.workspace_id as string | null,
    created_at: p.created_at as string | null,
    email: authMap[p.id]?.email || '',
    auth_created_at: authMap[p.id]?.created_at || null,
    workspace: p.workspace_id ? workspaceMap[p.workspace_id] || null : null,
  }))

  const filtered = search
    ? users.filter((u) => u.email.toLowerCase().includes(search))
    : users

  return NextResponse.json({ users: filtered })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const role = body.role
  const workspaceId =
    typeof body.workspaceId === 'string'
      ? body.workspaceId.trim() || null
      : body.workspaceId === null
        ? null
        : undefined

  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (isValidRole(role)) updates.role = role
  if (workspaceId !== undefined) updates.workspace_id = workspaceId

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualização' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, role, workspace_id, created_at')
    .single()

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/users', method: 'PATCH', error: error.message, target_user_id: id },
    })
    return NextResponse.json({ error: 'Falha ao atualizar usuário' }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
