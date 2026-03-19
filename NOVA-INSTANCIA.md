# Nova Instância — Guia Rápido

> Checklist completo para subir o Carousel Studio do zero em um novo Supabase/domínio.
> Para instruções detalhadas de cada passo, consulte `docs/INSTALLATION.md`.

---

## O que você vai precisar antes de começar

| Item | Onde obter |
|------|-----------|
| Conta Supabase | supabase.com |
| Conta Google Cloud (com billing) | console.cloud.google.com |
| Chave Anthropic (Claude) | console.anthropic.com |
| Chave Google (Gemini / Vertex AI) | console.cloud.google.com → Credenciais |
| (Opcional) Chave EXA Search | exa.ai |
| (Opcional) App Meta + Token Instagram | developers.facebook.com |
| (Opcional) Conta Vercel | vercel.com |

---

## PASSO 1 — Supabase: criar projeto

1. Supabase Dashboard → **New project**
2. Nome, senha do banco, região (São Paulo recomendado)
3. Aguardar provisionamento (~2 min)
4. Anotar em local seguro:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (clicar em Reveal) → `SUPABASE_SERVICE_ROLE_KEY`
   - **Reference ID** (Project Settings > General) → usado nas URLs de Edge Function e OAuth

---

## PASSO 2 — Supabase: rodar o schema

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Copiar e colar o conteúdo inteiro de `supabase-schema.sql`
3. Clicar em **Run**

> Schema é idempotente — pode ser rerodado sem erro. Ao atualizar uma instância existente, simplesmente rode novamente.

**O schema cria automaticamente:**
- Tabelas: `profiles`, `workspaces`, `workspace_members`, `experts`, `expert_photos`, `carousels`
- Tabelas admin: `app_settings` (1 linha pré-inserida), `system_logs`
- Tabelas Content Hub: `platforms`, `content_formats`, `templates`, `template_prompts` (com seed)
- Tabelas Cost Intelligence: `provider_price_catalog`, `usage_events`, `carousel_metrics_snapshots`
- Storage buckets: `expert-photos` e `carousel-images` (privados)
- RLS policies em todas as tabelas
- Trigger `on_auth_user_created` → cria `profile` + `workspace` + `workspace_member` no primeiro login
- Funções auxiliares: `is_owner()`, `current_workspace_id()`, `user_workspace_role()`

**Verificar se funcionou:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- Esperado: carousels, content_formats, expert_photos, experts, platforms,
--           profiles, provider_price_catalog, system_logs, template_prompts,
--           templates, usage_events, workspace_members, workspaces, app_settings,
--           carousel_metrics_snapshots, provider_daily_costs
```

---

## PASSO 3 — Google Cloud: configurar OAuth para login

> O app usa **Google OAuth** via Supabase Auth. Sem isso, o login não funciona.

### 3.1 — Google Cloud Console

1. Acessar `console.cloud.google.com` → criar/selecionar projeto
2. **APIs e Serviços** → **Tela de permissão OAuth** → tipo: Externo → salvar
3. **APIs e Serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**
   - Tipo: **Aplicativo da Web**
   - Origens JS autorizadas:
     - `http://localhost:8080`
     - `https://seudominio.com` (produção)
   - URIs de redirecionamento autorizados:
     - `https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback`
4. Copiar **Client ID** e **Client Secret**

### 3.2 — Supabase: habilitar provider Google

1. Supabase Dashboard → **Authentication** → **Providers** → **Google** → Enable
2. Preencher **Client ID** e **Client Secret** do Google Cloud
3. Salvar

### 3.3 — Supabase: configurar URLs

**Authentication** → **URL Configuration**:
- **Site URL**: `http://localhost:8080` (dev) ou `https://seudominio.com` (produção)
- **Redirect URLs**: adicionar `http://localhost:8080/auth/callback` e `https://seudominio.com/auth/callback`

---

