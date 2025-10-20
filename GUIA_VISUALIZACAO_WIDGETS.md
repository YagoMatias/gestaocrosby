# 📊 Guia: Implementação da Visualização de Widgets

## ✅ Problema Solucionado

**Situação anterior:**

- Widgets eram criados e salvos com sucesso
- Usuários eram atribuídos corretamente
- Porém, na página de Dashboard Personalizado, widgets mostravam apenas placeholder "Visualização será implementada em breve"

**Solução implementada:**

- Criado componente `WidgetRenderer` que executa as queries e renderiza os dados
- Atualizado `DashboardPersonalizado.jsx` para usar o novo componente
- Implementado visualizações para todos os tipos de widget

---

## 🎯 Arquivos Criados/Modificados

### 1. **Novo Componente: `src/components/WidgetRenderer.jsx`**

Componente principal que renderiza widgets com dados reais:

**Funcionalidades:**

- ✅ Executa query do widget automaticamente ao montar
- ✅ Gerencia estados de loading, erro e dados
- ✅ Renderiza 4 tipos de widgets:
  - **Tabela** → TableWidget
  - **Gráfico de Barras** → BarChartWidget
  - **Gráfico de Pizza** → PieChartWidget
  - **Métrica** → MetricWidget

**Sub-componentes:**

#### `TableWidget`

- Renderiza dados em formato de tabela
- Headers fixos no topo (sticky)
- Scroll para muitos registros
- Mostra contagem total de registros

#### `BarChartWidget`

- Gráfico de barras horizontal
- Usa primeira coluna como label, segunda como valor
- Cores configuráveis via `display_config`
- Limita a 10 registros para melhor visualização
- Barra de progresso visual com percentual

#### `PieChartWidget`

- Gráfico de pizza (representação simplificada)
- Mostra legenda com cores e percentuais
- Calcula total automaticamente
- Limita a 8 itens para clareza
- Display central com valor total

#### `MetricWidget`

- Exibe valor único grande e centralizado
- Ideal para KPIs (total vendas, quantidade, etc.)
- Formatação numérica automática

---

### 2. **Atualizado: `src/pages/DashboardPersonalizado.jsx`**

**Mudanças:**

```jsx
// ANTES - Placeholder estático
<div className="text-center">
  <div className="text-4xl mb-2">📊</div>
  <p>Visualização será implementada em breve</p>
</div>

// DEPOIS - Renderização dinâmica com dados
<WidgetRenderer widget={widget} />
```

**Import adicionado:**

```jsx
import WidgetRenderer from '../components/WidgetRenderer';
```

---

### 3. **Melhorado: `src/lib/queryBuilderApi.js`**

**Função `executeQuery` atualizada:**

- ✅ Adicionado logging detalhado
- ✅ Tratamento robusto do formato de resposta
- ✅ Suporte para diferentes estruturas de retorno da API

```javascript
return {
  success: true,
  data: {
    rows: result.data?.rows || result.data || [],
    total: result.data?.total || result.total || 0,
  },
  executionTime: result.executionTime,
};
```

---

## 🔄 Fluxo Completo

### Como Funciona Agora:

1. **Usuário acessa Dashboard Personalizado**

   ```
   DashboardPersonalizado.jsx carrega
   ```

2. **Busca dashboards do usuário**

   ```javascript
   fetchMyDashboards(user.email);
   // Retorna dashboards atribuídos ao usuário
   ```

3. **Seleciona dashboard**

   ```javascript
   fetchDashboardDetails(dashboardId);
   // Retorna dashboard com array de widgets
   ```

4. **Para cada widget:**

   ```javascript
   <WidgetRenderer widget={widget} />
   ```

5. **WidgetRenderer executa query:**

   ```javascript
   executeQuery(widget.query_config);
   // query_config = { select: [...], from: "...", where: [...] }
   ```

6. **Backend processa query:**

   ```
   POST /api/querybuilder/execute
   → Valida configuração
   → Constrói SQL seguro (parameterizado)
   → Executa no ERP
   → Retorna resultados
   ```

