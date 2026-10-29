// Forecast — menu abaixo do DRE (Niziany, 27/10/2026).
// DRE projetada de 2026 a partir da planilha base "FORECAST PESSIMISTA /
// Conservador": Realizado (jan–set) + Previsão (out–dez), mês a mês.
// Layout no padrão das demais páginas do HeadCoach (azul #000638, cabeçalho
// cinza, cards com borda). Os valores vêm de src/data/forecastBase.json; as
// visões e blocos extras seguem no JSON caso precise voltar.
import React, { useEffect, useMemo, useState } from 'react';
import { ChartLineUp, CaretRight, CaretDown, CornersOut, CornersIn } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import base from '../data/forecastBase.json';
import { API_BASE_URL } from '../config/constants';

// Automação da receita bruta (Niziany, 27–28/10/2026): a partir de setembro/2026
// os canais vêm do New Forecast (GET /api/forecast-dre/receita-canais), já com
// o showroom separado por cliente. Jan–ago seguem com os números da planilha.
// É automático para os próximos meses: puxa todo mês de 2026 marcado como
// "realizado" a partir de setembro — não precisa ligar mês a mês.
const CANAL_POR_LINHA = {
  VAREJO: 'varejo',
  MULTIMARCAS: 'multimarcas',
  FRANQUIA: 'franquia',
  REVENDA: 'revenda',
  BAZAR: 'bazar',
};
// Linhas de canal que podem abrir para mostrar o CREDEV do canal (só visual).
const CREDEV_CANAL_POR_LINHA = {
  VAREJO: 'varejo',
  MULTIMARCAS: 'multimarcas',
  FRANQUIA: 'franquia',
  REVENDA: 'revenda',
  BAZAR: 'bazar',
};
const MES_ABREV = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
// Coluna mensal → 'YYYY-MM' (usa o label 'Set/26' + o ano da coluna).
const colParaMes = (c) => {
  if (c.grupo !== 'mensal' || !c.ano) return null;
  const m = MES_ABREV[String(c.label || '').slice(0, 3).toLowerCase()];
  return m ? `${c.ano}-${String(m).padStart(2, '0')}` : null;
};
// Meses a puxar do New Forecast: colunas mensais de 2026, realizado, mês >= 9.
function mesesAutomaticos(colunas) {
  const out = [];
  for (const c of colunas) {
    if (c.grupo !== 'mensal' || c.ano !== 2026 || c.tipo !== 'realizado') continue;
    const abrev = String(c.label || '').slice(0, 3).toLowerCase();
    const m = MES_ABREV[abrev];
    if (!m || m < 9) continue;
    out.push({ col: c.key, mes: `2026-${String(m).padStart(2, '0')}` });
  }
  return out;
}

const TIPO_ROTULO = { realizado: 'Realizado', forecast: 'Previsão' };

// Cabeçalho superior agrupado por tipo (Realizado / Previsão)
const TIPO_CABECALHO = {
  realizado: 'bg-[#000638] text-white',
  forecast: 'bg-blue-600 text-white',
};

// Realce suave da coluna de previsão no corpo da tabela
const TIPO_CELULA = {
  realizado: '',
  forecast: 'bg-blue-50/70',
};

const fmtMoeda = (v) =>
  v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const fmtInt = (v) =>
  v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v) =>
  v == null
    ? '–'
    : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
      '%';

function formatar(valor, fmtLinha) {
  if (fmtLinha === 'pct') return fmtPct(valor);
  if (fmtLinha === 'int') return fmtInt(valor);
  return fmtMoeda(valor);
}

// Agrupa colunas consecutivas do mesmo tipo para a linha de cabeçalho superior
function agruparColunas(colunas) {
  const grupos = [];
  for (const c of colunas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.tipo === c.tipo) ultimo.qtd += 1;
    else grupos.push({ tipo: c.tipo, qtd: 1 });
  }
  return grupos;
}

// Linhas de total/resultado com destaque forte (banda azul do HeadCoach).
const TOTAIS_FORTES = new Set([
  'RECEITA BRUTA',
  'RECEITA LÍQUIDA',
  'RECEITA OPERACIONAL LÍQUIDA',
  'LUCRO BRUTO',
  'LUCRO OPERACIONAL',
  'EBITDA',
  'LUCRO ANTES DO IR E CS',
  'LUCRO LÍQUIDO',
  'RESULTADO FINAL',
]);
// Linhas que abrem uma nova seção (ganham um traço superior mais marcado).
const INICIO_SECAO = new Set([
  'RECEITA LÍQUIDA',
  'CUSTO DAS MERCADORIAS VENDIDAS',
  'RECEITAS (DESPESAS) OPERACIONAIS',
  'LUCRO OPERACIONAL',
  'RECEITAS NÃO OPERACIONAIS',
  'INVESTIMENTOS',
]);

const tipoLinha = (l) => {
  if (l.fmt === 'pct') return 'pct';
  if (TOTAIS_FORTES.has(l.label)) return 'forte';
  if (l.nivel === 1) return 'sub';
  return 'normal';
};