## PASSO 4 — App: configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencher `.env.local`:

```env
# Obrigatório — Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

# Obrigatório — App
NEXT_PUBLIC_APP_URL=http://localhost:8080    # ou https://seudominio.com

# Para agendamento (gerar com: openssl rand -hex 32)
CRON_SECRET=<STRING_ALEATORIA_FORTE>

# Fallback server-side para dev local (em produção ficam no admin panel)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

---

## PASSO 5 — App: instalar e rodar

```bash
npm install           # instala deps + baixa Chromium do Playwright automaticamente
npm run dev           # http://localhost:8080
```

---

## PASSO 6 — Definir o owner da plataforma

O **primeiro usuário** que fizer login vira `owner` automaticamente.

Se precisar promover manualmente (ex: usuário já existente):

```sql
UPDATE profiles SET role = 'owner'
WHERE id = (SELECT id FROM auth.users WHERE email = 'seu@email.com');
```

Verificar:
```sql
SELECT u.email, p.role, w.name AS workspace
FROM profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN workspaces w ON w.id = p.workspace_id
ORDER BY p.created_at ASC;
```

---

## PASSO 7 — Configurar chaves de IA no painel admin

1. Login como owner → acessar `/admin/settings`
2. Inserir chaves:
   - **Anthropic Key** (para geração de conteúdo com Claude)
   - **Google Key** (para geração de imagens com Gemini)
   - **EXA Key** (opcional — busca de tópicos tendência)
3. Clicar **Testar conexão** em cada chave
4. Acessar `/admin/plans` → ajustar planos e limites de experts/membros/créditos

---

## PASSO 8 — Configurar Expert DNA

1. Acessar `/expert/dna` → **Novo**
2. Preencher obrigatórios:
   - `display_name`, `handle`, `niche`, `bio_short`
   - `product_name`, `product_cta`
   - `author_slide_template` (slide 5 — apresentação do autor)
   - `cta_final_template` (slide 10 — CTA final)
   - `highlight_color` (cor de destaque da marca)
3. Salvar o expert
4. Acessar `/expert/photos` → **Novo** → selecionar o expert → fazer upload das fotos de referência (máx 10)

> Ver `docs/EXPERT-DNA-GUIDE.md` para exemplos e campos detalhados.

---

## PASSO 9 — Configurar Google Cloud: geração de imagens

1. No Google Cloud, habilitar **billing** no projeto
2. **APIs e Serviços** → **Biblioteca** → buscar **Vertex AI API** → Ativar
3. **APIs e Serviços** → **Credenciais** → a mesma chave usada no OAuth serve (ou criar nova)
4. Configurar a chave em `/admin/settings` → **Google Key** → Testar conexão

---

## PASSO 10 — (Opcional) Configurar publicação no Instagram

1. Criar app em `developers.facebook.com` → tipo **Business**
2. Adicionar produto **Instagram Graph API**
3. Permissões: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`
4. Obter Access Token (longa duração ou token de sistema — não expira)
5. Obter Instagram Account ID:
   ```bash
   curl "https://graph.facebook.com/v18.0/me/accounts?access_token=<TOKEN>"
   curl "https://graph.facebook.com/v18.0/<PAGE_ID>?fields=instagram_business_account&access_token=<TOKEN>"
   ```
6. Em `/expert/dna`: preencher `Instagram Account ID` e `Meta Access Token`

> Ver `docs/INSTALLATION.md` — Passo 10.1 para detalhes completos.

---

## PASSO 11 — (Opcional) Configurar publicação agendada

### Edge Function

1. Supabase → **Edge Functions** → **Create a new function** → nome: `publish-scheduled`
2. Colar conteúdo de `supabase/functions/publish-scheduled/index.ts`
3. Deploy

### Secrets da function

**Project Settings** → **Edge Functions** → **Secrets**:

