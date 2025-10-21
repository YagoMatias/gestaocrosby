# 📊 Sistema de Widgets e Dashboards - Documentação Completa

## 🗄️ Estrutura de Bancos de Dados

### **1. Supabase (PostgreSQL)** - Armazenamento de Configurações

Responsável por:

- ✅ Dashboards criados
- ✅ Widgets e suas configurações
- ✅ Usuários com acesso
- ✅ Metadados (criação, atualização, etc)

### **2. REST API (Render/PostgreSQL)** - Fonte de Dados

Responsável por:

- ✅ Views e tabelas disponíveis
- ✅ Dados reais para os widgets
- ✅ Execução de queries personalizadas

---

## 📋 PASSO 1: Configurar Supabase

### Criar as Tabelas no Supabase

Execute o arquivo SQL no editor SQL do Supabase:

```bash
backend/database/schema-widgets-dashboards.sql
```

Este script cria:

#### **Tabela: `dashboards`**

```sql
- id (UUID) - Primary Key
- nome (VARCHAR) - Nome do dashboard
- descricao (TEXT) - Descrição do dashboard
- usuarios (INTEGER[]) - Array de IDs dos usuários com acesso
- created_by (INTEGER) - ID do criador
- created_at (TIMESTAMP) - Data de criação
- updated_at (TIMESTAMP) - Data de atualização
- is_active (BOOLEAN) - Status ativo/inativo
```

#### **Tabela: `widgets`**

```sql
- id (UUID) - Primary Key
- dashboard_id (UUID) - Foreign Key para dashboards
- nome (VARCHAR) - Nome do widget
- view_name (VARCHAR) - Nome da view/tabela do REST API
- config (JSONB) - Configuração completa do widget
- created_by (INTEGER) - ID do criador
- created_at (TIMESTAMP) - Data de criação
- updated_at (TIMESTAMP) - Data de atualização
- is_active (BOOLEAN) - Status ativo/inativo
```

#### **Estrutura do JSONB `config`:**

```json
{
  "selectedColumns": ["col1", "col2"],
  "filters": [
    {
      "id": 123,
      "column": "nome_coluna",
      "operator": "=",
      "value": "valor"
    }
  ],
  "aggregations": [
    {
      "column": "valor",
      "function": "SUM"
    }
  ],
  "orderBy": {
    "column": "data",
    "direction": "DESC"
  },
  "type": "table|bar|pie|line"
}
```

### ✅ Recursos Incluídos:

- Índices otimizados
- Triggers para `updated_at` automático
- Row Level Security (RLS)
- Políticas de segurança

---

## 🚀 PASSO 2: Rotas do Backend (REST API)

### Rotas Disponíveis:

#### **1. Listar Views Disponíveis**

```http
GET /api/widgets/views
```

**Resposta:**

```json
{
  "success": true,
  "data": [
    {
      "name": "vw_vendas",
      "type": "VIEW"
    },
    {
      "name": "vw_financeiro",
      "type": "VIEW"
    }
  ],
  "count": 2
}
```

---

#### **2. Listar Colunas de uma View**

```http
GET /api/widgets/views/:viewName/columns
```

**Exemplo:**

```http
GET /api/widgets/views/vw_vendas/columns
```

**Resposta:**

```json
{
  "success": true,
  "viewName": "vw_vendas",
  "columns": [
    {
      "name": "id",
      "type": "integer",
      "nullable": "NO",
      "default_value": null
    },
    {
      "name": "produto",
      "type": "character varying",
      "nullable": "YES",
      "default_value": null
    }
  ],
  "count": 2
}
```

---

#### **3. Executar Query Customizada**

```http
POST /api/widgets/query
```

**Body:**

```json
{
  "viewName": "vw_vendas",
  "columns": ["produto", "valor_total"],
  "filters": [
    {
      "column": "data",
      "operator": ">=",
      "value": "2024-01-01"
    },
    {
      "column": "loja",
      "operator": "IN",
      "values": ["Loja 1", "Loja 2"]
    }
  ],
  "aggregations": [
    {
      "column": "valor_total",
      "function": "SUM"
    }
  ],
  "orderBy": {
    "column": "valor_total",
    "direction": "DESC"
  },
  "limit": 100
}
```

**Resposta:**

```json
{
  "success": true,
  "data": [
    {
      "produto": "Produto A",
      "valor_total": 15000
    },
    {
      "produto": "Produto B",
      "valor_total": 12000
    }
  ],
  "count": 2
}
```

---

#### **4. Validar Query (sem executar)**

```http
POST /api/widgets/validate-query
```

**Body:**

```json
{
  "viewName": "vw_vendas",
  "columns": ["produto", "valor"]
}
```

