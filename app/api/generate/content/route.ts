import { NextRequest } from 'next/server'
import { getExpertFromDB } from '@/lib/expert-config'
import { createClient } from '@/lib/supabase/server'
import { generateWithTemplate } from '@/lib/template-engine'
import { getWorkspaceContext, getAppKeys } from '@/lib/workspace'
import { log } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const { topic, hook, textLength, useFixedSlides, templateId } = await req.json()
  if (!topic) {
    return new Response(JSON.stringify({ error: 'topic obrigatório' }), { status: 400 })
  }

  // Workspace e chaves da plataforma em paralelo
  const [{ workspaceId, role }, appKeys, expert] = await Promise.all([
    getWorkspaceContext(user.id, supabase),
    getAppKeys(),
    getExpertFromDB(user.id, supabase),
  ])

  if (!expert) {
    return new Response(
      JSON.stringify({ error: 'Perfil de expert não encontrado. Configure em Expert → DNA.' }),
      { status: 400 }
    )
  }

  // Owner usa chave da plataforma; fallback para env local (desenvolvimento)
  const anthropicKey = appKeys.anthropicKey || process.env.ANTHROPIC_API_KEY || ''

  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ error: 'Chave Anthropic não configurada. Acesse o painel admin → Settings.' }),
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
        providerId: 'anthropic',
        apiKey: anthropicKey,
        supabase,
        contentOptions,
      })

      for await (const event of gen) {
        controller.enqueue(sse(event))

        if ('done' in event && event.done) {
          // Salva no histórico com workspace_id
          supabase.from('carousels').insert({
            user_id:      user.id,
            workspace_id: workspaceId,
            created_by:   user.id,
            topic,
            caption:      event.caption,
            slides:       event.slides,
          }).then(() => {})

          // Log de sucesso
          log({
            event: 'content.generated',
            workspaceId,
            userId: user.id,
            payload: {
              template_id:  resolvedTemplateId,
              model:        'claude-opus-4-6',
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
            payload:     { template_id: resolvedTemplateId, model: 'claude-opus-4-6', topic, error: event.error },
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
