import { NextRequest, NextResponse } from 'next/server'
import { generateSlideImage } from '@/lib/image-generator'
import { createClient } from '@/lib/supabase/server'
import { getAppKeys } from '@/lib/workspace'
import { getActiveExpertRow } from '@/lib/expert-config'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { slideNum, imagePrompt } = await req.json()
    if (!imagePrompt) return NextResponse.json({ error: 'imagePrompt obrigatório' }, { status: 400 })

    // Chave Google da plataforma (app_settings); fallback para env local.
    const appKeys = await getAppKeys()
    const googleKey = appKeys.googleKey || process.env.GOOGLE_API_KEY || ''
    if (!googleKey) return NextResponse.json(
      { error: 'Chave Google Gemini não configurada. Acesse o painel admin → Settings.' },
      { status: 400 }
    )

    // Carrega foto de referência do expert (2 queries separadas, sem N+1)
    let expertPhotoBase64: string | undefined

    const expert = await getActiveExpertRow(user.id, supabase)

    if (expert && typeof expert.id === 'string') {
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
          expertPhotoBase64 = Buffer.from(buffer).toString('base64')
        }
      }
    }

    const result = await generateSlideImage(slideNum, imagePrompt, expertPhotoBase64, googleKey)

    return NextResponse.json({
      slideNum: result.slideNum,
      dataUrl: `data:${result.mimeType};base64,${result.base64}`,
    })
  } catch (err: any) {
    console.error('[generate/images]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
