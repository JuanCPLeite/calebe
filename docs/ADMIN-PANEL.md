# Painel de Administração — Especificação

> Acesso exclusivo do owner da plataforma (role = 'owner').
> Rota: `/admin`
> Versão: 1.0 — 2026-03-06

---

## Visão Geral

O painel admin é a central de operação do SaaS. O owner vê dados de toda a plataforma, gerencia clientes, monitora logs e configura as chaves de IA globais.

```
/admin                  ← Dashboard geral
/admin/workspaces       ← Lista de clientes/workspaces
/admin/workspaces/[id]  ← Detalhe de um workspace
/admin/users            ← Todos os usuários
/admin/logs             ← System logs viewer
/admin/settings         ← Chaves de IA, configurações globais
```

---

## /admin — Dashboard Geral

### Cards de Métricas (topo)

| Card | Dado | Query |
|------|------|-------|
| Workspaces ativos | Count workspaces WHERE active=true | total + delta últimos 30d |
| Usuários totais | Count profiles | total + novos hoje |
| Carrosséis gerados | Count carousels | total + últimas 24h |
| Publicações | Count carousels WHERE ig_post_id IS NOT NULL | total + últimas 24h |

### Gráfico de Geração (últimos 30 dias)

- Eixo X: dias
- Eixo Y: carrosséis gerados
- Linhas por template (Brand Equity, X vs Y, etc.)
- Fonte: `carousels.created_at GROUP BY date`

### Atividade Recente

- Últimos 20 eventos de `system_logs` (qualquer workspace)
- Colunas: timestamp, workspace, usuário, evento, status
- Badge colorido por `level` (info=azul, warn=amarelo, error=vermelho)

### Erros das Últimas 24h

- Filtro automático: `system_logs WHERE level='error' AND created_at > now()-24h`
- Destaque visual quando count > 0

---

## /admin/workspaces — Clientes

### Tabela de Workspaces

Colunas:
- Nome do workspace + slug
- Plano (badge: starter / pro / agency)
- Membros (count)
- Carrosséis gerados (total)
- Último acesso (último carousel criado ou login)
- Status (ativo / inativo)
- Ações: Ver detalhes, Suspender, Alterar plano

Filtros: plano, status, busca por nome

### /admin/workspaces/[id] — Detalhe

**Seção: Informações**
- Nome, slug, plano, data de criação
- Owner do workspace (nome + email)

**Seção: Membros**
- Lista de workspace_members com role e data de entrada
- Ação: remover membro

**Seção: Expert DNA**
- Resumo do perfil do expert configurado (display_name, niche, handle)

**Seção: Uso**
- Carrosséis gerados (total, últimos 30 dias)
- Publicações realizadas
- Modelos de IA mais usados (via system_logs)

**Seção: Logs do Workspace**
- Últimos 50 logs filtrados por workspace_id
- Mesmo componente de /admin/logs mas pré-filtrado

---

## /admin/users — Usuários

### Tabela de Usuários

Colunas:
- Avatar + nome (display_name do expert ou email)
- Email
- Role (owner / admin / member)
- Workspace (nome)
- Criado em
- Último acesso

Filtros: role, workspace, busca por email

Ações:
- Ver perfil
- Alterar role
- Desativar conta

---

## /admin/logs — System Logs Viewer

### Filtros

| Filtro | Tipo | Opções |
|--------|------|--------|
| Nível | Select | info, warn, error, todos |
| Evento | Select | content.generated, image.generated, publish.success, publish.error, auth.login, error.api, todos |
| Workspace | Select | lista de workspaces + "todos" |
| Período | DateRange | últimas 1h, 24h, 7d, 30d, custom |
| Busca | Text | busca no payload (JSONB) |

### Tabela de Logs

Colunas:
- Timestamp (com hora exata no hover)
- Level (badge colorido)
- Evento
- Workspace
- Usuário
- Preview do payload (primeiros 100 chars)
- Ação: expandir row para ver payload completo em JSON

### Exportar

- Botão "Exportar CSV" com os filtros ativos aplicados
- Formato: timestamp, level, event, workspace, user_email, payload

---

## /admin/settings — Configurações Globais

