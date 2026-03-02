import { NextRequest, NextResponse } from 'next/server'
import { getExpertFromDB } from '@/lib/expert-config'
import { publishCarousel } from '@/lib/instagram'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { imageUrls, caption, carouselId } = await req.json()
    if (!imageUrls?.length) return NextResponse.json({ error: 'imageUrls obrigatório' }, { status: 400 })
    if (!caption) return NextResponse.json({ error: 'caption obrigatório' }, { status: 400 })

    const expert = await getExpertFromDB(user.id, supabase)
    if (!expert) return NextResponse.json(
      { error: 'Perfil de expert não encontrado. Configure em Expert → DNA.' },
      { status: 400 }
    )

    // Tokens Meta: somente do banco do usuário
    const { data: tokens } = await supabase
      .from('user_tokens')
      .select('provider, value')
      .eq('user_id', user.id)
      .in('provider', ['meta_token', 'meta_account_id'])

    let metaToken = ''
    let metaAccountId = ''
    for (const t of tokens || []) {
      if (t.provider === 'meta_token') metaToken = t.value
      if (t.provider === 'meta_account_id') metaAccountId = t.value
    }

    if (!metaToken) return NextResponse.json(
      { error: 'Meta Graph API Token não configurado. Acesse Tokens & APIs.' },
      { status: 400 }
    )
    if (!metaAccountId) return NextResponse.json(
      { error: 'Meta Account ID não configurado. Acesse Tokens & APIs.' },
      { status: 400 }
    )

    const postId = await publishCarousel({
      accountId: metaAccountId,
      token: metaToken,
      imageUrls,
      caption,
    })

    if (carouselId) {
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
