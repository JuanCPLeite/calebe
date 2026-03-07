'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface WorkspaceDetail {
  workspace: {
    id: string
    name: string
    slug: string
    plan: string
    owner_id: string | null
    active: boolean
    created_at: string
  }
  expert: {
    id: string
    display_name: string
    handle: string
    niche: string
  } | null
  usage: {
    total_carousels: number
    carousels_last_30d: number
    total_published: number
  }
  members: Array<{
    id: string
    user_id: string
    role: string
    invited_by: string | null
    created_at: string
    email: string
  }>
  logs: Array<{
    id: string
    event: string
    level: 'info' | 'warn' | 'error'
    payload: Record<string, unknown>
    user_id: string | null
    created_at: string
    email: string
  }>
}

export default function AdminWorkspaceDetailPage() {
  const params = useParams<{ id: string }>()
  const workspaceId = params?.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<WorkspaceDetail | null>(null)

  useEffect(() => {
    async function load() {
      if (!workspaceId) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/admin/workspaces/${workspaceId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar workspace')
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar workspace')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspaceId])

  const levelClass = (level: string) =>
    level === 'error'
      ? 'bg-red-700/30 text-red-300'
      : level === 'warn'
        ? 'bg-amber-700/30 text-amber-300'
        : 'bg-blue-700/30 text-blue-300'

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/workspaces">
            <Button variant="outline" className="border-zinc-700 text-zinc-200">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Workspace Detail</h1>
            <p className="text-sm text-zinc-500 mt-1">{workspaceId}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : data ? (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-lg font-semibold text-zinc-100">{data.workspace.name}</p>
              <Badge className={data.workspace.active ? 'bg-green-700/30 text-green-300' : 'bg-red-700/30 text-red-300'}>
                {data.workspace.active ? 'Ativo' : 'Suspenso'}
              </Badge>
            </div>
            <p className="text-sm text-zinc-400">slug: {data.workspace.slug}</p>
            <p className="text-sm text-zinc-400">plano: {data.workspace.plan}</p>
            <p className="text-sm text-zinc-400">criado em: {new Date(data.workspace.created_at).toLocaleString('pt-BR')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">Carrosséis totais</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{data.usage.total_carousels}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">Últimos 30 dias</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{data.usage.carousels_last_30d}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">Publicados</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{data.usage.total_published}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-zinc-100">Expert</p>
            {data.expert ? (
              <>
                <p className="text-sm text-zinc-300">{data.expert.display_name} ({data.expert.handle})</p>
                <p className="text-xs text-zinc-500">{data.expert.niche || 'nicho não definido'}</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Nenhum expert associado ao workspace.</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-100 mb-3">Membros</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Entrou em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.id} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-200">{m.email || m.user_id}</td>
                      <td className="py-2 pr-3 text-zinc-300">{m.role}</td>
                      <td className="py-2 pr-3 text-zinc-500">{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                  {data.members.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-zinc-500">Sem membros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-100 mb-3">Últimos logs</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Nível</th>
                    <th className="py-2 pr-3">Evento</th>
                    <th className="py-2 pr-3">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((l) => (
                    <tr key={l.id} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-400">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                      <td className="py-2 pr-3"><Badge className={levelClass(l.level)}>{l.level}</Badge></td>
                      <td className="py-2 pr-3 text-zinc-200">{l.event}</td>
                      <td className="py-2 pr-3 text-zinc-500">{l.email || l.user_id || '—'}</td>
                    </tr>
                  ))}
                  {data.logs.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-zinc-500">Sem logs recentes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
