-- ==============================================================================
-- SISTEMA DE DASHBOARDS PERSONALIZADOS - SUPABASE
-- ==============================================================================
-- Execute este script no SUPABASE para criar as tabelas de configuração
-- dos dashboards personalizados

-- ==============================================================================
-- TABELA: dashboards
-- Armazena os dashboards criados por administradores
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dashboards (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by VARCHAR(255) NOT NULL, -- Email do usuário criador
  created_by_role VARCHAR(50) NOT NULL, -- 'admin' ou 'ownier'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  layout_config JSONB, -- Configuração de layout (grid, posições, etc.)
  CONSTRAINT chk_created_by_role CHECK (created_by_role IN ('admin', 'ownier'))
);

-- RLS (Row Level Security) - Opcional
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Política: Admin/Proprietário podem ver todos
CREATE POLICY "Admin e Proprietário podem ver todos dashboards"
  ON public.dashboards
  FOR SELECT
  USING (true); -- Ajuste conforme sua lógica de auth

-- Política: Apenas Admin e Owner podem inserir
CREATE POLICY "Apenas Admin e Owner podem criar dashboards"
  ON public.dashboards
  FOR INSERT
  WITH CHECK (created_by_role IN ('admin', 'ownier'));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON public.dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_active ON public.dashboards(is_active);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON public.dashboards(created_at DESC);

-- ==============================================================================
-- TABELA: dashboard_permissions
-- Define quais usuários podem ver cada dashboard
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dashboard_permissions (
  id BIGSERIAL PRIMARY KEY,
  dashboard_id BIGINT NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL, -- Email do usuário com permissão
  user_role VARCHAR(50), -- Role do usuário (opcional)
  granted_by VARCHAR(255) NOT NULL, -- Quem concedeu a permissão
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  can_view BOOLEAN DEFAULT true,
  can_export BOOLEAN DEFAULT false,
  UNIQUE(dashboard_id, user_email)
);

-- RLS
ALTER TABLE public.dashboard_permissions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários veem apenas suas permissões
CREATE POLICY "Usuários veem suas próprias permissões"
  ON public.dashboard_permissions
  FOR SELECT
  USING (true); -- Ajuste conforme auth.uid() ou auth.email()

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_user ON public.dashboard_permissions(user_email);
CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_dashboard ON public.dashboard_permissions(dashboard_id);

-- ==============================================================================
-- TABELA: dashboard_widgets
-- Armazena os widgets (gráficos, tabelas) de cada dashboard
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id BIGSERIAL PRIMARY KEY,
  dashboard_id BIGINT NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
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
  refresh_interval INTEGER, -- Intervalo de atualização em segundos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT chk_widget_type CHECK (widget_type IN ('chart', 'table', 'metric', 'kpi'))
);

-- RLS
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ver widgets de dashboards que têm acesso
CREATE POLICY "Usuários veem widgets dos dashboards permitidos"
  ON public.dashboard_widgets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_permissions dp
      WHERE dp.dashboard_id = dashboard_widgets.dashboard_id
      AND dp.can_view = true
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON public.dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_type ON public.dashboard_widgets(widget_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_active ON public.dashboard_widgets(is_active);

-- ==============================================================================
-- TABELA: dashboard_access_log (opcional - auditoria)
-- Registra acessos aos dashboards
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dashboard_access_log (
  id BIGSERIAL PRIMARY KEY,
  dashboard_id BIGINT NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- RLS
ALTER TABLE public.dashboard_access_log ENABLE ROW LEVEL SECURITY;

-- Política: Admin pode ver todos os logs
CREATE POLICY "Admin vê todos os logs"
  ON public.dashboard_access_log
  FOR SELECT
  USING (true); -- Ajuste para verificar role do usuário

-- Índices
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_dashboard ON public.dashboard_access_log(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_user ON public.dashboard_access_log(user_email);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_date ON public.dashboard_access_log(accessed_at DESC);

-- ==============================================================================
-- COMENTÁRIOS
-- ==============================================================================
COMMENT ON TABLE public.dashboards IS 'Dashboards personalizados criados por administradores';
COMMENT ON TABLE public.dashboard_permissions IS 'Permissões de acesso aos dashboards por usuário';
COMMENT ON TABLE public.dashboard_widgets IS 'Widgets (gráficos/tabelas) dos dashboards';
COMMENT ON TABLE public.dashboard_access_log IS 'Log de acessos aos dashboards para auditoria';

-- ==============================================================================
-- TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dashboards_updated_at
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
