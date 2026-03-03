'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CarouselPreview, type Slide, type ExpertInfo } from '@/components/generate/carousel-preview'
import {
  ArrowLeft, Send, Loader2, ExternalLink,
  ImageIcon, Calendar, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_EXPERT: ExpertInfo = {
  displayName: 'Expert',
  handle: '@expert',
  highlightColor: '#9B59FF',
}

export default function CarouselDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const supabase = createClient()

  const [carousel, setCarousel]           = useState<any>(null)
  const [slides, setSlides]               = useState<Slide[]>([])
  const [caption, setCaption]             = useState('')
  const [expert, setExpert]               = useState<ExpertInfo>(DEFAULT_EXPERT)
  const [loading, setLoading]             = useState(true)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState<Record<number, 'loading' | 'done' | 'error'>>({})
  const [publishing, setPublishing]       = useState(false)
  const [scheduledAt, setScheduledAt]     = useState('')
  const [showScheduler, setShowScheduler] = useState(false)
  const autoSaveTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carrega dados do carousel + expert
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/carousels/${id}`)
        const data = await res.json()
        if (data.error) { router.push('/dashboard'); return }

        setCarousel(data)
        setSlides((data.slides || []).map((s: Slide) => ({
          ...s,
          imagePosition: s.imagePosition ?? 'bottom',
          imageObjectX:  s.imageObjectX  ?? 50,
          imageObjectY:  s.imageObjectY  ?? 50,
        })))
        setCaption(data.caption || '')
        if (data.scheduled_at) {
          // converte ISO para formato datetime-local
          const d = new Date(data.scheduled_at)
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16)
          setScheduledAt(local)
        }
      } catch (e) {
        console.error('Erro ao carregar carousel:', e)
      }

      // Carrega expert
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: exp } = await supabase
          .from('experts')
          .select('display_name, handle, highlight_color, id')
          .eq('user_id', user.id)
          .single()

        if (exp) {
          let avatarUrl: string | undefined

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

          setExpert({
            displayName:    exp.display_name || DEFAULT_EXPERT.displayName,
            handle:         exp.handle       || DEFAULT_EXPERT.handle,
            highlightColor: exp.highlight_color || DEFAULT_EXPERT.highlightColor,
            avatarUrl,
          })
        }
      }

      setLoading(false)
    }
    load()
  }, [id])

  // Auto-save com debounce de 1.5s (somente rascunhos)
  useEffect(() => {
    if (!carousel || carousel.ig_post_id || loading) return

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/carousels/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption, slides }),
        })
      } catch (e) {
        console.error('Auto-save falhou:', e)
      }
    }, 1500)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [slides, caption, carousel, loading])

  // ── Geração de imagem para um slide ───────────────────────────────────────
  async function generateOneSlide(slide: Slide) {
    if (!slide.imagePrompt) return
    setImageProgress(prev => ({ ...prev, [slide.num]: 'loading' }))
    try {
      const imgRes  = await fetch('/api/generate/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideNum: slide.num, imagePrompt: slide.imagePrompt }),
      })
      const imgData = await imgRes.json()
      if (imgData.error) throw new Error(imgData.error)

      const imageBase64 = imgData.dataUrl.replace(/^data:[^;]+;base64,/, '')
      const cardRes  = await fetch('/api/render/card', {
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
          ? { ...s, imagePath: imgData.dataUrl, cardPath: `data:image/png;base64,${cardData.cardBase64}` }
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
    await Promise.all(slides.map(s => generateOneSlide(s)))
    setGeneratingImages(false)
  }

  async function handleRegenerateSlide(slideNum: number) {
    const slide = slides.find(s => s.num === slideNum)
    if (!slide) return
    await generateOneSlide(slide)
  }

  // ── Publicação ───────────────────────────────────────────────────────────
  async function handlePublish() {
    const toPublish = slides.filter(s => s.cardPath || s.imagePath)
    if (!toPublish.length) { alert('Gere as imagens antes de publicar.'); return }
    if (!caption) { alert('Legenda não encontrada.'); return }

    setPublishing(true)
    try {
      const sessionId = `carousel-${id}`
      const saveRes  = await fetch('/api/save-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: toPublish.map(s => ({ num: s.num, dataUrl: s.cardPath || s.imagePath })),
          sessionId,
        }),
      })
      const saveData = await saveRes.json()
      if (saveData.error) throw new Error(saveData.error)

      const pubRes  = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: saveData.urls, caption, carouselId: id }),
      })
      const pubData = await pubRes.json()
      if (pubData.error) throw new Error(pubData.error)

      setCarousel((prev: any) => ({ ...prev, ig_post_id: pubData.ig_post_id || 'published' }))
    } catch (err: any) {
      alert(`Erro ao publicar: ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  async function handleSchedule() {
    if (!scheduledAt) return
    try {
      await fetch(`/api/carousels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: new Date(scheduledAt).toISOString() }),
      })
      setShowScheduler(false)
      setCarousel((prev: any) => ({ ...prev, scheduled_at: new Date(scheduledAt).toISOString() }))
    } catch (e) {
      console.error('Falha ao agendar:', e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    )
  }

  if (!carousel) return null

  const isPublished  = !!carousel.ig_post_id
  const imagesReady  = slides.length > 0 && slides.every(s => imageProgress[s.num] === 'done')

  // ── View-only: carrossel publicado ───────────────────────────────────────
  if (isPublished) {
    return (
      <div className="p-8 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard
          </Button>
          <h1 className="text-sm font-medium text-zinc-300 flex-1 truncate">{carousel.topic}</h1>
          {carousel.ig_post_id && carousel.ig_post_id !== 'published' && (
            <a href={`https://www.instagram.com/p/${carousel.ig_post_id}/`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Ver no Instagram
              </Button>
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {slides.map((s, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-zinc-800 aspect-[4/5] bg-zinc-900">
              {(s.cardPath || s.imagePath) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.cardPath || s.imagePath} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Slide {i + 1}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Editor completo: rascunho ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 flex-shrink-0">
        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard
        </Button>
        <h1 className="text-sm font-medium text-zinc-300 flex-1 truncate">{carousel.topic}</h1>

        {/* Agendador */}
        <div className="relative">
          <Button
            size="sm" variant="outline"
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 gap-1.5"
            onClick={() => setShowScheduler(v => !v)}
          >
            <Calendar className="w-3.5 h-3.5" />
            {scheduledAt
              ? new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'Agendar'
            }
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

        <Button
          size="sm"
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 gap-1.5"
          variant="outline"
          onClick={handleGenerateImages}
          disabled={generatingImages}
        >
          {generatingImages
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
            : <><ImageIcon className="w-3.5 h-3.5" /> Gerar imagens</>
          }
        </Button>

        <Button
          size="sm"
          className={cn(
            'gap-1.5 text-white',
            imagesReady ? 'bg-violet-600 hover:bg-violet-500' : 'bg-zinc-700 opacity-50 cursor-not-allowed',
          )}
          onClick={handlePublish}
          disabled={!imagesReady || publishing}
        >
          {publishing
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Publicando...</>
            : <><Send className="w-3.5 h-3.5" /> Publicar no Instagram</>
          }
        </Button>
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
