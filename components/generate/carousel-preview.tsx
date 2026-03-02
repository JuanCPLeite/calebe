'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bold, Italic, RotateCcw, Check, ImageIcon, Loader2,
  ChevronLeft, ChevronRight, AlertCircle, Highlighter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FrankCard } from './frank-card'

export interface Slide {
  num: number
  type: string
  text: string
  imagePrompt?: string
  imagePath?: string
  /** PNG renderizado via Playwright — o que vai para o Instagram */
  cardPath?: string
  approved?: boolean
}

export interface ExpertInfo {
  displayName: string
  handle: string
  highlightColor: string
  avatarUrl?: string
}

interface CarouselPreviewProps {
  slides: Slide[]
  caption: string
  expert: ExpertInfo
  onSlidesChange: (slides: Slide[]) => void
  onGenerateImages: () => void
  generatingImages: boolean
  imageProgress: Record<number, 'loading' | 'done' | 'error'>
  imageHeightPercent: number
  onImageHeightPercentChange: (v: number) => void
  onRegenerateSlide?: (slideNum: number) => void
}

const TYPE_LABELS: Record<string, string> = {
  hook:        'Hook',
  problem:     'Problema',
  content:     'Conteúdo',
  cta:         'Apresentação',
  benefit:     'Benefício',
  comparison:  'Comparação',
  proof:       'Prova',
  'cta-final': 'CTA Final',
}

