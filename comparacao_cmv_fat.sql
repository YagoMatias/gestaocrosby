-- Query de Comparação: CMV vs FAT
-- Execute para validar que as views FAT e CMV retornam os mesmos nr_transacao

-- ========================================
-- 1. COMPARAÇÃO GLOBAL (TODOS OS CANAIS)
-- ========================================

-- VAREJO
WITH fat_varejo AS (
  SELECT DISTINCT nr_transacao, dt_transacao
  FROM fatvarejo
  WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND nr_transacao IS NOT NULL
),
cmv_varejo AS (
  SELECT DISTINCT nr_transacao, dt_transacao
  FROM cmv_varejo
  WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND nr_transacao IS NOT NULL
)
SELECT
  'VAREJO' as canal,
  (SELECT COUNT(*) FROM fat_varejo) as total_fat,
  (SELECT COUNT(*) FROM cmv_varejo) as total_cmv,
  (SELECT COUNT(*) FROM fat_varejo f INNER JOIN cmv_varejo c ON f.nr_transacao = c.nr_transacao) as total_comum,
  (SELECT COUNT(*) FROM fat_varejo f LEFT JOIN cmv_varejo c ON f.nr_transacao = c.nr_transacao WHERE c.nr_transacao IS NULL) as apenas_fat,
  (SELECT COUNT(*) FROM cmv_varejo c LEFT JOIN fat_varejo f ON c.nr_transacao = f.nr_transacao WHERE f.nr_transacao IS NULL) as apenas_cmv

UNION ALL

-- MULTIMARCAS
SELECT
  'MULTIMARCAS' as canal,
  (SELECT COUNT(DISTINCT nr_transacao) FROM fatmtm WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND nr_transacao IS NOT NULL) as total_fat,
  (SELECT COUNT(DISTINCT nr_transacao) FROM cmv_mtm WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND nr_transacao IS NOT NULL) as total_cmv,
  (SELECT COUNT(DISTINCT f.nr_transacao) FROM fatmtm f INNER JOIN cmv_mtm c ON f.nr_transacao = c.nr_transacao WHERE f.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND f.nr_transacao IS NOT NULL) as total_comum,
  (SELECT COUNT(DISTINCT f.nr_transacao) FROM fatmtm f LEFT JOIN cmv_mtm c ON f.nr_transacao = c.nr_transacao WHERE f.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND f.nr_transacao IS NOT NULL AND c.nr_transacao IS NULL) as apenas_fat,
  (SELECT COUNT(DISTINCT c.nr_transacao) FROM cmv_mtm c LEFT JOIN fatmtm f ON c.nr_transacao = f.nr_transacao WHERE c.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND c.nr_transacao IS NOT NULL AND f.nr_transacao IS NULL) as apenas_cmv

UNION ALL

-- REVENDA
SELECT
  'REVENDA' as canal,
  (SELECT COUNT(DISTINCT nr_transacao) FROM fatrevenda WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND nr_transacao IS NOT NULL) as total_fat,
  (SELECT COUNT(DISTINCT nr_transacao) FROM cmv_revenda WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND nr_transacao IS NOT NULL) as total_cmv,
  (SELECT COUNT(DISTINCT f.nr_transacao) FROM fatrevenda f INNER JOIN cmv_revenda c ON f.nr_transacao = c.nr_transacao WHERE f.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND f.nr_transacao IS NOT NULL) as total_comum,
  (SELECT COUNT(DISTINCT f.nr_transacao) FROM fatrevenda f LEFT JOIN cmv_revenda c ON f.nr_transacao = c.nr_transacao WHERE f.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND f.nr_transacao IS NOT NULL AND c.nr_transacao IS NULL) as apenas_fat,
  (SELECT COUNT(DISTINCT c.nr_transacao) FROM cmv_revenda c LEFT JOIN fatrevenda f ON c.nr_transacao = f.nr_transacao WHERE c.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND c.nr_transacao IS NOT NULL AND f.nr_transacao IS NULL) as apenas_cmv

UNION ALL

