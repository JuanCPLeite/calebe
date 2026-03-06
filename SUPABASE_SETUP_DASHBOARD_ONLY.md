# Supabase Setup (Dashboard-Only, Sem Terminal Local)

Guia para instalar tudo em um novo projeto Supabase usando apenas o Dashboard e SQL Editor.

## Objetivo

Configurar:
- schema/tabelas/policies/storage
- Edge Function `publish-scheduled`
- secrets da function
- cron nativo (`pg_cron + pg_net`) para publicar agendados

## 1) Criar projeto no Supabase

No Supabase Dashboard:
- Create new project
- Aguarde provisionamento completo

## 2) Rodar schema completo

No projeto novo:
- Abra `SQL Editor`
- Cole e execute o arquivo:
  - `supabase-schema.sql`

Observacao:
- O arquivo e reexecutavel (usa `drop policy if exists`).

## 3) Criar a Edge Function no Dashboard

No menu:
- `Edge Functions` > `Create a new function`
- Nome: `publish-scheduled`

No editor da function:
- cole o codigo de:
  - `supabase/functions/publish-scheduled/index.ts`
- salve/deploy

Configuracao:
- `verify_jwt = false` (endpoint de cron, nao de usuario final)

Referencia no repo:
- `supabase/config.toml`

## 4) Configurar secrets da function (Dashboard)

No menu:
- `Project Settings` > `Edge Functions` > `Secrets`

Adicionar:
- `CRON_SECRET=<SEGREDO_FORTE>`
- `SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`

Onde achar `SERVICE_ROLE_KEY`:
- `Project Settings` > `API` > `service_role`

## 5) Habilitar extensoes no SQL Editor

```sql
create extension if not exists pg_net;
create extension if not exists pg_cron;
```

## 6) Criar o cron job (1 minuto)

No SQL Editor:

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
- `<PROJECT_REF>` (Settings > General > Reference ID)
- `<CRON_SECRET>` (mesmo valor salvo nos secrets)

Se ja existir:

```sql
select cron.unschedule('publish-scheduled-carousels');
```

e execute o `cron.schedule` novamente.

## 7) Verificar se cron foi criado

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'publish-scheduled-carousels';
```

## 8) Teste manual da function (Dashboard)

Em `Edge Functions` > `publish-scheduled` > Test/Invoke:
- Method: `POST`
- Headers:
  - `Content-Type: application/json`
  - `x-cron-secret: <CRON_SECRET>`
- Body: `{}`

Resposta esperada:
- `processed: 0` (sem pendentes) ou `processed > 0`.

## 9) Regra de precisao

- Cron em `* * * * *` roda a cada 1 minuto.
- Postagem normalmente ocorre em ate ~60s apos `scheduled_at`.
- "Segundo exato" nao e garantido com cron SQL.

## 10) Checklist rapido

- [ ] Schema executado
- [ ] Function `publish-scheduled` criada e deployada
- [ ] Secrets (`CRON_SECRET`, `SERVICE_ROLE_KEY`) salvos
- [ ] `pg_net` e `pg_cron` habilitados
- [ ] `cron.schedule` criado
- [ ] Teste manual retornando JSON valido

## 11) Seguranca

- Nunca compartilhar `service_role` fora de ambiente seguro.
- Se a chave vazar, rotacione em `Settings > API`.
- Atualize imediatamente o secret `SERVICE_ROLE_KEY` da function.

