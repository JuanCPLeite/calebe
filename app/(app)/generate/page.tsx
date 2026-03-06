'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Topic } from '@/components/generate/topic-card'
import { CarouselPreview, type Slide, type ExpertInfo } from '@/components/generate/carousel-preview'
import { Sparkles, Mic, Loader2, ArrowLeft, Send, AlertCircle, Key, Calendar, Check, X } from 'lucide-react'
import { TopicDiscovery } from '@/components/generate/topic-discovery'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { TEMPLATES, TEMPLATE_PRESETS } from '@/lib/templates'

type Stage = 'discovery' | 'generating' | 'editing'

const DEFAULT_EXPERT: ExpertInfo = {
  displayName: 'Expert',
  handle: '@expert',
  highlightColor: '#9B59FF',
}

export default function GeneratePage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [stage, setStage]                 = useState<Stage>('discovery')
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
  const [missingTokens, setMissingTokens] = useState<string[]>([])
  const [carouselId, setCarouselId]       = useState<string | null>(null)
  const [userId, setUserId]               = useState<string | null>(null)
  const [textLength, setTextLength]       = useState<'short' | 'medium' | 'long'>('medium')
  const [useFixedSlides, setUseFixedSlides] = useState(true)
  const [activeTemplateName, setActiveTemplateName] = useState<string>('')
  const [activeTemplateId, setActiveTemplateId]     = useState<string>('')
  const [scheduledAt, setScheduledAt]     = useState('')
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduling, setScheduling]       = useState(false)
  const [savedTopicRef, setSavedTopicRef] = useState<string | null>(null)
  const autoSaveTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef                      = useRef<string>(`temp-${Date.now()}`)
  const reRenderTimers                    = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const lastRenderedSettings              = useRef<Record<number, { x: number; y: number; h: number; pos: string }>>({})

  // Mantém sessionId sincronizado com o carouselId real assim que disponível
  useEffect(() => {
    if (carouselId) sessionIdRef.current = carouselId
  }, [carouselId])

  // Carrega expert + verifica tokens essenciais
  useEffect(() => {
    async function loadExpertAndTokens() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Carrega expert
      const { data: exp } = await supabase
        .from('experts')
        .select('display_name, handle, highlight_color, niche, id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (exp) {
        setNiche(exp.niche || 'seu nicho')

        let avatarUrl: string | undefined
        try {
          const { data: expFull } = await supabase
            .from('experts')
            .select('avatar_url')
            .eq('user_id', user.id)
            .maybeSingle()
          avatarUrl = (expFull as any)?.avatar_url || undefined
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
          displayName:    exp.display_name || DEFAULT_EXPERT.displayName,
          handle:         exp.handle       || DEFAULT_EXPERT.handle,
          highlightColor: exp.highlight_color || DEFAULT_EXPERT.highlightColor,
          avatarUrl,
        })
      }

      // Verifica tokens essenciais
      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('provider')
        .eq('user_id', user.id)
        .in('provider', ['anthropic', 'google'])

      const configured = new Set((tokens || []).map((t: { provider: string }) => t.provider))
      const missing: string[] = []
      if (!configured.has('anthropic')) missing.push('Anthropic (Claude)')
      if (!configured.has('google'))    missing.push('Google Gemini')
      setMissingTokens(missing)
    }

    loadExpertAndTokens()
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
  }, [searchParams])

  // ── Cria registro no banco ao entrar em editing ───────────────────────────
  useEffect(() => {
    if (stage !== 'editing' || !slides.length || savedTopicRef === selectedTopic) return

    async function createCarousel() {
      try {
        const res = await fetch('/api/carousels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: selectedTopic, caption, slides }),
        })
        const data = await res.json()
        if (data.id) {
          setCarouselId(data.id)
          setSavedTopicRef(selectedTopic)
        }
      } catch (e) {
        console.error('Falha ao criar carousel:', e)
      }
    }
    createCarousel()
  }, [stage, selectedTopic])

  // ── Auto-save com debounce de 1.5s ────────────────────────────────────────
  useEffect(() => {
    if (!carouselId || stage !== 'editing') return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        // Remove campos grandes (base64) — só persiste paths e URLs pequenas
        const slidesForSave = slides.map(({ imagePath, cardPath, ...rest }) => ({
          ...rest,
          ...(cardPath && !cardPath.startsWith('data:') ? { cardPath } : {}),
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

  // ── Geração de conteúdo ──────────────────────────────────────────────────
  async function handleGenerate(topic: Topic, hook: string) {
    setSelectedTopic(topic.title)
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

    try {
      const res = await fetch('/api/generate/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.title, hook, textLength, useFixedSlides, templateId: activeTemplateId }),
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
            setSlides((event.slides as Slide[]).map(s => ({
              ...s,
              approved: false,
              imagePosition: 'bottom' as const,
              imageObjectX: 50,
              imageObjectY: 50,
            })))
            setCaption(event.caption || '')
            setStage('editing')
            break outer
          }
        }
      }
    } catch (err: any) {
      console.error(err)
      setGenerateError(err.message || 'Erro ao gerar carrossel.')
      setStage('discovery')
    } finally {
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
    await handleGenerate(mockTopic, customTopic)
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

  // ── Gera imagem + card de UM slide ──────────────────────────────────────
  async function generateOneSlide(slide: Slide): Promise<void> {
    const imagePrompt = slide.imagePrompt || FALLBACK_IMAGE_PROMPTS[slide.type]
    if (!imagePrompt) return

    setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))

    try {
      let imageData: any = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const imageRes = await fetch('/api/generate/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slideNum: slide.num, imagePrompt }),
          })
          const data = await imageRes.json()
          if (data.error) throw new Error(data.error)
          imageData = data
          break
        } catch (err) {
          if (attempt === 3) throw err
        }
      }

      const imageBase64 = imageData.dataUrl.replace(/^data:[^;]+;base64,/, '')

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
          ? { ...s, imagePath: imageData.dataUrl, bgImageStoragePath: bgImageStoragePath ?? undefined, cardPath, cardStoragePath: stored?.path }
          : s
      ))
      setImageProgress(prev => ({ ...prev, [slide.num]: 'done' }))
    } catch (err) {
      console.error(`Erro slide ${slide.num}:`, err)
      setImageProgress(prev => ({ ...prev, [slide.num]: 'error' }))
    }
  }

  async function handleGenerateImages() {
    setGeneratingImages(true)
    await Promise.all(slides.map(slide => generateOneSlide(slide)))
    setGeneratingImages(false)
    // Salva imediatamente após gerar todas as imagens, sem esperar o debounce de 1.5s,
    // para garantir que bgImageStoragePath seja persistido antes do usuário navegar.
    if (carouselId) {
      try {
        // Lê o estado mais recente via callback funcional
        setSlides(current => {
          const slidesForSave = current.map(({ imagePath, cardPath, ...rest }) => ({
            ...rest,
            ...(cardPath && !cardPath.startsWith('data:') ? { cardPath } : {}),
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

      const publishRes = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: saveData.urls, caption }),
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

  const imagesReady = slides.length > 0 && slides.every(s => imageProgress[s.num] === 'done')

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

          {/* Agendador */}
          {carouselId && !publishedUrl && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowScheduler(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border',
                  scheduledAt
                    ? 'border-violet-600/50 text-violet-300 bg-violet-900/20 hover:bg-violet-900/35'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                {scheduledAt
                  ? new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Agendar'
                }
              </button>
              {showScheduler && (
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

        <div className="flex-1 min-h-0 overflow-hidden">
          <CarouselPreview
            slides={slides}
            caption={caption}
            expert={expert}
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

  // ── Gerando ──────────────────────────────────────────────────────────────
  if (stage === 'generating') {
    const clampedSlides = Math.min(slidesGenerated, 10)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-100">Gerando carrossel com Claude...</p>
            {clampedSlides > 0 ? (
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

  // ── Discovery ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Gerar Carrossel</h1>
        <p className="text-sm text-zinc-500 mt-1">Escolha um tema viral ou escreva o seu próprio</p>
      </div>

      {activeTemplateName && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
          <p className="text-xs text-violet-200">
            Template ativo: <span className="font-medium">{activeTemplateName}</span>
          </p>
        </div>
      )}

      {/* Banner: tokens faltando */}
      {missingTokens.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3">
          <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-amber-200 font-medium mb-0.5">
              Configure suas chaves de API para gerar carrosséis
            </p>
            <p className="text-xs text-amber-400/80">
              Faltando: <strong>{missingTokens.join(', ')}</strong>.{' '}
              <Link href="/tokens" className="underline underline-offset-2 hover:text-amber-200">
                Configurar em Tokens & APIs →
              </Link>
            </p>
          </div>
        </div>
      )}

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

      {/* Opções de geração */}
      <div className="flex items-center gap-4 flex-wrap">
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
          disabled={!customTopic.trim() || generating}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Gerar
        </Button>
      </div>

      {/* Topic Discovery */}
      <TopicDiscovery niche={niche} onSelect={handleGenerate} />
    </div>
  )
}
