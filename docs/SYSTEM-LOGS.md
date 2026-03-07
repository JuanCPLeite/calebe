# Sistema de Logs — Especificação

> Como o sistema registra eventos, onde são salvos e como o owner os acessa.
> Versão: 1.0 — 2026-03-06

---

## Princípios

1. **Append-only** — logs nunca são deletados ou editados (apenas o owner lê)
2. **Server-side only** — inserts via `service_role`, nunca pelo client
3. **Não bloqueia o fluxo** — erro ao salvar log não quebra a operação principal (fire-and-forget)
4. **Estruturado** — payload em JSONB para facilitar filtros e exportação
5. **Identificado** — sempre com `workspace_id` e/ou `user_id` quando disponível

---

## Tabela `system_logs`

```sql
system_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  event        text        NOT NULL,
  level        text        NOT NULL DEFAULT 'info',  -- 'info' | 'warn' | 'error'
  payload      jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
)
```

**Índices:**
```sql
CREATE INDEX ON system_logs (created_at DESC);
CREATE INDEX ON system_logs (workspace_id, created_at DESC);
CREATE INDEX ON system_logs (level, created_at DESC);
CREATE INDEX ON system_logs (event, created_at DESC);
```

---

## Helper de Log no Servidor

```typescript
// lib/logger.ts

import { createServiceClient } from '@/lib/supabase/service'

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
  workspaceId?: string
  userId?: string
  payload?: Record<string, unknown>
}

export async function log(options: LogOptions): Promise<void> {
  const { event, level = 'info', workspaceId, userId, payload = {} } = options

  // Fire-and-forget — nunca bloqueia o fluxo principal
  const supabase = createServiceClient()
  supabase
    .from('system_logs')
    .insert({ event, level, workspace_id: workspaceId, user_id: userId, payload })
    .then(() => {})
    .catch((err) => console.error('[logger] Falha ao salvar log:', err))
}
```

---

## Onde Chamar o Logger

### Geração de conteúdo (`/api/generate/content`)

```typescript
// Sucesso
await log({
  event: 'content.generated',
  workspaceId: workspace.id,
  userId: user.id,
  payload: {
    template_id: templateId,
    model: 'claude-opus-4-6',
    topic,
    slides_count: slides.length,
    duration_ms: Date.now() - startTime,
  },
})

// Erro
await log({
  event: 'content.error',
  level: 'error',
  workspaceId: workspace.id,
  userId: user.id,
  payload: { template_id: templateId, model, topic, error: err.message, attempt },
})
```

### Publicação no Instagram (`/api/publish`)

```typescript
// Sucesso
await log({
  event: 'publish.success',
  workspaceId: workspace.id,
  userId: user.id,
  payload: { carousel_id: carouselId, ig_post_id: postId, platform: 'instagram' },
})

// Erro
await log({
  event: 'publish.error',
  level: 'error',
  workspaceId: workspace.id,
  userId: user.id,
  payload: { carousel_id: carouselId, error: err.message, platform: 'instagram' },
})
```

### Atualização de settings (`/api/admin/settings`)

```typescript
await log({
  event: 'settings.updated',
  userId: user.id,
  payload: { field: 'anthropic_key', masked: true },
})
```

---

## RLS para system_logs

```sql
-- Apenas owner lê
CREATE POLICY "owner reads logs"
  ON system_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- Inserts somente via service_role (server-side)
-- Nenhuma policy de INSERT para usuários autenticados
```

---

## Queries Úteis para o Admin

### Erros das últimas 24h

```sql
SELECT event, count(*) as total, max(created_at) as ultimo
FROM system_logs
WHERE level = 'error' AND created_at > now() - interval '24 hours'
GROUP BY event
ORDER BY total DESC;
```

### Geração por workspace (últimos 30 dias)

```sql
SELECT w.name, count(*) as carrosseis
FROM system_logs sl
JOIN workspaces w ON w.id = sl.workspace_id
WHERE sl.event = 'content.generated'
  AND sl.created_at > now() - interval '30 days'
GROUP BY w.name
ORDER BY carrosseis DESC;
```

### Modelos mais usados

```sql
SELECT
  payload->>'model' as model,
  count(*) as total
FROM system_logs
WHERE event = 'content.generated'
GROUP BY model
ORDER BY total DESC;
```

### Taxa de erro por rota

```sql
SELECT
  payload->>'route' as route,
  count(*) as erros
FROM system_logs
WHERE event = 'error.api'
  AND created_at > now() - interval '7 days'
GROUP BY route
ORDER BY erros DESC;
```

---

## Retenção de Logs

| Nível | Retenção sugerida |
|-------|-----------------|
| `info` | 90 dias |
| `warn` | 180 dias |
| `error` | 1 ano |

Implementar via Supabase scheduled function ou pg_cron:

```sql
-- Rodar 1x por semana: deletar logs info > 90 dias
DELETE FROM system_logs
WHERE level = 'info' AND created_at < now() - interval '90 days';
```

> Por enquanto, sem retenção automática. Implementar quando o volume justificar.
