import { createAdminClient } from '@/lib/supabase/admin'

export type LogLevel = 'info' | 'warn' | 'error'

export type LogEvent =
  | 'content.generated'
  | 'content.error'
  | 'image.generated'
  | 'image.error'
  | 'publish.success'
  | 'publish.error'
  | 'workspace.created'
  | 'member.invited'
  | 'auth.login'
  | 'settings.updated'
  | 'error.api'

interface LogOptions {
  event: LogEvent
  level?: LogLevel
  workspaceId?: string | null
  userId?: string | null
  payload?: Record<string, unknown>
}

/**
 * Registra um evento em system_logs via service_role (fire-and-forget).
 * Nunca lança exceção — falha no log não quebra o fluxo principal.
 */
export function log(options: LogOptions): void {
  const { event, level = 'info', workspaceId, userId, payload = {} } = options

  const supabase = createAdminClient()
  void (async () => {
    const { error } = await supabase.from('system_logs').insert({
      event,
      level,
      workspace_id: workspaceId ?? null,
      user_id: userId ?? null,
      payload,
    })

    if (error) {
      console.error('[logger] Falha ao salvar log:', error)
    }
  })()
}
