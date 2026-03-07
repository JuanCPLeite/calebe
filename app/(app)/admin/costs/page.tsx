'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WorkspaceOption {
  id: string
  name: string
}

interface CostData {
  days: number
  from: string
  totalCostUsd: number
  eventCount: number
  workspaces: WorkspaceOption[]
  topWorkspaces: Array<{ workspaceId: string; workspaceName: string; totalCostUsd: number }>
  topUsers: Array<{ userId: string; userName: string; totalCostUsd: number }>
  topModels: Array<{ provider: string; model: string; totalCostUsd: number; totalQuantity: number }>
  daily: Array<{ date: string; totalCostUsd: number }>
}

function usd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })
}

export default function AdminCostsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState('30')
  const [workspaceId, setWorkspaceId] = useState('all')
  const [data, setData] = useState<CostData | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('days', days)
      if (workspaceId !== 'all') params.set('workspaceId', workspaceId)
      const res = await fetch(`/api/admin/costs?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar custos')
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar custos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const avgPerEvent = useMemo(() => {
    if (!data || data.eventCount === 0) return 0
    return data.totalCostUsd / data.eventCount
  }, [data])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin Costs</h1>
          <p className="text-sm text-zinc-500 mt-1">Custos por modelo, workspace e usuário</p>
        </div>
        <Button onClick={load} variant="outline" className="border-zinc-700 text-zinc-200">
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-2 flex-wrap">
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
        <select
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
        >
          <option value="all">Workspace: todos</option>
          {(data?.workspaces || []).map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <Button onClick={load} className="bg-violet-600 hover:bg-violet-500">Filtrar</Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando custos...
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-xs text-zinc-500">Custo total</p>
              <p className="text-lg font-semibold text-zinc-100">{usd(data.totalCostUsd)}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-xs text-zinc-500">Eventos de uso</p>
              <p className="text-lg font-semibold text-zinc-100">{data.eventCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-xs text-zinc-500">Custo médio / evento</p>
              <p className="text-lg font-semibold text-zinc-100">{usd(avgPerEvent)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-sm font-semibold text-zinc-100 mb-3">Top Workspaces por custo</p>
              <div className="space-y-2">
                {data.topWorkspaces.map((item) => (
                  <div key={item.workspaceId} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 truncate">{item.workspaceName}</span>
                    <span className="text-zinc-100 font-medium">{usd(item.totalCostUsd)}</span>
                  </div>
                ))}
                {data.topWorkspaces.length === 0 && <p className="text-xs text-zinc-500">Sem dados no período.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-sm font-semibold text-zinc-100 mb-3">Top Usuários por custo</p>
              <div className="space-y-2">
                {data.topUsers.map((item) => (
                  <div key={item.userId} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 truncate">{item.userName}</span>
                    <span className="text-zinc-100 font-medium">{usd(item.totalCostUsd)}</span>
                  </div>
                ))}
                {data.topUsers.length === 0 && <p className="text-xs text-zinc-500">Sem dados no período.</p>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-100 mb-3">Modelos mais caros no período</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Modelo</th>
                    <th className="py-2 pr-3">Quantidade</th>
                    <th className="py-2 pr-3">Custo USD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topModels.map((item, idx) => (
                    <tr key={`${item.provider}:${item.model}:${idx}`} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.provider}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.model || '—'}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.totalQuantity.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-zinc-100 font-medium">{usd(item.totalCostUsd)}</td>
                    </tr>
                  ))}
                  {data.topModels.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-zinc-500">Sem dados no período.</td></tr>
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

