import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspacePlanLimits } from '@/lib/plan-limits'

export interface WorkspaceCreditUsage {
  planId: string
  planLabel: string
  usedCredits: number
  creditLimit: number
  remainingCredits: number
}

export interface CreditWeights {
  contentRender: number
  imageGenerate: number
  publish: number
}

type UsageRow = {
  event_type: string
  unit: string
  quantity: number | null
}

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export const DEFAULT_CREDIT_WEIGHTS: CreditWeights = {
  contentRender: 1,
  imageGenerate: 0.25,
  publish: 0,
}

export function parseCreditWeights(input: unknown): CreditWeights {
  const source = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  function n(key: keyof CreditWeights, fallback: number): number {
    const raw = Number(source[key])
    if (!Number.isFinite(raw) || raw < 0) return fallback
    return Number(raw.toFixed(4))
  }
  return {
    contentRender: n('contentRender', DEFAULT_CREDIT_WEIGHTS.contentRender),
    imageGenerate: n('imageGenerate', DEFAULT_CREDIT_WEIGHTS.imageGenerate),
    publish: n('publish', DEFAULT_CREDIT_WEIGHTS.publish),
  }
}

export async function getCreditWeights(): Promise<CreditWeights> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('app_settings')
    .select('credit_weights_json')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  return parseCreditWeights((data as any)?.credit_weights_json)
}

function monthStartIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

export function toWeightedCredits(rows: UsageRow[], weights: CreditWeights = DEFAULT_CREDIT_WEIGHTS): number {
  let credits = 0
  for (const row of rows || []) {
    const qty = Number(row.quantity || 0)
    if (qty <= 0) continue
    if (row.event_type === 'content.generate' && row.unit === 'render') {
      credits += qty * weights.contentRender
      continue
    }
    if (row.event_type === 'image.generate' && row.unit === 'image') {
      credits += qty * weights.imageGenerate
      continue
    }
    if (row.event_type === 'publish' && row.unit === 'publish') {
      credits += qty * weights.publish
      continue
    }
  }
  return Number(credits.toFixed(2))
}

export async function getWorkspaceCreditUsage(workspaceId: string): Promise<WorkspaceCreditUsage> {
  const admin = createAdminClient()
  const [limits, weights, usageRes, legacyCarouselCountRes] = await Promise.all([
    getWorkspacePlanLimits(workspaceId),
    getCreditWeights(),
    admin
      .from('usage_events')
      .select('event_type, unit, quantity')
      .eq('workspace_id', workspaceId)
      .in('event_type', ['content.generate', 'image.generate', 'publish'])
      .in('unit', ['render', 'image', 'publish'])
      .gte('created_at', monthStartIso()),
    admin
      .from('carousels')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', monthStartIso()),
  ])

  // usage_events e o ledger oficial. Fallback legado: carousels antigos sem evento.
  const weightedUsage = toWeightedCredits((usageRes.data || []) as UsageRow[], weights)
  const usedCredits = Math.max(weightedUsage, legacyCarouselCountRes.count || 0)
  const creditLimit = limits.monthlyPostCredits
  const remainingCredits = Number(Math.max(0, creditLimit - usedCredits).toFixed(2))

  return {
    planId: limits.planId,
    planLabel: limits.planLabel,
    usedCredits,
    creditLimit,
    remainingCredits,
  }
}

export async function assertWorkspaceCreditsAvailable(workspaceId: string): Promise<{
  ok: boolean
  usage: WorkspaceCreditUsage
}> {
  const usage = await getWorkspaceCreditUsage(workspaceId)
  return {
    ok: usage.usedCredits < usage.creditLimit,
    usage,
  }
}
