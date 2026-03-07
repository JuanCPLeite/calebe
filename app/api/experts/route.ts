import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type WorkspacePlan = 'starter' | 'pro' | 'agency'

function normalizePlan(value: unknown): WorkspacePlan {
  if (value === 'pro' || value === 'agency') return value
  return 'starter'
}

function getExpertLimit(plan: WorkspacePlan): number {
  if (plan === 'agency') return 5
  if (plan === 'pro') return 3
  return 1
}

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null as null }
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id, active_expert_id')
    .eq('id', user.id)
    .maybeSingle()

  const workspaceId = (profile as any)?.workspace_id as string | null | undefined
  if (!workspaceId) return NextResponse.json({ experts: [], activeExpertId: null })

  const { data: experts } = await supabase
    .from('experts')
    .select('id, display_name, handle, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  const expertIds = (experts || []).map((e) => e.id)
  let photoCountMap: Record<string, number> = {}
  if (expertIds.length > 0) {
    const { data: photos } = await supabase
      .from('expert_photos')
      .select('expert_id')
      .in('expert_id', expertIds)
    for (const row of photos || []) {
      photoCountMap[row.expert_id] = (photoCountMap[row.expert_id] || 0) + 1
    }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .maybeSingle()
  const plan = normalizePlan((workspace as any)?.plan)
  const expertLimit = getExpertLimit(plan)
  const expertsWithCounts = (experts || []).map((e) => ({
    ...e,
    photos_count: photoCountMap[e.id] || 0,
  }))

  return NextResponse.json({
    experts: expertsWithCounts,
    activeExpertId: (profile as any)?.active_expert_id || null,
    workspaceId,
    workspacePlan: plan,
    expertLimit,
    canCreateMore: expertsWithCounts.length < expertLimit,
  })
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const handleInput = typeof body.handle === 'string' ? body.handle.trim() : ''

  if (!displayName) {
    return NextResponse.json({ error: 'displayName é obrigatório' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  const workspaceId = (profile as any)?.workspace_id as string | null | undefined
  if (!workspaceId) {
    return NextResponse.json({ error: 'Usuário sem workspace ativo' }, { status: 400 })
  }

  const handle = handleInput ? (handleInput.startsWith('@') ? handleInput : `@${handleInput}`) : ''

  const { data: expert, error } = await supabase
    .from('experts')
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      display_name: displayName,
      handle,
      highlight_color: '#9B59FF',
      updated_at: new Date().toISOString(),
    })
    .select('id, display_name, handle, updated_at')
    .single()

  if (error || !expert) {
    return NextResponse.json({ error: 'Falha ao criar expert' }, { status: 500 })
  }

  await supabase
    .from('profiles')
    .update({ active_expert_id: expert.id })
    .eq('id', user.id)

  return NextResponse.json({ expert, activeExpertId: expert.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const activeExpertId = typeof body.activeExpertId === 'string' ? body.activeExpertId.trim() : ''
  if (!activeExpertId) {
    return NextResponse.json({ error: 'activeExpertId é obrigatório' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle()
  const workspaceId = (profile as any)?.workspace_id as string | null | undefined
  if (!workspaceId) return NextResponse.json({ error: 'Usuário sem workspace ativo' }, { status: 400 })

  const { data: expert } = await supabase
    .from('experts')
    .select('id')
    .eq('id', activeExpertId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!expert) return NextResponse.json({ error: 'Expert não encontrado no workspace atual' }, { status: 404 })

  const { error } = await supabase
    .from('profiles')
    .update({ active_expert_id: activeExpertId })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'Falha ao trocar expert ativo' }, { status: 500 })
  return NextResponse.json({ ok: true, activeExpertId })
}
