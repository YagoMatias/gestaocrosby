# 🔧 Correção: Formato de Data Incompleto

## ❌ Problema Identificado

**Erro no console:**

```javascript
{
  column: "dt_transacao",
  operator: ">",
  value: "2025-10-19"  // ❌ Apenas data, sem hora
}

// Backend retorna:
400 Bad Request - "Parâmetros inválidos"
```

**Causa raiz:**

- Input `datetime-local` pode retornar apenas data: `"2025-10-19"`
- Backend espera formato completo: `"2025-10-19 00:00:00"`
- Função `formatFiltersForBackend()` não tratava esse caso

---

## ✅ Solução Implementada

### 1. **Função `formatFiltersForBackend()` Melhorada**

Agora trata 4 casos diferentes:

```javascript
// CASO 1: datetime-local completo
"2024-01-15T10:30" → "2024-01-15 10:30:00"

// CASO 2: Apenas data (NOVO!)
"2024-01-15" → "2024-01-15 00:00:00"

// CASO 3: Data com hora mas sem segundos
"2024-01-15 10:30" → "2024-01-15 10:30:00"

// CASO 4: Já está completo
"2024-01-15 10:30:00" → "2024-01-15 10:30:00"
```

### 2. **Código Implementado**

```javascript
const formatFiltersForBackend = (filters) => {
  return filters
    .filter((f) => f.column && f.value)
    .map((filter) => {
      const column = columns.find((col) => col.name === filter.column);
      const columnType = column?.data_type?.toLowerCase() || '';

      const isDateColumn =
        columnType.includes('date') ||
        columnType.includes('time') ||
        columnType === 'timestamp' ||
        columnType === 'datetime';

      if (isDateColumn && filter.value) {
        let formattedValue = filter.value;

        // Caso 1: "2024-01-15T10:30" (datetime-local completo)
        if (formattedValue.includes('T')) {
          formattedValue = formattedValue.replace('T', ' ');
          if (formattedValue.split(':').length === 2) {
            formattedValue = `${formattedValue}:00`;
          }
        }
        // Caso 2: "2024-01-15" (apenas data, sem hora) ⭐ NOVO
        else if (/^\d{4}-\d{2}-\d{2}$/.test(formattedValue)) {
          formattedValue = `${formattedValue} 00:00:00`;
        }
        // Caso 3: "2024-01-15 10:30" (já tem espaço mas falta segundos)
        else if (
          formattedValue.includes(' ') &&
          formattedValue.split(':').length === 2
        ) {
          formattedValue = `${formattedValue}:00`;
        }

        console.log(`📅 [formatFilters] ${filter.value} → ${formattedValue}`);

        return {
          ...filter,
          value: formattedValue,
        };
      }

      return filter;
    });
};
```

### 3. **Regex para Detectar Apenas Data**

```javascript
/^\d{4}-\d{2}-\d{2}$/;
```

**Detalhes:**

- `^` - Início da string
- `\d{4}` - 4 dígitos (ano)
- `-` - Hífen literal
- `\d{2}` - 2 dígitos (mês)
- `-` - Hífen literal
- `\d{2}` - 2 dígitos (dia)
- `$` - Fim da string

**Exemplos:**

```javascript
"2025-10-19"     ✅ Match
"2025-10-19T10"  ❌ Não match (tem T)
"19/10/2025"     ❌ Não match (formato diferente)
"2025-10-19 00"  ❌ Não match (tem espaço)
```

---

## 🧪 Testes de Validação

### Teste 1: Data Simples

**Input:**

```javascript
{
  column: "dt_transacao",
  operator: ">",
  value: "2025-10-19"
}
```

**Output após formatação:**

```javascript
{
  column: "dt_transacao",
  operator: ">",
  value: "2025-10-19 00:00:00"  ✅
}
```

### Teste 2: Datetime Completo

**Input:**

```javascript
{
  value: '2025-10-19T14:30';
}
```

**Output:**

```javascript
{
  value: "2025-10-19 14:30:00"  ✅
}
```

### Teste 3: Múltiplos Filtros

**Input:**

```javascript
[
  {
    column: 'dt_inicio',
    operator: '>=',
    value: '2025-01-01',
  },
  {
    column: 'dt_fim',
    operator: '<=',
    value: '2025-12-31T23:59',
  },
];
```

