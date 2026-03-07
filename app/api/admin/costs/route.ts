import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'
import { findPlanById, parsePlanConfigs, DEFAULT_PLAN_CONFIGS } from '@/lib/plan-config'
import { parseCreditWeights, toWeightedCredits } from '@/lib/credit-limits'
import { parseCostGuardrails } from '@/lib/cost-guardrails'

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

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Number((((current - previous) / previous) * 100).toFixed(2))
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
    const parsedDays = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 30
    const prevTo = from
    const prevFrom = new Date(new Date(from).getTime() - parsedDays * 24 * 60 * 60 * 1000).toISOString()

    let usageQuery = admin
      .from('usage_events')
      .select('workspace_id, user_id, carousel_id, provider, model, event_type, unit, quantity, total_cost_usd, created_at')
      .gte('created_at', from)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (workspaceId) usageQuery = usageQuery.eq('workspace_id', workspaceId)
    let periodCarouselsQuery = admin
      .from('carousels')
      .select('workspace_id, provider_used, model_used, ig_post_id, published_at, created_at')
      .gte('created_at', from)
      .limit(20000)
    if (workspaceId) periodCarouselsQuery = periodCarouselsQuery.eq('workspace_id', workspaceId)

    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
    const [usageRes, prevUsageRes, workspacesRes, profilesRes, settingsRes, monthCarouselsRes, monthUsageRes, monthCostRes, periodCarouselsRes] = await Promise.all([
      usageQuery,
      admin
        .from('usage_events')
        .select('event_type, unit, quantity, total_cost_usd, created_at')
        .gte('created_at', prevFrom)
        .lt('created_at', prevTo)
        .limit(5000),
      admin.from('workspaces').select('id, name, plan').order('name', { ascending: true }),
      admin.from('profiles').select('id, full_name'),
      admin.from('app_settings').select('plan_configs, credit_weights_json, cost_guardrails_json').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle(),
      admin
        .from('carousels')
        .select('workspace_id, created_at')
        .gte('created_at', monthStart)
        .limit(20000),
      admin
        .from('usage_events')
        .select('workspace_id, event_type, unit, quantity')
        .gte('created_at', monthStart)
        .in('event_type', ['content.generate', 'image.generate', 'publish'])
        .in('unit', ['render', 'image', 'publish'])
        .limit(50000),
      admin
        .from('usage_events')
        .select('workspace_id, total_cost_usd')
        .gte('created_at', monthStart)
        .limit(50000),
      periodCarouselsQuery,
    ])

    if (usageRes.error) {
      throw new Error(usageRes.error.message || 'Falha ao consultar usage_events')
    }
    if (prevUsageRes.error) {
      throw new Error(prevUsageRes.error.message || 'Falha ao consultar usage_events do período anterior')
    }
    if (periodCarouselsRes.error) {
      throw new Error(periodCarouselsRes.error.message || 'Falha ao consultar carousels do período')
    }

    const usage = usageRes.data || []
    const workspaces = workspacesRes.data || []
    const profiles = profilesRes.data || []
    const plans = parsePlanConfigs((settingsRes.data as any)?.plan_configs || DEFAULT_PLAN_CONFIGS)
    const creditWeights = parseCreditWeights((settingsRes.data as any)?.credit_weights_json)
    const costGuardrails = parseCostGuardrails((settingsRes.data as any)?.cost_guardrails_json)
    const wsNameById = new Map(workspaces.map((w) => [w.id, w.name || w.id]))
    const userNameById = new Map(profiles.map((p) => [p.id, p.full_name || p.id]))

    let totalCostUsd = 0
    const byDay = new Map<string, number>()
    const byWorkspace = new Map<string, number>()
    const byUser = new Map<string, number>()
    const byModel = new Map<string, { provider: string; model: string; cost: number; quantity: number }>()
    const byCarousel = new Map<string, { carouselId: string; workspaceId: string; workspaceName: string; totalCostUsd: number; eventCount: number }>()
    const userBreakdown = new Map<
      string,
      {
        userId: string
        userName: string
        workspaceId: string
        workspaceName: string
        eventCount: number
        totalCostUsd: number
        totalCredits: number
        contentCredits: number
        imageCredits: number
        publishCredits: number
      }
    >()

    for (const row of usage) {
      const cost = Number(row.total_cost_usd || 0)
      const qty = Number(row.quantity || 0)
      const day = String(row.created_at || '').slice(0, 10)
      const wsId = row.workspace_id || 'unknown'
      const userId = row.user_id || 'unknown'
      const provider = row.provider || 'unknown'
      const model = row.model || ''
      const modelKey = `${provider}:${model}`
      const carouselId = row.carousel_id || ''

      totalCostUsd += cost
      if (day) byDay.set(day, (byDay.get(day) || 0) + cost)
      byWorkspace.set(wsId, (byWorkspace.get(wsId) || 0) + cost)
      byUser.set(userId, (byUser.get(userId) || 0) + cost)

      const current = byModel.get(modelKey) || { provider, model, cost: 0, quantity: 0 }
      current.cost += cost
      current.quantity += qty
      byModel.set(modelKey, current)

      if (carouselId) {
        const currentCarousel = byCarousel.get(carouselId) || {
          carouselId,
          workspaceId: wsId,
          workspaceName: wsNameById.get(wsId) || wsId,
          totalCostUsd: 0,
          eventCount: 0,
        }
        currentCarousel.totalCostUsd += cost
        currentCarousel.eventCount += 1
        byCarousel.set(carouselId, currentCarousel)
      }

      const breakdownKey = `${wsId}:${userId}`
      const breakdown = userBreakdown.get(breakdownKey) || {
        userId,
        userName: userNameById.get(userId) || userId,
        workspaceId: wsId,
        workspaceName: wsNameById.get(wsId) || wsId,
        eventCount: 0,
        totalCostUsd: 0,
        totalCredits: 0,
        contentCredits: 0,
        imageCredits: 0,
        publishCredits: 0,
      }
      breakdown.eventCount += 1
      breakdown.totalCostUsd += cost

      const weighted = toWeightedCredits([{
        event_type: row.event_type,
        unit: row.unit,
        quantity: Number((row as any).quantity || 0),
      }], creditWeights)
      breakdown.totalCredits = Number((breakdown.totalCredits + weighted).toFixed(2))
      if (row.event_type === 'content.generate' && row.unit === 'render') {
        breakdown.contentCredits = Number((breakdown.contentCredits + weighted).toFixed(2))
      }
      if (row.event_type === 'image.generate' && row.unit === 'image') {
        breakdown.imageCredits = Number((breakdown.imageCredits + weighted).toFixed(2))
      }
      if (row.event_type === 'publish' && row.unit === 'publish') {
        breakdown.publishCredits = Number((breakdown.publishCredits + weighted).toFixed(2))
      }
      userBreakdown.set(breakdownKey, breakdown)
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

    const topCarouselCandidates = Array.from(byCarousel.values())
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
      .slice(0, 30)
    const topCarouselIds = topCarouselCandidates.map((item) => item.carouselId)
    const carouselMetaById = new Map<string, { topic: string; published: boolean; createdAt: string | null }>()
    if (topCarouselIds.length > 0) {
      const { data: topCarouselsMetaRes } = await admin
        .from('carousels')
        .select('id, topic, ig_post_id, published_at, created_at')
        .in('id', topCarouselIds)
      for (const row of topCarouselsMetaRes || []) {
        carouselMetaById.set(row.id, {
          topic: row.topic || row.id,
          published: Boolean(row.ig_post_id || row.published_at),
          createdAt: row.created_at || null,
        })
      }
    }
    const topCarousels = topCarouselCandidates.map((item) => {
      const meta = carouselMetaById.get(item.carouselId)
      return {
        carouselId: item.carouselId,
        topic: meta?.topic || item.carouselId,
        workspaceId: item.workspaceId,
        workspaceName: item.workspaceName,
        published: meta?.published || false,
        createdAt: meta?.createdAt || null,
        totalCostUsd: Number(item.totalCostUsd.toFixed(8)),
        eventCount: item.eventCount,
      }
    })
    const byModelEffectiveness = new Map<string, { provider: string; model: string; generatedCount: number; publishedCount: number }>()
    for (const row of periodCarouselsRes.data || []) {
      const provider = row.provider_used || 'unknown'
      const model = row.model_used || 'unknown'
      const key = `${provider}:${model}`
      const current = byModelEffectiveness.get(key) || { provider, model, generatedCount: 0, publishedCount: 0 }
      current.generatedCount += 1
      if (row.ig_post_id || row.published_at) current.publishedCount += 1
      byModelEffectiveness.set(key, current)
    }
    const modelEffectiveness = Array.from(byModelEffectiveness.values())
      .map((item) => ({
        provider: item.provider,
        model: item.model,
        generatedCount: item.generatedCount,
        publishedCount: item.publishedCount,
        publishRatePct: item.generatedCount > 0 ? Number(((item.publishedCount / item.generatedCount) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.generatedCount - a.generatedCount || b.publishedCount - a.publishedCount)
      .slice(0, 20)

    const userCreditBreakdown = Array.from(userBreakdown.values())
      .sort((a, b) => b.totalCredits - a.totalCredits || b.totalCostUsd - a.totalCostUsd)
      .slice(0, 30)
      .map((row) => ({
        ...row,
        totalCostUsd: Number(row.totalCostUsd.toFixed(8)),
      }))

    const daily = Array.from(byDay.entries())
      .map(([date, cost]) => ({ date, totalCostUsd: cost }))
      .sort((a, b) => a.date.localeCompare(b.date))

    let prevTotalCostUsd = 0
    let prevTotalCredits = 0
    const prevRows = prevUsageRes.data || []
    for (const row of prevRows) {
      prevTotalCostUsd += Number(row.total_cost_usd || 0)
      prevTotalCredits += toWeightedCredits([{
        event_type: row.event_type,
        unit: row.unit,
        quantity: Number((row as any).quantity || 0),
      }], creditWeights)
    }
    prevTotalCredits = Number(prevTotalCredits.toFixed(2))

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
    for (const row of monthUsageRes.data || []) {
      const wsId = row.workspace_id || 'unknown'
      const weighted = toWeightedCredits([{
        event_type: row.event_type,
        unit: row.unit,
        quantity: Number((row as any).quantity || 0),
      }], creditWeights)
      monthUsageByWorkspace.set(wsId, Number(((monthUsageByWorkspace.get(wsId) || 0) + weighted).toFixed(2)))
    }

    const monthCarouselFallback = new Map<string, number>()
    for (const row of monthCarouselsRes.data || []) {
      const wsId = row.workspace_id || 'unknown'
      monthCarouselFallback.set(wsId, (monthCarouselFallback.get(wsId) || 0) + 1)
    }

    const creditUsage = workspaces.map((w) => {
      const plan = findPlanById(plans, w.plan) || plans[0]
      const used = Math.max(monthUsageByWorkspace.get(w.id) || 0, monthCarouselFallback.get(w.id) || 0)
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

    const monthCostByWorkspace = new Map<string, number>()
    for (const row of monthCostRes.data || []) {
      const wsId = row.workspace_id || 'unknown'
      const cost = Number(row.total_cost_usd || 0)
      monthCostByWorkspace.set(wsId, (monthCostByWorkspace.get(wsId) || 0) + cost)
    }
    const now = new Date()
    const dayOfMonth = now.getUTCDate()
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()

    const monthlyProjection = workspaces.map((w) => {
      const monthCostUsd = monthCostByWorkspace.get(w.id) || 0
      const projectedMonthCostUsd = dayOfMonth > 0 ? (monthCostUsd / dayOfMonth) * daysInMonth : monthCostUsd
      return {
        workspaceId: w.id,
        workspaceName: w.name || w.id,
        planId: w.plan || 'starter',
        monthCostUsd,
        projectedMonthCostUsd,
      }
    })
      .sort((a, b) => b.projectedMonthCostUsd - a.projectedMonthCostUsd)
      .slice(0, 20)

    const budgetUsage = workspaces.map((w) => {
      const monthCostUsd = Number((monthCostByWorkspace.get(w.id) || 0).toFixed(8))
      const override = costGuardrails.workspaceMonthlyBudgetUsd[w.id]
      const budgetLimitUsd = Number((override ?? costGuardrails.defaultMonthlyBudgetUsd ?? 0).toFixed(2))
      const hasBudget = budgetLimitUsd > 0
      const usagePercent = hasBudget ? Math.round((monthCostUsd / Math.max(0.00000001, budgetLimitUsd)) * 100) : 0
      const exceeded = hasBudget ? monthCostUsd >= budgetLimitUsd : false
      const warning = hasBudget ? usagePercent >= costGuardrails.warnAtPercent : false
      return {
        workspaceId: w.id,
        workspaceName: w.name || w.id,
        planId: w.plan || 'starter',
        monthCostUsd,
        budgetLimitUsd,
        usagePercent,
        exceeded,
        warning,
      }
    })
      .sort((a, b) => b.usagePercent - a.usagePercent)
      .slice(0, 30)

    const planStats = new Map<string, {
      planId: string
      planLabel: string
      workspaceCount: number
      planPriceUsd: number
      monthCostUsd: number
      projectedMonthCostUsd: number
    }>()
    for (const workspace of workspaces) {
      const plan = findPlanById(plans, workspace.plan) || plans[0]
      const planId = plan?.id || workspace.plan || 'starter'
      const current = planStats.get(planId) || {
        planId,
        planLabel: plan?.label || planId,
        workspaceCount: 0,
        planPriceUsd: Number((plan?.monthlyPriceUsd || 0).toFixed(2)),
        monthCostUsd: 0,
        projectedMonthCostUsd: 0,
      }
      const monthCostUsd = monthCostByWorkspace.get(workspace.id) || 0
      const projectedMonthCostUsd = dayOfMonth > 0 ? (monthCostUsd / dayOfMonth) * daysInMonth : monthCostUsd
      current.workspaceCount += 1
      current.monthCostUsd += monthCostUsd
      current.projectedMonthCostUsd += projectedMonthCostUsd
      planStats.set(planId, current)
    }
    const planMarginSimulation = Array.from(planStats.values())
      .map((item) => {
        const revenueUsd = Number((item.workspaceCount * item.planPriceUsd).toFixed(2))
        const projectedMonthCostUsd = Number(item.projectedMonthCostUsd.toFixed(8))
        const projectedMarginUsd = Number((revenueUsd - projectedMonthCostUsd).toFixed(8))
        const projectedMarginPct = revenueUsd > 0
          ? Number(((projectedMarginUsd / revenueUsd) * 100).toFixed(2))
          : null
        return {
          planId: item.planId,
          planLabel: item.planLabel,
          workspaceCount: item.workspaceCount,
          planPriceUsd: item.planPriceUsd,
          revenueUsd,
          monthCostUsd: Number(item.monthCostUsd.toFixed(8)),
          projectedMonthCostUsd,
          projectedMarginUsd,
          projectedMarginPct,
        }
      })
      .sort((a, b) => a.projectedMarginUsd - b.projectedMarginUsd)

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
    for (const item of budgetUsage) {
      if (!item.budgetLimitUsd || item.budgetLimitUsd <= 0) continue
      if (item.exceeded) {
        alerts.push({
          level: 'warn',
          message: `Workspace ${item.workspaceName} estourou orçamento de custo (${item.monthCostUsd.toFixed(4)}/${item.budgetLimitUsd.toFixed(2)} USD).`,
        })
      } else if (item.warning) {
        alerts.push({
          level: 'warn',
          message: `Workspace ${item.workspaceName} perto do orçamento de custo (${item.monthCostUsd.toFixed(4)}/${item.budgetLimitUsd.toFixed(2)} USD).`,
        })
      }
    }

    return NextResponse.json({
      days: parsedDays,
      from,
      compare: {
        previousFrom: prevFrom,
        previousTo: prevTo,
        current: {
          totalCostUsd: Number(totalCostUsd.toFixed(8)),
          eventCount: usage.length,
          totalCredits: Number(
            usage.reduce((acc, row) => acc + toWeightedCredits([{
              event_type: row.event_type,
              unit: row.unit,
              quantity: Number((row as any).quantity || 0),
            }], creditWeights), 0).toFixed(2)
          ),
        },
        previous: {
          totalCostUsd: Number(prevTotalCostUsd.toFixed(8)),
          eventCount: prevRows.length,
          totalCredits: prevTotalCredits,
        },
        deltaPct: {
          totalCostUsd: percentDelta(totalCostUsd, prevTotalCostUsd),
          eventCount: percentDelta(usage.length, prevRows.length),
          totalCredits: percentDelta(
            usage.reduce((acc, row) => acc + toWeightedCredits([{
              event_type: row.event_type,
              unit: row.unit,
              quantity: Number((row as any).quantity || 0),
            }], creditWeights), 0),
            prevTotalCredits
          ),
        },
      },
      totalCostUsd,
      eventCount: usage.length,
      workspaces,
      topWorkspaces,
      topUsers,
      topModels,
      topCarousels,
      modelEffectiveness,
      userCreditBreakdown,
      daily,
      creditUsage,
      budgetUsage,
      costGuardrails,
      monthlyProjection,
      planMarginSimulation,
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
