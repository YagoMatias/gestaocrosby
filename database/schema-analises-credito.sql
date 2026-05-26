-- ─── Análises de crédito (MULTIMARCAS) ──────────────────────────────────────
-- Workflow:
--   1. Qualquer usuário com acesso à página "Análise de Crédito" solicita.
--   2. Apenas usuários financeiro / admin / owner concluem a análise,
--      definindo o limite aprovado.
--   3. Análises concluídas ficam visíveis a todos na aba "Clientes analisados".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analises_credito (
  id BIGSERIAL PRIMARY KEY,

  -- Cliente (TOTVS)
  person_code INTEGER NOT NULL,
  cliente_nome TEXT,
  cliente_cpf_cnpj TEXT,
  cliente_uf TEXT,

  -- Solicitação
  solicitado_por UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  solicitado_por_nome TEXT,
  solicitado_por_email TEXT,
  solicitado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes_solicitacao TEXT,

  -- Status do fluxo
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'cancelada')),

  -- Conclusão (financeiro/admin/owner)
  limite_aprovado NUMERIC(14, 2),
  observacoes_analise TEXT,
  aprovado_por UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  aprovado_por_nome TEXT,
  aprovado_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analises_credito_status
  ON analises_credito (status);
CREATE INDEX IF NOT EXISTS idx_analises_credito_person_code
  ON analises_credito (person_code);
CREATE INDEX IF NOT EXISTS idx_analises_credito_solicitado_em
  ON analises_credito (solicitado_em DESC);

-- Trigger para manter updated_at em sincronia
CREATE OR REPLACE FUNCTION update_analises_credito_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_analises_credito_updated_at ON analises_credito;
CREATE TRIGGER trg_analises_credito_updated_at
  BEFORE UPDATE ON analises_credito
  FOR EACH ROW EXECUTE FUNCTION update_analises_credito_updated_at();

-- RLS
ALTER TABLE analises_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analises_credito_select_all" ON analises_credito;
CREATE POLICY "analises_credito_select_all" ON analises_credito
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "analises_credito_insert_auth" ON analises_credito;
CREATE POLICY "analises_credito_insert_auth" ON analises_credito
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "analises_credito_update_auth" ON analises_credito;
CREATE POLICY "analises_credito_update_auth" ON analises_credito
  FOR UPDATE USING (auth.role() = 'authenticated');
