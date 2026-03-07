import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_CREDIT_WEIGHTS, parseCreditWeights } from '@/lib/credit-limits'

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

export async function GET() {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data } = await admin
    .from('app_settings')
    .select('credit_weights_json')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  return NextResponse.json({
    weights: parseCreditWeights((data as any)?.credit_weights_json),
    defaults: DEFAULT_CREDIT_WEIGHTS,
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const incoming = parseCreditWeights(body.weights || body)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_settings')
    .upsert(
      {
        id: APP_SETTINGS_ID,
        credit_weights_json: incoming,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      },
      { onConflict: 'id' }
    )
    .select('credit_weights_json')
    .single()

  if (error) return NextResponse.json({ error: error.message || 'Falha ao salvar política' }, { status: 500 })
  return NextResponse.json({ weights: parseCreditWeights((data as any)?.credit_weights_json) })
}

