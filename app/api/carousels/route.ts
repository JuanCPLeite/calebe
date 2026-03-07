import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getActiveExpertRow } from '@/lib/expert-config'

/**
 * POST /api/carousels
 * Cria um novo registro de carrossel (rascunho).
 *
 * Body: { topic: string, caption: string, slides: Slide[] }
 * Response: { id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { topic, caption, slides, providerId, model, provider_used, model_used } = await req.json()
    const [{ workspaceId }, activeExpert] = await Promise.all([
      getWorkspaceContext(user.id, supabase),
      getActiveExpertRow(user.id, supabase),
    ])

    const providerUsed =
      typeof provider_used === 'string'
        ? provider_used
        : typeof providerId === 'string'
          ? providerId
          : null
    const modelUsed =
      typeof model_used === 'string'
        ? model_used
        : typeof model === 'string'
          ? model
          : null

    const { data, error } = await supabase
      .from('carousels')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        created_by: user.id,
        expert_id: typeof activeExpert?.id === 'string' ? activeExpert.id : null,
        topic,
        caption,
        slides,
        provider_used: providerUsed,
        model_used: modelUsed,
      })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (err: any) {
    console.error('[POST /api/carousels]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
