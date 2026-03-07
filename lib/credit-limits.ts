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
  const [limits, countRes] = await Promise.all([
    getWorkspacePlanLimits(workspaceId),
    admin
      .from('carousels')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', monthStartIso()),
  ])

  const usedCredits = countRes.count || 0
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

