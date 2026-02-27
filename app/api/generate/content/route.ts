import { NextRequest, NextResponse } from 'next/server'

// Mock slides para MVP — será conectado ao content-engine.js do AIOS
function buildMockSlides(topic: string, hook: string) {
  const types = ['hook', 'problem', 'content', 'content', 'cta', 'benefit', 'content', 'comparison', 'proof', 'cta-final']
  return types.map((type, i) => ({
    num: i + 1,
    type,
    text: i === 0
      ? `${hook}\n\n👉 Arrasta pra entender`
      : i === 4
      ? `Opa, segura aí rapidão...\n\nSe você tá gostando desse conteúdo, muito prazer...\n*EU SOU O JUAN CARLOS.*\n\nAjudo empresários a automatizarem processos com IA.\n\nMe segue pra não perder a próxima, belé?\n@juancarlos.ai\n\nBora para o próximo slide...`
      : i === 9
      ? `Se tu chegou até aqui, já saiu na frente de *90% dos empresários*.\n\nSe isso foi útil pra ti:\n\n{↗️ Compartilha} com um empresário que precisa ver isso\n\n{👆 Me segue} pra não perder a próxima\n\nConteúdo assim toda semana — sem enrolação.\n\n@juancarlos.ai`
      : `Slide ${i + 1} sobre: ${topic}\n\nConteúdo sendo gerado via Claude AI...\n\nEste é um placeholder que será substituído pelo conteúdo real gerado pelo content-engine.`,
    imagePrompt: `Professional Brazilian business context related to: ${topic}. Slide ${i + 1}.`,
    approved: false,
  }))
}

export async function POST(req: NextRequest) {
  try {
    const { topic, hook } = await req.json()

    if (!topic) {
      return NextResponse.json({ error: 'topic é obrigatório' }, { status: 400 })
    }

    // TODO: conectar ao content-engine.js do AIOS
    // const { generateCarousel } = require('../../../../../aios/squads/traffic/scripts/lib/content-engine')
    // const carousel = await generateCarousel({ expertId: 'juancarlos', topic, hook })

    // Mock por agora — retorna estrutura correta
    const slides = buildMockSlides(topic, hook || topic)

    return NextResponse.json({ slides, topic })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
