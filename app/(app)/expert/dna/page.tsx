'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Save, Wand2, Plus, X, Sparkles, Camera, Loader2, Copy, Check, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getActiveExpertContext } from '@/lib/expert-client'

interface FormData {
  display_name: string
  handle: string
  ig_account_id: string
  ig_access_token: string
  niche: string
  bio_short: string
  product_name: string
  product_cta: string
  highlight_color: string
  author_slide_template: string
  cta_final_template: string
  style_rules: string[]
}

type WorkspacePlan = string

interface ExpertListItem {
  id: string
  display_name: string
  handle: string
  photos_count: number
}

const EMPTY: FormData = {
  display_name: '',
  handle: '',
  ig_account_id: '',
  ig_access_token: '',
  niche: '',
  bio_short: '',
  product_name: '',
  product_cta: '',
  highlight_color: '#9B59FF',
  author_slide_template: '',
  cta_final_template: '',
  style_rules: [],
}

const DNA_EXAMPLE = [
  { label: 'Nome',            value: 'Marina Souza' },
  { label: 'Handle',          value: '@marinasouza.fit' },
  { label: 'Nicho',           value: 'Emagrecimento feminino sem dieta restritiva' },
  { label: 'Bio curta',       value: 'Nutricionista especializada em comportamento alimentar. Ajudo mulheres a emagrecer sem sofrimento e sem efeito sanfona em 12 semanas.' },
  { label: 'Produto',         value: 'Método Leveza Total' },
  { label: 'CTA do produto',  value: 'Acesse o link na bio e comece hoje.' },
  { label: 'Cor de destaque', value: '#E91E8C' },
  { label: 'Template Slide 5 (autor)', value: `Oi, eu sou a Marina Souza 👋
Nutricionista há 8 anos, especialista em comportamento alimentar.

Já ajudei mais de 2.000 mulheres a emagrecer sem abrir mão da vida social.

➡️ No próximo slide, o passo a passo completo.` },
  { label: 'Template Slide 10 (CTA)', value: `Se esse conteúdo fez sentido pra você:

👆 Me segue — posto todo dia sobre emagrecimento real
🔔 Ativa o sininho para não perder nada
❤️ Compartilha com uma amiga que precisa ver isso

👇 Acesse o link na bio e conheça o Método Leveza Total` },
  { label: 'Regras de estilo', value: `• Use "você" — tom próximo e acolhedor, sem julgamentos
• Frases curtas. Máximo uma ideia por parágrafo
• Nunca use termos clínicos sem explicar em seguida
• Prefira exemplos do cotidiano a dados técnicos
• Fale sempre com empatia — o público já tentou muitas dietas` },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 text-zinc-600 hover:text-violet-400 transition-colors mt-0.5"
      title="Copiar"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function ExampleModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Exemplo de DNA Expert</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Leia, copie o que precisar e preencha com os seus dados</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {DNA_EXAMPLE.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
              <div className="flex items-start gap-2">
                <p className="text-xs text-zinc-300 leading-relaxed flex-1 whitespace-pre-line">{value}</p>
                <CopyButton text={value} />
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function DnaForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === '1'
  const isCreatingNew = searchParams.get('new') === '1'

  const [form, setForm]         = useState<FormData>(EMPTY)
  const [newRule, setNewRule]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [userId, setUserId]     = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [expertId, setExpertId] = useState<string | null>(null)
  const [showExample, setShowExample] = useState(false)
  const [experts, setExperts] = useState<ExpertListItem[]>([])
  const [workspacePlan, setWorkspacePlan] = useState<WorkspacePlan>('starter')
  const [expertLimit, setExpertLimit] = useState(1)
  const [activeExpertId, setActiveExpertId] = useState<string | null>(null)
  const [switchingExpertId, setSwitchingExpertId] = useState<string | null>(null)
  const [selectedExpertId, setSelectedExpertId] = useState<string | null>(null)
  const [expertLoadError, setExpertLoadError] = useState('')

  const [avatarUrl, setAvatarUrl]             = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const ctx = await getActiveExpertContext(supabase, user.id)
      setWorkspaceId(ctx.workspaceId)
      const expertRes = await fetch('/api/experts').catch(() => null)
      const expertJson = expertRes ? await expertRes.json().catch(() => null) : null
      if (expertRes?.ok && expertJson) {
        setExperts(expertJson.experts || [])
        setWorkspacePlan((expertJson.workspacePlan as WorkspacePlan) || 'starter')
        setExpertLimit(Number(expertJson.expertLimit) || 1)
        setActiveExpertId(expertJson.activeExpertId || null)
        setExpertLoadError('')
      } else {
        // Fallback: busca direto no client se a API falhar.
        if (ctx.workspaceId) {
          const { data: fallbackExperts } = await supabase
            .from('experts')
            .select('id, display_name, handle')
            .eq('workspace_id', ctx.workspaceId)
            .order('updated_at', { ascending: false })
          setExperts((fallbackExperts || []).map((e: { id: string; display_name: string; handle: string }) => ({ ...e, photos_count: 0 })))
          setActiveExpertId((ctx.activeExpertId as string | null) || null)
          setExpertLoadError('Falha ao carregar lista via API. Mostrando fallback local.')
        }
      }
      if (isCreatingNew) {
        setExpertId(null)
        setSelectedExpertId('new')
        setForm(EMPTY)
        setAvatarUrl(null)
        return
      }
      setSelectedExpertId(null)
    }
    load()
  }, [isCreatingNew])

  async function loadExpertFormById(nextExpertId: string) {
    const { data: expert } = await supabase
      .from('experts')
      .select('*')
      .eq('id', nextExpertId)
      .maybeSingle()
    if (!expert) return

    setExpertId(nextExpertId)
    setForm({
      display_name:           expert.display_name || '',
      handle:                 expert.handle || '',
      ig_account_id:          expert.ig_account_id || '',
      ig_access_token:        expert.ig_access_token || '',
      niche:                  expert.niche || '',
      bio_short:              expert.bio_short || '',
      product_name:           expert.product_name || '',
      product_cta:            expert.product_cta || '',
      highlight_color:        expert.highlight_color || '#9B59FF',
      author_slide_template:  expert.author_slide_template || '',
      cta_final_template:     expert.cta_final_template || '',
      style_rules:            expert.style_rules || [],
    })
    setAvatarUrl((expert as any).avatar_url || null)
    setSelectedExpertId(nextExpertId)
  }

  async function ensureExpertId(forceCreate = false): Promise<string | null> {
    if (!userId || !workspaceId) return null
    if (selectedExpertId && selectedExpertId !== 'new' && !forceCreate) return selectedExpertId

    const { data: created, error } = await supabase
      .from('experts')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        display_name: form.display_name || 'Novo Expert',
        handle: form.handle || '',
        highlight_color: form.highlight_color || '#9B59FF',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error || !created?.id) return null

    await supabase
      .from('profiles')
      .update({ active_expert_id: created.id })
      .eq('id', userId)

    setExpertId(created.id)
    setSelectedExpertId(created.id)
    setActiveExpertId(created.id)
    return created.id
  }

  async function handleAvatarUpload(file: File) {
    const currentExpertId = await ensureExpertId()
    if (!userId || !currentExpertId) return
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
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('id', currentExpertId)
      setAvatarUrl(url)
    } catch (err) {
      console.error('Erro ao enviar avatar:', err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    const currentExpertId = await ensureExpertId(selectedExpertId === 'new')
    if (!userId || !workspaceId || !currentExpertId) return
    setSaving(true)
    await supabase
      .from('experts')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', currentExpertId)

    if (selectedExpertId === 'new') {
      window.history.replaceState(null, '', '/expert/dna')
    }

    const expertRes = await fetch('/api/experts')
    const expertJson = await expertRes.json().catch(() => null)
    if (expertRes.ok && expertJson) {
      setExperts(expertJson.experts || [])
      setWorkspacePlan((expertJson.workspacePlan as WorkspacePlan) || 'starter')
      setExpertLimit(Number(expertJson.expertLimit) || 1)
      setActiveExpertId(expertJson.activeExpertId || currentExpertId)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleSwitchExpert(nextExpertId: string) {
    if (!nextExpertId) return
    if (nextExpertId === activeExpertId) {
      await loadExpertFormById(nextExpertId)
      return
    }
    setSwitchingExpertId(nextExpertId)
    try {
      const res = await fetch('/api/experts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeExpertId: nextExpertId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao trocar expert')
      setActiveExpertId(nextExpertId)
      await loadExpertFormById(nextExpertId)
    } catch (err) {
      console.error(err)
    } finally {
      setSwitchingExpertId(null)
    }
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
  const canCreateMore = experts.length < expertLimit

  function startNewExpert() {
    if (!canCreateMore) return
    setSelectedExpertId('new')
    setExpertId(null)
    setForm(EMPTY)
    setAvatarUrl(null)
    setSaved(false)
  }

  return (
    <div className="p-8 max-w-2xl">
      {!selectedExpertId ? (
        <>
          <div className="mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
          </div>
          {isOnboarding && (
            <div className="flex items-start gap-3 bg-violet-950/50 border border-violet-700 rounded-xl p-4 mb-6">
              <Sparkles className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-violet-200">Configure seu perfil para começar</p>
                <p className="text-xs text-violet-400 mt-0.5">
                  Escolha um DNA existente ou clique em <strong>Novo</strong> para criar um.
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">DNA Expert</h1>
              <p className="text-zinc-400 text-sm mt-1">Selecione um DNA para editar ou crie um novo</p>
            </div>
            <button
              onClick={startNewExpert}
              disabled={!canCreateMore}
              className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700 text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              title={canCreateMore ? 'Criar novo expert' : 'Limite do plano atingido'}
            >
              <Plus className="w-4 h-4" />
              Novo
            </button>
          </div>
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">DNAs do workspace</p>
              <p className="text-xs text-zinc-500">
                Plano: {workspacePlan} · {experts.length}/{expertLimit} experts
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {experts.map((item) => {
                const isActive = item.id === activeExpertId
                const isSwitching = switchingExpertId === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSwitchExpert(item.id)}
                    disabled={isSwitching}
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                      isActive
                        ? 'border-violet-500/60 bg-violet-900/20'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-sm text-zinc-100 font-medium truncate">{item.display_name || 'Sem nome'}</p>
                    <p className="text-xs text-zinc-500 truncate">{item.handle || 'sem @'} · {item.photos_count || 0} fotos</p>
                    {isSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 mt-1" />}
                  </button>
                )
              })}
              {experts.length === 0 && (
                <p className="text-xs text-zinc-500">Nenhum expert criado ainda. Clique em Novo para começar.</p>
              )}
            </div>
            {expertLoadError && (
              <p className="text-xs text-amber-400">{expertLoadError}</p>
            )}
          </div>
        </>
      ) : (
        <>
      <div className="mb-4">
        <button
          onClick={() => setSelectedExpertId(null)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para lista de DNAs
        </button>
      </div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">DNA Expert</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {selectedExpertId === 'new' ? 'Preencha os dados para criar um novo DNA' : 'Ajuste os dados do DNA selecionado'}
          </p>
        </div>
        <button
          onClick={() => setShowExample(true)}
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

      {/* ── Campos ───────────────────────────────────────────────── */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {field('Nome', 'display_name',
            'Seu nome completo ou nome pelo qual é reconhecido profissionalmente.',
            'Ex: Marina Souza')}
          {field('Handle (@)', 'handle',
            'Seu @ do Instagram exatamente como aparece no perfil.',
            'Ex: @marinasouza.fit')}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {field('Instagram Account ID', 'ig_account_id',
            'ID numérico da conta Instagram Business/Creator usada na publicação via API Meta.',
            'Ex: 17841401220225117')}
          {field('Meta Access Token', 'ig_access_token',
            'Token de publicação do Meta Graph API (long-lived). Fica salvo no workspace.',
            'Ex: EAAJ...')}
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
              className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {textarea('Template Slide 5 — apresentação do autor', 'author_slide_template',
          'Texto do slide central onde você se apresenta. Inclua nome, especialidade e uma credencial relevante.', 6)}

        {textarea('Template Slide 10 — CTA final', 'cta_final_template',
          'Chamada para ação do último slide. Peça para seguir, salvar ou clicar no link.', 6)}

        {/* Regras de estilo */}
        <div>
          <label className="block text-xs text-zinc-400 mb-0.5">Regras de estilo</label>
          <p className="text-[11px] text-zinc-600 mb-2 leading-snug">
            Como você escreve: pronome, tom, expressões que usa ou evita. Cada regra guia a IA na geração do conteúdo.
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
        {saved ? '✓ Salvo!' : saving ? 'Salvando...' : selectedExpertId === 'new' ? 'Criar Expert' : 'Salvar DNA'}
      </button>
      </>
      )}

      {showExample && <ExampleModal onClose={() => setShowExample(false)} />}
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
