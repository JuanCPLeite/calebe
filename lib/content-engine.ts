import Anthropic from '@anthropic-ai/sdk'
import type { ExpertConfig } from './expert-config'

export interface Slide {
  num: number
  type: string
  text: string
  imagePrompt: string
  approved?: boolean
}

export interface CarouselContent {
  topic: string
  caption: string
  slides: Slide[]
}

function buildSystemPrompt(expert: ExpertConfig): string {
  return `Você é ${expert.displayName}, criador de conteúdo especialista em ${expert.niche}.

${expert.bioShort}

HANDLE: ${expert.handle}

== REGRAS DE ESTILO (OBRIGATÓRIAS) ==

${expert.styleRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

== SLIDE 5 (FIXO — NUNCA ALTERAR) ==

${expert.authorSlideTemplate}

== SLIDE 10 (FIXO — NUNCA ALTERAR) ==

${expert.ctaFinalTemplate}

== ESTRUTURA DO CARROSSEL (10 slides) ==

- Slide 1 (hook): Gancho provocativo que faz parar de scrollar
- Slide 2 (problem): Aprofunda a dor / contexto do problema
- Slide 3 (content): Primeiro insight + analogia forte
- Slide 4 (content): Segundo insight — custo oculto ou revelação
- Slide 5 (cta): USAR EXATAMENTE O TEMPLATE ACIMA
- Slide 6 (benefit): Reframe — "A pergunta não é... A pergunta é:"
- Slide 7 (content): Terceiro insight — comparação, dado, revelação
- Slide 8 (comparison): Antes vs Depois ou Manual vs Automação
- Slide 9 (proof): Aplicação prática — "Onde tu aplica isso essa semana?"
- Slide 10 (cta-final): USAR EXATAMENTE O TEMPLATE ACIMA

== PRODUTO ==
Nome: ${expert.productName}
CTA: ${expert.productCta}`
}

function buildUserPrompt(topic: string, hook?: string): string {
  return `Gere um carrossel de 10 slides sobre o tema:

"${topic}"

${hook ? `Hook sugerido para o slide 1 (pode adaptar): "${hook}"` : ''}

RESPONDA SOMENTE com JSON válido, sem markdown, sem explicações:

{
  "topic": "${topic}",
  "caption": "legenda do post Instagram com 3-5 hashtags relevantes",
  "slides": [
    {
      "num": 1,
      "type": "hook",
      "text": "texto do slide com *negrito* e {destaque} onde necessário",
      "imagePrompt": "detailed scene description in English, photorealistic, no text in image"
    }
  ]
}

Tipos válidos: hook | problem | content | cta | benefit | comparison | proof | cta-final
Slide 5 → type "cta", usar EXATAMENTE o template de apresentação do autor.
Slide 10 → type "cta-final", usar EXATAMENTE o template de CTA final (Compartilha + Me segue).
Cada slide: 80-200 palavras densas.
imagePrompt: em INGLÊS, descritivo, sem texto na imagem.`
}

export async function generateCarouselContent(
  expert: ExpertConfig,
  topic: string,
  hook?: string,
  apiKey?: string
): Promise<CarouselContent> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada')

  const client = new Anthropic({ apiKey: key })

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: buildSystemPrompt(expert),
    messages: [{ role: 'user', content: buildUserPrompt(topic, hook) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extrai JSON mesmo se vier com texto ao redor
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude não retornou JSON válido')

  const parsed = JSON.parse(jsonMatch[0])

  return {
    topic: parsed.topic || topic,
    caption: parsed.caption || '',
    slides: (parsed.slides || []).map((s: any) => ({ ...s, approved: false })),
  }
}
