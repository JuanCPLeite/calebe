import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchUsdToBrlRate } from '@/lib/fx-rates'
import { fetchAnthropicDailyCosts, fetchOpenAIDailyCosts } from '@/lib/provider-real-costs'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

async function ensureOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'owner') return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  return { user }
}

export async function POST(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const daysRaw = Number(body.days || 30)
  const days = Number.isFinite(daysRaw) ? Math.min(365, Math.max(1, Math.floor(daysRaw))) : 30

  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('app_settings')
    .select('openai_key, anthropic_key')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  const openaiKey = String((settings as any)?.openai_key || '').trim()
  const anthropicKey = String((settings as any)?.anthropic_key || '').trim()

  const errors: string[] = []
  const rows: Array<{
    provider: string
    cost_date: string
    total_cost_usd: number
    usd_to_brl: number
    total_cost_brl: number
    metadata: Record<string, unknown>
    source: string
    synced_at: string
  }> = []

  let usdToBrl = 0
  try {
    usdToBrl = await fetchUsdToBrlRate()
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Falha ao obter câmbio USD/BRL' }, { status: 500 })
  }

  const syncedAt = new Date().toISOString()

  if (openaiKey) {
    try {
      const openaiRows = await fetchOpenAIDailyCosts(openaiKey, days)
      for (const row of openaiRows) {
        rows.push({
          provider: row.provider,
          cost_date: row.costDate,
          total_cost_usd: row.totalCostUsd,
          usd_to_brl: usdToBrl,
          total_cost_brl: Number((row.totalCostUsd * usdToBrl).toFixed(8)),
          metadata: row.metadata || {},
          source: 'provider_api',
          synced_at: syncedAt,
        })
      }
    } catch (err: any) {
      errors.push(`OpenAI: ${err.message || 'falha desconhecida'}`)
    }
  } else {
    errors.push('OpenAI: chave não configurada em app_settings')
  }

  if (anthropicKey) {
    try {
      const anthropicRows = await fetchAnthropicDailyCosts(anthropicKey, days)
      for (const row of anthropicRows) {
        rows.push({
          provider: row.provider,
          cost_date: row.costDate,
          total_cost_usd: row.totalCostUsd,
          usd_to_brl: usdToBrl,
          total_cost_brl: Number((row.totalCostUsd * usdToBrl).toFixed(8)),
          metadata: row.metadata || {},
          source: 'provider_api',
          synced_at: syncedAt,
        })
      }
    } catch (err: any) {
      errors.push(`Anthropic: ${err.message || 'falha desconhecida'}`)
    }
  } else {
    errors.push('Anthropic: chave não configurada em app_settings')
  }

  // Google/Gemini: usa ledger interno de usage_events (imagens) como custo diário.
  // Mantém Google no painel de custo real operacional mesmo sem API de billing direta aqui.
  try {
    const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data: googleUsageRows, error: googleUsageError } = await admin
      .from('usage_events')
      .select('created_at, total_cost_usd')
      .eq('provider', 'google')
      .gte('created_at', fromIso)
      .limit(50000)
    if (googleUsageError) {
      errors.push(`Google/Gemini: falha ao consultar usage_events (${googleUsageError.message})`)
    } else {
      const byDay = new Map<string, number>()
      for (const row of googleUsageRows || []) {
        const day = String(row.created_at || '').slice(0, 10)
        if (!day) continue
        byDay.set(day, (byDay.get(day) || 0) + Number(row.total_cost_usd || 0))
      }
      for (const [costDate, totalUsdRaw] of byDay.entries()) {
        const totalCostUsd = Number(totalUsdRaw.toFixed(8))
        rows.push({
          provider: 'google',
          cost_date: costDate,
          total_cost_usd: totalCostUsd,
          usd_to_brl: usdToBrl,
          total_cost_brl: Number((totalCostUsd * usdToBrl).toFixed(8)),
          metadata: { source: 'usage_events.google' },
          source: 'internal_ledger',
          synced_at: syncedAt,
        })
      }
    }
  } catch (err: any) {
    errors.push(`Google/Gemini: ${err.message || 'falha desconhecida'}`)
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from('provider_daily_costs')
      .upsert(rows, { onConflict: 'provider,cost_date,source' })
    if (error) {
      return NextResponse.json({ error: error.message || 'Falha ao salvar custos reais' }, { status: 500 })
    }
  }

  return NextResponse.json({
    days,
    usdToBrl,
    syncedAt,
    savedRows: rows.length,
    errors,
  })
}
