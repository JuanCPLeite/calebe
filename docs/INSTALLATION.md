# Guia de Instalação Completo — Carousel Studio SaaS

> Para instalar uma nova instância do sistema do zero.
> Inclui configuração do Supabase, variáveis de ambiente e primeiro acesso.
> Versão: 2.2 — 2026-03-15

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
- Tabelas de usuários: `profiles`, `experts`, `expert_photos`, `carousels`
- Tabelas multi-tenant: `workspaces`, `workspace_members`
- Tabelas admin: `app_settings`, `system_logs`
- Tabelas de custo: `provider_price_catalog`, `usage_events`
- Tabelas Content Hub: `platforms`, `content_formats`, `templates`, `template_prompts`
- Buckets de storage: `expert-photos`, `carousel-images`
- Todas as RLS policies
- Trigger de onboarding automático: `profiles` + `workspace` + `workspace_members`
- Política de créditos por ação em `app_settings.credit_weights_json`

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

Com o schema atual, o **primeiro usuário cadastrado** vira `owner` automaticamente.
Ainda assim, mantenha o SQL abaixo como fallback operacional:

```sql
-- Substitua pelo seu e-mail
UPDATE profiles
SET role = 'owner'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'seu@email.com'
);
```

> Regra atual:
> - Primeiro usuário do projeto: `owner` (automático)
> - Próximos usuários: `member`
> - Todo usuário novo recebe workspace padrão automático
> - Todo usuário novo entra como `admin` no próprio workspace
> - Sempre é possível promover/rebaixar manualmente via SQL

### Verificar se funcionou

```sql
SELECT
  u.email,
  p.id,
  p.role,
  p.workspace_id,
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at ASC;
```

```sql
SELECT
  u.email,
  p.role,
  p.workspace_id,
  p.active_expert_id,
  w.name as workspace_name
FROM profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN workspaces w ON w.id = p.workspace_id
ORDER BY p.created_at ASC;
```

### Promover owner por ID (alternativa)

```sql
UPDATE profiles
SET role = 'owner'
WHERE id = 'UUID_DO_USUARIO';
```

### Trocar owner (playbook)

```sql
-- 1) Promote novo owner
UPDATE profiles
SET role = 'owner'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'novo-owner@email.com'
);

-- 2) (Opcional) rebaixa owner antigo para admin ou member
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'owner-antigo@email.com'
);
```

### Em todo novo sistema/projeto

1. Rode o schema completo (`supabase-schema.sql`)
2. Crie/login com o usuário que será owner
3. Execute o SQL de promoção para `owner`
4. Valide no `SELECT` acima
5. Acesse `/admin/settings` para configurar as chaves globais

---

## Passo 6 — Configurar chaves de IA no painel admin

1. Faça login no app com a conta owner
2. Acesse `/admin/settings`
3. Insira as chaves de IA da plataforma:
   - Anthropic Key
   - Google Key
   - EXA Key (opcional)
4. Clique em "Testar conexão" para validar cada chave
5. Acesse `/admin/plans` para ajustar tipos de plano e limite de experts por plano
6. (Opcional) cadastre preços em `provider_price_catalog` e acompanhe `/admin/costs`

> Em desenvolvimento, as chaves do `.env.local` são usadas como fallback.
> Em produção, as chaves ficam exclusivamente no painel admin (banco), nunca no servidor de deploy.

---

## Passo 7 — Rodar em desenvolvimento

```bash
npm run dev
# Acesse: http://localhost:8080
```

### Fluxo inicial recomendado após primeiro login

1. Acesse `Expert > DNA`.
2. Na entrada da tela, escolha um DNA existente da lista ou clique em `Novo`.
3. No detalhe do DNA, use `Ver exemplo` se precisar de referência e salve.
4. Acesse `Expert > Fotos Referência`.
5. Clique em `Novo` para abrir o modal de experts já cadastrados no DNA e selecione um.
6. Envie as fotos e use `Voltar` para retornar à lista quando necessário.

### Fluxo operacional do dashboard

Depois que houver carrosséis gerados, o workspace pode operar tudo em `/dashboard`:

1. Abrir o carrossel individual em `/dashboard/[id]`
2. Publicar usando imagens já persistidas quando existirem
3. Repostar um carrossel publicado
4. Abrir o link direto do post no Instagram
5. Excluir somente do sistema
6. Excluir somente do Instagram
7. Excluir de ambos
8. Selecionar múltiplos itens no dashboard para exclusão em lote

