# 📅 Guia: Filtros de Data no Widget Builder

## ✅ Funcionalidade Implementada

Agora quando você adicionar filtros em widgets, colunas do tipo **data/datetime** exibem automaticamente um **seletor de data** ao invés de um campo de texto comum.

---

## 🎯 Como Funciona

### 1. **Detecção Automática de Tipo**

Quando você seleciona uma coluna no filtro, o sistema verifica o tipo da coluna (`data_type`):

```javascript
const columnType = selectedColumn?.data_type?.toLowerCase() || '';

const isDateColumn =
  columnType.includes('date') ||
  columnType.includes('time') ||
  columnType === 'timestamp' ||
  columnType === 'datetime';
```

**Tipos suportados:**

- `date`
- `datetime`
- `datetime2`
- `smalldatetime`
- `timestamp`
- Qualquer tipo que contenha "date" ou "time"

---

### 2. **Input Dinâmico**

**Para colunas de DATA:**

```jsx
<input type="datetime-local" />
```

- Mostra calendário visual
- Seletor de hora integrado
- Formato: `2024-01-15T10:30`

**Para outras colunas:**

```jsx
<input type="text" placeholder="Valor..." />
```

- Campo de texto normal
- Para números, strings, etc.

---

### 3. **Formatação Automática**

O valor selecionado no calendário é automaticamente formatado para o formato aceito pelo SQL Server:

**Input do usuário (datetime-local):**

```
2024-01-15T10:30
```

**Enviado para o backend:**

```
2024-01-15 10:30:00
```

**Código de conversão:**

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
        // "2024-01-15T10:30" → "2024-01-15 10:30:00"
        const dateValue = filter.value.replace('T', ' ');
        const formattedValue =
          dateValue.includes(':') && dateValue.split(':').length === 2
            ? `${dateValue}:00`
            : dateValue;

        return {
          ...filter,
          value: formattedValue,
        };
      }

      return filter;
    });
};
```

---

## 🎨 Experiência do Usuário

### Passo 1: Adicionar Filtro

1. Vá para **Step 2: Filtros**
2. Clique em **+ Adicionar Filtro**

### Passo 2: Selecionar Coluna de Data

```
┌─────────────────────────────────────────────┐
│ Coluna:  [dt_cadastro (datetime2)    ▼]    │
│ Operador: [Maior (>)                 ▼]    │
│ Valor:    [📅 15/01/2024 - 10:30    ▼]    │
│                                      🗑️     │
└─────────────────────────────────────────────┘
```

### Passo 3: Seletor de Data Aparece

Ao clicar no campo de valor, um **calendário visual** é exibido:

```
┌─────────────────────────┐
│   Janeiro 2024    < >   │
├─────────────────────────┤
│ D  S  T  Q  Q  S  S    │
│    1  2  3  4  5  6    │
│ 7  8  9 10 11 12 13    │
│14 [15]16 17 18 19 20    │  ← Dia selecionado
│21 22 23 24 25 26 27    │
│28 29 30 31             │
├─────────────────────────┤
│ Hora: 10:30            │  ← Seletor de hora
└─────────────────────────┘
```

### Passo 4: Preview ou Salvar

- O valor é automaticamente formatado
- Backend recebe no formato correto
- Query é executada sem erros

---

## 📊 Exemplos de Uso

### Exemplo 1: Vendas do Último Mês

```javascript
{
  column: "dt_venda",
  operator: ">=",
  value: "2024-01-01 00:00:00"  // Formatado automaticamente
}
```

### Exemplo 2: Cadastros Entre Datas

```javascript
// Filtro 1
{
  column: "dt_cadastro",
  operator: ">=",
  value: "2024-01-01 00:00:00"
}

// Filtro 2
{
  column: "dt_cadastro",
  operator: "<=",
  value: "2024-01-31 23:59:59"
}
```

### Exemplo 3: Movimentos Antes de Data Específica

```javascript
{
  column: "dt_movimento",
  operator: "<",
  value: "2024-06-15 00:00:00"
}
```

---

## 🔧 Operadores Recomendados para Datas

| Operador | Descrição         | Exemplo de Uso                        |
| -------- | ----------------- | ------------------------------------- |
| `=`      | Igual (dia exato) | Transações do dia 15/01               |
| `!=`     | Diferente         | Excluir data específica               |
| `>`      | Depois de         | Após 01/01/2024                       |
| `>=`     | A partir de       | A partir de 01/01/2024 (inclui o dia) |
| `<`      | Antes de          | Antes de 31/12/2023                   |
| `<=`     | Até               | Até 31/12/2023 (inclui o dia)         |

---

## 🐛 Troubleshooting

### Problema: Seletor de data não aparece

**Causa:** Coluna não é reconhecida como data

**Solução:**

1. Verifique o tipo da coluna no banco
2. Certifique-se que `data_type` contém "date" ou "time"
3. Veja no dropdown a coluna mostra o tipo: `nome_coluna (datetime2)`

---

### Problema: Erro "Invalid date format"

**Causa:** Backend não aceita o formato enviado

**Solução:**

- A formatação é automática
- Se persistir, verifique logs do console:

```javascript
console.log('📅 [WidgetBuilder] Filtros formatados:', queryConfig.where);
```

---

### Problema: Query não retorna resultados

**Causa:** Formato de hora pode estar incorreto

**Dica:**

- Para buscar DIA INTEIRO, use:

  - **Início:** `2024-01-15 00:00:00`
  - **Fim:** `2024-01-15 23:59:59`

- Para buscar MÊS INTEIRO:
  - **>=** `2024-01-01 00:00:00`
  - **<** `2024-02-01 00:00:00` (primeiro dia do mês seguinte)

---

## 🎯 Melhorias Implementadas

### Antes ❌

```jsx
// Usuário tinha que digitar manualmente
<input type="text" placeholder="Valor..." />

// Formato incorreto causava erros
"15/01/2024"        ❌
"2024-01-15"        ❌
"15-01-2024 10:30"  ❌
```

### Depois ✅

```jsx
// Seletor visual de data
<input type="datetime-local" />

// Formato sempre correto
"2024-01-15 10:30:00"  ✅
```

---

## 📝 Detalhes Técnicos

### Arquivos Modificados

**`src/components/WidgetBuilderModal.jsx`:**

1. **Renderização Condicional (linhas ~533-600):**

```jsx
{
  isDateColumn ? <input type="datetime-local" /> : <input type="text" />;
}
```

2. **Função de Formatação (linhas ~244-277):**

```javascript
const formatFiltersForBackend = (filters) => {
  // Converte "2024-01-15T10:30" → "2024-01-15 10:30:00"
};
```

3. **Uso em Preview (linha ~207):**

```javascript
where: formatFiltersForBackend(filters);
```

4. **Uso em Save (linha ~296):**

```javascript
where: formatFiltersForBackend(filters);
```

---

## ✅ Checklist de Validação

- [x] Colunas datetime exibem seletor de data
- [x] Colunas não-datetime exibem input de texto
- [x] Formato de data é convertido automaticamente
- [x] Preview funciona com filtros de data
- [x] Salvar widget funciona com filtros de data
- [x] Backend aceita o formato enviado
- [x] Tipo da coluna é exibido no dropdown
- [x] Múltiplos filtros de data podem ser adicionados

---

## 🎉 Resultado Final

**Antes:** Usuário digitava datas manualmente, erros de formato eram comuns

**Depois:** Seletor visual de data, formato sempre correto, zero erros! 🎯

---

**Criado em:** 20 de outubro de 2025
**Autor:** GitHub Copilot + NotCrosby02
