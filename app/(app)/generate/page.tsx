'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Topic } from '@/components/generate/topic-card'
import { CarouselPreview, type Slide, type ExpertInfo } from '@/components/generate/carousel-preview'
import { Sparkles, Mic, Loader2, ArrowLeft, Send, AlertCircle, Calendar, Check, X, ChevronRight } from 'lucide-react'
import { TopicDiscovery } from '@/components/generate/topic-discovery'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getActiveExpertContext } from '@/lib/expert-client'
import { useSearchParams } from 'next/navigation'
import { TEMPLATES, TEMPLATE_PRESETS } from '@/lib/templates'

type Stage = 'template' | 'discovery' | 'angles' | 'generating' | 'editing'

interface AngleOption {
  title: string
  subtitle: string
  description: string
}
type WorkspacePlan = 'starter' | 'pro' | 'agency'
type ProviderId = 'anthropic' | 'openai'

interface ModelOption {
  providerId: ProviderId
  model: string
  label: string
}

interface WorkspaceLimits {
  planId: string
  planLabel: string
  monthlyPostCredits: number
  usedCredits: number
  remainingCredits: number
  usagePercent: number
  budgetLimitUsd: number
  usedBudgetUsd: number
  remainingBudgetUsd: number | null
  budgetUsagePercent: number
  canGenerate: boolean
  recommendation?: {
    recommendedPlanId: string
    recommendedPlanLabel: string
    reason: string
  } | null
}

