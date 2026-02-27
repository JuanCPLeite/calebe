import https from 'https'

const GEMINI_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
  'gemini-2.0-flash-exp-image-generation',
]
const GOOGLE_HOST = 'generativelanguage.googleapis.com'

const EXPERT_INSTRUCTION = `
BACKGROUND CHARACTER (REFERENCE-BASED, NOT A PROTAGONIST):

Use the provided reference image ONLY to define the appearance
of EXACTLY ONE background person in the scene.

Rules:
- Generate EXACTLY ONE instance of this person
- Do NOT clone, repeat, or vary this person
- This person must NOT appear in foreground or midground
- This person must NEVER be holding or looking at a phone

Position:
- Fixed far background (left or right corner)
- Partially hidden by other elements or people
- Strongly blurred (depth of field)

Action — CRITICAL:
- This person is FULLY ENGAGED with the scene context
- Body language shows genuine interest toward what is happening
- NO phone, NO device, NO unrelated object in hand
- Valid actions: observing attentively, leaning in with interest,
  nodding while watching, pointing at something in the scene

Context:
- Surrounded by at least 2 other background people with different appearance

CRITICAL: If more than one person resembles the reference, the image is INVALID.
If the reference person is holding a phone or device, the image is INVALID.
`

function callGeminiApi(
  prompt: string,
  aspectRatio = '16:9',
  expertPhotoBase64?: string,
  expertPhotoMime = 'image/jpeg',
  googleApiKey?: string
): Promise<string> {
  const key = googleApiKey || process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY não configurada')

  const fullPrompt = expertPhotoBase64
    ? `${EXPERT_INSTRUCTION}\nScene: ${prompt} NO text, NO words, NO letters in the image.`
    : `${prompt} SEM texto, SEM palavras, SEM letras na imagem.`

  const parts: any[] = [{ text: fullPrompt }]
  if (expertPhotoBase64) {
    parts.push({ inlineData: { mimeType: expertPhotoMime, data: expertPhotoBase64 } })
  }

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio, imageSize: '2K' },
    },
  })

  const tryModel = (modelName: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const geminiPath = `/v1beta/models/${modelName}:generateContent`
      const chunks: Buffer[] = []

      const req = https.request({
        hostname: GOOGLE_HOST,
        path: `${geminiPath}?key=${key}`,
        method: 'POST',
        timeout: 90000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            if (json.error) { reject(new Error(`${modelName}: ${json.error.message}`)); return }
            const parts = json.candidates?.[0]?.content?.parts || []
            const img = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
            if (!img?.inlineData?.data) { reject(new Error(`${modelName} sem imagem`)); return }
            resolve(img.inlineData.data)
          } catch (e: any) {
            reject(new Error(`Parse error ${modelName}: ${e.message}`))
          }
        })
      })
      req.on('timeout', () => { req.destroy(); reject(new Error(`${modelName}: timeout`)) })
      req.on('error', reject)
      req.write(body)
      req.end()
    })

  return (async () => {
    for (const model of GEMINI_MODELS) {
      try {
        return await tryModel(model)
      } catch {
        // tenta próximo
      }
    }
    throw new Error('Todos os modelos Gemini falharam')
  })()
}

export interface GenerateImageResult {
  slideNum: number
  base64: string   // jpeg base64 — retorna direto pro browser
  mimeType: string
}

export async function generateSlideImage(
  slideNum: number,
  imagePrompt: string,
  expertPhotoBase64?: string,
  googleApiKey?: string
): Promise<GenerateImageResult> {
  const base64 = await callGeminiApi(imagePrompt, '16:9', expertPhotoBase64, 'image/jpeg', googleApiKey)
  return { slideNum, base64, mimeType: 'image/jpeg' }
}
