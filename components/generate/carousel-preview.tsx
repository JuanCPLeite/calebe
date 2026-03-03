'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RotateCcw, Check, ImageIcon, Loader2,
  ChevronLeft, ChevronRight, AlertCircle,
  GripVertical, ArrowUp, ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FrankCard } from './frank-card'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Slide {
  num: number
  type: string
  text: string
  imagePrompt?: string
  imagePath?: string
  cardPath?: string
  approved?: boolean
  imageHeightPercent?: number
  imagePosition?: 'top' | 'bottom'
  imageObjectX?: number
  imageObjectY?: number
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
  onRegenerateSlide?: (slideNum: number) => void
  generatingImages: boolean
  imageProgress: Record<number, 'loading' | 'done' | 'error'>
}


const TYPE_LABELS: Record<string, string> = {
  hook: 'Hook', problem: 'Problema', content: 'Conteúdo',
  cta: 'Apresentação', benefit: 'Benefício', comparison: 'Comparação',
  proof: 'Prova', 'cta-final': 'CTA Final',
}

const PREVIEW_W = 400

// ─── Componente principal ─────────────────────────────────────────────────────

export function CarouselPreview({
  slides,
  caption,
  expert,
  onSlidesChange,
  onGenerateImages,
  onRegenerateSlide,
  generatingImages,
  imageProgress,
}: CarouselPreviewProps) {
  const [activeSlide, setActiveSlide]     = useState(0)
  const [dragIndex, setDragIndex]         = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showCaption, setShowCaption]     = useState(false)

  if (slides.length === 0) return null

  const doneCount  = Object.values(imageProgress).filter(v => v === 'done').length
  const canGenImages = !generatingImages && slides.length > 0

  // ── Helpers ────────────────────────────────────────────────────────────────
  function updateSlide(i: number, patch: Partial<Slide>) {
    onSlidesChange(slides.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  function approveSlide(i: number) {
    updateSlide(i, { approved: true })
    if (i < slides.length - 1) setActiveSlide(i + 1)
  }

  function getImgState(num: number) {
    const p = imageProgress[num]
    return p === 'loading' ? 'loading' : p === 'done' ? 'done' : p === 'error' ? 'error' : 'idle'
  }

  // ── Drag & Drop do strip ──────────────────────────────────────────────────
  function handleDragStart(index: number) { setDragIndex(index) }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragOverIndex !== index) setDragOverIndex(index)
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex !== null && dragIndex !== dropIndex) {
      const next = [...slides]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(dropIndex, 0, moved)
      onSlidesChange(next)
      setActiveSlide(dropIndex)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null) }

  function handleResetOrder() {
    onSlidesChange([...slides].sort((a, b) => a.num - b.num))
    setActiveSlide(0)
  }

  const isReordered = slides.some((s, i) => s.num !== i + 1)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ══ STRIP: Sequência dos slides ══════════════════════════════════════ */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/60 px-5 pt-4 pb-3">

        {/* Cabeçalho do strip */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GripVertical className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs font-medium text-zinc-400">
              Sequência dos slides
              <span className="text-zinc-600 ml-1">· arraste para reordenar</span>
            </span>
            {isReordered && (
              <Badge className="text-[10px] bg-amber-900/30 text-amber-400 border border-amber-700/40 h-4 px-1.5">
                reordenado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isReordered && (
              <button
                onClick={handleResetOrder}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-zinc-700 text-zinc-400 hover:border-amber-500 hover:text-amber-300 transition-colors bg-zinc-900"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar ordem
              </button>
            )}
            <Button
              size="sm"
              className={cn(
                'h-7 text-xs gap-1.5',
                canGenImages ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-zinc-800 text-zinc-400'
              )}
              onClick={onGenerateImages}
              disabled={!canGenImages}
            >
              {generatingImages
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Gerando ({doneCount}/{slides.length})</>
                : <><ImageIcon className="w-3 h-3" /> Gerar imagens</>
              }
            </Button>
          </div>
        </div>

        {/* Thumbnails draggáveis */}
        <div className="flex gap-2 overflow-x-auto pb-1 select-none">
          {slides.map((s, i) => {
            const isActive   = i === activeSlide
            const isDragging = dragIndex === i
            const isDragOver = dragOverIndex === i && dragIndex !== i
            const imgState   = getImgState(s.num)
            const miniText   = s.text.replace(/[*_{}\n]/g, ' ').trim()

            return (
              <button
                key={`${s.num}-${i}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  setActiveSlide(i)
                  document.getElementById(`slide-card-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className={cn(
                  'relative rounded-xl overflow-hidden flex-shrink-0 cursor-grab active:cursor-grabbing transition-all duration-150',
                  isActive   ? 'ring-2 ring-violet-500 shadow-lg shadow-violet-500/20' : 'ring-1 ring-zinc-700 hover:ring-zinc-500',
                  isDragOver ? 'ring-2 ring-violet-400 scale-[1.06] shadow-xl' : '',
                  isDragging ? 'opacity-25 scale-95' : '',
                )}
                style={{ width: 88, height: 110, background: '#fff', flexShrink: 0 }}
              >
                {/* Conteúdo: PNG gerado */}
                {s.cardPath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cardPath} className="absolute inset-0 w-full h-full object-cover" alt="" />
                )}

                {/* Conteúdo: mini preview de texto */}
                {!s.cardPath && (
                  <div className="absolute inset-0 flex flex-col p-1.5 bg-white">
                    <div className="flex items-center gap-1 flex-shrink-0 mb-1">
                      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: expert.highlightColor }} />
                      <span className="text-[6px] text-zinc-500 truncate font-medium">{expert.displayName}</span>
                    </div>
                    <p className="text-[5.5px] text-zinc-600 leading-snug flex-1 overflow-hidden">
                      {miniText.slice(0, 150)}
                    </p>
                    {s.imagePath ? (
                      <div className="mt-1 rounded overflow-hidden flex-shrink-0" style={{ height: 36 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.imagePath} className="w-full h-full object-cover" alt="" />
                      </div>
                    ) : (
                      <div className="mt-1 rounded flex-shrink-0 flex items-center justify-center bg-zinc-100 border border-dashed border-zinc-300" style={{ height: 36 }}>
                        <span className="text-[9px] text-zinc-400">📷</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Número */}
                <div className="absolute top-1 left-1 min-w-[16px] h-4 px-1 rounded-sm bg-black/60 flex items-center justify-center z-10">
                  <span className="text-[8px] font-bold text-white leading-none">{i + 1}</span>
                </div>

                {/* Tipo */}
                {!s.cardPath && (
                  <div className="absolute top-1 right-1 z-10">
                    <span className="text-[5.5px] font-medium text-zinc-400 uppercase tracking-wide">
                      {TYPE_LABELS[s.type]?.slice(0, 4) || s.type.slice(0, 4)}
                    </span>
                  </div>
                )}

                {/* Aprovado */}
                {s.approved && (
                  <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center z-10 shadow">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}

                {/* Loading */}
                {imgState === 'loading' && (
                  <div className="absolute inset-0 bg-white/75 flex items-center justify-center z-20">
                    <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                  </div>
                )}

                {/* Erro */}
                {imgState === 'error' && (
                  <div className="absolute bottom-1 left-1 z-10">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                  </div>
                )}

                {/* Borda ativa */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl border-2 border-violet-500 pointer-events-none" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ══ ÁREA SCROLL VERTICAL: slides empilhados ══════════════════════════ */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="flex flex-col items-center gap-6" style={{ maxWidth: PREVIEW_W + 20, margin: '0 auto' }}>

          {/* Legenda colapsável */}
          {caption && (
            <div className="w-full border border-zinc-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowCaption(v => !v)}
                className="flex items-center justify-between w-full px-3 py-2.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
              >
                <span>📋 Legenda do post Instagram</span>
                <span className="text-zinc-600 text-[10px]">{showCaption ? '▲ fechar' : '▼ ver'}</span>
              </button>
              {showCaption && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap bg-zinc-900/50 rounded-lg p-2.5">
                    {caption}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Slides empilhados */}
          {slides.map((slide, i) => {
            const isActive        = i === activeSlide
            const imgState        = getImgState(slide.num)
            const slideImgPos     = slide.imagePosition ?? 'bottom'
            // imageHeightPercent agora controla o espaço extra (0-40%); default 0
            const slideExtraPct   = (slide.imageHeightPercent ?? 0) > 40 ? 0 : (slide.imageHeightPercent ?? 0)
            const slideObjX       = slide.imageObjectX ?? 50
            const slideObjY       = slide.imageObjectY ?? 50

            return (
              <div
                key={`${slide.num}-${i}`}
                id={`slide-card-${i}`}
                onClick={() => setActiveSlide(i)}
                className={cn(
                  'w-full rounded-2xl overflow-hidden border transition-all cursor-pointer',
                  isActive
                    ? 'border-violet-500/70 shadow-xl shadow-violet-500/10'
                    : 'border-zinc-800 hover:border-zinc-700'
                )}
              >
                {/* ── Barra superior: badge + nav + aprovar ─────────────── */}
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-500 w-5 flex-shrink-0">{i + 1}</span>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 h-5 px-1.5">
                    {TYPE_LABELS[slide.type] || slide.type}
                  </Badge>
                  {slide.approved && (
                    <Badge className="text-[10px] bg-green-600/20 text-green-400 border border-green-600/30 h-5 px-1.5">
                      ✓
                    </Badge>
                  )}
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-500"
                      onClick={e => { e.stopPropagation(); setActiveSlide(Math.max(0, i - 1)) }}
                      disabled={i === 0}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-500"
                      onClick={e => { e.stopPropagation(); setActiveSlide(Math.min(slides.length - 1, i + 1)) }}
                      disabled={i === slides.length - 1}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className={cn(
                        'h-6 px-2 text-xs gap-1 ml-1',
                        slide.approved ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-500',
                        'text-white'
                      )}
                      onClick={e => { e.stopPropagation(); approveSlide(i) }}
                    >
                      <Check className="w-3 h-3" />
                      {slide.approved ? 'OK ✓' : 'Aprovar'}
                    </Button>
                  </div>
                </div>

                {/* ── Card preview — sempre editável até publicar ────────── */}
                <div
                  className="relative bg-zinc-950 flex justify-center"
                  onClick={e => e.stopPropagation()}
                >
                  <FrankCard
                    text={slide.text}
                    imagePath={slide.imagePath}
                    authorName={expert.displayName}
                    authorHandle={expert.handle}
                    avatarUrl={expert.avatarUrl}
                    highlightColor={expert.highlightColor}
                    imageHeightPercent={slideExtraPct}
                    onImageHeightPercentChange={v => updateSlide(i, { imageHeightPercent: v })}
                    imagePosition={slideImgPos}
                    imageObjectX={slideObjX}
                    imageObjectY={slideObjY}
                    onImageObjectChange={(x, y) => updateSlide(i, { imageObjectX: x, imageObjectY: y })}
                    onTextChange={text => updateSlide(i, { text })}
                    format="portrait"
                    displayWidth={PREVIEW_W}
                  />

                  {/* Loading overlay */}
                  {imgState === 'loading' && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                      <span className="text-xs text-violet-700 font-medium">Gerando imagem...</span>
                    </div>
                  )}
                </div>

                {/* ── Barra inferior: refazer + posição imagem ──────────── */}
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-t border-zinc-800"
                  onClick={e => e.stopPropagation()}
                >
                  {onRegenerateSlide && (
                    <Button
                      size="sm" variant="outline"
                      className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 gap-1.5 h-7 text-xs"
                      onClick={() => onRegenerateSlide(slide.num)}
                      disabled={imgState === 'loading'}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Refazer imagem
                    </Button>
                  )}
                  <div className="flex gap-1 ml-auto items-center">
                    {slideExtraPct > 0 && (
                      <span className="text-[10px] text-zinc-600 mr-1">+{slideExtraPct}% espaço</span>
                    )}
                    <button
                      onClick={() => updateSlide(i, { imagePosition: 'top' })}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all border',
                        slideImgPos === 'top'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                      )}
                    >
                      <ArrowUp className="w-3 h-3" /> Topo
                    </button>
                    <button
                      onClick={() => updateSlide(i, { imagePosition: 'bottom' })}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all border',
                        slideImgPos === 'bottom'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                      )}
                    >
                      <ArrowDown className="w-3 h-3" /> Base
                    </button>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
