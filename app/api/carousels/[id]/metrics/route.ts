import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncInstagramMetricsSnapshot } from '@/lib/instagram-metrics'

type CarouselRow = {
  id: string
  user_id: string
  workspace_id: string | null
  expert_id: string | null
  ig_post_id: string | null
}

async function loadOwnedCarousel(id: string, userId: string): Promise<CarouselRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('carousels')
    .select('id, user_id, workspace_id, expert_id, ig_post_id')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  return (data as CarouselRow | null) || null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const carousel = await loadOwnedCarousel(id, user.id)
    if (!carousel) return NextResponse.json({ error: 'Carrossel não encontrado' }, { status: 404 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('carousel_metrics_snapshots')
      .select('*')
      .eq('carousel_id', id)
      .order('synced_at', { ascending: false })
      .limit(12)

    if (error) throw error

    const rows = data || []
    return NextResponse.json({
      latest: rows[0] || null,
      history: rows,
      isPublished: Boolean(carousel.ig_post_id),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar métricas' }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const carousel = await loadOwnedCarousel(id, user.id)
    if (!carousel) return NextResponse.json({ error: 'Carrossel não encontrado' }, { status: 404 })

    const snapshot = await syncInstagramMetricsSnapshot(carousel)
    return NextResponse.json({ snapshot })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao sincronizar métricas' }, { status: 500 })
  }
}
