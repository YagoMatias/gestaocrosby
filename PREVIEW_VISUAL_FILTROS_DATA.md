# 🎨 Preview Visual: Filtros de Data no Widget Builder

## Interface Atualizada

### ANTES - Campo de Texto Simples ❌

```
┌─────────────────────────────────────────────────────────────────┐
│ Filtros (WHERE)                           + Adicionar Filtro    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────┐ ┌──────────────┐ ┌─────────────┐ ┌───┐   │
│ │ dt_cadastro  ▼ │ │ Maior (>)  ▼│ │Digite data... │ │🗑️│   │
│ └─────────────────┘ └──────────────┘ └─────────────┘ └───┘   │
│                                                                  │
│ Usuário precisa digitar manualmente: "2024-01-15 10:30:00"     │
│ ⚠️ Risco de erro de formato!                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### DEPOIS - Seletor Visual de Data ✅

```
┌─────────────────────────────────────────────────────────────────┐
│ Filtros (WHERE)                           + Adicionar Filtro    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────────────┐ ┌──────────────┐ ┌──────────────┐│
│ │ dt_cadastro (datetime2)▼│ │ Maior (>)  ▼│ │📅 15/01/2024│ │
│ └──────────────────────────┘ └──────────────┘ │   10:30     ▼││
│                                                └──────────────┘ │
│                                                           🗑️    │
│ ✅ Formato correto automático!                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Seletor de Data em Ação

### 1. Ao Clicar no Campo de Data

```
┌──────────────────────────────────────┐
│  📅 Selecione Data e Hora            │
├──────────────────────────────────────┤
│                                       │
│     Janeiro 2024        ◄    ►       │
│  ─────────────────────────────────   │
│   D   S   T   Q   Q   S   S         │
│                   1   2   3   4      │
│   5   6   7   8   9  10  11         │
│  12  13  14 [15] 16  17  18         │ ← Dia selecionado
│  19  20  21  22  23  24  25         │
│  26  27  28  29  30  31             │
│                                       │
│  ─────────────────────────────────   │
│   Hora:  [10] : [30]                 │ ← Seletor de hora
│          ▲       ▲                    │
│                                       │
│  [Cancelar]            [Confirmar]   │
└──────────────────────────────────────┘
```

---

## Comparação Lado a Lado

### Coluna de TEXTO (ex: nome, código)

```
┌─────────────────────────────────────────────┐
│ Coluna:    [cd_empresa (int)           ▼]  │
│ Operador:  [Igual (=)                  ▼]  │
│ Valor:     [Digite o código...         ]   │ ← Campo de texto
│                                      🗑️     │
└─────────────────────────────────────────────┘
```

### Coluna de DATA (ex: dt_cadastro, dt_venda)

```
┌─────────────────────────────────────────────┐
│ Coluna:    [dt_cadastro (datetime2)    ▼]  │
│ Operador:  [Maior ou Igual (≥)         ▼]  │
│ Valor:     [📅 15/01/2024 - 10:30     ▼]  │ ← Seletor visual
│                                      🗑️     │
└─────────────────────────────────────────────┘
```

---

## Múltiplos Filtros de Data

### Exemplo: Vendas entre duas datas

```
┌────────────────────────────────────────────────────────────────┐
│ Filtros (WHERE)                          + Adicionar Filtro    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📅 FILTRO 1 - Data Inicial                                     │
│ ┌──────────────────────┐ ┌──────────────┐ ┌──────────────┐   │
│ │dt_venda (datetime2)▼│ │Maior/Igual▼│ │📅 01/01/2024 │   │
│ └──────────────────────┘ └──────────────┘ │   00:00     ▼│   │
│                                           └──────────────┘ 🗑️│
│                                                                 │
│ 📅 FILTRO 2 - Data Final                                       │
│ ┌──────────────────────┐ ┌──────────────┐ ┌──────────────┐   │
│ │dt_venda (datetime2)▼│ │Menor/Igual ▼│ │📅 31/01/2024 │   │
│ └──────────────────────┘ └──────────────┘ │   23:59     ▼│   │
│                                           └──────────────┘ 🗑️│
│                                                                 │
│ ✅ Resultado: Vendas de janeiro de 2024                       │
└────────────────────────────────────────────────────────────────┘
```

---

## Indicadores Visuais

### Tipo da Coluna no Dropdown

```
ANTES:
┌──────────────────┐
│ cd_empresa    ▼ │  ← Sem informação do tipo
│ dt_cadastro   ▼ │
│ nm_cliente    ▼ │
└──────────────────┘

DEPOIS:
┌─────────────────────────────┐
│ cd_empresa (int)         ▼ │  ← Tipo visível
│ dt_cadastro (datetime2)  ▼ │  ← Identifica data!
│ nm_cliente (varchar)     ▼ │
└─────────────────────────────┘
```

---

## Preview com Filtros de Data

### Antes de Executar Preview

