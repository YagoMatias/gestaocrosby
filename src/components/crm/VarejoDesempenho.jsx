// Sub-aba "Desempenho" — Reunião do Varejo
// Top N vendedoras por faturamento + métricas (TM, PA, PMPV)
// Padrão visual: Ranking de Faturamento (Crosby)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy,
  Funnel,
  Spinner,
  MagnifyingGlass,
  ChartBar,
  CurrencyDollar,
  ShoppingCart,
  Tote,
  Users,
  Buildings,
  Crown,
  Medal,
} from '@phosphor-icons/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '../ui/cards';
import { API_BASE_URL } from '../../config/constants';

const formatBRL = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '-';
const formatInt = (v) => Number(v || 0).toLocaleString('pt-BR');

const ORDENAR_POR = [
  { id: 'invoice_value', label: 'Faturamento' },
  { id: 'comissao', label: 'Comissão' },
  { id: 'pct_meta', label: '% Meta' },
  { id: 'tm', label: 'Ticket Médio' },
  { id: 'pa', label: 'PA' },
  { id: 'pmpv', label: 'PMPV' },
  { id: 'invoice_qty', label: 'Atendimentos' },
];

// Bolinha de posição: top3 dourado/prata/bronze, demais azul Crosby
function getPositionBadge(position) {
  if (position === 0) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-white shadow"
        title="1º lugar"
      >
        <Crown size={14} weight="fill" />
      </span>
    );
  }
  if (position === 1) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400 text-white shadow"
        title="2º lugar"
      >
        <Medal size={14} weight="fill" />
      </span>
    );
  }
  if (position === 2) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white shadow"
        title="3º lugar"
      >
        <Medal size={14} weight="fill" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#000638] text-white text-xs font-bold font-barlow">
      {position + 1}
    </span>
  );
}

