-- =====================================================
-- MIGRAÇÃO: INTEGER → UUID para usuarios e created_by
-- Executar no Supabase SQL Editor
-- =====================================================

-- 1. Listar todas as políticas existentes
SELECT policyname FROM pg_policies WHERE tablename IN ('dashboards', 'widgets');

-- 2. Remover TODAS as políticas das tabelas (dashboards e widgets)
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('dashboards', 'widgets')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. Alterar tipo da coluna usuarios de INTEGER[] para TEXT[]
ALTER TABLE dashboards 
ALTER COLUMN usuarios TYPE TEXT[] USING usuarios::TEXT[];

-- 4. Alterar tipo da coluna created_by de INTEGER para UUID
ALTER TABLE dashboards 
ALTER COLUMN created_by TYPE UUID USING created_by::TEXT::UUID;

ALTER TABLE widgets 
ALTER COLUMN created_by TYPE UUID USING created_by::TEXT::UUID;

-- 4. Recriar políticas RLS com UUID
CREATE POLICY "Users can view their dashboards" ON dashboards
    FOR SELECT
    USING (
        auth.uid()::TEXT = ANY(usuarios) OR 
        auth.uid() = created_by
    );

CREATE POLICY "Users can update their own dashboards" ON dashboards
    FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own dashboards" ON dashboards
    FOR DELETE
    USING (auth.uid() = created_by);

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
                auth.uid()::TEXT = ANY(dashboards.usuarios) OR 
                auth.uid() = dashboards.created_by
            )
        )
    );

CREATE POLICY "Users can create widgets in their dashboards" ON widgets
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dashboards 
            WHERE dashboards.id = widgets.dashboard_id 
            AND auth.uid() = dashboards.created_by
        )
    );

CREATE POLICY "Users can update their own widgets" ON widgets
    FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own widgets" ON widgets
    FOR DELETE
    USING (auth.uid() = created_by);

-- 5. Comentários atualizados
COMMENT ON COLUMN dashboards.usuarios IS 'Array de UUIDs dos usuários que podem visualizar este dashboard';
COMMENT ON COLUMN dashboards.created_by IS 'UUID do usuário que criou o dashboard';
COMMENT ON COLUMN widgets.created_by IS 'UUID do usuário que criou o widget';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
