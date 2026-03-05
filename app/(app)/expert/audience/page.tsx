'use client'

import { useState, useEffect } from 'react'
import { Save, Wand2 } from 'lucide-react'
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

// Exemplo genérico — audiência de uma especialista em emagrecimento feminino
const AUDIENCE_EXAMPLE: AudienceProfile = {
  pain_points: `Já tentaram várias dietas e sempre voltaram ao peso original (efeito sanfona).
Se sentem culpadas quando "fogem" da dieta, mesmo em situações sociais.
Não têm tempo para cozinhar refeições elaboradas todos os dias.
Acham que precisam sofrer ou se privar para emagrecer de verdade.`,
  desires: `Emagrecer de forma definitiva, sem ficar o resto da vida em dieta.
Ter energia e disposição para acompanhar os filhos e o trabalho.
Se sentir bem na própria pele sem abrir mão de sair para jantar ou tomar vinho.
Ter uma relação leve e tranquila com a comida — sem ansiedade.`,
  objections: `"Já tentei de tudo e não funciona para mim — meu corpo é diferente."
"Não tenho disciplina suficiente para manter uma dieta."
"É caro contratar uma nutricionista, não sei se vai valer."
"Não consigo seguir uma dieta por mais de duas semanas."`,
  awareness_level: `Sabe que precisa mudar a alimentação, mas acredita que a solução é uma dieta restritiva. Já tentou dietas da moda (low carb, jejum, etc.). Tem consciência do problema mas não conhece a abordagem comportamental. Geralmente descobre o perfil por recomendação ou pelo conteúdo de desmistificação de dietas.`,
  language_style: `Tom acolhedor e empático, sem julgamentos — o público já se sente culpado o suficiente.
Linguagem simples, do cotidiano — evita termos clínicos como "déficit calórico" sem explicar.
Frases curtas e diretas. Usa exemplos práticos do dia a dia (almoço no trabalho, fim de semana).
Expressões comuns: "emagrecer de vez", "sem sofrimento", "relação saudável com a comida".`,
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

  const textarea = (
    label: string,
    key: keyof AudienceProfile,
    hint: string,
    placeholder: string,
    rows = 3
  ) => (
    <div>
      <label className="block text-xs text-zinc-400 mb-0.5">{label}</label>
      <p className="text-[11px] text-zinc-600 mb-1.5 leading-snug">{hint}</p>
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Perfil & Público</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Defina quem é sua audiência para gerar conteúdo mais preciso
          </p>
        </div>
        <button
          onClick={() => setForm(AUDIENCE_EXAMPLE)}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Wand2 className="w-4 h-4" />
          Ver exemplo
        </button>
      </div>

      <div className="space-y-5">
        {textarea(
          'Principais dores',
          'pain_points',
          'Quais problemas seu público enfrenta hoje? O que os tira o sono? Liste os mais recorrentes.',
          'Ex: Não consegue manter consistência, perde tempo com tarefas repetitivas...',
          4
        )}
        {textarea(
          'Desejos e objetivos',
          'desires',
          'Qual transformação eles buscam? O que querem conquistar nos próximos meses?',
          'Ex: Trabalhar menos horas, aumentar o faturamento sem contratar mais pessoas...',
          4
        )}
        {textarea(
          'Objeções comuns',
          'objections',
          'Por que ainda não compraram sua solução? O que os impede de agir? Liste as frases que você mais ouve.',
          'Ex: "É muito caro", "não tenho tempo", "já tentei e não funcionou"...',
          4
        )}
        {textarea(
          'Nível de consciência',
          'awareness_level',
          'Eles sabem que têm o problema? Conhecem a solução? Já ouviram falar de você? Descreva onde estão na jornada.',
          'Ex: Sabe que existe IA mas não sabe como aplicar. Já tentou ChatGPT mas parou no básico.',
          3
        )}
        {textarea(
          'Linguagem e tom preferido',
          'language_style',
          'Como eles falam? Formal ou informal? Quais expressões usam? O que evitar no texto?',
          'Ex: Direto e prático, linguagem de empresário, evita termos técnicos sem explicação...',
          3
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-8 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
      >
        <Save className="w-4 h-4" />
        {saved ? '✓ Salvo!' : saving ? 'Salvando...' : 'Salvar perfil'}
      </button>
    </div>
  )
}
