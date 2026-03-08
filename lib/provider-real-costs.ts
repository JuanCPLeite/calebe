export type SupportedCostProvider = 'openai' | 'anthropic'

export interface ProviderDailyCost {
  provider: SupportedCostProvider
  costDate: string // YYYY-MM-DD
  totalCostUsd: number
  currency: 'USD'
  metadata?: Record<string, unknown>
}

function dateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function fromUnixToDateOnly(unixSeconds: number | null | undefined): string | null {
  const n = Number(unixSeconds || 0)
  if (!Number.isFinite(n) || n <= 0) return null
  return dateOnlyIso(new Date(n * 1000))
}

function toMoney(value: unknown): number {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Number(n.toFixed(8))
}

export async function fetchOpenAIDailyCosts(apiKey: string, days: number): Promise<ProviderDailyCost[]> {
  if (!apiKey) return []
  const now = new Date()
  const endUnix = Math.floor(now.getTime() / 1000)
  const startUnix = Math.floor(new Date(now.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000).getTime() / 1000)

  const url = new URL('https://api.openai.com/v1/organization/costs')
  url.searchParams.set('start_time', String(startUnix))
  url.searchParams.set('end_time', String(endUnix))
  url.searchParams.set('bucket_width', '1d')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI costs API falhou (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = await res.json().catch(() => ({}))
  const rows: ProviderDailyCost[] = []
  const rawBuckets = Array.isArray((json as any)?.data) ? (json as any).data : []
  for (const bucket of rawBuckets) {
    const day = fromUnixToDateOnly(bucket?.start_time) || fromUnixToDateOnly(bucket?.end_time)
    if (!day) continue

    let totalUsd = 0
    const amountValue = Number(bucket?.amount?.value || 0)
    if (Number.isFinite(amountValue) && amountValue > 0) totalUsd += amountValue

    const results = Array.isArray(bucket?.results) ? bucket.results : []
    for (const result of results) {
      const v = Number(result?.amount?.value || result?.cost || 0)
      if (Number.isFinite(v) && v > 0) totalUsd += v
    }

    const lineItems = Array.isArray(bucket?.line_items) ? bucket.line_items : []
    for (const item of lineItems) {
      const v = Number(item?.amount?.value || item?.cost || 0)
      if (Number.isFinite(v) && v > 0) totalUsd += v
    }

    totalUsd = toMoney(totalUsd)
    if (totalUsd <= 0) continue
    rows.push({
      provider: 'openai',
      costDate: day,
      totalCostUsd: totalUsd,
      currency: 'USD',
      metadata: { source: 'openai.organization.costs' },
    })
  }
  return rows
}

export async function fetchAnthropicDailyCosts(apiKey: string, days: number): Promise<ProviderDailyCost[]> {
  if (!apiKey) return []
  const now = new Date()
  const startDate = new Date(now.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000)
  const payload = {
    starting_at: startDate.toISOString(),
    ending_at: now.toISOString(),
    granularity: 'day',
  }

  const res = await fetch('https://api.anthropic.com/v1/organizations/cost_report', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic cost_report falhou (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = await res.json().catch(() => ({}))
  const rows: ProviderDailyCost[] = []
  const rawBuckets = Array.isArray((json as any)?.data)
    ? (json as any).data
    : Array.isArray((json as any)?.results)
      ? (json as any).results
      : []
  for (const bucket of rawBuckets) {
    const day = String(bucket?.date || bucket?.starting_at || bucket?.start_time || '').slice(0, 10)
    if (!day || day.length !== 10) continue
    const totalUsd = toMoney(
      bucket?.total_cost_usd ??
      bucket?.cost_usd ??
      bucket?.amount?.value ??
      bucket?.total_cost ??
      0
    )
    if (totalUsd <= 0) continue
    rows.push({
      provider: 'anthropic',
      costDate: day,
      totalCostUsd: totalUsd,
      currency: 'USD',
      metadata: { source: 'anthropic.organizations.cost_report' },
    })
  }
  return rows
}

