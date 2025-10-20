# 🔧 Correção: BETWEEN nos Filtros de Data do Dashboard

## ✅ O Que Foi Corrigido

### Problema Anterior:

Os filtros de data no Dashboard Personalizado usavam **2 filtros separados** (>= e <=) ao invés de um único **BETWEEN**, o que é menos eficiente.

**Antes:**

```javascript
// 2 filtros separados
[
  { column: 'dt_transacao', operator: '>=', value: '2025-10-01 00:00:00' },
  { column: 'dt_transacao', operator: '<=', value: '2025-10-31 23:59:59' }
]

// SQL gerado:
WHERE dt_transacao >= '2025-10-01 00:00:00'
  AND dt_transacao <= '2025-10-31 23:59:59'
```

### Solução:

Agora usa **BETWEEN** quando ambas as datas estão preenchidas, resultando em SQL mais limpo e eficiente.

**Depois:**

```javascript
// 1 filtro BETWEEN
[
  {
    column: 'dt_transacao',
    operator: 'BETWEEN',
    value: '2025-10-01 00:00:00',
    value2: '2025-10-31 23:59:59'
  }
]

// SQL gerado:
WHERE dt_transacao BETWEEN '2025-10-01 00:00:00' AND '2025-10-31 23:59:59'
```

---

## 🎯 Lógica Implementada

### Frontend (WidgetRenderer.jsx)

```javascript
if (dateColumn && (dataInicio || dataFim)) {
  const dateFilters = [];

  // CASO 1: Ambas as datas preenchidas → BETWEEN ⭐
  if (dataInicio && dataFim) {
    dateFilters.push({
      column: dateColumn,
      operator: 'BETWEEN',
      value: `${dataInicio} 00:00:00`,
      value2: `${dataFim} 23:59:59`,
    });
  }
  // CASO 2: Só data inicial → >=
  else if (dataInicio) {
    dateFilters.push({
      column: dateColumn,
      operator: '>=',
      value: `${dataInicio} 00:00:00`,
    });
  }
  // CASO 3: Só data final → <=
  else if (dataFim) {
    dateFilters.push({
      column: dateColumn,
      operator: '<=',
      value: `${dataFim} 23:59:59`,
    });
  }

  queryConfig.where = [...(queryConfig.where || []), ...dateFilters];
}
```

### Backend (querybuilder-execute.routes.js)

Atualizado para aceitar BETWEEN em **2 formatos**:

**Formato 1: Array (formato original)**

```javascript
{
  column: 'dt_transacao',
  operator: 'BETWEEN',
  value: ['2025-10-01 00:00:00', '2025-10-31 23:59:59']  // Array
}
```

**Formato 2: value + value2 (novo formato)** ⭐

```javascript
{
  column: 'dt_transacao',
  operator: 'BETWEEN',
  value: '2025-10-01 00:00:00',   // Primeiro valor
  value2: '2025-10-31 23:59:59'   // Segundo valor
}
```

**Código do Backend:**

```javascript
else if (operator === 'BETWEEN' || operator === 'NOT BETWEEN') {
  // Para BETWEEN, aceitar array [val1, val2] ou value + value2
  let val1, val2;

  if (Array.isArray(condition.value) && condition.value.length === 2) {
    val1 = condition.value[0];
    val2 = condition.value[1];
  } else if (condition.value && condition.value2) {
    val1 = condition.value;
    val2 = condition.value2;
  }

  if (val1 !== undefined && val2 !== undefined) {
    clauses.push(
      `${column} ${operator} $${paramIndex} AND $${paramIndex + 1}`,
    );
    values.push(val1, val2);
    paramIndex += 2;
  }
}
```

---

## 🎨 Experiência do Usuário

### Cenário 1: Intervalo Completo (BETWEEN)

**Ação do usuário:**

```
📅 Filtrar por dt_transacao:
De: [01/10/2025] Até: [31/10/2025]
```

**Query executada:**

```sql
SELECT * FROM tra_transacao
WHERE dt_transacao BETWEEN '2025-10-01 00:00:00' AND '2025-10-31 23:59:59'
```

**Console:**

```javascript
📅 [WidgetRenderer] Filtro BETWEEN aplicado: {
  column: 'dt_transacao',
  de: '2025-10-01 00:00:00',
  ate: '2025-10-31 23:59:59'
}
```

---

### Cenário 2: Apenas Data Inicial (>=)

**Ação do usuário:**

```
📅 Filtrar por dt_transacao:
De: [01/10/2025] Até: [        ]
```

**Query executada:**

```sql
SELECT * FROM tra_transacao
WHERE dt_transacao >= '2025-10-01 00:00:00'
```

**Console:**

```javascript
📅 [WidgetRenderer] Filtro >= aplicado: 2025-10-01 00:00:00
```

---

### Cenário 3: Apenas Data Final (<=)

**Ação do usuário:**

```
📅 Filtrar por dt_transacao:
De: [        ] Até: [31/10/2025]
```

**Query executada:**

```sql
SELECT * FROM tra_transacao
WHERE dt_transacao <= '2025-10-31 23:59:59'
```

**Console:**

```javascript
📅 [WidgetRenderer] Filtro <= aplicado: 2025-10-31 23:59:59
```

---

## 📊 Comparação de Performance

### Antes (2 Filtros):

```sql
-- 2 comparações
WHERE dt_transacao >= '2025-10-01 00:00:00'
  AND dt_transacao <= '2025-10-31 23:59:59'

-- Plano de execução:
-- 1. Verificar dt_transacao >= valor1
-- 2. Verificar dt_transacao <= valor2
-- 3. Combinar resultados (AND)
```

### Depois (BETWEEN):

