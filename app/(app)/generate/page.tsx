'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Topic } from '@/components/generate/topic-card'
import { CarouselPreview, type Slide, type ExpertInfo } from '@/components/generate/carousel-preview'
import { Sparkles, Mic, Loader2, ArrowLeft, Send, AlertCircle, Key, Calendar, Check } from 'lucide-react'
import { TopicDiscovery } from '@/components/generate/topic-discovery'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Stage = 'discovery' | 'generating' | 'editing'

const DEFAULT_EXPERT: ExpertInfo = {
  displayName: 'Expert',
  handle: '@expert',
  highlightColor: '#9B59FF',
}

export default function GeneratePage() {
  const supabase = createClient()
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
  const [scheduledAt, setScheduledAt]     = useState('')
  const [showScheduler, setShowScheduler] = useState(false)
  const [savedTopicRef, setSavedTopicRef] = useState<string | null>(null)
  const autoSaveTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carrega expert + verifica tokens essenciais
  useEffect(() => {
    async function loadExpertAndTokens() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Carrega expert
      const { data: exp } = await supabase
        .from('experts')
        .select('display_name, handle, highlight_color, niche, id')
        .eq('user_id', user.id)
        .single()

      if (exp) {
        setNiche(exp.niche || 'seu nicho')

        let avatarUrl: string | undefined
        try {
          const { data: expFull } = await supabase
            .from('experts')
            .select('avatar_url')
            .eq('user_id', user.id)
            .single()
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
        await fetch(`/api/carousels/${carouselId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption, slides }),
        })
      } catch (e) {
        console.error('Auto-save falhou:', e)
      }
    }, 1500)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [slides, caption, carouselId])

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
        body: JSON.stringify({ topic: topic.title, hook }),
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

  // ── Gera imagem + card de UM slide ──────────────────────────────────────
  async function generateOneSlide(slide: Slide): Promise<void> {
    if (!slide.imagePrompt) return

    setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))

    try {
      const imageRes = await fetch('/api/generate/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideNum: slide.num, imagePrompt: slide.imagePrompt }),
      })
      const imageData = await imageRes.json()
      if (imageData.error) throw new Error(imageData.error)

      const imageBase64 = imageData.dataUrl.replace(/^data:[^;]+;base64,/, '')
      const cardRes = await fetch('/api/render/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:               slide.text,
          imageBase64,
          format:             'portrait',
          showHeader:         true,
          imageHeightPercent: slide.imageHeightPercent ?? 0,
          imagePosition:      slide.imagePosition ?? 'bottom',
        }),
      })
      const cardData = await cardRes.json()
      if (cardData.error) throw new Error(cardData.error)

      setSlides(prev => prev.map(s =>
        s.num === slide.num
          ? { ...s, imagePath: imageData.dataUrl, cardPath: `data:image/png;base64,${cardData.cardBase64}` }
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
    try {
      await fetch(`/api/carousels/${carouselId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: new Date(scheduledAt).toISOString() }),
      })
      setShowScheduler(false)
    } catch (e) {
      console.error('Falha ao agendar:', e)
    }
  }

  const imagesReady = slides.length > 0 && slides.every(s => imageProgress[s.num] === 'done')

  // ── Tela de edição ───────────────────────────────────────────────────────
  if (stage === 'editing') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 flex-shrink-0">
          <Button
            variant="ghost" size="sm"
            className="text-zinc-400 hover:text-zinc-200"
            onClick={() => setStage('discovery')}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
          </Button>
          <h1 className="text-sm font-medium text-zinc-300 flex-1 truncate">{selectedTopic}</h1>

          {/* Agendador */}
          {carouselId && !publishedUrl && (
            <div className="relative">
              <Button
                size="sm" variant="outline"
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 gap-1.5"
                onClick={() => setShowScheduler(v => !v)}
              >
                <Calendar className="w-3.5 h-3.5" />
                {scheduledAt ? new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Agendar'}
              </Button>
              {showScheduler && (
                <div className="absolute right-0 top-9 z-50 bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl flex flex-col gap-2 min-w-[220px]">
                  <p className="text-xs text-zinc-400 font-medium">Publicar automaticamente em:</p>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                  />
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white gap-1" onClick={handleSchedule} disabled={!scheduledAt}>
                    <Check className="w-3 h-3" /> Confirmar
                  </Button>
                </div>
              )}
            </div>
          )}

          {publishedUrl ? (
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white gap-1.5">
                ✓ Ver no Instagram
              </Button>
            </a>
          ) : (
            <Button
              size="sm"
              className={cn(
                'gap-1.5 text-white',
                imagesReady ? 'bg-violet-600 hover:bg-violet-500' : 'bg-zinc-700 opacity-50 cursor-not-allowed'
              )}
              onClick={handlePublish}
              disabled={!imagesReady || publishing}
            >
              {publishing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Publicando...</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Publicar no Instagram</>
              )}
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <CarouselPreview
            slides={slides}
            caption={caption}
            expert={expert}
            onSlidesChange={setSlides}
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
