import { NextRequest } from 'next/server'
import { getExpertFromDB } from '@/lib/expert-config'
import { createClient } from '@/lib/supabase/server'
import { generateWithTemplate } from '@/lib/template-engine'

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

  const encoder = new TextEncoder()
  function sse(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const body = new ReadableStream({
    async start(controller) {
      const gen = generateWithTemplate({
        templateId: templateId || 'frank-costa-10',
        topic,
        hook,
        expert,
        providerId: 'anthropic',
        apiKey: anthropicKey,
        supabase,
        contentOptions: { textLength, useFixedSlides: useFixedSlides !== false },
      })

      for await (const event of gen) {
        controller.enqueue(sse(event))

        // Salva no histórico quando concluído
        if ('done' in event && event.done) {
          supabase.from('carousels').insert({
            user_id: user.id,
            topic,
            caption: event.caption,
            slides: event.slides,
          }).then(() => {})
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
