import express from 'express';
import pool from '../config/database.js';
import { validateRequired, validateDateFormat, validatePagination, sanitizeInput } from '../middlewares/validation.middleware.js';
import { asyncHandler, successResponse, errorResponse } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * @route GET /financial/extrato
 * @desc Buscar extrato bancário com filtros e paginação
 * @access Public
 * @query {cd_empresa, nr_ctapes, dt_movim_ini, dt_movim_fim, limit, offset}
 */
router.get('/extrato',
  sanitizeInput,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { cd_empresa, nr_ctapes, dt_movim_ini, dt_movim_fim } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50000000;
    const offset = parseInt(req.query.offset, 10) || 0;

    let baseQuery = ' FROM fcc_extratbco fe WHERE 1=1';
    const params = [];
    let idx = 1;

    // Construir filtros dinamicamente
    if (cd_empresa) {
      baseQuery += ` AND fe.cd_empresa = $${idx++}`;
      params.push(cd_empresa);
    }

    if (nr_ctapes) {
      if (Array.isArray(nr_ctapes) && nr_ctapes.length > 0) {
        const nr_ctapes_num = nr_ctapes.map(Number);
        baseQuery += ` AND fe.nr_ctapes IN (${nr_ctapes_num.map(() => `$${idx++}`).join(',')})`;
        params.push(...nr_ctapes_num);
      } else {
        baseQuery += ` AND fe.nr_ctapes = $${idx++}`;
        params.push(Number(nr_ctapes));
      }
    }

    if (dt_movim_ini && dt_movim_fim) {
      baseQuery += ` AND fe.dt_lancto BETWEEN $${idx++} AND $${idx++}`;
      params.push(dt_movim_ini, dt_movim_fim);
    }

    // Query para total de registros
    const totalQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const totalResult = await pool.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].total, 10);

    // Query para dados paginados
    const dataQuery = `
      SELECT 
        fe.nr_ctapes, 
        fe.dt_lancto, 
        fe.ds_histbco, 
        fe.tp_operbco, 
        fe.vl_lancto, 
        fe.dt_conciliacao
      ${baseQuery}
      ORDER BY fe.dt_lancto DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    
    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(dataQuery, dataParams);

    successResponse(res, {
      total,
      limit,
      offset,
      hasMore: (offset + limit) < total,
      data: rows
    }, 'Extrato bancário obtido com sucesso');
  })
);

/**
 * @route GET /financial/extrato-totvs
 * @desc Buscar extrato TOTVS com filtros
 * @access Public
 * @query {nr_ctapes, dt_movim_ini, dt_movim_fim, limit, offset}
 */
router.get('/extrato-totvs',
  sanitizeInput,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { nr_ctapes, dt_movim_ini, dt_movim_fim } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50000000;
    const offset = parseInt(req.query.offset, 10) || 0;

    let baseQuery = ' FROM fcc_mov fm WHERE fm.in_estorno = $1';
    const params = ['F']; // Filtro fixo para não estornados
    let idx = 2;

    if (nr_ctapes) {
      let contas = Array.isArray(nr_ctapes) ? nr_ctapes : [nr_ctapes];
      if (contas.length > 1) {
        baseQuery += ` AND fm.nr_ctapes IN (${contas.map(() => `$${idx++}`).join(',')})`;
        params.push(...contas);
      } else {
        baseQuery += ` AND fm.nr_ctapes = $${idx++}`;
        params.push(contas[0]);
      }
    }

    if (dt_movim_ini && dt_movim_fim) {
      baseQuery += ` AND fm.dt_movim BETWEEN $${idx++} AND $${idx++}`;
      params.push(dt_movim_ini, dt_movim_fim);
    }

    const dataQuery = `
      SELECT 
        fm.cd_empresa, 
        fm.nr_ctapes, 
        fm.dt_movim, 
        fm.ds_doc, 
        fm.dt_liq, 
        fm.in_estorno, 
        fm.tp_operacao, 
        fm.ds_aux, 
        fm.vl_lancto
      ${baseQuery}
      ORDER BY fm.dt_movim DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    
    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(dataQuery, dataParams);

    successResponse(res, {
      limit,
      offset,
      count: rows.length,
      data: rows
    }, 'Extrato TOTVS obtido com sucesso');
  })
);

