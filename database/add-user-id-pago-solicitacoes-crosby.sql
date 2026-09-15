-- =====================================================================
-- Solicitações Crosby — vínculo com o usuário logado + "Minhas Solicitações"
-- =====================================================================
-- O formulário deixou de ser público: cada solicitação passa a gravar o
-- user_id de quem abriu (auth.users). A página Minhas Solicitações filtra
-- por esse campo (com fallback em solicitante_email para as antigas).
--
-- O financeiro também pode marcar manualmente uma solicitação como PAGA
-- nessa página, independente da fila de Liberação de Pagamento — os
-- campos pago_* registram isso. A solicitação é considerada paga quando
-- pago_em está preenchido OU pagamentos_liberacao.status = 'PAGO'.
--
-- tem_nota_fiscal (definido em add-nota-fiscal-compras-manutencao.sql, que
-- pode não ter sido aplicado) passa a ser preenchido também em
-- pagamento/reembolso/RH pela pergunta obrigatória
-- "O pagamento TEM ou VAI TER nota fiscal?". Repetido aqui com
-- IF NOT EXISTS para esta migration ser suficiente sozinha.
-- =====================================================================

ALTER TABLE solicitacoes_crosby
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS pago_em          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pago_por         UUID,
  ADD COLUMN IF NOT EXISTS pago_por_nome    TEXT,
  ADD COLUMN IF NOT EXISTS tem_nota_fiscal  BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nota_fiscal_url  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nota_fiscal_path TEXT    DEFAULT NULL;

COMMENT ON COLUMN solicitacoes_crosby.tem_nota_fiscal IS
  'Pagamento/reembolso/RH: resposta obrigatória "tem ou vai ter NF?". Compra/manutenção: true = tem NF (não envia ao TOTVS).';

-- Força o PostgREST a recarregar o schema (evita "column not found in schema cache")
NOTIFY pgrst, 'reload schema';

CREATE INDEX IF NOT EXISTS idx_solic_crosby_user_id
  ON solicitacoes_crosby (user_id);

COMMENT ON COLUMN solicitacoes_crosby.user_id IS
  'Usuário (auth.users) que abriu a solicitação pelo formulário logado.';
COMMENT ON COLUMN solicitacoes_crosby.pago_em IS
  'Marcação manual de pagamento feita pelo financeiro em Minhas Solicitações.';
