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
function buildSystemPrompt(expert: ExpertConfig): string {
  return `Você é ${expert.displayName}, criador de conteúdo especialista em ${expert.niche}.

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
   Ex: IA mal usada = "Ferrari batendo no poste"
   Ex: automação ruim = "robô que liga às 3 da manhã"

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

Slide 5 — cta (FIXO — COPIAR EXATAMENTE, SEM ALTERAR NADA):
${expert.authorSlideTemplate}

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
  Anota isso: [analogia concreta — Ferrari, jet ski, tradutor de idiomas...]
  [O segredo não é a ferramenta. É saber qual processo usar.]
  [CTA suave apontando pro conteúdo/produto.]

Slide 10 — cta-final (FIXO — COPIAR EXATAMENTE, SEM ALTERAR NADA):
${expert.ctaFinalTemplate}

━━━ IMAGENS (imagePrompt) ━━━

- Em INGLÊS, cena fotorrealista, sem texto na imagem
- Situações CONCRETAS de trabalho/negócio — nunca abstrações genéricas
- Contraste emocional quando possível (caótico vs organizado)
- Ambiente brasileiro quando fizer sentido
- Por tipo de slide:
  hook    → person looking at screen with "I can't believe I didn't know this" expression
  problem → messy desk, multiple open tabs, overwhelmed expression
  content → clean dashboard, automated workflow, organized setup
  cta     → warm approachable photo (if expert photo available: use it)
  comparison → split: left=chaotic manual work, right=clean automated setup
  proof   → powerful object requiring skill (Ferrari, cockpit, precision instrument)
  cta-final → person relaxed, business running smoothly, laptop + coffee`
}

// ─── User prompt ─────────────────────────────────────────────────────────────

function buildUserPrompt(topic: string, hook?: string): string {
  return `Gere um carrossel de 10 slides no estilo Frank Costa sobre:

"${topic}"

${hook ? `Hook sugerido para o slide 1 (adapte se necessário): "${hook}"` : ''}

REGRAS CRÍTICAS:
- Slide 5: COPIAR EXATAMENTE o template do autor fornecido no system prompt. NENHUMA alteração.
- Slide 10: COPIAR EXATAMENTE o template de CTA final. NENHUMA alteração.
- Dados sempre específicos com números reais
- Usar pelo menos 1 reframe ("A pergunta não é... A pergunta é:")
- Usar pelo menos 1 lista numerada mostrando processo quebrado
- Slide 8 DEVE ter formato Modo Antigo vs Com Automação com dados de tempo/custo

RESPONDA SOMENTE com JSON válido, sem markdown, sem explicações:

{
  "topic": "${topic}",
  "caption": "legenda Instagram: hook de 1 linha + 3 bullets com dados + CTA salvar + quebras visuais (.) + 5-7 hashtags relevantes",
  "slides": [
    {
      "num": 1,
      "type": "hook",
      "text": "texto do slide — use *negrito* para frase-chicote e {destaque} para dados/valores chave",
      "imagePrompt": "detailed photorealistic scene in English, no text in image"
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
