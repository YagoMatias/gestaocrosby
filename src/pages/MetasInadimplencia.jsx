import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { TotvsURL } from '../config/constants';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import {
  Target,
  ChartBar,
  CircleNotch,
  CurrencyDollar,
  Receipt,
  CheckCircle,
  Wallet,
  Spinner,
  X,
} from '@phosphor-icons/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels,
);

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Formato compacto para os rótulos das barras (ex.: R$ 412,3k / R$ 1,2M)
const formatCompact = (value) => {
  const v = value || 0;
  if (Math.abs(v) >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  }
  if (Math.abs(v) >= 1_000) {
    return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return formatCurrency(v);
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

// Chave YYYY-MM a partir de uma data ISO
const mesKey = (isoDate) => {
  if (!isoDate) return null;
  return String(isoDate).substring(0, 7);
};

// As barras representam meses inteiros, então a consulta é sempre expandida
// para o 1º dia do mês inicial e o último dia do mês final. Sem isso, um
// período terminando no meio do mês (ex.: hoje) corta a última barra.
const primeiroDiaDoMes = (isoDate) => `${String(isoDate).substring(0, 7)}-01`;

const ultimoDiaDoMes = (isoDate) => {
  const ym = String(isoDate).substring(0, 7);
  const [ano, mes] = ym.split('-').map(Number);
  const dia = new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte
  return `${ym}-${String(dia).padStart(2, '0')}`;
};

const MESES_LABEL = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const formatMesLabel = (key) => {
  if (!key) return '';
  const [ano, mes] = key.split('-').map(Number);
  return `${MESES_LABEL[mes - 1]}/${String(ano).slice(2)}`;
};

// Título é considerado PAGO se tiver data de liquidação OU valor pago
const isTituloPago = (item) =>
  !!item.dt_liq || (parseFloat(item.vl_pago) || 0) > 0;

// dischargeType 9 = "Baixa por renegociação" (tp_baixa no mapeamento do
// backend). O título foi quitado sem entrada de dinheiro: o saldo migrou
// para um título novo, que aparece na série pelo vencimento dele.
const TP_BAIXA_RENEGOCIACAO = 9;
const ehRenegociacao = (item) =>
  Number(item.tp_baixa) === TP_BAIXA_RENEGOCIACAO;

// Tipo de carteira efetivo, igual ao Dashboard de Contas a Receber:
// portador SAFRA/DALILA conta como DESCONTADA (2), senão vale o tp_cobranca
// (0 = não está em cobrança, 1 = simples, 2 = descontada).
const getCarteiraEfetiva = (item) => {
  const portador = (item.nm_portador || '').toUpperCase();
  if (portador.includes('SAFRA') || portador.includes('DALILA')) return 2;
  return parseInt(item.tp_cobranca) || 0;
};

// Só a carteira descontada é separada. Todo o resto — cobrança simples,
// título em carteira e baixado por solicitação da empresa — entra em SIMPLES.
const ehDescontada = (item) => getCarteiraEfetiva(item) === 2;

const carteiraLabel = (item) => (ehDescontada(item) ? 'Descontada' : 'Simples');

// Dias de atraso em relação a hoje (0 se não vencido)
const diasAtraso = (item) => {
  const venc = parseDateNoTZ(item.dt_vencimento);
  if (!venc) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  return Math.floor((hoje - venc) / (1000 * 60 * 60 * 24));
};

const formatDateBR = (isoDate) => {
  const d = parseDateNoTZ(isoDate);
  return d ? d.toLocaleDateString('pt-BR') : '--';
};

// Situação do título para o detalhamento
const situacaoTitulo = (item) => {
  if (isTituloPago(item)) return { label: 'Pago', cor: 'text-green-700' };
  const atraso = diasAtraso(item);
  if (atraso > 60)
    return { label: `Inadimplente (${atraso}d)`, cor: 'text-red-600' };
  if (atraso > 0) return { label: `Vencido (${atraso}d)`, cor: 'text-amber-600' };
  return { label: 'A vencer', cor: 'text-gray-500' };
};

const MetasInadimplencia = () => {
  const hojeStr = new Date().toISOString().slice(0, 10);
  const inicioAnoStr = `${new Date().getFullYear()}-01-01`;

  const [filtroDataInicial, setFiltroDataInicial] = useState(inicioAnoStr);
  const [filtroDataFinal, setFiltroDataFinal] = useState(ultimoDiaDoMes(hojeStr));
  // TODOS | VENCIDOS (atraso 1-60 dias) | INADIMPLENTES (atraso > 60 dias)
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  const [vencendo, setVencendo] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [pessoasMap, setPessoasMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [erro, setErro] = useState(null);

  // Drill-down: mês clicado na tabela e aba do modal
  const [mesSelecionado, setMesSelecionado] = useState(null);
  const [abaModal, setAbaModal] = useState('VENCIMENTOS');

  const fetchDados = useCallback(async () => {
    if (!filtroDataInicial || !filtroDataFinal) return;
    setLoading(true);
    setErro(null);
    try {
      // Meses completos: o gráfico é mensal, então uma data final no meio do
      // mês (o padrão "hoje", por exemplo) truncaria a última barra.
      const dtInicio = primeiroDiaDoMes(filtroDataInicial);
      const dtFim = ultimoDiaDoMes(filtroDataFinal);

      // ============================================================
      // PASSO 1: Buscar os códigos dos clientes MULTIMARCAS e FRANQUIAS.
      // A análise cobre só essa base, igual às demais páginas de
      // inadimplência — por isso os totais ficam abaixo dos do Contas a
      // Receber, que não tem esse recorte de cliente.
      // ============================================================
      const [respMtm, respFrq] = await Promise.all([
        fetch(`${TotvsURL}multibrand-clients`),
        fetch(`${TotvsURL}franchise-clients`),
      ]);

      const codigos = new Set();
      if (respMtm.ok) {
        const r = await respMtm.json();
        (r.data || []).forEach((c) => codigos.add(String(c.code)));
      }
      if (respFrq.ok) {
        const r = await respFrq.json();
        (r.data || []).forEach((c) => codigos.add(String(c.code)));
      }

      if (codigos.size === 0) {
        throw new Error('Nenhum cliente multimarcas/franquia encontrado');
      }
      const codigosParam = [...codigos].join(',');

      // ============================================================
      // PASSO 2: Buscar em paralelo
      //  - VENCENDO: boletos por data de VENCIMENTO dentro do período
      //  - PAGOS: boletos por data de PAGAMENTO dentro do período
      //    (independente do mês de vencimento — pode ser de qualquer mês)
      // tp_documento=1 => apenas FATURA, como nas demais páginas
      // ============================================================
      const paramsVencendo = new URLSearchParams({
        dt_inicio: dtInicio,
        dt_fim: dtFim,
        modo: 'vencimento',
        situacao: '1',
        tp_documento: '1',
        cd_cliente: codigosParam,
      });

      const paramsPagos = new URLSearchParams({
        dt_inicio: dtInicio,
        dt_fim: dtFim,
        modo: 'pagamento',
        situacao: '1',
        status: 'Pago',
        tp_documento: '1',
        cd_cliente: codigosParam,
      });

      const [respVencendo, respPagos] = await Promise.all([
        fetch(`${TotvsURL}accounts-receivable/filter?${paramsVencendo}`),
        fetch(`${TotvsURL}accounts-receivable/filter?${paramsPagos}`),
      ]);

      if (!respVencendo.ok) {
        const err = await respVencendo.json().catch(() => ({}));
        throw new Error(
          err.message || `Erro vencimentos: HTTP ${respVencendo.status}`,
        );
      }
      if (!respPagos.ok) {
        const err = await respPagos.json().catch(() => ({}));
        throw new Error(err.message || `Erro pagos: HTTP ${respPagos.status}`);
      }

      const resultVencendo = await respVencendo.json();
      const resultPagos = await respPagos.json();

      // Rede de segurança: o tp_documento já vai na query, mas garante FATURA
      const soFatura = (item) =>
        item.tp_documento === 1 || item.tp_documento === '1';

      // Título quitado por renegociação não é meta cumprida nem dívida
      // viva: o saldo virou outro título. Some das duas séries para não
      // inflar o pago nem contar a dívida duas vezes.
      const valeParaMeta = (item) => soFatura(item) && !ehRenegociacao(item);

      const itensVencendo = (resultVencendo.data?.items || []).filter(
        valeParaMeta,
      );
      const itensPagos = (resultPagos.data?.items || []).filter(valeParaMeta);

      setVencendo(itensVencendo);
      setPagos(itensPagos);
      setDadosCarregados(true);

      // ============================================================
      // PASSO 3: Nomes dos clientes para o detalhamento (a rota de
      // contas a receber devolve só o CNPJ). O backend já lida com o
      // lote internamente, então vai tudo numa requisição só.
      // ============================================================
      const codigosClientes = [
        ...new Set(
          [...itensVencendo, ...itensPagos]
            .map((i) => i.cd_cliente)
            .filter(Boolean),
        ),
      ];

      if (codigosClientes.length > 0) {
        try {
          const respPessoas = await fetch(`${TotvsURL}persons/batch-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personCodes: codigosClientes }),
          });
          if (respPessoas.ok) {
            const dataPessoas = await respPessoas.json();
            setPessoasMap(dataPessoas?.data || {});
          }
        } catch (err) {
          console.warn('⚠️ Erro ao buscar nomes de clientes:', err.message);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados de metas inadimplência:', error);
      setErro(error.message);
      setVencendo([]);
      setPagos([]);
    } finally {
      setLoading(false);
    }
  }, [filtroDataInicial, filtroDataFinal]);

  useEffect(() => {
    fetchDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boletos que vencem no período, após filtro Vencidos / Inadimplentes / Todos
  const vencendoFiltrados = useMemo(() => {
    if (filtroStatus === 'TODOS') return vencendo;
    return vencendo.filter((item) => {
      if (isTituloPago(item)) return false;
      const atraso = diasAtraso(item);
      if (filtroStatus === 'VENCIDOS') return atraso > 0 && atraso <= 60;
      if (filtroStatus === 'INADIMPLENTES') return atraso > 60;
      return true;
    });
  }, [vencendo, filtroStatus]);

  // Agregação por mês: vencimento (mês de vencimento) x pago (mês de pagamento)
  const dadosPorMes = useMemo(() => {
    const mapa = {};

    const garantirMes = (key) => {
      if (!mapa[key]) {
        mapa[key] = {
          key,
          valorVencendo: 0,
          qtdVencendo: 0,
          valorPago: 0,
          qtdPagos: 0,
          // Separação por carteira (descontada x simples)
          valorVencendoSimples: 0,
          valorVencendoDescontada: 0,
          valorPagoSimples: 0,
          valorPagoDescontada: 0,
          // Títulos que compõem cada barra, para o drill-down da tabela
          titulosVencendo: [],
          titulosPagos: [],
        };
      }
      return mapa[key];
    };

    vencendoFiltrados.forEach((item) => {
      const key = mesKey(item.dt_vencimento);
      if (!key) return;
      const mes = garantirMes(key);
      const valor = parseFloat(item.vl_fatura) || 0;
      mes.valorVencendo += valor;
      mes.qtdVencendo += 1;
      if (ehDescontada(item)) mes.valorVencendoDescontada += valor;
      else mes.valorVencendoSimples += valor;
      mes.titulosVencendo.push(item);
    });

    pagos.forEach((item) => {
      const key = mesKey(item.dt_liq);
      if (!key) return;
      const mes = garantirMes(key);
      // vl_pago quando disponível; senão o valor da fatura
      const valor = parseFloat(item.vl_pago) || parseFloat(item.vl_fatura) || 0;
      mes.valorPago += valor;
      mes.qtdPagos += 1;
      if (ehDescontada(item)) mes.valorPagoDescontada += valor;
      else mes.valorPagoSimples += valor;
      mes.titulosPagos.push(item);
    });

    return Object.values(mapa).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [vencendoFiltrados, pagos]);

  // Totais para os cards
  const totais = useMemo(() => {
    const somar = (campo) => dadosPorMes.reduce((a, m) => a + m[campo], 0);
    const valorVencendo = somar('valorVencendo');
    const valorPago = somar('valorPago');
    const qtdVencendo = somar('qtdVencendo');
    const qtdPagos = somar('qtdPagos');
    const percPago = valorVencendo > 0 ? (valorPago / valorVencendo) * 100 : 0;
    return {
      valorVencendo,
      valorPago,
      qtdVencendo,
      qtdPagos,
      percPago,
      valorVencendoSimples: somar('valorVencendoSimples'),
      valorVencendoDescontada: somar('valorVencendoDescontada'),
      valorPagoSimples: somar('valorPagoSimples'),
      valorPagoDescontada: somar('valorPagoDescontada'),
    };
  }, [dadosPorMes]);

  // ======================== DRILL-DOWN DO MÊS ========================
  const nomeCliente = useCallback(
    (item) => {
      const pessoa = pessoasMap[String(item.cd_cliente).trim()] || {};
      return (
        pessoa.name ||
        pessoa.fantasyName ||
        item.nm_cliente ||
        `Cliente ${item.cd_cliente}`
      );
    },
    [pessoasMap],
  );

  // Nome fantasia identifica a loja (ex.: "F013 - CROSBY CATOLE DO ROCHA")
  const fantasiaCliente = useCallback(
    (item) => pessoasMap[String(item.cd_cliente).trim()]?.fantasyName || '',
    [pessoasMap],
  );

  const mesDetalhe = useMemo(
    () => dadosPorMes.find((m) => m.key === mesSelecionado) || null,
    [dadosPorMes, mesSelecionado],
  );

  // Títulos da aba ativa, do maior valor para o menor
  const titulosModal = useMemo(() => {
    if (!mesDetalhe) return [];
    const lista =
      abaModal === 'PAGOS' ? mesDetalhe.titulosPagos : mesDetalhe.titulosVencendo;
    const valorOrdenacao = (item) =>
      abaModal === 'PAGOS'
        ? parseFloat(item.vl_pago) || parseFloat(item.vl_fatura) || 0
        : parseFloat(item.vl_fatura) || 0;
    return [...lista].sort((a, b) => valorOrdenacao(b) - valorOrdenacao(a));
  }, [mesDetalhe, abaModal]);

  const abrirDetalheMes = (key) => {
    setMesSelecionado(key);
    setAbaModal('VENCIMENTOS');
  };

  // Curto porque a legenda tem 4 itens (2 barras x 2 carteiras)
  const labelVencendo =
    filtroStatus === 'TODOS'
      ? 'Vencendo no mês'
      : filtroStatus === 'VENCIDOS'
        ? 'Vencidos (≤ 60d)'
        : 'Inadimplentes (> 60d)';

  // Gráfico em barras: vencimentos do mês x pagos no mês, cada barra
  // empilhada em carteira Simples (base) e Descontada (topo)
  const chartData = useMemo(() => {
    if (!dadosPorMes.length) return null;
    return {
      labels: dadosPorMes.map((m) => formatMesLabel(m.key)),
      datasets: [
        {
          label: `${labelVencendo} — Simples`,
          data: dadosPorMes.map((m) => m.valorVencendoSimples),
          backgroundColor: '#000638',
          stack: 'vencendo',
          datalabels: { color: '#ffffff' },
        },
        {
          label: `${labelVencendo} — Descontada`,
          data: dadosPorMes.map((m) => m.valorVencendoDescontada),
          backgroundColor: '#8ea3d2',
          stack: 'vencendo',
          borderRadius: 4,
          datalabels: { color: '#000638' },
        },
        {
          label: 'Pagos no mês — Simples',
          data: dadosPorMes.map((m) => m.valorPagoSimples),
          backgroundColor: '#10b981',
          stack: 'pagos',
          datalabels: { color: '#ffffff' },
        },
        {
          label: 'Pagos no mês — Descontada',
          data: dadosPorMes.map((m) => m.valorPagoDescontada),
          backgroundColor: '#a7f3d0',
          stack: 'pagos',
          borderRadius: 4,
          datalabels: { color: '#065f46' },
        },
      ],
    };
  }, [dadosPorMes, labelVencendo]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 11 }, boxWidth: 14, padding: 10 },
        },
        datalabels: {
          // Rótulo dentro de cada fatia; some quando a fatia é fina demais
          // para caber o texto sem virar poluição visual.
          display: (ctx) => {
            const v = ctx.dataset.data[ctx.dataIndex] || 0;
            const max = ctx.chart.scales.y?.max || 0;
            return v > 0 && max > 0 && v >= max * 0.07;
          },
          font: { weight: 'bold', size: 9 },
          formatter: (v) => formatCompact(v),
          anchor: 'center',
          align: 'center',
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.raw > 0
                ? `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
                : null,
            footer: (ctxs) => {
              const i = ctxs[0]?.dataIndex;
              const mes = dadosPorMes[i];
              if (!mes) return '';
              return [
                `Total vencendo: ${formatCurrency(mes.valorVencendo)}`,
                `Total pago: ${formatCurrency(mes.valorPago)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { font: { size: 10 } }, grid: { display: false } },
        y: {
          stacked: true,
          ticks: { font: { size: 10 }, callback: (v) => formatCompact(v) },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
      },
    }),
    [dadosPorMes],
  );

  const OPCOES_STATUS = [
    { valor: 'TODOS', label: 'Todos' },
    { valor: 'VENCIDOS', label: 'Vencidos' },
    { valor: 'INADIMPLENTES', label: 'Inadimplentes' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-6">
      <PageTitle
        title="Metas Inadimplência"
        subtitle="Boletos que vencem no mês x boletos pagos no mês (de qualquer vencimento)"
        icon={Target}
        iconColor="text-red-600"
      />

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDados();
          }}
        >
          <div className="text-sm font-semibold text-[#000638] mb-2">
            Configurações para análise de Metas de Inadimplência
          </div>
          <span className="text-xs text-gray-500 mt-1">
            Considera apenas faturas de clientes Multimarcas e Franquias,
            fora as baixadas por renegociação. O período filtra o vencimento e
            o pagamento dos boletos, e é sempre expandido para meses completos
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3 mt-4">
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
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Situação dos Vencimentos
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                {OPCOES_STATUS.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
            >
              {loading ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <ChartBar size={16} />
                  Buscar Dados
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
          Erro ao carregar dados: {erro}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Valor a Vencer no Período
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-[#000638]">
              {loading ? (
                <Spinner size={22} className="animate-spin" />
              ) : (
                formatCurrency(totais.valorVencendo)
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              {totais.qtdVencendo} boleto(s) vencendo no período
              <br />
              Simples {formatCompact(totais.valorVencendoSimples)} · Descontada{' '}
              {formatCompact(totais.valorVencendoDescontada)}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Valor Pago
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-green-600">
              {loading ? (
                <Spinner size={22} className="animate-spin" />
              ) : (
                formatCurrency(totais.valorPago)
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              {totais.qtdPagos} boleto(s) pagos no período
              <br />
              Simples {formatCompact(totais.valorPagoSimples)} · Descontada{' '}
              {formatCompact(totais.valorPagoDescontada)}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={18} className="text-amber-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                % Pago / Vencido
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-amber-600">
              {loading ? (
                <Spinner size={22} className="animate-spin" />
              ) : (
                `${totais.percPago.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Pagos no período sobre os vencimentos
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-red-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Diferença
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-red-600">
              {loading ? (
                <Spinner size={22} className="animate-spin" />
              ) : (
                formatCurrency(totais.valorVencendo - totais.valorPago)
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Vencendo − pago no período
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico em barras */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-[#000638]">
            Vencimentos x Pagos por Mês
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Barras azuis: valor dos boletos que vencem no mês. Barras verdes:
            valor dos boletos pagos naquele mês, independente do mês de
            vencimento. Cada barra é dividida em carteira Simples (tom escuro,
            base) e Descontada (tom claro, topo) — título em carteira e baixado
            por solicitação da empresa contam como Simples. No mês corrente os
            pagamentos só existem até hoje, então a barra verde ainda está em
            andamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <CircleNotch
                size={32}
                className="animate-spin text-[#000638]"
              />
            </div>
          ) : chartData ? (
            <div className="h-96">
              <Bar data={chartData} options={chartOptions} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
              {dadosCarregados
                ? 'Nenhum dado encontrado para o período selecionado'
                : 'Selecione o período e clique em Buscar Dados'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela por mês */}
      {!loading && dadosPorMes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#000638]">
              Detalhamento Mensal
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Clique em um mês para ver os títulos que compõem os valores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-3 py-2 text-left font-semibold">Mês</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Valor Vencendo
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Qtd Vencendo
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Valor Pago no Mês
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Qtd Pagos
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      % Pago / Vencido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosPorMes.map((m) => {
                    const perc =
                      m.valorVencendo > 0
                        ? (m.valorPago / m.valorVencendo) * 100
                        : 0;
                    return (
                      <tr
                        key={m.key}
                        onClick={() => abrirDetalheMes(m.key)}
                        title="Ver títulos do mês"
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2 font-semibold text-[#000638] underline decoration-dotted underline-offset-2">
                          {formatMesLabel(m.key)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(m.valorVencendo)}
                          <div className="text-[10px] text-gray-500">
                            S {formatCompact(m.valorVencendoSimples)} · D{' '}
                            {formatCompact(m.valorVencendoDescontada)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {m.qtdVencendo}
                        </td>
                        <td className="px-3 py-2 text-right text-green-700 font-semibold">
                          {formatCurrency(m.valorPago)}
                          <div className="text-[10px] font-normal text-gray-500">
                            S {formatCompact(m.valorPagoSimples)} · D{' '}
                            {formatCompact(m.valorPagoDescontada)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{m.qtdPagos}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {perc.toLocaleString('pt-BR', {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal: títulos do mês selecionado */}
      {mesDetalhe && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-[#000638]" />
                <h2 className="text-lg font-bold text-[#000638]">
                  {formatMesLabel(mesDetalhe.key)}
                </h2>
                <span className="text-sm text-gray-500 ml-2">
                  {mesDetalhe.qtdVencendo} vencendo ·{' '}
                  {formatCurrency(mesDetalhe.valorVencendo)} | {' '}
                  {mesDetalhe.qtdPagos} pagos ·{' '}
                  {formatCurrency(mesDetalhe.valorPago)}
                </span>
              </div>
              <button
                onClick={() => setMesSelecionado(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Abas */}
            <div className="flex gap-2 px-5 pt-3">
              <button
                onClick={() => setAbaModal('VENCIMENTOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                  abaModal === 'VENCIMENTOS'
                    ? 'bg-[#000638] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Vencendo no mês ({mesDetalhe.qtdVencendo})
              </button>
              <button
                onClick={() => setAbaModal('PAGOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                  abaModal === 'PAGOS'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Pagos no mês ({mesDetalhe.qtdPagos})
              </button>
            </div>

            <p className="px-5 pt-2 text-xs text-gray-500">
              {abaModal === 'VENCIMENTOS'
                ? `Títulos com vencimento neste mês, pagos ou não. Simples ${formatCurrency(
                    mesDetalhe.valorVencendoSimples,
                  )} · Descontada ${formatCurrency(
                    mesDetalhe.valorVencendoDescontada,
                  )}`
                : `Títulos pagos neste mês, independente do mês de vencimento. Simples ${formatCurrency(
                    mesDetalhe.valorPagoSimples,
                  )} · Descontada ${formatCurrency(
                    mesDetalhe.valorPagoDescontada,
                  )}`}
            </p>

            {/* Lista */}
            <div className="flex-1 overflow-auto px-5 py-3">
              {titulosModal.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-gray-500">
                  Nenhum título nesta aba
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-[#000638] text-white">
                      <th className="px-3 py-2 text-left font-semibold">
                        Cliente
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Fatura
                      </th>
                      <th className="px-3 py-2 text-center font-semibold">
                        Empresa
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Carteira
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Portador
                      </th>
                      <th className="px-3 py-2 text-center font-semibold">
                        Vencimento
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Valor
                      </th>
                      <th className="px-3 py-2 text-center font-semibold">
                        Pago em
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Valor Pago
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Situação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulosModal.map((t, idx) => {
                      const sit = situacaoTitulo(t);
                      return (
                        <tr
                          key={`${t.nr_fatura}-${t.nr_parcela}-${t.cd_empresa}-${idx}`}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2">
                            <div className="font-semibold text-[#000638]">
                              {nomeCliente(t)}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {fantasiaCliente(t)
                                ? `${fantasiaCliente(t)} · `
                                : ''}
                              Cód. {t.cd_cliente}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {t.nr_fatura}
                            {t.nr_parcela ? `/${t.nr_parcela}` : ''}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {t.cd_empresa}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ehDescontada(t)
                                  ? 'bg-[#8ea3d2]/30 text-[#000638]'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {carteiraLabel(t)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {t.nm_portador || '--'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {formatDateBR(t.dt_vencimento)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(parseFloat(t.vl_fatura) || 0)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {formatDateBR(t.dt_liq)}
                          </td>
                          <td className="px-3 py-2 text-right text-green-700 font-semibold">
                            {(parseFloat(t.vl_pago) || 0) > 0
                              ? formatCurrency(parseFloat(t.vl_pago))
                              : '--'}
                          </td>
                          <td className={`px-3 py-2 font-semibold ${sit.cor}`}>
                            {sit.label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rodapé com total da aba */}
            <div className="px-5 py-3 border-t border-gray-200 flex justify-between items-center text-sm">
              <span className="text-gray-500 text-xs">
                {titulosModal.length} título(s)
              </span>
              <span className="font-bold text-[#000638]">
                Total:{' '}
                {formatCurrency(
                  titulosModal.reduce(
                    (a, t) =>
                      a +
                      (abaModal === 'PAGOS'
                        ? parseFloat(t.vl_pago) || parseFloat(t.vl_fatura) || 0
                        : parseFloat(t.vl_fatura) || 0),
                    0,
                  ),
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetasInadimplencia;
