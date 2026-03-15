'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLink, Calendar, CheckCircle2, Clock, Trash2,
  Copy, Search, LayoutGrid, List, Loader2, RotateCcw, CheckSquare, Square,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { FrankCard } from '@/components/generate/frank-card'
import { SplitCard, type SplitSlide } from '@/components/generate/split-card'
import { getActiveExpertContext } from '@/lib/expert-client'

interface Carousel {
  id: string
  topic: string
  caption: string
  expert_id?: string | null
  provider_used?: string | null
  model_used?: string | null
  slides: Array<{ cardPath?: string; imagePath?: string; text?: string; imageHeightPercent?: number; imagePosition?: 'top' | 'bottom'; imageObjectX?: number; imageObjectY?: number; fontSize?: number; highlightEnabled?: boolean }>
  ig_post_id: string | null
  published_at: string | null
  scheduled_at: string | null
  created_at: string
}

interface Expert {
  display_name: string
  handle: string
  highlight_color: string
  avatar_url?: string | null
}

interface WorkspaceLimits {
  planLabel: string
  monthlyPostCredits: number
  usedCredits: number
  remainingCredits: number
  usagePercent: number
  budgetLimitUsd: number
  usedBudgetUsd: number
  budgetUsagePercent: number
  canGenerate: boolean
  recommendation?: {
    recommendedPlanId: string
    recommendedPlanLabel: string
    reason: string
  } | null
}

type FilterTab = 'all' | 'draft' | 'scheduled' | 'published'
type ViewMode  = 'list' | 'grid'
const DASHBOARD_VIEW_KEY = 'dashboard_view_mode'

function computeStats(rows: Carousel[]) {
  return {
    total:     rows.length,
    published: rows.filter(r => r.ig_post_id).length,
    scheduled: rows.filter(r => r.scheduled_at && !r.ig_post_id).length,
  }
}

function getThumbnail(c: Carousel) {
  return Array.isArray(c.slides) && c.slides.length > 0
    ? (c.slides[0] as any)?.cardPath || (c.slides[0] as any)?.imagePath
    : null
}

function isSplitCarousel(c: Carousel) {
  return Array.isArray(c.slides) && (c.slides[0] as any)?.layout?.startsWith('split')
}

