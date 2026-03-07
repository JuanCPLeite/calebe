import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'
import { DEFAULT_PLAN_CONFIGS, parsePlanConfigs, findPlanById, type PlanConfig } from '@/lib/plan-config'
import { toWeightedCredits, parseCreditWeights } from '@/lib/credit-limits'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'
type WorkspaceBase = {
  id: string
  name: string
  slug: string
  plan: string
  owner_id: string | null
  active: boolean
  created_at: string
}

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

async function getPlanConfigs(admin: ReturnType<typeof createAdminClient>): Promise<PlanConfig[]> {
  const { data } = await admin
    .from('app_settings')
    .select('plan_configs')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  return parsePlanConfigs((data as any)?.plan_configs || DEFAULT_PLAN_CONFIGS)
}

function asIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function latestDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

async function enrichWorkspaces(
  admin: ReturnType<typeof createAdminClient>,
  workspaces: WorkspaceBase[],
  plans: PlanConfig[]
) {
  if (workspaces.length === 0) return []

  const workspaceIds = workspaces.map((w) => w.id)
  const last30Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const recentLogsDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const monthStartDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()

  const [membersRes, carouselsRes, usageRes, logsRes, monthCarouselsRes, settingsRes] = await Promise.all([
    admin.from('workspace_members').select('workspace_id').in('workspace_id', workspaceIds),
    admin
      .from('carousels')
      .select('workspace_id, created_at, ig_post_id')
      .in('workspace_id', workspaceIds),
    admin
      .from('usage_events')
      .select('workspace_id, created_at, event_type, unit, quantity')
      .in('workspace_id', workspaceIds)
      .in('event_type', ['content.generate', 'image.generate', 'publish'])
      .in('unit', ['render', 'image', 'publish']),
    admin
      .from('system_logs')
      .select('workspace_id, created_at')
      .in('workspace_id', workspaceIds)
      .gte('created_at', recentLogsDate),
    admin
      .from('carousels')
      .select('workspace_id')
      .in('workspace_id', workspaceIds)
      .gte('created_at', monthStartDate),
    admin
      .from('app_settings')
      .select('credit_weights_json')
      .eq('id', APP_SETTINGS_ID)
      .maybeSingle(),
  ])
  const creditWeights = parseCreditWeights((settingsRes.data as any)?.credit_weights_json)

  const memberCounts = new Map<string, number>()
  for (const row of membersRes.data || []) {
    memberCounts.set(row.workspace_id, (memberCounts.get(row.workspace_id) || 0) + 1)
  }

  const usageByWorkspace = new Map<string, { generatedTotal: number; generatedLast30: number; generatedThisMonth: number; publishedTotal: number; creditsThisMonth: number }>()
  for (const workspaceId of workspaceIds) {
    usageByWorkspace.set(workspaceId, {
      generatedTotal: 0,
      generatedLast30: 0,
      generatedThisMonth: 0,
      publishedTotal: 0,
      creditsThisMonth: 0,
    })
  }

  for (const row of usageRes.data || []) {
    const entry = usageByWorkspace.get(row.workspace_id)
    if (!entry) continue

    const isGenerated = row.event_type === 'content.generate' && row.unit === 'render'
    const isPublished = row.event_type === 'publish' && row.unit === 'publish'
    if (isGenerated) {
      entry.generatedTotal += 1
      if (row.created_at && row.created_at >= last30Date) entry.generatedLast30 += 1
      if (row.created_at && row.created_at >= monthStartDate) entry.generatedThisMonth += 1
    }
    if (isPublished) {
      entry.publishedTotal += 1
    }
    if (row.created_at && row.created_at >= monthStartDate) {
      entry.creditsThisMonth = Number((entry.creditsThisMonth + toWeightedCredits([{
        event_type: row.event_type,
        unit: row.unit,
        quantity: Number((row as any).quantity || 0),
      }], creditWeights)).toFixed(2))
    }
  }

  const monthCarouselFallback = new Map<string, number>()
  for (const row of monthCarouselsRes.data || []) {
    monthCarouselFallback.set(row.workspace_id, (monthCarouselFallback.get(row.workspace_id) || 0) + 1)
  }

  const usage = new Map<
    string,
    { total: number; published: number; last30: number; lastActivity: string | null }
  >()
  for (const workspace of workspaces) {
    usage.set(workspace.id, {
      total: 0,
      published: 0,
      last30: 0,
      lastActivity: asIso(workspace.created_at),
    })
  }

  for (const carousel of carouselsRes.data || []) {
    const entry = usage.get(carousel.workspace_id)
    if (!entry) continue
    // Fallback legado para bases ainda sem usage_events completos.
    entry.total += 1
    if (carousel.ig_post_id) entry.published += 1
    if (carousel.created_at && carousel.created_at >= last30Date) entry.last30 += 1
    entry.lastActivity = latestDate(entry.lastActivity, asIso(carousel.created_at))
  }

  for (const logEntry of logsRes.data || []) {
    const entry = usage.get(logEntry.workspace_id)
    if (!entry) continue
    entry.lastActivity = latestDate(entry.lastActivity, asIso(logEntry.created_at))
  }

  return workspaces.map((workspace) => {
    const workspaceUsage = usage.get(workspace.id)
    const usageEvents = usageByWorkspace.get(workspace.id)
    const plan = findPlanById(plans, workspace.plan) || plans[0] || DEFAULT_PLAN_CONFIGS[0]
    const generatedTotal = Math.max(usageEvents?.generatedTotal || 0, workspaceUsage?.total || 0)
    const generatedLast30 = Math.max(usageEvents?.generatedLast30 || 0, workspaceUsage?.last30 || 0)
    const publishedTotal = Math.max(usageEvents?.publishedTotal || 0, workspaceUsage?.published || 0)
    const monthlyCreditsUsed = Math.max(usageEvents?.creditsThisMonth || 0, monthCarouselFallback.get(workspace.id) || 0)
    const monthlyCreditsLimit = plan?.monthlyPostCredits || 1
    const monthlyCreditsPercent = Math.round((monthlyCreditsUsed / Math.max(1, monthlyCreditsLimit)) * 100)
    return {
      ...workspace,
      member_count: memberCounts.get(workspace.id) || 0,
      member_limit: plan?.memberLimit || 1,
      total_carousels: generatedTotal,
      total_published: publishedTotal,
      carousels_last_30d: generatedLast30,
      last_activity_at: workspaceUsage?.lastActivity || null,
      monthly_credits_used: monthlyCreditsUsed,
      monthly_credits_limit: monthlyCreditsLimit,
      monthly_credits_percent: monthlyCreditsPercent,
    }
  })
}

