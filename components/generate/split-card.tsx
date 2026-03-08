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
  imagePath?: string
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

  // Quebra "ESQUERDA VS. DIREITA" em duas partes para o título
  const vsMatch = slide.text.match(/^(.+?)\s+VS\.?\s+(.+)$/i)
  const leftTitle  = vsMatch ? vsMatch[1].trim().toUpperCase() : slide.text.toUpperCase()
  const rightTitle = vsMatch ? vsMatch[2].trim().toUpperCase() : ''

  // Suporte a **negrito** no subtítulo
  const subtitleParts = slide.subtitulo
    ? slide.subtitulo.split(/(\*\*[^*]+\*\*)/g)
    : []

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
          {/* Overlay horizontal: escuro à esquerda, deixa foto aparecer à direita */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.60) 100%)',
          }} />
          {/* Overlay vertical: escurece topo e base */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 22%, transparent 72%, rgba(0,0,0,0.65) 100%)',
          }} />
        </>
      ) : (
        /* Sem foto: gradiente ambiente quente como fallback */
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
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: `${fs(100)}px ${fs(88)}px`,
        gap: fs(28),
      }}>
        {/* Título 4 linhas: ESQUERDA (1-2) / VS. DIREITA (3-4) */}
        <div style={{
          fontFamily: '"Arial Black", "Arial", "Helvetica Neue", sans-serif',
          fontWeight: 900,
          textTransform: 'uppercase',
          fontSize: fs(106),
          color: '#fff',
          lineHeight: 0.9,
          letterSpacing: fs(0.5),
        }}>
          <div>{leftTitle}</div>
          <div style={{ marginTop: fs(12) }}>
            {rightTitle ? `VS. ${rightTitle}` : 'VS.'}
          </div>
        </div>

        {/* Subtítulo — sem itálico, com **negrito** para ênfase */}
        {slide.subtitulo && (
          <p style={{ fontSize: fs(38), color: '#d4d4d4', lineHeight: 1.45, margin: 0, fontWeight: 400 }}>
            {subtitleParts.map((part, i) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={i} style={{ fontWeight: 800, color: '#fff' }}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
            )}
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

function ContentSlideContent({ slide, scale, accent }: { slide: SplitSlide; scale: number; accent: string }) {
  const fs = (v: number) => v * scale

  // Cada metade tem overflow:hidden e width:50%.
  // O <img> dentro tem width:200% (= card inteiro) e height:100%.
  // objectPosition ancora o lado correto → overflow:hidden corta o resto.
  const imgStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    top: 0,
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    width: '200%',    // img spans full card width
    height: '100%',   // full container height
    objectFit: 'cover',
    objectPosition: side === 'left' ? 'left top' : 'right top',
  })

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#111' }}>

      {/* ── LEFT HALF — imagem full-bleed (100% da altura do card) ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', overflow: 'hidden' }}>
        {slide.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imagePath} alt="" style={imgStyle('left')} />
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg, #5a3a1e 0%, #3d2815 30%, #1a100a 100%)' }} />
            <Person stressed scale={scale} />
          </>
        )}
        {/* Gradiente base para texto */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.65) 40%, rgba(0,0,0,0.92) 70%, #000 100%)',
        }} />
        {/* Label + texto */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: `0 ${fs(16)}px ${fs(40)}px`, gap: fs(14),
        }}>
          <div style={{ background: '#fff', padding: `${fs(7)}px ${fs(22)}px`, borderRadius: fs(5), boxShadow: '0 2px 8px rgba(0,0,0,0.6)', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: fs(24), color: '#111' }}>{slide.labelEsquerda}</span>
          </div>
          <Bold text={slide.esquerda || ''} fontSize={fs(26)} />
        </div>
      </div>

      {/* ── RIGHT HALF — imagem full-bleed (100% da altura do card) ── */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', overflow: 'hidden' }}>
        {slide.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imagePath} alt="" style={imgStyle('right')} />
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg, #35363d 0%, #282830 30%, #141418 100%)' }} />
            <Person stressed={false} scale={scale} />
            <div style={{ position: 'absolute', top: '8%', left: '25%', width: '55%', height: '28%', background: `radial-gradient(ellipse, ${accent}18 0%, transparent 70%)` }} />
          </>
        )}
        {/* Gradiente base para texto */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.65) 40%, rgba(0,0,0,0.92) 70%, #000 100%)',
        }} />
        {/* Label + texto */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: `0 ${fs(16)}px ${fs(40)}px`, gap: fs(14),
        }}>
          <div style={{ background: accent, padding: `${fs(7)}px ${fs(22)}px`, borderRadius: fs(5), boxShadow: '0 2px 8px rgba(0,0,0,0.6)', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: fs(24), color: '#fff' }}>{slide.labelDireita}</span>
          </div>
          <Bold text={slide.direita || ''} fontSize={fs(26)} />
        </div>
      </div>

      {/* ── Divisor vertical central ── */}
      <div style={{ position: 'absolute', top: 0, left: '50%', width: fs(1.5), height: '100%', background: 'rgba(255,255,255,0.08)', zIndex: 1 }} />

      {/* ── Título — overlay no topo, largura total, sobre as duas metades ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}>
        {/* Gradiente escuro no topo para o título ser legível */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: fs(240),
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.55) 65%, transparent 100%)',
        }} />
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `${fs(38)}px ${fs(36)}px ${fs(38)}px`,
        }}>
          <h3 style={{
            fontFamily: '"Arial Black", "Arial", "Helvetica Neue", sans-serif',
            fontSize: fs(44), fontWeight: 900, color: '#fff',
            margin: 0, textAlign: 'center', textTransform: 'uppercase',
            letterSpacing: fs(0.6), lineHeight: 1.15,
            textShadow: '0 2px 10px rgba(0,0,0,0.9)',
          }}>
            {slide.text}
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
