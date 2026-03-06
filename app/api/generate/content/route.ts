import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, buildUserPrompt, buildSplitSystemPrompt, buildSplitUserPrompt } from '@/lib/content-engine'
import { getExpertFromDB } from '@/lib/expert-config'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const { topic, hook, textLength, useFixedSlides, templateId } = await req.json()
  const isSplit = templateId === 'positivo-negativo'
  const contentOptions = { textLength, useFixedSlides: useFixedSlides !== false }
  if (!topic) {
    return new Response(JSON.stringify({ error: 'topic obrigatório' }), { status: 400 })
  }

  const expert = await getExpertFromDB(user.id, supabase)
  if (!expert) {
    return new Response(
      JSON.stringify({ error: 'Perfil de expert não encontrado. Configure em Expert → DNA.' }),
      { status: 400 }
    )
  }

  const { data: tokenRow } = await supabase
    .from('user_tokens')
    .select('value')
    .eq('user_id', user.id)
    .eq('provider', 'anthropic')
    .maybeSingle()

  const anthropicKey = tokenRow?.value
  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ error: 'Chave Anthropic (Claude) não configurada. Acesse Tokens & APIs.' }),
      { status: 400 }
    )
  }

  const client = new Anthropic({ apiKey: anthropicKey })
  const encoder = new TextEncoder()

  function sse(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const body = new ReadableStream({
    async start(controller) {
      let accumulated = ''

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const msgStream = client.messages.stream({
            model: 'claude-opus-4-6',
            max_tokens: 8192,
            system: isSplit ? buildSplitSystemPrompt(expert) : buildSystemPrompt(expert, contentOptions),
            messages: [{ role: 'user', content: isSplit ? buildSplitUserPrompt(topic) : buildUserPrompt(topic, hook, contentOptions) }],
          })

          for await (const event of msgStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              accumulated += event.delta.text
              // Conta slides recebidos até agora (cada slide tem "num":)
              const slidesGenerated = (accumulated.match(/"num"\s*:/g) || []).length
              controller.enqueue(sse({ chunk: event.delta.text, slidesGenerated }))
            }
          }

          // Extrai e valida o JSON completo
          const jsonMatch = accumulated.match(/\{[\s\S]*\}/)
          if (!jsonMatch) throw new Error('Claude não retornou JSON válido')

          const parsed = JSON.parse(jsonMatch[0])

          // Salva no histórico (fire-and-forget)
          supabase.from('carousels').insert({
            user_id: user.id,
            topic,
            caption: parsed.caption,
            slides: parsed.slides,
          }).then(() => {})

          controller.enqueue(sse({
            done: true,
            topic: parsed.topic || topic,
            caption: parsed.caption || '',
            slides: (parsed.slides || []).map((s: any) => ({ ...s, approved: false })),
          }))
          break

        } catch (err: any) {
          const isOverloaded = err?.status === 529 || err?.error?.type === 'overloaded_error'
          if (!isOverloaded || attempt === 2) {
            controller.enqueue(sse({ error: err.message || 'Erro ao gerar carrossel' }))
            break
          }
          const wait = (attempt + 1) * 8
          controller.enqueue(sse({ retrying: true, waitSeconds: wait, attempt: attempt + 1 }))
          accumulated = ''
          await new Promise(r => setTimeout(r, wait * 1000))
        }
      }

      controller.close()
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
