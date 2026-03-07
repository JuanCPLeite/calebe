import { NextRequest, NextResponse } from 'next/server'
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

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export async function GET() {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('provider_price_catalog')
    .select('id, provider, model, unit, price_per_unit, currency, effective_from, created_at, updated_at')
    .order('effective_from', { ascending: false })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prices: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const provider = normalizeText(body.provider).toLowerCase()
  const model = normalizeText(body.model)
  const unit = normalizeText(body.unit).toLowerCase()
  const currency = normalizeText(body.currency).toUpperCase() || 'USD'
  const effectiveFrom = normalizeText(body.effectiveFrom) || new Date().toISOString()
  const pricePerUnit = Number(body.pricePerUnit)

  if (!provider || !unit || !Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
    return NextResponse.json({ error: 'provider, unit e pricePerUnit válidos são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const payload = {
    provider,
    model,
    unit,
    price_per_unit: pricePerUnit,
    currency,
    effective_from: effectiveFrom,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  }

  const { data, error } = await admin
    .from('provider_price_catalog')
    .insert(payload)
    .select('id, provider, model, unit, price_per_unit, currency, effective_from, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ price: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = normalizeText(body.id)
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('provider_price_catalog').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

