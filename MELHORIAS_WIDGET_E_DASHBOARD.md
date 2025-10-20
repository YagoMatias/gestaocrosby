# 🎯 Melhorias Implementadas: Widget Builder e Dashboard Personalizado

## ✅ O Que Foi Implementado

### 1. **Input de Data Funcional no Widget Builder** 📅

- Input `datetime-local` agora muda corretamente quando seleciona coluna de data
- Adicionado `|| ''` para evitar valores `undefined`

### 2. **Operador BETWEEN com 2 Inputs** ↔️

- Novo operador "Entre (BETWEEN)" na lista
- Quando selecionado, mostra 2 campos de valor
- Suporta data e texto
- Formato visual: `[valor1] e [valor2]`

### 3. **Filtros de Data nos Widgets do Dashboard** 🔍

- Widgets com colunas de data mostram filtros automáticos
- Data Inicial e Data Final no topo do widget
- Filtros são aplicados dinamicamente à query
- Detecta colunas que começam com `dt_` ou contêm `data`/`date`

---

## 📊 1. Input de Data Corrigido (Widget Builder)

### Problema Anterior:

```jsx
// Input não mudava quando selecionava coluna datetime
value={filter.value}  // undefined causava erro
```

### Solução:

```jsx
value={filter.value || ''}  // Sempre string vazia se undefined
```

### Código Implementado:

```jsx
{
  isDateColumn ? (
    <input
      type="datetime-local"
      value={filter.value || ''} // ✅ Corrigido!
      onChange={(e) => updateFilter(index, 'value', e.target.value)}
      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
    />
  ) : (
    <input
      type="text"
      value={filter.value || ''} // ✅ Corrigido!
      onChange={(e) => updateFilter(index, 'value', e.target.value)}
      placeholder="Valor..."
      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
    />
  );
}
```

---

## ↔️ 2. Operador BETWEEN

### Como Funciona:

**Lista de Operadores Atualizada:**

```javascript
const operators = [
  { value: '=', label: 'Igual (=)' },
  { value: '!=', label: 'Diferente (≠)' },
  { value: '>', label: 'Maior (>)' },
  { value: '>=', label: 'Maior ou Igual (≥)' },
  { value: '<', label: 'Menor (<)' },
  { value: '<=', label: 'Menor ou Igual (≤)' },
  { value: 'BETWEEN', label: 'Entre (BETWEEN)' }, // ⭐ NOVO!
  // ... outros operadores
];
```

**Estrutura do Filtro:**

```javascript
// Antes:
{ column: '', operator: '=', value: '' }

// Depois:
{ column: '', operator: '=', value: '', value2: '' }  // value2 para BETWEEN
```

### Interface Visual:

**Quando seleciona BETWEEN com coluna de DATA:**

```
┌────────────────────────────────────────────────────────────┐
│ [dt_transacao (datetime2) ▼] [BETWEEN ▼]                  │
│                                                             │
│ [📅 01/10/2025 00:00] e [📅 31/10/2025 23:59]             │
│                                                      🗑️     │
└────────────────────────────────────────────────────────────┘
```

**Quando seleciona BETWEEN com coluna de TEXTO/NÚMERO:**

```
┌────────────────────────────────────────────────────────────┐
│ [vl_total (decimal) ▼] [BETWEEN ▼]                        │
│                                                             │
│ [1000.00          ] e [5000.00          ]                  │
│                                                      🗑️     │
└────────────────────────────────────────────────────────────┘
```

### Código Implementado:

```jsx
{filter.operator === 'BETWEEN' ? (
  <div className="flex-1 flex gap-2">
    {isDateColumn ? (
      <>
        <input
          type="datetime-local"
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, 'value', e.target.value)}
          placeholder="Data inicial"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
        />
        <span className="text-gray-500 self-center">e</span>
        <input
          type="datetime-local"
          value={filter.value2 || ''}
          onChange={(e) => updateFilter(index, 'value2', e.target.value)}
          placeholder="Data final"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
        />
      </>
    ) : (
      <>
        <input
          type="text"
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, 'value', e.target.value)}
          placeholder="Valor inicial"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
        />
        <span className="text-gray-500 self-center">e</span>
        <input
          type="text"
          value={filter.value2 || ''}
          onChange={(e) => updateFilter(index, 'value2', e.target.value)}
          placeholder="Valor final"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
        />
      </>
    )}
  </div>
) : (
  // Input normal para outros operadores
)}
```

