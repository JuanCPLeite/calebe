'use client'

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
}

interface SplitCardProps {
  slide: SplitSlide
  accentColor?: string
  displayWidth?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Bold({ text, fontSize, color = '#fff' }: { text: string; fontSize: number; color?: string }) {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p style={{
      color, fontSize, lineHeight: 1.45, margin: 0, textAlign: 'center',
      textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.5)',
    }}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </p>
  )
}

// ─── Cover ───────────────────────────────────────────────────────────────────

function CoverContent({ slide, scale, accent }: { slide: SplitSlide; scale: number; accent: string }) {
  const fs = (v: number) => v * scale
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0c0c0c' }}>
      {/* Ambient gradients */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 60% 40%, rgba(180,100,30,0.25) 0%, transparent 55%), radial-gradient(ellipse at 35% 65%, rgba(120,70,20,0.18) 0%, transparent 50%)',
        filter: 'blur(2px)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: `0 ${fs(90)}px`,
        gap: fs(24),
      }}>
        {/* Label pills */}
        <div style={{ display: 'flex', gap: fs(16) }}>
          <span style={{
            background: '#fff', color: '#111', fontWeight: 800, fontSize: fs(22),
            padding: `${fs(6)}px ${fs(22)}px`, borderRadius: fs(4),
          }}>
            {slide.labelEsquerda || 'Errado'}
          </span>
          <span style={{
            background: accent, color: '#fff', fontWeight: 800, fontSize: fs(22),
            padding: `${fs(6)}px ${fs(22)}px`, borderRadius: fs(4),
          }}>
            {slide.labelDireita || 'Certo'}
          </span>
        </div>

        {/* VS divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: fs(24) }}>
          <div style={{ flex: 1, height: fs(1), background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ color: accent, fontWeight: 900, fontSize: fs(28), letterSpacing: fs(2) }}>VS</span>
          <div style={{ flex: 1, height: fs(1), background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Main title */}
        <h1 style={{
          fontFamily: '"Arial Black", "Arial", "Helvetica Neue", sans-serif',
          fontSize: fs(108),
          fontWeight: 900,
          color: '#fff',
          lineHeight: 0.95,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: fs(1),
        }}>
          {slide.text}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: fs(38),
          color: '#bbb',
          fontStyle: 'italic',
          lineHeight: 1.4,
          margin: 0,
        }}>
          {slide.subtitulo}
        </p>
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

function ContentSlideContent({ slide, scale, accent }: { slide: SplitSlide; scale: number; accent: string }) {
  const fs = (v: number) => v * scale
  const titleBarH = CARD_H * 0.19 * scale
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', flexDirection: 'column' }}>
      {/* Title bar */}
      <div style={{
        height: titleBarH,
        background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: `0 ${fs(40)}px`, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <h3 style={{
          fontFamily: '"Arial Black", "Arial", "Helvetica Neue", sans-serif',
          fontSize: fs(48), fontWeight: 900, color: '#fff',
          margin: 0, textAlign: 'center', textTransform: 'uppercase',
          letterSpacing: fs(0.8), lineHeight: 1.1,
        }}>
          {slide.text}
        </h3>
      </div>

      {/* Split area */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── LEFT (negative) ──────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg, #5a3a1e 0%, #3d2815 30%, #1a100a 100%)' }} />
          <Person stressed scale={scale} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.58) 55%, rgba(0,0,0,0.88) 78%, rgba(0,0,0,0.96) 100%)' }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: `0 ${fs(22)}px ${fs(36)}px`, gap: fs(16),
          }}>
            <div style={{ background: '#fff', padding: `${fs(9)}px ${fs(28)}px`, borderRadius: fs(6), boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
              <span style={{ fontWeight: 800, fontSize: fs(26), color: '#111' }}>{slide.labelEsquerda}</span>
            </div>
            <Bold text={slide.esquerda || ''} fontSize={fs(28)} />
          </div>
        </div>

        {/* ── RIGHT (positive) ─────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg, #35363d 0%, #282830 30%, #141418 100%)' }} />
          <Person stressed={false} scale={scale} />
          {/* Accent glow */}
          <div style={{ position: 'absolute', top: '8%', left: '25%', width: '55%', height: '28%', background: `radial-gradient(ellipse, ${accent}18 0%, transparent 70%)` }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.58) 55%, rgba(0,0,0,0.88) 78%, rgba(0,0,0,0.96) 100%)' }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: `0 ${fs(22)}px ${fs(36)}px`, gap: fs(16),
          }}>
            <div style={{ background: accent, padding: `${fs(9)}px ${fs(28)}px`, borderRadius: fs(6), boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
              <span style={{ fontWeight: 800, fontSize: fs(26), color: '#fff' }}>{slide.labelDireita}</span>
            </div>
            <Bold text={slide.direita || ''} fontSize={fs(28)} />
          </div>
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
        {slide.text}
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

export function SplitCard({ slide, accentColor = '#F59E0B', displayWidth = 380 }: SplitCardProps) {
  const scale   = displayWidth / CARD_W
  const displayH = Math.round(CARD_H * scale)

  return (
    <div style={{
      width: displayWidth, height: displayH,
      position: 'relative', overflow: 'hidden',
      background: '#0c0c0c',
      fontFamily: '"DM Sans", "Inter", "Segoe UI", system-ui, sans-serif',
    }}>
      {slide.layout === 'split-cover'   && <CoverContent         slide={slide} scale={scale} accent={accentColor} />}
      {slide.layout === 'split-content' && <ContentSlideContent   slide={slide} scale={scale} accent={accentColor} />}
      {slide.layout === 'split-cta'     && <CtaContent            slide={slide} scale={scale} accent={accentColor} />}
    </div>
  )
}
