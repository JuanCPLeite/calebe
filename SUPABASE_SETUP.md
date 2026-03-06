# Supabase Setup (Novo Projeto)

Guia rapido para replicar a infraestrutura do Carousel Studio em outro projeto Supabase.

## 1) Pre-requisitos

- Node.js + npm instalados
- Supabase CLI instalado (`npm i -g supabase`) ou via `npx supabase`
- Acesso ao projeto Supabase (Dashboard)

## 2) Link do projeto local com o Supabase

No root do projeto:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

`PROJECT_REF` fica em: Supabase Dashboard > Settings > General > Reference ID.

## 3) Banco de dados (schema)

Rodar o arquivo completo:

- Arquivo: `supabase-schema.sql`
- Local: Supabase Dashboard > SQL Editor

Observacao:
- O schema foi preparado para ser reexecutavel (policies com `drop policy if exists`).

## 4) Deploy da Edge Function de agendamento

```bash
npx supabase functions deploy publish-scheduled --no-verify-jwt
```

Arquivo da function:
- `supabase/functions/publish-scheduled/index.ts`

## 5) Secrets da function

Obrigatorio:

```bash
npx supabase secrets set CRON_SECRET="<SEGREDO_FORTE>"
npx supabase secrets set SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"
```

Onde pegar `SERVICE_ROLE_KEY`:
- Supabase Dashboard > Settings > API > `service_role` (secret)

Notas importantes:
- Nomes com prefixo `SUPABASE_` nao podem ser setados manualmente pelo CLI.
- A function aceita `SUPABASE_SERVICE_ROLE_KEY` ou `SERVICE_ROLE_KEY`.

## 6) Cron nativo no Supabase

No SQL Editor, rode:

```sql
create extension if not exists pg_net;
create extension if not exists pg_cron;
```

Se ja existir job antigo:

```sql
select cron.unschedule('publish-scheduled-carousels');
```

Criar job (precisao de ate ~60s):

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

## 7) Variaveis de ambiente da aplicacao (Next.js)

No ambiente da app (ex: Vercel), configurar:

- `NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>`
- `NEXT_PUBLIC_APP_URL=https://<SEU_DOMINIO_APP>`
- `CRON_SECRET=<MESMO_CRON_SECRET_DA_FUNCTION>`

Opcional no backend Next.js (se usar rotas admin server-side):
- `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`

## 8) Validacao rapida

### 8.1 Verificar job

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'publish-scheduled-carousels';
```

### 8.2 Testar function manualmente

PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://<PROJECT_REF>.functions.supabase.co/publish-scheduled" `
  -Headers @{ "Content-Type" = "application/json"; "x-cron-secret" = "<CRON_SECRET>" } `
  -Body "{}"
```

Resposta esperada:
- `processed: 0` quando nao ha carrosseis pendentes
- `processed > 0` quando houver itens para publicar

## 9) Regras de agendamento no produto

- `Agendar`: define `scheduled_at` no carousel
- `Reagendar`: altera `scheduled_at`
- `Cancelar`: seta `scheduled_at = null`
- Job publica quando `scheduled_at <= now` e `ig_post_id is null`

## 10) Troubleshooting

Erro `relation "cron.job" does not exist`:
- `pg_cron` nao foi habilitado no banco.

Erro 401 na function:
- `x-cron-secret` diferente do `CRON_SECRET` salvo.

Function processa mas nao publica:
- Verificar `user_tokens` do usuario (`meta_token` e `meta_account_id`).
- Verificar slides com URL publicavel (`cardStoragePath`, `bgImageStoragePath`, `cardPath`, `imagePath`).

## 11) Seguranca

- Nunca compartilhar `service_role` em chat/log publico.
- Se exposta, rotacionar imediatamente em Settings > API.
- Atualizar `SERVICE_ROLE_KEY` no secret da function apos rotacao.

