-- =====================================================================
-- Solicitações Crosby — adaptação para fluxo de criação de DUPLICATAS
-- na API TOTVS (POST /accounts-payable/v2/duplicates).
--
-- Mantém a tabela existente `solicitacoes_crosby` e ADICIONA todas as
-- colunas necessárias para o novo fluxo:
--
-- 1) Solicitante preenche o formulário (3 tipos: pagamento/compra/manutencao)
-- 2) Gestor aprova (status: aprovado_gestor)
-- 3) Financeiro aprova (status: aprovado_financeiro) — ao aprovar, o
--    payload `payload_totvs` é enviado para a API TOTVS.
-- 4) Resultado (status: enviado_totvs ou erro_envio).
-- =====================================================================

-- Cria tabela caso ela não exista (idempotente)
CREATE TABLE IF NOT EXISTS solicitacoes_crosby (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pendente'
);

-- ---------------------------------------------------------------------
-- Campos básicos (legados — mantidos por compatibilidade)
-- ---------------------------------------------------------------------
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS cd_empresa INTEGER;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS nm_empresa TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS solicitante TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS solicitante_email TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS tipo_solicitacao TEXT; -- pagamento|compra|manutencao
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS nivel_urgencia TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS observacao TEXT;

-- ---------------------------------------------------------------------
-- Campos da DUPLICATA (espelho do payload TOTVS)
-- ---------------------------------------------------------------------
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS branch_cnpj TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS supplier_cpf_cnpj TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS duplicate_code BIGINT;

-- Resumo da 1ª parcela (para exibição em listagem)
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS valor_total NUMERIC(14,2);
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS dt_emissao DATE;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS dt_vencimento DATE;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS dt_chegada DATE;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS document_type TEXT;       -- ex: Duplicate
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS prevision_type TEXT;      -- ex: Forecast/Real
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS stage_type TEXT;          -- ex: InvoiceNotConfered

-- Payload completo serializado (usado no envio à TOTVS)
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS payload_totvs JSONB;

-- ---------------------------------------------------------------------
-- Fluxo de aprovação
-- ---------------------------------------------------------------------
-- Status válidos:
--   pendente | aprovado_gestor | aprovado_financeiro |
--   enviado_totvs | erro_envio | rejeitado | cancelada
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS aprovado_gestor_em TIMESTAMPTZ;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS aprovado_gestor_por UUID;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS aprovado_gestor_por_nome TEXT;

ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS aprovado_financeiro_em TIMESTAMPTZ;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS aprovado_financeiro_por UUID;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS aprovado_financeiro_por_nome TEXT;

ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS enviado_totvs_em TIMESTAMPTZ;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS totvs_response JSONB;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS totvs_erro TEXT;

ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS rejeitado_em TIMESTAMPTZ;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS rejeitado_por UUID;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS rejeitado_por_nome TEXT;
ALTER TABLE solicitacoes_crosby ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

-- ---------------------------------------------------------------------
-- Índices úteis
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_solic_crosby_status   ON solicitacoes_crosby (status);
CREATE INDEX IF NOT EXISTS idx_solic_crosby_tipo     ON solicitacoes_crosby (tipo_solicitacao);
CREATE INDEX IF NOT EXISTS idx_solic_crosby_data     ON solicitacoes_crosby (data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_solic_crosby_empresa  ON solicitacoes_crosby (cd_empresa);

-- ---------------------------------------------------------------------
-- Comentários
-- ---------------------------------------------------------------------
COMMENT ON COLUMN solicitacoes_crosby.tipo_solicitacao IS
  'pagamento | compra | manutencao';
COMMENT ON COLUMN solicitacoes_crosby.status IS
  'pendente | aprovado_gestor | aprovado_financeiro | enviado_totvs | erro_envio | rejeitado | cancelada';
COMMENT ON COLUMN solicitacoes_crosby.payload_totvs IS
  'Payload completo no formato CreatedDuplicateCommand da API TOTVS Accounts Payable v2';
