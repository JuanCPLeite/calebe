'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Carousel {
  id: string
  topic: string
  caption: string
  slides: unknown[]
  ig_post_id: string | null
  published_at: string | null
  created_at: string
}

export default function DashboardPage() {
  const supabase = createClient()
  const [carousels, setCarousels] = useState<Carousel[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, published: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('carousels')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const rows = data || []
      setCarousels(rows)
      setStats({
        total: rows.length,
        published: rows.filter((r: Carousel) => r.ig_post_id).length,
      })
      setLoading(false)
    }
    load()
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Carrosséis gerados</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{stats.total}</p>
          <p className="text-xs text-zinc-600 mt-0.5">total</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Publicados</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{stats.published}</p>
          <p className="text-xs text-zinc-600 mt-0.5">no Instagram</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Taxa de publicação</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">
            {stats.total > 0 ? `${Math.round((stats.published / stats.total) * 100)}%` : '—'}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">do gerado</p>
        </div>
      </div>

      {/* Histórico */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Histórico</h2>

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-zinc-500 text-sm">Carregando...</p>
          </div>
        ) : carousels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center">
            <p className="text-zinc-500 text-sm">Nenhum carrossel gerado ainda.</p>
            <p className="text-zinc-600 text-xs mt-1">Vá para <strong className="text-zinc-400">Gerar</strong> para criar o primeiro.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {carousels.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{c.topic}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{c.caption}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    c.ig_post_id
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-zinc-700/50 text-zinc-400'
                  }`}>
                    {c.ig_post_id
                      ? <><CheckCircle2 className="w-3 h-3" /> Publicado</>
                      : <><Clock className="w-3 h-3" /> Rascunho</>
                    }
                  </span>
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <Calendar className="w-3 h-3" />
                    {formatDate(c.created_at)}
                  </span>
                  {c.ig_post_id && (
                    <a
                      href={`https://www.instagram.com/p/${c.ig_post_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
