import { NextRequest, NextResponse } from 'next/server'
import { getExpertFromDB, getExpertBySlug } from '@/lib/expert-config'
import { publishCarousel } from '@/lib/instagram'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { imageUrls, caption, carouselId } = await req.json()
    if (!imageUrls?.length) return NextResponse.json({ error: 'imageUrls obrigatório' }, { status: 400 })
    if (!caption) return NextResponse.json({ error: 'caption obrigatório' }, { status: 400 })

    let expert = user ? await getExpertFromDB(user.id, supabase) : null
    if (!expert) expert = getExpertBySlug('juancarlos')

    // Busca tokens Meta do DB (fallback: env)
    let metaToken = process.env[`IG_TOKEN_JUANCARLOS`] || ''
    let metaAccountId = expert.igAccountId

    if (user) {
      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('provider, value')
        .eq('user_id', user.id)
        .in('provider', ['meta_token', 'meta_account_id'])

      for (const t of tokens || []) {
        if (t.provider === 'meta_token') metaToken = t.value
        if (t.provider === 'meta_account_id') metaAccountId = t.value
      }
    }

    if (!metaToken) return NextResponse.json({ error: 'Meta token não configurado. Acesse /tokens.' }, { status: 400 })
    if (!metaAccountId) return NextResponse.json({ error: 'Meta Account ID não configurado. Acesse /tokens.' }, { status: 400 })

    const postId = await publishCarousel({
      accountId: metaAccountId,
      token: metaToken,
      imageUrls,
      caption,
    })

    // Atualiza histórico com ig_post_id se tiver carouselId
    if (user && carouselId) {
      await supabase
        .from('carousels')
        .update({ ig_post_id: postId, published_at: new Date().toISOString() })
        .eq('id', carouselId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      postId,
      url: `https://www.instagram.com/${expert.handle.replace('@', '')}/`,
    })
  } catch (err: any) {
    console.error('[publish]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