**Resposta:**

```json
{
  "success": true,
  "message": "Query válida",
  "viewName": "vw_vendas",
  "columns": ["produto", "valor"]
}
```

---

## 🔧 Operadores Suportados

| Operador      | Símbolo | Descrição          | Requer Valor    |
| ------------- | ------- | ------------------ | --------------- |
| `=`           | =       | Igual a            | Sim             |
| `<>`          | ≠       | Diferente de       | Sim             |
| `>`           | >       | Maior que          | Sim             |
| `>=`          | ≥       | Maior ou igual     | Sim             |
| `<`           | <       | Menor que          | Sim             |
| `<=`          | ≤       | Menor ou igual     | Sim             |
| `LIKE`        | ~       | Contém             | Sim             |
| `NOT LIKE`    | ≁       | Não contém         | Sim             |
| `BETWEEN`     | ⇔       | Entre dois valores | Sim (2 valores) |
| `IN`          | ∈       | Em lista           | Sim (array)     |
| `IS NULL`     | ∅       | É nulo             | Não             |
| `IS NOT NULL` | ∃       | Não é nulo         | Não             |

---

## 📊 Funções de Agregação

- `SUM` - Soma
- `COUNT` - Contagem
- `AVG` - Média
- `MIN` - Mínimo
- `MAX` - Máximo

---

## 🎨 Tipos de Visualização

1. **table** - Tabela simples
2. **bar** - Gráfico de barras
3. **pie** - Gráfico de pizza
4. **line** - Gráfico de linha

---

## 💻 Exemplo de Uso Completo

### 1. **Buscar Views Disponíveis**

```javascript
const response = await fetch('http://localhost:5000/api/widgets/views');
const { data } = await response.json();
console.log(data); // Lista de views
```

### 2. **Buscar Colunas de uma View**

```javascript
const response = await fetch(
  'http://localhost:5000/api/widgets/views/vw_vendas/columns',
);
const { columns } = await response.json();
console.log(columns); // Lista de colunas
```

### 3. **Executar Query com Filtros**

```javascript
const response = await fetch('http://localhost:5000/api/widgets/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    viewName: 'vw_vendas',
    columns: ['produto', 'valor_total'],
    filters: [{ column: 'data', operator: '>=', value: '2024-01-01' }],
    aggregations: [{ column: 'valor_total', function: 'SUM' }],
    orderBy: { column: 'valor_total', direction: 'DESC' },
    limit: 100,
  }),
});
const { data } = await response.json();
console.log(data); // Dados processados
```

---

## 🔐 Segurança

### Backend (REST API):

- ✅ Rate limiting configurado
- ✅ Validação de nomes de views/colunas (SQL injection protection)
- ✅ Apenas queries SELECT permitidas
- ✅ Limit máximo de 1000 registros

### Supabase:

- ✅ Row Level Security (RLS) ativado
- ✅ Políticas de acesso por usuário
- ✅ Triggers para auditoria
- ✅ JSONB para configurações flexíveis

---

## 📁 Arquivos Criados

```
backend/
├── database/
│   └── schema-widgets-dashboards.sql    # Schema Supabase
├── routes/
│   └── widgets.routes.js                # Rotas REST API
└── index.js (atualizado)                # Registro das rotas

src/
├── utils/
│   └── widgetValidators.js              # Validadores e operadores
├── components/
│   ├── WidgetModal.jsx                  # Modal de criação de widgets
│   └── WidgetPreview.jsx                # Preview de widgets
└── pages/
    ├── GerenciadorDashboards.jsx        # Gerenciamento
    └── Widgets.jsx                      # Visualização dos widgets
```

---

## 🎯 Próximos Passos

1. ✅ Executar SQL no Supabase
2. ✅ Backend já configurado
3. 🔄 Conectar frontend com as APIs
4. 🔄 Implementar CRUD de dashboards no Supabase
5. 🔄 Implementar CRUD de widgets no Supabase
6. 🔄 Substituir dados mockados por dados reais

---

## 📞 Endpoints do Supabase (a implementar no frontend)

```javascript
// Criar dashboard
supabase.from('dashboards').insert({
  nome,
  descricao,
  usuarios,
  created_by,
});

// Buscar dashboards do usuário
supabase.from('dashboards').select('*').contains('usuarios', [userId]);

// Criar widget
supabase.from('widgets').insert({
  dashboard_id,
  nome,
  view_name,
  config,
  created_by,
});

// Buscar widgets de um dashboard
supabase.from('widgets').select('*').eq('dashboard_id', dashboardId);
```

---

✅ **Sistema completo e pronto para integração!**
