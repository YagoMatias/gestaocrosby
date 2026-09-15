-- =====================================================================
-- Solicitações Crosby — fluxo de NOTA FISCAL (escrituração via Dryland)
-- =====================================================================
-- Solicitação de pagamento que TEM nota fiscal não vai ao TOTVS: a NF é
-- escriturada direto lá pelo setor de Produção. Então, na aprovação do
-- gestor, ela vai para o status 'nota_fiscal' (em vez de 'aprovado_gestor')
-- e o HeadCoach abre um chamado no Dryland para o setor Produção:
--   "NOTA FISCAL (fornecedor) pendente de escrituração"
-- Quando o chamado é concluído, marcamos nf_escriturado_em (ESCRITURADO).
-- Do status 'nota_fiscal' o financeiro libera direto para pagamento.
--
-- Status possíveis passam a ser:
--   pendente | aprovado_gestor | aprovado_financeiro | enviado_totvs
--   | nota_fiscal | erro_envio | rejeitado | cancelada
-- =====================================================================

ALTER TABLE solicitacoes_crosby
  ADD COLUMN IF NOT EXISTS nf_chamado_dryland_id     INTEGER,
  ADD COLUMN IF NOT EXISTS nf_chamado_dryland_numero INTEGER,
  ADD COLUMN IF NOT EXISTS nf_chamado_aberto_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nf_escriturado_em         TIMESTAMPTZ;

COMMENT ON COLUMN solicitacoes_crosby.nf_chamado_dryland_id IS
  'id do chamado aberto no Dryland (setor Produção) pedindo a escrituração da NF.';
COMMENT ON COLUMN solicitacoes_crosby.nf_escriturado_em IS
  'Preenchido quando o chamado de escrituração é concluído no Dryland (NF escriturada).';

NOTIFY pgrst, 'reload schema';

-- O banco tem um CHECK de status que precisa conhecer 'nota_fiscal'
-- (ver add-status-nota-fiscal-check-solicitacoes-crosby.sql).
ALTER TABLE solicitacoes_crosby
  DROP CONSTRAINT IF EXISTS solicitacoes_crosby_status_check;
ALTER TABLE solicitacoes_crosby
  ADD CONSTRAINT solicitacoes_crosby_status_check
  CHECK (status IN (
    'pendente', 'aprovado_gestor', 'aprovado_financeiro', 'enviado_totvs',
    'nota_fiscal', 'erro_envio', 'rejeitado', 'cancelada'
  ));
