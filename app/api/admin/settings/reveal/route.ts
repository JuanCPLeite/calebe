import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'
type Provider = 'anthropic' | 'google' | 'openai' | 'exa'

const providerToColumn: Record<Provider, 'anthropic_key' | 'google_key' | 'openai_key' | 'exa_key'> = {
  anthropic: 'anthropic_key',
  google: 'google_key',
  openai: 'openai_key',
  exa: 'exa_key',
}

function isProvider(v: unknown): v is Provider {
  return v === 'anthropic' || v === 'google' || v === 'openai' || v === 'exa'
}

async function ensureOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }

  return { user }
}

export async function POST(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const provider = body.provider
  if (!isProvider(provider)) {
    return NextResponse.json({ error: 'provider inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const column = providerToColumn[provider]
  const { data, error } = await admin
    .from('app_settings')
    .select(column)
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/settings/reveal', method: 'POST', error: error.message, provider },
    })
    return NextResponse.json({ error: 'Falha ao revelar chave' }, { status: 500 })
  }

  const row = (data || {}) as Record<string, unknown>
  const value = (row[column] as string | undefined) || ''
  return NextResponse.json({ provider, value })
}
