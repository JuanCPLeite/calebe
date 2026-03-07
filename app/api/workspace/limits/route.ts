import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceCreditUsage } from '@/lib/credit-limits'
import { getWorkspacePlanLimits } from '@/lib/plan-limits'
import { getWorkspaceBudgetUsage } from '@/lib/cost-guardrails'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_PLAN_CONFIGS, parsePlanConfigs } from '@/lib/plan-config'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  const workspaceId = (profile as any)?.workspace_id as string | null | undefined
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
  }

  const [planLimits, creditUsage, budgetUsage] = await Promise.all([
    getWorkspacePlanLimits(workspaceId),
    getWorkspaceCreditUsage(workspaceId),
    getWorkspaceBudgetUsage(workspaceId),
  ])

  let recommendation: {
    recommendedPlanId: string
    recommendedPlanLabel: string
    reason: string
  } | null = null

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('app_settings')
      .select('plan_configs')
      .eq('id', APP_SETTINGS_ID)
      .maybeSingle()
    const plans = parsePlanConfigs((data as any)?.plan_configs || DEFAULT_PLAN_CONFIGS)
    const currentIndex = Math.max(0, plans.findIndex((p) => p.id === planLimits.planId))
    const nextPlan = plans[currentIndex + 1]
    const creditPercent = Math.round((creditUsage.usedCredits / Math.max(1, creditUsage.creditLimit)) * 100)
    const budgetPercent = budgetUsage.budgetLimitUsd > 0
      ? Math.round((budgetUsage.usedBudgetUsd / Math.max(0.00000001, budgetUsage.budgetLimitUsd)) * 100)
      : 0
    if (nextPlan && (creditPercent >= 90 || budgetPercent >= 90)) {
      recommendation = {
        recommendedPlanId: nextPlan.id,
        recommendedPlanLabel: nextPlan.label || nextPlan.id,
        reason: creditPercent >= 90
          ? `Uso de créditos em ${creditPercent}% no plano atual.`
          : `Uso de orçamento em ${budgetPercent}% no plano atual.`,
      }
    }
  } catch {
    recommendation = null
  }

  return NextResponse.json({
    workspaceId,
    planId: planLimits.planId,
    planLabel: planLimits.planLabel,
    memberLimit: planLimits.memberLimit,
    expertLimit: planLimits.expertLimit,
    monthlyPostCredits: planLimits.monthlyPostCredits,
    usedCredits: creditUsage.usedCredits,
    remainingCredits: creditUsage.remainingCredits,
    usagePercent: Math.round((creditUsage.usedCredits / Math.max(1, creditUsage.creditLimit)) * 100),
    budgetLimitUsd: budgetUsage.budgetLimitUsd,
    usedBudgetUsd: budgetUsage.usedBudgetUsd,
    remainingBudgetUsd: Number.isFinite(budgetUsage.remainingBudgetUsd) ? budgetUsage.remainingBudgetUsd : null,
    budgetUsagePercent: budgetUsage.usagePercent,
    canGenerate: creditUsage.usedCredits < creditUsage.creditLimit && !(budgetUsage.blocking && budgetUsage.exceeded),
    recommendation,
  })
}
