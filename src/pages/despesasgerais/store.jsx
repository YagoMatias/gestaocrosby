import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import useApiClient from '../../hooks/useApiClient';
import { getCategoriaPorCodigo } from '../../config/categoriasDespesas';
import baseData from './dadosDespesasGerais.json';
import { supabase } from '../../lib/supabase';
import { parseHistoricoHtml } from './historicoHtml';

// Observações importadas (planilha) ficam no Supabase em
// observacoes_despesas_totvs. Buscamos as do período e casamos com os
// lançamentos pela mesma chave do rowId: empresa|duplicata|parcela|fornecedor.
async function fetchObsSupabase(dtInicio, dtFim) {
  try {
    const { data, error } = await supabase
      .from('observacoes_despesas_totvs')
      .select('cd_empresa,cd_fornecedor,nr_duplicata,nr_parcela,observacao,updated_at,is_active')
      .eq('dt_inicio', dtInicio)
      .eq('dt_fim', dtFim)
      .eq('is_active', true);
    if (error) {
      console.warn('DespesasGerais: falha ao ler observações do Supabase', error.message);
      return {};
    }
    const full = {}; // chave completa empresa|duplicata|parcela|fornecedor
    const loose = {}; // chave leve empresa|duplicata (histórico importado do HTML)
    for (const r of data || []) {
      const fk = `${r.cd_empresa}|${r.nr_duplicata}|${r.nr_parcela ?? ''}|${r.cd_fornecedor ?? ''}`;
      full[fk] = r.observacao;
      const lk = `${r.cd_empresa}|${r.nr_duplicata}`;
      loose[lk] = r.observacao;
    }
    return { full, loose };
  } catch (e) {
    console.warn('DespesasGerais: erro ao buscar observações', e?.message);
    return { full: {}, loose: {} };
  }
}

// ─── Parser do HTML histórico (ferramenta "Despesas Gerais 2026") ────────────
// Extrai o literal de `const NOME = ...;` balanceando chaves (respeita strings).
function extrairConstHtml(html, nome) {
  const i = html.indexOf(`const ${nome}`);
  if (i < 0) return null;
  const eq = html.indexOf('=', i);
  if (eq < 0) return null;
  let j = eq + 1;
  let depth = 0;
  let started = false;
  let emStr = false;
  let asp = '';
  for (; j < html.length; j++) {
    const c = html[j];
    if (emStr) {
      if (c === '\\') {
        j++;
        continue;
      }
      if (c === asp) emStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      emStr = true;
      asp = c;
      continue;
    }
    if (c === '{' || c === '[') {
      depth++;
      started = true;
    } else if (c === '}' || c === ']') {
      depth--;
      if (started && depth === 0) {
        j++;
        break;
      }
    }
  }
  return html.slice(eq + 1, j).trim();
}
// Normaliza literal JS → JSON (sem eval): põe aspas nas chaves sem aspas e
// remove vírgulas finais, respeitando strings.
function normalizarLiteralJs(str) {
  let out = '';
  let emStr = false;
  let asp = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (emStr) {
      out += c;
      if (c === '\\') {
        out += str[++i] ?? '';
        continue;
      }
      if (c === asp) emStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      emStr = true;
      asp = c;
      out += '"';
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < str.length && /[A-Za-z0-9_$]/.test(str[j])) j++;
      let k = j;
      while (k < str.length && /\s/.test(str[k])) k++;
      if (str[k] === ':') {
        out += `"${str.slice(i, j)}"`;
        i = j - 1;
        continue;
      }
    }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}
function lerConstHtml(html, nome) {
  const bruto = extrairConstHtml(html, nome);
  if (!bruto) return null;
  try {
    return JSON.parse(normalizarLiteralJs(bruto));
  } catch {
    return null;
  }
}
// Siglas dos meses congelados no HTML (jan–ago).
const HTML_MESES = { JAN: 'jan', FEV: 'fev', MAR: 'mar', ABR: 'abr', MAI: 'mai', JUN: 'jun', JUL: 'jul', AGO: 'ago' };

// Constrói os objetos de mês (igual ao shape do store) a partir do HTML.
export function parseHtmlMeses(html) {
  const out = {};
  for (const [sigla, mk] of Object.entries(HTML_MESES)) {
    const summaryRaw = lerConstHtml(html, `${sigla}_SUMMARY`);
    const detailsRaw = lerConstHtml(html, `${sigla}_DETAILS`);
    if (!summaryRaw && !detailsRaw) continue;
    const details = {};
    let cnt = 0;
    if (detailsRaw && typeof detailsRaw === 'object') {
      for (const cat of Object.keys(detailsRaw)) {
        const linhas = Array.isArray(detailsRaw[cat]) ? detailsRaw[cat] : [];
        details[cat] = linhas.map((l, idx) => ({
          id: `${l.emp ?? ''}|${String(l.dupl ?? '').replace(/\D/g, '')}|${idx}`,
          emp: String(l.emp ?? ''),
          forn: l.forn || '',
          dupl: String(l.dupl ?? ''),
          emis: l.emis || '',
          venc: l.venc || '',
          liq: l.liq || '',
          val: Math.round((Number(l.val) || 0) * 100) / 100,
          estag: l.estag || '',
          obs: l.obs || '',
        }));
        cnt += details[cat].length;
      }
    }
    const summary = Array.isArray(summaryRaw)
      ? summaryRaw.map((s) => ({ cat: s.cat, total: Math.round((Number(s.total) || 0) * 100) / 100 }))
      : Object.entries(details).map(([cat, rows]) => ({ cat, total: Math.round(rows.reduce((a, r) => a + (Number(r.val) || 0), 0) * 100) / 100 }));
    summary.sort((a, b) => b.total - a.total);
    const total = Math.round(summary.reduce((a, x) => a + x.total, 0) * 100) / 100;
    out[mk] = { summary, details, total, cnt };
  }
  return out;
}

