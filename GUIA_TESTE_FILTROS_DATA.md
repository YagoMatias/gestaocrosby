# 🧪 Guia de Teste: Filtros de Data no Widget Builder

## ✅ Objetivo do Teste

Validar que colunas do tipo datetime exibem seletor visual de data e o formato é enviado corretamente ao backend.

---

## 📋 Pré-requisitos

- ✅ Frontend rodando (`npm run dev`)
- ✅ Backend online (Render API)
- ✅ Usuário com permissão admin ou ownier
- ✅ Pelo menos 1 dashboard criado

---

## 🧪 Teste 1: Seletor de Data Aparece

### Passos:

1. Acesse **Gerenciar Dashboards**
2. Selecione um dashboard existente ou crie novo
3. Clique em **+ Adicionar Widget**
4. **Step 1:** Selecione tabela que tenha coluna de data
   - Exemplo: `VENDAS`, `CLIENTES`, `GER_EMPRESA`
5. Selecione algumas colunas (incluindo uma de data)
6. Clique em **Próximo →**
7. **Step 2:** Clique em **+ Adicionar Filtro**
8. No dropdown "Coluna", selecione uma coluna de data
   - Ex: `dt_cadastro (datetime2)`

### ✅ Resultado Esperado:

```
Campo "Valor" deve mostrar:
┌─────────────────────────────┐
│ 📅 dd/mm/yyyy - hh:mm   ▼  │  ← Seletor de data
└─────────────────────────────┘

NÃO deve mostrar:
┌─────────────────────────────┐
│ Digite valor...             │  ← Campo de texto
└─────────────────────────────┘
```

### ❌ Se Falhar:

- Verifique console: `[WidgetBuilder] Columns disponíveis`
- Confirme que coluna tem `data_type` contendo "date" ou "time"
- Verifique se não há erro no console

---

## 🧪 Teste 2: Seletor Funciona

### Passos:

1. Continue do Teste 1
2. Clique no campo de data
3. Calendário visual deve abrir
4. Selecione uma data (ex: 15/01/2024)
5. Selecione uma hora (ex: 10:30)
6. Confirme

### ✅ Resultado Esperado:

```
Campo deve mostrar:
📅 15/01/2024 - 10:30
```

### ❌ Se Falhar:

- Navegador não suporta `datetime-local` (use Chrome/Edge atualizado)
- Campo fica vazio → Tente digitar manualmente: `2024-01-15T10:30`

---

## 🧪 Teste 3: Preview com Filtro de Data

### Passos:

1. Continue do Teste 2
2. Configure filtro completo:
   - Coluna: `dt_cadastro (datetime2)`
   - Operador: `Maior ou Igual (≥)`
   - Valor: `📅 01/01/2024 - 00:00`
3. Clique em **Próximo →** (Step 3)
4. Clique em **🔄 Atualizar Preview**

### ✅ Resultado Esperado:

```
Console deve mostrar:
📅 [WidgetBuilder] Filtros formatados: [
  {
    column: "dt_cadastro",
    operator: ">=",
    value: "2024-01-01 00:00:00"  ← Formato correto!
  }
]

Tabela de preview deve carregar com dados filtrados
```

### ❌ Se Falhar:

**Erro 500:**

- Verifique formato no console
- Deve ser `YYYY-MM-DD HH:MM:SS`
- Se estiver `YYYY-MM-DDTHH:MM` → Função de formatação não foi aplicada

**Sem dados:**

- Query pode não ter registros nessa data
- Tente data mais antiga ou mude operador para `<` (menor)

---

## 🧪 Teste 4: Salvar Widget com Filtro de Data

### Passos:

1. Continue do Teste 3
2. Digite nome do widget: "Teste Filtro Data"
3. Escolha tipo: Tabela
4. Clique em **✓ Salvar Widget**

### ✅ Resultado Esperado:

```
✅ "Widget criado com sucesso!"
Modal fecha
Widget aparece na lista
```

### ❌ Se Falhar:

**Erro ao salvar:**

```javascript
// Verifique console:
💾 [WidgetBuilder] Salvando widget com dados: {...}
📅 [WidgetBuilder] Filtros formatados: [...]
```

- Se `value` estiver com `T`: formatação falhou
- Se backend retornou erro: verifique logs do Render

---

## 🧪 Teste 5: Widget Renderiza Dados Corretamente

### Passos:

1. Vá para **Dashboard Personalizado**
2. Selecione o dashboard onde salvou o widget
3. Widget deve carregar e exibir dados

### ✅ Resultado Esperado:

```
┌─────────────────────────────────────┐
│ Teste Filtro Data                   │
├─────────────────────────────────────┤
│ cd_empresa │ dt_cadastro │ ...     │
├────────────┼─────────────┼─────────┤
│ 1          │ 2024-01-15  │ ...     │
│ 2          │ 2024-02-20  │ ...     │
└─────────────────────────────────────┘
```

### ❌ Se Falhar:

**Widget mostra erro:**

- Query pode estar inválida
- Verifique `query_config` no Supabase
- Teste query manualmente no banco

---

## 🧪 Teste 6: Múltiplos Filtros de Data

### Passos:

1. Crie novo widget
2. Adicione **2 filtros de data**:
   - **Filtro 1:** `dt_cadastro >= 01/01/2024 00:00`
   - **Filtro 2:** `dt_cadastro <= 31/12/2024 23:59`
3. Preview e Salve

### ✅ Resultado Esperado:

