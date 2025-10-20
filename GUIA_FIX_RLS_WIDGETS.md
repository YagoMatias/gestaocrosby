# 🔐 CORREÇÃO URGENTE - Erro 403 (Forbidden) ao Criar Widget

## ❌ Erro Atual

```
POST https://dorztqiunewggydvkjnf.supabase.co/rest/v1/dashboard_widgets 403 (Forbidden)

Erro: new row violates row-level security policy for table "dashboard_widgets"
```

---

## 🔍 Causa do Problema

**Row-Level Security (RLS)** está bloqueando a inserção de widgets porque **faltam políticas de INSERT**.

O schema atual tem apenas:

- ✅ Política de SELECT (ver widgets)
- ❌ **FALTA** Política de INSERT (criar widgets)
- ❌ **FALTA** Política de UPDATE (atualizar widgets)
- ❌ **FALTA** Política de DELETE (deletar widgets)

---

## ✅ SOLUÇÃO RÁPIDA - Execute no Supabase

### Opção 1: Políticas Permissivas (Desenvolvimento) ⚡ RECOMENDADO

Use este para testar rapidamente:

```sql
-- COPIE E COLE NO SQL EDITOR DO SUPABASE

-- Remover política antiga
DROP POLICY IF EXISTS "Usuários veem widgets dos dashboards permitidos" ON public.dashboard_widgets;

-- SELECT: Todos podem ver
CREATE POLICY "Todos podem ver widgets"
  ON public.dashboard_widgets
  FOR SELECT
  USING (true);

-- INSERT: Todos podem criar
CREATE POLICY "Todos podem criar widgets"
  ON public.dashboard_widgets
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Todos podem atualizar
CREATE POLICY "Todos podem atualizar widgets"
  ON public.dashboard_widgets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE: Todos podem deletar
CREATE POLICY "Todos podem deletar widgets"
  ON public.dashboard_widgets
  FOR DELETE
  USING (true);
```

### Opção 2: Políticas Seguras (Produção) 🔒

Use este para produção (requer validação de role):

**Arquivo:** `backend/database/migration-widget-policies-secure.sql`

Valida que apenas admin/owner do dashboard podem criar/editar widgets.

---

## 📋 Passo a Passo - EXECUTAR AGORA

### 1. Abrir Supabase Dashboard

- Acesse: https://app.supabase.com
- Selecione seu projeto: `dorztqiunewggydvkjnf`

### 2. Ir para SQL Editor

- Menu lateral → **SQL Editor**
- Clique em **+ New query**

### 3. Copiar e Executar Script

**COPIE TODO O CÓDIGO ABAIXO:**

```sql
-- ==============================================================================
-- FIX RÁPIDO: Permitir CRUD de widgets
-- ==============================================================================

-- Limpar políticas antigas
DROP POLICY IF EXISTS "Usuários veem widgets dos dashboards permitidos" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Todos podem ver widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Todos podem criar widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Todos podem atualizar widgets" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "Todos podem deletar widgets" ON public.dashboard_widgets;

-- SELECT: Ver widgets
CREATE POLICY "policy_select_widgets"
  ON public.dashboard_widgets
  FOR SELECT
  USING (true);

-- INSERT: Criar widgets
CREATE POLICY "policy_insert_widgets"
  ON public.dashboard_widgets
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Atualizar widgets
CREATE POLICY "policy_update_widgets"
  ON public.dashboard_widgets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE: Deletar widgets
CREATE POLICY "policy_delete_widgets"
  ON public.dashboard_widgets
  FOR DELETE
  USING (true);

-- Verificar se funcionou
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'dashboard_widgets'
ORDER BY cmd;
```

### 4. Executar Query

- Cole o código no editor
- Clique em **RUN** (▶️)
- Aguarde: **Success**

### 5. Verificar Resultado

Deve mostrar 4 políticas:

