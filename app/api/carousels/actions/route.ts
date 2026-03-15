import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertWorkspaceBudgetAvailable } from '@/lib/cost-guardrails'
import { assertWorkspaceCreditsAvailable } from '@/lib/credit-limits'
import { deleteInstagramMedia, getInstagramPermalink, publishCarousel } from '@/lib/instagram'
import { getExpertForContext, toExpertConfig } from '@/lib/expert-config'
import { recordUsageEvent } from '@/lib/usage-events'

type CarouselRow = {
  id: string
  user_id: string
  workspace_id: string | null
  expert_id: string | null
  topic: string
  caption: string | null
  slides: any[]
  ig_post_id: string | null
  published_at: string | null
  scheduled_at: string | null
  deleted_at: string | null
  provider_used: string | null
  model_used: string | null
}

type Action =
  | 'duplicate'
  | 'repost'
  | 'get_permalink'
  | 'delete_system'
  | 'delete_instagram'
  | 'delete_both'

function isValidAction(value: unknown): value is Action {
  return (
    value === 'duplicate' ||
    value === 'repost' ||
    value === 'get_permalink' ||
    value === 'delete_system' ||
    value === 'delete_instagram' ||
    value === 'delete_both'
  )
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getStoragePaths(slides: any[]): string[] {
  const paths = new Set<string>()
  for (const slide of Array.isArray(slides) ? slides : []) {
    if (typeof slide?.cardStoragePath === 'string' && slide.cardStoragePath) paths.add(slide.cardStoragePath)
    if (typeof slide?.bgImageStoragePath === 'string' && slide.bgImageStoragePath) paths.add(slide.bgImageStoragePath)
  }
  return Array.from(paths)
}

async function removeStoragePaths(paths: string[]) {
  if (!paths.length) return
  const admin = createAdminClient()
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { error } = await admin.storage.from('carousel-images').remove(batch)
    if (error) throw new Error(error.message || 'Falha ao excluir arquivos do carrossel')
  }
}

async function resolveExpertToken(userId: string, carousel: CarouselRow) {
  const supabase = await createClient()
  if (carousel.expert_id) {
    const admin = createAdminClient()
    const { data: expertRow } = await admin
      .from('experts')
      .select('*')
      .eq('id', carousel.expert_id)
      .maybeSingle()
    if (expertRow) {
      return toExpertConfig(expertRow)
    }
  }
  return getExpertForContext(userId, supabase)
}

async function resolvePublishUrls(carousel: CarouselRow): Promise<string[]> {
  const admin = createAdminClient()
  const slides = Array.isArray(carousel.slides) ? carousel.slides : []
  const preferredPaths = slides.map((slide) => slide?.cardStoragePath || slide?.bgImageStoragePath).filter((value): value is string => typeof value === 'string' && value.length > 0)

  if (preferredPaths.length) {
    const { data, error } = await admin.storage.from('carousel-images').createSignedUrls(preferredPaths, 60 * 60)
    if (error) throw new Error(error.message || 'Falha ao gerar URLs assinadas para repost')

    const signedUrls = (data || []).map((item) => item.signedUrl).filter((value): value is string => typeof value === 'string' && value.length > 0)
    if (signedUrls.length) return signedUrls
  }

  const fallbackUrls = slides
    .map((slide) => {
      const cardPath = typeof slide?.cardPath === 'string' ? slide.cardPath : ''
      const imagePath = typeof slide?.imagePath === 'string' ? slide.imagePath : ''
      return cardPath && !cardPath.startsWith('data:') ? cardPath : imagePath && !imagePath.startsWith('data:') ? imagePath : ''
    })
    .filter(Boolean)

  if (!fallbackUrls.length) {
    throw new Error('Carrossel sem imagens persistidas para repost')
  }

  return fallbackUrls
}

