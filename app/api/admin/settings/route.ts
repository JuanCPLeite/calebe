import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

type AppSettingsRow = {
  anthropic_key: string | null
  google_key: string | null
  openai_key: string | null
  exa_key: string | null
  updated_at: string | null
  updated_by: string | null
}

function maskSecret(secret: string): string {
  if (!secret) return ''
  if (secret.length <= 4) return '*'.repeat(secret.length)
  return `${'*'.repeat(Math.max(0, secret.length - 4))}${secret.slice(-4)}`
}

function toApiResponse(row: AppSettingsRow) {
  const anthropic = row.anthropic_key ?? ''
  const google = row.google_key ?? ''
  const openai = row.openai_key ?? ''
  const exa = row.exa_key ?? ''

  return {
    keys: {
      anthropic: { configured: Boolean(anthropic), masked: maskSecret(anthropic) },
      google: { configured: Boolean(google), masked: maskSecret(google) },
      openai: { configured: Boolean(openai), masked: maskSecret(openai) },
      exa: { configured: Boolean(exa), masked: maskSecret(exa) },
    },
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
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

export async function GET() {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_settings')
    .select('anthropic_key, google_key, openai_key, exa_key, updated_at, updated_by')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/settings', method: 'GET', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao carregar configurações' }, { status: 500 })
  }

  if (!data) {
    const { error: upsertError } = await admin
      .from('app_settings')
      .upsert({ id: APP_SETTINGS_ID }, { onConflict: 'id' })

    if (upsertError) {
      return NextResponse.json({ error: 'Falha ao inicializar app_settings' }, { status: 500 })
    }

    const emptyRow: AppSettingsRow = {
      anthropic_key: '',
      google_key: '',
      openai_key: '',
      exa_key: '',
      updated_at: null,
      updated_by: null,
    }
    return NextResponse.json(toApiResponse(emptyRow))
  }

  return NextResponse.json(toApiResponse(data as AppSettingsRow))
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const updates: Record<string, string> = {}
  const changedFields: string[] = []

  const allowedFields: Array<{ api: string; db: string }> = [
    { api: 'anthropicKey', db: 'anthropic_key' },
    { api: 'googleKey', db: 'google_key' },
    { api: 'openaiKey', db: 'openai_key' },
    { api: 'exaKey', db: 'exa_key' },
    { api: 'anthropic_key', db: 'anthropic_key' },
    { api: 'google_key', db: 'google_key' },
    { api: 'openai_key', db: 'openai_key' },
    { api: 'exa_key', db: 'exa_key' },
  ]

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field.api)) {
      const value = body[field.api]
      if (typeof value !== 'string') {
        return NextResponse.json({ error: `Campo inválido: ${field.api}` }, { status: 400 })
      }
      updates[field.db] = value.trim()
      if (!changedFields.includes(field.db)) changedFields.push(field.db)
    }
  }

  if (changedFields.length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const payload = {
    id: APP_SETTINGS_ID,
    ...updates,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  }

  const { data, error } = await admin
    .from('app_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('anthropic_key, google_key, openai_key, exa_key, updated_at, updated_by')
    .single()

  if (error) {
    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/settings', method: 'PATCH', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao salvar configurações' }, { status: 500 })
  }

  log({
    event: 'settings.updated',
    userId: auth.user.id,
    payload: { fields: changedFields },
  })

  return NextResponse.json(toApiResponse(data as AppSettingsRow))
}
