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

export async function GET(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const url = new URL(req.url)
  const level = (url.searchParams.get('level') || '').trim()
  const event = (url.searchParams.get('event') || '').trim()
  const workspaceId = (url.searchParams.get('workspaceId') || '').trim()
  const daysParam = Number(url.searchParams.get('days') || '7')
  const limitParam = Number(url.searchParams.get('limit') || '100')

  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 7
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = admin
    .from('system_logs')
    .select('id, workspace_id, user_id, event, level, payload, created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (level && ['info', 'warn', 'error'].includes(level)) query = query.eq('level', level)
  if (event) query = query.eq('event', event)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data: logsData, error } = await query

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/logs', method: 'GET', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao carregar logs' }, { status: 500 })
  }

  const workspaceIds = Array.from(
    new Set((logsData || []).map((l) => l.workspace_id).filter(Boolean))
  ) as string[]

  let workspaceMap: Record<string, { name: string; slug: string }> = {}
  if (workspaceIds.length) {
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, name, slug')
      .in('id', workspaceIds)

    workspaceMap = Object.fromEntries(
      (workspaces || []).map((w) => [w.id, { name: w.name, slug: w.slug }])
    )
  }

  const logs = (logsData || []).map((entry) => ({
    ...entry,
    workspace: entry.workspace_id ? workspaceMap[entry.workspace_id] || null : null,
  }))

  return NextResponse.json({ logs })
}
