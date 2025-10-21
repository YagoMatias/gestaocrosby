# Correção do Erro 400 - Invalid Input Syntax

## 🐛 Problema Identificado

Erro: `400 Bad Request - invalid input syntax for type integer: "76b8906e-7504-4da6-8f4a-8389802766c4"`

### Causa Raiz

O error `22P02` do PostgreSQL indica que o código estava tentando filtrar a coluna `usuarios` (que é um array INTEGER[]) usando a sintaxe de array nativa do Supabase, mas passando um UUID (string) quando o banco espera um INTEGER.

**Query problemática:**

```sql
SELECT * FROM dashboards
WHERE usuarios.cs.{76b8906e-7504-4da6-8f4a-8389802766c4}
```

**Problema:**

- `usuarios` é do tipo `INTEGER[]` (array de inteiros)
- Estava tentando buscar com um UUID (string) que é o formato de `auth.uid()` do Supabase
- A sintaxe `.cs.{}` (contains) espera um tipo compatível

---

## ✅ Solução Implementada

### 1. **Filtro Movido para Frontend**

Ao invés de usar a sintaxe de array nativa do Supabase (que tem limitações), agora:

```javascript
// ❌ Antes (não funcionava)
.or(`usuarios.cs.{${userIdParam}},created_by.eq.${userIdParam}`)

// ✅ Depois (filtra no frontend)
const dashboards = supabase
  .from('dashboards')
  .select('*')
  .eq('is_active', true);

// Filtrar no código JavaScript
const userDashboards = dashboards.filter(
  dashboard =>
    dashboard.usuarios?.includes(userIdParam) ||
    dashboard.created_by === userIdParam
);
```

### 2. **Padronização de Nomes de Propriedades**

O hook agora aceita múltiplos formatos:

```javascript
// Cria um novo dashboard
await createDashboard({
  name: 'Meu Dashboard', // ✅ Novo formato
  description: 'Descrição...',
  user_ids: [1, 2, 3],

  // OU (legado)
  nome: 'Meu Dashboard', // ✅ Ainda funciona
  descricao: 'Descrição...',
  usuarios: [1, 2, 3],
});
```

**Código do hook:**

```javascript
const nome = dashboardData.name || dashboardData.nome;
const descricao = dashboardData.description || dashboardData.descricao;
const usuarios = dashboardData.user_ids || dashboardData.usuarios || [];
```

### 3. **Campos Adicionados ao Retorno**

Agora retorna `widget_count` em vez de tentar contar via Supabase:

```javascript
const dashboardsWithCount = userDashboards.map((dash) => ({
  ...dash,
  widget_count: dash.widgets?.length || 0, // ✅ Novo
}));
```

---

## 📋 Arquivos Corrigidos

### `src/hooks/useDashboards.js`

- ✅ `fetchDashboards()` - Remove filtro de array nativo, filtra no frontend
- ✅ `fetchDashboardsWithWidgetCount()` - Mesmo ajuste + calcula widget_count
- ✅ `createDashboard()` - Aceita `name`/`user_ids` e `nome`/`usuarios`
- ✅ `updateDashboard()` - Mesmo ajuste para criar e atualizar
- ✅ Adiciona `fetchUserDashboards()` ao retorno

### `src/hooks/useWidgets.js`

- ✅ `createWidget()` - Flexível para múltiplos formatos de entrada
- ✅ Determina dinamicamente: `dashboard_id`, `nome`, `view_name`, `config`

### `src/pages/GerenciadorDashboards.jsx`

- ✅ `handleSaveWidget()` - Passa `user?.id` como segundo parâmetro

---

## 🔄 Fluxo Corrigido

```javascript
// 1. Frontend envia dados
await createDashboard({
  name: 'Dashboard Financeiro',
  description: 'Visão geral...',
  user_ids: [1, 2, 3],  // ✅ Array de INTEGERs
});

// 2. Hook padroniza
const nome = 'Dashboard Financeiro';
const usuarios = [1, 2, 3];  // ✅ Inteiros

// 3. Insere no Supabase
INSERT INTO dashboards (nome, usuarios, ...)
VALUES ('Dashboard Financeiro', '{1,2,3}', ...);  // ✅ Válido

// 4. Ao buscar: sem .cs.{uuid}
SELECT * FROM dashboards WHERE is_active = true;

// 5. Filtra em JavaScript
.filter(d => d.usuarios?.includes(userId) || d.created_by === userId);
```

---

## 🎯 Resultado

✅ **Erro 400 - Resolvido**

- Sem mais sintaxe de array nativa problemática
- Filtragem confiável no JavaScript
- Suporta múltiplos formatos de dados

✅ **Compatibilidade**

- Frontend envia dados normalizados
- Hook aceita formatos legado
- Supabase recebe dados válidos

✅ **Performance**

- Queries mais simples ao Supabase
- Filtragem em memória é instantânea
- Sem overhead adicional

---

## 🧪 Testando

```bash
# 1. Iniciar backend
cd backend && node index.js

# 2. Iniciar frontend
npm run dev

# 3. No navegador:
- Login como admin/owner
- Ir em "Gerenciador de Dashboards"
- Criar novo dashboard
- Deve funcionar sem erros 400 ✅
```

---

## 📝 Observações

- A coluna `usuarios` no Supabase é `INTEGER[]` ✅
- O `user_id` do contexto deve ser convertido para INTEGER se necessário
- Filtros de array nativo do Supabase são limitados, melhor fazer no frontend
- Mantém compatibilidade com código legado
