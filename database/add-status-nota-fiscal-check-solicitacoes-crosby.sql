-- =====================================================================
-- Solicitações Crosby — inclui 'nota_fiscal' no CHECK de status
-- =====================================================================
-- O banco tem o constraint solicitacoes_crosby_status_check (criado fora
-- dos arquivos de schema deste repo). Sem esta migration, aprovar como
-- gestor uma solicitação COM nota fiscal falha com:
--   23514 new row violates check constraint "solicitacoes_crosby_status_check"
-- Recria o constraint com a lista completa de status.
-- =====================================================================

ALTER TABLE solicitacoes_crosby
  DROP CONSTRAINT IF EXISTS solicitacoes_crosby_status_check;

ALTER TABLE solicitacoes_crosby
  ADD CONSTRAINT solicitacoes_crosby_status_check
  CHECK (status IN (
    'pendente',
    'aprovado_gestor',
    'aprovado_financeiro',
    'enviado_totvs',
    'nota_fiscal',
    'erro_envio',
    'rejeitado',
    'cancelada'
  ));

NOTIFY pgrst, 'reload schema';
