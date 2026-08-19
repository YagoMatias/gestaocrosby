-- =============================================
-- Migração: chave_pix sem limite de caracteres
-- A chave PIX pode ser um "copia e cola" (BR Code / EMV),
-- que passa facilmente de 255 caracteres. Com VARCHAR(255)
-- o INSERT vindo das Solicitações Crosby falha (ou o valor
-- chega cortado quando conferido na Liberação de Pagamento).
-- Em solicitacoes_crosby a coluna já é TEXT.
-- Execute no Supabase SQL Editor.
-- =============================================

ALTER TABLE pagamentos_liberacao
  ALTER COLUMN chave_pix TYPE TEXT;
