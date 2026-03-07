import type { SupabaseClient } from '@supabase/supabase-js'

export interface ActiveExpertContext {
  workspaceId: string | null
  activeExpertId: string | null
  expert: Record<string, any> | null
}

export async function getActiveExpertContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveExpertContext> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id, active_expert_id')
    .eq('id', userId)
    .maybeSingle()

  const workspaceId = (profile as any)?.workspace_id || null
  const activeExpertId = (profile as any)?.active_expert_id || null

  if (activeExpertId) {
    const { data: active } = await supabase
      .from('experts')
      .select('*')
      .eq('id', activeExpertId)
      .maybeSingle()
    if (active) {
      return { workspaceId, activeExpertId, expert: active as Record<string, any> }
    }
  }

  if (!workspaceId) {
    return { workspaceId: null, activeExpertId: null, expert: null }
  }

  const { data: fallback } = await supabase
    .from('experts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fallback?.id) {
    await supabase
      .from('profiles')
      .update({ active_expert_id: fallback.id })
      .eq('id', userId)
    return { workspaceId, activeExpertId: fallback.id, expert: fallback as Record<string, any> }
  }

  return { workspaceId, activeExpertId: null, expert: null }
}