```
┌──────────────────────────────────────────────┐
│ Preview dos Dados      [🔄 Atualizar Preview]│
├──────────────────────────────────────────────┤
│                                               │
│         Clique em "Atualizar Preview"        │
│         para ver os dados filtrados          │
│                                               │
└──────────────────────────────────────────────┘
```

### Após Executar Preview

```
┌──────────────────────────────────────────────────────────────┐
│ Preview dos Dados                   [🔄 Atualizar Preview]   │
├──────────────────────────────────────────────────────────────┤
│ produto         │ valor      │ dt_venda            │ cliente│
├─────────────────┼────────────┼────────────────────┼────────┤
│ Notebook Pro    │ R$ 3.500,00│ 2024-01-15 10:30:00│ João   │
│ Mouse Gamer     │ R$ 150,00  │ 2024-01-16 14:22:00│ Maria  │
│ Teclado Mecânico│ R$ 450,00  │ 2024-01-18 09:15:00│ Pedro  │
├─────────────────┴────────────┴────────────────────┴────────┤
│ Mostrando 3 registros (preview limitado)                    │
│ ✅ Filtro aplicado: dt_venda >= 2024-01-15 00:00:00        │
└──────────────────────────────────────────────────────────────┘
```

---

## Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRIAR WIDGET - STEP 2                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1️⃣ Adicionar Filtro                                            │
│     ↓                                                            │
│  2️⃣ Selecionar coluna datetime                                 │
│     ↓                                                            │
│  3️⃣ Sistema detecta tipo automaticamente                        │
│     ↓                                                            │
│  4️⃣ Mostra seletor visual de data 📅                           │
│     ↓                                                            │
│  5️⃣ Usuário escolhe data e hora                                │
│     ↓                                                            │
│  6️⃣ Formato convertido automaticamente                          │
│     "2024-01-15T10:30" → "2024-01-15 10:30:00"                 │
│     ↓                                                            │
│  7️⃣ Preview ou Salvar                                           │
│     ↓                                                            │
│  8️⃣ Backend recebe formato correto ✅                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mensagens de Feedback

### Console do Navegador (para debug)

```javascript
🔍 [WidgetBuilder] Carregando colunas para tabela: VENDAS
✅ [WidgetBuilder] Colunas carregadas: 8 colunas

📅 [WidgetBuilder] Filtros formatados: [
  {
    column: "dt_venda",
    operator: ">=",
    value: "2024-01-15 10:30:00"  ← Formato correto!
  }
]

🌐 [WidgetBuilder] Chamando previewQuery...
⏱️ [WidgetBuilder] previewQuery levou 234ms
✅ [WidgetBuilder] Preview data recebido: 3 registros
```

---

## Casos de Uso Visuais

### Caso 1: Vendas de Hoje

```
┌───────────────────────────────────────┐
│ dt_venda (datetime2) ▼               │
│ Maior ou Igual (≥)   ▼               │
│ 📅 20/10/2024 - 00:00 ▼              │
└───────────────────────────────────────┘

Resultado: Todas vendas a partir da meia-noite de hoje
```

### Caso 2: Cadastros Antigos

```
┌───────────────────────────────────────┐
│ dt_cadastro (datetime2) ▼            │
│ Menor (<)            ▼               │
│ 📅 01/01/2023 - 00:00 ▼              │
└───────────────────────────────────────┘

Resultado: Cadastros antes de 2023
```

### Caso 3: Período Específico

```
📅 FILTRO 1:
┌───────────────────────────────────────┐
│ dt_movimento (datetime2) ▼           │
│ Maior ou Igual (≥)   ▼               │
│ 📅 01/06/2024 - 00:00 ▼              │
└───────────────────────────────────────┘

📅 FILTRO 2:
┌───────────────────────────────────────┐
│ dt_movimento (datetime2) ▼           │
│ Menor ou Igual (≤)   ▼               │
│ 📅 30/06/2024 - 23:59 ▼              │
└───────────────────────────────────────┘

Resultado: Movimentos de junho de 2024
```

---

## Estados Visuais

### ✅ Estado Normal

```
┌──────────────────────────────────────┐
│ 📅 15/01/2024 - 10:30        ▼      │
└──────────────────────────────────────┘
```

### 🎯 Estado Focado (clicado)

```
┌──────────────────────────────────────┐
│ 📅 15/01/2024 - 10:30        ▼      │ ← Borda azul
└──────────────────────────────────────┘
    ↓
┌────────────────────────────┐
│   [Calendário abre aqui]   │
└────────────────────────────┘
```

### ⚠️ Estado Vazio

```
┌──────────────────────────────────────┐
│                              ▼      │ ← Campo vazio
└──────────────────────────────────────┘
```

### ✅ Estado Preenchido

```
┌──────────────────────────────────────┐
│ 📅 15/01/2024 - 10:30        ▼      │
└──────────────────────────────────────┘
      ↓
      Valor enviado: "2024-01-15 10:30:00"
```

---

## 🎉 Resultado Final

**Interface intuitiva, visual, sem erros de formato!** 🚀

**Criado em:** 20 de outubro de 2025
