-- =====================================================
-- SCHEMA PARA GERENCIADOR DE DASHBOARDS E WIDGETS
-- Supabase Database
-- =====================================================

-- Tabela de Dashboards
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    usuarios INTEGER[] NOT NULL DEFAULT '{}', -- Array de IDs dos usuários com acesso
    created_by INTEGER NOT NULL, -- ID do usuário que criou
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Tabela de Widgets
CREATE TABLE IF NOT EXISTS widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    view_name VARCHAR(255) NOT NULL, -- Nome da view/tabela do banco REST API
    config JSONB NOT NULL, -- Armazena toda a configuração do widget
    -- Estrutura do JSONB config:
    -- {
    --   "selectedColumns": ["col1", "col2"],
    --   "filters": [{"column": "col", "operator": "=", "value": "val", "id": 123}],
    --   "aggregations": [{"column": "col", "function": "SUM"}],
    --   "orderBy": {"column": "col", "direction": "ASC"},
    --   "type": "table|bar|pie|line"
    -- }
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_usuarios ON dashboards USING GIN(usuarios);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_id ON widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_widgets_created_by ON widgets(created_by);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widgets_updated_at BEFORE UPDATE ON widgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários nas tabelas
COMMENT ON TABLE dashboards IS 'Armazena os dashboards criados e os usuários com acesso';
COMMENT ON TABLE widgets IS 'Armazena os widgets e suas configurações (filtros, agregações, visualização)';

COMMENT ON COLUMN dashboards.usuarios IS 'Array de IDs dos usuários que podem visualizar este dashboard';
COMMENT ON COLUMN widgets.config IS 'Configuração completa do widget em formato JSONB (colunas, filtros, agregações, tipo de visualização)';

-- RLS (Row Level Security) - Opcional, mas recomendado
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança - Exemplo básico
-- Usuários podem ver dashboards onde eles estão na lista de usuários
CREATE POLICY "Users can view their dashboards" ON dashboards
    FOR SELECT
    USING (
        auth.uid()::TEXT::INTEGER = ANY(usuarios) OR 
        auth.uid()::TEXT::INTEGER = created_by
    );

-- Apenas criadores e admins podem editar dashboards
CREATE POLICY "Users can update their own dashboards" ON dashboards
    FOR UPDATE
    USING (auth.uid()::TEXT::INTEGER = created_by);

-- Apenas criadores podem deletar dashboards
CREATE POLICY "Users can delete their own dashboards" ON dashboards
    FOR DELETE
    USING (auth.uid()::TEXT::INTEGER = created_by);

-- Qualquer usuário autenticado pode criar dashboard
CREATE POLICY "Authenticated users can create dashboards" ON dashboards
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para widgets
CREATE POLICY "Users can view widgets from their dashboards" ON widgets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM dashboards 
            WHERE dashboards.id = widgets.dashboard_id 
            AND (
                auth.uid()::TEXT::INTEGER = ANY(dashboards.usuarios) OR 
                auth.uid()::TEXT::INTEGER = dashboards.created_by
            )
        )
    );

CREATE POLICY "Users can manage widgets in their dashboards" ON widgets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM dashboards 
            WHERE dashboards.id = widgets.dashboard_id 
            AND auth.uid()::TEXT::INTEGER = dashboards.created_by
        )
    );

-- =====================================================
-- EXEMPLOS DE QUERIES ÚTEIS
-- =====================================================

-- Buscar todos os dashboards de um usuário
-- SELECT * FROM dashboards WHERE $1 = ANY(usuarios) OR created_by = $1;

-- Buscar widgets de um dashboard específico
-- SELECT * FROM widgets WHERE dashboard_id = $1 AND is_active = true;

-- Buscar widgets com seus dashboards
-- SELECT w.*, d.nome as dashboard_nome, d.usuarios 
-- FROM widgets w 
-- JOIN dashboards d ON w.dashboard_id = d.id 
-- WHERE $1 = ANY(d.usuarios) OR d.created_by = $1;

-- Contar widgets por dashboard
-- SELECT dashboard_id, COUNT(*) as total_widgets 
-- FROM widgets 
-- WHERE is_active = true 
-- GROUP BY dashboard_id;

-- =====================================================
-- DADOS DE EXEMPLO (OPCIONAL - REMOVER EM PRODUÇÃO)
-- =====================================================

-- Inserir dashboard de exemplo
-- INSERT INTO dashboards (nome, descricao, usuarios, created_by) 
-- VALUES ('Dashboard Financeiro', 'Visão geral das finanças', ARRAY[1,2,3], 1);

-- Inserir widget de exemplo
-- INSERT INTO widgets (dashboard_id, nome, view_name, config, created_by)
-- VALUES (
--     'uuid-do-dashboard',
--     'Vendas por Produto',
--     'vw_vendas',
--     '{"selectedColumns": ["produto", "valor_total"], "filters": [], "aggregations": [{"column": "valor_total", "function": "SUM"}], "orderBy": {"column": "valor_total", "direction": "DESC"}, "type": "bar"}'::jsonb,
--     1
-- );
