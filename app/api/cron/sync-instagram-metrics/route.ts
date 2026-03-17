import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncInstagramMetricsSnapshot, type CarouselMetricsTarget } from '@/lib/instagram-metrics'

/**
 * GET /api/cron/sync-instagram-metrics
 *
 * Sincroniza snapshots de métricas dos posts já publicados.
 * Requer o mesmo `x-cron-secret` usado no cron de publicação.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET || ''
  const headerSecret = req.headers.get('x-cron-secret') || ''
  const authHeader = req.headers.get('authorization') || ''
  const bearerSecret = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  const provided = headerSecret || bearerSecret

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data: rows, error } = await admin
      .from('carousels')
      .select('id, user_id, workspace_id, expert_id, ig_post_id')
      .is('deleted_at', null)
      .not('ig_post_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const targets = (rows || []) as CarouselMetricsTarget[]
    if (!targets.length) return NextResponse.json({ processed: 0, results: [] })

    const results: Array<{ id: string; ok: boolean; error?: string }> = []
    for (const carousel of targets) {
      try {
        await syncInstagramMetricsSnapshot(carousel)
        results.push({ id: carousel.id, ok: true })
      } catch (err: any) {
        results.push({ id: carousel.id, ok: false, error: err.message || 'Falha ao sincronizar métricas' })
      }
    }

    const okCount = results.filter((item) => item.ok).length
    return NextResponse.json({ processed: okCount, attempted: results.length, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
