import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publishCarousel } from '@/lib/instagram'

interface CarouselSlide {
  num: number
  cardPath?: string
  imagePath?: string
  cardStoragePath?: string
  bgImageStoragePath?: string
}

function isDataUrl(value?: string): boolean {
  return !!value && value.startsWith('data:')
}

function isHttpUrl(value?: string): boolean {
  return !!value && /^https?:\/\//i.test(value)
}

async function uploadDataUrlAsJpg(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  carouselId: string,
  slideNum: number,
  dataUrl: string,
): Promise<string> {
  const [, base64] = dataUrl.split(',')
  const buffer = Buffer.from(base64, 'base64')
  const storagePath = `${userId}/cron-${carouselId}/slide-${slideNum}.jpg`

  const { error } = await supabase.storage
    .from('carousel-images')
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Storage upload falhou: ${error.message}`)

  const { data: signed, error: signedError } = await supabase.storage
    .from('carousel-images')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  if (signedError || !signed?.signedUrl) {
    throw new Error(`Falha ao assinar imagem: ${signedError?.message || 'sem URL assinada'}`)
  }
  return signed.signedUrl
}

async function resolveSlidePublishUrl(
  supabase: ReturnType<typeof createAdminClient>,
  carousel: { id: string; user_id: string },
  slide: CarouselSlide,
): Promise<string | null> {
  if (isDataUrl(slide.cardPath)) {
    return uploadDataUrlAsJpg(supabase, carousel.user_id, carousel.id, slide.num, slide.cardPath!)
  }
  if (isHttpUrl(slide.cardPath)) {
    return slide.cardPath!
  }

  if (slide.cardStoragePath) {
    const { data: signed, error } = await supabase.storage
      .from('carousel-images')
      .createSignedUrl(slide.cardStoragePath, 60 * 60 * 24 * 7)
    if (error || !signed?.signedUrl) {
      throw new Error(`Falha ao assinar card (${slide.cardStoragePath}): ${error?.message || 'sem URL'}`)
    }
    return signed.signedUrl
  }

  if (isDataUrl(slide.imagePath)) {
    return uploadDataUrlAsJpg(supabase, carousel.user_id, carousel.id, slide.num, slide.imagePath!)
  }
  if (isHttpUrl(slide.imagePath)) {
    return slide.imagePath!
  }
  if (slide.bgImageStoragePath) {
    const { data: signed, error } = await supabase.storage
      .from('carousel-images')
      .createSignedUrl(slide.bgImageStoragePath, 60 * 60 * 24 * 7)
    if (error || !signed?.signedUrl) {
      throw new Error(`Falha ao assinar bg (${slide.bgImageStoragePath}): ${error?.message || 'sem URL'}`)
    }
    return signed.signedUrl
  }

  return null
}

/**
 * GET /api/cron/publish-scheduled
 *
 * Vercel Cron Job — executa a cada 5 minutos.
 * Publica automaticamente os carrosséis agendados cujo scheduled_at já passou.
 *
 * Requer header: x-cron-secret = CRON_SECRET (env var)
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Busca carrosséis agendados que ainda não foram publicados
    const { data: pending, error } = await supabase
      .from('carousels')
      .select('*')
      .lte('scheduled_at', new Date().toISOString())
      .is('ig_post_id', null)
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true })
      .limit(25)

    if (error) throw error
    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    const results: Array<{ id: string; status: string }> = []

    for (const carousel of pending) {
      try {
        const slides = (carousel.slides || []) as CarouselSlide[]
        if (!slides.length || !carousel.caption) {
          results.push({ id: carousel.id, status: 'sem_imagens' })
          continue
        }

        const imageUrls: string[] = []
        for (const slide of slides.sort((a, b) => a.num - b.num)) {
          const url = await resolveSlidePublishUrl(supabase, carousel, slide)
          if (url) imageUrls.push(url)
        }
        if (!imageUrls.length) {
          results.push({ id: carousel.id, status: 'sem_urls_publicaveis' })
          continue
        }

        const { data: tokens, error: tokenErr } = await supabase
          .from('user_tokens')
          .select('provider, value')
          .eq('user_id', carousel.user_id)
          .in('provider', ['meta_token', 'meta_account_id'])
        if (tokenErr) throw tokenErr

        let metaToken = ''
        let metaAccountId = ''
        for (const t of tokens || []) {
          if (t.provider === 'meta_token') metaToken = t.value
          if (t.provider === 'meta_account_id') metaAccountId = t.value
        }
        if (!metaToken || !metaAccountId) {
          results.push({ id: carousel.id, status: 'tokens_meta_ausentes' })
          continue
        }

        const postId = await publishCarousel({
          accountId: metaAccountId,
          token: metaToken,
          imageUrls,
          caption: carousel.caption,
        })

        const { error: updateErr } = await supabase
          .from('carousels')
          .update({
            ig_post_id: postId,
            published_at: new Date().toISOString(),
          })
          .eq('id', carousel.id)
          .eq('user_id', carousel.user_id)
        if (updateErr) throw updateErr

        results.push({ id: carousel.id, status: 'publicado' })
      } catch (err: any) {
        console.error(`[cron] Falha ao publicar carousel ${carousel.id}:`, err.message)
        results.push({ id: carousel.id, status: `erro: ${err.message}` })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (err: any) {
    console.error('[cron/publish-scheduled]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
