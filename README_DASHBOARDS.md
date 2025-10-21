# 📊 Sistema de Dashboards e Widgets - README

## 🎯 O que foi entregue?

Um **sistema completo e funcional de dashboards e widgets** que permite que administradores criem dashboards personalizados e os compartilhem com usuários, que podem visualizar dados em tempo real através de gráficos e tabelas interativas.

---

## 🏗️ Arquitetura

### Frontend (React + Vite)

- **GerenciadorDashboards:** Interface CRUD para admin/owner
- **Widgets:** Página de visualização para usuários
- **WidgetModal:** Configurador 5-step para criar widgets
- **Hooks:** useDashboards, useWidgets, useWidgetAPI

### Backend (Node.js + Express)

- **REST API:** Endpoints para buscar views e executar queries
- **Database:** PostgreSQL via Supabase

### Segurança

- **RLS:** Row Level Security no Supabase
- **SQL Injection Protection:** Queries parametrizadas
- **Role-Based Access:** Admin/Owner vs Usuários normais

---

## 🚀 Quick Start

### 1. Iniciar Backend

```bash
cd backend
npm install
node index.js
# ✅ REST API em http://localhost:5000
```

### 2. Iniciar Frontend

```bash
npm install
npm run dev
# ✅ App em http://localhost:3001
```

### 3. Login

- **Admin/Owner:** Acesso ao Gerenciador de Dashboards
- **Usuário Normal:** Acesso à página de Widgets

---

## 📂 Estrutura do Projeto

```
projeto/
├── backend/
│   ├── index.js
│   ├── routes/
│   │   └── widgets.routes.js
│   ├── config/
│   │   └── database.js
│   └── database/
│       └── schema-widgets-dashboards.sql
│
├── src/
│   ├── pages/
│   │   ├── GerenciadorDashboards.jsx ⭐
│   │   └── Widgets.jsx ⭐
│   │
│   ├── components/
│   │   ├── WidgetModal.jsx ⭐
│   │   └── WidgetPreview.jsx ⭐
│   │
│   ├── hooks/
│   │   ├── useDashboards.js ⭐
│   │   ├── useWidgets.js ⭐
│   │   └── useWidgetAPI.js ⭐
│   │
│   └── utils/
│       └── widgetValidators.js
│
├── .env                          ⭐ (VITE_API_URL)
├── SISTEMA_DASHBOARDS_COMPLETO.md
├── GUIA_TESTES.md
└── README.md
```

⭐ = Arquivos principais

---

## 🔑 Arquivos Principais

### 1. **GerenciadorDashboards.jsx**

```javascript
// O que faz:
- Listar dashboards
- Criar novo dashboard
- Editar dashboard
- Deletar dashboard
- Incluir widget
- Atribuir usuários

// Acesso:
- Admin/Owner apenas
- Via: Sidebar → Administração
```

### 2. **Widgets.jsx**

```javascript
// O que faz:
- Listar dashboards do usuário
- Listar widgets de cada dashboard
- Renderizar widgets com dados reais
- Suporta: tabelas, gráficos (bar, pie, line)

// Acesso:
- Todos os usuários
- Via: Menu → Widgets
```

### 3. **WidgetModal.jsx**

```javascript
// 5 Passos:
1. Selecionar View e Colunas
2. Configurar Filtros (WHERE)
3. Agregações (SUM, COUNT, AVG) & ORDER BY
4. Tipo de Visualização
5. Preview & Salvar

// Dados reais:
- Views do REST API
- Colunas dinâmicas
- Preview em tempo real
```

### 4. **Hooks (useDashboards, useWidgets, useWidgetAPI)**

```javascript
// useDashboards.js
- Fetch/Create/Update/Delete dashboards
- Contagem automática de widgets

// useWidgets.js
- Fetch/Create/Update/Delete widgets
- Buscar widgets por dashboard

// useWidgetAPI.js
- Buscar views disponíveis
- Buscar colunas de uma view
- Executar queries com filtros/agregações
- Validar queries
```

---

## 🗄️ Supabase Schema

### Tabela: `dashboards`

```sql
id              UUID PRIMARY KEY
nome            VARCHAR(255)
descricao       TEXT
usuarios        INTEGER[]           -- Array de IDs dos usuários
created_by      INTEGER             -- Criador
created_at      TIMESTAMP
updated_at      TIMESTAMP
is_active       BOOLEAN
```

### Tabela: `widgets`

```sql
id              UUID PRIMARY KEY
dashboard_id    UUID REFERENCES dashboards(id)
nome            VARCHAR(255)
view_name       VARCHAR(255)        -- Nome da view do REST API
config          JSONB               -- Toda a configuração
created_by      INTEGER
created_at      TIMESTAMP
updated_at      TIMESTAMP
is_active       BOOLEAN

-- Config JSONB:
{
  "selectedColumns": ["col1", "col2"],
  "filters": [{column, operator, value}],
  "aggregations": [{column, function}],
  "orderBy": {column, direction},
  "type": "table|bar|pie|line"
}
```

---

## 🔌 API REST (Backend)

### Endpoints de Widgets

