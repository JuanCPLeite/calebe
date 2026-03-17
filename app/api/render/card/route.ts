import { NextRequest, NextResponse } from 'next/server'
import { renderCardToPng } from '@/lib/card-renderer'
import { renderSplitCardToPng } from '@/lib/split-card-renderer'
import { createClient } from '@/lib/supabase/server'
import { getActiveExpertRow } from '@/lib/expert-config'

/**
 * POST /api/render/card
 *
 * Recebe texto + imagem Gemini (base64) e retorna um card PNG completo
 * renderizado via Playwright — idêntico ao output do tweet-card-renderer.js.
 *
 * Body: {
 *   text: string
 *   imageBase64?: string      // base64 puro da imagem Gemini (sem prefixo data:)
 *   imageMime?: string        // default 'jpeg'
 *   format?: 'portrait' | 'square' | 'story'   // default 'portrait'
 *   showHeader?: boolean      // default true
 * }
 *
 * Response: { cardBase64: string, mimeType: 'image/png' }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await req.json()
    const {
      template = 'frank',
      text,
      imageBase64,
      imageUrl,
      imageMime = 'jpeg',
      format = 'portrait',
      showHeader = true,
      imageHeightPercent,
      imagePosition = 'bottom',
      imageObjectX,
      imageObjectY,
      fontSize,
      highlightEnabled,
      slide,
      accentColor,
      contentIndex,
    } = body

    if (template === 'split') {
      if (!slide?.layout || typeof slide.text !== 'string') {
        return NextResponse.json({ error: 'slide split invalido' }, { status: 400 })
      }

      const pngBuffer = await renderSplitCardToPng({
        slide,
        accentColor: typeof accentColor === 'string' ? accentColor : undefined,
        contentIndex: typeof contentIndex === 'number' ? contentIndex : undefined,
        imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
        imageMime: typeof imageMime === 'string' ? imageMime : undefined,
        imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
      })

      const cardBase64 = pngBuffer.toString('base64')
      return NextResponse.json({ cardBase64, mimeType: 'image/png' })
    }

    // Dados do expert — busca do DB se autenticado
    let authorName    = 'Expert'
    let authorHandle  = '@expert'
    let highlightColor = '#9B59FF'
    let avatarBase64: string | undefined
    let avatarMime    = 'jpeg'

    if (user) {
      const expert = await getActiveExpertRow(user.id, supabase)

      if (expert) {
        authorName = (expert.display_name as string) || authorName
        authorHandle = (expert.handle as string) || authorHandle
        highlightColor = (expert.highlight_color as string) || highlightColor

        // Busca avatar do Supabase Storage
        const { data: photos } = await supabase
          .from('expert_photos')
          .select('storage_path')
          .eq('expert_id', expert.id as string)
          .order('order_index', { ascending: true })
          .limit(1)

        if (photos?.[0]?.storage_path) {
          const { data: fileData } = await supabase.storage
            .from('expert-photos')
            .download(photos[0].storage_path)

          if (fileData) {
            const buffer = await fileData.arrayBuffer()
            avatarBase64 = Buffer.from(buffer).toString('base64')
            const ext = photos[0].storage_path.split('.').pop()?.toLowerCase()
            avatarMime = ext === 'png' ? 'png' : 'jpeg'
          }
        }
      }
    }

    const pngBuffer = await renderCardToPng({
      authorName,
      authorHandle,
      avatarBase64,
      avatarMime,
      text,
      imageBase64,
      imageMime,
      highlightColor,
      format: format as 'portrait' | 'square' | 'story',
      showHeader,
      imageHeightPercent: typeof imageHeightPercent === 'number' ? imageHeightPercent : undefined,
      imagePosition: imagePosition as 'top' | 'bottom',
      imageObjectX: typeof imageObjectX === 'number' ? imageObjectX : undefined,
      imageObjectY: typeof imageObjectY === 'number' ? imageObjectY : undefined,
      fontSize: typeof fontSize === 'number' ? fontSize : undefined,
      highlightEnabled: highlightEnabled !== false,
    })

    const cardBase64 = pngBuffer.toString('base64')
    return NextResponse.json({ cardBase64, mimeType: 'image/png' })
  } catch (err: any) {
    console.error('[render/card]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
