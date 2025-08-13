-- Criação da tabela retorno_bancario
-- Execute este script no SQL Editor do Supabase

-- Criar a tabela
CREATE TABLE IF NOT EXISTS retorno_bancario (
    id BIGSERIAL PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    data_upload TIMESTAMP WITH TIME ZONE NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    banco_nome VARCHAR(100) NOT NULL,
    banco_codigo VARCHAR(10) NOT NULL,
    banco_layout VARCHAR(50) NOT NULL,
    agencia VARCHAR(20) NOT NULL,
    conta VARCHAR(20) NOT NULL,
    saldo_formatado VARCHAR(50) NOT NULL,
    data_processamento TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_nome_arquivo ON retorno_bancario(nome_arquivo);
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_data_upload ON retorno_bancario(data_upload);
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_valor ON retorno_bancario(valor);
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_banco_nome ON retorno_bancario(banco_nome);
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_created_at ON retorno_bancario(created_at);

-- Criar índice único composto para evitar duplicatas
-- Este índice garante que não haverá arquivos duplicados baseado em nome, data e valor
CREATE UNIQUE INDEX IF NOT EXISTS idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, data_upload, valor);

-- Criar função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_retorno_bancario_updated_at 
    BEFORE UPDATE ON retorno_bancario 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Criar RLS (Row Level Security) policies
ALTER TABLE retorno_bancario ENABLE ROW LEVEL SECURITY;

-- Policy para permitir inserção apenas para usuários autenticados
CREATE POLICY "Usuários autenticados podem inserir retornos bancários" ON retorno_bancario
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy para permitir leitura apenas para usuários autenticados
CREATE POLICY "Usuários autenticados podem ler retornos bancários" ON retorno_bancario
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy para permitir atualização apenas para usuários autenticados
CREATE POLICY "Usuários autenticados podem atualizar retornos bancários" ON retorno_bancario
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy para permitir exclusão apenas para usuários autenticados
CREATE POLICY "Usuários autenticados podem deletar retornos bancários" ON retorno_bancario
    FOR DELETE USING (auth.role() = 'authenticated');

-- Comentários na tabela
COMMENT ON TABLE retorno_bancario IS 'Tabela para armazenar dados de arquivos .RET processados';
COMMENT ON COLUMN retorno_bancario.id IS 'ID único do registro';
COMMENT ON COLUMN retorno_bancario.nome_arquivo IS 'Nome original do arquivo .RET';
COMMENT ON COLUMN retorno_bancario.data_upload IS 'Data e hora do upload do arquivo';
COMMENT ON COLUMN retorno_bancario.valor IS 'Valor do saldo extraído do arquivo';
COMMENT ON COLUMN retorno_bancario.banco_nome IS 'Nome do banco identificado no arquivo';
COMMENT ON COLUMN retorno_bancario.banco_codigo IS 'Código do banco';
COMMENT ON COLUMN retorno_bancario.banco_layout IS 'Layout do arquivo identificado';
COMMENT ON COLUMN retorno_bancario.agencia IS 'Número da agência';
COMMENT ON COLUMN retorno_bancario.conta IS 'Número da conta';
COMMENT ON COLUMN retorno_bancario.saldo_formatado IS 'Saldo formatado em moeda brasileira';
COMMENT ON COLUMN retorno_bancario.data_processamento IS 'Data e hora do processamento';
COMMENT ON COLUMN retorno_bancario.created_at IS 'Data e hora de criação do registro';
COMMENT ON COLUMN retorno_bancario.updated_at IS 'Data e hora da última atualização';

-- Verificar se a tabela foi criada corretamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
ORDER BY ordinal_position;
