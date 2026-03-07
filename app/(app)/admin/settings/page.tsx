'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
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
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar settings')
    } finally {
      setSaving(false)
    }
  }

  const row = (
    label: string,
    placeholder: string,
    field: keyof typeof form,
    view?: KeyView
  ) => (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        <span className={`text-xs ${view?.configured ? 'text-green-400' : 'text-zinc-500'}`}>
          {view?.configured ? 'Configurada' : 'Não configurada'}
        </span>
      </div>
      <p className="text-xs text-zinc-500">Atual: {view?.masked || '—'}</p>
      <Input
        value={form[field]}
        onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="bg-zinc-800 border-zinc-700 text-zinc-100"
      />
    </div>
  )

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Admin Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Chaves globais da plataforma (owner only)</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {row('Anthropic', 'sk-ant-...', 'anthropicKey', masked?.anthropic)}
          {row('Google', 'AIza...', 'googleKey', masked?.google)}
          {row('OpenAI', 'sk-...', 'openaiKey', masked?.openai)}
          {row('EXA', 'exa_...', 'exaKey', masked?.exa)}
        </div>
      )}

      {updatedAt && (
        <p className="text-xs text-zinc-500">
          Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={handleSave} disabled={saving || loading} className="bg-violet-600 hover:bg-violet-500">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar chaves
      </Button>
    </div>
  )
}
