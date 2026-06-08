// Faturamento Histórico — browser de transações (NF por NF), igual à planilha
// "Crescimento 24x25.xlsx" aba "Base 2425". Fonte: faturamento_transacao_historico.
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CurrencyDollar,
  MagnifyingGlass,
  ArrowsClockwise,
  Download,
  CaretLeft,
  CaretRight,
  Funnel,
  X,
  CloudArrowDown,
  FileXls,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../config/constants';

const CANAIS = [
  { v: '',              label: 'Todos canais',          color: '#64748b' },
  { v: 'varejo',        label: 'Varejo',                color: '#2563eb' },
  { v: 'revenda',       label: 'Revenda',               color: '#16a34a' },
  { v: 'multimarcas',   label: 'Multimarcas',           color: '#9333ea' },
  { v: 'franquia',      label: 'Franquia',              color: '#d97706' },
  { v: 'business',      label: 'Business',              color: '#475569' },
  { v: 'bazar',         label: 'Bazar',                 color: '#ea580c' },
  { v: 'outros',        label: 'Outros (não mapeados)', color: '#94a3b8' },
];
const CANAL_MAP = Object.fromEntries(CANAIS.map((c) => [c.v, c]));

const fmtBRL = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRLcompact = (n) => {
  const x = Number(n || 0);
  if (Math.abs(x) >= 1_000_000) return `R$ ${(x / 1_000_000).toFixed(1)}M`;
  if (Math.abs(x) >= 1_000) return `R$ ${(x / 1_000).toFixed(0)}k`;
  return `R$ ${fmtBRL(x)}`;
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
};

const HOJE_ISO = new Date().toISOString().slice(0, 10);
const ATALHOS = [
  { label: 'Este ano', calc: () => [`${new Date().getFullYear()}-01-01`, HOJE_ISO] },
  { label: 'Ano passado', calc: () => { const a = new Date().getFullYear() - 1; return [`${a}-01-01`, `${a}-12-31`]; } },
  { label: '2024+2025', calc: () => ['2024-01-01', '2025-12-31'] },
  { label: 'Últimos 30d', calc: () => { const d = new Date(); d.setDate(d.getDate() - 30); return [d.toISOString().slice(0,10), HOJE_ISO]; } },
];

