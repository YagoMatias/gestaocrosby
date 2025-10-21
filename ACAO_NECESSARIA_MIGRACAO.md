# 🔧 AÇÃO NECESSÁRIA - Executar Migração no Supabase

## ⚠️ PROBLEMA IDENTIFICADO

**Erro:** `invalid input syntax for type integer: "76b8906e-7504-4da6-8f4a-8389802766c4"`

**Causa:** As colunas `created_by` e `usuarios` estão definidas como INTEGER no banco de dados, mas o sistema de autenticação do Supabase retorna UUIDs (strings).

**Solução:** Executar migração para alterar tipos de INTEGER para UUID/TEXT[].

---

## 📋 Passo a Passo para Corrigir

### 1️⃣ Abrir Supabase Dashboard

```
1. Acesse https://supabase.com
2. Entre no projeto
3. Vá em "SQL Editor" no menu lateral
```

### 2️⃣ Executar Script de Migração

```
1. Clique em "New Query"
2. Cole o conteúdo do arquivo:
   backend/database/migration-integer-to-uuid.sql
3. Clique em "Run" (ou Ctrl+Enter)
4. Aguarde confirmação de sucesso
```

### 3️⃣ Verificar Alterações

```sql
-- Execute esta query para verificar:
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'dashboards'
AND column_name IN ('created_by', 'usuarios');

-- Resultado esperado:
-- usuarios    | ARRAY (text[])
-- created_by  | uuid
```

---

## 📝 O que a Migração Faz

### Antes:

```sql
created_by  INTEGER
usuarios    INTEGER[]
```

### Depois:

```sql
created_by  UUID
usuarios    TEXT[]  -- Array de UUIDs como strings
```

### Alterações incluídas:

1. ✅ Converte `usuarios` de INTEGER[] para TEXT[]
2. ✅ Converte `created_by` de INTEGER para UUID
3. ✅ Converte `widgets.created_by` de INTEGER para UUID
4. ✅ Recria políticas RLS com UUIDs
5. ✅ Atualiza comentários da documentação

---

## 🚀 Após Executar a Migração

### 1. Reiniciar Frontend

```bash
# Se estiver rodando, pare com Ctrl+C e reinicie:
npm run dev
```

### 2. Testar Criação de Dashboard

```
1. Login como admin/owner
2. Ir em "Gerenciador de Dashboards"
3. Clique "Novo Dashboard"
4. Preencher nome, descrição, usuários
5. Clicar "Criar Dashboard"
```

### 3. Verificar Console

```
✅ Sem erro 400
✅ Dashboard criado com sucesso
✅ Lista atualizada
```

---

## 🔍 Solução de Problemas

### Se ainda der erro após migração:

#### Problema 1: Dados existentes incompatíveis

```sql
-- Limpar dados antigos (se houver):
DELETE FROM widgets WHERE is_active = true;
DELETE FROM dashboards WHERE is_active = true;
```

#### Problema 2: Políticas RLS ainda com problemas

```sql
-- Desabilitar temporariamente RLS:
ALTER TABLE dashboards DISABLE ROW LEVEL SECURITY;
ALTER TABLE widgets DISABLE ROW LEVEL SECURITY;

-- Testar criação de dashboard
-- Se funcionar, reabilitar RLS e ajustar políticas
```

#### Problema 3: Conversão de tipo falhou

```sql
-- Se a migração falhou, fazer manualmente:

-- 1. Criar colunas temporárias
ALTER TABLE dashboards ADD COLUMN created_by_new UUID;
ALTER TABLE dashboards ADD COLUMN usuarios_new TEXT[];

-- 2. Copiar dados (se houver)
-- Pule se tabela estiver vazia

-- 3. Deletar colunas antigas
ALTER TABLE dashboards DROP COLUMN created_by;
ALTER TABLE dashboards DROP COLUMN usuarios;

-- 4. Renomear colunas novas
ALTER TABLE dashboards RENAME COLUMN created_by_new TO created_by;
ALTER TABLE dashboards RENAME COLUMN usuarios_new TO usuarios;

-- 5. Adicionar constraints
ALTER TABLE dashboards ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE dashboards ALTER COLUMN usuarios SET NOT NULL;
ALTER TABLE dashboards ALTER COLUMN usuarios SET DEFAULT '{}';
```

---

## ✅ Checklist Final

Após executar a migração:

- [ ] Script executado sem erros
- [ ] Tipos de colunas verificados (UUID e TEXT[])
- [ ] Políticas RLS recriadas
- [ ] Frontend reiniciado
- [ ] Teste de criação de dashboard - SUCESSO ✅
- [ ] Teste de listagem de dashboards - SUCESSO ✅
- [ ] Teste de inclusão de widget - SUCESSO ✅

---

## 📞 Se Precisar de Ajuda

1. Copie o erro completo do console
2. Verifique se a migração foi executada:
   ```sql
   SELECT data_type FROM information_schema.columns
   WHERE table_name = 'dashboards' AND column_name = 'created_by';
   ```
3. Se resultado for 'integer', migração não foi aplicada
4. Se resultado for 'uuid', migração funcionou ✅

---

## 🎯 Resultado Esperado

Após executar a migração:

```javascript
// Criar dashboard funciona:
await createDashboard({
  name: 'Dashboard Teste',
  description: 'Teste',
  user_ids: ['uuid-1', 'uuid-2', 'uuid-3'], // ✅ UUIDs como strings
});

// created_by aceita UUID:
created_by: '76b8906e-7504-4da6-8f4a-8389802766c4'; // ✅

// Sem erro 400! 🎉
```

---

## ⚡ Executar AGORA

**Arquivo:** `backend/database/migration-integer-to-uuid.sql`
**Onde:** Supabase Dashboard → SQL Editor → New Query
**Ação:** Cole o script e clique RUN

**Tempo estimado:** 2 minutos ⏱️

Após executar, o sistema estará 100% funcional! 🚀
