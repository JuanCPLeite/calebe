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
  compare?: {
    previousFrom: string
    previousTo: string
    current: { totalCostUsd: number; eventCount: number; totalCredits: number }
    previous: { totalCostUsd: number; eventCount: number; totalCredits: number }
    deltaPct: { totalCostUsd: number | null; eventCount: number | null; totalCredits: number | null }
  }
  totalCostUsd: number
  eventCount: number
  workspaces: WorkspaceOption[]
  topWorkspaces: Array<{ workspaceId: string; workspaceName: string; totalCostUsd: number }>
  topUsers: Array<{ userId: string; userName: string; totalCostUsd: number }>
  topModels: Array<{ provider: string; model: string; totalCostUsd: number; totalQuantity: number }>
  modelEffectiveness: Array<{
    provider: string
    model: string
    generatedCount: number
    publishedCount: number
    publishRatePct: number
  }>
  userCreditBreakdown: Array<{
    userId: string
    userName: string
    workspaceId: string
    workspaceName: string
    eventCount: number
    totalCostUsd: number
    totalCredits: number
    contentCredits: number
    imageCredits: number
    publishCredits: number
  }>
  daily: Array<{ date: string; totalCostUsd: number }>
  creditUsage: Array<{
    workspaceId: string
    workspaceName: string
    planId: string
    usedCredits: number
    creditLimit: number
    usagePercent: number
  }>
  budgetUsage: Array<{
    workspaceId: string
    workspaceName: string
    planId: string
    monthCostUsd: number
    budgetLimitUsd: number
    usagePercent: number
    exceeded: boolean
    warning: boolean
  }>
  costGuardrails?: {
    defaultMonthlyBudgetUsd: number
    warnAtPercent: number
    blockOnBudgetExceeded: boolean
    workspaceMonthlyBudgetUsd: Record<string, number>
  }
  monthlyProjection: Array<{
    workspaceId: string
    workspaceName: string
    planId: string
    monthCostUsd: number
    projectedMonthCostUsd: number
  }>
  planMarginSimulation: Array<{
    planId: string
    planLabel: string
    workspaceCount: number
    planPriceUsd: number
    revenueUsd: number
    monthCostUsd: number
    projectedMonthCostUsd: number
    projectedMarginUsd: number
    projectedMarginPct: number | null
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

interface CreditPolicy {
  contentRender: number
  imageGenerate: number
  publish: number
}

interface CostGuardrails {
  defaultMonthlyBudgetUsd: number
  warnAtPercent: number
  blockOnBudgetExceeded: boolean
  workspaceMonthlyBudgetUsd: Record<string, number>
}

function usd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })
}