export default function FaturamentoHistorico() {
  // ── Filtros ──
  const [datemin, setDatemin] = useState('2024-01-01');
  const [datemax, setDatemax] = useState('2025-12-31');
  const [canal, setCanal] = useState('');
  const [busca, setBusca] = useState('');
  const [loja, setLoja] = useState('');
  const [order, setOrder] = useState('data_desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // ── Estado ──
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState('');

  // ── Carregar listagem ──
  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (datemin) qs.set('datemin', datemin);
      if (datemax) qs.set('datemax', datemax);
      if (canal) qs.set('canal', canal);
      if (busca) qs.set('busca', busca);
      if (loja) qs.set('loja', loja);
      qs.set('order', order);
      qs.set('page', page);
      qs.set('pageSize', pageSize);
      const r = await fetch(`${API_BASE_URL}/api/faturamento-transacao?${qs}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      setItems(j.items || []);
      setTotal(j.total || 0);
      setTotalPages(j.totalPages || 1);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [datemin, datemax, canal, busca, loja, order, page, pageSize]);

  // ── Carregar resumo (totais reais do range filtrado) ──
  const carregarResumo = useCallback(async () => {
    setLoadingResumo(true);
    try {
      const qs = new URLSearchParams();
      if (datemin) qs.set('datemin', datemin);
      if (datemax) qs.set('datemax', datemax);
      if (canal) qs.set('canal', canal);
      if (busca) qs.set('busca', busca);
      if (loja) qs.set('loja', loja);
      const r = await fetch(`${API_BASE_URL}/api/faturamento-transacao/resumo?${qs}`);
      const j = await r.json();
      if (r.ok) setResumo(j);
    } catch (e) {
      // resumo é opcional
    } finally {
      setLoadingResumo(false);
    }
  }, [datemin, datemax, canal, busca, loja]);

  // Debounce de busca/filtros
  useEffect(() => {
    setPage(1);
  }, [datemin, datemax, canal, busca, loja]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  // Resumo recarrega quando filtros mudam (mas não na paginação)
  useEffect(() => {
    const t = setTimeout(carregarResumo, 500);
    return () => clearTimeout(t);
  }, [carregarResumo]);

  const aplicarAtalho = (a) => {
    const [d1, d2] = a.calc();
    setDatemin(d1);
    setDatemax(d2);
  };

  const limparFiltros = () => {
    setCanal('');
    setBusca('');
    setLoja('');
    setOrder('data_desc');
  };

  const sincronizarTotvs = async () => {
    if (!window.confirm(
      `Sincronizar transações do TOTVS para o período ${datemin} → ${datemax}?\n\n` +
      `Lê das notas fiscais já baixadas (sem usar usuário do TOTVS).`
    )) return;
    setSincronizando(true);
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/faturamento-transacao/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datemin, datemax }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || j?.error || 'Erro');
      alert(
        `✅ Sincronização concluída!\n\n` +
        `Lidos da Supabase Fiscal: ${j.lidos_notas_fiscais}\n` +
        `Inseridos/atualizados: ${j.inseridos_ou_atualizados}\n` +
        `Ignorados (cancelados/etc): ${j.ignorados}`
      );
      carregar();
      carregarResumo();
    } catch (e) {
      setErro(`Sync falhou: ${e.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const exportarExcel = async () => {
    if (total > 100000) {
      if (!window.confirm(`O export tem ${total.toLocaleString('pt-BR')} linhas. Pode levar 1-2min e gerar arquivo grande. Continuar?`)) return;
    }
    try {
      // Busca tudo paginado
      const qs = new URLSearchParams();
      if (datemin) qs.set('datemin', datemin);
      if (datemax) qs.set('datemax', datemax);
      if (canal) qs.set('canal', canal);
      if (busca) qs.set('busca', busca);
      if (loja) qs.set('loja', loja);
      qs.set('order', order);
      qs.set('pageSize', 500);
      let allRows = [];
      const totalPg = Math.ceil(total / 500);
      for (let p = 1; p <= totalPg; p++) {
        qs.set('page', p);
        const r = await fetch(`${API_BASE_URL}/api/faturamento-transacao?${qs}`);
        const j = await r.json();
        allRows.push(...(j.items || []));
      }

      // Monta planilha estruturada
      const rows = allRows.map((i) => ({
        Loja: i.loja || '',
        Data: fmtDate(i.data_transacao),
        'Cod Cliente': i.cod_cliente || '',
        Cliente: i.cliente_nome || '',
        'Tipo Cliente': i.tipo_cliente || '',
        Canal: i.canal || '',
        'VL.FAT.': Number(i.vl_fat || 0),
        'CREDEV': Number(i.credev || 0),
        'Total': Number(i.total || 0),
        'Cidade/UF': i.cidade_uf || '',
        Fone: i.fone || '',
        'Observação': i.observacao || '',
        Origem: i.origem || '',
      }));

      // Cria worksheet
      const ws = XLSX.utils.json_to_sheet(rows);

      // Formatação BR de moeda nas colunas G, H, I (VL.FAT, CREDEV, Total)
      const fmtBR = '#,##0.00;(#,##0.00)';
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        for (const C of [6, 7, 8]) { // 0-indexed: G=6, H=7, I=8
          const cell = XLSX.utils.encode_cell({ r: R, c: C });
          if (ws[cell]) ws[cell].z = fmtBR;
        }
      }

      // Larguras de coluna ajustadas
      ws['!cols'] = [
        { wch: 35 }, // Loja
        { wch: 12 }, // Data
        { wch: 10 }, // Cod
        { wch: 35 }, // Cliente
        { wch: 18 }, // Tipo
        { wch: 14 }, // Canal
        { wch: 12 }, // VL.FAT
        { wch: 10 }, // CREDEV
        { wch: 12 }, // Total
        { wch: 25 }, // Cidade/UF
        { wch: 18 }, // Fone
        { wch: 30 }, // Observação
        { wch: 12 }, // Origem
      ];

      // Aba RESUMO com totais por canal
      const resumoCanal = {};
      let tVlFat = 0, tCredev = 0, tTotal = 0;
      for (const i of allRows) {
        const c = i.canal || 'sem canal';
        if (!resumoCanal[c]) resumoCanal[c] = { NFs: 0, 'VL.FAT.': 0, 'CREDEV': 0, 'Total': 0 };
        resumoCanal[c].NFs += 1;
        resumoCanal[c]['VL.FAT.'] += Number(i.vl_fat || 0);
        resumoCanal[c]['CREDEV'] += Number(i.credev || 0);
        resumoCanal[c]['Total'] += Number(i.total || 0);
        tVlFat += Number(i.vl_fat || 0);
        tCredev += Number(i.credev || 0);
        tTotal += Number(i.total || 0);
      }
      const resumoRows = Object.entries(resumoCanal)
        .sort((a, b) => b[1].Total - a[1].Total)
        .map(([canal, v]) => ({ Canal: canal, ...v }));
      resumoRows.push({ Canal: '— TOTAL GERAL —', NFs: allRows.length, 'VL.FAT.': tVlFat, 'CREDEV': tCredev, 'Total': tTotal });
      const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
      // Formatação BR
      const rangeR = XLSX.utils.decode_range(wsResumo['!ref']);
      for (let R = rangeR.s.r + 1; R <= rangeR.e.r; R++) {
        for (const C of [2, 3, 4]) {
          const cell = XLSX.utils.encode_cell({ r: R, c: C });
          if (wsResumo[cell]) wsResumo[cell].z = fmtBR;
        }
      }
      wsResumo['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];

      // Aba FILTROS aplicados
      const wsInfo = XLSX.utils.json_to_sheet([
        { Filtro: 'Período', Valor: `${datemin} → ${datemax}` },
        { Filtro: 'Canal', Valor: canal || 'Todos' },
        { Filtro: 'Loja', Valor: loja || '—' },
        { Filtro: 'Busca', Valor: busca || '—' },
        { Filtro: 'Ordem', Valor: order },
        { Filtro: 'Total NFs exportadas', Valor: allRows.length },
        { Filtro: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
      ]);
      wsInfo['!cols'] = [{ wch: 25 }, { wch: 35 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Canal');
      XLSX.utils.book_append_sheet(wb, ws, 'Transações');
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Filtros');

      XLSX.writeFile(
        wb,
        `faturamento-detalhado-${datemin}_a_${datemax}.xlsx`,
        { compression: true },
      );
    } catch (e) {
      alert('❌ Falha no export Excel: ' + e.message);
    }
  };

  const exportarCsv = async () => {
    if (total > 50000) {
      if (!window.confirm(`O export atual tem ${total.toLocaleString('pt-BR')} linhas. Pode levar minutos. Continuar?`)) return;
    }
    try {
      // Busca tudo paginado pra exportar
      const qs = new URLSearchParams();
      if (datemin) qs.set('datemin', datemin);
      if (datemax) qs.set('datemax', datemax);
      if (canal) qs.set('canal', canal);
      if (busca) qs.set('busca', busca);
      if (loja) qs.set('loja', loja);
      qs.set('order', order);
      qs.set('pageSize', 500);
      let allRows = [];
      const totalPg = Math.ceil(total / 500);
      for (let p = 1; p <= totalPg; p++) {
        qs.set('page', p);
        const r = await fetch(`${API_BASE_URL}/api/faturamento-transacao?${qs}`);
        const j = await r.json();
        allRows.push(...(j.items || []));
      }
      const headers = ['Loja','Data','Cod Cliente','Cliente','Tipo Cliente','Canal','VL.FAT.','CREDEV','Total','Cidade/UF','Fone','Obs'];
      const linhas = allRows.map((i) => [
        i.loja || '', fmtDate(i.data_transacao),
        i.cod_cliente || '', i.cliente_nome || '',
        i.tipo_cliente || '', i.canal || '',
        String(i.vl_fat || 0).replace('.', ','),
        String(i.credev || 0).replace('.', ','),
        String(i.total || 0).replace('.', ','),
        i.cidade_uf || '', i.fone || '', i.observacao || '',
      ]);
      const csv = [headers, ...linhas]
        .map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(';'))
        .join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `faturamento-transacoes-${datemin}_a_${datemax}.csv`;
      link.click();
    } catch (e) {
      alert('❌ Falha no export: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 py-6">
      <div className="max-w-[1700px] mx-auto px-6">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#000638] via-[#0a1a5c] to-[#001a8a] shadow-xl mb-4">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative px-6 py-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                <CurrencyDollar size={28} weight="duotone" className="text-blue-200" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  Faturamento Detalhado
                </h1>
                <p className="text-sm text-blue-200/80 mt-1">
                  Browser de transações (NF por NF) · base importada de planilha + sync TOTVS
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-blue-300/80 font-bold">Total filtrado</p>
              <p className="text-3xl font-black text-white tabular-nums leading-none mt-1">
                {resumo ? `R$ ${fmtBRL(resumo.total_liquido)}` : '—'}
              </p>
              <p className="text-[10px] text-blue-300/80 mt-1">
                {resumo ? `${resumo.n_transacoes.toLocaleString('pt-BR')} NFs` : `${total.toLocaleString('pt-BR')} resultados`}
              </p>
            </div>
          </div>
        </div>

        {/* KPIs detalhados (VL.FAT, CREDEV, Total) */}
        {resumo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">VL.FAT (bruto)</p>
              <p className="text-2xl font-black text-gray-800 tabular-nums mt-1">R$ {fmtBRL(resumo.total_vl_fat)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-rose-500 font-bold">CREDEV</p>
              <p className="text-2xl font-black text-rose-600 tabular-nums mt-1">− R$ {fmtBRL(resumo.total_credev)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Total Líquido</p>
              <p className="text-2xl font-black text-emerald-700 tabular-nums mt-1">R$ {fmtBRL(resumo.total_liquido)}</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-3 p-3 flex items-center gap-3 flex-wrap">
          <Funnel size={16} className="text-gray-400" />
          {/* Datas */}
          <div className="flex items-center gap-2 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-2 py-1">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Período</span>
            <input
              type="date"
              value={datemin}
              onChange={(e) => setDatemin(e.target.value)}
              className="text-xs border-0 bg-transparent focus:outline-none w-[110px] tabular-nums"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={datemax}
              onChange={(e) => setDatemax(e.target.value)}
              className="text-xs border-0 bg-transparent focus:outline-none w-[110px] tabular-nums"
            />
          </div>
          {/* Atalhos */}
          {ATALHOS.map((a) => (
            <button
              key={a.label}
              onClick={() => aplicarAtalho(a)}
              className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-700 font-medium transition"
            >
              {a.label}
            </button>
          ))}
          <span className="text-gray-300 mx-1">|</span>
          {/* Canal */}
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
          {/* Loja */}
          <input
            type="text"
            value={loja}
            onChange={(e) => setLoja(e.target.value)}
            placeholder="Loja…"
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {/* Busca cliente */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou loja…"
              className="text-sm pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {(canal || busca || loja) && (
            <button
              onClick={limparFiltros}
              className="text-[11px] px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium inline-flex items-center gap-1"
            >
              <X size={11} weight="bold" /> Limpar
            </button>
          )}
          <button
            onClick={() => { carregar(); carregarResumo(); }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 font-medium text-gray-700"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={sincronizarTotvs}
            disabled={sincronizando}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-sm disabled:opacity-50"
            title="Copia NFs já baixadas (notas_fiscais) → histórico. NÃO usa usuário TOTVS."
          >
            <CloudArrowDown size={14} weight="bold" className={sincronizando ? 'animate-pulse' : ''} />
            {sincronizando ? 'Sincronizando…' : 'Sincronizar TOTVS'}
          </button>
          <button
            onClick={exportarExcel}
            disabled={!total || loading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm disabled:opacity-50"
            title="Baixa relatório completo em Excel (3 abas: Resumo · Transações · Filtros)"
          >
            <FileXls size={14} weight="bold" />
            Excel
          </button>
          <button
            onClick={exportarCsv}
            disabled={!total || loading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
            title="CSV simples"
          >
            <Download size={14} weight="bold" />
            CSV
          </button>
        </div>

        {erro && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            Erro: {erro}
          </div>
        )}

        {/* Tabela de transações */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-b from-slate-100 to-slate-50 border-b border-gray-200">
                  <th className="py-2 px-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider">Loja</th>
                  <th onClick={() => setOrder(order === 'data_desc' ? 'data_asc' : 'data_desc')}
                      className="py-2 px-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider cursor-pointer hover:text-blue-700 whitespace-nowrap">
                    Data {order === 'data_desc' ? '↓' : order === 'data_asc' ? '↑' : ''}
                  </th>
                  <th className="py-2 px-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider w-20">Cod</th>
                  <th onClick={() => setOrder(order === 'cliente_asc' ? 'data_desc' : 'cliente_asc')}
                      className="py-2 px-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider cursor-pointer hover:text-blue-700">
                    Cliente {order === 'cliente_asc' ? '↑' : ''}
                  </th>
                  <th className="py-2 px-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider">Canal</th>
                  <th className="py-2 px-2 text-right text-[10px] font-black text-gray-700 uppercase tracking-wider">VL.FAT.</th>
                  <th className="py-2 px-2 text-right text-[10px] font-black text-rose-600 uppercase tracking-wider">Credev</th>
                  <th onClick={() => setOrder(order === 'valor_desc' ? 'valor_asc' : 'valor_desc')}
                      className="py-2 px-2 text-right text-[10px] font-black text-emerald-700 uppercase tracking-wider cursor-pointer hover:text-blue-700">
                    Total {order === 'valor_desc' ? '↓' : order === 'valor_asc' ? '↑' : ''}
                  </th>
                  <th className="py-2 px-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider">Cidade/UF</th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr><td colSpan={9} className="py-16 text-center text-gray-400">
                    <div className="inline-flex items-center gap-2">
                      <ArrowsClockwise size={18} className="animate-spin" />
                      Carregando…
                    </div>
                  </td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={9} className="py-16 text-center text-gray-400 text-sm">
                    Nenhuma transação encontrada nos filtros.
                  </td></tr>
                ) : items.map((i) => {
                  const cfg = CANAL_MAP[i.canal] || { label: (i.canal || '').toUpperCase(), color: '#94a3b8' };
                  return (
                    <tr key={i.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                      <td className="py-1 px-2 text-gray-600 whitespace-nowrap max-w-[180px] truncate" title={i.loja || ''}>
                        {i.loja || '—'}
                      </td>
                      <td className="py-1 px-2 text-gray-700 font-mono whitespace-nowrap">
                        {fmtDate(i.data_transacao)}
                      </td>
                      <td className="py-1 px-2 text-gray-500 font-mono">{i.cod_cliente || '—'}</td>
                      <td className="py-1 px-2 text-gray-800 max-w-[200px] truncate" title={i.cliente_nome || ''}>
                        {i.cliente_nome || '—'}
                      </td>
                      <td className="py-1 px-2">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
                          style={{ backgroundColor: cfg.color + '20', color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums text-gray-700">R$ {fmtBRL(i.vl_fat)}</td>
                      <td className="py-1 px-2 text-right tabular-nums text-rose-600">
                        {Number(i.credev) > 0 ? `R$ ${fmtBRL(i.credev)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums font-bold text-emerald-700">R$ {fmtBRL(i.total)}</td>
                      <td className="py-1 px-2 text-gray-500 whitespace-nowrap text-[11px]">{i.cidade_uf || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center gap-3 flex-wrap text-xs">
            <span className="text-gray-600">
              Página <b>{page}</b> de <b>{totalPages.toLocaleString('pt-BR')}</b> · {total.toLocaleString('pt-BR')} NFs no filtro
            </span>
            <span className="text-gray-300">|</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option value={50}>50/pg</option>
              <option value={100}>100/pg</option>
              <option value={200}>200/pg</option>
              <option value={500}>500/pg</option>
            </select>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 font-bold"
              >
                ⏮
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <CaretLeft size={11} weight="bold" /> Anterior
              </button>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={page}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(totalPages, parseInt(e.target.value, 10) || 1));
                  setPage(n);
                }}
                className="text-xs border border-gray-300 rounded px-2 py-1 w-16 text-center tabular-nums"
              />
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 inline-flex items-center gap-1"
              >
                Próxima <CaretRight size={11} weight="bold" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 font-bold"
              >
                ⏭
              </button>
            </div>
          </div>
        </div>

        {/* Resumo por canal */}
        {resumo?.por_canal && Object.keys(resumo.por_canal).length > 0 && (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1 h-4 bg-blue-500 rounded" />
              <h3 className="text-sm font-bold text-gray-800">Resumo por canal (no período filtrado)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                    <th className="text-left py-1.5 px-2 font-black">Canal</th>
                    <th className="text-right py-1.5 px-2 font-black">NFs</th>
                    <th className="text-right py-1.5 px-2 font-black">VL.FAT.</th>
                    <th className="text-right py-1.5 px-2 font-black">Credev</th>
                    <th className="text-right py-1.5 px-2 font-black">Total Líquido</th>
                    <th className="text-right py-1.5 px-2 font-black">%</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(resumo.por_canal)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([k, v]) => {
                      const cfg = CANAL_MAP[k] || { label: k.toUpperCase(), color: '#94a3b8' };
                      const pct = resumo.total_liquido > 0 ? (v.total / resumo.total_liquido * 100) : 0;
                      return (
                        <tr key={k} className="border-b border-gray-100 hover:bg-blue-50/30">
                          <td className="py-1.5 px-2">
                            <span style={{ color: cfg.color }} className="font-bold">{cfg.label}</span>
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{v.count.toLocaleString('pt-BR')}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">R$ {fmtBRL(v.vl_fat)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-rose-600">
                            {v.credev > 0 ? `R$ ${fmtBRL(v.credev)}` : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-bold text-emerald-700">R$ {fmtBRL(v.total)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-bold text-gray-600">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
