'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, Wand2, Plus, X, Sparkles, Camera, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FormData {
  display_name: string
  handle: string
  niche: string
  bio_short: string
  product_name: string
  product_cta: string
  highlight_color: string
  author_slide_template: string
  cta_final_template: string
  style_rules: string[]
  ig_account_id: string
}

const EMPTY: FormData = {
  display_name: '',
  handle: '',
  niche: '',
  bio_short: '',
  product_name: '',
  product_cta: '',
  highlight_color: '#9B59FF',
  author_slide_template: '',
  cta_final_template: '',
  style_rules: [],
  ig_account_id: '',
}

// Exemplo genérico — não é um perfil real, serve só como referência
const DNA_EXAMPLE: FormData = {
  display_name: 'Marina Souza',
  handle: '@marinasouza.fit',
  niche: 'Emagrecimento feminino sem dieta restritiva',
  bio_short: 'Nutricionista especializada em comportamento alimentar. Ajudo mulheres a emagrecer sem sofrimento e sem efeito sanfona em 12 semanas.',
  product_name: 'Método Leveza Total',
  product_cta: 'Acesse o link na bio e comece hoje.',
  highlight_color: '#E91E8C',
  author_slide_template: `Oi, eu sou a Marina Souza 👋
Nutricionista há 8 anos, especialista em comportamento alimentar.

Já ajudei mais de 2.000 mulheres a emagrecer sem abrir mão da vida social.

➡️ No próximo slide, o passo a passo completo.`,
  cta_final_template: `Se esse conteúdo fez sentido pra você:

👆 Me segue — posto todo dia sobre emagrecimento real
🔔 Ativa o sininho para não perder nada
❤️ Compartilha com uma amiga que precisa ver isso

👇 Acesse o link na bio e conheça o Método Leveza Total`,
  style_rules: [
    'Use "você" — tom próximo e acolhedor, sem julgamentos',
    'Frases curtas. Máximo uma ideia por parágrafo',
    'Nunca use termos clínicos sem explicar em seguida',
    'Prefira exemplos do cotidiano a dados técnicos',
    'Fale sempre com empatia — o público já tentou muitas dietas',
  ],
  ig_account_id: '',
}

function DnaForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === '1'

  const [form, setForm]       = useState<FormData>(EMPTY)
  const [newRule, setNewRule] = useState('')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [userId, setUserId]   = useState<string | null>(null)

  // Avatar
  const [avatarUrl, setAvatarUrl]             = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: expert } = await supabase
        .from('experts')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (expert) {
        setForm({
          display_name:           expert.display_name || '',
          handle:                 expert.handle || '',
          niche:                  expert.niche || '',
          bio_short:              expert.bio_short || '',
          product_name:           expert.product_name || '',
          product_cta:            expert.product_cta || '',
          highlight_color:        expert.highlight_color || '#9B59FF',
          author_slide_template:  expert.author_slide_template || '',
          cta_final_template:     expert.cta_final_template || '',
          style_rules:            expert.style_rules || [],
          ig_account_id:          expert.ig_account_id || '',
        })
        setAvatarUrl((expert as any).avatar_url || null)
      }
    }
    load()
  }, [])

  function applyExample() {
    setForm(DNA_EXAMPLE)
  }

  async function handleAvatarUpload(file: File) {
    if (!userId) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const storagePath = `${userId}/avatar.${ext}`
      await supabase.storage.from('expert-photos').remove([storagePath])
      const { error: uploadError } = await supabase.storage
        .from('expert-photos')
        .upload(storagePath, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: signed } = await supabase.storage
        .from('expert-photos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
      const url = signed?.signedUrl || ''
      await supabase
        .from('experts')
        .upsert({ avatar_url: url, user_id: userId }, { onConflict: 'user_id' })
      setAvatarUrl(url)
    } catch (err) {
      console.error('Erro ao enviar avatar:', err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    await supabase.from('experts').upsert(
      { ...form, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addRule() {
    if (!newRule.trim()) return
    setForm(prev => ({ ...prev, style_rules: [...prev.style_rules, newRule.trim()] }))
    setNewRule('')
  }

  function removeRule(i: number) {
    setForm(prev => ({ ...prev, style_rules: prev.style_rules.filter((_, idx) => idx !== i) }))
  }

  const field = (label: string, key: keyof FormData, hint: string, placeholder?: string) => (
    <div>
      <label className="block text-xs text-zinc-400 mb-0.5">{label}</label>
      <p className="text-[11px] text-zinc-600 mb-1.5 leading-snug">{hint}</p>
      <input
        type="text"
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
      />
    </div>
  )

  const textarea = (label: string, key: keyof FormData, hint: string, rows = 4) => (
    <div>
      <label className="block text-xs text-zinc-400 mb-0.5">{label}</label>
      <p className="text-[11px] text-zinc-600 mb-1.5 leading-snug">{hint}</p>
      <textarea
        rows={rows}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
      />
    </div>
  )

  const hl = form.highlight_color || '#9B59FF'
  const initials = form.display_name
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div className="p-8 max-w-2xl">
      {isOnboarding && (
        <div className="flex items-start gap-3 bg-violet-950/50 border border-violet-700 rounded-xl p-4 mb-6">
          <Sparkles className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-violet-200">Configure seu perfil para começar</p>
            <p className="text-xs text-violet-400 mt-0.5">
              Clique em <strong>Ver exemplo</strong> para ver um perfil de referência,
              depois preencha com seus dados reais e salve.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">DNA Expert</h1>
          <p className="text-zinc-400 text-sm mt-1">Tom de voz, estilo e dados do seu perfil</p>
        </div>
        <button
          onClick={applyExample}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Wand2 className="w-4 h-4" />
          Ver exemplo
        </button>
      </div>

      {/* ── Avatar ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <label className="block text-xs text-zinc-400 mb-0.5">Foto de perfil (avatar)</label>
        <p className="text-[11px] text-zinc-600 mb-3 leading-snug">
          Aparece no cabeçalho de cada slide. Use uma foto quadrada com rosto visível.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-zinc-600 hover:border-violet-500 transition-colors group flex-shrink-0"
            style={{ background: hl + '22' }}
          >
            {uploadingAvatar ? (
              <div className="flex items-center justify-center w-full h-full">
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              </div>
            ) : avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full gap-1">
                <span className="text-xl font-bold" style={{ color: hl }}>{initials}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </button>

          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2 disabled:opacity-50"
          >
            {avatarUrl ? 'Trocar foto' : 'Fazer upload'}
          </button>
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleAvatarUpload(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* ── Campos do formulário ─────────────────────────────────── */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {field('Nome', 'display_name',
            'Seu nome completo ou nome pelo qual é reconhecido profissionalmente.',
            'Ex: Marina Souza')}
          {field('Handle (@)', 'handle',
            'Seu @ do Instagram exatamente como aparece no perfil.',
            'Ex: @marinasouza.fit')}
        </div>

        {field('Nicho', 'niche',
          'Área de atuação + para quem. Quanto mais específico, melhor o conteúdo gerado.',
          'Ex: Emagrecimento feminino sem dieta restritiva')}

        {textarea('Bio curta', 'bio_short',
          '2-3 frases: quem você é, o que faz e para quem. Escreva como se estivesse se apresentando numa conversa.', 3)}

        <div className="grid grid-cols-2 gap-4">
          {field('Nome do produto', 'product_name',
            'Nome do seu curso, mentoria ou serviço principal.',
            'Ex: Método Leveza Total')}
          {field('CTA do produto', 'product_cta',
            'Chamada para ação curta. Aparece no slide final.',
            'Ex: Acesse o link na bio e comece hoje.')}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-0.5">Cor de destaque</label>
            <p className="text-[11px] text-zinc-600 mb-1.5 leading-snug">
              Cor principal da sua marca. Aparece como destaque visual nos slides.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.highlight_color}
                onChange={(e) => set('highlight_color', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={form.highlight_color}
                onChange={(e) => set('highlight_color', e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          {field('Instagram Account ID', 'ig_account_id',
            'ID numérico da sua conta business. Necessário para publicar pelo app.',
            '17841401...')}
        </div>

        {textarea('Template Slide 5 — apresentação do autor', 'author_slide_template',
          'Texto do slide central onde você se apresenta. Inclua nome, especialidade e uma credencial relevante. Use quebras de linha para separar as partes.', 6)}

        {textarea('Template Slide 10 — CTA final', 'cta_final_template',
          'Chamada para ação do último slide. Peça para seguir, salvar ou clicar no link. Use emojis para destacar cada ação.', 6)}

        {/* Regras de estilo */}
        <div>
          <label className="block text-xs text-zinc-400 mb-0.5">Regras de estilo</label>
          <p className="text-[11px] text-zinc-600 mb-2 leading-snug">
            Como você escreve: pronome (tu/você), tom, expressões que usa ou evita. Cada regra guia a IA na geração do conteúdo.
          </p>
          <div className="space-y-2 mb-2">
            {form.style_rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <span className="text-xs text-zinc-300 flex-1">{rule}</span>
                <button onClick={() => removeRule(i)} className="text-zinc-600 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRule()}
              placeholder="Ex: Use linguagem direta, sem rodeios"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={addRule}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-8 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
      >
        <Save className="w-4 h-4" />
        {saved ? '✓ Salvo!' : saving ? 'Salvando...' : 'Salvar DNA'}
      </button>
    </div>
  )
}

export default function DnaPage() {
  return (
    <Suspense>
      <DnaForm />
    </Suspense>
  )
}
