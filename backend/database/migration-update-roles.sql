-- ==============================================================================
-- MIGRAÇÃO: Atualizar Roles para aceitar 'admin' e 'ownier'
-- ==============================================================================
-- Execute este script no SUPABASE para atualizar os constraints de role
-- IMPORTANTE: Isso vai alterar o constraint existente

-- ==============================================================================
-- PASSO 1: Remover constraint antigo
-- ==============================================================================
ALTER TABLE public.dashboards 
DROP CONSTRAINT IF EXISTS chk_created_by_role;

-- ==============================================================================
-- PASSO 2: Adicionar novo constraint com 'admin' e 'ownier'
-- ==============================================================================
ALTER TABLE public.dashboards 
ADD CONSTRAINT chk_created_by_role 
CHECK (created_by_role IN ('admin', 'ownier'));

-- ==============================================================================
-- PASSO 3: Atualizar políticas RLS
-- ==============================================================================

-- Remover política antiga de INSERT se existir
DROP POLICY IF EXISTS "Apenas Admin/Proprietário podem criar dashboards" ON public.dashboards;

-- Criar nova política de INSERT
CREATE POLICY "Apenas Admin e Owner podem criar dashboards"
  ON public.dashboards
  FOR INSERT
  WITH CHECK (created_by_role IN ('admin', 'ownier'));

-- ==============================================================================
-- PASSO 4: (OPCIONAL) Migrar dados existentes se houver
-- ==============================================================================
-- Se você já tem dados com 'proprietario', atualize para 'ownier':
UPDATE public.dashboards 
SET created_by_role = 'ownier' 
WHERE created_by_role IN ('proprietario', 'proprietário', 'owner');

-- ==============================================================================
-- VERIFICAÇÃO: Conferir se a alteração foi aplicada
-- ==============================================================================
-- Execute esta query para verificar:
-- SELECT 
--   conname AS constraint_name,
--   pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'public.dashboards'::regclass
--   AND conname = 'chk_created_by_role';

