import https from 'https'

const GRAPH_BASE  = 'graph.facebook.com'
const API_VERSION = 'v21.0'

function buildGraphPath(path: string, token: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `/${API_VERSION}/${path}${separator}access_token=${encodeURIComponent(token)}`
}

function graphPost(path: string, body: object, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ ...body, access_token: token })
    const req = https.request({
      hostname: GRAPH_BASE,
      path:     `/${API_VERSION}/${path}`,
      method:   'POST',
      timeout:  30000,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.error) reject(new Error(`Graph API: ${json.error.message}`))
          else resolve(json)
        } catch (e: any) {
          reject(new Error(`Parse error: ${e.message}`))
        }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function graphGet(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GRAPH_BASE,
      path:     buildGraphPath(path, token),
      method:   'GET',
      timeout:  15000,
    }, (res) => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e: any) { reject(new Error(`Parse error: ${e.message}`)) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function graphDelete(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GRAPH_BASE,
      path: buildGraphPath(path, token),
      method: 'DELETE',
      timeout: 15000,
    }, (res) => {
      let data = ''
      res.on('data', (d) => { data += d })
      res.on('end', () => {
        if (!data) {
          resolve({ success: true })
          return
        }
        try {
          const json = JSON.parse(data)
          if (json.error) reject(new Error(`Graph API: ${json.error.message}`))
          else resolve(json)
        } catch (e: any) {
          reject(new Error(`Parse error: ${e.message}`))
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

/** Aguarda o container do carrossel estar pronto (polling) em vez de sleep fixo */
async function waitForCarouselReady(
  mediaId: string,
  token: string,
  maxWaitMs = 30_000,
  intervalMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const res = await graphGet(`${mediaId}?fields=status_code`, token)
    if (res.status_code === 'FINISHED' || res.status_code === 'PUBLISHED') return
    if (res.status_code === 'ERROR') throw new Error('Instagram: erro ao processar carrossel')
    await new Promise(r => setTimeout(r, intervalMs))
  }
  // Timeout: tenta publicar mesmo assim (Instagram pode aceitar)
}

export interface PublishCarouselOpts {
  accountId: string
  token:     string
  imageUrls: string[]
  caption:   string
}

export interface InstagramMediaSummary {
  id: string
  permalink: string | null
  likeCount: number
  commentsCount: number
  mediaType: string
  mediaProductType: string
  timestamp: string | null
}

export async function publishCarousel(opts: PublishCarouselOpts): Promise<string> {
  const { accountId, token, imageUrls, caption } = opts

  // 1. Cria containers de imagem em paralelo
  const containerIds = await Promise.all(
    imageUrls.map(url =>
      graphPost(`${accountId}/media`, { image_url: url, is_carousel_item: true }, token)
        .then(res => res.id as string)
    )
  )

  // 2. Cria container do carrossel
  const carousel = await graphPost(`${accountId}/media`, {
    media_type: 'CAROUSEL',
    children:   containerIds.join(','),
    caption,
  }, token)

  // 3. Aguarda processamento via polling (máx 30s, verifica a cada 2s)
  await waitForCarouselReady(carousel.id, token)

  // 4. Publica
  const result = await graphPost(`${accountId}/media_publish`, {
    creation_id: carousel.id,
  }, token)

  return result.id
}

export async function deleteInstagramMedia(mediaId: string, token: string): Promise<void> {
  await graphDelete(mediaId, token)
}

export async function getInstagramPermalink(mediaId: string, token: string): Promise<string | null> {
  const result = await graphGet(`${mediaId}?fields=permalink`, token)
  return typeof result?.permalink === 'string' && result.permalink.trim()
    ? result.permalink
    : null
}

export async function getInstagramMediaSummary(mediaId: string, token: string): Promise<InstagramMediaSummary> {
  const result = await graphGet(
    `${mediaId}?fields=id,permalink,like_count,comments_count,media_type,media_product_type,timestamp`,
    token
  )

  return {
    id: String(result?.id || mediaId),
    permalink: typeof result?.permalink === 'string' ? result.permalink : null,
    likeCount: Number(result?.like_count || 0),
    commentsCount: Number(result?.comments_count || 0),
    mediaType: String(result?.media_type || ''),
    mediaProductType: String(result?.media_product_type || ''),
    timestamp: typeof result?.timestamp === 'string' ? result.timestamp : null,
  }
}

export async function getInstagramMediaInsights(
  mediaId: string,
  token: string,
  metrics: string[] = ['views', 'reach', 'saved', 'shares', 'total_interactions']
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {}

  for (const metric of metrics) {
    try {
      const response = await graphGet(`${mediaId}/insights?metric=${encodeURIComponent(metric)}`, token)
      const item = Array.isArray(response?.data) ? response.data[0] : null
      const value = Array.isArray(item?.values) ? item.values[0]?.value : item?.value
      result[metric] = typeof value === 'number' ? value : value == null ? null : Number(value)
    } catch {
      result[metric] = null
    }
  }

  return result
}
