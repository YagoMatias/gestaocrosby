import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTitle from '../../components/ui/PageTitle';
import {
  ChartPieSlice,
  Table,
  ChartLineUp,
  Rows,
  Columns,
  Flag,
  Scissors,
  ClipboardText,
  DownloadSimple,
  UploadSimple,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  DespesasGeraisProvider,
  useDespesasGerais,
  MONTH_KEYS,
  MES_NOME,
  fmtBRL,
} from './store';
import VisaoGeral from './VisaoGeral';
import DreAnalitica from './DreAnalitica';
import Graficos from './Graficos';
import AnaliseHorizontal from './AnaliseHorizontal';
import AnaliseVertical from './AnaliseVertical';
import PaginaFlags from './PaginaFlags';
import HeadcoachContas from './HeadcoachContas';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const PAGINAS = {
  'visao-geral': {
    titulo: 'Despesas Gerais — Visão Geral',
    subtitulo:
      'Resumo executivo: Realizado (gasto efetivo) × Previsto (forecast) e a economia do período',
    icon: ChartPieSlice,
    comp: VisaoGeral,
  },
  'dre-analitica': {
    titulo: 'DRE Analítica',
    subtitulo:
      'Despesas por categoria — clique na categoria para ver os lançamentos e preencha o forecast para comparar',
    icon: Table,
    comp: DreAnalitica,
  },
  graficos: {
    titulo: 'Despesas Gerais — Gráficos',
    subtitulo: 'Top despesas, desvios do orçamento e evolução mensal',
    icon: ChartLineUp,
    comp: Graficos,
  },
  'analise-horizontal': {
    titulo: 'Análise Horizontal',
    subtitulo: 'Como cada despesa variou de Janeiro a Julho',
    icon: Rows,
    comp: AnaliseHorizontal,
  },
  'analise-vertical': {
    titulo: 'Análise Vertical',
    subtitulo: 'Peso de cada despesa no total — participação % acumulada e por mês',
    icon: Columns,
    comp: AnaliseVertical,
  },
  correcoes: {
    titulo: 'Correções DRE',
    subtitulo:
      'Lançamentos marcados na DRE Analítica que precisam de correção no sistema',
    icon: Flag,
    comp: (props) => <PaginaFlags tipo="correcao" {...props} />,
  },
  corte: {
    titulo: 'Corte de Custo',
    subtitulo: 'Lançamentos marcados como oportunidade de corte de custo',
    icon: Scissors,
    comp: (props) => <PaginaFlags tipo="corte" {...props} />,
  },
  headcoach: {
    titulo: 'Contas a Pagar — Sintética',
    subtitulo: 'Análise Janeiro · Conta Sintética / Analítica',
    icon: ClipboardText,
    comp: HeadcoachContas,
  },
};

function Topbar() {
  const {
    activeMonth,
    setActiveMonth,
    months,
    exportJson,
    importJson,
    resetAll,
  } = useDespesasGerais();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const mo = months[activeMonth];

  return (
    <div className="bg-white border border-[#000638]/10 rounded-xl shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg overflow-hidden border border-[#000638]/20">
        {MONTH_KEYS.map((m) => (
          <button
            key={m}
            onClick={() => setActiveMonth(m)}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
              activeMonth === m
                ? 'bg-[#000638] text-white'
                : 'bg-white text-[#000638] hover:bg-gray-100'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-500">
        Competência: <b className="text-[#000638]">{MES_NOME[activeMonth]} / 2026</b>{' '}
        · Total: <b className="text-[#000638]">{fmtBRL(mo.total)}</b> ·{' '}
        {mo.cnt} lançamentos
      </div>
      <div className="ml-auto flex items-center gap-2">
        {msg && <span className="text-[11px] text-green-600">{msg}</span>}
        <button
          onClick={exportJson}
          title="Baixa um backup JSON com todas as edições"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#000638] border border-[#000638]/20 hover:bg-gray-50 transition"
        >
          <DownloadSimple size={13} weight="bold" /> Exportar
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          title="Importa um backup JSON exportado anteriormente"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#000638] border border-[#000638]/20 hover:bg-gray-50 transition"
        >
          <UploadSimple size={13} weight="bold" /> Importar
        </button>
        <button
          onClick={() => {
            if (
              window.confirm(
                'Descartar todas as edições e voltar aos dados originais?',
              )
            )
              resetAll();
          }}
          title="Restaura os dados originais do painel"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition"
        >
          <ArrowCounterClockwise size={13} weight="bold" /> Restaurar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              importJson(f, (err) => {
                setMsg(err ? 'Falha ao importar: ' + err.message : 'Importado ✓');
                setTimeout(() => setMsg(''), 4000);
              });
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

function Conteudo() {
  const { pagina } = useParams();
  const navigate = useNavigate();
  const cfg = PAGINAS[pagina] || PAGINAS['visao-geral'];
  const Comp = cfg.comp;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-[1500px] mx-auto px-4 pt-6">
        <PageTitle title={cfg.titulo} subtitle={cfg.subtitulo} icon={cfg.icon} />
        {/* navegação rápida entre as visões (espelha o sidebar) */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-4">
          {Object.entries(PAGINAS).map(([slug, p]) => (
            <button
              key={slug}
              onClick={() => navigate(`/despesas-gerais/${slug}`)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                slug === (PAGINAS[pagina] ? pagina : 'visao-geral')
                  ? 'bg-[#000638] text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-[#000638]/40'
              }`}
            >
              {p.titulo.replace('Despesas Gerais — ', '')}
            </button>
          ))}
        </div>
        <Topbar />
        <Comp />
      </div>
    </div>
  );
}

export default function DespesasGerais() {
  return (
    <DespesasGeraisProvider>
      <Conteudo />
    </DespesasGeraisProvider>
  );
}
