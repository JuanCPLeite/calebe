import { chromium } from 'playwright'

const CARD_W = 1080
const CARD_H = 1350

interface SplitSlideRenderInput {
  num?: number
  type?: string
  layout: 'split-cover' | 'split-content' | 'split-cta'
  text: string
  subtitulo?: string
  esquerda?: string
  direita?: string
  labelEsquerda?: string
  labelDireita?: string
  subtexto?: string
  hashtags?: string
}

export interface SplitCardRenderOpts {
  slide: SplitSlideRenderInput
  accentColor?: string
  contentIndex?: number
  imageBase64?: string
  imageMime?: string
  imageUrl?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderRichText(value: string, accentColor: string, uppercase = false): string {
  const escaped = escapeHtml(value || '')
  const withMarkup = escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\{([^}]+)\}/g, `<span class="accent">$1</span>`)
    .replace(/\n/g, '<br>')

  return uppercase ? withMarkup.toUpperCase() : withMarkup
}

function getImageSrc(opts: SplitCardRenderOpts): string {
  if (opts.imageBase64) {
    return `data:image/${opts.imageMime || 'jpeg'};base64,${opts.imageBase64}`
  }
  return opts.imageUrl || ''
}

function calcCoverFontSizePx(leftTitle: string, rightTitle: string): number {
  const cleanRight = rightTitle.replace(/^VS\.?\s*/i, '')
  const words = [...leftTitle.split(/\s+/), ...cleanRight.split(/\s+/)].filter(Boolean)
  if (!words.length) return 106
  const longest = words.reduce((a, b) => a.length > b.length ? a : b)
  return Math.min(106, Math.max(48, Math.floor(904 / (longest.length * 0.72))))
}

function buildSplitCover(opts: SplitCardRenderOpts, accentColor: string): string {
  const imageSrc = getImageSrc(opts)
  // Strip markdown markers — same logic as CoverContent in split-card.tsx
  const rawText = (opts.slide.text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\{([^}]+)\}/g, '$1')
  const vsMatch = rawText.match(/^(.+?)\s+VS\.?\s+(.+)$/i)
  const leftTitle  = (vsMatch ? vsMatch[1].trim() : rawText).toUpperCase()
  const rightTitle = vsMatch ? `VS. ${vsMatch[2].trim().toUpperCase()}` : 'VS.'
  const subtitle = escapeHtml(opts.slide.subtitulo || '')
  const coverFontSize = calcCoverFontSizePx(leftTitle, rightTitle)

  return `
    <div class="split-card split-cover">
      ${imageSrc ? `
        <img class="cover-bg" src="${imageSrc}" alt="">
        <div class="cover-overlay cover-overlay-a"></div>
        <div class="cover-overlay cover-overlay-b"></div>
      ` : `
        <div class="cover-fallback cover-fallback-a"></div>
        <div class="cover-fallback cover-fallback-b"></div>
      `}
      <div class="cover-content">
        <div class="cover-title" style="font-size: ${coverFontSize}px;">
          <div class="cover-title-line">${leftTitle}</div>
          <div class="cover-title-line">${rightTitle}</div>
        </div>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
    </div>
  `
}

function buildSplitContent(opts: SplitCardRenderOpts, accentColor: string): string {
  const imageSrc = getImageSrc(opts)
  const titleHtml = renderRichText(opts.slide.text || '', accentColor)
  const leftLabel = escapeHtml(opts.slide.labelEsquerda || '')
  const rightLabel = escapeHtml(opts.slide.labelDireita || '')
  const leftText = renderRichText(opts.slide.esquerda || '', accentColor)
  const rightText = renderRichText(opts.slide.direita || '', accentColor)
  const contentPrefix = typeof opts.contentIndex === 'number' ? `${opts.contentIndex}. ` : ''

  return `
    <div class="split-card split-content">
      ${imageSrc ? `
        <img class="content-bg" src="${imageSrc}" alt="">
        <div class="content-top-vignette"></div>
      ` : `
        <div class="content-fallback content-fallback-left"></div>
        <div class="content-fallback content-fallback-right"></div>
      `}

      <div class="content-half left">
        <div class="content-shade"></div>
        <div class="content-side-vignette"></div>
        <div class="content-tag content-tag-left">${leftLabel}</div>
        <div class="content-copy"><p>${leftText}</p></div>
      </div>

      <div class="content-half right">
        <div class="content-shade"></div>
        <div class="content-side-vignette"></div>
        <div class="content-tag content-tag-right">${rightLabel}</div>
        <div class="content-copy"><p>${rightText}</p></div>
      </div>

      <div class="content-title-wrap">
        <div class="content-title-gradient"></div>
        <h2>${escapeHtml(contentPrefix)}${titleHtml}</h2>
      </div>
    </div>
  `
}

