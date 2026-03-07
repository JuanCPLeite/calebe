import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_COST_GUARDRAILS, parseCostGuardrails } from '@/lib/cost-guardrails'

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

function isMissingColumnError(message: string): boolean {
  const lower = (message || '').toLowerCase()
  return lower.includes('cost_guardrails_json') && (lower.includes('column') || lower.includes('schema cache'))
}

export async function GET() {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_settings')
    .select('cost_guardrails_json')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  if (error && !isMissingColumnError(error.message || '')) {
    return NextResponse.json({ error: error.message || 'Falha ao carregar guardrails' }, { status: 500 })
  }

  return NextResponse.json({
    guardrails: parseCostGuardrails((data as any)?.cost_guardrails_json),
    defaults: DEFAULT_COST_GUARDRAILS,
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const incoming = parseCostGuardrails(body.guardrails || body)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_settings')
    .upsert(
      {
        id: APP_SETTINGS_ID,
        cost_guardrails_json: incoming,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      },
      { onConflict: 'id' }
    )
    .select('cost_guardrails_json')
    .single()

  if (error) {
    if (isMissingColumnError(error.message || '')) {
      return NextResponse.json(
        { error: 'Coluna cost_guardrails_json não encontrada. Rode o schema atualizado.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message || 'Falha ao salvar guardrails' }, { status: 500 })
  }

  return NextResponse.json({ guardrails: parseCostGuardrails((data as any)?.cost_guardrails_json) })
}

