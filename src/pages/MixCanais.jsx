// Mix de Canais — quanto cada canal representa no faturamento da empresa,
// mês a mês, em valor e percentual.
//
// - Jan–jul/2026: histórico do relatório "Ds. Tipo Cliente" (tabela
//   mix_canais_mensal). Ago/2026 em diante: calculado do New Forecast.
// - Canal sem faturamento no mês aparece como "sem movimentação".
// - Meses mostram só o valor; o percentual fica na coluna Acumulado (e no
//   hover do gráfico). SHOWROOM / FABRICAS não é canal: o backend rateia
//   85% em FRANQUIAS e 15% em MULTIMARCAS.
// - Simulação: escolhe um mês (ou o acumulado), altera os percentuais e vê o
//   valor que cada canal ficaria para aquele total. Fica no localStorage.
// - Um mês pode ser ajustado à mão (lápis no cabeçalho) e volta ao forecast
//   quando o ajuste é removido.
import React, { useEffect, useMemo, useState } from 'react';
import {
  ChartPieSlice,
  ArrowClockwise,
  Spinner,
  X,
  FloppyDisk,
  PencilSimple,
  ArrowCounterClockwise,
  Equals,
  CurrencyDollar,
  Crown,
  CalendarBlank,
  Warning,
  Lock,
  LockOpen,
  Trash,
  TrendDown,
} from '@phosphor-icons/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Cor fixa por canal (mesma ordem do backend) — a cor segue o canal, não a
// posição no ranking.
const CORES = {
  VAREJO: '#2563eb',
  REVENDA: '#ea580c',
  FRANQUIAS: '#059669',
  MULTIMARCAS: '#7c3aed',
  BAZAR: '#db2777',
  BLUECRED: '#92400e',
  'MAGAZINE JESUS': '#65a30d',
  OUTROS: '#6b7280',
};
const corDo = (c) => CORES[c] || '#6b7280';

const MESES_ROTULO = [
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
const rotuloMes = (mes) => {
  const m = Number(String(mes).slice(5, 7));
  return MESES_ROTULO[m - 1] || mes;
};
const rotuloMesLongo = (mes) =>
  `${rotuloMes(mes)}/${String(mes).slice(0, 4)}`;

const ORIGEM = {
  historico: { label: 'Histórico', cls: 'bg-slate-100 text-slate-700' },
  forecast: { label: 'New Forecast', cls: 'bg-violet-100 text-violet-700' },
  manual: { label: 'Manual', cls: 'bg-amber-100 text-amber-800' },
  futuro: { label: 'Futuro', cls: 'bg-gray-100 text-gray-400' },
  erro: { label: 'Erro', cls: 'bg-rose-100 text-rose-700' },
};

const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const formatPct = (v, casas = 2) =>
  `${(Number(v) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const parseNum = (str) => {
  if (typeof str === 'number') return str;
  const s = String(str ?? '')
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const pctDe = (valor, total) => (total > 0 ? (valor / total) * 100 : 0);

const SIM_PREFIX = 'mix_canais_sim_v1_';
const loadSim = (key) => {
  try {
    const raw = localStorage.getItem(SIM_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const anoAtual = () => new Date().getFullYear();

// ─── Componentes pequenos ───────────────────────────────────────────────────
const Badge = ({ origem }) => {
  const o = ORIGEM[origem] || ORIGEM.futuro;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${o.cls}`}
    >
      {o.label}
    </span>
  );
};

const ResumoCard = ({ icon: Icon, color, bg, label, value, sub }) => (
  <div className="bg-white rounded-lg shadow-md p-4 flex items-center gap-3 border border-[#000638]/10">
    <div className={`p-2 rounded-full ${bg} shrink-0`}>
      <Icon size={20} className={color} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium truncate text-gray-500" title={label}>
        {label}
      </p>
      <p className="text-base font-bold text-[#000638] truncate" title={value}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  </div>
);

