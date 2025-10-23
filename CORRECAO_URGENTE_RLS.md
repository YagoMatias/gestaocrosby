# 🚨 CORREÇÃO URGENTE - Políticas RLS

## ⚠️ Problema Identificado

O erro `403 Forbidden` ao salvar permissões acontece porque as políticas RLS estão usando `user_metadata` ao invés de `raw_user_meta_data`.

**Erro exato:**

```
DELETE https://...user_page_permissions?user_id=eq... 403 (Forbidden)
{code: '42501', message: 'permission denied for table users'}
```

---

## ✅ Solução Imediata

Execute este SQL no **Supabase SQL Editor**:

```sql
-- Script de correção: Atualizar políticas RLS para usar raw_user_meta_data

-- Remover políticas antigas
DROP POLICY IF EXISTS "Only owners can insert permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Only owners can update permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Only owners can delete permissions" ON public.user_page_permissions;

-- Criar políticas corrigidas com raw_user_meta_data

-- Política: Apenas owners podem inserir permissões
CREATE POLICY "Only owners can insert permissions"
    ON public.user_page_permissions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (raw_user_meta_data->>'role')::text = 'owner'
        )
    );

-- Política: Apenas owners podem atualizar permissões
CREATE POLICY "Only owners can update permissions"
    ON public.user_page_permissions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (raw_user_meta_data->>'role')::text = 'owner'
        )
    );

-- Política: Apenas owners podem deletar permissões
CREATE POLICY "Only owners can delete permissions"
    ON public.user_page_permissions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (raw_user_meta_data->>'role')::text = 'owner'
        )
    );
```

---

## 📋 Passo a Passo

1. **Abra o Supabase Dashboard**: https://app.supabase.com
2. **Vá em SQL Editor**
3. **Clique em New Query**
4. **Copie o SQL acima**
5. **Cole e execute** (Run)
6. **Aguarde** a mensagem "Success"
7. **Recarregue** o Gerenciador de Acessos (F5)
8. **Teste novamente** salvar permissões

---

## ✅ Como Verificar se Funcionou

Após executar o SQL:

1. Volte ao **Gerenciador de Acessos**
2. Selecione um usuário
3. Marque algumas páginas
4. Clique em **"Salvar Permissões"**
5. ✅ Deve aparecer: **"Permissões salvas com sucesso!"**

---

## 🔍 O que Mudou?

### ❌ Antes (errado):

```sql
WHERE (user_metadata->>'role')::text = 'owner'
```

### ✅ Depois (correto):

```sql
WHERE (raw_user_meta_data->>'role')::text = 'owner'
```

---

## 📝 Arquivos Atualizados

- ✅ `supabase/migrations/create_user_page_permissions.sql` - Migration corrigida
- ✅ `supabase/migrations/fix_rls_policies.sql` - Script de correção
- ✅ `supabase/migrations/create_get_all_users_function.sql` - Já estava correto

---

## 🎯 Por que Aconteceu?

No PostgreSQL do Supabase:

- ❌ `user_metadata` **não existe** na tabela `auth.users`
- ✅ `raw_user_meta_data` é o campo **correto**

As políticas estavam verificando um campo que não existe, então sempre retornavam `false`, bloqueando o acesso.

---

## 💡 Dica

Se der erro novamente no futuro, verifique sempre se está usando:

- ✅ `raw_user_meta_data` (correto)
- ❌ `user_metadata` (errado)

---

**Execute o SQL agora e o sistema funcionará perfeitamente!** 🚀