| Nome | Valor |
|------|-------|
| `CRON_SECRET` | Mesmo valor do `.env.local` |
| `SERVICE_ROLE_KEY` | service_role key do projeto |

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

-- Verificar:
SELECT jobid, jobname, schedule, active FROM cron.job;
```

Substituir `<PROJECT_REF>` e `<CRON_SECRET>` pelos valores reais.

---

## PASSO 12 — (Opcional) Deploy em produção no Vercel

1. Push do código para o GitHub
2. Vercel → **Import repository**
3. Configurar variáveis de ambiente (mesmas do `.env.local`):
   - `NEXT_PUBLIC_APP_URL` → seu domínio real (ex: `https://carousel.seusite.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `ANTHROPIC_API_KEY` e `GOOGLE_API_KEY` → **deixar em branco** (ficam no admin panel do banco)
4. Deploy
5. Atualizar **Site URL** e **Redirect URLs** no Supabase Auth com o domínio real
6. Atualizar as **Origens JS autorizadas** e **URIs de redirecionamento** no Google Cloud Console com o domínio real

---

## Checklist final de validação

### Infraestrutura
- [ ] Schema rodou sem erros (16+ tabelas criadas)
- [ ] Buckets `expert-photos` e `carousel-images` criados no Storage
- [ ] Google OAuth: provider habilitado no Supabase, Client ID/Secret configurados
- [ ] Login com Google funcionando no app
- [ ] Primeiro usuário é `owner` (verificar via SQL)

### Conteúdo
- [ ] Chave Anthropic configurada e testada em `/admin/settings`
- [ ] Chave Google configurada e testada em `/admin/settings`
- [ ] Expert DNA criado com todos os campos obrigatórios
- [ ] Fotos de referência do expert carregadas
- [ ] Gerar um carrossel de teste (Brand Equity e X vs Y)
- [ ] Imagens geradas e preview funcionando

### Publicação (se aplicável)
- [ ] Token Meta configurado no Expert DNA
- [ ] Instagram Account ID configurado no Expert DNA
- [ ] Teste de publicação (1 post)
- [ ] Edge Function deployada com secrets corretos
- [ ] Cron job ativo (`SELECT * FROM cron.job`)

---

## Troubleshooting rápido

| Problema | Causa provável | Solução |
|---------|---------------|---------|
| Login não abre / redireciona em loop | OAuth mal configurado | Verificar URI de callback no Google Cloud e provider no Supabase |
| `profiles` não criado após login | Trigger não disparou | Verificar se schema foi rodado; rodar novamente |
| "Chave de IA não configurada" | `app_settings` sem chave | Acessar `/admin/settings` e configurar |
| Geração de imagem falha | Billing Google Cloud inativo | Ativar billing + Vertex AI API |
| Publicação Instagram falha | Token expirado ou conta errada | Renovar token ou verificar Account ID |
| Agendamento não publica | `CRON_SECRET` diferente | Confirmar mesmo valor no `.env.local` e secret da function |
| `npm run dev` falha com Playwright | Chromium não instalado | `npx playwright install chromium --with-deps` |

---

## Arquivos de referência

| Arquivo | Conteúdo |
|---------|---------|
| `supabase-schema.sql` | Schema completo — fonte única da verdade do banco |
| `.env.example` | Template comentado de todas as variáveis |
| `docs/INSTALLATION.md` | Guia detalhado passo a passo |
| `docs/EXPERT-DNA-GUIDE.md` | Campos e exemplos do Expert DNA |
| `docs/MULTI-TENANT-ARCHITECTURE.md` | Arquitetura de roles, workspaces, RLS |
| `docs/ADMIN-PANEL.md` | Especificação do painel admin |
| `docs/COST-INTELLIGENCE.md` | Sistema de custos e créditos |
| `docs/SUPABASE_SETUP_DASHBOARD_ONLY.md` | Setup Supabase sem terminal |
| `ROADMAP.md` | Fases implementadas e planejadas |
