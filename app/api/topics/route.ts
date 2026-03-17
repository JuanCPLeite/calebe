import { NextRequest, NextResponse } from 'next/server'
import { getAppKeys } from '@/lib/workspace'
import Anthropic from '@anthropic-ai/sdk'
import type { Topic } from '@/components/generate/topic-card'

// ─── Tipos EXA ───────────────────────────────────────────────────────────────

interface ExaResult {
  id: string
  url: string
  title: string
  score: number
  publishedDate?: string
  summary?: string
  author?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retorna ISO string do início do período de filtro */
function getDateFrom(dateFilter: string): string {
  const now = new Date()
  switch (dateFilter) {
    case '24h': now.setHours(now.getHours() - 24);  break
    case '7d':  now.setDate(now.getDate() - 7);      break
    case '30d': now.setDate(now.getDate() - 30);     break
    case '3m':  now.setDate(now.getDate() - 90);     break
    default:    now.setDate(now.getDate() - 7)
  }
  return now.toISOString()
}

/** Constrói a query de busca de acordo com o modo */
function buildQuery(
  mode: string,
  niche: string,
  query?: string,
  category?: string,
): string {
  if (mode === 'search' && query) {
    // Busca livre: foca exatamente no que o usuário digitou
    return `${query} tendências 2026 conteúdo Instagram`
  }
  if (mode === 'explore' && category) {
    // Explorar: foca na categoria selecionada
    const cat = category.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\s]+/u, '').trim()
    return `${cat} tendências 2026 novidades Instagram`
  }
  // Trending: usa o nicho do expert
  return `${niche} tendências 2026 Instagram conteúdo viral`
}

/** Transforma um resultado do EXA em Topic */
function exaToTopic(result: ExaResult, index: number, niche: string): Topic {
  const score = Math.min(1, Math.max(0, result.score ?? 0.5))
  const viralScore = Math.min(99, Math.max(15, Math.round(score * 100)))

  const title = (result.title || 'Tema sem título')
    .replace(/ - .*$/, '')
    .replace(/ \| .*$/, '')
    .trim()

  const summary = result.summary?.trim() || ''

  const hookSentence = summary.split(/[.!?]/)[0]?.trim()
  const hook = hookSentence && hookSentence.length > 20
    ? hookSentence + '.'
    : `${title} — entenda por que isso está mudando o mercado de ${niche}.`

  const sentences = summary.split(/[.!?]/).filter(s => s.trim().length > 10)
  const gain = sentences[1]?.trim()
    ? sentences[1].trim() + '.'
    : `Sua audiência vai entender como aplicar isso diretamente no negócio.`

  const angle =
    viralScore >= 80 ? 'Tendência urgente' :
    viralScore >= 65 ? 'Oportunidade' :
    viralScore >= 50 ? 'Educacional' : 'Análise'

  return {
    id: result.id || `exa-${index}`,
    title,
    viralScore,
    growth: viralScore >= 80
      ? `+${Math.round(viralScore * 5.8)}%`
      : viralScore >= 60
        ? `+${Math.round(viralScore * 2.8)}%`
        : `+${Math.round(viralScore * 1.3)}%`,
    postsToday: Math.max(8, Math.round(viralScore * 2.3)),
    avgEngagement: viralScore >= 80 ? '5.1%' : viralScore >= 60 ? '3.4%' : '2.0%',
    hook,
    gain,
    angle,
  }
}

// ─── Claude — geração de tópicos por conhecimento (sem tool, rápido e confiável) ──

