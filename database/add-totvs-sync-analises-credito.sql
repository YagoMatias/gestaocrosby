-- Adiciona campos para integração com TOTVS na tabela analises_credito
ALTER TABLE analises_credito
  ADD COLUMN IF NOT EXISTS branch_code INTEGER,
  ADD COLUMN IF NOT EXISTS totvs_sync_status TEXT
    CHECK (totvs_sync_status IS NULL OR totvs_sync_status IN ('pendente', 'sincronizado', 'erro')),
  ADD COLUMN IF NOT EXISTS totvs_sync_message TEXT,
  ADD COLUMN IF NOT EXISTS totvs_sync_em TIMESTAMPTZ;
