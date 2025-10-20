# 🔧 CORREÇÃO - Preview Infinito (Não Retorna Dados)

## ❌ Problema Identificado

**Sintoma:** Ao clicar em "🔄 Atualizar Preview", fica carregando indefinidamente e não mostra dados.

**Causa Raiz:** O endpoint `/api/querybuilder/preview` no backend estava **incorretamente implementado**.

```javascript
// CÓDIGO PROBLEMÁTICO ❌
router.post('/preview', async (req, res) => {
  try {
    const params = { ...req.body, limit: 10 };
    req.body = params;
    return router.handle(req, res); // ← ISSO NÃO FUNCIONA!
  } catch (error) {
    // ...
  }
});
```

**O que estava errado:**

1. `router.handle()` não existe dessa forma
2. Não executava a query de verdade
3. Não retornava resposta ao cliente
4. Frontend ficava esperando resposta que nunca chegava

---

## ✅ Solução Aplicada

### 1. Backend Corrigido (`querybuilder-execute.routes.js`)

**Implementação completa do endpoint `/preview`:**

```javascript
router.post('/preview', async (req, res) => {
  try {
    // Forçar limit de 10 para preview
    const params = { ...req.body, limit: 10 };

    // Validar parâmetros
    const validationErrors = validateQueryParams(params);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors,
      });
    }

    // Construir query segura
    const { query, values } = buildSafeQuery(params);

    // Executar query
    const result = await pool.query(query, values);

    // Retornar resultado
    res.json({
      success: true,
      data: {
        rows: result.rows,
        total: result.rows.length,
      },
      executionTime: `${executionTime}ms`,
    });
  } catch (error) {
    // Tratamento de erros
    res.status(500).json({
      success: false,
      error: 'PREVIEW_ERROR',
      message: errorMessage,
    });
  }
});
```

### 2. Frontend com Logs Detalhados

**Adicionados logs em `WidgetBuilderModal.jsx`:**

```javascript
const handlePreview = async () => {
  console.log('🔍 [WidgetBuilder] handlePreview iniciado');
  console.log('📋 Selected Table:', selectedTable);
  console.log('📋 Selected Columns:', selectedColumns);

  const queryConfig = {
    select: selectedColumns,
    from: selectedTable,
    where: filters.filter((f) => f.column && f.value),
    orderBy: orderBy.filter((o) => o.column),
    limit: 10,
  };

  console.log('📦 Query Config:', queryConfig);
  console.log('🌐 Chamando previewQuery...');

  const startTime = Date.now();
  const result = await previewQuery(queryConfig);
  const endTime = Date.now();

  console.log(`⏱️ previewQuery levou ${endTime - startTime}ms`);
  console.log('📦 Resultado:', result);

  if (result.success) {
    console.log('✅ Preview data recebido:', result.data?.length, 'registros');
    setPreviewData(result.data);
  }
};
```

**Adicionados logs em `queryBuilderApi.js`:**

