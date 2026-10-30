// Forecast — menu abaixo do DRE (Niziany, 27/10/2026).
// DRE projetada de 2026 a partir da planilha base "FORECAST PESSIMISTA /
// Conservador": Realizado (jan–set) + Previsão (out–dez), mês a mês.
// Layout no padrão das demais páginas do HeadCoach (azul #000638, cabeçalho
// cinza, cards com borda). Os valores vêm de src/data/forecastBase.json; as
// visões e blocos extras seguem no JSON caso precise voltar.
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ChartLineUp, CaretRight, CaretDown, CornersOut, CornersIn } from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
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
  'RECEITA (DESPESA) NÃO OPERACIONAL',
  'INVESTIMENTOS',
]);

const tipoLinha = (l) => {
  if (l.fmt === 'pct') return 'pct';
  if (TOTAIS_FORTES.has(l.label)) return 'forte';
  if (l.nivel === 1) return 'sub';
  if (l.nivel === 2) return 'sub2'; // item de subgrupo (3º nível)
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
  // CMV % editável por mês (Niziany 30/10): fração negativa (ex.: -0.335).
  // Sem override usa o % da planilha (linha CMV %). Ao editar, CMV = % × ROL.
  const [cmvPct, setCmvPct] = useState({}); // { [colKey]: pct }
  const [editandoCmv, setEditandoCmv] = useState(null); // col sendo editada
  const salvarCmvPct = (col, mes, pct) => {
    setCmvPct((p) => ({ ...p, [col]: pct }));
    fetch(`${API_BASE_URL}/api/forecast-dre/cmv-pct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, pct }),
    }).catch(() => {});
  };
  // Qual MÊS (coluna) está aberto em cada linha de despesa expansível
  // (Pessoal Fixo/Variável, PJ, Ocupação, Serviços de Terceiros Fixos).
  // Clica na célula do mês → abre só aquele mês. { [label]: colKey | null }
  const [mesAberto, setMesAberto] = useState({});
  const abrirMes = (label, col) =>
    setMesAberto((p) => ({ ...p, [label]: p[label] === col ? null : col }));
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
  // Despesa de OCUPAÇÃO (linha OCUPAÇÃO): total por coluna e por filial
  const [ocupLinha, setOcupLinha] = useState({}); // { [colKey]: total (negativo) }
  const [ocupFiliais, setOcupFiliais] = useState({}); // { [colKey]: [{nome, valor}] }
  // Despesa de MARKETING (Propaganda e Anúncios do Contas a Pagar)
  const [mktLinha, setMktLinha] = useState({}); // { [colKey]: total (negativo) } — PROPAGANDA E ANÚNCIO
  const [mktLanc, setMktLanc] = useState({}); // { [colKey]: [{forn, venc, valor}] }
  // Subitem TRÁFEGO do Marketing (Forecast de Mídia do Dryland)
  const [trafegoLinha, setTrafegoLinha] = useState({}); // { [colKey]: total (negativo) }
  const [trafegoItens, setTrafegoItens] = useState({}); // { [colKey]: [{canal, nome, valor}] }
  // PERDAS COM INADIMPLÊNCIA (Dashboard Inadimplência, mês específico)
  const [perdasLinha, setPerdasLinha] = useState({}); // { [colKey]: total (negativo) }
  const [perdasCanais, setPerdasCanais] = useState({}); // { [colKey]: [{nome, valor, titulos, clientes}] }
  // Importação da planilha de taxas de cartão (Niziany 30/10): por coluna,
  // { total, empresas:[{empresa, valor}] } — antecipação e taxa de cartão.
  const [impAntecip, setImpAntecip] = useState({});
  const [impCartao, setImpCartao] = useState({});
  const [importando, setImportando] = useState(false);
  const fileRef = useRef(null);
  // SERVIÇOS DE TERCEIROS FIXOS: lido do localStorage da DRE Analítica
  // (despesas-gerais-2026:v2). Mesmos números que a Niziany vê lá, com as
  // bonificações importadas manualmente — não dá pra reproduzir pelo backend.
  const [dreLocal, setDreLocal] = useState(null);
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
  // Agora com 3 níveis (Niziany 30/10): seção (0) → subgrupo (1) → item (2).
  // Recolher a seção esconde subgrupos e itens; recolher o subgrupo esconde
  // só os itens dele (paiId = quem abre/fecha direto, avoId = a seção).
  const estrutura = useMemo(() => {
    const info = linhas.map(() => ({ isPai: false, paiId: null, avoId: null }));
    let ultimoPai = null; // seção (nível 0)
    let ultimoSub = null; // subgrupo (nível 1)
    linhas.forEach((l, i) => {
      if (l.fmt === 'pct') return;
      if (l.nivel === 1) {
        if (ultimoPai != null) {
          info[i].paiId = linhas[ultimoPai].id;
          info[ultimoPai].isPai = true;
        }
        ultimoSub = i;
      } else if (l.nivel === 2) {
        if (ultimoSub != null) {
          info[i].paiId = linhas[ultimoSub].id;
          info[ultimoSub].isPai = true;
          info[i].avoId = ultimoPai != null ? linhas[ultimoPai].id : null;
        } else if (ultimoPai != null) {
          info[i].paiId = linhas[ultimoPai].id;
          info[ultimoPai].isPai = true;
        }
      } else {
        ultimoPai = i;
        ultimoSub = null;
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

  // CMV % salvo no backend por mês → coluna
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/forecast-dre/cmv-pct`);
        if (!r.ok) return;
        const j = await r.json();
        const ov = (j && j.data && j.data.overrides) || {};
        if (cancelado) return;
        const novo = {};
        for (const c of colunas) {
          const mes = colParaMes(c);
          if (mes && typeof ov[mes] === 'number') novo[c.key] = ov[mes];
        }
        setCmvPct(novo);
      } catch {
        /* fica com o % da planilha */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [colunas]);

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
      // Só set/2026 em diante — jan–ago ficam com o número da planilha.
      if (c.ano !== 2026 || (MES_ABREV[mk] || 0) < 9) continue;
      const mes = dreLocal.months[mk];
      if (!mes || !mes.details) continue;
      const categorias = [];
      let total = 0;
      for (const [cat, rows] of Object.entries(mes.details)) {
        const n = norm(cat);
        if (n === 'SERVICOS PRESTADOS POR TERCEIROS') continue; // já está no PJ
        if (/BONIFIC.*MARKETING/.test(n)) continue; // bonificação marketing fora
        if (/FRETE/.test(n)) continue; // frete fora (Niziany 29/10)
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

  // BONIFICAÇÕES MARKETING (subitem do Marketing, Niziany 30/10): vem da DRE
  // Analítica (localStorage) — as categorias /BONIFIC.*MARKETING/, que ficam
  // FORA dos Serviços de Terceiros Fixos. Só set/2026 em diante.
  const bonifMkt = useMemo(() => {
    const out = {};
    if (!dreLocal || !dreLocal.months) return out;
    for (const c of colunas) {
      if (c.grupo !== 'mensal' || c.tipo !== 'realizado') continue;
      const mk = String(c.label || '').slice(0, 3).toLowerCase();
      if (c.ano !== 2026 || (MES_ABREV[mk] || 0) < 9) continue;
      const mes = dreLocal.months[mk];
      if (!mes || !mes.details) continue;
      const lanc = [];
      for (const [cat, rows] of Object.entries(mes.details)) {
        const n = String(cat || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        if (!/BONIFIC.*MARKETING/.test(n)) continue;
        for (const r of rows || []) {
          lanc.push({ forn: r.forn || '—', venc: r.venc || '', valor: Number(r.val) || 0 });
        }
      }
      if (!lanc.length) continue;
      lanc.sort((a, b) => b.valor - a.valor);
      out[c.key] = { total: Math.round(lanc.reduce((a, x) => a + x.valor, 0) * 100) / 100, lanc };
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

  // Valor da planilha (estático) de uma linha numa coluna — usado pra recompor
  // os pais quando um filho é sobrescrito pela importação.
  const estatico = (label, col) => {
    const r = linhas.find((x) => x.label === label);
    return Number(r?.valores?.[col]) || 0;
  };

  // ── Importar planilha de taxas de cartão (Niziany 30/10) ──────────────────
  // Arquivo mensal "PAINEL DRE — TAXAS DE CARTÃO": o mês vem do título da aba
  // "Painel DRE"; a aba "Painel por Empresa" traz, por empresa (linhas
  // "► TOTAL …"), TAXA DE CARTÃO e TAXA DE ANTECIPAÇÃO. Só manda os totais por
  // empresa pro backend; reimportar o mesmo mês substitui a importação anterior.
  const MESES_PT = {
    janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  const lerNumero = (v) => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    const t = String(v).trim();
    const n = Number(/^-?[\d.]+,\d+$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
    return Number.isFinite(n) ? n : 0;
  };
  const fmtBRL2 = (v) =>
    (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const importarPlanilha = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      setImportando(true);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const abaEmp = wb.Sheets['Painel por Empresa'];
      if (!abaEmp) throw new Error('Não achei a aba "Painel por Empresa" nessa planilha.');
      let mes = null;
      const abaDre = wb.Sheets['Painel DRE'];
      if (abaDre) {
        const m1 = XLSX.utils.sheet_to_json(abaDre, { header: 1, blankrows: false, defval: '' });
        const titulo = String((m1[0] && m1[0][0]) || '');
        const m = titulo.match(/([A-Za-zÇç]+)\s*\/\s*(\d{4})\s*$/);
        const num = m && MESES_PT[m[1].toLowerCase()];
        if (num) mes = `${m[2]}-${String(num).padStart(2, '0')}`;
      }
      if (!mes) {
        const dig = window.prompt('Não achei o mês no título da planilha. Informe o mês (AAAA-MM):', '');
        if (!dig || !/^\d{4}-\d{2}$/.test(dig.trim())) throw new Error('Mês não informado.');
        mes = dig.trim();
      }
      const mat = XLSX.utils.sheet_to_json(abaEmp, { header: 1, blankrows: false, defval: '' });
      const up = (v) => String(v || '').trim().toUpperCase();
      const hi = mat.findIndex((r) => r.some((c) => up(c) === 'EMPRESA'));
      if (hi < 0) throw new Error('Não achei o cabeçalho EMPRESA na aba "Painel por Empresa".');
      const hdr = mat[hi].map(up);
      const iE = hdr.indexOf('EMPRESA');
      const iA = hdr.indexOf('ADQUIRENTE');
      const iC = hdr.indexOf('TAXA DE CARTÃO');
      const iT = hdr.indexOf('TAXA DE ANTECIPAÇÃO');
      if (iE < 0 || iC < 0 || iT < 0) {
        throw new Error('Cabeçalho sem EMPRESA / TAXA DE CARTÃO / TAXA DE ANTECIPAÇÃO.');
      }
      const emp = [];
      for (const r of mat.slice(hi + 1)) {
        const e = String(r[iE] || '').trim();
        if (!e || up(e).startsWith('TOTAL')) continue;
        const a = iA >= 0 ? String(r[iA] || '').trim() : '';
        if (a && !a.startsWith('►') && !up(a).startsWith('TOTAL')) continue;
        emp.push({ empresa: e, cartao: lerNumero(r[iC]), antecip: lerNumero(r[iT]) });
      }
      if (!emp.length) throw new Error('Nenhuma empresa encontrada na aba "Painel por Empresa".');
      const totC = emp.reduce((a, x) => a + x.cartao, 0);
      const totA = emp.reduce((a, x) => a + x.antecip, 0);
      const ok = window.confirm(
        `Importar "${file.name}" para ${mes}?\n\n` +
          `Taxa de cartão → Serviços de Terceiros Variáveis: R$ ${fmtBRL2(totC)}\n` +
          `Taxa de antecipação → Antecipação de recebíveis: R$ ${fmtBRL2(totA)}\n\n` +
          `Empresas: ${emp.map((x) => x.empresa).join(', ')}\n\n` +
          'Isso substitui uma importação anterior do mesmo mês.',
      );
      if (!ok) return;
      const resp = await fetch(`${API_BASE_URL}/api/forecast-dre/importacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes,
          arquivo: file.name,
          linhas: {
            taxa_antecipacao: emp.map((x) => ({ empresa: x.empresa, valor: x.antecip })),
            taxa_cartao: emp.map((x) => ({ empresa: x.empresa, valor: x.cartao })),
          },
        }),
      });
      if (!resp.ok) throw new Error(`Falha ao salvar (HTTP ${resp.status}).`);
      const r2 = await fetch(`${API_BASE_URL}/api/forecast-dre/importacao?mes=${mes}`);
      const j2 = await r2.json();
      const d2 = (j2 && j2.data) || j2 || {};
      const col = colunas.find((c) => colParaMes(c) === mes);
      if (col) {
        setImpAntecip((p) => ({ ...p, [col.key]: d2.taxa_antecipacao }));
        setImpCartao((p) => ({ ...p, [col.key]: d2.taxa_cartao }));
      }
      window.alert(
        `Importado ${mes}: taxa de cartão R$ ${fmtBRL2(totC)} e taxa de antecipação R$ ${fmtBRL2(totA)}.` +
          (col ? '' : ' O mês ainda não está marcado como realizado na tabela; aparece quando for.'),
      );
    } catch (e) {
      window.alert(`Não importei: ${e.message}`);
    } finally {
      setImportando(false);
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
          const [recOk, pf, imp] = await Promise.all([
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
            (async () => {
              try {
                const r = await fetch(
                  `${API_BASE_URL}/api/forecast-dre/importacao?mes=${mes}`,
                );
                if (!r.ok) return null;
                const j = await r.json();
                const d = j?.data || j;
                return d && (d.taxa_antecipacao || d.taxa_cartao) ? d : null;
              } catch {
                return null;
              }
            })(),
          ]);
          if (!recOk && !pf && !imp) return null;
          return [col, recOk, pf, imp];
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
      const novoMktLinha = {};
      const novoMktLanc = {};
      const novoTrafLinha = {};
      const novoTrafItens = {};
      const novoPerdasLinha = {};
      const novoPerdasCanais = {};
      const novoImpAntecip = {};
      const novoImpCartao = {};
      for (const item of resultados) {
        if (!item) continue;
        const [col, d, pf, imp] = item;
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
          // Despesa de MARKETING (propaganda): total e lançamentos
          if (typeof pf.marketing_total === 'number') novoMktLinha[col] = pf.marketing_total;
          if (Array.isArray(pf.marketing_lanc)) novoMktLanc[col] = pf.marketing_lanc;
          // Tráfego pago (Forecast de Mídia do Dryland)
          if (typeof pf.trafego_total === 'number') novoTrafLinha[col] = pf.trafego_total;
          if (Array.isArray(pf.trafego_itens)) novoTrafItens[col] = pf.trafego_itens;
          // Perdas com inadimplência (Dashboard Inadimplência)
          if (typeof pf.perdas_total === 'number') novoPerdasLinha[col] = pf.perdas_total;
          if (Array.isArray(pf.perdas_canais)) novoPerdasCanais[col] = pf.perdas_canais;
        }
        // Planilha de taxas importada (antecipação / taxa de cartão por empresa)
        if (imp) {
          if (imp.taxa_antecipacao?.empresas?.length) novoImpAntecip[col] = imp.taxa_antecipacao;
          if (imp.taxa_cartao?.empresas?.length) novoImpCartao[col] = imp.taxa_cartao;
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
      setMktLinha(novoMktLinha);
      setMktLanc(novoMktLanc);
      setTrafegoLinha(novoTrafLinha);
      setTrafegoItens(novoTrafItens);
      setPerdasLinha(novoPerdasLinha);
      setPerdasCanais(novoPerdasCanais);
      setImpAntecip(novoImpAntecip);
      setImpCartao(novoImpCartao);
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
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={importarPlanilha}
            />
            <button
              type="button"
              disabled={importando}
              onClick={() => fileRef.current && fileRef.current.click()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              title="Importar a planilha mensal de taxas de cartão (Painel DRE): preenche Antecipação de recebíveis e Taxa de cartão por empresa"
            >
              {importando ? 'Importando…' : 'Importar planilha'}
            </button>
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
                if (
                  (info.paiId && recolhidos.has(info.paiId)) ||
                  (info.avoId && recolhidos.has(info.avoId))
                )
                  return null;
                const tipo = tipoLinha(l);
                const forte = tipo === 'forte';
                const pct = tipo === 'pct';
                const sub = tipo === 'sub';
                const sub2 = tipo === 'sub2';
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
                    : sub2
                      ? 'pl-14 text-gray-500 font-normal text-[10px]'
                      : sub
                        ? ehPai
                          ? 'pl-8 text-gray-700 font-semibold'
                          : 'pl-8 text-gray-500 font-normal'
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
                // Todas as despesas expansíveis abrem por MÊS: clica na célula
                // do mês e abre só aquele mês (folha, PJ, Ocupação, Serviços).
                const ehPJ = l.label === 'PJ' && Object.keys(pjLinha).length > 0;
                const ehOcup = l.label === 'OCUPAÇÃO' && Object.keys(ocupLinha).length > 0;
                // Marketing agora é a soma de 3 subitens (nível 2); o drill de
                // lançamentos de propaganda fica no subitem PROPAGANDA E ANÚNCIO.
                const ehMkt = l.label === 'PROPAGANDA E ANÚNCIO' && Object.keys(mktLinha).length > 0;
                const ehTraf = l.label === 'TRÁFEGO' && Object.keys(trafegoLinha).length > 0;
                const ehBonif = l.label === 'BONIFICAÇÕES MARKETING' && Object.keys(bonifMkt).length > 0;
                const ehPerdas =
                  l.label === 'PERDAS COM INADIMPLÊNCIA' && Object.keys(perdasLinha).length > 0;
                const ehImpAnt =
                  l.label === 'ANTECIPAÇÃO DE RECEBÍVEIS' && Object.keys(impAntecip).length > 0;
                const ehImpCar = l.label === 'TAXA DE CARTÃO' && Object.keys(impCartao).length > 0;
                const ehServTerc =
                  l.label === 'SERVIÇOS DE TERCEIROS FIXOS' && Object.keys(servTerc).length > 0;
                // Coluna (mês) aberta nesta linha, se houver dado nela
                const temDadoMes = (col) =>
                  (ehFolha && (pfFixo[col] !== undefined || pfVariavel[col] !== undefined)) ||
                  (ehPJ && pjLinha[col] !== undefined) ||
                  (ehOcup && ocupLinha[col] !== undefined) ||
                  (ehMkt && mktLinha[col] !== undefined) ||
                  (ehTraf && trafegoLinha[col] !== undefined) ||
                  (ehBonif && bonifMkt[col] !== undefined) ||
                  (ehPerdas && perdasLinha[col] !== undefined) ||
                  (ehImpAnt && impAntecip[col] !== undefined) ||
                  (ehImpCar && impCartao[col] !== undefined) ||
                  (ehServTerc && servTerc[col] !== undefined);
                const colMesLinha =
                  mesAberto[l.label] && temDadoMes(mesAberto[l.label]) ? mesAberto[l.label] : null;
                const folhaAberta = ehFolha && !!colMesLinha;
                const pjAbertoLinha = ehPJ && !!colMesLinha;
                const ocupAbertoLinha = ehOcup && !!colMesLinha;
                const mktAbertoLinha = ehMkt && !!colMesLinha;
                const trafAbertoLinha = ehTraf && !!colMesLinha;
                const bonifAbertoLinha = ehBonif && !!colMesLinha;
                const perdasAbertoLinha = ehPerdas && !!colMesLinha;
                const impAntAberto = ehImpAnt && !!colMesLinha;
                const impCarAberto = ehImpCar && !!colMesLinha;
                const servAbertoLinha = ehServTerc && !!colMesLinha;
                const ehDespesaMes =
                  ehFolha || ehPJ || ehOcup || ehMkt || ehTraf || ehBonif || ehPerdas || ehImpAnt || ehImpCar || ehServTerc;
                // Só a label de seção (pai) e de canal (CREDEV) abrem pela label;
                // as despesas abrem clicando na célula do mês.
                const clicavel = ehPai || temCredevCanal;
                const onClickLabel = ehPai
                  ? () => toggleRecolher(l.id)
                  : temCredevCanal
                    ? () => toggleCanal(l.label)
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
                        ) : temCredevCanal ? (
                          canalAberto ? (
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
                        l.label === 'PROPAGANDA E ANÚNCIO' &&
                        mktLinha[c.key] !== undefined
                      ) {
                        pfLine = mktLinha[c.key];
                      } else if (l.label === 'TRÁFEGO' && trafegoLinha[c.key] !== undefined) {
                        pfLine = trafegoLinha[c.key];
                      } else if (
                        l.label === 'BONIFICAÇÕES MARKETING' &&
                        bonifMkt[c.key] !== undefined
                      ) {
                        pfLine = -Math.round((bonifMkt[c.key].total || 0) * 100) / 100;
                      } else if (l.label === 'CMV %' && cmvPct[c.key] !== undefined) {
                        pfLine = cmvPct[c.key];
                      } else if (
                        l.label === 'CUSTO DAS MERCADORIAS VENDIDAS' &&
                        cmvPct[c.key] !== undefined
                      ) {
                        // CMV = % editado × Receita Operacional Líquida (calculada ou da planilha)
                        const rol =
                          totaisCalculados[c.key]?.['RECEITA OPERACIONAL LÍQUIDA'] ??
                          estatico('RECEITA OPERACIONAL LÍQUIDA', c.key);
                        pfLine = Math.round(cmvPct[c.key] * rol * 100) / 100;
                      } else if (l.label === 'TAXA DE CARTÃO' && impCartao[c.key] !== undefined) {
                        pfLine = -Math.round((impCartao[c.key].total || 0) * 100) / 100;
                      } else if (
                        l.label === 'SERVIÇOS DE TERCEIROS VARIÁVEIS' &&
                        impCartao[c.key] !== undefined
                      ) {
                        // = soma do subnível (só Taxa de cartão por enquanto)
                        pfLine = -Math.round((impCartao[c.key].total || 0) * 100) / 100;
                      } else if (
                        l.label === 'ANTECIPAÇÃO DE RECEBÍVEIS' &&
                        impAntecip[c.key] !== undefined
                      ) {
                        pfLine = -Math.round((impAntecip[c.key].total || 0) * 100) / 100;
                      } else if (l.label === 'DESPESA FINANCEIRA' && impAntecip[c.key] !== undefined) {
                        // = Antecipação (importada) + Juros e multa (planilha)
                        pfLine =
                          Math.round(
                            (-(impAntecip[c.key].total || 0) + estatico('JUROS E MULTA POR ATRASO', c.key)) * 100,
                          ) / 100;
                      } else if (
                        l.label === 'RECEITA (DESPESA) NÃO OPERACIONAL' &&
                        impAntecip[c.key] !== undefined
                      ) {
                        // = Receita financeira (planilha) + Despesa financeira recomposta
                        pfLine =
                          Math.round(
                            (estatico('RECEITA FINANCEIRA', c.key) -
                              (impAntecip[c.key].total || 0) +
                              estatico('JUROS E MULTA POR ATRASO', c.key)) *
                              100,
                          ) / 100;
                      } else if (
                        l.label === 'PERDAS COM INADIMPLÊNCIA' &&
                        perdasLinha[c.key] !== undefined
                      ) {
                        pfLine = perdasLinha[c.key];
                      } else if (
                        l.label === 'MARKETING' &&
                        (mktLinha[c.key] !== undefined ||
                          trafegoLinha[c.key] !== undefined ||
                          bonifMkt[c.key] !== undefined)
                      ) {
                        // Marketing = Propaganda e anúncio + Tráfego + Bonificações marketing
                        pfLine =
                          Math.round(
                            ((mktLinha[c.key] || 0) +
                              (trafegoLinha[c.key] || 0) -
                              (bonifMkt[c.key]?.total || 0)) *
                              100,
                          ) / 100;
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
                                : sub || sub2
                                  ? 'text-gray-600'
                                  : 'text-gray-800';
                      // Célula de mês clicável nas linhas de despesa: abre só
                      // aquele mês (folha, PJ, Ocupação, Serviços).
                      const celulaMes = ehDespesaMes && temDadoMes(c.key);
                      // Linha CMV %: célula de mês editável (clique → digita o %)
                      const cmvEditavel = l.label === 'CMV %' && c.grupo === 'mensal' && !!colParaMes(c);
                      const cmvEditando = cmvEditavel && editandoCmv === c.key;
                      const celulaMesAberta = celulaMes && colMesLinha === c.key;
                      return (
                        <td
                          key={c.key}
                          onClick={
                            cmvEditavel
                              ? () => !cmvEditando && setEditandoCmv(c.key)
                              : celulaMes
                                ? () => abrirMes(l.label, c.key)
                                : undefined
                          }
                          title={
                            cmvEditavel
                              ? 'Clique para editar o % do CMV sobre a Receita Operacional Líquida'
                              : celulaMes
                              ? 'Clique para abrir as despesas deste mês'
                              : calc !== undefined
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
                            (pct || sub2 ? 'text-[10px] ' : '') +
                            (celulaMes || cmvEditavel ? 'cursor-pointer hover:underline ' : '') +
                            (celulaMesAberta ? 'ring-1 ring-inset ring-emerald-400 ' : '') +
                            corTexto
                          }
                        >
                          {cmvEditando ? (
                            <span className="inline-flex items-center gap-0.5">
                              <input
                                type="number"
                                step="0.1"
                                autoFocus
                                defaultValue={Math.round(Math.abs((v || 0) * 100) * 10) / 10}
                                onBlur={(e) => {
                                  const n = Math.abs(Number(e.target.value) || 0);
                                  const pct = -(n / 100);
                                  if (Math.abs(pct - (v || 0)) > 1e-9) salvarCmvPct(c.key, colParaMes(c), pct);
                                  setEditandoCmv(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                  if (e.key === 'Escape') setEditandoCmv(null);
                                }}
                                className="w-14 text-right text-[10px] text-emerald-800 bg-white border border-emerald-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              />
                              <span className="text-[10px] text-gray-500">%</span>
                            </span>
                          ) : (
                            formatar(v, l.fmt)
                          )}
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
                      // Só o mês clicado: contratados daquele mês.
                      const mc = colMesLinha;
                      const lista = (pjNomes[mc] || [])
                        .slice()
                        .sort((a, b) => (b.valor || 0) - (a.valor || 0));
                      return lista.map((p) => (
                        <tr key={'pj-' + p.nome} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {p.nome}
                            </span>
                          </td>
                          {colunas.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && p.valor ? formatar(-p.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {ocupAbertoLinha &&
                    (() => {
                      // Só o mês clicado: filiais daquele mês.
                      const mc = colMesLinha;
                      const lista = (ocupFiliais[mc] || [])
                        .slice()
                        .sort((a, b) => (b.valor || 0) - (a.valor || 0));
                      return lista.map((p) => (
                        <tr key={'ocup-' + p.nome} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {p.nome}
                            </span>
                          </td>
                          {colunas.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && p.valor ? formatar(-p.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {mktAbertoLinha &&
                    (() => {
                      // Só o mês clicado: lançamentos de propaganda daquele mês.
                      const mc = colMesLinha;
                      const lista = (mktLanc[mc] || [])
                        .slice()
                        .sort((a, b) => (b.valor || 0) - (a.valor || 0));
                      return lista.map((x, i) => (
                        <tr key={'mkt-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.forn}
                              {x.venc ? (
                                <span className="text-gray-400 font-normal"> · venc {x.venc}</span>
                              ) : null}
                            </span>
                          </td>
                          {colunas.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {trafAbertoLinha &&
                    (() => {
                      // Só o mês clicado: tráfego por canal → loja/conta (competência).
                      const mc = colMesLinha;
                      const lista = (trafegoItens[mc] || []).slice();
                      return lista.map((x, i) => (
                        <tr key={'traf-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.nome}
                              {x.canal ? (
                                <span className="text-gray-400 font-normal"> · {x.canal}</span>
                              ) : null}
                            </span>
                          </td>
                          {colunas.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {bonifAbertoLinha &&
                    (() => {
                      // Só o mês clicado: bonificações de marketing (DRE Analítica).
                      const mc = colMesLinha;
                      const lista = (bonifMkt[mc]?.lanc || []).slice();
                      return lista.map((x, i) => (
                        <tr key={'bonif-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.forn}
                              {x.venc ? (
                                <span className="text-gray-400 font-normal"> · venc {x.venc}</span>
                              ) : null}
                            </span>
                          </td>
                          {colunas.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {perdasAbertoLinha &&
                    (() => {
                      // Só o mês clicado: saldo vencido em aberto por canal.
                      const mc = colMesLinha;
                      const lista = (perdasCanais[mc] || []).slice();
                      return lista.map((x, i) => (
                        <tr key={'perdas-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.nome}
                              <span className="text-gray-400 font-normal">
                                {' '}· {x.titulos} tít. · {x.clientes} cli.
                              </span>
                            </span>
                          </td>
                          {colunas.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {(impAntAberto || impCarAberto) &&
                    (() => {
                      // Só o mês clicado: taxa por empresa (planilha importada).
                      const mc = colMesLinha;
                      const src = impAntAberto ? impAntecip[mc] : impCartao[mc];
                      const lista = ((src && src.empresas) || []).slice();
                      const pref = impAntAberto ? 'impA-' : 'impC-';
                      return lista.map((x, i) => (
                        <tr key={pref + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.empresa}
                            </span>
                          </td>
                          {colunas.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {servAbertoLinha &&
                    (() => {
                      // Só o mês clicado: despesas e lançamentos daquele mês.
                      const mc = colMesLinha;
                      const cats = (servTerc[mc]?.categorias || []).slice();
                      const colMes = colunas.find((c) => c.key === mc);
                      const rotuloMes = colMes ? colMes.label : '';
                      return cats.map((cg) => {
                        const catAberta = servCatsAbertas.has(cg.cat);
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
                                  <span className="text-gray-400 font-normal"> · {rotuloMes}</span>
                                </span>
                              </td>
                              {colunas.map((c) => (
                                <td
                                  key={c.key}
                                  className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                                >
                                  {c.key === mc && cg.valor
                                    ? formatar(-cg.valor, 'moeda')
                                    : '–'}
                                </td>
                              ))}
                            </tr>
                            {catAberta &&
                              (cg.lancamentos || []).map((x, i) => (
                                <tr key={'serv-' + cg.cat + '-' + i} className="bg-white">
                                  <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-0.5 whitespace-nowrap bg-white text-[10px] text-gray-500">
                                    {x.forn}
                                    {x.venc ? (
                                      <span className="text-gray-400"> · venc {x.venc}</span>
                                    ) : null}
                                  </td>
                                  {colunas.map((c) => (
                                    <td
                                      key={c.key}
                                      className="border-b border-gray-100 px-3 py-0.5 text-right tabular-nums whitespace-nowrap text-[10px] text-gray-500"
                                    >
                                      {c.key === mc && x.val ? formatar(-x.val, 'moeda') : '–'}
                                    </td>
                                  ))}
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
                      // Agrupa por EMPRESA e, dentro, por funcionário — só o mês
                      // aberto (colMesLinha), pra não misturar meses.
                      let empresas = [];
                      if (rubAberta) {
                        const col = colMesLinha;
                        const em = new Map();
                        for (const f of ru.funcPorCol[col] || []) {
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