```
📅 Filtros formatados: [
  {
    column: "dt_cadastro",
    operator: ">=",
    value: "2024-01-01 00:00:00"
  },
  {
    column: "dt_cadastro",
    operator: "<=",
    value: "2024-12-31 23:59:00"
  }
]

Dados entre as duas datas
```

---

## 🧪 Teste 7: Coluna Não-Data (Campo de Texto)

### Passos:

1. Adicione filtro
2. Selecione coluna **não-data** (ex: `cd_empresa (int)`)
3. Verifique campo de valor

### ✅ Resultado Esperado:

```
Campo deve mostrar INPUT DE TEXTO:
┌─────────────────────────────┐
│ Digite valor...             │  ← Campo de texto
└─────────────────────────────┘

NÃO deve mostrar seletor de data
```

---

## 🧪 Teste 8: Diferentes Tipos de Data

### Passos:

Teste com diferentes tipos de colunas:

- ✅ `datetime`
- ✅ `datetime2`
- ✅ `date`
- ✅ `timestamp`
- ✅ `smalldatetime`

Todas devem mostrar seletor de data.

---

## 📊 Checklist de Validação

Use este checklist durante os testes:

```
[ ] Seletor de data aparece para colunas datetime
[ ] Calendário visual abre ao clicar
[ ] Data selecionada é preenchida no campo
[ ] Preview executa com filtro de data
[ ] Console mostra formato correto (YYYY-MM-DD HH:MM:SS)
[ ] Widget salva com sucesso
[ ] Widget carrega dados filtrados
[ ] Múltiplos filtros de data funcionam
[ ] Colunas não-data mostram campo de texto
[ ] Tipo da coluna aparece no dropdown (ex: "datetime2")
```

---

## 🐛 Troubleshooting

### Problema: Seletor não aparece

**Debug:**

```javascript
// Cole no console do navegador:
console.log('Columns:', columns);
console.log(
  'Selected column:',
  columns.find((c) => c.name === 'dt_cadastro'),
);
```

**Verifique:**

- `data_type` da coluna contém "date" ou "time"?
- Coluna aparece no dropdown?

---

### Problema: Formato incorreto no backend

**Debug:**

```javascript
// Verifique no console antes de salvar:
console.log('📅 Filtros formatados:', queryConfig.where);
```

**Formato esperado:**

```javascript
{
  column: "dt_cadastro",
  operator: ">=",
  value: "2024-01-15 10:30:00"  ← Com espaço, com segundos
}
```

**Formato ERRADO:**

```javascript
{
  value: "2024-01-15T10:30"  ← Com T, sem segundos ❌
}
```

---

### Problema: Preview não retorna dados

**Causas possíveis:**

1. Data muito recente (sem dados nesse período)
2. Formato incorreto (erro 500)
3. Coluna não existe na tabela

**Teste manual no banco:**

```sql
SELECT TOP 10 *
FROM sua_tabela
WHERE dt_cadastro >= '2024-01-01 00:00:00'
ORDER BY dt_cadastro DESC
```

---

## 📸 Capturas de Tela Esperadas

### 1. Dropdown com Tipo da Coluna

```
┌─────────────────────────────────┐
│ cd_empresa (int)             ▼ │
│ dt_cadastro (datetime2)      ▼ │  ← Mostra tipo!
│ nm_cliente (varchar)         ▼ │
└─────────────────────────────────┘
```

### 2. Seletor de Data Ativo

```
┌──────────────────────────────────┐
│ 📅 15/01/2024 - 10:30        ▼  │
└──────────────────────────────────┘
```

### 3. Preview com Dados

```
┌──────────────────────────────────────────┐
│ produto         │ dt_venda            │  │
├─────────────────┼────────────────────┤  │
│ Notebook        │ 2024-01-15 10:30:00│  │
│ Mouse           │ 2024-01-16 14:20:00│  │
└──────────────────────────────────────────┘
```

---

## ✅ Critérios de Aprovação

O teste está **APROVADO** se:

✅ Seletor de data aparece automaticamente para colunas datetime  
✅ Calendário visual funciona  
✅ Preview carrega dados filtrados  
✅ Widget salva sem erros  
✅ Formato enviado é `YYYY-MM-DD HH:MM:SS`  
✅ Backend aceita o formato (sem erro 500)  
✅ Widget renderiza dados corretamente no dashboard  
✅ Colunas não-data mostram campo de texto normal

---

## 📝 Relatório de Teste

Preencha após completar os testes:

```
DATA DO TESTE: ___/___/____
TESTADO POR: _______________

RESULTADOS:
[ ] Teste 1: Seletor Aparece         - PASSOU / FALHOU
[ ] Teste 2: Seletor Funciona        - PASSOU / FALHOU
[ ] Teste 3: Preview                 - PASSOU / FALHOU
[ ] Teste 4: Salvar Widget           - PASSOU / FALHOU
[ ] Teste 5: Renderizar Dados        - PASSOU / FALHOU
[ ] Teste 6: Múltiplos Filtros       - PASSOU / FALHOU
[ ] Teste 7: Campo de Texto          - PASSOU / FALHOU
[ ] Teste 8: Diferentes Tipos        - PASSOU / FALHOU

NOTAS:
_________________________________
_________________________________
_________________________________

STATUS GERAL: ✅ APROVADO / ❌ REPROVADO
```

---

**Criado em:** 20 de outubro de 2025
**Autor:** GitHub Copilot
