import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

interface ProfileRow {
  role: 'owner' | 'admin' | 'member'
  workspace_id: string | null
}

type WorkspacePlan = 'starter' | 'pro' | 'agency'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, workspace_id')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  if (profile.role === 'owner') {
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, name, slug, active, plan')
      .order('name', { ascending: true })

    return NextResponse.json({
      currentWorkspaceId: profile.workspace_id,
      workspaces: (workspaces || []).map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        active: Boolean(w.active),
        plan: (w.plan as WorkspacePlan) || 'starter',
        role: 'owner',
      })),
    })
  }

  const { data: memberships } = await admin
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)

  const memberWorkspaceIds = Array.from(
    new Set((memberships || []).map((m) => m.workspace_id).filter(Boolean))
  ) as string[]

  const { data: workspaces } = memberWorkspaceIds.length
    ? await admin
        .from('workspaces')
        .select('id, name, slug, active, plan')
        .in('id', memberWorkspaceIds)
        .order('name', { ascending: true })
    : { data: [] as Array<{ id: string; name: string; slug: string; active: boolean; plan: WorkspacePlan }> }

  const roleMap = Object.fromEntries(
    (memberships || []).map((m) => [m.workspace_id, m.role || 'member'])
  )

  return NextResponse.json({
    currentWorkspaceId: profile.workspace_id,
      workspaces: (workspaces || []).map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        active: Boolean(w.active),
        plan: (w.plan as WorkspacePlan) || 'starter',
        role: (roleMap[w.id] as 'admin' | 'member' | undefined) || 'member',
      })),
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const workspaceId =
    typeof body.workspaceId === 'string' ? body.workspaceId.trim() : ''

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId é obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: 'owner' | 'admin' | 'member' }>()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  if (profile.role === 'owner') {
    const { data: workspace } = await admin
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .maybeSingle()

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
    }
  } else {
    const { data: member } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Acesso negado para este workspace' }, { status: 403 })
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({ workspace_id: workspaceId })
    .eq('id', user.id)

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: user.id,
      workspaceId,
      payload: {
        route: '/api/workspace/context',
        method: 'PATCH',
        error: error.message,
      },
    })
    return NextResponse.json({ error: 'Falha ao atualizar workspace atual' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, workspaceId })
}
