/**
 * card-renderer.ts — Porta TypeScript do tweet-card-renderer.js (AIOS)
 *
 * Gera cards estilo "screenshot de tweet": fundo branco, avatar circular,
 * nome + handle, texto formatado e imagem Gemini na base.
 *
 * Renderiza via Playwright → retorna Buffer PNG.
 */

import { chromium } from 'playwright'

// ─── Formatos ─────────────────────────────────────────────────────────────────

const FORMATS = {
  square:   { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story:    { width: 1080, height: 1920 },
} as const

type Format = keyof typeof FORMATS

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CardRenderOpts {
  authorName?: string
  authorHandle?: string
  /** base64 puro do avatar (sem prefixo data:) */
  avatarBase64?: string
  avatarMime?: string
  text?: string
  /** base64 puro da imagem Gemini (sem prefixo data:) */
  imageBase64?: string
  imageMime?: string
  highlightColor?: string
  format?: Format
  showHeader?: boolean
  /** Percentual da altura do card ocupado pela imagem (10–75). Default 45. */
  imageHeightPercent?: number
  /** Posição da imagem no card. Default 'bottom'. */
  imagePosition?: 'top' | 'bottom'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converte sintaxe markdown simplificada para HTML.
 * Idêntico ao parseText() do tweet-card-renderer.js.
 */
function parseText(raw: string): string {
  return (raw || '')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // **bold** primeiro
    .replace(/\*([^*]+)\*/g,     '<strong>$1</strong>')  // *bold* compat
    .replace(/_([^_]+)_/g,       '<em>$1</em>')          // _italic_
    .replace(/\{([^}]+)\}/g,     '<span class="hl">$1</span>') // {destaque}
    .replace(/\n/g, '<br>')
}

/**
 * Tamanho de fonte automático baseado em comprimento + número de linhas.
 * Mesma lógica do tweet-card-renderer.js (calibrado para 1080px portrait).
 */
function autoFontSize(text: string): string {
  const len = (text || '').length
  const lineCount = (text || '').split('\n').filter(l => l.trim().length > 0).length

  if (lineCount > 16 || len > 650) return '30px'
  if (lineCount > 12 || len > 450) return '34px'
  if (lineCount > 8  || len > 340) return '38px'
  if (lineCount > 5  || len > 200) return '44px'
  if (len < 120)                   return '58px'
  return '50px'
}

// ─── Builder HTML ─────────────────────────────────────────────────────────────

/**
 * Constrói o HTML completo do card.
 * Porta fiel do buildCardHTML() do tweet-card-renderer.js.
 */
export function buildCardHTML(opts: CardRenderOpts): string {
  const {
    authorName    = 'Autor',
    authorHandle  = '@autor',
    avatarBase64,
    avatarMime    = 'jpeg',
    text          = '',
    imageBase64,
    imageMime     = 'jpeg',
    highlightColor = '#c8a930',
    format        = 'portrait',
    showHeader    = true,
    imageHeightPercent = 45,
    imagePosition = 'bottom',
  } = opts

  const { width, height } = FORMATS[format] ?? FORMATS.portrait

  const avatarDataUrl = avatarBase64
    ? `data:image/${avatarMime};base64,${avatarBase64}`
    : null

  const postImageDataUrl = imageBase64
    ? `data:image/${imageMime};base64,${imageBase64}`
    : null

  // Altura da imagem em pixels baseada no percentual configurado
  const imgHeightPx = imageBase64 ? Math.round(height * imageHeightPercent / 100) : 0

  const fontSize = autoFontSize(text)

  // Padding proporcional: ~80px para 1080px de largura
  const padH = Math.round(width * 0.074)
  const padV = Math.round(height * 0.048)

  // Avatar: ~7.8% da largura
  const avatarSize = Math.round(width * 0.078)

  const avatarHTML = avatarDataUrl
    ? `<img src="${avatarDataUrl}" alt="avatar">`
    : `<div class="avatar-placeholder">👤</div>`

  const imageBlockHTML = postImageDataUrl
    ? `<div class="card-image"><img src="${postImageDataUrl}" alt="post image"></div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: #ffffff;
    font-family: 'DM Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    display: flex;
    flex-direction: column;
    padding-bottom: ${Math.round(width * 0.055)}px;
  }

  /* ── Header ───────────────────────────────────────── */
  .card-header {
    display: flex;
    align-items: center;
    gap: ${Math.round(avatarSize * 0.25)}px;
    padding: ${Math.round(padV * 0.80)}px ${padH}px ${Math.round(padV * 0.25)}px ${padH}px;
    flex-shrink: 0;
  }

  .card-avatar {
    width: ${avatarSize}px;
    height: ${avatarSize}px;
    border-radius: 50%;
    background: #e0e0e0;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    font-size: ${Math.round(avatarSize * 0.5)}px;
    color: #bbb;
  }

  .card-author-info {
    display: flex;
    flex-direction: column;
    gap: ${Math.round(avatarSize * 0.06)}px;
  }

  .card-author-name {
    font-weight: 700;
    font-size: ${Math.round(avatarSize * 0.38)}px;
    color: #1a1a1a;
    line-height: 1.2;
  }

  .card-author-handle {
    font-weight: 400;
    font-size: ${Math.round(avatarSize * 0.3)}px;
    color: #888888;
    line-height: 1.2;
  }

  /* ── Corpo do texto ──────────────────────────────── */
  .card-body {
    flex: 1;
    min-height: 0;
    padding: ${Math.round(padV * 0.85)}px ${padH}px;
    overflow: hidden;
    display: flex;
    align-items: flex-start;
  }

  .card-text {
    font-size: ${fontSize};
    line-height: 1.3;
    color: #1a1a1a;
    word-break: break-word;
    font-weight: 400;
  }

  .card-text .hl {
    font-weight: 700;
    color: ${highlightColor};
  }

  .card-text strong {
    font-weight: 700;
    color: #1a1a1a;
  }

  .card-text em {
    font-style: italic;
    color: #1a1a1a;
  }

  /* ── Imagem inferior ─────────────────────────────── */
  .card-image {
    flex: 0 0 ${imgHeightPx}px;
    margin: 0 ${padH}px ${Math.round(padV * 0.4)}px ${padH}px;
    overflow: hidden;
    border-radius: ${Math.round(width * 0.022)}px;
    background: #f0f0f0;
  }

  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    display: block;
  }
</style>
</head>
<body>

  ${showHeader ? `<div class="card-header">
    <div class="card-avatar">${avatarHTML}</div>
    <div class="card-author-info">
      <div class="card-author-name">${authorName}</div>
      <div class="card-author-handle">${authorHandle}</div>
    </div>
  </div>` : ''}

  ${imagePosition === 'top' ? imageBlockHTML : ''}

  <div class="card-body">
    <div class="card-text">${parseText(text)}</div>
  </div>

  ${imagePosition === 'bottom' ? imageBlockHTML : ''}

</body>
</html>`
}

// ─── Renderização ─────────────────────────────────────────────────────────────

/**
 * Renderiza um card via Playwright e retorna Buffer PNG.
 */
export async function renderCardToPng(opts: CardRenderOpts): Promise<Buffer> {
  const format = opts.format ?? 'portrait'
  const { width, height } = FORMATS[format] ?? FORMATS.portrait

  const html = buildCardHTML(opts)

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewportSize({ width, height })

    // networkidle aguarda Google Fonts carregar
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 })

    // Safety net: encolhe fonte pixel a pixel até texto caber sem overflow
    await page.evaluate(() => {
      const cardBody = document.querySelector('.card-body') as HTMLElement | null
      const cardText = document.querySelector('.card-text') as HTMLElement | null
      if (!cardBody || !cardText) return

      const MIN_FONT = 24
      let fontSize = parseFloat(window.getComputedStyle(cardText).fontSize)

      while (fontSize > MIN_FONT && cardBody.scrollHeight > cardBody.clientHeight) {
        fontSize -= 1
        cardText.style.fontSize = fontSize + 'px'
        cardText.style.lineHeight = fontSize <= 30 ? '1.2' : fontSize <= 36 ? '1.25' : '1.3'
      }
    })

    const buffer = await page.screenshot({ type: 'png' })
    await page.close()
    return buffer as Buffer
  } finally {
    await browser.close()
  }
}
