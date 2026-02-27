import { NextRequest, NextResponse } from 'next/server'
import { generateSlideImage } from '@/lib/image-generator'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { slideNum, imagePrompt } = await req.json()
    if (!imagePrompt) return NextResponse.json({ error: 'imagePrompt obrigatório' }, { status: 400 })

    // Busca token Google do DB (fallback: env)
    let googleKey = process.env.GOOGLE_API_KEY
    if (user) {
      const { data: tokenRow } = await supabase
        .from('user_tokens')
        .select('value')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .single()
      if (tokenRow?.value) googleKey = tokenRow.value
    }

    // Carrega foto de referência do expert do Supabase Storage
    let expertPhotoBase64: string | undefined
    if (user) {
      const { data: photos } = await supabase
        .from('expert_photos')
        .select('storage_path')
        .eq('expert_id', (await supabase.from('experts').select('id').eq('user_id', user.id).single()).data?.id)
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