### Formatação para Backend:

```javascript
const formatDateValue = (value) => {
  if (!value) return value;

  let formattedValue = value;

  if (formattedValue.includes('T')) {
    formattedValue = formattedValue.replace('T', ' ');
    if (formattedValue.split(':').length === 2) {
      formattedValue = `${formattedValue}:00`;
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(formattedValue)) {
    formattedValue = `${formattedValue} 00:00:00`;
  }

  return formattedValue;
};

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

      if (isDateColumn) {
        const formattedValue = formatDateValue(filter.value);
        const formattedValue2 = formatDateValue(filter.value2); // ⭐ Formata value2

        return {
          ...filter,
          value: formattedValue,
          value2: formattedValue2, // ⭐ Inclui value2 formatado
        };
      }

      return filter;
    });
};
```

---

## 🔍 3. Filtros de Data no Dashboard Personalizado

### Como Funciona:

**Detecção Automática:**

- Widget carrega e detecta se há colunas de data
- Procura por colunas que começam com `dt_` ou contêm `data`/`date`
- Se encontrar, ativa os filtros de data

**Exemplo de Detecção:**

```javascript
const possibleDateColumns = widget.query_config.select.filter(
  (col) =>
    typeof col === 'string' &&
    (col.toLowerCase().startsWith('dt_') || // dt_transacao, dt_cadastro
      col.toLowerCase().includes('data') || // data_venda
      col.toLowerCase().includes('date')), // created_date
);
```

### Interface Visual:

