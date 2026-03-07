import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspacePlanLimits } from '@/lib/plan-limits'

export interface WorkspaceCreditUsage {
  planId: string
  planLabel: string
  usedCredits: number
  creditLimit: number
  remainingCredits: number
}

function monthStartIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

export async function getWorkspaceCreditUsage(workspaceId: string): Promise<WorkspaceCreditUsage> {
  const admin = createAdminClient()
  const [limits, usageCountRes, legacyCarouselCountRes] = await Promise.all([
    getWorkspacePlanLimits(workspaceId),
    admin
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'content.generate')
      .eq('unit', 'render')
      .gte('created_at', monthStartIso()),
    admin
      .from('carousels')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', monthStartIso()),
  ])

  // usage_events e o ledger oficial. Fallback legado: carousels antigos sem evento.
  const usedCredits = Math.max(usageCountRes.count || 0, legacyCarouselCountRes.count || 0)
  const creditLimit = limits.monthlyPostCredits
  const remainingCredits = Math.max(0, creditLimit - usedCredits)

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