7. **WidgetRenderer renderiza:**
   ```javascript
   switch (widget.widget_type) {
     case 'table':
       return <TableWidget />;
     case 'chart':
       if (chart_type === 'bar') return <BarChartWidget />;
       if (chart_type === 'pie') return <PieChartWidget />;
     case 'metric':
       return <MetricWidget />;
   }
   ```

---

## 🎨 Tipos de Visualização

### 1. Tabela (`widget_type: 'table'`)

**Quando usar:**

- Listar registros detalhados
- Múltiplas colunas de dados
- Dados textuais

**Exemplo de Query Config:**

```json
{
  "select": ["nome", "email", "cargo", "salario"],
  "from": "funcionarios",
  "where": [{ "column": "ativo", "operator": "=", "value": "true" }],
  "orderBy": [{ "column": "nome", "direction": "ASC" }],
  "limit": 50
}
```

**Resultado:**

```
┌───────────────┬─────────────────────┬────────────┬──────────┐
│ nome          │ email               │ cargo      │ salario  │
├───────────────┼─────────────────────┼────────────┼──────────┤
│ João Silva    │ joao@example.com    │ Gerente    │ 5000.00  │
│ Maria Santos  │ maria@example.com   │ Analista   │ 3500.00  │
└───────────────┴─────────────────────┴────────────┴──────────┘
```

---

### 2. Gráfico de Barras (`widget_type: 'chart'`, `chart_type: 'bar'`)

**Quando usar:**

- Comparar valores entre categorias
- Ranking (top 10 produtos, vendedores, etc.)
- Evolução temporal

**Exemplo de Query Config:**

```json
{
  "select": ["produto", "SUM(quantidade) as total"],
  "from": "vendas",
  "where": [
    { "column": "data_venda", "operator": ">=", "value": "2024-01-01" }
  ],
  "groupBy": ["produto"],
  "orderBy": [{ "column": "total", "direction": "DESC" }],
  "limit": 10
}
```

**Resultado:**

```
Notebook Pro      ████████████████████████ 1,250
Mouse Gamer       ██████████████████ 980
Teclado Mecânico  ████████████ 650
Headset USB       ████████ 420
```

---

### 3. Gráfico de Pizza (`widget_type: 'chart'`, `chart_type: 'pie'`)

**Quando usar:**

- Mostrar proporções/percentuais
- Distribuição de categorias
- Partes de um todo

**Exemplo de Query Config:**

```json
{
  "select": ["categoria", "COUNT(*) as quantidade"],
  "from": "produtos",
  "groupBy": ["categoria"],
  "limit": 8
}
```

**Resultado:**

```
■ Eletrônicos     35.2% (442)
■ Vestuário       28.5% (358)
■ Alimentos       20.1% (252)
■ Livros          16.2% (203)

Total: 1,255
```

---

### 4. Métrica (`widget_type: 'metric'`)

**Quando usar:**

- Exibir um único valor importante (KPI)
- Total de vendas, quantidade de clientes, etc.
- Números de destaque

**Exemplo de Query Config:**

```json
{
  "select": ["SUM(valor) as total_vendas"],
  "from": "vendas",
  "where": [{ "column": "status", "operator": "=", "value": "aprovado" }]
}
```

**Resultado:**

```
         R$ 1,234,567.89
         ───────────────
          TOTAL VENDAS
```

---

## 🎨 Personalização de Cores

As cores dos gráficos podem ser configuradas via `display_config`:

```json
{
  "colors": [
    "#3B82F6", // Azul
    "#10B981", // Verde
    "#F59E0B", // Amarelo
    "#EF4444", // Vermelho
    "#8B5CF6" // Roxo
  ]
}
```

Se não especificadas, cores padrão são usadas.

---

## 🔧 Estados do Widget

### Loading

```jsx
<LoadingSpinner />
```

### Erro

```jsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <p className="text-red-700">❌ Erro ao carregar dados: {error}</p>
  <button onClick={loadWidgetData}>Tentar novamente</button>
</div>
```

### Sem Dados

```jsx
<div className="bg-gray-50 rounded-lg p-8">
  <p className="text-gray-500">Sem dados para exibir</p>
</div>
```

---

## 🧪 Testando a Implementação

