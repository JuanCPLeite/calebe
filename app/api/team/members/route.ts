import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

type MemberRole = 'admin' | 'member'

function isMemberRole(value: unknown): value is MemberRole {
  return value === 'admin' || value === 'member'
}

async function ensureTeamAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, workspace_id')
    .eq('id', user.id)
    .maybeSingle<{ role: 'owner' | 'admin' | 'member'; workspace_id: string | null }>()

  const workspaceId = profile?.workspace_id || null
  if (!workspaceId) {
    return { error: NextResponse.json({ error: 'Nenhum workspace selecionado' }, { status: 400 }) }
  }

  if (profile?.role === 'owner') {
    return { user, workspaceId, isOwner: true as const, admin }
  }

  const { data: membership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle<{ role: MemberRole }>()

  if (membership?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }

  return { user, workspaceId, isOwner: false as const, admin }
}

export async function GET() {
  const auth = await ensureTeamAdmin()
  if ('error' in auth) return auth.error

  const { admin, workspaceId, user } = auth
  const [workspaceRes, membersRes, usersRes] = await Promise.all([
    admin
      .from('workspaces')
      .select('id, name, slug, plan, active')
      .eq('id', workspaceId)
      .maybeSingle(),
    admin
      .from('workspace_members')
      .select('id, user_id, role, invited_by, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (workspaceRes.error || membersRes.error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: user.id,
      workspaceId,
      payload: {
        route: '/api/team/members',
        method: 'GET',
        error: workspaceRes.error?.message || membersRes.error?.message || 'unknown',
      },
    })
    return NextResponse.json({ error: 'Falha ao carregar equipe' }, { status: 500 })
  }

  const usersMap = Object.fromEntries(
    (usersRes.data?.users || []).map((u) => [u.id, u.email || ''])
  )

  return NextResponse.json({
    workspace: workspaceRes.data || null,
    members: (membersRes.data || []).map((m) => ({
      ...m,
      email: usersMap[m.user_id] || '',
      isCurrentUser: m.user_id === user.id,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await ensureTeamAdmin()
  if ('error' in auth) return auth.error

  const { admin, workspaceId, user } = auth
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role

  if (!email) return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })
  if (!isMemberRole(role)) return NextResponse.json({ error: 'role inválido (admin|member)' }, { status: 400 })

  const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const targetUser = (usersRes.data?.users || []).find(
    (u) => (u.email || '').toLowerCase() === email
  )

  if (!targetUser) {
    return NextResponse.json(
      { error: 'Usuário não encontrado. Peça para ele criar conta antes de convidar.' },
      { status: 404 }
    )
  }

  const { error } = await admin
    .from('workspace_members')
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: targetUser.id,
        role,
        invited_by: user.id,
      },
      { onConflict: 'workspace_id,user_id' }
    )

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: user.id,
      workspaceId,
      payload: {
        route: '/api/team/members',
        method: 'POST',
        error: error.message,
      },
    })
    return NextResponse.json({ error: 'Falha ao convidar membro' }, { status: 500 })
  }

  await admin
    .from('profiles')
    .update({ workspace_id: workspaceId })
    .eq('id', targetUser.id)
    .is('workspace_id', null)

  log({
    event: 'member.invited',
    userId: user.id,
    workspaceId,
    payload: { workspace_id: workspaceId, invited_email: email, role },
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureTeamAdmin()
  if ('error' in auth) return auth.error

  const { admin, workspaceId, user, isOwner } = auth
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const role = body.role

  if (!userId) return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  if (!isMemberRole(role)) return NextResponse.json({ error: 'role inválido (admin|member)' }, { status: 400 })
  if (!isOwner && userId === user.id && role !== 'admin') {
    return NextResponse.json({ error: 'Você não pode remover seu próprio admin' }, { status: 400 })
  }

  const { data: member, error } = await admin
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('id, user_id, role, invited_by, created_at')
    .maybeSingle()

  if (error || !member) {
    return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ member })
}

export async function DELETE(req: NextRequest) {
  const auth = await ensureTeamAdmin()
  if ('error' in auth) return auth.error

  const { admin, workspaceId, user, isOwner } = auth
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''

  if (!userId) return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  if (!isOwner && userId === user.id) {
    return NextResponse.json({ error: 'Você não pode remover a si mesmo' }, { status: 400 })
  }

  const { error } = await admin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: user.id,
      workspaceId,
      payload: {
        route: '/api/team/members',
        method: 'DELETE',
        error: error.message,
      },
    })
    return NextResponse.json({ error: 'Falha ao remover membro' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
