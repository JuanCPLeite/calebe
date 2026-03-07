# Supabase Setup — Dashboard Only (Sem Terminal)

Guia completo para configurar um projeto Carousel Studio do zero usando apenas o Supabase Dashboard online. Nenhum terminal local necessario.

---

## O que este guia configura

| Item | Descricao |
|------|-----------|
| Schema completo | Todas as tabelas, RLS e storage |
| Tabelas de usuarios | experts, expert_photos, user_tokens, carousels |
| Tabelas Content Hub | platforms, content_formats, templates, template_prompts |
| Storage buckets | expert-photos, carousel-images |
| Edge Function | publish-scheduled (cron de publicacao) |
| Cron job | pg_cron chamando a function a cada 1 minuto |

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faca login
2. Clique em **New project**
3. Preencha:
   - **Name**: `carousel-studio` (ou qualquer nome)
   - **Database password**: anote em local seguro — nao e usado no app, mas pode ser necessario para suporte
   - **Region**: escolha o mais proximo dos seus usuarios (ex: `South America (São Paulo)`)
4. Aguarde o provisionamento (normalmente 1-2 minutos, o status fica verde)

---

## Passo 2 — Rodar o schema completo

Este e o passo principal. O arquivo `supabase-schema.sql` cria tudo de uma vez.

1. No menu lateral, clique em **SQL Editor**
2. Clique em **New query**
3. Abra o arquivo `supabase-schema.sql` do repositorio e copie o conteudo inteiro
4. Cole no editor e clique em **Run** (ou `Ctrl+Enter`)

O schema e **idempotente**: pode ser rodado multiplas vezes sem erro — ele usa `CREATE IF NOT EXISTS` e `ON CONFLICT DO NOTHING` em todos os lugares.

### O que o schema cria automaticamente

**Tabelas de usuarios:**
- `experts` — perfil do expert (nome, nicho, templates, CTA, cor de destaque)
- `expert_photos` — fotos de referencia do expert (max 10)
- `user_tokens` — chaves de API por usuario (Anthropic, Google, EXA, Meta)
- `carousels` — historico de carrosseis gerados (slides em JSONB)

**Tabelas Content Hub:**
- `platforms` — Instagram, LinkedIn, Facebook, Twitter/X, Pinterest
- `content_formats` — formatos por plataforma (carrossel 4:5, post 1:1, story 9:16, etc.)
- `templates` — templates de geracao (Brand Equity, X vs Y, etc.)
- `template_prompts` — prompts em `{{variable}}` syntax por template e por provider de IA

**Storage:**
- Bucket `expert-photos` (privado) — fotos de referencia
- Bucket `carousel-images` (privado) — imagens geradas

**RLS:**
- Tabelas de usuarios: somente o dono acessa
- Tabelas Content Hub: leitura publica (sem dados sensiveis)

---

## Passo 3 — Anotar as chaves do projeto

Voce vai precisar dessas chaves para configurar o `.env.local` do app.

