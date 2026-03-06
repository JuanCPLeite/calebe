'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLink, Calendar, CheckCircle2, Clock, Trash2,
  Copy, Search, LayoutGrid, List, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Carousel {
  id: string
  topic: string
  caption: string
  slides: Array<{ cardPath?: string; imagePath?: string }>
  ig_post_id: string | null
  published_at: string | null
  scheduled_at: string | null
  created_at: string
}

type FilterTab = 'all' | 'draft' | 'scheduled' | 'published'
type ViewMode  = 'list' | 'grid'

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

// ─── Página ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [carousels,   setCarousels]  = useState<Carousel[]>([])
  const [loading,     setLoading]    = useState(true)
  const [stats,       setStats]      = useState({ total: 0, published: 0, scheduled: 0 })
  const [deleting,    setDeleting]   = useState<string | null>(null)
  const [duplicating, setDuplicating]= useState<string | null>(null)
  const [search,      setSearch]     = useState('')
  const [filter,      setFilter]     = useState<FilterTab>('all')
  const [view,        setView]       = useState<ViewMode>('list')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('carousels')
        .select('id, topic, caption, ig_post_id, published_at, scheduled_at, created_at, slides')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      const rows = data || []
      setCarousels(rows)
      setStats(computeStats(rows))
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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Excluir este carrossel? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    await supabase.from('carousels').delete().eq('id', id)
    setCarousels(prev => {
      const next = prev.filter(c => c.id !== id)
      setStats(computeStats(next))
      return next
    })
    setDeleting(null)
  }

  async function handleDuplicate(e: React.MouseEvent, c: Carousel) {
    e.stopPropagation()
    setDuplicating(c.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDuplicating(null); return }

    const { data } = await supabase
      .from('carousels')
      .insert({
        user_id:  user.id,
        topic:    `${c.topic} (cópia)`,
        caption:  c.caption,
        slides:   c.slides,
      })
      .select('id, topic, caption, ig_post_id, published_at, scheduled_at, created_at, slides')
      .single()

    if (data) {
      setCarousels(prev => {
        const next = [data as Carousel, ...prev]
        setStats(computeStats(next))
        return next
      })
    }
    setDuplicating(null)
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
          <a
            href={`https://www.instagram.com/p/${c.ig_post_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver no Instagram"
            className="p-1.5 rounded-lg text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
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
                <div className="w-12 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  {thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xl">🖼️</span>}
                </div>

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
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                <div className="relative bg-zinc-800 aspect-[4/5] flex items-center justify-center overflow-hidden">
                  {thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                    : <span className="text-5xl opacity-20">🖼️</span>}

                  {/* Slide count */}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md">
                    {slideCount} slides
                  </div>

                  {/* Ações no hover */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
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
                    <a
                      href={`https://www.instagram.com/p/${c.ig_post_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" /> Ver no Instagram
                    </a>
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