export function CarouselPreview({
  slides,
  caption,
  expert,
  onSlidesChange,
  onGenerateImages,
  generatingImages,
  imageProgress,
  imageHeightPercent,
  onImageHeightPercentChange,
  onRegenerateSlide,
}: CarouselPreviewProps) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [showCaption, setShowCaption] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const slide = slides[activeSlide]
  if (!slide) return null

  const anyImageLoading = Object.values(imageProgress).some(v => v === 'loading')
  const doneCount = Object.values(imageProgress).filter(v => v === 'done').length

  // Atualiza texto do slide ativo em tempo real
  function updateActiveText(text: string) {
    const updated = slides.map((s, i) => i === activeSlide ? { ...s, text } : s)
    onSlidesChange(updated)
  }

  function approveSlide() {
    const updated = slides.map((s, i) =>
      i === activeSlide ? { ...s, approved: true } : s
    )
    onSlidesChange(updated)
    if (activeSlide < slides.length - 1) setActiveSlide(activeSlide + 1)
  }

  function applyFormat(tag: 'bold' | 'italic' | 'highlight') {
    const area = textareaRef.current
    if (!area) return
    const { selectionStart: s, selectionEnd: e } = area
    const selected = slide.text.slice(s, e)
    if (!selected) return
    const wrapped =
      tag === 'bold'      ? `*${selected}*`
      : tag === 'italic'  ? `_${selected}_`
      : `{${selected}}`
    const newText = slide.text.slice(0, s) + wrapped + slide.text.slice(e)
    updateActiveText(newText)
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(s + 1, s + 1 + selected.length)
    })
  }

  function getImageState(slideNum: number) {
    const prog = imageProgress[slideNum]
    if (prog === 'loading') return 'loading'
    if (prog === 'done')    return 'done'
    if (prog === 'error')   return 'error'
    return 'idle'
  }

  const hasAnyContent = slides.some(s => s.cardPath || s.imagePath)
  const canGenImages = !generatingImages && slides.length > 0

  return (
    <div className="flex gap-4 h-full min-h-0">

      {/* ── Thumbnail strip ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 overflow-y-auto w-[80px] flex-shrink-0 pr-1">
        {slides.map((s, i) => {
          const imgState = getImageState(s.num)
          const isActive = i === activeSlide
          return (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className={cn(
                'relative w-full rounded-lg border text-xs font-bold flex items-center justify-center flex-shrink-0 transition-all overflow-hidden bg-white',
                isActive
                  ? 'border-violet-500 ring-1 ring-violet-500 shadow-md shadow-violet-500/20'
                  : 'border-zinc-300 hover:border-zinc-500',
              )}
              style={{ aspectRatio: '4/5' }}
            >
              {/* Thumbnail image */}
              {(s.cardPath || s.imagePath) && (
                <img
                  src={s.cardPath || s.imagePath}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: isActive ? 1 : 0.75 }}
                />
              )}

              {/* Slide number */}
              {!s.cardPath && !s.imagePath && (
                <span className="relative z-10 text-[11px] font-bold text-zinc-400">{s.num}</span>
              )}

              {/* Approved badge */}
              {s.approved && (
                <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center z-10 shadow">
                  <Check className="w-2 h-2 text-white" />
                </div>
              )}

              {/* Loading spinner */}
              {imgState === 'loading' && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                  <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                </div>
              )}

              {/* Error */}
              {imgState === 'error' && (
                <div className="absolute bottom-0.5 right-0.5 z-10">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                </div>
              )}

              {/* Active indicator strip */}
              {isActive && (
                <div className="absolute inset-y-0 left-0 w-0.5 bg-violet-500 rounded-r" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Card preview ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col gap-3" style={{ width: '420px' }}>

        {/* Slide header: num / type / nav */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-200">
              {slide.num}<span className="text-zinc-600 font-normal">/{slides.length}</span>
            </span>
            <Badge variant="outline" className="text-[11px] border-zinc-700 text-zinc-400 h-5 px-2">
              {TYPE_LABELS[slide.type] || slide.type}
            </Badge>
            {slide.approved && (
              <Badge className="text-[11px] bg-green-600/20 text-green-400 border border-green-600/30 h-5 px-2">
                ✓
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-zinc-500"
              onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
              disabled={activeSlide === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-zinc-500"
              onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))}
              disabled={activeSlide === slides.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Card — exibe PNG renderizado ou FrankCard React */}
        <div className="relative shadow-xl rounded-xl overflow-hidden" style={{ width: '420px' }}>
          {slide.cardPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.cardPath}
              alt={`Slide ${slide.num}`}
              style={{ width: '420px', height: Math.round(420 * 1350 / 1080), display: 'block', borderRadius: '12px' }}
            />
          ) : (
            <FrankCard
              text={slide.text}
              imagePath={slide.imagePath}
              authorName={expert.displayName}
              authorHandle={expert.handle}
              avatarUrl={expert.avatarUrl}
              highlightColor={expert.highlightColor}
              imageHeightPercent={imageHeightPercent}
              format="portrait"
              displayWidth={420}
            />
          )}

          {/* Loading overlay */}
          {getImageState(slide.num) === 'loading' && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              <span className="text-xs text-violet-700 font-medium">Gerando imagem...</span>
            </div>
          )}
        </div>

        {/* Slider de tamanho da imagem */}
        <div className="flex items-center gap-3 px-1">
          <ImageIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <input
            type="range"
            min={10}
            max={75}
            step={5}
            value={imageHeightPercent}
            onChange={e => onImageHeightPercentChange(Number(e.target.value))}
            className="flex-1 accent-violet-500 h-1.5 cursor-pointer"
          />
          <span className="text-[11px] text-zinc-500 w-8 text-right">{imageHeightPercent}%</span>
        </div>

        {/* Progress dots */}
        <div className="flex flex-wrap gap-1 px-1">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className={cn(
                'w-5 h-5 rounded text-[10px] font-bold transition-colors',
                s.approved
                  ? 'bg-green-600 text-white'
                  : i === activeSlide
                    ? 'bg-violet-600 text-white'
                    : imageProgress[s.num] === 'done'
                      ? 'bg-zinc-600 text-zinc-200'
                      : 'bg-zinc-800 text-zinc-600'
              )}
            >
              {s.num}
            </button>
          ))}
        </div>
      </div>

      {/* ── Painel de controles / editor ─────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">

        {/* Toolbar de formatação */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-shrink-0">
          <button
            onClick={() => applyFormat('bold')}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Negrito — selecione o texto e clique"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyFormat('italic')}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Itálico"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyFormat('highlight')}
            className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
            title="Destaque na cor do expert"
            style={{ color: expert.highlightColor }}
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <span className="text-[10px] text-zinc-600 select-none">
            *negrito* &nbsp;_itálico_&nbsp; {'{'}destaque{'}'}
          </span>
        </div>

        {/* Editor de texto — atualiza o card em tempo real */}
        <textarea
          ref={textareaRef}
          value={slide.text}
          onChange={e => updateActiveText(e.target.value)}
          className="flex-1 min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 font-mono leading-relaxed resize-none focus:outline-none focus:border-violet-500 transition-colors placeholder-zinc-600"
          placeholder="Texto do slide..."
          spellCheck={false}
        />

        {/* Ações do slide */}
        <div className="flex gap-2 flex-shrink-0">
          {onRegenerateSlide && (
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 gap-1.5"
              onClick={() => onRegenerateSlide(slide.num)}
              disabled={getImageState(slide.num) === 'loading'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Regerar imagem
            </Button>
          )}
          <Button
            size="sm"
            className={cn(
              'gap-1.5 ml-auto',
              slide.approved
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-green-600 hover:bg-green-500 text-white'
            )}
            onClick={approveSlide}
          >
            <Check className="w-3.5 h-3.5" />
            {slide.approved ? 'Aprovado' : 'Aprovar slide'}
          </Button>
        </div>

        {/* Botão gerar imagens */}
        <Button
          className={cn(
            'w-full gap-2 flex-shrink-0 font-medium',
            canGenImages
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-zinc-800 text-zinc-400'
          )}
          onClick={onGenerateImages}
          disabled={!canGenImages}
        >
          {generatingImages ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando imagens... ({doneCount}/{slides.length})
            </>
          ) : hasAnyContent ? (
            <>
              <RotateCcw className="w-4 h-4" />
              Regerar todas as imagens
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              Gerar imagens para todos os slides
            </>
          )}
        </Button>

        {/* Legenda — visível assim que o conteúdo é gerado */}
        {caption && (
          <div className="border border-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
            <button
              onClick={() => setShowCaption(v => !v)}
              className="flex items-center justify-between w-full px-4 py-3 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <span>📋 Legenda do post Instagram</span>
              <span className="text-zinc-600 text-[10px]">{showCaption ? '▲ fechar' : '▼ ver'}</span>
            </button>
            {showCaption && (
              <div className="px-4 pb-4">
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap bg-zinc-900/50 rounded-lg p-3">
                  {caption}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
