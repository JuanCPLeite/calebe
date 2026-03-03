import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/carousels
 * Cria um novo registro de carrossel (rascunho).
 *
 * Body: { topic: string, caption: string, slides: Slide[] }
 * Response: { id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { topic, caption, slides } = await req.json()

    const { data, error } = await supabase
      .from('carousels')
      .insert({ user_id: user.id, topic, caption, slides })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (err: any) {
    console.error('[POST /api/carousels]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
