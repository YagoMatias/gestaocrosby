-- =====================================================
-- ADICIONAR COLUNA usuario_inseriu NA TABELA retorno_bancario
-- =====================================================

-- 1. Verificar se a tabela retorno_bancario existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'retorno_bancario'
);

-- 2. Verificar a estrutura atual da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'retorno_bancario'
ORDER BY ordinal_position;

-- 3. Adicionar a coluna usuario_inseriu
ALTER TABLE retorno_bancario 
ADD COLUMN usuario_inseriu VARCHAR(255);

-- 4. Adicionar comentário na coluna para documentação
COMMENT ON COLUMN retorno_bancario.usuario_inseriu IS 'Nome do usuário que inseriu manualmente o saldo';

-- 5. Verificar se a coluna foi adicionada corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'retorno_bancario'
AND column_name = 'usuario_inseriu';

-- 6. Atualizar registros existentes de saldos manuais (opcional)
-- Se você já tem saldos manuais inseridos e quer adicionar o nome do usuário
UPDATE retorno_bancario 
SET usuario_inseriu = 'Usuário Sistema'
WHERE nome_arquivo = 'saldo_manual' 
AND usuario_inseriu IS NULL;

-- 7. Verificar registros de saldos manuais existentes
SELECT 
    id,
    nome_arquivo,
    banco_nome,
    agencia,
    conta,
    valor,
    usuario_inseriu,
    created_at
FROM retorno_bancario 
WHERE nome_arquivo = 'saldo_manual'
ORDER BY created_at DESC;

-- 8. Criar índice para melhor performance (opcional)
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_usuario_inseriu 
ON retorno_bancario(usuario_inseriu);

-- 9. Verificar as políticas RLS para incluir a nova coluna
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'retorno_bancario';

-- 10. Atualizar políticas RLS se necessário (exemplo)
-- Se você tem políticas que incluem todas as colunas, elas devem funcionar automaticamente
-- Se você tem políticas específicas, pode precisar atualizá-las

-- =====================================================
-- INSTRUÇÕES DE EXECUÇÃO:
-- =====================================================
-- 1. Execute as consultas 1-2 para verificar o estado atual
-- 2. Execute a consulta 3 para adicionar a coluna
-- 3. Execute a consulta 4 para adicionar documentação
-- 4. Execute a consulta 5 para verificar se foi adicionada
-- 5. Execute a consulta 6 se quiser atualizar registros existentes
-- 6. Execute a consulta 7 para verificar os dados
-- 7. Execute a consulta 8 para criar índice (opcional)
-- 8. Execute a consulta 9 para verificar políticas RLS
-- =====================================================

-- =====================================================
-- COMANDOS ALTERNATIVOS (se necessário):
-- =====================================================

-- Se precisar remover a coluna (emergência):
-- ALTER TABLE retorno_bancario DROP COLUMN IF EXISTS usuario_inseriu;

-- Se precisar alterar o tipo da coluna:
-- ALTER TABLE retorno_bancario ALTER COLUMN usuario_inseriu TYPE TEXT;

-- Se precisar tornar a coluna obrigatória (não recomendado para registros existentes):
-- ALTER TABLE retorno_bancario ALTER COLUMN usuario_inseriu SET NOT NULL;

-- =====================================================