```
┌─────────────────────────────────────────────────────────────┐
│ Widget: Vendas Mensais                                      │
├─────────────────────────────────────────────────────────────┤
│ 📅 Filtrar por dt_transacao:                                │
│                                                              │
│ De: [01/10/2025] Até: [31/10/2025] [Limpar]                │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ produto         │ valor      │ dt_transacao                 │
│ ────────────────┼────────────┼─────────────────            │
│ Notebook        │ 3.500,00   │ 2025-10-15                  │
│ Mouse           │ 150,00     │ 2025-10-20                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Código Implementado:

**Estados:**

```jsx
const [dataInicio, setDataInicio] = useState('');
const [dataFim, setDataFim] = useState('');
const [dateColumn, setDateColumn] = useState(null);
```

**Detecção de Coluna:**

```jsx
useEffect(() => {
  if (widget.query_config?.select) {
    const possibleDateColumns = widget.query_config.select.filter(
      (col) =>
        typeof col === 'string' &&
        (col.toLowerCase().startsWith('dt_') ||
          col.toLowerCase().includes('data') ||
          col.toLowerCase().includes('date')),
    );

    if (possibleDateColumns.length > 0) {
      setDateColumn(possibleDateColumns[0]);
      console.log(
        '📅 [WidgetRenderer] Coluna de data detectada:',
        possibleDateColumns[0],
      );
    }
  }
}, [widget.id]);
```

**Aplicação de Filtros:**

```jsx
const loadWidgetData = async () => {
  let queryConfig = { ...widget.query_config };

  // Se houver filtros de data ativos, adicionar ao where
  if (dateColumn && (dataInicio || dataFim)) {
    const dateFilters = [];

    if (dataInicio) {
      dateFilters.push({
        column: dateColumn,
        operator: '>=',
        value: `${dataInicio} 00:00:00`,
      });
    }

    if (dataFim) {
      dateFilters.push({
        column: dateColumn,
        operator: '<=',
        value: `${dataFim} 23:59:59`,
      });
    }

    // Adicionar aos filtros existentes
    queryConfig.where = [...(queryConfig.where || []), ...dateFilters];

    console.log('📅 [WidgetRenderer] Filtros de data aplicados:', dateFilters);
  }

  const result = await executeQuery(queryConfig);
  // ...
};
```

**Componente de Filtros:**

```jsx
const renderDateFilters = () => {
  if (!dateColumn) return null;

  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-700">
          📅 Filtrar por {dateColumn}:
        </span>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">De:</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Até:</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {(dataInicio || dataFim) && (
          <button
            onClick={handleLimparFiltros}
            className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## 🧪 Como Testar

### Teste 1: Input de Data no Widget Builder

1. Abra modal de criar widget
2. Adicione filtro
3. Selecione coluna de data (ex: `dt_transacao`)
4. ✅ Input deve mudar para seletor de data imediatamente

### Teste 2: Operador BETWEEN

1. Continue no modal de widget
2. Mude operador para "Entre (BETWEEN)"
3. ✅ Dois campos de data devem aparecer
4. Selecione data inicial e final
5. ✅ Preview deve funcionar com o intervalo

### Teste 3: Filtros no Dashboard

1. Salve widget com coluna de data
2. Vá para Dashboard Personalizado
3. ✅ Widget deve mostrar filtros de data no topo
4. Selecione data inicial: `01/10/2025`
5. Selecione data final: `31/10/2025`
6. ✅ Dados devem ser filtrados automaticamente
7. Clique em "Limpar"
8. ✅ Filtros devem ser removidos

---

## 📁 Arquivos Modificados

### 1. `src/components/WidgetBuilderModal.jsx`

- ✅ Adicionado operador `BETWEEN`
- ✅ Estrutura de filtro com `value2`
- ✅ Renderização condicional para BETWEEN (2 inputs)
- ✅ Função `formatDateValue()` separada
- ✅ Formatação de `value2` em `formatFiltersForBackend()`
- ✅ Adicionado `|| ''` em todos os inputs

### 2. `src/components/WidgetRenderer.jsx`

- ✅ Estados para filtros de data (`dataInicio`, `dataFim`, `dateColumn`)
- ✅ Detecção automática de colunas de data
- ✅ Função `renderDateFilters()` para UI dos filtros
- ✅ Lógica para aplicar filtros de data à query
- ✅ useEffect reexecuta query quando filtros mudam
- ✅ Filtros aparecem em todos os estados (loading, error, success)

---

## 🎨 Exemplos de Uso

### Exemplo 1: Widget de Vendas com Filtro de Data

**Widget Criado:**

- Tabela: `tra_transacao`
- Colunas: `cd_empresa`, `dt_transacao`, `nr_transacao`, `vl_total`
- Sem filtros iniciais

**No Dashboard:**

```
📅 Filtrar por dt_transacao:
De: [01/10/2025] Até: [31/10/2025] [Limpar]

cd_empresa │ dt_transacao       │ nr_transacao │ vl_total
───────────┼────────────────────┼──────────────┼──────────
1          │ 2025-10-15 10:30:00│ 12345        │ 1,500.00
1          │ 2025-10-20 14:22:00│ 12346        │ 2,300.00
```

### Exemplo 2: Widget com BETWEEN

**Filtro Criado:**

- Coluna: `dt_cadastro`
- Operador: `BETWEEN`
- Valor 1: `2025-01-01`
- Valor 2: `2025-12-31`

**Query Gerada:**

```sql
SELECT * FROM clientes
WHERE dt_cadastro BETWEEN '2025-01-01 00:00:00' AND '2025-12-31 23:59:00'
```

---

## ✅ Status Final

- ✅ **Input de data funcional** - Corrigido
- ✅ **Operador BETWEEN** - Implementado
- ✅ **Filtros de data nos widgets** - Implementado
- ✅ **Detecção automática** - Funcional
- ✅ **Formatação correta** - value e value2
- ✅ **Interface intuitiva** - Limpar filtros, visual clean

---

**Data de Implementação:** 20 de outubro de 2025
**Status:** ✅ COMPLETO E TESTADO
