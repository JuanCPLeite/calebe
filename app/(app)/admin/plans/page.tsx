'use client'

import { useEffect, useMemo, useState } from 'react'
import { Info, Lightbulb, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PlanItem {
  id: string
  label: string
  expertLimit: number
  memberLimit: number
  monthlyPostCredits: number
  description: string
}

const DEFAULT_NEW_PLAN: PlanItem = {
  id: '',
  label: '',
  expertLimit: 1,
  memberLimit: 1,
  monthlyPostCredits: 30,
  description: '',
}

const TIPS = [
  'Starter: poucos usuarios e poucos creditos.',
  'Pro: limite intermediario para operacao recorrente.',
  'Agency: mais usuarios, mais experts e mais creditos.',
  'Use limites como referencia, nao como regra fixa.',
]

export default function AdminPlansPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [readonly, setReadonly] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [showTips, setShowTips] = useState(false)
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [newPlan, setNewPlan] = useState<PlanItem>(DEFAULT_NEW_PLAN)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/plans')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar planos')
      setPlans(data.plans || [])
      setReadonly(Boolean(data.readonly))
      setHint(typeof data.hint === 'string' ? data.hint : '')
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar planos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canAdd = useMemo(() => {
    const id = newPlan.id.trim().toLowerCase()
    return Boolean(id && newPlan.label.trim() && !plans.some((p) => p.id === id))
  }, [newPlan, plans])

  function normalizeId(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function addPlan() {
    if (!canAdd) return
    const plan: PlanItem = {
      id: normalizeId(newPlan.id),
      label: newPlan.label.trim(),
      expertLimit: Math.max(1, Math.min(100, Math.floor(Number(newPlan.expertLimit) || 1))),
      memberLimit: Math.max(1, Math.min(500, Math.floor(Number(newPlan.memberLimit) || 1))),
      monthlyPostCredits: Math.max(1, Math.min(100000, Math.floor(Number(newPlan.monthlyPostCredits) || 1))),
      description: newPlan.description.trim(),
    }
    setPlans((prev) => [...prev, plan])
    setNewPlan(DEFAULT_NEW_PLAN)
  }

  function updatePlan(index: number, patch: Partial<PlanItem>) {
    setPlans((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removePlan(index: number) {
    setPlans((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar planos')
      setPlans(data.plans || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar planos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin Plans</h1>
          <p className="text-sm text-zinc-500 mt-1">Crie e ajuste tipos de plano e limite de experts</p>
        </div>
        <Button onClick={() => setShowTips(true)} variant="outline" className="border-zinc-700 text-zinc-200">
          <Info className="w-4 h-4" /> Dicas
        </Button>
      </div>

      {hint && <p className="text-xs text-amber-400">{hint}</p>}
      {readonly && (
        <p className="text-sm text-amber-400">
          Modo leitura: rode o schema atualizado para habilitar salvar `plan_configs`.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando planos...
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-sm font-medium text-zinc-100">Adicionar plano</p>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <Input
                value={newPlan.id}
                onChange={(e) => setNewPlan((p) => ({ ...p, id: normalizeId(e.target.value) }))}
                placeholder="id (ex: growth)"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
              <Input
                value={newPlan.label}
                onChange={(e) => setNewPlan((p) => ({ ...p, label: e.target.value }))}
                placeholder="Nome (ex: Growth)"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
              <Input
                type="number"
                min={1}
                max={100}
                value={newPlan.expertLimit}
                onChange={(e) => setNewPlan((p) => ({ ...p, expertLimit: Number(e.target.value) || 1 }))}
                placeholder="Limite experts"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
              <Input
                type="number"
                min={1}
                max={500}
                value={newPlan.memberLimit}
                onChange={(e) => setNewPlan((p) => ({ ...p, memberLimit: Number(e.target.value) || 1 }))}
                placeholder="Limite usuarios"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
              <Input
                type="number"
                min={1}
                max={100000}
                value={newPlan.monthlyPostCredits}
                onChange={(e) => setNewPlan((p) => ({ ...p, monthlyPostCredits: Number(e.target.value) || 1 }))}
                placeholder="Creditos mes"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
              <Input
                value={newPlan.description}
                onChange={(e) => setNewPlan((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descricao (opcional)"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            <Button onClick={addPlan} disabled={!canAdd || readonly} className="bg-zinc-700 hover:bg-zinc-600">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-sm font-medium text-zinc-100">Planos configurados</p>
            <p className="text-xs text-zinc-500">
              Para editar: altere nome/limite/descricao e clique em <strong className="text-zinc-300">Salvar planos</strong>.
            </p>
            <div className="hidden md:grid md:grid-cols-14 gap-2 px-1 text-[11px] uppercase tracking-wide text-zinc-500">
              <p className="md:col-span-2">ID</p>
              <p className="md:col-span-2">Nome</p>
              <p className="md:col-span-2">Limite Experts</p>
              <p className="md:col-span-2">Limite Usuarios</p>
              <p className="md:col-span-2">Creditos/mes</p>
              <p className="md:col-span-5">Descricao</p>
              <p className="md:col-span-1">Acao</p>
            </div>
            <div className="space-y-2">
              {plans.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-14 gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <Input value={item.id} disabled className="md:col-span-2 bg-zinc-800 border-zinc-700 text-zinc-400" />
                  <Input
                    value={item.label}
                    onChange={(e) => updatePlan(index, { label: e.target.value })}
                    className="md:col-span-2 bg-zinc-800 border-zinc-700 text-zinc-100"
                    disabled={readonly}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={item.expertLimit}
                    onChange={(e) => updatePlan(index, { expertLimit: Math.max(1, Number(e.target.value) || 1) })}
                    className="md:col-span-2 bg-zinc-800 border-zinc-700 text-zinc-100"
                    disabled={readonly}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={item.memberLimit}
                    onChange={(e) => updatePlan(index, { memberLimit: Math.max(1, Number(e.target.value) || 1) })}
                    className="md:col-span-2 bg-zinc-800 border-zinc-700 text-zinc-100"
                    disabled={readonly}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={100000}
                    value={item.monthlyPostCredits}
                    onChange={(e) => updatePlan(index, { monthlyPostCredits: Math.max(1, Number(e.target.value) || 1) })}
                    className="md:col-span-2 bg-zinc-800 border-zinc-700 text-zinc-100"
                    disabled={readonly}
                  />
                  <Input
                    value={item.description || ''}
                    onChange={(e) => updatePlan(index, { description: e.target.value })}
                    className="md:col-span-5 bg-zinc-800 border-zinc-700 text-zinc-100"
                    disabled={readonly}
                  />
                  <Button
                    variant="outline"
                    className="md:col-span-1 border-zinc-700 text-zinc-300"
                    onClick={() => removePlan(index)}
                    disabled={readonly || plans.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={handleSave} disabled={saving || readonly} className="bg-violet-600 hover:bg-violet-500">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar planos
            </Button>
          </div>
        </>
      )}

      {showTips && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowTips(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">Dicas de planos e limites</p>
              <button className="text-zinc-400 hover:text-zinc-200" onClick={() => setShowTips(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {TIPS.map((tip) => (
                <div key={tip} className="flex items-start gap-2 text-sm text-zinc-300">
                  <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p>{tip}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-zinc-500">
              Esses limites podem ser apenas exemplos. Voce define o que fizer sentido para seu modelo comercial.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
