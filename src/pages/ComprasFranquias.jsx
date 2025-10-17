import React, { useState, useMemo } from 'react';
import useApiClient from '../hooks/useApiClient';
import LoadingSpinner from '../components/LoadingSpinner';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import {
  Receipt,
  Funnel,
  TrendDown,
  ShoppingCart,
  TrendUp,
  UserCircle,
  ArrowUp,
  ArrowDown,
  ChartBar,
} from '@phosphor-icons/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Pie } from 'react-chartjs-2';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartDataLabels,
);

const ComprasFranquias = () => {
  const api = useApiClient();

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dataInicio, setDataInicio] = useState(
    firstDay.toISOString().split('T')[0],
  );
  const [dataFim, setDataFim] = useState(today.toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [groupedRows, setGroupedRows] = useState([]);
  const [sortField, setSortField] = useState('nm_fantasia');
  const [sortDirection, setSortDirection] = useState('asc');

  const formatBRL = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value) || 0);
  };

  const buscar = async () => {
    if (!dataInicio || !dataFim) {
      setError('Selecione data início e fim');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const resp = await api.sales.faturamentoFranquias({
        dataInicio,
        dataFim,
      });

      // Normalizar resposta para array de registros
      let data = [];
      if (!resp) data = [];
      else if (Array.isArray(resp)) data = resp;
      else if (Array.isArray(resp.data)) data = resp.data;
      else if (resp.data && Array.isArray(resp.data.data))
        data = resp.data.data;
      else if (Array.isArray(resp.data?.data)) data = resp.data.data;
      else {
        // tentar extrair primeiro array encontrado
        const firstArray = Object.values(resp).find((v) => Array.isArray(v));
        data = firstArray || [];
      }

      setRows(data);
      // Buscar nomes fantasia em lote (por nr_transacao)
      try {
        const transacoesUnicas = Array.from(
          new Set(
            data.map((d) => String(d.nr_transacao).trim()).filter(Boolean),
          ),
        );

        if (transacoesUnicas.length > 0) {
          const csv = transacoesUnicas.join(',');
          const nmResp = await api.apiCall('/api/utils/nm-franquia', {
            nr_transacao: csv,
          });

          const nmMap = nmResp && nmResp.data ? nmResp.data : {};

          const mapped = data.map((row) => ({
            ...row,
            nm_fantasia:
              (nmMap[row.nr_transacao] &&
                nmMap[row.nr_transacao].nm_fantasia) ||
              row.nm_fantasia ||
              null,
            consultor:
              (nmMap[row.nr_transacao] && nmMap[row.nr_transacao].consultor) ||
              row.consultor ||
              'Sem consultor',
          }));

          setRows(mapped);

          // Agrupar por cliente (nm_fantasia) e somar valores
          const grupos = {};
          mapped.forEach((r) => {
            const cliente = r.nm_fantasia || 'CADASTRE O CONSULTOR NO TOTVS';
            if (!grupos[cliente]) {
              grupos[cliente] = {
                nm_fantasia: cliente,
                nm_grupoempresa: r.nm_grupoempresa || r.nm_grupo || '',
                total_devolucao: 0,
                total_compras: 0,
                consultor: r.consultor || 'Sem consultor',
              };
            }
            const entrada = Number(r.valor_com_desconto_entrada) || 0;
            const saida = Number(r.valor_com_desconto_saida) || 0;

            grupos[cliente].total_devolucao += entrada;
            grupos[cliente].total_compras += saida;
          });

          const grouped = Object.values(grupos).map((g) => ({
            ...g,
            total_liquido: g.total_compras - g.total_devolucao,
          }));

          setGroupedRows(grouped);
        }
      } catch (err) {
        console.warn('Erro ao buscar nomes fantasia:', err);
      }
    } catch (err) {
      console.error('Erro buscar ComprasFranquias', err);
      setError('Erro ao buscar dados');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Ordenação da tabela
  const sortedRows = useMemo(() => {
    const sorted = [...groupedRows].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Converter para números se for campo numérico
      if (
        sortField === 'total_devolucao' ||
        sortField === 'total_compras' ||
        sortField === 'total_liquido'
      ) {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        // Para texto, fazer case-insensitive
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    return sorted;
  }, [groupedRows, sortField, sortDirection]);

  // Função para alternar ordenação
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Cálculos de totais para os cards
  const totalDevolucoes = groupedRows.reduce(
    (s, g) => s + (Number(g.total_devolucao) || 0),
    0,
  );
  const totalCompras = groupedRows.reduce(
    (s, g) => s + (Number(g.total_compras) || 0),
    0,
  );
  const totalLiquido = groupedRows.reduce(
    (s, g) => s + (Number(g.total_liquido) || 0),
    0,
  );

  const consultores = ['IVANNA', 'ARTHUR', 'JHEMYSON'];
  const consultorTotals = consultores.map((c) =>
    groupedRows
      .filter((g) => String(g.consultor).toUpperCase() === c)
      .reduce((s, g) => s + (Number(g.total_liquido) || 0), 0),
  );

  // Dados para gráfico de barras - Devoluções, Compras e Líquido
  const dadosBarras = useMemo(() => {
    return {
      labels: ['Devoluções', 'Compras', 'Compras - Devoluções'],
      datasets: [
        {
          label: 'Valores',
          data: [totalDevolucoes, totalCompras, totalLiquido],
          backgroundColor: ['#EF4444', '#10B981', '#3B82F6'],
          borderColor: ['#DC2626', '#059669', '#2563EB'],
          borderWidth: 2,
        },
      ],
    };
  }, [totalDevolucoes, totalCompras, totalLiquido]);

  // Dados para gráfico de pizza - Vendas por consultor
  const dadosPizzaConsultores = useMemo(() => {
    return {
      labels: consultores,
      datasets: [
        {
          data: consultorTotals,
          backgroundColor: ['#8B5CF6', '#F59E0B', '#EC4899'],
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    };
  }, [consultorTotals]);

  // Opções dos gráficos
  const optionsBarras = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      datalabels: {
        color: '#fff',
        font: {
          weight: 'bold',
          size: 12,
        },
        formatter: (value) => formatBRL(value),
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatBRL(value),
        },
      },
    },
  };

  const optionsPizza = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      datalabels: {
        color: '#fff',
        font: {
          weight: 'bold',
          size: 12,
        },
        formatter: (value, ctx) => {
          const total = ctx.chart.data.datasets[0].data.reduce(
            (a, b) => a + b,
            0,
          );
          const percentage = ((value / total) * 100).toFixed(1);
          return `${percentage}%`;
        },
      },
    },
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto py-6 px-4">
      <PageTitle
        title="Compras Franquias"
        subtitle="Análise de compras e devoluções por franquia"
        icon={Receipt}
        iconColor="text-purple-600"
      />

      {/* Filtros */}
      <div className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
          className="bg-white p-3 rounded-lg shadow-lg border border-[#000638]/10"
        >
          <div className="mb-2">
            <span className="text-sm font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={16} weight="bold" />
              Filtros
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>

            <div className="items-center hidden lg:flex">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors shadow-md tracking-wide uppercase text-xs w-full justify-center"
              >
                <Funnel size={14} weight="bold" />
                Buscar
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : groupedRows.length > 0 ? (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            {/* Devoluções */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendDown size={20} className="text-red-600" />
                  <CardTitle className="text-sm font-bold text-red-700">
                    Devoluções
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-red-600 mb-0.5">
                  {formatBRL(totalDevolucoes)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Total devolvido
                </CardDescription>
              </CardContent>
            </Card>

            {/* Compras */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={20} className="text-green-600" />
                  <CardTitle className="text-sm font-bold text-green-700">
                    Compras
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-green-600 mb-0.5">
                  {formatBRL(totalCompras)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Total comprado
                </CardDescription>
              </CardContent>
            </Card>

            {/* Compras - Devoluções (Líquido) */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendUp size={20} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-700">
                    Líquido
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-blue-600 mb-0.5">
                  {formatBRL(totalLiquido)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Compras - Devoluções
                </CardDescription>
              </CardContent>
            </Card>

            {/* Cards dos Consultores */}
            {consultores.map((c, i) => {
              const colors = [
                {
                  bg: 'bg-purple-50',
                  text: 'text-purple-700',
                  icon: 'text-purple-600',
                },
                {
                  bg: 'bg-orange-50',
                  text: 'text-orange-700',
                  icon: 'text-orange-600',
                },
                {
                  bg: 'bg-pink-50',
                  text: 'text-pink-700',
                  icon: 'text-pink-600',
                },
              ];
              const color = colors[i];

              return (
                <Card
                  key={c}
                  className={`shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl ${color.bg} border-0`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <UserCircle size={20} className={color.icon} />
                      <CardTitle className={`text-sm font-bold ${color.text}`}>
                        {c}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-4">
                    <div
                      className={`text-lg font-extrabold ${color.text} mb-0.5`}
                    >
                      {formatBRL(consultorTotals[i] || 0)}
                    </div>
                    <CardDescription className="text-xs text-gray-600">
                      Consultor {i + 1}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Seção de Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Gráfico de Barras - Devoluções, Compras e Líquido */}
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ChartBar size={24} className="text-indigo-600" />
                  <CardTitle className="text-lg font-bold text-[#000638]">
                    Análise de Valores
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Comparativo de devoluções, compras e valor líquido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: '300px' }}>
                  <Bar data={dadosBarras} options={optionsBarras} />
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Pizza - Consultores */}
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserCircle size={24} className="text-purple-600" />
                  <CardTitle className="text-lg font-bold text-[#000638]">
                    Distribuição por Consultor
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Percentual de vendas líquidas por consultor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: '300px' }}>
                  <Pie data={dadosPizzaConsultores} options={optionsPizza} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Dados */}
          <Card className="shadow-lg rounded-xl bg-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Receipt size={24} className="text-indigo-600" />
                <CardTitle className="text-lg font-bold text-[#000638]">
                  Detalhamento por Franquia
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-gray-500">
                Clique nos cabeçalhos para ordenar • Total de{' '}
                {sortedRows.length} franquia(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-white uppercase bg-[#000638]">
                    <tr>
                      <th
                        className="px-4 py-3 text-left cursor-pointer hover:bg-[#fe0000] transition-colors"
                        onClick={() => handleSort('nm_grupoempresa')}
                      >
                        <div className="flex items-center gap-1">
                          Empresa Fat
                          {sortField === 'nm_grupoempresa' && (
                            <span>
                              {sortDirection === 'asc' ? (
                                <ArrowUp size={14} weight="bold" />
                              ) : (
                                <ArrowDown size={14} weight="bold" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left cursor-pointer hover:bg-[#fe0000] transition-colors"
                        onClick={() => handleSort('nm_fantasia')}
                      >
                        <div className="flex items-center gap-1">
                          Nome Fantasia
                          {sortField === 'nm_fantasia' && (
                            <span>
                              {sortDirection === 'asc' ? (
                                <ArrowUp size={14} weight="bold" />
                              ) : (
                                <ArrowDown size={14} weight="bold" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left cursor-pointer hover:bg-[#fe0000] transition-colors"
                        onClick={() => handleSort('consultor')}
                      >
                        <div className="flex items-center gap-1">
                          Consultor
                          {sortField === 'consultor' && (
                            <span>
                              {sortDirection === 'asc' ? (
                                <ArrowUp size={14} weight="bold" />
                              ) : (
                                <ArrowDown size={14} weight="bold" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right cursor-pointer hover:bg-[#fe0000] transition-colors"
                        onClick={() => handleSort('total_devolucao')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Devoluções
                          {sortField === 'total_devolucao' && (
                            <span>
                              {sortDirection === 'asc' ? (
                                <ArrowUp size={14} weight="bold" />
                              ) : (
                                <ArrowDown size={14} weight="bold" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right cursor-pointer hover:bg-[#fe0000] transition-colors"
                        onClick={() => handleSort('total_compras')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Compras
                          {sortField === 'total_compras' && (
                            <span>
                              {sortDirection === 'asc' ? (
                                <ArrowUp size={14} weight="bold" />
                              ) : (
                                <ArrowDown size={14} weight="bold" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right cursor-pointer hover:bg-[#fe0000] transition-colors"
                        onClick={() => handleSort('total_liquido')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Líquido
                          {sortField === 'total_liquido' && (
                            <span>
                              {sortDirection === 'asc' ? (
                                <ArrowUp size={14} weight="bold" />
                              ) : (
                                <ArrowDown size={14} weight="bold" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          Nenhum registro encontrado
                        </td>
                      </tr>
                    ) : (
                      sortedRows.map((r, idx) => (
                        <tr
                          key={idx}
                          className={`border-b hover:bg-blue-50 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {r.nm_grupoempresa || '-'}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {r.nm_fantasia || '-'}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-700">
                            {r.consultor || 'Sem consultor'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">
                            {formatBRL(r.total_devolucao)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {formatBRL(r.total_compras)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">
                            {formatBRL(r.total_liquido)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default ComprasFranquias;
