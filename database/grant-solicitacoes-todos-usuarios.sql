-- =====================================================================
-- Libera "Formulário de Solicitações" e "Minhas Solicitações" para todos
-- os usuários, exceto perfil FRANQUIAS
-- =====================================================================
-- O acesso às páginas é por user_page_permissions (user_id, page_path).
-- 1) Insere as duas páginas para todo usuário existente que não seja
--    'franquias' (owner já tem '*' no app, mas a linha não atrapalha).
-- 2) Trigger em auth.users: usuário novo (não-franquias) já nasce com as
--    duas páginas, sem precisar liberar no Gerenciador de Acessos.
-- Idempotente: pode rodar mais de uma vez.
-- =====================================================================

INSERT INTO public.user_page_permissions (user_id, page_path)
SELECT u.id, p.page_path
FROM auth.users u
CROSS JOIN (VALUES ('/formulario-solicitacoes'), ('/minhas-solicitacoes')) AS p(page_path)
WHERE COALESCE(u.raw_user_meta_data->>'role', 'guest') <> 'franquias'
ON CONFLICT (user_id, page_path) DO NOTHING;

-- Usuários novos: mesmas duas páginas por padrão (exceto franquias)
CREATE OR REPLACE FUNCTION public.conceder_paginas_padrao_solicitacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'guest') <> 'franquias' THEN
    INSERT INTO public.user_page_permissions (user_id, page_path)
    VALUES (NEW.id, '/formulario-solicitacoes'),
           (NEW.id, '/minhas-solicitacoes')
    ON CONFLICT (user_id, page_path) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paginas_padrao_solicitacoes ON auth.users;
CREATE TRIGGER trg_paginas_padrao_solicitacoes
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.conceder_paginas_padrao_solicitacoes();

-- Conferência: quantos usuários ficaram com cada página
SELECT page_path, COUNT(*) AS usuarios
FROM public.user_page_permissions
WHERE page_path IN ('/formulario-solicitacoes', '/minhas-solicitacoes')
GROUP BY page_path;
