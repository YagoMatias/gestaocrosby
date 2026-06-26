-- Remapeamento manual de NF → vendedor para o replica do SQL oficial.
--
-- Contexto: o relatório SQL "0326 - Vendas por Vendedor Financeiro" do TOTVS
-- agrupa por CD_COMPVEND (vendedor da TRANSAÇÃO). A API REST do TOTVS só
-- expõe `dealerCode` do PRODUTO. Em raros casos esses dois divergem (ex.: NF
-- 12227 tem produto com dealer Arthur=259 mas a transação está atribuída ao
-- Rafael=21).
--
-- Esta tabela permite cadastrar essas exceções manualmente para o card
-- "Faturamento por Vendedor — Mensal" bater 100% com o relatório oficial.

CREATE TABLE IF NOT EXISTS forecast_vendedor_remap (
  id BIGSERIAL PRIMARY KEY,
  invoice_code BIGINT NOT NULL,
  branch_code INT NOT NULL,
  dealer_origem INT,                  -- dealer atualmente atribuído (informativo)
  dealer_destino INT NOT NULL,        -- para onde o valor deve ir (CD_COMPVEND)
  razao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_code, invoice_code)
);

CREATE INDEX IF NOT EXISTS idx_fvr_invoice ON forecast_vendedor_remap (invoice_code);

-- Seed do caso conhecido: NF 12227 em jun/2026 (R$ 4.772,00) atribuída ao
-- Arthur (259) no produto, mas o relatório oficial coloca no Rafael (21).
INSERT INTO forecast_vendedor_remap
  (invoice_code, branch_code, dealer_origem, dealer_destino, razao)
VALUES
  (12227, 99, 259, 21, 'PDF oficial jun/2026: vendedor da transação = Rafael (21), não Arthur (259)')
ON CONFLICT (branch_code, invoice_code) DO NOTHING;
