# Guia de Instalação Completo — Carousel Studio SaaS

> Para instalar uma nova instância do sistema do zero.
> Inclui configuração do Supabase, variáveis de ambiente e primeiro acesso.
> Versão: 2.0 — 2026-03-06

---

## Pré-requisitos

| Ferramenta | Versão mínima | Uso |
|-----------|--------------|-----|
| Node.js | 18+ | Runtime do Next.js |
| npm | 9+ | Gerenciador de pacotes |
| Conta Supabase | — | Banco, auth, storage, edge functions |
| Conta GitHub | — | Deploy via Vercel (opcional) |
| Conta Vercel | — | Hospedagem em produção (opcional) |

**Chaves de API necessárias (do owner da plataforma):**

| Provider | Para quê | Obrigatório |
|----------|---------|------------|
| Anthropic (Claude) | Geração de conteúdo | Sim |
| Google (Gemini) | Geração de imagens | Sim |
| Meta Graph API | Publicação no Instagram | Para publicar |
| EXA Search | Busca de tópicos | Não (tem fallback) |
| OpenAI | GPT-4o (fase 3) | Não por enquanto |

---

## Passo 1 — Clonar e instalar dependências

```bash
git clone https://github.com/<seu-usuario>/carousel-studio.git
cd carousel-studio
npm install
```

---

## Passo 2 — Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **New project**
3. Preencha: nome, senha do banco, região (São Paulo recomendado)
4. Aguarde o provisionamento (~2 minutos)

---

## Passo 3 — Configurar o banco (schema completo)

1. No Supabase Dashboard, abra **SQL Editor**
2. Clique em **New query**
3. Copie e cole todo o conteúdo de `supabase-schema.sql`
4. Clique em **Run**

O schema cria automaticamente:
- Tabelas de usuários: `profiles`, `experts`, `expert_photos`, `user_tokens`, `carousels`
- Tabelas multi-tenant: `workspaces`, `workspace_members`
- Tabelas admin: `app_settings`, `system_logs`
- Tabelas Content Hub: `platforms`, `content_formats`, `templates`, `template_prompts`
- Buckets de storage: `expert-photos`, `carousel-images`
- Todas as RLS policies
- Trigger para criação automática de `profiles` no cadastro

> O schema é **idempotente** — pode ser rodado múltiplas vezes sem erro.

---

## Passo 4 — Configurar as variáveis de ambiente

Copie o template:

```bash
cp .env.example .env.local
```

Abra `.env.local` e preencha:

