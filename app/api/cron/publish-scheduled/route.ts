import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = await createClient()

    // Busca carrosséis agendados que ainda não foram publicados
    const { data: pending, error } = await supabase
      .from('carousels')
      .select('*')
      .lte('scheduled_at', new Date().toISOString())
      .is('ig_post_id', null)
      .not('scheduled_at', 'is', null)

    if (error) throw error
    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    const results: Array<{ id: string; status: string }> = []

    for (const carousel of pending) {
      try {
        const slides = (carousel.slides || []) as Array<{
          num: number
          cardPath?: string
          imagePath?: string
        }>
        const toPublish = slides.filter(s => s.cardPath || s.imagePath)

        if (!toPublish.length || !carousel.caption) {
          results.push({ id: carousel.id, status: 'sem_imagens' })
          continue
        }

        // Salva as imagens no Storage
        const saveRes  = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/save-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slides: toPublish.map(s => ({ num: s.num, dataUrl: s.cardPath || s.imagePath })),
            sessionId: `cron-${carousel.id}`,
          }),
        })
        const saveData = await saveRes.json()
        if (saveData.error) throw new Error(saveData.error)

        // Publica no Instagram usando as credenciais do dono do carousel
        const pubRes  = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrls: saveData.urls,
            caption: carousel.caption,
            carouselId: carousel.id,
            userId: carousel.user_id,
          }),
        })
        const pubData = await pubRes.json()
        if (pubData.error) throw new Error(pubData.error)

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