-- FRANQUIAS
SELECT
  'FRANQUIAS' as canal,
  (SELECT COUNT(DISTINCT nr_transacao) FROM fatfranquias WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND nr_transacao IS NOT NULL) as total_fat,
  (SELECT COUNT(DISTINCT nr_transacao) FROM cmv_franquias WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND nr_transacao IS NOT NULL) as total_cmv,
  (SELECT COUNT(DISTINCT f.nr_transacao) FROM fatfranquias f INNER JOIN cmv_franquias c ON f.nr_transacao = c.nr_transacao WHERE f.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND f.nr_transacao IS NOT NULL) as total_comum,
  (SELECT COUNT(DISTINCT f.nr_transacao) FROM fatfranquias f LEFT JOIN cmv_franquias c ON f.nr_transacao = c.nr_transacao WHERE f.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND f.nr_transacao IS NOT NULL AND c.nr_transacao IS NULL) as apenas_fat,
  (SELECT COUNT(DISTINCT c.nr_transacao) FROM cmv_franquias c LEFT JOIN fatfranquias f ON c.nr_transacao = f.nr_transacao WHERE c.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31' AND c.nr_transacao IS NOT NULL AND f.nr_transacao IS NULL) as apenas_cmv;

-- ========================================
-- 2. DETALHES DAS DIFERENÇAS (SE HOUVER)
-- ========================================

-- Transações que estão no FAT mas não no CMV (VAREJO)
SELECT 
  'VAREJO - Apenas FAT' as tipo,
  f.nr_transacao,
  f.dt_transacao,
  f.nm_grupoempresa
FROM fatvarejo f
LEFT JOIN cmv_varejo c ON f.nr_transacao = c.nr_transacao
WHERE f.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND f.nr_transacao IS NOT NULL
  AND c.nr_transacao IS NULL
LIMIT 10;

-- Transações que estão no CMV mas não no FAT (VAREJO)
SELECT 
  'VAREJO - Apenas CMV' as tipo,
  c.nr_transacao,
  c.dt_transacao,
  c.nm_grupoempresa
FROM cmv_varejo c
LEFT JOIN fatvarejo f ON c.nr_transacao = f.nr_transacao
WHERE c.dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND c.nr_transacao IS NOT NULL
  AND f.nr_transacao IS NULL
LIMIT 10;

-- ========================================
-- 3. COMPARAÇÃO DE IMPOSTOS (ANTES E DEPOIS)
-- ========================================

-- Impostos usando CMV (método anterior)
WITH cmv_trans AS (
  SELECT DISTINCT nr_transacao
  FROM cmv_varejo
  WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND nr_transacao IS NOT NULL
)
SELECT 
  'CMV_VAREJO' as fonte,
  ti.cd_imposto,
  CASE 
    WHEN ti.cd_imposto = 1 THEN 'ICMS'
    WHEN ti.cd_imposto = 5 THEN 'COFINS'
    WHEN ti.cd_imposto = 6 THEN 'PIS'
    ELSE 'OUTROS'
  END as nome_imposto,
  COUNT(DISTINCT ti.nr_transacao) as qtd_transacoes,
  SUM(ti.vl_imposto) as total_imposto
FROM tra_itemimposto ti
INNER JOIN tra_transacao t ON t.nr_transacao = ti.nr_transacao
WHERE ti.nr_transacao IN (SELECT nr_transacao FROM cmv_trans)
  AND t.tp_operacao = 'S'
  AND ti.cd_imposto IN (1, 5, 6)
GROUP BY ti.cd_imposto

UNION ALL

-- Impostos usando FAT (método novo)
SELECT 
  'FAT_VAREJO' as fonte,
  ti.cd_imposto,
  CASE 
    WHEN ti.cd_imposto = 1 THEN 'ICMS'
    WHEN ti.cd_imposto = 5 THEN 'COFINS'
    WHEN ti.cd_imposto = 6 THEN 'PIS'
    ELSE 'OUTROS'
  END as nome_imposto,
  COUNT(DISTINCT ti.nr_transacao) as qtd_transacoes,
  SUM(ti.vl_imposto) as total_imposto
FROM tra_itemimposto ti
INNER JOIN tra_transacao t ON t.nr_transacao = ti.nr_transacao
WHERE ti.nr_transacao IN (
  SELECT DISTINCT nr_transacao
  FROM fatvarejo
  WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  AND nr_transacao IS NOT NULL
)
  AND t.tp_operacao = 'S'
  AND ti.cd_imposto IN (1, 5, 6)
GROUP BY ti.cd_imposto
ORDER BY fonte, cd_imposto;

-- ========================================
-- 4. RESUMO COMPARATIVO POR CANAL
-- ========================================

WITH impostos_cmv AS (
  SELECT 
    'VAREJO' as canal,
    SUM(CASE WHEN ti.cd_imposto = 1 THEN ti.vl_imposto ELSE 0 END) as icms,
    SUM(CASE WHEN ti.cd_imposto = 6 THEN ti.vl_imposto ELSE 0 END) as pis,
    SUM(CASE WHEN ti.cd_imposto = 5 THEN ti.vl_imposto ELSE 0 END) as cofins
  FROM tra_itemimposto ti
  INNER JOIN tra_transacao t ON t.nr_transacao = ti.nr_transacao
  WHERE ti.nr_transacao IN (
    SELECT DISTINCT nr_transacao FROM cmv_varejo 
    WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  )
  AND t.tp_operacao = 'S'
),
impostos_fat AS (
  SELECT 
    'VAREJO' as canal,
    SUM(CASE WHEN ti.cd_imposto = 1 THEN ti.vl_imposto ELSE 0 END) as icms,
    SUM(CASE WHEN ti.cd_imposto = 6 THEN ti.vl_imposto ELSE 0 END) as pis,
    SUM(CASE WHEN ti.cd_imposto = 5 THEN ti.vl_imposto ELSE 0 END) as cofins
  FROM tra_itemimposto ti
  INNER JOIN tra_transacao t ON t.nr_transacao = ti.nr_transacao
  WHERE ti.nr_transacao IN (
    SELECT DISTINCT nr_transacao FROM fatvarejo 
    WHERE dt_transacao BETWEEN '2025-01-01' AND '2025-01-31'
  )
  AND t.tp_operacao = 'S'
)
SELECT 
  'CMV' as fonte,
  canal,
  ROUND(icms::numeric, 2) as icms,
  ROUND(pis::numeric, 2) as pis,
  ROUND(cofins::numeric, 2) as cofins,
  ROUND((icms + pis + cofins)::numeric, 2) as total
FROM impostos_cmv

UNION ALL

SELECT 
  'FAT' as fonte,
  canal,
  ROUND(icms::numeric, 2) as icms,
  ROUND(pis::numeric, 2) as pis,
  ROUND(cofins::numeric, 2) as cofins,
  ROUND((icms + pis + cofins)::numeric, 2) as total
FROM impostos_fat

UNION ALL

-- Diferença percentual
SELECT 
  'DIFERENÇA' as fonte,
  'VAREJO' as canal,
  ROUND(((f.icms - c.icms) / NULLIF(c.icms, 0) * 100)::numeric, 2) as icms,
  ROUND(((f.pis - c.pis) / NULLIF(c.pis, 0) * 100)::numeric, 2) as pis,
  ROUND(((f.cofins - c.cofins) / NULLIF(c.cofins, 0) * 100)::numeric, 2) as cofins,
  ROUND((((f.icms + f.pis + f.cofins) - (c.icms + c.pis + c.cofins)) / NULLIF((c.icms + c.pis + c.cofins), 0) * 100)::numeric, 2) as total
FROM impostos_cmv c, impostos_fat f;

-- ========================================
-- INTERPRETAÇÃO DOS RESULTADOS
-- ========================================

/*
QUERY 1: COMPARAÇÃO GLOBAL
- total_fat: Transações nas views FAT
- total_cmv: Transações nas views CMV
- total_comum: Transações presentes em ambas
- apenas_fat: Transações SOMENTE no FAT
- apenas_cmv: Transações SOMENTE no CMV

✅ IDEAL: total_comum ≈ total_fat ≈ total_cmv
✅ IDEAL: apenas_fat = 0, apenas_cmv = 0

QUERY 2: DETALHES DAS DIFERENÇAS
- Mostra quais transações estão em uma view mas não na outra
- Útil para investigar discrepâncias

QUERY 3: COMPARAÇÃO DE IMPOSTOS
- Compara valores de ICMS, PIS, COFINS usando CMV vs FAT
- Deve retornar valores IDÊNTICOS ou muito próximos

✅ VALIDAÇÃO: total_imposto CMV = total_imposto FAT

QUERY 4: RESUMO COMPARATIVO
- Mostra lado a lado os totais de CMV vs FAT
- Última linha mostra diferença percentual
- ✅ IDEAL: Diferença próxima de 0%

AÇÕES BASEADAS NOS RESULTADOS:

1. Se diferença = 0%:
   ✅ Migração bem-sucedida! FAT = CMV

2. Se diferença < 5%:
   ⚠️ Pequena discrepância - Investigar causas

3. Se diferença > 5%:
   ❌ Problema detectado - Verificar:
      - Views FAT estão materializadas?
      - Campo nr_transacao populado corretamente?
      - Filtros de data aplicados corretamente?
*/
