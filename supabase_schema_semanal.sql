-- =============================================================================
-- SCHEMA PARA TABELA DE METAS SEMANAIS VAREJO - SUPABASE
-- =============================================================================

-- Criar tabela para armazenar metas semanais de lojas e vendedores
CREATE TABLE IF NOT EXISTS metas_semanais_varejo (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação do tipo e entidade
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('lojas', 'vendedores')),
    nome VARCHAR(255) NOT NULL,
    
    -- Período da meta (formato YYYY-MM-DD para início da semana)
    semana_inicio DATE NOT NULL,
    semana_fim DATE NOT NULL,
    
    -- Tipo de meta
    campo VARCHAR(20) NOT NULL CHECK (campo IN ('bronze', 'prata', 'ouro', 'diamante')),
    valor DECIMAL(15,2) NOT NULL, -- Valor numérico para cálculos
    
    -- Mês de referência para agrupamento (formato YYYY-MM)
    mes_referencia VARCHAR(7) NOT NULL,
    
    -- Número da semana no mês (1, 2, 3, 4, 5)
    numero_semana INTEGER NOT NULL CHECK (numero_semana BETWEEN 1 AND 5),
    
    -- Auditoria
    usuario VARCHAR(100) NOT NULL,
    data_alteracao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices para performance
    CONSTRAINT unique_meta_semanal_per_entity UNIQUE (tipo, nome, campo, semana_inicio)
);

-- =============================================================================
-- TABELA PARA METAS MENSAIS CALCULADAS (DERIVADAS DAS SEMANAIS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS metas_mensais_calculadas (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação do tipo e entidade
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('lojas', 'vendedores')),
    nome VARCHAR(255) NOT NULL,
    
    -- Mês de referência (formato YYYY-MM)
    mes VARCHAR(7) NOT NULL,
    
    -- Metas calculadas das semanas
    bronze DECIMAL(15,2) NOT NULL DEFAULT 0,
    prata DECIMAL(15,2) NOT NULL DEFAULT 0,
    ouro DECIMAL(15,2) NOT NULL DEFAULT 0,
    diamante DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Status de cálculo
    calculado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario VARCHAR(100) NOT NULL,
    
    -- Chave única por entidade e mês
    CONSTRAINT unique_meta_mensal_calculada UNIQUE (tipo, nome, mes)
);

-- =============================================================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================================================

-- Índices para metas semanais
CREATE INDEX IF NOT EXISTS idx_metas_semanais_mes_referencia ON metas_semanais_varejo (mes_referencia);
CREATE INDEX IF NOT EXISTS idx_metas_semanais_tipo ON metas_semanais_varejo (tipo);
CREATE INDEX IF NOT EXISTS idx_metas_semanais_nome ON metas_semanais_varejo (nome);
CREATE INDEX IF NOT EXISTS idx_metas_semanais_semana_inicio ON metas_semanais_varejo (semana_inicio);
CREATE INDEX IF NOT EXISTS idx_metas_semanais_numero_semana ON metas_semanais_varejo (numero_semana);
CREATE INDEX IF NOT EXISTS idx_metas_semanais_data_alteracao ON metas_semanais_varejo (data_alteracao DESC);

