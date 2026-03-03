-- Adiciona coluna de agendamento na tabela carousels
-- Execute no Supabase Dashboard > SQL Editor
ALTER TABLE carousels ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
