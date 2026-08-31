-- Migration: Sistema de Setores e Gestores + novos perfis de usuário
-- Descrição:
--   1. Cria a tabela `setores` (cada setor tem um gestor — perfil gerente,
--      administrador ou proprietário; um gestor pode cuidar de vários setores)
--   2. Cria a tabela `setor_usuarios` (um usuário pode estar em vários setores)
--   3. Popula os 12 setores padrão
--   4. Converte todo usuário que não é owner/admin/franquias para o perfil
--      Padrão (guest)
--
-- Executar no SQL Editor do Supabase.

-- ─── 1. Tabela de setores ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    ordem INTEGER NOT NULL DEFAULT 0,
    gestor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.setores IS 'Setores da empresa. Cada setor tem um gestor (perfil gerente, admin ou owner).';
COMMENT ON COLUMN public.setores.gestor_id IS 'Usuário gestor do setor (auth.users). Um gestor pode gerir vários setores.';

-- ─── 2. Tabela de vínculo usuário ↔ setor ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setor_usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setor_id UUID NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    CONSTRAINT unique_setor_usuario UNIQUE (setor_id, user_id)
);

COMMENT ON TABLE public.setor_usuarios IS 'Vínculo N:N entre usuários e setores. Um usuário pode ter mais de um setor.';

CREATE INDEX IF NOT EXISTS idx_setor_usuarios_setor_id ON public.setor_usuarios(setor_id);
CREATE INDEX IF NOT EXISTS idx_setor_usuarios_user_id ON public.setor_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_setores_gestor_id ON public.setores(gestor_id);

-- ─── 3. RLS (mesmo padrão de user_page_permissions) ──────────────────────────
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setor_usuarios ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem VER setores e vínculos
DROP POLICY IF EXISTS "Authenticated can view setores" ON public.setores;
CREATE POLICY "Authenticated can view setores"
    ON public.setores FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated can view setor_usuarios" ON public.setor_usuarios;
CREATE POLICY "Authenticated can view setor_usuarios"
    ON public.setor_usuarios FOR SELECT
    TO authenticated
    USING (true);

-- Apenas owners podem modificar.
-- IMPORTANTE: usar a função is_owner() (SECURITY DEFINER) em vez de consultar
-- auth.users direto na policy — o role `authenticated` não tem SELECT em
-- auth.users e a policy falharia com "permission denied for table users"
-- (mesmo problema já corrigido em fix_rls_with_function.sql).
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'owner'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_owner() TO authenticated;

DROP POLICY IF EXISTS "Only owners can modify setores" ON public.setores;
CREATE POLICY "Only owners can modify setores"
    ON public.setores FOR ALL
    USING (is_owner())
    WITH CHECK (is_owner());

DROP POLICY IF EXISTS "Only owners can modify setor_usuarios" ON public.setor_usuarios;
CREATE POLICY "Only owners can modify setor_usuarios"
    ON public.setor_usuarios FOR ALL
    USING (is_owner())
    WITH CHECK (is_owner());

-- Trigger de updated_at (função update_updated_at_column já existe no projeto)
DROP TRIGGER IF EXISTS update_setores_updated_at ON public.setores;
CREATE TRIGGER update_setores_updated_at
    BEFORE UPDATE ON public.setores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─── 4. Seed dos 12 setores ──────────────────────────────────────────────────
INSERT INTO public.setores (nome, ordem) VALUES
    ('FINANCEIRO', 1),
    ('CENTRAL DE FRANQUIAS', 2),
    ('DP-RH', 3),
    ('PATRIMONIO', 4),
    ('TECNOLOGIA', 5),
    ('EXPEDIÇÃO', 6),
    ('TRAFEGO', 7),
    ('VAREJO', 8),
    ('REVENDA', 9),
    ('MULTIMARCAS', 10),
    ('MARKETING', 11),
    ('PRODUÇÃO', 12)
ON CONFLICT (nome) DO NOTHING;

-- ─── 5. Migração de perfis ───────────────────────────────────────────────────
-- Todo usuário que NÃO é proprietário (owner), administrador (admin) ou
-- franquias vira Padrão (guest). Perfis Gerente serão atribuídos manualmente
-- aos gestores de setor depois.
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"guest"'
)
WHERE COALESCE(raw_user_meta_data->>'role', '') NOT IN ('owner', 'admin', 'franquias');
