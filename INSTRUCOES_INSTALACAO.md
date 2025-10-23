# 🚀 Instruções de Instalação - Sistema de Permissões

## ✅ O que foi atualizado

1. **Nova função RPC**: `get_all_users()` - Lista usuários sem precisar de Service Role Key
2. **Serviço atualizado**: `permissionsService.js` agora usa RPC ao invés de `auth.admin`
3. **README atualizado**: Instruções completas de instalação

---

## 📋 Passo a Passo para Instalar

### **Passo 1: Execute a primeira migration (Função RPC)**

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral esquerdo)
4. Clique em **New Query**
5. Abra o arquivo: `supabase/migrations/create_get_all_users_function.sql`
6. Copie **TODO** o conteúdo do arquivo
7. Cole no SQL Editor
8. Clique em **Run** (ou pressione `Ctrl + Enter`)
9. ✅ Aguarde aparecer "Success. No rows returned"

---

### **Passo 2: Execute a segunda migration (Tabela de Permissões)**

1. No SQL Editor, clique em **New Query** novamente
2. Abra o arquivo: `supabase/migrations/create_user_page_permissions.sql`
3. Copie **TODO** o conteúdo do arquivo
4. Cole no SQL Editor
5. Clique em **Run** (ou pressione `Ctrl + Enter`)
6. ✅ Aguarde aparecer "Success. No rows returned"

---

### **Passo 3: Verificar se funcionou**

Execute este comando no SQL Editor para testar:

```sql
SELECT * FROM get_all_users();
```

**Resultado esperado:**

- ✅ Deve listar todos os usuários do sistema
- ❌ Se der erro "Apenas owners podem listar usuários", você precisa estar logado como owner

---

### **Passo 4: Testar no Frontend**

1. Faça login no sistema como **owner**
2. Abra o Console do navegador (F12)
3. Execute:

```javascript
const permService = await import('/src/services/permissionsService.js');
const { data: users, error } = await permService.getAllUsers();
console.log('Usuários:', users);
```

**Resultado esperado:**

- ✅ Deve listar todos os usuários sem erro 403
- ✅ Cada usuário deve ter: id, email, name, role, created_at

---

## 🐛 Solução de Problemas

### Erro: "Apenas owners podem listar usuários"

**Causa**: Você não está logado como owner  
**Solução**: Faça login com um usuário que tem `role: 'owner'` no user_metadata

### Erro: "function get_all_users() does not exist"

**Causa**: A migration não foi executada  
**Solução**: Execute o Passo 1 novamente

### Erro: "table user_page_permissions does not exist"

**Causa**: A segunda migration não foi executada  
**Solução**: Execute o Passo 2

---

## 📂 Arquivos Criados/Modificados

✅ `supabase/migrations/create_get_all_users_function.sql` - Nova migration  
✅ `src/services/permissionsService.js` - Atualizado (usa RPC)  
✅ `supabase/migrations/README.md` - Instruções atualizadas

---

## 🎯 Próximos Passos

Após confirmar que tudo está funcionando:

1. ✅ Banco de dados configurado
2. ✅ Serviços funcionando
3. ⏳ **Próxima fase**: Criar página do Gerenciador de Acessos

---

## 🆘 Precisa de ajuda?

Se algo não funcionar, me avise com a mensagem de erro completa que aparece no console!
