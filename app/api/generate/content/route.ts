import { NextRequest, NextResponse } from 'next/server'
import { generateCarouselContent } from '@/lib/content-engine'
import { getExpertFromDB, getExpertBySlug } from '@/lib/expert-config'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { topic, hook } = await req.json()
    if (!topic) return NextResponse.json({ error: 'topic obrigatório' }, { status: 400 })

    let expert = user ? await getExpertFromDB(user.id, supabase) : null
    if (!expert) expert = getExpertBySlug('juancarlos')

    // Busca token Anthropic do DB (fallback: env)
    let anthropicKey = process.env.ANTHROPIC_API_KEY
    if (user) {
      const { data: tokenRow } = await supabase
        .from('user_tokens')
        .select('value')
        .eq('user_id', user.id)
        .eq('provider', 'anthropic')
        .single()
      if (tokenRow?.value) anthropicKey = tokenRow.value
    }

    const carousel = await generateCarouselContent(expert, topic, hook, anthropicKey)

    // Salva no histórico se autenticado
    if (user) {
      await supabase.from('carousels').insert({
        user_id: user.id,
        topic,
        caption: carousel.caption,
        slides: carousel.slides,
      })
    }

    return NextResponse.json(carousel)
  } catch (err: any) {
    console.error('[generate/content]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
