import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

type SeedRow = {
  provider: string
  model: string
  unit: string
  price_per_unit: number
}

const ESTIMATED_BASELINES: SeedRow[] = [
  { provider: 'anthropic', model: 'claude-sonnet-4-5', unit: 'token_in',  price_per_unit: 0.00000300 },
  { provider: 'anthropic', model: 'claude-sonnet-4-5', unit: 'token_out', price_per_unit: 0.00001500 },
  { provider: 'anthropic', model: 'claude-opus-4-6',   unit: 'token_in',  price_per_unit: 0.00001500 },
  { provider: 'anthropic', model: 'claude-opus-4-6',   unit: 'token_out', price_per_unit: 0.00007500 },
  { provider: 'openai',    model: 'gpt-4o',            unit: 'token_in',  price_per_unit: 0.00000500 },
  { provider: 'openai',    model: 'gpt-4o',            unit: 'token_out', price_per_unit: 0.00001500 },
  { provider: 'google',    model: 'gemini-2.5-flash-image', unit: 'image',   price_per_unit: 0.04000000 },
  { provider: 'meta',      model: 'instagram-carousel',      unit: 'publish', price_per_unit: 0.00000000 },
]

export async function POST() {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const effectiveFrom = new Date().toISOString()
  const rows = ESTIMATED_BASELINES.map((item) => ({
    provider: item.provider,
    model: item.model,
    unit: item.unit,
    price_per_unit: item.price_per_unit,
    currency: 'USD',
    effective_from: effectiveFrom,
    updated_at: effectiveFrom,
    updated_by: auth.user.id,
  }))

  const { data, error } = await admin
    .from('provider_price_catalog')
    .insert(rows)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inserted: (data || []).length, estimated: true })
}

