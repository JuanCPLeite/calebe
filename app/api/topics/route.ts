import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

// ─── Claude web_search (nativo — usa chave Anthropic existente) ───────────────

async function searchWithClaude(
  searchQuery: string,
  limit: number,
  anthropicKey: string,
): Promise<Topic[]> {
  const client = new Anthropic({ apiKey: anthropicKey })

  console.log('[topics/claude] iniciando busca:', searchQuery)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }] as any,
    messages: [{
      role: 'user',
      content: `Pesquise na web e encontre ${limit} temas/notícias recentes sobre: "${searchQuery}"

Após pesquisar, responda SOMENTE com JSON válido (sem markdown, sem explicações):

{
  "topics": [
    {
      "id": "cs-1",
      "title": "título conciso do tema (máx 70 chars)",
      "viralScore": 78,
      "hook": "frase de gancho para carrossel Instagram — direto e provocativo (em português)",
      "gain": "o que o leitor vai aprender ou ganhar com esse conteúdo",
      "angle": "Tendência urgente",
      "growth": "+230%",
      "postsToday": 112,
      "avgEngagement": "4.1%"
    }
  ]
}

Regras:
- Mantenha o foco EXATAMENTE no tema pesquisado: "${searchQuery}"
- viralScore: 15–99 (quanto mais recente/trending, mais alto)
- angle deve ser: "Tendência urgente", "Oportunidade", "Educacional" ou "Análise"
- hook e gain sempre em português brasileiro
- Retorne exatamente ${limit} tópicos sobre esse tema específico`,
    }],
  })

  console.log('[topics/claude] stop_reason:', response.stop_reason, '| blocks:', response.content.map(b => b.type).join(', '))

  // Com tools server-side, o loop acontece internamente no servidor da Anthropic.
  // O último TextBlock é a resposta final após todas as buscas.
  const textBlocks = response.content.filter(b => b.type === 'text')
  const lastText = textBlocks[textBlocks.length - 1]
  if (!lastText || lastText.type !== 'text') {
    console.warn('[topics/claude] nenhum text block na resposta')
    return []
  }

  console.log('[topics/claude] texto recebido (200 chars):', lastText.text.slice(0, 200))

  const jsonMatch = lastText.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn('[topics/claude] JSON não encontrado no texto')
    return []
  }

  const parsed = JSON.parse(jsonMatch[0])
  return ((parsed.topics || []) as Topic[]).slice(0, limit)
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
  },
  {
    id: 'm3', title: 'Agente IA para e-commerce que vende no automático', viralScore: 61,
    growth: '+95%', postsToday: 74, avgEngagement: '3.5%',
    hook: 'Minha loja vende sem eu estar online. O agente cuida de tudo — da pergunta ao pagamento.',
    gain: 'Lojistas vão entender como configurar um agente que opera 24/7 sem intervenção.',
    angle: 'Resultado real',
  },
  {
    id: 'm4', title: 'Automação que se paga em menos de 30 dias', viralScore: 54,
    growth: '+72%', postsToday: 58, avgEngagement: '3.2%',
    hook: 'Em 11 dias o sistema pagou o próprio custo. Hoje é puro lucro operacional.',
    gain: 'Empreendedores vão calcular o ROI real de automações e saber por onde começar.',
    angle: 'ROI rápido',
  },
  {
    id: 'm5', title: 'ChatGPT Canvas eliminando designers', viralScore: 68,
    growth: '+340%', postsToday: 127, avgEngagement: '5.1%',
    hook: 'Rasguei um contrato de R$ 3.000/mês com designer depois de testar o Canvas.',
    gain: 'Donos de negócio vão produzir material visual profissional sem agência.',
    angle: 'Choque de custo',
  },
]

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await req.json()
    const {
      mode       = 'trending',
      query,
      niche      = 'negócios',
      category,
      dateFilter = '7d',
      limit      = 5,
      offset     = 0,
    } = body

    const searchQuery = buildQuery(mode, niche, query, category)

    // ── 1. Busca chaves do usuário no banco ─────────────────────────────────
    let exaKey: string | undefined
    let anthropicKey: string | undefined

    if (user) {
      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('provider, value')
        .eq('user_id', user.id)
        .in('provider', ['exa', 'anthropic'])

      for (const token of tokens || []) {
        if (token.provider === 'exa' && token.value)        exaKey       = token.value
        if (token.provider === 'anthropic' && token.value)  anthropicKey = token.value
      }
    }

    console.log('[topics] user:', user?.id ?? 'null', '| exaKey:', !!exaKey, '| anthropicKey:', !!anthropicKey)

    // ── 2. EXA Search (melhor para paginação e filtros de data) ────────────
    if (exaKey) {
      try {
        const { topics, hasMore } = await searchWithExa(
          searchQuery, niche, limit, offset, dateFilter, exaKey,
        )
        return NextResponse.json({ topics, hasMore, source: 'exa' })
      } catch (err: any) {
        console.warn('[topics/exa] falhou, tentando Claude web_search:', err.message)
      }
    }

    // ── 3. Claude web_search nativo (usa chave Anthropic — já configurada) ─
    if (anthropicKey) {
      try {
        const topics = await searchWithClaude(searchQuery, limit, anthropicKey)
        if (topics.length > 0) {
          return NextResponse.json({ topics, hasMore: false, source: 'claude' })
        }
      } catch (err: any) {
        console.warn('[topics/claude] falhou:', err.message, err.status ?? '')
      }
    }

    // ── 4. Mock fallback ────────────────────────────────────────────────────
    const sliced = MOCK_TOPICS.slice(offset, offset + limit)
    return NextResponse.json({
      topics: sliced,
      hasMore: false,
      noKey: !exaKey && !anthropicKey,
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
