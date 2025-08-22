import express from 'express';
import pool from '../config/database.js';
import { validateDateFormat, sanitizeInput } from '../middlewares/validation.middleware.js';
import { asyncHandler, successResponse, errorResponse } from '../utils/errorHandler.js';

const router = express.Router();



/**
 * @route GET /franchise/fundo-propaganda
 * @desc Buscar dados do fundo de propaganda das franquias
 * @access Public
 * @query {cd_empresa, dt_inicio, dt_fim, nm_fantasia[]}
 */


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
    const { dt_inicio, dt_fim } = req.query;
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