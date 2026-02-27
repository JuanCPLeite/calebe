'use client'

import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AudienceProfile {
  pain_points: string
  desires: string
  objections: string
  awareness_level: string
  language_style: string
}

const EMPTY: AudienceProfile = {
  pain_points: '',
  desires: '',
  objections: '',
  awareness_level: '',
  language_style: '',
}

export default function AudiencePage() {
  const supabase = createClient()
  const [form, setForm] = useState<AudienceProfile>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: expert } = await supabase
        .from('experts')
        .select('audience_profile')
        .eq('user_id', user.id)
        .single()

      if (expert?.audience_profile) {
        setForm({ ...EMPTY, ...expert.audience_profile })
      }
    }
    load()
  }, [])

  async function handleSave() {
    if (!userId) return
    setSaving(true)

    await supabase
      .from('experts')
      .upsert(
        { user_id: userId, audience_profile: form, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function set(field: keyof AudienceProfile, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const textarea = (label: string, key: keyof AudienceProfile, placeholder?: string, rows = 3) => (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <textarea
        rows={rows}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
      />
    </div>
  )

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Perfil & Público</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Defina quem é sua audiência para gerar conteúdo mais preciso
        </p>
      </div>

      <div className="space-y-5">
        {textarea(
          'Principais dores',
          'pain_points',
          'Ex: Perde muito tempo em tarefas manuais, não sabe usar IA no negócio...',
          3
        )}
        {textarea(
          'Desejos e objetivos',
          'desires',
          'Ex: Trabalhar menos, vender mais, escalar sem contratar...',
          3
        )}
        {textarea(
          'Objeções comuns',
          'objections',
          'Ex: "IA é complicada", "não tenho tempo para aprender", "é caro"...',
          3
        )}
        {textarea(
          'Nível de consciência',
          'awareness_level',
          'Ex: Sabe que existe IA mas não sabe como aplicar no negócio. Já tentou ChatGPT mas não passou do básico.',
          2
        )}
        {textarea(
          'Linguagem e tom preferido',
          'language_style',
          'Ex: Direto, sem rodeios, linguagem de empresário, evita termos técnicos...',
          2
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-8 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
      >
        <Save className="w-4 h-4" />
        {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar perfil'}
      </button>
    </div>
  )
}
