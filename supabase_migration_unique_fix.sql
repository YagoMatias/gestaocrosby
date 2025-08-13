-- Script para corrigir o índice único da tabela retorno_bancario
-- Remove a data da chave única e usa apenas nome_arquivo, valor, banco_nome, banco_codigo

-- 1. Remover o índice único antigo
DROP INDEX IF EXISTS idx_retorno_bancario_unique_file;

-- 2. Criar novo índice único sem a data
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo);

-- 3. Verificar se o índice foi criado corretamente
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario' 
AND indexname = 'idx_retorno_bancario_unique_file';

-- 4. Verificar se há dados duplicados que precisam ser limpos
-- (Execute apenas se quiser verificar duplicatas existentes)
SELECT 
    nome_arquivo, 
    valor, 
    banco_nome, 
    banco_codigo,
    COUNT(*) as quantidade
FROM retorno_bancario 
GROUP BY nome_arquivo, valor, banco_nome, banco_codigo
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- 5. Se houver duplicatas, você pode limpar mantendo apenas o registro mais recente
-- (Descomente e execute apenas se necessário)
/*
DELETE FROM retorno_bancario 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM retorno_bancario 
    GROUP BY nome_arquivo, valor, banco_nome, banco_codigo
);
*/

-- 6. Teste de inserção com dados iguais (deve falhar na segunda tentativa)
-- Primeira inserção (deve funcionar)
INSERT INTO retorno_bancario (
    nome_arquivo,
    data_upload,
    valor,
    banco_nome,
    banco_codigo,
    banco_layout,
    agencia,
    conta,
    saldo_formatado,
    data_processamento
) VALUES (
    'teste_duplicado.RET',
    NOW(),
    1000.00,
    'Banco Teste',
    '001',
    'CNAB400',
    '0001',
    '123456',
    'R$ 1.000,00',
    NOW()
);

-- Segunda inserção com mesmos dados (deve falhar)
-- INSERT INTO retorno_bancario (
--     nome_arquivo,
--     data_upload,
--     valor,
--     banco_nome,
--     banco_codigo,
--     banco_layout,
--     agencia,
--     conta,
--     saldo_formatado,
--     data_processamento
-- ) VALUES (
--     'teste_duplicado.RET',
--     NOW() + INTERVAL '1 hour', -- Data diferente
--     1000.00,
--     'Banco Teste',
--     '001',
--     'CNAB400',
--     '0001',
--     '123456',
--     'R$ 1.000,00',
--     NOW()
-- );

-- 7. Limpar dados de teste
DELETE FROM retorno_bancario WHERE nome_arquivo = 'teste_duplicado.RET';

-- 8. Verificar estrutura final
SELECT 
    'Índices únicos:' as tipo,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'retorno_bancario' 
AND indexdef LIKE '%UNIQUE%'

UNION ALL

SELECT 
    'Todos os índices:' as tipo,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'retorno_bancario';