const PLAN_MODEL_OPTIONS: Record<WorkspacePlan, ModelOption[]> = {
  starter: [
    { providerId: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  ],
  pro: [
    { providerId: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { providerId: 'anthropic', model: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  ],
  agency: [
    { providerId: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { providerId: 'anthropic', model: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { providerId: 'openai', model: 'gpt-4o', label: 'GPT-4o' },
  ],
}

function normalizePlan(value: unknown): WorkspacePlan {
  if (value === 'pro' || value === 'agency') return value
  return 'starter'
}

const DEFAULT_EXPERT: ExpertInfo = {
  displayName: 'Expert',
  handle: '@expert',
  highlightColor: '#9B59FF',
}

function formatCreditValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function usd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function normalizeSplitCoverTitle(value: string): string {
  return value
    .trim()
    .replace(/\s+vs\.?\s+/gi, ' VS. ')
    .toUpperCase()
}

function getTemplateHint(templateId: string): string {
  return templateId === 'positivo-negativo'
    ? 'Contrastes fortes, comparações e perguntas de capa'
    : 'Hooks, autoridade e conteúdo educativo em carrossel'
}

export default function GeneratePage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [stage, setStage]                 = useState<Stage>('template')
  const [generating, setGenerating]       = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [slides, setSlides]               = useState<Slide[]>([])
  const [caption, setCaption]             = useState('')
  const [imageProgress, setImageProgress] = useState<Record<number, 'loading' | 'done' | 'error'>>({})
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [voiceActive, setVoiceActive]     = useState(false)
  const [customTopic, setCustomTopic]     = useState('')
  const [slidesGenerated, setSlidesGenerated] = useState(0)
  const [retryMessage, setRetryMessage]   = useState('')
  const [publishing, setPublishing]       = useState(false)
  const [publishedUrl, setPublishedUrl]   = useState('')
  const [expert, setExpert]               = useState<ExpertInfo>(DEFAULT_EXPERT)
  const [niche, setNiche]                 = useState('seu nicho')
  const [generateError, setGenerateError] = useState('')
  const [carouselId, setCarouselId]       = useState<string | null>(null)
  const [userId, setUserId]               = useState<string | null>(null)
  const [textLength, setTextLength]       = useState<'short' | 'medium' | 'long'>('medium')
  const [contentStyle, setContentStyle]   = useState<'text' | 'question'>('text')
  const [useFixedSlides, setUseFixedSlides] = useState(true)
  const [activeTemplateName, setActiveTemplateName] = useState<string>('Brand Equity')
  const [activeTemplateId, setActiveTemplateId]     = useState<string>('frank-costa-10')
  const [scheduledAt, setScheduledAt]     = useState('')
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduling, setScheduling]       = useState(false)
  const [angleOptions, setAngleOptions]   = useState<AngleOption[]>([])
  const [loadingAngles, setLoadingAngles] = useState(false)
  const [pendingAngleTopic, setPendingAngleTopic] = useState<{ topic: Topic; hook: string } | null>(null)
  const [customAngle, setCustomAngle]     = useState('')
  const [workspacePlan, setWorkspacePlan] = useState<WorkspacePlan>('starter')
  const [workspaceLimits, setWorkspaceLimits] = useState<WorkspaceLimits | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>('anthropic')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5')
  const autoSaveTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef                      = useRef<string>(`temp-${Date.now()}`)
  const reRenderTimers                    = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const lastRenderedSettings              = useRef<Record<number, { x: number; y: number; h: number; pos: string }>>({})
  // Guard para evitar que handleGenerate seja chamado concorrentemente (double-click, etc.)
  const isGeneratingRef                   = useRef(false)
  // Trigger para auto-geração de imagens no template X vs Y
  const autoGenImagesRef                  = useRef(false)

  function getSplitContentIndex(slideNum: number, sourceSlides: Slide[] = slides): number | undefined {
    const targetIndex = sourceSlides.findIndex((slide) => slide.num === slideNum)
    if (targetIndex < 0 || sourceSlides[targetIndex]?.layout !== 'split-content') return undefined

    let count = 0
    for (let i = 0; i < targetIndex; i++) {
      if (sourceSlides[i].layout === 'split-content') count += 1
    }
    return count + 1
  }

  // Mantém sessionId sincronizado com o carouselId real assim que disponível
  useEffect(() => {
    if (carouselId) sessionIdRef.current = carouselId
  }, [carouselId])

  // Carrega expert
  useEffect(() => {
    async function loadExpertContext() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const ctx = await getActiveExpertContext(supabase, user.id)
      const exp = ctx.expert

      if (exp) {
        setNiche((exp.niche as string) || 'seu nicho')

        let avatarUrl: string | undefined
        try {
          avatarUrl = (exp as any)?.avatar_url || undefined
        } catch { /* coluna ainda não existe */ }

        if (!avatarUrl && exp.id) {
          const { data: photos } = await supabase
            .from('expert_photos')
            .select('storage_path')
            .eq('expert_id', exp.id)
            .order('order_index', { ascending: true })
            .limit(1)

          if (photos?.[0]?.storage_path) {
            const { data: signed } = await supabase.storage
              .from('expert-photos')
              .createSignedUrl(photos[0].storage_path, 3600)
            avatarUrl = signed?.signedUrl || undefined
          }
        }

        setExpert({
          displayName:    (exp.display_name as string) || DEFAULT_EXPERT.displayName,
          handle:         (exp.handle as string)       || DEFAULT_EXPERT.handle,
          highlightColor: (exp.highlight_color as string) || DEFAULT_EXPERT.highlightColor,
          avatarUrl,
        })
      }

    }

    loadExpertContext()
  }, [])

  // Carrega plano do workspace atual para filtrar modelos disponíveis
  useEffect(() => {
    async function loadWorkspacePlan() {
      try {
        const res = await fetch('/api/workspace/context')
        const data = await res.json()
        if (!res.ok) return

        const workspaces = Array.isArray(data.workspaces) ? data.workspaces : []
        const currentWorkspaceId = typeof data.currentWorkspaceId === 'string' ? data.currentWorkspaceId : ''
        const currentWorkspace = workspaces.find((w: any) => w.id === currentWorkspaceId) || workspaces[0]
        setWorkspacePlan(normalizePlan(currentWorkspace?.plan))
      } catch {
        setWorkspacePlan('starter')
      }
    }

    loadWorkspacePlan()
  }, [])

  const availableModels = useMemo(() => PLAN_MODEL_OPTIONS[workspacePlan], [workspacePlan])
  const providerOptions = useMemo(
    () => Array.from(new Set(availableModels.map((opt) => opt.providerId))),
    [availableModels]
  )

  useEffect(() => {
    const currentModelIsValid = availableModels.some(
      (opt) => opt.providerId === selectedProviderId && opt.model === selectedModel
    )
    if (currentModelIsValid) return

    const fallback = availableModels.find((opt) => opt.providerId === selectedProviderId) || availableModels[0]
    if (!fallback) return
    setSelectedProviderId(fallback.providerId)
    setSelectedModel(fallback.model)
  }, [availableModels, selectedProviderId, selectedModel])

  async function loadWorkspaceLimits(): Promise<WorkspaceLimits | null> {
    try {
      const res = await fetch('/api/workspace/limits')
      const data = await res.json()
      if (!res.ok) return null
      const nextLimits: WorkspaceLimits = {
        planId: data.planId || 'starter',
        planLabel: data.planLabel || 'Starter',
        monthlyPostCredits: Number(data.monthlyPostCredits) || 0,
        usedCredits: Number(data.usedCredits) || 0,
        remainingCredits: Number(data.remainingCredits) || 0,
        usagePercent: Number(data.usagePercent) || 0,
        budgetLimitUsd: Number(data.budgetLimitUsd) || 0,
        usedBudgetUsd: Number(data.usedBudgetUsd) || 0,
        remainingBudgetUsd: data.remainingBudgetUsd === null ? null : Number(data.remainingBudgetUsd || 0),
        budgetUsagePercent: Number(data.budgetUsagePercent) || 0,
        canGenerate: Boolean(data.canGenerate),
        recommendation: data.recommendation || null,
      }
      setWorkspaceLimits(nextLimits)
      return nextLimits
    } catch {
      return null
    }
  }

  useEffect(() => {
    loadWorkspaceLimits()
  }, [])

  // Aplica preset automaticamente quando vem de /templates?template=...
  useEffect(() => {
    const templateId = searchParams.get('template')
    if (!templateId) return

    const template = TEMPLATES.find(t => t.id === templateId && t.available)
    if (!template) return

    const preset = TEMPLATE_PRESETS[templateId]
    if (preset) {
      setTextLength(preset.textLength)
      setUseFixedSlides(preset.useFixedSlides)
    }
    setActiveTemplateName(template.name)
    setActiveTemplateId(templateId)
    setStage('discovery')
  }, [searchParams])

  // ── Auto-geração de imagens após conteúdo X vs Y ───────────────────────────
  // Permanece no stage 'generating' e transita para 'editing' só quando imagens ficam prontas
  useEffect(() => {
    if (!autoGenImagesRef.current || slides.length === 0 || generatingImages) return
    autoGenImagesRef.current = false
    handleGenerateImages(() => setStage('editing'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, generatingImages])

  // ── Auto-save com debounce de 1.5s ────────────────────────────────────────
  useEffect(() => {
    if (!carouselId || stage !== 'editing') return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        // Remove campos base64 — persiste apenas paths/URLs
        const slidesForSave = slides.map(({ imagePath, cardPath, ...rest }) => ({
          ...rest,
          ...(imagePath && !imagePath.startsWith('data:') ? { imagePath } : {}),
          ...(cardPath  && !cardPath.startsWith('data:')  ? { cardPath }  : {}),
        }))
        await fetch(`/api/carousels/${carouselId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption, slides: slidesForSave }),
        })
      } catch (e) {
        console.error('Auto-save falhou:', e)
      }
    }, 1500)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [slides, caption, carouselId])

  // ── Re-render automático quando posição/espaço mudam (debounce 2s) ─────────
  useEffect(() => {
    slides.forEach(slide => {
      if (!slide.imagePath) return // só re-renderiza se tiver a imagem Gemini em memória
      const current = {
        x:   slide.imageObjectX      ?? 50,
        y:   slide.imageObjectY      ?? 50,
        h:   slide.imageHeightPercent ?? 0,
        pos: slide.imagePosition     ?? 'bottom',
      }
      const last = lastRenderedSettings.current[slide.num]
      if (!last) { lastRenderedSettings.current[slide.num] = current; return }
      if (last.x === current.x && last.y === current.y && last.h === current.h && last.pos === current.pos) return

      if (reRenderTimers.current[slide.num]) clearTimeout(reRenderTimers.current[slide.num])
      reRenderTimers.current[slide.num] = setTimeout(async () => {
        lastRenderedSettings.current[slide.num] = current
        await reRenderSlide(slide)
      }, 2000)
    })
  }, [slides])

  function handleTemplateSelect(templateId: string, templateName: string) {
    setActiveTemplateId(templateId)
    setActiveTemplateName(templateName)
    const preset = TEMPLATE_PRESETS[templateId]
    if (preset) {
      setTextLength(preset.textLength)
      setUseFixedSlides(preset.useFixedSlides)
    }
    setCustomTopic('')
    setGenerateError('')
    setStage('discovery')
  }

  // ── Geração de conteúdo ──────────────────────────────────────────────────
  async function handleGenerate(topic: Topic, hook: string) {
    // Previne chamadas concorrentes (double-click, click rápido em TopicCard, etc.)
    if (isGeneratingRef.current) return
    isGeneratingRef.current = true

    const isSplitTemplate = activeTemplateId === 'positivo-negativo'
    const resolvedSplitTitle = isSplitTemplate
      ? normalizeSplitCoverTitle(hook || topic.splitTitle || topic.title || '')
      : ''
    const resolvedSplitSubtitle = isSplitTemplate
      ? ((topic.splitSubtitle || '').trim())
      : ''
    const resolvedTopic = isSplitTemplate
      ? (topic.title || resolvedSplitTitle || 'Tema comparativo')
      : topic.title

    const limits = await loadWorkspaceLimits()
    if (limits && !limits.canGenerate) {
      const blockedByBudget = limits.budgetLimitUsd > 0 && limits.usedBudgetUsd >= limits.budgetLimitUsd
      setGenerateError(
        blockedByBudget
          ? `Orçamento mensal de custo atingido no plano ${limits.planLabel} (${usd(limits.usedBudgetUsd)}/${usd(limits.budgetLimitUsd)}).`
          : `Limite de créditos atingido no plano ${limits.planLabel} (${formatCreditValue(limits.usedCredits)}/${formatCreditValue(limits.monthlyPostCredits)}).`
      )
      return
    }

    setSelectedTopic(isSplitTemplate && resolvedSplitTitle ? resolvedSplitTitle : resolvedTopic)
    setGenerating(true)
    setStage('generating')
    setGenerateError('')
    setImageProgress({})
    setCaption('')
    setPublishedUrl('')
    setSlidesGenerated(0)
    setRetryMessage('')
    setCarouselId(null)
    setScheduledAt('')
    setShowScheduler(false)
    sessionIdRef.current = `temp-${Date.now()}`

    try {
      const res = await fetch('/api/generate/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: resolvedTopic,
          hook,
          splitTitle: resolvedSplitTitle || undefined,
          splitSubtitle: resolvedSplitSubtitle || undefined,
          textLength,
          contentStyle,
          useFixedSlides,
          templateId: activeTemplateId,
          providerId: selectedProviderId,
          model: selectedModel,
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Erro ao conectar com a API' }))
        throw new Error(err.error)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          let event: any
          try { event = JSON.parse(jsonStr) } catch { continue }

          if (event.error) throw new Error(event.error)

          if (event.retrying) {
            setRetryMessage(`API sobrecarregada. Nova tentativa ${event.attempt}/3 em ${event.waitSeconds}s...`)
          }

          if (typeof event.slidesGenerated === 'number') {
            setSlidesGenerated(event.slidesGenerated)
            setRetryMessage('')
          }

          if (event.done) {
            if (typeof event.carouselId === 'string' && event.carouselId) {
              setCarouselId(event.carouselId)
              sessionIdRef.current = event.carouselId
            }
            setSlides((event.slides as Slide[]).map(s => ({
              ...s,
              approved: false,
              imagePosition: 'bottom' as const,
              imageObjectX: 50,
              imageObjectY: 50,
            })))
            setCaption(event.caption || '')
            if (isSplitTemplate) {
              // Fica na tela de gerando até as imagens estarem prontas
              autoGenImagesRef.current = true
            } else {
              setStage('editing')
            }
            break outer
          }
        }
      }
    } catch (err: any) {
      console.error(err)
      setGenerateError(err.message || 'Erro ao gerar carrossel.')
      setStage('discovery')
    } finally {
      isGeneratingRef.current = false
      setGenerating(false)
      setSlidesGenerated(0)
      setRetryMessage('')
    }
  }

  async function handleGenerateFromCustom() {
    if (!customTopic.trim()) return
    const mockTopic: Topic = {
      id: 'custom',
      title: customTopic,
      viralScore: 0,
      growth: '—',
      postsToday: 0,
      avgEngagement: '—',
      hook: customTopic,
      gain: '',
      angle: 'Personalizado',
    }
    if (activeTemplateId === 'positivo-negativo') {
      await handleDiscoverAngles(mockTopic, customTopic)
    } else {
      await handleGenerate(mockTopic, customTopic)
    }
  }

  // ── Descobre ângulos para o template X vs Y ────────────────────────────────
  async function handleDiscoverAngles(topic: Topic, hook: string) {
    setLoadingAngles(true)
    setPendingAngleTopic({ topic, hook })
    setAngleOptions([])
    setCustomAngle('')
    setStage('angles')
    try {
      const res = await fetch('/api/generate/angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.title }),
      })
      const data = await res.json()
      setAngleOptions(data.angles || [])
    } catch (e) {
      console.error('Falha ao gerar ângulos:', e)
    } finally {
      setLoadingAngles(false)
    }
  }

  // ── Seleciona um ângulo e dispara geração ──────────────────────────────────
  async function handleSelectAngle(angle: AngleOption) {
    if (!pendingAngleTopic) return
    const modifiedTopic: Topic = {
      ...pendingAngleTopic.topic,
      splitTitle: angle.title,
      splitSubtitle: angle.subtitle,
    }
    await handleGenerate(modifiedTopic, angle.title)
  }

  async function handleSelectCustomAngle() {
    if (!customAngle.trim() || !pendingAngleTopic) return
    const modifiedTopic: Topic = {
      ...pendingAngleTopic.topic,
      splitTitle: normalizeSplitCoverTitle(customAngle),
    }
    await handleGenerate(modifiedTopic, customAngle)
  }

  function handleVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Seu navegador não suporta reconhecimento de voz.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.onstart = () => setVoiceActive(true)
    recognition.onend   = () => setVoiceActive(false)
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setCustomTopic(transcript)
    }
    recognition.start()
  }

  // imagePrompts padrão para slides que não recebem prompt do Claude (ex: fixos)
  const FALLBACK_IMAGE_PROMPTS: Record<string, string> = {
    cta:       'warm professional portrait, confident approachable smile, natural light, modern clean office',
    'cta-final': 'person sitting relaxed at clean desk, laptop open, coffee cup, warm natural sunlight',
  }

  // ── Upload da imagem de fundo (Gemini) para o Storage ───────────────────
  async function uploadBgImageToStorage(slideNum: number, imageBase64: string): Promise<string | null> {
    if (!userId) return null
    const path = `${userId}/carousel-${sessionIdRef.current}/bg-${slideNum}.jpg`
    const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
    const { error } = await supabase.storage.from('carousel-images').upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (error) { console.error('Upload bg image falhou:', error); return null }
    return path
  }

  // ── Upload do card PNG para o Storage ────────────────────────────────────
  async function uploadCardToStorage(slideNum: number, cardBase64: string): Promise<{ url: string; path: string } | null> {
    if (!userId) return null
    const path = `${userId}/carousel-${sessionIdRef.current}/card-${slideNum}.png`
    const bytes = Uint8Array.from(atob(cardBase64), c => c.charCodeAt(0))
    const { error } = await supabase.storage.from('carousel-images').upload(path, bytes, {
      contentType: 'image/png',
      upsert: true,
    })
    if (error) { console.error('Upload card falhou:', error); return null }
    const { data: signed } = await supabase.storage.from('carousel-images').createSignedUrl(path, 60 * 60 * 24 * 365)
    return signed?.signedUrl ? { url: signed.signedUrl, path } : null
  }

  // ── Re-renderiza um slide usando a imagem Gemini já existente ─────────────
  async function reRenderSlide(slide: Slide): Promise<void> {
    if (!slide.imagePath) return
    setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))
    try {
      const imageBase64 = slide.imagePath.replace(/^data:[^;]+;base64,/, '')
      const cardRes = await fetch('/api/render/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:               slide.text,
          imageBase64,
          format:             'portrait',
          showHeader:         true,
          imageHeightPercent: slide.imageHeightPercent ?? 0,
          imagePosition:      slide.imagePosition      ?? 'bottom',
          imageObjectX:       slide.imageObjectX       ?? 50,
          imageObjectY:       slide.imageObjectY       ?? 50,
          fontSize:           slide.fontSize,
          highlightEnabled:   slide.highlightEnabled !== false,
        }),
      })
      const cardData = await cardRes.json()
      if (cardData.error) throw new Error(cardData.error)

      const stored = await uploadCardToStorage(slide.num, cardData.cardBase64)
      const cardPath = stored?.url || `data:image/png;base64,${cardData.cardBase64}`
      setSlides(prev => prev.map(s =>
        s.num === slide.num
          ? { ...s, cardPath, cardStoragePath: stored?.path }
          : s
      ))
      setImageProgress(prev => ({ ...prev, [slide.num]: 'done' }))
    } catch (err) {
      console.error(`Re-render slide ${slide.num}:`, err)
      setImageProgress(prev => ({ ...prev, [slide.num]: 'error' }))
    }
  }

  // ── Helper: chama a API de geração de imagem com retry ────────────────
  async function fetchGeneratedImage(slideNum: number, imagePrompt: string, noExpertPhoto = false, aspectRatio = '16:9'): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch('/api/generate/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slideNum, imagePrompt, noExpertPhoto, aspectRatio }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        return data.dataUrl as string
      } catch (err) {
        if (attempt === 3) throw err
      }
    }
    throw new Error('Falha ao gerar imagem após 3 tentativas')
  }

  async function renderSplitCardDataUrl(targetSlide: Slide, options?: { imageDataUrl?: string; sourceSlides?: Slide[] }): Promise<string> {
    const imageDataUrl = options?.imageDataUrl
    const imageBase64 = imageDataUrl?.startsWith('data:') ? imageDataUrl.replace(/^data:[^;]+;base64,/, '') : undefined
    const imageUrl = imageDataUrl && !imageDataUrl.startsWith('data:')
      ? imageDataUrl
      : targetSlide.imagePath && !targetSlide.imagePath.startsWith('data:')
        ? targetSlide.imagePath
        : undefined

    const res = await fetch('/api/render/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: 'split',
        slide: {
          layout: targetSlide.layout,
          text: targetSlide.text,
          subtitulo: targetSlide.subtitulo,
          esquerda: targetSlide.esquerda,
          direita: targetSlide.direita,
          labelEsquerda: targetSlide.labelEsquerda,
          labelDireita: targetSlide.labelDireita,
          subtexto: targetSlide.subtexto,
          hashtags: targetSlide.hashtags,
        },
        accentColor: expert.highlightColor,
        contentIndex: getSplitContentIndex(targetSlide.num, options?.sourceSlides ?? slides),
        imageBase64,
        imageUrl,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return `data:image/png;base64,${data.cardBase64}`
  }

  // ── Gera imagem + card de UM slide ──────────────────────────────────────
  async function generateOneSlide(slide: Slide): Promise<void> {
    // ── Helper interno: upload de imagem split + signed URL ──────────────────
    async function uploadSplitImage(slideNum: number, dataUrl: string): Promise<string> {
      const imageBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
      const storagePath = await uploadBgImageToStorage(slideNum, imageBase64)
      if (!storagePath) return dataUrl
      const { data: signed } = await supabase.storage
        .from('carousel-images')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
      return signed?.signedUrl || dataUrl
    }

    // ── Split-cover: 1 imagem desfocada de fundo (sem foto do expert) ──
    if (slide.layout === 'split-cover') {
      const basePrompt = slide.imagePrompt
      if (!basePrompt) return
      const prompt = [
        `cinematic portrait background related to: ${basePrompt}.`,
        'vertical composition, full frame subject, dark moody atmosphere, warm amber tones, photorealistic.',
        'clean background with no signage.',
        'STRICT RULE: no text, no letters, no words, no logos, no watermarks anywhere.',
      ].join(' ')
      setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))
      try {
        const dataUrl   = await fetchGeneratedImage(slide.num, prompt, true, '4:5')
        const persisted = await uploadSplitImage(slide.num, dataUrl)
        const splitCardDataUrl = await renderSplitCardDataUrl(
          { ...slide, imagePath: persisted },
          { imageDataUrl: dataUrl, sourceSlides: slides }
        )
        const stored = await uploadCardToStorage(slide.num, splitCardDataUrl.replace(/^data:image\/png;base64,/, ''))
        setSlides(prev => prev.map(s => s.num === slide.num
          ? { ...s, imagePath: persisted, cardPath: stored?.url || splitCardDataUrl, cardStoragePath: stored?.path }
          : s))
        setImageProgress(prev => ({ ...prev, [slide.num]: 'done' }))
      } catch (err) {
        console.error(`Erro capa split ${slide.num}:`, err)
        setImageProgress(prev => ({ ...prev, [slide.num]: 'error' }))
      }
      return
    }

    // ── Split-content: usa imagePrompt gerado pelo Claude (template estruturado) ──
    if (slide.layout === 'split-content') {
      const negLabel = (slide.labelEsquerda || '').replace(/\*\*/g, '').trim()
      const posLabel = (slide.labelDireita  || '').replace(/\*\*/g, '').trim()
      const negScene = (slide.esquerda      || '').replace(/\*\*/g, '').slice(0, 120)
      const posScene = (slide.direita       || '').replace(/\*\*/g, '').slice(0, 120)

      // Usa imagePrompt do Claude se disponível, senão constrói fallback
      const prompt = slide.imagePrompt || `Single illustration with a vertical split-screen composition showing two contrasting situations of the SAME professional.

Left side of the image: ${negScene || `${negLabel} — stressed and overwhelmed, struggling with the situation, visible tension, darker lighting, warm tones, frustrated expression`}.

Right side of the image: ${posScene || `${posLabel} — confident and accomplished, successfully handling the situation, brighter lighting, positive professional atmosphere`}.

Both scenes exist inside the SAME image, divided vertically in the middle.

The same character appears on both sides with identical facial features, hairstyle and clothing.

IMPORTANT: This is ONE single image with a split composition — NOT two separate images.

Style: semi-realistic digital painting, cinematic lighting, editorial business illustration, highly detailed, professional concept art, realistic characters, dramatic shadows, linkedin leadership editorial illustration style. Left side darker dramatic lighting and stressed mood. Right side brighter confident lighting and positive mood.

Aspect ratio 4:5 vertical composition.

No text, no typography, no captions.`
      setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))
      try {
        const dataUrl   = await fetchGeneratedImage(slide.num, prompt, true, '4:5')
        const persisted = await uploadSplitImage(slide.num, dataUrl)
        const splitCardDataUrl = await renderSplitCardDataUrl(
          { ...slide, imagePath: persisted },
          { imageDataUrl: dataUrl, sourceSlides: slides }
        )
        const stored = await uploadCardToStorage(slide.num, splitCardDataUrl.replace(/^data:image\/png;base64,/, ''))
        setSlides(prev => prev.map(s => s.num === slide.num
          ? { ...s, imagePath: persisted, cardPath: stored?.url || splitCardDataUrl, cardStoragePath: stored?.path }
          : s))
        setImageProgress(prev => ({ ...prev, [slide.num]: 'done' }))
      } catch (err) {
        console.error(`Erro split-content ${slide.num}:`, err)
        setImageProgress(prev => ({ ...prev, [slide.num]: 'error' }))
      }
      return
    }

    // ── Split-CTA: sem imagem de fundo (CtaContent usa background sólido) ──
    if (slide.layout === 'split-cta') {
      setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))
      try {
        const splitCardDataUrl = await renderSplitCardDataUrl(slide, { sourceSlides: slides })
        const stored = await uploadCardToStorage(slide.num, splitCardDataUrl.replace(/^data:image\/png;base64,/, ''))
        setSlides(prev => prev.map(s => s.num === slide.num
          ? { ...s, cardPath: stored?.url || splitCardDataUrl, cardStoragePath: stored?.path }
          : s))
        setImageProgress(prev => ({ ...prev, [slide.num]: 'done' }))
      } catch (err) {
        console.error(`Erro split-cta ${slide.num}:`, err)
        setImageProgress(prev => ({ ...prev, [slide.num]: 'error' }))
      }
      return
    }

    // ── Frank / demais slides: fluxo original ──
    const imagePrompt = slide.imagePrompt || FALLBACK_IMAGE_PROMPTS[slide.type]
    if (!imagePrompt) return

    setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))

    try {
      const imageDataUrl = await fetchGeneratedImage(slide.num, imagePrompt)
      const imageBase64 = imageDataUrl.replace(/^data:[^;]+;base64,/, '')

      // Render do card e upload da bg image em paralelo
      const [cardRes, bgImageStoragePath] = await Promise.all([
        fetch('/api/render/card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text:               slide.text,
            imageBase64,
            format:             'portrait',
            showHeader:         true,
            imageHeightPercent: slide.imageHeightPercent ?? 0,
            imagePosition:      slide.imagePosition      ?? 'bottom',
            imageObjectX:       slide.imageObjectX       ?? 50,
            imageObjectY:       slide.imageObjectY       ?? 50,
          fontSize:           slide.fontSize,
          highlightEnabled:   slide.highlightEnabled !== false,
          }),
        }),
        uploadBgImageToStorage(slide.num, imageBase64),
      ])
      const cardData = await cardRes.json()
      if (cardData.error) throw new Error(cardData.error)

      const stored = await uploadCardToStorage(slide.num, cardData.cardBase64)
      const cardPath = stored?.url || `data:image/png;base64,${cardData.cardBase64}`
      lastRenderedSettings.current[slide.num] = {
        x: slide.imageObjectX ?? 50, y: slide.imageObjectY ?? 50,
        h: slide.imageHeightPercent ?? 0, pos: slide.imagePosition ?? 'bottom',
      }
      setSlides(prev => prev.map(s =>
        s.num === slide.num
          ? { ...s, imagePath: imageDataUrl, bgImageStoragePath: bgImageStoragePath ?? undefined, cardPath, cardStoragePath: stored?.path }
          : s
      ))
      setImageProgress(prev => ({ ...prev, [slide.num]: 'done' }))
    } catch (err) {
      console.error(`Erro slide ${slide.num}:`, err)
      setImageProgress(prev => ({ ...prev, [slide.num]: 'error' }))
    }
  }

  async function handleGenerateImages(onComplete?: () => void) {
    setGeneratingImages(true)
    await Promise.all(slides.map(slide => generateOneSlide(slide)))
    setGeneratingImages(false)
    onComplete?.()
    // Salva imediatamente após gerar todas as imagens, sem esperar o debounce de 1.5s,
    // para garantir que bgImageStoragePath seja persistido antes do usuário navegar.
    if (carouselId) {
      try {
        // Lê o estado mais recente via callback funcional
        setSlides(current => {
          const slidesForSave = current.map(({ imagePath, cardPath, ...rest }) => ({
            ...rest,
            ...(imagePath && !imagePath.startsWith('data:') ? { imagePath } : {}),
            ...(cardPath  && !cardPath.startsWith('data:')  ? { cardPath }  : {}),
          }))
          fetch(`/api/carousels/${carouselId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption, slides: slidesForSave }),
          }).catch(e => console.error('Save pós-geração falhou:', e))
          return current // não altera o estado
        })
      } catch (e) {
        console.error('Save pós-geração falhou:', e)
      }
    }
  }

  async function handleRegenerateSlide(slideNum: number) {
    const slide = slides.find(s => s.num === slideNum)
    if (!slide) return
    await generateOneSlide(slide)
  }

  // ── Publicação ───────────────────────────────────────────────────────────
  async function handlePublish() {
    const slidesToPublish = slides.filter(s => s.cardPath || s.imagePath)
    if (slidesToPublish.length === 0) {
      alert('Gere as imagens primeiro antes de publicar.')
      return
    }
    if (!caption) { alert('Legenda não encontrada.'); return }

    setPublishing(true)
    try {
      const existingUrls = slidesToPublish
        .map((slide) => slide.cardPath || slide.imagePath || '')
        .filter((value) => value && !value.startsWith('data:'))

      const imageUrls = existingUrls.length === slidesToPublish.length
        ? existingUrls
        : await (async () => {
            const sessionId = `carousel-${Date.now()}`
            const saveRes = await fetch('/api/save-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slides: slidesToPublish.map(s => ({ num: s.num, dataUrl: s.cardPath || s.imagePath })),
                sessionId,
              }),
            })
            const saveData = await saveRes.json()
            if (saveData.error) throw new Error(saveData.error)
            return saveData.urls as string[]
          })()

      const publishRes = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls, caption, carouselId }),
      })
      const publishData = await publishRes.json()
      if (publishData.error) throw new Error(publishData.error)
      setPublishedUrl(publishData.url)
    } catch (err: any) {
      alert(`Erro ao publicar: ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  async function handleSchedule() {
    if (!carouselId || !scheduledAt) return
    setScheduling(true)
    try {
      await fetch(`/api/carousels/${carouselId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: new Date(scheduledAt).toISOString() }),
      })
      setShowScheduler(false)
    } finally {
      setScheduling(false)
    }
  }

  async function handleCancelSchedule() {
    if (!carouselId) return
    setScheduling(true)
    try {
      await fetch(`/api/carousels/${carouselId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: null }),
      })
      setScheduledAt('')
      setShowScheduler(false)
    } catch (e) {
      console.error('Falha ao cancelar agendamento:', e)
    } finally {
      setScheduling(false)
    }
  }

  const readySlidesCount = slides.filter(s => imageProgress[s.num] === 'done').length
  const imagesReady = slides.length > 0 && readySlidesCount === slides.length

  // ── Tela de edição ───────────────────────────────────────────────────────
  if (stage === 'editing') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-zinc-800/70 bg-zinc-900/30 flex-shrink-0">
          <button
            onClick={() => setStage('discovery')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-zinc-800 flex-shrink-0" />
          <h1 className="text-sm font-medium text-zinc-400 flex-1 truncate min-w-0">{selectedTopic}</h1>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!publishedUrl && (
              <span className="hidden xl:inline text-[11px] text-zinc-500 whitespace-nowrap">
                {imagesReady
                  ? 'Aprovacao opcional'
                  : `${readySlidesCount}/${slides.length} slides prontos`}
              </span>
            )}

            {/* Agendador */}
            {!publishedUrl && (
              <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowScheduler(v => !v)}
                disabled={!carouselId}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border',
                  !carouselId
                    ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : '',
                  scheduledAt
                    ? 'border-violet-600/50 text-violet-300 bg-violet-900/20 hover:bg-violet-900/35'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                )}
                title={carouselId ? 'Agendar publicacao' : 'Salvando carrossel para habilitar agendamento'}
              >
                <Calendar className="w-3.5 h-3.5" />
                {scheduledAt
                  ? new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Agendar'
                }
              </button>
              {showScheduler && carouselId && (
                <div className="absolute right-0 top-10 z-50 bg-zinc-900 border border-zinc-700/80 rounded-xl p-4 shadow-2xl flex flex-col gap-3 min-w-[230px]">
                  <p className="text-xs text-zinc-400 font-medium">Publicar automaticamente em:</p>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5" onClick={handleSchedule} disabled={!scheduledAt || scheduling}>
                      {scheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {scheduledAt ? 'Reagendar' : 'Agendar'}
                    </Button>
                    {scheduledAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-700 text-zinc-300 hover:text-zinc-100 gap-1.5"
                        onClick={handleCancelSchedule}
                        disabled={scheduling}
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              )}
              </div>
            )}

            {publishedUrl ? (
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white gap-1.5 h-8">
                  <Check className="w-3.5 h-3.5" /> Ver no Instagram
                </Button>
              </a>
            ) : (
              <Button
                size="sm"
                className={cn(
                  'gap-1.5 text-white h-8 flex-shrink-0',
                  imagesReady ? 'bg-violet-600 hover:bg-violet-500' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                )}
                onClick={handlePublish}
                disabled={!imagesReady || publishing}
              >
                {publishing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Publicando...</>
                  : <><Send className="w-3.5 h-3.5" /> Publicar</>
                }
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <CarouselPreview
            slides={slides}
            caption={caption}
            expert={expert}
            topic={selectedTopic}
            onSlidesChange={setSlides}
            onCaptionChange={setCaption}
            onGenerateImages={handleGenerateImages}
            generatingImages={generatingImages}
            imageProgress={imageProgress}
            onRegenerateSlide={handleRegenerateSlide}
          />
        </div>
      </div>
    )
  }

  // ── Ângulos X vs Y ────────────────────────────────────────────────────────
  if (stage === 'angles') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <button
            onClick={() => setStage('discovery')}
            className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Escolha o ângulo</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Tema: <span className="text-zinc-300">{pendingAngleTopic?.topic.title}</span>
            </p>
          </div>
        </div>

        {loadingAngles ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            <span className="text-sm text-zinc-400">Analisando desdobramentos do tema...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => pendingAngleTopic && handleGenerate(pendingAngleTopic.topic, pendingAngleTopic.hook)}
              className="w-full text-left rounded-xl border border-violet-600/50 bg-violet-950/30 p-4 hover:border-violet-500 hover:bg-violet-950/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-600/30 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-violet-600/50 transition-colors">
                  <Sparkles className="w-3 h-3 text-violet-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-violet-100 leading-snug">Usar o tema original</p>
                  <p className="text-xs text-violet-400 mt-0.5">Gerar sem adaptar o ângulo</p>
                </div>
                <ChevronRight className="w-4 h-4 text-violet-600 flex-shrink-0 mt-1 group-hover:text-violet-300 transition-colors" />
              </div>
            </button>

            {angleOptions.map((angle, i) => (
              <button
                key={i}
                onClick={() => handleSelectAngle(angle)}
                className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-violet-600/50 hover:bg-zinc-800/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-violet-600/40 transition-colors">
                    <span className="text-violet-400 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 leading-snug">{angle.title}</p>
                    <p className="text-xs text-violet-300 mt-0.5">{angle.subtitle}</p>
                    <p className="text-xs text-zinc-500 mt-1">{angle.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-1 group-hover:text-violet-400 transition-colors" />
                </div>
              </button>
            ))}

            {angleOptions.length === 0 && !loadingAngles && (
              <p className="text-sm text-zinc-500 text-center py-4">Nenhum ângulo gerado. Escreva o seu abaixo.</p>
            )}

            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2">Ou escreva seu próprio contraste:</p>
              <div className="flex gap-2">
                <input
                  value={customAngle}
                  onChange={e => setCustomAngle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSelectCustomAngle()}
                  placeholder="ex: FREELA VS. CLT"
                  className="flex-1 h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                />
                <Button
                  className="bg-violet-600 hover:bg-violet-500 text-white"
                  disabled={!customAngle.trim()}
                  onClick={handleSelectCustomAngle}
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Gerar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Gerando ──────────────────────────────────────────────────────────────
  if (stage === 'generating') {
    const clampedSlides = Math.min(slidesGenerated, 10)
    const isGeneratingImages = generatingImages && slides.length > 0
    const imagesReadyCount = Object.values(imageProgress).filter(v => v === 'done').length
    const totalImages = slides.length
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-100">
              {isGeneratingImages ? 'Gerando imagens...' : 'Gerando carrossel...'}
            </p>
            {isGeneratingImages ? (
              <>
                <p className="text-xs text-zinc-400">
                  <span className="text-violet-400 font-semibold">{imagesReadyCount}</span> de {totalImages} imagens prontas
                </p>
                <div className="w-48 h-1 bg-zinc-800 rounded-full mx-auto overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${totalImages > 0 ? (imagesReadyCount / totalImages) * 100 : 0}%` }}
                  />
                </div>
              </>
            ) : clampedSlides > 0 ? (
              <>
                <p className="text-xs text-zinc-400">
                  Slide <span className="text-violet-400 font-semibold">{clampedSlides}</span> de 10
                </p>
                <div className="w-48 h-1 bg-zinc-800 rounded-full mx-auto overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${(clampedSlides / 10) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Criando 10 slides no seu estilo</p>
            )}
            {retryMessage && (
              <p className="text-xs text-amber-400 mt-1">{retryMessage}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'template') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-zinc-100">Escolha o template</h1>
          <p className="text-sm text-zinc-500">Selecione o formato primeiro. Depois eu mostro a busca e os controles de geração desse template.</p>
        </div>

        {workspaceLimits && (
          <div className={`rounded-xl border px-4 py-3 ${
            workspaceLimits.canGenerate
              ? workspaceLimits.usagePercent >= 80
                ? 'border-amber-700/40 bg-amber-950/20'
                : 'border-zinc-800 bg-zinc-900/30'
              : 'border-red-700/40 bg-red-950/20'
          }`}>
            <p className={`text-xs font-medium ${
              workspaceLimits.canGenerate
                ? workspaceLimits.usagePercent >= 80 ? 'text-amber-300' : 'text-zinc-300'
                : 'text-red-300'
            }`}>
              Créditos do mês: {formatCreditValue(workspaceLimits.usedCredits)}/{formatCreditValue(workspaceLimits.monthlyPostCredits)} ({workspaceLimits.usagePercent}%)
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Plano {workspaceLimits.planLabel}. Restantes: {workspaceLimits.remainingCredits}.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.filter(t => t.available).map((t) => {
            const icon = t.layout === 'split' ? '⚡' : '📚'
            const hint = getTemplateHint(t.id)
            return (
              <button
                key={t.id}
                onClick={() => handleTemplateSelect(t.id, t.name)}
                className="text-left rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{icon}</span>
                      <span className="text-sm font-semibold text-zinc-100">{t.name}</span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{t.description}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 whitespace-nowrap">{t.slideCount} slides</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {t.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-1 rounded-md bg-zinc-800 text-[10px] text-zinc-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-[11px] text-violet-400 font-medium">{hint}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Discovery ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <button
          onClick={() => setStage('template')}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Trocar template
        </button>
        <h1 className="text-xl font-semibold text-zinc-100">{activeTemplateName}</h1>
        <p className="text-sm text-zinc-500 mt-1">Escolha um tema viral ou escreva o seu próprio para este template.</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5">
          <span className="text-xs font-medium text-violet-300">{activeTemplateName}</span>
          <span className="text-[11px] text-violet-400">{getTemplateHint(activeTemplateId)}</span>
        </div>
      </div>

      {/* Banner: erro da última geração */}
      {generateError && (
        <div className="flex items-start gap-3 bg-red-950/30 border border-red-700/40 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-red-200 font-medium mb-0.5">Erro ao gerar carrossel</p>
            <p className="text-xs text-red-400/80">{generateError}</p>
          </div>
          <button
            onClick={() => setGenerateError('')}
            className="text-red-600 hover:text-red-400 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {workspaceLimits && (
        <div className={`rounded-xl border px-4 py-3 ${
          workspaceLimits.canGenerate
            ? workspaceLimits.usagePercent >= 80
              ? 'border-amber-700/40 bg-amber-950/20'
              : 'border-zinc-800 bg-zinc-900/30'
            : 'border-red-700/40 bg-red-950/20'
        }`}>
          <p className={`text-xs font-medium ${
            workspaceLimits.canGenerate
              ? workspaceLimits.usagePercent >= 80 ? 'text-amber-300' : 'text-zinc-300'
              : 'text-red-300'
          }`}>
            Créditos do mês: {formatCreditValue(workspaceLimits.usedCredits)}/{formatCreditValue(workspaceLimits.monthlyPostCredits)} ({workspaceLimits.usagePercent}%)
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Plano {workspaceLimits.planLabel}. Restantes: {workspaceLimits.remainingCredits}.
          </p>
          {workspaceLimits.budgetLimitUsd > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Orçamento: {usd(workspaceLimits.usedBudgetUsd)}/{usd(workspaceLimits.budgetLimitUsd)} ({workspaceLimits.budgetUsagePercent}%).
            </p>
          )}
          {workspaceLimits.recommendation && (
            <p className="text-xs text-amber-300 mt-0.5">
              Recomendação: upgrade para {workspaceLimits.recommendation.recommendedPlanLabel}. {workspaceLimits.recommendation.reason}
            </p>
          )}
        </div>
      )}

      {/* Opções de geração */}
      <div className="flex items-center gap-4 flex-wrap">
        {activeTemplateId === 'positivo-negativo' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Formato:</span>
            <div className="flex rounded-lg bg-zinc-800 p-0.5 gap-0.5">
              {(['text', 'question'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setContentStyle(opt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    contentStyle === opt ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  {opt === 'text' ? 'Texto' : 'Pergunta'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Texto:</span>
            <div className="flex rounded-lg bg-zinc-800 p-0.5 gap-0.5">
              {(['short', 'medium', 'long'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setTextLength(opt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    textLength === opt ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  {opt === 'short' ? 'Curto' : opt === 'medium' ? 'Médio' : 'Longo'}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeTemplateId === 'frank-costa-10' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Slides 5 e 10:</span>
            <div className="flex rounded-lg bg-zinc-800 p-0.5 gap-0.5">
              <button
                onClick={() => setUseFixedSlides(true)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  useFixedSlides ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                Template fixo
              </button>
              <button
                onClick={() => setUseFixedSlides(false)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  !useFixedSlides ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                Gerar com IA
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Provider:</span>
          <select
            value={selectedProviderId}
            onChange={(e) => {
              const nextProvider = e.target.value as ProviderId
              setSelectedProviderId(nextProvider)
              const firstModel = availableModels.find((m) => m.providerId === nextProvider)
              if (firstModel) setSelectedModel(firstModel.model)
            }}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Modelo:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            {availableModels
              .filter((m) => m.providerId === selectedProviderId)
              .map((modelOption) => (
                <option key={`${modelOption.providerId}:${modelOption.model}`} value={modelOption.model}>
                  {modelOption.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Input livre + voz */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerateFromCustom()}
            placeholder="Digite ou fale um tema..."
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'border-zinc-700',
            voiceActive ? 'bg-red-500/20 border-red-500 text-red-400' : 'text-zinc-400 hover:bg-zinc-800'
          )}
          onClick={handleVoice}
        >
          <Mic className="w-4 h-4" />
        </Button>
        <Button
          className="bg-violet-600 hover:bg-violet-500 text-white"
          onClick={handleGenerateFromCustom}
          disabled={!customTopic.trim() || generating || (workspaceLimits ? !workspaceLimits.canGenerate : false)}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Gerar
        </Button>
      </div>

      {/* Topic Discovery */}
      <TopicDiscovery
        niche={niche}
        templateId={activeTemplateId}
        onSelect={activeTemplateId === 'positivo-negativo' ? handleDiscoverAngles : handleGenerate}
      />
    </div>
  )
}