```bash
# 1. Listar views disponíveis
GET http://localhost:5000/api/widgets/views

# Resposta:
[
  { "name": "vw_vendas", "label": "View de Vendas" },
  { "name": "vw_financeiro", "label": "View Financeira" }
]

---

# 2. Listar colunas de uma view
GET http://localhost:5000/api/widgets/views/vw_vendas/columns

# Resposta:
["id", "data", "produto", "quantidade", "valor_total", "vendedor"]

---

# 3. Executar query com filtros e agregações
POST http://localhost:5000/api/widgets/query
Content-Type: application/json

{
  "viewName": "vw_vendas",
  "columns": ["produto", "valor_total"],
  "filters": [
    {
      "column": "data",
      "operator": ">=",
      "value": "2024-01-01"
    }
  ],
  "aggregations": [
    { "column": "valor_total", "function": "SUM" }
  ],
  "orderBy": {
    "column": "valor_total",
    "direction": "DESC"
  }
}

# Resposta:
{
  "data": [
    { "produto": "Produto A", "valor_total": 5000 },
    { "produto": "Produto B", "valor_total": 3000 }
  ],
  "success": true
}

---

# 4. Validar query (sem executar)
POST http://localhost:5000/api/widgets/validate-query
# Mesmo body que query

# Resposta:
{ "valid": true, "message": "Query válida" }
```

---

## 🔒 Segurança

### RLS (Row Level Security)

```sql
-- Usuários veem dashboards onde estão em 'usuarios' ou são criadores
-- Apenas criadores podem editar/deletar
-- Widgets herdam permissões do dashboard
```

### SQL Injection Protection

```javascript
// ✅ Queries parametrizadas
// ✅ Regex validation de nomes
// ✅ Whitelist de operadores SQL
// ✅ Validação de tipos
```

### Autenticação

```javascript
// ✅ useAuth() para proteger páginas
// ✅ PrivateRoute para componentes
// ✅ Verificação de roles
// ✅ Sidebar condicionado ao role
```

---

## 🧪 Testando

### Teste Rápido

```bash
1. npm run dev
2. Abrir http://localhost:3001
3. Login como admin/owner
4. Ir em "Gerenciador de Dashboards"
5. Criar novo dashboard
6. Incluir widget
7. Vê preview com dados reais? ✅
```

### Testes Completos

Veja `GUIA_TESTES.md` para checklist detalhado

---

## 📊 Fluxo Completo

```
┌─────────────────────────────────────┐
│       ADMIN/OWNER                   │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Criar Dashboard     │
    │ - Nome              │
    │ - Descrição         │
    │ - Usuários (select) │
    └──────────┬──────────┘
               │ Salva em Supabase.dashboards
               ▼
    ┌─────────────────────┐
    │ Incluir Widget      │
    │ - 5 Step Modal      │
    │ - Dados da API      │
    │ - Preview realtime  │
    └──────────┬──────────┘
               │ Salva em Supabase.widgets
               ▼
    ┌─────────────────────┐
    │ Widget + Dashboard  │
    │ Criado com sucesso! │
    └─────────────────────┘
               │
               │ Compartilha com usuários
               │
┌──────────────┴──────────────────────┐
│          USUÁRIOS                   │
└─────────────────────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Ir em "Widgets"     │
    │ - Listar dashboards │
    │ - Listar widgets    │
    │ - Dados reais       │
    │ - Gráficos/Tabelas  │
    └─────────────────────┘
```

---

## 📝 Variáveis de Ambiente

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:5000
```

### Backend (`.env` ou direto em `config/database.js`)

```env
# Supabase (RLS protege access)
SUPABASE_URL=...
SUPABASE_KEY=...

# PostgreSQL REST API (local ou remoto)
DB_HOST=localhost
DB_PORT=5432
DB_USER=...
DB_PASS=...
DB_NAME=...
```

---

## 🎯 Checklist de Implementação

- ✅ GerenciadorDashboards.jsx criado
- ✅ Widgets.jsx criado
- ✅ WidgetModal.jsx com 5 steps
- ✅ WidgetPreview.jsx com charts
- ✅ useDashboards.js hook
- ✅ useWidgets.js hook
- ✅ useWidgetAPI.js hook
- ✅ Backend REST API funcionando
- ✅ Supabase RLS configurado
- ✅ Erro 400 resolvido
- ✅ Dados reais (não mockados)
- ✅ Documentação completa

---

## 🐛 Troubleshooting

### Erro 400 - Supabase

**Solução:** Verifique se `usuarios` é INTEGER[] no Supabase

### Widgets não carregam

**Solução:** Verifique se REST API está rodando em 5000

### Usuários não aparecem ao criar dashboard

**Solução:** Verifique se tabela `users` existe no Supabase

### Preview sem dados

**Solução:** Verifique query no Network tab do DevTools

---

## 📚 Documentação

- `SISTEMA_DASHBOARDS_COMPLETO.md` - Visão geral completa
- `CORRECAO_ERRO_400.md` - Detalhes da correção
- `GUIA_TESTES.md` - Testes funcionais passo a passo
- Este `README.md` - Quick start

---

## 🎉 Pronto para Usar!

O sistema está **100% funcional** e pronto para produção.

### Para começar:

```bash
cd backend && node index.js &
npm run dev
```

### Acessar:

```
Frontend: http://localhost:3001
Backend:  http://localhost:5000
```

### Enjoy! 🚀
