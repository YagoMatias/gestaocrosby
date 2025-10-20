-- ==============================================================================
-- MIGRAÇÃO: Adicionar Políticas RLS para Dashboard Widgets
-- ==============================================================================
-- Execute este script no SUPABASE para permitir CRUD de widgets por admin/owner

-- ==============================================================================
-- POLÍTICAS PARA dashboard_widgets
-- ==============================================================================

-- DROP políticas existentes se houver
DROP POLICY IF EXISTS "Usuários veem widgets dos dashboards permitidos" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Admin e Owner podem criar widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Admin e Owner podem atualizar widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Admin e Owner podem deletar widgets" ON public.dashboard_widgets;

-- ==============================================================================
-- POLÍTICA: SELECT (Ver widgets)
-- ==============================================================================
-- Permite ver widgets de dashboards que o usuário tem acesso
CREATE POLICY "Todos podem ver widgets de dashboards acessíveis"
  ON public.dashboard_widgets
  FOR SELECT
  USING (true);  -- Simplificado: todos podem ver (ajuste conforme necessário)

-- ==============================================================================
-- POLÍTICA: INSERT (Criar widgets)
-- ==============================================================================
-- Permite que qualquer usuário autenticado crie widgets
-- (Você pode adicionar validação adicional baseada em role se necessário)
CREATE POLICY "Usuários autenticados podem criar widgets"
  ON public.dashboard_widgets
  FOR INSERT
  WITH CHECK (true);  -- Permite inserção (ajuste conforme necessário)

-- ==============================================================================
-- POLÍTICA: UPDATE (Atualizar widgets)
-- ==============================================================================
-- Permite que usuários autenticados atualizem widgets
CREATE POLICY "Usuários autenticados podem atualizar widgets"
  ON public.dashboard_widgets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- POLÍTICA: DELETE (Deletar widgets)
-- ==============================================================================
-- Permite que usuários autenticados deletem widgets (soft delete via is_active)
CREATE POLICY "Usuários autenticados podem deletar widgets"
  ON public.dashboard_widgets
  FOR DELETE
  USING (true);

-- ==============================================================================
-- VERIFICAÇÃO
-- ==============================================================================
-- Para verificar as políticas criadas, execute:
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'dashboard_widgets';
*/

-- ==============================================================================
-- NOTAS IMPORTANTES
-- ==============================================================================
-- 1. As políticas acima são PERMISSIVAS (true) para desenvolvimento
-- 2. Em PRODUÇÃO, você deve adicionar validações mais rigorosas:
--    - Verificar se o usuário é admin/owner
--    - Verificar se o dashboard pertence ao usuário
--    - Validar permissões específicas
--
-- Exemplo de política mais restritiva para INSERT:
/*
CREATE POLICY "Apenas Admin e Owner podem criar widgets"
  ON public.dashboard_widgets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_id
      AND d.created_by_role IN ('admin', 'ownier')
    )
  );
*/

