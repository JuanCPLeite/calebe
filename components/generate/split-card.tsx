'use client'

import { useRef, useEffect } from 'react'

// ── SplitCard — Card comparativo "X vs Y" ────────────────────────────────────
// Renderiza internamente a 1080×1350px (mesmo CARD_W/H do FrankCard)
// e aplica CSS scale para o displayWidth solicitado.
//
// Layouts suportados:
//  • split-cover   — capa com título + subtítulo + labels
//  • split-content — slide comparativo (dois lados, imagens + texto sobreposto)
//  • split-cta     — slide final com pergunta + CTA + hashtags

const CARD_W = 1080
const CARD_H = 1350

// ── Cover title auto font-size ────────────────────────────────────────────────
const COVER_W       = CARD_W - 2 * 88  // 904px — largura útil do título da capa
const ARIAL_BLACK_R = 0.72             // largura média do char / fontSize para Arial Black maiúsculo

function calcCoverFontSize(leftTitle: string, rightTitle: string): number {
  const cleanRight = rightTitle.replace(/^VS\.?\s*/i, '')
  const words = [...leftTitle.split(/\s+/), ...cleanRight.split(/\s+/)].filter(Boolean)
  if (!words.length) return 106
  const longest = words.reduce((a, b) => a.length > b.length ? a : b)
  return Math.min(106, Math.max(48, Math.floor(COVER_W / (longest.length * ARIAL_BLACK_R))))
}

// ── Inline markdown para títulos ─────────────────────────────────────────────
// Processa **bold** e {acento} dentro de h2/h3 sem o wrapper <p> do Bold
function SlideTitle({ text, accent }: { text: string; accent: string }) {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*|\{[^}]+\})/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <span key={i}>{part.slice(2, -2)}</span>
        if (part.startsWith('{') && part.endsWith('}'))
          return <span key={i} style={{ color: accent }}>{part.slice(1, -1)}</span>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export interface SplitSlide {
  num: number
  type: string
  layout: 'split-cover' | 'split-content' | 'split-cta'
  text: string
  subtitulo?: string
  esquerda?: string
  direita?: string
  labelEsquerda?: string
  labelDireita?: string
  subtexto?: string
  hashtags?: string
  cardPath?: string
  approved?: boolean
  imagePrompt?: string
  imagePath?: string
}

interface SplitCardProps {
  slide: SplitSlide
  accentColor?: string
  displayWidth?: number
  contentIndex?: number
  onCoverTitleChange?: (text: string) => void
  onCoverSubtitleChange?: (text: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Bold({ text, fontSize, color = '#fff', accent = '#F59E0B' }: { text: string; fontSize: number; color?: string; accent?: string }) {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*|\{[^}]+\})/g)
  return (
    <p style={{
      color, fontSize, lineHeight: 1.45, margin: 0, textAlign: 'center',
      textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.5)',
    }}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>
        if (part.startsWith('{') && part.endsWith('}'))
          return <span key={i} style={{ fontWeight: 800, textTransform: 'uppercase', color: accent }}>{part.slice(1, -1)}</span>
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

// ─── Cover ───────────────────────────────────────────────────────────────────