// ─── Constantes ──────────────────────────────────────────────────────────────
export const MONTH_KEYS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export const MES_NOME = {
  jan: 'Janeiro',
  fev: 'Fevereiro',
  mar: 'Março',
  abr: 'Abril',
  mai: 'Maio',
  jun: 'Junho',
  jul: 'Julho',
  ago: 'Agosto',
  set: 'Setembro',
  out: 'Outubro',
  nov: 'Novembro',
  dez: 'Dezembro',
};

export const MES_SHORT = {
  jan: 'Jan',
  fev: 'Fev',
  mar: 'Mar',
  abr: 'Abr',
  mai: 'Mai',
  jun: 'Jun',
  jul: 'Jul',
  ago: 'Ago',
  set: 'Set',
  out: 'Out',
  nov: 'Nov',
  dez: 'Dez',
};

// prefixo das chaves de forecast (mantém compatibilidade com dados antigos)
export const MES_PREFIX = {
  jan: '',
  fev: 'FEV_',
  mar: 'MAR_',
  abr: 'ABR_',
  mai: 'MAI_',
  jun: 'JUN_',
  jul: 'JUL_',
  ago: 'AGO_',
  set: 'SET_',
  out: 'OUT_',
  nov: 'NOV_',
  dez: 'DEZ_',
};

// número do mês (1-12) para montar datas
const MES_NUM = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

// ordem dos meses (p/ achar o mês anterior)
export const MES_SEQ = Object.keys(MES_NUM);

// Meses CONGELADOS: jan–ago são importação manual (histórico). De setembro em
// diante é HeadCoach ao vivo. Congelado = não sincroniza/altera com o TOTVS.
export const MES_CORTE_HEADCOACH = 'set';
export const mesCongelado = (m) =>
  MES_SEQ.indexOf(m) > -1 && MES_SEQ.indexOf(m) < MES_SEQ.indexOf(MES_CORTE_HEADCOACH);

// Despesas RETIRADAS da DRE Analítica a partir de um mês (regra fixa, pedido do
// financeiro em 21/10/2026): não entram ao sincronizar com o TOTVS e não voltam
// em syncs futuros. Casa por código do item de despesa e, por segurança, pelo nome.
export const DESPESAS_EXCLUIDAS = [
  { desde: 'set', codigos: [6031], nomes: ['PROPAGANDA E ANUNCIOS'] }, // set–dez
];
const normCat = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
export const despesaExcluida = (m, it) => {
  const im = MES_SEQ.indexOf(m);
  if (im < 0) return false;
  const cod = Number(it.cd_despesaitem) || 0;
  const nome = normCat(it.ds_despesaitem);
  return DESPESAS_EXCLUIDAS.some(
    (r) =>
      im >= MES_SEQ.indexOf(r.desde) &&
      (r.codigos.includes(cod) || r.nomes.map(normCat).includes(nome)),
  );
};

export const ANO = 2026;

export const STATUS_LIST = [
  'Liquidado',
  'Liberado para pagamento',
  'Título não conferido',
];

export const FLAG_STATUS = ['Pendente', 'Em andamento', 'Concluído'];

// Empresas consultadas (mesma lista usada na DRE gerencial)
export const EMPRESAS_DRE = [
  1, 2, 5, 6, 7, 11, 12, 13, 14, 15, 16, 31, 55, 65, 75, 85, 90, 91, 92, 93,
  94, 95, 96, 97, 99, 100, 101, 111, 200, 311, 500, 550, 600, 650, 700, 750,
  850, 890, 910, 920, 930, 940, 950, 960, 970, 990,
];

// Grupos de despesas que no sistema vêm separadas mas compartilham UM forecast
export const FC_MERGE_GROUPS = [
  {
    members: [
      'BONIFICAÇÕES, BRINDES E DONATIVOS',
      'BONIFICACOES, BRINDES E DONATIVOS',
      'BONIFICAÇÕES - MARKETING',
      'BONIFICAÇÕES MARKETING',
      'BONIFICAÇÕES GERAIS',
    ],
    canon: 'BONIFICACOES, BRINDES E DONATIVOS',
  },
  {
    members: [
      'FRETES E CARRETAS (FILIAIS)',
      'TAXA DE ENTREGA (CLIENTE)',
      'FRETES',
    ],
    canon: 'TAXA DE ENTREGA (CLIENTE)',
  },
];

export const groupOf = (cat) =>
  FC_MERGE_GROUPS.find((g) => g.members.includes(cat)) || null;

export const fmtBRL = (v) =>
  'R$ ' +
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtBRL0 = (v) =>
  'R$ ' + Math.round(Number(v || 0)).toLocaleString('pt-BR');

const STORAGE_KEY = 'despesas-gerais-2026:v2';
const LEGACY_STORAGE_KEY = 'despesas-gerais-2026:v1';

const deepClone = (o) => JSON.parse(JSON.stringify(o));

// identifica a regra de consulta vigente; mudar isso força re-sincronização
// dos meses gravados com uma regra anterior
// v4: retira PROPAGANDA E ANUNCIOS (6031) a partir de set — força re-sync dos
// meses ao vivo; os congelados (jan–ago) não re-sincronizam.
export const CONSULTA_VERSAO = 'emissao-normais-v4';

