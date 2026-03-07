import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspacePlanLimits } from '@/lib/plan-limits'

export interface WorkspaceCreditUsage {
  planId: string
  planLabel: string
  usedCredits: number
  creditLimit: number
  remainingCredits: number
}

type UsageRow = {
  event_type: string
  unit: string
  quantity: number | null
}

// Regua inicial de credito por acao (pode evoluir para configuracao em app_settings).
export const CREDIT_WEIGHTS = {
  contentRender: 1,
  imageGenerate: 0.25,
  publish: 0,
} as const

function monthStartIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

export function toWeightedCredits(rows: UsageRow[]): number {
  let credits = 0
  for (const row of rows || []) {
    const qty = Number(row.quantity || 0)
    if (qty <= 0) continue
    if (row.event_type === 'content.generate' && row.unit === 'render') {
      credits += qty * CREDIT_WEIGHTS.contentRender
      continue
    }
    if (row.event_type === 'image.generate' && row.unit === 'image') {
      credits += qty * CREDIT_WEIGHTS.imageGenerate
      continue
    }
    if (row.event_type === 'publish' && row.unit === 'publish') {
      credits += qty * CREDIT_WEIGHTS.publish
      continue
    }
  }
  return Number(credits.toFixed(2))
}

export async function getWorkspaceCreditUsage(workspaceId: string): Promise<WorkspaceCreditUsage> {
  const admin = createAdminClient()
  const [limits, usageRes, legacyCarouselCountRes] = await Promise.all([
    getWorkspacePlanLimits(workspaceId),
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
  const weightedUsage = toWeightedCredits((usageRes.data || []) as UsageRow[])
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
