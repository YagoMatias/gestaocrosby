-- Corrige registros legados de saldo_bancario que foram criados
-- com nomes individuais de banco STONE* (ex: STONE FABIO, STONE CROSBY, etc.)
-- consolidando todos em 'STONE'.
--
-- Execute este script UMA VEZ no Supabase SQL Editor.

-- 1. Soma todos os saldos individuais STONE* (exceto 'STONE' já normalizado)
WITH stone_soma AS (
  SELECT COALESCE(SUM(valor), 0) AS total
  FROM saldo_bancario
  WHERE banco LIKE 'STONE %'
),
stone_atual AS (
  SELECT COALESCE(valor, 0) AS valor
  FROM saldo_bancario
  WHERE banco = 'STONE'
)
-- 2. Atualiza (ou insere) o registro 'STONE' somando os valores legados
INSERT INTO saldo_bancario (banco, valor, updated_at)
SELECT
  'STONE',
  (SELECT valor FROM stone_atual) + (SELECT total FROM stone_soma),
  NOW()
ON CONFLICT (banco) DO UPDATE
  SET valor = EXCLUDED.valor, updated_at = EXCLUDED.updated_at;

-- 3. Remove os registros individuais STONE* (STONE FABIO, STONE CROSBY, etc.)
DELETE FROM saldo_bancario
WHERE banco LIKE 'STONE %';
