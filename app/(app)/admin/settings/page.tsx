'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, Eye, EyeOff, PlugZap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface KeyView {
  configured: boolean
  masked: string
}

interface SettingsResponse {
  keys: {
    anthropic: KeyView
    google: KeyView
    openai: KeyView
    exa: KeyView
  }
  updatedAt: string | null
}

type Provider = 'anthropic' | 'google' | 'openai' | 'exa'

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [masked, setMasked] = useState<SettingsResponse['keys'] | null>(null)
  const [form, setForm] = useState({
    anthropicKey: '',
    googleKey: '',
    openaiKey: '',
    exaKey: '',
  })
  const [revealed, setRevealed] = useState<Record<Provider, string>>({
    anthropic: '',
    google: '',
    openai: '',
    exa: '',
  })
  const [revealing, setRevealing] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
    openai: false,
    exa: false,
  })
  const [testing, setTesting] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
    openai: false,
    exa: false,
  })
  const [testResult, setTestResult] = useState<Record<Provider, { ok: boolean; detail: string } | null>>({
    anthropic: null,
    google: null,
    openai: null,
    exa: null,
  })

  async function loadSettings() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar settings')
      setMasked(data.keys)
      setUpdatedAt(data.updatedAt ?? null)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, string> = {}
      if (form.anthropicKey.trim()) payload.anthropicKey = form.anthropicKey.trim()
      if (form.googleKey.trim()) payload.googleKey = form.googleKey.trim()
      if (form.openaiKey.trim()) payload.openaiKey = form.openaiKey.trim()
      if (form.exaKey.trim()) payload.exaKey = form.exaKey.trim()

      if (Object.keys(payload).length === 0) {
        throw new Error('Preencha pelo menos uma chave para atualizar.')
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar settings')

      setMasked(data.keys)
      setUpdatedAt(data.updatedAt ?? null)
      setForm({ anthropicKey: '', googleKey: '', openaiKey: '', exaKey: '' })
      setRevealed({ anthropic: '', google: '', openai: '', exa: '' })
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar settings')
    } finally {
      setSaving(false)
    }
  }

  async function toggleReveal(provider: Provider) {
    if (revealed[provider]) {
      setRevealed((prev) => ({ ...prev, [provider]: '' }))
      return
    }

    setRevealing((prev) => ({ ...prev, [provider]: true }))
    setError('')
    try {
      const res = await fetch('/api/admin/settings/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao revelar chave')
      setRevealed((prev) => ({ ...prev, [provider]: data.value || '' }))
    } catch (err: any) {
      setError(err.message || 'Erro ao revelar chave')
    } finally {
      setRevealing((prev) => ({ ...prev, [provider]: false }))
    }
  }

  async function handleTest(provider: Provider) {
    setTesting((prev) => ({ ...prev, [provider]: true }))
    setError('')
    try {
      const res = await fetch('/api/admin/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      setTestResult((prev) => ({
        ...prev,
        [provider]: { ok: Boolean(data.ok), detail: data.detail || '' },
      }))
    } catch (err: any) {
      setTestResult((prev) => ({
        ...prev,
        [provider]: { ok: false, detail: err.message || 'Erro ao testar conexão' },
      }))
    } finally {
      setTesting((prev) => ({ ...prev, [provider]: false }))
    }
  }

  const row = (
    provider: Provider,
    label: string,
    placeholder: string,
    field: keyof typeof form,
    view?: KeyView
  ) => (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Armazenada no `app_settings`</p>
        </div>
        <span className={`text-xs font-medium ${view?.configured ? 'text-green-400' : 'text-zinc-500'}`}>
          {view?.configured ? 'Configurada' : 'Não configurada'}
        </span>
      </div>
      <p className="text-xs text-zinc-500 break-all font-mono bg-zinc-950/70 border border-zinc-800 rounded-md px-2 py-1.5">
          Atual: {revealed[provider] || view?.masked || '—'}
      </p>
      <Input
        value={form[field]}
        onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="bg-zinc-800 border-zinc-700 text-zinc-100"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-200"
          onClick={() => toggleReveal(provider)}
          disabled={revealing[provider] || !view?.configured}
        >
          {revealing[provider]
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : revealed[provider]
              ? <EyeOff className="w-4 h-4" />
              : <Eye className="w-4 h-4" />
          }
          {revealed[provider] ? 'Ocultar' : 'Revelar'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-200"
          onClick={() => handleTest(provider)}
          disabled={testing[provider] || !view?.configured}
        >
          {testing[provider] ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
          Testar conexão
        </Button>
        </div>
        {testResult[provider] && (
          <span className={`text-xs ${testResult[provider]!.ok ? 'text-green-400' : 'text-red-400'}`}>
            {testResult[provider]!.detail}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Chaves globais da plataforma (owner only)</p>
          {updatedAt && (
            <p className="text-xs text-zinc-500 mt-2">
              Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving || loading} className="bg-violet-600 hover:bg-violet-500">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar chaves
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {row('anthropic', 'Anthropic', 'sk-ant-...', 'anthropicKey', masked?.anthropic)}
          {row('google', 'Google', 'AIza...', 'googleKey', masked?.google)}
          {row('openai', 'OpenAI', 'sk-...', 'openaiKey', masked?.openai)}
          {row('exa', 'EXA', 'exa_...', 'exaKey', masked?.exa)}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
