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
  creditUsage: Array<{
    workspaceId: string
    workspaceName: string
    planId: string
    usedCredits: number
    creditLimit: number
    usagePercent: number
  }>
  monthlyProjection: Array<{
    workspaceId: string
    workspaceName: string
    planId: string
    monthCostUsd: number
    projectedMonthCostUsd: number
  }>
  alerts: Array<{ level: 'info' | 'warn'; message: string }>
}

interface PriceRow {
  id: string
  provider: string
  model: string
  unit: string
  price_per_unit: number
  currency: string
  effective_from: string
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
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [savingPrice, setSavingPrice] = useState(false)
  const [seedingPrice, setSeedingPrice] = useState(false)
  const [priceForm, setPriceForm] = useState({
    provider: 'anthropic',
    model: '',
    unit: 'token_in',
    pricePerUnit: '0',
    currency: 'USD',
    effectiveFrom: '',
  })

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
    loadPrices()
  }, [])

  const avgPerEvent = useMemo(() => {
    if (!data || data.eventCount === 0) return 0
    return data.totalCostUsd / data.eventCount
  }, [data])

  async function loadPrices() {
    try {
      const res = await fetch('/api/admin/costs/prices')
      const json = await res.json()
      if (!res.ok) return
      setPrices(json.prices || [])
    } catch {
      // noop
    }
  }

  async function addPrice() {
    setSavingPrice(true)
    try {
      const res = await fetch('/api/admin/costs/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(priceForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar preço')
      setPriceForm((prev) => ({ ...prev, model: '', pricePerUnit: '0', effectiveFrom: '' }))
      await loadPrices()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar preço')
    } finally {
      setSavingPrice(false)
    }
  }

  async function seedEstimatedPrices() {
    setSeedingPrice(true)
    try {
      const res = await fetch('/api/admin/costs/prices/seed', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao semear preços')
      await loadPrices()
      await load()
    } catch (err: any) {
      setError(err.message || 'Erro ao semear preços')
    } finally {
      setSeedingPrice(false)
    }
  }

  async function deletePrice(id: string) {
    try {
      const res = await fetch('/api/admin/costs/prices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir preço')
      await loadPrices()
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir preço')
    }
  }

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

          {data.alerts.length > 0 && (
            <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-300">Alertas de custo e uso</p>
              {data.alerts.map((alert, idx) => (
                <p key={idx} className={`text-xs ${alert.level === 'warn' ? 'text-amber-300' : 'text-zinc-300'}`}>
                  • {alert.message}
                </p>
              ))}
            </div>
          )}

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

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-100 mb-3">Uso de créditos mensais por workspace</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Workspace</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Uso</th>
                    <th className="py-2 pr-3">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.creditUsage.map((item) => (
                    <tr key={item.workspaceId} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.workspaceName}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.planId}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.usedCredits}/{item.creditLimit}</td>
                      <td className={`py-2 pr-3 font-medium ${item.usagePercent >= 100 ? 'text-red-400' : item.usagePercent >= 80 ? 'text-amber-400' : 'text-zinc-100'}`}>
                        {item.usagePercent}%
                      </td>
                    </tr>
                  ))}
                  {data.creditUsage.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-zinc-500">Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-100 mb-3">Projeção mensal de custo (USD)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Workspace</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Mês atual</th>
                    <th className="py-2 pr-3">Projeção do mês</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyProjection.map((item) => (
                    <tr key={item.workspaceId} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.workspaceName}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.planId}</td>
                      <td className="py-2 pr-3 text-zinc-100">{usd(item.monthCostUsd)}</td>
                      <td className="py-2 pr-3 text-zinc-100 font-medium">{usd(item.projectedMonthCostUsd)}</td>
                    </tr>
                  ))}
                  {data.monthlyProjection.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-zinc-500">Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-zinc-100">Catálogo de Preços (USD)</p>
              <Button onClick={seedEstimatedPrices} disabled={seedingPrice} variant="outline" className="border-zinc-700 text-zinc-200">
                {seedingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Seed estimado'}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Seed estimado serve como ponto de partida. Ajuste com preços reais do provider.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              <select
                value={priceForm.provider}
                onChange={(e) => setPriceForm((p) => ({ ...p, provider: e.target.value }))}
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              >
                <option value="anthropic">anthropic</option>
                <option value="openai">openai</option>
                <option value="google">google</option>
                <option value="meta">meta</option>
                <option value="internal">internal</option>
              </select>
              <input
                value={priceForm.model}
                onChange={(e) => setPriceForm((p) => ({ ...p, model: e.target.value }))}
                placeholder="modelo (opcional)"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <select
                value={priceForm.unit}
                onChange={(e) => setPriceForm((p) => ({ ...p, unit: e.target.value }))}
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              >
                <option value="token_in">token_in</option>
                <option value="token_out">token_out</option>
                <option value="image">image</option>
                <option value="publish">publish</option>
                <option value="render">render</option>
              </select>
              <input
                type="number"
                step="0.00000001"
                min="0"
                value={priceForm.pricePerUnit}
                onChange={(e) => setPriceForm((p) => ({ ...p, pricePerUnit: e.target.value }))}
                placeholder="preço por unidade"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <input
                value={priceForm.currency}
                onChange={(e) => setPriceForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                placeholder="USD"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <input
                type="datetime-local"
                value={priceForm.effectiveFrom}
                onChange={(e) => setPriceForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <Button onClick={addPrice} disabled={savingPrice} className="bg-violet-600 hover:bg-violet-500">
                {savingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Modelo</th>
                    <th className="py-2 pr-3">Unidade</th>
                    <th className="py-2 pr-3">Preço</th>
                    <th className="py-2 pr-3">Vigente em</th>
                    <th className="py-2 pr-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{row.provider}</td>
                      <td className="py-2 pr-3 text-zinc-300">{row.model || '—'}</td>
                      <td className="py-2 pr-3 text-zinc-300">{row.unit}</td>
                      <td className="py-2 pr-3 text-zinc-100">{Number(row.price_per_unit || 0).toFixed(8)} {row.currency}</td>
                      <td className="py-2 pr-3 text-zinc-300">{new Date(row.effective_from).toLocaleString('pt-BR')}</td>
                      <td className="py-2 pr-3">
                        <button onClick={() => deletePrice(row.id)} className="text-xs text-red-400 hover:text-red-300">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {prices.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-zinc-500">Sem preços cadastrados.</td></tr>
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
