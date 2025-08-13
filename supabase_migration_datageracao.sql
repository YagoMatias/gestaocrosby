-- Script para adicionar dataGeracao à tabela retorno_bancario
-- e atualizar a chave única para incluir dataGeracao

-- 1. Adicionar nova coluna dataGeracao
ALTER TABLE retorno_bancario 
ADD COLUMN IF NOT EXISTS data_geracao TIMESTAMP WITH TIME ZONE;

-- 2. Remover índice único antigo
DROP INDEX IF EXISTS idx_retorno_bancario_unique_file;

-- 3. Criar novo índice único incluindo data_geracao
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo, data_geracao);

-- 4. Verificar se a coluna foi adicionada corretamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
AND column_name = 'data_geracao'
ORDER BY ordinal_position;

-- 5. Verificar se o índice foi criado corretamente
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario' 
AND indexname = 'idx_retorno_bancario_unique_file';

-- 6. Verificar se há dados duplicados que precisam ser limpos
-- (Execute apenas se quiser verificar duplicatas existentes)
SELECT 
    nome_arquivo, 
    valor, 
    banco_nome, 
    banco_codigo,
    data_geracao,
    COUNT(*) as quantidade
FROM retorno_bancario 
GROUP BY nome_arquivo, valor, banco_nome, banco_codigo, data_geracao
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- 7. Se houver duplicatas, você pode limpar mantendo apenas o registro mais recente
-- (Descomente e execute apenas se necessário)
/*
DELETE FROM retorno_bancario 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM retorno_bancario 
    GROUP BY nome_arquivo, valor, banco_nome, banco_codigo, data_geracao
);
*/

-- 8. Teste de inserção com dados iguais (deve falhar na segunda tentativa)
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
    data_processamento,
    data_geracao
) VALUES (
    'teste_datageracao.RET',
    NOW(),
    1000.00,
    'Banco Teste',
    '001',
    'CNAB400',
    '0001',
    '123456',
    'R$ 1.000,00',
    NOW(),
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
--     data_processamento,
--     data_geracao
-- ) VALUES (
--     'teste_datageracao.RET',
--     NOW() + INTERVAL '1 hour', -- Data de upload diferente
--     1000.00,
--     'Banco Teste',
--     '001',
--     'CNAB400',
--     '0001',
--     '123456',
--     'R$ 1.000,00',
--     NOW(),
--     NOW() -- Mesma data de geração
-- );

-- 9. Limpar dados de teste
DELETE FROM retorno_bancario WHERE nome_arquivo = 'teste_datageracao.RET';

-- 10. Verificar estrutura final
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

-- 11. Verificar estrutura completa da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
ORDER BY ordinal_position;
