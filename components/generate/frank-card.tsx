'use client'

/**
 * FrankCard — Preview pixel-perfect do card Instagram
 *
 * Renderiza internamente a 1080×1350px (portrait real) usando as mesmas
 * proporções que card-renderer.ts, depois aplica CSS scale para caber
 * no layout. O que você vê aqui é exatamente o que vai ser gerado.
 */

import { useMemo } from 'react'

// ─── Dimensões reais do Instagram Portrait ─────────────────────────────────────
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
  /** 'portrait' (4:5) | 'square' (1:1) */
  format?: 'portrait' | 'square'
  /** Percentual da altura do card ocupado pela imagem (10–75). Default 45. */
  imageHeightPercent?: number
  /** Largura de exibição em px — o card é renderizado em 1080px e escalado. Default: 380 */
  displayWidth?: number
}

/**
 * Idêntico ao autoFontSize de card-renderer.ts — calibrado para 1080px.
 */
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

/**
 * Converte sintaxe do AIOS para JSX:
 *   {texto}  → destaque na cor do expert
 *   *texto*  → negrito
 *   _texto_  → itálico
 *   \n       → <br/>
 */
function parseTextToJSX(text: string, highlightColor: string): React.ReactNode[] {
  const parts = text.split(/(\{[^}]+\}|\*[^*]+\*|_[^_]+_|\n)/g)
  return parts.map((part, i) => {
    if (part === '\n') return <br key={i} />
    if (part.startsWith('{') && part.endsWith('}')) {
      return (
        <span key={i} style={{ color: highlightColor, fontWeight: 700 }}>
          {part.slice(1, -1)}
        </span>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <strong key={i}>{part.slice(1, -1)}</strong>
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
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
  displayWidth = 380,
}: FrankCardProps) {
  const cardW = CARD_W
  const cardH = format === 'square' ? CARD_W : CARD_H

  // Fator de escala: do tamanho real para o display
  const scale = displayWidth / cardW
  const displayHeight = Math.round(cardH * scale)

  // ── Proporções idênticas ao card-renderer.ts ───────────────────────────────
  const padH        = Math.round(cardW * 0.074)          // 80px
  const padV        = Math.round(cardH * 0.048)          // 65px
  const avatarSize  = Math.round(cardW * 0.078)          // 84px
  const bottomPad   = Math.round(cardW * 0.055)          // 59px
  const imgHeightPx = imagePath ? Math.round(cardH * imageHeightPercent / 100) : 0
  const imgRadius   = Math.round(cardW * 0.022)          // 24px

  const fontSize   = useMemo(() => autoFontSize(text), [text])
  const lineHeight = fontSize <= 30 ? 1.2 : fontSize <= 36 ? 1.25 : 1.3
  const content    = useMemo(() => parseTextToJSX(text, highlightColor), [text, highlightColor])

  const initials = authorName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    // Container externo: reserva o espaço exato no layout
    <div style={{
      width:    displayWidth,
      height:   displayHeight,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      flexShrink: 0,
    }}>
      {/* Card interno: tamanho real (1080×1350), escalado via transform */}
      <div style={{
        width:           cardW,
        height:          cardH,
        position:        'absolute',
        top:             0,
        left:            0,
        transform:       `scale(${scale})`,
        transformOrigin: 'top left',
        background:      '#ffffff',
        fontFamily:      "'DM Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        display:         'flex',
        flexDirection:   'column',
        paddingBottom:   bottomPad,
        overflow:        'hidden',
      }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        {showHeader && (
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        Math.round(avatarSize * 0.25),
            padding:    `${Math.round(padV * 0.80)}px ${padH}px ${Math.round(padV * 0.25)}px ${padH}px`,
            flexShrink: 0,
          }}>
            {/* Avatar */}
            <div style={{
              width:           avatarSize,
              height:          avatarSize,
              borderRadius:    '50%',
              overflow:        'hidden',
              flexShrink:      0,
              background:      highlightColor,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={authorName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{
                  color:      '#fff',
                  fontWeight: 700,
                  fontSize:   Math.round(avatarSize * 0.5),
                }}>
                  {initials}
                </span>
              )}
            </div>

            {/* Nome + handle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(avatarSize * 0.06) }}>
              <span style={{
                fontWeight: 700,
                fontSize:   Math.round(avatarSize * 0.38),
                color:      '#1a1a1a',
                lineHeight: 1.2,
              }}>
                {authorName}
              </span>
              <span style={{
                fontWeight: 400,
                fontSize:   Math.round(avatarSize * 0.30),
                color:      '#888888',
                lineHeight: 1.2,
              }}>
                {authorHandle}
              </span>
            </div>
          </div>
        )}

        {/* ── Corpo do texto ───────────────────────────────────────────── */}
        <div style={{
          flex:       1,
          minHeight:  0,
          padding:    `${Math.round(padV * 0.85)}px ${padH}px`,
          overflow:   'hidden',
          display:    'flex',
          alignItems: 'flex-start',
        }}>
          <p style={{
            fontSize,
            lineHeight,
            color:      '#1a1a1a',
            fontWeight: 400,
            wordBreak:  'break-word',
            margin:     0,
          }}>
            {content}
          </p>
        </div>

        {/* ── Imagem inferior ──────────────────────────────────────────── */}
        {imagePath && (
          <div style={{
            flexBasis:    imgHeightPx,
            flexShrink:   0,
            flexGrow:     0,
            margin:       `0 ${padH}px ${Math.round(padV * 0.4)}px ${padH}px`,
            overflow:     'hidden',
            borderRadius: imgRadius,
            background:   '#f0f0f0',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePath}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
