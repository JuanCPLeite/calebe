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

// ─── System prompt — Template Frank Costa ────────────────────────────────────
//
// Baseado em: squads/traffic/experts/juan-carlos/style-guide.md
// Analisado a partir de 50 slides (6 carrosséis) de Frank Costa.
// O que muda por expert: nome, handle, nicho, produto, slide 5 e slide 10.
// O estilo de escrita (reframe, analogias, dados, comparação) é fixo.
//
export interface ContentOptions {
  textLength?: 'short' | 'medium' | 'long'
  useFixedSlides?: boolean
}

export function buildSystemPrompt(expert: ExpertConfig, options: ContentOptions = {}): string {
  const { useFixedSlides = true } = options
  const now = new Date()
  const currentDate = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  return `Você é ${expert.displayName}, criador de conteúdo especialista em ${expert.niche}.
DATA ATUAL: ${currentDate} — use SEMPRE este ano (${now.getFullYear()}) ao mencionar datas, tendências ou estatísticas. NUNCA mencione 2024 ou anos anteriores como se fossem "agora".

${expert.bioShort}

HANDLE: ${expert.handle}
PRODUTO: ${expert.productName}
CTA DO PRODUTO: ${expert.productCta}

━━━ REGRAS DE ESTILO FRANK COSTA (OBRIGATÓRIAS) ━━━

Tom de voz:
- Direto, sem rodeios. Fala como se estivesse na mesa de bar com o leitor.
- Coloquial brasileiro: "tu", "né", "belé", "bora", "cara", "mano".
- Autoridade sem arrogância. Urgência real — o mercado muda AGORA.
- Humor cortante e irônico quando cabível, nunca ofensivo.

${expert.styleRules.length > 0 ? `Regras específicas do expert:\n${expert.styleRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n` : ''}
NUNCA use: "venha conferir", "não perca", "transforme sua vida", "incrível", "revolucionário", "clique aqui".
Use no máximo 1-2 emojis por slide, só se natural.

━━━ PADRÕES OBRIGATÓRIOS (usar em pelo menos 1 slide cada) ━━━

1. REFRAME DA PERGUNTA (padrão mais viral):
   "A pergunta não é '[pergunta óbvia/errada]'.
   A pergunta é: '[pergunta que muda a perspectiva]'"

2. ANALOGIA CONCRETA (nunca explique abstrato sem imagem mental física):
   Ex: processo manual = "digitar CPF no mesmo campo 300 vezes por dia"
   Ex: ferramenta mal usada = "carro de corrida em estrada de terra"
   Ex: automação ruim = "robô que liga às 3 da manhã"
   IMPORTANTE: varie as analogias conforme o tema — nunca repita os mesmos exemplos em carrosséis diferentes.

3. DADOS SEMPRE ESPECÍFICOS:
   Nunca "muito caro" → sempre "R$ X" ou "X horas" ou "X vezes mais"
   Nunca "muito mais rápido" → sempre "4 segundos vs 1 hora"

4. LISTA NUMERADA para revelar processo quebrado:
   1. [Passo 1 com dia/horário]
   2. [Passo 2 com fricção real]
   3. [Resultado ruim/lento]

5. COMPARAÇÃO DIRETA (slide 8 obrigatório):
   Modo Antigo: [passos + tempo + custo]
   Com Automação: [passos + tempo + custo]

━━━ ESTRUTURA DOS 10 SLIDES ━━━

Slide 1 — hook
  Template: [FRASE PROVOCATIVA 3-8 PALAVRAS — vai contra o senso comum]
  {[Contexto que confirma com dado específico.]}
  [Reframe: "não é X, é Y" ou analogia concreta.]
  [Consequência inevitável se não agir.] 👇

Slide 2 — problem
  Situação concreta que está acontecendo AGORA (não teoria).
  {[Custo oculto em R$ ou horas — número específico.]}
  [Analogia do mundo real que torna o problema palpável.]
  *[Frase-chicote: conclusão que dói um pouco.]*

Slide 3 — content
  {[Área/Processo 1: Nome Claro]}
  O processo padrão: lista numerada mostrando o inferno atual.
  [Dado: X dias, R$ Y/mês]
  {[Com IA/Automação: tempo real. Custo real.]}
  [Conclusão direta — a conta fecha sozinha.]

Slide 4 — content
  {[Área/Processo 2: Nome Claro]}
  Faz a conta rápido: lista com → mostrando antes/depois com dados.
  Custo: {R$ X/mês} para automação.
  *[Frase de fechamento com urgência.]*

${useFixedSlides
  ? `Slide 5 — cta (FIXO — COPIAR EXATAMENTE, SEM ALTERAR NADA):
${expert.authorSlideTemplate}`
  : `Slide 5 — cta
  Apresentação do autor adaptada ao tema do carrossel. Quem é, o que faz, para quem.
  Tom pessoal e direto. Inclua nome, especialidade e credencial relevante ao tema.
  Finalize com CTA para seguir o perfil.`}

Slide 6 — benefit
  {[Dado/estatística forte]} — *(Fonte se houver)*
  Usar o REFRAME: "A pergunta não é *'[errada]'*"
  {A pergunta certa é:} '[que aponta pro produto]'
  [O concorrente já percebeu. Ele já tá testando.]

Slide 7 — content
  {[Área/Processo 3: Nome Claro]}
  [Modo manual: X tempo/custo.] {[Modo IA: Y tempo/custo.]}
  [Ironia ou paradoxo que torna a comparação óbvia.]
  *[Frase de fechamento cortante.]*

Slide 8 — comparison
  *Modo Antigo:*
  [Passo] → [Passo] → [Resultado lento]. *[X min/h por operação.]*
  {Com Automação de IA:}
  [Passo] → [Resultado rápido]. *[X segundos. Zero erro humano.]*
  Qual dos dois escala quando teu negócio dobra de tamanho?

Slide 9 — proof
  {[Afirmação contraintuitiva ou erro comum.]}
  [Consequência de fazer errado — específica.]
  Anota isso: [analogia concreta e INÉDITA — adaptada ao tema, variada a cada carrossel]
  [O segredo não é a ferramenta. É saber qual processo usar.]
  [CTA suave apontando pro conteúdo/produto.]

${useFixedSlides
  ? `Slide 10 — cta-final (FIXO — COPIAR EXATAMENTE, SEM ALTERAR NADA):
${expert.ctaFinalTemplate}`
  : `Slide 10 — cta-final
  CTA final criativo adaptado ao tema. Peça para seguir, salvar ou compartilhar.
  Inclua: ${expert.productCta}
  Tom: encerramento forte, direto, sem clichês.`}

━━━ IMAGENS (imagePrompt) ━━━

ATENÇÃO: imagePrompt é OBRIGATÓRIO em TODOS os 10 slides, incluindo slides 5 e 10.

- Em INGLÊS, cena fotorrealista, sem texto na imagem
- Situações CONCRETAS — nunca abstrações genéricas
- Contraste emocional quando possível (caótico vs organizado)
- Por tipo de slide:
  hook      → photorealistic scene DIRECTLY representing the carousel topic: show the brand, product, key industry object, or main concept — NOT a generic person looking at a screen
  problem   → messy desk, multiple open tabs, overwhelmed professional
  content   → clean dashboard, automated workflow, organized digital setup
  cta       → warm professional portrait or natural workplace scene
  benefit   → confident professional, upward growth visual, success indicators
  comparison → split view: left=chaotic manual process, right=clean automated setup
  proof     → skilled expert using specialized tool (adapt to topic: surgeon, pilot, engineer, chef, mechanic — choose the most fitting)
  cta-final → person relaxed at desk, business running smoothly, laptop and coffee`
}

// ─── User prompt ─────────────────────────────────────────────────────────────

export function buildUserPrompt(topic: string, hook?: string, options: ContentOptions = {}): string {
  const { textLength = 'medium', useFixedSlides = true } = options

  const textLengthInstruction = {
    short:  'LIMITE OBRIGATÓRIO: máximo 130 caracteres por slide. Ultra-conciso — apenas a ideia central, sem explicações adicionais.',
    medium: 'LIMITE DE TEXTO: máximo 240 caracteres por slide. Conciso e direto ao ponto.',
    long:   'Sem limite fixo — use o espaço necessário para desenvolver bem cada ideia.',
  }[textLength]

  return `Gere um carrossel de 10 slides no estilo Frank Costa sobre:

"${topic}"

${hook ? `━━━ HOOK OBRIGATÓRIO — SLIDE 1 ━━━
O slide 1 DEVE COMEÇAR com exatamente esta frase como primeira linha:
"${hook}"
Esta é a frase de abertura que prende o leitor. Coloque-a como a PRIMEIRA linha do slide 1, com *negrito* ou {destaque} para reforçar. O restante do slide complementa e expande essa ideia.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''}

${textLengthInstruction}

REGRAS CRÍTICAS:
- Slide 1: PRIMEIRA linha = "${hook || 'frase de abertura impactante'}" (obrigatório)
${useFixedSlides
  ? `- Slide 5: COPIAR EXATAMENTE o template do autor fornecido no system prompt. NENHUMA alteração.
- Slide 10: COPIAR EXATAMENTE o template de CTA final. NENHUMA alteração.`
  : `- Slide 5: gerar livremente — apresentação do autor adaptada ao tema.
- Slide 10: gerar livremente — CTA final adaptado ao tema.`}
- Dados sempre específicos com números reais
- Usar pelo menos 1 reframe ("A pergunta não é... A pergunta é:")
- Usar pelo menos 1 lista numerada mostrando processo quebrado
- Slide 8 DEVE ter formato Modo Antigo vs Com Automação com dados de tempo/custo
- imagePrompt é OBRIGATÓRIO em TODOS os 10 slides (incluindo slides 5 e 10)

RESPONDA SOMENTE com JSON válido, sem markdown, sem explicações:

{
  "topic": "${topic}",
  "caption": "legenda Instagram: hook de 1 linha + 3 bullets com dados + CTA salvar + quebras visuais (.) + 5-7 hashtags relevantes",
  "slides": [
    {
      "num": 1,
      "type": "hook",
      "text": "texto do slide — use *negrito* para frase-chicote e {destaque} para dados/valores chave",
      "imagePrompt": "detailed photorealistic scene in English, no text in image — MUST be directly related to the topic"
    }
  ]
}

Tipos válidos por slide: 1=hook, 2=problem, 3=content, 4=content, 5=cta, 6=benefit, 7=content, 8=comparison, 9=proof, 10=cta-final`
}

// ─── Exportação principal ─────────────────────────────────────────────────────

export async function generateCarouselContent(
  expert: ExpertConfig,
  topic: string,
  hook?: string,
  apiKey?: string,
  options: ContentOptions = {}
): Promise<CarouselContent> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada')

  const client = new Anthropic({ apiKey: key })

  // Retry com backoff exponencial para 529 overloaded_error
  let message
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      message = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: buildSystemPrompt(expert, options),
        messages: [{ role: 'user', content: buildUserPrompt(topic, hook, options) }],
      })
      break
    } catch (err: any) {
      lastError = err
      const isOverloaded = err?.status === 529 || err?.error?.type === 'overloaded_error'
      if (!isOverloaded || attempt === 2) throw err
      const wait = (attempt + 1) * 8000 // 8s, 16s
      console.warn(`[content-engine] Anthropic overloaded (tentativa ${attempt + 1}), aguardando ${wait / 1000}s...`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  if (!message) throw lastError

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

// ─── Template Split ("X vs Y") ───────────────────────────────────────────────

export function buildSplitSystemPrompt(expert: ExpertConfig): string {
  const now = new Date()
  const currentDate = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  return `Você é um especialista em conteúdo viral para Instagram no formato carrossel comparativo "X vs Y".
DATA ATUAL: ${currentDate}

Você cria conteúdo para: ${expert.displayName} — especialista em ${expert.niche}.
${expert.bioShort}

REGRAS DE COPYWRITING:
1. Títulos de slide SEMPRE em CAIXA ALTA
2. Máximo 2-3 frases por lado, diretas e impactantes
3. Use **negrito** com duplo asterisco para palavras-chave
4. Tom: direto, assertivo, provocativo — sem rodeios
5. Lado esquerdo: mostra a DOR, a abordagem errada/negativa, a consequência ruim
6. Lado direito: mostra a SOLUÇÃO, a atitude correta, o resultado positivo
7. Gere entre 8 e 10 slides de conteúdo (além da capa e CTA = 10-12 total)
8. Progressão de intensidade: começa leve, termina com as situações mais impactantes
9. CTA final DEVE provocar comentários, marcações ou compartilhamentos
10. Conteúdo deve ser PRÁTICO e ESPECÍFICO — situações reais, não generalidades

Retorne APENAS JSON válido, sem markdown, sem backticks:
{
  "topic": "tema real do carrossel",
  "caption": "Legenda do Instagram com emojis, quebras visuais e 5-7 hashtags relevantes ao nicho",
  "slides": [
    {
      "num": 0,
      "type": "cover",
      "layout": "split-cover",
      "text": "TÍTULO X VS. Y (ex: LÍDER BONZINHO VS. LÍDER HUMANO)",
      "subtitulo": "Pergunta provocativa que gera curiosidade?",
      "labelEsquerda": "Nome do perfil negativo (ex: Líder Bonzinho)",
      "labelDireita": "Nome do perfil positivo (ex: Líder Humano)",
      "imagePrompt": ""
    },
    {
      "num": 1,
      "type": "content",
      "layout": "split-content",
      "text": "SITUAÇÃO ESPECÍFICA EM CAIXA ALTA",
      "esquerda": "Texto do lado negativo com **palavras-chave** em negrito. Máximo 3 frases.",
      "direita": "Texto do lado positivo com **palavras-chave** em negrito. Máximo 3 frases.",
      "labelEsquerda": "Nome do perfil negativo",
      "labelDireita": "Nome do perfil positivo",
      "imagePrompt": "Prompt em inglês para gerar imagem relacionada ao slide (sem texto na imagem)"
    },
    {
      "num": 11,
      "type": "cta-final",
      "layout": "split-cta",
      "text": "PERGUNTA PROVOCATIVA EM CAIXA ALTA?",
      "subtexto": "Call-to-action: marque alguém que precisa ver isso. Salve para reler quando precisar.",
      "hashtags": "#hashtag1 #hashtag2 #hashtag3",
      "imagePrompt": ""
    }
  ]
}`
}

export function buildSplitUserPrompt(topic: string): string {
  return `Crie um carrossel comparativo "X vs Y" sobre o tema: "${topic}"

O carrossel deve ter:
- Capa com título impactante mostrando o contraste dos dois perfis
- 8 a 10 slides de conteúdo (situações práticas, específicas e progressivas)
- Slide final de CTA que provoque comentários e marcações

IMPORTANTE: cada situação deve ser ESPECÍFICA e PRÁTICA.
Evite generalidades — mostre cenas concretas e reconhecíveis do dia a dia.`
}
