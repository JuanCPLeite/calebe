'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TopicCard, type Topic } from './topic-card'
import { RefreshCw, Search, TrendingUp, Globe, Loader2, Key, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mode        = 'trending' | 'search' | 'explore'
type DateFilter  = '24h' | '7d' | '30d' | '3m'

interface TopicDiscoveryProps {
  niche: string
  onSelect: (topic: Topic, hook: string) => void
}

// ─── Categorias do modo explorar ──────────────────────────────────────────────

const EXPLORE_CATEGORIES = [
  { label: '💰 Finanças',       query: 'finanças pessoais investimentos poupança riqueza' },
  { label: '🤖 IA & Tech',      query: 'inteligência artificial automação ferramentas tecnologia' },
  { label: '💪 Saúde',          query: 'saúde bem-estar mental fitness energia produtividade' },
  { label: '📱 Marketing',      query: 'marketing digital tráfego pago Instagram conteúdo' },
  { label: '🏠 Negócios',       query: 'empreendedorismo negócios crescimento vendas faturamento' },
  { label: '🎓 Educação',       query: 'educação cursos online aprendizado carreira profissional' },
  { label: '✈️ Lifestyle',      query: 'estilo de vida liberdade financeira viagem trabalho remoto' },
  { label: '🔧 Produtividade',  query: 'produtividade organização sistemas rotina eficiência' },
]

const DATE_LABELS: Record<DateFilter, string> = {
  '24h': 'Últimas 24h',
  '7d':  'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '3m':  'Últimos 3 meses',
}

const LIMIT_OPTIONS = [5, 10, 15, 20]

// ─── Componente ───────────────────────────────────────────────────────────────

export function TopicDiscovery({ niche, onSelect }: TopicDiscoveryProps) {
  const [mode, setMode]                 = useState<Mode>('trending')
  const [dateFilter, setDateFilter]     = useState<DateFilter>('7d')
  const [searchQuery, setSearchQuery]   = useState('')
  const [activeCategory, setActiveCategory] = useState<(typeof EXPLORE_CATEGORIES)[0] | null>(null)
  const [topics, setTopics]             = useState<Topic[]>([])
  const [loading, setLoading]           = useState(false)
  const [hasMore, setHasMore]           = useState(false)
  const [noKey, setNoKey]               = useState(false)
  const [source, setSource]             = useState<'exa' | 'claude' | 'mock' | ''>('')
  const [limit, setLimit]               = useState(5)
  const [offset, setOffset]             = useState(0)
  const [showLimitMenu, setShowLimitMenu] = useState(false)
  const limitMenuRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown de limit ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (limitMenuRef.current && !limitMenuRef.current.contains(e.target as Node)) {
        setShowLimitMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Fetch de tópicos ───────────────────────────────────────────────────────

  const fetchTopics = useCallback(async (opts: {
    mode: Mode
    dateFilter: DateFilter
    query?: string
    category?: string
    limit: number
    offset: number
    append?: boolean
  }) => {
    setLoading(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: opts.mode,
          niche,
          query: opts.query,
          category: opts.category,
          dateFilter: opts.dateFilter,
          limit: opts.limit,
          offset: opts.offset,
        }),
      })
      const data = await res.json()
      setNoKey(!!data.noKey)
      setHasMore(!!data.hasMore)
      setSource(data.source || '')

      if (opts.append) {
        setTopics(prev => [...prev, ...(data.topics || [])])
      } else {
        setTopics(data.topics || [])
      }
    } catch (err) {
      console.error('[TopicDiscovery]', err)
    } finally {
      setLoading(false)
    }
  }, [niche])

  // Carrega trending ao montar e quando filtro/nicho muda
  useEffect(() => {
    if (mode === 'trending') {
      setOffset(0)
      fetchTopics({ mode: 'trending', dateFilter, limit, offset: 0 })
    }
  }, [mode, dateFilter, limit, niche])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleRefresh() {
    setOffset(0)
    if (mode === 'trending') {
      fetchTopics({ mode: 'trending', dateFilter, limit, offset: 0 })
    } else if (mode === 'search' && searchQuery.trim()) {
      fetchTopics({ mode: 'search', dateFilter, query: searchQuery.trim(), limit, offset: 0 })
    } else if (mode === 'explore' && activeCategory) {
      fetchTopics({ mode: 'explore', dateFilter, category: activeCategory.query, limit, offset: 0 })
    }
  }

  function handleSearch() {
    if (!searchQuery.trim()) return
    setOffset(0)
    setTopics([])
    fetchTopics({ mode: 'search', dateFilter, query: searchQuery.trim(), limit, offset: 0 })
  }

  function handleCategory(cat: typeof EXPLORE_CATEGORIES[0]) {
    setActiveCategory(cat)
    setOffset(0)
    setTopics([])
    fetchTopics({ mode: 'explore', dateFilter, category: cat.query, limit, offset: 0 })
  }

  function handleLoadMore() {
    const newOffset = offset + limit
    setOffset(newOffset)
    const opts = mode === 'search'
      ? { mode: 'search' as Mode, dateFilter, query: searchQuery.trim(), limit, offset: newOffset, append: true }
      : mode === 'explore' && activeCategory
        ? { mode: 'explore' as Mode, dateFilter, category: activeCategory.query, limit, offset: newOffset, append: true }
        : { mode: 'trending' as Mode, dateFilter, limit, offset: newOffset, append: true }
    fetchTopics(opts)
  }

  function handleTabChange(newMode: Mode) {
    setMode(newMode)
    setTopics([])
    setOffset(0)
    setHasMore(false)
    if (newMode === 'explore') setActiveCategory(null)
  }

  function handleDateChange(df: DateFilter) {
    setDateFilter(df)
    setOffset(0)
    // Re-fetch com novo filtro de data
    if (mode === 'trending') {
      fetchTopics({ mode: 'trending', dateFilter: df, limit, offset: 0 })
    } else if (mode === 'search' && searchQuery.trim()) {
      fetchTopics({ mode: 'search', dateFilter: df, query: searchQuery.trim(), limit, offset: 0 })
    } else if (mode === 'explore' && activeCategory) {
      fetchTopics({ mode: 'explore', dateFilter: df, category: activeCategory.query, limit, offset: 0 })
    }
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit)
    setOffset(0)
    setShowLimitMenu(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Filtro de data — sempre visível */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 flex-shrink-0">Período:</span>
        <div className="flex gap-1.5">
          {(['24h', '7d', '30d', '3m'] as DateFilter[]).map(df => (
            <button
              key={df}
              onClick={() => handleDateChange(df)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                dateFilter === df
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
              )}
            >
              {df}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-600 ml-1">{DATE_LABELS[dateFilter]}</span>
      </div>

      {/* Tabs de modo */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl w-fit border border-zinc-800">
        {([
          { id: 'trending' as Mode, icon: TrendingUp, label: '🔥 Trending no meu nicho' },
          { id: 'search'   as Mode, icon: Search,     label: '🔍 Busca livre' },
          { id: 'explore'  as Mode, icon: Globe,      label: '🌐 Explorar' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              mode === id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Indicador de fonte */}
      {source && (
        <div className="flex items-center gap-2">
          {source === 'exa' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-emerald-900/40 border border-emerald-700/50 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              EXA Search
            </span>
          )}
          {source === 'claude' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-violet-900/40 border border-violet-700/50 text-violet-300">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
              Claude web_search
            </span>
          )}
          {source === 'mock' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block" />
              Exemplos
            </span>
          )}
        </div>
      )}

      {/* Banner sem chave — aparece quando nenhum token de busca está configurado */}
      {noKey && (
        <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3">
          <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-amber-200 font-medium mb-1">Configure uma chave para buscar tendências reais</p>
            <p className="text-xs text-amber-400/80">
              Adicione sua{' '}
              <Link href="/tokens" className="underline underline-offset-2 font-medium hover:text-amber-200">
                chave Anthropic (Claude) em Tokens & APIs
              </Link>{' '}
              para busca via IA — ou EXA Search para busca neural avançada.
              Enquanto isso, mostrando exemplos.
            </p>
          </div>
        </div>
      )}

      {/* ── TRENDING ──────────────────────────────────────────── */}
      {mode === 'trending' && (
        <div className="space-y-3">
          {/* Cabeçalho com controles */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Trending · <span className="text-zinc-300">{niche}</span>
              {topics.length > 0 && <span> · {topics.length} temas</span>}
            </p>
            <div className="flex items-center gap-2">
              {/* Quantos resultados */}
              <div className="relative" ref={limitMenuRef}>
                <button
                  onClick={() => setShowLimitMenu(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors bg-zinc-900"
                >
                  Mostrar {limit}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showLimitMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 py-1 min-w-[100px]">
                    {LIMIT_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => handleLimitChange(opt)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs transition-colors',
                          limit === opt
                            ? 'text-violet-400 bg-violet-900/30'
                            : 'text-zinc-300 hover:bg-zinc-700'
                        )}
                      >
                        {opt} temas
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Atualizar */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-300 transition-colors bg-zinc-900 disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
                Atualizar
              </button>
            </div>
          </div>

          <TopicList
            topics={topics}
            loading={loading}
            hasMore={hasMore}
            onSelect={onSelect}
            onLoadMore={handleLoadMore}
          />
        </div>
      )}

      {/* ── BUSCA LIVRE ─────────────────────────────────────── */}
      {mode === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: automação de propostas comerciais, IA para e-commerce..."
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
            />
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>

          {topics.length === 0 && !loading && (
            <p className="text-sm text-zinc-500 text-center py-8">
              Digite um tema e pressione Enter ou clique em Buscar
            </p>
          )}

          <TopicList
            topics={topics}
            loading={loading}
            hasMore={hasMore}
            onSelect={onSelect}
            onLoadMore={handleLoadMore}
          />
        </div>
      )}

      {/* ── EXPLORAR ────────────────────────────────────────── */}
      {mode === 'explore' && (
        <div className="space-y-4">
          {/* Grade de categorias */}
          <div className="grid grid-cols-4 gap-2">
            {EXPLORE_CATEGORIES.map(cat => (
              <button
                key={cat.label}
                onClick={() => handleCategory(cat)}
                className={cn(
                  'p-3 rounded-xl border text-sm text-left transition-all',
                  activeCategory?.label === cat.label
                    ? 'bg-violet-600/20 border-violet-500 text-violet-200 shadow-md shadow-violet-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Resultados da categoria selecionada */}
          {activeCategory && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {activeCategory.label}
                    {topics.length > 0 && <span> · {topics.length} temas</span>}
                  </span>
                  <button
                    onClick={() => { setActiveCategory(null); setTopics([]) }}
                    className="text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-300 transition-colors bg-zinc-900 disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
                  Atualizar
                </button>
              </div>

              <TopicList
                topics={topics}
                loading={loading}
                hasMore={hasMore}
                onSelect={onSelect}
                onLoadMore={handleLoadMore}
              />
            </div>
          )}

          {!activeCategory && (
            <p className="text-sm text-zinc-500 text-center py-6">
              Selecione uma categoria para ver tendências
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TopicList — lista com loading + load more ────────────────────────────────

function TopicList({
  topics,
  loading,
  hasMore,
  onSelect,
  onLoadMore,
}: {
  topics: Topic[]
  loading: boolean
  hasMore: boolean
  onSelect: (topic: Topic, hook: string) => void
  onLoadMore: () => void
}) {
  if (loading && topics.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 gap-3 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Buscando tópicos...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {topics.map((topic, i) => (
        <TopicCard key={topic.id} topic={topic} rank={i + 1} onSelect={onSelect} />
      ))}

      {/* Carregar mais */}
      {(hasMore || loading) && topics.length > 0 && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500 hover:border-violet-500 hover:text-violet-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</>
            : '↓ Carregar mais temas'
          }
        </button>
      )}
    </div>
  )
}
