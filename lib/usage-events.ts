import { createAdminClient } from '@/lib/supabase/admin'

export interface UsageEventInput {
  workspaceId?: string | null
  userId?: string | null
  carouselId?: string | null
  provider: string
  model?: string | null
  eventType: string
  unit: string
  quantity: number
  metadata?: Record<string, unknown>
}

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

async function resolveUnitCostUsd(
  provider: string,
  model: string,
  unit: string
): Promise<number> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const specific = await admin
    .from('provider_price_catalog')
    .select('price_per_unit')
    .eq('provider', provider)
    .eq('model', model)
    .eq('unit', unit)
    .lte('effective_from', nowIso)
    .order('effective_from', { ascending: false })
    .limit(1)

  const specificPrice = Number(specific.data?.[0]?.price_per_unit || 0)
  if (specificPrice > 0) return specificPrice

  const fallback = await admin
    .from('provider_price_catalog')
    .select('price_per_unit')
    .eq('provider', provider)
    .eq('model', '')
    .eq('unit', unit)
    .lte('effective_from', nowIso)
    .order('effective_from', { ascending: false })
    .limit(1)

  return Number(fallback.data?.[0]?.price_per_unit || 0)
}

/**
 * Registra consumo/custo em usage_events via service_role.
 * Nunca lança erro para nao quebrar o fluxo principal.
 */
export async function recordUsageEvent(input: UsageEventInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const model = (input.model || '').trim()
    const quantity = clampQuantity(input.quantity)
    const unitCostUsd = await resolveUnitCostUsd(input.provider, model, input.unit)
    const totalCostUsd = Number((quantity * unitCostUsd).toFixed(8))

    const { error } = await admin.from('usage_events').insert({
      workspace_id: input.workspaceId || null,
      user_id: input.userId || null,
      carousel_id: input.carouselId || null,
      provider: input.provider,
      model,
      event_type: input.eventType,
      unit: input.unit,
      quantity,
      unit_cost_usd: unitCostUsd,
      total_cost_usd: totalCostUsd,
      metadata: input.metadata || {},
    })

    if (error) {
      console.error('[usage-events] Falha ao salvar usage_event:', error.message)
    }
  } catch (err: any) {
    console.error('[usage-events] Erro inesperado:', err?.message || err)
  }
}