async function duplicateCarousel(admin: ReturnType<typeof createAdminClient>, current: CarouselRow, createdBy: string, topicSuffix = ' (cópia)') {
  const { data, error } = await admin
    .from('carousels')
    .insert({
      user_id: current.user_id,
      workspace_id: current.workspace_id,
      created_by: createdBy,
      expert_id: current.expert_id,
      topic: `${current.topic}${topicSuffix}`,
      caption: current.caption,
      slides: current.slides,
      provider_used: current.provider_used,
      model_used: current.model_used,
      ig_post_id: null,
      published_at: null,
      scheduled_at: null,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message || 'Falha ao duplicar carrossel')
  return data.id
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const ids = asArray(body.ids)
    const action = body.action

    if (!ids.length) return NextResponse.json({ error: 'ids é obrigatório' }, { status: 400 })
    if (!isValidAction(action)) return NextResponse.json({ error: 'action inválida' }, { status: 400 })

    const admin = createAdminClient()
    const { data: rows, error } = await admin
      .from('carousels')
      .select('id, user_id, workspace_id, expert_id, topic, caption, slides, ig_post_id, published_at, scheduled_at, deleted_at, provider_used, model_used')
      .in('id', ids)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message || 'Falha ao carregar carrosséis' }, { status: 500 })
    }

    const carousels = (rows || []) as CarouselRow[]
    if (!carousels.length) {
      return NextResponse.json({ error: 'Nenhum carrossel encontrado' }, { status: 404 })
    }

    const results: Array<Record<string, unknown>> = []

    for (const carousel of carousels) {
      try {
        if (action === 'duplicate') {
          const duplicatedId = await duplicateCarousel(admin, carousel, user.id)
          results.push({ id: carousel.id, ok: true, duplicatedId })
          continue
        }

        if (action === 'get_permalink') {
          if (!carousel.ig_post_id) throw new Error('Carrossel ainda não foi publicado')
          const expert = await resolveExpertToken(user.id, carousel)
          const token = expert?.igAccessToken || process.env.META_GRAPH_API_TOKEN || process.env.IG_TOKEN || ''
          if (!token) throw new Error('Token da Meta não configurado')
          const permalink = await getInstagramPermalink(carousel.ig_post_id, token)
          results.push({
            id: carousel.id,
            ok: true,
            permalink: permalink || `https://www.instagram.com/p/${carousel.ig_post_id}/`,
          })
          continue
        }

        if (action === 'delete_instagram' || action === 'delete_both') {
          if (carousel.ig_post_id) {
            const expert = await resolveExpertToken(user.id, carousel)
            const token = expert?.igAccessToken || process.env.META_GRAPH_API_TOKEN || process.env.IG_TOKEN || ''
            if (!token) throw new Error('Token da Meta não configurado')
            await deleteInstagramMedia(carousel.ig_post_id, token)
          }

          const updatePayload: Record<string, unknown> = {
            ig_post_id: null,
            published_at: null,
          }

          if (action === 'delete_both') {
            updatePayload.deleted_at = new Date().toISOString()
            updatePayload.deleted_by = user.id
            updatePayload.deleted_reason = 'user_delete_both'
            updatePayload.scheduled_at = null
          }

          const { error: updateError } = await admin
            .from('carousels')
            .update(updatePayload)
            .eq('id', carousel.id)
            .eq('user_id', user.id)

          if (updateError) throw new Error(updateError.message || 'Falha ao atualizar carrossel após exclusão no Instagram')

          if (action === 'delete_both') {
            await removeStoragePaths(getStoragePaths(carousel.slides))
          }

          results.push({ id: carousel.id, ok: true })
          continue
        }

        if (action === 'delete_system') {
          await removeStoragePaths(getStoragePaths(carousel.slides))
          const { error: deleteError } = await admin
            .from('carousels')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by: user.id,
              deleted_reason: 'user_delete_system',
              scheduled_at: null,
            })
            .eq('id', carousel.id)
            .eq('user_id', user.id)

          if (deleteError) throw new Error(deleteError.message || 'Falha ao excluir carrossel do sistema')
          results.push({ id: carousel.id, ok: true })
          continue
        }

        if (action === 'repost') {
          if (!carousel.caption) throw new Error('Carrossel sem legenda para repost')
          const workspaceId = carousel.workspace_id || ''
          if (workspaceId) {
            const creditCheck = await assertWorkspaceCreditsAvailable(workspaceId)
            if (!creditCheck.ok) throw new Error(`Limite de créditos do plano ${creditCheck.usage.planLabel} atingido`)
            const budgetCheck = await assertWorkspaceBudgetAvailable(workspaceId)
            if (!budgetCheck.ok) throw new Error('Orçamento mensal de custo atingido')
          }

          const imageUrls = await resolvePublishUrls(carousel)
          const duplicatedId = await duplicateCarousel(admin, carousel, user.id, ' (repost)')
          const expert = await resolveExpertToken(user.id, carousel)
          const token = expert?.igAccessToken || process.env.META_GRAPH_API_TOKEN || process.env.IG_TOKEN || ''
          const accountId = expert?.igAccountId || process.env.META_IG_ACCOUNT_ID || process.env.IG_ACCOUNT_ID || ''
          if (!token) throw new Error('Token da Meta não configurado')
          if (!accountId) throw new Error('Conta do Instagram não configurada')

          const postId = await publishCarousel({
            accountId,
            token,
            imageUrls,
            caption: carousel.caption,
          })

          await admin
            .from('carousels')
            .update({
              ig_post_id: postId,
              published_at: new Date().toISOString(),
            })
            .eq('id', duplicatedId)
            .eq('user_id', user.id)

          await recordUsageEvent({
            workspaceId: workspaceId || null,
            userId: user.id,
            carouselId: duplicatedId,
            provider: 'meta',
            model: 'instagram-carousel',
            eventType: 'publish',
            unit: 'publish',
            quantity: 1,
            metadata: { igPostId: postId, sourceCarouselId: carousel.id, mode: 'repost' },
          })

          const permalink = await getInstagramPermalink(postId, token).catch(() => null)
          results.push({ id: carousel.id, ok: true, duplicatedId, ig_post_id: postId, permalink })
        }
      } catch (actionError: any) {
        results.push({ id: carousel.id, ok: false, error: actionError?.message || 'Falha ao executar ação' })
      }
    }

    const hasError = results.some((item) => item.ok === false)
    return NextResponse.json({ ok: !hasError, results }, { status: hasError ? 207 : 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
