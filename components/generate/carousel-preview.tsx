'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bold, Italic, RotateCcw, Check, ImageIcon, Loader2,
  ChevronLeft, ChevronRight, AlertCircle, Highlighter,
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
  imageHeightPercent: number
  onImageHeightPercentChange: (v: number) => void
  imagePosition: 'top' | 'bottom'
  onImagePositionChange: (pos: 'top' | 'bottom') => void
}

const TYPE_LABELS: Record<string, string> = {
  hook: 'Hook', problem: 'Problema', content: 'Conteúdo',
  cta: 'Apresentação', benefit: 'Benefício', comparison: 'Comparação',
  proof: 'Prova', 'cta-final': 'CTA Final',
}

// Dimensões reais — portrait Instagram
const CARD_W = 1080
const CARD_H = 1350
const PREVIEW_W = 300
const PREVIEW_H = Math.round(PREVIEW_W * CARD_H / CARD_W) // 375

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
  imageHeightPercent,
  onImageHeightPercentChange,
  imagePosition,
  onImagePositionChange,
}: CarouselPreviewProps) {
  const [activeSlide, setActiveSlide]     = useState(0)
  const [dragIndex, setDragIndex]         = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showCaption, setShowCaption]     = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const slide = slides[activeSlide]
  if (!slide) return null

  const doneCount = Object.values(imageProgress).filter(v => v === 'done').length
  const canGenImages = !generatingImages && slides.length > 0

  // ── Texto ──────────────────────────────────────────────────────────────────
  function updateActiveText(text: string) {
    onSlidesChange(slides.map((s, i) => i === activeSlide ? { ...s, text } : s))
  }

  function approveSlide() {
    onSlidesChange(slides.map((s, i) => i === activeSlide ? { ...s, approved: true } : s))
    if (activeSlide < slides.length - 1) setActiveSlide(activeSlide + 1)
  }

  function applyFormat(tag: 'bold' | 'italic' | 'highlight') {
    const area = textareaRef.current
    if (!area) return
    const { selectionStart: s, selectionEnd: e } = area
    const selected = slide.text.slice(s, e)
    if (!selected) return
    const wrapped = tag === 'bold' ? `*${selected}*` : tag === 'italic' ? `_${selected}_` : `{${selected}}`
    updateActiveText(slide.text.slice(0, s) + wrapped + slide.text.slice(e))
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(s + 1, s + 1 + selected.length) })
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
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

  // ── Ordem ──────────────────────────────────────────────────────────────────
  function handleResetOrder() {
    onSlidesChange([...slides].sort((a, b) => a.num - b.num))
    setActiveSlide(0)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getImgState(num: number) {
    const p = imageProgress[num]
    return p === 'loading' ? 'loading' : p === 'done' ? 'done' : p === 'error' ? 'error' : 'idle'
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
                onClick={() => setActiveSlide(i)}
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
                    {/* mini header */}
                    <div className="flex items-center gap-1 flex-shrink-0 mb-1">
                      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: expert.highlightColor }} />
                      <span className="text-[6px] text-zinc-500 truncate font-medium">{expert.displayName}</span>
                    </div>
                    {/* mini text */}
                    <p className="text-[5.5px] text-zinc-600 leading-snug flex-1 overflow-hidden">
                      {miniText.slice(0, 150)}
                    </p>
                    {/* mini image placeholder */}
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

      {/* ══ PAINEL PRINCIPAL ═════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 gap-5 p-5">

        {/* ── Coluna esquerda: Preview do card + legenda ──────────────────── */}
        <div
          className="flex flex-col gap-4 flex-shrink-0 overflow-y-auto"
          style={{ width: PREVIEW_W + 20 }}
        >
          {/* Slide info */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-300">
              Slide {activeSlide + 1}
              <span className="text-zinc-600 font-normal">/{slides.length}</span>
            </span>
            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 h-5 px-1.5">
              {TYPE_LABELS[slide.type] || slide.type}
            </Badge>
            {slide.approved && (
              <Badge className="text-[10px] bg-green-600/20 text-green-400 border border-green-600/30 h-5 px-1.5">
                ✓
              </Badge>
            )}
            <div className="ml-auto flex gap-0.5">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-500"
                onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
                disabled={activeSlide === 0}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-500"
                onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))}
                disabled={activeSlide === slides.length - 1}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Card preview */}
          <div className="relative shadow-2xl rounded-xl overflow-hidden flex-shrink-0"
            style={{ width: PREVIEW_W, height: PREVIEW_H }}>
            {slide.cardPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.cardPath}
                alt={`Slide ${slide.num}`}
                style={{ width: PREVIEW_W, height: PREVIEW_H, objectFit: 'cover', display: 'block' }}
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
                onImageHeightPercentChange={onImageHeightPercentChange}
                imagePosition={imagePosition}
                format="portrait"
                displayWidth={PREVIEW_W}
              />
            )}

            {/* Overlay de loading */}
            {getImgState(slide.num) === 'loading' && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                <span className="text-xs text-violet-700 font-medium">Gerando imagem...</span>
              </div>
            )}
          </div>

          {/* Legenda */}
          {caption && (
            <div className="border border-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
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
        </div>

        {/* ── Coluna direita: Editor + controles ──────────────────────────── */}
        <div className="flex flex-col flex-1 gap-4 min-w-0 min-h-0">

          {/* Toolbar de formatação */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-shrink-0">
            <button onClick={() => applyFormat('bold')}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 transition-colors" title="Negrito">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => applyFormat('italic')}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 transition-colors" title="Itálico">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => applyFormat('highlight')}
              className="p-1.5 rounded hover:bg-zinc-700 transition-colors" title="Destaque"
              style={{ color: expert.highlightColor }}>
              <Highlighter className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-zinc-700 mx-1" />
            <span className="text-[10px] text-zinc-600 select-none">
              *negrito* &nbsp;_itálico_&nbsp; {'{'}destaque{'}'}
            </span>
          </div>

          {/* Editor de texto */}
          <textarea
            ref={textareaRef}
            value={slide.text}
            onChange={e => updateActiveText(e.target.value)}
            className="flex-1 min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 font-mono leading-relaxed resize-none focus:outline-none focus:border-violet-500 transition-colors placeholder-zinc-600"
            placeholder="Texto do slide..."
            spellCheck={false}
          />

          {/* Controles de imagem */}
          <div className="flex-shrink-0 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-4">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Controles da imagem
            </p>

            {/* Dica de drag */}
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-violet-950/40 border border-violet-800/30">
              <span className="text-violet-400 text-sm">↕</span>
              <span className="text-[11px] text-violet-300/80 leading-snug">
                Arraste a linha roxa no card para ajustar o tamanho da imagem
              </span>
              <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">{imageHeightPercent}%</span>
            </div>

            {/* Posição */}
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                <span className="text-zinc-500 text-xs">↕</span>
              </div>
              <span className="text-xs text-zinc-500 w-16 flex-shrink-0">Posição</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onImagePositionChange('top')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    imagePosition === 'top'
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
                  )}
                >
                  <ArrowUp className="w-3 h-3" /> Topo
                </button>
                <button
                  onClick={() => onImagePositionChange('bottom')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    imagePosition === 'bottom'
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
                  )}
                >
                  <ArrowDown className="w-3 h-3" /> Base
                </button>
              </div>
            </div>
          </div>

          {/* Ações do slide */}
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {onRegenerateSlide && (
              <Button
                size="sm" variant="outline"
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 gap-1.5"
                onClick={() => onRegenerateSlide(slide.num)}
                disabled={getImgState(slide.num) === 'loading'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refazer imagem
              </Button>
            )}
            <Button
              size="sm"
              className={cn('gap-1.5', slide.approved ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-500', 'text-white')}
              onClick={approveSlide}
            >
              <Check className="w-3.5 h-3.5" />
              {slide.approved ? 'Aprovado ✓' : 'Aprovar slide'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
