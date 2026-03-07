import { createAdminClient } from '@/lib/supabase/admin'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export interface CostGuardrails {
  defaultMonthlyBudgetUsd: number
  warnAtPercent: number
  blockOnBudgetExceeded: boolean
  workspaceMonthlyBudgetUsd: Record<string, number>
}

export interface WorkspaceBudgetUsage {
  budgetLimitUsd: number
  usedBudgetUsd: number
  remainingBudgetUsd: number
  usagePercent: number
  warning: boolean
  exceeded: boolean
  blocking: boolean
}

export const DEFAULT_COST_GUARDRAILS: CostGuardrails = {
  defaultMonthlyBudgetUsd: 0,
  warnAtPercent: 80,
  blockOnBudgetExceeded: true,
  workspaceMonthlyBudgetUsd: {},
}

function toMoney(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Number(parsed.toFixed(2))
}

function toPercent(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(100, Math.round(parsed)))
}

export function parseCostGuardrails(input: unknown): CostGuardrails {
  const source = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const workspaceSource = (source.workspaceMonthlyBudgetUsd && typeof source.workspaceMonthlyBudgetUsd === 'object')
    ? (source.workspaceMonthlyBudgetUsd as Record<string, unknown>)
    : {}

  const workspaceMonthlyBudgetUsd: Record<string, number> = {}
  for (const [workspaceId, rawValue] of Object.entries(workspaceSource)) {
    const value = toMoney(rawValue, -1)
    if (value >= 0) workspaceMonthlyBudgetUsd[workspaceId] = value
  }

  return {
    defaultMonthlyBudgetUsd: toMoney(source.defaultMonthlyBudgetUsd, DEFAULT_COST_GUARDRAILS.defaultMonthlyBudgetUsd),
    warnAtPercent: toPercent(source.warnAtPercent, DEFAULT_COST_GUARDRAILS.warnAtPercent),
    blockOnBudgetExceeded: source.blockOnBudgetExceeded !== false,
    workspaceMonthlyBudgetUsd,
  }
}

function isMissingColumnError(message: string): boolean {
  const lower = (message || '').toLowerCase()
  return lower.includes('cost_guardrails_json') && (lower.includes('column') || lower.includes('schema cache'))
}

export async function getCostGuardrails(): Promise<CostGuardrails> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_settings')
    .select('cost_guardrails_json')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  if (error && !isMissingColumnError(error.message || '')) {
    throw new Error(error.message || 'Falha ao carregar guardrails de custo')
  }

  return parseCostGuardrails((data as any)?.cost_guardrails_json)
}

function monthStartIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

export async function getWorkspaceMonthlyCostUsd(workspaceId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('usage_events')
    .select('total_cost_usd')
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStartIso())
    .limit(50000)

  let total = 0
  for (const row of data || []) {
    total += Number(row.total_cost_usd || 0)
  }
  return Number(total.toFixed(8))
}

export async function getWorkspaceBudgetUsage(
  workspaceId: string,
  guardrails?: CostGuardrails
): Promise<WorkspaceBudgetUsage> {
  const resolvedGuardrails = guardrails || await getCostGuardrails()
  const usedBudgetUsd = await getWorkspaceMonthlyCostUsd(workspaceId)
  const override = resolvedGuardrails.workspaceMonthlyBudgetUsd[workspaceId]
  const budgetLimitUsd = Number((override ?? resolvedGuardrails.defaultMonthlyBudgetUsd ?? 0).toFixed(2))
  const hasBudget = budgetLimitUsd > 0
  const remainingBudgetUsd = hasBudget
    ? Number(Math.max(0, budgetLimitUsd - usedBudgetUsd).toFixed(8))
    : Number.POSITIVE_INFINITY
  const usagePercent = hasBudget
    ? Math.round((usedBudgetUsd / Math.max(0.00000001, budgetLimitUsd)) * 100)
    : 0
  const exceeded = hasBudget ? usedBudgetUsd >= budgetLimitUsd : false
  const warning = hasBudget ? usagePercent >= resolvedGuardrails.warnAtPercent : false

  return {
    budgetLimitUsd,
    usedBudgetUsd,
    remainingBudgetUsd,
    usagePercent,
    warning,
    exceeded,
    blocking: resolvedGuardrails.blockOnBudgetExceeded,
  }
}

export async function assertWorkspaceBudgetAvailable(workspaceId: string): Promise<{
  ok: boolean
  usage: WorkspaceBudgetUsage
}> {
  const guardrails = await getCostGuardrails()
  const usage = await getWorkspaceBudgetUsage(workspaceId, guardrails)
  const ok = !(usage.blocking && usage.exceeded)
  return { ok, usage }
}

