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

async function fetchKey(provider: Provider) {
  const admin = createAdminClient()
  const column = providerToColumn[provider]
  const { data } = await admin
    .from('app_settings')
    .select(column)
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()
  const row = (data || {}) as Record<string, unknown>
  return ((row[column] as string | undefined) || '').trim()
}

async function testProvider(provider: Provider, key: string): Promise<{ ok: boolean; detail: string }> {
  if (!key) return { ok: false, detail: 'Chave vazia' }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!res.ok) return { ok: false, detail: `Anthropic HTTP ${res.status}` }
    return { ok: true, detail: 'Conexão Anthropic OK' }
  }

  if (provider === 'google') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`)
    if (!res.ok) return { ok: false, detail: `Google HTTP ${res.status}` }
    return { ok: true, detail: 'Conexão Google OK' }
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return { ok: false, detail: `OpenAI HTTP ${res.status}` }
    return { ok: true, detail: 'Conexão OpenAI OK' }
  }

  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'test', numResults: 1, type: 'neural' }),
  })
  if (!res.ok) return { ok: false, detail: `EXA HTTP ${res.status}` }
  return { ok: true, detail: 'Conexão EXA OK' }
}

export async function POST(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const provider = body.provider
  if (!isProvider(provider)) {
    return NextResponse.json({ error: 'provider inválido' }, { status: 400 })
  }

  try {
    const key = await fetchKey(provider)
    const result = await testProvider(provider, key)
    return NextResponse.json({ provider, ...result })
  } catch (err: any) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/settings/test', method: 'POST', provider, error: err.message || 'unknown' },
    })
    return NextResponse.json({ provider, ok: false, detail: err.message || 'Erro no teste' }, { status: 500 })
  }
}
