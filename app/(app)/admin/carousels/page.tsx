'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw, Eye, Copy, CalendarX2, RotateCcw, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'published'

interface Workspace {
  id: string
  name: string
  slug: string
}

interface CarouselRow {
  id: string
  workspace_id: string | null
  user_id: string | null
  expert_id: string | null
  topic: string
  caption: string
  provider_used: string | null
  model_used: string | null
  ig_post_id: string | null
  published_at: string | null
  scheduled_at: string | null
  created_at: string
  workspace: { name: string; slug: string } | null
  expert: { display_name: string; handle: string } | null
  user: { email: string } | null
}

export default function AdminCarouselsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [rows, setRows] = useState<CarouselRow[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | string>('all')
  const [days, setDays] = useState<'7' | '30' | '90'>('90')
  const [actingId, setActingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<CarouselRow | null>(null)

  async function loadWorkspaces() {
    const res = await fetch('/api/admin/workspaces')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Falha ao listar workspaces')
    setWorkspaces(data.workspaces || [])
  }

  async function loadRows() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('status', status)
      params.set('days', days)
      if (workspaceFilter !== 'all') params.set('workspaceId', workspaceFilter)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/admin/carousels?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao listar carrosséis')
      setRows(data.carousels || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar carrosséis')
    } finally {
      setLoading(false)
    }
  }

  async function loadAll() {
    await Promise.all([loadWorkspaces(), loadRows()])
  }

  useEffect(() => {
    loadAll()
  }, [])

  const counters = useMemo(() => ({
    all: rows.length,
    published: rows.filter((r) => !!r.ig_post_id).length,
    scheduled: rows.filter((r) => !r.ig_post_id && !!r.scheduled_at).length,
    draft: rows.filter((r) => !r.ig_post_id && !r.scheduled_at).length,
  }), [rows])

  function statusBadge(row: CarouselRow) {
    if (row.ig_post_id) return <Badge className="bg-green-700/30 text-green-300">Publicado</Badge>
    if (row.scheduled_at) return <Badge className="bg-amber-700/30 text-amber-300">Agendado</Badge>
    return <Badge className="bg-zinc-700/40 text-zinc-300">Rascunho</Badge>
  }

  async function runAction(id: string, action: 'cancel_schedule' | 'requeue_publish' | 'duplicate' | 'delete') {
    setActingId(id)
    setError('')
    try {
      const res = await fetch('/api/admin/carousels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao executar ação')
      await loadRows()
    } catch (err: any) {
      setError(err.message || 'Erro ao executar ação')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Postagens</h1>
          <p className="text-sm text-zinc-500 mt-1">Visão global de carrosséis, publicações e agendamentos</p>
        </div>
        <Button onClick={loadAll} variant="outline" className="border-zinc-700 text-zinc-200">
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="text-xs text-zinc-500">Total</p><p className="text-xl text-zinc-100 font-semibold">{counters.all}</p></div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="text-xs text-zinc-500">Publicados</p><p className="text-xl text-green-300 font-semibold">{counters.published}</p></div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="text-xs text-zinc-500">Agendados</p><p className="text-xl text-amber-300 font-semibold">{counters.scheduled}</p></div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="text-xs text-zinc-500">Rascunhos</p><p className="text-xl text-zinc-200 font-semibold">{counters.draft}</p></div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tópico, legenda ou e-mail..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="all">Status: todos</option>
            <option value="published">Publicado</option>
            <option value="scheduled">Agendado</option>
            <option value="draft">Rascunho</option>
          </select>
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="all">Workspace: todos</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value as '7' | '30' | '90')}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <Button onClick={loadRows} variant="outline" className="border-zinc-700 text-zinc-200">
            Filtrar
          </Button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-3">Tópico</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Workspace</th>
                  <th className="py-2 pr-3">Expert</th>
                  <th className="py-2 pr-3">Usuário</th>
                  <th className="py-2 pr-3">Modelo</th>
                  <th className="py-2 pr-3">Criado em</th>
                  <th className="py-2 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-900 align-top">
                    <td className="py-3 pr-3">
                      <p className="text-zinc-100 font-medium">{row.topic}</p>
                      <p className="text-xs text-zinc-500 max-w-sm truncate">{row.caption || '—'}</p>
                    </td>
                    <td className="py-3 pr-3">
                      {statusBadge(row)}
                    </td>
                    <td className="py-3 pr-3 text-zinc-300">
                      {row.workspace?.name || '—'}
                    </td>
                    <td className="py-3 pr-3 text-zinc-300">
                      {row.expert ? `${row.expert.display_name || 'Sem nome'} ${row.expert.handle || ''}` : '—'}
                    </td>
                    <td className="py-3 pr-3 text-zinc-400">
                      {row.user?.email || '—'}
                    </td>
                    <td className="py-3 pr-3 text-zinc-400">
                      {row.provider_used || '—'} {row.model_used ? `· ${row.model_used}` : ''}
                    </td>
                    <td className="py-3 pr-3 text-zinc-400 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 border-zinc-700 text-zinc-200"
                          onClick={() => setSelected(row)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 border-zinc-700 text-zinc-200"
                          disabled={actingId === row.id}
                          onClick={() => runAction(row.id, 'duplicate')}
                        >
                          {actingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 border-zinc-700 text-zinc-200"
                          disabled={actingId === row.id || !row.scheduled_at}
                          onClick={() => runAction(row.id, 'cancel_schedule')}
                        >
                          <CalendarX2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 border-zinc-700 text-zinc-200"
                          disabled={actingId === row.id}
                          onClick={() => runAction(row.id, 'requeue_publish')}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 border-red-900 text-red-300"
                          disabled={actingId === row.id}
                          onClick={() => {
                            if (!confirm('Excluir este carrossel?')) return
                            runAction(row.id, 'delete')
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-zinc-500">
                      Nenhuma postagem encontrada com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] rounded-xl border border-zinc-700 bg-zinc-900 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{selected.topic}</p>
                <p className="text-xs text-zinc-500">ID: {selected.id}</p>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-100"
                onClick={() => setSelected(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-2 overflow-y-auto">
              <p className="text-xs text-zinc-500">Workspace: {selected.workspace?.name || '—'}</p>
              <p className="text-xs text-zinc-500">Expert: {selected.expert ? `${selected.expert.display_name} ${selected.expert.handle}` : '—'}</p>
              <p className="text-xs text-zinc-500">Usuário: {selected.user?.email || '—'}</p>
              <p className="text-xs text-zinc-500">Modelo: {selected.provider_used || '—'} {selected.model_used ? `· ${selected.model_used}` : ''}</p>
              <p className="text-xs text-zinc-500">Criado em: {new Date(selected.created_at).toLocaleString('pt-BR')}</p>
              <p className="text-xs text-zinc-500">Agendado: {selected.scheduled_at ? new Date(selected.scheduled_at).toLocaleString('pt-BR') : '—'}</p>
              <p className="text-xs text-zinc-500">Publicado: {selected.published_at ? new Date(selected.published_at).toLocaleString('pt-BR') : '—'}</p>
              <pre className="text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-3 whitespace-pre-wrap break-words">
                {selected.caption || '(sem legenda)'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