### Seção: Chaves de IA da Plataforma

Cada chave tem:
- Campo de texto com valor mascarado (●●●●●●●● + últimos 4 chars)
- Botão "Revelar" (requer confirmação)
- Botão "Atualizar"
- Status: conectada (verde) / não configurada (cinza) / erro (vermelho)
- Último teste: data/hora do último request bem-sucedido

Chaves gerenciadas:

| Provider | Variável | Modelos disponíveis |
|----------|----------|---------------------|
| Anthropic (Claude) | `anthropic_key` | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| Google (Gemini) | `google_key` | gemini-2.0-flash, imagen-3 |
| OpenAI (GPT) | `openai_key` | gpt-4o, gpt-4o-mini (fase 3) |
| EXA Search | `exa_key` | busca de tópicos |

**Botão "Testar conexão"** — faz um request mínimo para validar a chave

### Seção: Modelos Disponíveis por Plano

Tabela editável: qual modelo cada plano pode usar.

| Modelo | Starter | Pro | Agency |
|--------|---------|-----|--------|
| Claude Haiku | ✅ | ✅ | ✅ |
| Claude Sonnet | ❌ | ✅ | ✅ |
| Claude Opus | ❌ | ✅ | ✅ |
| GPT-4o | ❌ | ❌ | ✅ |

### Seção: Configurações do Sistema

- Nome da plataforma (exibido nos emails)
- URL pública (NEXT_PUBLIC_APP_URL)
- Modo manutenção (toggle — bloqueia novos logins exceto owner)

---

## Eventos de Log — Catálogo Completo

| Evento | Quando | Payload |
|--------|--------|---------|
| `content.generated` | Carrossel gerado com sucesso | `{ template_id, model, topic, slides_count, duration_ms }` |
| `content.error` | Falha na geração | `{ template_id, model, topic, error, attempt }` |
| `image.generated` | Imagens geradas com sucesso | `{ slides_count, model, duration_ms }` |
| `image.error` | Falha na geração de imagens | `{ error, slide_num }` |
| `publish.success` | Publicação no Instagram OK | `{ carousel_id, ig_post_id, platform }` |
| `publish.error` | Falha na publicação | `{ carousel_id, error, platform }` |
| `workspace.created` | Novo workspace criado | `{ workspace_id, name, plan }` |
| `member.invited` | Membro convidado | `{ workspace_id, invited_email, role }` |
| `auth.login` | Login do usuário | `{ method: 'email' \| 'google' }` |
| `settings.updated` | Owner atualizou app_settings | `{ field: 'anthropic_key', by: user_id }` |
| `error.api` | Erro genérico de API route | `{ route, status, message }` |

---

## Componentes de UI

### `LogsTable`
Tabela reutilizada em `/admin/logs` e `/admin/workspaces/[id]`.
Props: `workspaceId?`, `level?`, `event?`, `limit`, `dateRange`.

### `MetricCard`
Card com: título, valor principal, delta (↑ +12% vs. ontem), ícone.

### `WorkspaceStatusBadge`
Badge: starter (cinza) | pro (azul) | agency (dourado) | suspenso (vermelho).

### `ApiKeyField`
Input mascarado com revelar/salvar/testar. Reutilizado em /admin/settings.

---

## Segurança do Painel Admin

- Middleware bloqueia qualquer rota `/admin/*` se `profiles.role !== 'owner'`
- `app_settings` lida apenas via `service_role` no servidor — nunca exposta ao client
- Logs são insert-only via `service_role` — usuário comum não pode apagar
- Ações destrutivas (suspender workspace, remover usuário) exigem confirmação com modal
- Toda ação do owner em `app_settings` gera um log `settings.updated`

---

## Implementação — Ordem Sugerida

1. Schema: tabelas `profiles`, `workspaces`, `workspace_members`, `app_settings`, `system_logs`
2. Middleware de autorização (`/admin` → só owner)
3. `/admin/settings` — primeiro porque desbloqueia o fluxo de tokens
4. `/admin` — dashboard com métricas
5. `/admin/workspaces` — gestão de clientes
6. `/admin/logs` — viewer de logs
7. `/admin/users` — gestão de usuários
