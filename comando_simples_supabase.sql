-- COMANDO SIMPLES PARA ADICIONAR A COLUNA usuario_inseriu
-- Execute este comando no SQL Editor do Supabase:

ALTER TABLE retorno_bancario 
ADD COLUMN IF NOT EXISTS usuario_inseriu VARCHAR(255);

-- Adicionar comentário para documentação
COMMENT ON COLUMN retorno_bancario.usuario_inseriu IS 'Nome do usuário que inseriu manualmente o saldo';

-- Verificar se foi adicionada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
AND column_name = 'usuario_inseriu';
