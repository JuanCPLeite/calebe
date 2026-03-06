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
create policy "own experts"
  on experts for all
  using (auth.uid() = user_id);

-- expert_photos: acesso via expert do usuario
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
create policy "own tokens"
  on user_tokens for all
  using (auth.uid() = user_id);

-- carousels: dono acessa tudo
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

create policy "upload own expert photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own expert photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "delete own expert photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- STORAGE POLICIES — carousel-images
-- ============================================================

create policy "upload own carousel images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own carousel images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

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

create policy "delete own carousel images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- CRON — publicacao automatica de carrosseis agendados
-- ============================================================
-- Pre-requisitos antes de executar este bloco:
--   1. Habilite pg_net em: Database > Extensions > pg_net > Enable
--   2. Defina CRON_SECRET e NEXT_PUBLIC_APP_URL nas envs do Vercel
--   3. Substitua <APP_URL> e <CRON_SECRET> abaixo antes de rodar
--
-- SELECT cron.schedule(
--   'publish-scheduled-carousels',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := '<APP_URL>/api/cron/publish-scheduled',
--     headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- Para verificar: SELECT * FROM cron.job;
-- Para remover:   SELECT cron.unschedule('publish-scheduled-carousels');
