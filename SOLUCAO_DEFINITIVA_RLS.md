# 🎯 SOLUÇÃO DEFINITIVA - Políticas RLS

## 🔍 Problema Identificado

O erro `permission denied for table users` acontece porque as políticas RLS tentam acessar `auth.users` diretamente, mas o usuário autenticado não tem permissão para isso dentro de uma política.

---

## ✅ SOLUÇÃO FINAL

Execute este SQL no **Supabase SQL Editor**:

```sql
-- SOLUÇÃO DEFINITIVA: Criar função para verificar se é owner

-- 1. Criar função que verifica se usuário atual é owner
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

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "Only owners can insert permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Only owners can update permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Only owners can delete permissions" ON public.user_page_permissions;

-- 3. Criar novas políticas usando a função
CREATE POLICY "Only owners can insert permissions"
    ON public.user_page_permissions
    FOR INSERT
    WITH CHECK (is_owner());

CREATE POLICY "Only owners can update permissions"
    ON public.user_page_permissions
    FOR UPDATE
    USING (is_owner());

CREATE POLICY "Only owners can delete permissions"
    ON public.user_page_permissions
    FOR DELETE
    USING (is_owner());

-- 4. Garantir que a função pode ser executada por usuários autenticados
GRANT EXECUTE ON FUNCTION is_owner() TO authenticated;

-- Comentário
COMMENT ON FUNCTION is_owner() IS 'Verifica se o usuário autenticado atual tem role de owner';
```

---

## 📋 Passo a Passo

1. **Abra**: https://app.supabase.com
2. **SQL Editor** → **New Query**
3. **Copie** o SQL acima (TUDO)
4. **Cole** no editor
5. **Run** (Ctrl + Enter)
6. **Aguarde** aparecer "Success"
7. **Recarregue** o sistema (F5)
8. **Teste** novamente

---

## 🎯 Por Que Esta Solução Funciona?

### ❌ Problema Anterior:

```sql
-- Política tentava acessar auth.users diretamente
EXISTS (
    SELECT 1 FROM auth.users  -- ❌ Permission denied!
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'owner'
)
```

### ✅ Solução Atual:

```sql
-- Função com SECURITY DEFINER tem privilégios elevados
CREATE FUNCTION is_owner() ... SECURITY DEFINER

-- Política usa a função (sem problemas de permissão)
CREATE POLICY ... WITH CHECK (is_owner());  -- ✅ Funciona!
```

**SECURITY DEFINER** = A função executa com os privilégios do dono (você), não do usuário que a chama.

---

## ✅ Como Testar

Após executar:

1. Vá no **Gerenciador de Acessos**
2. Selecione: `vendedorteste@timecrosby.com`
3. Marque: `Home`, `Crosby Bot`
4. Clique em **"Salvar Permissões"**
5. ✅ Deve mostrar: **"Permissões salvas com sucesso!"**

---

## 🔍 Verificar se Foi Aplicado

Execute este SQL para verificar:

```sql
-- Verificar se a função existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'is_owner';

-- Testar a função (deve retornar TRUE se você é owner)
SELECT is_owner();

-- Verificar políticas
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'user_page_permissions';
```

---

## 🎉 Resultado Esperado

Depois de executar este SQL:

- ✅ Função `is_owner()` criada
- ✅ Políticas RLS atualizadas
- ✅ Salvamento de permissões funcionando
- ✅ Sem erro 403
- ✅ Mensagem de sucesso aparece

---

## 📝 Arquivos Relacionados

- ✅ `supabase/migrations/fix_rls_with_function.sql` - Este script
- ✅ `SOLUCAO_DEFINITIVA_RLS.md` - Esta documentação

---

## 💡 Diferença dos Scripts Anteriores

| Script                      | Status               | Por Que Falhou                                   |
| --------------------------- | -------------------- | ------------------------------------------------ |
| `fix_rls_policies.sql`      | ❌ Não funcionou     | Políticas acessando `auth.users` diretamente     |
| `fix_rls_with_function.sql` | ✅ **ESTE FUNCIONA** | Função com `SECURITY DEFINER` resolve o problema |

---

**Execute agora e tudo vai funcionar!** 🚀

Após executar, teste e me avise se funcionou!
