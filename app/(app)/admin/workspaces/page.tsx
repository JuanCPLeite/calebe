'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, RefreshCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type WorkspacePlan = 'starter' | 'pro' | 'agency'

interface WorkspaceItem {
  id: string
  name: string
  slug: string
  plan: WorkspacePlan
  owner_id: string | null
  active: boolean
  created_at: string
  member_count: number
  total_carousels: number
  total_published: number
  carousels_last_30d: number
  last_activity_at: string | null
}

export default function AdminWorkspacesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | WorkspacePlan>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all')
  const [form, setForm] = useState({
    name: '',
    slug: '',
    plan: 'starter' as WorkspacePlan,
    ownerUserId: '',
  })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (planFilter !== 'all') params.set('plan', planFilter)
      if (activeFilter !== 'all') params.set('active', activeFilter)

      const res = await fetch(`/api/admin/workspaces?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao listar workspaces')
      setItems(data.workspaces || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao listar workspaces')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    if (!form.name.trim()) {
      setError('Nome do workspace é obrigatório.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          plan: form.plan,
          ownerUserId: form.ownerUserId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao criar workspace')
      setForm({ name: '', slug: '', plan: 'starter', ownerUserId: '' })
      await load()
    } catch (err: any) {
      setError(err.message || 'Erro ao criar workspace')
    } finally {
      setSaving(false)
    }
  }

  async function patchWorkspace(id: string, payload: Record<string, unknown>) {
    setError('')
    setUpdatingId(id)
    try {
      const res = await fetch('/api/admin/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar workspace')
      setItems((prev) => prev.map((w) => (w.id === id ? { ...w, ...data.workspace } : w)))
    } finally {
      setUpdatingId(null)
    }
  }

  async function toggleActive(item: WorkspaceItem) {
    const nextActive = !item.active
    const confirmed = window.confirm(
      nextActive
        ? `Reativar o workspace "${item.name}"?`
        : `Suspender o workspace "${item.name}"?`
    )
    if (!confirmed) return

    try {
      await patchWorkspace(item.id, { active: nextActive })
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status')
    }
  }

  async function changePlan(item: WorkspaceItem, plan: WorkspacePlan) {
    try {
      await patchWorkspace(item.id, { plan })
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar plano')
    }
  }

  const total = useMemo(() => items.length, [items])
  const activeCount = useMemo(() => items.filter((w) => w.active).length, [items])
  const totalCarousels = useMemo(
    () => items.reduce((acc, item) => acc + (item.total_carousels || 0), 0),
    [items]
  )
  const totalPublished = useMemo(
    () => items.reduce((acc, item) => acc + (item.total_published || 0), 0),
    [items]
  )

  function formatDateTime(dateLike: string | null) {
    if (!dateLike) return '—'
    const date = new Date(dateLike)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('pt-BR')
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Workspaces</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestão de clientes e status da conta</p>
        </div>
        <Button onClick={load} variant="outline" className="border-zinc-700 text-zinc-200">
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 max-w-4xl">
        <p className="text-sm font-medium text-zinc-100">Criar workspace</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nome"
            className="bg-zinc-800 border-zinc-700 text-zinc-100"
          />
          <Input
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
            placeholder="Slug (opcional)"
            className="bg-zinc-800 border-zinc-700 text-zinc-100"
          />
          <select
            value={form.plan}
            onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value as WorkspacePlan }))}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="starter">starter</option>
            <option value="pro">pro</option>
            <option value="agency">agency</option>
          </select>
          <Input
            value={form.ownerUserId}
            onChange={(e) => setForm((p) => ({ ...p, ownerUserId: e.target.value }))}
            placeholder="ownerUserId (opcional)"
            className="bg-zinc-800 border-zinc-700 text-zinc-100"
          />
        </div>
        <Button onClick={handleCreate} disabled={saving} className="bg-violet-600 hover:bg-violet-500">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Criar workspace
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou slug..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-xs"
          />
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as 'all' | WorkspacePlan)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="all">Plano: todos</option>
            <option value="starter">starter</option>
            <option value="pro">pro</option>
            <option value="agency">agency</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as 'all' | 'true' | 'false')}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
          >
            <option value="all">Status: todos</option>
            <option value="true">Ativos</option>
            <option value="false">Suspensos</option>
          </select>
          <Button onClick={load} variant="outline" className="border-zinc-700 text-zinc-200">
            Filtrar
          </Button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs text-zinc-500">Workspaces</p>
            <p className="text-lg font-semibold text-zinc-100">{total}</p>
            <p className="text-xs text-zinc-500">{activeCount} ativos</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs text-zinc-500">Suspensos</p>
            <p className="text-lg font-semibold text-zinc-100">{Math.max(total - activeCount, 0)}</p>
            <p className="text-xs text-zinc-500">Reativáveis a qualquer momento</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs text-zinc-500">Carrosséis gerados</p>
            <p className="text-lg font-semibold text-zinc-100">{totalCarousels}</p>
            <p className="text-xs text-zinc-500">Base total dos clientes</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs text-zinc-500">Publicações</p>
            <p className="text-lg font-semibold text-zinc-100">{totalPublished}</p>
            <p className="text-xs text-zinc-500">Posts enviados para IG</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Plano</th>
                  <th className="py-2 pr-3">Membros</th>
                  <th className="py-2 pr-3">Uso</th>
                  <th className="py-2 pr-3">Última atividade</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id} className="border-b border-zinc-900">
                    <td className="py-3 pr-3">
                      <p className="text-zinc-100 font-medium">{w.name}</p>
                      <p className="text-xs text-zinc-500">{w.slug}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={w.plan}
                        onChange={(e) => changePlan(w, e.target.value as WorkspacePlan)}
                        disabled={updatingId === w.id}
                        className="h-8 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100"
                      >
                        <option value="starter">starter</option>
                        <option value="pro">pro</option>
                        <option value="agency">agency</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-zinc-300">{w.member_count || 0}</td>
                    <td className="py-3 pr-3">
                      <p className="text-zinc-200">{w.total_carousels || 0} carrosséis</p>
                      <p className="text-xs text-zinc-500">
                        {w.carousels_last_30d || 0} últimos 30d • {w.total_published || 0} publicados
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      {formatDateTime(w.last_activity_at)}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge className={w.active ? 'bg-green-700/30 text-green-300' : 'bg-red-700/30 text-red-300'}>
                        {w.active ? 'Ativo' : 'Suspenso'}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/workspaces/${w.id}`}>
                          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-200">
                            Detalhes
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700 text-zinc-200"
                          onClick={() => toggleActive(w)}
                          disabled={updatingId === w.id}
                        >
                          {w.active ? 'Suspender' : 'Reativar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">
                      Nenhum workspace encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
