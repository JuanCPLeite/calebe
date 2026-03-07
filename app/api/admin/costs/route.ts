import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'
import { findPlanById, parsePlanConfigs, DEFAULT_PLAN_CONFIGS } from '@/lib/plan-config'

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

    const [usageRes, workspacesRes, profilesRes, settingsRes, monthCarouselsRes] = await Promise.all([
      usageQuery,
      admin.from('workspaces').select('id, name, plan').order('name', { ascending: true }),
      admin.from('profiles').select('id, full_name'),
      admin.from('app_settings').select('plan_configs').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle(),
      admin
        .from('carousels')
        .select('workspace_id, created_at')
        .gte('created_at', new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString())
        .limit(20000),
    ])

    if (usageRes.error) {
      throw new Error(usageRes.error.message || 'Falha ao consultar usage_events')
    }

    const usage = usageRes.data || []
    const workspaces = workspacesRes.data || []
    const profiles = profilesRes.data || []
    const plans = parsePlanConfigs((settingsRes.data as any)?.plan_configs || DEFAULT_PLAN_CONFIGS)
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

    const alerts: Array<{ level: 'info' | 'warn'; message: string }> = []
    const dailyCosts = daily.map((d) => d.totalCostUsd)
    const avgDaily = dailyCosts.length > 0 ? dailyCosts.reduce((a, b) => a + b, 0) / dailyCosts.length : 0
    const maxDaily = dailyCosts.length > 0 ? Math.max(...dailyCosts) : 0
    if (avgDaily > 0 && maxDaily >= avgDaily * 2.2) {
      alerts.push({
        level: 'warn',
        message: `Pico de custo detectado: dia mais caro em ${maxDaily.toFixed(4)} USD (média ${avgDaily.toFixed(4)} USD).`,
      })
    }
    if (totalCostUsd === 0 && usage.length > 0) {
      alerts.push({
        level: 'info',
        message: 'Eventos de uso encontrados com custo total 0. Verifique o catálogo de preços em Admin Costs.',
      })
    }

    const monthUsageByWorkspace = new Map<string, number>()
    for (const row of monthCarouselsRes.data || []) {
      const wsId = row.workspace_id || 'unknown'
      monthUsageByWorkspace.set(wsId, (monthUsageByWorkspace.get(wsId) || 0) + 1)
    }

    const creditUsage = workspaces.map((w) => {
      const plan = findPlanById(plans, w.plan) || plans[0]
      const used = monthUsageByWorkspace.get(w.id) || 0
      const limit = plan?.monthlyPostCredits || 1
      const usagePercent = Math.round((used / Math.max(1, limit)) * 100)
      return {
        workspaceId: w.id,
        workspaceName: w.name || w.id,
        planId: w.plan || plan?.id || 'starter',
        usedCredits: used,
        creditLimit: limit,
        usagePercent,
      }
    })
      .sort((a, b) => b.usagePercent - a.usagePercent)
      .slice(0, 20)

    for (const item of creditUsage) {
      if (item.usagePercent >= 100) {
        alerts.push({
          level: 'warn',
          message: `Workspace ${item.workspaceName} estourou créditos (${item.usedCredits}/${item.creditLimit}).`,
        })
      } else if (item.usagePercent >= 80) {
        alerts.push({
          level: 'warn',
          message: `Workspace ${item.workspaceName} perto do limite (${item.usedCredits}/${item.creditLimit}).`,
        })
      }
    }

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
      creditUsage,
      alerts: alerts.slice(0, 12),
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