// classificação por faixa de código (mesma régua da DRE gerencial)
const categoriaPorFaixa = (codigo) => {
  if (codigo >= 1000 && codigo <= 1999) return 'CUSTO DAS MERCADORIAS VENDIDAS';
  if (codigo >= 2000 && codigo <= 2999) return 'DESPESAS OPERACIONAIS';
  if (codigo >= 3000 && codigo <= 3999) return 'DESPESAS COM PESSOAL';
  if (codigo >= 4001 && codigo <= 4999) return 'ALUGUÉIS E ARRENDAMENTOS';
  if (codigo >= 5000 && codigo <= 5999) return 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES';
  if (codigo >= 6000 && codigo <= 6999) return 'DESPESAS GERAIS';
  if (codigo >= 7000 && codigo <= 7999) return 'DESPESAS FINANCEIRAS';
  if (codigo >= 8000 && codigo <= 8999) return 'OUTRAS DESPESAS OPERACIONAIS';
  if (codigo >= 9000 && codigo <= 9999) return 'DESPESAS C/ VENDAS';
  return 'SEM CLASSIFICAÇÃO';
};

// exceções por código têm precedência; faixa é o fallback (igual à DRE)
export const classificarDespesa = (cd) => {
  const n = Number(cd) || 0;
  return getCategoriaPorCodigo(n) || categoriaPorFaixa(n);
};

// mapeia tp_estagio do TOTVS para o status usado no painel
const ESTAGIO_MAP = {
  Liquid: 'Liquidado',
  Lib: 'Liberado para pagamento',
  NConf: 'Título não conferido',
};

// 'YYYY-MM-DDT...' → 'DD/MM/YYYY'
const isoParaBR = (iso) => {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const [y, mo, d] = s.split('-');
  if (!y || !mo || !d) return String(iso);
  return `${d}/${mo}/${y}`;
};

const mesVazio = (m) => ({
  label: `${MES_NOME[m]} / ${ANO}`,
  short: `${MES_SHORT[m]} ${ANO}`,
  prefix: MES_PREFIX[m],
  summary: [],
  details: {},
  total: 0,
  cnt: 0,
});

function loadInitial() {
  const base = {
    months: deepClone(baseData.months),
    forecasts: deepClone(baseData.forecasts),
    flags: deepClone(baseData.flags),
    fontes: {}, // m -> { origem: 'planilha'|'totvs', atualizadoEm }
    obsEdits: {}, // rowId -> observação digitada pelo usuário
    travas: {}, // m -> { travado: true, em } — mês travado após análise (sem sync, sem edição)
    analisadas: {}, // m -> { cat: { em } } — despesas já conferidas pelo financeiro
  };
  MONTH_KEYS.forEach((m) => {
    if (!base.months[m]) base.months[m] = mesVazio(m);
    base.fontes[m] = { origem: 'planilha', atualizadoEm: null };
  });
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.months)
        Object.entries(saved.months).forEach(([m, v]) => {
          base.months[m] = v;
        });
      if (saved.forecasts) base.forecasts = saved.forecasts;
      if (saved.flags) base.flags = saved.flags;
      if (saved.fontes)
        Object.entries(saved.fontes).forEach(([m, v]) => {
          base.fontes[m] = v;
        });
      if (saved.obsEdits) base.obsEdits = saved.obsEdits;
      if (saved.travas) base.travas = saved.travas;
      if (saved.analisadas) base.analisadas = saved.analisadas;
    }
  } catch (e) {
    console.warn('DespesasGerais: falha ao ler estado salvo', e);
  }
  // consolida forecast dos grupos numa chave única (todos os meses)
  FC_MERGE_GROUPS.forEach((g) => {
    Object.values(MES_PREFIX).forEach((p) => {
      let soma = 0;
      let achou = false;
      g.members.forEach((c) => {
        const k = p + c;
        if (base.forecasts[k] !== undefined) {
          soma += parseFloat(base.forecasts[k]) || 0;
          achou = true;
          if (c !== g.canon) delete base.forecasts[k];
        }
      });
      if (achou) base.forecasts[p + g.canon] = Math.round(soma * 100) / 100;
    });
  });
  return base;
}

const DespesasGeraisContext = createContext(null);