export default function Forecast() {
  // Realizado × Previsão por mês: a Niziany marca na tela (salvo no backend).
  // Mescla por cima do tipo padrão da planilha.
  const [tipoOverrides, setTipoOverrides] = useState({});
  // Overrides ao vivo por coluna: { [colKey]: { VAREJO: v, MULTIMARCAS: v, ... } }
  const [overrides, setOverrides] = useState({});
  // CREDEV por canal (só visualização): { [colKey]: { varejo, multimarcas, ... } }
  const [credevCanais, setCredevCanais] = useState({});
  // Rubricas da folha por coluna (abrir Pessoal Fixo): { [colKey]: [{desc,tipo,qtd,valor}] }
  const [rubricasFolha, setRubricasFolha] = useState({});
  // Proventos dos empregados (sem pró-labore) e pró-labore editável por coluna
  const [pfFixo, setPfFixo] = useState({}); // proventos fixos por coluna
  const [pfVariavel, setPfVariavel] = useState({}); // proventos variáveis (comissão)
  const [prolabore, setProlabore] = useState({});
  const [editandoProl, setEditandoProl] = useState(null); // col sendo editada
  const [folhasAbertas, setFolhasAbertas] = useState(() => new Set());
  const toggleFolha = (label) =>
    setFolhasAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  const salvarProlabore = (col, mes, valor) => {
    setProlabore((p) => ({ ...p, [col]: valor }));
    fetch(`${API_BASE_URL}/api/forecast-dre/prolabore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, valor }),
    }).catch(() => {});
  };
  // Despesa de PJ (linha PJ): total por coluna e nomes dos contratados
  const [pjLinha, setPjLinha] = useState({}); // { [colKey]: total (negativo) }
  const [pjNomes, setPjNomes] = useState({}); // { [colKey]: [{nome, valor}] }
  const [pjAberto, setPjAberto] = useState(false);
  // Despesa de OCUPAÇÃO (linha OCUPAÇÃO): total por coluna e por filial
  const [ocupLinha, setOcupLinha] = useState({}); // { [colKey]: total (negativo) }
  const [ocupFiliais, setOcupFiliais] = useState({}); // { [colKey]: [{nome, valor}] }
  const [ocupAberto, setOcupAberto] = useState(false);
  // SERVIÇOS DE TERCEIROS FIXOS: lido do localStorage da DRE Analítica
  // (despesas-gerais-2026:v2). Mesmos números que a Niziany vê lá, com as
  // bonificações importadas manualmente — não dá pra reproduzir pelo backend.
  const [dreLocal, setDreLocal] = useState(null);
  const [servAberto, setServAberto] = useState(false);
  const [servCatsAbertas, setServCatsAbertas] = useState(() => new Set());
  const toggleServCat = (cat) =>
    setServCatsAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });
  // Canais abertos para mostrar o CREDEV do canal (por label)
  const [canaisAbertos, setCanaisAbertos] = useState(() => new Set());
  const toggleCanal = (label) =>
    setCanaisAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });

  // Só 2026, visão mensal. Aplica o tipo (realizado/previsão) salvo.
  const colunas = useMemo(
    () =>
      base.colunas
        .filter((c) => c.grupo === 'mensal' && c.ano !== 2025)
        .map((c) => {
          const mes = colParaMes(c);
          const ov = mes && tipoOverrides[mes];
          if (!ov) return c;
          return { ...c, tipo: ov === 'previsao' ? 'forecast' : 'realizado' };
        }),
    [tipoOverrides],
  );
  const grupos = useMemo(() => agruparColunas(colunas), [colunas]);
  const linhas = base.blocos.dre || [];

  // Estrutura pai → filhos: uma linha de nível 0 seguida de linhas de nível 1
  // é "pai" (expansível). Clicar nela recolhe/mostra os detalhes.
  const estrutura = useMemo(() => {
    const info = linhas.map(() => ({ isPai: false, paiId: null }));
    let ultimoPai = null;
    linhas.forEach((l, i) => {
      if (l.nivel === 1 && l.fmt !== 'pct') {
        if (ultimoPai != null) {
          info[i].paiId = linhas[ultimoPai].id;
          info[ultimoPai].isPai = true;
        }
      } else if (l.fmt !== 'pct') {
        ultimoPai = i;
      }
    });
    return info;
  }, [linhas]);

  // Totais calculados (Niziany, 28/10/2026):
  //   RECEITA LÍQUIDA = soma de todas as receitas por canal de venda
  //   RECEITA BRUTA   = soma dos canais + CREDEV (somado pelo valor ABSOLUTO,
  //                     independente do sinal — o CREDEV soma, não diminui)
  // Só recalcula a coluna que tem dados de canal; previsão sem canais (out–dez)
  // mantém o alvo da planilha.
  const totaisCalculados = useMemo(() => {
    const LINHAS_CANAIS = [
      'VAREJO', 'MULTIMARCAS', 'FRANQUIA', 'REVENDA', 'BAZAR',
      'FARDAMENTO', 'IMOBILIZADO', 'BLUECRED',
    ];
    const porLabel = {};
    for (const l of linhas) porLabel[l.label] = l;
    const valor = (label, col) => {
      const ov = overrides[col]?.[label];
      if (ov !== undefined) return ov;
      const l = porLabel[label];
      return l ? (l.valores[col] ?? 0) : 0;
    };
    const out = {};
    for (const c of colunas) {
      const soma = LINHAS_CANAIS.reduce((a, lab) => a + (valor(lab, c.key) || 0), 0);
      if (!soma) continue; // sem canais → mantém o estático (previsão)
      const credev = valor('CREDEV', c.key) || 0;
      out[c.key] = {
        'RECEITA LÍQUIDA': Math.round(soma * 100) / 100,
        'RECEITA BRUTA': Math.round((soma + Math.abs(credev)) * 100) / 100,
      };
    }
    return out;
  }, [colunas, overrides, linhas]);

  const [recolhidos, setRecolhidos] = useState(() => new Set());
  const [telaCheia, setTelaCheia] = useState(false);
  const [carregandoAuto, setCarregandoAuto] = useState(false);

  const [rubricasAbertas, setRubricasAbertas] = useState(() => new Set());
  const toggleRubrica = (key) =>
    setRubricasAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const [empresasAbertas, setEmpresasAbertas] = useState(() => new Set());
  const toggleEmpresa = (key) =>
    setEmpresasAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // Rubricas da folha unidas por coluna (para abrir sob Pessoal Fixo).
  const rubricasUnidas = useMemo(() => {
    const map = new Map();
    for (const [col, lista] of Object.entries(rubricasFolha)) {
      for (const r of lista || []) {
        const key = r.tipo + '|' + r.desc;
        const e =
          map.get(key) ||
          {
            key,
            desc: r.desc,
            tipo: r.tipo,
            entra: r.entra !== false,
            grupo: r.grupo || 'fixo',
            porCol: {},
            funcPorCol: {},
            max: 0,
          };
        e.porCol[col] = r.valor;
        if (Array.isArray(r.funcionarios)) e.funcPorCol[col] = r.funcionarios;
        e.max = Math.max(e.max, Math.abs(Number(r.valor) || 0));
        map.set(key, e);
      }
    }
    return [...map.values()].sort((a, b) => b.max - a.max);
  }, [rubricasFolha]);

  // Lê o estado da DRE Analítica (localStorage, mesmo do menu Despesas Gerais)
  // uma vez — é de onde sai a linha SERVIÇOS DE TERCEIROS FIXOS.
  useEffect(() => {
    try {
      const raw =
        localStorage.getItem('despesas-gerais-2026:v2') ||
        localStorage.getItem('despesas-gerais-2026:v1');
      if (raw) setDreLocal(JSON.parse(raw));
    } catch {
      /* sem acesso ao localStorage: cai no número da planilha */
    }
  }, []);

  // SERVIÇOS DE TERCEIROS FIXOS por coluna realizada = todas as despesas da DRE
  // Analítica do mês, MENOS "Serviços Prestados por Terceiros" (já no PJ) e a
  // "Bonificação Marketing" (a outra bonificação fica). Abre por despesa →
  // lançamentos, igual à DRE Analítica.
  const servTerc = useMemo(() => {
    const out = {};
    if (!dreLocal || !dreLocal.months) return out;
    const norm = (s) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toUpperCase();
    for (const c of colunas) {
      if (c.grupo !== 'mensal' || c.tipo !== 'realizado') continue;
      const mk = String(c.label || '').slice(0, 3).toLowerCase();
      const mes = dreLocal.months[mk];
      if (!mes || !mes.details) continue;
      const categorias = [];
      let total = 0;
      for (const [cat, rows] of Object.entries(mes.details)) {
        const n = norm(cat);
        if (n === 'SERVICOS PRESTADOS POR TERCEIROS') continue; // já está no PJ
        if (/BONIFIC.*MARKETING/.test(n)) continue; // bonificação marketing fora
        const lanc = (rows || []).map((r) => ({
          forn: r.forn || '—',
          venc: r.venc || '',
          val: Number(r.val) || 0,
        }));
        const soma = lanc.reduce((a, x) => a + x.val, 0);
        if (!lanc.length) continue;
        total += soma;
        categorias.push({
          cat,
          valor: Math.round(soma * 100) / 100,
          lancamentos: lanc.sort((a, b) => b.val - a.val),
        });
      }
      categorias.sort((a, b) => b.valor - a.valor);
      out[c.key] = { total: Math.round(total * 100) / 100, categorias };
    }
    return out;
  }, [dreLocal, colunas]);
  const toggleRecolher = (id) =>
    setRecolhidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Carrega a config de meses (realizado/previsão) salva.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/forecast-dre/config`);
        if (!r.ok) return;
        const j = await r.json();
        const ov = (j?.data || j)?.overrides;
        if (!cancelado && ov && typeof ov === 'object') setTipoOverrides(ov);
      } catch {
        /* sem config → usa o padrão da planilha */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Alterna um mês entre Realizado e Previsão (clique no cabeçalho do mês).
  const alternarTipoMes = async (c) => {
    const mes = colParaMes(c);
    if (!mes) return;
    const novo = c.tipo === 'realizado' ? 'previsao' : 'realizado';
    setTipoOverrides((p) => ({ ...p, [mes]: novo }));
    try {
      await fetch(`${API_BASE_URL}/api/forecast-dre/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, tipo: novo }),
      });
    } catch {
      /* falha ao salvar: fica só na sessão */
    }
  };

  useEffect(() => {
    let cancelado = false;
    const alvos = mesesAutomaticos(colunas);
    if (alvos.length === 0) return undefined;
    setCarregandoAuto(true);
    (async () => {
      const resultados = await Promise.all(
        alvos.map(async ({ col, mes }) => {
          // Receita por canal + CREDEV, e em paralelo a folha (Pessoal Fixo)
          const [recOk, pf] = await Promise.all([
            (async () => {
              try {
                const r = await fetch(
                  `${API_BASE_URL}/api/forecast-dre/receita-canais?mes=${mes}`,
                );
                if (!r.ok) return null;
                const j = await r.json();
                const d = j?.data || j;
                return d && typeof d.varejo === 'number' ? d : null;
              } catch {
                return null;
              }
            })(),
            (async () => {
              try {
                const r = await fetch(
                  `${API_BASE_URL}/api/forecast-dre/pessoal-fixo?mes=${mes}`,
                );
                if (!r.ok) return null;
                const j = await r.json();
                const d = j?.data || j;
                return d && typeof d.pessoal_fixo === 'number' ? d : null;
              } catch {
                return null;
              }
            })(),
          ]);
          if (!recOk && !pf) return null;
          return [col, recOk, pf];
        }),
      );
      if (cancelado) return;
      const novo = {};
      const novoCredevCanais = {};
      const novoRubricas = {};
      const novoPfFixo = {};
      const novoPfVar = {};
      const novoProlabore = {};
      const novoPjLinha = {};
      const novoPjNomes = {};
      const novoOcupLinha = {};
      const novoOcupFiliais = {};
      for (const item of resultados) {
        if (!item) continue;
        const [col, d, pf] = item;
        novo[col] = {};
        if (d) {
          for (const [linha, chave] of Object.entries(CANAL_POR_LINHA)) {
            if (typeof d[chave] === 'number') novo[col][linha] = d[chave];
          }
          // CREDEV vem do Contas a Receber (já negativo).
          if (typeof d.credev === 'number') novo[col].CREDEV = d.credev;
          // CREDEV por canal (só visualização)
          if (d.credev_canais && typeof d.credev_canais === 'object') {
            novoCredevCanais[col] = d.credev_canais;
          }
        }
        // Pessoal Fixo (fixos + pró-labore) e Pessoal Variável (comissão).
        if (pf && typeof pf.pessoal_fixo === 'number') {
          novoPfFixo[col] = pf.proventos_fixo || 0;
          novoPfVar[col] = pf.proventos_variavel || 0;
          novoProlabore[col] = typeof pf.prolabore === 'number' ? pf.prolabore : 80000;
          if (Array.isArray(pf.rubricas)) {
            // pró-labore é tratado à parte (editável); e tira o que não entra na DRE
            novoRubricas[col] = pf.rubricas.filter(
              (r) => !r.editavel && r.entra !== false,
            );
          }
          // Despesa de PJ (linha separada): total e nomes dos contratados
          if (typeof pf.pj_total === 'number') novoPjLinha[col] = pf.pj_total;
          if (Array.isArray(pf.pj_nomes)) novoPjNomes[col] = pf.pj_nomes;
          // Despesa de OCUPAÇÃO (aluguel): total e por filial
          if (typeof pf.ocupacao_total === 'number') novoOcupLinha[col] = pf.ocupacao_total;
          if (Array.isArray(pf.ocupacao_filiais)) novoOcupFiliais[col] = pf.ocupacao_filiais;
        }
      }
      setOverrides(novo);
      setCredevCanais(novoCredevCanais);
      setRubricasFolha(novoRubricas);
      setPfFixo(novoPfFixo);
      setPfVariavel(novoPfVar);
      setProlabore(novoProlabore);
      setPjLinha(novoPjLinha);
      setPjNomes(novoPjNomes);
      setOcupLinha(novoOcupLinha);
      setOcupFiliais(novoOcupFiliais);
      setCarregandoAuto(false);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunas]);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <PageTitle
        title="Forecast"
        subtitle="DRE projetada de 2026 — Realizado (jan–set) e Previsão (out–dez)"
        icon={ChartLineUp}
        iconColor="text-[#000638]"
      />

      <div
        className={
          telaCheia
            ? 'fixed inset-0 z-50 bg-white flex flex-col overflow-hidden'
            : 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'
        }
      >
        {/* Barra de topo: cenário + legenda + tela cheia */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-gray-500">Cenário</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {base.cenario}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              Clique no mês para Realizado / Previsão · clique na seção para expandir
            </span>
            {carregandoAuto && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Atualizando do New Forecast…
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#000638]" /> Realizado
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Previsão
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> New Forecast
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTelaCheia((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {telaCheia ? <CornersIn size={14} /> : <CornersOut size={14} />}
              {telaCheia ? 'Sair' : 'Tela cheia'}
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div
          className={
            telaCheia
              ? 'overflow-auto flex-1 min-h-0'
              : 'overflow-auto max-h-[calc(100vh-250px)]'
          }
        >
          <table className="min-w-full text-[11px] border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-200 px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600 min-w-[240px]">
                  DRE Forecast
                </th>
                {grupos.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.qtd}
                    className={
                      'border-b border-l border-white/20 px-2 py-1.5 text-center text-[11px] font-bold uppercase ' +
                      TIPO_CABECALHO[g.tipo]
                    }
                  >
                    {TIPO_ROTULO[g.tipo]}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-200 px-3 py-1.5 text-left text-[10px] text-gray-400 font-normal">
                  em R$
                </th>
                {colunas.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => alternarTipoMes(c)}
                    title="Clique para alternar entre Realizado e Previsão"
                    className={
                      'border-b border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-600 whitespace-nowrap bg-gray-100 cursor-pointer select-none hover:bg-blue-100 hover:text-[#000638] ' +
                      TIPO_CELULA[c.tipo]
                    }
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, idx) => {
                const info = estrutura[idx];
                // Esconde filhos de uma seção recolhida
                if (info.paiId && recolhidos.has(info.paiId)) return null;
                const tipo = tipoLinha(l);
                const forte = tipo === 'forte';
                const pct = tipo === 'pct';
                const sub = tipo === 'sub';
                const ehPai = info.isPai;
                const recolhido = recolhidos.has(l.id);
                const secao = INICIO_SECAO.has(l.label);
                const zebra = sub && idx % 2 === 1;
                const trBg = forte
                  ? 'bg-[#000638]/[0.04]'
                  : zebra
                    ? 'bg-gray-50/50'
                    : 'hover:bg-blue-50/40';
                const bordaTopo = secao ? 'border-t-2 border-[#000638]/15' : '';
                const labelCls = forte
                  ? 'font-bold text-[#000638]'
                  : pct
                    ? 'pl-8 text-gray-400 italic font-normal text-[10px]'
                    : sub
                      ? 'pl-8 text-gray-500 font-normal'
                      : 'font-semibold text-gray-700';
                const labelBg = forte ? 'bg-[#eef0f6]' : zebra ? 'bg-gray-50' : 'bg-white';
                // Linha de canal que abre pra mostrar o CREDEV do canal (só visual)
                const canalKey = CREDEV_CANAL_POR_LINHA[l.label];
                const temCredevCanal =
                  canalKey &&
                  Object.values(credevCanais).some(
                    (cc) => cc && typeof cc[canalKey] === 'number' && cc[canalKey] !== 0,
                  );
                const canalAberto = temCredevCanal && canaisAbertos.has(l.label);
                // Linhas da folha (Pessoal Fixo / Variável) abrem as rubricas
                const grupoFolha =
                  l.label === 'PESSOAL FIXO'
                    ? 'fixo'
                    : l.label === 'PESSOAL VARIÁVEL'
                      ? 'variavel'
                      : null;
                const rubsDaLinha = grupoFolha
                  ? rubricasUnidas.filter((r) => r.grupo === grupoFolha)
                  : [];
                const ehFolha = grupoFolha !== null && rubsDaLinha.length > 0;
                const folhaAberta = ehFolha && folhasAbertas.has(l.label);
                // Linha PJ: abre por nome dos contratados (um nível)
                const ehPJ = l.label === 'PJ' && Object.keys(pjLinha).length > 0;
                const pjAbertoLinha = ehPJ && pjAberto;
                // Linha OCUPAÇÃO: abre por filial (um nível)
                const ehOcup = l.label === 'OCUPAÇÃO' && Object.keys(ocupLinha).length > 0;
                const ocupAbertoLinha = ehOcup && ocupAberto;
                // Linha SERVIÇOS DE TERCEIROS FIXOS: abre por despesa → lançamentos
                const ehServTerc =
                  l.label === 'SERVIÇOS DE TERCEIROS FIXOS' && Object.keys(servTerc).length > 0;
                const servAbertoLinha = ehServTerc && servAberto;
                const clicavel =
                  ehPai || temCredevCanal || ehFolha || ehPJ || ehOcup || ehServTerc;
                const onClickLabel = ehPai
                  ? () => toggleRecolher(l.id)
                  : temCredevCanal
                    ? () => toggleCanal(l.label)
                    : ehFolha
                      ? () => toggleFolha(l.label)
                      : ehPJ
                        ? () => setPjAberto((v) => !v)
                        : ehOcup
                          ? () => setOcupAberto((v) => !v)
                          : ehServTerc
                            ? () => setServAberto((v) => !v)
                            : undefined;
                return (
                  <React.Fragment key={l.id}>
                  <tr className={trBg}>
                    <td
                      onClick={onClickLabel}
                      className={
                        'sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-2 whitespace-nowrap ' +
                        bordaTopo + ' ' + labelBg + ' ' + labelCls +
                        (clicavel ? ' cursor-pointer hover:text-blue-700' : '')
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {ehPai ? (
                          recolhido ? (
                            <CaretRight size={11} weight="bold" className="text-gray-400 shrink-0" />
                          ) : (
                            <CaretDown size={11} weight="bold" className="text-gray-400 shrink-0" />
                          )
                        ) : temCredevCanal || ehFolha || ehPJ || ehOcup || ehServTerc ? (
                          (ehFolha
                            ? folhaAberta
                            : ehPJ
                              ? pjAbertoLinha
                              : ehOcup
                                ? ocupAbertoLinha
                                : ehServTerc
                                  ? servAbertoLinha
                                  : canalAberto) ? (
                            <CaretDown size={10} weight="bold" className="text-gray-300 shrink-0" />
                          ) : (
                            <CaretRight size={10} weight="bold" className="text-gray-300 shrink-0" />
                          )
                        ) : null}
                        {l.label}
                      </span>
                    </td>
                    {colunas.map((c) => {
                      // Pessoal Fixo = fixos + pró-labore; Variável = comissão
                      let pfLine;
                      if (l.label === 'PESSOAL FIXO' && pfFixo[c.key] !== undefined) {
                        pfLine =
                          -Math.round(
                            ((pfFixo[c.key] || 0) + (prolabore[c.key] || 0)) * 100,
                          ) / 100;
                      } else if (
                        l.label === 'PESSOAL VARIÁVEL' &&
                        pfVariavel[c.key] !== undefined
                      ) {
                        pfLine = -Math.round((pfVariavel[c.key] || 0) * 100) / 100;
                      } else if (l.label === 'PJ' && pjLinha[c.key] !== undefined) {
                        pfLine = pjLinha[c.key];
                      } else if (
                        l.label === 'OCUPAÇÃO' &&
                        ocupLinha[c.key] !== undefined
                      ) {
                        pfLine = ocupLinha[c.key];
                      } else if (
                        l.label === 'SERVIÇOS DE TERCEIROS FIXOS' &&
                        servTerc[c.key] !== undefined
                      ) {
                        pfLine = -Math.round((servTerc[c.key].total || 0) * 100) / 100;
                      }
                      const ovr = overrides[c.key]?.[l.label];
                      const calc = totaisCalculados[c.key]?.[l.label];
                      const auto = pfLine !== undefined || ovr !== undefined;
                      const v =
                        pfLine !== undefined
                          ? pfLine
                          : calc !== undefined
                            ? calc
                            : ovr !== undefined
                              ? ovr
                              : l.valores[c.key];
                      const negativo = typeof v === 'number' && v < 0;
                      const corTexto = negativo
                        ? 'text-red-600'
                        : v == null
                          ? 'text-gray-300'
                          : auto
                            ? 'text-emerald-700'
                            : forte
                              ? 'text-[#000638]'
                              : pct
                                ? 'text-gray-400 italic'
                                : sub
                                  ? 'text-gray-600'
                                  : 'text-gray-800';
                      return (
                        <td
                          key={c.key}
                          title={
                            calc !== undefined
                              ? l.label === 'RECEITA BRUTA'
                                ? 'Calculado: soma dos canais + CREDEV'
                                : 'Calculado: soma dos canais de venda'
                              : auto
                                ? 'Puxado do New Forecast'
                                : undefined
                          }
                          className={
                            'border-b border-gray-100 px-3 py-2 text-right tabular-nums whitespace-nowrap ' +
                            bordaTopo + ' ' +
                            (auto ? 'bg-emerald-50 font-semibold ' : TIPO_CELULA[c.tipo] + ' ') +
                            (forte && !auto ? 'font-bold ' : '') +
                            (pct ? 'text-[10px] ' : '') +
                            corTexto
                          }
                        >
                          {formatar(v, l.fmt)}
                        </td>
                      );
                    })}
                  </tr>
                  {canalAberto && (
                    <tr className="bg-red-50/40">
                      <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1.5 whitespace-nowrap bg-red-50/60 text-[10px] font-semibold text-red-700">
                        ↳ CREDEV {l.label}
                      </td>
                      {colunas.map((c) => {
                        const cv = credevCanais[c.key]?.[canalKey];
                        return (
                          <td
                            key={c.key}
                            title="CREDEV do canal (apenas visualização, não entra no cálculo)"
                            className="border-b border-gray-100 px-3 py-1.5 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-red-50/40"
                          >
                            {typeof cv === 'number' && cv !== 0 ? formatar(cv, 'moeda') : '–'}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {pjAbertoLinha &&
                    (() => {
                      // União dos nomes dos contratados (por coluna realizada)
                      const nomesSet = new Map();
                      for (const [col, lista] of Object.entries(pjNomes)) {
                        for (const it of lista || []) {
                          const e =
                            nomesSet.get(it.nome) || { nome: it.nome, porCol: {}, max: 0 };
                          e.porCol[col] = -(Number(it.valor) || 0); // despesa (negativo)
                          e.max = Math.max(e.max, Math.abs(Number(it.valor) || 0));
                          nomesSet.set(it.nome, e);
                        }
                      }
                      const linhasPj = [...nomesSet.values()].sort((a, b) => b.max - a.max);
                      return linhasPj.map((p) => (
                        <tr key={'pj-' + p.nome} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {p.nome}
                            </span>
                          </td>
                          {colunas.map((c) => {
                            const pv = p.porCol[c.key];
                            return (
                              <td
                                key={c.key}
                                className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                              >
                                {typeof pv === 'number' && pv !== 0 ? formatar(pv, 'moeda') : '–'}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  {ocupAbertoLinha &&
                    (() => {
                      // União das filiais (por coluna realizada)
                      const filSet = new Map();
                      for (const [col, lista] of Object.entries(ocupFiliais)) {
                        for (const it of lista || []) {
                          const e =
                            filSet.get(it.nome) || { nome: it.nome, porCol: {}, max: 0 };
                          e.porCol[col] = -(Number(it.valor) || 0); // despesa (negativo)
                          e.max = Math.max(e.max, Math.abs(Number(it.valor) || 0));
                          filSet.set(it.nome, e);
                        }
                      }
                      const linhasOc = [...filSet.values()].sort((a, b) => b.max - a.max);
                      return linhasOc.map((p) => (
                        <tr key={'ocup-' + p.nome} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {p.nome}
                            </span>
                          </td>
                          {colunas.map((c) => {
                            const pv = p.porCol[c.key];
                            return (
                              <td
                                key={c.key}
                                className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                              >
                                {typeof pv === 'number' && pv !== 0 ? formatar(pv, 'moeda') : '–'}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  {servAbertoLinha &&
                    (() => {
                      // Despesas (categorias) da DRE Analítica, por coluna
                      const catMap = new Map();
                      for (const [col, d] of Object.entries(servTerc)) {
                        for (const cg of d.categorias || []) {
                          const e =
                            catMap.get(cg.cat) ||
                            { cat: cg.cat, porCol: {}, lancPorCol: {}, max: 0 };
                          e.porCol[col] = -(Number(cg.valor) || 0);
                          e.lancPorCol[col] = cg.lancamentos || [];
                          e.max = Math.max(e.max, Math.abs(Number(cg.valor) || 0));
                          catMap.set(cg.cat, e);
                        }
                      }
                      const cats = [...catMap.values()].sort((a, b) => b.max - a.max);
                      return cats.map((cg) => {
                        const catAberta = servCatsAbertas.has(cg.cat);
                        // lançamentos unidos por fornecedor+venc+valor
                        let lancs = [];
                        if (catAberta) {
                          const lm = new Map();
                          for (const [col, lista] of Object.entries(cg.lancPorCol)) {
                            for (const x of lista || []) {
                              const k = `${x.forn}|${x.venc}|${x.val}`;
                              const e = lm.get(k) || { forn: x.forn, venc: x.venc, porCol: {}, max: 0 };
                              e.porCol[col] = -(Number(x.val) || 0);
                              e.max = Math.max(e.max, Math.abs(Number(x.val) || 0));
                              lm.set(k, e);
                            }
                          }
                          lancs = [...lm.values()].sort((a, b) => b.max - a.max);
                        }
                        return (
                          <React.Fragment key={'serv-' + cg.cat}>
                            <tr className="bg-slate-50/50">
                              <td
                                onClick={() => toggleServCat(cg.cat)}
                                className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600 cursor-pointer hover:underline"
                              >
                                <span className="inline-flex items-center gap-1">
                                  {catAberta ? (
                                    <CaretDown size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  ) : (
                                    <CaretRight size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  )}
                                  {cg.cat}
                                </span>
                              </td>
                              {colunas.map((c) => {
                                const pv = cg.porCol[c.key];
                                return (
                                  <td
                                    key={c.key}
                                    className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                                  >
                                    {typeof pv === 'number' && pv !== 0 ? formatar(pv, 'moeda') : '–'}
                                  </td>
                                );
                              })}
                            </tr>
                            {catAberta &&
                              lancs.map((x, i) => (
                                <tr key={'serv-' + cg.cat + '-' + i} className="bg-white">
                                  <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-0.5 whitespace-nowrap bg-white text-[10px] text-gray-500">
                                    {x.forn}
                                    {x.venc ? (
                                      <span className="text-gray-400"> · venc {x.venc}</span>
                                    ) : null}
                                  </td>
                                  {colunas.map((c) => {
                                    const pv = x.porCol[c.key];
                                    return (
                                      <td
                                        key={c.key}
                                        className="border-b border-gray-100 px-3 py-0.5 text-right tabular-nums whitespace-nowrap text-[10px] text-gray-500"
                                      >
                                        {typeof pv === 'number' && pv !== 0 ? formatar(pv, 'moeda') : '–'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      });
                    })()}
                  {ehFolha && folhaAberta && l.label === 'PESSOAL FIXO' && (
                    <tr className="bg-slate-50/50">
                      <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-emerald-700">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          PRÓ-LABORE (DIRETORES)
                        </span>
                      </td>
                      {colunas.map((c) => {
                        const temFolha = pfFixo[c.key] !== undefined;
                        const editando = editandoProl === c.key;
                        const val = prolabore[c.key] ?? 80000;
                        return (
                          <td
                            key={c.key}
                            onClick={() => temFolha && !editando && setEditandoProl(c.key)}
                            title={temFolha ? 'Clique para editar o pró-labore' : undefined}
                            className={
                              'border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] bg-slate-50/40 text-emerald-700 ' +
                              (temFolha && !editando ? 'cursor-pointer hover:underline' : '')
                            }
                          >
                            {temFolha ? (
                              editando ? (
                                <input
                                  type="number"
                                  autoFocus
                                  defaultValue={val}
                                  onBlur={(e) => {
                                    const n = Math.max(0, Number(e.target.value) || 0);
                                    if (n !== val) salvarProlabore(c.key, colParaMes(c), n);
                                    setEditandoProl(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') setEditandoProl(null);
                                  }}
                                  className="w-20 text-right text-[10px] text-emerald-800 bg-white border border-emerald-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                              ) : (
                                formatar(val, 'moeda')
                              )
                            ) : (
                              <span className="text-gray-300">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {ehFolha &&
                    folhaAberta &&
                    rubsDaLinha.map((ru) => {
                      const prov = ru.tipo === 'provento';
                      const corVal = prov ? 'text-emerald-700' : 'text-red-600';
                      const dot = prov ? 'bg-emerald-500' : 'bg-red-500';
                      const temFunc = Object.keys(ru.funcPorCol).length > 0;
                      const rubAberta = temFunc && rubricasAbertas.has(ru.key);
                      // Agrupa por EMPRESA e, dentro, por funcionário (3 níveis)
                      let empresas = [];
                      if (rubAberta) {
                        const em = new Map();
                        for (const [col, lista] of Object.entries(ru.funcPorCol)) {
                          for (const f of lista || []) {
                            const emp = f.loja || '— sem seção —';
                            const e =
                              em.get(emp) ||
                              { empresa: emp, porCol: {}, max: 0, funcs: new Map() };
                            e.porCol[col] = (e.porCol[col] || 0) + (Number(f.valor) || 0);
                            e.max = Math.max(e.max, Math.abs(e.porCol[col]));
                            const fk = (f.chapa || '') + '|' + f.nome;
                            const fe =
                              e.funcs.get(fk) ||
                              { nome: f.nome, chapa: f.chapa, funcao: f.funcao, porCol: {}, max: 0 };
                            fe.porCol[col] = f.valor;
                            fe.max = Math.max(fe.max, Math.abs(Number(f.valor) || 0));
                            e.funcs.set(fk, fe);
                            em.set(emp, e);
                          }
                        }
                        empresas = [...em.values()]
                          .map((e) => ({
                            ...e,
                            funcs: [...e.funcs.values()].sort((a, b) => b.max - a.max),
                          }))
                          .sort((a, b) => b.max - a.max);
                      }
                      return (
                        <React.Fragment key={'rub-' + ru.key}>
                          <tr className="bg-slate-50/50">
                            <td
                              onClick={temFunc ? () => toggleRubrica(ru.key) : undefined}
                              className={
                                'sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] ' +
                                corVal +
                                (temFunc ? ' cursor-pointer hover:underline' : '')
                              }
                            >
                              <span className="inline-flex items-center gap-1">
                                {temFunc ? (
                                  rubAberta ? (
                                    <CaretDown size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  ) : (
                                    <CaretRight size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  )
                                ) : (
                                  <span className={'w-1.5 h-1.5 rounded-full ' + dot} />
                                )}
                                {ru.desc}
                              </span>
                            </td>
                            {colunas.map((c) => {
                              const rv = ru.porCol[c.key];
                              return (
                                <td
                                  key={c.key}
                                  className={
                                    'border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] bg-slate-50/40 ' +
                                    corVal
                                  }
                                >
                                  {typeof rv === 'number' && rv !== 0 ? formatar(rv, 'moeda') : '–'}
                                </td>
                              );
                            })}
                          </tr>
                          {rubAberta &&
                            empresas.map((emp, ei) => {
                              const empKey = ru.key + '|' + emp.empresa;
                              const empAberta = empresasAbertas.has(empKey);
                              return (
                                <React.Fragment key={'e-' + empKey}>
                                  <tr className="bg-white">
                                    <td
                                      onClick={() => toggleEmpresa(empKey)}
                                      className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-0.5 whitespace-nowrap bg-white text-[10px] text-gray-600 cursor-pointer hover:underline"
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        {empAberta ? (
                                          <CaretDown size={9} weight="bold" className="text-gray-300 shrink-0" />
                                        ) : (
                                          <CaretRight size={9} weight="bold" className="text-gray-300 shrink-0" />
                                        )}
                                        {emp.empresa}
                                        <span className="text-gray-300"> · {emp.funcs.length} func.</span>
                                      </span>
                                    </td>
                                    {colunas.map((c) => {
                                      const ev = emp.porCol[c.key];
                                      return (
                                        <td
                                          key={c.key}
                                          className={
                                            'border-b border-gray-100 px-3 py-0.5 text-right tabular-nums whitespace-nowrap text-[10px] ' +
                                            corVal
                                          }
                                        >
                                          {typeof ev === 'number' && ev !== 0 ? formatar(ev, 'moeda') : '–'}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {empAberta &&
                                    emp.funcs.map((f, fi) => (
                                      <tr key={'f-' + empKey + '-' + fi} className="bg-gray-50/40">
                                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-28 pr-3 py-0.5 whitespace-nowrap bg-gray-50 text-[9px] text-gray-500">
                                          {f.nome}
                                          {f.funcao ? (
                                            <span className="text-gray-400"> · {f.funcao}</span>
                                          ) : null}
                                        </td>
                                        {colunas.map((c) => {
                                          const fv = f.porCol[c.key];
                                          return (
                                            <td
                                              key={c.key}
                                              className={
                                                'border-b border-gray-100 px-3 py-0.5 text-right tabular-nums whitespace-nowrap text-[9px] ' +
                                                corVal
                                              }
                                            >
                                              {typeof fv === 'number' && fv !== 0 ? formatar(fv, 'moeda') : '–'}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                </React.Fragment>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 px-1 mt-3">
        Base: {base.origem}. A partir de setembro/2026 (células em verde): a receita bruta por
        canal vem do New Forecast (showroom separado por cliente) e o CREDEV vem do Contas a
        Receber (faturas CREDEV das filiais, por emissão do mês). Jan–ago e os totais seguem
        com os números da planilha.
      </p>
    </div>
  );
}
