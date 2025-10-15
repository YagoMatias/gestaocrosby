# Migração: CMV → FAT para Consulta de Impostos

## 📋 Resumo da Mudança

As rotas de impostos foram atualizadas para buscar `nr_transacao` das **views de faturamento** ao invés das **views de CMV**.

## 🔄 Mudanças Realizadas

### Views Substituídas

| Anterior (CMV)  | Novo (FAT)     | Canal       |
| --------------- | -------------- | ----------- |
| `cmv_varejo`    | `fatvarejo`    | Varejo      |
| `cmv_mtm`       | `fatmtm`       | Multimarcas |
| `cmv_revenda`   | `fatrevenda`   | Revenda     |
| `cmv_franquias` | `fatfranquias` | Franquias   |

### Rotas Atualizadas

#### 1. `/api/faturamento/impostos-por-canal`

- **Antes**: Buscava `nr_transacao` de `cmv_varejo`, `cmv_mtm`, `cmv_revenda`, `cmv_franquias`
- **Depois**: Busca `nr_transacao` de `fatvarejo`, `fatmtm`, `fatrevenda`, `fatfranquias`

#### 2. `/api/faturamento/impostos-detalhados`

- **Antes**: Buscava `nr_transacao`, `dt_transacao`, `nm_grupoempresa` das views CMV
- **Depois**: Busca os mesmos campos das views FAT

## 🎯 Motivo da Mudança

As views de **faturamento** (FAT) agora incluem o campo `nr_transacao`, permitindo consulta direta sem necessidade de passar pelas views de CMV. Isso:

1. ✅ **Simplifica a arquitetura** - Menos dependência entre views
2. ✅ **Mantém a mesma lógica** - Processo idêntico, apenas fonte diferente
3. ✅ **Melhora a coesão** - Impostos relacionados ao faturamento consultam views de faturamento
4. ✅ **Preserva o filtro crítico** - Continua filtrando apenas transações de SAÍDA (`tp_operacao = 'S'`)

## 📊 Estrutura das Views FAT

Todas as views de faturamento agora incluem:

```sql
SELECT
  cd_grupoempresa,
  dt_transacao,
  nm_grupoempresa,
  valor_com_desconto,
  valor_com_desconto_entrada,
  valor_com_desconto_saida,
  valor_sem_desconto,
  valor_sem_desconto_entrada,
  valor_sem_desconto_saida,
  nr_transacao  -- ← Campo adicionado
FROM fatvarejo/fatmtm/fatrevenda/fatfranquias
```

## 🔍 Exemplo de Query Atualizada

### Antes (CMV)

```javascript
const cmvQuery = `
  SELECT DISTINCT nr_transacao
  FROM cmv_varejo
  WHERE dt_transacao BETWEEN $1 AND $2
  AND nr_transacao IS NOT NULL
`;
```

### Depois (FAT)

```javascript
const fatQuery = `
  SELECT DISTINCT nr_transacao
  FROM fatvarejo
  WHERE dt_transacao BETWEEN $1 AND $2
  AND nr_transacao IS NOT NULL
`;
```

## ⚡ Performance

A mudança **não impacta negativamente** a performance:

- ✅ Mesma estrutura de índices pode ser aplicada
- ✅ Mesma lógica de cache (30min TTL)
- ✅ Mesmo processamento em lotes (1000 transações/lote)
- ✅ Mesmo processamento paralelo (3 lotes simultâneos)
- ✅ Mesmo filtro de SAÍDA (`tp_operacao = 'S'`)

## 🧪 Validação

### 1. Testar Rota Principal

```powershell
# Buscar impostos de todos os canais
Invoke-WebRequest "http://localhost:3000/api/faturamento/impostos-por-canal?dataInicio=2025-01-01&dataFim=2025-01-31"

# Buscar impostos de um canal específico
Invoke-WebRequest "http://localhost:3000/api/faturamento/impostos-por-canal?dataInicio=2025-01-01&dataFim=2025-01-31&canal=varejo"
```

### 2. Testar Rota Detalhada

```powershell
Invoke-WebRequest "http://localhost:3000/api/faturamento/impostos-detalhados?dataInicio=2025-01-01&dataFim=2025-01-31&canal=varejo"
```

### 3. Comparar Resultados

Execute esta query SQL para validar que FAT e CMV retornam os mesmos `nr_transacao`:

```sql
-- Comparar nr_transacao de FAT vs CMV
WITH fat_trans AS (
  SELECT DISTINCT nr_transacao
  FROM fatvarejo
  WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND nr_transacao IS NOT NULL
),
cmv_trans AS (
  SELECT DISTINCT nr_transacao
  FROM cmv_varejo
  WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND nr_transacao IS NOT NULL
)
SELECT
  (SELECT COUNT(*) FROM fat_trans) as total_fat,
  (SELECT COUNT(*) FROM cmv_trans) as total_cmv,
  (SELECT COUNT(*) FROM fat_trans f INNER JOIN cmv_trans c ON f.nr_transacao = c.nr_transacao) as total_comum,
  (SELECT COUNT(*) FROM fat_trans f LEFT JOIN cmv_trans c ON f.nr_transacao = c.nr_transacao WHERE c.nr_transacao IS NULL) as apenas_fat,
  (SELECT COUNT(*) FROM cmv_trans c LEFT JOIN fat_trans f ON c.nr_transacao = f.nr_transacao WHERE f.nr_transacao IS NULL) as apenas_cmv;
```

**Resultado Esperado**:

- `total_fat` ≈ `total_cmv`
- `total_comum` = maioria das transações
- `apenas_fat` e `apenas_cmv` = 0 ou muito próximo

## 🚀 Próximos Passos

1. **Reiniciar o backend** para aplicar as mudanças:

   ```powershell
   cd backend
   npm restart
   ```

2. **Limpar o cache** (opcional, mas recomendado):

   ```powershell
   Invoke-WebRequest -Method Delete "http://localhost:3000/api/faturamento/impostos-cache"
   ```

3. **Testar na aplicação DRE**:
   - Abrir página DRE
   - Selecionar período
   - Verificar que impostos carregam normalmente
   - Confirmar valores estão corretos

## 📝 Observações Importantes

1. **Filtro de SAÍDA mantido**: Continua filtrando apenas `tp_operacao = 'S'` para excluir transações de ENTRADA
2. **Cache automático**: Cache ainda é limpo ao reiniciar o servidor
3. **Separação de impostos**: ICMS, PIS e COFINS continuam separados
4. **Índices recomendados**: Os mesmos índices de `tra_transacao` e `tra_itemimposto` ainda são necessários

## 🔗 Arquivos Relacionados

- `backend/routes/faturamento.routes.js` - Rotas atualizadas (linhas ~1445 e ~1575)
- `CORRECAO_IMPOSTOS_SAIDA.md` - Documentação da correção anterior (filtro tp_operacao)
- `validacao_impostos_saida.sql` - Queries de validação

---

**Data da Mudança**: 15 de outubro de 2025  
**Impacto**: Baixo - Mudança interna sem alteração de comportamento  
**Breaking Changes**: Nenhum - API permanece idêntica
