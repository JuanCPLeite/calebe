'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Bold, Italic, RotateCcw, Check, ImageIcon, Loader2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Slide {
  num: number
  type: string
  text: string
  imagePrompt?: string
  imagePath?: string
  approved?: boolean
}

interface CarouselPreviewProps {
  slides: Slide[]
  caption: string
  onSlidesChange: (slides: Slide[]) => void
  onGenerateImages: () => void
  generatingImages: boolean
  imageProgress: Record<number, 'loading' | 'done' | 'error'>
}

const TYPE_COLORS: Record<string, string> = {
  hook: 'from-violet-900/40 to-zinc-900',
  problem: 'from-red-900/30 to-zinc-900',
  content: 'from-blue-900/30 to-zinc-900',
  cta: 'from-green-900/30 to-zinc-900',
  benefit: 'from-amber-900/30 to-zinc-900',
  comparison: 'from-cyan-900/30 to-zinc-900',
  proof: 'from-emerald-900/30 to-zinc-900',
  'cta-final': 'from-violet-900/50 to-zinc-900',
}

const TYPE_LABELS: Record<string, string> = {
  hook: 'Hook',
  problem: 'Problema',
  content: 'Conteúdo',
  cta: 'Apresentação',
  benefit: 'Benefício',
  comparison: 'Comparação',
  proof: 'Prova',
  'cta-final': 'CTA Final',
}

// Renderiza *negrito* e {destaque} como HTML
function renderText(text: string) {
  return text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/\{([^}]+)\}/g, '<span class="text-violet-400 font-semibold">$1</span>')
    .replace(/\n/g, '<br/>')
}

