import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string | null }>()

  const displayName =
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    ''

  return NextResponse.json({
    email: user.email || '',
    displayName,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''

  if (!displayName) {
    return NextResponse.json({ error: 'displayName é obrigatório' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: displayName })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Falha ao salvar configurações' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, displayName })
}
