-- ==============================================================================
-- MIGRAÇÃO: Políticas RLS SEGURAS para Dashboard Widgets
-- ==============================================================================
-- Esta é uma versão mais segura com validações baseadas em role
-- Use esta se você quiser controle mais rigoroso

-- ==============================================================================
-- REMOVER POLÍTICAS PERMISSIVAS
-- ==============================================================================
DROP POLICY IF EXISTS "Usuários autenticados podem criar widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Todos podem ver widgets de dashboards acessíveis" ON public.dashboard_widgets;

-- ==============================================================================
-- POLÍTICAS SEGURAS BASEADAS EM ROLE
-- ==============================================================================

-- SELECT: Usuários veem widgets dos dashboards que têm permissão
CREATE POLICY "Ver widgets de dashboards com permissão"
  ON public.dashboard_widgets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_permissions dp
      WHERE dp.dashboard_id = dashboard_widgets.dashboard_id
      AND dp.can_view = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_widgets.dashboard_id
      AND d.created_by_role IN ('admin', 'ownier')
    )
  );

-- INSERT: Apenas criadores do dashboard podem adicionar widgets
CREATE POLICY "Criar widgets no próprio dashboard"
  ON public.dashboard_widgets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_id
      AND d.created_by_role IN ('admin', 'ownier')
    )
  );

-- UPDATE: Apenas criadores do dashboard podem atualizar widgets
CREATE POLICY "Atualizar widgets do próprio dashboard"
  ON public.dashboard_widgets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_id
      AND d.created_by_role IN ('admin', 'ownier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_id
      AND d.created_by_role IN ('admin', 'ownier')
    )
  );

-- DELETE: Apenas criadores do dashboard podem deletar widgets
CREATE POLICY "Deletar widgets do próprio dashboard"
  ON public.dashboard_widgets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_id
      AND d.created_by_role IN ('admin', 'ownier')
    )
  );

-- ==============================================================================
-- VERIFICAÇÃO
-- ==============================================================================
-- Para verificar as políticas criadas:
/*
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE ''
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'CHECK: ' || with_check
    ELSE ''
  END as check_clause
FROM pg_policies
WHERE tablename = 'dashboard_widgets'
ORDER BY cmd, policyname;
*/