export function CarouselPreview({ slides, caption, onSlidesChange, onGenerateImages, generatingImages, imageProgress }: CarouselPreviewProps) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [showCaption, setShowCaption] = useState(false)

  const slide = slides[activeSlide]
  if (!slide) return null

  const allApproved = slides.every(s => s.approved)
  const imagesGenerated = slides.every(s => imageProgress[s.num] === 'done')

  function startEdit() {
    setEditText(slide.text)
    setEditing(true)
  }

  function saveEdit() {
    const updated = slides.map((s, i) =>
      i === activeSlide ? { ...s, text: editText, approved: true } : s
    )
    onSlidesChange(updated)
    setEditing(false)
  }

  function approveSlide() {
    const updated = slides.map((s, i) =>
      i === activeSlide ? { ...s, approved: true } : s
    )
    onSlidesChange(updated)
    if (activeSlide < slides.length - 1) setActiveSlide(activeSlide + 1)
  }

  function applyFormat(tag: 'bold' | 'italic') {
    const area = document.querySelector('#slide-editor') as HTMLTextAreaElement
    if (!area) return
    const { selectionStart: s, selectionEnd: e } = area
    const selected = editText.slice(s, e)
    if (!selected) return
    const wrapped = tag === 'bold' ? `*${selected}*` : `_${selected}_`
    setEditText(editText.slice(0, s) + wrapped + editText.slice(e))
  }

  function getImageState(slideNum: number) {
    const prog = imageProgress[slideNum]
    if (prog === 'loading') return 'loading'
    if (prog === 'done') return 'done'
    if (prog === 'error') return 'error'
    return 'idle'
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Thumbnail strip */}
      <div className="flex flex-col gap-2 w-16 flex-shrink-0 overflow-y-auto py-1">
        {slides.map((s, i) => {
          const imgState = getImageState(s.num)
          return (
            <button
              key={i}
              onClick={() => { setActiveSlide(i); setEditing(false) }}
              className={cn(
                'relative w-14 h-20 rounded-lg border text-xs font-bold flex items-center justify-center flex-shrink-0 transition-all overflow-hidden',
                i === activeSlide
                  ? 'border-violet-500 ring-1 ring-violet-500'
                  : 'border-zinc-700 hover:border-zinc-500',
                `bg-gradient-to-b ${TYPE_COLORS[s.type] || 'from-zinc-800 to-zinc-900'}`
              )}
            >
              {s.imagePath ? (
                <img src={s.imagePath} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
              ) : null}
              <span className="text-zinc-400 relative z-10">{s.num}</span>
              {/* Status badges */}
              {s.approved && (
                <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-green-500 flex items-center justify-center z-10">
                  <Check className="w-2 h-2 text-white" />
                </div>
              )}
              {imgState === 'loading' && (
                <div className="absolute bottom-0.5 right-0.5 z-10">
                  <Loader2 className="w-2.5 h-2.5 text-violet-400 animate-spin" />
                </div>
              )}
              {imgState === 'done' && !s.imagePath && (
                <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-violet-500 z-10" />
              )}
              {imgState === 'error' && (
                <div className="absolute bottom-0.5 right-0.5 z-10">
                  <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Main editor */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Slide header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300">Slide {slide.num}/{slides.length}</span>
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
              {TYPE_LABELS[slide.type] || slide.type}
            </Badge>
            {slide.approved && (
              <Badge className="text-xs bg-green-600/20 text-green-400 border-green-600/30">
                ✓ Aprovado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-zinc-400 h-7 px-2"
              onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-zinc-400 h-7 px-2"
              onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))} disabled={activeSlide === slides.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Card preview */}
        <div
          className={cn(
            'relative rounded-xl border border-zinc-700 overflow-hidden cursor-pointer',
            `bg-gradient-to-b ${TYPE_COLORS[slide.type] || 'from-zinc-800 to-zinc-900'}`
          )}
          style={{ aspectRatio: '4/5', maxHeight: '420px' }}
          onClick={!editing ? startEdit : undefined}
        >
          {/* Mock card layout */}
          <div className="absolute inset-0 flex flex-col p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">JC</div>
              <div>
                <p className="text-xs font-semibold text-zinc-100 leading-none">Juan Carlos</p>
                <p className="text-xs text-zinc-500 leading-none mt-0.5">@juancarlos.ai</p>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 overflow-hidden">
              {editing ? (
                <div className="space-y-2 h-full flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 bg-zinc-800/80 rounded-lg p-1">
                    <button onClick={() => applyFormat('bold')} className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
                      <Bold className="w-3 h-3" />
                    </button>
                    <button onClick={() => applyFormat('italic')} className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
                      <Italic className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-zinc-600 px-1">| *negrito* &nbsp; _itálico_ &nbsp; {'{'}destaque{'}'}</span>
                  </div>
                  <Textarea
                    id="slide-editor"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="flex-1 text-xs bg-zinc-900/80 border-zinc-700 text-zinc-100 resize-none leading-relaxed"
                  />
                </div>
              ) : (
                <div
                  className="text-xs text-zinc-100 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderText(slide.text) }}
                />
              )}
            </div>

            {/* Image area */}
            {(() => {
              const imgState = getImageState(slide.num)
              return (
                <div className={cn(
                  'mt-3 rounded-lg flex items-center justify-center flex-shrink-0',
                  slide.imagePath ? 'overflow-hidden' : 'bg-zinc-800/60 border border-zinc-700/50 border-dashed'
                )}
                  style={{ height: '90px' }}>
                  {slide.imagePath ? (
                    <img src={slide.imagePath} alt="" className="w-full h-full object-cover" />
                  ) : imgState === 'loading' ? (
                    <div className="flex flex-col items-center gap-1 text-zinc-500">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      <span className="text-xs text-violet-400">gerando...</span>
                    </div>
                  ) : imgState === 'error' ? (
                    <div className="flex flex-col items-center gap-1 text-red-500">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs">erro na imagem</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-zinc-600">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-xs">imagem aqui</span>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {!editing && (
            <div className="absolute inset-0 bg-zinc-100/0 hover:bg-zinc-100/5 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <span className="text-xs bg-zinc-900/80 px-2 py-1 rounded-full text-zinc-300">Clique para editar</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white flex-1" onClick={saveEdit}>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" className="text-zinc-400" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex-1" onClick={startEdit}>
                Editar texto
              </Button>
              <Button size="sm" variant="ghost" className="text-zinc-400 border border-zinc-700 hover:bg-zinc-800" onClick={() => {}}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Regerar
              </Button>
              {!slide.approved && (
                <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={approveSlide}>
                  <Check className="w-3.5 h-3.5 mr-1.5" /> Aprovar
                </Button>
              )}
            </>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Aprovados:</span>
          <div className="flex gap-1">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={cn(
                  'w-5 h-5 rounded text-xs font-medium transition-colors',
                  s.approved ? 'bg-green-600 text-white' : i === activeSlide ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-500'
                )}
              >
                {s.num}
              </button>
            ))}
          </div>
        </div>

        {/* Generate images button */}
        <Button
          className={cn(
            'w-full',
            allApproved
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          )}
          onClick={onGenerateImages}
          disabled={generatingImages}
        >
          {generatingImages ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando imagens...</>
          ) : (
            <><ImageIcon className="w-4 h-4 mr-2" />
              {allApproved ? '⚡ Gerar Imagens' : `Gerar Imagens (${slides.filter(s => s.approved).length}/${slides.length} aprovados)`}
            </>
          )}
        </Button>

        {/* Caption section (aparece após gerar imagens) */}
        {imagesGenerated && caption && (
          <div className="border border-zinc-700 rounded-xl p-3 space-y-2">
            <button
              onClick={() => setShowCaption(v => !v)}
              className="flex items-center justify-between w-full text-xs font-medium text-zinc-400 hover:text-zinc-200"
            >
              <span>Legenda do post</span>
              <span className="text-zinc-600">{showCaption ? '▲' : '▼'}</span>
            </button>
            {showCaption && (
              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{caption}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