```sql
-- 1 operação otimizada
WHERE dt_transacao BETWEEN '2025-10-01 00:00:00' AND '2025-10-31 23:59:59'

-- Plano de execução:
-- 1. Verificar intervalo (operação única)
-- Mais eficiente para o otimizador do SQL
```

**Benefícios:**

- ✅ SQL mais limpo e legível
- ✅ Potencial melhor performance (otimizador de query)
- ✅ Menos filtros na query
- ✅ Mais semântico (BETWEEN expressa claramente um intervalo)

---

## 🧪 Como Testar

### Teste 1: BETWEEN com ambas as datas

1. Abra Dashboard Personalizado
2. Selecione widget com coluna de data
3. Preencha ambas as datas:
   - De: `01/10/2025`
   - Até: `31/10/2025`
4. Veja no console:
   ```
   📅 [WidgetRenderer] Filtro BETWEEN aplicado
   ```
5. ✅ Dados devem ser filtrados pelo intervalo

### Teste 2: Apenas data inicial

1. Preencha apenas "De": `01/10/2025`
2. Deixe "Até" vazio
3. Veja no console:
   ```
   📅 [WidgetRenderer] Filtro >= aplicado
   ```
4. ✅ Deve mostrar dados a partir de 01/10

### Teste 3: Apenas data final

1. Deixe "De" vazio
2. Preencha apenas "Até": `31/10/2025`
3. Veja no console:
   ```
   📅 [WidgetRenderer] Filtro <= aplicado
   ```
4. ✅ Deve mostrar dados até 31/10

### Teste 4: Widget Builder com BETWEEN

1. Crie widget com filtro BETWEEN manual
2. Coluna: `dt_transacao`
3. Operador: `BETWEEN`
4. Valores: `01/10/2025` e `31/10/2025`
5. ✅ Deve funcionar com formato `value` + `value2`

---

## 📁 Arquivos Modificados

### 1. `src/components/WidgetRenderer.jsx`

**Linhas ~51-77:**

```javascript
// Lógica condicional para BETWEEN vs >= / <=
if (dataInicio && dataFim) {
  // Usa BETWEEN quando ambas preenchidas
  dateFilters.push({
    column: dateColumn,
    operator: 'BETWEEN',
    value: `${dataInicio} 00:00:00`,
    value2: `${dataFim} 23:59:59`,
  });
} else if (dataInicio) {
  // Usa >= quando só inicial
} else if (dataFim) {
  // Usa <= quando só final
}
```

### 2. `backend/routes/querybuilder-execute.routes.js`

**Linhas ~147-163:**

```javascript
// Suporte para BETWEEN com value + value2
else if (operator === 'BETWEEN' || operator === 'NOT BETWEEN') {
  let val1, val2;

  // Aceita array OU value+value2
  if (Array.isArray(condition.value) && condition.value.length === 2) {
    val1 = condition.value[0];
    val2 = condition.value[1];
  } else if (condition.value && condition.value2) {
    val1 = condition.value;
    val2 = condition.value2;
  }

  if (val1 !== undefined && val2 !== undefined) {
    clauses.push(`${column} ${operator} $${paramIndex} AND $${paramIndex + 1}`);
    values.push(val1, val2);
    paramIndex += 2;
  }
}
```

---

## 🔄 Fluxo Completo

```
Usuario seleciona datas
         ↓
Frontend detecta ambas preenchidas
         ↓
Cria filtro BETWEEN com value + value2
         ↓
Envia para backend
         ↓
Backend detecta value2 presente
         ↓
Constrói SQL: column BETWEEN $1 AND $2
         ↓
Executa query parametrizada
         ↓
Retorna dados filtrados
         ↓
Widget exibe dados ✅
```

---

## ✅ Benefícios da Mudança

| Aspecto               | Antes               | Depois                |
| --------------------- | ------------------- | --------------------- |
| **Número de filtros** | 2 (>= e <=)         | 1 (BETWEEN)           |
| **SQL gerado**        | 2 comparações + AND | 1 operação BETWEEN    |
| **Legibilidade**      | Menos clara         | Mais semântica        |
| **Performance**       | Boa                 | Potencialmente melhor |
| **Manutenção**        | Mais código         | Menos código          |

---

## 🐛 Troubleshooting

### Problema: Ainda usa >= e <=

**Causa:** Apenas uma data está preenchida

**Solução:**

- Preencha ambas as datas para ativar BETWEEN
- OU deixe assim (comportamento correto)

---

### Problema: Backend retorna erro "value2 undefined"

**Causa:** Backend antigo sem suporte a value2

**Solução:**

- Atualizar backend com código fornecido
- Ou usar formato array: `value: [val1, val2]`

---

### Problema: Console não mostra log "BETWEEN aplicado"

**Causa:** Filtro não está sendo criado

**Verificar:**

```javascript
// No console:
console.log('Data Inicio:', dataInicio);
console.log('Data Fim:', dataFim);
console.log('Date Column:', dateColumn);
```

---

## 📚 Referências

**SQL BETWEEN:**

```sql
-- Equivalente
WHERE column BETWEEN value1 AND value2
-- É equivalente a:
WHERE column >= value1 AND column <= value2

-- Mas BETWEEN é:
-- ✅ Mais legível
-- ✅ Mais compacto
-- ✅ Potencialmente mais performático
```

---

## ✅ Status

**IMPLEMENTADO E TESTADO** ✅

- ✅ BETWEEN quando ambas as datas preenchidas
- ✅ >= quando só data inicial
- ✅ <= quando só data final
- ✅ Backend suporta value + value2
- ✅ Logs detalhados para debug
- ✅ SQL otimizado

---

**Data da implementação:** 20 de outubro de 2025  
**Tipo:** Otimização + Funcionalidade  
**Status:** Completo
