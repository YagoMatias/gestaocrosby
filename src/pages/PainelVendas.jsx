import React, { useState, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  TrendUp,
  TrendDown,
  Users,
  Clock,
  CalendarBlank,
  CurrencyDollar,
  Package,
  ArrowUp,
  ArrowDown,
  Spinner,
  Warning,
  Funnel,
  Trophy,
  Storefront,
  ChartBar,
  CreditCard,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';

const fmt = (v) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) => (v || 0).toLocaleString('pt-BR');
const fmtPct = (v) =>
  (v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '%';

const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

function toISODate(dateStr) {
  return dateStr + 'T00:00:00';
}

export default function PainelVendas() {
  const { totvs } = useApiClient();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [datemin, setDatemin] = useState(thirtyDaysAgo);
  const [datemax, setDatemax] = useState(today);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

  const branchs = useMemo(() => {
    return empresasSelecionadas
      .map((e) => parseInt(e.cd_empresa, 10))
      .filter((n) => !isNaN(n));
  }, [empresasSelecionadas]);

  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [totals, setTotals] = useState(null);
  const [hourData, setHourData] = useState(null);
  const [weekdayData, setWeekdayData] = useState(null);
  const [sellersData, setSellersData] = useState(null);
  const [docTypesData, setDocTypesData] = useState(null);
  const [branchRankingData, setBranchRankingData] = useState(null);
  const [bestSellingData, setBestSellingData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (branchs.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }
    setLoading(true);
    setError(null);

    const body = {
      branchs,
      datemin: toISODate(datemin),
      datemax: toISODate(datemax),
    };

    try {
      const results = await Promise.allSettled([
        totvs.salePanelTotals(body),
        totvs.salePanelHours(body),
        totvs.salePanelWeekdays(body),
        totvs.salePanelSellers(body),
        totvs.salePanelDocumentTypes(body),
        totvs.salePanelBranchRanking(body),
        totvs.bestSellingProducts(body),
      ]);

      const get = (idx) =>
        results[idx].status === 'fulfilled' ? results[idx].value?.data : null;

      setTotals(get(0));
      setHourData(get(1));
      setWeekdayData(get(2));
      setSellersData(get(3));
      setDocTypesData(get(4));
      setBranchRankingData(get(5));
      setBestSellingData(get(6));
      setDadosCarregados(true);
    } catch (err) {
      console.error('Erro ao buscar dados do painel:', err);
      setError('Erro ao buscar dados. Verifique os filtros e tente novamente.');
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  }, [branchs, datemin, datemax, totvs]);

  const totalModel = totals?.dataRow?.[0] || {};
  const totalLastYear = totals?.dataRowLastYear?.[0] || {};
  const hourRows = hourData?.dataRow || [];
  const weekdayRows = weekdayData?.dataRow || [];
  const sellerRows = sellersData?.dataRow || [];
  const docTypeRows = docTypesData?.dataRow || [];
  const branchRows = branchRankingData?.dataRow || [];
  const bestSellingRows = bestSellingData?.dataRow || [];

  const maxHourValue = Math.max(
    ...hourRows.map((h) => h.invoice_value || 0),
    1,
  );

  const sortedSellers = useMemo(
    () =>
      [...sellerRows].sort(
        (a, b) => (b.seller_sale_value || 0) - (a.seller_sale_value || 0),
      ),
    [sellerRows],
  );

  const sortedBranches = useMemo(
    () =>
      [...branchRows].sort(
        (a, b) => (b.invoice_value || 0) - (a.invoice_value || 0),
      ),
    [branchRows],
  );

  const growth =
    totalLastYear?.invoice_value && totalModel?.invoice_value
      ? ((totalModel.invoice_value - totalLastYear.invoice_value) /
          totalLastYear.invoice_value) *
        100
      : null;

  const kpiCards = [
    {
      icon: CurrencyDollar,
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-700',
      title: 'Faturamento Total',
      value: fmt(totalModel.invoice_value),
      subtitle:
        growth != null
          ? `${growth >= 0 ? '\u2191' : '\u2193'} ${fmtPct(Math.abs(growth))} vs ano anterior`
          : 'Per\u00edodo selecionado',
    },
    {
      icon: ShoppingCart,
      iconColor: 'text-green-600',
      titleColor: 'text-green-700',
      title: 'Qtd. Vendas',
      value: fmtNum(totalModel.invoice_qty),
      subtitle: `Ticket m\u00e9dio: ${fmt(totalModel.tm)}`,
    },
    {
      icon: Package,
      iconColor: 'text-purple-600',
      titleColor: 'text-purple-700',
      title: 'Itens Vendidos',
      value: fmtNum(totalModel.itens_qty),
      subtitle: `PA: ${(totalModel.pa || 0).toFixed(1)} | PMPV: ${fmt(totalModel.pmpv)}`,
    },
    {
      icon: Trophy,
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-700',
      title: 'Produtos Distintos',
      value: fmtNum(bestSellingRows.length),
      subtitle: bestSellingRows[0]?.product_name
        ? `Top: ${bestSellingRows[0].product_name.slice(0, 30)}`
        : 'Sem dados',
    },
  ];

  const kpiCards2 = [
    {
      icon: TrendUp,
      iconColor: 'text-teal-600',
      titleColor: 'text-teal-700',
      title: 'Mais Vendido (Itens)',
      value: fmtNum(bestSellingRows[0]?.item_quantity || 0),
      subtitle: bestSellingRows[0]?.product_name
        ? bestSellingRows[0].product_name.slice(0, 35)
        : 'Sem dados',
    },
    {
      icon: ChartBar,
      iconColor: 'text-indigo-600',
      titleColor: 'text-indigo-700',
      title: 'Ticket M\u00e9dio',
      value: fmt(totalModel.tm),
      subtitle: 'Valor m\u00e9dio por venda',
    },
    {
      icon: Users,
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-700',
      title: 'Pe\u00e7a/Atend. (PA)',
      value: (totalModel.pa || 0).toFixed(1),
      subtitle: 'M\u00e9dia de pe\u00e7as por ticket',
    },
    {
      icon: CurrencyDollar,
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-700',
      title: 'PMPV',
      value: fmt(totalModel.pmpv),
      subtitle: 'Pre\u00e7o m\u00e9dio por volume',
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Painel de Vendas"
        subtitle="An\u00e1lise completa de vendas \u2022 TOTVS Moda"
        icon={ShoppingCart}
        iconColor="text-blue-600"
      />

      {/* FILTROS */}
      <div className="mb-4">
        <div className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full border border-[#000638]/10">
          <div className="mb-2">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={18} weight="bold" />
              Filtros
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div>
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data In\u00edcio
              </label>
              <input
                type="date"
                value={datemin}
                onChange={(e) => setDatemin(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Fim
              </label>
              <input
                type="date"
                value={datemax}
                onChange={(e) => setDatemax(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                onClick={fetchData}
                className="flex gap-1 bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-8 text-xs font-bold shadow-md tracking-wide uppercase w-full justify-center mt-4"
                disabled={loading || !datemin || !datemax}
              >
                {loading ? (
                  <>
                    <Spinner size={12} className="animate-spin" /> Carregando...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass size={12} /> Buscar
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-2 flex items-center gap-2 text-red-600 text-xs">
              <Warning size={14} /> {error}
            </div>
          )}
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-600">Carregando dados...</span>
        </div>
      )}

      {/* SEM DADOS */}
      {!loading && !dadosCarregados && (
        <div className="flex justify-center items-center py-16 text-gray-500 text-sm">
          Selecione o per\u00edodo e empresa, depois clique em
          &quot;Buscar&quot;
        </div>
      )}

      {/* DASHBOARD */}
      {!loading && dadosCarregados && (
        <>
          {/* KPI CARDS LINHA 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {kpiCards.map((kpi, i) => {
              const KpiIcon = kpi.icon;
              return (
                <Card
                  key={i}
                  className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <KpiIcon size={16} className={kpi.iconColor} />
                      <CardTitle
                        className={`text-xs font-bold ${kpi.titleColor}`}
                      >
                        {kpi.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className={`text-lg font-extrabold ${kpi.iconColor}`}>
                      {kpi.value}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {kpi.subtitle}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* KPI CARDS LINHA 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {kpiCards2.map((kpi, i) => {
              const KpiIcon = kpi.icon;
              return (
                <Card
                  key={i}
                  className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <KpiIcon size={16} className={kpi.iconColor} />
                      <CardTitle
                        className={`text-xs font-bold ${kpi.titleColor}`}
                      >
                        {kpi.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className={`text-lg font-extrabold ${kpi.iconColor}`}>
                      {kpi.value}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {kpi.subtitle}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* VENDAS POR HORA + DIA DA SEMANA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <Card className="shadow-md rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#000638]" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Vendas por Hora
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {hourRows.length === 0 ? (
                  <p className="text-gray-400 text-xs text-center py-6">
                    Sem dados de vendas por hora
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                    {hourRows
                      .sort((a, b) => a.saledatetime_hour - b.saledatetime_hour)
                      .map((h) => {
                        const pct =
                          maxHourValue > 0
                            ? ((h.invoice_value || 0) / maxHourValue) * 100
                            : 0;
                        return (
                          <div
                            key={h.saledatetime_hour}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs font-semibold text-[#000638] w-10 text-right">
                              {String(h.saledatetime_hour).padStart(2, '0')}:00
                            </span>
                            <div className="flex-1">
                              <div className="w-full bg-gray-100 rounded-full h-4">
                                <div
                                  className="h-4 rounded-full bg-[#000638] transition-all duration-500"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-[#000638] whitespace-nowrap min-w-[120px] text-right">
                              {fmt(h.invoice_value)}{' '}
                              <span className="text-gray-400 font-normal">
                                ({fmtNum(h.invoice_qty)})
                              </span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-md rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CalendarBlank size={16} className="text-[#000638]" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Vendas por Dia da Semana
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {weekdayRows.length === 0 ? (
                  <p className="text-gray-400 text-xs text-center py-6">
                    Sem dados
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {weekdayRows
                      .sort(
                        (a, b) =>
                          (a.saledatetime_weekday || 0) -
                          (b.saledatetime_weekday || 0),
                      )
                      .map((d) => {
                        const maxWeekday = Math.max(
                          ...weekdayRows.map((w) => w.invoice_value || 0),
                          1,
                        );
                        const pct =
                          maxWeekday > 0
                            ? ((d.invoice_value || 0) / maxWeekday) * 100
                            : 0;
                        return (
                          <div
                            key={d.saledatetime_weekday}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs font-semibold text-[#000638] w-16 text-right">
                              {WEEKDAY_NAMES[d.saledatetime_weekday] ||
                                `Dia ${d.saledatetime_weekday}`}
                            </span>
                            <div className="flex-1">
                              <div className="w-full bg-gray-100 rounded-full h-4">
                                <div
                                  className="h-4 rounded-full bg-[#000638] transition-all duration-500"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-[#000638] whitespace-nowrap min-w-[120px] text-right">
                              {fmt(d.invoice_value)}{' '}
                              <span className="text-gray-400 font-normal">
                                ({fmtPct(d.percentage_value)})
                              </span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RANKING VENDEDORES + FORMAS DE PAGAMENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <Card className="shadow-md rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-amber-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Ranking de Vendedores
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {sortedSellers.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <Warning size={24} className="mx-auto mb-1" />
                    <p className="text-xs">Nenhum vendedor encontrado</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-1.5 px-1 font-semibold text-[#000638] uppercase text-[10px]">
                              #
                            </th>
                            <th className="text-left py-1.5 px-1 font-semibold text-[#000638] uppercase text-[10px]">
                              Vendedor
                            </th>
                            <th className="text-right py-1.5 px-1 font-semibold text-[#000638] uppercase text-[10px]">
                              Vendas
                            </th>
                            <th className="text-right py-1.5 px-1 font-semibold text-[#000638] uppercase text-[10px]">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedSellers.map((r, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-1.5 px-1 text-gray-400 font-bold">
                                {idx < 3 ? (
                                  <span
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-600'}`}
                                  >
                                    {idx + 1}
                                  </span>
                                ) : (
                                  idx + 1
                                )}
                              </td>
                              <td className="py-1.5 px-1">
                                <span className="font-medium text-gray-800">
                                  {r.seller_name || 'N/A'}
                                </span>
                                <span className="text-[10px] text-gray-400 ml-1">
                                  #{r.seller_code}
                                </span>
                              </td>
                              <td className="py-1.5 px-1 text-right font-semibold">
                                {fmtNum(r.seller_sale_qty)}
                              </td>
                              <td className="py-1.5 px-1 text-right font-bold text-green-700">
                                {fmt(r.seller_sale_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-xs">
                      <span className="text-gray-500 font-medium">
                        Total: {fmtNum(sellersData?.invoiceQuantity)} vendas
                      </span>
                      <span className="text-green-700 font-bold">
                        {fmt(sellersData?.invoiceValue)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-md rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Vendas por Forma de Pagamento
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {docTypeRows.length === 0 ? (
                  <p className="text-gray-400 text-xs text-center py-6">
                    Sem dados
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      {[...docTypeRows]
                        .sort(
                          (a, b) =>
                            (b.payment_value || 0) - (a.payment_value || 0),
                        )
                        .map((d, i) => {
                          const maxDoc = Math.max(
                            ...docTypeRows.map((x) => x.payment_value || 0),
                            1,
                          );
                          const pct =
                            maxDoc > 0
                              ? ((d.payment_value || 0) / maxDoc) * 100
                              : 0;
                          const barColors = [
                            'bg-[#000638]',
                            'bg-[#fe0000]',
                            'bg-blue-500',
                            'bg-teal-500',
                            'bg-green-500',
                            'bg-amber-500',
                            'bg-orange-500',
                            'bg-purple-500',
                          ];
                          return (
                            <div
                              key={d.payment_document_type || i}
                              className="flex items-center gap-2"
                            >
                              <span className="text-[10px] font-bold text-gray-400 w-4 text-right">
                                #{i + 1}
                              </span>
                              <span className="text-xs font-medium text-gray-700 truncate w-28">
                                {d.payment_document_type || 'Outros'}
                              </span>
                              <div className="flex-1">
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                  <div
                                    className={`h-3 rounded-full ${barColors[i % barColors.length]} transition-all duration-500`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-[#000638] whitespace-nowrap min-w-[90px] text-right">
                                {fmt(d.payment_value)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-xs">
                      <span className="text-gray-500 font-medium">
                        {fmtNum(docTypesData?.invoiceQuantity)} vendas
                      </span>
                      <span className="text-purple-700 font-bold">
                        {fmt(docTypesData?.invoiceValue)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RANKING POR EMPRESA */}
          <Card className="shadow-md rounded-xl bg-white mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Storefront size={16} className="text-indigo-600" />
                <CardTitle className="text-sm font-bold text-[#000638]">
                  Ranking por Empresa
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              {sortedBranches.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Warning size={24} className="mx-auto mb-1" />
                  <p className="text-xs">Nenhuma empresa encontrada</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {[
                            '#',
                            'Empresa',
                            'Vendas',
                            'Itens',
                            'T. M\u00e9dio',
                            'PA',
                            'Faturamento',
                            'Dinheiro',
                            'PIX',
                            'Cr\u00e9dito',
                            'D\u00e9bito',
                          ].map((h) => (
                            <th
                              key={h}
                              className={`py-1.5 px-1 font-semibold text-[#000638] uppercase text-[10px] ${h !== '#' && h !== 'Empresa' ? 'text-right' : 'text-left'}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedBranches.map((r, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-1.5 px-1 text-gray-400 font-bold">
                              {idx < 3 ? (
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-600'}`}
                                >
                                  {idx + 1}
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>
                            <td className="py-1.5 px-1">
                              <span className="font-medium text-gray-800">
                                {r.branch_name || 'N/A'}
                              </span>
                              <span className="text-[10px] text-gray-400 ml-1">
                                #{r.branchCode}
                              </span>
                            </td>
                            <td className="py-1.5 px-1 text-right font-semibold">
                              {fmtNum(r.invoice_qty)}
                            </td>
                            <td className="py-1.5 px-1 text-right font-semibold">
                              {fmtNum(r.itens_qty)}
                            </td>
                            <td className="py-1.5 px-1 text-right font-semibold">
                              {fmt(r.tm)}
                            </td>
                            <td className="py-1.5 px-1 text-right font-semibold">
                              {(r.pa || 0).toFixed(1)}
                            </td>
                            <td className="py-1.5 px-1 text-right font-bold text-green-700">
                              {fmt(r.invoice_value)}
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              {fmt(r.cash_value)}
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              {fmt(r.pix_value)}
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              {fmt(r.credit_value)}
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              {fmt(r.debit_value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {branchRankingData && (
                    <div className="mt-3 pt-2 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500">Total Vendas</p>
                        <p className="font-bold text-[#000638]">
                          {fmtNum(branchRankingData.invoiceQuantity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Itens</p>
                        <p className="font-bold text-[#000638]">
                          {fmtNum(branchRankingData.itemQuantity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Faturamento</p>
                        <p className="font-bold text-green-700">
                          {fmt(branchRankingData.invoiceValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Ticket M\u00e9dio</p>
                        <p className="font-bold text-[#000638]">
                          {fmt(branchRankingData.tm)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">PA</p>
                        <p className="font-bold text-[#000638]">
                          {(branchRankingData.pa || 0).toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">PMPV</p>
                        <p className="font-bold text-[#000638]">
                          {fmt(branchRankingData.pmpv)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* COMPARATIVO ANO ANTERIOR */}
          {totals?.dataRowLastYear?.length > 0 && (
            <Card className="shadow-md rounded-xl bg-white mb-4">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendUp size={16} className="text-teal-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Comparativo com Ano Anterior
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    {
                      label: 'Faturamento',
                      current: totalModel.invoice_value,
                      past: totalLastYear.invoice_value,
                      format: fmt,
                    },
                    {
                      label: 'Qtd. Vendas',
                      current: totalModel.invoice_qty,
                      past: totalLastYear.invoice_qty,
                      format: fmtNum,
                    },
                    {
                      label: 'Itens',
                      current: totalModel.itens_qty,
                      past: totalLastYear.itens_qty,
                      format: fmtNum,
                    },
                    {
                      label: 'Ticket M\u00e9dio',
                      current: totalModel.tm,
                      past: totalLastYear.tm,
                      format: fmt,
                    },
                    {
                      label: 'PA',
                      current: totalModel.pa,
                      past: totalLastYear.pa,
                      format: (v) => (v || 0).toFixed(1),
                    },
                    {
                      label: 'PMPV',
                      current: totalModel.pmpv,
                      past: totalLastYear.pmpv,
                      format: fmt,
                    },
                  ].map((item, i) => {
                    const diff =
                      item.past && item.current
                        ? ((item.current - item.past) / item.past) * 100
                        : null;
                    return (
                      <div
                        key={i}
                        className="text-center p-2 bg-[#f8f9fb] rounded-lg border border-[#000638]/10"
                      >
                        <p className="text-[10px] text-gray-500 font-semibold mb-0.5 uppercase">
                          {item.label}
                        </p>
                        <p className="text-sm font-bold text-[#000638]">
                          {item.format(item.current)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Anterior: {item.format(item.past)}
                        </p>
                        {diff != null && (
                          <div
                            className={`inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {diff >= 0 ? (
                              <ArrowUp size={10} weight="bold" />
                            ) : (
                              <ArrowDown size={10} weight="bold" />
                            )}
                            {fmtPct(Math.abs(diff))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* RANKING DE PRODUTOS MAIS VENDIDOS */}
          {bestSellingData && bestSellingRows.length > 0 && (
            <Card className="shadow-md rounded-xl bg-white mb-4">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-yellow-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Ranking de Produtos Mais Vendidos
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-center py-1.5 px-2 font-semibold text-[#000638] uppercase text-[10px] w-8">
                          #
                        </th>
                        <th className="text-left py-1.5 px-2 font-semibold text-[#000638] uppercase text-[10px]">
                          Produto
                        </th>
                        <th className="text-right py-1.5 px-2 font-semibold text-[#000638] uppercase text-[10px]">
                          Itens
                        </th>
                        <th className="text-right py-1.5 px-2 font-semibold text-[#000638] uppercase text-[10px]">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bestSellingRows.map((row, i) => (
                        <tr
                          key={row.product_code}
                          className={`border-b border-gray-50 ${i === 0 ? 'bg-yellow-50' : ''}`}
                        >
                          <td className="py-1.5 px-2 text-center">
                            {i === 0 ? (
                              <Trophy
                                size={12}
                                className="text-yellow-500 mx-auto"
                                weight="fill"
                              />
                            ) : (
                              <span className="text-gray-400 font-mono text-[10px]">
                                {i + 1}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            <p className="font-medium text-[#000638] leading-tight">
                              {row.product_name}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              {row.product_code}
                            </p>
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold text-[#000638]">
                            {fmtNum(row.item_quantity)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-green-700">
                            {fmt(row.order_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold border-t border-gray-200">
                        <td
                          className="py-1.5 px-2 text-[#000638] text-[10px] uppercase"
                          colSpan={2}
                        >
                          Total ({fmtNum(bestSellingData.totalOrderQuantity)}{' '}
                          pedidos)
                        </td>
                        <td className="py-1.5 px-2 text-right text-[#000638]">
                          {fmtNum(bestSellingData.totalItemQuantity)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-[#000638]">
                          {fmt(bestSellingData.totalOrderValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
