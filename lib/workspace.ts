import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export interface WorkspaceContext {
  workspaceId: string | null
  role: 'owner' | 'admin' | 'member'
}

export interface AppKeys {
  anthropicKey: string
  googleKey: string
  openaiKey: string
  exaKey: string
}

/**
 * Retorna o workspace_id e role do usuário autenticado.
 * Usa a tabela `profiles` criada pelo trigger no cadastro.
 */
export async function getWorkspaceContext(
  userId: string,
  supabase: SupabaseClient
): Promise<WorkspaceContext> {
  const { data } = await supabase
    .from('profiles')
    .select('role, workspace_id')
    .eq('id', userId)
    .maybeSingle()

  return {
    workspaceId: data?.workspace_id ?? null,
    role: (data?.role as WorkspaceContext['role']) ?? 'member',
  }
}

/**
 * Busca as chaves de IA da plataforma em app_settings.
 * Chamado server-side — chaves nunca chegam ao client.
 */
export async function getAppKeys(): Promise<AppKeys> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('app_settings')
    .select('anthropic_key, google_key, openai_key, exa_key')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle()

  return {
    anthropicKey: data?.anthropic_key ?? '',
    googleKey:    data?.google_key    ?? '',
    openaiKey:    data?.openai_key    ?? '',
    exaKey:       data?.exa_key       ?? '',
  }
}
