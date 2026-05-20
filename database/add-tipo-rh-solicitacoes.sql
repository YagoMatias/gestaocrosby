-- Adiciona o tipo 'rh' ao CHECK constraint da coluna tipo_solicitacao
-- Execute este script no Supabase SQL Editor

ALTER TABLE solicitacoes_crosby
  DROP CONSTRAINT IF EXISTS solicitacoes_crosby_tipo_solicitacao_check;

ALTER TABLE solicitacoes_crosby
  ADD CONSTRAINT solicitacoes_crosby_tipo_solicitacao_check
  CHECK (tipo_solicitacao IN ('pagamento', 'reembolso', 'compra', 'manutencao', 'rh'));
