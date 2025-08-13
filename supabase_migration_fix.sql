-- Script corrigido para resolver problemas de RLS
-- Execute este script no SQL Editor do Supabase

-- 1. Primeiro, vamos remover as políticas existentes (se houver)
DROP POLICY IF EXISTS "Usuários autenticados podem inserir retornos bancários" ON retorno_bancario;
DROP POLICY IF EXISTS "Usuários autenticados podem ler retornos bancários" ON retorno_bancario;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar retornos bancários" ON retorno_bancario;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar retornos bancários" ON retorno_bancario;

-- 2. Desabilitar RLS temporariamente para permitir acesso
ALTER TABLE retorno_bancario DISABLE ROW LEVEL SECURITY;

-- 3. Ou, se preferir manter RLS, criar políticas mais permissivas
-- ALTER TABLE retorno_bancario ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas que permitem acesso público (se RLS estiver habilitado)
-- CREATE POLICY "Permitir acesso público para inserção" ON retorno_bancario
--     FOR INSERT WITH CHECK (true);

-- CREATE POLICY "Permitir acesso público para leitura" ON retorno_bancario
--     FOR SELECT USING (true);

-- CREATE POLICY "Permitir acesso público para atualização" ON retorno_bancario
--     FOR UPDATE USING (true);

-- CREATE POLICY "Permitir acesso público para exclusão" ON retorno_bancario
--     FOR DELETE USING (true);

-- 5. Verificar se a tabela existe e tem a estrutura correta
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
ORDER BY ordinal_position;

-- 6. Verificar se os índices existem
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario';

-- 7. Verificar se RLS está desabilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'retorno_bancario';

-- 8. Teste de inserção (opcional - remova após testar)
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
--     'teste.RET',
--     NOW(),
--     1000.00,
--     'Banco Teste',
--     '001',
--     'CNAB400',
--     '0001',
--     '123456',
--     'R$ 1.000,00',
--     NOW()
-- );

-- 9. Verificar se a inserção funcionou
-- SELECT * FROM retorno_bancario WHERE nome_arquivo = 'teste.RET';

-- 10. Limpar dados de teste (se necessário)
-- DELETE FROM retorno_bancario WHERE nome_arquivo = 'teste.RET';
