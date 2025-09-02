import express from 'express';
import pool from '../config/database.js';
import { validateDateFormat, sanitizeInput } from '../middlewares/validation.middleware.js';
import { asyncHandler, successResponse, errorResponse } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * @route GET /franchise/consulta-fatura
 * @desc Consultar faturas de franquias com filtros múltiplos
 * @access Public
 * @query {cd_empresa, cd_cliente, dt_inicio, dt_fim, nm_fantasia[]}
 */
router.get('/consulta-fatura',
  sanitizeInput,
  validateDateFormat(['dt_inicio', 'dt_fim']),
  asyncHandler(async (req, res) => {
    let { cd_empresa, cd_cliente, dt_inicio, dt_fim, nm_fantasia } = req.query;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    // Filtro para nome fantasia (múltiplo ou padrão)
    if (nm_fantasia) {
      let nomes = Array.isArray(nm_fantasia) ? nm_fantasia : [nm_fantasia];
      whereConditions.push(`pp.nm_fantasia IN (${nomes.map(() => `$${paramIndex++}`).join(',')})`);
      params.push(...nomes);
    } else {
      whereConditions.push("pp.nm_fantasia LIKE 'F%CROSBY%'");
    }
    
    // Filtros opcionais
    if (cd_empresa) {
      whereConditions.push(`vff.cd_empresa = $${paramIndex++}`);
      params.push(cd_empresa);
    }
    
    if (cd_cliente) {
      whereConditions.push(`vff.cd_cliente = $${paramIndex++}`);
      params.push(cd_cliente);
    }
    
    // Filtro de data (com padrão se não fornecido)
    if (dt_inicio && dt_fim) {
      whereConditions.push(`vff.dt_emissao BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(dt_inicio, dt_fim);
    } else {
      whereConditions.push(`vff.dt_emissao BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push('2025-05-01', '2025-05-12');
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const query = `
      SELECT
        vff.cd_empresa,
        vff.cd_cliente,
        vff.nm_cliente,
        pp.nm_fantasia,
        vff.nr_fat,
        vff.dt_emissao,
        vff.tp_documento,
        vff.tp_faturamento,
        vff.tp_situacao,
        vff.vl_fatura,
        vff.vl_pago,
        (vff.vl_fatura - vff.vl_pago) AS vl_saldo
      FROM vr_fcr_faturai vff
      LEFT JOIN pes_pesjuridica pp ON pp.cd_pessoa = vff.cd_cliente
      WHERE ${whereClause}
      GROUP BY
        vff.cd_empresa,
        vff.cd_cliente,
        vff.nm_cliente,
        pp.nm_fantasia,
        vff.nr_fat,
        vff.nr_parcela,
        vff.nr_documento,
        vff.dt_emissao,
        vff.tp_documento,
        vff.tp_faturamento,
        vff.tp_situacao,
        vff.vl_fatura,
        vff.vl_pago
      ORDER BY vff.dt_emissao DESC
    `;
    
    const { rows } = await pool.query(query, params);

    // Calcular totais
    const totals = rows.reduce((acc, row) => {
      acc.totalFatura += parseFloat(row.vl_fatura || 0);
      acc.totalPago += parseFloat(row.vl_pago || 0);
      acc.totalSaldo += parseFloat(row.vl_saldo || 0);
      return acc;
    }, { totalFatura: 0, totalPago: 0, totalSaldo: 0 });

    successResponse(res, {
      filtros: { cd_empresa, cd_cliente, dt_inicio, dt_fim, nm_fantasia },
      totais: totals,
      count: rows.length,
      data: rows
    }, 'Consulta de faturas realizada com sucesso');
  })
);

/**
 * @route GET /franchise/fundo-propaganda
 * @desc Buscar dados do fundo de propaganda das franquias
 * @access Public
 * @query {cd_empresa, dt_inicio, dt_fim, nm_fantasia[]}
 */
router.get('/fundo-propaganda',
  sanitizeInput,
  validateDateFormat(['dt_inicio', 'dt_fim']),
  asyncHandler(async (req, res) => {
    let { cd_empresa, dt_inicio, dt_fim, nm_fantasia } = req.query;
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Filtro para nome fantasia
    if (nm_fantasia) {
      let nomes = Array.isArray(nm_fantasia) ? nm_fantasia : [nm_fantasia];
      whereConditions.push(`p.nm_fantasia IN (${nomes.map(() => `$${paramIndex++}`).join(',')})`);
      params.push(...nomes);
    } else {
      whereConditions.push("p.nm_fantasia LIKE 'F%CROSBY%'");
    }

    if (cd_empresa) {
      whereConditions.push(`vfn.cd_empresa = $${paramIndex++}`);
      params.push(cd_empresa);
    }

    // Filtro de data com padrão
    if (dt_inicio && dt_fim) {
      whereConditions.push(`vfn.dt_transacao BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(dt_inicio, dt_fim);
    } else {
      whereConditions.push(`vfn.dt_transacao BETWEEN '2025-07-01' AND '2025-07-15'`);
    }

    // Filtros fixos do fundo de propaganda
    const excludedOperations = [
      1152,590,5153,660,9200,2008,536,1153,599,5920,5930,1711,7111,2009,5152,6029,530,
      5152,5930,650,5010,600,620,40,1557,8600,5910,3336,9003,9052,662,5909,5153,5910,
      3336,9003,530,36,536,1552,51,1556,2500,1126,1127,8160,1122,1102,9986,1128,1553,
      1556,9200,8002,2551,1557,8160,2004,5912,1410
    ];

    whereConditions.push(`vfn.cd_operacao NOT IN (${excludedOperations.join(',')})`);
    whereConditions.push(`vfn.tp_situacao = 4`);
    whereConditions.push(`vfn.cd_grupoempresa < 5999`);
    whereConditions.push(`(f.tp_documento IS NULL OR f.tp_documento <> 20)`);
    whereConditions.push(`vfn.tp_operacao = 'S'`);

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT
        vfn.cd_empresa,
        f.cd_cliente,
        p.nm_fantasia,
        vfn.cd_operacao,
        vfn.tp_situacao,
        vfn.tp_operacao,
        vfn.vl_total,
        vfn.nr_transacao,
        vfn.dt_transacao
      FROM tra_transacao vfn
      LEFT JOIN pes_pesjuridica p ON p.cd_pessoa = vfn.cd_pessoa
      LEFT JOIN fcr_faturai f ON f.cd_cliente = vfn.cd_pessoa
      WHERE ${whereClause}
      GROUP BY
        vfn.cd_empresa,
        f.cd_cliente,
        p.nm_fantasia,
        vfn.cd_operacao,
        vfn.dt_transacao,
        vfn.tp_situacao,
        vfn.tp_operacao,
        vfn.vl_total,
        vfn.nr_transacao
      ORDER BY p.nm_fantasia, vfn.dt_transacao DESC
    `;

    const { rows } = await pool.query(query, params);

    // Agrupar por fantasia
    const groupedData = rows.reduce((acc, row) => {
      const fantasia = row.nm_fantasia || 'Sem Fantasia';
      if (!acc[fantasia]) {
        acc[fantasia] = {
          nm_fantasia: fantasia,
          total_valor: 0,
          total_transacoes: 0,
          transacoes: []
        };
      }
      acc[fantasia].total_valor += parseFloat(row.vl_total || 0);
      acc[fantasia].total_transacoes += 1;
      acc[fantasia].transacoes.push(row);
      return acc;
    }, {});

    successResponse(res, {
      periodo: dt_inicio && dt_fim ? { dt_inicio, dt_fim } : { dt_inicio: '2025-07-01', dt_fim: '2025-07-15' },
      filtros: { cd_empresa, nm_fantasia },
      total_franquias: Object.keys(groupedData).length,
      data: Object.values(groupedData)
    }, 'Dados do fundo de propaganda obtidos com sucesso');
  })
);

/**
 * @route GET /franchise/franquias-credev
 * @desc Buscar franquias com crédito/débito em período específico
 * @access Public
 * @query {dt_inicio, dt_fim}
 */
router.get('/franquias-credev',
  sanitizeInput,
  validateDateFormat(['dt_inicio', 'dt_fim']),
  asyncHandler(async (req, res) => {
    const { dt_inicio, dt_fim, cd_cliente } = req.query;
    let where = [];
    let params = [];
    let idx = 1;

    if (dt_inicio && dt_fim) {
      where.push(`f.dt_emissao BETWEEN $${idx++} AND $${idx++}`);
      params.push(dt_inicio, dt_fim);
    } else {
      // Período padrão se não informado
      where.push(`f.dt_emissao BETWEEN '2025-06-10' AND '2025-06-10'`);
    }

    // Filtro opcional por lista de clientes (IN)
    if (cd_cliente) {
      const clientes = Array.isArray(cd_cliente) ? cd_cliente : [cd_cliente];
      if (clientes.length > 0) {
        const placeholders = clientes.map(() => `$${idx++}`).join(',');
        where.push(`f.cd_cliente IN (${placeholders})`);
        params.push(...clientes);
      }
    }

    where.push(`p.nm_fantasia LIKE 'F%CROSBY%'`);
    where.push(`f.tp_documento = 20`); // Tipo específico para crédito/débito

    const query = `
      SELECT
        f.cd_cliente,
        p.nm_fantasia,
        f.vl_pago,
        f.dt_emissao as dt_fatura,
        f.tp_documento,
        CASE 
          WHEN f.vl_pago > 0 THEN 'CRÉDITO'
          WHEN f.vl_pago < 0 THEN 'DÉBITO'
          ELSE 'NEUTRO'
        END as tipo_movimento
      FROM fcr_faturai f
      LEFT JOIN pes_pesjuridica p ON p.cd_pessoa = f.cd_cliente
      WHERE ${where.join(' AND ')}
      ORDER BY f.dt_emissao DESC, p.nm_fantasia
    `;

    const { rows } = await pool.query(query, params);

    // Calcular estatísticas
    const stats = rows.reduce((acc, row) => {
      const valor = parseFloat(row.vl_pago || 0);
      if (valor > 0) {
        acc.totalCredito += valor;
        acc.qtdCredito += 1;
      } else if (valor < 0) {
        acc.totalDebito += Math.abs(valor);
        acc.qtdDebito += 1;
      }
      acc.saldoTotal = acc.totalCredito - acc.totalDebito;
      return acc;
    }, { totalCredito: 0, totalDebito: 0, qtdCredito: 0, qtdDebito: 0, saldoTotal: 0 });

    successResponse(res, {
      periodo: dt_inicio && dt_fim ? { dt_inicio, dt_fim } : { dt_inicio: '2025-06-10', dt_fim: '2025-06-10' },
      estatisticas: stats,
      count: rows.length,
      data: rows
    }, 'Franquias crédito/débito obtidas com sucesso');
  })
);

export default router;