-- ==============================================================================
-- SISTEMA DE DASHBOARDS PERSONALIZADOS
-- ==============================================================================
-- Este script cria as tabelas necessárias para o sistema de dashboards
-- personalizados com controle de permissões por usuário

-- ==============================================================================
-- TABELA: dashboards
-- Armazena os dashboards criados por administradores
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dashboards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by VARCHAR(255) NOT NULL, -- Email ou ID do usuário criador
  created_by_role VARCHAR(50) NOT NULL, -- 'admin' ou 'proprietario'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  layout_config JSONB, -- Configuração de layout (grid, posições, etc.)
  CONSTRAINT chk_created_by_role CHECK (created_by_role IN ('admin', 'proprietario'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_active ON dashboards(is_active);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON dashboards(created_at DESC);

-- ==============================================================================
-- TABELA: dashboard_permissions
-- Define quais usuários podem ver cada dashboard
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dashboard_permissions (
  id SERIAL PRIMARY KEY,
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL, -- Email do usuário com permissão
  user_role VARCHAR(50), -- Role do usuário (opcional, para filtros)
  granted_by VARCHAR(255) NOT NULL, -- Quem concedeu a permissão
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  can_view BOOLEAN DEFAULT true,
  can_export BOOLEAN DEFAULT false,
  UNIQUE(dashboard_id, user_email)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_user ON dashboard_permissions(user_email);
CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_dashboard ON dashboard_permissions(dashboard_id);

-- ==============================================================================
-- TABELA: dashboard_widgets
-- Armazena os widgets (gráficos, tabelas) de cada dashboard
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id SERIAL PRIMARY KEY,
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  widget_type VARCHAR(50) NOT NULL, -- 'chart', 'table', 'metric', 'kpi'
  chart_type VARCHAR(50), -- 'bar', 'line', 'pie', 'area', 'scatter', etc.
  query_config JSONB NOT NULL, -- Configuração da query (select, from, where, etc.)
  display_config JSONB, -- Configurações de exibição (cores, eixos, etc.)
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 6, -- Grid de 12 colunas
  height INTEGER DEFAULT 4,
  refresh_interval INTEGER, -- Intervalo de atualização em segundos (null = manual)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT chk_widget_type CHECK (widget_type IN ('chart', 'table', 'metric', 'kpi'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_type ON dashboard_widgets(widget_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_active ON dashboard_widgets(is_active);

-- ==============================================================================
-- TABELA: dashboard_access_log (opcional - auditoria)
-- Registra acessos aos dashboards para auditoria
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dashboard_access_log (
  id SERIAL PRIMARY KEY,
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Índice para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_dashboard ON dashboard_access_log(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_user ON dashboard_access_log(user_email);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_date ON dashboard_access_log(accessed_at DESC);

-- ==============================================================================
-- COMENTÁRIOS NAS TABELAS
-- ==============================================================================
COMMENT ON TABLE dashboards IS 'Dashboards personalizados criados por administradores';
COMMENT ON TABLE dashboard_permissions IS 'Permissões de acesso aos dashboards por usuário';
COMMENT ON TABLE dashboard_widgets IS 'Widgets (gráficos, tabelas) dos dashboards';
COMMENT ON TABLE dashboard_access_log IS 'Log de acessos aos dashboards para auditoria';

-- ==============================================================================
-- DADOS DE EXEMPLO (opcional)
-- ==============================================================================
-- Inserir dashboard de exemplo
-- INSERT INTO dashboards (name, description, created_by, created_by_role) 
-- VALUES ('Dashboard Financeiro', 'Visão geral das finanças', 'admin@crosby.com', 'admin');

-- Conceder permissão a um usuário
-- INSERT INTO dashboard_permissions (dashboard_id, user_email, granted_by) 
-- VALUES (1, 'usuario@crosby.com', 'admin@crosby.com');

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================
