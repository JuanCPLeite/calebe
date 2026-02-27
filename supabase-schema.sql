-- ============================================================
-- Carousel Studio — Schema SQL para Supabase
-- Rodar no: Supabase Dashboard → SQL Editor
-- ============================================================

-- Perfil do expert por usuário (1 por usuário)
create table if not exists experts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null default '',
  handle text not null default '',
  niche text default '',
  bio_short text default '',
  product_name text default '',
  product_cta text default '',
  highlight_color text default '#9B59FF',
  author_slide_template text default '',
  cta_final_template text default '',
  style_rules text[] default '{}',
  ig_account_id text default '',
  audience_profile jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Fotos de referência do expert (máx 10)
create table if not exists expert_photos (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid references experts(id) on delete cascade not null,
  storage_path text not null,
  url text not null,
  order_index int default 0,
  created_at timestamptz default now()
);

-- Tokens de API por usuário
create table if not exists user_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,  -- 'anthropic' | 'google' | 'meta_token' | 'meta_account_id' | 'exa'
  value text not null,
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- Histórico de carrosséis gerados
create table if not exists carousels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text not null,
  caption text default '',
  slides jsonb not null default '[]',
  ig_post_id text,
  published_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table experts enable row level security;
alter table expert_photos enable row level security;
alter table user_tokens enable row level security;
alter table carousels enable row level security;

-- Experts: acesso somente ao próprio usuário
create policy "own experts" on experts
  for all using (auth.uid() = user_id);

-- Expert photos: acesso via expert do usuário
create policy "own expert photos" on expert_photos
  for all using (
    exists (
      select 1 from experts
      where id = expert_photos.expert_id
        and user_id = auth.uid()
    )
  );

-- Tokens: acesso somente ao próprio usuário
create policy "own tokens" on user_tokens
  for all using (auth.uid() = user_id);

-- Carrosséis: acesso somente ao próprio usuário
create policy "own carousels" on carousels
  for all using (auth.uid() = user_id);

-- ============================================================
-- Storage Buckets
-- ============================================================

-- Bucket para fotos de referência do expert (privado)
insert into storage.buckets (id, name, public)
values ('expert-photos', 'expert-photos', false)
on conflict (id) do nothing;

-- Bucket para imagens geradas dos carrosséis (privado)
insert into storage.buckets (id, name, public)
values ('carousel-images', 'carousel-images', false)
on conflict (id) do nothing;

-- Policies do Storage: expert-photos
create policy "upload own expert photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own expert photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "delete own expert photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expert-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policies do Storage: carousel-images
create policy "upload own carousel images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own carousel images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "delete own carousel images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
