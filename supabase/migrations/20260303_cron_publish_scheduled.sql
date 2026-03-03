-- ─── Cron de publicação automática via Supabase pg_cron + pg_net ─────────────
--
-- Pré-requisitos:
--   1. Habilite a extensão pg_net em: Database → Extensions → pg_net → Enable
--   2. pg_cron já vem habilitado por padrão no Supabase
--
-- Substitua os dois valores abaixo antes de executar:
--   <SUA_URL>     → URL do seu app no Vercel, ex: https://carousel-studio.vercel.app
--   <SEU_SECRET>  → Valor da env var CRON_SECRET que você definiu no Vercel

SELECT cron.schedule(
  'publish-scheduled-carousels',   -- nome do job (único)
  '*/5 * * * *',                   -- a cada 5 minutos
  $$
  SELECT net.http_post(
    url     := '<SUA_URL>/api/cron/publish-scheduled',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<SEU_SECRET>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Para verificar que o job foi criado:
-- SELECT * FROM cron.job;

-- Para remover o job (se precisar recriar):
-- SELECT cron.unschedule('publish-scheduled-carousels');