const Bolinha = ({ canal }) => (
  <span
    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
    style={{ background: corDo(canal) }}
    aria-hidden="true"
  />
);

// ─── Página ─────────────────────────────────────────────────────────────────
const MixCanais = () => {
  const apiClient = useApiClient();
  const [ano, setAno] = useState(anoAtual());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // ─── Carga ───────────────────────────────────────────────────────────────
  const carregar = async (opts = {}) => {
    setLoading(true);
    setErro('');
    try {
      const r = await apiClient.totvs.mixCanaisGet(ano, opts.refresh);
      const payload = r?.data ?? r;
      setDados(payload);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar o mix de canais.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano]);

  const canais = dados?.canais || Object.keys(CORES);
  const meses = dados?.meses || [];
  const mesesComDados = meses.filter(
    (m) => m.origem !== 'futuro' && m.origem !== 'erro',
  );
  const acumulado = dados?.acumulado || { canais: {}, total: 0 };

  // ─── Resumo ──────────────────────────────────────────────────────────────
  const rankingAcum = useMemo(
    () =>
      canais
        .map((c) => ({ canal: c, valor: acumulado.canais?.[c] || 0 }))
        .sort((a, b) => b.valor - a.valor),
    [canais, acumulado],
  );
  const maior = rankingAcum[0];
  const menorComMov = [...rankingAcum].reverse().find((x) => x.valor > 0);
  const ultimoMes = mesesComDados[mesesComDados.length - 1];

  // ─── Gráfico: faturamento (R$) empilhado por canal, por mês ──────────────
  const chartData = useMemo(
    () => ({
      labels: meses.map((m) => rotuloMes(m.mes)),
      datasets: canais.map((c) => ({
        label: c,
        data: meses.map((m) => r2(m.canais?.[c] || 0)),
        backgroundColor: corDo(c),
        borderColor: '#ffffff',
        borderWidth: 1,
        borderSkipped: false,
        barPercentage: 0.72,
        categoryPercentage: 0.9,
      })),
    }),
    [meses, canais],
  );
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#6b7280' } },
        y: {
          stacked: true,
          min: 0,
          ticks: {
            callback: (v) =>
              v >= 1000000
                ? `R$ ${(v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
                : `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`,
            color: '#6b7280',
          },
          grid: { color: 'rgba(0,6,56,0.06)' },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, boxHeight: 10, color: '#374151', font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const m = meses[items[0]?.dataIndex];
              return m ? `${rotuloMesLongo(m.mes)} · ${formatBRL(m.total)}` : '';
            },
            label: (item) => {
              const m = meses[item.dataIndex];
              const valor = m?.canais?.[item.dataset.label] || 0;
              if (!valor) return `${item.dataset.label}: sem movimentação`;
              return `${item.dataset.label}: ${formatBRL(valor)} (${formatPct(pctDe(valor, m.total || 0))})`;
            },
          },
        },
      },
    }),
    [meses],
  );

  // ─── Edição manual de um mês ─────────────────────────────────────────────
  const [editMes, setEditMes] = useState(null); // { mes, origem, valores:{}, observacao }
  const [salvandoMes, setSalvandoMes] = useState(false);
  const abrirEdicao = (m) => {
    const valores = {};
    for (const c of canais) valores[c] = (m.canais?.[c] || 0).toFixed(2).replace('.', ',');
    setEditMes({ mes: m.mes, origem: m.origem, valores, observacao: m.observacao || '' });
  };
  const salvarMes = async () => {
    if (!editMes) return;
    setSalvandoMes(true);
    try {
      const canaisNum = {};
      for (const c of canais) canaisNum[c] = r2(parseNum(editMes.valores[c]));
      await apiClient.totvs.mixCanaisMesSave({
        mes: editMes.mes,
        canais: canaisNum,
        observacao: editMes.observacao,
      });
      setEditMes(null);
      await carregar();
    } catch (e) {
      window.alert(e.message || 'Falha ao salvar o mês.');
    } finally {
      setSalvandoMes(false);
    }
  };
  const removerAjuste = async () => {
    if (!editMes) return;
    if (
      !window.confirm(
        `Remover o ajuste manual de ${rotuloMesLongo(editMes.mes)}? O mês volta a ser calculado automaticamente.`,
      )
    )
      return;
    setSalvandoMes(true);
    try {
      await apiClient.totvs.mixCanaisMesRemove(editMes.mes);
      setEditMes(null);
      await carregar();
    } catch (e) {
      window.alert(e.message || 'Falha ao remover o ajuste.');
    } finally {
      setSalvandoMes(false);
    }
  };

  // ─── Simulação ───────────────────────────────────────────────────────────
  // base: 'acum' ou 'YYYY-MM'. O exercício guarda total, % por canal e os
  // canais travados (não entram na compensação/normalização).
  const [simBase, setSimBase] = useState('acum');
  const [sim, setSim] = useState({ total: 0, pct: {}, travados: [] });
  const [autoCompensar, setAutoCompensar] = useState(true);
  const simKey = `${ano}_${simBase}`;

  const baseSim = useMemo(() => {
    if (simBase === 'acum') return { canais: acumulado.canais || {}, total: acumulado.total || 0 };
    const m = meses.find((x) => x.mes === simBase);
    return { canais: m?.canais || {}, total: m?.total || 0 };
  }, [simBase, meses, acumulado]);
  const realPct = useMemo(() => {
    const out = {};
    for (const c of canais) out[c] = r2(pctDe(baseSim.canais[c] || 0, baseSim.total));
    return out;
  }, [canais, baseSim]);

  // Troca de base/ano: recupera o exercício salvo ou parte do real
  useEffect(() => {
    if (!dados) return;
    const salvo = loadSim(simKey);
    if (salvo && salvo.pct) {
      setSim({
        total: Number(salvo.total) || baseSim.total,
        pct: { ...realPct, ...salvo.pct },
        travados: Array.isArray(salvo.travados) ? salvo.travados : [],
      });
    } else {
      setSim({ total: baseSim.total, pct: { ...realPct }, travados: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simKey, dados]);
  // Persiste o exercício
  useEffect(() => {
    if (!dados) return;
    try {
      localStorage.setItem(SIM_PREFIX + simKey, JSON.stringify(sim));
    } catch (_) {
      /* sem localStorage: segue sem persistir */
    }
  }, [sim, simKey, dados]);

  const somaPct = r2(canais.reduce((a, c) => a + (Number(sim.pct[c]) || 0), 0));
  const simValor = (c) => r2(((Number(sim.pct[c]) || 0) / 100) * (Number(sim.total) || 0));
  const travado = (c) => sim.travados.includes(c);
  const toggleTrava = (c) =>
    setSim((s) => ({
      ...s,
      travados: travado(c) ? s.travados.filter((x) => x !== c) : [...s.travados, c],
    }));

  // Altera o % de um canal. Com "compensar" ligado, a diferença é tirada
  // (ou dada) proporcionalmente aos outros canais destravados, para a soma
  // continuar em 100%.
  const setPct = (canal, novoRaw) => {
    const novo = Math.max(0, Math.min(100, Number(novoRaw) || 0));
    setSim((s) => {
      const pct = { ...s.pct, [canal]: novo };
      if (autoCompensar) {
        const delta = novo - (Number(s.pct[canal]) || 0);
        const outros = canais.filter((c) => c !== canal && !s.travados.includes(c));
        const somaOutros = outros.reduce((a, c) => a + (Number(s.pct[c]) || 0), 0);
        if (outros.length && Math.abs(delta) > 1e-9) {
          let sobra = -delta;
          for (const c of outros) {
            const atual = Number(s.pct[c]) || 0;
            const parte =
              somaOutros > 0 ? (atual / somaOutros) * -delta : -delta / outros.length;
            const prox = Math.max(0, r2(atual + parte));
            sobra -= prox - atual;
            pct[c] = prox;
          }
          // o que não coube (canal zerado) fica na soma — a tela avisa
          if (Math.abs(sobra) > 0.009) {
            const alvo = outros.find((c) => pct[c] > 0);
            if (alvo) pct[alvo] = Math.max(0, r2(pct[alvo] + sobra));
          }
        }
      }
      return { ...s, pct };
    });
  };
  // Normaliza os destravados para a soma fechar em 100%
  const normalizar = () =>
    setSim((s) => {
      const pct = { ...s.pct };
      const livres = canais.filter((c) => !s.travados.includes(c));
      const somaTravados = canais
        .filter((c) => s.travados.includes(c))
        .reduce((a, c) => a + (Number(pct[c]) || 0), 0);
      const alvo = Math.max(0, 100 - somaTravados);
      const somaLivres = livres.reduce((a, c) => a + (Number(pct[c]) || 0), 0);
      for (const c of livres)
        pct[c] = somaLivres > 0 ? r2(((Number(pct[c]) || 0) / somaLivres) * alvo) : r2(alvo / livres.length);
      return { ...s, pct };
    });
  const restaurar = () => setSim({ total: baseSim.total, pct: { ...realPct }, travados: [] });
  const simAlterada =
    r2(sim.total) !== r2(baseSim.total) ||
    canais.some((c) => r2(sim.pct[c]) !== r2(realPct[c]));

  // Gráfico Real × Simulado (barras horizontais 100%)
  const simChartData = useMemo(
    () => ({
      labels: ['Real', 'Simulado'],
      datasets: canais.map((c) => ({
        label: c,
        data: [realPct[c] || 0, r2(Number(sim.pct[c]) || 0)],
        backgroundColor: corDo(c),
        borderColor: '#ffffff',
        borderWidth: 1,
        borderSkipped: false,
        barPercentage: 0.7,
      })),
    }),
    [canais, realPct, sim.pct],
  );
  const simChartOptions = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          min: 0,
          max: 100,
          ticks: { callback: (v) => `${v}%`, color: '#6b7280', stepSize: 25 },
          grid: { color: 'rgba(0,6,56,0.06)' },
        },
        y: { stacked: true, grid: { display: false }, ticks: { color: '#374151' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = item.dataIndex === 0 ? baseSim.total : Number(sim.total) || 0;
              const valor = (item.raw / 100) * total;
              return `${item.dataset.label}: ${formatPct(item.raw)} · ${formatBRL(valor)}`;
            },
          },
        },
      },
    }),
    [baseSim.total, sim.total],
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  const btnSec =
    'flex items-center gap-1.5 border border-[#000638]/30 text-[#000638] rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-[#000638]/5 disabled:opacity-50 transition-colors h-8';
  const anos = [anoAtual() - 1, anoAtual(), anoAtual() + 1];

  // Célula de mês: só o valor. `comPct` (coluna Acumulado) mostra a
  // participação do canal embaixo do valor.
  const Celula = ({ valor, total, origem, comPct }) => {
    if (origem === 'futuro') return <span className="text-gray-300">—</span>;
    if (!valor)
      return (
        <span className="text-[10px] italic text-gray-400 whitespace-nowrap">
          sem movimentação
        </span>
      );
    return (
      <>
        <div className="font-medium text-[#000638] whitespace-nowrap">{formatBRL(valor)}</div>
        {comPct && (
          <div className="whitespace-nowrap text-[11px] text-gray-500">
            {formatPct(pctDe(valor, total))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="w-full max-w-[1500px] mx-auto flex flex-col items-stretch justify-start gap-4 py-3 px-2">
      <PageTitle
        title="Mix de Canais"
        subtitle="Participação de cada canal no faturamento • Jan–Jul histórico · Ago+ New Forecast"
        icon={ChartPieSlice}
        iconColor="text-violet-600"
      />

      {/* Filtros */}
      <div className="bg-white p-3 rounded-lg shadow-md border border-[#000638]/10">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[120px]">
            <label className="block text-xs font-semibold mb-1 text-[#000638]">Ano</label>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="h-8 w-full border border-[#000638]/30 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="self-end">
            <button
              onClick={() => carregar({ refresh: true })}
              disabled={loading}
              title="Recalcular os meses do New Forecast no TOTVS (ignora o cache)"
              className="h-8 flex gap-1 items-center justify-center bg-[#000638] text-white px-3 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold tracking-wide uppercase"
            >
              {loading ? (
                <>
                  <Spinner size={12} className="animate-spin" /> Calculando...
                </>
              ) : (
                <>
                  <ArrowClockwise size={12} /> Atualizar
                </>
              )}
            </button>
          </div>
          <div className="self-end ml-auto flex items-center gap-2 text-[11px] text-gray-500">
            {Object.entries(ORIGEM)
              .filter(([k]) => k !== 'erro')
              .map(([k]) => (
                <Badge key={k} origem={k} />
              ))}
          </div>
        </div>
        {loading && !dados && (
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
            <Spinner size={12} className="animate-spin" />
            Calculando os meses do New Forecast — a primeira vez pode levar alguns minutos.
          </p>
        )}
        {erro && <p className="mt-2 text-xs text-rose-600">{erro}</p>}
        {dados?.avisos?.length > 0 && (
          <p className="mt-2 text-xs text-amber-700 flex items-center gap-1">
            <Warning size={14} /> Falha ao calcular: {dados.avisos.join(' · ')}
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumoCard
          icon={CurrencyDollar}
          color="text-emerald-600"
          bg="bg-emerald-50"
          label={`Faturamento acumulado ${ano}`}
          value={formatBRL(acumulado.total)}
          sub={
            mesesComDados.length
              ? `${mesesComDados.length} ${mesesComDados.length === 1 ? 'mês' : 'meses'} · até ${rotuloMesLongo(ultimoMes.mes)}`
              : 'sem dados'
          }
        />
        <ResumoCard
          icon={Crown}
          color="text-amber-600"
          bg="bg-amber-50"
          label="Maior canal (acumulado)"
          value={maior?.valor ? maior.canal : '—'}
          sub={
            maior?.valor
              ? `${formatPct(pctDe(maior.valor, acumulado.total))} · ${formatBRL(maior.valor)}`
              : ''
          }
        />
        <ResumoCard
          icon={TrendDown}
          color="text-rose-600"
          bg="bg-rose-50"
          label="Menor canal com movimentação"
          value={menorComMov ? menorComMov.canal : '—'}
          sub={
            menorComMov
              ? `${formatPct(pctDe(menorComMov.valor, acumulado.total))} · ${formatBRL(menorComMov.valor)}`
              : ''
          }
        />
        <ResumoCard
          icon={CalendarBlank}
          color="text-violet-600"
          bg="bg-violet-50"
          label="Mês atual"
          value={ultimoMes ? rotuloMesLongo(ultimoMes.mes) : '—'}
          sub={
            ultimoMes
              ? `${ORIGEM[ultimoMes.origem]?.label || ultimoMes.origem}${ultimoMes.parcial ? ' · parcial' : ''} · ${formatBRL(ultimoMes.total)}`
              : ''
          }
        />
      </div>

      {/* Gráfico mensal */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[#000638]">Faturamento por canal, mês a mês</h2>
          <span className="text-[11px] text-gray-400">passe o mouse para ver valor e participação</span>
        </div>
        <div className="h-[300px]">
          {meses.length > 0 && <Bar data={chartData} options={chartOptions} />}
        </div>
      </div>

      {/* Tabela canal × mês */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1300px]">
          <thead>
            <tr className="bg-[#000638]/5 text-[#000638]">
              <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-[#f5f5f8] z-10">
                Canal
              </th>
              {meses.map((m) => {
                const sel = simBase === m.mes;
                return (
                  <th
                    key={m.mes}
                    className={`text-right font-semibold px-2 py-2 align-top transition-colors ${
                      sel ? 'bg-violet-600 text-white' : ''
                    }`}
                  >
                    <div className="flex items-start justify-end gap-1">
                      <button
                        onClick={() => setSimBase(sel ? 'acum' : m.mes)}
                        title="Clique para simular este mês"
                        className={`text-right rounded px-1 -mx-1 ${sel ? 'font-bold' : 'hover:text-violet-700'}`}
                        disabled={m.origem === 'futuro'}
                      >
                        {rotuloMes(m.mes)}
                      </button>
                      {m.origem !== 'futuro' && (
                        <button
                          onClick={() => abrirEdicao(m)}
                          title="Ajustar os valores deste mês à mão"
                          className={`rounded p-0.5 ${sel ? 'text-violet-100 hover:text-white' : 'text-gray-400 hover:text-[#000638]'}`}
                        >
                          <PencilSimple size={12} />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-right">
                      <Badge origem={m.origem} />
                      {m.parcial && (
                        <span className={`ml-1 text-[10px] ${sel ? 'text-violet-100' : 'text-gray-400'}`}>
                          parcial
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th
                className={`text-right font-semibold px-3 py-2 align-top ${
                  simBase === 'acum' ? 'bg-violet-600 text-white' : 'bg-[#000638]/10'
                }`}
              >
                <button
                  onClick={() => setSimBase('acum')}
                  title="Clique para simular o acumulado"
                  className="rounded px-1 -mx-1 hover:text-violet-700"
                >
                  Acumulado
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {canais.map((c, idx) => {
              const zebra = idx % 2 === 1 ? 'bg-[#000638]/[0.02]' : '';
              return (
                <tr key={c} className={`border-t border-gray-100 ${zebra} hover:bg-gray-50/60`}>
                  <td
                    className={`px-3 py-1.5 font-medium sticky left-0 z-10 whitespace-nowrap text-[#000638] ${
                      idx % 2 === 1 ? 'bg-[#fbfbfc]' : 'bg-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Bolinha canal={c} />
                      {c}
                    </span>
                  </td>
                  {meses.map((m) => (
                    <td
                      key={m.mes}
                      className={`px-2 py-1.5 text-right align-middle ${
                        simBase === m.mes ? 'bg-violet-50' : ''
                      }`}
                    >
                      <Celula valor={m.canais?.[c] || 0} total={m.total || 0} origem={m.origem} />
                    </td>
                  ))}
                  <td
                    className={`px-3 py-1.5 text-right ${
                      simBase === 'acum' ? 'bg-violet-50' : 'bg-[#000638]/[0.04]'
                    }`}
                  >
                    <Celula
                      valor={acumulado.canais?.[c] || 0}
                      total={acumulado.total || 0}
                      origem="acum"
                      comPct
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-[#000638]/20 bg-[#000638]/5 font-bold text-[#000638]">
              <td className="px-3 py-2 sticky left-0 bg-[#f5f5f8] z-10">Total</td>
              {meses.map((m) => (
                <td key={m.mes} className="px-2 py-2 text-right whitespace-nowrap">
                  {m.origem === 'futuro' ? (
                    <span className="text-gray-300 font-normal">—</span>
                  ) : (
                    formatBRL(m.total)
                  )}
                </td>
              ))}
              <td className="px-3 py-2 text-right whitespace-nowrap bg-[#000638]/10">
                <div>{formatBRL(acumulado.total)}</div>
                <div className="text-[11px] font-normal text-gray-500">100%</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Simulação */}
      <div className="bg-white rounded-lg shadow-md border border-violet-200 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-[#000638]">Simulação de mix</h2>
            <p className="text-[11px] text-gray-500">
              Altere o % de cada canal e veja o valor que ele ficaria para o total escolhido.
              Cadeado = canal travado (não entra na compensação).
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={simBase}
              onChange={(e) => setSimBase(e.target.value)}
              className="h-8 border border-[#000638]/30 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            >
              <option value="acum">Acumulado {ano}</option>
              {mesesComDados.map((m) => (
                <option key={m.mes} value={m.mes}>
                  {rotuloMesLongo(m.mes)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-[#000638] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCompensar}
                onChange={(e) => setAutoCompensar(e.target.checked)}
                className="accent-violet-600"
              />
              compensar nos outros canais
            </label>
            <button onClick={normalizar} className={btnSec} title="Ajusta os canais destravados para a soma fechar em 100%">
              <Equals size={14} /> Fechar 100%
            </button>
            <button onClick={restaurar} disabled={!simAlterada} className={btnSec} title="Volta aos percentuais reais">
              <ArrowCounterClockwise size={14} /> Restaurar real
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-[#000638]/5 text-[#000638]">
                  <th className="text-left font-semibold px-3 py-2">Canal</th>
                  <th className="text-right font-semibold px-2 py-2">Real R$</th>
                  <th className="text-right font-semibold px-2 py-2">Real %</th>
                  <th className="text-right font-semibold px-2 py-2 bg-violet-100 text-violet-900">
                    Simulado %
                  </th>
                  <th className="text-right font-semibold px-2 py-2 bg-violet-100 text-violet-900">
                    Simulado R$
                  </th>
                  <th className="text-right font-semibold px-2 py-2">Diferença R$</th>
                  <th className="text-center font-semibold px-2 py-2 w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {canais.map((c, idx) => {
                  const real = baseSim.canais[c] || 0;
                  const vSim = simValor(c);
                  const dif = r2(vSim - real);
                  const mudou = r2(sim.pct[c]) !== r2(realPct[c]);
                  return (
                    <tr
                      key={c}
                      className={`border-t border-gray-100 ${idx % 2 === 1 ? 'bg-[#000638]/[0.02]' : ''}`}
                    >
                      <td className="px-3 py-1.5 font-medium text-[#000638] whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <Bolinha canal={c} />
                          {c}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {real ? (
                          formatBRL(real)
                        ) : (
                          <span className="text-[10px] italic text-gray-400">sem movimentação</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-600">{formatPct(realPct[c])}</td>
                      <td className="px-2 py-1 text-right bg-violet-50/60">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={Number(sim.pct[c] ?? 0)}
                            onChange={(e) => setPct(c, e.target.value)}
                            disabled={travado(c)}
                            className={`h-7 w-[84px] text-right border rounded-md px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100 disabled:text-gray-400 ${
                              mudou ? 'border-violet-400 bg-white font-semibold text-violet-900' : 'border-[#000638]/20 bg-white'
                            }`}
                          />
                          <span className="text-gray-400">%</span>
                        </div>
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right whitespace-nowrap bg-violet-50/60 ${
                          mudou ? 'font-semibold text-violet-900' : 'text-[#000638]'
                        }`}
                      >
                        {formatBRL(vSim)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right whitespace-nowrap ${
                          dif > 0 ? 'text-emerald-600' : dif < 0 ? 'text-rose-600' : 'text-gray-400'
                        }`}
                      >
                        {dif > 0 ? '+' : ''}
                        {formatBRL(dif)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => toggleTrava(c)}
                          title={travado(c) ? 'Destravar canal' : 'Travar canal (fica fora da compensação)'}
                          className={`rounded p-1 ${travado(c) ? 'text-amber-600 bg-amber-50' : 'text-gray-300 hover:text-gray-500'}`}
                        >
                          {travado(c) ? <Lock size={14} weight="fill" /> : <LockOpen size={14} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[#000638]/20 bg-[#000638]/5 font-bold text-[#000638]">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{formatBRL(baseSim.total)}</td>
                  <td className="px-2 py-2 text-right">{baseSim.total ? '100%' : '0%'}</td>
                  <td
                    className={`px-2 py-2 text-right ${
                      Math.abs(somaPct - 100) > 0.01 ? 'text-rose-600' : 'text-violet-900'
                    }`}
                  >
                    {formatPct(somaPct)}
                    {Math.abs(somaPct - 100) > 0.01 && (
                      <span className="block text-[10px] font-normal">
                        {somaPct > 100 ? 'passa de' : 'falta para'} 100% ({formatPct(Math.abs(100 - somaPct))})
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right bg-violet-50/60">
                    <div className="inline-flex items-center gap-1">
                      <span className="text-[10px] font-normal text-gray-500">total</span>
                      <input
                        type="text"
                        value={sim.total === '' ? '' : (Number(sim.total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        onChange={(e) => setSim((s) => ({ ...s, total: parseNum(e.target.value) }))}
                        onFocus={(e) => e.target.select()}
                        title="Total simulado (R$) — pode ser alterado"
                        className="h-7 w-[130px] text-right border border-violet-300 rounded-md px-1.5 text-xs font-bold text-violet-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </td>
                  <td
                    className={`px-2 py-2 text-right whitespace-nowrap ${
                      r2(sim.total - baseSim.total) > 0
                        ? 'text-emerald-600'
                        : r2(sim.total - baseSim.total) < 0
                          ? 'text-rose-600'
                          : 'text-gray-400'
                    }`}
                  >
                    {r2(sim.total - baseSim.total) > 0 ? '+' : ''}
                    {formatBRL(r2(sim.total - baseSim.total))}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col">
            <p className="text-xs font-semibold text-[#000638] mb-1">
              Real × Simulado · {simBase === 'acum' ? `Acumulado ${ano}` : rotuloMesLongo(simBase)}
            </p>
            <div className="h-[140px]">
              <Bar data={simChartData} options={simChartOptions} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {canais.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-[10px] text-gray-600">
                  <Bolinha canal={c} />
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: ajuste manual do mês */}
      {editMes && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !salvandoMes && setEditMes(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md border border-[#000638]/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-[#000638]">
                  Ajustar {rotuloMesLongo(editMes.mes)}
                </h3>
                <p className="text-[11px] text-gray-500">
                  Origem atual: {ORIGEM[editMes.origem]?.label || editMes.origem}. Ao salvar, o mês
                  passa a ser <b>Manual</b> e deixa de ser recalculado.
                </p>
              </div>
              <button onClick={() => setEditMes(null)} className="text-gray-400 hover:text-[#000638]">
                <X size={18} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
              {canais.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs text-[#000638] w-[170px] shrink-0">
                    <Bolinha canal={c} />
                    {c}
                  </span>
                  <span className="text-xs text-gray-400">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editMes.valores[c]}
                    onChange={(e) =>
                      setEditMes((m) => ({ ...m, valores: { ...m.valores, [c]: e.target.value } }))
                    }
                    onFocus={(e) => e.target.select()}
                    className="h-8 flex-1 text-right border border-[#000638]/20 rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#000638] border-t border-gray-100 mt-2">
                <span>Total</span>
                <span>
                  {formatBRL(canais.reduce((a, c) => a + parseNum(editMes.valores[c]), 0))}
                </span>
              </div>
              <input
                type="text"
                placeholder="Observação (opcional)"
                value={editMes.observacao}
                onChange={(e) => setEditMes((m) => ({ ...m, observacao: e.target.value }))}
                className="mt-2 h-8 w-full border border-[#000638]/20 rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
              {editMes.origem === 'manual' && (
                <button
                  onClick={removerAjuste}
                  disabled={salvandoMes}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50"
                  title="Apaga o ajuste e volta ao cálculo automático"
                >
                  <Trash size={14} /> Remover ajuste
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button onClick={() => setEditMes(null)} disabled={salvandoMes} className={btnSec}>
                  Cancelar
                </button>
                <button
                  onClick={salvarMes}
                  disabled={salvandoMes}
                  className="h-8 px-4 flex items-center gap-1.5 bg-[#000638] text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#fe0000] disabled:opacity-50 transition-colors"
                >
                  {salvandoMes ? <Spinner size={12} className="animate-spin" /> : <FloppyDisk size={14} />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MixCanais;
