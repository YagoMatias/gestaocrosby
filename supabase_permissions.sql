-- =====================================================
-- CONFIGURAÇÕES DE PERMISSÃO PARA EXCLUSÃO DE SALDOS MANUAIS
-- =====================================================

-- 1. Verificar se a tabela retorno_bancario existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'retorno_bancario'
);

-- 2. Verificar as políticas RLS atuais
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

-- 3. Criar política para permitir exclusão de saldos manuais
-- (Execute apenas se não existir uma política de DELETE)
CREATE POLICY "Permitir exclusão de saldos manuais" ON retorno_bancario
FOR DELETE USING (
    nome_arquivo = 'saldo_manual'
);

-- 4. Criar política para permitir atualização de saldos manuais
-- (Para marcar como deletado)
CREATE POLICY "Permitir atualização de saldos manuais" ON retorno_bancario
FOR UPDATE USING (
    nome_arquivo = 'saldo_manual'
) WITH CHECK (
    nome_arquivo = 'saldo_manual'
);

-- 5. Verificar se o RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'retorno_bancario';

-- 6. Se necessário, habilitar RLS (descomente se necessário)
-- ALTER TABLE retorno_bancario ENABLE ROW LEVEL SECURITY;

-- 7. Criar função RPC para remoção segura (opcional)
CREATE OR REPLACE FUNCTION remover_saldo_manual(saldo_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    resultado JSON;
BEGIN
    -- Verificar se o registro existe e é um saldo manual
    IF NOT EXISTS (
        SELECT 1 FROM retorno_bancario 
        WHERE id = saldo_id AND nome_arquivo = 'saldo_manual'
    ) THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Registro não encontrado ou não é um saldo manual'
        );
    END IF;
    
    -- Tentar excluir
    DELETE FROM retorno_bancario 
    WHERE id = saldo_id AND nome_arquivo = 'saldo_manual';
    
    -- Verificar se foi excluído
    IF FOUND THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Saldo manual removido com sucesso'
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'message', 'Não foi possível remover o saldo manual'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Erro ao remover saldo: ' || SQLERRM
        );
END;
$$;

-- 8. Conceder permissões para a função RPC
GRANT EXECUTE ON FUNCTION remover_saldo_manual(BIGINT) TO authenticated;

-- 9. Verificar registros de saldos manuais existentes
SELECT 
    id,
    nome_arquivo,
    banco_nome,
    agencia,
    conta,
    valor,
    created_at
FROM retorno_bancario 
WHERE nome_arquivo = 'saldo_manual'
ORDER BY created_at DESC;

-- 10. Verificar registros marcados como deletados
SELECT 
    id,
    nome_arquivo,
    banco_nome,
    agencia,
    conta,
    valor,
    created_at
FROM retorno_bancario 
WHERE nome_arquivo = 'saldo_manual_deletado'
ORDER BY created_at DESC;

-- =====================================================
-- INSTRUÇÕES DE USO:
-- =====================================================
-- 1. Execute as consultas 1-5 para verificar o estado atual
-- 2. Execute as consultas 3-4 para criar as políticas necessárias
-- 3. Execute as consultas 7-8 para criar a função RPC (opcional)
-- 4. Execute as consultas 9-10 para verificar os dados
-- =====================================================