export function DespesasGeraisProvider({ children }) {
  const apiClient = useApiClient();
  const [state, setState] = useState(loadInitial);
  const [activeMonth, setActiveMonth] = useState('jul');
  const [carregandoMes, setCarregandoMes] = useState(null); // mês em carregamento
  const [erroMes, setErroMes] = useState(null); // { m, msg }
  const persistTimer = useRef(null);
  const carregandoRef = useRef(false);
  const stateRef = useRef(state); // leitura síncrona do estado dentro de callbacks
  stateRef.current = state;
  // resultado da última sincronização POR DESPESA (feedback na tela)
  const [ultimaSyncDespesa, setUltimaSyncDespesa] = useState(null); // { m, cat, antes, depois, em }

  // persistência com debounce
  useEffect(() => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('DespesasGerais: falha ao salvar estado', e);
      }
    }, 400);
    return () => clearTimeout(persistTimer.current);
  }, [state]);

  const { months, forecasts, flags, fontes, obsEdits } = state;
  const travas = state.travas || {};
  // mês travado pelo usuário (botão "Travar mês"): sem sync e sem alteração
  const mesTravado = useCallback((m) => !!(travas[m] && travas[m].travado), [travas]);

  // despesa marcada como "analisada" no mês (controle de conferência do financeiro)
  const analisadas = state.analisadas || {};
  const catAnalisada = useCallback(
    (m, cat) => !!(analisadas[m] && analisadas[m][cat]),
    [analisadas],
  );
  const toggleAnalisada = useCallback((m, cat) => {
    setState((st) => {
      const todas = { ...(st.analisadas || {}) };
      const doMes = { ...(todas[m] || {}) };
      if (doMes[cat]) delete doMes[cat];
      else doMes[cat] = { em: new Date().toISOString() };
      todas[m] = doMes;
      return { ...st, analisadas: todas };
    });
  }, []);

  // meses que têm dados (para tabelas/gráficos não mostrarem meses vazios)
  const mesesAtivos = useMemo(
    () => MONTH_KEYS.filter((m) => months[m] && months[m].cnt > 0),
    [months],
  );

  // ── helpers de forecast/grupos ──
  const fcKeyFor = useCallback(
    (cat, m) => {
      const g = groupOf(cat);
      const c = g ? g.canon : cat;
      return MES_PREFIX[m || activeMonth] + c;
    },
    [activeMonth],
  );

  // realizado de uma categoria (ou do seu grupo) num mês; null se o mês não foi carregado
  const realizadoCatMes = useCallback(
    (cat, m) => {
      const mo = months[m];
      if (!mo) return null;
      const g = groupOf(cat);
      if (g) return mo.summary.filter((s) => g.members.includes(s.cat)).reduce((sum, s) => sum + s.total, 0);
      const row = mo.summary.find((s) => s.cat === cat);
      return row ? row.total : 0;
    },
    [months],
  );

  // Forecast padrão (regra: forecast de um mês = realizado do mês anterior).
  // Usado quando não há forecast definido na mão. null se não dá p/ calcular.
  const forecastPadraoFor = useCallback(
    (cat, m) => {
      const atual = m || activeMonth;
      const i = MES_SEQ.indexOf(atual);
      const pm = i > 0 ? MES_SEQ[i - 1] : null;
      if (!pm) return null;
      const r = realizadoCatMes(cat, pm);
      return r == null ? null : Math.round(r * 100) / 100;
    },
    [activeMonth, realizadoCatMes],
  );

  const fcTotalFor = useCallback(
    (m) => {
      const mo = months[m];
      if (!mo) return 0;
      const seen = new Set();
      let soma = 0;
      mo.summary.forEach((s) => {
        const key = fcKeyFor(s.cat, m);
        if (seen.has(key)) return;
        seen.add(key);
        const v = forecasts[key];
        const fv =
          v !== undefined && v !== null && v !== ''
            ? parseFloat(v) || 0
            : forecastPadraoFor(s.cat, m); // padrão: realizado do mês anterior
        if (fv != null && !isNaN(fv)) soma += fv;
      });
      return Math.round(soma * 100) / 100;
    },
    [months, forecasts, fcKeyFor, forecastPadraoFor],
  );

  const mergeRealizedG = useCallback(
    (g, m) => {
      const mo = months[m || activeMonth];
      if (!mo) return 0;
      return mo.summary
        .filter((s) => g.members.includes(s.cat))
        .reduce((sum, s) => sum + s.total, 0);
    },
    [months, activeMonth],
  );

  // ── TOTVS: busca o que foi PAGO (liquidado) no mês ──
  // apenasCat: sincroniza SÓ essa despesa (categoria) — as outras do mês ficam
  // como estão (pedido do financeiro em 21/10/2026).
  const carregarMesTotvs = useCallback(
    async (m, { somenteGerais = true, apenasCat = null } = {}) => {
      if (carregandoRef.current) return;
      carregandoRef.current = true;
      setCarregandoMes(m);
      setErroMes(null);
      try {
        const num = MES_NUM[m];
        const ultimoDia = new Date(ANO, num, 0).getDate();
        const pad = (n) => String(n).padStart(2, '0');
        const payload = {
          dt_inicio: `${ANO}-${pad(num)}-01`,
          dt_fim: `${ANO}-${pad(num)}-${pad(ultimoDia)}`,
          branches: EMPRESAS_DRE,
          modo: 'emissao', // período = data de emissão do título
          situacao: 'N', // só títulos NORMAIS (exclui cancelados/agrupados/devolvidos)
          // ATENÇÃO: não usar previsao 'REAL' — o backend filtra por inclusionType,
          // que é o MÉTODO de inclusão (manual/automático/API), não Previsão×Real.
          // A busca do TOTVS não retorna nem filtra o campo Previsão de verdade.
          previsao: 'TODOS',
          filtroPagamento: 'TODOS', // faturas em aberto E pagas
        };
        const result = await apiClient.totvs.accountsPayableSearch(payload);
        // observações importadas (planilha) do mesmo período, do Supabase
        const supaObs = await fetchObsSupabase(payload.dt_inicio, payload.dt_fim);

        let dadosArray = [];
        if (result && typeof result === 'object') {
          if (Array.isArray(result.data)) dadosArray = result.data;
          else if (result.data && Array.isArray(result.data.data))
            dadosArray = result.data.data;
          else if (result.metadata && Array.isArray(result.metadata.data))
            dadosArray = result.metadata.data;
        }

        // regras da DRE: ignora centro de custo 999 (rateio interno)
        let itens = dadosArray.filter((it) => Number(it.cd_ccusto) !== 999);
        // despesas retiradas por regra fixa (ex.: PROPAGANDA E ANUNCIOS a partir de set)
        itens = itens.filter((it) => !despesaExcluida(m, it));
        // classifica: só despesas do grupo "DESPESAS GERAIS" (exceções + faixa 6000-6999)
        if (somenteGerais) {
          itens = itens.filter(
            (it) => classificarDespesa(it.cd_despesaitem) === 'DESPESAS GERAIS',
          );
        }

        const catAlvo = apenasCat ? String(apenasCat).trim().toUpperCase() : null;
        if (catAlvo) {
          itens = itens.filter(
            (it) => (it.ds_despesaitem || 'SEM CLASSIFICAÇÃO').trim().toUpperCase() === catAlvo,
          );
          // feedback: como estava × como ficou (a tela mostra mesmo quando nada muda)
          const soma = (rows) =>
            Math.round(rows.reduce((s, r) => s + (parseFloat(r.val) || 0), 0) * 100) / 100;
          const antesRows = (stateRef.current.months[m] && stateRef.current.months[m].details[catAlvo]) || [];
          const depoisVals = itens.map((it) => ({
            val: parseFloat(it.vl_pago) > 0 ? parseFloat(it.vl_pago) : parseFloat(it.vl_duplicata) || 0,
          }));
          setUltimaSyncDespesa({
            m,
            cat: catAlvo,
            antes: { n: antesRows.length, total: soma(antesRows) },
            depois: { n: depoisVals.length, total: soma(depoisVals) },
            em: new Date().toISOString(),
          });
        }

        setState((st) => {
          // só uma despesa: parte das categorias que já estão no mês
          const details = catAlvo ? { ...((st.months[m] && st.months[m].details) || {}) } : {};
          if (catAlvo) delete details[catAlvo];
          itens.forEach((it) => {
            const cat = (it.ds_despesaitem || 'SEM CLASSIFICAÇÃO')
              .trim()
              .toUpperCase();
            const rowId = `${it.cd_empresa}|${it.nr_duplicata}|${it.nr_parcela ?? ''}|${it.cd_fornecedor ?? ''}`;
            const val =
              parseFloat(it.vl_pago) > 0
                ? parseFloat(it.vl_pago)
                : parseFloat(it.vl_duplicata) || 0;
            if (!details[cat]) details[cat] = [];
            details[cat].push({
              id: rowId,
              emp: String(it.cd_empresa ?? ''),
              forn: it.nm_fornecedor || `Fornecedor ${it.cd_fornecedor || '?'}`,
              dupl: String(it.nr_duplicata ?? ''),
              emis: isoParaBR(it.dt_emissao),
              venc: isoParaBR(it.dt_vencimento),
              liq: isoParaBR(it.dt_liq),
              val: Math.round(val * 100) / 100,
              estag:
                ESTAGIO_MAP[it.tp_estagio] ||
                it.tp_estagio ||
                (it.dt_liq ? 'Liquidado' : 'Título não conferido'),
              obs:
                st.obsEdits[rowId] ||
                supaObs.full[rowId] ||
                supaObs.loose[`${it.cd_empresa}|${it.nr_duplicata}`] ||
                '',
            });
          });
          // ordena lançamentos por valor desc dentro de cada categoria
          // (só a recarregada, no modo por despesa — as outras mantêm a ordem)
          (catAlvo ? [details[catAlvo]].filter(Boolean) : Object.values(details)).forEach((rows) =>
            rows.sort((a, b) => b.val - a.val),
          );
          const summary = Object.entries(details)
            .map(([cat, rows]) => ({
              cat,
              total:
                Math.round(
                  rows.reduce((s, r) => s + (parseFloat(r.val) || 0), 0) * 100,
                ) / 100,
            }))
            .sort((a, b) => b.total - a.total);
          const total =
            Math.round(summary.reduce((s, x) => s + x.total, 0) * 100) / 100;
          const cnt = Object.values(details).reduce((s, rows) => s + rows.length, 0);

          // desvincula flags indexados da planilha deste mês (dados trocaram):
          // a linha vive no snapshot e não aponta mais para um índice vivo
          // (no modo por despesa, só os flags dessa categoria)
          const flags = { ...st.flags };
          Object.keys(flags).forEach((k) => {
            const parts = k.split('||');
            if (catAlvo && parts[1] !== catAlvo) return;
            if (parts[0] === m && /^\d+$/.test(parts[2] || '')) {
              flags[`${m}||${parts[1]}||snap:${parts[2]}`] = flags[k];
              delete flags[k];
            }
          });

          return {
            ...st,
            flags,
            months: {
              ...st.months,
              [m]: {
                ...mesVazio(m),
                summary,
                details,
                total,
                cnt,
              },
            },
            fontes: {
              ...st.fontes,
              [m]: catAlvo
                ? {
                    // mês continua com a origem que tinha; registra só a despesa recarregada
                    ...(st.fontes[m] || { origem: 'totvs', somenteGerais, consulta: CONSULTA_VERSAO }),
                    ultimaDespesa: { cat: catAlvo, atualizadoEm: new Date().toISOString() },
                  }
                : {
                    origem: 'totvs',
                    atualizadoEm: new Date().toISOString(),
                    somenteGerais,
                    consulta: CONSULTA_VERSAO,
                  },
            },
          };
        });
      } catch (e) {
        console.error('DespesasGerais: erro ao buscar TOTVS', e);
        setErroMes({ m, msg: e.message || 'Erro ao consultar o TOTVS' });
      } finally {
        carregandoRef.current = false;
        setCarregandoMes(null);
      }
    },
    [apiClient],
  );

  // Importa o histórico (jan–ago) do HTML "Despesas Gerais 2026": carrega os
  // valores + lançamentos + observações nesses meses (espelho do arquivo),
  // marcando origem 'html'. Meses congelados não re-sincronizam com o TOTVS.
  // Prefere o window.__SAVED_STATE__ (estado vivo do tool antigo: meses com os
  // lançamentos manuais e edições, forecasts e flags — inclusive flags manuais);
  // cai nas constantes <MES>_SUMMARY/_DETAILS só se não houver estado salvo.
  // Substitui, para jan–ago, os meses, os forecasts e as flags existentes.
  const importarMesesHtml = useCallback((html) => {
    const r = parseHistoricoHtml(html);
    const todos = Object.keys(r.meses);
    if (!todos.length) throw new Error('Não achei os dados dos meses no HTML (estado salvo ou const <MES>_SUMMARY/_DETAILS).');
    // meses travados pelo usuário não são alterados pela importação
    const pulados = todos.filter((mk) => travas[mk] && travas[mk].travado);
    const mks = todos.filter((mk) => !pulados.includes(mk));
    const prefixos = new Set(mks.map((mk) => MES_PREFIX[mk]));
    const mesesSet = new Set(mks);
    const fcImport = Object.fromEntries(
      Object.entries(r.forecasts).filter(([k]) => prefixos.has((k.match(/^[A-Z]{3}_/) || [''])[0])),
    );
    const flImport = Object.fromEntries(
      Object.entries(r.flags).filter(([k, f]) => mesesSet.has(f && f.manual ? f.mes : k.split('||')[0])),
    );
    if (mks.length) {
      setState((st) => {
        const months = { ...st.months };
        const fontes = { ...st.fontes };
        const atualizadoEm = new Date().toISOString();
        for (const mk of mks) {
          months[mk] = { ...mesVazio(mk), ...r.meses[mk] };
          fontes[mk] = { origem: 'html', atualizadoEm, somenteGerais: true, consulta: CONSULTA_VERSAO };
        }
        // forecasts dos meses importados: troca pelos do arquivo
        const forecasts = { ...st.forecasts };
        Object.keys(forecasts).forEach((k) => {
          const p = (k.match(/^[A-Z]{3}_/) || [''])[0];
          if (prefixos.has(p)) delete forecasts[k];
        });
        Object.assign(forecasts, fcImport);
        // flags (correção/corte, inclusive manuais) dos meses importados: troca pelas do arquivo
        const flags = { ...st.flags };
        Object.keys(flags).forEach((k) => {
          const f = flags[k];
          const m = f && f.manual ? f.mes : k.split('||')[0];
          if (mesesSet.has(m)) delete flags[k];
        });
        Object.assign(flags, flImport);
        return { ...st, months, fontes, forecasts, flags };
      });
    }
    return {
      origem: r.origem,
      meses: mks,
      pulados,
      totalLancamentos: mks.reduce((a, m) => a + (r.meses[m].cnt || 0), 0),
      forecasts: Object.keys(fcImport).length,
      flags: Object.keys(flImport).length,
      manuais: Object.values(flImport).filter((f) => f && f.manual).length,
    };
  }, [travas]);

  // ── mutações locais ──
  const setForecast = useCallback((key, value) => {
    setState((st) => {
      // forecast de mês travado não muda (prefixo da chave → mês)
      const pref = (String(key).match(/^[A-Z]{3}_/) || [''])[0];
      const mesDaChave = Object.keys(MES_PREFIX).find((mk) => MES_PREFIX[mk] === pref);
      if (mesDaChave && st.travas && st.travas[mesDaChave] && st.travas[mesDaChave].travado) return st;
      const forecasts = { ...st.forecasts };
      if (value === '' || value === null || isNaN(value)) delete forecasts[key];
      else forecasts[key] = Math.round(parseFloat(value) * 100) / 100;
      return { ...st, forecasts };
    });
  }, []);

  // Trava/destrava um mês (botão "Travar mês"). Travado: Sincronizar TOTVS
  // desabilitado, sem recarga automática e sem alteração de valores/forecast.
  const travarMes = useCallback((m, travado) => {
    setState((st) => {
      const travas = { ...(st.travas || {}) };
      if (travado) travas[m] = { travado: true, em: new Date().toISOString() };
      else delete travas[m];
      return { ...st, travas };
    });
  }, []);

  const recalcMonth = (mo) => {
    const cats = {};
    let total = 0;
    let cnt = 0;
    Object.entries(mo.details).forEach(([cat, rows]) => {
      const t = rows.reduce((s, r) => s + (parseFloat(r.val) || 0), 0);
      cats[cat] = t;
      total += t;
      cnt += rows.length;
    });
    Object.keys(mo.details).forEach((cat) => {
      if (!mo.details[cat].length) {
        delete mo.details[cat];
        delete cats[cat];
      }
    });
    mo.summary = Object.entries(cats)
      .map(([cat, t]) => ({ cat, total: Math.round(t * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
    mo.total = Math.round(total * 100) / 100;
    mo.cnt = cnt;
  };

  const mutateMonth = useCallback((m, fn) => {
    setState((st) => {
      // mês travado: nenhuma alteração de lançamentos/valores passa
      if (st.travas && st.travas[m] && st.travas[m].travado) return st;
      const months = { ...st.months, [m]: deepClone(st.months[m]) };
      const extra = fn(months[m], st) || {};
      recalcMonth(months[m]);
      return { ...st, months, ...extra };
    });
  }, []);

  const updateRow = useCallback(
    (m, cat, i, field, value) => {
      mutateMonth(m, (mo, st) => {
        const d = mo.details[cat] && mo.details[cat][i];
        if (!d) return;
        if (field === 'val') {
          const v = parseFloat(
            String(value).replace(/\./g, '').replace(',', '.'),
          );
          d.val = isNaN(v) ? d.val : Math.round(v * 100) / 100;
        } else d[field] = value;
        // observações de linhas TOTVS sobrevivem à re-sincronização
        if (field === 'obs' && d.id)
          return { obsEdits: { ...st.obsEdits, [d.id]: value } };
      });
    },
    [mutateMonth],
  );

  // Ao excluir um lançamento (ou a despesa inteira) na DRE Analítica, as flags
  // de correção/corte daquela linha NÃO somem: viram flags "snap:" (snapshot
  // completo do lançamento, marcadas excluido) e continuam nas páginas de
  // Correções DRE / Corte de custo. Flags por índice das linhas seguintes são
  // re-indexadas para continuarem apontando para a linha certa.
  const snapDeLinha = (row, atual) => ({
    ...(atual || {}),
    emp: row.emp ?? atual?.emp ?? '',
    forn: row.forn ?? atual?.forn ?? '',
    dupl: row.dupl ?? atual?.dupl ?? '',
    emis: row.emis ?? atual?.emis ?? '',
    venc: row.venc ?? atual?.venc ?? '',
    liq: row.liq ?? atual?.liq ?? '',
    val: row.val ?? atual?.val ?? 0,
    estag: row.estag ?? atual?.estag ?? '',
    obs: row.obs ?? atual?.obs ?? '',
  });
  const desvincularFlagsDaLinha = (flagsIn, m, cat, i, row) => {
    const flags = { ...flagsIn };
    const chaves = [`${m}||${cat}||${i}`];
    if (row && row.id) chaves.push(`${m}||${cat}||id:${row.id}`);
    const excluidoEm = new Date().toISOString();
    chaves.forEach((k) => {
      if (!flags[k]) return;
      const f = flags[k];
      const nova = `${m}||${cat}||snap:${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      flags[nova] = { ...f, snap: snapDeLinha(row || {}, f.snap), excluido: true, excluidoEm };
      delete flags[k];
    });
    // re-indexa flags por índice das linhas que vêm depois da excluída
    Object.keys(flags)
      .filter((k) => {
        const p = k.split('||');
        return p[0] === m && p[1] === cat && /^\d+$/.test(p[2] || '') && parseInt(p[2], 10) > i;
      })
      .sort((a, b) => parseInt(a.split('||')[2], 10) - parseInt(b.split('||')[2], 10))
      .forEach((k) => {
        const p = k.split('||');
        flags[`${m}||${cat}||${parseInt(p[2], 10) - 1}`] = flags[k];
        delete flags[k];
      });
    return flags;
  };

  const deleteRow = useCallback(
    (m, cat, i) => {
      mutateMonth(m, (mo, st) => {
        if (!mo.details[cat]) return;
        const row = mo.details[cat][i];
        const flags = desvincularFlagsDaLinha(st.flags, m, cat, i, row);
        mo.details[cat].splice(i, 1);
        return { flags };
      });
    },
    [mutateMonth],
  );

  const addRow = useCallback(
    (m, cat) => {
      const hoje = new Date().toLocaleDateString('pt-BR');
      mutateMonth(m, (mo) => {
        if (!mo.details[cat]) mo.details[cat] = [];
        mo.details[cat].push({
          emp: '1',
          forn: 'NOVO FORNECEDOR',
          dupl: '—',
          emis: hoje,
          venc: hoje,
          val: 0,
          estag: STATUS_LIST[2],
          obs: '',
        });
      });
    },
    [mutateMonth],
  );

  const addCategory = useCallback(
    (m, nome) => {
      const cat = nome.trim().toUpperCase();
      if (!cat) return false;
      let created = false;
      mutateMonth(m, (mo) => {
        if (mo.details[cat]) return;
        const hoje = new Date().toLocaleDateString('pt-BR');
        mo.details[cat] = [
          {
            emp: '1',
            forn: 'NOVO FORNECEDOR',
            dupl: '—',
            emis: hoje,
            venc: hoje,
            val: 0,
            estag: STATUS_LIST[2],
            obs: '',
          },
        ];
        created = true;
      });
      return created;
    },
    [mutateMonth],
  );

  const deleteCategory = useCallback(
    (m, cat) => {
      mutateMonth(m, (mo, st) => {
        const rows = mo.details[cat] || [];
        // converte as flags de TODAS as linhas da despesa em snapshots (do último
        // índice para o primeiro, para a re-indexação não interferir)
        let flags = st.flags;
        for (let i = rows.length - 1; i >= 0; i--) {
          flags = desvincularFlagsDaLinha(flags, m, cat, i, rows[i]);
        }
        delete mo.details[cat];
        return { flags };
      });
    },
    [mutateMonth],
  );

  // ── flags (correções / corte) ──
  // chave estável: linhas TOTVS usam o id da duplicata; linhas de planilha, o índice
  const flagKeyFor = useCallback((m, cat, row, i) => {
    return row && row.id ? `${m}||${cat}||id:${row.id}` : `${m}||${cat}||${i}`;
  }, []);

  const toggleFlag = useCallback(
    (tipo, m, cat, i, row) => {
      setState((st) => {
        const flags = { ...st.flags };
        const d =
          row ||
          (st.months[m] &&
            st.months[m].details[cat] &&
            st.months[m].details[cat][i]);
        const key =
          d && d.id ? `${m}||${cat}||id:${d.id}` : `${m}||${cat}||${i}`;
        const cur = flags[key];
        if (cur && cur.tipo === tipo) delete flags[key];
        else if (cur) flags[key] = { ...cur, tipo };
        else
          flags[key] = {
            tipo,
            nota: '',
            status: FLAG_STATUS[0],
            // snapshot completo: se o lançamento for excluído da DRE, a flag
            // continua com todos os dados nas páginas de correção/corte
            snap: d
              ? {
                  forn: d.forn,
                  dupl: d.dupl,
                  emis: d.emis,
                  venc: d.venc,
                  liq: d.liq,
                  val: d.val,
                  emp: d.emp,
                  estag: d.estag,
                  obs: d.obs,
                }
              : null,
          };
        return { ...st, flags };
      });
    },
    [],
  );

  const addManualFlag = useCallback((tipo) => {
    const id = `man||${Date.now()}||${Math.floor(Math.random() * 1000)}`;
    setState((st) => ({
      ...st,
      flags: {
        ...st.flags,
        [id]: {
          tipo,
          nota: '',
          status: FLAG_STATUS[0],
          manual: true,
          mes: 'jan',
          cat: '',
          snap: { forn: '', dupl: '', venc: '', val: 0, emp: '', estag: '' },
        },
      },
    }));
    return id;
  }, []);

  const updateFlag = useCallback((key, patch) => {
    setState((st) => {
      if (!st.flags[key]) return st;
      const f = { ...st.flags[key] };
      Object.entries(patch).forEach(([k, v]) => {
        if (k.startsWith('snap.'))
          f.snap = { ...(f.snap || {}), [k.slice(5)]: v };
        else f[k] = v;
      });
      return { ...st, flags: { ...st.flags, [key]: f } };
    });
  }, []);

  const removeFlag = useCallback((key) => {
    setState((st) => {
      const flags = { ...st.flags };
      delete flags[key];
      return { ...st, flags };
    });
  }, []);

  // dados "vivos" de um flag: linha atual, ou o snapshot se não existe mais
  const flagRowData = useCallback(
    (key) => {
      const f = flags[key];
      if (f && f.manual)
        return {
          m: f.mes,
          cat: f.cat,
          d: f.snap || {},
          existe: true,
          manual: true,
        };
      const [m, cat, ref] = key.split('||');
      let live = null;
      if (ref && ref.startsWith('id:')) {
        const id = ref.slice(3);
        const rows = (months[m] && months[m].details[cat]) || [];
        live = rows.find((r) => r.id === id) || null;
      } else if (ref && ref.startsWith('snap:')) {
        live = null; // referência histórica da planilha — usa só o snapshot
      } else {
        const i = parseInt(ref, 10);
        live =
          (months[m] && months[m].details[cat] && months[m].details[cat][i]) ||
          null;
      }
      return {
        m,
        cat,
        d: live || (f && f.snap) || {},
        existe: !!live || (ref && ref.startsWith('snap:')),
        excluido: !!(f && f.excluido), // lançamento foi excluído na DRE; flag segue pelo snapshot
        manual: false,
      };
    },
    [flags, months],
  );

  // ── export / import / reset ──
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 1)], {
      type: 'application/json;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download =
      'despesas_gerais_2026_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }, [state]);

  const importJson = useCallback((file, onDone) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.months) throw new Error('arquivo sem "months"');
        setState((st) => ({
          months: parsed.months,
          forecasts: parsed.forecasts || {},
          flags: parsed.flags || {},
          fontes: parsed.fontes || st.fontes,
          obsEdits: parsed.obsEdits || {},
          travas: parsed.travas || st.travas || {},
          analisadas: parsed.analisadas || st.analisadas || {},
        }));
        onDone && onDone(null);
      } catch (e) {
        onDone && onDone(e);
      }
    };
    reader.readAsText(file);
  }, []);

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setState(loadInitial());
  }, []);

  const flagCounts = useMemo(() => {
    const c = { correcao: 0, corte: 0 };
    Object.values(flags).forEach((f) => {
      if (c[f.tipo] !== undefined) c[f.tipo] += 1;
    });
    return c;
  }, [flags]);

  const value = {
    months,
    forecasts,
    flags,
    fontes,
    travas,
    travarMes,
    mesTravado,
    analisadas,
    catAnalisada,
    toggleAnalisada,
    ultimaSyncDespesa,
    limparUltimaSyncDespesa: () => setUltimaSyncDespesa(null),
    hcRows: baseData.hcRows,
    activeMonth,
    setActiveMonth,
    mesesAtivos,
    carregandoMes,
    erroMes,
    carregarMesTotvs,
    fcKeyFor,
    fcTotalFor,
    forecastPadraoFor,
    realizadoCatMes,
    mergeRealizedG,
    importarMesesHtml,
    setForecast,
    updateRow,
    deleteRow,
    addRow,
    addCategory,
    deleteCategory,
    flagKeyFor,
    toggleFlag,
    addManualFlag,
    updateFlag,
    removeFlag,
    flagRowData,
    flagCounts,
    exportJson,
    importJson,
    resetAll,
  };

  return (
    <DespesasGeraisContext.Provider value={value}>
      {children}
    </DespesasGeraisContext.Provider>
  );
}

export function useDespesasGerais() {
  const ctx = useContext(DespesasGeraisContext);
  if (!ctx)
    throw new Error(
      'useDespesasGerais deve ser usado dentro de DespesasGeraisProvider',
    );
  return ctx;
}