function credit(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function deltaLabel(value: number | null): string {
  if (value === null) return 'novo período'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
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
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [savingGuardrails, setSavingGuardrails] = useState(false)
  const [creditPolicy, setCreditPolicy] = useState<CreditPolicy>({ contentRender: 1, imageGenerate: 0.25, publish: 0 })
  const [guardrails, setGuardrails] = useState<CostGuardrails>({
    defaultMonthlyBudgetUsd: 0,
    warnAtPercent: 80,
    blockOnBudgetExceeded: true,
    workspaceMonthlyBudgetUsd: {},
  })
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
    loadCreditPolicy()
    loadGuardrails()
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

  async function loadCreditPolicy() {
    try {
      const res = await fetch('/api/admin/costs/credit-policy')
      const json = await res.json()
      if (!res.ok) return
      setCreditPolicy({
        contentRender: Number(json?.weights?.contentRender) || 0,
        imageGenerate: Number(json?.weights?.imageGenerate) || 0,
        publish: Number(json?.weights?.publish) || 0,
      })
    } catch {
      // noop
    }
  }

  async function loadGuardrails() {
    try {
      const res = await fetch('/api/admin/costs/guardrails')
      const json = await res.json()
      if (!res.ok) return
      setGuardrails({
        defaultMonthlyBudgetUsd: Number(json?.guardrails?.defaultMonthlyBudgetUsd) || 0,
        warnAtPercent: Number(json?.guardrails?.warnAtPercent) || 80,
        blockOnBudgetExceeded: json?.guardrails?.blockOnBudgetExceeded !== false,
        workspaceMonthlyBudgetUsd: json?.guardrails?.workspaceMonthlyBudgetUsd || {},
      })
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

  async function saveCreditPolicy() {
    setSavingPolicy(true)
    try {
      const payload = {
        weights: {
          contentRender: Number(creditPolicy.contentRender || 0),
          imageGenerate: Number(creditPolicy.imageGenerate || 0),
          publish: Number(creditPolicy.publish || 0),
        },
      }
      const res = await fetch('/api/admin/costs/credit-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar política de créditos')
      await load()
      await loadCreditPolicy()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar política de créditos')
    } finally {
      setSavingPolicy(false)
    }
  }

  async function saveGuardrails() {
    setSavingGuardrails(true)
    try {
      const payload = {
        guardrails: {
          defaultMonthlyBudgetUsd: Number(guardrails.defaultMonthlyBudgetUsd || 0),
          warnAtPercent: Number(guardrails.warnAtPercent || 80),
          blockOnBudgetExceeded: Boolean(guardrails.blockOnBudgetExceeded),
          workspaceMonthlyBudgetUsd: guardrails.workspaceMonthlyBudgetUsd || {},
        },
      }
      const res = await fetch('/api/admin/costs/guardrails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar guardrails')
      await loadGuardrails()
      await load()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar guardrails')
    } finally {
      setSavingGuardrails(false)
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

          {data.compare && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <p className="text-sm font-semibold text-zinc-100">
                Comparativo: últimos {data.days} dias vs período anterior
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">Custo (delta)</p>
                  <p className="text-sm text-zinc-100 font-semibold">
                    {usd(data.compare.current.totalCostUsd)} / {usd(data.compare.previous.totalCostUsd)}
                  </p>
                  <p className={`text-xs ${data.compare.deltaPct.totalCostUsd !== null && data.compare.deltaPct.totalCostUsd > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {deltaLabel(data.compare.deltaPct.totalCostUsd)}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">Eventos (delta)</p>
                  <p className="text-sm text-zinc-100 font-semibold">
                    {data.compare.current.eventCount} / {data.compare.previous.eventCount}
                  </p>
                  <p className={`text-xs ${data.compare.deltaPct.eventCount !== null && data.compare.deltaPct.eventCount > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {deltaLabel(data.compare.deltaPct.eventCount)}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">Créditos (delta)</p>
                  <p className="text-sm text-zinc-100 font-semibold">
                    {credit(data.compare.current.totalCredits)} / {credit(data.compare.previous.totalCredits)}
                  </p>
                  <p className={`text-xs ${data.compare.deltaPct.totalCredits !== null && data.compare.deltaPct.totalCredits > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {deltaLabel(data.compare.deltaPct.totalCredits)}
                  </p>
                </div>
              </div>
            </div>
          )}

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
            <p className="text-sm font-semibold text-zinc-100 mb-3">Efetividade por modelo (gerado x publicado)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Modelo</th>
                    <th className="py-2 pr-3">Gerados</th>
                    <th className="py-2 pr-3">Publicados</th>
                    <th className="py-2 pr-3">Taxa de publicação</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.modelEffectiveness || []).map((item, idx) => (
                    <tr key={`${item.provider}:${item.model}:${idx}`} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.provider}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.model || '—'}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.generatedCount}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.publishedCount}</td>
                      <td className="py-2 pr-3 text-zinc-100 font-medium">{item.publishRatePct.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {(data.modelEffectiveness || []).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-100 mb-3">Uso por usuário (créditos por ação)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Usuário</th>
                    <th className="py-2 pr-3">Workspace</th>
                    <th className="py-2 pr-3">Eventos</th>
                    <th className="py-2 pr-3">Créd. texto</th>
                    <th className="py-2 pr-3">Créd. imagem</th>
                    <th className="py-2 pr-3">Créd. publish</th>
                    <th className="py-2 pr-3">Créd. total</th>
                    <th className="py-2 pr-3">Custo USD</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.userCreditBreakdown || []).map((item) => (
                    <tr key={`${item.workspaceId}:${item.userId}`} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.userName}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.workspaceName}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.eventCount}</td>
                      <td className="py-2 pr-3 text-zinc-300">{credit(item.contentCredits)}</td>
                      <td className="py-2 pr-3 text-zinc-300">{credit(item.imageCredits)}</td>
                      <td className="py-2 pr-3 text-zinc-300">{credit(item.publishCredits)}</td>
                      <td className="py-2 pr-3 text-zinc-100 font-medium">{credit(item.totalCredits)}</td>
                      <td className="py-2 pr-3 text-zinc-100 font-medium">{usd(item.totalCostUsd)}</td>
                    </tr>
                  ))}
                  {(data.userCreditBreakdown || []).length === 0 && (
                    <tr><td colSpan={8} className="py-4 text-center text-zinc-500">Sem dados no período.</td></tr>
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
            <p className="text-sm font-semibold text-zinc-100 mb-3">Uso de orçamento mensal por workspace (USD)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Workspace</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Custo mês</th>
                    <th className="py-2 pr-3">Orçamento</th>
                    <th className="py-2 pr-3">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.budgetUsage || []).map((item) => (
                    <tr key={item.workspaceId} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.workspaceName}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.planId}</td>
                      <td className="py-2 pr-3 text-zinc-100">{usd(item.monthCostUsd)}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.budgetLimitUsd > 0 ? usd(item.budgetLimitUsd) : '—'}</td>
                      <td className={`py-2 pr-3 font-medium ${item.exceeded ? 'text-red-400' : item.warning ? 'text-amber-400' : 'text-zinc-100'}`}>
                        {item.budgetLimitUsd > 0 ? `${item.usagePercent}%` : '—'}
                      </td>
                    </tr>
                  ))}
                  {(data.budgetUsage || []).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-zinc-100">Guardrails de orçamento mensal</p>
              <Button onClick={saveGuardrails} disabled={savingGuardrails} className="bg-violet-600 hover:bg-violet-500">
                {savingGuardrails ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar guardrails'}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Defina orçamento padrão e override por workspace. Com bloqueio ativo, geração/publicação para ao estourar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={guardrails.defaultMonthlyBudgetUsd}
                onChange={(e) => setGuardrails((p) => ({ ...p, defaultMonthlyBudgetUsd: Number(e.target.value) || 0 }))}
                placeholder="Orçamento padrão USD/mês (0 = sem limite)"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                value={guardrails.warnAtPercent}
                onChange={(e) => setGuardrails((p) => ({ ...p, warnAtPercent: Number(e.target.value) || 80 }))}
                placeholder="Alerta em %"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <label className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={guardrails.blockOnBudgetExceeded}
                  onChange={(e) => setGuardrails((p) => ({ ...p, blockOnBudgetExceeded: e.target.checked }))}
                />
                Bloquear ao estourar orçamento
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Workspace</th>
                    <th className="py-2 pr-3">Override USD/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.workspaces || []).map((item) => (
                    <tr key={item.id} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.name}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={guardrails.workspaceMonthlyBudgetUsd[item.id] ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim()
                            setGuardrails((prev) => {
                              const next = { ...prev.workspaceMonthlyBudgetUsd }
                              if (!raw) {
                                delete next[item.id]
                              } else {
                                next[item.id] = Math.max(0, Number(raw) || 0)
                              }
                              return { ...prev, workspaceMonthlyBudgetUsd: next }
                            })
                          }}
                          placeholder="vazio = usa padrão"
                          className="h-8 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100 w-full md:w-56"
                        />
                      </td>
                    </tr>
                  ))}
                  {(data.workspaces || []).length === 0 && (
                    <tr><td colSpan={2} className="py-4 text-center text-zinc-500">Sem workspaces.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-100 mb-3">Simulação de margem por plano</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Workspaces</th>
                    <th className="py-2 pr-3">Preço USD/mês</th>
                    <th className="py-2 pr-3">Receita mês</th>
                    <th className="py-2 pr-3">Custo projetado</th>
                    <th className="py-2 pr-3">Margem projetada</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.planMarginSimulation || []).map((item) => (
                    <tr key={item.planId} className="border-b border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-300">{item.planLabel}</td>
                      <td className="py-2 pr-3 text-zinc-300">{item.workspaceCount}</td>
                      <td className="py-2 pr-3 text-zinc-300">{usd(item.planPriceUsd)}</td>
                      <td className="py-2 pr-3 text-zinc-100">{usd(item.revenueUsd)}</td>
                      <td className="py-2 pr-3 text-zinc-100">{usd(item.projectedMonthCostUsd)}</td>
                      <td className={`py-2 pr-3 font-medium ${item.projectedMarginUsd < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {usd(item.projectedMarginUsd)} {item.projectedMarginPct === null ? '' : `(${item.projectedMarginPct.toFixed(2)}%)`}
                      </td>
                    </tr>
                  ))}
                  {(data.planMarginSimulation || []).length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-zinc-500">Sem dados para simulação.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-zinc-100">Política de Créditos por Ação</p>
              <Button onClick={saveCreditPolicy} disabled={savingPolicy} className="bg-violet-600 hover:bg-violet-500">
                {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar política'}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Define quantos créditos cada ação consome no mês. Valores decimais permitidos.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={creditPolicy.contentRender}
                onChange={(e) => setCreditPolicy((p) => ({ ...p, contentRender: Number(e.target.value) }))}
                placeholder="Geração de conteúdo (render)"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={creditPolicy.imageGenerate}
                onChange={(e) => setCreditPolicy((p) => ({ ...p, imageGenerate: Number(e.target.value) }))}
                placeholder="Geração de imagem"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={creditPolicy.publish}
                onChange={(e) => setCreditPolicy((p) => ({ ...p, publish: Number(e.target.value) }))}
                placeholder="Publicação"
                className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100"
              />
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