-- Índices compostos
CREATE INDEX IF NOT EXISTS idx_metas_semanais_tipo_mes ON metas_semanais_varejo (tipo, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_metas_semanais_nome_mes ON metas_semanais_varejo (nome, mes_referencia);

-- Índices para metas mensais calculadas
CREATE INDEX IF NOT EXISTS idx_metas_mensais_calculadas_mes ON metas_mensais_calculadas (mes);
CREATE INDEX IF NOT EXISTS idx_metas_mensais_calculadas_tipo ON metas_mensais_calculadas (tipo);
CREATE INDEX IF NOT EXISTS idx_metas_mensais_calculadas_nome ON metas_mensais_calculadas (nome);

-- =============================================================================
-- FUNÇÕES AUXILIARES PARA CÁLCULOS
-- =============================================================================

-- Função para obter o primeiro dia da semana de uma data
CREATE OR REPLACE FUNCTION obter_inicio_semana(data_input DATE)
RETURNS DATE AS $$
BEGIN
    RETURN data_input - (EXTRACT(DOW FROM data_input)::INTEGER - 1);
END;
$$ LANGUAGE plpgsql;

-- Função para obter o último dia da semana de uma data
CREATE OR REPLACE FUNCTION obter_fim_semana(data_input DATE)
RETURNS DATE AS $$
BEGIN
    RETURN data_input - (EXTRACT(DOW FROM data_input)::INTEGER - 1) + 6;
END;
$$ LANGUAGE plpgsql;

-- Função para obter o número da semana no mês
CREATE OR REPLACE FUNCTION obter_numero_semana_mes(data_input DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN CEIL(EXTRACT(DAY FROM data_input)::INTEGER / 7.0);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER PARA RECALCULAR METAS MENSAIS AUTOMATICAMENTE
-- =============================================================================

-- Função do trigger
CREATE OR REPLACE FUNCTION recalcular_meta_mensal()
RETURNS TRIGGER AS $$
DECLARE
    tipo_meta VARCHAR(20);
    nome_meta VARCHAR(255);
    mes_ref VARCHAR(7);
    bronze_total DECIMAL(15,2);
    prata_total DECIMAL(15,2);
    ouro_total DECIMAL(15,2);
    diamante_total DECIMAL(15,2);
BEGIN
    -- Determinar se é INSERT, UPDATE ou DELETE
    IF TG_OP = 'DELETE' THEN
        tipo_meta := OLD.tipo;
        nome_meta := OLD.nome;
        mes_ref := OLD.mes_referencia;
    ELSE
        tipo_meta := NEW.tipo;
        nome_meta := NEW.nome;
        mes_ref := NEW.mes_referencia;
    END IF;

    -- Calcular totais das semanas para o mês
    SELECT 
        COALESCE(SUM(CASE WHEN campo = 'bronze' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN campo = 'prata' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN campo = 'ouro' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN campo = 'diamante' THEN valor ELSE 0 END), 0)
    INTO bronze_total, prata_total, ouro_total, diamante_total
    FROM metas_semanais_varejo
    WHERE tipo = tipo_meta 
      AND nome = nome_meta 
      AND mes_referencia = mes_ref;

    -- Inserir ou atualizar meta mensal calculada
    INSERT INTO metas_mensais_calculadas (tipo, nome, mes, bronze, prata, ouro, diamante, usuario)
    VALUES (tipo_meta, nome_meta, mes_ref, bronze_total, prata_total, ouro_total, diamante_total, 
            COALESCE(NEW.usuario, OLD.usuario, 'Sistema'))
    ON CONFLICT (tipo, nome, mes)
    DO UPDATE SET
        bronze = EXCLUDED.bronze,
        prata = EXCLUDED.prata,
        ouro = EXCLUDED.ouro,
        diamante = EXCLUDED.diamante,
        calculado_em = NOW(),
        usuario = EXCLUDED.usuario;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_recalcular_meta_mensal ON metas_semanais_varejo;
CREATE TRIGGER trigger_recalcular_meta_mensal
    AFTER INSERT OR UPDATE OR DELETE ON metas_semanais_varejo
    FOR EACH ROW EXECUTE FUNCTION recalcular_meta_mensal();

-- =============================================================================
-- VIEWS PARA FACILITAR CONSULTAS
-- =============================================================================

-- View para metas semanais com informações detalhadas
CREATE OR REPLACE VIEW vw_metas_semanais_detalhadas AS
SELECT 
    ms.*,
    EXTRACT(WEEK FROM semana_inicio) as semana_ano,
    TO_CHAR(semana_inicio, 'DD/MM') as inicio_formatado,
    TO_CHAR(semana_fim, 'DD/MM') as fim_formatado,
    TO_CHAR(semana_inicio, 'Month YYYY') as mes_nome_completo
FROM metas_semanais_varejo ms;

-- View para metas mensais com resumo das semanas
CREATE OR REPLACE VIEW vw_metas_mensais_resumo AS
SELECT 
    mmc.*,
    COUNT(ms.id) as total_semanas_configuradas,
    CASE 
        WHEN COUNT(ms.id) >= 4 THEN 'Completo'
        WHEN COUNT(ms.id) > 0 THEN 'Parcial'
        ELSE 'Sem configuração'
    END as status_configuracao
FROM metas_mensais_calculadas mmc
LEFT JOIN metas_semanais_varejo ms ON (
    mmc.tipo = ms.tipo 
    AND mmc.nome = ms.nome 
    AND mmc.mes = ms.mes_referencia
)
GROUP BY mmc.id, mmc.tipo, mmc.nome, mmc.mes, mmc.bronze, mmc.prata, mmc.ouro, mmc.diamante, 
         mmc.calculado_em, mmc.usuario;

-- =============================================================================
-- DADOS DE EXEMPLO
-- =============================================================================

-- Exemplo de inserção de metas semanais para Janeiro 2024
/*
INSERT INTO metas_semanais_varejo (tipo, nome, semana_inicio, semana_fim, campo, valor, mes_referencia, numero_semana, usuario) VALUES
-- Semana 1 (01/01 a 07/01)
('lojas', 'CROSBY SHOPPING', '2024-01-01', '2024-01-07', 'bronze', 12500.00, '2024-01', 1, 'Sistema'),
('lojas', 'CROSBY SHOPPING', '2024-01-01', '2024-01-07', 'prata', 25000.00, '2024-01', 1, 'Sistema'),
('lojas', 'CROSBY SHOPPING', '2024-01-01', '2024-01-07', 'ouro', 37500.00, '2024-01', 1, 'Sistema'),
('lojas', 'CROSBY SHOPPING', '2024-01-01', '2024-01-07', 'diamante', 50000.00, '2024-01', 1, 'Sistema'),

-- Semana 2 (08/01 a 14/01)
('lojas', 'CROSBY SHOPPING', '2024-01-08', '2024-01-14', 'bronze', 12500.00, '2024-01', 2, 'Sistema'),
('lojas', 'CROSBY SHOPPING', '2024-01-08', '2024-01-14', 'prata', 25000.00, '2024-01', 2, 'Sistema'),
('lojas', 'CROSBY SHOPPING', '2024-01-08', '2024-01-14', 'ouro', 37500.00, '2024-01', 2, 'Sistema'),
('lojas', 'CROSBY SHOPPING', '2024-01-08', '2024-01-14', 'diamante', 50000.00, '2024-01', 2, 'Sistema');

-- As metas mensais serão calculadas automaticamente pelo trigger
*/