export async function GET(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const planConfigs = await getPlanConfigs(admin)
  const allowedPlanIds = planConfigs.map((p) => p.id)
  const url = new URL(req.url)
  const search = (url.searchParams.get('search') || '').trim()
  const plan = (url.searchParams.get('plan') || '').trim()
  const activeParam = (url.searchParams.get('active') || '').trim().toLowerCase()

  let query = admin
    .from('workspaces')
    .select('id, name, slug, plan, owner_id, active, created_at')
    .order('created_at', { ascending: false })

  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
  if (plan && allowedPlanIds.includes(plan)) query = query.eq('plan', plan)
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

  const workspaces = await enrichWorkspaces(admin, (data || []) as WorkspaceBase[], planConfigs)
  return NextResponse.json({ workspaces })
}

export async function POST(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const providedSlug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const plan = typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : ''
  const ownerUserId = typeof body.ownerUserId === 'string' ? body.ownerUserId.trim() : ''

  if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const planConfigs = await getPlanConfigs(admin)
  const allowedPlanIds = planConfigs.map((p) => p.id)
  if (!plan || !allowedPlanIds.includes(plan)) {
    return NextResponse.json({ error: `plan invalido (use: ${allowedPlanIds.join(', ')})` }, { status: 400 })
  }
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

  const [enrichedWorkspace] = await enrichWorkspaces(admin, [workspace as WorkspaceBase], planConfigs)
  return NextResponse.json({ workspace: enrichedWorkspace || workspace }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const workspaceId = typeof body.id === 'string' ? body.id.trim() : ''

  if (!workspaceId) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') updates.active = body.active
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()

  if (typeof body.plan === 'string' && body.plan.trim()) {
    const admin = createAdminClient()
    const planConfigs = await getPlanConfigs(admin)
    const allowedPlanIds = planConfigs.map((p) => p.id)
    const plan = body.plan.trim().toLowerCase()
    if (!allowedPlanIds.includes(plan)) {
      return NextResponse.json({ error: `plan invalido (use: ${allowedPlanIds.join(', ')})` }, { status: 400 })
    }
    updates.plan = plan
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualização' }, { status: 400 })
  }

  const admin = createAdminClient()
  const planConfigs = await getPlanConfigs(admin)
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

  const [enrichedWorkspace] = await enrichWorkspaces(admin, [workspace as WorkspaceBase], planConfigs)
  return NextResponse.json({ workspace: enrichedWorkspace || workspace })
}
