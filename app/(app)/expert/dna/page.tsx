'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, Wand2, Plus, X, Sparkles, Camera, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { JUAN_CARLOS_TEMPLATE } from '@/lib/expert-config'

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
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(null)
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
        // avatar_url pode não existir ainda se migration não foi rodada
        setAvatarUrl((expert as any).avatar_url || null)
      }
    }
    load()
  }, [])

  function applyTemplate() {
    setForm({
      display_name:           JUAN_CARLOS_TEMPLATE.displayName,
      handle:                 JUAN_CARLOS_TEMPLATE.handle,
      niche:                  JUAN_CARLOS_TEMPLATE.niche,
      bio_short:              JUAN_CARLOS_TEMPLATE.bioShort,
      product_name:           JUAN_CARLOS_TEMPLATE.productName,
      product_cta:            JUAN_CARLOS_TEMPLATE.productCta,
      highlight_color:        JUAN_CARLOS_TEMPLATE.highlightColor,
      author_slide_template:  JUAN_CARLOS_TEMPLATE.authorSlideTemplate,
      cta_final_template:     JUAN_CARLOS_TEMPLATE.ctaFinalTemplate,
      style_rules:            JUAN_CARLOS_TEMPLATE.styleRules,
      ig_account_id:          JUAN_CARLOS_TEMPLATE.igAccountId,
    })
  }

  async function handleAvatarUpload(file: File) {
    if (!userId) return
    setUploadingAvatar(true)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const storagePath = `${userId}/avatar.${ext}`

      // Remove avatar anterior se existir
      await supabase.storage.from('expert-photos').remove([storagePath])

      const { error: uploadError } = await supabase.storage
        .from('expert-photos')
        .upload(storagePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: signed } = await supabase.storage
        .from('expert-photos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

      const url = signed?.signedUrl || ''

      // Salva URL no experts
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

  const field = (label: string, key: keyof FormData, placeholder?: string) => (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
      />
    </div>
  )

  const textarea = (label: string, key: keyof FormData, rows = 4) => (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <textarea
        rows={rows}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
      />
    </div>
  )

  // Cor de preview para o avatar placeholder
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
              Clique em <strong>Usar template</strong> para pré-preencher com um exemplo,
              depois personalize com seus dados e salve.
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
          onClick={applyTemplate}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Wand2 className="w-4 h-4" />
          Usar template
        </button>
      </div>

      {/* ── Avatar ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <label className="block text-xs text-zinc-400 mb-3">Foto de perfil (avatar)</label>
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
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full gap-1">
                <span className="text-xl font-bold" style={{ color: hl }}>{initials}</span>
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </button>

          <div className="text-xs text-zinc-500 leading-relaxed">
            <p>Esta foto aparece no cabeçalho de cada slide.</p>
            <p className="mt-1">Use uma foto quadrada com rosto visível.</p>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="mt-2 text-violet-400 hover:text-violet-300 underline underline-offset-2 disabled:opacity-50"
            >
              {avatarUrl ? 'Trocar foto' : 'Fazer upload'}
            </button>
          </div>
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
          {field('Nome', 'display_name', 'Juan Carlos')}
          {field('Handle (@)', 'handle', '@juancarlos.ai')}
        </div>

        {field('Nicho', 'niche', 'Automações com IA para negócios')}
        {textarea('Bio curta', 'bio_short', 3)}

        <div className="grid grid-cols-2 gap-4">
          {field('Nome do produto', 'product_name', 'Automações na Prática')}
          {field('CTA do produto', 'product_cta', 'Clica no link da bio')}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Cor de destaque</label>
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
          {field('Instagram Account ID', 'ig_account_id', '17841401...')}
        </div>

        {textarea('Template Slide 5 (apresentação do autor)', 'author_slide_template', 6)}
        {textarea('Template Slide 10 (CTA final)', 'cta_final_template', 6)}

        {/* Regras de estilo */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2">Regras de estilo</label>
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
              placeholder="Adicionar regra de estilo..."
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
