-- Tabela para armazenar valor real pago e comprovante por fornecedor/categoria
-- na página de Despesas de Indústria
CREATE TABLE IF NOT EXISTS despesas_industria_pagamentos (
  id BIGSERIAL PRIMARY KEY,
  cd_fornecedor TEXT NOT NULL,
  nm_fornecedor TEXT,
  categoria_codigo INTEGER NOT NULL, -- 1001, 1002 ou 1005
  valor_real NUMERIC(15,2),
  dt_atualizacao TIMESTAMPTZ DEFAULT NOW(),
  comprovante_path TEXT,
  comprovante_nome TEXT,
  comprovante_tipo TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_fornecedor_categoria UNIQUE (cd_fornecedor, categoria_codigo)
);

CREATE INDEX IF NOT EXISTS idx_dip_categoria ON despesas_industria_pagamentos (categoria_codigo);
CREATE INDEX IF NOT EXISTS idx_dip_fornecedor ON despesas_industria_pagamentos (cd_fornecedor);

-- RLS
ALTER TABLE despesas_industria_pagamentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'despesas_industria_pagamentos' AND policyname = 'Leitura autenticada') THEN
    CREATE POLICY "Leitura autenticada"    ON despesas_industria_pagamentos FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'despesas_industria_pagamentos' AND policyname = 'Insercao autenticada') THEN
    CREATE POLICY "Insercao autenticada"   ON despesas_industria_pagamentos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'despesas_industria_pagamentos' AND policyname = 'Atualizacao autenticada') THEN
    CREATE POLICY "Atualizacao autenticada" ON despesas_industria_pagamentos FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'despesas_industria_pagamentos' AND policyname = 'Exclusao autenticada') THEN
    CREATE POLICY "Exclusao autenticada"   ON despesas_industria_pagamentos FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Bucket Storage necessário no Supabase: "despesas-industria"
-- (criar pelo Studio caso ainda não exista — privado, acesso via service role/policy do projeto)

-- MIGRAÇÃO: adicionar coluna checado (execute se a tabela já existir)
ALTER TABLE despesas_industria_pagamentos
  ADD COLUMN IF NOT EXISTS checado BOOLEAN NOT NULL DEFAULT FALSE;
