-- Tabela: pagamentos_fabricas
CREATE TABLE IF NOT EXISTS pagamentos_fabricas (
  id BIGSERIAL PRIMARY KEY,
  empresa TEXT NOT NULL,
  transacao TEXT,
  fornecedor TEXT NOT NULL,
  nfe TEXT,
  valor NUMERIC(12,2),
  data_lancamento DATE,
  status TEXT DEFAULT 'Pendente',
  data_pagamento DATE,
  forma TEXT,
  cartao_conta TEXT,
  parcelas NUMERIC(5,0),
  valor_pago NUMERIC(12,2),
  observacao TEXT,
  tem_nota BOOLEAN DEFAULT true,
  tem_transacao BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE pagamentos_fabricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagamentos_fabricas_select" ON pagamentos_fabricas FOR SELECT USING (true);
CREATE POLICY "pagamentos_fabricas_insert" ON pagamentos_fabricas FOR INSERT WITH CHECK (true);
CREATE POLICY "pagamentos_fabricas_update" ON pagamentos_fabricas FOR UPDATE USING (true);
CREATE POLICY "pagamentos_fabricas_delete" ON pagamentos_fabricas FOR DELETE USING (true);
