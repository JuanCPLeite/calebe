'use client'

/**
 * FrankCard — Preview pixel-perfect do card Instagram
 *
 * Renderiza internamente a 1080×1350px com as mesmas proporções de
 * card-renderer.ts, depois aplica CSS scale. O que você vê = o que será gerado.
 *
 * Features:
 * - Drag handle sempre visível → resize da imagem por slide
 * - Drag na imagem → reposiciona objectPosition X/Y
 * - Click no texto → abre textarea inline para edição
 */

import { useMemo, useRef, useState } from 'react'

const CARD_W = 1080
const CARD_H = 1350

export interface FrankCardProps {
  text: string
  imagePath?: string
  authorName: string
  authorHandle: string
  avatarUrl?: string
  highlightColor: string
  showHeader?: boolean
  format?: 'portrait' | 'square'
  imageHeightPercent?: number
  imagePosition?: 'top' | 'bottom'
  imageObjectX?: number
  imageObjectY?: number
  displayWidth?: number
  onImageHeightPercentChange?: (v: number) => void
  onImageObjectChange?: (x: number, y: number) => void
  onTextChange?: (text: string) => void
}

function autoFontSize(text: string): number {
  const len = text.length
  const lineCount = text.split('\n').filter(l => l.trim().length > 0).length
  if (lineCount > 16 || len > 650) return 30
  if (lineCount > 12 || len > 450) return 34
  if (lineCount > 8  || len > 340) return 38
  if (lineCount > 5  || len > 200) return 44
  if (len < 120)                   return 58
  return 50
}

function parseTextToJSX(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_|\n)/g)
  return parts.map((part, i) => {
    if (part === '\n') return <br key={i} />
    if (part.startsWith('*') && part.endsWith('*'))
      return <strong key={i}>{part.slice(1, -1)}</strong>
    if (part.startsWith('_') && part.endsWith('_'))
      return <em key={i}>{part.slice(1, -1)}</em>
    return part.replace(/\{([^}]+)\}/g, '$1')
  })
}

