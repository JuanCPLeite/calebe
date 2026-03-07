import { NextRequest } from 'next/server'
import { getExpertForContext } from '@/lib/expert-config'
import { createClient } from '@/lib/supabase/server'
import { generateWithTemplate } from '@/lib/template-engine'
import { getWorkspaceContext, getAppKeys } from '@/lib/workspace'
import { log } from '@/lib/logger'
import { recordUsageEvent } from '@/lib/usage-events'
import { getWorkspacePlanLimits } from '@/lib/plan-limits'
import type { ProviderId } from '@/lib/providers/types'

type WorkspacePlan = 'starter' | 'pro' | 'agency'

interface ModelOption {
  providerId: ProviderId
  model: string
  label: string
}

const PLAN_MODEL_OPTIONS: Record<WorkspacePlan, ModelOption[]> = {
  starter: [
    { providerId: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  ],
  pro: [
    { providerId: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { providerId: 'anthropic', model: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  ],
  agency: [
    { providerId: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { providerId: 'anthropic', model: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { providerId: 'openai', model: 'gpt-4o', label: 'GPT-4o' },
  ],
}

function normalizePlan(value: string | null | undefined): WorkspacePlan {
  if (value === 'pro' || value === 'agency') return value
  return 'starter'
}

function normalizeProviderId(value: unknown): ProviderId {
  if (value === 'openai' || value === 'google' || value === 'anthropic') return value
  return 'anthropic'
}

function estimateTokensFromCharCount(charCount: number): number {
  return Math.max(1, Math.ceil(Math.max(0, charCount) / 4))
}

function monthStartIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const { topic, hook, textLength, useFixedSlides, templateId, providerId, model } = await req.json()
  if (!topic) {
    return new Response(JSON.stringify({ error: 'topic obrigatório' }), { status: 400 })
  }

  // Workspace e chaves da plataforma em paralelo
  const [{ workspaceId }, appKeys, expert] = await Promise.all([
    getWorkspaceContext(user.id, supabase),
    getAppKeys(),
    getExpertForContext(user.id, supabase),
  ])

  const selectedProviderId = normalizeProviderId(providerId)

  if (!expert) {
    return new Response(
      JSON.stringify({ error: 'Perfil de expert não encontrado. Configure em Expert → DNA.' }),
      { status: 400 }
    )
  }

  if (workspaceId) {
    const [limits, usageRes] = await Promise.all([
      getWorkspacePlanLimits(workspaceId),
      supabase
        .from('carousels')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', monthStartIso()),
    ])

    const usedCredits = usageRes.count || 0
    if (usedCredits >= limits.monthlyPostCredits) {
      return new Response(
        JSON.stringify({
          error: `Limite mensal de créditos do plano ${limits.planLabel} atingido (${limits.monthlyPostCredits}).`,
        }),
        { status: 403 }
      )
    }
  }

  const { data: workspace } = workspaceId
    ? await supabase
        .from('workspaces')
        .select('plan')
        .eq('id', workspaceId)
        .maybeSingle<{ plan: WorkspacePlan }>()
    : { data: null as { plan: WorkspacePlan } | null }

  const plan = normalizePlan(workspace?.plan)
  const availableModels = PLAN_MODEL_OPTIONS[plan]
  const availablePairs = new Set(availableModels.map((opt) => `${opt.providerId}:${opt.model}`))

  const fallbackModel = availableModels.find((opt) => opt.providerId === selectedProviderId)
  const selectedModel = typeof model === 'string' ? model.trim() : ''
  const chosenModel = selectedModel || fallbackModel?.model || ''

  if (!chosenModel || !availablePairs.has(`${selectedProviderId}:${chosenModel}`)) {
    return new Response(
      JSON.stringify({ error: `Modelo não disponível no plano ${plan}.` }),
      { status: 403 }
    )
  }

  const keyByProvider: Partial<Record<ProviderId, string>> = {
    anthropic: appKeys.anthropicKey || process.env.ANTHROPIC_API_KEY || '',
    openai: appKeys.openaiKey || process.env.OPENAI_API_KEY || '',
    google: appKeys.googleKey || process.env.GOOGLE_API_KEY || '',
  }

  const providerApiKey = keyByProvider[selectedProviderId] || ''

  if (!providerApiKey) {
    return new Response(
      JSON.stringify({ error: `Chave ${selectedProviderId} não configurada. Acesse o painel admin → Settings.` }),
      { status: 400 }
    )
  }

  const resolvedTemplateId = templateId || 'frank-costa-10'
  const contentOptions = { textLength, useFixedSlides: useFixedSlides !== false }
  const startTime = Date.now()

  const encoder = new TextEncoder()
  function sse(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const body = new ReadableStream({
    async start(controller) {
      const gen = generateWithTemplate({
        templateId: resolvedTemplateId,
        topic,
        hook,
        expert,
        providerId: selectedProviderId,
        apiKey: providerApiKey,
        supabase,
        contentOptions,
        modelOverride: chosenModel,
      })

      for await (const event of gen) {
        controller.enqueue(sse(event))

        if ('done' in event && event.done) {
          // Salva no histórico com workspace_id
          const { data: insertedCarousel } = await supabase.from('carousels').insert({
            user_id:      user.id,
            workspace_id: workspaceId,
            created_by:   user.id,
            expert_id:    expert.id || null,
            topic,
            caption:      event.caption,
            slides:       event.slides,
            provider_used: selectedProviderId,
            model_used: event.modelUsed,
          }).select('id').maybeSingle()

          const carouselId = insertedCarousel?.id || null

          // Estimativa inicial de tokens para analise de custo.
          const expertText = [
            expert.displayName,
            expert.handle,
            expert.niche,
            expert.bioShort,
            expert.productName,
            expert.productCta,
            expert.authorSlideTemplate,
            expert.ctaFinalTemplate,
            ...(expert.styleRules || []),
          ].join(' ')
          const inputChars = [String(topic || ''), String(hook || ''), expertText].join(' ').length
          const outputChars = [String(event.caption || ''), JSON.stringify(event.slides || [])].join(' ').length
          const estimatedInputTokens = estimateTokensFromCharCount(inputChars)
          const estimatedOutputTokens = estimateTokensFromCharCount(outputChars)

          await Promise.all([
            recordUsageEvent({
              workspaceId,
              userId: user.id,
              carouselId,
              provider: selectedProviderId,
              model: event.modelUsed,
              eventType: 'content.generate',
              unit: 'render',
              quantity: 1,
              metadata: { topic, templateId: resolvedTemplateId },
            }),
            recordUsageEvent({
              workspaceId,
              userId: user.id,
              carouselId,
              provider: selectedProviderId,
              model: event.modelUsed,
              eventType: 'content.generate',
              unit: 'token_in',
              quantity: estimatedInputTokens,
              metadata: { estimated: true },
            }),
            recordUsageEvent({
              workspaceId,
              userId: user.id,
              carouselId,
              provider: selectedProviderId,
              model: event.modelUsed,
              eventType: 'content.generate',
              unit: 'token_out',
              quantity: estimatedOutputTokens,
              metadata: { estimated: true },
            }),
          ])

          // Log de sucesso
          log({
            event: 'content.generated',
            workspaceId,
            userId: user.id,
            payload: {
              template_id:  resolvedTemplateId,
              provider:     selectedProviderId,
              model:        event.modelUsed,
              topic,
              slides_count: (event.slides as unknown[]).length,
              duration_ms:  Date.now() - startTime,
            },
          })
        }

        if ('error' in event) {
          log({
            event:       'content.error',
            level:       'error',
            workspaceId,
            userId:      user.id,
            payload:     { template_id: resolvedTemplateId, provider: selectedProviderId, model: chosenModel, topic, error: event.error },
          })
        }
      }

      controller.close()
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
