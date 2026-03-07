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

async function countWhere(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  builder: (q: any) => any = (q) => q
): Promise<number> {
  const q = admin.from(table).select('*', { count: 'exact', head: true })
  const { count } = await builder(q)
  return count || 0
}

export async function GET(_req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const now = new Date()
  const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)

  try {
    const [
      activeWorkspaces,
      activeWorkspacesLast30d,
      totalUsers,
      usersToday,
      totalCarousels,
      carousels24h,
      totalPublished,
      published24h,
      errors24h,
      recentLogsRes,
      usersRes,
    ] = await Promise.all([
      countWhere(admin, 'workspaces', (q) => q.eq('active', true)),
      countWhere(admin, 'workspaces', (q) => q.eq('active', true).gte('created_at', start30d)),
      countWhere(admin, 'profiles'),
      countWhere(admin, 'profiles', (q) => q.gte('created_at', startToday.toISOString())),
      countWhere(admin, 'carousels'),
      countWhere(admin, 'carousels', (q) => q.gte('created_at', start24h)),
      countWhere(admin, 'carousels', (q) => q.not('ig_post_id', 'is', null)),
      countWhere(admin, 'carousels', (q) => q.not('ig_post_id', 'is', null).gte('published_at', start24h)),
      countWhere(admin, 'system_logs', (q) => q.eq('level', 'error').gte('created_at', start24h)),
      admin
        .from('system_logs')
        .select('id, workspace_id, user_id, event, level, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

    const recentLogs = recentLogsRes.data || []
    const workspaceIds = Array.from(new Set(recentLogs.map((l) => l.workspace_id).filter(Boolean))) as string[]
    const usersMap = Object.fromEntries(
      (usersRes.data?.users || []).map((u) => [u.id, u.email || ''])
    )

    let workspaceMap: Record<string, { name: string; slug: string }> = {}
    if (workspaceIds.length) {
      const { data: workspaces } = await admin
        .from('workspaces')
        .select('id, name, slug')
        .in('id', workspaceIds)
      workspaceMap = Object.fromEntries((workspaces || []).map((w) => [w.id, { name: w.name, slug: w.slug }]))
    }

    const activity = recentLogs.map((l) => ({
      id: l.id,
      event: l.event,
      level: l.level,
      created_at: l.created_at,
      workspace: l.workspace_id ? workspaceMap[l.workspace_id] || null : null,
      user_email: l.user_id ? usersMap[l.user_id] || '' : '',
      payload: l.payload,
    }))

    return NextResponse.json({
      cards: {
        activeWorkspaces: { total: activeWorkspaces, delta30d: activeWorkspacesLast30d },
        totalUsers: { total: totalUsers, newToday: usersToday },
        carousels: { total: totalCarousels, last24h: carousels24h },
        publications: { total: totalPublished, last24h: published24h },
      },
      errors24h,
      recentActivity: activity,
    })
  } catch (err: any) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/metrics', method: 'GET', error: err.message || 'unknown' },
    })
    return NextResponse.json({ error: 'Falha ao carregar métricas admin' }, { status: 500 })
  }
}
