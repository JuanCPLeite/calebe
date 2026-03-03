import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Salva imagens no Supabase Storage (usuário autenticado)
// ou em /public/generated/ como fallback (sem auth)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { slides, sessionId, carouselId } = await req.json()
    if (!slides?.length) return NextResponse.json({ error: 'slides obrigatório' }, { status: 400 })

    const sessionDir = sessionId || `session-${Date.now()}`
    const urls: string[] = []

    if (user) {
      // Salva no Supabase Storage — todos em paralelo
      const results = await Promise.all(
        slides.map(async (slide: { num: number; dataUrl: string }) => {
          const { num, dataUrl } = slide
          if (!dataUrl?.startsWith('data:')) return { num, url: dataUrl }

          const [, base64] = dataUrl.split(',')
          const buffer = Buffer.from(base64, 'base64')
          const storagePath = `${user.id}/${sessionDir}/slide-${num}.jpg`

          const { error } = await supabase.storage
            .from('carousel-images')
            .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })

          if (error) throw new Error(`Storage upload falhou: ${error.message}`)

          const { data: signed } = await supabase.storage
            .from('carousel-images')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7) // 7 dias

          return { num, url: signed?.signedUrl || '' }
        })
      )
      // Mantém a ordem original dos slides
      results.sort((a, b) => a.num - b.num)
      for (const r of results) urls.push(r.url)
    } else {
      // Fallback: salva em /public/generated/ localmente
      const { writeFile, mkdir } = await import('fs/promises')
      const path = await import('path')
      const outDir = path.join(process.cwd(), 'public', 'generated', sessionDir)
      await mkdir(outDir, { recursive: true })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8080'

      for (const slide of slides) {
        const { num, dataUrl } = slide
        if (!dataUrl?.startsWith('data:')) {
          urls.push(dataUrl)
          continue
        }
        const [, base64] = dataUrl.split(',')
        const fileName = `slide-${num}.jpg`
        await writeFile(path.join(outDir, fileName), Buffer.from(base64, 'base64'))
        urls.push(`${appUrl}/generated/${sessionDir}/${fileName}`)
      }
    }

    return NextResponse.json({ urls })
  } catch (err: any) {
    console.error('[save-images]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