function getStatus(c: Carousel): 'published' | 'scheduled' | 'draft' {
  if (c.ig_post_id)   return 'published'
  if (c.scheduled_at) return 'scheduled'
  return 'draft'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatScheduled(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatCreditValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function usd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

function StatusBadge({ c }: { c: Carousel }) {
  const s = getStatus(c)
  return (
    <span className={cn(
      'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
      s === 'published' ? 'bg-green-600/20 text-green-400'  :
      s === 'scheduled' ? 'bg-amber-600/20 text-amber-400'  :
                          'bg-zinc-700/50  text-zinc-400',
    )}>
      {s === 'published' && <><CheckCircle2 className="w-3 h-3" /> Publicado</>}
      {s === 'scheduled' && <><Calendar     className="w-3 h-3" /> Agendado</>}
      {s === 'draft'     && <><Clock        className="w-3 h-3" /> Rascunho</>}
    </span>
  )
}

function ResponsiveFrankThumb({
  text,
  imagePath,
  expert,
  imageHeightPercent,
  imagePosition,
  imageObjectX,
  imageObjectY,
  fontSize,
  highlightEnabled,
}: {
  text: string
  imagePath?: string
  expert: Expert
  imageHeightPercent?: number
  imagePosition?: 'top' | 'bottom'
  imageObjectX?: number
  imageObjectY?: number
  fontSize?: number
  highlightEnabled?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(280)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      if (w > 0) setWidth(w)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      <FrankCard
        text={text}
        imagePath={imagePath}
        authorName={expert.display_name}
        authorHandle={expert.handle}
        highlightColor={expert.highlight_color}
        avatarUrl={expert.avatar_url ?? undefined}
        imageHeightPercent={imageHeightPercent ?? 0}
        imagePosition={imagePosition ?? 'bottom'}
        imageObjectX={imageObjectX ?? 50}
        imageObjectY={imageObjectY ?? 50}
        fontSizeOverride={fontSize}
        highlightEnabled={highlightEnabled !== false}
        format="portrait"
        displayWidth={width}
      />
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [carousels,   setCarousels]  = useState<Carousel[]>([])
  const [expert,      setExpert]     = useState<Expert | null>(null)
  const [loading,     setLoading]    = useState(true)
  const [stats,       setStats]      = useState({ total: 0, published: 0, scheduled: 0 })
  const [deleting,    setDeleting]   = useState<string | null>(null)
  const [duplicating, setDuplicating]= useState<string | null>(null)
  const [reposting,   setReposting]  = useState<string | null>(null)
  const [openingLink, setOpeningLink]= useState<string | null>(null)
  const [bulkAction,  setBulkAction] = useState<string | null>(null)
  const [search,      setSearch]     = useState('')
  const [filter,      setFilter]     = useState<FilterTab>('all')
  const [view,        setView]       = useState<ViewMode>('list')
  const [viewReady,   setViewReady]  = useState(false)
  const [workspaceLimits, setWorkspaceLimits] = useState<WorkspaceLimits | null>(null)
  const [selectedIds, setSelectedIds]= useState<string[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(DASHBOARD_VIEW_KEY)
    if (saved === 'list' || saved === 'grid') {
      setView(saved)
    }
    setViewReady(true)
  }, [])

  useEffect(() => {
    if (!viewReady) return
    localStorage.setItem(DASHBOARD_VIEW_KEY, view)
  }, [view, viewReady])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: carouselData }, expertCtx] = await Promise.all([
        supabase
          .from('carousels')
          .select('id, topic, caption, expert_id, provider_used, model_used, ig_post_id, published_at, scheduled_at, created_at, slides')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(100),
        getActiveExpertContext(supabase, user.id),
      ])

      const rows = carouselData || []
      setCarousels(rows)
      setStats(computeStats(rows))
      if (expertCtx.expert) setExpert(expertCtx.expert as Expert)

      const limitsRes = await fetch('/api/workspace/limits').catch(() => null)
      const limitsJson = limitsRes ? await limitsRes.json().catch(() => null) : null
      if (limitsRes?.ok && limitsJson) {
        setWorkspaceLimits({
          planLabel: limitsJson.planLabel || 'Starter',
          monthlyPostCredits: Number(limitsJson.monthlyPostCredits) || 0,
          usedCredits: Number(limitsJson.usedCredits) || 0,
          remainingCredits: Number(limitsJson.remainingCredits) || 0,
          usagePercent: Number(limitsJson.usagePercent) || 0,
          budgetLimitUsd: Number(limitsJson.budgetLimitUsd) || 0,
          usedBudgetUsd: Number(limitsJson.usedBudgetUsd) || 0,
          budgetUsagePercent: Number(limitsJson.budgetUsagePercent) || 0,
          canGenerate: Boolean(limitsJson.canGenerate),
          recommendation: limitsJson.recommendation || null,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = carousels
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.topic.toLowerCase().includes(q))
    }
    if (filter === 'draft')     list = list.filter(c => !c.ig_post_id && !c.scheduled_at)
    if (filter === 'scheduled') list = list.filter(c => !!c.scheduled_at && !c.ig_post_id)
    if (filter === 'published') list = list.filter(c => !!c.ig_post_id)
    return list
  }, [carousels, search, filter])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((item) => item.id === id)))
  }, [filtered])

  async function runCarouselAction(ids: string[], action: 'duplicate' | 'repost' | 'get_permalink' | 'delete_system' | 'delete_instagram' | 'delete_both') {
    const res = await fetch('/api/carousels/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    })
    const data = await res.json()
    if (!res.ok && res.status !== 207) throw new Error(data.error || 'Falha ao executar ação')
    return Array.isArray(data.results) ? data.results : []
  }

  function removeCarouselsFromState(ids: string[]) {
    setCarousels((prev) => {
      const next = prev.filter((item) => !ids.includes(item.id))
      setStats(computeStats(next))
      return next
    })
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
  }

  function updateCarousel(id: string, patch: Partial<Carousel>) {
    setCarousels((prev) => {
      const next = prev.map((item) => item.id === id ? { ...item, ...patch } : item)
      setStats(computeStats(next))
      return next
    })
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Excluir este carrossel do sistema?')) return
    setDeleting(id)
    try {
      const results = await runCarouselAction([id], 'delete_system')
      const failed = results.find((item: any) => !item.ok)
      if (failed) throw new Error(failed.error || 'Falha ao excluir carrossel')
      removeCarouselsFromState([id])
    } catch {
      setDeleting(null)
      return
    } finally {
      setDeleting(null)
    }
  }

  async function handleDuplicate(e: React.MouseEvent, c: Carousel) {
    e.stopPropagation()
    setDuplicating(c.id)
    try {
      const results = await runCarouselAction([c.id], 'duplicate')
      const failed = results.find((item: any) => !item.ok)
      if (failed) throw new Error(failed.error || 'Falha ao duplicar carrossel')
      window.location.reload()
    } finally {
      setDuplicating(null)
    }
  }

  async function handleRepost(e: React.MouseEvent, c: Carousel) {
    e.stopPropagation()
    setReposting(c.id)
    try {
      const results = await runCarouselAction([c.id], 'repost')
      const failed = results.find((item: any) => !item.ok)
      if (failed) throw new Error(failed.error || 'Falha ao repostar')
      const success = results.find((item: any) => item.ok)
      if (success?.permalink) {
        window.open(success.permalink as string, '_blank', 'noopener,noreferrer')
      }
      window.location.reload()
    } catch {
      setReposting(null)
      return
    } finally {
      setReposting(null)
    }
  }

  async function handleOpenPost(e: React.MouseEvent, c: Carousel) {
    e.stopPropagation()
    if (!c.ig_post_id) return
    setOpeningLink(c.id)
    try {
      const results = await runCarouselAction([c.id], 'get_permalink')
      const success = results.find((item: any) => item.ok)
      const url = success?.permalink || `https://www.instagram.com/p/${c.ig_post_id}/`
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningLink(null)
    }
  }

  async function handleBulkDelete(action: 'delete_system' | 'delete_instagram' | 'delete_both') {
    if (!selectedIds.length) return
    const labels: Record<typeof action, string> = {
      delete_system: 'Excluir os selecionados do sistema?',
      delete_instagram: 'Remover os selecionados do Instagram?',
      delete_both: 'Excluir os selecionados do sistema e do Instagram?',
    }
    if (!confirm(labels[action])) return

    setBulkAction(action)
    try {
      const results = await runCarouselAction(selectedIds, action)
      const successIds = results.filter((item: any) => item.ok).map((item: any) => item.id as string)
      if (action === 'delete_instagram') {
        for (const id of successIds) {
          updateCarousel(id, { ig_post_id: null, published_at: null })
        }
        setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)))
      } else {
        removeCarouselsFromState(successIds)
      }
    } finally {
      setBulkAction(null)
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }

  function toggleSelectAllVisible() {
    const visibleIds = filtered.map((item) => item.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    setSelectedIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleIds.includes(id))
      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }

  const FILTER_TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',       label: 'Todos',      count: carousels.length },
    { key: 'draft',     label: 'Rascunhos',  count: carousels.filter(c => !c.ig_post_id && !c.scheduled_at).length },
    { key: 'scheduled', label: 'Agendados',  count: stats.scheduled },
    { key: 'published', label: 'Publicados', count: stats.published },
  ]

  // ─── Actions inline (evita re-render da lista inteira) ───────────────────
  function ActionButtons({ c }: { c: Carousel }) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        {c.ig_post_id && (
          <button
            onClick={(e) => handleOpenPost(e, c)}
            title="Ver no Instagram"
            className="p-1.5 rounded-lg text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 transition-colors"
          >
            {openingLink === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={e => handleRepost(e, c)}
          disabled={reposting === c.id}
          title="Repostar"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
        >
          {reposting === c.id
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RotateCcw className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleSelection(c.id)
          }}
          title={selectedIds.includes(c.id) ? 'Desmarcar' : 'Selecionar'}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {selectedIds.includes(c.id) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={e => handleDuplicate(e, c)}
          disabled={duplicating === c.id}
          title="Duplicar"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
        >
          {duplicating === c.id
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Copy    className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={e => handleDelete(e, c.id)}
          disabled={deleting === c.id}
          title="Excluir"
          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-900/10 disabled:opacity-40 transition-colors"
        >
          {deleting === c.id
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2  className="w-3.5 h-3.5" />}
        </button>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => setView('list')}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-md transition-colors',
              view === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-md transition-colors',
              view === 'grid' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {workspaceLimits && (workspaceLimits.usagePercent >= 80 || (workspaceLimits.budgetLimitUsd > 0 && workspaceLimits.budgetUsagePercent >= 80)) && (
        <div className={`rounded-xl border px-4 py-3 ${
          workspaceLimits.usagePercent >= 100 || (workspaceLimits.budgetLimitUsd > 0 && workspaceLimits.budgetUsagePercent >= 100)
            ? 'border-red-700/40 bg-red-950/20'
            : 'border-amber-700/40 bg-amber-950/20'
        }`}>
          <p className={`text-xs font-medium ${
            workspaceLimits.usagePercent >= 100 || (workspaceLimits.budgetLimitUsd > 0 && workspaceLimits.budgetUsagePercent >= 100)
              ? 'text-red-300'
              : 'text-amber-300'
          }`}>
            {workspaceLimits.usagePercent >= 100
              ? 'Créditos do mês esgotados.'
              : workspaceLimits.budgetLimitUsd > 0 && workspaceLimits.budgetUsagePercent >= 100
                ? 'Orçamento mensal de custo esgotado.'
                : 'Uso de créditos/custo alto.'}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {formatCreditValue(workspaceLimits.usedCredits)}/{formatCreditValue(workspaceLimits.monthlyPostCredits)} usados no plano {workspaceLimits.planLabel}.
            {workspaceLimits.usagePercent >= 80 ? ' Upgrade recomendado.' : ''}
          </p>
          {workspaceLimits.budgetLimitUsd > 0 && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {usd(workspaceLimits.usedBudgetUsd)}/{usd(workspaceLimits.budgetLimitUsd)} de orçamento ({workspaceLimits.budgetUsagePercent}%).
            </p>
          )}
          {workspaceLimits.recommendation && (
            <p className="text-xs text-amber-300 mt-0.5">
              Recomendação: upgrade para {workspaceLimits.recommendation.recommendedPlanLabel}. {workspaceLimits.recommendation.reason}
            </p>
          )}
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Gerados</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{stats.total}</p>
          <p className="text-xs text-zinc-600 mt-0.5">total</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Rascunhos</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">
            {stats.total - stats.published - stats.scheduled}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">não publicados</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Agendados</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{stats.scheduled}</p>
          <p className="text-xs text-zinc-600 mt-0.5">para publicar</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Publicados</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{stats.published}</p>
          <p className="text-xs text-zinc-600 mt-0.5">no Instagram</p>
        </div>
      </div>

      {/* Filtros + Busca */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Abas */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                filter === tab.key ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {tab.label}
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[10px] tabular-nums',
                filter === tab.key ? 'bg-zinc-600 text-zinc-200' : 'bg-zinc-800 text-zinc-500',
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por tópico..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleSelectAllVisible}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700"
          >
            {filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))
              ? <CheckSquare className="w-3.5 h-3.5" />
              : <Square className="w-3.5 h-3.5" />}
            Selecionar visíveis
          </button>
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs text-zinc-500">{selectedIds.length} selecionados</span>
              <button
                onClick={() => handleBulkDelete('delete_instagram')}
                disabled={bulkAction !== null}
                className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-1.5 text-xs text-amber-300 disabled:opacity-50"
              >
                {bulkAction === 'delete_instagram' ? 'Processando...' : 'Excluir Instagram'}
              </button>
              <button
                onClick={() => handleBulkDelete('delete_system')}
                disabled={bulkAction !== null}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
              >
                {bulkAction === 'delete_system' ? 'Processando...' : 'Excluir sistema'}
              </button>
              <button
                onClick={() => handleBulkDelete('delete_both')}
                disabled={bulkAction !== null}
                className="rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50"
              >
                {bulkAction === 'delete_both' ? 'Processando...' : 'Excluir ambos'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>

      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
          <p className="text-zinc-500 text-sm">
            {search || filter !== 'all' ? 'Nenhum resultado encontrado.' : 'Nenhum carrossel gerado ainda.'}
          </p>
          {!search && filter === 'all' && (
            <p className="text-zinc-600 text-xs mt-1">
              Vá para <strong className="text-zinc-400">Gerar</strong> para criar o primeiro.
            </p>
          )}
        </div>

      ) : view === 'list' ? (
        /* ── LISTA ──────────────────────────────────────────────────────── */
        <div className="space-y-2">
          {filtered.map(c => {
            const thumb = getThumbnail(c)
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/dashboard/${c.id}`)}
                className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors group"
              >
                {/* Thumbnail */}
                <div className="w-12 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : isSplitCarousel(c) ? (
                    <div className="w-full h-full overflow-hidden pointer-events-none">
                      <SplitCard
                        slide={c.slides[0] as unknown as SplitSlide}
                        accentColor={expert?.highlight_color ?? '#F59E0B'}
                        displayWidth={48}
                      />
                    </div>
                  ) : expert && c.slides[0]?.text ? (
                    <div className="w-full h-full overflow-hidden pointer-events-none">
                      <FrankCard
                        text={c.slides[0].text}
                        imagePath={c.slides[0].imagePath}
                        authorName={expert.display_name}
                        authorHandle={expert.handle}
                        highlightColor={expert.highlight_color}
                        avatarUrl={expert.avatar_url ?? undefined}
                        imageHeightPercent={c.slides[0].imageHeightPercent ?? 0}
                        imagePosition={c.slides[0].imagePosition ?? 'bottom'}
                        imageObjectX={c.slides[0].imageObjectX ?? 50}
                        imageObjectY={c.slides[0].imageObjectY ?? 50}
                        fontSizeOverride={c.slides[0].fontSize}
                        highlightEnabled={c.slides[0].highlightEnabled !== false}
                        format="portrait"
                        displayWidth={48}
                      />
                    </div>
                  ) : (
                    <span className="text-xl">🖼️</span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelection(c.id)
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  {selectedIds.includes(c.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{c.topic}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{c.caption}</p>
                  {c.scheduled_at && !c.ig_post_id && (
                    <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Agendado para {formatScheduled(c.scheduled_at)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge c={c} />
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <Calendar className="w-3 h-3" />
                    {formatDate(c.created_at)}
                  </span>
                  <ActionButtons c={c} />
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        /* ── GRID ───────────────────────────────────────────────────────── */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {filtered.map(c => {
            const thumb      = getThumbnail(c)
            const slideCount = Array.isArray(c.slides) ? c.slides.length : 0
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/dashboard/${c.id}`)}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden cursor-pointer hover:border-zinc-600 hover:shadow-lg hover:shadow-black/30 transition-all"
              >
                {/* Thumbnail */}
                <div className="relative bg-white aspect-[4/5] flex items-center justify-center overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : isSplitCarousel(c) ? (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <SplitCard
                        slide={c.slides[0] as unknown as SplitSlide}
                        accentColor={expert?.highlight_color ?? '#F59E0B'}
                        displayWidth={300}
                      />
                    </div>
                  ) : expert && c.slides[0]?.text ? (
                    <ResponsiveFrankThumb
                      text={c.slides[0].text}
                      imagePath={c.slides[0].imagePath}
                      expert={expert}
                      imageHeightPercent={c.slides[0].imageHeightPercent}
                      imagePosition={c.slides[0].imagePosition}
                      imageObjectX={c.slides[0].imageObjectX}
                      imageObjectY={c.slides[0].imageObjectY}
                      fontSize={c.slides[0].fontSize}
                      highlightEnabled={c.slides[0].highlightEnabled}
                    />
                  ) : (
                    <span className="text-5xl opacity-20">🖼️</span>
                  )}

                  {/* Slide count */}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md">
                    {slideCount} slides
                  </div>

                  {/* Ações no hover */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelection(c.id)
                      }}
                      title={selectedIds.includes(c.id) ? 'Desmarcar' : 'Selecionar'}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors shadow"
                    >
                      {selectedIds.includes(c.id) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={e => handleRepost(e, c)}
                      disabled={reposting === c.id}
                      title="Repostar"
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow"
                    >
                      {reposting === c.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={e => handleDuplicate(e, c)}
                      disabled={duplicating === c.id}
                      title="Duplicar"
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow"
                    >
                      {duplicating === c.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Copy    className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={e => handleDelete(e, c.id)}
                      disabled={deleting === c.id}
                      title="Excluir"
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-900/90 text-zinc-400 hover:text-red-400 hover:bg-red-900/30 disabled:opacity-40 transition-colors shadow"
                    >
                      {deleting === c.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2  className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium text-zinc-100 truncate">{c.topic}</p>
                  <div className="flex items-center justify-between">
                    <StatusBadge c={c} />
                    <span className="text-[10px] text-zinc-600">{formatDate(c.created_at)}</span>
                  </div>
                  {c.ig_post_id && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      onClick={(e) => handleOpenPost(e, c)}
                    >
                      {openingLink === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />} Abrir post
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
