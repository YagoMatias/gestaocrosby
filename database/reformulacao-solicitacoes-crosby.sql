-- =====================================================================
-- Reformulação dos formulários de Solicitações Crosby
-- =====================================================================
-- Adiciona campos para o novo fluxo simplificado:
--   * Pagamento / Reembolso  → vencimento único, despesa única, comprovante
--                              de aprovação do gestor + comprovante do Fábio
--   * Compra / Manutenção    → marca/modelo (opcional) e, para manutenção,
--                              recomendações livres de fornecedores
--   * RH                      → mantém o fluxo antigo (parcelas/duplicata)
-- =====================================================================

ALTER TABLE solicitacoes_crosby
  ADD COLUMN IF NOT EXISTS comprovante_gestor_url    TEXT,
  ADD COLUMN IF NOT EXISTS comprovante_fabio_url     TEXT,
  ADD COLUMN IF NOT EXISTS despesa_code              INTEGER,
  ADD COLUMN IF NOT EXISTS cost_center_code          INTEGER,
  ADD COLUMN IF NOT EXISTS rateio_percentual         NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS marca_modelo              TEXT,
  ADD COLUMN IF NOT EXISTS recomendacao_fornecedores TEXT,
  ADD COLUMN IF NOT EXISTS chave_pix                 TEXT,
  ADD COLUMN IF NOT EXISTS codigo_barras             TEXT;

COMMENT ON COLUMN solicitacoes_crosby.comprovante_gestor_url IS
  'URL pública do comprovante de aprovação do gestor (pagamento/reembolso).';
COMMENT ON COLUMN solicitacoes_crosby.comprovante_fabio_url IS
  'URL pública do comprovante de aprovação do Fábio (pagamento/reembolso).';
COMMENT ON COLUMN solicitacoes_crosby.despesa_code IS
  'Código único de despesa selecionado pelo solicitante no fluxo simplificado de pagamento/reembolso. ' ||
  'Para RH, as despesas continuam dentro de payload_totvs.installments[].expenses[].';
COMMENT ON COLUMN solicitacoes_crosby.marca_modelo IS
  'Marca / modelo desejado (compra ou manutenção, campo opcional).';
COMMENT ON COLUMN solicitacoes_crosby.recomendacao_fornecedores IS
  'Sugestões livres de fornecedores informadas pelo solicitante em manutenção.';
