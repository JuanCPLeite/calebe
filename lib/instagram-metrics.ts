import { createAdminClient } from '@/lib/supabase/admin'
import { getExpertForContext, toExpertConfig } from '@/lib/expert-config'
import { createClient } from '@/lib/supabase/server'
import { getInstagramMediaInsights, getInstagramMediaSummary } from '@/lib/instagram'

export type CarouselMetricsTarget = {
  id: string
  user_id: string
  workspace_id: string | null
  expert_id: string | null
  ig_post_id: string | null
}

async function resolveExpert(userId: string, expertId: string | null) {
  if (expertId) {
    const admin = createAdminClient()
    const { data: expertRow } = await admin
      .from('experts')
      .select('*')
      .eq('id', expertId)
      .maybeSingle()
    if (expertRow) return toExpertConfig(expertRow)
  }

  const supabase = await createClient()
  return getExpertForContext(userId, supabase)
}

export async function syncInstagramMetricsSnapshot(carousel: CarouselMetricsTarget) {
  if (!carousel.ig_post_id) throw new Error('Métricas disponíveis apenas para carrossel publicado')

  const expert = await resolveExpert(carousel.user_id, carousel.expert_id)
  const token = expert?.igAccessToken || process.env.META_GRAPH_API_TOKEN || process.env.IG_TOKEN || ''
  if (!token) throw new Error('Token da Meta não configurado')

  const [summary, insights] = await Promise.all([
    getInstagramMediaSummary(carousel.ig_post_id, token),
    getInstagramMediaInsights(carousel.ig_post_id, token),
  ])

  const metricsJson = {
    like_count: summary.likeCount,
    comments_count: summary.commentsCount,
    views_count: insights.views,
    reach_count: insights.reach,
    saved_count: insights.saved,
    shares_count: insights.shares,
    total_interactions: insights.total_interactions,
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('carousel_metrics_snapshots')
    .insert({
      carousel_id: carousel.id,
      user_id: carousel.user_id,
      workspace_id: carousel.workspace_id,
      ig_post_id: carousel.ig_post_id,
      permalink: summary.permalink || '',
      media_type: summary.mediaType,
      media_product_type: summary.mediaProductType,
      post_timestamp: summary.timestamp,
      like_count: summary.likeCount,
      comments_count: summary.commentsCount,
      views_count: insights.views,
      reach_count: insights.reach,
      saved_count: insights.saved,
      shares_count: insights.shares,
      total_interactions: insights.total_interactions,
      metrics_json: metricsJson,
      synced_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message || 'Falha ao salvar snapshot de métricas')
  return data
}