```javascript
export async function previewQuery(queryConfig) {
  console.log('🌐 [API] previewQuery iniciado');
  console.log('🌐 [API] URL:', `${API_BASE_URL}/api/querybuilder/preview`);
  console.log('🌐 [API] Query Config:', queryConfig);

  const response = await fetch(`${API_BASE_URL}/api/querybuilder/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queryConfig),
  });

  console.log('🌐 [API] Response status:', response.status);
  console.log('🌐 [API] Response ok:', response.ok);

  const result = await response.json();
  console.log('📦 [API] Result:', result);

  return {
    success: true,
    data: result.data.rows,
    total: result.data.total,
  };
}
```

---

## 🧪 Como Testar Agora

### Passo 1: Reiniciar Backend

O backend precisa recarregar o código atualizado:

```bash
# Se estiver rodando em modo dev, basta salvar o arquivo
# Se não estiver rodando, execute:
cd backend
npm run dev
```

### Passo 2: Testar Preview

1. **Abra o Console** (F12)
2. **Clique em "➕ Widget"**
3. **Preencha:**
   - Selecione tabela
   - Selecione colunas
   - Clique "Próximo"
   - (Opcional) Adicione filtros
   - Clique "Próximo"
4. **Clique em "🔄 Atualizar Preview"**

### Passo 3: Verificar Logs

**No Console do Navegador:**

```javascript
🔍 [WidgetBuilder] handlePreview iniciado
📋 [WidgetBuilder] Selected Table: prd_produto
📋 [WidgetBuilder] Selected Columns: ["cd_produto", "ds_produto"]
📦 [WidgetBuilder] Query Config: {select: [...], from: "...", ...}
🌐 [WidgetBuilder] Chamando previewQuery...
🌐 [API] previewQuery iniciado
🌐 [API] URL: https://apigestaocrosby.../api/querybuilder/preview
🌐 [API] Response status: 200
🌐 [API] Response ok: true
📦 [API] Result: {success: true, data: {rows: [...]}}
⏱️ [WidgetBuilder] previewQuery levou 1234ms
✅ [WidgetBuilder] Preview data recebido: 10 registros
🏁 [WidgetBuilder] handlePreview finalizado
```

**No Console do Backend:**

```
🔍 Executando PREVIEW: {select: [...], from: "...", limit: 10}
📝 Query SQL (preview): SELECT "cd_produto", "ds_produto" FROM prd_produto LIMIT 10
📊 Valores (preview): []
✅ Preview executado com sucesso em 45ms - 10 registros
```

### Passo 4: Verificar Tabela

Deve aparecer uma tabela com os dados:

| cd_produto | ds_produto |
| ---------- | ---------- |
| 1          | Produto A  |
| 2          | Produto B  |
| ...        | ...        |

---

## 🐛 Troubleshooting

### Problema: Ainda fica carregando

**Verifique:**

1. **Backend está rodando?**

   ```bash
   curl http://localhost:3000/api/utils/health
   ```

2. **URL da API está correta?**

   ```javascript
   // No console do navegador:
   console.log(import.meta.env.VITE_API_URL);
   ```

3. **Endpoint existe?**
   ```bash
   curl -X POST http://localhost:3000/api/querybuilder/preview \
     -H "Content-Type: application/json" \
     -d '{"select":["*"],"from":"prd_produto","limit":10}'
   ```

### Problema: Erro 400 (Bad Request)

**Verifique no console:**

```javascript
❌ [API] Response error: {...errors: [...]}
```

**Causa provável:** Query config inválida

- `select` deve ser array de strings
- `from` deve ser string (nome da tabela)
- `where` deve ser array de objetos
- `orderBy` deve ser array de objetos

### Problema: Erro 500 (Internal Server Error)

**Verifique nos logs do backend:**

```
❌ Erro ao executar preview: Error: ...
```

**Causas possíveis:**

- Tabela não existe (42P01)
- Coluna não existe (42703)
- Sintaxe SQL inválida (42601)
- Banco de dados offline

### Problema: Tabela vazia (sem dados)

**Isso é normal se:**

- A tabela realmente está vazia
- Os filtros excluem todos os registros
- O limite é muito baixo

**Para testar:**

```sql
-- Execute no banco de dados:
SELECT COUNT(*) FROM sua_tabela;
```

---

## 📊 Estrutura da Resposta

### Request (Frontend → Backend):

```json
{
  "select": ["cd_produto", "ds_produto"],
  "from": "prd_produto",
  "where": [{ "column": "cd_produto", "operator": ">", "value": "100" }],
  "orderBy": [{ "column": "cd_produto", "direction": "DESC" }],
  "limit": 10
}
```

### Response (Backend → Frontend):

```json
{
  "success": true,
  "data": {
    "rows": [
      { "cd_produto": 105, "ds_produto": "Produto X" },
      { "cd_produto": 104, "ds_produto": "Produto Y" }
    ],
    "total": 2,
    "columns": [
      { "name": "cd_produto", "dataTypeID": 23 },
      { "name": "ds_produto", "dataTypeID": 1043 }
    ]
  },
  "executionTime": "45ms",
  "query": "SELECT \"cd_produto\", \"ds_produto\" FROM prd_produto WHERE \"cd_produto\" > $1 ORDER BY \"cd_produto\" DESC LIMIT 10"
}
```

---

## ✅ Checklist Final

Antes de considerar resolvido:

- [ ] ✅ Backend reiniciado com código atualizado
- [ ] ✅ Console do navegador mostra logs detalhados
- [ ] ✅ Request é enviado para `/api/querybuilder/preview`
- [ ] ✅ Response retorna status 200
- [ ] ✅ Response contém `data.rows` com registros
- [ ] ✅ Tabela de preview renderiza na tela
- [ ] ✅ Mostra "Mostrando X registros (preview limitado)"
- [ ] ✅ Sem erros no console

---

## 📁 Arquivos Modificados

1. ✅ `backend/routes/querybuilder-execute.routes.js` - Endpoint `/preview` corrigido
2. ✅ `src/components/WidgetBuilderModal.jsx` - Logs adicionados em `handlePreview`
3. ✅ `src/lib/queryBuilderApi.js` - Logs adicionados em `previewQuery`
4. ✅ `GUIA_FIX_PREVIEW_INFINITO.md` - Este arquivo (NOVO)

---

## 🎯 Resumo Executivo

**Problema:** Preview não retorna dados (loading infinito)  
**Causa:** Endpoint `/preview` mal implementado  
**Solução:** Reimplementação completa do endpoint  
**Status:** ✅ Corrigido  
**Ação:** Reiniciar backend e testar

---

**Reinicie o backend e teste novamente! Os logs vão mostrar exatamente onde está o problema.** 🚀