| tablename         | policyname            | cmd    |
| ----------------- | --------------------- | ------ |
| dashboard_widgets | policy_delete_widgets | DELETE |
| dashboard_widgets | policy_insert_widgets | INSERT |
| dashboard_widgets | policy_select_widgets | SELECT |
| dashboard_widgets | policy_update_widgets | UPDATE |

---

## 🧪 Testar Novamente

1. **Volte para o aplicativo**
2. **Recarregue a página** (Ctrl + R)
3. **Clique em "➕ Widget"**
4. **Configure o widget:**

   - Selecione tabela
   - Selecione colunas
   - Clique "Próximo"
   - Clique "Próximo"
   - Digite nome do widget
   - Clique "Salvar"

5. **Deve funcionar!** ✅

---

## 🐛 Se Ainda Não Funcionar

### Verificar RLS está Ativo

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'dashboard_widgets';
```

Deve retornar: `rowsecurity = true`

### Verificar Políticas Foram Criadas

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'dashboard_widgets';
```

Deve mostrar 4 políticas (SELECT, INSERT, UPDATE, DELETE)

### Testar Inserção Manual

```sql
-- Teste inserir um widget manualmente
INSERT INTO public.dashboard_widgets (
  dashboard_id,
  name,
  widget_type,
  query_config,
  position_x,
  position_y,
  width,
  height
) VALUES (
  1,  -- Use um dashboard_id existente
  'Teste Manual',
  'chart',
  '{"select":["*"],"from":"test","where":[],"orderBy":[],"limit":10}'::jsonb,
  0,
  0,
  6,
  4
);
```

Se este INSERT funcionar, o problema está no frontend. Se falhar, o problema está nas políticas.

---

## 📊 Entendendo Row-Level Security (RLS)

### O que é RLS?

Row-Level Security controla **quem** pode fazer **o quê** em cada linha da tabela.

### Tipos de Políticas:

| Operação   | Quando Usa      | Cláusula                                                            |
| ---------- | --------------- | ------------------------------------------------------------------- |
| **SELECT** | Ver dados       | `USING (condição)`                                                  |
| **INSERT** | Criar dados     | `WITH CHECK (condição)`                                             |
| **UPDATE** | Atualizar dados | `USING (condição para ler)` + `WITH CHECK (condição para escrever)` |
| **DELETE** | Deletar dados   | `USING (condição)`                                                  |

### Política Permissiva vs Restritiva:

```sql
-- PERMISSIVA (true = todos podem)
CREATE POLICY "nome" ON tabela FOR INSERT WITH CHECK (true);

-- RESTRITIVA (valida condição)
CREATE POLICY "nome" ON tabela FOR INSERT WITH CHECK (
  created_by = current_user
);
```

---

## 🔒 Migrar para Produção Depois

Quando for para produção, substitua as políticas permissivas por seguras:

```sql
-- Executar: migration-widget-policies-secure.sql
```

Isso vai:

- ✅ Validar que apenas admin/owner podem criar widgets
- ✅ Verificar permissões do dashboard
- ✅ Proteger contra acessos não autorizados

---

## 📁 Arquivos Criados

1. **migration-add-widget-policies.sql** - Políticas permissivas (desenvolvimento)
2. **migration-widget-policies-secure.sql** - Políticas seguras (produção)
3. **GUIA_FIX_RLS_WIDGETS.md** - Este arquivo

---

## ✅ Checklist Final

Antes de considerar resolvido:

- [ ] ✅ Executou script SQL no Supabase
- [ ] ✅ Verificou 4 políticas criadas
- [ ] ✅ Recarregou aplicação
- [ ] ✅ Conseguiu criar widget sem erro 403
- [ ] ✅ Widget aparece na lista
- [ ] ✅ Sem erros no console

---

## 🎯 Resumo Executivo

**Problema:** RLS bloqueando inserção de widgets  
**Causa:** Falta políticas de INSERT/UPDATE/DELETE  
**Solução:** Executar script SQL para criar políticas  
**Tempo:** 2 minutos  
**Urgência:** 🔴 CRÍTICO - Bloqueia funcionalidade principal

---

**Execute o script SQL AGORA e teste novamente!** 🚀
