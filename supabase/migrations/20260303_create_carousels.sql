-- ─── Tabela carousels ─────────────────────────────────────────────────────────
-- Execute no Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS carousels (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic         text,
  caption       text,
  slides        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ig_post_id    text,
  published_at  timestamptz,
  scheduled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security: cada usuário vê e edita apenas seus carrosséis
ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own carousels"
  ON carousels
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
