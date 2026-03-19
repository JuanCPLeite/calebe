# Guia de Instalação Completo — Carousel Studio SaaS

> Para instalar uma nova instância do sistema do zero.
> Inclui configuração do Supabase, OAuth Google, variáveis de ambiente e primeiro acesso.

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

> O `npm install` executa automaticamente `postinstall`, que baixa o browser Chromium do Playwright.
> Este browser é usado pelo card renderer para gerar os PNGs dos cards.
> Se quiser instalar manualmente: `npx playwright install chromium --with-deps`

---

## Passo 2 — Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **New project**
3. Preencha: nome, senha do banco, região (São Paulo recomendado)
4. Aguarde o provisionamento (~2 minutos)

---

## Passo 3 — Configurar autenticação (Google OAuth)

O sistema usa **Supabase Auth com Google OAuth** como provedor de login. Configure antes de rodar o app.

### 3.1 — Criar credenciais OAuth no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e faça login
2. Crie ou selecione um projeto (pode ser o mesmo do Gemini, se já tiver)
3. Menu > **APIs e Serviços** > **Tela de permissão OAuth**
   - Tipo de usuário: **Externo**
   - Preencha: nome do app, e-mail de suporte, e-mail do desenvolvedor
   - Salve e continue (escopos e usuários de teste são opcionais em dev)
4. Menu > **APIs e Serviços** > **Credenciais**
   - Clique em **Criar credenciais** > **ID do cliente OAuth**
   - Tipo de aplicativo: **Aplicativo da Web**
   - Nome: `Carousel Studio`
   - **Origens JavaScript autorizadas**: adicione
     - `http://localhost:8080` (para dev)
     - `https://seudominio.com` (para produção)
   - **URIs de redirecionamento autorizados**: adicione
     - `https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback`
5. Clique em **Criar** — anote o **Client ID** e **Client Secret**

> O `<SEU_PROJECT_REF>` está em: Supabase Dashboard > Project Settings > General > Reference ID

### 3.2 — Habilitar Google como provedor no Supabase

1. No Supabase Dashboard, acesse **Authentication** > **Providers**
2. Localize **Google** e clique em **Enable**
3. Preencha:
   - **Client ID**: o Client ID do Google Cloud (Passo 3.1)
   - **Client Secret**: o Client Secret do Google Cloud (Passo 3.1)
4. Clique em **Save**

### 3.3 — Configurar URL de callback no app

No Supabase Dashboard, acesse **Authentication** > **URL Configuration**:
- **Site URL**: `http://localhost:8080` (dev) ou `https://seudominio.com` (produção)
- **Redirect URLs**: adicione `http://localhost:8080/auth/callback` e `https://seudominio.com/auth/callback`

> Em produção, atualize o Site URL para o domínio real antes do deploy.

---

## Passo 4 — Configurar o banco (schema completo)

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

## Passo 5 — Configurar as variáveis de ambiente

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

## Passo 6 — Definir o owner da plataforma

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

## Passo 7 — Configurar chaves de IA no painel admin

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

## Passo 8 — Rodar em desenvolvimento

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
5. Ocultar/excluir do sistema
6. Selecionar múltiplos itens no dashboard para exclusão em lote no sistema

> Essas ações não exigem nova configuração do Supabase além do setup padrão deste guia.

### Métricas de posts no Instagram

O detalhe do carrossel publicado em `/dashboard/[id]` agora pode:

1. Exibir o último snapshot salvo de métricas
2. Atualizar métricas manualmente
3. Consumir snapshots automáticos via cron

Para isso, a instância precisa ter a tabela `carousel_metrics_snapshots`, criada ao reaplicar `supabase-schema.sql`.

---

## Passo 9 — Configurar publicação agendada (opcional)

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

### Cron opcional para métricas do Instagram

Se quiser manter snapshots atualizados automaticamente, crie também um cron para:

```sql
SELECT cron.schedule(
  'sync-instagram-metrics',
  '*/30 * * * *',
  $$
  SELECT net.http_get(
    url     := 'https://<APP_DOMAIN>/api/cron/sync-instagram-metrics',
    headers := '{"x-cron-secret": "<CRON_SECRET>"}'::jsonb
  );
  $$
);
```

Substitua `<APP_DOMAIN>` pelo domínio do app.

---

## Passo 10 — Deploy em produção (Vercel)

