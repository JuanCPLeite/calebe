# Arquitetura Multi-tenant — Carousel Studio SaaS

> Documento vivo. Atualizar sempre que uma decisão arquitetural for tomada.
> Versão: 1.0 — 2026-03-06

---

## Visão Geral

O sistema opera como um **SaaS multi-tenant** onde:
- **Owner (dono da plataforma)** gerencia as chaves de IA e vê tudo
- **Customers (clientes)** compram acesso, configuram seu expert DNA e gerenciam seu time
- **Members (funcionários do cliente)** geram e publicam conteúdo dentro do workspace do cliente

Os tokens de IA (Anthropic, Google, OpenAI) são **da plataforma**, não do usuário final. O usuário apenas escolhe qual modelo usar.

---

## Atores e Permissões

| Papel | Acesso | Gerencia |
|-------|--------|----------|
| `owner` | Tudo — painel admin completo | Chaves de IA, planos, todos os workspaces, logs do sistema |
| `admin` | Apenas seu workspace | Expert DNA, membros, carrosséis, publicação |
| `member` | Apenas seu workspace | Gerar conteúdo, editar, publicar (sem gerenciar membros) |

---

## Schema do Banco

### Diagrama de Entidades

```
auth.users (Supabase)
  └── profiles (1:1)
        ├── role: 'owner' | 'admin' | 'member'
        └── workspace_id (workspace padrão)

workspaces (1 por cliente/time)
  ├── workspace_members (N:N com users)
  │     └── role: 'admin' | 'member'
  ├── experts (1 por workspace)
  ├── expert_photos
  └── carousels (N por workspace)
        └── created_by (FK auth.users)

app_settings (global — 1 linha)
  └── chaves de IA da plataforma

system_logs (append-only)
  └── eventos de geração, erros, publicação, auth
```

### Tabelas Detalhadas

```sql
-- Perfil público de cada usuário autenticado
profiles (
  id          uuid PK → auth.users.id,
  role        text  -- 'owner' | 'admin' | 'member'
  workspace_id uuid FK → workspaces (workspace padrão do usuário)
  created_at  timestamptz
)

-- Um workspace por cliente (empresa/criador individual)
workspaces (
  id          uuid PK,
  name        text,        -- "Agência do João"
  slug        text UNIQUE, -- "agencia-do-joao"
  plan        text,        -- 'starter' | 'pro' | 'agency'
  owner_id    uuid FK → auth.users,
  active      boolean,
  created_at  timestamptz
)

-- Membros por workspace (admin ou member)
workspace_members (
  id           uuid PK,
  workspace_id uuid FK → workspaces,
  user_id      uuid FK → auth.users,
  role         text,  -- 'admin' | 'member'
  invited_by   uuid FK → auth.users,
  created_at   timestamptz,
  UNIQUE(workspace_id, user_id)
)

-- Configurações globais da plataforma (owner only)
app_settings (
  id             uuid PK,
  anthropic_key  text,  -- chave Claude da plataforma
  google_key     text,  -- chave Gemini da plataforma
  openai_key     text,  -- chave GPT-4o (fase 3)
  exa_key        text,  -- chave EXA Search
  updated_at     timestamptz,
  updated_by     uuid FK → auth.users
)

-- Logs de sistema (append-only, owner vê tudo)
system_logs (
  id           uuid PK,
  workspace_id uuid FK → workspaces (nullable — logs globais não têm workspace),
  user_id      uuid FK → auth.users (nullable),
  event        text,      -- 'content.generated' | 'image.generated' | 'publish.success' | 'publish.error' | 'auth.login' | 'error.api'
  level        text,      -- 'info' | 'warn' | 'error'
  payload      jsonb,     -- dados do evento (topic, model, tokens_used, error_message, etc.)
  created_at   timestamptz DEFAULT now()
)

-- experts e carousels: trocar user_id → workspace_id
experts (
  workspace_id uuid FK → workspaces  -- era user_id
  ...
)

carousels (
  workspace_id uuid FK → workspaces, -- era user_id
  created_by   uuid FK → auth.users, -- quem gerou
  ...
)
```

---

## Fluxo de Tokens de IA

