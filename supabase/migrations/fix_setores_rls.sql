-- Fix: RLS de setores/setor_usuarios dava "permission denied for table users"
-- Motivo: as policies consultavam auth.users diretamente, e o role
-- `authenticated` não tem SELECT nessa tabela. Solução: usar a função
-- is_owner() (SECURITY DEFINER), mesmo padrão do fix_rls_with_function.sql.
--
-- Executar no SQL Editor do Supabase.

-- Garantir que a função is_owner() existe (já criada pelo
-- fix_rls_with_function.sql, mas recriar é inofensivo)
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

-- Recriar as policies de escrita usando is_owner()
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
