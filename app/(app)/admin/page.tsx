'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Settings, FileText, UserCog, Loader2, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface MetricPayload {
  cards: {
    activeWorkspaces: { total: number; delta30d: number }
    totalUsers: { total: number; newToday: number }
    carousels: { total: number; last24h: number }
    publications: { total: number; last24h: number }
  }
  errors24h: number
  recentActivity: Array<{
    id: string
    event: string
    level: 'info' | 'warn' | 'error'
    created_at: string
    workspace: { name: string; slug: string } | null
    user_email: string
  }>
}

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<MetricPayload | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/metrics')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar dashboard')
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function levelClass(level: 'info' | 'warn' | 'error') {
    if (level === 'error') return 'bg-red-700/30 text-red-300'
    if (level === 'warn') return 'bg-amber-700/30 text-amber-300'
    return 'bg-blue-700/30 text-blue-300'
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Admin</h1>
        <p className="text-sm text-zinc-500 mt-1">Painel operacional da plataforma</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando métricas...
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">Workspaces ativos</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{data.cards.activeWorkspaces.total}</p>
              <p className="text-xs text-zinc-500 mt-1">+{data.cards.activeWorkspaces.delta30d} nos últimos 30d</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">Usuários totais</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{data.cards.totalUsers.total}</p>
              <p className="text-xs text-zinc-500 mt-1">+{data.cards.totalUsers.newToday} hoje</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">Carrosséis gerados</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{data.cards.carousels.total}</p>
              <p className="text-xs text-zinc-500 mt-1">{data.cards.carousels.last24h} nas últimas 24h</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">Publicações</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{data.cards.publications.total}</p>
              <p className="text-xs text-zinc-500 mt-1">{data.cards.publications.last24h} nas últimas 24h</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-zinc-100">Erros nas últimas 24h</p>
            </div>
            <p className="text-xl font-bold text-zinc-100">{data.errors24h}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-zinc-100">Atividade recente</p>
              <Link href="/admin/logs" className="text-xs text-violet-300 hover:text-violet-200">
                Ver todos os logs
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Nível</th>
                    <th className="py-2 pr-3">Evento</th>
                    <th className="py-2 pr-3">Workspace</th>
                    <th className="py-2 pr-3">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-400">{new Date(a.created_at).toLocaleString('pt-BR')}</td>
                      <td className="py-2 pr-3"><Badge className={levelClass(a.level)}>{a.level}</Badge></td>
                      <td className="py-2 pr-3 text-zinc-200">{a.event}</td>
                      <td className="py-2 pr-3 text-zinc-300">{a.workspace?.name || '—'}</td>
                      <td className="py-2 pr-3 text-zinc-500">{a.user_email || '—'}</td>
                    </tr>
                  ))}
                  {data.recentActivity.length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Sem atividade recente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <Link
          href="/admin/workspaces"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Workspaces</h2>
          </div>
          <p className="text-xs text-zinc-500">Listar, criar e suspender clientes.</p>
        </Link>

        <Link
          href="/admin/settings"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          </div>
          <p className="text-xs text-zinc-500">Gerenciar chaves globais de IA da plataforma.</p>
        </Link>

        <Link
          href="/admin/logs"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Logs</h2>
          </div>
          <p className="text-xs text-zinc-500">Auditar eventos, erros e atividade recente.</p>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <UserCog className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Users</h2>
          </div>
          <p className="text-xs text-zinc-500">Gerenciar role e workspace padrão dos usuários.</p>
        </Link>
      </div>
    </div>
  )
}