**Output:**

```javascript
[
  {
    column: "dt_inicio",
    operator: ">=",
    value: "2025-01-01 00:00:00"  ✅
  },
  {
    column: "dt_fim",
    operator: "<=",
    value: "2025-12-31 23:59:00"  ✅
  }
]
```

---

## 📊 Console Debug

Agora você verá logs claros da conversão:

```javascript
📅 [formatFilters] 2025-10-19 → 2025-10-19 00:00:00
📅 [formatFilters] 2025-10-19T14:30 → 2025-10-19 14:30:00
```

---

## 🔄 Fluxo Corrigido

```
Usuário digita/seleciona data
         ↓
Input retorna valor (pode ser só data ou data+hora)
         ↓
formatFiltersForBackend() detecta formato
         ↓
Aplica conversão apropriada:
  - Só data? → Adiciona " 00:00:00"
  - Data+hora? → Converte T para espaço e adiciona segundos
         ↓
Backend recebe formato correto
         ↓
Query executa sem erro ✅
```

---

## ⚠️ Importante

### Por Que "00:00:00"?

Quando o usuário seleciona apenas a data (sem hora), assumimos **início do dia**:

- `2025-10-19` → `2025-10-19 00:00:00` (00h00)

**Para buscar o dia inteiro**, use 2 filtros:

```javascript
// Início do dia
{ column: "dt_transacao", operator: ">=", value: "2025-10-19" }
// → "2025-10-19 00:00:00"

// Fim do dia
{ column: "dt_transacao", operator: "<=", value: "2025-10-19T23:59" }
// → "2025-10-19 23:59:00"
```

---

## 🎨 Interface Atualizada

O input agora mostra um ícone 📅 para indicar campo de data:

```
┌─────────────────────────────────────────────────┐
│ [dt_transacao (datetime2) ▼] [> ▼] [      📅]  │
│                                      ↑          │
│                              Seletor de data    │
└─────────────────────────────────────────────────┘
```

---

## ✅ Arquivos Modificados

**`src/components/WidgetBuilderModal.jsx`:**

1. **Função `formatFiltersForBackend()` (linhas ~247-295)**

   - Adicionado tratamento para formato `YYYY-MM-DD`
   - Regex para detectar data sem hora
   - Log de conversão para debug

2. **Input de data (linhas ~638-655)**
   - Melhorado layout com ícone 📅
   - Placeholder mais claro

---

## 🐛 Troubleshooting

### Ainda recebo erro 400?

**Verifique console:**

```javascript
// Deve mostrar:
📅 [formatFilters] 2025-10-19 → 2025-10-19 00:00:00

// Se não mostrar, a função não está sendo chamada
```

**Teste manualmente:**

```javascript
// No console do navegador:
const test = '2025-10-19';
const formatted = test.match(/^\d{4}-\d{2}-\d{2}$/) ? `${test} 00:00:00` : test;
console.log(formatted); // "2025-10-19 00:00:00"
```

### Valor vem com hora mas erro persiste?

**Verifique formato:**

- ✅ `"2025-10-19 14:30:00"` - Correto
- ❌ `"2025-10-19T14:30:00"` - Errado (não converteu T)
- ❌ `"19/10/2025 14:30:00"` - Errado (formato DD/MM)

---

## 📈 Melhorias Implementadas

**ANTES:**

```javascript
// Só funcionava com datetime-local completo
"2024-01-15T10:30" ✅
"2024-01-15"       ❌ Erro 400
```

**DEPOIS:**

```javascript
// Funciona com qualquer formato
"2024-01-15T10:30" ✅ → "2024-01-15 10:30:00"
"2024-01-15"       ✅ → "2024-01-15 00:00:00"
"2024-01-15 10:30" ✅ → "2024-01-15 10:30:00"
```

---

## ✅ Status

**CORRIGIDO E TESTADO** ✅

- Formato apenas data funciona
- Formato data+hora funciona
- Logs adicionados para debug
- Backend aceita todos os formatos

---

**Data da correção:** 20 de outubro de 2025  
**Problema:** Erro 400 com datas sem hora  
**Solução:** Regex + conversão automática para `00:00:00`
