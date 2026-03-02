import { NextRequest, NextResponse } from 'next/server'
import { generateCarouselContent } from '@/lib/content-engine'
import { getExpertFromDB } from '@/lib/expert-config'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { topic, hook } = await req.json()
    if (!topic) return NextResponse.json({ error: 'topic obrigatório' }, { status: 400 })

    const expert = await getExpertFromDB(user.id, supabase)
    if (!expert) return NextResponse.json(
      { error: 'Perfil de expert não encontrado. Configure em Expert → DNA.' },
      { status: 400 }
    )

    // Chave Anthropic: somente do banco do usuário
    const { data: tokenRow } = await supabase
      .from('user_tokens')
      .select('value')
      .eq('user_id', user.id)
      .eq('provider', 'anthropic')
      .single()

    const anthropicKey = tokenRow?.value
    if (!anthropicKey) return NextResponse.json(
      { error: 'Chave Anthropic (Claude) não configurada. Acesse Tokens & APIs.' },
      { status: 400 }
    )

    const carousel = await generateCarouselContent(expert, topic, hook, anthropicKey)

    // Salva no histórico
    await supabase.from('carousels').insert({
      user_id: user.id,
      topic,
      caption: carousel.caption,
      slides: carousel.slides,
    })

    return NextResponse.json(carousel)
  } catch (err: any) {
    console.error('[generate/content]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
