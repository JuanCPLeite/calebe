'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Bold, Italic, RotateCcw, Check, ImageIcon, Loader2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FrankCard } from './frank-card'

export interface Slide {
  num: number
  type: string
  text: string
  imagePrompt?: string
  imagePath?: string
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

export function CarouselPreview({
  slides,
  caption,
  expert,
  onSlidesChange,
  onGenerateImages,
  generatingImages,
  imageProgress,
}: CarouselPreviewProps) {
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
      {/* ── Thumbnail strip ────────────────────────────── */}
      <div className="flex flex-col gap-2 w-16 flex-shrink-0 overflow-y-auto py-1">
        {slides.map((s, i) => {
          const imgState = getImageState(s.num)
          return (
            <button
              key={i}
              onClick={() => { setActiveSlide(i); setEditing(false) }}
              className={cn(
                'relative w-14 rounded-lg border text-xs font-bold flex items-center justify-center flex-shrink-0 transition-all overflow-hidden bg-white',
                i === activeSlide
                  ? 'border-violet-500 ring-1 ring-violet-500'
                  : 'border-zinc-200 hover:border-zinc-400',
              )}
              style={{ aspectRatio: '4/5' }}
            >
              {s.imagePath ? (
                <img src={s.imagePath} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              ) : null}
              <span
                className="relative z-10 text-[10px] font-bold"
                style={{ color: s.imagePath ? '#fff' : '#888' }}
              >
                {s.num}
              </span>

              {/* Badges de status */}
              {s.approved && (
                <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-green-500 flex items-center justify-center z-10">
                  <Check className="w-2 h-2 text-white" />
                </div>
              )}
              {imgState === 'loading' && (
                <div className="absolute bottom-0.5 right-0.5 z-10">
                  <Loader2 className="w-2.5 h-2.5 text-violet-500 animate-spin" />
                </div>
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

      {/* ── Editor principal ───────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Cabeçalho do slide */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300">
              Slide {slide.num}/{slides.length}
            </span>
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
              onClick={() => { setActiveSlide(Math.max(0, activeSlide - 1)); setEditing(false) }}
              disabled={activeSlide === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-zinc-400 h-7 px-2"
              onClick={() => { setActiveSlide(Math.min(slides.length - 1, activeSlide + 1)); setEditing(false) }}
              disabled={activeSlide === slides.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Card preview — estilo Frank */}
        <div
          className="cursor-pointer shadow-lg"
          style={{ maxWidth: '320px' }}
          onClick={!editing ? startEdit : undefined}
        >
          {editing ? (
            /* Modo edição — textarea dark sobre o card */
            <div
              className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700"
              style={{ aspectRatio: '4/5' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="h-full flex flex-col p-3 gap-2">
                {/* Toolbar de formatação */}
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-2 py-1 flex-shrink-0">
                  <button
                    onClick={() => applyFormat('bold')}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-300"
                    title="Negrito (*texto*)"
                  >
                    <Bold className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => applyFormat('italic')}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-300"
                    title="Itálico (_texto_)"
                  >
                    <Italic className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-zinc-600 px-1">
                    *negrito* &nbsp; _itálico_ &nbsp; {'{'}destaque{'}'}
                  </span>
                </div>
                <Textarea
                  id="slide-editor"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="flex-1 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 resize-none leading-relaxed font-mono"
                />
              </div>
            </div>
          ) : (
            /* Preview do card estilo Frank */
            <div className="relative group">
              <FrankCard
                text={slide.text}
                imagePath={slide.imagePath}
                authorName={expert.displayName}
                authorHandle={expert.handle}
                avatarUrl={expert.avatarUrl}
                highlightColor={expert.highlightColor}
              />

              {/* Overlay hover */}
              <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                <span className="text-xs bg-black/70 text-white px-2 py-1 rounded-full">
                  Clique para editar
                </span>
              </div>

              {/* Loading overlay para imagem */}
              {getImageState(slide.num) === 'loading' && (
                <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/80 flex items-center justify-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                  <span className="text-xs text-violet-600 font-medium">gerando imagem...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ações */}
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
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex-1"
                onClick={startEdit}
              >
                Editar texto
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-zinc-400 border border-zinc-700 hover:bg-zinc-800"
                onClick={() => {}}
              >
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

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Aprovados:</span>
          <div className="flex gap-1">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => { setActiveSlide(i); setEditing(false) }}
                className={cn(
                  'w-5 h-5 rounded text-xs font-medium transition-colors',
                  s.approved
                    ? 'bg-green-600 text-white'
                    : i === activeSlide
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-500'
                )}
              >
                {s.num}
              </button>
            ))}
          </div>
        </div>

        {/* Botão gerar imagens */}
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
              {allApproved
                ? '⚡ Gerar Imagens'
                : `Gerar Imagens (${slides.filter(s => s.approved).length}/${slides.length} aprovados)`
              }
            </>
          )}
        </Button>

        {/* Legenda */}
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
