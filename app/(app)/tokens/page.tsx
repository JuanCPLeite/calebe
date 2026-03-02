'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TOKEN_FIELDS = [
  {
    provider: 'anthropic',
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    hint: 'Obrigatório — gera o conteúdo dos slides e faz a busca de tópicos trending.',
  },
  {
    provider: 'google',
    label: 'Google Gemini',
    placeholder: 'AIzaSy...',
    hint: 'Obrigatório — gera as imagens de cada slide via Gemini.',
  },
  {
    provider: 'meta_token',
    label: 'Meta Graph API Token',
    placeholder: 'EAAp...',
    hint: 'Necessário para publicar carrosséis direto no Instagram.',
  },
  {
    provider: 'meta_account_id',
    label: 'Meta Account ID (Instagram)',
    placeholder: '17841...',
    hint: 'ID numérico da sua conta de negócios no Instagram.',
  },
  {
    provider: 'exa',
    label: 'EXA Search',
    placeholder: 'exa_...',
    hint: 'Opcional — busca neural avançada para tópicos trending. Sem ela, o Claude já faz a busca.',
    optional: true,
  },
]

export default function TokensPage() {
  const supabase = createClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('provider, value')
        .eq('user_id', user.id)

      const map: Record<string, string> = {}
      for (const t of tokens || []) map[t.provider] = t.value
      setValues(map)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const [provider, value] of Object.entries(values)) {
      if (!value.trim()) continue
      await supabase.from('user_tokens').upsert(
        { user_id: user.id, provider, value: value.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,provider' }
      )
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Tokens & APIs</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Suas chaves são salvas com segurança e acessadas somente por você.
        </p>
      </div>

      <div className="space-y-4">
        {TOKEN_FIELDS.map(({ provider, label, placeholder, hint, optional }) => {
          const filled = !!(values[provider]?.trim())
          return (
            <div key={provider} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-zinc-200">{label}</label>
                  {optional && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">
                      opcional
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${filled ? 'text-green-400' : optional ? 'text-zinc-600' : 'text-zinc-500'}`}>
                  {filled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {filled ? 'Configurado' : optional ? 'Não configurado' : 'Pendente'}
                </div>
              </div>
              {hint && <p className="text-xs text-zinc-500 mb-2.5">{hint}</p>}
              <div className="relative">
                <input
                  type={show[provider] ? 'text' : 'password'}
                  value={values[provider] || ''}
                  onChange={(e) => setValues(prev => ({ ...prev, [provider]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 pr-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow(prev => ({ ...prev, [provider]: !prev[provider] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {show[provider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
      >
        <Save className="w-4 h-4" />
        {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar tokens'}
      </button>
    </div>
  )
}
