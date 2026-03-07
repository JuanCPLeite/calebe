import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

async function ensureOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

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

function startDateFromDays(days: number): string {
  const n = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 30
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

export async function GET(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  try {
    const admin = createAdminClient()
    const url = new URL(req.url)
    const days = Number(url.searchParams.get('days') || '30')
    const workspaceId = (url.searchParams.get('workspaceId') || '').trim()
    const from = startDateFromDays(days)

    let usageQuery = admin
      .from('usage_events')
      .select('workspace_id, user_id, provider, model, quantity, total_cost_usd, created_at')
      .gte('created_at', from)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (workspaceId) usageQuery = usageQuery.eq('workspace_id', workspaceId)

    const [usageRes, workspacesRes, profilesRes] = await Promise.all([
      usageQuery,
      admin.from('workspaces').select('id, name').order('name', { ascending: true }),
      admin.from('profiles').select('id, full_name'),
    ])

    if (usageRes.error) {
      throw new Error(usageRes.error.message || 'Falha ao consultar usage_events')
    }

    const usage = usageRes.data || []
    const workspaces = workspacesRes.data || []
    const profiles = profilesRes.data || []
    const wsNameById = new Map(workspaces.map((w) => [w.id, w.name || w.id]))
    const userNameById = new Map(profiles.map((p) => [p.id, p.full_name || p.id]))

    let totalCostUsd = 0
    const byDay = new Map<string, number>()
    const byWorkspace = new Map<string, number>()
    const byUser = new Map<string, number>()
    const byModel = new Map<string, { provider: string; model: string; cost: number; quantity: number }>()

    for (const row of usage) {
      const cost = Number(row.total_cost_usd || 0)
      const qty = Number(row.quantity || 0)
      const day = String(row.created_at || '').slice(0, 10)
      const wsId = row.workspace_id || 'unknown'
      const userId = row.user_id || 'unknown'
      const provider = row.provider || 'unknown'
      const model = row.model || ''
      const modelKey = `${provider}:${model}`

      totalCostUsd += cost
      if (day) byDay.set(day, (byDay.get(day) || 0) + cost)
      byWorkspace.set(wsId, (byWorkspace.get(wsId) || 0) + cost)
      byUser.set(userId, (byUser.get(userId) || 0) + cost)

      const current = byModel.get(modelKey) || { provider, model, cost: 0, quantity: 0 }
      current.cost += cost
      current.quantity += qty
      byModel.set(modelKey, current)
    }

    const topWorkspaces = Array.from(byWorkspace.entries())
      .map(([id, cost]) => ({ workspaceId: id, workspaceName: wsNameById.get(id) || id, totalCostUsd: cost }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
      .slice(0, 10)

    const topUsers = Array.from(byUser.entries())
      .map(([id, cost]) => ({ userId: id, userName: userNameById.get(id) || id, totalCostUsd: cost }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
      .slice(0, 10)

    const topModels = Array.from(byModel.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12)
      .map((item) => ({
        provider: item.provider,
        model: item.model,
        totalCostUsd: item.cost,
        totalQuantity: item.quantity,
      }))

    const daily = Array.from(byDay.entries())
      .map(([date, cost]) => ({ date, totalCostUsd: cost }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      days: Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 30,
      from,
      totalCostUsd,
      eventCount: usage.length,
      workspaces,
      topWorkspaces,
      topUsers,
      topModels,
      daily,
    })
  } catch (err: any) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/costs', method: 'GET', error: err.message || 'unknown' },
    })
    return NextResponse.json({ error: err.message || 'Falha ao carregar custos' }, { status: 500 })
  }
}