```env
# Supabase — obrigatório
NEXT_PUBLIC_SUPABASE_URL=https://<SEU_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUA_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUA_SERVICE_ROLE_KEY>

# App
NEXT_PUBLIC_APP_URL=http://localhost:8080   # ou seu domínio em produção
CRON_SECRET=<STRING_ALEATORIA_FORTE>        # openssl rand -hex 32

# Chaves de IA (ficam no admin panel em produção, aqui são apenas para dev local)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

Onde encontrar as chaves do Supabase:
- `Project Settings` > `API` > Project URL e anon key
- `Project Settings` > `API` > service_role (clique em Reveal)

---

## Passo 5 — Definir o owner da plataforma

Após o primeiro login, defina seu usuário como owner via SQL Editor:

```sql
-- Substitua pelo seu e-mail
UPDATE profiles
SET role = 'owner'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'seu@email.com'
);
```

> O trigger de cadastro cria todos os novos usuários com `role = 'member'` por padrão.
> O owner precisa ser definido manualmente uma única vez.

---

## Passo 6 — Configurar chaves de IA no painel admin

1. Faça login no app com a conta owner
2. Acesse `/admin/settings`
3. Insira as chaves de IA da plataforma:
   - Anthropic Key
   - Google Key
   - EXA Key (opcional)
4. Clique em "Testar conexão" para validar cada chave

> Em desenvolvimento, as chaves do `.env.local` são usadas como fallback.
> Em produção, as chaves ficam exclusivamente no painel admin (banco), nunca no servidor de deploy.

---

## Passo 7 — Rodar em desenvolvimento

```bash
npm run dev
# Acesse: http://localhost:8080
```

---

## Passo 8 — Configurar publicação agendada (opcional)

Necessário para o recurso de agendamento de posts funcionar em produção.

### Edge Function

1. No Supabase: **Edge Functions** > **Create a new function**
2. Nome: `publish-scheduled`
3. Cole o código de `supabase/functions/publish-scheduled/index.ts`
4. Deploy

### Secrets da function

**Project Settings** > **Edge Functions** > **Secrets**:

| Nome | Valor |
|------|-------|
| `CRON_SECRET` | Mesmo valor do `.env.local` |
| `SERVICE_ROLE_KEY` | Sua service_role key |

### Habilitar extensões

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Criar cron job

```sql
SELECT cron.schedule(
  'publish-scheduled-carousels',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/publish-scheduled',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
```

Substituir `<PROJECT_REF>` (Settings > General > Reference ID) e `<CRON_SECRET>`.

---

## Passo 9 — Deploy em produção (Vercel)

1. Faça push do código para o GitHub
2. No [vercel.com](https://vercel.com), importe o repositório
3. Configure as variáveis de ambiente (mesmas do `.env.local`, exceto:
   - `NEXT_PUBLIC_APP_URL` → seu domínio real
   - `ANTHROPIC_API_KEY` e `GOOGLE_API_KEY` → deixe vazios; chaves ficam no admin panel)
4. Deploy

---

## Checklist de Instalação

### Obrigatório para funcionar

- [ ] Schema executado no Supabase (sem erros)
- [ ] `.env.local` preenchido com URL e keys do Supabase
- [ ] `npm run dev` rodando sem erros
- [ ] Login funcionando
- [ ] Owner definido via SQL (`UPDATE profiles SET role = 'owner'`)
- [ ] Chaves de IA configuradas em `/admin/settings`

### Para geração de conteúdo

- [ ] Chave Anthropic configurada no admin
- [ ] Expert DNA configurado pelo cliente (nome, nicho, CTA)

### Para geração de imagens

- [ ] Chave Google Gemini configurada no admin

### Para publicação no Instagram

- [ ] Conta Meta Developer configurada
- [ ] Token de acesso do Instagram configurado no expert

### Para agendamento

- [ ] Edge Function `publish-scheduled` deployada
- [ ] Secrets `CRON_SECRET` e `SERVICE_ROLE_KEY` na function
- [ ] `pg_net` e `pg_cron` habilitados
- [ ] Cron job criado e verificado

---

## Troubleshooting

### Login não funciona
- Verifique `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`
- Confirme que o schema foi executado (tabela `profiles` existe)

### "Perfil de expert não encontrado"
- O usuário precisa estar em um workspace com expert configurado
- Acesse `/expert` e preencha o DNA do expert

### "Chave de IA não configurada"
- Acesse `/admin/settings` como owner e configure as chaves
- Verifique se `app_settings` tem pelo menos uma linha no banco

### Geração de imagens falha
- Verifique a chave Google no admin panel
- O modelo `imagen-3` requer projeto Google Cloud com billing ativo

### Publicação no Instagram falha
- Verifique se o token Meta não expirou (tokens de curta duração expiram em 60 dias)
- Confirme que a conta Instagram é Business ou Creator

---

## Estrutura de Arquivos Relevantes

```
supabase-schema.sql                 ← Schema completo (fonte única da verdade)
.env.example                        ← Template de variáveis de ambiente
docs/
  INSTALLATION.md                   ← Este arquivo
  MULTI-TENANT-ARCHITECTURE.md      ← Arquitetura multi-tenant detalhada
  ADMIN-PANEL.md                    ← Especificação do painel admin
  SYSTEM-LOGS.md                    ← Sistema de logs
  CONTENT-HUB-ARCHITECTURE.md       ← Arquitetura do Content Hub
ROADMAP.md                          ← Fases de implementação
README.md                           ← Visão geral do produto
SUPABASE_SETUP_DASHBOARD_ONLY.md    ← Guia Supabase sem terminal
```
