-- =============================================================================
-- SCHEMA PARA TABELA DE METAS VAREJO - SUPABASE
-- =============================================================================

-- Criar tabela para armazenar metas mensais de lojas e vendedores
CREATE TABLE IF NOT EXISTS metas_varejo (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação do tipo e entidade
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('lojas', 'vendedores')),
    nome VARCHAR(255) NOT NULL,
    
    -- Tipo de meta
    campo VARCHAR(20) NOT NULL CHECK (campo IN ('bronze', 'prata', 'ouro', 'diamante')),
    valor VARCHAR(50) NOT NULL, -- Valor formatado como "R$ 1.000,00"
    
    -- Período da meta (formato YYYY-MM)
    mes VARCHAR(7) NOT NULL,
    
    -- Auditoria
    usuario VARCHAR(100) NOT NULL,
    data_alteracao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices para performance
    CONSTRAINT unique_meta_per_entity_per_month UNIQUE (tipo, nome, campo, mes)
);

-- =============================================================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================================================

-- Índice para buscas por período
CREATE INDEX IF NOT EXISTS idx_metas_varejo_mes ON metas_varejo (mes);

-- Índice para buscas por tipo
CREATE INDEX IF NOT EXISTS idx_metas_varejo_tipo ON metas_varejo (tipo);

-- Índice para buscas por nome
CREATE INDEX IF NOT EXISTS idx_metas_varejo_nome ON metas_varejo (nome);

-- Índice para buscas por data de alteração (para logs)
CREATE INDEX IF NOT EXISTS idx_metas_varejo_data_alteracao ON metas_varejo (data_alteracao DESC);

-- Índice composto para buscas otimizadas
CREATE INDEX IF NOT EXISTS idx_metas_varejo_tipo_mes ON metas_varejo (tipo, mes);

-- =============================================================================
-- RLS (Row Level Security) - OPCIONAL
-- =============================================================================

-- Habilitar RLS na tabela
ALTER TABLE metas_varejo ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura para usuários autenticados
CREATE POLICY "Permitir leitura para usuários autenticados" ON metas_varejo
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para permitir inserção para usuários autenticados
CREATE POLICY "Permitir inserção para usuários autenticados" ON metas_varejo
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política para permitir atualização para usuários autenticados
CREATE POLICY "Permitir atualização para usuários autenticados" ON metas_varejo
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Política para permitir exclusão para usuários autenticados
CREATE POLICY "Permitir exclusão para usuários autenticados" ON metas_varejo
    FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================================================
-- TRIGGER PARA ATUALIZAR DATA_ALTERACAO AUTOMATICAMENTE
-- =============================================================================

-- Função para atualizar data_alteracao
CREATE OR REPLACE FUNCTION update_data_alteracao()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_alteracao = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para executar a função antes de INSERT/UPDATE
CREATE TRIGGER trigger_update_data_alteracao
    BEFORE INSERT OR UPDATE ON metas_varejo
    FOR EACH ROW
    EXECUTE FUNCTION update_data_alteracao();

-- =============================================================================
-- DADOS DE EXEMPLO (OPCIONAL - REMOVER EM PRODUÇÃO)
-- =============================================================================

-- Inserir alguns dados de exemplo para teste
INSERT INTO metas_varejo (tipo, nome, campo, valor, mes, usuario) VALUES
('lojas', 'CROSBY SHOPPING MIDWAY', 'bronze', 'R$ 50.000,00', '2024-01', 'João Silva'),
('lojas', 'CROSBY SHOPPING MIDWAY', 'prata', 'R$ 75.000,00', '2024-01', 'João Silva'),
('lojas', 'CROSBY VILLA LOBOS', 'ouro', 'R$ 100.000,00', '2024-01', 'Ana Costa'),
('vendedores', 'MARIA SANTOS', 'diamante', 'R$ 200.000,00', '2024-01', 'Pedro Oliveira'),
('vendedores', 'CARLOS FERREIRA', 'bronze', 'R$ 30.000,00', '2024-01', 'Maria Santos')
ON CONFLICT (tipo, nome, campo, mes) DO NOTHING;

-- =============================================================================
-- VIEWS ÚTEIS (OPCIONAL)
-- =============================================================================

-- View para metas consolidadas por loja/mês
CREATE OR REPLACE VIEW view_metas_lojas_consolidadas AS
SELECT 
    nome,
    mes,
    MAX(CASE WHEN campo = 'bronze' THEN valor END) as meta_bronze,
    MAX(CASE WHEN campo = 'prata' THEN valor END) as meta_prata,
    MAX(CASE WHEN campo = 'ouro' THEN valor END) as meta_ouro,
    MAX(CASE WHEN campo = 'diamante' THEN valor END) as meta_diamante,
    MAX(data_alteracao) as ultima_alteracao
FROM metas_varejo 
WHERE tipo = 'lojas'
GROUP BY nome, mes
ORDER BY nome, mes DESC;

-- View para metas consolidadas por vendedor/mês
CREATE OR REPLACE VIEW view_metas_vendedores_consolidadas AS
SELECT 
    nome,
    mes,
    MAX(CASE WHEN campo = 'bronze' THEN valor END) as meta_bronze,
    MAX(CASE WHEN campo = 'prata' THEN valor END) as meta_prata,
    MAX(CASE WHEN campo = 'ouro' THEN valor END) as meta_ouro,
    MAX(CASE WHEN campo = 'diamante' THEN valor END) as meta_diamante,
    MAX(data_alteracao) as ultima_alteracao
FROM metas_varejo 
WHERE tipo = 'vendedores'
GROUP BY nome, mes
ORDER BY nome, mes DESC;

-- =============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =============================================================================

COMMENT ON TABLE metas_varejo IS 'Tabela para armazenar metas mensais de lojas e vendedores do canal varejo';
COMMENT ON COLUMN metas_varejo.tipo IS 'Tipo da entidade: lojas ou vendedores';
COMMENT ON COLUMN metas_varejo.nome IS 'Nome da loja ou vendedor';
COMMENT ON COLUMN metas_varejo.campo IS 'Tipo de meta: bronze, prata, ouro, diamante';
COMMENT ON COLUMN metas_varejo.valor IS 'Valor da meta formatado em reais';
COMMENT ON COLUMN metas_varejo.mes IS 'Período da meta no formato YYYY-MM';
COMMENT ON COLUMN metas_varejo.usuario IS 'Usuário que criou/alterou a meta';
COMMENT ON COLUMN metas_varejo.data_alteracao IS 'Data e hora da última alteração';