/**
 * @route GET /financial/contas-pagar
 * @desc Buscar contas a pagar
 * @access Public
 * @query {dt_inicio, dt_fim, cd_empresa, limit, offset}
 */
router.get('/contas-pagar',
  sanitizeInput,
  validateRequired(['dt_inicio', 'dt_fim', 'cd_empresa']),
  validateDateFormat(['dt_inicio', 'dt_fim']),
  validatePagination,
  asyncHandler(async (req, res) => {
    const { dt_inicio, dt_fim, cd_empresa } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50000000;
    const offset = parseInt(req.query.offset, 10) || 0;

    // Query principal com JOIN otimizado
    const query = `
      SELECT
        fd.cd_empresa,
        fd.cd_fornecedor,
        fd.nr_duplicata,
        fd.nr_portador,
        fd.nr_parcela,
        fd.dt_emissao,
        fd.dt_vencimento,
        fd.dt_entrada,
        fd.dt_liq,
        fd.tp_situacao,
        fd.tp_estagio,
        fd.vl_duplicata,
        fd.vl_juros,
        fd.vl_acrescimo,
        fd.vl_desconto,
        fd.vl_pago,
        fd.in_aceite,
        od.ds_observacao,
        fd.cd_despesaitem,
        COALESCE(fdi.ds_despesaitem, 'SEM DESCRIÇÃO') as ds_despesaitem,
        vpf.nm_fornecedor,
        fd.cd_ccusto,
        COALESCE(gc.ds_ccusto, 'SEM CENTRO DE CUSTO') as ds_ccusto
      FROM vr_fcp_despduplicatai fd
      LEFT JOIN obs_dupi od ON fd.nr_duplicata = od.nr_duplicata 
        AND fd.cd_fornecedor = od.cd_fornecedor
      LEFT JOIN fcp_despesaitem fdi ON fd.cd_despesaitem = fdi.cd_despesaitem
      LEFT JOIN vr_pes_fornecedor vpf ON fd.cd_fornecedor = vpf.cd_fornecedor
      LEFT JOIN ger_ccusto gc ON fd.cd_ccusto = gc.cd_ccusto
      WHERE fd.dt_vencimento BETWEEN $1 AND $2
        AND fd.cd_empresa = $3
      ORDER BY fd.dt_emissao DESC
      LIMIT $4 OFFSET $5
    `;

    // Query para contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM vr_fcp_despduplicatai fd
      WHERE fd.dt_vencimento BETWEEN $1 AND $2
        AND fd.cd_empresa = $3
    `;

    // Query de diagnóstico para verificar dados de despesa e centro de custo
    const diagnosticQuery = `
      SELECT 
        COUNT(*) as total_registros,
        COUNT(CASE WHEN cd_despesaitem IS NOT NULL THEN 1 END) as com_despesa,
        COUNT(CASE WHEN cd_ccusto IS NOT NULL THEN 1 END) as com_centro_custo,
        COUNT(CASE WHEN cd_despesaitem IS NOT NULL AND cd_ccusto IS NOT NULL THEN 1 END) as com_ambos
      FROM vr_fcp_despduplicatai fd
      WHERE fd.dt_vencimento BETWEEN $1 AND $2
        AND fd.cd_empresa = $3
    `;

    // Query específica para verificar dados da RECEITA FEDERAL
    const receitaQuery = `
      SELECT 
        fd.cd_fornecedor,
        fd.nr_duplicata,
        fd.cd_despesaitem,
        fd.cd_ccusto,
        fdi.ds_despesaitem,
        gc.ds_ccusto,
        vpf.nm_fornecedor
      FROM vr_fcp_despduplicatai fd
      LEFT JOIN fcp_despesaitem fdi ON fd.cd_despesaitem = fdi.cd_despesaitem
      LEFT JOIN ger_ccusto gc ON fd.cd_ccusto = gc.cd_ccusto
      LEFT JOIN vr_pes_fornecedor vpf ON fd.cd_fornecedor = vpf.cd_fornecedor
      WHERE fd.dt_vencimento BETWEEN $1 AND $2
        AND fd.cd_empresa = $3
        AND vpf.nm_fornecedor LIKE '%RECEITA FEDERAL%'
      LIMIT 5
    `;

    const [resultado, totalResult, diagnosticResult, receitaResult] = await Promise.all([
      pool.query(query, [dt_inicio, dt_fim, cd_empresa, limit, offset]),
      pool.query(countQuery, [dt_inicio, dt_fim, cd_empresa]),
      pool.query(diagnosticQuery, [dt_inicio, dt_fim, cd_empresa]),
      pool.query(receitaQuery, [dt_inicio, dt_fim, cd_empresa])
    ]);

    const total = parseInt(totalResult.rows[0].total, 10);

    // Debug para verificar dados de despesa e centro de custo
    console.log('📊 Diagnóstico - Estatísticas dos dados:');
    console.log(diagnosticResult.rows[0]);
    
    console.log('🏛️ Dados específicos da RECEITA FEDERAL:');
    console.log(receitaResult.rows);
    
    if (resultado.rows.length > 0) {
      console.log('🔍 Debug - Primeiros 3 registros do banco:');
      resultado.rows.slice(0, 3).forEach((row, index) => {
        console.log(`📋 Registro ${index + 1}:`, {
          fornecedor: row.nm_fornecedor,
          cd_despesaitem: row.cd_despesaitem,
          ds_despesaitem: row.ds_despesaitem,
          cd_ccusto: row.cd_ccusto,
          ds_ccusto: row.ds_ccusto
        });
      });
    }

    successResponse(res, {
      total,
      limit,
      offset,
      hasMore: (offset + limit) < total,
      filtros: { dt_inicio, dt_fim, cd_empresa },
      data: resultado.rows
    }, 'Contas a pagar obtidas com sucesso');
  })
);

/**
 * @route GET /financial/contas-receber
 * @desc Buscar contas a receber
 * @access Public
 * @query {dt_inicio, dt_fim, cd_empresa, limit, offset}
 */
router.get('/contas-receber',
  sanitizeInput,
  validateRequired(['dt_inicio', 'dt_fim', 'cd_empresa']),
  validateDateFormat(['dt_inicio', 'dt_fim']),
  validatePagination,
  asyncHandler(async (req, res) => {
    const { dt_inicio, dt_fim, cd_empresa } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50000000;
    const offset = parseInt(req.query.offset, 10) || 0;

    const query = `
      SELECT
        vff.cd_empresa,
        vff.cd_cliente,
        vff.nm_cliente,
        vff.nr_parcela,
        vff.dt_emissao,
        vff.dt_vencimento,
        vff.dt_cancelamento,
        vff.dt_liq,
        vff.tp_cobranca,
        vff.tp_documento,
        vff.tp_faturamento,
        vff.tp_inclusao,
        vff.tp_baixa,
        vff.tp_situacao,
        vff.vl_fatura,
        vff.vl_original,
        vff.vl_abatimento,
        vff.vl_pago,
        vff.vl_desconto,
        vff.vl_liquido,
        vff.vl_acrescimo,
        vff.vl_multa,
        vff.nr_portador,
        vff.vl_renegociacao,
        vff.vl_corrigido,
        vff.vl_juros,
        vff.pr_juromes,
        vff.pr_multa
      FROM vr_fcr_faturai vff
      WHERE vff.dt_emissao BETWEEN $1 AND $2
        AND vff.cd_empresa = $3
      ORDER BY vff.dt_emissao DESC
      LIMIT $4 OFFSET $5
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM vr_fcr_faturai vff
      WHERE vff.dt_emissao BETWEEN $1 AND $2
        AND vff.cd_empresa = $3
    `;

    const [resultado, totalResult] = await Promise.all([
      pool.query(query, [dt_inicio, dt_fim, cd_empresa, limit, offset]),
      pool.query(countQuery, [dt_inicio, dt_fim, cd_empresa])
    ]);

    const total = parseInt(totalResult.rows[0].total, 10);

    successResponse(res, {
      total,
      limit,
      offset,
      hasMore: (offset + limit) < total,
      filtros: { dt_inicio, dt_fim, cd_empresa },
      data: resultado.rows
    }, 'Contas a receber obtidas com sucesso');
  })
);

/**
 * @route GET /financial/fluxo-caixa
 * @desc Buscar fluxo de caixa com suporte a múltiplas empresas
 * @access Public
 * @query {dt_inicio, dt_fim, cd_empresa[]}
 */
router.get('/fluxo-caixa',
  sanitizeInput,
  validateDateFormat(['dt_inicio', 'dt_fim']),
  asyncHandler(async (req, res) => {
    const { dt_inicio, dt_fim, cd_empresa } = req.query;
    
    if (!cd_empresa) {
      return errorResponse(res, 'Parâmetro cd_empresa é obrigatório', 400, 'MISSING_PARAMETER');
    }

    // Seguir exatamente o mesmo padrão da rota /faturamento - UMA ÚNICA QUERY
    let empresas = Array.isArray(cd_empresa) ? cd_empresa : [cd_empresa];
    let params = [dt_inicio, dt_fim, ...empresas];
    let empresaPlaceholders = empresas.map((_, idx) => `$${3 + idx}`).join(',');

    // CORREÇÃO: Aumentar limiar para queries pesadas e sempre incluir JOINs essenciais
    // Só remover JOINs opcionais em casos extremos (>100 empresas)
    const isHeavyQuery = empresas.length > 100;
    
    const query = isHeavyQuery ? `
      SELECT
        fd.cd_empresa,
        fd.cd_fornecedor,
        fd.nr_duplicata,
        fd.nr_portador,
        fd.nr_parcela,
        fd.dt_emissao,
        fd.dt_vencimento,
        fd.dt_entrada,
        fd.dt_liq,
        fd.tp_situacao,
        fd.tp_estagio,
        fd.vl_duplicata,
        fd.vl_juros,
        fd.vl_acrescimo,
        fd.vl_desconto,
        fd.vl_pago,
        fd.in_aceite,
        fd.cd_despesaitem,
        fd.cd_ccusto,
        -- CORREÇÃO: Manter JOINs essenciais mesmo em queries pesadas
        COALESCE(fdi.ds_despesaitem, 'SEM DESCRIÇÃO') as ds_despesaitem,
        vpf.nm_fornecedor,
        COALESCE(gc.ds_ccusto, 'SEM CENTRO DE CUSTO') as ds_ccusto
      FROM vr_fcp_despduplicatai fd
      -- JOINs essenciais mantidos para preservar dados de fornecedor e despesas
      LEFT JOIN fcp_despesaitem fdi ON fd.cd_despesaitem = fdi.cd_despesaitem
      LEFT JOIN vr_pes_fornecedor vpf ON fd.cd_fornecedor = vpf.cd_fornecedor
      LEFT JOIN gec_ccusto gc ON fd.cd_ccusto = gc.cd_ccusto
      WHERE fd.dt_vencimento BETWEEN $1 AND $2
        AND fd.cd_empresa IN (${empresaPlaceholders})
      ORDER BY fd.dt_vencimento DESC
      LIMIT 5000000
    ` : `
      SELECT
        fd.cd_empresa,
        fd.cd_fornecedor,
        fd.nr_duplicata,
        fd.nr_portador,
        fd.nr_parcela,
        fd.dt_emissao,
        fd.dt_vencimento,
        fd.dt_entrada,
        fd.dt_liq,
        fd.tp_situacao,
        fd.tp_estagio,
        fd.vl_duplicata,
        fd.vl_juros,
        fd.vl_acrescimo,
        fd.vl_desconto,
        fd.vl_pago,
        fd.in_aceite,
        od.ds_observacao,
        fd.cd_despesaitem,
        COALESCE(fdi.ds_despesaitem, 'SEM DESCRIÇÃO') as ds_despesaitem,
        vpf.nm_fornecedor,
        fd.cd_ccusto,
        COALESCE(gc.ds_ccusto, 'SEM CENTRO DE CUSTO') as ds_ccusto
      FROM vr_fcp_despduplicatai fd
      LEFT JOIN obs_dupi od ON fd.nr_duplicata = od.nr_duplicata 
        AND fd.cd_fornecedor = od.cd_fornecedor
      LEFT JOIN fcp_despesaitem fdi ON fd.cd_despesaitem = fdi.cd_despesaitem
      LEFT JOIN vr_pes_fornecedor vpf ON fd.cd_fornecedor = vpf.cd_fornecedor
      LEFT JOIN gec_ccusto gc ON fd.cd_ccusto = gc.cd_ccusto
      WHERE fd.dt_vencimento BETWEEN $1 AND $2
        AND fd.cd_empresa IN (${empresaPlaceholders})
      ORDER BY fd.dt_vencimento DESC
    `;

    console.log(`🔍 Fluxo-caixa: ${empresas.length} empresas, query ${isHeavyQuery ? 'otimizada' : 'completa'}`);
    
    // Para queries pesadas, usar timeout específico
    const queryOptions = isHeavyQuery ? {
      text: query,
      values: params,
      // Para queries pesadas, não usar timeout (herda do pool)
    } : query;

    const { rows } = await pool.query(queryOptions, isHeavyQuery ? undefined : params);

    // Debug para verificar dados de despesa e centro de custo
    if (rows.length > 0) {
      console.log('🔍 Debug - Primeiros 3 registros de contas a pagar:');
      rows.slice(0, 3).forEach((row, index) => {
        console.log(`📋 Registro ${index + 1}:`, {
          fornecedor: row.nm_fornecedor,
          cd_despesaitem: row.cd_despesaitem,
          ds_despesaitem: row.ds_despesaitem,
          cd_ccusto: row.cd_ccusto,
          ds_ccusto: row.ds_ccusto,
          dt_vencimento: row.dt_vencimento
        });
      });
    }

    // Calcular totais (igual ao faturamento)
    const totals = rows.reduce((acc, row) => {
      acc.totalDuplicata += parseFloat(row.vl_duplicata || 0);
      acc.totalPago += parseFloat(row.vl_pago || 0);
      acc.totalJuros += parseFloat(row.vl_juros || 0);
      acc.totalDesconto += parseFloat(row.vl_desconto || 0);
      return acc;
    }, { totalDuplicata: 0, totalPago: 0, totalJuros: 0, totalDesconto: 0 });

    successResponse(res, {
      periodo: { dt_inicio, dt_fim },
      empresas,
      totals,
      count: rows.length,
      optimized: isHeavyQuery,
      queryType: isHeavyQuery ? 'otimizada-com-joins-essenciais' : 'completo-com-joins',
      data: rows
    }, `Fluxo de caixa obtido com sucesso (${isHeavyQuery ? 'otimizado' : 'completo'})`);
  })
);

/**
 * @route GET /financial/observacao
 * @desc Buscar observações de duplicatas
 * @access Public
 * @query {cd_fornecedor, nr_duplicata}
 */
router.get('/observacao',
  sanitizeInput,
  validateRequired(['cd_fornecedor', 'nr_duplicata']),
  asyncHandler(async (req, res) => {
    const { cd_fornecedor, nr_duplicata } = req.query;

    const query = `
      SELECT
        od.cd_fornecedor,
        od.nr_duplicata,
        od.ds_observacao
      FROM obs_dupi od
      WHERE od.cd_fornecedor = $1
        AND od.nr_duplicata = $2
    `;

    const { rows } = await pool.query(query, [cd_fornecedor, nr_duplicata]);

    successResponse(res, {
      filtros: { cd_fornecedor, nr_duplicata },
      count: rows.length,
      data: rows
    }, 'Observações obtidas com sucesso');
  })
);

/**
 * @route GET /financial/observacao
 * @desc Buscar observações de duplicatas
 * @access Public
 * @query {cd_fornecedor, nr_duplicata, cd_empresa, nr_parcela}
 */
router.get('/observacao',
  sanitizeInput,
  validateRequired(['cd_fornecedor', 'nr_duplicata', 'cd_empresa', 'nr_parcela']),
  asyncHandler(async (req, res) => {
    const { cd_fornecedor, nr_duplicata, cd_empresa, nr_parcela } = req.query;

    const query = `
      SELECT
        od.cd_fornecedor,
        od.nr_duplicata,
        od.dt_cadastro,
        od.cd_empresa,
        od.nr_parcela,
        od.ds_observacao
      FROM obs_dupi od
      WHERE od.cd_fornecedor = $1
        AND od.nr_duplicata = $2
        AND od.cd_empresa = $3
        AND od.nr_parcela = $4
    `;

    const { rows } = await pool.query(query, [cd_fornecedor, nr_duplicata, cd_empresa, nr_parcela]);

    successResponse(res, {
      filtros: { cd_fornecedor, nr_duplicata, cd_empresa, nr_parcela },
      count: rows.length,
      data: rows
    }, 'Observações obtidas com sucesso');
  })
);

export default router;