```
Owner cadastra:
  app_settings.anthropic_key = "sk-ant-..."
  app_settings.google_key    = "AIza..."

Usuário gera conteúdo:
  1. Escolhe o modelo (Claude Opus / Claude Sonnet / GPT-4o / Gemini)
  2. API busca a chave em app_settings (server-side, nunca exposta)
  3. Chama a IA com a chave da plataforma
  4. Debita uso do workspace (para controle de plano — futuro)
```

---

## Planos (estrutura — sem billing por enquanto)

| Plano | Workspaces | Membros | Modelos disponíveis | Carrosséis/mês |
|-------|-----------|---------|---------------------|----------------|
| `starter` | 1 | 1 | Claude Sonnet | 30 |
| `pro` | 1 | 3 | Claude Opus + Sonnet | 100 |
| `agency` | 5 | 10 | Todos | Ilimitado |

> O campo `plan` existe no schema desde o início. A lógica de limites vem com Stripe (fase futura).

---

## RLS — Row Level Security

### Princípios

1. `owner` vê todas as linhas (via `profiles.role = 'owner'`)
2. `admin` e `member` veem apenas linhas do seu workspace
3. `app_settings` e `system_logs`: somente `owner` escreve; logs: somente `owner` lê
4. `workspace_members`: `admin` pode inserir/remover; `member` só lê

### Helpers SQL

```sql
-- Retorna o workspace_id do usuário atual
create or replace function current_workspace_id()
returns uuid language sql stable as $$
  select workspace_id from profiles where id = auth.uid()
$$;

-- Retorna o role do usuário atual
create or replace function current_user_role()
returns text language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

-- Verifica se o usuário é owner da plataforma
create or replace function is_owner()
returns boolean language sql stable as $$
  select role = 'owner' from profiles where id = auth.uid()
$$;
```

### Policies por tabela

```sql
-- workspaces: owner vê tudo; admin vê o seu
"select workspaces"
  using (is_owner() OR owner_id = auth.uid() OR
         exists(select 1 from workspace_members
                where workspace_id = workspaces.id and user_id = auth.uid()))

-- experts / carousels: owner vê tudo; outros veem só o workspace
"select own workspace data"
  using (is_owner() OR workspace_id = current_workspace_id())

-- app_settings: só owner lê e escreve
"owner only app_settings"
  using (is_owner())

-- system_logs: só owner lê; inserts via service_role (server-side)
"owner reads logs"
  for select using (is_owner())
```

---

## Fluxo de Onboarding

```
1. Usuário se cadastra (auth.users criado pelo Supabase)
2. Trigger cria profiles com role='member' e workspace_id=null
3. Se for o primeiro usuário do sistema → role='owner' (ou configurado manualmente)
4. Cliente paga → owner cria workspace para ele → envia convite
5. Cliente aceita → workspace_members criado com role='admin'
6. Cliente convida funcionários → workspace_members com role='member'
```

---

## Estrutura de Rotas

```
app/
  (app)/
    dashboard/          ← workspace do cliente
    generate/           ← geração (workspace-scoped)
    expert/             ← expert DNA (workspace-scoped)
    team/               ← gerenciar membros (admin only)
    tokens/             ← removido (tokens são da plataforma)

  (admin)/              ← só owner acessa (middleware bloqueia)
    admin/
      page.tsx          ← dashboard geral (métricas globais)
      workspaces/       ← lista de clientes
      logs/             ← system_logs viewer
      settings/         ← app_settings (chaves de IA)
      users/            ← todos os usuários
```

---

## Middleware de Autorização

```typescript
// middleware.ts
// /admin/* → verifica profiles.role = 'owner', redireciona se não for
// /app/*   → verifica workspace ativo, redireciona se não tiver
// /team/*  → verifica role = 'admin' no workspace
```

---

## Decisões Técnicas

| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-03-06 | Tokens de IA são da plataforma (app_settings) | SaaS — usuário não precisa gerenciar chaves |
| 2026-03-06 | Workspace como unidade de isolamento (não user_id) | Suporta times/agências sem re-arquitetura |
| 2026-03-06 | system_logs append-only via service_role | Logs imutáveis — owner vê tudo, usuário não apaga |
| 2026-03-06 | profiles.role com 3 níveis (owner/admin/member) | Simples e suficiente para o estágio atual |
| 2026-03-06 | plan no schema desde o início | Evita migration forçada quando Stripe for integrado |
| 2026-03-06 | Trigger cria profile automaticamente | Onboarding automático sem ação manual |
