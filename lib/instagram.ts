import https from 'https'

const GRAPH_BASE = 'graph.facebook.com'
const API_VERSION = 'v21.0'

function graphPost(path: string, body: object, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ ...body, access_token: token })
    const req = https.request({
      hostname: GRAPH_BASE,
      path: `/${API_VERSION}/${path}`,
      method: 'POST',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
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

export interface PublishCarouselOpts {
  accountId: string
  token: string
  imageUrls: string[]   // URLs públicas de cada slide (servidas pelo tunnel)
  caption: string
}

export async function publishCarousel(opts: PublishCarouselOpts): Promise<string> {
  const { accountId, token, imageUrls, caption } = opts

  // 1. Cria container para cada imagem
  const containerIds: string[] = []
  for (const url of imageUrls) {
    const res = await graphPost(`${accountId}/media`, {
      image_url: url,
      is_carousel_item: true,
    }, token)
    containerIds.push(res.id)
    await new Promise(r => setTimeout(r, 500))
  }

  // 2. Cria container do carrossel
  const carousel = await graphPost(`${accountId}/media`, {
    media_type: 'CAROUSEL',
    children: containerIds.join(','),
    caption,
  }, token)

  // 3. Aguarda processamento
  await new Promise(r => setTimeout(r, 5000))

  // 4. Publica
  const result = await graphPost(`${accountId}/media_publish`, {
    creation_id: carousel.id,
  }, token)

  return result.id
}