function buildSplitCta(opts: SplitCardRenderOpts, accentColor: string): string {
  const title = escapeHtml(opts.slide.text || '')
  const subtext = escapeHtml(opts.slide.subtexto || '')
  const hashtags = escapeHtml(opts.slide.hashtags || '')

  return `
    <div class="split-card split-cta">
      <div class="cta-glow"></div>
      <div class="cta-circle"><span>?</span></div>
      <h2>${title.toUpperCase()}</h2>
      ${subtext ? `<p class="cta-subtext">${subtext}</p>` : ''}
      <div class="cta-button">COMENTE ABAIXO</div>
      ${hashtags ? `<p class="cta-hashtags">${hashtags}</p>` : ''}
    </div>
  `
}

export function buildSplitCardHtml(opts: SplitCardRenderOpts): string {
  const accentColor = opts.accentColor || '#F59E0B'
  const body =
    opts.slide.layout === 'split-cover'
      ? buildSplitCover(opts, accentColor)
      : opts.slide.layout === 'split-content'
        ? buildSplitContent(opts, accentColor)
        : buildSplitCta(opts, accentColor)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${CARD_W}px;
    height: ${CARD_H}px;
    overflow: hidden;
    background: #0c0c0c;
    font-family: "DM Sans", "Segoe UI", Arial, sans-serif;
  }
  body { position: relative; }
  .split-card {
    position: relative;
    width: ${CARD_W}px;
    height: ${CARD_H}px;
    overflow: hidden;
    background: #0c0c0c;
  }
  .accent { color: ${accentColor}; font-weight: 800; text-transform: uppercase; }

  .split-cover .cover-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(22px);
    transform: scale(1.08);
  }
  .split-cover .cover-overlay {
    position: absolute;
    inset: 0;
  }
  .split-cover .cover-overlay-a {
    background: linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.60) 100%);
  }
  .split-cover .cover-overlay-b {
    background: linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 22%, transparent 72%, rgba(0,0,0,0.65) 100%);
  }
  .split-cover .cover-fallback {
    position: absolute;
    inset: 0;
  }
  .split-cover .cover-fallback-a {
    background: radial-gradient(ellipse at 68% 45%, rgba(160,90,20,0.30) 0%, transparent 55%), radial-gradient(ellipse at 30% 70%, rgba(100,55,15,0.20) 0%, transparent 50%);
  }
  .split-cover .cover-fallback-b {
    background: rgba(0,0,0,0.55);
  }
  .split-cover .cover-content {
    position: relative;
    z-index: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 28px;
    padding: 100px 88px;
  }
  .split-cover .cover-title {
    font-family: "Arial Black", Arial, sans-serif;
    font-weight: 900;
    font-size: 106px;
    line-height: 0.9;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #fff;
    width: 100%;
    text-align: left;
  }
  .split-cover .cover-title-line {
    display: block;
    text-align: left;
  }
  .split-cover .cover-title-line + .cover-title-line {
    margin-top: 12px;
  }
  .split-cover .cover-content p {
    color: #d4d4d4;
    font-size: 38px;
    line-height: 1.45;
  }

  .split-content .content-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .split-content .content-top-vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.08) 18%, transparent 38%);
  }
  .split-content .content-fallback {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
  }
  .split-content .content-fallback-left {
    left: 0;
    background: linear-gradient(155deg, #5a3a1e 0%, #3d2815 30%, #1a100a 100%);
  }
  .split-content .content-fallback-right {
    right: 0;
    background: linear-gradient(155deg, #35363d 0%, #282830 30%, #141418 100%);
  }
  .content-half {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
    overflow: hidden;
  }
  .content-half.left { left: 0; }
  .content-half.right { right: 0; }
  .content-half .content-shade {
    position: absolute;
    top: 44%;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.58) 22%, rgba(0,0,0,0.88) 50%, rgba(0,0,0,0.96) 100%);
  }
  .content-half .content-side-vignette {
    position: absolute;
    inset: 0;
  }
  .content-half.left .content-side-vignette {
    background: linear-gradient(to right, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.08) 55%, transparent 100%);
  }
  .content-half.right .content-side-vignette {
    background: linear-gradient(to left, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 55%, transparent 100%);
  }
  .content-tag {
    position: absolute;
    top: 62%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 3;
    padding: 12px 30px;
    border-radius: 0;
    box-shadow: 0 2px 12px rgba(0,0,0,0.7);
    font-size: 28px;
    font-weight: 800;
    white-space: nowrap;
  }
  .content-tag-left {
    background: #fff;
    color: #111;
  }
  .content-tag-right {
    background: ${accentColor};
    color: #fff;
  }
  .content-copy {
    position: absolute;
    top: calc(62% + 56px);
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 10px 20px 36px;
    color: #fff;
    text-align: center;
    font-size: 34px;
    line-height: 1.45;
    text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.5);
  }
  .content-copy p {
    margin: 0;
    width: 100%;
    text-align: center;
  }
  .content-copy strong { font-weight: 800; }
  .content-title-wrap {
    position: absolute;
    inset: 0 0 auto 0;
    z-index: 4;
  }
  .content-title-gradient {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 240px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 62%, transparent 100%);
  }
  .content-title-wrap h2 {
    position: relative;
    padding: 64px 36px 24px;
    color: #fff;
    font-family: "Arial Black", Arial, sans-serif;
    font-size: 44px;
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: 0.6px;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 2px 10px rgba(0,0,0,0.9);
  }

  .split-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 36px;
    padding: 0 100px;
    text-align: center;
    background: #0c0c0c;
  }
  .split-cta .cta-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 45%, ${accentColor}1a 0%, transparent 60%);
  }
  .split-cta .cta-circle,
  .split-cta h2,
  .split-cta p,
  .split-cta .cta-button {
    position: relative;
    z-index: 1;
  }
  .split-cta .cta-circle {
    width: 156px;
    height: 156px;
    border-radius: 50%;
    border: 5px solid ${accentColor};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .split-cta .cta-circle span {
    color: ${accentColor};
    font-size: 88px;
    font-weight: 900;
    line-height: 1;
  }
  .split-cta h2 {
    color: #fff;
    font-family: "Arial Black", Arial, sans-serif;
    font-size: 72px;
    font-weight: 900;
    line-height: 1.1;
    text-transform: uppercase;
  }
  .split-cta .cta-subtext {
    color: #888;
    font-size: 36px;
    line-height: 1.5;
  }
  .split-cta .cta-button {
    padding: 24px 80px;
    border-radius: 80px;
    background: ${accentColor};
    color: #000;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: 1px;
    box-shadow: 0 4px 20px ${accentColor}40;
  }
  .split-cta .cta-hashtags {
    color: #3a3a3a;
    font-size: 26px;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>${body}</body>
</html>`
}

export async function renderSplitCardToPng(opts: SplitCardRenderOpts): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewportSize({ width: CARD_W, height: CARD_H })
    // networkidle aguarda Google Fonts carregar (mesmo padrão do card-renderer.ts)
    await page.setContent(buildSplitCardHtml(opts), { waitUntil: 'networkidle', timeout: 15000 })
    const buffer = await page.screenshot({ type: 'png' })
    await page.close()
    return buffer as Buffer
  } finally {
    await browser.close()
  }
}