> Essas ações não exigem nova configuração do Supabase além do setup padrão deste guia.

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
- [ ] Validar visão owner em `/admin` e `/admin/carousels`
- [ ] Validar `/dashboard` com repost, abrir post e exclusão em lote

### Para geração de conteúdo

- [ ] Chave Anthropic configurada no admin
- [ ] Expert DNA configurado pelo cliente (nome, nicho, CTA)
- [ ] Expert ativo selecionado no header (quando houver múltiplos experts)
- [ ] Se houver múltiplos experts, gerenciar a troca no próprio `DNA Expert` (lista de experts)
- [ ] Em `DNA Expert`, selecionar um expert da lista para abrir/editar os dados

### Para geração de imagens

- [ ] Chave Google Gemini configurada no admin
- [ ] O expert já foi salvo em `/expert/dna` antes de usar `/expert/photos`
- [ ] Em `/expert/photos`, usar o modal `Novo` para escolher qual expert criado no DNA terá as fotos vinculadas

### Para publicação no Instagram

- [ ] Conta Meta Developer configurada
- [ ] `Instagram Account ID` configurado em `/expert/dna`
- [ ] `Meta Access Token` configurado em `/expert/dna` (ou fallback no `.env.local`)
- [ ] Validar também `Repostar`, `Abrir post` e `Excluir IG` em `/dashboard`

### Para agendamento

- [ ] Edge Function `publish-scheduled` deployada
- [ ] Secrets `CRON_SECRET` e `SERVICE_ROLE_KEY` na function
- [ ] `pg_net` e `pg_cron` habilitados
- [ ] Cron job criado e verificado

---

## Troubleshooting

### Preciso rodar algo novo no Supabase após essas correções?

Não, desde que a instância já tenha sido provisionada conforme este guia.

Estas mudanças foram apenas em aplicação:

- correção de fluxo duplicado do template `X vs Y`
- persistência correta das imagens do carrossel
- endpoint operacional `/api/carousels/actions`
- ações de repost/exclusão/link direto no `/dashboard`

Só será necessário mexer no Supabase novamente se a nova instância ainda não tiver:

- schema `supabase-schema.sql` aplicado
- bucket `carousel-images`
- bucket `expert-photos`
- credenciais Meta válidas por expert ou via `.env.local`

### Login não funciona
- Verifique `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`
- Confirme que o schema foi executado (tabela `profiles` existe)

### "Perfil de expert não encontrado"
- O usuário precisa estar em um workspace com expert configurado
- Acesse `/expert` e preencha o DNA do expert
- Com múltiplos experts, confirme qual está ativo no selector do header

### "Chave de IA não configurada"
- Acesse `/admin/settings` como owner e configure as chaves
- Verifique se `app_settings` tem pelo menos uma linha no banco

### Geração de imagens falha
- Verifique a chave Google no admin panel
- O modelo `imagen-3` requer projeto Google Cloud com billing ativo
- Se a página `Fotos Referência` estiver vazia, salve antes o DNA do expert em `/expert/dna` (isso cria o expert)

### Publicação no Instagram falha
- Verifique se o token Meta não expirou (tokens de curta duração expiram em 60 dias)
- Confirme que a conta Instagram é Business ou Creator
- Confirme que `ig_account_id` e `ig_access_token` estão preenchidos em `experts`

### Agendamento não publica no horário
- No fluxo Supabase (`pg_cron` + Edge Function), o header esperado é `x-cron-secret: <CRON_SECRET>`
- Confirme que o mesmo valor de `CRON_SECRET` está no secret da function e no `cron.schedule(...)`
- Para publicação no fluxo atual, a function usa credenciais Meta do `experts` (`ig_access_token` e `ig_account_id`), com fallback de env
- `processed: 0` indica que não há itens elegíveis (`scheduled_at <= now`, `ig_post_id is null`, `deleted_at is null`)
- Erro `Only photo or video can be accepted as media type`: regenere imagens/cards do carrossel e reagende

### Após atualizar para a versão multi-tenant atual
- Rode novamente `supabase-schema.sql` para garantir colunas novas idempotentes (ex.: `experts.ig_access_token`)
- O script também faz backfill automático de:
  - `workspace_id` para usuários legados sem workspace
  - `workspace_members` do dono no próprio workspace
  - `active_expert_id` para quem já tinha expert legado

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
