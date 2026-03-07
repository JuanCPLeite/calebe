import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_PLAN_CONFIGS, findPlanById, parsePlanConfigs, type PlanConfig } from '@/lib/plan-config'

export interface WorkspacePlanLimits {
  planId: string
  planLabel: string
  expertLimit: number
  memberLimit: number
  monthlyPostCredits: number
}

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

async function loadPlanConfigs(): Promise<PlanConfig[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('app_settings')
    .select('plan_configs')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  return parsePlanConfigs((data as any)?.plan_configs || DEFAULT_PLAN_CONFIGS)
}

export async function getWorkspacePlanLimits(workspaceId: string): Promise<WorkspacePlanLimits> {
  const admin = createAdminClient()
  const [plans, workspaceRes] = await Promise.all([
    loadPlanConfigs(),
    admin.from('workspaces').select('plan').eq('id', workspaceId).maybeSingle(),
  ])

  const planId = String((workspaceRes.data as any)?.plan || 'starter')
  const resolved = findPlanById(plans, planId) || plans[0] || DEFAULT_PLAN_CONFIGS[0]

  return {
    planId: resolved.id,
    planLabel: resolved.label || resolved.id,
    expertLimit: resolved.expertLimit,
    memberLimit: resolved.memberLimit,
    monthlyPostCredits: resolved.monthlyPostCredits,
  }
}

