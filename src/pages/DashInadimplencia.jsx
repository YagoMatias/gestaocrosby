import React, { useEffect, useState, useMemo, memo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import PageTitle from '../components/ui/PageTitle';
import {
  Warning,
  ChartBar,
  ChartLineUp,
  Users,
  Wallet,
  Bank,
  Receipt,
  Spinner,
  ArrowsOut,
  X,
  FileArrowDown,
  CurrencyDollar,
  CalendarBlank,
  TrendDown,
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
  Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

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
  Filler,
  ChartDataLabels,
);

const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getCarteiraEfetiva = (item) => {
  const portador = (item.nm_portador || '').toUpperCase();
  if (portador.includes('SAFRA') || portador.includes('DALILA')) return 2;
  return parseInt(item.tp_cobranca) || 0;
};

const parseDateNoTZ = (isoDate) => {
  if (!isoDate) return null;
  try {
    const str = String(isoDate).substring(0, 10);
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  } catch {
    return null;
  }
};

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
  '#facc15',
  '#be185d',
  '#0d9488',
  '#7c3aed',
];

const DashInadimplencia = memo(() => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [portadorExpandido, setPortadorExpandido] = useState(false);
  const [portadorSelecionado, setPortadorSelecionado] = useState(null);

  // ======================== TIMELINE SUPABASE ========================
  const carregarTimeline = useCallback(async () => {
    setLoadingTimeline(true);
    try {
      const { data, error } = await supabase
        .from('inadimplencia_timeline')
        .select('data, valor_total, qtd_titulos, qtd_clientes')
        .order('data', { ascending: true });
      if (error) throw error;
      setTimeline(data || []);
    } catch (err) {
      console.error('Erro ao carregar timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  const salvarTimelineHoje = useCallback(
    async (valorTotal, qtdTitulos, qtdClientes) => {
      try {
        const hoje = new Date().toISOString().split('T')[0];
        const { error } = await supabase.from('inadimplencia_timeline').upsert(
          {
            data: hoje,
            valor_total: valorTotal,
            qtd_titulos: qtdTitulos,
            qtd_clientes: qtdClientes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'data' },
        );
        if (error) throw error;
        console.log('✅ Timeline salva para', hoje);
        await carregarTimeline();
      } catch (err) {
        console.error('Erro ao salvar timeline:', err);
      }
    },
    [carregarTimeline],
  );

  // ======================== BUSCAR DADOS ========================
  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const dataIni = '2024-04-01';
      const dataFim = new Date().toISOString().split('T')[0];

      // ============================================================
      // PASSO 1: Buscar clientes MULTIMARCAS e FRANQUIAS em paralelo
      // ============================================================
      console.log('🔍 Buscando clientes multimarcas e franquias...');
      const [respMultimarcas, respFranquias] = await Promise.all([
        fetch(`${TotvsURL}multibrand-clients`),
        fetch(`${TotvsURL}franchise-clients`),
      ]);

      let clientesMap = {};

      if (respMultimarcas.ok) {
        const resultMtm = await respMultimarcas.json();
        const multimarcas = resultMtm.data || [];
        multimarcas.forEach((m) => {
          clientesMap[String(m.code)] = { ...m, canal: 'MTM' };
        });
        console.log(`📋 ${multimarcas.length} clientes multimarcas`);
      }

      if (respFranquias.ok) {
        const resultFrq = await respFranquias.json();
        const franquias = resultFrq.data || [];
        franquias.forEach((f) => {
          clientesMap[String(f.code)] = { ...f, canal: 'FRQ' };
        });
        console.log(`📋 ${franquias.length} clientes franquias`);
      }

      const todosCodigosCanais = Object.keys(clientesMap);
      if (todosCodigosCanais.length === 0) {
        console.warn('⚠️ Nenhum cliente multimarcas/franquia encontrado.');
        setDados([]);
        setDadosCarregados(true);
        return;
      }

      const codigosParam = todosCodigosCanais.join(',');
      console.log(
        `📋 Total: ${todosCodigosCanais.length} clientes (MTM + FRQ)`,
      );

      // ============================================================
      // PASSO 2: Buscar contas a receber vencidas APENAS desses clientes
      // ============================================================
      const params = new URLSearchParams({
        dt_inicio: dataIni,
        dt_fim: dataFim,
        modo: 'vencimento',
        situacao: '1',
        status: 'Vencido',
        cd_cliente: codigosParam,
      });

      console.log('🔍 Buscando inadimplentes (MTM + FRQ) via TOTVS...');
      const response = await fetch(
        `${TotvsURL}accounts-receivable/filter?${params.toString()}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      const items = result.data?.items || [];

      // Filtrar apenas tp_documento = 1 (FATURA)
      const faturasFiltradas = items.filter(
        (item) => item.tp_documento === 1 || item.tp_documento === '1',
      );
      console.log(
        `📊 Faturas vencidas: ${items.length}, após filtro FATURA: ${faturasFiltradas.length}`,
      );

      // ============================================================
      // PASSO 3: Enriquecer com dados de pessoa (nome, UF)
      // ============================================================
      const codigosClientes = [
        ...new Set(faturasFiltradas.map((i) => i.cd_cliente).filter(Boolean)),
      ];

      let pessoasMap = {};
      if (codigosClientes.length > 0) {
        try {
          const batchSize = 50;
          for (let i = 0; i < codigosClientes.length; i += batchSize) {
            const batch = codigosClientes.slice(i, i + batchSize);
            const resp = await fetch(`${TotvsURL}persons/batch-lookup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ personCodes: batch }),
            });
            if (resp.ok) {
              const data = await resp.json();
              const map = data?.data || data || {};
              for (const [code, pessoa] of Object.entries(map)) {
                pessoasMap[String(code).trim()] = pessoa;
              }
            }
          }
          console.log(
            `👤 ${Object.keys(pessoasMap).length} clientes enriquecidos`,
          );
        } catch (err) {
          console.warn('⚠️ Erro ao buscar dados de pessoas:', err.message);
        }
      }

      const dadosEnriquecidos = faturasFiltradas.map((item) => {
        const key = String(item.cd_cliente).trim();
        const pessoa = pessoasMap[key] || {};
        const canalInfo = clientesMap[key] || {};
        return {
          ...item,
          nm_cliente:
            pessoa.name ||
            canalInfo.name ||
            item.nm_cliente ||
            `Cliente ${item.cd_cliente}`,
          nm_fantasia:
            pessoa.fantasyName ||
            canalInfo.fantasyName ||
            item.nm_fantasia ||
            '',
          ds_uf: pessoa.uf || item.ds_uf || '',
          canal: canalInfo.canal || '',
        };
      });

      setDados(dadosEnriquecidos);
      setDadosCarregados(true);

      // Salvar timeline do dia
      if (dadosEnriquecidos.length > 0) {
        const totalInadimplencia = dadosEnriquecidos.reduce(
          (acc, item) =>
            acc +
            ((parseFloat(item.vl_fatura) || 0) -
              (parseFloat(item.vl_pago) || 0)),
          0,
        );
        const qtdClientes = new Set(dadosEnriquecidos.map((i) => i.cd_cliente))
          .size;
        await salvarTimelineHoje(
          totalInadimplencia,
          dadosEnriquecidos.length,
          qtdClientes,
        );
      }
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      alert(`Erro ao buscar dados: ${err.message}`);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  }, [salvarTimelineHoje]);

  // Carregar timeline e dados automaticamente
  useEffect(() => {
    carregarTimeline();
    buscarDados();
  }, []);

  // ======================== MÉTRICAS ========================
  const metricas = useMemo(() => {
    if (!dados.length) {
      return {
        totalInadimplencia: 0,
        qtdTitulos: 0,
        qtdClientes: 0,
        ticketMedio: 0,
        topClientes: [],
        porPortador: [],
        carteiraSimples: { qtd: 0, valor: 0 },
        carteiraDescontada: { qtd: 0, valor: 0 },
        porFaixa: {},
      };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let totalInadimplencia = 0;
    const clienteMap = {};
    const portadorMap = {};
    let carteiraSimples = { qtd: 0, valor: 0 };
    let carteiraDescontada = { qtd: 0, valor: 0 };
    const faixaMap = {
      '1-15 dias': 0,
      '16-30 dias': 0,
      '31-60 dias': 0,
      '61-90 dias': 0,
      '91-120 dias': 0,
      '121-180 dias': 0,
      '181-360 dias': 0,
      '360+ dias': 0,
    };

    dados.forEach((item) => {
      const vlFatura = parseFloat(item.vl_fatura) || 0;
      const vlPago = parseFloat(item.vl_pago) || 0;
      const saldo = vlFatura - vlPago;
      if (saldo <= 0) return;

      totalInadimplencia += saldo;

      // Por cliente
      const cd = String(item.cd_cliente);
      if (!clienteMap[cd]) {
        clienteMap[cd] = {
          cd_cliente: cd,
          nm_cliente: item.nm_fantasia || item.nm_cliente || `Cliente ${cd}`,
          valor: 0,
          qtd: 0,
          ds_uf: item.ds_uf || '',
        };
      }
      clienteMap[cd].valor += saldo;
      clienteMap[cd].qtd += 1;

      // Por portador
      const portadorNome =
        item.nm_portador || `Portador ${item.cd_portador || 'N/I'}`;
      if (!portadorMap[portadorNome])
        portadorMap[portadorNome] = { valor: 0, qtd: 0 };
      portadorMap[portadorNome].valor += saldo;
      portadorMap[portadorNome].qtd += 1;

      // Carteira
      const cobranca = getCarteiraEfetiva(item);
      if (cobranca === 2) {
        carteiraDescontada.qtd += 1;
        carteiraDescontada.valor += saldo;
      } else {
        carteiraSimples.qtd += 1;
        carteiraSimples.valor += saldo;
      }

      // Faixa de dias
      const dv = parseDateNoTZ(item.dt_vencimento);
      if (dv) {
        const diff = Math.floor((hoje - dv) / (1000 * 60 * 60 * 24));
        if (diff <= 15) faixaMap['1-15 dias'] += saldo;
        else if (diff <= 30) faixaMap['16-30 dias'] += saldo;
        else if (diff <= 60) faixaMap['31-60 dias'] += saldo;
        else if (diff <= 90) faixaMap['61-90 dias'] += saldo;
        else if (diff <= 120) faixaMap['91-120 dias'] += saldo;
        else if (diff <= 180) faixaMap['121-180 dias'] += saldo;
        else if (diff <= 360) faixaMap['181-360 dias'] += saldo;
        else faixaMap['360+ dias'] += saldo;
      }
    });

    const topClientes = Object.values(clienteMap)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 20);

    const porPortador = Object.entries(portadorMap)
      .map(([nome, d]) => ({ nome, ...d }))
      .sort((a, b) => b.valor - a.valor);

    const qtdClientes = Object.keys(clienteMap).length;

    return {
      totalInadimplencia,
      qtdTitulos: dados.filter(
        (i) =>
          (parseFloat(i.vl_fatura) || 0) - (parseFloat(i.vl_pago) || 0) > 0,
      ).length,
      qtdClientes,
      ticketMedio: qtdClientes > 0 ? totalInadimplencia / qtdClientes : 0,
      topClientes,
      porPortador,
      carteiraSimples,
      carteiraDescontada,
      porFaixa: faixaMap,
    };
  }, [dados]);

  // Títulos detalhados do portador selecionado
  const titulosPortadorSelecionado = useMemo(() => {
    if (!portadorSelecionado) return [];
    return dados
      .filter((item) => {
        const portadorNome =
          item.nm_portador || `Portador ${item.cd_portador || 'N/I'}`;
        if (portadorNome !== portadorSelecionado) return false;
        const saldo =
          (parseFloat(item.vl_fatura) || 0) - (parseFloat(item.vl_pago) || 0);
        return saldo > 0;
      })
      .sort(
        (a, b) =>
          (parseFloat(b.vl_fatura) || 0) - (parseFloat(a.vl_fatura) || 0),
      );
  }, [dados, portadorSelecionado]);

  // ======================== GRÁFICOS ========================
  const chartTopClientes = useMemo(() => {
    if (!metricas.topClientes.length) return null;
    return {
      labels: metricas.topClientes.map((c) =>
        c.nm_cliente.length > 25
          ? c.nm_cliente.substring(0, 25) + '…'
          : c.nm_cliente,
      ),
      datasets: [
        {
          label: 'Saldo Inadimplente',
          data: metricas.topClientes.map((c) => c.valor),
          backgroundColor: '#fe0000',
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [metricas.topClientes]);

  const chartFaixas = useMemo(() => {
    const entries = Object.entries(metricas.porFaixa);
    if (!entries.length) return null;
    return {
      labels: entries.map(([f]) => f),
      datasets: [
        {
          label: 'Valor Inadimplente',
          data: entries.map(([, v]) => v),
          backgroundColor: [
            '#10b981',
            '#3b82f6',
            '#f59e0b',
            '#f97316',
            '#ef4444',
            '#dc2626',
            '#b91c1c',
            '#7f1d1d',
          ],
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [metricas.porFaixa]);

  const chartPortador = useMemo(() => {
    const top10 = metricas.porPortador.slice(0, 10);
    if (!top10.length) return null;
    return {
      labels: top10.map((p) => p.nome),
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
  }, [metricas.porPortador]);

  const chartCarteira = useMemo(() => {
    if (!metricas.carteiraSimples.valor && !metricas.carteiraDescontada.valor)
      return null;
    return {
      labels: ['Simples', 'Descontada'],
      datasets: [
        {
          data: [
            metricas.carteiraSimples.valor,
            metricas.carteiraDescontada.valor,
          ],
          backgroundColor: ['#3b82f6', '#8b5cf6'],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  }, [metricas.carteiraSimples, metricas.carteiraDescontada]);

  const chartTimeline = useMemo(() => {
    if (!timeline.length) return null;
    return {
      labels: timeline.map((t) => {
        const d = parseDateNoTZ(t.data);
        return d
          ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : t.data;
      }),
      datasets: [
        {
          label: 'Inadimplência Total',
          data: timeline.map((t) => parseFloat(t.valor_total) || 0),
          borderColor: '#fe0000',
          backgroundColor: 'rgba(254, 0, 0, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#fe0000',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [timeline]);

  // Opções de gráficos
  const barOptions = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
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
        ticks: { font: { size: 9 }, callback: (v) => formatCurrency(v) },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      y: {
        ticks: { font: { size: 9 } },
        grid: { display: false },
      },
    },
  });

  const barVerticalOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
          label: (ctx) => formatCurrency(ctx.raw),
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 9 }, maxRotation: 45 },
        grid: { display: false },
      },
      y: {
        ticks: { font: { size: 9 }, callback: (v) => formatCurrency(v) },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { font: { size: 11 }, boxWidth: 14, padding: 10 },
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold', size: 11 },
        formatter: (v, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = ((v / total) * 100).toFixed(1);
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

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        display: true,
        color: '#000638',
        font: { weight: 'bold', size: 10 },
        formatter: (v) => formatCurrency(v),
        anchor: 'end',
        align: 'top',
        offset: 4,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => formatCurrency(ctx.raw),
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        ticks: { font: { size: 10 }, callback: (v) => formatCurrency(v) },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  // ======================== EXPORT EXCEL ========================
  const exportarExcel = useCallback(() => {
    if (!dados.length) return;
    const hoje = new Date();
    const dadosExport = dados
      .filter(
        (i) =>
          (parseFloat(i.vl_fatura) || 0) - (parseFloat(i.vl_pago) || 0) > 0,
      )
      .map((t) => {
        const vlFat = parseFloat(t.vl_fatura) || 0;
        const vlPg = parseFloat(t.vl_pago) || 0;
        const dv = parseDateNoTZ(t.dt_vencimento);
        const diasAtraso = dv
          ? Math.floor((hoje - dv) / (1000 * 60 * 60 * 24))
          : 0;
        const dt = (d) => {
          const p = parseDateNoTZ(d);
          return p ? p.toLocaleDateString('pt-BR') : '';
        };
        return {
          Empresa: t.cd_empresa,
          'Cód. Cliente': t.cd_cliente,
          Cliente: t.nm_fantasia || t.nm_cliente || '',
          UF: t.ds_uf || '',
          Fatura: t.nr_fatura,
          Parcela: t.nr_parcela || '',
          Vencimento: dt(t.dt_vencimento),
          'Dias Atraso': diasAtraso,
          Portador: t.nm_portador || '',
          Carteira: getCarteiraEfetiva(t) === 2 ? 'Descontada' : 'Simples',
          'Valor Fatura': vlFat,
          'Valor Pago': vlPg,
          Saldo: vlFat - vlPg,
        };
      });
    const ws = XLSX.utils.json_to_sheet(dadosExport);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 35 },
      { wch: 5 },
      { wch: 12 },
      { wch: 8 },
      { wch: 12 },
      { wch: 10 },
      { wch: 20 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inadimplência');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `Inadimplencia_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }, [dados]);

  // ======================== RENDER ========================
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Dashboard de Inadimplência"
        subtitle="Visão consolidada da inadimplência Crosby - Todos os canais"
        icon={TrendDown}
        iconColor="text-red-600"
      />

      {/* Botão de atualizar + Export */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={buscarDados}
          disabled={loading}
          className="flex items-center gap-1.5 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 transition-colors text-xs font-bold shadow-md"
        >
          {loading ? (
            <>
              <Spinner size={14} className="animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <ChartBar size={14} />
              Atualizar Dados
            </>
          )}
        </button>
        {dadosCarregados && (
          <button
            onClick={exportarExcel}
            className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-xs font-bold shadow-md"
          >
            <FileArrowDown size={14} />
            Exportar Excel
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-600">
            Carregando dados de inadimplência...
          </span>
        </div>
      )}

      {/* Sem dados */}
      {!loading && !dadosCarregados && (
        <div className="flex justify-center items-center py-16 text-gray-500 text-sm">
          Clique em "Atualizar Dados" para carregar a inadimplência
        </div>
      )}

      {/* Dashboard */}
      {!loading && dadosCarregados && (
        <>
          {/* ---- CARDS PRINCIPAIS ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white border-l-4 border-red-500">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Warning size={16} className="text-red-600" />
                  <CardTitle className="text-xs font-bold text-red-700">
                    Total Inadimplente
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-red-600">
                  {formatCurrency(metricas.totalInadimplencia)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Saldo em aberto vencido
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-blue-600" />
                  <CardTitle className="text-xs font-bold text-blue-700">
                    Títulos Vencidos
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-blue-600">
                  {metricas.qtdTitulos.toLocaleString('pt-BR')}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Títulos com saldo devedor
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-orange-600" />
                  <CardTitle className="text-xs font-bold text-orange-700">
                    Clientes Inadimplentes
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-orange-600">
                  {metricas.qtdClientes.toLocaleString('pt-BR')}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Clientes únicos
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={16} className="text-purple-600" />
                  <CardTitle className="text-xs font-bold text-purple-700">
                    Ticket Médio
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-purple-600">
                  {formatCurrency(metricas.ticketMedio)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Média por cliente
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* ---- TIMELINE ---- */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ChartLineUp size={16} className="text-red-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Evolução da Inadimplência
                  </CardTitle>
                  {loadingTimeline && (
                    <Spinner size={14} className="animate-spin text-gray-400" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {chartTimeline ? (
                  <div style={{ height: 300 }}>
                    <Line data={chartTimeline} options={lineOptions} />
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12 text-sm">
                    Sem dados de timeline
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ---- CARTEIRA SIMPLES & DESCONTADA ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Carteira Simples
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Quantidade</div>
                    <div className="text-2xl font-extrabold text-blue-600">
                      {metricas.carteiraSimples.qtd.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">
                      Valor Total
                    </div>
                    <div className="text-xl font-extrabold text-blue-600">
                      {formatCurrency(metricas.carteiraSimples.valor)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Carteira Descontada
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Quantidade</div>
                    <div className="text-2xl font-extrabold text-purple-600">
                      {metricas.carteiraDescontada.qtd.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">
                      Valor Total
                    </div>
                    <div className="text-xl font-extrabold text-purple-600">
                      {formatCurrency(metricas.carteiraDescontada.valor)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---- TOP 20 CLIENTES + CARTEIRA PIE ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            <div className="lg:col-span-2">
              <Card className="shadow-lg rounded-xl bg-white h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-red-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Top 20 Clientes Inadimplentes
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  {chartTopClientes ? (
                    <div style={{ height: 500 }}>
                      <Bar
                        data={chartTopClientes}
                        options={barOptions('Top Clientes')}
                      />
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-12 text-sm">
                      Sem dados
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="shadow-lg rounded-xl bg-white h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-blue-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Carteira
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  {chartCarteira ? (
                    <div style={{ height: 250 }}>
                      <Doughnut data={chartCarteira} options={pieOptions} />
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-12 text-sm">
                      Sem dados
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabela resumo top clientes */}
              {metricas.topClientes.length > 0 && (
                <Card className="shadow-lg rounded-xl bg-white mt-3">
                  <CardContent className="p-3">
                    <div className="max-h-[220px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1 font-semibold text-gray-700">
                              Cliente
                            </th>
                            <th className="text-center px-2 py-1 font-semibold text-gray-700">
                              Qtd
                            </th>
                            <th className="text-right px-2 py-1 font-semibold text-red-600">
                              Saldo
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {metricas.topClientes.map((c, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-2 py-1 text-gray-800">
                                <span className="font-medium">
                                  {c.cd_cliente}
                                </span>{' '}
                                - {c.nm_cliente}
                              </td>
                              <td className="text-center px-2 py-1 text-gray-600">
                                {c.qtd}
                              </td>
                              <td className="text-right px-2 py-1 font-semibold text-red-600">
                                {formatCurrency(c.valor)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* ---- FAIXA DE DIAS ---- */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CalendarBlank size={16} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-[#000638]">
                    Inadimplência por Faixa de Atraso
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {chartFaixas ? (
                  <div style={{ height: 320 }}>
                    <Bar data={chartFaixas} options={barVerticalOptions} />
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12 text-sm">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ---- PORTADORES ---- */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bank size={16} className="text-teal-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Inadimplência por Portador
                    </CardTitle>
                    <button
                      onClick={() => setPortadorExpandido(true)}
                      className="ml-2 p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-[#000638] transition-colors"
                      title="Expandir"
                    >
                      <ArrowsOut size={16} />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    {chartPortador ? (
                      <div style={{ height: 340 }}>
                        <Bar
                          data={chartPortador}
                          options={barVerticalOptions}
                        />
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-12 text-sm">
                        Sem dados
                      </div>
                    )}
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {metricas.porPortador.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-semibold text-gray-700">
                              Portador
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
                          {metricas.porPortador.map((p, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                              onClick={() => setPortadorSelecionado(p.nome)}
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
                                {p.qtd.toLocaleString('pt-BR')}
                              </td>
                              <td className="text-right px-2 py-1 font-semibold text-teal-600">
                                {formatCurrency(p.valor)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-bold">
                            <td className="px-2 py-1.5 text-gray-800">TOTAL</td>
                            <td className="text-center px-2 py-1.5 text-gray-800">
                              {metricas.porPortador
                                .reduce((a, p) => a + p.qtd, 0)
                                .toLocaleString('pt-BR')}
                            </td>
                            <td className="text-right px-2 py-1.5 text-teal-700">
                              {formatCurrency(
                                metricas.porPortador.reduce(
                                  (a, p) => a + p.valor,
                                  0,
                                ),
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

          {/* ---- MODAL DETALHAMENTO TÍTULOS DO PORTADOR ---- */}
          {portadorSelecionado && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Bank size={20} className="text-teal-600" />
                    <h2 className="text-lg font-bold text-[#000638]">
                      {portadorSelecionado}
                    </h2>
                    <span className="text-sm text-gray-500 ml-2">
                      {titulosPortadorSelecionado.length} título(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const dadosExport = titulosPortadorSelecionado.map(
                          (t) => {
                            const vlFat = parseFloat(t.vl_fatura) || 0;
                            const vlPg = parseFloat(t.vl_pago) || 0;
                            const dv = parseDateNoTZ(t.dt_vencimento);
                            const diasAtraso = dv
                              ? Math.floor(
                                  (new Date() - dv) / (1000 * 60 * 60 * 24),
                                )
                              : 0;
                            const dt = (d) => {
                              const p = parseDateNoTZ(d);
                              return p ? p.toLocaleDateString('pt-BR') : '';
                            };
                            return {
                              Empresa: t.cd_empresa,
                              'Cód. Cliente': t.cd_cliente,
                              Cliente: t.nm_fantasia || t.nm_cliente || '',
                              Fatura: t.nr_fatura,
                              Vencimento: dt(t.dt_vencimento),
                              'Dias Atraso': diasAtraso,
                              Portador: t.nm_portador || '',
                              'Valor Fatura': vlFat,
                              'Valor Pago': vlPg,
                              Saldo: vlFat - vlPg,
                            };
                          },
                        );
                        const ws = XLSX.utils.json_to_sheet(dadosExport);
                        ws['!cols'] = [
                          { wch: 8 },
                          { wch: 12 },
                          { wch: 35 },
                          { wch: 12 },
                          { wch: 12 },
                          { wch: 10 },
                          { wch: 20 },
                          { wch: 14 },
                          { wch: 14 },
                          { wch: 14 },
                        ];
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Títulos');
                        const buf = XLSX.write(wb, {
                          bookType: 'xlsx',
                          type: 'array',
                        });
                        saveAs(
                          new Blob([buf], {
                            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                          }),
                          `Portador_${portadorSelecionado.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
                        );
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-bold shadow-md"
                      title="Exportar para Excel"
                    >
                      <FileArrowDown size={16} />
                      Excel
                    </button>
                    <button
                      onClick={() => setPortadorSelecionado(null)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                      title="Fechar"
                    >
                      <X size={20} weight="bold" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {titulosPortadorSelecionado.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-2 font-semibold text-gray-700">
                            Empresa
                          </th>
                          <th className="text-left px-2 py-2 font-semibold text-gray-700">
                            Cliente
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            Fatura
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            Vencimento
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            Dias Atraso
                          </th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-700">
                            Carteira
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-gray-700">
                            Valor Fatura
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-gray-700">
                            Valor Pago
                          </th>
                          <th className="text-right px-2 py-2 font-semibold text-gray-700">
                            Saldo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {titulosPortadorSelecionado.map((t, i) => {
                          const vlFat = parseFloat(t.vl_fatura) || 0;
                          const vlPg = parseFloat(t.vl_pago) || 0;
                          const saldo = vlFat - vlPg;
                          const dv = parseDateNoTZ(t.dt_vencimento);
                          const hoje = new Date();
                          hoje.setHours(0, 0, 0, 0);
                          const diasAtraso = dv
                            ? Math.floor((hoje - dv) / (1000 * 60 * 60 * 24))
                            : 0;
                          return (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-2 py-1.5 text-gray-700">
                                {t.cd_empresa}
                              </td>
                              <td className="px-2 py-1.5 text-gray-800">
                                <span className="font-medium">
                                  {t.cd_cliente}
                                </span>
                                {' - '}
                                {t.nm_fantasia || t.nm_cliente}
                              </td>
                              <td className="text-center px-2 py-1.5 text-gray-700">
                                {t.nr_fatura}
                              </td>
                              <td className="text-center px-2 py-1.5 text-gray-600">
                                {dv ? dv.toLocaleDateString('pt-BR') : '-'}
                              </td>
                              <td className="text-center px-2 py-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    diasAtraso > 90
                                      ? 'bg-red-100 text-red-700'
                                      : diasAtraso > 30
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {diasAtraso}d
                                </span>
                              </td>
                              <td className="text-center px-2 py-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    getCarteiraEfetiva(t) === 2
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {getCarteiraEfetiva(t) === 2
                                    ? 'DESC'
                                    : 'SIMPL'}
                                </span>
                              </td>
                              <td className="text-right px-2 py-1.5 text-gray-800">
                                {formatCurrency(vlFat)}
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
                          <td colSpan={6} className="px-2 py-2 text-gray-800">
                            TOTAL
                          </td>
                          <td className="text-right px-2 py-2 text-gray-800">
                            {formatCurrency(
                              titulosPortadorSelecionado.reduce(
                                (a, t) => a + (parseFloat(t.vl_fatura) || 0),
                                0,
                              ),
                            )}
                          </td>
                          <td className="text-right px-2 py-2 text-green-700">
                            {formatCurrency(
                              titulosPortadorSelecionado.reduce(
                                (a, t) => a + (parseFloat(t.vl_pago) || 0),
                                0,
                              ),
                            )}
                          </td>
                          <td className="text-right px-2 py-2 text-red-700">
                            {formatCurrency(
                              titulosPortadorSelecionado.reduce(
                                (a, t) =>
                                  a +
                                  ((parseFloat(t.vl_fatura) || 0) -
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

          {/* ---- MODAL EXPANDIDO PORTADOR ---- */}
          {portadorExpandido && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Bank size={20} className="text-teal-600" />
                    <h2 className="text-lg font-bold text-[#000638]">
                      Inadimplência por Portador
                    </h2>
                  </div>
                  <button
                    onClick={() => setPortadorExpandido(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                    title="Fechar"
                  >
                    <X size={20} weight="bold" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                    <div>
                      {chartPortador ? (
                        <div style={{ height: 'calc(85vh - 100px)' }}>
                          <Bar
                            data={chartPortador}
                            options={barVerticalOptions}
                          />
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 py-12">
                          Sem dados
                        </div>
                      )}
                    </div>
                    <div
                      style={{ maxHeight: 'calc(85vh - 100px)' }}
                      className="overflow-y-auto"
                    >
                      {metricas.porPortador.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                Portador
                              </th>
                              <th className="text-center px-3 py-2 font-semibold text-gray-700">
                                Qtd
                              </th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-700">
                                Valor
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {metricas.porPortador.map((p, i) => (
                              <tr
                                key={i}
                                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                onClick={() => setPortadorSelecionado(p.nome)}
                              >
                                <td className="px-3 py-2 text-gray-800 flex items-center gap-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                                    style={{
                                      backgroundColor: CORES[i % CORES.length],
                                    }}
                                  />
                                  {p.nome}
                                </td>
                                <td className="text-center px-3 py-2 text-gray-600">
                                  {p.qtd.toLocaleString('pt-BR')}
                                </td>
                                <td className="text-right px-3 py-2 font-semibold text-teal-600">
                                  {formatCurrency(p.valor)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                              <td className="px-3 py-2 text-gray-800">TOTAL</td>
                              <td className="text-center px-3 py-2 text-gray-800">
                                {metricas.porPortador
                                  .reduce((a, p) => a + p.qtd, 0)
                                  .toLocaleString('pt-BR')}
                              </td>
                              <td className="text-right px-3 py-2 text-teal-700">
                                {formatCurrency(
                                  metricas.porPortador.reduce(
                                    (a, p) => a + p.valor,
                                    0,
                                  ),
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center text-gray-400 py-12">
                          Sem dados
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

DashInadimplencia.displayName = 'DashInadimplencia';
export default DashInadimplencia;