1. No menu lateral, clique em **Project Settings** > **API**
2. Anote:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (clique em "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`

> **Atencao:** a chave `service_role` tem acesso total ao banco. Nunca exponha no frontend nem compartilhe.

3. Em **Project Settings** > **General**, anote:
   - **Reference ID** → usado para montar a URL da Edge Function

---

## Passo 4 — Configurar o .env.local

Na raiz do projeto, edite (ou crie) o arquivo `.env.local` com as chaves anotadas.

Consulte o arquivo `.env.example` do repositorio para ver todas as variaveis disponiveis e suas descricoes.

**Variaveis obrigatorias para o app funcionar:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://<SEU_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUA_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUA_SERVICE_ROLE_KEY>
NEXT_PUBLIC_APP_URL=https://<SEU_DOMINIO>   # ou http://localhost:8080 para local
```

**Variaveis opcionais** (tokens de IA e redes sociais sao salvos por usuario no banco — estas sao apenas fallback server-side):

```env
ANTHROPIC_API_KEY=sk-ant-...        # fallback Claude no servidor
GOOGLE_API_KEY=AIza...              # fallback Gemini no servidor
```

**Variaveis necessarias para agendamento funcionar em producao:**

```env
CRON_SECRET=<STRING_ALEATORIA_FORTE>
NEXT_PUBLIC_APP_URL=https://<SEU_DOMINIO_PRODUCAO>
```

---

## Passo 5 — Criar a Edge Function (publicacao agendada)

Se voce vai usar o recurso de agendamento de posts, siga estes passos. Caso contrario, pode pular.

1. No menu lateral, clique em **Edge Functions**
2. Clique em **Create a new function**
3. Nome: `publish-scheduled`
4. No editor que abre, apague o codigo de exemplo e cole o conteudo de:
   ```
   supabase/functions/publish-scheduled/index.ts
   ```
5. Clique em **Deploy**

**Configuracao importante:**
- Esta function nao usa JWT de usuario (e chamada pelo cron)
- Certifique-se que `verify_jwt = false` esta configurado (ver `supabase/config.toml` no repo)

---

## Passo 6 — Configurar secrets da Edge Function

Os secrets sao variaveis de ambiente exclusivas da Edge Function (diferente do `.env.local` do Next.js).

1. Va em **Project Settings** > **Edge Functions** > **Secrets**
2. Adicione os seguintes secrets clicando em **Add secret**:

| Nome | Valor | Onde encontrar |
|------|-------|----------------|
| `CRON_SECRET` | String forte e aleatoria (ex: `openssl rand -hex 32`) | Voce define — use o mesmo valor no `.env.local` |
| `SERVICE_ROLE_KEY` | Sua service_role key | Project Settings > API > service_role |

> O mesmo `CRON_SECRET` deve estar tanto no secret da function quanto no `.env.local` do Next.js.

---

## Passo 7 — Habilitar extensoes pg_net e pg_cron

Necessario para o cron job funcionar.

1. No menu lateral, clique em **SQL Editor**
2. Rode:

```sql
create extension if not exists pg_net;
create extension if not exists pg_cron;
```

Alternativa via interface: **Database** > **Extensions** > busque `pg_net` e `pg_cron` e ative.

---

## Passo 8 — Criar o cron job

No **SQL Editor**, rode o comando abaixo substituindo os placeholders:

```sql
select cron.schedule(
  'publish-scheduled-carousels',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/publish-scheduled',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
```

Substituir:
- `<PROJECT_REF>` → Reference ID do projeto (Project Settings > General)
- `<CRON_SECRET>` → o mesmo valor que voce definiu no Passo 6

**Verificar se foi criado:**
```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'publish-scheduled-carousels';
```

**Para recriar (se precisar alterar):**
```sql
select cron.unschedule('publish-scheduled-carousels');
-- depois rode o cron.schedule novamente
```

---

## Passo 9 — Testar a Edge Function manualmente

1. No menu lateral, clique em **Edge Functions** > `publish-scheduled`
2. Clique em **Test** (ou use a aba de invocacao)
3. Configure:
   - Method: `POST`
   - Headers:
     ```
     Content-Type: application/json
     x-cron-secret: <SEU_CRON_SECRET>
     ```
   - Body: `{}`
4. Execute e verifique a resposta:
   - `{ "processed": 0 }` = sem carrosseis pendentes (normal)
   - `{ "processed": N }` = N carrosseis publicados

---

## Passo 10 — Verificar o banco (opcional)

Para confirmar que o schema foi criado corretamente:

```sql
-- Ver todas as tabelas criadas
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- Resultado esperado:
-- carousels
-- content_formats
-- expert_photos
-- experts
-- platforms
-- template_prompts
-- templates
-- user_tokens
```

```sql
-- Ver plataformas e formatos populados
select p.name as plataforma, cf.name as formato, cf.aspect_ratio, cf.canvas_w || 'x' || cf.canvas_h as canvas
from content_formats cf
join platforms p on p.id = cf.platform_id
order by p.sort_order, cf.sort_order;
```

```sql
-- Ver templates disponiveis
select id, name, layout, slide_count, tags
from templates
order by sort_order;
```

```sql
-- Ver prompts cadastrados
select tp.template_id, tp.step, tp.provider, tp.version,
       left(tp.prompt_text, 80) || '...' as preview
from template_prompts tp
order by tp.template_id, tp.step;
```

---

## Checklist completo

- [ ] Projeto Supabase criado e provisionado
- [ ] `supabase-schema.sql` executado sem erros
- [ ] 8 tabelas criadas (4 de usuario + 4 de Content Hub)
- [ ] 2 buckets de storage criados (expert-photos, carousel-images)
- [ ] Chaves anotadas (URL, anon key, service_role)
- [ ] `.env.local` preenchido com as chaves
- [ ] *(Se usar agendamento)* Edge Function `publish-scheduled` criada e deployada
- [ ] *(Se usar agendamento)* Secrets `CRON_SECRET` e `SERVICE_ROLE_KEY` salvos na function
- [ ] *(Se usar agendamento)* `pg_net` e `pg_cron` habilitados
- [ ] *(Se usar agendamento)* `cron.schedule` criado e verificado
- [ ] *(Se usar agendamento)* Teste manual da function retornando JSON valido

---

## Notas de seguranca

- **Nunca** commite `.env.local` no git (ja esta no `.gitignore`)
- A `service_role` key bypassa RLS — use apenas no servidor, nunca no frontend
- Se qualquer chave vazar: rotacione em Project Settings > API e atualize todos os lugares
- O `CRON_SECRET` protege o endpoint da function de chamadas externas nao autorizadas

---

## Notas de precisao do cron

- Cron em `* * * * *` roda a cada 1 minuto
- Postagem normalmente ocorre em ate ~60 segundos apos `scheduled_at`
- Precisao de "segundo exato" nao e garantida com cron SQL
- Para alta precisao, considere Supabase Realtime + webhook dedicado
