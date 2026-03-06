-- ============================================================
-- Carousel Studio — Schema Unificado (fonte única da verdade)
-- Rodar no: Supabase Dashboard > SQL Editor
-- Cole este arquivo inteiro sempre que precisar recriar o banco.
-- ============================================================

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfil do expert por usuário (1 por usuário)
create table if not exists experts (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        references auth.users(id) on delete cascade not null unique,
  display_name          text        not null default '',
  handle                text        not null default '',
  niche                 text        default '',
  bio_short             text        default '',
  product_name          text        default '',
  product_cta           text        default '',
  highlight_color       text        default '#9B59FF',
  avatar_url            text        default '',
  author_slide_template text        default '',
  cta_final_template    text        default '',
  style_rules           text[]      default '{}',
  ig_account_id         text        default '',
  audience_profile      jsonb       default '{}',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Fotos de referência do expert (max 10)
create table if not exists expert_photos (
  id           uuid        primary key default gen_random_uuid(),
  expert_id    uuid        references experts(id) on delete cascade not null,
  storage_path text        not null,
  url          text        not null,
  order_index  int         default 0,
  created_at   timestamptz default now()
);

-- Tokens de API por usuário
-- provider: 'anthropic' | 'google' | 'exa' | 'meta_token' | 'meta_account_id'
create table if not exists user_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  provider   text        not null,
  value      text        not null,
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- Historico de carrosseis gerados
create table if not exists carousels (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade not null,
  topic        text        not null,
  caption      text        default '',
  slides       jsonb       not null default '[]',
  ig_post_id   text,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table experts       enable row level security;
alter table expert_photos enable row level security;
alter table user_tokens   enable row level security;
alter table carousels     enable row level security;

-- experts: dono acessa tudo
drop policy if exists "own experts" on experts;
create policy "own experts"
  on experts for all
  using (auth.uid() = user_id);

-- expert_photos: acesso via expert do usuario
drop policy if exists "own expert photos" on expert_photos;
create policy "own expert photos"
  on expert_photos for all
  using (
    exists (
      select 1 from experts
      where id = expert_photos.expert_id
        and user_id = auth.uid()
    )
  );

-- user_tokens: dono acessa tudo
drop policy if exists "own tokens" on user_tokens;
create policy "own tokens"
  on user_tokens for all
  using (auth.uid() = user_id);

-- carousels: dono acessa tudo
drop policy if exists "own carousels" on carousels;
create policy "own carousels"
  on carousels for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('expert-photos', 'expert-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('carousel-images', 'carousel-images', false)
on conflict (id) do nothing;

-- ============================================================
-- STORAGE POLICIES — expert-photos
-- ============================================================

drop policy if exists "upload own expert photos" on storage.objects;
create policy "upload own expert photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "read own expert photos" on storage.objects;
create policy "read own expert photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "delete own expert photos" on storage.objects;
create policy "delete own expert photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- STORAGE POLICIES — carousel-images
-- ============================================================

drop policy if exists "upload own carousel images" on storage.objects;
create policy "upload own carousel images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "read own carousel images" on storage.objects;
create policy "read own carousel images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "update own carousel images" on storage.objects;
create policy "update own carousel images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "delete own carousel images" on storage.objects;
create policy "delete own carousel images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- CRON NATIVO SUPABASE — publicacao automatica de carrosseis agendados
-- ============================================================
-- Extensoes necessarias (idempotente):
-- create extension if not exists pg_net;
-- create extension if not exists pg_cron;
--
-- Fluxo recomendado:
--   1. Crie a Edge Function `publish-scheduled` no Supabase
--   2. Defina o secret CRON_SECRET na Function
--   3. Habilite as extensoes pg_net e pg_cron
--   4. Agende o job abaixo para chamar a Function a cada 1 minuto
--
-- Precisao de postagem:
--   - Com cron de 1 minuto, o post ocorre normalmente entre 0-60s apos scheduled_at
--   - Exemplo: agendado 17:33 -> publica no ciclo de 17:33 ou 17:34 (dependendo do segundo exato)
--   - Para "segundo exato", cron SQL nao e a ferramenta adequada
--
-- URL padrao de Edge Function:
--   https://<PROJECT_REF>.functions.supabase.co/publish-scheduled
--
-- Headers esperados:
--   Content-Type: application/json
--   x-cron-secret: <CRON_SECRET_DA_FUNCTION>
--
-- Exemplo:
-- SELECT cron.schedule(
--   'publish-scheduled-carousels',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/publish-scheduled',
--     headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_DA_FUNCTION>"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- Para verificar: SELECT * FROM cron.job;
-- Para remover:   SELECT cron.unschedule('publish-scheduled-carousels');
