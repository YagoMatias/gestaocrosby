-- =====================================================================
-- Forma de pagamento "Saldo PagBank"
-- =====================================================================
-- No formulário de solicitações a forma vale 'saldo_pagbank' e a chave da
-- conta PagBank fica em solicitacoes_crosby.chave_pix (mesma coluna da
-- chave PIX). Ao liberar para pagamento a linha vai para a fila com
-- forma_pagamento = 'PAGBANK' — o CHECK de pagamentos_liberacao precisa
-- conhecer o valor novo.
-- =====================================================================

ALTER TABLE pagamentos_liberacao
  DROP CONSTRAINT IF EXISTS pagamentos_liberacao_forma_pagamento_check;

ALTER TABLE pagamentos_liberacao
  ADD CONSTRAINT pagamentos_liberacao_forma_pagamento_check
  CHECK (
    forma_pagamento IN ('PIX', 'BOLETO', 'DEBITO', 'CREDITO', 'PAGBANK')
    OR forma_pagamento IS NULL
  );

NOTIFY pgrst, 'reload schema';
