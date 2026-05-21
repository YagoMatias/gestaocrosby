// Ranking de Compras das Franquias — sellin (matriz → franquia)
// Mostra quanto cada franquia comprou da empresa 99 (matriz) no período.
// Click numa franquia → modal com NFs detalhadas (compras + credev).
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '../components/ui/cards';
import {
  Spinner,
  MagnifyingGlass,
  ChartBar,
  Buildings,
  CurrencyDollar,
  Trophy,
  ShoppingCart,
  Funnel,
  Storefront,
  X,
  Package,
} from '@phosphor-icons/react';

// ==========================================
// HELPERS
// ==========================================
const formatBRL = (value) =>
  typeof value === 'number'
    ? value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '-';

// Badge que sinaliza o segmento da NF (franquia / showroom / novidades / credev)
// usado tanto no modal de detalhes quanto em outras visões.
function SegmentoBadge({ segmento, is_credev }) {
  const cfg = is_credev
    ? { label: 'CREDEV', cls: 'bg-rose-100 text-rose-700 border-rose-200' }
    : segmento === 'showroom'
      ? { label: 'SHOWROOM', cls: 'bg-cyan-100 text-cyan-700 border-cyan-200' }
      : segmento === 'novidades'
        ? { label: 'NOVIDADES', cls: 'bg-purple-100 text-purple-700 border-purple-200' }
        : segmento === 'franquia'
          ? { label: 'FRANQUIA', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
          : { label: 'OUTRO', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// Badge inline para mostrar % de crescimento (vs ano anterior)
function GrowthBadge({ value, size = 'sm' }) {
  if (value === null || value === undefined) {
    return (
      <span
        className={`${size === 'lg' ? 'text-xs' : 'text-[10px]'} text-gray-400 italic font-semibold`}
        title="Sem dado no ano anterior"
      >
        novo
      </span>
    );
  }
  const v = Number(value);
  const up = v >= 0;
  const cls = up
    ? v >= 10
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : v <= -10
      ? 'bg-rose-100 text-rose-800 border-rose-200'
      : 'bg-rose-50 text-rose-700 border-rose-100';
  const sizeCls =
    size === 'lg'
      ? 'px-2 py-0.5 text-[11px]'
      : 'px-1.5 py-0 text-[10px]';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md border font-bold font-mono ${sizeCls} ${cls}`}
      title="Vs mesmo período do ano anterior"
    >
      {up ? '▲' : '▼'}
      {' '}
      {up ? '+' : ''}
      {v.toFixed(1)}%
    </span>
  );
}

// Comparação visual 2025 → 2026 — lado a lado
function YearComparison({ valueLy, value, color = 'orange', growthPct }) {
  const colorMap = {
    orange: { text: 'text-orange-700', border: 'border-orange-200' },
    blue: { text: 'text-blue-700', border: 'border-blue-200' },
  };
  const c = colorMap[color] || colorMap.orange;
  const hasLy = (valueLy || 0) > 0;
  return (
    <div className="flex flex-col items-end gap-0.5 leading-tight">
      <div className="flex items-stretch gap-1.5 text-right">
        <div className="text-right">
          <p className="text-[8px] uppercase tracking-wider font-bold text-gray-400">25</p>
          <p className="font-mono text-[10px] font-bold text-gray-500 tabular-nums leading-none">
            {hasLy ? `R$ ${formatBRL(valueLy)}` : <span className="italic text-gray-300">—</span>}
          </p>
        </div>
        <div className={`text-right border-l ${c.border} pl-1.5`}>
          <p className={`text-[8px] uppercase tracking-wider font-bold ${c.text}`}>26</p>
          <p className={`font-mono text-xs font-extrabold ${c.text} tabular-nums leading-none`}>
            R$ {formatBRL(value || 0)}
          </p>
        </div>
      </div>
      <GrowthBadge value={growthPct} />
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
const RankingComprasFranquias = () => {
  const apiClient = useApiClient();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [franquias, setFranquias] = useState([]);
  const [busca, setBusca] = useState('');

  // Modal de detalhe
  const [franquiaModal, setFranquiaModal] = useState(null);
  const [detalheData, setDetalheData] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  // Totais globais retornados pela API (compras + credev + líquido + crescimento)
  const [totaisApi, setTotaisApi] = useState({
    total: 0,
    total_compras: 0,
    total_credev: 0,
    total_sellout: 0,
    total_compras_ly: 0,
    total_sellout_ly: 0,
    crescimento_compras_pct: null,
    crescimento_sellout_pct: null,
  });

  // ==========================================
  // FETCH: Compras das franquias
  // ==========================================
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      setError('Informe as datas de início e fim.');
      return;
    }
    setLoading(true);
    setError('');
    setFranquias([]);
    try {
      const res = await apiClient.totvs.salePanelComprasFranquias({
        datemin: startDate,
        datemax: endDate,
      });
      const data = res?.data ?? res ?? {};
      const list = Array.isArray(data.franquias) ? data.franquias : [];
      setFranquias(list);
      setTotaisApi({
        total: Number(data.total || 0),
        total_compras: Number(data.total_compras || 0),
        total_credev: Number(data.total_credev || 0),
        total_sellout: Number(data.total_sellout || 0),
        total_compras_ly: Number(data.total_compras_ly || 0),
        total_sellout_ly: Number(data.total_sellout_ly || 0),
        crescimento_compras_pct: data.crescimento_compras_pct,
        crescimento_sellout_pct: data.crescimento_sellout_pct,
      });
      if (list.length === 0) {
        setError('Nenhuma franquia com compras no período.');
      }
    } catch (err) {
      setError(err.message || 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FILTRO de busca
  // ==========================================
  const franquiasFiltradas = useMemo(() => {
    if (!busca.trim()) return franquias;
    const t = busca.trim().toLowerCase();
    return franquias.filter(
      (f) =>
        String(f.fantasy_name || '').toLowerCase().includes(t) ||
        String(f.nm_pessoa || '').toLowerCase().includes(t) ||
        String(f.person_code || '').includes(t),
    );
  }, [franquias, busca]);

  const totais = useMemo(() => {
    const totalCompras = franquiasFiltradas.reduce(
      (s, f) => s + Number(f.total_compras || 0),
      0,
    );
    const totalCredev = franquiasFiltradas.reduce(
      (s, f) => s + Number(f.total_credev || 0),
      0,
    );
    const totalSellout = franquiasFiltradas.reduce(
      (s, f) => s + Number(f.total_sellout || 0),
      0,
    );
    const totalLiquido = totalCompras - totalCredev;
    const totalNFs = franquiasFiltradas.reduce(
      (s, f) => s + Number(f.qty || 0),
      0,
    );
    return {
      total: totalLiquido,
      totalCompras,
      totalCredev,
      totalSellout,
      totalNFs,
      qtdFranquias: franquiasFiltradas.length,
      ticketMedio: totalNFs > 0 ? totalLiquido / totalNFs : 0,
    };
  }, [franquiasFiltradas]);

  // ==========================================
  // Modal: detalhe da franquia
  // ==========================================
  const abrirDetalhe = useCallback(
    (franquia) => {
      setFranquiaModal(franquia);
      setDetalheData(null);
      setLoadingDetalhe(true);
      apiClient.totvs
        .salePanelComprasFranquiaDetalhe({
          datemin: startDate,
          datemax: endDate,
          person_code: franquia.person_code,
        })
        .then((res) => {
          setDetalheData(res?.data ?? res);
        })
        .catch((err) => {
          setDetalheData({ error: err.message });
        })
        .finally(() => setLoadingDetalhe(false));
    },
    [apiClient, startDate, endDate],
  );

  const fecharDetalhe = useCallback(() => {
    setFranquiaModal(null);
    setDetalheData(null);
  }, []);

  // ==========================================
  // ATALHOS DE PERÍODO
  // ==========================================
  const toYmd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const aplicarAtalho = useCallback((tipo) => {
    const hoje = new Date();
    let ini = hoje, fim = hoje;
    if (tipo === 'hoje') {
      ini = hoje;
      fim = hoje;
    } else if (tipo === 'semana') {
      // Semana corrente (segunda → hoje)
      const dow = hoje.getDay(); // 0=dom..6=sab
      const offset = dow === 0 ? 6 : dow - 1;
      ini = new Date(hoje);
      ini.setDate(hoje.getDate() - offset);
      fim = hoje;
    } else if (tipo === 'mes') {
      ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      fim = hoje;
    } else if (tipo === 'mes-passado') {
      ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // último dia do mês passado
    } else if (tipo === 'ano') {
      ini = new Date(hoje.getFullYear(), 0, 1);
      fim = hoje;
    } else if (tipo === '30d') {
      ini = new Date(hoje);
      ini.setDate(hoje.getDate() - 29);
      fim = hoje;
    }
    setStartDate(toYmd(ini));
    setEndDate(toYmd(fim));
  }, []);

  // ==========================================
  // HELPERS UI
  // ==========================================
  const getPositionBadge = (position) => (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold">
      {position + 1}
    </span>
  );

  const top1 = franquiasFiltradas.length > 0 ? franquiasFiltradas[0] : null;

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2 sm:px-4 font-barlow">
      <PageTitle
        title="Compras das Franquias (Sellin)"
        subtitle="Quanto cada franquia comprou da matriz (empresa 99) no período"
        icon={ShoppingCart}
        iconColor="text-orange-600"
      />

      {/* Filtros */}
      <div className="flex flex-col bg-white p-3 sm:p-4 rounded-xl shadow-md w-full mx-auto border border-orange-200 mb-4">
        <span className="text-sm sm:text-base font-bold text-orange-700 flex items-center gap-1.5 mb-0.5 font-barlow">
          <Funnel size={16} weight="bold" />
          Filtros
        </span>
        <span className="text-xs text-gray-500 mb-3 font-barlow">
          Selecione o período para gerar o ranking de compras
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-orange-700 font-barlow">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-orange-200 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50/30 text-gray-800 text-xs font-barlow"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-orange-700 font-barlow">
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-orange-200 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50/30 text-gray-800 text-xs font-barlow"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold shadow-md tracking-wide uppercase w-full sm:w-auto font-barlow"
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

        {/* Atalhos de período */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-500 font-semibold font-barlow">
            Atalhos:
          </span>
          {[
            { k: 'hoje', label: 'Hoje' },
            { k: 'semana', label: 'Esta semana' },
            { k: 'mes', label: 'Este mês' },
            { k: 'mes-passado', label: 'Mês passado' },
            { k: '30d', label: 'Últimos 30 dias' },
            { k: 'ano', label: 'Este ano' },
          ].map((a) => (
            <button
              key={a.k}
              type="button"
              onClick={() => aplicarAtalho(a.k)}
              className="text-[11px] font-semibold px-3 py-1 rounded-full border border-orange-200 bg-white hover:bg-orange-50 hover:border-orange-400 text-orange-700 transition-colors font-barlow"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Filtro busca por nome */}
        {franquias.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
            <MagnifyingGlass size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Buscar franquia por nome ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs sm:text-sm text-red-700 font-barlow">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-gray-400">
          <Spinner size={36} className="animate-spin mb-3" />
          <p className="text-sm font-medium font-barlow">Carregando compras das franquias...</p>
        </div>
      )}

      {/* DASHBOARD */}
      {!loading && franquiasFiltradas.length > 0 && (
        <>
          {/* Cards de Resumo: Compras / Credev / Líquido / Sellout */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white overflow-hidden">
              <CardHeader className="pb-1 pt-2.5 px-3 bg-gradient-to-br from-orange-50 to-orange-50/30 border-b border-orange-100">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart size={14} weight="bold" className="text-orange-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-orange-700 font-barlow">
                    Compras (Sellin)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 px-3 pb-3">
                {/* Grid 2 colunas: 2025 | 2026 lado a lado */}
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">
                      2025
                    </p>
                    <p className="text-xs font-bold text-gray-600 font-mono tabular-nums leading-none">
                      R$ {formatBRL(totaisApi.total_compras_ly || 0)}
                    </p>
                  </div>
                  <div className="border-l border-orange-200 pl-2">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-orange-700 mb-0.5">
                      2026
                    </p>
                    <p className="text-sm sm:text-base font-extrabold text-orange-700 font-barlow tabular-nums leading-none">
                      R$ {formatBRL(totais.totalCompras)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-orange-50">
                  <GrowthBadge value={totaisApi.crescimento_compras_pct} size="lg" />
                  <span className="text-[10px] text-gray-500 font-barlow hidden sm:inline">
                    {totais.totalNFs} NFs
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <Package size={14} weight="bold" className="text-rose-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-rose-700 font-barlow">
                    Credev / Devolução
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-rose-600 break-words font-barlow">
                  − R$ {formatBRL(totais.totalCredev)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  desconsiderado do total
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollar size={14} weight="bold" className="text-emerald-700" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-emerald-800 font-barlow">
                    Total Líquido
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-emerald-700 break-words font-barlow">
                  R$ {formatBRL(totais.total)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-emerald-700 font-barlow hidden sm:block">
                  compras − credev
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white overflow-hidden">
              <CardHeader className="pb-1 pt-2.5 px-3 bg-gradient-to-br from-blue-50 to-blue-50/30 border-b border-blue-100">
                <div className="flex items-center gap-1.5">
                  <Storefront size={14} weight="bold" className="text-blue-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-blue-700 font-barlow">
                    Vendas (Sellout)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 px-3 pb-3">
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">
                      2025
                    </p>
                    <p className="text-xs font-bold text-gray-600 font-mono tabular-nums leading-none">
                      R$ {formatBRL(totaisApi.total_sellout_ly || 0)}
                    </p>
                  </div>
                  <div className="border-l border-blue-200 pl-2">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-blue-700 mb-0.5">
                      2026
                    </p>
                    <p className="text-sm sm:text-base font-extrabold text-blue-700 font-barlow tabular-nums leading-none">
                      R$ {formatBRL(totais.totalSellout)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-blue-50">
                  <GrowthBadge value={totaisApi.crescimento_sellout_pct} size="lg" />
                  <span className="text-[10px] text-gray-500 font-barlow hidden sm:inline">
                    → cliente
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <Buildings size={14} weight="bold" className="text-slate-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-slate-700 font-barlow">
                    Franquias
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-slate-600 break-words font-barlow">
                  {totais.qtdFranquias}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  com compras no período
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* TOP 1 destaque */}
          {top1 && (
            <div className="relative mb-4 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-2 border-orange-300 rounded-xl shadow-lg p-3 sm:p-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 opacity-5 pointer-events-none">
                <Trophy size={128} weight="fill" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-md">
                    <Trophy size={24} weight="fill" className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-orange-700 bg-orange-200 px-2 py-0.5 rounded-full font-barlow">
                      TOP 1
                    </span>
                    <h3 className="text-sm sm:text-lg font-bold text-orange-900 truncate mt-0.5 font-barlow">
                      {top1.fantasy_name || top1.nm_pessoa || `Person ${top1.person_code}`}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto">
                  <div className="text-xs text-gray-600 font-barlow">
                    NFs: <strong className="text-gray-700">{top1.qty}</strong>
                  </div>
                  <div className="sm:ml-2">
                    <p className="text-lg sm:text-2xl font-extrabold text-orange-700 font-barlow">
                      R$ {formatBRL(top1.total_value)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nota informativa sobre comparação ano anterior */}
          {(() => {
            const semLy = franquiasFiltradas.filter(
              (f) => !(f.total_compras_ly || 0),
            ).length;
            if (semLy === 0) return null;
            return (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 font-barlow flex items-start gap-2">
                <span className="text-base leading-none">ℹ️</span>
                <span>
                  <strong>{semLy}</strong> de <strong>{franquiasFiltradas.length}</strong> franquias estão marcadas como{' '}
                  <span className="italic">"novo"</span> no comparativo de 2025 — geralmente porque
                  o cadastro foi recriado (CNPJ/code mudou) ou a franquia abriu em 2026. O total geral
                  de 2025 é obtido pela soma bruta no período (independente do código).
                </span>
              </div>
            );
          })()}

          {/* RANKING */}
          <div className="bg-white rounded-xl shadow-md border border-orange-200 w-full overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-orange-100 flex items-center gap-2">
              <ChartBar size={16} weight="bold" className="text-orange-600" />
              <h2 className="text-xs sm:text-sm font-bold text-orange-700 font-barlow">
                Ranking por Franquia
              </h2>
              <span className="ml-auto text-[10px] sm:text-xs text-gray-400 font-barlow hidden sm:inline">
                Clique para ver NFs detalhadas (compras + credev)
              </span>
            </div>

            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider font-barlow">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-3">Franquia</div>
              <div className="col-span-2 text-right">Compras (Sellin)</div>
              <div className="col-span-2 text-right">Credev</div>
              <div className="col-span-2 text-right">Líquido</div>
              <div className="col-span-2 text-right">Vendas (Sellout)</div>
            </div>

            {/* Rows */}
            {franquiasFiltradas.map((f, idx) => {
              const pct = totais.total > 0 ? (f.total_value / totais.total) * 100 : 0;
              return (
                <div
                  key={f.person_code}
                  onClick={() => abrirDetalhe(f)}
                  className={`w-full transition-all duration-150 border-b border-orange-50 last:border-b-0 cursor-pointer hover:bg-orange-50/60 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-orange-50/20'
                  }`}
                  title="Clique para ver NFs detalhadas"
                >
                  {/* Mobile */}
                  <div className="md:hidden p-3 flex items-start gap-2.5">
                    <div className="flex-shrink-0 mt-0.5">{getPositionBadge(idx)}</div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold truncate font-barlow ${idx < 3 ? 'text-orange-700' : 'text-gray-700'}`}
                      >
                        {f.fantasy_name || f.nm_pessoa || `Person ${f.person_code}`}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        #{f.person_code}
                      </p>
                      <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                        R$ {formatBRL(f.total_value)}{' '}
                        <span className="text-[10px] text-emerald-600 font-normal">líquido</span>
                      </p>
                      <div className="flex gap-x-2 mt-1 text-[10px] text-gray-500 font-barlow flex-wrap">
                        <span>
                          Compras: <strong className="text-gray-700">R$ {formatBRL(f.total_compras)}</strong>
                        </span>
                        {(f.total_credev || 0) > 0 && (
                          <span>
                            Credev: <strong className="text-rose-600">−R$ {formatBRL(f.total_credev)}</strong>
                          </span>
                        )}
                        {(f.total_sellout || 0) > 0 && (
                          <span>
                            Vendas: <strong className="text-blue-700">R$ {formatBRL(f.total_sellout)}</strong>
                          </span>
                        )}
                        <span>
                          NFs: <strong className="text-gray-700">{f.qty}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm">
                    <div className="col-span-1 text-center">{getPositionBadge(idx)}</div>
                    <div className="col-span-3 text-left truncate">
                      <p
                        className={`font-semibold font-barlow ${idx < 3 ? 'text-orange-700' : 'text-gray-700'} truncate`}
                      >
                        {f.fantasy_name || f.nm_pessoa || `Person ${f.person_code}`}
                      </p>
                      {f.fantasy_name && f.nm_pessoa && f.fantasy_name !== f.nm_pessoa && (
                        <p className="text-[10px] text-gray-400 truncate">{f.nm_pessoa}</p>
                      )}
                      <p className="text-[10px] text-gray-400 font-mono">
                        #{f.person_code} · {f.qty} NFs
                      </p>
                    </div>
                    <div className="col-span-2">
                      <YearComparison
                        valueLy={f.total_compras_ly}
                        value={f.total_compras}
                        growthPct={f.crescimento_compras_pct}
                        color="orange"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      {(f.total_credev || 0) > 0 ? (
                        <span className="font-mono text-xs text-rose-600">
                          − R$ {formatBRL(f.total_credev)}
                        </span>
                      ) : (
                        <span className="text-gray-300 font-mono text-xs">—</span>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="font-bold font-mono text-xs text-emerald-700">
                        R$ {formatBRL(f.total_value)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      {(f.total_sellout || 0) > 0 || (f.total_sellout_ly || 0) > 0 ? (
                        <YearComparison
                          valueLy={f.total_sellout_ly}
                          value={f.total_sellout}
                          growthPct={f.crescimento_sellout_pct}
                          color="blue"
                        />
                      ) : (
                        <div className="text-right text-gray-300 font-mono text-xs">—</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && franquias.length === 0 && !error && (
        <div className="text-center py-16 sm:py-20 text-gray-400">
          <ShoppingCart size={48} weight="light" className="mx-auto mb-3 opacity-30" />
          <p className="text-xs sm:text-sm font-medium font-barlow">
            Selecione o período e clique em Buscar para gerar o ranking de compras das franquias.
          </p>
        </div>
      )}

      {/* Modal de detalhe */}
      {franquiaModal && (
        <DetalheFranquiaModal
          franquia={franquiaModal}
          startDate={startDate}
          endDate={endDate}
          data={detalheData}
          loading={loadingDetalhe}
          onClose={fecharDetalhe}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Modal: NFs detalhadas (compras + credev) de uma franquia
// ═══════════════════════════════════════════════════════════════════════════
function DetalheFranquiaModal({
  franquia,
  startDate,
  endDate,
  data,
  loading,
  onClose,
}) {
  const [filtro, setFiltro] = useState('todos'); // todos | compras | credev | franquia | showroom | novidades
  const transacoes = data?.transacoes || [];
  // Contagem por segmento (para os labels dos botões)
  const contagens = useMemo(() => {
    const c = { todos: transacoes.length, compras: 0, credev: 0, franquia: 0, showroom: 0, novidades: 0 };
    for (const t of transacoes) {
      if (t.is_credev) c.credev++;
      else c.compras++;
      if (!t.is_credev && t.segmento) c[t.segmento] = (c[t.segmento] || 0) + 1;
    }
    return c;
  }, [transacoes]);
  const filtradas = useMemo(() => {
    if (filtro === 'compras') return transacoes.filter((t) => !t.is_credev);
    if (filtro === 'credev') return transacoes.filter((t) => t.is_credev);
    if (filtro === 'franquia') return transacoes.filter((t) => !t.is_credev && t.segmento === 'franquia');
    if (filtro === 'showroom') return transacoes.filter((t) => !t.is_credev && t.segmento === 'showroom');
    if (filtro === 'novidades') return transacoes.filter((t) => !t.is_credev && t.segmento === 'novidades');
    return transacoes;
  }, [transacoes, filtro]);

  // ESC fecha modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden font-barlow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-br from-orange-50 to-amber-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Buildings size={20} weight="duotone" className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-orange-700 mb-0.5">
                  Compras da Matriz (Sellin)
                </p>
                <h3 className="text-base font-bold text-gray-900 truncate">
                  {franquia.fantasy_name ||
                    franquia.nm_pessoa ||
                    `Person ${franquia.person_code}`}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {franquia.nm_pessoa &&
                  franquia.fantasy_name &&
                  franquia.nm_pessoa !== franquia.fantasy_name
                    ? franquia.nm_pessoa + ' · '
                    : ''}
                  #{franquia.person_code} · {startDate} → {endDate}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-orange-100 text-gray-500 transition-colors flex-shrink-0"
              title="Fechar (ESC)"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {/* Totais */}
          {data && !loading && !data.error && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="bg-white border border-orange-200 rounded-lg p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                  Compras
                </p>
                <p className="text-sm font-bold text-orange-700 tabular-nums">
                  R$ {formatBRL(data.total_compras)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {transacoes.filter((t) => !t.is_credev).length} NFs
                </p>
              </div>
              <div className="bg-white border border-rose-200 rounded-lg p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                  Credev/Devolução
                </p>
                <p className="text-sm font-bold text-rose-700 tabular-nums">
                  − R$ {formatBRL(data.total_credev)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {transacoes.filter((t) => t.is_credev).length} NFs
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">
                  Líquido
                </p>
                <p className="text-sm font-bold text-emerald-800 tabular-nums">
                  R$ {formatBRL(data.total_liquido)}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  {data.count} transações
                </p>
              </div>
            </div>
          )}

          {/* Breakdown por segmento (Franquia / Showroom / Novidades) */}
          {data && !loading && !data.error && data.totais_por_segmento && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wide text-emerald-700 font-bold">
                    Franquia
                  </p>
                  <span className="text-[9px] text-emerald-600 font-mono">
                    {contagens.franquia || 0} NFs
                  </span>
                </div>
                <p className="text-xs font-bold text-emerald-800 tabular-nums">
                  R$ {formatBRL(data.totais_por_segmento.franquia || 0)}
                </p>
              </div>
              <div className="bg-cyan-50/50 border border-cyan-100 rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wide text-cyan-700 font-bold">
                    Showroom
                  </p>
                  <span className="text-[9px] text-cyan-600 font-mono">
                    {contagens.showroom || 0} NFs
                  </span>
                </div>
                <p className="text-xs font-bold text-cyan-800 tabular-nums">
                  R$ {formatBRL(data.totais_por_segmento.showroom || 0)}
                </p>
              </div>
              <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wide text-purple-700 font-bold">
                    Novidades
                  </p>
                  <span className="text-[9px] text-purple-600 font-mono">
                    {contagens.novidades || 0} NFs
                  </span>
                </div>
                <p className="text-xs font-bold text-purple-800 tabular-nums">
                  R$ {formatBRL(data.totais_por_segmento.novidades || 0)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Filtro */}
        <div className="px-6 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-1">
          {[
            { k: 'todos', label: `Todas (${contagens.todos})` },
            { k: 'franquia', label: `Franquia (${contagens.franquia || 0})` },
            { k: 'showroom', label: `Showroom (${contagens.showroom || 0})` },
            { k: 'novidades', label: `Novidades (${contagens.novidades || 0})` },
            { k: 'credev', label: `Credev (${contagens.credev || 0})` },
          ].map((opt) => (
            <button
              key={opt.k}
              onClick={() => setFiltro(opt.k)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                filtro === opt.k
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Lista de NFs */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <Spinner size={28} className="animate-spin mx-auto mb-3" />
              <p className="text-sm">Buscando NFs no TOTVS...</p>
            </div>
          ) : data?.error ? (
            <div className="text-center py-16 text-rose-600 px-4">
              <p className="text-sm">⚠️ {data.error}</p>
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">Nenhuma transação encontrada.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  <th className="py-2 px-3 text-left">Data</th>
                  <th className="py-2 px-3 text-left">Tipo</th>
                  <th className="py-2 px-3 text-left">NF</th>
                  <th className="py-2 px-3 text-left">Operação</th>
                  <th className="py-2 px-3 text-left">Pagamento</th>
                  <th className="py-2 px-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t, idx) => (
                  <tr
                    key={`${t.branch_code}-${t.transaction_code}-${idx}`}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      t.is_credev ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap text-xs">
                      {t.issue_date}
                    </td>
                    <td className="py-2 px-3">
                      <SegmentoBadge segmento={t.segmento} is_credev={t.is_credev} />
                    </td>
                    <td className="py-2 px-3 text-gray-700 font-mono text-xs">
                      {t.invoice_code}
                      <span className="ml-1 text-gray-300 text-[10px]">
                        #{t.transaction_code}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs truncate max-w-[200px]">
                      <span className="text-gray-400 font-mono mr-1">{t.operation_code}</span>
                      {t.operation_name || ''}
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs truncate max-w-[140px]">
                      {t.payment_condition || '—'}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-bold whitespace-nowrap tabular-nums ${
                        t.is_credev ? 'text-rose-700' : 'text-gray-800'
                      }`}
                    >
                      {t.is_credev ? '−' : ''}R$ {formatBRL(t.total_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {data && (
                <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-sm font-bold text-gray-700">
                      Total Líquido ({filtradas.length} NFs)
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-800 tabular-nums">
                      R${' '}
                      {formatBRL(
                        filtradas.reduce(
                          (s, t) => s + (t.is_credev ? -t.total_value : t.total_value),
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default RankingComprasFranquias;