1. Faça push do código para o GitHub
2. No [vercel.com](https://vercel.com), importe o repositório
3. Configure as variáveis de ambiente (mesmas do `.env.local`, exceto:
   - `NEXT_PUBLIC_APP_URL` → seu domínio real
   - `ANTHROPIC_API_KEY` e `GOOGLE_API_KEY` → deixe vazios; chaves ficam no admin panel)
4. Deploy

---

## Passo 10.1 — Configurar publicação no Instagram (Meta Graph API)

Para publicar carrosséis no Instagram, a conta precisa ser **Business** ou **Creator** e estar conectada a uma **Página do Facebook**.

### Criar o app Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com) e faça login
2. Clique em **My Apps** > **Create App**
3. Selecione **Other** > **Business**
4. Preencha nome e e-mail de contato > **Create App**

### Adicionar produto Instagram

1. No painel do app, clique em **Add Products**
2. Encontre **Instagram Graph API** > **Set Up**

### Permissões necessárias

Na seção **App Review** > **Permissions**, solicite:

| Permissão | Para quê |
|-----------|----------|
| `instagram_basic` | Ler dados da conta |
| `instagram_content_publish` | Publicar posts |
| `pages_show_list` | Listar páginas do Facebook |
| `pages_read_engagement` | Ler métricas |

> Em desenvolvimento, as permissões funcionam sem aprovação para o usuário admin do app.
> Para produção com múltiplos usuários, é necessário passar pelo App Review da Meta.

### Obter o Access Token

**Opção A — Token de usuário de longa duração (60 dias):**

1. Acesse [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Selecione seu app
3. Em **Permissions**, adicione: `instagram_basic`, `instagram_content_publish`
4. Clique em **Generate Access Token** e autorize
5. Copie o token de curta duração
6. Converta para longa duração (60 dias):

```bash
curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_TOKEN>"
```

**Opção B — Token de Sistema (nunca expira, recomendado para produção):**

1. No [Business Manager](https://business.facebook.com), acesse **Configurações do Negócio**
2. **Usuários** > **Usuários do Sistema** > **Adicionar**
3. Nomeie o usuário do sistema, role: **Admin**
4. Clique em **Gerar novo token** > selecione o app > marque as permissões
5. Copie o token — ele não expira

### Obter o Instagram Account ID

```bash
curl "https://graph.facebook.com/v18.0/me/accounts?access_token=<TOKEN>"
# Retorna as páginas. Copie o id da página.

curl "https://graph.facebook.com/v18.0/<PAGE_ID>?fields=instagram_business_account&access_token=<TOKEN>"
# Retorna o instagram_business_account.id — este é o Instagram Account ID
```

### Configurar no sistema

Em `/expert/dna`, preencha:
- **Instagram Account ID** — o `id` do `instagram_business_account` acima
- **Meta Access Token** — o token de longa duração ou de sistema

---

## Passo 10.2 — Configurar geração de imagens (Google Gemini + Imagen 3)

### Criar projeto no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ex: `carousel-studio`)
3. Ative o **billing** no projeto (necessário para Imagen 3)
   - Menu > **Faturamento** > **Vincular conta de faturamento**

### Ativar a API

1. Menu > **APIs e Serviços** > **Biblioteca**
2. Pesquise **Vertex AI API** > **Ativar**

### Obter a chave de API

1. Menu > **APIs e Serviços** > **Credenciais**
2. **Criar credenciais** > **Chave de API**
3. Copie a chave gerada
4. (Recomendado) Restrinja a chave para a API do Vertex AI

### Modelos usados

| Modelo | Para quê | Billing |
|--------|----------|---------|
| `gemini-2.0-flash` | Geração de imagens rápidas | ~$0.039/imagem |
| `imagen-3.0-generate-002` | Imagens de alta qualidade | ~$0.04/imagem |

### Configurar no sistema

Em `/admin/settings` (como owner), insira a **Google Key** no campo correspondente e clique em **Testar conexão**.

> Se a geração de imagens falhar, verifique:
> - Billing ativo no projeto Google Cloud
> - Vertex AI API habilitada
> - A chave tem permissão para `aiplatform.googleapis.com`

---

## Checklist de Instalação

### Base — obrigatório para o app funcionar

- [ ] Projeto Supabase criado e provisionado
- [ ] Schema executado no Supabase (`supabase-schema.sql`) sem erros
- [ ] Google OAuth configurado no Google Cloud Console (Client ID + Secret)
- [ ] Provider Google habilitado no Supabase > Authentication > Providers
- [ ] Site URL e Redirect URLs configurados no Supabase > Authentication > URL Configuration
- [ ] `.env.local` preenchido com URL e keys do Supabase
- [ ] `npm install` executado (baixa Playwright/Chromium automaticamente)
- [ ] `npm run dev` rodando sem erros em `http://localhost:8080`
- [ ] Login com Google funcionando
- [ ] Owner definido via SQL (`UPDATE profiles SET role = 'owner'`)
- [ ] Chaves de IA configuradas em `/admin/settings`
- [ ] Validar visão owner em `/admin` e `/admin/carousels`

### Para geração de conteúdo (Claude)

- [ ] Chave Anthropic configurada no admin (via `/admin/settings`)
- [ ] Expert DNA configurado: `display_name`, `handle`, `niche`, `bio_short`, `product_name`, `product_cta`
- [ ] Slides fixos preenchidos: `author_slide_template` (slide 5) e `cta_final_template` (slide 10)
- [ ] Expert ativo selecionado no header (quando houver múltiplos experts)
- [ ] Ver guia completo em `docs/EXPERT-DNA-GUIDE.md`

### Para geração de imagens (Google Gemini)

- [ ] Projeto Google Cloud criado com billing ativo
- [ ] Vertex AI API habilitada no projeto
- [ ] Chave de API Google obtida em APIs e Serviços > Credenciais
- [ ] Chave Google configurada em `/admin/settings` e testada
- [ ] Expert salvo em `/expert/dna` antes de usar `/expert/photos`
- [ ] Fotos de referência carregadas em `/expert/photos`
- [ ] Ver `docs/INSTALLATION.md` — Passo 10.2 para configuração detalhada

### Para publicação no Instagram

- [ ] App Meta criado em developers.facebook.com
- [ ] Permissões `instagram_basic` e `instagram_content_publish` configuradas
- [ ] Access Token obtido (longa duração ou token de sistema — ver Passo 10.1)
- [ ] `Instagram Account ID` obtido via Graph API Explorer
- [ ] `Instagram Account ID` e `Meta Access Token` configurados em `/expert/dna`
- [ ] Validar `Repostar`, `Abrir post` e ocultação no `/dashboard`
- [ ] Validar `Atualizar agora` nas métricas em `/dashboard/[id]`

### Para publicação agendada (pg_cron + Edge Function)

- [ ] Edge Function `publish-scheduled` criada e deployada no Supabase
- [ ] Secrets `CRON_SECRET` e `SERVICE_ROLE_KEY` configurados na Edge Function
- [ ] Extensões `pg_net` e `pg_cron` habilitadas
- [ ] Cron job criado via `cron.schedule(...)` e verificado
- [ ] Teste manual da function retornando `{ "processed": 0 }` (sem erros)

---

## Troubleshooting

### Login não funciona com Google
- Verifique `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`
- Confirme que o provider Google está habilitado em Supabase > Authentication > Providers
- Confirme que o Client ID e Client Secret do Google Cloud estão corretos
- Confirme que o URI de redirecionamento `https://<PROJECT_REF>.supabase.co/auth/v1/callback` está na lista de URIs autorizados no Google Cloud Console
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
NOVA-INSTANCIA.md                   ← Checklist rápido para nova instância (começo aqui)
supabase-schema.sql                 ← Schema completo (fonte única da verdade do banco)
middleware.ts                       ← Auth middleware (proteção de rotas + role-based access)
.env.example                        ← Template comentado de todas as variáveis de ambiente
docs/
  INSTALLATION.md                   ← Este arquivo (guia detalhado completo)
  EXPERT-DNA-GUIDE.md               ← Como configurar o expert DNA (campos, exemplos, fotos)
  MULTI-TENANT-ARCHITECTURE.md      ← Arquitetura multi-tenant detalhada (roles, workspaces, RLS)
  ADMIN-PANEL.md                    ← Especificação do painel admin
  COST-INTELLIGENCE.md              ← Custos, créditos e telemetria de uso
  SYSTEM-LOGS.md                    ← Sistema de logs: eventos, queries, retenção
  CONTENT-HUB-ARCHITECTURE.md       ← Content Hub: plataformas, formatos, template engine
  SUPABASE_SETUP_DASHBOARD_ONLY.md  ← Setup Supabase sem terminal (alternativa)
ROADMAP.md                          ← Fases de implementação (passadas e futuras)
README.md                           ← Visão geral do produto e links
supabase/
  functions/
    publish-scheduled/index.ts      ← Edge Function para agendamento de posts
```
