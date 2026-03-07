import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/logger'
import { DEFAULT_PLAN_CONFIGS, parsePlanConfigs } from '@/lib/plan-config'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

async function ensureOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) }
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

function isMissingColumnError(message: string): boolean {
  const lower = (message || '').toLowerCase()
  return lower.includes('plan_configs') && (lower.includes('column') || lower.includes('schema cache'))
}

export async function GET() {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_settings')
    .select('plan_configs, updated_at')
    .eq('id', APP_SETTINGS_ID)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error.message || '')) {
      return NextResponse.json({
        plans: DEFAULT_PLAN_CONFIGS,
        readonly: true,
        migrationRequired: true,
        hint: 'Execute o novo supabase-schema.sql para habilitar plan_configs.',
      })
    }

    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/plans', method: 'GET', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao carregar planos' }, { status: 500 })
  }

  if (!data) {
    await admin.from('app_settings').upsert({ id: APP_SETTINGS_ID }, { onConflict: 'id' })
    return NextResponse.json({ plans: DEFAULT_PLAN_CONFIGS, updatedAt: null, readonly: false })
  }

  return NextResponse.json({
    plans: parsePlanConfigs((data as Record<string, unknown>).plan_configs),
    updatedAt: (data as Record<string, unknown>).updated_at || null,
    readonly: false,
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const plans = parsePlanConfigs((body as Record<string, unknown>).plans)
  if (!plans.length) {
    return NextResponse.json({ error: 'Informe pelo menos um plano' }, { status: 400 })
  }

  const admin = createAdminClient()
  const payload = {
    id: APP_SETTINGS_ID,
    plan_configs: plans,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  }

  const { data, error } = await admin
    .from('app_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('plan_configs, updated_at')
    .single()

  if (error) {
    if (isMissingColumnError(error.message || '')) {
      return NextResponse.json(
        { error: 'Coluna plan_configs nao encontrada. Rode o schema atualizado.' },
        { status: 400 }
      )
    }

    log({
      event: 'error.api',
      level: 'error',
      userId: auth.user.id,
      payload: { route: '/api/admin/plans', method: 'PATCH', error: error.message },
    })
    return NextResponse.json({ error: 'Falha ao salvar planos' }, { status: 500 })
  }

  log({
    event: 'settings.updated',
    userId: auth.user.id,
    payload: { section: 'plans', plans: plans.map((p) => p.id) },
  })

  return NextResponse.json({
    plans: parsePlanConfigs((data as Record<string, unknown>).plan_configs),
    updatedAt: (data as Record<string, unknown>).updated_at || null,
    readonly: false,
  })
}