async function generateWithClaude(
  searchQuery: string,
  limit: number,
  anthropicKey: string,
  dateFilter: string = '7d',
  isSplit: boolean = false,
): Promise<Topic[]> {
  const client = new Anthropic({ apiKey: anthropicKey })

  const tema = searchQuery.split(' tendências')[0].split(' novidades')[0].trim()

  const now = new Date()
  const currentDate = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const periodoLabel: Record<string, string> = {
    '24h': 'nas últimas 24 horas',
    '7d':  'nos últimos 7 dias',
    '30d': 'nos últimos 30 dias',
    '3m':  'nos últimos 3 meses',
  }
  const periodo = periodoLabel[dateFilter] || 'nos últimos 7 dias'

  const splitFields = isSplit ? `
      "splitTitle": "PERFIL NEGATIVO VS. PERFIL POSITIVO em caixa alta, ex: FREELANCER RAIZ VS. FREELANCER PROFISSIONAL",
      "splitSubtitle": "pergunta provocativa de capa que gera curiosidade, ex: Qual dos dois é você?",
      "splitAltTitles": [
        { "labelEsquerda": "Nome perfil negativo alternativo", "labelDireita": "Nome perfil positivo alternativo" }
      ],` : ''

  const splitRules = isSplit ? `
- splitTitle: dois perfis contrastantes em CAIXA ALTA separados por " VS. " — específicos e reconhecíveis
- splitSubtitle: pergunta provocativa e direta sobre o contraste (máx 60 chars)
- splitAltTitles: 1 contraste alternativo para o mesmo tema` : `
- hook: frase de abertura impactante sobre ${tema} — direto, em português coloquial`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: Math.min(8192, Math.max(2048, limit * 400)),
    messages: [{
      role: 'user',
      content: `Você é um especialista em conteúdo viral para Instagram no Brasil.
DATA ATUAL: ${currentDate}. Gere tópicos relevantes para ${periodo}.

Gere ${limit} ideias de tópicos para carrosséis do Instagram sobre: "${tema}"

Responda SOMENTE com JSON válido, sem markdown, sem texto extra:

{
  "topics": [
    {
      "id": "t1",
      "title": "título direto e específico sobre ${tema} (máx 70 chars)",
      "viralScore": 78,${splitFields}
      "hook": "frase de abertura impactante — direto, em português",
      "gain": "o que o seguidor vai aprender ou ganhar com esse carrossel",
      "angle": "Tendência urgente",
      "growth": "+230%",
      "postsToday": 112,
      "avgEngagement": "4.1%"
    }
  ]
}

Regras OBRIGATÓRIAS:
- Todos os tópicos devem ser especificamente sobre: "${tema}"
- NÃO gere tópicos sobre outros assuntos além de "${tema}"
- Tópicos variados e com ângulos diferentes entre si
- viralScore: 15–99 baseado no potencial de engajamento
- angle: "Tendência urgente" | "Oportunidade" | "Educacional" | "Análise"
- gain sempre em português brasileiro coloquial
- Retorne exatamente ${limit} tópicos${splitRules}`,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.warn('[topics/claude] sem bloco de texto na resposta')
    return []
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn('[topics/claude] JSON não encontrado na resposta:', textBlock.text.slice(0, 200))
    return []
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return ((parsed.topics || []) as Topic[]).slice(0, limit)
  } catch (e) {
    console.warn('[topics/claude] falha ao parsear JSON:', e)
    return []
  }
}

// ─── Enriquece tópicos EXA com splitTitle para X vs Y ────────────────────────

async function enrichWithSplitTitles(topics: Topic[], niche: string, anthropicKey: string): Promise<Topic[]> {
  const client = new Anthropic({ apiKey: anthropicKey })
  const titlesInput = topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Para cada tema abaixo, gere um título de carrossel comparativo "X vs Y" no estilo Instagram viral.

Nicho: ${niche}
Temas:
${titlesInput}

Responda APENAS com JSON válido:
{
  "results": [
    {
      "splitTitle": "PERFIL NEGATIVO VS. PERFIL POSITIVO em caixa alta",
      "splitSubtitle": "pergunta provocativa curta (máx 60 chars)"
    }
  ]
}

Regras:
- splitTitle: dois perfis contrastantes em CAIXA ALTA com " VS. " — concretos e reconhecíveis
- splitSubtitle: pergunta que gera curiosidade e identidade
- Retorne exatamente ${topics.length} resultados na mesma ordem`,
    }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return topics

  try {
    const parsed = JSON.parse(match[0])
    const results = parsed.results || []
    return topics.map((t, i) => ({
      ...t,
      splitTitle: results[i]?.splitTitle ?? undefined,
      splitSubtitle: results[i]?.splitSubtitle ?? undefined,
    }))
  } catch {
    return topics
  }
}

// ─── EXA Search ──────────────────────────────────────────────────────────────

async function searchWithExa(
  searchQuery: string,
  niche: string,
  limit: number,
  offset: number,
  dateFilter: string,
  exaKey: string,
): Promise<{ topics: Topic[]; hasMore: boolean }> {
  const startPublishedDate = getDateFrom(dateFilter)
  const numResults = limit + offset + 1

  const exaRes = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': exaKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: searchQuery,
      numResults,
      type: 'neural',
      startPublishedDate,
      contents: {
        summary: true,
        summaryNumSentences: 2,
      },
    }),
  })

  if (!exaRes.ok) {
    throw new Error(`EXA error ${exaRes.status}: ${await exaRes.text()}`)
  }

  const exaData = await exaRes.json()
  const allResults: ExaResult[] = exaData.results || []
  const pageResults = allResults.slice(offset, offset + limit)
  const hasMore = allResults.length > offset + limit

  return {
    topics: pageResults.map((r, i) => exaToTopic(r, i + offset, niche)),
    hasMore,
  }
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

const MOCK_TOPICS: Topic[] = [
  {
    id: 'm1', title: 'IA que responde WhatsApp por você', viralScore: 82,
    growth: '+520%', postsToday: 201, avgEngagement: '4.2%',
    hook: 'Seu WhatsApp pode responder clientes enquanto você dorme — menos de R$ 50/mês.',
    gain: 'Empresários vão montar atendimento automático sem contratar ninguém.',
    angle: 'Custo oculto',
    splitTitle: 'ATENDIMENTO MANUAL VS. ATENDIMENTO AUTOMATIZADO',
    splitSubtitle: 'Qual dos dois está perdendo vendas às 23h?',
    splitAltTitles: [{ labelEsquerda: 'Dono Apagando Incêndio', labelDireita: 'Dono Com Sistema Rodando' }],
    altAngles: [
      { label: 'Medo de perder', hook: 'Seu concorrente já automatizou o WhatsApp. Você ainda não sabe.' },
      { label: 'Tutorial', hook: '5 passos para o WhatsApp responder por você — sem programar nada.' },
    ],
  },
  {
    id: 'm2', title: 'n8n vs Make: qual usar em 2026', viralScore: 71,
    growth: '+180%', postsToday: 89, avgEngagement: '3.8%',
    hook: 'Errei gastando R$ 1.200 no Make antes de descobrir o n8n. Vou te poupar esse erro.',
    gain: 'Profissionais vão escolher a ferramenta certa e economizar tempo e dinheiro.',
    angle: 'Erro pessoal',
    splitTitle: 'QUEM USA MAKE VS. QUEM USA N8N',
    splitSubtitle: 'A diferença de R$ 800/mês que ninguém te contou.',
  },
  {
    id: 'm3', title: 'Agente IA para e-commerce que vende no automático', viralScore: 61,
    growth: '+95%', postsToday: 74, avgEngagement: '3.5%',
    hook: 'Minha loja vende sem eu estar online. O agente cuida de tudo — da pergunta ao pagamento.',
    gain: 'Lojistas vão entender como configurar um agente que opera 24/7 sem intervenção.',
    angle: 'Resultado real',
    splitTitle: 'LOJA SEM AGENTE VS. LOJA COM AGENTE DE IA',
    splitSubtitle: 'Quem vende mais enquanto dorme?',
  },
  {
    id: 'm4', title: 'Automação que se paga em menos de 30 dias', viralScore: 54,
    growth: '+72%', postsToday: 58, avgEngagement: '3.2%',
    hook: 'Em 11 dias o sistema pagou o próprio custo. Hoje é puro lucro operacional.',
    gain: 'Empreendedores vão calcular o ROI real de automações e saber por onde começar.',
    angle: 'ROI rápido',
    splitTitle: 'PROCESSO MANUAL VS. PROCESSO AUTOMATIZADO',
    splitSubtitle: 'Qual dos dois escala sem contratar mais gente?',
  },
  {
    id: 'm5', title: 'ChatGPT Canvas eliminando designers', viralScore: 68,
    growth: '+340%', postsToday: 127, avgEngagement: '5.1%',
    hook: 'Rasguei um contrato de R$ 3.000/mês com designer depois de testar o Canvas.',
    gain: 'Donos de negócio vão produzir material visual profissional sem agência.',
    angle: 'Choque de custo',
    splitTitle: 'NEGÓCIO COM AGÊNCIA VS. NEGÓCIO COM IA',
    splitSubtitle: 'R$ 3.000/mês de diferença. Vale a pena?',
  },
  {
    id: 'm6', title: 'Prompt engineering: do zero ao avançado em 7 dias', viralScore: 77,
    growth: '+290%', postsToday: 143, avgEngagement: '4.8%',
    hook: 'Aprendi a escrever prompts que geram resultado em 7 dias. Vou te ensinar o caminho.',
    gain: 'Profissionais vão dominar prompts que economizam horas de trabalho toda semana.',
    angle: 'Educacional',
    splitTitle: 'QUEM USA PROMPT GENÉRICO VS. QUEM DOMINA ENGENHARIA DE PROMPT',
    splitSubtitle: 'Qual resultado você prefere?',
  },
  {
    id: 'm7', title: 'Criação de conteúdo com IA: 30 posts em 1 hora', viralScore: 88,
    growth: '+610%', postsToday: 312, avgEngagement: '6.2%',
    hook: 'Gerei 30 posts para o mês inteiro em menos de 60 minutos. Sem contratar redator.',
    gain: 'Criadores vão estruturar um sistema de conteúdo que funciona no piloto automático.',
    angle: 'Tendência urgente',
    splitTitle: 'CRIADOR SEM SISTEMA VS. CRIADOR COM SISTEMA DE IA',
    splitSubtitle: 'Quem publica mais e com mais consistência?',
  },
  {
    id: 'm8', title: 'LinkedIn com IA: como gerar leads B2B todo dia', viralScore: 65,
    growth: '+145%', postsToday: 98, avgEngagement: '3.6%',
    hook: 'Meu LinkedIn traz 3 a 5 leads qualificados por semana — com IA trabalhando por mim.',
    gain: 'Consultores e prestadores de serviço vão transformar LinkedIn em canal de aquisição.',
    angle: 'Oportunidade',
    splitTitle: 'LINKEDIN PARADO VS. LINKEDIN COM IA GERANDO LEADS',
    splitSubtitle: 'Qual perfil fecha mais contratos?',
  },
  {
    id: 'm9', title: 'Copy com IA: headlines que param o scroll', viralScore: 73,
    growth: '+210%', postsToday: 167, avgEngagement: '4.4%',
    hook: 'Testei 200 headlines com IA. Essas 5 fórmulas funcionam sempre.',
    gain: 'Profissionais de marketing vão escrever copies mais rápido e com melhores resultados.',
    angle: 'Tendência urgente',
    splitTitle: 'COPY GENÉRICO VS. COPY COM ESTRUTURA DE IA',
    splitSubtitle: 'Qual para mais o scroll?',
  },
  {
    id: 'm10', title: 'Precificação com IA: nunca mais cobrar barato', viralScore: 59,
    growth: '+88%', postsToday: 52, avgEngagement: '2.9%',
    hook: 'Eu cobrava R$ 500 pelo serviço que hoje vale R$ 3.000. A IA me ajudou a precificar direito.',
    gain: 'Freelancers e prestadores de serviço vão aprender a defender o preço com dados.',
    angle: 'Erro pessoal',
    splitTitle: 'FREELANCER QUE COBRA NO CHUTE VS. FREELANCER QUE PRECIFICA COM DADOS',
    splitSubtitle: 'Qual dos dois fecha mais e recebe mais?',
  },
  {
    id: 'm11', title: 'Funil de vendas automático com IA em 2026', viralScore: 79,
    growth: '+380%', postsToday: 189, avgEngagement: '5.3%',
    hook: 'Montei um funil que qualifica, nutre e converte sem eu tocar em nada.',
    gain: 'Empreendedores vão estruturar um funil que vende 24/7 sem equipe de vendas.',
    angle: 'Resultado real',
    splitTitle: 'FUNIL MANUAL VS. FUNIL AUTOMATIZADO COM IA',
    splitSubtitle: 'Qual converte mais leads dormindo?',
  },
  {
    id: 'm12', title: 'IA para análise de métricas do Instagram', viralScore: 56,
    growth: '+67%', postsToday: 43, avgEngagement: '2.7%',
    hook: 'Passei a entender minhas métricas de verdade depois que a IA começou a analisar.',
    gain: 'Criadores vão tomar decisões de conteúdo baseadas em dados, não em feeling.',
    angle: 'Análise',
    splitTitle: 'CRIADOR QUE PUBLICA NO FEELING VS. CRIADOR QUE PUBLICA COM DADOS',
    splitSubtitle: 'Qual cresce mais rápido?',
  },
  {
    id: 'm13', title: 'Carrossel viral: estrutura dos 10 slides perfeitos', viralScore: 84,
    growth: '+470%', postsToday: 234, avgEngagement: '5.7%',
    hook: 'Todo carrossel viral tem a mesma estrutura. Vou te mostrar slide por slide.',
    gain: 'Criadores de conteúdo vão parar de improvisar e começar a publicar com estratégia.',
    angle: 'Educacional',
    splitTitle: 'CARROSSEL SEM ESTRUTURA VS. CARROSSEL COM ESTRUTURA VIRAL',
    splitSubtitle: 'Qual salva mais e gera mais seguidores?',
  },
  {
    id: 'm14', title: 'Automação de proposta comercial com IA', viralScore: 62,
    growth: '+102%', postsToday: 67, avgEngagement: '3.3%',
    hook: 'Minha proposta sai em 8 minutos com IA. Antes levava 2 horas.',
    gain: 'Vendedores e consultores vão fechar mais rápido com propostas profissionais e personalizadas.',
    angle: 'ROI rápido',
    splitTitle: 'PROPOSTA MANUAL VS. PROPOSTA GERADA COM IA',
    splitSubtitle: 'Qual fecha mais rápido?',
  },
  {
    id: 'm15', title: 'Recrutamento com IA: contratar melhor em menos tempo', viralScore: 51,
    growth: '+58%', postsToday: 39, avgEngagement: '2.5%',
    hook: 'Reduzi o tempo de contratação de 3 semanas para 4 dias usando IA no processo.',
    gain: 'Gestores e RHs vão acelerar contratações sem abrir mão de qualidade.',
    angle: 'Análise',
    splitTitle: 'RECRUTAMENTO TRADICIONAL VS. RECRUTAMENTO COM IA',
    splitSubtitle: 'Qual encontra o candidato certo mais rápido?',
  },
]

// ─── Classificação de erros de API ───────────────────────────────────────────

function classifyApiError(message: string, provider: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('credit') || msg.includes('balance') || msg.includes('billing'))
    return `Saldo insuficiente na conta ${provider}. Adicione créditos em console.${provider === 'Anthropic' ? 'anthropic.com' : 'exa.ai'}/billing.`
  if (msg.includes('invalid') && msg.includes('key') || msg.includes('authentication') || msg.includes('unauthorized') || msg.includes('401'))
    return `Chave ${provider} inválida. Verifique no painel admin → Settings.`
  if (msg.includes('rate limit') || msg.includes('429'))
    return `Limite de requisições atingido na ${provider}. Tente em alguns segundos.`
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch'))
    return `Erro de conexão com a ${provider}. Verifique sua internet e tente novamente.`
  return `Erro na ${provider}: ${message.slice(0, 120)}`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      mode       = 'trending',
      query,
      niche      = 'negócios',
      category,
      dateFilter = '7d',
      limit      = 5,
      offset     = 0,
      templateId = 'frank-costa-10',
    } = body

    const isSplit = templateId === 'positivo-negativo'
    const searchQuery = buildQuery(mode, niche, query, category)

    // ── 1. Busca chaves globais da plataforma ───────────────────────────────
    const appKeys = await getAppKeys()
    const exaKey = appKeys.exaKey || process.env.EXA_API_KEY || ''
    const anthropicKey = appKeys.anthropicKey || process.env.ANTHROPIC_API_KEY || ''


    // ── 2. EXA Search (melhor para paginação e filtros de data) ────────────
    let apiError: string | undefined

    if (exaKey) {
      try {
        const { topics, hasMore } = await searchWithExa(
          searchQuery, niche, limit, offset, dateFilter, exaKey,
        )
        // Para X vs Y, enriquece os tópicos do EXA com splitTitle via Claude
        if (isSplit && anthropicKey && topics.length > 0) {
          const enriched = await enrichWithSplitTitles(topics, niche, anthropicKey)
          return NextResponse.json({ topics: enriched, hasMore, source: 'exa' })
        }
        return NextResponse.json({ topics, hasMore, source: 'exa' })
      } catch (err: any) {
        console.warn('[topics/exa] falhou:', err.message)
        apiError = classifyApiError(err.message, 'EXA')
      }
    }

    // ── 3. Claude — geração por conhecimento (rápido, usa chave Anthropic) ──
    if (anthropicKey) {
      try {
        const topics = await generateWithClaude(searchQuery, limit, anthropicKey, dateFilter, isSplit)
        if (topics.length > 0) {
          return NextResponse.json({ topics, hasMore: false, source: 'claude' })
        }
      } catch (err: any) {
        console.warn('[topics/claude] falhou:', err.message)
        apiError = classifyApiError(err.message, 'Anthropic')
      }
    }

    // ── 4. Mock fallback ────────────────────────────────────────────────────
    // Se houve erro de API (crédito, chave inválida, etc.) ou não há chave → sem temas
    const hasKey = Boolean(exaKey || anthropicKey)
    const mockTopics: Topic[] = (!hasKey && !apiError && mode === 'trending')
      ? MOCK_TOPICS.slice(offset, offset + limit)
      : []

    return NextResponse.json({
      topics: mockTopics,
      hasMore: false,
      noKey: !hasKey,
      apiError: apiError ?? null,
      source: 'mock',
    })

  } catch (err: any) {
    console.error('[topics]', err.message)
    return NextResponse.json(
      { topics: MOCK_TOPICS.slice(0, 5), hasMore: false, error: err.message },
      { status: 200 },
    )
  }
}
