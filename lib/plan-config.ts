export interface PlanConfig {
  id: string
  label: string
  expertLimit: number
  memberLimit: number
  monthlyPostCredits: number
  monthlyPriceUsd: number
  description: string
}

export const DEFAULT_PLAN_CONFIGS: PlanConfig[] = [
  {
    id: 'starter',
    label: 'Starter',
    expertLimit: 1,
    memberLimit: 1,
    monthlyPostCredits: 30,
    monthlyPriceUsd: 0,
    description: 'Plano de entrada com 1 expert ativo por workspace.',
  },
  {
    id: 'pro',
    label: 'Pro',
    expertLimit: 3,
    memberLimit: 3,
    monthlyPostCredits: 100,
    monthlyPriceUsd: 0,
    description: 'Plano intermediario com ate 3 experts por workspace.',
  },
  {
    id: 'agency',
    label: 'Agency',
    expertLimit: 5,
    memberLimit: 10,
    monthlyPostCredits: 1000,
    monthlyPriceUsd: 0,
    description: 'Plano avancado com ate 5 experts por workspace.',
  },
]

function toPlanId(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  if (normalized < 1) return 1
  if (normalized > max) return max
  return normalized
}

function toMoney(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Number(parsed.toFixed(2))
}

export function parsePlanConfigs(value: unknown): PlanConfig[] {
  if (!Array.isArray(value)) return [...DEFAULT_PLAN_CONFIGS]

  const normalized: PlanConfig[] = []
  const used = new Set<string>()

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const id = toPlanId(item.id)
    if (!id || used.has(id)) continue

    const label = typeof item.label === 'string' && item.label.trim()
      ? item.label.trim()
      : id
    const description = typeof item.description === 'string'
      ? item.description.trim().slice(0, 240)
      : ''
    const expertLimit = toPositiveInt(item.expertLimit, 1, 100)
    const memberLimit = toPositiveInt(item.memberLimit, expertLimit, 500)
    const monthlyPostCredits = toPositiveInt(item.monthlyPostCredits, 30, 100000)
    const monthlyPriceUsd = toMoney(item.monthlyPriceUsd, 0)

    normalized.push({ id, label, expertLimit, memberLimit, monthlyPostCredits, monthlyPriceUsd, description })
    used.add(id)
  }

  return normalized.length > 0 ? normalized : [...DEFAULT_PLAN_CONFIGS]
}

export function findPlanById(plans: PlanConfig[], planId: string | null | undefined): PlanConfig | null {
  const value = toPlanId(planId || '')
  if (!value) return null
  return plans.find((p) => p.id === value) || null
}

export function getExpertLimitForPlan(
  plans: PlanConfig[],
  planId: string | null | undefined
): number {
  const found = findPlanById(plans, planId)
  if (found) return found.expertLimit
  return plans[0]?.expertLimit || DEFAULT_PLAN_CONFIGS[0].expertLimit
}
