import React, { useState, useMemo } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  ChartLineUp,
  ChartBar,
  ChartPieSlice,
  TrendUp,
  Money,
  ArrowUp,
  ArrowDown,
  Buildings,
  Funnel,
  Spinner,
  Receipt,
  ShoppingCart,
} from '@phosphor-icons/react';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  ChartDataLabels,
);

const DashboardFaturamento = () => {
  const apiClient = useApiClient();

  // Estado para modal de gráfico ampliado
  const [modalGrafico, setModalGrafico] = useState(null);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(
    firstDay.toISOString().split('T')[0],
  );
  const [dataFim, setDataFim] = useState(today.toISOString().split('T')[0]);

  // Estados para dados
  const [dadosFaturamento, setDadosFaturamento] = useState({
    varejo: [],
    mtm: [],
    franquias: [],
    revenda: [],
  });
  const [dadosMesAnterior, setDadosMesAnterior] = useState({
    varejo: [],
    mtm: [],
    franquias: [],
    revenda: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Função para formatar valores em Real
  const formatBRL = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  };

  // Função para buscar dados
  const buscarDados = async () => {
    if (!dataInicio || !dataFim) {
      setError('Por favor, selecione as datas de início e fim');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = {
        dataInicio,
        dataFim,
      };

      // Calcular período anterior (mesmo intervalo, mas do mês anterior)
      const inicioDate = new Date(dataInicio);
      const fimDate = new Date(dataFim);

      // Subtrair exatamente 1 mês das datas, mantendo o mesmo dia
      const inicioMesAnterior = new Date(inicioDate);
      inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);

      const fimMesAnterior = new Date(fimDate);
      fimMesAnterior.setMonth(fimMesAnterior.getMonth() - 1);

      const paramsAnterior = {
        ...params,
        dataInicio: inicioMesAnterior.toISOString().split('T')[0],
        dataFim: fimMesAnterior.toISOString().split('T')[0],
      };

      console.log('Período atual:', dataInicio, 'até', dataFim);
      console.log(
        'Período anterior calculado:',
        paramsAnterior.dataInicio,
        'até',
        paramsAnterior.dataFim,
      );
      console.log('Params atual:', params);
      console.log('Params anterior:', paramsAnterior);

      // Buscar dados de todos os tipos de faturamento - período atual
      const [varejoRes, mtmRes, franquiasRes, revendaRes] = await Promise.all([
        apiClient.apiCall('/api/faturamento/varejo', params),
        apiClient.apiCall('/api/faturamento/mtm', params),
        apiClient.apiCall('/api/faturamento/franquias', params),
        apiClient.apiCall('/api/faturamento/revenda', params),
      ]);

      // Buscar dados do mês anterior
      const [varejoAntRes, mtmAntRes, franquiasAntRes, revendaAntRes] =
        await Promise.all([
          apiClient.apiCall('/api/faturamento/varejo', paramsAnterior),
          apiClient.apiCall('/api/faturamento/mtm', paramsAnterior),
          apiClient.apiCall('/api/faturamento/franquias', paramsAnterior),
          apiClient.apiCall('/api/faturamento/revenda', paramsAnterior),
        ]);

      setDadosFaturamento({
        varejo: varejoRes.data?.data || varejoRes.data || [],
        mtm: mtmRes.data?.data || mtmRes.data || [],
        franquias: franquiasRes.data?.data || franquiasRes.data || [],
        revenda: revendaRes.data?.data || revendaRes.data || [],
      });

      setDadosMesAnterior({
        varejo: varejoAntRes.data?.data || varejoAntRes.data || [],
        mtm: mtmAntRes.data?.data || mtmAntRes.data || [],
        franquias: franquiasAntRes.data?.data || franquiasAntRes.data || [],
        revenda: revendaAntRes.data?.data || revendaAntRes.data || [],
      });
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Erro ao carregar dados de faturamento');
    } finally {
      setLoading(false);
    }
  };

  // Cálculos consolidados
  const dadosConsolidados = useMemo(() => {
    const tipos = ['varejo', 'mtm', 'franquias', 'revenda'];
    const resultado = {};

    tipos.forEach((tipo) => {
      const dados = dadosFaturamento[tipo] || [];
      resultado[tipo] = dados.reduce(
        (acc, item) => ({
          vendas: acc.vendas + (parseFloat(item.vendas) || 0),
          devolucoes: acc.devolucoes + (parseFloat(item.devolucoes) || 0),
          venda_liquida:
            acc.venda_liquida + (parseFloat(item.venda_liquida) || 0),
          frete: acc.frete + (parseFloat(item.frete) || 0),
          total: acc.total + (parseFloat(item.total) || 0),
        }),
        {
          vendas: 0,
          devolucoes: 0,
          venda_liquida: 0,
          frete: 0,
          total: 0,
        },
      );
    });

    // Totais gerais
    resultado.totais = tipos.reduce(
      (acc, tipo) => ({
        vendas: acc.vendas + resultado[tipo].vendas,
        devolucoes: acc.devolucoes + resultado[tipo].devolucoes,
        venda_liquida: acc.venda_liquida + resultado[tipo].venda_liquida,
        frete: acc.frete + resultado[tipo].frete,
        total: acc.total + resultado[tipo].total,
      }),
      {
        vendas: 0,
        devolucoes: 0,
        venda_liquida: 0,
        frete: 0,
        total: 0,
      },
    );

    return resultado;
  }, [dadosFaturamento]);

  // Cálculos consolidados do mês anterior
  const dadosConsolidadosMesAnterior = useMemo(() => {
    const tipos = ['varejo', 'mtm', 'franquias', 'revenda'];
    const resultado = {};

    tipos.forEach((tipo) => {
      const dados = dadosMesAnterior[tipo] || [];
      resultado[tipo] = dados.reduce(
        (acc, item) => ({
          vendas: acc.vendas + (parseFloat(item.vendas) || 0),
          devolucoes: acc.devolucoes + (parseFloat(item.devolucoes) || 0),
          venda_liquida:
            acc.venda_liquida + (parseFloat(item.venda_liquida) || 0),
          frete: acc.frete + (parseFloat(item.frete) || 0),
          total: acc.total + (parseFloat(item.total) || 0),
        }),
        {
          vendas: 0,
          devolucoes: 0,
          venda_liquida: 0,
          frete: 0,
          total: 0,
        },
      );
    });

    return resultado;
  }, [dadosMesAnterior]);

  // Dados para gráfico de pizza - Faturamento por tipo
  const dadosPizza = useMemo(() => {
    const labels = ['Varejo', 'MTM', 'Franquias', 'Revenda'];
    const dados = [
      dadosConsolidados.varejo?.total || 0,
      dadosConsolidados.mtm?.total || 0,
      dadosConsolidados.franquias?.total || 0,
      dadosConsolidados.revenda?.total || 0,
    ];

    return {
      labels,
      datasets: [
        {
          data: dados,
          backgroundColor: [
            '#3B82F6', // Azul
            '#10B981', // Verde
            '#F59E0B', // Amarelo
            '#EF4444', // Vermelho
          ],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  }, [dadosConsolidados]);

  // Dados para gráfico de barras - Vendas vs Devoluções
  const dadosBarras = useMemo(() => {
    const labels = ['Varejo', 'MTM', 'Franquias', 'Revenda'];

    return {
      labels,
      datasets: [
        {
          label: 'Vendas',
          data: [
            dadosConsolidados.varejo?.vendas || 0,
            dadosConsolidados.mtm?.vendas || 0,
            dadosConsolidados.franquias?.vendas || 0,
            dadosConsolidados.revenda?.vendas || 0,
          ],
          backgroundColor: '#3B82F6',
        },
        {
          label: 'Devoluções',
          data: [
            Math.abs(dadosConsolidados.varejo?.devolucoes || 0),
            Math.abs(dadosConsolidados.mtm?.devolucoes || 0),
            Math.abs(dadosConsolidados.franquias?.devolucoes || 0),
            Math.abs(dadosConsolidados.revenda?.devolucoes || 0),
          ],
          backgroundColor: '#EF4444',
        },
        {
          label: 'Frete',
          data: [
            dadosConsolidados.varejo?.frete || 0,
            dadosConsolidados.mtm?.frete || 0,
            dadosConsolidados.franquias?.frete || 0,
            dadosConsolidados.revenda?.frete || 0,
          ],
          backgroundColor: '#10B981',
        },
      ],
    };
  }, [dadosConsolidados]);

  // Dados para gráfico de linha - Faturamento por empresa
  const dadosLinha = useMemo(() => {
    // Combinar todos os dados por empresa
    const empresas = new Map();

    Object.keys(dadosFaturamento).forEach((tipo) => {
      dadosFaturamento[tipo].forEach((item) => {
        const empresa = item.cd_empresa;
        if (!empresas.has(empresa)) {
          empresas.set(empresa, {
            empresa,
            nm_grupoempresa: item.nm_grupoempresa,
            varejo: 0,
            mtm: 0,
            franquias: 0,
            revenda: 0,
          });
        }
        empresas.get(empresa)[tipo] = parseFloat(item.total) || 0;
      });
    });

    const dadosArray = Array.from(empresas.values()).sort(
      (a, b) => a.empresa - b.empresa,
    );

    return {
      labels: dadosArray.map(
        (item) => item.nm_grupoempresa || `Empresa ${item.empresa}`,
      ),
      datasets: [
        {
          label: 'Varejo',
          data: dadosArray.map((item) => item.varejo),
          borderColor: '#3B82F6',
          backgroundColor: '#3B82F6',
          tension: 0.1,
        },
        {
          label: 'MTM',
          data: dadosArray.map((item) => item.mtm),
          borderColor: '#10B981',
          backgroundColor: '#10B981',
          tension: 0.1,
        },
        {
          label: 'Franquias',
          data: dadosArray.map((item) => item.franquias),
          borderColor: '#F59E0B',
          backgroundColor: '#F59E0B',
          tension: 0.1,
        },
        {
          label: 'Revenda',
          data: dadosArray.map((item) => item.revenda),
          borderColor: '#EF4444',
          backgroundColor: '#EF4444',
          tension: 0.1,
        },
      ],
    };
  }, [dadosFaturamento]);

  // Configurações dos gráficos
  const opcoesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value =
              context.parsed?.y !== undefined ? context.parsed.y : context.raw;
            return `${context.dataset.label}: ${formatBRL(value || 0)}`;
          },
        },
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return formatBRL(value);
          },
        },
      },
    },
  };

  const opcoesPizza = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage =
              total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
            return `${context.label}: ${formatBRL(
              context.raw,
            )} (${percentage}%)`;
          },
        },
      },
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 'bold',
          size: 12,
        },
        formatter: function (value, context) {
          const data = context.dataset.data;
          const total = data.reduce((sum, val) => sum + val, 0);
          const percentage =
            total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
          return percentage + '%';
        },
      },
    },
  };

  // Campo para comparar crescimento (total ou venda_liquida)
  const campoCrescimento = 'venda_liquida'; // altere para 'total' se quiser comparar pelo total

  // Função para calcular crescimento mensal
  const calcularCrescimentoMensal = (canal) => {
    const valorAtual = dadosConsolidados[canal]?.[campoCrescimento] || 0;
    const valorAnterior =
      dadosConsolidadosMesAnterior[canal]?.[campoCrescimento] || 0;

    // Swing
    const swing = valorAtual - valorAnterior;
    // Multiplicador
    const multiplicador =
      valorAnterior !== 0 ? valorAtual / Math.abs(valorAnterior) : null;
    // Variação percentual (sempre sobre o módulo do anterior)
    const variacao =
      valorAnterior !== 0
        ? ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100
        : null;

    // Se anterior for negativo, retorna objeto especial
    if (valorAnterior < 0) {
      return {
        swing,
        multiplicador,
        variacao,
        anterior: valorAnterior,
        atual: valorAtual,
      };
    }
    // Se anterior for zero, não faz sentido percentual
    if (valorAnterior === 0) {
      return {
        swing,
        multiplicador: null,
        variacao: null,
        anterior: valorAnterior,
        atual: valorAtual,
      };
    }
    // Caso padrão: taxa de crescimento clássica
    return {
      swing,
      multiplicador,
      variacao: ((valorAtual - valorAnterior) / valorAnterior) * 100,
      anterior: valorAnterior,
      atual: valorAtual,
    };
  };

  // Dados para gráfico de crescimento
  const dadosCrescimento = useMemo(() => {
    const canais = Object.keys(dadosConsolidados).filter(
      (key) => key !== 'totais',
    );
    const crescimentos = canais.map((canal) =>
      calcularCrescimentoMensal(canal),
    );

    console.log('Dados consolidados atual:', dadosConsolidados);
    console.log(
      'Dados consolidados mês anterior:',
      dadosConsolidadosMesAnterior,
    );
    console.log('Crescimentos calculados:', crescimentos);

    return {
      labels: canais.map(
        (canal) => canal.charAt(0).toUpperCase() + canal.slice(1),
      ),
      datasets: [
        {
          label: 'Taxa de Crescimento (%)',
          data: crescimentos,
          backgroundColor: crescimentos.map((val) =>
            val >= 0 ? '#10B981' : '#EF4444',
          ),
          borderColor: crescimentos.map((val) =>
            val >= 0 ? '#059669' : '#DC2626',
          ),
          borderWidth: 2,
        },
      ],
    };
  }, [dadosConsolidados, dadosConsolidadosMesAnterior]);

  // Opções para gráfico de crescimento
  const opcoesCrescimento = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.raw || 0;
            return `${context.label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return value + '%';
          },
        },
      },
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <PageTitle
        title="Dashboard Faturamento"
        subtitle="Análise completa e gerencial dos dados de faturamento das lojas"
        icon={ChartLineUp}
        iconColor="text-indigo-600"
      />

      {/* Filtros */}

      <div className="mb-4">
        <form className="flex flex-col bg-white p-3 rounded-lg shadow-lg w-full max-w-4xl mx-auto border border-[#000638]/10 gap-5 p-5">
          <div className="mb-2">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={18} weight="bold" />
              Filtros
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Selecione o período e empresa para análise
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-3">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
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
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={buscarDados}
                disabled={loading}
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
              >
                <>
                  <ChartLineUp size={16} />
                  Buscar Dados
                </>
              </button>
            </div>
          </div>
        </form>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : Object.values(dadosFaturamento).some((dados) => dados.length > 0) ? (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Total Geral */}
            <Card
              className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
              onClick={() =>
                setModalGrafico({
                  tipo: 'canal',
                  title: 'Distribuição do Faturamento por Canal',
                  data: dadosPizza,
                })
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Money size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-700">
                    Total Geral
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-blue-600 mb-0.5">
                  {formatBRL(dadosConsolidados.totais?.total)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Faturamento consolidado
                </CardDescription>
              </CardContent>
            </Card>

            {/* Vendas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ArrowUp size={18} className="text-green-600" />
                  <CardTitle className="text-sm font-bold text-green-700">
                    Vendas
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-green-600 mb-0.5">
                  {formatBRL(dadosConsolidados.totais?.vendas)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Vendas brutas
                </CardDescription>
              </CardContent>
            </Card>

            {/* Devoluções */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ArrowDown size={18} className="text-red-600" />
                  <CardTitle className="text-sm font-bold text-red-700">
                    Devoluções
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-red-600 mb-0.5">
                  {formatBRL(Math.abs(dadosConsolidados.totais?.devolucoes))}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Valores devolvidos
                </CardDescription>
              </CardContent>
            </Card>

            {/* Frete */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-700">
                    Frete
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-purple-600 mb-0.5">
                  {formatBRL(dadosConsolidados.totais?.frete)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Valores de frete
                </CardDescription>
              </CardContent>
            </Card>

            {/* Venda Líquida */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-gray-600" />
                  <CardTitle className="text-sm font-bold text-gray-700">
                    Venda Líquida
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-gray-600 mb-0.5">
                  {formatBRL(dadosConsolidados.totais?.venda_liquida)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Vendas após devoluções
                </CardDescription>
              </CardContent>
            </Card>
          </div>
          {/* Cards por Canal - Faturamento e Crescimento */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                key: 'varejo',
                label: 'Varejo',
                colorClass: 'text-blue-700',
                valueClass: 'text-blue-600',
              },
              {
                key: 'franquias',
                label: 'Franquias',
                colorClass: 'text-yellow-700',
                valueClass: 'text-yellow-600',
              },
              {
                key: 'mtm',
                label: 'Multimarcas',
                colorClass: 'text-green-700',
                valueClass: 'text-green-600',
              },
              {
                key: 'revenda',
                label: 'Revenda',
                colorClass: 'text-purple-700',
                valueClass: 'text-purple-600',
              },
            ].map((canal) => {
              const faturamento = formatBRL(
                dadosConsolidados[canal.key]?.venda_liquida || 0,
              );
              const crescimento = calcularCrescimentoMensal(canal.key);
              // Se anterior for negativo, exibe swing, multiplicador e variação
              if (crescimento.anterior < 0) {
                return (
                  <Card
                    key={canal.key}
                    className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle
                        className={`text-sm font-bold ${canal.colorClass}`}
                      >
                        {canal.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 px-4 pb-4">
                      <div
                        className={`text-base font-extrabold ${canal.valueClass} mb-0.5`}
                      >
                        {faturamento}
                      </div>
                      <span className="text-xs text-gray-500">
                        Período anterior: {formatBRL(crescimento.anterior)}
                      </span>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-bold text-green-600 text-lg">
                          +{Math.abs(crescimento.variacao).toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          vs. mês anterior
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              // Caso padrão: taxa de crescimento clássica
              const isPositivo =
                crescimento.variacao !== null && crescimento.variacao >= 0;
              return (
                <Card
                  key={canal.key}
                  className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white"
                >
                  <CardHeader className="pb-2">
                    <CardTitle
                      className={`text-sm font-bold ${canal.colorClass}`}
                    >
                      {canal.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-4">
                    <div
                      className={`text-base font-extrabold ${canal.valueClass} mb-0.5`}
                    >
                      {faturamento}
                    </div>
                    <div className={`text-xs text-gray-500`}>
                      Período anterior: {formatBRL(crescimento.anterior)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`font-bold ${
                          isPositivo ? 'text-green-600' : 'text-red-600'
                        } text-lg`}
                      >
                        {isPositivo ? '+' : ''}
                        {crescimento.variacao !== null
                          ? crescimento.variacao.toFixed(1) + '%'
                          : '—'}
                      </span>
                      <span className="text-xs text-gray-500">
                        vs. mês anterior
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tabela Detalhada por Tipo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.keys(dadosConsolidados)
              .filter((key) => key !== 'totais')
              .map((tipo) => (
                <Card
                  key={tipo}
                  className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Buildings size={20} className="text-[#000638]" />
                      <CardTitle className="text-lg font-bold text-[#000638]">
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Resumo financeiro do canal {tipo}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="bg-white">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">
                          Vendas:
                        </span>
                        <span className="font-bold text-green-600">
                          {formatBRL(dadosConsolidados[tipo]?.vendas)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">
                          Devoluções:
                        </span>
                        <span className="font-bold text-red-600">
                          {formatBRL(
                            Math.abs(dadosConsolidados[tipo]?.devolucoes),
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">
                          Venda Líquida:
                        </span>
                        <span className="font-bold text-blue-600">
                          {formatBRL(dadosConsolidados[tipo]?.venda_liquida)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">
                          Frete:
                        </span>
                        <span className="font-bold text-purple-600">
                          {formatBRL(dadosConsolidados[tipo]?.frete)}
                        </span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-800">
                            Total:
                          </span>
                          <span className="font-bold text-[#000638] text-lg">
                            {formatBRL(dadosConsolidados[tipo]?.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-10">
            {/* Gráfico de Pizza - Distribuição por Tipo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ChartPieSlice size={20} className="text-[#000638]" />
                  <CardTitle className="text-lg font-bold text-[#000638]">
                    Distribuição do Faturamento por Canal
                  </CardTitle>
                </div>
                <CardDescription>
                  Percentual de participação de cada canal no faturamento total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 bg-white rounded">
                  <Pie data={dadosPizza} options={opcoesPizza} />
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Pizza - Frequência de Devoluções por Canal */}
            <Card
              className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white p-6 min-h-[420px] flex flex-col justify-center items-center cursor-pointer"
              onClick={() =>
                setModalGrafico({
                  tipo: 'devolucao',
                  title: 'Frequência de Devoluções por Canal',
                  data: {
                    labels: ['Varejo', 'Multimarcas', 'Franquias', 'Revenda'],
                    datasets: [
                      {
                        data: [
                          Math.abs(dadosConsolidados.varejo?.devolucoes || 0),
                          Math.abs(dadosConsolidados.mtm?.devolucoes || 0),
                          Math.abs(
                            dadosConsolidados.franquias?.devolucoes || 0,
                          ),
                          Math.abs(dadosConsolidados.revenda?.devolucoes || 0),
                        ],
                        backgroundColor: [
                          '#3B82F6',
                          '#10B981',
                          '#F59E0B',
                          '#EF4444',
                        ],
                        borderWidth: 2,
                        borderColor: '#fff',
                      },
                    ],
                  },
                })
              }
            >
              {/* Modal para gráfico ampliado - agora também para os cards de canal e devolução */}
              {modalGrafico && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                  <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full flex flex-col items-center relative">
                    <button
                      onClick={() => setModalGrafico(null)}
                      className="absolute top-4 right-4 text-gray-500 hover:text-red-600 text-2xl font-bold"
                      aria-label="Fechar"
                    >
                      &times;
                    </button>
                    <div className="mb-4 flex items-center gap-2">
                      <ChartPieSlice size={28} className="text-[#000638]" />
                      <span className="text-2xl font-bold text-[#000638]">
                        {modalGrafico.title || modalGrafico.canalLabel}
                      </span>
                    </div>
                    <div
                      className="w-full flex items-center justify-center"
                      style={{ height: '480px' }}
                    >
                      <Pie
                        data={modalGrafico.data || modalGrafico.pizzaData}
                        options={opcoesPizza}
                      />
                    </div>
                  </div>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ChartPieSlice size={20} className="text-[#000638]" />
                  <CardTitle className="text-lg font-bold text-[#000638]">
                    Frequência de Devoluções por Canal
                  </CardTitle>
                </div>
                <CardDescription>
                  Veja qual canal tem maior frequência de devoluções
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full flex items-center justify-center">
                  <Pie
                    data={{
                      labels: ['Varejo', 'Multimarcas', 'Franquias', 'Revenda'],
                      datasets: [
                        {
                          data: [
                            Math.abs(dadosConsolidados.varejo?.devolucoes || 0),
                            Math.abs(dadosConsolidados.mtm?.devolucoes || 0),
                            Math.abs(
                              dadosConsolidados.franquias?.devolucoes || 0,
                            ),
                            Math.abs(
                              dadosConsolidados.revenda?.devolucoes || 0,
                            ),
                          ],
                          backgroundColor: [
                            '#3B82F6',
                            '#10B981',
                            '#F59E0B',
                            '#EF4444',
                          ],
                          borderWidth: 2,
                          borderColor: '#fff',
                        },
                      ],
                    }}
                    options={opcoesPizza}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4 Gráficos de Pizza - Faturamento por Empresa para cada Canal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-10">
            {['varejo', 'mtm', 'franquias', 'revenda'].map((canal) => {
              // Agrupa faturamento por empresa para o canal
              const dados = dadosFaturamento[canal] || [];
              const empresas = dados.map(
                (item) => item.nm_grupoempresa || `Empresa ${item.cd_empresa}`,
              );
              const valores = dados.map((item) => parseFloat(item.total) || 0);
              const pizzaData = {
                labels: empresas,
                datasets: [
                  {
                    data: valores,
                    backgroundColor: [
                      '#3B82F6',
                      '#10B981',
                      '#F59E0B',
                      '#EF4444',
                      '#6366F1',
                      '#F472B6',
                      '#F87171',
                      '#34D399',
                      '#A78BFA',
                      '#FBBF24',
                      '#6EE7B7',
                      '#F9A8D4',
                      '#FDE68A',
                      '#C7D2FE',
                      '#FCA5A5',
                      '#A3E635',
                      '#FCD34D',
                      '#818CF8',
                      '#FECACA',
                      '#F3F4F6',
                    ],
                    borderWidth: 2,
                    borderColor: '#fff',
                  },
                ],
              };
              const canalLabel = {
                varejo: 'Varejo',
                mtm: 'Multimarcas',
                franquias: 'Franquias',
                revenda: 'Revenda',
              }[canal];
              return (
                <Card
                  key={canal}
                  className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
                  onClick={() =>
                    setModalGrafico({ canal, pizzaData, canalLabel })
                  }
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ChartPieSlice size={20} className="text-[#000638]" />
                      <CardTitle className="text-lg font-bold text-[#000638]">
                        {canalLabel} - Faturamento por Empresa
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Distribuição do faturamento por empresa ({canalLabel})
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 bg-white rounded">
                      <Pie data={pizzaData} options={opcoesPizza} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Modal para gráfico ampliado */}
          {modalGrafico && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full flex flex-col items-center relative">
                <button
                  onClick={() => setModalGrafico(null)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-600 text-2xl font-bold"
                  aria-label="Fechar"
                >
                  &times;
                </button>
                <div className="mb-4 flex items-center gap-2">
                  <ChartPieSlice size={28} className="text-[#000638]" />
                  <span className="text-2xl font-bold text-[#000638]">
                    {modalGrafico.canalLabel} - Faturamento por Empresa
                  </span>
                </div>
                <div
                  className="w-full flex items-center justify-center"
                  style={{ height: '480px' }}
                >
                  <Pie data={modalGrafico.pizzaData} options={opcoesPizza} />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-gray-50 rounded-xl p-8 max-w-md">
            <ChartLineUp size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Nenhum dado encontrado
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              Selecione um período e clique em "Buscar Dados" para visualizar o
              dashboard de faturamento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFaturamento;