export default function VarejoDesempenho() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(inicioMes);
  const [endDate, setEndDate] = useState(hoje);
  const [presetAtivo, setPresetAtivo] = useState('mes_atual');

  // Calcula um range com base em um preset
  const aplicarPreset = (id) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const dow = today.getDay(); // 0=dom, 1=seg, ..., 6=sáb
    let di, df;
    if (id === 'semana_atual') {
      // segunda da semana corrente → hoje
      const seg = new Date(today);
      const daysSinceMonday = dow === 0 ? 6 : dow - 1;
      seg.setDate(today.getDate() - daysSinceMonday);
      di = fmt(seg); df = fmt(today);
    } else if (id === 'semana_passada') {
      // segunda passada → domingo passado
      const daysSinceMonday = dow === 0 ? 6 : dow - 1;
      const segPassada = new Date(today);
      segPassada.setDate(today.getDate() - daysSinceMonday - 7);
      const domPassado = new Date(segPassada);
      domPassado.setDate(segPassada.getDate() + 6);
      di = fmt(segPassada); df = fmt(domPassado);
    } else if (id === 'mes_atual') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      di = fmt(first); df = fmt(today);
    } else if (id === 'mes_passado') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      di = fmt(first); df = fmt(last);
    }
    if (di && df) {
      setStartDate(di);
      setEndDate(df);
      setPresetAtivo(id);
    }
  };

  const PRESETS_DATA = [
    { id: 'semana_passada', label: 'Última semana' },
    { id: 'semana_atual', label: 'Semana atual' },
    { id: 'mes_atual', label: 'Este mês' },
    { id: 'mes_passado', label: 'Mês passado' },
  ];
  const [ordenarPor, setOrdenarPor] = useState('invoice_value');
  const [topN, setTopN] = useState(10);
  const [comissaoPct, setComissaoPct] = useState(3); // % comissão (padrão 3%)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    if (!startDate || !endDate) {
      setError('Informe o período');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Usa a MESMA fonte do CRM → Performance (/api/crm/sellers-totals com modulo=varejo)
      // - Mesma lógica de segmentação do /faturamento-por-segmento
      // - Desconta credev, exclui canceladas, separa inbound/franquia/revenda
      // - Garante que os números batem com a tela Performance
      const monthKey = startDate.slice(0, 7); // YYYY-MM
      const [sellersResp, metaResp] = await Promise.all([
        fetch(`${API_BASE_URL}/api/crm/sellers-totals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datemin: startDate,
            datemax: endDate,
            modulo: 'varejo',
          }),
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/crm/canal-metas?period_type=mensal&period_key=${monthKey}&canal=varejo`)
          .then((r) => r.json())
          .catch(() => ({ success: false })),
      ]);
      if (!sellersResp?.success) throw new Error(sellersResp?.message || 'Erro');
      const metaVarejo = (metaResp?.data?.metas || []).find((m) => m.canal === 'varejo');

      // sellers-totals não retorna `totals` agregado — calcula no front
      const rows = sellersResp.data?.dataRow || [];
      const sum = rows.reduce(
        (acc, r) => {
          acc.invoice_value += Number(r.invoice_value || 0);
          acc.invoice_qty += Number(r.invoice_qty || 0);
          acc.itens_qty += Number(r.itens_qty || 0);
          return acc;
        },
        { invoice_value: 0, invoice_qty: 0, itens_qty: 0 },
      );
      const totals = {
        invoice_value: sum.invoice_value,
        invoice_qty: sum.invoice_qty,
        itens_qty: sum.itens_qty,
        tm: sum.invoice_qty > 0 ? sum.invoice_value / sum.invoice_qty : 0,
        pa: sum.invoice_qty > 0 ? sum.itens_qty / sum.invoice_qty : 0,
        pmpv: sum.itens_qty > 0 ? sum.invoice_value / sum.itens_qty : 0,
      };

      setData({
        dataRow: rows,
        totals,
        meta_mensal_varejo: Number(metaVarejo?.valor_meta || 0),
        month_key: monthKey,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { handleSearch(); /* eslint-disable-next-line */ }, []);

  // Calcula meta estimada por vendedora (proporcional aos dias do período)
  // meta_estimada = (meta_mensal_varejo × dias_periodo / dias_mes) / N_vendedoras
  const metaEstimadaPorVendedora = useMemo(() => {
    const metaMes = Number(data?.meta_mensal_varejo || 0);
    const ps = data?.dataRow || [];
    if (!metaMes || !ps.length) return 0;
    // Dias do mês de referência
    const monthKey = data?.month_key || startDate.slice(0, 7);
    const [y, m] = monthKey.split('-').map(Number);
    const diasMes = new Date(y, m, 0).getDate();
    // Dias do período selecionado
    const dStart = new Date(`${startDate}T12:00:00`);
    const dEnd = new Date(`${endDate}T12:00:00`);
    const diasPeriodo = Math.max(1, Math.round((dEnd - dStart) / 86400000) + 1);
    const metaPeriodo = (metaMes * diasPeriodo) / diasMes;
    return metaPeriodo / ps.length;
  }, [data, startDate, endDate]);

  // Enriquece dataRow com meta_estimada + %_meta + comissao
  const todasVendedoras = useMemo(() => {
    const ps = data?.dataRow || [];
    const taxa = Math.max(0, Number(comissaoPct) || 0) / 100;
    return ps.map((v) => {
      const meta = metaEstimadaPorVendedora;
      const fat = Number(v.invoice_value || 0);
      const pct = meta > 0 ? (fat / meta) * 100 : 0;
      const comissao = fat * taxa;
      return { ...v, meta_estimada: meta, pct_meta: pct, comissao };
    });
  }, [data, metaEstimadaPorVendedora, comissaoPct]);

  const vendedoras = useMemo(() => {
    const sorted = [...todasVendedoras].sort((a, b) => Number(b[ordenarPor] || 0) - Number(a[ordenarPor] || 0));
    return sorted.slice(0, topN);
  }, [todasVendedoras, ordenarPor, topN]);

  // Resumo geral — usa totals agregados que vêm direto do TOTVS
  const resumo = useMemo(() => {
    const t = data?.totals || {};
    const taxa = Math.max(0, Number(comissaoPct) || 0) / 100;
    const fatTotal = Number(t.invoice_value || 0);
    return {
      total_vendedoras: todasVendedoras.length,
      faturamento_total: fatTotal,
      total_atendimentos: Number(t.invoice_qty || 0),
      ticket_medio_geral: Number(t.tm || 0),
      pa_geral: Number(t.pa || 0),
      pmpv_geral: Number(t.pmpv || 0),
      comissao_total: fatTotal * taxa,
    };
  }, [data, todasVendedoras.length, comissaoPct]);

  return (
    <div className="w-full flex flex-col items-stretch justify-start py-1 font-barlow">
      {/* ── FILTROS ────────────────────────────────────── */}
      <div className="flex flex-col bg-white p-3 sm:p-4 rounded-xl shadow-md w-full mx-auto border border-[#000638]/10 mb-4">
        <span className="text-sm sm:text-base font-bold text-[#000638] flex items-center gap-1.5 mb-0.5 font-barlow">
          <Funnel size={16} weight="bold" />
          Filtros
        </span>
        <span className="text-xs text-gray-500 mb-3 font-barlow">
          Selecione o período e o critério de ordenação do ranking
        </span>

        {/* Presets de período */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {PRESETS_DATA.map((p) => (
            <button
              key={p.id}
              onClick={() => aplicarPreset(p.id)}
              className={`text-xs px-3 py-1 rounded-full font-bold transition-all duration-150 font-barlow ${
                presetAtivo === p.id
                  ? 'bg-[#000638] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638] font-barlow">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPresetAtivo(''); }}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs font-barlow"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638] font-barlow">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPresetAtivo(''); }}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs font-barlow"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638] font-barlow">Ordenar por</label>
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs font-barlow"
            >
              {ORDENAR_POR.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638] font-barlow">Top</label>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs font-barlow"
            >
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638] font-barlow">Comissão %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={comissaoPct}
              onChange={(e) => setComissaoPct(Number(e.target.value))}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs font-barlow"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold shadow-md tracking-wide uppercase w-full sm:w-auto font-barlow"
            >
              {loading ? (
                <Spinner size={14} className="animate-spin" />
              ) : (
                <MagnifyingGlass size={14} weight="bold" />
              )}
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs sm:text-sm text-red-700 font-barlow">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-gray-400">
          <Spinner size={36} className="animate-spin mb-3" />
          <p className="text-sm font-medium font-barlow">Carregando dados...</p>
          <p className="text-xs text-gray-300 mt-1 font-barlow">Isso pode levar alguns segundos</p>
        </div>
      )}

      {!loading && vendedoras.length > 0 && (
        <>
          {/* ── CARDS DE RESUMO ───────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollar size={14} weight="bold" className="text-green-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-green-700 font-barlow">
                    Faturamento Total
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-green-600 break-words font-barlow">
                  R$ {formatBRL(resumo.faturamento_total)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  Todas as vendedoras
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart size={14} weight="bold" className="text-blue-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-blue-700 font-barlow">
                    Ticket Médio
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-blue-600 break-words font-barlow">
                  R$ {formatBRL(resumo.ticket_medio_geral)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  Valor médio por venda
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <Tote size={14} weight="bold" className="text-purple-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-purple-700 font-barlow">
                    PA
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-purple-600 break-words font-barlow">
                  {resumo.pa_geral.toFixed(2)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  Peças por atendimento
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollar size={14} weight="bold" className="text-orange-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-orange-700 font-barlow">
                    PMPV
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-orange-600 break-words font-barlow">
                  R$ {formatBRL(resumo.pmpv_geral)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  Preço médio por peça
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollar size={14} weight="bold" className="text-pink-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-pink-700 font-barlow">
                    Comissão Total
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-pink-600 break-words font-barlow">
                  R$ {formatBRL(resumo.comissao_total)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  {comissaoPct}% do faturamento
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <Users size={14} weight="bold" className="text-[#000638]" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-[#000638] font-barlow">
                    Vendedoras
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-[#000638] break-words font-barlow">
                  {formatInt(resumo.total_vendedoras)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  {formatInt(resumo.total_atendimentos)} atendimentos
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* ── RANKING ───────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-md border border-[#000638]/10 w-full overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#000638]/10 flex items-center gap-2">
              <Trophy size={16} weight="fill" className="text-yellow-500" />
              <h2 className="text-xs sm:text-sm font-bold text-[#000638] font-barlow">
                Top {topN} Vendedoras
              </h2>
              <span className="ml-auto text-[10px] sm:text-xs text-gray-400 font-barlow hidden sm:inline">
                Ordenado por <strong>{ORDENAR_POR.find((o) => o.id === ordenarPor)?.label}</strong>
              </span>
            </div>

            {/* Header desktop */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-[#000638] text-white text-[10px] font-bold uppercase tracking-wider font-barlow">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-2">Vendedora</div>
              <div className="col-span-1">Loja</div>
              <div className="col-span-2 text-right">Faturamento</div>
              <div className="col-span-2 text-right" title="Meta estimada proporcional ao período (mensal varejo ÷ N vendedoras)">
                Meta / %
              </div>
              <div className="col-span-1 text-right" title={`Comissão = ${comissaoPct}% do faturamento`}>Comissão</div>
              <div className="col-span-1 text-right">TM</div>
              <div className="col-span-1 text-right">PA</div>
              <div className="col-span-1 text-right">PMPV</div>
            </div>

            {vendedoras.map((v, idx) => (
              <div
                key={`${v.seller_code}-${idx}`}
                className={`w-full transition-all duration-150 border-b border-gray-100 last:border-b-0 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                {/* Mobile card */}
                <div className="md:hidden p-3 flex items-start gap-2.5">
                  <div className="flex-shrink-0 mt-0.5">
                    {getPositionBadge(idx)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate font-barlow ${idx < 3 ? 'text-[#000638]' : 'text-gray-700'}`}>
                      {v.seller_name}
                    </p>
                    <p className="text-[10px] text-gray-500 font-barlow flex items-center gap-1">
                      <Buildings size={10} weight="bold" />
                      {v.branch_short || v.branch_name || `#${v.branch_code}`}
                    </p>
                    <p className="text-sm font-bold font-mono mt-0.5 text-green-700">
                      R$ {formatBRL(v.invoice_value)}
                    </p>
                    {v.meta_estimada > 0 && (
                      <p className="text-[10px] text-gray-500 font-barlow">
                        Meta: <strong className="text-gray-700">R$ {formatBRL(v.meta_estimada)}</strong>
                        <span className={`ml-1 px-1.5 py-0 rounded text-[9px] font-bold ${
                          v.pct_meta >= 100 ? 'bg-emerald-100 text-emerald-700'
                          : v.pct_meta >= 70 ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                        }`}>
                          {v.pct_meta.toFixed(0)}%
                        </span>
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500 font-barlow mt-0.5">
                      Comissão ({comissaoPct}%): <strong className="text-pink-700">R$ {formatBRL(v.comissao)}</strong>
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-500 font-barlow">
                      <span>Atend.: <strong className="text-gray-700">{formatInt(v.invoice_qty)}</strong></span>
                      <span>TM: <strong className="text-blue-700">R$ {formatBRL(v.tm)}</strong></span>
                      <span>PA: <strong className="text-purple-700">{Number(v.pa || 0).toFixed(2)}</strong></span>
                      <span>PMPV: <strong className="text-orange-700">R$ {formatBRL(v.pmpv)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm">
                  <div className="col-span-1 text-center">
                    {getPositionBadge(idx)}
                  </div>
                  <div className="col-span-2 text-left truncate">
                    <span className={`font-semibold font-barlow ${idx < 3 ? 'text-[#000638]' : 'text-gray-700'}`}>
                      {v.seller_name}
                    </span>
                  </div>
                  <div className="col-span-1 text-left text-xs text-gray-600 truncate font-barlow inline-flex items-center gap-1">
                    <Buildings size={11} weight="bold" className="text-gray-400" />
                    {v.branch_short || v.branch_name || `#${v.branch_code}`}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-bold font-mono text-xs text-green-700">
                      R$ {formatBRL(v.invoice_value)}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="font-mono text-xs text-gray-700">
                      {v.meta_estimada > 0 ? `R$ ${formatBRL(v.meta_estimada)}` : <span className="text-gray-400">—</span>}
                    </div>
                    {v.meta_estimada > 0 && (
                      <div className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-bold ${
                        v.pct_meta >= 100 ? 'bg-emerald-100 text-emerald-700'
                        : v.pct_meta >= 70 ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                      }`}>
                        {v.pct_meta.toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-pink-700 font-mono font-bold text-xs" title={`${comissaoPct}% sobre R$ ${formatBRL(v.invoice_value)}`}>
                      R$ {formatBRL(v.comissao)}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-blue-700 font-mono font-medium text-xs">R$ {formatBRL(v.tm)}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-purple-700 font-mono font-medium text-xs">{Number(v.pa || 0).toFixed(2)}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-orange-700 font-mono font-medium text-xs">R$ {formatBRL(v.pmpv)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty */}
      {!loading && data && vendedoras.length === 0 && !error && (
        <div className="text-center py-16 sm:py-20 text-gray-400">
          <Trophy size={48} weight="light" className="mx-auto mb-3 opacity-30" />
          <p className="text-xs sm:text-sm font-medium font-barlow">
            Nenhum vendedor com vendas no período selecionado.
          </p>
        </div>
      )}
    </div>
  );
}
