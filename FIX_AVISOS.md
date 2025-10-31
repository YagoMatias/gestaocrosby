# 🚨 FIX RÁPIDO - Sistema de Avisos

## Problema: Avisos não aparecem no gerenciador

### ✅ Solução em 2 passos:

## Passo 1: Executar Script SQL

1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Cole e execute este script:

```sql
-- Função para listar usuários
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      u.email
    ) as name,
    COALESCE(u.raw_user_meta_data->>'role', 'user') as role,
    u.created_at
  FROM auth.users u
  ORDER BY u.email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
```

4. Clique em **Run** (ou Ctrl + Enter)

## Passo 2: Testar

1. Recarregue a página do sistema (F5)
2. Acesse `/gerenciador-avisos`
3. Crie um novo aviso
4. Verifique se aparece na lista

## ✅ Alterações Feitas no Código:

1. **useNotices.js** - Removido join com `auth.users` que causava erro
2. **NoticeEditor.jsx** - Melhorado fallback para carregar usuários
3. Criado script SQL rápido em `quick_fix_users.sql`

## 🔍 Como verificar se funcionou:

Execute no SQL Editor:

```sql
SELECT * FROM get_all_users();
```

Deve retornar a lista de todos os usuários do sistema.

## ⚠️ Nota Importante:

Se ainda não funcionar, significa que você não executou o script SQL da Fase 1 que cria as tabelas `notices`, `notice_recipients` e `notice_reads`.

Execute também o script completo: `supabase/migrations/add_user_management.sql`

---

**Arquivos modificados:**

- ✅ `src/hooks/useNotices.js` - Corrigido query getAllNotices
- ✅ `src/components/NoticeEditor.jsx` - Melhorado fallback de usuários
- ✅ Criado `supabase/migrations/quick_fix_users.sql`
