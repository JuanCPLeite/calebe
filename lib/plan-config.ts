export interface PlanConfig {
  id: string
  label: string
  expertLimit: number
  description: string
}

export const DEFAULT_PLAN_CONFIGS: PlanConfig[] = [
  {
    id: 'starter',
    label: 'Starter',
    expertLimit: 1,
    description: 'Plano de entrada com 1 expert ativo por workspace.',
  },
  {
    id: 'pro',
    label: 'Pro',
    expertLimit: 3,
    description: 'Plano intermediario com ate 3 experts por workspace.',
  },
  {
    id: 'agency',
    label: 'Agency',
    expertLimit: 5,
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

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  if (normalized < 1) return 1
  if (normalized > 100) return 100
  return normalized
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
    const expertLimit = toPositiveInt(item.expertLimit, 1)

    normalized.push({ id, label, expertLimit, description })
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

