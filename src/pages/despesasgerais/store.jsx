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
export const CONSULTA_VERSAO = 'emissao-normais-v3';

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
        if (v !== undefined && v !== null && v !== '')
          soma += parseFloat(v) || 0;
      });
      return Math.round(soma * 100) / 100;
    },
    [months, forecasts, fcKeyFor],
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
  const carregarMesTotvs = useCallback(
    async (m, { somenteGerais = true } = {}) => {
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
        // classifica: só despesas do grupo "DESPESAS GERAIS" (exceções + faixa 6000-6999)
        if (somenteGerais) {
          itens = itens.filter(
            (it) => classificarDespesa(it.cd_despesaitem) === 'DESPESAS GERAIS',
          );
        }

        setState((st) => {
          const details = {};
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
              obs: st.obsEdits[rowId] || '',
            });
          });
          // ordena lançamentos por valor desc dentro de cada categoria
          Object.values(details).forEach((rows) =>
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
          const cnt = itens.length;

          // desvincula flags indexados da planilha deste mês (dados trocaram):
          // a linha vive no snapshot e não aponta mais para um índice vivo
          const flags = { ...st.flags };
          Object.keys(flags).forEach((k) => {
            const parts = k.split('||');
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
              [m]: {
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

  // ── mutações locais ──
  const setForecast = useCallback((key, value) => {
    setState((st) => {
      const forecasts = { ...st.forecasts };
      if (value === '' || value === null || isNaN(value)) delete forecasts[key];
      else forecasts[key] = Math.round(parseFloat(value) * 100) / 100;
      return { ...st, forecasts };
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

  const deleteRow = useCallback(
    (m, cat, i) => {
      mutateMonth(m, (mo) => {
        if (mo.details[cat]) mo.details[cat].splice(i, 1);
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
      mutateMonth(m, (mo) => {
        delete mo.details[cat];
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
            snap: d
              ? {
                  forn: d.forn,
                  dupl: d.dupl,
                  venc: d.venc,
                  val: d.val,
                  emp: d.emp,
                  estag: d.estag,
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
    hcRows: baseData.hcRows,
    activeMonth,
    setActiveMonth,
    mesesAtivos,
    carregandoMes,
    erroMes,
    carregarMesTotvs,
    fcKeyFor,
    fcTotalFor,
    mergeRealizedG,
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
