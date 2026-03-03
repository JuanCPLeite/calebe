-- OBSOLETO: a coluna scheduled_at já está incluída em 20260303_create_carousels.sql
-- Este arquivo pode ser ignorado se você criou a tabela do zero com a migration acima.

-- Só execute isto se a tabela carousels JÁ EXISTIA antes e está faltando a coluna:
-- ALTER TABLE carousels ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
