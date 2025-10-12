# 🐛 Debug - Faturamento MTM e Revenda Zerados

## 📋 Checklist de Verificação

### 1. Verificar Console do Navegador

Abra o Dashboard de Faturamento e verifique no console (F12):

```javascript
// Você deve ver logs como:
📊 Dados MTM extraídos: [...]
📊 MTM - Primeira linha: {...}
📊 MTM - Campos disponíveis: [...]
📊 Quantidade de registros: { varejo: X, mtm: Y, franquias: Z, revenda: W }
```

**⚠️ IMPORTANTE:** Copie e cole aqui a saída completa do console, especialmente:

- `📊 MTM - Primeira linha`
- `📊 Revenda - Primeira linha`
- `📊 MTM - Campos disponíveis`
- `📊 Revenda - Campos disponíveis`

### 2. Testar Rotas do Backend Diretamente

Abra o navegador e teste as rotas diretamente:

```
# MTM
http://localhost:3000/api/faturamento/mtm?dataInicio=2024-10-01&dataFim=2024-10-31

# Revenda
http://localhost:3000/api/faturamento/revenda?dataInicio=2024-10-01&dataFim=2024-10-31
```

**Verifique se a resposta contém:**

- ✅ `success: true`
- ✅ `data: [array com registros]`
- ✅ Campos: `valor_sem_desconto_saida`, `valor_com_desconto_saida`, etc.

### 3. Verificar Estrutura de Resposta

A resposta da API deve estar neste formato:

```json
{
  "success": true,
  "data": [
    {
      "dt_transacao": "2024-10-01",
      "cd_grupoempresa": "GRUPO X",
      "valor_sem_desconto_saida": "12345.67",
      "valor_sem_desconto_entrada": "0",
      "valor_com_desconto_saida": "11000.00",
      "valor_com_desconto_entrada": "0",
      "valor_sem_desconto": "12345.67",
      "valor_com_desconto": "11000.00",
      "quantidade_total_saida": "100",
      "quantidade_total_entrada": "0",
      "cmv": "8000.00"
    }
  ],
  "total": 1,
  "message": "Faturamento MTM recuperado com sucesso"
}
```

### 4. Verificar Tipos de Dados

**PROBLEMA COMUM:** Os valores podem estar como STRING em vez de NUMBER.

Se os valores estão como string (`"12345.67"` em vez de `12345.67`), o `parseFloat()` deve funcionar, mas verifique se não há caracteres especiais ou formatação.

### 5. Verificar Filtros WHERE

As queries MTM e Revenda têm filtros específicos:

**MTM:**

```sql
AND EXISTS (
  SELECT 1 FROM vr_pes_pessoaclas vpp
  WHERE vpp.cd_pessoa = fisnf.cd_pessoatra
  AND (
    (vpp.cd_tipoclas = 20 AND vpp.cd_classificacao::integer = 2)
    OR (vpp.cd_tipoclas = 5 AND vpp.cd_classificacao::integer = 1)
  )
)
```

**Revenda:**

```sql
AND EXISTS (
  SELECT 1 FROM vr_pes_pessoaclas vpp
  WHERE vpp.cd_pessoa = fisnf.cd_pessoatra
  AND (
    (vpp.cd_tipoclas = 20 AND vpp.cd_classificacao::integer = 3)
    OR (vpp.cd_tipoclas = 7 AND vpp.cd_classificacao::integer = 1)
  )
)
```

**⚠️ AÇÃO:** Verifique se esses filtros estão retornando resultados no banco de dados.

## 🔧 Possíveis Soluções

### Solução 1: Campos com Nomes Diferentes

Se os campos vierem com nomes diferentes (camelCase vs snake_case), o código já tem fallbacks:

```javascript
const valorBrutoSaida =
  parseFloat(item.valor_sem_desconto_saida) ||
  parseFloat(item.valorSemDescontoSaida) ||
  parseFloat(item.valor_bruto_saida) ||
  0;
```

### Solução 2: Valores como String com Formatação

Se os valores vierem formatados (ex: "R$ 1.234,56"), precisamos limpar:

```javascript
const cleanNumber = (value) => {
  if (!value) return 0;
  // Remove R$, pontos e substitui vírgula por ponto
  const cleaned = String(value)
    .replace(/[R$\s.]/g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
};
```

### Solução 3: Resposta Aninhada Diferente

Se a estrutura da resposta for diferente, ajuste a extração:

```javascript
// Em vez de:
const mtmData = mtmRes.data || [];

// Tente:
const mtmData = mtmRes.data?.data || mtmRes.data || [];
```

## 📝 Informações Necessárias

Por favor, forneça:

1. ✅ **Console.log completo** do navegador
2. ✅ **Resposta JSON** das rotas `/api/faturamento/mtm` e `/api/faturamento/revenda`
3. ✅ **Período de data** que está usando para testar
4. ✅ **Quantidade de registros** retornados por cada rota

Com essas informações, posso identificar e corrigir o problema exato! 🚀