### 1. Criar Widget de Tabela

1. Acesse **Gerenciar Dashboards**
2. Crie novo dashboard: "Relatório de Vendas"
3. Adicione widget:
   - Nome: "Lista de Produtos"
   - Tipo: Tabela
   - Tabela: `VENDA_PRODUTO`
   - Colunas: `produto`, `quantidade`, `valor`
   - Ordem: `quantidade DESC`
4. Atribua seu usuário ao dashboard
5. Vá para **Dashboard Personalizado**
6. ✅ Deve ver tabela com dados reais

### 2. Criar Widget de Gráfico de Barras

1. Adicione novo widget:
   - Nome: "Top 10 Produtos"
   - Tipo: Gráfico
   - Gráfico: Barras
   - Tabela: `VENDA_PRODUTO`
   - Colunas: `produto`, `SUM(quantidade)`
   - Limite: 10
2. ✅ Deve ver gráfico de barras horizontal

### 3. Criar Widget de Métrica

1. Adicione novo widget:
   - Nome: "Total de Vendas"
   - Tipo: Métrica
   - Tabela: `VENDAS`
   - Colunas: `SUM(valor_total)`
2. ✅ Deve ver valor grande centralizado

---

## 🐛 Troubleshooting

### Widget mostra "Erro ao carregar dados"

**Verifique:**

1. Console do navegador para ver erro específico
2. Query config está válida no banco?
3. Tabela/colunas existem no ERP?
4. Backend está respondendo?

**Teste:**

```javascript
// No console do navegador:
const testQuery = {
  select: ['*'],
  from: 'sua_tabela',
  limit: 10,
};
fetch('https://apigestaocrosby-bw2v.onrender.com/api/querybuilder/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testQuery),
})
  .then((r) => r.json())
  .then(console.log);
```

### Widget mostra loading infinito

**Possíveis causas:**

1. Backend não está respondendo
2. Query muito pesada (timeout)
3. Erro não tratado na API

**Solução:**

- Adicione `limit` menor na query
- Verifique logs do backend
- Teste query direto no banco

### Gráfico aparece vazio

**Verifique:**

1. Query retorna dados?
2. Colunas estão corretas?
3. Primeira coluna é label, segunda é valor numérico?

**Exemplo correto:**

```javascript
// ✅ BOM
{ produto: "Notebook", total: 150 }

// ❌ RUIM - falta valor numérico
{ produto: "Notebook" }
```

---

## 📈 Próximos Passos (Melhorias Futuras)

### Opcionais para implementar depois:

1. **Biblioteca Recharts**

   - Gráficos mais sofisticados
   - Animações e interatividade
   - Mais tipos de gráficos

2. **Filtros Dinâmicos**

   - Usuário filtrar widget sem recriar
   - Date pickers, dropdowns
   - Aplicar filtros em tempo real

3. **Refresh Automático**

   - Atualizar dados periodicamente
   - Botão de refresh manual
   - Indicador de última atualização

4. **Export de Dados**

   - Baixar dados em CSV/Excel
   - Export de imagem do gráfico
   - Compartilhar widget

5. **Drill-down**
   - Clicar em barra/seção → ver detalhes
   - Navegação entre níveis de dados

---

## ✅ Checklist de Validação

- [x] WidgetRenderer criado
- [x] Tipos de widget implementados (table, chart, metric)
- [x] Gráfico de barras funcional
- [x] Gráfico de pizza funcional
- [x] Tabela com scroll e contagem
- [x] Estados de loading/erro tratados
- [x] executeQuery com logging
- [x] DashboardPersonalizado integrado
- [x] Documentação completa

---

## 🎉 Resultado Final

Agora quando você:

1. ✅ Criar um dashboard
2. ✅ Adicionar widgets com queries
3. ✅ Atribuir usuários
4. ✅ Acessar Dashboard Personalizado

**Você verá:**

- 📊 Gráficos renderizados com dados reais
- 📋 Tabelas com registros do banco
- 📈 Métricas atualizadas
- 🎨 Visual limpo e responsivo

---

**Criado em:** 2024
**Autor:** GitHub Copilot + NotCrosby02