export function FrankCard({
  text,
  imagePath,
  authorName,
  authorHandle,
  avatarUrl,
  highlightColor,
  showHeader = true,
  format = 'portrait',
  imageHeightPercent = 45,
  imagePosition = 'bottom',
  imageObjectX = 50,
  imageObjectY = 50,
  displayWidth = 380,
  onImageHeightPercentChange,
  onImageObjectChange,
  onTextChange,
}: FrankCardProps) {
  const [handleHovered, setHandleHovered] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartPct = useRef(0)
  const imgDragStartX = useRef(0)
  const imgDragStartY = useRef(0)
  const imgDragStartObjX = useRef(imageObjectX)
  const imgDragStartObjY = useRef(imageObjectY)

  const cardW     = CARD_W
  const cardH     = format === 'square' ? CARD_W : CARD_H
  const scale     = displayWidth / cardW
  const displayHeight = Math.round(cardH * scale)

  // ── Proporções idênticas a card-renderer.ts ──────────────────────────────
  const padV       = Math.round(cardH * 0.048)          // 65px
  const padH       = Math.round(cardW * 0.074)          // 80px
  const avatarSize = Math.round(cardW * 0.078)          // 84px
  const bottomPad  = Math.round(cardW * 0.055)          // 59px
  const imgRadius  = Math.round(cardW * 0.022)          // 24px
  const imgMarginB = imagePosition === 'bottom' ? Math.round(padV * 0.4) : 0
  const imgMarginT = imagePosition === 'top'    ? Math.round(padV * 0.3) : 0

  // imageHeightPercent é reutilizado como "espaço extra entre texto e imagem" (0-40%)
  // Valores > 40 são legados (formato antigo) e tratados como 0
  const textExtraPct   = imageHeightPercent > 40 ? 0 : imageHeightPercent
  const textBottomPadPx = Math.round(cardH * textExtraPct / 100)

  const headerInternalH = showHeader
    ? Math.round(padV * 0.80) + avatarSize + Math.round(padV * 0.25)
    : 0

  const fontSize   = useMemo(() => autoFontSize(text), [text])
  const lineHeight = fontSize <= 30 ? 1.2 : fontSize <= 36 ? 1.25 : 1.3
  const content    = useMemo(() => parseTextToJSX(text), [text])
  const initials   = authorName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Estimativa da altura do bloco de texto para posicionar o handle e a textarea
  const bodyPadV      = Math.round(padV * 0.85)
  const textW         = cardW - 2 * padH
  const charsPerLine  = Math.max(1, Math.floor(textW / (fontSize * 0.52)))
  const wrappedLines  = text.split('\n').reduce((acc, line) => {
    const stripped = line.replace(/[*_{}\[\]]/g, '')
    return acc + Math.max(1, Math.ceil((stripped.length || 1) / charsPerLine))
  }, 0)
  const textContentH   = wrappedLines * fontSize * lineHeight
  const estimatedBodyH = textContentH + bodyPadV * 2

  // Y do handle em display pixels — na fronteira entre texto+spacer e imagem
  const handleY = imagePosition === 'bottom'
    ? (headerInternalH + estimatedBodyH + textBottomPadPx) * scale
    : (cardH - bottomPad - estimatedBodyH - textBottomPadPx) * scale

  // Coordenadas da textarea inline (em display pixels)
  const bodyTopInCard = imagePosition === 'top'
    ? cardH - bottomPad - estimatedBodyH
    : headerInternalH
  const textareaTop    = bodyTopInCard * scale
  const textareaLeft   = padH * scale
  const textareaWidth  = (cardW - 2 * padH) * scale
  const textareaHeight = estimatedBodyH * scale
  const textareaFontSize  = fontSize * scale
  const textareaBodyPadV  = bodyPadV * scale

  // ── Drag do handle — controla o espaço extra entre texto e imagem ────────
  function startDrag(e: React.MouseEvent) {
    if (!onImageHeightPercentChange) return
    e.preventDefault()
    isDragging.current   = true
    dragStartY.current   = e.clientY
    dragStartPct.current = textExtraPct

    function onMove(ev: MouseEvent) {
      const dy    = ev.clientY - dragStartY.current
      // bottom: arrastar para baixo aumenta o espaço; top: arrastar para cima aumenta
      const delta = (imagePosition === 'top' ? -dy : dy) / displayHeight * 100
      const next  = Math.max(0, Math.min(40, dragStartPct.current + delta))
      onImageHeightPercentChange!(Math.round(next))
    }
    function onUp() {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Drag da imagem para reposicionar objectPosition ───────────────────────
  function startImgDrag(e: React.MouseEvent) {
    if (!onImageObjectChange || !imagePath) return
    e.preventDefault()
    e.stopPropagation()
    imgDragStartX.current    = e.clientX
    imgDragStartY.current    = e.clientY
    imgDragStartObjX.current = imageObjectX
    imgDragStartObjY.current = imageObjectY

    const imageDisplayW = (cardW - 2 * padH) * scale
    // Estimativa da altura da imagem em display (espaço restante após texto e spacer)
    const imageDisplayH = Math.max(50, displayHeight - (headerInternalH + estimatedBodyH + textBottomPadPx) * scale)

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - imgDragStartX.current
      const dy = ev.clientY - imgDragStartY.current
      const newX = Math.max(0, Math.min(100, imgDragStartObjX.current - dx / imageDisplayW * 100))
      const newY = Math.max(0, Math.min(100, imgDragStartObjY.current - dy / imageDisplayH * 100))
      onImageObjectChange!(Math.round(newX), Math.round(newY))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Blocos ────────────────────────────────────────────────────────────────
  const imageBlock = (
    <div
      onMouseDown={startImgDrag}
      style={{
        flex:         '1 1 0',
        minHeight:    0,
        margin:       `${imgMarginT}px ${padH}px ${imgMarginB}px ${padH}px`,
        overflow:     'hidden',
        borderRadius: imgRadius,
        background:   imagePath ? '#f0f0f0' : '#f7f7f7',
        border:       imagePath ? 'none' : '4px dashed #d1d5db',
        display:      'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column' as const, gap: 16,
        cursor:       imagePath && onImageObjectChange ? 'grab' : 'default',
      }}
    >
      {imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagePath}
          alt=""
          draggable={false}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            objectPosition: `${imageObjectX}% ${imageObjectY}%`,
            userSelect: 'none', pointerEvents: 'none',
          }}
        />
      ) : (
        <>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
            stroke="#c8c8c8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span style={{ fontSize: 28, color: '#bebebe', fontWeight: 500, textAlign: 'center', padding: '0 60px', lineHeight: 1.4 }}>
            Imagem será gerada aqui
          </span>
        </>
      )}
    </div>
  )

  const spacer = <div style={{ flexShrink: 0, height: textBottomPadPx }} />

  const bodyBlock = (
    <div
      onClick={() => { if (onTextChange && !editingText) setEditingText(true) }}
      style={{
        flexShrink: 0,
        padding: `${bodyPadV}px ${padH}px`,
        display: 'flex', alignItems: 'flex-start',
        cursor: onTextChange ? 'text' : 'default',
      }}
    >
      <p style={{ fontSize, lineHeight, color: '#1a1a1a', fontWeight: 400, wordBreak: 'break-word', margin: 0 }}>
        {content}
      </p>
    </div>
  )

  return (
    <div style={{
      width: displayWidth, height: displayHeight,
      position: 'relative', overflow: 'hidden',
      borderRadius: 12, flexShrink: 0,
    }}>
      {/* Card interno — renderizado em 1080px, escalado */}
      <div style={{
        width: cardW, height: cardH,
        position: 'absolute', top: 0, left: 0,
        transform: `scale(${scale})`, transformOrigin: 'top left',
        background: '#ffffff',
        fontFamily: "var(--font-dm-sans, 'DM Sans'), 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        display: 'flex', flexDirection: 'column',
        paddingBottom: bottomPad, overflow: 'hidden',
      }}>
        {/* Header */}
        {showHeader && (
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: Math.round(avatarSize * 0.25),
            padding: `${Math.round(padV * 0.80)}px ${padH}px ${Math.round(padV * 0.25)}px ${padH}px`,
            flexShrink: 0,
          }}>
            <div style={{
              width: avatarSize, height: avatarSize, borderRadius: '50%',
              overflow: 'hidden', flexShrink: 0, background: highlightColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#fff', fontWeight: 700, fontSize: Math.round(avatarSize * 0.5) }}>{initials}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(avatarSize * 0.06) }}>
              <span style={{ fontWeight: 700, fontSize: Math.round(avatarSize * 0.38), color: '#1a1a1a', lineHeight: 1.2 }}>
                {authorName}
              </span>
              <span style={{ fontWeight: 400, fontSize: Math.round(avatarSize * 0.30), color: '#888888', lineHeight: 1.2 }}>
                {authorHandle}
              </span>
            </div>
          </div>
        )}

        {/* Corpo + spacer + imagem na ordem correta — imagem preenche o espaço restante */}
        {imagePosition === 'top'
          ? <>{imageBlock}{spacer}{bodyBlock}</>
          : <>{bodyBlock}{spacer}{imageBlock}</>
        }
      </div>

      {/* ── Drag handle — sempre visível ─────────────────────────────────── */}
      <div
        onMouseDown={startDrag}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        title="Arraste para redimensionar a imagem"
        style={{
          position: 'absolute',
          left: 0, right: 0,
          top: Math.max(4, handleY - 12),
          height: 24,
          cursor: onImageHeightPercentChange ? 'ns-resize' : 'default',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          width: '55%',
          height: handleHovered ? 5 : 3,
          background: handleHovered ? '#7c3aed' : 'rgba(124, 58, 237, 0.65)',
          borderRadius: 4,
          transition: 'all 0.12s ease',
          boxShadow: handleHovered ? '0 0 8px rgba(124,58,237,0.5)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}>
          {[0,1,2].map(d => (
            <div key={d} style={{
              width: 3, height: 3,
              borderRadius: '50%',
              background: handleHovered ? '#fff' : 'rgba(255,255,255,0.7)',
              flexShrink: 0,
            }} />
          ))}
        </div>
      </div>

      {/* ── Textarea inline de edição ─────────────────────────────────────── */}
      {editingText && onTextChange && (
        <textarea
          autoFocus
          value={text}
          onChange={e => onTextChange(e.target.value)}
          onBlur={() => setEditingText(false)}
          style={{
            position: 'absolute',
            top: textareaTop,
            left: textareaLeft,
            width: textareaWidth,
            height: textareaHeight,
            fontSize: textareaFontSize,
            lineHeight,
            fontFamily: "var(--font-dm-sans, 'DM Sans'), 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 400,
            color: '#1a1a1a',
            background: 'rgba(255,255,255,0.93)',
            border: '2px solid #7c3aed',
            borderRadius: 8,
            padding: `${textareaBodyPadV}px 0`,
            resize: 'none',
            outline: 'none',
            zIndex: 40,
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  )
}
