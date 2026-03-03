import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/carousels/[id]
 * Retorna os dados de um carrossel pelo ID.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('carousels')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[GET /api/carousels/[id]]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/carousels/[id]
 * Atualiza campos de um carrossel (slides, caption, scheduled_at).
 *
 * Body: Partial<{ slides, caption, scheduled_at }>
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    if ('slides' in body)        allowed.slides = body.slides
    if ('caption' in body)       allowed.caption = body.caption
    if ('scheduled_at' in body)  allowed.scheduled_at = body.scheduled_at

    const { error } = await supabase
      .from('carousels')
      .update(allowed)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[PATCH /api/carousels/[id]]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
