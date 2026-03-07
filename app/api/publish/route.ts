import { NextRequest, NextResponse } from 'next/server'
import { getExpertForContext } from '@/lib/expert-config'
import { publishCarousel } from '@/lib/instagram'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { log } from '@/lib/logger'
import { recordUsageEvent } from '@/lib/usage-events'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { imageUrls, caption, carouselId } = await req.json()
    if (!imageUrls?.length) return NextResponse.json({ error: 'imageUrls obrigatório' }, { status: 400 })
    if (!caption) return NextResponse.json({ error: 'caption obrigatório' }, { status: 400 })

    const [{ workspaceId }, expert] = await Promise.all([
      getWorkspaceContext(user.id, supabase),
      getExpertForContext(user.id, supabase),
    ])

    if (!expert) return NextResponse.json(
      { error: 'Perfil de expert não encontrado. Configure em Expert → DNA.' },
      { status: 400 }
    )

    // Credenciais Meta por workspace/expert; fallback para variáveis de ambiente.
    const metaToken = expert.igAccessToken || process.env.META_GRAPH_API_TOKEN || process.env.IG_TOKEN || ''
    const metaAccountId = expert.igAccountId || process.env.META_IG_ACCOUNT_ID || process.env.IG_ACCOUNT_ID || ''

    if (!metaToken) return NextResponse.json(
      { error: 'Meta Graph API Token não configurado. Acesse Expert → DNA ou configure o fallback no .env.' },
      { status: 400 }
    )
    if (!metaAccountId) return NextResponse.json(
      { error: 'Meta Account ID não configurado. Acesse Expert → DNA ou configure o fallback no .env.' },
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

    log({
      event: 'publish.success',
      workspaceId,
      userId: user.id,
      payload: { carousel_id: carouselId ?? null, ig_post_id: postId, platform: 'instagram' },
    })

    await recordUsageEvent({
      workspaceId,
      userId: user.id,
      carouselId: typeof carouselId === 'string' ? carouselId : null,
      provider: 'meta',
      model: 'instagram-carousel',
      eventType: 'publish',
      unit: 'publish',
      quantity: 1,
      metadata: { igPostId: postId },
    })

    return NextResponse.json({
      postId,
      url: `https://www.instagram.com/${expert.handle.replace('@', '')}/`,
    })
  } catch (err: any) {
    console.error('[publish]', err.message)
    log({
      event: 'publish.error',
      level: 'error',
      payload: { error: err.message, platform: 'instagram' },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
