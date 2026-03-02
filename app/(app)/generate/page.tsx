'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Topic } from '@/components/generate/topic-card'
import { CarouselPreview, type Slide, type ExpertInfo } from '@/components/generate/carousel-preview'
import { Sparkles, Mic, Loader2, ArrowLeft, Send } from 'lucide-react'
import { TopicDiscovery } from '@/components/generate/topic-discovery'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

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
  const [publishing, setPublishing]       = useState(false)
  const [publishedUrl, setPublishedUrl]   = useState('')
  const [expert, setExpert]               = useState<ExpertInfo>(DEFAULT_EXPERT)
  const [niche, setNiche]                 = useState('seu nicho')
  const [imageHeightPercent, setImageHeightPercent] = useState(45)

  // Carrega expert do Supabase (nome, handle, highlight, avatar, nicho)
  useEffect(() => {
    async function loadExpert() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: exp } = await supabase
        .from('experts')
        .select('display_name, handle, highlight_color, niche, id')
        .eq('user_id', user.id)
        .single()

      if (!exp) return

      setNiche(exp.niche || 'seu nicho')

      // avatar_url: query separada com fallback (coluna pode não existir ainda na DB)
      let avatarUrl: string | undefined
      try {
        const { data: expFull } = await supabase
          .from('experts')
          .select('avatar_url')
          .eq('user_id', user.id)
          .single()
        avatarUrl = (expFull as any)?.avatar_url || undefined
      } catch { /* coluna ainda não existe — ignorar */ }

      // Fallback: primeira foto do bucket de referências
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
    loadExpert()
  }, [])

  // ── Geração de conteúdo ──────────────────────────────────────────────────
  async function handleGenerate(topic: Topic, hook: string) {
    setSelectedTopic(topic.title)
    setGenerating(true)
    setStage('generating')
    setImageProgress({})
    setCaption('')
    setPublishedUrl('')

    try {
      const res = await fetch('/api/generate/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.title, hook }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSlides(data.slides.map((s: Slide) => ({ ...s, approved: false })))
      setCaption(data.caption || '')
      setStage('editing')
    } catch (err) {
      console.error(err)
      setStage('discovery')
    } finally {
      setGenerating(false)
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
      // Passo 1: Gera imagem via Gemini
      const imageRes = await fetch('/api/generate/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideNum: slide.num, imagePrompt: slide.imagePrompt }),
      })
      const imageData = await imageRes.json()
      if (imageData.error) throw new Error(imageData.error)

      // Passo 2: Renderiza card completo via Playwright
      const imageBase64 = imageData.dataUrl.replace(/^data:[^;]+;base64,/, '')
      const cardRes = await fetch('/api/render/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:               slide.text,
          imageBase64,
          format:             'portrait',
          showHeader:         true,
          imageHeightPercent,
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

  // ── Gera imagens para todos os slides (sequencial) ───────────────────────
  async function handleGenerateImages() {
    setGeneratingImages(true)
    for (const slide of slides) {
      await generateOneSlide(slide)
    }
    setGeneratingImages(false)
  }

  // ── Regenera a imagem de um slide específico ─────────────────────────────
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

  const imagesReady = slides.length > 0 && slides.every(s => imageProgress[s.num] === 'done')

  // ── Tela de edição ───────────────────────────────────────────────────────
  if (stage === 'editing') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 flex-shrink-0">
          <Button
            variant="ghost" size="sm"
            className="text-zinc-400 hover:text-zinc-200"
            onClick={() => setStage('discovery')}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
          </Button>
          <h1 className="text-sm font-medium text-zinc-300 flex-1 truncate">{selectedTopic}</h1>

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

        {/* Editor — ocupa o restante da tela com scroll interno */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <CarouselPreview
            slides={slides}
            caption={caption}
            expert={expert}
            onSlidesChange={setSlides}
            onGenerateImages={handleGenerateImages}
            generatingImages={generatingImages}
            imageProgress={imageProgress}
            imageHeightPercent={imageHeightPercent}
            onImageHeightPercentChange={setImageHeightPercent}
            onRegenerateSlide={handleRegenerateSlide}
          />
        </div>
      </div>
    )
  }

  // ── Tela de geração em andamento ──────────────────────────────────────────
  if (stage === 'generating') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100">Gerando carrossel com Claude...</p>
            <p className="text-xs text-zinc-500 mt-1">Criando 10 slides no seu estilo</p>
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

      {/* Discovery — trending / busca / explorar com EXA */}
      <TopicDiscovery niche={niche} onSelect={handleGenerate} />
    </div>
  )
}