function CoverContent({
  slide, scale, accent, onTitleChange, onSubtitleChange,
}: {
  slide: SplitSlide; scale: number; accent: string
  onTitleChange?: (text: string) => void
  onSubtitleChange?: (text: string) => void
}) {
  const fs = (v: number) => v * scale

  // Strip markdown markers before displaying as plain title
  const rawText = slide.text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\{([^}]+)\}/g, '$1')
  const vsMatch = rawText.match(/^(.+?)\s+VS\.?\s+(.+)$/i)
  const leftTitle  = vsMatch ? vsMatch[1].trim().toUpperCase() : rawText.toUpperCase()
  const rightTitle = vsMatch ? vsMatch[2].trim().toUpperCase() : ''

  // Refs para edição inline (contentEditable sem conflito com React)
  const leftRef  = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const subRef   = useRef<HTMLParagraphElement>(null)

  // Sincroniza DOM quando o conteúdo muda externamente (sem re-renderizar o caret)
  useEffect(() => {
    if (leftRef.current && document.activeElement !== leftRef.current)
      leftRef.current.textContent = leftTitle
    if (rightRef.current && document.activeElement !== rightRef.current)
      rightRef.current.textContent = rightTitle ? `VS. ${rightTitle}` : 'VS.'
  }, [leftTitle, rightTitle])

  useEffect(() => {
    if (subRef.current && document.activeElement !== subRef.current)
      subRef.current.textContent = slide.subtitulo || ''
  }, [slide.subtitulo])

  function handleTitleBlur() {
    if (!onTitleChange) return
    const l    = (leftRef.current?.textContent || '').trim()
    const rRaw = (rightRef.current?.textContent || 'VS.').trim()
    const r    = rRaw.replace(/^VS\.?\s*/i, '').trim()
    onTitleChange(l + (r ? ` VS. ${r}` : ''))
  }

  const editable = !!onTitleChange
  const editHint = editable
    ? { cursor: 'text', outline: 'none', borderRadius: 4,
        transition: 'background 0.15s',
        ':hover': { background: 'rgba(255,255,255,0.06)' } }
    : { outline: 'none' }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }}>

      {/* ── Foto de fundo desfocada (quando disponível) ── */}
      {slide.imagePath ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.imagePath}
            alt=""
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              filter: `blur(${fs(22)}px)`,
              transform: 'scale(1.08)',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.60) 100%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 22%, transparent 72%, rgba(0,0,0,0.65) 100%)',
          }} />
        </>
      ) : (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 68% 45%, rgba(160,90,20,0.30) 0%, transparent 55%), radial-gradient(ellipse at 30% 70%, rgba(100,55,15,0.20) 0%, transparent 50%)',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
        </>
      )}

      {/* ── Texto ── */}
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start',
        padding: `${fs(100)}px ${fs(88)}px`,
        gap: fs(28),
      }}>
        {/* Hint visual de editável */}
        {editable && (
          <div style={{
            position: 'absolute', top: fs(18), right: fs(18),
            fontSize: fs(18), color: 'rgba(255,255,255,0.35)',
            fontFamily: 'system-ui', pointerEvents: 'none',
          }}>
            ✎
          </div>
        )}

        {/* Título: ESQUERDA / VS. DIREITA — cada linha editável independente */}
        <div style={{
          fontFamily: '"Arial Black", "Arial", "Helvetica Neue", sans-serif',
          fontWeight: 900,
          textTransform: 'uppercase',
          fontSize: fs(calcCoverFontSize(leftTitle, rightTitle ? `VS. ${rightTitle}` : 'VS.')),
          color: '#fff',
          lineHeight: 0.9,
          letterSpacing: fs(0.5),
          width: '100%',
          textAlign: 'left',
          overflowWrap: 'normal',
          wordBreak: 'normal',
        }}>
          <div
            ref={leftRef}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={handleTitleBlur}
            style={{ textAlign: 'left', ...editHint, padding: editable ? `${fs(4)}px ${fs(6)}px` : 0 }}
          >
            {leftTitle}
          </div>
          <div
            ref={rightRef}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={handleTitleBlur}
            style={{ textAlign: 'left', marginTop: fs(12), ...editHint, padding: editable ? `${fs(4)}px ${fs(6)}px` : 0 }}
          >
            {rightTitle ? `VS. ${rightTitle}` : 'VS.'}
          </div>
        </div>

        {/* Subtítulo — editável quando handler fornecido */}
        {(slide.subtitulo || onSubtitleChange) && (
          <p
            ref={subRef}
            contentEditable={!!onSubtitleChange}
            suppressContentEditableWarning
            onBlur={() => onSubtitleChange?.((subRef.current?.textContent || '').trim())}
            style={{
              fontSize: fs(38), color: '#d4d4d4', lineHeight: 1.45, margin: 0, fontWeight: 400,
              outline: 'none',
              cursor: onSubtitleChange ? 'text' : 'default',
              padding: onSubtitleChange ? `${fs(4)}px ${fs(6)}px` : 0,
            }}
          >
            {slide.subtitulo}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Content (split) ─────────────────────────────────────────────────────────

function Person({ stressed, scale }: { stressed: boolean; scale: number }) {
  const fs = (v: number) => v * scale
  const skinColor = stressed ? '#c49060' : '#d4a070'
  const bodyColor = stressed
    ? 'linear-gradient(180deg, #c47a30 0%, #a86520 100%)'
    : 'linear-gradient(180deg, #2a2a32 0%, #1a1a20 100%)'
  return (
    <div style={{
      position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)',
      width: fs(200), height: fs(300),
    }}>
      {/* Hair */}
      <div style={{
        width: fs(120), height: fs(62), borderRadius: '50% 50% 0 0',
        background: stressed ? 'linear-gradient(180deg, #3d2510 0%, #5a3515 100%)' : 'linear-gradient(180deg, #2a1808 0%, #3d2510 100%)',
        position: 'absolute', top: fs(-8), left: '50%', transform: 'translateX(-50%)',
      }} />
      {/* Head */}
      <div style={{
        width: fs(110), height: fs(110), borderRadius: '50%',
        background: `radial-gradient(circle at ${stressed ? '45%' : '50%'} 40%, ${skinColor} 0%, #8a6035 60%, #5a3d20 100%)`,
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }} />
      {/* Body */}
      <div style={{
        width: fs(196), height: fs(170),
        background: bodyColor,
        borderRadius: `${fs(24)}px ${fs(24)}px 0 0`,
        position: 'absolute', top: fs(94), left: '50%', transform: 'translateX(-50%)',
      }} />
      {stressed ? (
        /* Hand on head (stress) */
        <div style={{
          width: fs(38), height: fs(38), borderRadius: '50%',
          background: skinColor,
          position: 'absolute', top: fs(14), right: '12%',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      ) : (
        /* Pointing hand (confident) */
        <div style={{
          width: fs(46), height: fs(23), background: skinColor,
          borderRadius: fs(12), position: 'absolute', top: fs(68), right: '4%',
          transform: 'rotate(-30deg)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      )}
    </div>
  )
}

function ContentSlideContent({
  slide, scale, accent, contentIndex,
}: { slide: SplitSlide; scale: number; accent: string; contentIndex?: number }) {
  const fs = (v: number) => v * scale

  // Tag fica como divisória visual na fronteira imagem/texto a 62% do topo.
  // transform: translate(-50%, -50%) centraliza o tag verticalmente nessa linha.
  // Texto começa logo abaixo do tag e ocupa o espaço restante até o fundo.
  const TAG_TOP = 62 // % do topo

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#111' }}>
      {/* ── Imagem full-card (split-screen gerado pelo Gemini) ── */}
      {slide.imagePath && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.imagePath}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
            }}
          />
          {/* Vinheta superior leve para o título */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.08) 18%, transparent 38%)',
          }} />
        </>
      )}

      {/* ── LEFT HALF ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', overflow: 'hidden' }}>
        {!slide.imagePath ? (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg, #5a3a1e 0%, #3d2815 30%, #1a100a 100%)' }} />
            <Person stressed scale={scale} />
          </>
        ) : null}

        {/* Gradiente escurece da tag para baixo */}
        <div style={{
          position: 'absolute',
          top: `${TAG_TOP - 18}%`,
          left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.58) 22%, rgba(0,0,0,0.88) 50%, rgba(0,0,0,0.96) 100%)',
        }} />

        {/* Vinheta lateral esquerda */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)',
        }} />

        {/* TAG — divisória fixa em TAG_TOP% */}
        <div style={{
          position: 'absolute',
          top: `${TAG_TOP}%`,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          padding: `${fs(12)}px ${fs(30)}px`,
          borderRadius: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap',
          zIndex: 3,
        }}>
          <span style={{ fontWeight: 800, fontSize: fs(28), color: '#111' }}>{slide.labelEsquerda}</span>
        </div>

        {/* TEXTO — começa logo após o tag, ocupa resto do espaço */}
        <div style={{
          position: 'absolute',
          top: `calc(${TAG_TOP}% + ${fs(56)}px)`,
          left: 0, right: 0, bottom: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: `${fs(10)}px ${fs(20)}px ${fs(36)}px`,
          zIndex: 2,
        }}>
          <Bold text={slide.esquerda || ''} fontSize={fs(34)} accent={accent} />
        </div>
      </div>

      {/* ── RIGHT HALF ── */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', overflow: 'hidden' }}>
        {!slide.imagePath ? (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg, #35363d 0%, #282830 30%, #141418 100%)' }} />
            <Person stressed={false} scale={scale} />
            <div style={{ position: 'absolute', top: '8%', left: '25%', width: '55%', height: '28%', background: `radial-gradient(ellipse, ${accent}18 0%, transparent 70%)` }} />
          </>
        ) : null}

        {/* Gradiente escurece da tag para baixo */}
        <div style={{
          position: 'absolute',
          top: `${TAG_TOP - 18}%`,
          left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.58) 22%, rgba(0,0,0,0.88) 50%, rgba(0,0,0,0.96) 100%)',
        }} />

        {/* Vinheta lateral direita */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to left, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)',
        }} />

        {/* TAG — divisória fixa em TAG_TOP% */}
        <div style={{
          position: 'absolute',
          top: `${TAG_TOP}%`,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: accent,
          padding: `${fs(12)}px ${fs(30)}px`,
          borderRadius: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap',
          zIndex: 3,
        }}>
          <span style={{ fontWeight: 800, fontSize: fs(28), color: '#fff' }}>{slide.labelDireita}</span>
        </div>

        {/* TEXTO — começa logo após o tag, ocupa resto do espaço */}
        <div style={{
          position: 'absolute',
          top: `calc(${TAG_TOP}% + ${fs(56)}px)`,
          left: 0, right: 0, bottom: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: `${fs(10)}px ${fs(20)}px ${fs(36)}px`,
          zIndex: 2,
        }}>
          <Bold text={slide.direita || ''} fontSize={fs(34)} accent={accent} />
        </div>
      </div>

      {/* ── Título — overlay no topo ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: fs(240),
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 62%, transparent 100%)',
        }} />
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `${fs(64)}px ${fs(36)}px ${fs(24)}px`,
        }}>
          <h3 style={{
            fontFamily: '"Arial Black", "Arial", "Helvetica Neue", sans-serif',
            fontSize: fs(44), fontWeight: 900, color: '#fff',
            margin: 0, textAlign: 'center', textTransform: 'uppercase',
            letterSpacing: fs(0.6), lineHeight: 1.15,
            textShadow: '0 2px 10px rgba(0,0,0,0.9)',
          }}>
            {contentIndex != null ? `${contentIndex}. ` : ''}<SlideTitle text={slide.text} accent={accent} />
          </h3>
        </div>
      </div>

    </div>
  )
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function CtaContent({ slide, scale, accent }: { slide: SplitSlide; scale: number; accent: string }) {
  const fs = (v: number) => v * scale
  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#0c0c0c',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `0 ${fs(100)}px`, textAlign: 'center', gap: fs(36),
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 45%, ${accent}1a 0%, transparent 60%)` }} />

      {/* Question mark circle */}
      <div style={{
        width: fs(156), height: fs(156), borderRadius: '50%',
        border: `${fs(5)}px solid ${accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}>
        <span style={{ fontWeight: 900, fontSize: fs(88), color: accent, lineHeight: 1 }}>?</span>
      </div>

      {/* Question */}
      <h2 style={{
        fontFamily: '"Arial Black", "Arial", "Helvetica Neue", sans-serif',
        fontSize: fs(72), fontWeight: 900, color: '#fff',
        lineHeight: 1.1, margin: 0, textTransform: 'uppercase',
        position: 'relative', zIndex: 1,
      }}>
        <SlideTitle text={slide.text} accent={accent} />
      </h2>

      {/* Subtext */}
      <p style={{ fontSize: fs(36), color: '#888', lineHeight: 1.5, margin: 0, position: 'relative', zIndex: 1 }}>
        {slide.subtexto}
      </p>

      {/* CTA button */}
      <div style={{
        background: accent, padding: `${fs(24)}px ${fs(80)}px`,
        borderRadius: fs(80), boxShadow: `0 4px 20px ${accent}40`,
        position: 'relative', zIndex: 1,
      }}>
        <span style={{ fontWeight: 800, fontSize: fs(34), color: '#000', letterSpacing: 1 }}>
          COMENTE ABAIXO
        </span>
      </div>

      {/* Hashtags */}
      <p style={{ fontSize: fs(26), color: '#3a3a3a', margin: 0, letterSpacing: 0.5, position: 'relative', zIndex: 1 }}>
        {slide.hashtags}
      </p>
    </div>
  )
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function SplitCard({
  slide, accentColor = '#F59E0B', displayWidth = 380,
  contentIndex, onCoverTitleChange, onCoverSubtitleChange,
}: SplitCardProps) {
  const scale    = displayWidth / CARD_W
  const displayH = Math.round(CARD_H * scale)

  // Renderiza o card em resolução nativa (1080×1350) e aplica CSS transform para
  // escalar visualmente. Isso evita o tamanho mínimo de fonte do browser que
  // distorce tags e elementos pequenos nas miniaturas.
  return (
    <div style={{
      width: displayWidth, height: displayH,
      position: 'relative', overflow: 'hidden',
      fontFamily: '"DM Sans", "Inter", "Segoe UI", system-ui, sans-serif',
    }}>
      <div style={{
        width: CARD_W, height: CARD_H,
        position: 'absolute', top: 0, left: 0,
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
        background: '#0c0c0c',
      }}>
        {slide.layout === 'split-cover'   && (
          <CoverContent
            slide={slide} scale={1} accent={accentColor}
            onTitleChange={onCoverTitleChange}
            onSubtitleChange={onCoverSubtitleChange}
          />
        )}
        {slide.layout === 'split-content' && (
          <ContentSlideContent slide={slide} scale={1} accent={accentColor} contentIndex={contentIndex} />
        )}
        {slide.layout === 'split-cta'     && <CtaContent slide={slide} scale={1} accent={accentColor} />}
      </div>
    </div>
  )
}
