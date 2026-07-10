-- =====================================================================
-- pagamentos_fabricas — reformulação (mescla Solicitações + Formulário)
-- =====================================================================
-- Novos campos de fornecedor (CNPJ/código), forma de pagamento
-- (PIX/BOLETO/CARTAO) + informação, e vínculo com a fila de
-- Liberação de Pagamento (pagamentos_liberacao).
-- Execute no Supabase SQL Editor.
-- =====================================================================

ALTER TABLE pagamentos_fabricas
  -- Empresa (código TOTVS: 1 = MATRIZ, 99 = BREJINHO)
  ADD COLUMN IF NOT EXISTS cd_empresa                  INTEGER,

  -- Fornecedor (busca por CNPJ / nome / nome fantasia em pes_pessoa)
  ADD COLUMN IF NOT EXISTS fornecedor_cnpj             TEXT,
  ADD COLUMN IF NOT EXISTS fornecedor_codigo           TEXT,

  -- Forma de pagamento informada no cadastro
  ADD COLUMN IF NOT EXISTS tipo_pagamento              TEXT,   -- 'PIX' | 'BOLETO' | 'CARTAO'
  ADD COLUMN IF NOT EXISTS info_pagamento              TEXT,   -- chave PIX / linha do boleto / info do cartão

  -- Vínculo com a Liberação de Pagamento
  ADD COLUMN IF NOT EXISTS pagamento_liberacao_id      UUID,
  ADD COLUMN IF NOT EXISTS liberado_pagamento_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS liberado_pagamento_por      UUID,
  ADD COLUMN IF NOT EXISTS liberado_pagamento_por_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_pag_fabricas_pgto_lib
  ON pagamentos_fabricas (pagamento_liberacao_id);

COMMENT ON COLUMN pagamentos_fabricas.pagamento_liberacao_id IS
  'FK lógica para pagamentos_liberacao.id, criada ao liberar o pagamento.';
COMMENT ON COLUMN pagamentos_fabricas.tipo_pagamento IS
  'Forma de pagamento do cadastro: PIX, BOLETO ou CARTAO.';
COMMENT ON COLUMN pagamentos_fabricas.info_pagamento IS
  'Chave PIX / linha digitável do boleto / info do cartão. Obrigatório para PIX e BOLETO.';

-- =====================================================================
-- STATUS
-- Agora os status válidos são:
--   'Aguardando Nota', 'Pendente de Escrituração',
--   'Aguardando Pagamento', 'Pago'
-- O status é definido no cadastro e pode ser editado por qualquer
-- usuário. 'Pago' é aplicado automaticamente quando o título é pago
-- na tela de Liberação de Pagamento.
-- =====================================================================
ALTER TABLE pagamentos_fabricas ALTER COLUMN status SET DEFAULT 'Aguardando Nota';

-- Normaliza registros antigos para os novos status
UPDATE pagamentos_fabricas SET status = 'Aguardando Pagamento'   WHERE status IN ('Pendente', 'Parcial');
UPDATE pagamentos_fabricas SET status = 'Pendente de Escrituração'
  WHERE status NOT IN ('Aguardando Nota', 'Pendente de Escrituração', 'Aguardando Pagamento', 'Pago');
