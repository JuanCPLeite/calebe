import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const { id: workspaceId } = await params
  if (!workspaceId) return NextResponse.json({ error: 'workspace id obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  const [{ data: workspace, error: workspaceError }, { data: expert }] = await Promise.all([
    admin
      .from('workspaces')
      .select('id, name, slug, plan, owner_id, active, created_at')
      .eq('id', workspaceId)
      .maybeSingle(),
    admin
      .from('experts')
      .select('id, display_name, handle, niche')
      .eq('workspace_id', workspaceId)
      .limit(1)
      .maybeSingle(),
  ])

  if (workspaceError) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: `/api/admin/workspaces/${workspaceId}`, method: 'GET', error: workspaceError.message },
    })
    return NextResponse.json({ error: 'Falha ao carregar workspace' }, { status: 500 })
  }
  if (!workspace) return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })

  const [membersRes, carouselsRes, usageRes, logsRes, usersRes] = await Promise.all([
    admin
      .from('workspace_members')
      .select('id, user_id, role, invited_by, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    admin
      .from('carousels')
      .select('id, created_at, ig_post_id, published_at')
      .eq('workspace_id', workspaceId),
    admin
      .from('usage_events')
      .select('id, created_at, event_type, unit')
      .eq('workspace_id', workspaceId)
      .in('event_type', ['content.generate', 'publish'])
      .in('unit', ['render', 'publish']),
    admin
      .from('system_logs')
      .select('id, event, level, payload, user_id, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const usersMap = Object.fromEntries(
    (usersRes.data?.users || []).map((u) => [u.id, u.email || ''])
  )

  const members = (membersRes.data || []).map((m) => ({
    ...m,
    email: usersMap[m.user_id] || '',
  }))

  const carousels = carouselsRes.data || []
  const usageEvents = usageRes.data || []
  const now = Date.now()
  const last30 = now - 30 * 24 * 60 * 60 * 1000
  const generatedFromEvents = usageEvents.filter((e) => e.event_type === 'content.generate' && e.unit === 'render')
  const publishedFromEvents = usageEvents.filter((e) => e.event_type === 'publish' && e.unit === 'publish')
  const usage = {
    total_carousels: Math.max(generatedFromEvents.length, carousels.length),
    carousels_last_30d: Math.max(
      generatedFromEvents.filter((e) => new Date(e.created_at).getTime() >= last30).length,
      carousels.filter((c) => new Date(c.created_at).getTime() >= last30).length
    ),
    total_published: Math.max(publishedFromEvents.length, carousels.filter((c) => Boolean(c.ig_post_id)).length),
  }

  const logs = (logsRes.data || []).map((entry) => ({
    ...entry,
    email: entry.user_id ? usersMap[entry.user_id] || '' : '',
  }))

  return NextResponse.json({
    workspace,
    expert: expert || null,
    usage,
    members,
    logs,
  })
}
