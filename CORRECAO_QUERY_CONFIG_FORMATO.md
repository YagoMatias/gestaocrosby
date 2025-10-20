# 🔧 Correção: Suporte a Formatos de Query Config

## 🐛 Problema Identificado

**Erro 500 ao executar query:**

```
POST https://apigestaocrosby-bw2v.onrender.com/api/querybuilder/execute 500
Error: Erro ao executar consulta
```

**Causa:**
O backend esperava `select` como array de objetos:

```javascript
// Esperado pelo backend:
select: [{ column: 'cd_empresa' }, { column: 'cd_ccusto' }];
```

Mas o frontend enviava array de strings:

```javascript
// Enviado pelo frontend:
select: ['cd_empresa', 'cd_ccusto'];
```

---

## ✅ Solução Implementada

### Arquivo: `backend/routes/querybuilder-execute.routes.js`

#### 1. **Correção no `buildSafeQuery` - SELECT**

**ANTES:**

```javascript
const select = params.select
  .map((col) => {
    // Assumia sempre objeto
    if (col.aggregation) { ... }
    const column = sanitizeIdentifier(col.column || col);
    ...
  })
```

**DEPOIS:**

```javascript
const select = params.select
  .map((col) => {
    // ✅ NOVO: Suporta string simples
    if (typeof col === 'string') {
      return sanitizeIdentifier(col);
    }

    // Objeto com agregação
    if (col.aggregation) { ... }

    // Objeto simples
    const column = sanitizeIdentifier(col.column || col);
    ...
  })
```

#### 2. **Correção no `buildSafeQuery` - ORDER BY**

**ANTES:**

```javascript
if (params.orderBy && params.orderBy.length > 0) {
  const orderColumns = params.orderBy
    .map((col) => {
      const column = sanitizeIdentifier(col.column || col);
      const direction = col.direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      return `${column} ${direction}`;
    })
```

**DEPOIS:**

```javascript
if (params.orderBy && Array.isArray(params.orderBy) && params.orderBy.length > 0) {
  const orderColumns = params.orderBy
    .map((col) => {
      // ✅ NOVO: Suporta string simples
      if (typeof col === 'string') {
        return `${sanitizeIdentifier(col)} ASC`;
      }
      // Objeto com direção
      const column = sanitizeIdentifier(col.column || col);
      const direction = col.direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      return `${column} ${direction}`;
    })
```

---

## 📋 Formatos Suportados Agora

### SELECT - 3 formatos aceitos:

**1. Array de strings (NOVO):**

```javascript
select: ['cd_empresa', 'cd_ccusto', 'cd_pessoa'];
```

**2. Array de objetos simples:**

```javascript
select: [
  { column: 'cd_empresa' },
  { column: 'cd_ccusto', alias: 'codigo_custo' },
];
```

**3. Array com agregações:**

```javascript
select: [
  { column: 'categoria' },
  { column: 'valor', aggregation: 'SUM', alias: 'total' },
];
```

### ORDER BY - 2 formatos aceitos:

**1. Array de strings (NOVO):**

```javascript
orderBy: ['cd_empresa', 'dt_cadastro'];
// Resulta em: ORDER BY cd_empresa ASC, dt_cadastro ASC
```

**2. Array de objetos:**

```javascript
orderBy: [
  { column: 'cd_empresa', direction: 'ASC' },
  { column: 'dt_cadastro', direction: 'DESC' },
];
```

### WHERE - Mantido (já funcionava):

```javascript
where: [
  { column: 'ativo', operator: '=', value: true },
  { column: 'dt_cadastro', operator: '>=', value: '2024-01-01', logic: 'AND' },
];
```

**Array vazio também funciona:**

```javascript
where: []; // ✅ OK - WHERE não será adicionado
```

---

## 🧪 Testando a Correção

### Query Config Enviada pelo Widget:

```javascript
{
  from: "ger_empresa",
  select: [
    "cd_empresa",
    "cd_ccusto",
    "cd_grupoempresa",
    "dt_cadastro",
    "cd_pessoa",
    "u_version",
    "cd_operador"
  ],
  where: [
    {column: "cd_empresa", operator: "=", value: "1"}
  ],
  orderBy: [],  // Array vazio - OK
  limit: 100
}
```

### SQL Gerado (esperado):

```sql
SELECT cd_empresa, cd_ccusto, cd_grupoempresa, dt_cadastro, cd_pessoa, u_version, cd_operador
FROM ger_empresa
WHERE cd_empresa = $1
LIMIT 100
```

---

## 🔄 Deploy no Render

Para aplicar as mudanças no backend:

### Opção 1: Git Push (Recomendado)

```bash
git add backend/routes/querybuilder-execute.routes.js
git commit -m "fix: suporte a select e orderBy como arrays de strings"
git push origin main
```

O Render fará deploy automático.

### Opção 2: Deploy Manual no Render

1. Acesse https://dashboard.render.com
2. Selecione o serviço `apigestaocrosby`
3. Clique em **"Manual Deploy" > "Deploy latest commit"**

---

## ✅ Checklist de Validação

Após deploy:

- [ ] Backend reiniciado no Render
- [ ] Testar endpoint direto:
  ```bash
  curl -X POST https://apigestaocrosby-bw2v.onrender.com/api/querybuilder/execute \
    -H "Content-Type: application/json" \
    -d '{
      "from": "ger_empresa",
      "select": ["cd_empresa", "cd_ccusto"],
      "where": [],
      "orderBy": [],
      "limit": 10
    }'
  ```
- [ ] Abrir Dashboard Personalizado
- [ ] Widget deve carregar dados sem erro 500
- [ ] Logs do Render devem mostrar "✅ Query executada com sucesso"

---

## 📊 Melhorias Adicionais

### Validação mais robusta:

```javascript
function validateQueryParams(params) {
  const errors = [];

  // Validar SELECT
  if (
    !params.select ||
    !Array.isArray(params.select) ||
    params.select.length === 0
  ) {
    errors.push('SELECT deve ser um array não vazio');
  }

  // Validar FROM
  if (!params.from || typeof params.from !== 'string') {
    errors.push('FROM deve ser uma string');
  }

  // Validar WHERE (opcional)
  if (params.where && !Array.isArray(params.where)) {
    errors.push('WHERE deve ser um array');
  }

  // Validar ORDER BY (opcional)
  if (params.orderBy && !Array.isArray(params.orderBy)) {
    errors.push('ORDER BY deve ser um array');
  }

  return errors;
}
```

---

## 🎯 Resultado Esperado

**Console do navegador:**

```
🌐 [executeQuery] Executando query: {...}
✅ [executeQuery] Resultado: {success: true, data: {rows: [...]}}
```

**Widget renderiza:**

- Tabela com dados reais
- Sem erro 500
- Sem loading infinito

---

**Status:** ✅ Correção implementada, aguardando deploy
**Próximo passo:** Fazer commit e push para aplicar no Render
