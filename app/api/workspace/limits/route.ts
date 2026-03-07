import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceCreditUsage } from '@/lib/credit-limits'
import { getWorkspacePlanLimits } from '@/lib/plan-limits'

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

  const [planLimits, creditUsage] = await Promise.all([
    getWorkspacePlanLimits(workspaceId),
    getWorkspaceCreditUsage(workspaceId),
  ])

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
    canGenerate: creditUsage.usedCredits < creditUsage.creditLimit,
  })
}

