'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RotateCcw, Check, ImageIcon, Loader2,
  ChevronLeft, ChevronRight, AlertCircle,
  GripVertical, ArrowUp, ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FrankCard } from './frank-card'
import { SplitCard, type SplitSlide } from './split-card'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Slide {
  num: number
  type: string
  text: string
  imagePrompt?: string
  imagePath?: string
  bgImageStoragePath?: string
  cardPath?: string
  cardStoragePath?: string
  approved?: boolean
  imageHeightPercent?: number
  imagePosition?: 'top' | 'bottom'
  imageObjectX?: number
  imageObjectY?: number
  fontSize?: number
  highlightEnabled?: boolean
  // ── Split template fields ──────────────────────
  layout?: 'split-cover' | 'split-content' | 'split-cta'
  subtitulo?: string
  esquerda?: string
  direita?: string
  labelEsquerda?: string
  labelDireita?: string
  subtexto?: string
  hashtags?: string
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
  onCaptionChange?: (caption: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  hook: 'Hook', problem: 'Problema', content: 'Conteúdo',
  cta: 'Apresentação', benefit: 'Benefício', comparison: 'Comparação',
  proof: 'Prova', 'cta-final': 'CTA Final',
}

const PREVIEW_W = 380

const EMOJI_LIST = ['🔥','💡','✅','🚀','⭐','💪','📈','🎯','👉','💰','🙌','📱','💻','🧠','🎨','✨','🔑','💎','💯','❤️','👏','🤝','📣','🏆','⚡','🌟','😊','👀','💬','📝']

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
  onCaptionChange,
}: CarouselPreviewProps) {
  const [activeSlide, setActiveSlide]         = useState(0)
  const [dragIndex, setDragIndex]             = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex]     = useState<number | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const captionRef = useRef<HTMLTextAreaElement>(null)

  function wrapCaption(open: string, close: string) {
    if (!captionRef.current || !onCaptionChange) return
    const ta    = captionRef.current
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const newVal = caption.slice(0, start) + open + caption.slice(start, end) + close + caption.slice(end)
    onCaptionChange(newVal)
    setTimeout(() => {
      if (!captionRef.current) return
      captionRef.current.selectionStart = start + open.length
      captionRef.current.selectionEnd   = end   + open.length
      captionRef.current.focus()
    }, 0)
  }

  function insertCaption(text: string) {
    if (!captionRef.current || !onCaptionChange) return
    const ta    = captionRef.current
    const start = ta.selectionStart
    const newVal = caption.slice(0, start) + text + caption.slice(start)
    onCaptionChange(newVal)
    setTimeout(() => {
      if (!captionRef.current) return
      captionRef.current.selectionStart = start + text.length
      captionRef.current.selectionEnd   = start + text.length
      captionRef.current.focus()
    }, 0)
  }

  if (slides.length === 0) return null

  const doneCount    = Object.values(imageProgress).filter(v => v === 'done').length
  const canGenImages = !generatingImages && slides.length > 0

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

  function isSplitSlide(s: Slide) { return !!s.layout?.startsWith('split') }

  // Dados do slide ativo
  const slide        = slides[activeSlide]
  const imgState     = getImgState(slide.num)
  const slideImgPos  = slide.imagePosition  ?? 'bottom'
  const slideExtraPct = (slide.imageHeightPercent ?? 0) > 40 ? 0 : (slide.imageHeightPercent ?? 0)
  const slideObjX    = slide.imageObjectX   ?? 50
  const slideObjY    = slide.imageObjectY   ?? 50
  const hasImage     = !!(slide.imagePath || slide.bgImageStoragePath)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">

      {/* ══ STRIP ════════════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 border-b border-zinc-800/70 bg-zinc-900/40 px-4 py-3">
        <div className="flex items-center gap-3">

          <GripVertical className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />

          {/* Thumbnails */}
          <div
            className="flex gap-2 flex-1 overflow-x-auto select-none"
            style={{ scrollbarWidth: 'none' }}
          >
            {slides.map((s, i) => {
              const isActive   = i === activeSlide
              const isDragging = dragIndex === i
              const isDragOver = dragOverIndex === i && dragIndex !== i
              const tState     = getImgState(s.num)
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
                  title={`Slide ${i + 1} — ${TYPE_LABELS[s.type] || s.type}`}
                  className={cn(
                    'relative rounded-lg overflow-hidden flex-shrink-0 cursor-grab active:cursor-grabbing transition-all duration-150',
                    isActive   ? 'ring-2 ring-violet-500 shadow-lg shadow-violet-500/25' : 'ring-1 ring-zinc-800 hover:ring-zinc-600',
                    isDragOver ? 'ring-2 ring-violet-400 scale-105' : '',
                    isDragging ? 'opacity-20 scale-95' : '',
                  )}
                  style={{ width: 68, height: 85, background: '#fff', flexShrink: 0 }}
                >
                  {s.cardPath
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.cardPath} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    : (
                      <div className="absolute inset-0 flex flex-col p-1 bg-white">
                        <div className="flex items-center gap-0.5 mb-0.5 flex-shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: expert.highlightColor }} />
                          <span className="text-[4.5px] text-zinc-500 truncate leading-none">{expert.displayName}</span>
                        </div>
                        <p className="text-[4px] text-zinc-600 leading-snug flex-1 overflow-hidden">{miniText.slice(0, 90)}</p>
                        <div className="mt-0.5 rounded flex-shrink-0 h-6 overflow-hidden bg-zinc-100 border border-dashed border-zinc-300 flex items-center justify-center">
                          {s.imagePath
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={s.imagePath} className="w-full h-full object-cover" alt="" />
                            : <span className="text-[6px] text-zinc-400">📷</span>
                          }
                        </div>
                      </div>
                    )
                  }

                  <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded bg-black/55 flex items-center justify-center z-10">
                    <span className="text-[7px] font-bold text-white leading-none">{i + 1}</span>
                  </div>

                  {s.approved && (
                    <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-green-500 flex items-center justify-center z-10">
                      <Check className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}

                  {tState === 'loading' && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
                      <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                    </div>
                  )}
                  {tState === 'error' && (
                    <div className="absolute bottom-0.5 left-0.5 z-10">
                      <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                    </div>
                  )}
                  {isActive && <div className="absolute inset-0 rounded-lg border-2 border-violet-500 pointer-events-none" />}
                </button>
              )
            })}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isReordered && (
              <button
                onClick={handleResetOrder}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-zinc-700 text-zinc-500 hover:border-amber-500 hover:text-amber-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar
              </button>
            )}
            <Button
              size="sm"
              className={cn(
                'h-8 text-xs gap-1.5 px-3 flex-shrink-0',
                canGenImages ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-zinc-800 text-zinc-500'
              )}
              onClick={onGenerateImages}
              disabled={!canGenImages}
            >
              {generatingImages
                ? <><Loader2 className="w-3 h-3 animate-spin" /> {doneCount}/{slides.length}</>
                : <><ImageIcon className="w-3 h-3" /> Gerar imagens</>
              }
            </Button>
          </div>

        </div>
      </div>

      {/* ══ ÁREA PRINCIPAL ════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── Coluna esquerda: slide ativo ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-w-0 flex flex-col items-center py-6 gap-4">

          {/* Barra de navegação */}
          <div style={{ width: PREVIEW_W, maxWidth: '100%' }}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-semibold text-zinc-300">{activeSlide + 1}</span>
                <span className="text-zinc-700">/</span>
                <span className="text-zinc-600">{slides.length}</span>
              </div>
              <div className="w-px h-4 bg-zinc-800" />
              <span className="text-sm text-zinc-400 font-medium">
                {TYPE_LABELS[slide.type] || slide.type}
              </span>
              {slide.approved && (
                <Badge className="text-[10px] bg-green-900/30 text-green-400 border border-green-700/40 h-5 px-2">
                  ✓ aprovado
                </Badge>
              )}
              <button
                onClick={() => approveSlide(activeSlide)}
                className={cn(
                  'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  slide.approved
                    ? 'bg-green-800/30 text-green-400 hover:bg-green-800/50'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                )}
              >
                <Check className="w-3.5 h-3.5" />
                {slide.approved ? 'Aprovado' : 'Aprovar'}
              </button>
            </div>
          </div>

          {/* Coverflow */}
          <div className="flex items-center gap-4 w-full justify-center px-4">

            {/* Seta esquerda */}
            <button
              onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
              disabled={activeSlide === 0}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Slide anterior */}
            <div
              className="flex-shrink-0 transition-all duration-300"
              style={{ opacity: 0.38, width: 200 }}
              onClick={() => activeSlide > 0 && setActiveSlide(activeSlide - 1)}
            >
              {activeSlide > 0 ? (
                <div className="rounded-xl overflow-hidden cursor-pointer border border-zinc-800/40">
                  {isSplitSlide(slides[activeSlide - 1]) ? (
                    <SplitCard slide={slides[activeSlide - 1] as SplitSlide} accentColor={expert.highlightColor} displayWidth={200} />
                  ) : (
                    <FrankCard
                      text={slides[activeSlide - 1].text}
                      imagePath={slides[activeSlide - 1].imagePath}
                      authorName={expert.displayName}
                      authorHandle={expert.handle}
                      avatarUrl={expert.avatarUrl}
                      highlightColor={expert.highlightColor}
                      imageHeightPercent={(slides[activeSlide - 1].imageHeightPercent ?? 0) > 40 ? 0 : (slides[activeSlide - 1].imageHeightPercent ?? 0)}
                      imagePosition={slides[activeSlide - 1].imagePosition ?? 'bottom'}
                      imageObjectX={slides[activeSlide - 1].imageObjectX ?? 50}
                      imageObjectY={slides[activeSlide - 1].imageObjectY ?? 50}
                      fontSizeOverride={slides[activeSlide - 1].fontSize}
                      highlightEnabled={slides[activeSlide - 1].highlightEnabled !== false}
                      format="portrait"
                      displayWidth={200}
                    />
                  )}
                </div>
              ) : (
                <div style={{ width: 200 }} />
              )}
            </div>

            {/* Slide ativo */}
            <div
              className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-zinc-800/60 shadow-2xl shadow-black/50"
              style={{ width: PREVIEW_W }}
            >
              <div className="relative flex justify-center" style={{ background: isSplitSlide(slide) ? '#0c0c0c' : '#fff' }}>
                {isSplitSlide(slide) ? (
                  <SplitCard slide={slide as SplitSlide} accentColor={expert.highlightColor} displayWidth={PREVIEW_W} />
                ) : (
                  <FrankCard
                    text={slide.text}
                    imagePath={slide.imagePath}
                    authorName={expert.displayName}
                    authorHandle={expert.handle}
                    avatarUrl={expert.avatarUrl}
                    highlightColor={expert.highlightColor}
                    imageHeightPercent={slideExtraPct}
                    onImageHeightPercentChange={v => updateSlide(activeSlide, { imageHeightPercent: v })}
                    imagePosition={slideImgPos}
                    imageObjectX={slideObjX}
                    imageObjectY={slideObjY}
                    onImageObjectChange={(x, y) => updateSlide(activeSlide, { imageObjectX: x, imageObjectY: y })}
                    onTextChange={text => updateSlide(activeSlide, { text })}
                    fontSizeOverride={slide.fontSize}
                    highlightEnabled={slide.highlightEnabled !== false}
                    format="portrait"
                    displayWidth={PREVIEW_W}
                  />
                )}
                {imgState === 'loading' && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-violet-600" />
                    <span className="text-sm text-zinc-600 font-medium">Gerando imagem...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Slide seguinte */}
            <div
              className="flex-shrink-0 transition-all duration-300"
              style={{ opacity: 0.38, width: 200 }}
              onClick={() => activeSlide < slides.length - 1 && setActiveSlide(activeSlide + 1)}
            >
              {activeSlide < slides.length - 1 ? (
                <div className="rounded-xl overflow-hidden cursor-pointer border border-zinc-800/40">
                  {isSplitSlide(slides[activeSlide + 1]) ? (
                    <SplitCard slide={slides[activeSlide + 1] as SplitSlide} accentColor={expert.highlightColor} displayWidth={200} />
                  ) : (
                    <FrankCard
                      text={slides[activeSlide + 1].text}
                      imagePath={slides[activeSlide + 1].imagePath}
                      authorName={expert.displayName}
                      authorHandle={expert.handle}
                      avatarUrl={expert.avatarUrl}
                      highlightColor={expert.highlightColor}
                      imageHeightPercent={(slides[activeSlide + 1].imageHeightPercent ?? 0) > 40 ? 0 : (slides[activeSlide + 1].imageHeightPercent ?? 0)}
                      imagePosition={slides[activeSlide + 1].imagePosition ?? 'bottom'}
                      imageObjectX={slides[activeSlide + 1].imageObjectX ?? 50}
                      imageObjectY={slides[activeSlide + 1].imageObjectY ?? 50}
                      fontSizeOverride={slides[activeSlide + 1].fontSize}
                      highlightEnabled={slides[activeSlide + 1].highlightEnabled !== false}
                      format="portrait"
                      displayWidth={200}
                    />
                  )}
                </div>
              ) : (
                <div style={{ width: 200 }} />
              )}
            </div>

            {/* Seta direita */}
            <button
              onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))}
              disabled={activeSlide === slides.length - 1}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 disabled:opacity-20 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

          </div>

          {/* Controles do slide */}
          <div style={{ width: PREVIEW_W, maxWidth: '100%' }}>
            <div className="flex items-center flex-wrap gap-2">
              {!isSplitSlide(slide) && onRegenerateSlide && (
                <>
                  <button
                    onClick={() => onRegenerateSlide(slide.num)}
                    disabled={imgState === 'loading'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Refazer imagem
                  </button>
                  <div className="w-px h-5 bg-zinc-800" />
                </>
              )}

              {/* Tamanho da fonte + cor de destaque (apenas FrankCard) */}
              {!isSplitSlide(slide) && (<>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 select-none">Aa</span>
                <select
                  value={slide.fontSize ?? ''}
                  onChange={e => {
                    const v = e.target.value
                    updateSlide(activeSlide, { fontSize: v ? Number(v) : undefined })
                  }}
                  className="bg-zinc-800 text-zinc-300 text-xs rounded-lg border border-zinc-700 px-2 py-1.5 outline-none focus:border-violet-500 cursor-pointer"
                >
                  <option value="">Auto</option>
                  {[24, 28, 32, 36, 40, 44, 50, 58, 64, 72].map(s => (
                    <option key={s} value={s}>{s}px</option>
                  ))}
                </select>
              </div>

              <button
                title={slide.highlightEnabled === false ? 'Ativar cor {}' : 'Desativar cor {}'}
                onClick={() => updateSlide(activeSlide, { highlightEnabled: slide.highlightEnabled !== false ? false : true })}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  slide.highlightEnabled !== false
                    ? 'border-violet-600/50 text-violet-300 bg-violet-900/20 hover:bg-violet-900/35'
                    : 'border-zinc-700 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                )}
              >
                <span style={{
                  display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                  background: slide.highlightEnabled !== false ? expert.highlightColor : '#52525b',
                  flexShrink: 0,
                }} />
                {'{ }'} cor
              </button>
              </>)}

              {/* Posição da imagem */}
              {!isSplitSlide(slide) && hasImage && (
                <>
                  <div className="w-px h-5 bg-zinc-800 ml-auto" />
                  <button
                    onClick={() => updateSlide(activeSlide, { imagePosition: 'top' })}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                      slideImgPos === 'top'
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <ArrowUp className="w-3.5 h-3.5" /> Topo
                  </button>
                  <button
                    onClick={() => updateSlide(activeSlide, { imagePosition: 'bottom' })}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                      slideImgPos === 'bottom'
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <ArrowDown className="w-3.5 h-3.5" /> Base
                  </button>
                </>
              )}
            </div>
          </div>

        </div>

        {/* ── Coluna direita: legenda ─────────────────────────────────────── */}
        <div className="w-[420px] flex-shrink-0 border-l border-zinc-800/70 flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/70 flex-shrink-0">
            <span className="text-sm font-semibold text-zinc-300">Legenda</span>
            <span className={cn(
              'text-xs font-mono tabular-nums px-2 py-0.5 rounded-md',
              (caption?.length ?? 0) > 2000 ? 'text-red-400 bg-red-900/20' : 'text-zinc-600 bg-zinc-800/50'
            )}>
              {caption?.length ?? 0} / 2200
            </span>
          </div>

          {/* Toolbar de formatação */}
          {onCaptionChange && (
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-zinc-800/70 flex-shrink-0">
              {([
                { label: 'B', title: 'Negrito',         open: '*',  close: '*',  style: { fontWeight: 700 } },
                { label: 'I', title: 'Itálico',          open: '_',  close: '_',  style: { fontStyle: 'italic' as const } },
                { label: '↵', title: 'Quebra de linha',  open: '\n', close: '',   style: {} },
              ]).map(({ label, title, open, close, style }) => (
                <button
                  key={label}
                  title={title}
                  onMouseDown={e => { e.preventDefault(); wrapCaption(open, close) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  style={style}
                >
                  {label}
                </button>
              ))}
              <div className="w-px h-5 bg-zinc-800 mx-1" />
              <div className="relative">
                <button
                  title="Inserir emoji"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-zinc-800 transition-colors"
                >
                  😊
                </button>
                {showEmojiPicker && (
                  <div className="absolute left-0 top-10 z-50 bg-zinc-900 border border-zinc-700/80 rounded-xl p-3 shadow-2xl w-60">
                    <div className="grid grid-cols-6 gap-1.5">
                      {EMOJI_LIST.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => { insertCaption(emoji); setShowEmojiPicker(false) }}
                          className="text-lg hover:bg-zinc-800 rounded-lg p-1 transition-colors leading-none"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={captionRef}
            value={caption ?? ''}
            onChange={e => onCaptionChange?.(e.target.value)}
            readOnly={!onCaptionChange}
            placeholder={onCaptionChange ? 'Escreva ou edite a legenda do post...' : 'Nenhuma legenda gerada ainda'}
            className="flex-1 bg-transparent resize-none px-5 py-4 text-sm text-zinc-300 leading-relaxed outline-none placeholder:text-zinc-700 min-h-0"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

      </div>
    </div>
  )
}
