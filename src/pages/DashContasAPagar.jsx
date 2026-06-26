import React, { useEffect, useState, useMemo, memo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import PageTitle from '../components/ui/PageTitle';
import {
  Receipt,
  Calendar,
  Funnel,
  Spinner,
  CurrencyDollar,
  Clock,
  Warning,
  CheckCircle,
  ChartBar,
  ChartPieSlice,
  Buildings,
  Users,
  Tag,
  X,
  FileArrowDown,
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
  PointElement,
  LineElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getCategoriaPorCodigo } from '../config/categoriasDespesas';
import CENTROS_CUSTO from '../config/centrosCusto.json';
import {
  agruparDadosIdenticos,
  getStatusFromData,
  criarDataSemFusoHorario,
  formatarData,
} from '../components/ContasAPagar';

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

const CORES = [
  '#000638',
  '#fe0000',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#e11d48',
  '#0ea5e9',
  '#a855f7',
  '#22c55e',
];

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

// Classificação por Plano de Contas (mesma lógica de DespesasPorCategoria)
const classificarDespesa = (cdDespesa) => {
  const codigo = parseInt(cdDespesa) || 0;
  const categoriaExcecao = getCategoriaPorCodigo(codigo);
  if (categoriaExcecao) return categoriaExcecao;
  if (codigo >= 1000 && codigo <= 1999) return 'CUSTO DAS MERCADORIAS VENDIDAS';
  if (codigo >= 2000 && codigo <= 2999) return 'DESPESAS OPERACIONAIS';
  if (codigo >= 3000 && codigo <= 3999) return 'DESPESAS COM PESSOAL';
  if (codigo >= 4001 && codigo <= 4999) return 'ALUGUÉIS E ARRENDAMENTOS';
  if (codigo >= 5000 && codigo <= 5999)
    return 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES';
  if (codigo >= 6000 && codigo <= 6999) return 'DESPESAS GERAIS';
  if (codigo >= 7000 && codigo <= 7999) return 'DESPESAS FINANCEIRAS';
  if (codigo >= 9000 && codigo <= 9999) return 'DESPESAS C/ VENDAS';
  return 'SEM CLASSIFICAÇÃO';
};

const MESES_MAP = {
  JAN: 1,
  FEV: 2,
  MAR: 3,
  ABR: 4,
  MAI: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SET: 9,
  OUT: 10,
  NOV: 11,
  DEZ: 12,
};
const MESES = Object.keys(MESES_MAP);

const DashContasAPagar = memo(() => {
  const apiClient = useApiClient();

  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [modoData, setModoData] = useState('vencimento');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

  const [filtroMes, setFiltroMes] = useState('ANO');
  // Situação dos títulos (parâmetro da API): N = NORMAL, C = CANCELADA
  const [filtroSituacao, setFiltroSituacao] = useState('N');
  // Status de pagamento (filtro client-side): TODOS | PAGOS | EM ABERTO
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  // Modal de detalhamento (fornecedor / plano / centro de custo / despesa)
  const [detalhe, setDetalhe] = useState(null); // { tipo, chave, titulo }

  // Datas padrão (mês atual)
  useEffect(() => {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setDataInicio(primeiro.toISOString().split('T')[0]);
    setDataFim(ultimo.toISOString().split('T')[0]);
  }, []);

  // ======================== BUSCAR DADOS ========================
  const buscarDados = async () => {
    if (!dataInicio || !dataFim) return;
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }

    setLoading(true);
    try {
      const codigosEmpresas = empresasSelecionadas
        .filter((e) => e.cd_empresa)
        .map((e) => parseInt(e.cd_empresa));

      const payload = {
        dt_inicio: dataInicio,
        dt_fim: dataFim,
        branches: codigosEmpresas,
        modo: modoData,
        situacao: filtroSituacao,
        previsao: 'TODOS',
        filtroPagamento: 'TODOS',
      };

      const result = await apiClient.totvs.accountsPayableSearch(payload);

      let dadosArray = [];
      if (result && typeof result === 'object') {
        if (Array.isArray(result.data)) dadosArray = result.data;
        else if (result.data && Array.isArray(result.data.data))
          dadosArray = result.data.data;
        else if (result.metadata && Array.isArray(result.metadata.data))
          dadosArray = result.metadata.data;
      }

      // Mapa código empresa → nome
      const empresaMap = {};
      empresasSelecionadas.forEach((e) => {
        if (e.cd_empresa) {
          empresaMap[String(e.cd_empresa)] =
            e.nm_grupoempresa || e.fantasyName || e.description || '';
        }
      });

      const dadosProcessados = dadosArray.map((item) => ({
        ...item,
        nm_fornecedor: item.nm_fornecedor || '',
        ds_despesaitem: item.ds_despesaitem || '',
        cd_despesaitem: item.cd_despesaitem || '',
        cd_ccusto: item.cd_ccusto || '',
        ds_ccusto: item.ds_ccusto || (item.cd_ccusto ? '----' : ''),
        nm_empresa: empresaMap[String(item.cd_empresa)] || '',
      }));

      setDados(dadosProcessados);
      setDadosCarregados(true);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      alert(`Erro ao buscar dados: ${err.message || err}`);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  // Itens agrupados (remove duplicações idênticas) + filtro mensal + filtro de status
  const itens = useMemo(() => {
    let agrupados = agruparDadosIdenticos(dados).map((g) => g.item);
    if (filtroMes !== 'ANO') {
      const mes = MESES_MAP[filtroMes];
      agrupados = agrupados.filter((item) => {
        const dv = criarDataSemFusoHorario(item.dt_vencimento);
        return dv && dv.getMonth() + 1 === mes;
      });
    }
    if (filtroStatus !== 'TODOS') {
      agrupados = agrupados.filter((item) => {
        const pago = getStatusFromData(item) === 'Pago';
        return filtroStatus === 'PAGOS' ? pago : !pago;
      });
    }
    return agrupados;
  }, [dados, filtroMes, filtroStatus]);

  // ======================== MÉTRICAS ========================
  const metricas = useMemo(() => {
    let totalPagar = 0;
    let pago = 0;
    let emAberto = 0;
    let vencido = 0;

    const fornMap = {};

    itens.forEach((item) => {
      const vlDup = parseFloat(item.vl_duplicata) || 0;
      const vlPago = parseFloat(item.vl_pago) || 0;
      const saldo = vlDup - vlPago;
      const status = getStatusFromData(item);

      totalPagar += vlDup;
      pago += vlPago;
      if (status !== 'Pago') {
        emAberto += saldo;
        if (status === 'Vencido') vencido += saldo;

        // Top fornecedores — somente em aberto (maior débito)
        const key = String(item.cd_fornecedor || 'N/I');
        const nome =
          item.nm_fornecedor || `Fornecedor ${item.cd_fornecedor || 'N/I'}`;
        if (!fornMap[key]) {
          fornMap[key] = {
            cd_fornecedor: item.cd_fornecedor,
            nome,
            valor: 0,
            vencido: 0,
            aVencer: 0,
            qtd: 0,
          };
        }
        if (nome && fornMap[key].nome !== nome) fornMap[key].nome = nome;
        fornMap[key].valor += saldo;
        if (status === 'Vencido') fornMap[key].vencido += saldo;
        else fornMap[key].aVencer += saldo;
        fornMap[key].qtd += 1;
      }
    });

    const topFornecedores = Object.values(fornMap)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 15);

    return {
      totalPagar,
      pago,
      emAberto,
      vencido,
      topFornecedores,
      qtdTitulos: itens.length,
    };
  }, [itens]);

  // Valor base conforme filtro de status (para plano/centro/despesa)
  const valorBase = (item) => {
    const vlDup = parseFloat(item.vl_duplicata) || 0;
    const vlPago = parseFloat(item.vl_pago) || 0;
    const status = getStatusFromData(item);
    if (filtroStatus === 'PAGOS') return status === 'Pago' ? vlPago : 0;
    if (filtroStatus === 'EM ABERTO')
      return status !== 'Pago' ? vlDup - vlPago : 0;
    return vlDup; // TODOS
  };

  // Por Plano de Contas
  const porPlanoContas = useMemo(() => {
    const map = {};
    itens.forEach((item) => {
      const v = valorBase(item);
      if (v <= 0) return;
      const cat = classificarDespesa(item.cd_despesaitem);
      if (!map[cat]) map[cat] = { nome: cat, valor: 0, qtd: 0 };
      map[cat].valor += v;
      map[cat].qtd += 1;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, filtroStatus]);

  // Por Centro de Custo
  const porCentroCusto = useMemo(() => {
    const map = {};
    itens.forEach((item) => {
      const v = valorBase(item);
      if (v <= 0) return;
      const cod = String(item.cd_ccusto || 'N/I');
      const nomeJson = CENTROS_CUSTO[cod];
      const nomeItem =
        item.ds_ccusto && item.ds_ccusto !== '----' ? item.ds_ccusto : null;
      const nome = nomeJson || nomeItem;
      const label =
        cod === 'N/I'
          ? 'SEM C. CUSTO'
          : nome
            ? `${cod} - ${nome}`
            : `C. Custo ${cod}`;
      if (!map[cod]) map[cod] = { codigo: cod, nome: label, valor: 0, qtd: 0 };
      map[cod].valor += v;
      map[cod].qtd += 1;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, filtroStatus]);

  // Por Despesa
  const porDespesa = useMemo(() => {
    const map = {};
    itens.forEach((item) => {
      const v = valorBase(item);
      if (v <= 0) return;
      const nome = item.ds_despesaitem || 'SEM DESCRIÇÃO';
      if (!map[nome]) map[nome] = { nome, valor: 0, qtd: 0 };
      map[nome].valor += v;
      map[nome].qtd += 1;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, filtroStatus]);

  // ======================== GRÁFICOS ========================
  const chartStatus = useMemo(() => {
    if (!metricas.totalPagar) return null;
    return {
      labels: ['Pago', 'Em Aberto'],
      datasets: [
        {
          data: [metricas.pago, metricas.emAberto],
          backgroundColor: ['#10b981', '#f59e0b'],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  }, [metricas]);

  const chartPlano = useMemo(() => {
    if (!porPlanoContas.length) return null;
    return {
      labels: porPlanoContas.map((p) => p.nome),
      datasets: [
        {
          data: porPlanoContas.map((p) => p.valor),
          backgroundColor: CORES.slice(0, porPlanoContas.length),
          borderWidth: 1,
          borderColor: '#fff',
        },
      ],
    };
  }, [porPlanoContas]);

  const chartFornecedores = useMemo(() => {
    const top10 = metricas.topFornecedores.slice(0, 10);
    if (!top10.length) return null;
    return {
      labels: top10.map((d) =>
        d.nome.length > 25 ? d.nome.substring(0, 25) + '…' : d.nome,
      ),
      datasets: [
        {
          label: 'Vencido',
          data: top10.map((d) => d.vencido),
          backgroundColor: '#fe0000',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'A Vencer',
          data: top10.map((d) => d.aVencer),
          backgroundColor: '#f59e0b',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [metricas.topFornecedores]);

  const chartCentroCusto = useMemo(() => {
    const top10 = porCentroCusto.slice(0, 10);
    if (!top10.length) return null;
    return {
      labels: top10.map((p) =>
        p.nome.length > 22 ? p.nome.substring(0, 22) + '…' : p.nome,
      ),
      datasets: [
        {
          label: 'Valor',
          data: top10.map((p) => p.valor),
          backgroundColor: CORES.slice(0, top10.length),
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [porCentroCusto]);

  const chartDespesa = useMemo(() => {
    const top12 = porDespesa.slice(0, 12);
    if (!top12.length) return null;
    return {
      labels: top12.map((p) =>
        p.nome.length > 22 ? p.nome.substring(0, 22) + '…' : p.nome,
      ),
      datasets: [
        {
          label: 'Valor',
          data: top12.map((p) => p.valor),
          backgroundColor: CORES.slice(0, top12.length),
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [porDespesa]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      datalabels: {
        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
        color: '#fff',
        font: { weight: 'bold', size: 9 },
        formatter: (v) => formatCurrency(v),
        anchor: 'center',
        align: 'center',
        clip: true,
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label || ''}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 0 },
        grid: { display: false },
      },
      y: {
        ticks: { font: { size: 9 }, callback: (v) => formatCurrency(v) },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  const barStackedOptions = {
    ...barOptions,
    plugins: {
      ...barOptions.plugins,
      legend: {
        display: true,
        position: 'top',
        labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
      },
      datalabels: { display: false },
    },
    scales: {
      x: { ...barOptions.scales.x, stacked: true },
      y: { ...barOptions.scales.y, stacked: true },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold', size: 10 },
        formatter: (v, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
          return pct > 3 ? `${pct}%` : '';
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
  };

  // ======================== DETALHAMENTO ========================
  const titulosDetalhe = useMemo(() => {
    if (!detalhe) return [];
    return itens
      .filter((item) => {
        if (detalhe.tipo === 'fornecedor') {
          if (String(item.cd_fornecedor || 'N/I') !== String(detalhe.chave))
            return false;
          return getStatusFromData(item) !== 'Pago';
        }
        if (detalhe.tipo === 'plano')
          return classificarDespesa(item.cd_despesaitem) === detalhe.chave;
        if (detalhe.tipo === 'ccusto')
          return String(item.cd_ccusto || 'N/I') === String(detalhe.chave);
        if (detalhe.tipo === 'despesa')
          return (item.ds_despesaitem || 'SEM DESCRIÇÃO') === detalhe.chave;
        return false;
      })
      .sort(
        (a, b) =>
          (parseFloat(b.vl_duplicata) || 0) - (parseFloat(a.vl_duplicata) || 0),
      );
  }, [detalhe, itens]);

  const exportarDetalhe = () => {
    if (!titulosDetalhe.length) return;
    const linhas = titulosDetalhe.map((t) => {
      const vlDup = parseFloat(t.vl_duplicata) || 0;
      const vlPago = parseFloat(t.vl_pago) || 0;
      return {
        Empresa: t.nm_empresa ? `${t.cd_empresa} - ${t.nm_empresa}` : t.cd_empresa,
        'Cód. Fornecedor': t.cd_fornecedor || '',
        Fornecedor: t.nm_fornecedor || '',
        Despesa: t.ds_despesaitem || '',
        'Centro de Custo': t.cd_ccusto || '',
        Duplicata: t.nr_duplicata || '',
        Parcela: t.nr_parcela || '',
        Emissão: formatarData(t.dt_emissao),
        Vencimento: formatarData(t.dt_vencimento),
        Liquidação: formatarData(t.dt_liq),
        Status: getStatusFromData(t),
        'Valor Duplicata': vlDup,
        'Valor Pago': vlPago,
        Saldo: vlDup - vlPago,
      };
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws['!cols'] = [
      { wch: 22 },
      { wch: 12 },
      { wch: 32 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Títulos');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `Detalhe_${(detalhe?.titulo || 'titulos').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  };

  // ======================== RENDER ========================
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Dashboard Contas a Pagar"
        subtitle="Visão consolidada de débitos por fornecedor, plano de contas, centro de custo e despesa"
        icon={ChartBar}
        iconColor="text-red-600"
      />

      {/* ============ FILTROS ============ */}
      <div className="mb-4">
        <div className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full border border-[#000638]/10">
          <div className="mb-2">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={18} weight="bold" />
              Filtros
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="lg:col-span-2">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Tipo de Data
              </label>
              <select
                value={modoData}
                onChange={(e) => setModoData(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="vencimento">Vencimento</option>
                <option value="emissao">Emissão</option>
                <option value="liquidacao">Pagamento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Situação
              </label>
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="N">NORMAL</option>
                <option value="C">CANCELADA</option>
              </select>
            </div>
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
            <div>
              <button
                onClick={buscarDados}
                className="flex gap-1 bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-8 text-xs font-bold shadow-md tracking-wide uppercase w-full justify-center mt-4"
                disabled={loading || !dataInicio || !dataFim}
              >
                {loading ? (
                  <>
                    <Spinner size={12} className="animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Calendar size={12} />
                    Buscar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ LOADING ============ */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-600">Carregando dados...</span>
        </div>
      )}

      {/* ============ SEM DADOS ============ */}
      {!loading && !dadosCarregados && (
        <div className="flex justify-center items-center py-16 text-gray-500 text-sm">
          Selecione o período e empresa, depois clique em "Buscar"
        </div>
      )}

      {/* ============ DASHBOARD ============ */}
      {!loading && dadosCarregados && (
        <>
          {/* Filtro mensal global */}
          <div className="flex flex-wrap gap-1 mb-3">
            {['ANO', ...MESES].map((mes) => (
              <button
                key={mes}
                onClick={() => setFiltroMes(mes)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  filtroMes === mes
                    ? 'bg-[#000638] text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {mes}
              </button>
            ))}
          </div>

          {/* Filtro de status de pagamento (global) */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold text-gray-500">Status:</span>
            {['TODOS', 'PAGOS', 'EM ABERTO'].map((st) => (
              <button
                key={st}
                onClick={() => setFiltroStatus(st)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  filtroStatus === st
                    ? st === 'PAGOS'
                      ? 'bg-green-600 text-white shadow-md'
                      : st === 'EM ABERTO'
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-[#000638] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* ---- CARDS PRINCIPAIS ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={16} className="text-[#000638]" />
                  <CardTitle className="text-xs font-bold text-[#000638]">
                    Total a Pagar
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-[#000638]">
                  {formatCurrency(metricas.totalPagar)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  {metricas.qtdTitulos} título(s) no período
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <CardTitle className="text-xs font-bold text-green-700">
                    Pago
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-green-600">
                  {formatCurrency(metricas.pago)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Valor total pago
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-orange-500" />
                  <CardTitle className="text-xs font-bold text-orange-600">
                    Em Aberto
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-orange-500">
                  {formatCurrency(metricas.emAberto)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Saldo pendente de pagamento
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Warning size={16} className="text-red-600" />
                  <CardTitle className="text-xs font-bold text-red-700">
                    Vencido
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-red-600">
                  {formatCurrency(metricas.vencido)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Títulos vencidos em aberto
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* ---- LINHA 1: Pago x Em Aberto + Plano de Contas ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            {/* Pago x Em Aberto */}
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ChartPieSlice size={16} className="text-green-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Pago x Em Aberto
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {chartStatus ? (
                  <div style={{ height: 320 }}>
                    <Doughnut data={chartStatus} options={pieOptions} />
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12 text-sm">
                    Sem dados
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-green-700">Pago</span>
                    <span className="font-bold text-green-700">
                      {formatCurrency(metricas.pago)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-orange-600">
                      Em Aberto
                    </span>
                    <span className="font-bold text-orange-600">
                      {formatCurrency(metricas.emAberto)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plano de Contas */}
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ChartPieSlice size={16} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Débito por Plano de Contas
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {chartPlano ? (
                  <div style={{ height: 320 }}>
                    <Doughnut data={chartPlano} options={pieOptions} />
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12 text-sm">
                    Sem dados
                  </div>
                )}
                {porPlanoContas.length > 0 && (
                  <div className="mt-3 max-h-44 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1 font-semibold text-gray-700">
                            Plano de Contas
                          </th>
                          <th className="text-center px-2 py-1 font-semibold text-gray-700">
                            Qtd
                          </th>
                          <th className="text-right px-2 py-1 font-semibold text-gray-700">
                            Valor
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {porPlanoContas.map((p, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              setDetalhe({
                                tipo: 'plano',
                                chave: p.nome,
                                titulo: p.nome,
                              })
                            }
                          >
                            <td className="px-2 py-1 text-gray-800 flex items-center gap-1">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{
                                  backgroundColor: CORES[i % CORES.length],
                                }}
                              />
                              {p.nome}
                            </td>
                            <td className="text-center px-2 py-1 text-gray-600">
                              {p.qtd}
                            </td>
                            <td className="text-right px-2 py-1 font-semibold text-blue-600">
                              {formatCurrency(p.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ---- TOP FORNECEDORES ---- */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-red-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Fornecedores com Maior Débito (Em Aberto)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    {chartFornecedores ? (
                      <div style={{ height: 360 }}>
                        <Bar
                          data={chartFornecedores}
                          options={barStackedOptions}
                        />
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-12 text-sm">
                        Sem débitos em aberto
                      </div>
                    )}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {metricas.topFornecedores.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-semibold text-gray-700">
                              Fornecedor
                            </th>
                            <th className="text-center px-2 py-1.5 font-semibold text-gray-700">
                              Qtd
                            </th>
                            <th className="text-right px-2 py-1.5 font-semibold text-red-600">
                              Vencido
                            </th>
                            <th className="text-right px-2 py-1.5 font-semibold text-orange-500">
                              A Vencer
                            </th>
                            <th className="text-right px-2 py-1.5 font-semibold text-gray-700">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {metricas.topFornecedores.map((d, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                              onClick={() =>
                                setDetalhe({
                                  tipo: 'fornecedor',
                                  chave: String(d.cd_fornecedor || 'N/I'),
                                  titulo: d.nome,
                                })
                              }
                            >
                              <td className="px-2 py-1 text-gray-800">
                                <span className="font-medium">
                                  {d.cd_fornecedor}
                                </span>{' '}
                                - {d.nome}
                              </td>
                              <td className="text-center px-2 py-1 text-gray-600">
                                {d.qtd}
                              </td>
                              <td className="text-right px-2 py-1 font-semibold text-red-600">
                                {formatCurrency(d.vencido)}
                              </td>
                              <td className="text-right px-2 py-1 font-semibold text-orange-500">
                                {formatCurrency(d.aVencer)}
                              </td>
                              <td className="text-right px-2 py-1 font-semibold text-gray-800">
                                {formatCurrency(d.valor)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-bold">
                            <td className="px-2 py-1.5 text-gray-800">TOTAL</td>
                            <td className="text-center px-2 py-1.5 text-gray-800">
                              {metricas.topFornecedores.reduce(
                                (a, d) => a + d.qtd,
                                0,
                              )}
                            </td>
                            <td className="text-right px-2 py-1.5 text-red-700">
                              {formatCurrency(
                                metricas.topFornecedores.reduce(
                                  (a, d) => a + d.vencido,
                                  0,
                                ),
                              )}
                            </td>
                            <td className="text-right px-2 py-1.5 text-orange-600">
                              {formatCurrency(
                                metricas.topFornecedores.reduce(
                                  (a, d) => a + d.aVencer,
                                  0,
                                ),
                              )}
                            </td>
                            <td className="text-right px-2 py-1.5 text-gray-800">
                              {formatCurrency(
                                metricas.topFornecedores.reduce(
                                  (a, d) => a + d.valor,
                                  0,
                                ),
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center text-gray-400 py-12 text-sm">
                        Sem fornecedores em aberto
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---- CENTRO DE CUSTO ---- */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Buildings size={16} className="text-teal-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Débito por Centro de Custo
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    {chartCentroCusto ? (
                      <div style={{ height: 360 }}>
                        <Bar data={chartCentroCusto} options={barOptions} />
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-12 text-sm">
                        Sem dados
                      </div>
                    )}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {porCentroCusto.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-semibold text-gray-700">
                              Centro de Custo
                            </th>
                            <th className="text-center px-2 py-1.5 font-semibold text-gray-700">
                              Qtd
                            </th>
                            <th className="text-right px-2 py-1.5 font-semibold text-gray-700">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {porCentroCusto.map((p, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                              onClick={() =>
                                setDetalhe({
                                  tipo: 'ccusto',
                                  chave: p.codigo,
                                  titulo: p.nome,
                                })
                              }
                            >
                              <td className="px-2 py-1 text-gray-800 flex items-center gap-1">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{
                                    backgroundColor: CORES[i % CORES.length],
                                  }}
                                />
                                {p.nome}
                              </td>
                              <td className="text-center px-2 py-1 text-gray-600">
                                {p.qtd}
                              </td>
                              <td className="text-right px-2 py-1 font-semibold text-teal-600">
                                {formatCurrency(p.valor)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-bold">
                            <td className="px-2 py-1.5 text-gray-800">TOTAL</td>
                            <td className="text-center px-2 py-1.5 text-gray-800">
                              {porCentroCusto.reduce((a, p) => a + p.qtd, 0)}
                            </td>
                            <td className="text-right px-2 py-1.5 text-teal-700">
                              {formatCurrency(
                                porCentroCusto.reduce((a, p) => a + p.valor, 0),
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center text-gray-400 py-12 text-sm">
                        Sem dados
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---- DESPESAS ---- */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Débito por Despesa
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    {chartDespesa ? (
                      <div style={{ height: 380 }}>
                        <Bar data={chartDespesa} options={barOptions} />
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-12 text-sm">
                        Sem dados
                      </div>
                    )}
                  </div>
                  <div className="max-h-[380px] overflow-y-auto">
                    {porDespesa.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-semibold text-gray-700">
                              Despesa
                            </th>
                            <th className="text-center px-2 py-1.5 font-semibold text-gray-700">
                              Qtd
                            </th>
                            <th className="text-right px-2 py-1.5 font-semibold text-gray-700">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {porDespesa.map((p, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                              onClick={() =>
                                setDetalhe({
                                  tipo: 'despesa',
                                  chave: p.nome,
                                  titulo: p.nome,
                                })
                              }
                            >
                              <td className="px-2 py-1 text-gray-800 flex items-center gap-1">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{
                                    backgroundColor: CORES[i % CORES.length],
                                  }}
                                />
                                {p.nome}
                              </td>
                              <td className="text-center px-2 py-1 text-gray-600">
                                {p.qtd}
                              </td>
                              <td className="text-right px-2 py-1 font-semibold text-purple-600">
                                {formatCurrency(p.valor)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-bold">
                            <td className="px-2 py-1.5 text-gray-800">TOTAL</td>
                            <td className="text-center px-2 py-1.5 text-gray-800">
                              {porDespesa.reduce((a, p) => a + p.qtd, 0)}
                            </td>
                            <td className="text-right px-2 py-1.5 text-purple-700">
                              {formatCurrency(
                                porDespesa.reduce((a, p) => a + p.valor, 0),
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center text-gray-400 py-12 text-sm">
                        Sem dados
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---- MODAL DETALHAMENTO ---- */}
          {detalhe && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Receipt size={20} className="text-red-600" />
                    <h2 className="text-lg font-bold text-[#000638]">
                      {detalhe.titulo}
                    </h2>
                    <span className="text-sm text-gray-500 ml-2">
                      {titulosDetalhe.length} título(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportarDetalhe}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-bold shadow-md"
                      title="Exportar para Excel"
                    >
                      <FileArrowDown size={16} />
                      Excel
                    </button>
                    <button
                      onClick={() => setDetalhe(null)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                      title="Fechar"
                    >
                      <X size={20} weight="bold" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {titulosDetalhe.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-2 font-semibold text-gray-700">
                            Empresa
                          </th>
                          <th className="text-left px-2 py-2 font-semibold text-gray-700">
                            Fornecedor
                          </th>
                          <th className="text-left px-2 py-2 font-semibold text-gray-700">
                            Despesa
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            C.Custo
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            Duplicata
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            Vencimento
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            Status
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-gray-700">
                            Valor
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-gray-700">
                            Pago
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-gray-700">
                            Saldo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {titulosDetalhe.map((t, i) => {
                          const vlDup = parseFloat(t.vl_duplicata) || 0;
                          const vlPg = parseFloat(t.vl_pago) || 0;
                          const saldo = vlDup - vlPg;
                          const status = getStatusFromData(t);
                          return (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-2 py-1.5 text-gray-700">
                                {t.nm_empresa
                                  ? `${t.cd_empresa} - ${t.nm_empresa}`
                                  : t.cd_empresa}
                              </td>
                              <td className="px-2 py-1.5 text-gray-800">
                                <span className="font-medium">
                                  {t.cd_fornecedor}
                                </span>{' '}
                                - {t.nm_fornecedor}
                              </td>
                              <td className="px-2 py-1.5 text-gray-600">
                                {t.ds_despesaitem}
                              </td>
                              <td
                                className="text-center px-2 py-1.5 text-gray-600"
                                title={CENTROS_CUSTO[String(t.cd_ccusto)] || ''}
                              >
                                {t.cd_ccusto
                                  ? CENTROS_CUSTO[String(t.cd_ccusto)]
                                    ? `${t.cd_ccusto} - ${CENTROS_CUSTO[String(t.cd_ccusto)]}`
                                    : t.cd_ccusto
                                  : '-'}
                              </td>
                              <td className="text-center px-2 py-1.5 text-gray-700">
                                {t.nr_duplicata}
                                {t.nr_parcela ? `/${t.nr_parcela}` : ''}
                              </td>
                              <td className="text-center px-2 py-1.5 text-gray-600">
                                {formatarData(t.dt_vencimento)}
                              </td>
                              <td className="text-center px-2 py-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    status === 'Pago'
                                      ? 'bg-green-100 text-green-700'
                                      : status === 'Vencido'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-orange-100 text-orange-700'
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>
                              <td className="text-right px-2 py-1.5 text-gray-800">
                                {formatCurrency(vlDup)}
                              </td>
                              <td className="text-right px-2 py-1.5 text-green-600">
                                {formatCurrency(vlPg)}
                              </td>
                              <td
                                className={`text-right px-2 py-1.5 font-semibold ${saldo > 0 ? 'text-red-600' : 'text-gray-500'}`}
                              >
                                {formatCurrency(saldo)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-gray-100 font-bold">
                          <td colSpan={7} className="px-2 py-2 text-gray-800">
                            TOTAL
                          </td>
                          <td className="text-right px-2 py-2 text-gray-800">
                            {formatCurrency(
                              titulosDetalhe.reduce(
                                (a, t) => a + (parseFloat(t.vl_duplicata) || 0),
                                0,
                              ),
                            )}
                          </td>
                          <td className="text-right px-2 py-2 text-green-700">
                            {formatCurrency(
                              titulosDetalhe.reduce(
                                (a, t) => a + (parseFloat(t.vl_pago) || 0),
                                0,
                              ),
                            )}
                          </td>
                          <td className="text-right px-2 py-2 text-red-700">
                            {formatCurrency(
                              titulosDetalhe.reduce(
                                (a, t) =>
                                  a +
                                  ((parseFloat(t.vl_duplicata) || 0) -
                                    (parseFloat(t.vl_pago) || 0)),
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center text-gray-400 py-12">
                      Nenhum título encontrado
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

DashContasAPagar.displayName = 'DashContasAPagar';
export default DashContasAPagar;
