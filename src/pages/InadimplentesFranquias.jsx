import React, { useState, useEffect, useMemo } from 'react';
import FiltroEstados from '../components/filters/FiltroEstados';
import FiltroClientes from '../components/filters/FiltroClientes';
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
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  ChartBar,
  CircleNotch,
  Users,
  CurrencyDollar,
  MapPin,
  Receipt,
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
);

const InadimplentesFranquias = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroDataInicial, setFiltroDataInicial] = useState('2024-04-01');
  const hojeStr = new Date().toISOString().slice(0, 10);
  const [filtroDataFinal, setFiltroDataFinal] = useState(hojeStr);
  const [filtroClientes, setFiltroClientes] = useState([]);
  const [filtroEstados, setFiltroEstados] = useState([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [faturasSelecionadas, setFaturasSelecionadas] = useState([]);
  const [obsModalAberto, setObsModalAberto] = useState(false);
  const [obsFatura, setObsFatura] = useState([]);
  const [obsLoading, setObsLoading] = useState(false);

  const fetchDados = async () => {
    try {
      setLoading(true);

      const params = {
        dt_vencimento_ini: '2024-01-01',
      };

      if (filtroDataInicial) params.dt_inicio = filtroDataInicial;
      if (filtroDataFinal) params.dt_fim = filtroDataFinal;

      // Rota específica para franquias (inclui pp.ds_uf e nome fantasia)
      const response = await apiClient.financial.inadimplentesFranquias(params);

      let dadosRecebidos = [];
      if (response?.success && response?.data) {
        dadosRecebidos = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        dadosRecebidos = response;
      }

      console.log(
        '📊 Dados recebidos de inadimplentes Franquias:',
        dadosRecebidos,
      );
      setDados(dadosRecebidos);
    } catch (error) {
      console.error('Erro ao buscar dados de inadimplentes:', error);
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, []);

  const dadosFiltrados = useMemo(() => {
    return dados.filter((item) => {
      // REGRA 1: Filtrar apenas tp_documento = 1 (faturas de mercadoria)
      const tipoDocumentoValido = !item.tp_documento || item.tp_documento === 1 || item.tp_documento === '1';
      
      // REGRA 2: Filtrar apenas tp_situacao = 1 (situação ativa/normal)
      const situacaoValida = !item.tp_situacao || item.tp_situacao === 1 || item.tp_situacao === '1';
      
      // REGRA 3: Não mostrar faturas canceladas (dt_cancelamento deve ser null)
      const naoCancelada = !item.dt_cancelamento || item.dt_cancelamento === null;
      
      // REGRA 4: Não mostrar faturas liquidadas (dt_liq deve ser null)
      const naoLiquidada = !item.dt_liq || item.dt_liq === null;

      const matchCliente =
        filtroClientes.length === 0 ||
        filtroClientes.includes(String(item.cd_cliente));

      // Para franquias o estado vem em pp.ds_uf (campo aninhado). Priorize pp.ds_uf
      const sigla =
        item.pp && item.pp.ds_uf
          ? String(item.pp.ds_uf).trim()
          : (item.ds_uf || '').trim();
      const matchEstado =
        filtroEstados.length === 0 || filtroEstados.includes(sigla);

      if (!item.dt_vencimento) return false;
      const hoje = new Date();
      const vencimento = new Date(item.dt_vencimento);
      const diferencaMs = hoje - vencimento;
      const diasAtraso = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

      const estaAtrasado = diasAtraso >= 1;

      return matchCliente && estaAtrasado && matchEstado && tipoDocumentoValido && situacaoValida && naoCancelada && naoLiquidada;
    });
  }, [dados, filtroClientes, filtroEstados]);

  const estadosDisponiveis = useMemo(() => {
    const setEstados = new Set();
    dados.forEach((d) => {
      const sigla =
        d.pp && d.pp.ds_uf ? String(d.pp.ds_uf).trim() : (d.ds_uf || '').trim();
      if (sigla) setEstados.add(sigla);
    });
    return Array.from(setEstados).filter(Boolean).sort();
  }, [dados]);

  const clientesDisponiveis = useMemo(() => {
    const map = new Map();
    (dados || []).forEach((d) => {
      if (d.cd_cliente) {
        const key = String(d.cd_cliente);
        if (!map.has(key)) {
          // Para franquias, exibir nome fantasia quando disponível
          const nome = d.nm_fantasia || d.nm_cliente || key;
          map.set(key, { cd_cliente: key, nm_cliente: nome });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.nm_cliente > b.nm_cliente ? 1 : -1,
    );
  }, [dados]);

  const clientesAgrupados = useMemo(() => {
    const agrupado = dadosFiltrados.reduce((acc, item) => {
      const cdCliente = item.cd_cliente;
      if (!acc[cdCliente]) {
        acc[cdCliente] = {
          cd_cliente: cdCliente,
          // guardar nome fantasia separadamente e nome legal
          nm_fantasia: item.nm_fantasia || null,
          nm_cliente: item.nm_cliente || null,
          // estado usando pp.ds_uf quando disponível
          ds_uf:
            item.pp && item.pp.ds_uf
              ? String(item.pp.ds_uf).trim()
              : item.ds_uf || null,
          valor_total: 0,
          faturas: [],
        };
      }
      acc[cdCliente].valor_total += parseFloat(item.vl_fatura) || 0;
      acc[cdCliente].faturas.push(item);
      return acc;
    }, {});

    return Object.values(agrupado);
  }, [dadosFiltrados]);

  const metricas = useMemo(() => {
    const totalClientes = clientesAgrupados.length;
    const valorTotal = clientesAgrupados.reduce(
      (acc, cliente) => acc + cliente.valor_total,
      0,
    );

    return {
      totalClientes,
      valorTotal,
    };
  }, [clientesAgrupados]);

  const dadosPorEstado = useMemo(() => {
    const agrupado = dadosFiltrados.reduce((acc, item) => {
      const estado =
        (item.pp && item.pp.ds_uf
          ? String(item.pp.ds_uf).trim()
          : item.ds_uf || ''
        ).trim() || 'Não informado';
      if (!acc[estado]) {
        acc[estado] = { clientes: 0, valor: 0 };
      }
      acc[estado].clientes += 1;
      acc[estado].valor += parseFloat(item.vl_fatura) || 0;
      return acc;
    }, {});

    const estados = Object.keys(agrupado);
    const clientesPorEstado = estados.map(
      (estado) => agrupado[estado].clientes,
    );

    return {
      estados,
      clientesPorEstado,
    };
  }, [dadosFiltrados]);

  const topClientes = useMemo(() => {
    if (!clientesAgrupados || clientesAgrupados.length === 0) return [];
    const sorted = [...clientesAgrupados]
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10);
    return sorted.map((c) => {
      const diasMax = (c.faturas || []).reduce((max, f) => {
        if (!f.dt_vencimento) return max;
        const diff = Math.floor(
          (new Date() - new Date(f.dt_vencimento)) / (1000 * 60 * 60 * 24),
        );
        return Math.max(max, diff);
      }, 0);
      return { ...c, diasAtrasoMax: diasMax };
    });
  }, [clientesAgrupados]);

  const graficoPrincipalData = {
    labels: topClientes.map((c) =>
      c.nm_cliente ? c.nm_cliente : c.cd_cliente,
    ),
    datasets: [
      {
        label: 'Valor Inadimplente (R$)',
        data: topClientes.map((c) => Number(c.valor_total || 0)),
        backgroundColor: '#000638',
        borderColor: '#000638',
        borderWidth: 1,
      },
    ],
  };

  const graficoEstadoData = {
    labels: dadosPorEstado.estados,
    datasets: [
      {
        label: 'Clientes',
        data: dadosPorEstado.clientesPorEstado,
        backgroundColor: '#000638',
        borderColor: '#000638',
        borderWidth: 1,
      },
    ],
  };

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  const formatarData = (data) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const calcularTempoInadimplencia = (dtVencimento) => {
    if (!dtVencimento) return 'N/A';

    const hoje = new Date();
    const vencimento = new Date(dtVencimento);
    const diferencaMs = hoje - vencimento;
    const dias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

    if (dias <= 0) return '0 dias';
    if (dias === 1) return '1 dia';
    if (dias < 30) return `${dias} dias`;
    if (dias < 365) {
      const meses = Math.floor(dias / 30);
      return meses === 1 ? '1 mês' : `${meses} meses`;
    }
    const anos = Math.floor(dias / 365);
    return anos === 1 ? '1 ano' : `${anos} anos`;
  };

  const abrirModal = (cliente) => {
    setClienteSelecionado(cliente);
    setFaturasSelecionadas(cliente.faturas);
    setModalAberto(true);
  };

  const abrirObsFatura = async (fatura) => {
    // Chamar rota obsfati com cd_cliente e nr_fat
    try {
      setObsLoading(true);
      const cd_cliente =
        clienteSelecionado?.cd_cliente || fatura.cd_cliente || '';
      const nr_fat = fatura.nr_fat || fatura.nr_fatura || '';

      const response = await apiClient.financial.obsFati({
        cd_cliente,
        nr_fat,
      });

      let rows = [];
      if (response && response.success && Array.isArray(response.data)) {
        rows = response.data;
      } else if (Array.isArray(response)) {
        rows = response;
      }

      setObsFatura(rows);
      setObsModalAberto(true);
    } catch (error) {
      console.error('Erro ao carregar observações da fatura', error);
      setObsFatura([]);
      setObsModalAberto(true);
    } finally {
      setObsLoading(false);
    }
  };

  const fecharModal = () => {
    setModalAberto(false);
    setClienteSelecionado(null);
    setFaturasSelecionadas([]);
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-6">
      <PageTitle
        title="Inadimplência Franquias"
        subtitle="Acompanhe os clientes inadimplentes das Franquias"
        icon={ChartBar}
        iconColor="text-purple-600"
      />
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDados();
          }}
        >
          <div className="text-sm font-semibold text-[#000638] mb-2">
            Configurações para análise de Inadimplência - Franquias
          </div>
          <span className="text-xs text-gray-500 mt-1">
            Filtros para consulta de clientes inadimplentes
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 mt-4">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Inicial
              </label>
              <input
                type="date"
                value={filtroDataInicial}
                onChange={(e) => setFiltroDataInicial(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Final
              </label>
              <input
                type="date"
                value={filtroDataFinal}
                onChange={(e) => setFiltroDataFinal(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div className="col-span-1">
              <FiltroClientes
                clientes={clientesDisponiveis}
                selected={filtroClientes}
                onChange={setFiltroClientes}
              />
            </div>
            <div className="col-span-1">
              <FiltroEstados
                estados={estadosDisponiveis}
                selected={filtroEstados}
                onChange={setFiltroEstados}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={fetchDados}
              disabled={loading}
              className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
            >
              {loading ? (
                <div className="inline-flex items-center gap-2">
                  <CircleNotch size={16} className="animate-spin" />
                  <span>Carregando...</span>
                </div>
              ) : (
                'Buscar Dados'
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <CardTitle className="text-sm font-bold text-blue-700">
                Total de Clientes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-blue-600 mb-0.5">
              {metricas.totalClientes}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Clientes inadimplentes
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={18} className="text-green-600" />
              <CardTitle className="text-sm font-bold text-green-700">
                Valor Total
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-green-600 mb-0.5">
              {formatarMoeda(metricas.valorTotal)}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Valor em aberto
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ChartBar size={18} className="text-blue-600" />
              <CardTitle className="text-sm font-bold text-blue-700">
                TOP CLIENTES INADIMPLENTES
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <CardDescription className="text-xs text-gray-500 mb-3">
              Visão geral dos dados de inadimplência
            </CardDescription>
            <div className="h-64">
              <Bar
                data={graficoPrincipalData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          const idx = context.dataIndex;
                          const cliente = topClientes[idx];
                          const valor = context.dataset.data[idx] || 0;
                          const valorFmt = new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(valor);
                          const dias = cliente?.diasAtrasoMax ?? 0;
                          return `${valorFmt} — ${dias} dias em atraso`;
                        },
                      },
                    },
                  },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-green-600" />
              <CardTitle className="text-sm font-bold text-green-700">
                Clientes por Estado
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <CardDescription className="text-xs text-gray-500 mb-3">
              Distribuição de inadimplentes por estado
            </CardDescription>
            <div className="h-64">
              <Bar
                data={graficoEstadoData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-purple-600" />
            <CardTitle className="text-sm font-bold text-purple-700">
              Lista de Clientes Inadimplentes
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            Detalhes completos dos clientes em situação de inadimplência
          </CardDescription>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" text="Carregando dados..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Código Cliente</th>
                    <th className="px-4 py-3">Nome Fantasia</th>
                    <th className="px-4 py-3">Nome Cliente</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesAgrupados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Nenhum cliente inadimplente encontrado
                      </td>
                    </tr>
                  ) : (
                    clientesAgrupados.map((cliente, index) => (
                      <tr
                        key={index}
                        className="bg-white border-b hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => abrirModal(cliente)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {cliente.cd_cliente || 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {cliente.nm_fantasia || '---'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {cliente.nm_cliente || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            {cliente.ds_uf || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-green-600">
                          {formatarMoeda(cliente.valor_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalhes das Faturas -{' '}
                {clienteSelecionado?.nm_fantasia ||
                  clienteSelecionado?.nm_cliente}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Nº Fatura</th>
                    <th className="px-4 py-3">Emissão</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Valor Fatura</th>
                    <th className="px-4 py-3">Juros</th>
                    <th className="px-4 py-3">Parcela</th>
                    <th className="px-4 py-3">Tempo Inadimplência</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasSelecionadas.map((fatura, index) => (
                    <tr
                      key={index}
                      className="bg-white border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => abrirObsFatura(fatura)}
                    >
                      <td className="px-4 py-3">
                        {fatura.cd_empresa || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {fatura.nr_fat || fatura.nr_fatura || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {formatarData(fatura.dt_emissao)}
                      </td>
                      <td className="px-4 py-3">
                        {formatarData(fatura.dt_vencimento)}
                      </td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {formatarMoeda(fatura.vl_fatura)}
                      </td>
                      <td className="px-4 py-3 font-medium text-red-600">
                        {formatarMoeda(fatura.vl_juros)}
                      </td>
                      <td className="px-4 py-3">
                        {fatura.nr_parcela || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
                          {calcularTempoInadimplencia(fatura.dt_vencimento)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={fecharModal}
                className="px-4 py-2 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {obsModalAberto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ zIndex: 99999 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Observações da Fatura
              </h3>
              <button
                onClick={() => setObsModalAberto(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              {obsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <LoadingSpinner size="sm" text="Carregando observações..." />
                </div>
              ) : obsFatura && obsFatura.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {obsFatura.map((o, idx) => (
                    <li key={idx} className="text-sm text-gray-700">
                      {o.ds_observacao}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">
                  Nenhuma observação encontrada para esta fatura.
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setObsModalAberto(false)}
                className="px-4 py-2 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InadimplentesFranquias;
