'use client'

/**
 * FrankCard — Replica o visual do tweet-card-renderer.js
 *
 * Fundo branco · DM Sans · Avatar circular · Texto grande · Imagem na base
 * Estilo confirmado em produção no AIOS (T03-56-13)
 */

import { useMemo } from 'react'

export interface FrankCardProps {
  text: string
  imagePath?: string
  authorName: string
  authorHandle: string
  avatarUrl?: string
  highlightColor: string
  showHeader?: boolean
  /** 'portrait' (4:5) | 'square' (1:1) — afeta só o preview */
  format?: 'portrait' | 'square'
}

/**
 * Calcula font size com a mesma lógica do tweet-card-renderer.js
 * Calibrado para portrait 1080×1350 com padding 80px.
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
 *   {texto}   → <span color=highlight bold>
 *   *texto*   → <strong>
 *   _texto_   → <em>
 *   \n        → <br/>
 */
function parseTextToJSX(text: string, highlightColor: string): React.ReactNode[] {
  // Tokeniza por padrões na ordem correta
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
}: FrankCardProps) {
  const fontSize = useMemo(() => autoFontSize(text), [text])
  const content = useMemo(() => parseTextToJSX(text, highlightColor), [text, highlightColor])

  // Aspect ratio: portrait = 4/5, square = 1/1
  const aspectRatio = format === 'portrait' ? '4 / 5' : '1 / 1'

  // Initials fallback para o avatar
  const initials = authorName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Linha-height proporcional
  const lineHeight = fontSize <= 30 ? 1.2 : fontSize <= 36 ? 1.25 : 1.3

  return (
    <div
      style={{
        aspectRatio,
        background: '#ffffff',
        fontFamily: "var(--font-dm-sans, 'DM Sans'), 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
        borderRadius: '12px',
      }}
    >
      {/* ── Header ──────────────────────────────── */}
      {showHeader && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 20px 8px 20px',
          flexShrink: 0,
        }}>
          {/* Avatar */}
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            background: highlightColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={authorName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                {initials}
              </span>
            )}
          </div>

          {/* Nome + handle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', lineHeight: 1.2 }}>
              {authorName}
            </span>
            <span style={{ fontWeight: 400, fontSize: '12px', color: '#888888', lineHeight: 1.2 }}>
              {authorHandle}
            </span>
          </div>
        </div>
      )}

      {/* ── Corpo de texto ──────────────────────── */}
      <div style={{
        flex: imagePath ? '0 1 auto' : '1',
        padding: '12px 20px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
      }}>
        <p style={{
          fontSize: `${fontSize}px`,
          lineHeight,
          color: '#1a1a1a',
          fontWeight: 400,
          wordBreak: 'break-word',
          margin: 0,
        }}>
          {content}
        </p>
      </div>

      {/* ── Imagem inferior ──────────────────────── */}
      {imagePath && (
        <div style={{
          flex: '1 0 80px',
          margin: '0 20px 14px 20px',
          overflow: 'hidden',
          borderRadius: '10px',
          background: '#f0f0f0',
          minHeight: '80px',
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
  )
}
