// New Forecast — planilha FORCAST integrada ao Painel de Vendas.
//
// - Período livre (Data Início/Fim); semanas em blocos de 7 dias ajustáveis.
// - Canais automáticos preenchidos pelo /sale-panel/faturamento-vendedor-semanal,
//   que já devolve o DRILL de cada semana (vendedores + vendas, lojas do varejo,
//   clientes da expedição) — clicar na célula NÃO refaz busca nenhuma.
//   Única exceção: clientes de um vendedor de loja do varejo (nível 3),
//   buscados sob demanda por serem milhares de linhas.
// - Célula de semana é somente leitura (R$ BR); o ajuste (override) fica no modal.
// - Semanas, metas, manuais e overrides persistem na tabela new_forecast_config
//   (Supabase), com fallback em localStorage.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChartLineUp,
  ArrowClockwise,
  Target,
  Spinner,
  Plugs,
  MagnifyingGlass,
  X,
  CaretLeft,
  CurrencyDollar,
  Percent,
  Warning,
  Crosshair,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import { TotvsURL } from '../config/constants';

// --- Canais + metas padrão (planilha FORCAST) --------------------------------
// fonte: chave no endpoint semanal (null = 100% manual)
// codes: vendedores do canal (drill) · expedicao: 'showroom'|'novidades'
const CANAIS_BASE = [
  { canal: 'BAZAR', fonte: 'BAZAR', meta: 20000, expedicao: 'bazar' },
  { canal: 'NOVIDADES', fonte: 'NOVIDADES', meta: 0, expedicao: 'novidades' },
  { canal: 'FARDAMENTO', fonte: null, meta: 0 },
  { canal: 'SHOWROOM / FABRICAS', fonte: 'SHOWROOM', meta: 350000, expedicao: 'showroom' },
  { canal: 'FRANQUIAS', fonte: 'FRANQUIAS', meta: 150000, codes: [40] },
  { canal: 'REVENDA', fonte: 'REVENDA', meta: 165000, codes: [161, 241, 165] },
  { canal: 'REVENDA MAX', fonte: null, meta: 0 },
  { canal: 'MTM RAFAEL', fonte: 'MTM_RAFAEL', meta: 100000, codes: [21] },
  { canal: 'MTM DAVID', fonte: 'MTM_DAVID', meta: 65000, codes: [26] },
  { canal: 'MTM ARTHUR', fonte: 'MTM_ARTHUR', meta: 90000, codes: [259] },
  { canal: 'VAREJO', fonte: 'VAREJO', meta: 363400, varejo: true },
  // clientes com contrato BlueCred × faturas de crediário (pseudo-vendedor -1000)
  { canal: 'BLUECRED', fonte: 'BLUECRED', meta: 25000, codes: [-1000], direto: true },
  // op 512 não gera NF: vem do contas a receber como pseudo-vendedor -512
  { canal: 'RICARDO ELETRO', fonte: 'RICARDO_ELETRO', meta: 12000, codes: [-512], direto: true },
  { canal: 'MALA', fonte: null, meta: 10 },
  // Cartões: contados em UNIDADES (qtd), fora dos totais em R$
  { canal: 'CARTÃO PB', fonte: null, meta: 50, qtd: true },
  { canal: 'CARTÃO RN', fonte: null, meta: 100, qtd: true },
  { canal: 'CARTÃO PI', fonte: null, meta: 50, qtd: true },
  { canal: 'CARTÃO PE', fonte: null, meta: 50, qtd: true },
  { canal: 'CARTÃO PB - PATOS', fonte: null, meta: 50, qtd: true },
];

const OP_NOVIDADES = 7255;
const OPS_BAZAR = [887, 888, 889];

const STORAGE_PREFIX = 'new_forecast_v3_';
const AUTO_CACHE_PREFIX = 'new_forecast_auto_v3_';

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioMesAtual = () => `${hoje().slice(0, 7)}-01`;
const fimMesAtual = () => {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${hoje().slice(0, 7)}-${String(last).padStart(2, '0')}`;
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Semanas padrão do período: blocos de 7 dias a partir da data início
const defaultSemanas = (ini, fim) => {
  const out = [];
  let cur = ini;
  let s = 1;
  while (cur <= fim && s <= 10) {
    const fimBloco = addDays(cur, 6);
    out.push({ s, datemin: cur, datemax: fimBloco <= fim ? fimBloco : fim });
    cur = addDays(out[out.length - 1].datemax, 1);
    s++;
  }
  return out;
};

const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

const formatInt = (v) => (Number(v) || 0).toLocaleString('pt-BR');

// Canais de cartão são medidos em unidades; o resto em R$
const fmtValor = (v, qtd) =>
  qtd ? `${formatInt(v)} und` : formatBRL(v);

// Converte texto digitado ("1.234,56" ou "1234.56") em número.
const parseNum = (str) => {
  if (str === '' || str == null) return 0;
  let s = String(str).trim().replace(/\s|R\$/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const emptyStore = () => ({ manual: {}, overrides: {}, metas: {}, semanas: null });

const loadLocal = (key) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        return {
          manual: saved.manual || {},
          overrides: saved.overrides || {},
          metas: saved.metas || {},
          semanas: Array.isArray(saved.semanas) ? saved.semanas : null,
        };
      }
    }
  } catch (_) {
    /* ignore */
  }
  return emptyStore();
};

const loadAutoCache = (key) => {
  try {
    const raw = localStorage.getItem(AUTO_CACHE_PREFIX + key);
    if (raw) return JSON.parse(raw) || {};
  } catch (_) {
    /* ignore */
  }
  return {};
};

const semanasSig = (semanas) =>
  (semanas || []).map((w) => `${w.datemin}~${w.datemax}`).join(',');

const ddmm = (iso) =>
  iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';

// Agrupa as vendas por cliente (nível intermediário do drill): soma valores
// e guarda as faturas de cada um para o nível seguinte.
const agruparPorCliente = (vendas) => {
  const mapa = new Map();
  for (const v of vendas || []) {
    const code = v.cliente_code;
    const cur = mapa.get(code) || {
      cliente_code: code,
      cliente_nome: v.cliente_nome || `Cliente ${code}`,
      qtd: 0,
      valor: 0,
      vendas: [],
    };
    if (v.cliente_nome) cur.cliente_nome = v.cliente_nome;
    cur.qtd += 1;
    cur.valor += Number(v.valor || 0);
    cur.vendas.push(v);
    mapa.set(code, cur);
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, valor: Math.round(c.valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor);
};

// Input de dinheiro: mostra R$ formatado quando não está focado; ao focar,
// vira número puro pra edição. FORA do componente da página (senão o React
// recria o tipo a cada render e o input perde o foco a cada tecla).
const MoneyInput = ({ value, onChange, strong, qtd }) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const num = parseNum(value);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? draft : num === 0 ? '' : fmtValor(num, qtd)}
      placeholder={qtd ? '0 und' : 'R$ 0,00'}
      onFocus={() => {
        setDraft(num === 0 ? '' : String(num).replace('.', ','));
        setFocused(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        onChange(parseNum(draft));
      }}
      className={`w-full bg-transparent text-right px-2 py-1.5 rounded-md border border-transparent hover:border-gray-200 focus:border-[#000638] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#000638]/30 transition ${
        strong ? 'font-semibold text-[#000638]' : 'text-gray-700'
      }`}
    />
  );
};

const NewForecast = () => {
  const apiClient = useApiClient();
  const [draftIni, setDraftIni] = useState(inicioMesAtual());
  const [draftFim, setDraftFim] = useState(fimMesAtual());
  const [periodo, setPeriodo] = useState({
    ini: inicioMesAtual(),
    fim: fimMesAtual(),
  });
  const periodKey = `${periodo.ini}|${periodo.fim}`;

  const [store, setStore] = useState(emptyStore);
  const [auto, setAuto] = useState({});
  // drill por semana (vem junto do endpoint semanal): { s1: {vendedores, varejo, expedicao} }
  const [drillData, setDrillData] = useState({});
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoErro, setAutoErro] = useState('');
  const [editSemanas, setEditSemanas] = useState(false);
  const fetchSeq = useRef(0);
  const saveTimer = useRef(null);
  const storeLoaded = useRef(false);

  // Modo apresentação: destaca as linhas dos canais e/ou as colunas das
  // semanas clicados — aceita vários (efêmero, não persiste).
  const [focoCanais, setFocoCanais] = useState([]);
  const [focoSemanas, setFocoSemanas] = useState([]);
  const toggleFoco = (setter) => (v) =>
    setter((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  const toggleCanal = toggleFoco(setFocoCanais);
  const toggleSemana = toggleFoco(setFocoSemanas);

  // Nomes das lojas (mesma rota do FiltroEmpresa) — o drill do varejo mostra
  // "CROSBY SHOPPING MIDWAY" em vez de "95".
  const [branchNames, setBranchNames] = useState({});
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`${TotvsURL}branches`);
        if (!r.ok) return;
        const json = await r.json();
        let empresas = json?.data?.data || json?.data || [];
        if (!Array.isArray(empresas)) empresas = [];
        const mapa = {};
        for (const emp of empresas) {
          const code = parseInt(emp.cd_empresa);
          if (!Number.isFinite(code)) continue;
          mapa[code] =
            emp.nm_grupoempresa || emp.fantasyName || emp.description || null;
        }
        if (vivo) setBranchNames(mapa);
      } catch (_) {
        /* sem nomes: cai no código da filial */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  const nomeFilial = (code) => branchNames[Number(code)] || `Filial ${code}`;

  // drill modal: { canal, week, stack: [view] }
  const [drill, setDrill] = useState(null);
  // clientes de vendedor de loja (varejo, nível 3 — único fetch sob demanda)
  const [vendasCache, setVendasCache] = useState({});

  const semanasDef = useMemo(
    () =>
      store.semanas?.length
        ? store.semanas
        : defaultSemanas(periodo.ini, periodo.fim),
    [store.semanas, periodo],
  );
  const SEMANAS = useMemo(() => semanasDef.map((w) => `s${w.s}`), [semanasDef]);

  // ─── Carrega config (Supabase → fallback local) + busca painel ──────────
  useEffect(() => {
    let vivo = true;
    (async () => {
      storeLoaded.current = false;
      let st = null;
      try {
        const r = await apiClient.totvs.newForecastConfigGet(
          periodo.ini,
          periodo.fim,
        );
        const row = r?.data ?? r;
        if (row && typeof row === 'object' && row.period_key) {
          st = {
            manual: row.manual || {},
            overrides: row.overrides || {},
            metas: row.metas || {},
            semanas: Array.isArray(row.semanas) ? row.semanas : null,
          };
        }
      } catch (_) {
        /* backend fora — cai no localStorage */
      }
      if (!vivo) return;
      if (!st) st = loadLocal(periodKey);
      setStore(st);
      storeLoaded.current = true;
      const semanas = st.semanas?.length
        ? st.semanas
        : defaultSemanas(periodo.ini, periodo.fim);
      setAuto(loadAutoCache(`${periodKey}|${semanasSig(semanas)}`));
      setDrillData({});
      buscarPainel(periodo, semanas);
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  // ─── Persiste config: localStorage + Supabase (debounce) ────────────────
  useEffect(() => {
    if (!storeLoaded.current) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + periodKey, JSON.stringify(store));
    } catch (_) {
      /* ignore */
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiClient.totvs
        .newForecastConfigSave({
          datemin: periodo.ini,
          datemax: periodo.fim,
          semanas: store.semanas,
          metas: store.metas,
          manual: store.manual,
          overrides: store.overrides,
        })
        .catch(() => {
          /* backend fora — fica no localStorage */
        });
    }, 1000);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, periodKey]);

  const buscarPainel = async (p, semanas) => {
    const seq = ++fetchSeq.current;
    const semanasUsadas = semanas || semanasDef;
    setAutoLoading(true);
    setAutoErro('');
    try {
      const r = await apiClient.totvs.salePanelFaturamentoVendedorSemanal({
        datemin: p.ini,
        datemax: p.fim,
        semanas: semanasUsadas,
      });
      if (seq !== fetchSeq.current) return;
      const payload = r?.data ?? r;
      const canais = payload?.canais || {};
      setAuto(canais);
      setDrillData(payload?.drill || {});
      try {
        localStorage.setItem(
          AUTO_CACHE_PREFIX + `${p.ini}|${p.fim}|${semanasSig(semanasUsadas)}`,
          JSON.stringify(canais),
        );
      } catch (_) {
        /* drill não vai pro localStorage (grande demais) */
      }
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      setAutoErro(e.message || 'Falha ao buscar o Painel de Vendas.');
    } finally {
      if (seq === fetchSeq.current) setAutoLoading(false);
    }
  };

  const aplicarPeriodo = () => {
    if (!draftIni || !draftFim || draftIni > draftFim) return;
    setEditSemanas(false);
    setDrill(null);
    setPeriodo({ ini: draftIni, fim: draftFim });
  };

  // ─── Valores das células ────────────────────────────────────────────────
  const cellValue = (c, k) => {
    if (c.fonte) {
      const ovr = store.overrides?.[c.canal]?.[k];
      if (ovr !== undefined && ovr !== null && ovr !== '') return ovr;
      return auto?.[c.fonte]?.[k] ?? 0;
    }
    return store.manual?.[c.canal]?.[k] ?? 0;
  };
  const autoValue = (c, k) => (c.fonte ? auto?.[c.fonte]?.[k] ?? 0 : null);
  const isOverridden = (c, k) => {
    const ovr = store.overrides?.[c.canal]?.[k];
    return !!c.fonte && ovr !== undefined && ovr !== null && ovr !== '';
  };

  const setCell = (c, k, value) => {
    setStore((prev) => {
      const bucket = c.fonte ? 'overrides' : 'manual';
      return {
        ...prev,
        [bucket]: {
          ...prev[bucket],
          [c.canal]: { ...(prev[bucket]?.[c.canal] || {}), [k]: value },
        },
      };
    });
  };
  const clearOverrideCell = (c, k) => {
    setStore((prev) => {
      const canalOvr = { ...(prev.overrides?.[c.canal] || {}) };
      delete canalOvr[k];
      const overrides = { ...prev.overrides, [c.canal]: canalOvr };
      if (Object.keys(canalOvr).length === 0) delete overrides[c.canal];
      return { ...prev, overrides };
    });
  };

  // ─── Semanas ────────────────────────────────────────────────────────────
  const setSemanaData = (idx, field, value) => {
    setStore((prev) => {
      const base = prev.semanas?.length
        ? prev.semanas
        : defaultSemanas(periodo.ini, periodo.fim);
      const semanas = base.map((w, i) =>
        i === idx ? { ...w, [field]: value } : w,
      );
      return { ...prev, semanas };
    });
  };
  const aplicarSemanas = () => {
    setEditSemanas(false);
    setAuto(loadAutoCache(`${periodKey}|${semanasSig(semanasDef)}`));
    setDrillData({});
    buscarPainel(periodo, semanasDef);
  };
  const resetSemanas = () => {
    const padrao = defaultSemanas(periodo.ini, periodo.fim);
    setStore((prev) => ({ ...prev, semanas: null }));
    setEditSemanas(false);
    setAuto(loadAutoCache(`${periodKey}|${semanasSig(padrao)}`));
    setDrillData({});
    buscarPainel(periodo, padrao);
  };

  const metaValue = (c) => store.metas?.[c.canal] ?? c.meta;
  const setMeta = (c, value) => {
    setStore((prev) => ({
      ...prev,
      metas: { ...prev.metas, [c.canal]: value },
    }));
  };

  const calc = (c) => {
    const realizado = SEMANAS.reduce((acc, k) => acc + parseNum(cellValue(c, k)), 0);
    const meta = parseNum(metaValue(c));
    const pct = meta > 0 ? (realizado / meta) * 100 : 0;
    const falta = Math.max(meta - realizado, 0);
    return { realizado, meta, pct, falta };
  };

  // Totais em R$ — canais medidos em unidades (cartões) ficam de fora
  const totals = useMemo(() => {
    const acc = { realizado: 0, meta: 0, falta: 0 };
    for (const k of SEMANAS) acc[k] = 0;
    for (const c of CANAIS_BASE) {
      if (c.qtd) continue;
      const { realizado, meta, falta } = calc(c);
      for (const k of SEMANAS) acc[k] += parseNum(cellValue(c, k));
      acc.realizado += realizado;
      acc.meta += meta;
      acc.falta += falta;
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, auto, SEMANAS]);

  const totalPct = totals.meta > 0 ? (totals.realizado / totals.meta) * 100 : 0;

  // Soma do que está em foco (canais × semanas selecionados). Sem canal em
  // foco vale a coluna inteira; sem semana em foco, a linha inteira.
  const foco = useMemo(() => {
    const canais = focoCanais.length
      ? CANAIS_BASE.filter((c) => focoCanais.includes(c.canal))
      : CANAIS_BASE;
    const semanas = focoSemanas.length
      ? semanasDef.filter((w) => focoSemanas.includes(w.s))
      : semanasDef;
    let brl = 0;
    let und = 0;
    for (const c of canais) {
      for (const w of semanas) {
        const v = parseNum(cellValue(c, `s${w.s}`));
        if (c.qtd) und += v;
        else brl += v;
      }
    }
    // Rótulo: "BAZAR × Semana 2", "2 canais × 3 semanas", "BAZAR × todas"
    const parteCanal =
      focoCanais.length === 0
        ? 'todos os canais'
        : focoCanais.length === 1
          ? focoCanais[0]
          : `${focoCanais.length} canais`;
    const parteSemana =
      focoSemanas.length === 0
        ? 'todas as semanas'
        : focoSemanas.length === 1
          ? `Semana ${focoSemanas[0]}`
          : `${focoSemanas.length} semanas`;
    return { brl, und, label: `${parteCanal} × ${parteSemana}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoCanais, focoSemanas, semanasDef, store, auto]);

  const handleReset = () => {
    if (
      window.confirm(
        'Limpar edições deste período (canais manuais, overrides, metas e semanas ajustadas)?',
      )
    ) {
      localStorage.removeItem(STORAGE_PREFIX + periodKey);
      setStore(emptyStore());
    }
  };

  // Consolidado de TODAS as semanas — usado no clique da coluna "Realizado".
  const drillTotal = useMemo(() => {
    const vendedores = {};
    const varejoMap = new Map();
    const expedicao = [];
    for (const w of semanasDef) {
      const d = drillData[`s${w.s}`];
      if (!d) continue;
      for (const [code, v] of Object.entries(d.vendedores || {})) {
        const cur = vendedores[code] || {
          seller_code: v.seller_code,
          seller_name: v.seller_name,
          qtd: 0,
          valor: 0,
          vendas: [],
        };
        if (v.seller_name) cur.seller_name = v.seller_name;
        cur.qtd += v.qtd || 0;
        cur.valor = Math.round((cur.valor + (v.valor || 0)) * 100) / 100;
        cur.vendas = [...cur.vendas, ...(v.vendas || [])];
        vendedores[code] = cur;
      }
      for (const l of d.varejo || []) {
        const cur = varejoMap.get(l.branch_code) || {
          branch_code: l.branch_code,
          qtd: 0,
          valor: 0,
          sellersMap: new Map(),
        };
        cur.qtd += l.qtd || 0;
        cur.valor = Math.round((cur.valor + (l.valor || 0)) * 100) / 100;
        for (const s of l.sellers || []) {
          const sc = cur.sellersMap.get(s.seller_code) || {
            seller_code: s.seller_code,
            seller_name: s.seller_name,
            qtd: 0,
            valor: 0,
          };
          if (s.seller_name) sc.seller_name = s.seller_name;
          sc.qtd += s.qtd || 0;
          sc.valor = Math.round((sc.valor + (s.valor || 0)) * 100) / 100;
          cur.sellersMap.set(s.seller_code, sc);
        }
        varejoMap.set(l.branch_code, cur);
      }
      expedicao.push(...(d.expedicao || []));
    }
    const varejo = [...varejoMap.values()]
      .map((l) => ({
        branch_code: l.branch_code,
        qtd: l.qtd,
        valor: l.valor,
        sellers: [...l.sellersMap.values()].sort((a, b) => b.valor - a.valor),
      }))
      .sort((a, b) => b.valor - a.valor);
    return { vendedores, varejo, expedicao };
  }, [drillData, semanasDef]);

  // ─── Drill ──────────────────────────────────────────────────────────────
  // week === null → período inteiro (clique na coluna "Realizado")
  const janela = (w) =>
    w
      ? { datemin: w.datemin, datemax: w.datemax }
      : { datemin: periodo.ini, datemax: periodo.fim };
  const weekKeyOf = (w) => {
    const j = janela(w);
    return `${j.datemin}|${j.datemax}`;
  };

  // Nível 3 do varejo: clientes de um vendedor de loja (único fetch sob demanda)
  const fetchVendasVarejo = (sellerCode, w) => {
    const key = `${sellerCode}|${weekKeyOf(w)}`;
    if (vendasCache[key]) return;
    apiClient.totvs
      .salePanelFaturamentoVendedorDetalhe({
        seller_code: sellerCode,
        filtroempresa: [],
        ...janela(w),
      })
      .then((r) => {
        const p = r?.data ?? r;
        setVendasCache((c) => ({ ...c, [key]: { vendas: p.vendas || [] } }));
      })
      .catch((e) => {
        setVendasCache((c) => ({
          ...c,
          [key]: { vendas: [], erro: e.message || 'Erro ao buscar vendas.' },
        }));
      });
  };

  const abrirCelula = (c, w) => {
    setDrill({ canal: c, week: w, stack: [{ tipo: 'root' }] });
  };
  // Coluna "Realizado": mesmo drill, consolidando todas as semanas
  const abrirRealizado = (c) => {
    setDrill({ canal: c, week: null, stack: [{ tipo: 'root' }] });
  };
  const pushView = (v) =>
    setDrill((d) => (d ? { ...d, stack: [...d.stack, v] } : d));
  const popView = () =>
    setDrill((d) =>
      d && d.stack.length > 1 ? { ...d, stack: d.stack.slice(0, -1) } : d,
    );

  const pctColor = (pct) => {
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };
  const barColor = (pct) => {
    if (pct >= 100) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  // ─── Render do conteúdo do modal ────────────────────────────────────────
  const renderDrill = () => {
    if (!drill) return null;
    const { canal: c, week: w } = drill;
    const view = drill.stack[drill.stack.length - 1];
    // week null = coluna "Realizado" → consolidado de todas as semanas
    const kSem = w ? `s${w.s}` : null;
    const dSem = w ? drillData[kSem] : drillTotal;

    const thCls = 'px-3 py-1.5 font-semibold text-[#000638] border-b';

    // Nível de clientes: agrupado, com soma; clique abre as faturas do cliente
    const tabelaClientes = (vendas) => {
      const clientes = agruparPorCliente(vendas);
      const total = vendas.reduce((a, v) => a + (v.valor || 0), 0);
      return (
        <>
          <p className="text-[11px] text-gray-400 mb-2">
            {formatInt(clientes.length)} cliente(s) &bull;{' '}
            {formatInt(vendas.length)} venda(s) &bull; {formatBRL(total)}
          </p>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#000638]/5">
                <th className={thCls}>Código</th>
                <th className={thCls}>Cliente</th>
                <th className={`${thCls} text-right`}>Vendas</th>
                <th className={`${thCls} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cl) => (
                <tr
                  key={cl.cliente_code}
                  onClick={() =>
                    pushView({
                      tipo: 'faturas',
                      titulo: cl.cliente_nome,
                      vendas: cl.vendas,
                    })
                  }
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-3 py-1.5">{cl.cliente_code}</td>
                  <td className="px-3 py-1.5">{cl.cliente_nome}</td>
                  <td className="px-3 py-1.5 text-right">{formatInt(cl.qtd)}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {formatBRL(cl.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    };

    // Nível final: faturas de um cliente
    const tabelaFaturas = (vendas) => (
      <>
        <p className="text-[11px] text-gray-400 mb-2">
          {formatInt(vendas.length)} venda(s) &bull;{' '}
          {formatBRL(vendas.reduce((a, v) => a + (v.valor || 0), 0))}
        </p>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-[#000638]/5">
              <th className={thCls}>Data</th>
              <th className={thCls}>Fatura</th>
              <th className={thCls}>Filial</th>
              <th className={`${thCls} text-right`}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-1.5 whitespace-nowrap">{ddmm(v.data)}</td>
                <td className="px-3 py-1.5">{v.fatura || '—'}</td>
                <td className="px-3 py-1.5">{nomeFilial(v.branch_code)}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  {formatBRL(v.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );

    const carregando = (
      <div className="flex justify-center py-8 gap-2 text-gray-500 text-sm">
        <Spinner size={18} className="animate-spin" />
        {autoLoading
          ? 'O Painel de Vendas ainda está carregando esta semana...'
          : 'Sem dados desta semana — clique em "Painel" para buscar.'}
      </div>
    );

    // ─ Nível faturas de um cliente (último nível) ─
    if (view.tipo === 'faturas') {
      return tabelaFaturas(view.vendas || []);
    }

    // ─ Nível clientes (agrupados) do vendedor ─
    if (view.tipo === 'vendas') {
      // vendas embutidas (atacado) ou sob demanda (vendedor de loja)
      if (view.vendas) {
        return view.vendas.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">Nenhuma venda.</div>
        ) : (
          tabelaClientes(view.vendas)
        );
      }
      const entry = vendasCache[`${view.sellerCode}|${weekKeyOf(w)}`];
      if (!entry)
        return (
          <div className="flex justify-center py-8 gap-2 text-gray-500 text-sm">
            <Spinner size={18} className="animate-spin" /> Buscando clientes...
          </div>
        );
      if (entry.erro)
        return <div className="text-sm text-rose-600 py-4">{entry.erro}</div>;
      let vendas = entry.vendas;
      if (view.filial != null)
        vendas = vendas.filter((v) => Number(v.branch_code) === Number(view.filial));
      return vendas.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">Nenhuma venda.</div>
      ) : (
        tabelaClientes(vendas)
      );
    }

    // ─ Nível vendedores (loja do varejo) ─
    if (view.tipo === 'vendedores') {
      return (
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-[#000638]/5">
              <th className={thCls}>Código</th>
              <th className={thCls}>Vendedor</th>
              <th className={`${thCls} text-right`}>Qtd</th>
              <th className={`${thCls} text-right`}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {view.vendedores.map((v) => (
              <tr
                key={v.code}
                onClick={() => {
                  pushView({
                    tipo: 'vendas',
                    titulo: v.nome || `Vend. ${v.code}`,
                    sellerCode: v.code,
                    filial: view.filial,
                  });
                  fetchVendasVarejo(v.code, w);
                }}
                className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-3 py-1.5">{v.code}</td>
                <td className="px-3 py-1.5">{v.nome || '—'}</td>
                <td className="px-3 py-1.5 text-right">{v.qtd}</td>
                <td className="px-3 py-1.5 text-right">{formatBRL(v.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // ─ Nível root: ajuste + drill do canal ─
    const valorPainel = autoValue(c, kSem);
    const ovr = store.overrides?.[c.canal]?.[kSem];

    const blocoAjuste = !w ? null : (
      <div className="mb-4 border border-[#000638]/10 rounded-lg p-3 bg-[#f8f9fb]">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[11px] text-gray-500 mb-0.5">
              {c.fonte ? 'Valor do Painel de Vendas' : 'Valor da célula'}
            </p>
            <p className="text-sm font-bold text-[#000638]">
              {c.fonte
                ? fmtValor(valorPainel, c.qtd)
                : fmtValor(parseNum(cellValue(c, kSem)), c.qtd)}
            </p>
          </div>
          <div className="flex-1 min-w-[160px]">
            <p className="text-[11px] text-gray-500 mb-0.5">
              {c.fonte ? 'Ajustar valor (override)' : 'Digitar valor'}
            </p>
            <input
              type="text"
              inputMode="decimal"
              defaultValue={
                c.fonte
                  ? ovr !== undefined && ovr !== null && ovr !== ''
                    ? ovr
                    : ''
                  : store.manual?.[c.canal]?.[kSem] || ''
              }
              placeholder={
                c.fonte ? fmtValor(valorPainel, c.qtd) : c.qtd ? '0 und' : 'R$ 0,00'
              }
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (c.fonte && raw === '') clearOverrideCell(c, kSem);
                else setCell(c, kSem, parseNum(raw));
              }}
              className="w-full border border-[#000638]/30 rounded-md px-3 py-1.5 text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]"
            />
          </div>
          {isOverridden(c, kSem) && (
            <button
              onClick={() => clearOverrideCell(c, kSem)}
              className="text-xs border border-amber-300 text-amber-700 rounded-md px-3 py-1.5 hover:bg-amber-50"
            >
              Voltar ao painel
            </button>
          )}
        </div>
        {c.fonte && (
          <p className="text-[10px] text-gray-400 mt-1.5">
            O ajuste vale só para esta célula; deixe vazio para usar o valor do
            painel.
          </p>
        )}
      </div>
    );

    let corpo = null;
    if (c.expedicao) {
      if (!dSem) corpo = carregando;
      else {
        const vendas = (dSem.expedicao || []).filter((v) => {
          if (c.expedicao === 'novidades') return v.op === OP_NOVIDADES;
          if (c.expedicao === 'bazar') return OPS_BAZAR.includes(v.op);
          // showroom/fábricas = o que sobra da expedição
          return v.op !== OP_NOVIDADES && !OPS_BAZAR.includes(v.op);
        });
        corpo =
          vendas.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center">Nenhuma venda.</div>
          ) : (
            tabelaClientes(vendas)
          );
      }
    } else if (c.varejo) {
      if (!dSem) corpo = carregando;
      else {
        const lojas = [...(dSem.varejo || [])].sort(
          (a, b) => b.valor - a.valor,
        );
        corpo = (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#000638]/5">
                <th className={thCls}>Loja</th>
                <th className={`${thCls} text-right`}>Vendedores</th>
                <th className={`${thCls} text-right`}>Qtd</th>
                <th className={`${thCls} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {lojas.map((l) => (
                <tr
                  key={l.branch_code}
                  onClick={() =>
                    pushView({
                      tipo: 'vendedores',
                      titulo: nomeFilial(l.branch_code),
                      filial: l.branch_code,
                      vendedores: (l.sellers || [])
                        .map((s) => ({
                          code: s.seller_code,
                          nome: s.seller_name,
                          qtd: s.qtd,
                          valor: s.valor,
                        }))
                        .sort((a, b) => b.valor - a.valor),
                    })
                  }
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-3 py-1.5 font-semibold">
                    {nomeFilial(l.branch_code)}
                    <span className="text-gray-400 font-normal ml-1">
                      #{l.branch_code}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">{(l.sellers || []).length}</td>
                  <td className="px-3 py-1.5 text-right">{l.qtd}</td>
                  <td className="px-3 py-1.5 text-right">{formatBRL(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
    } else if (c.fonte) {
      if (!dSem) corpo = carregando;
      else {
        const rows = (c.codes || [])
          .map((code) => dSem.vendedores?.[code])
          .filter(Boolean)
          .sort((a, b) => b.valor - a.valor);
        // canal de vendedor único (ex: Ricardo Eletro, BlueCred) — vai direto
        // aos clientes, sem passar pela lista de vendedores
        if (c.direto) {
          const vendas = rows.flatMap((r) => r.vendas || []);
          return (
            <>
              {blocoAjuste}
              {vendas.length === 0 ? (
                <div className="text-sm text-gray-400 py-6 text-center">
                  Nenhuma venda nesta semana.
                </div>
              ) : (
                tabelaClientes(vendas)
              )}
            </>
          );
        }
        corpo =
          rows.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center">
              Nenhum vendedor com venda nesta semana.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#000638]/5">
                  <th className={thCls}>Código</th>
                  <th className={thCls}>Vendedor</th>
                  <th className={`${thCls} text-right`}>Qtd</th>
                  <th className={`${thCls} text-right`}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr
                    key={v.seller_code}
                    onClick={() =>
                      pushView({
                        tipo: 'vendas',
                        titulo: v.seller_name || `Vend. ${v.seller_code}`,
                        vendas: v.vendas || [],
                      })
                    }
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-3 py-1.5">{v.seller_code}</td>
                    <td className="px-3 py-1.5">{v.seller_name || '—'}</td>
                    <td className="px-3 py-1.5 text-right">{v.qtd}</td>
                    <td className="px-3 py-1.5 text-right">{formatBRL(v.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
      }
    }

    return (
      <>
        {blocoAjuste}
        {corpo}
      </>
    );
  };

  const drillView = drill ? drill.stack[drill.stack.length - 1] : null;

  const btnSec =
    'flex items-center gap-1.5 border border-[#000638]/30 text-[#000638] rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-[#000638]/5 disabled:opacity-50 transition-colors h-8';

  return (
    <div className="w-full max-w-[1400px] mx-auto flex flex-col items-stretch justify-start py-3 px-2 gap-4">
      <PageTitle
        title="New Forecast"
        subtitle="Faturamento semanal por canal × meta • Painel de Vendas"
        icon={ChartLineUp}
        iconColor="text-violet-600"
      />

      {/* Filtros */}
      <div className="bg-white p-3 rounded-lg shadow-md border border-[#000638]/10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Data Início
            </label>
            <input
              type="date"
              value={draftIni}
              onChange={(e) => setDraftIni(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Data Fim
            </label>
            <input
              type="date"
              value={draftFim}
              onChange={(e) => setDraftFim(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            />
          </div>
          <div>
            <button
              onClick={aplicarPeriodo}
              disabled={autoLoading || !draftIni || !draftFim || draftIni > draftFim}
              className="flex gap-1 items-center justify-center bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-8 text-xs font-bold shadow-md tracking-wide uppercase w-full"
            >
              {autoLoading ? (
                <>
                  <Spinner size={12} className="animate-spin" /> Buscando...
                </>
              ) : (
                <>
                  <MagnifyingGlass size={12} /> Buscar
                </>
              )}
            </button>
          </div>
          <div>
            <button
              onClick={() => buscarPainel(periodo)}
              disabled={autoLoading}
              title="Rebuscar valores do Painel de Vendas"
              className={`${btnSec} w-full justify-center`}
            >
              <Plugs size={14} /> Painel
            </button>
          </div>
          <div>
            <button
              onClick={() => setEditSemanas((v) => !v)}
              title="Ajustar as datas das semanas"
              className={`w-full justify-center flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-semibold h-8 transition-colors ${
                editSemanas || store.semanas?.length
                  ? 'border-amber-300 text-amber-700 bg-amber-50'
                  : 'border-[#000638]/30 text-[#000638] hover:bg-[#000638]/5'
              }`}
            >
              Semanas
            </button>
          </div>
          <div>
            <button
              onClick={handleReset}
              title="Limpar edições do período"
              className={`${btnSec} w-full justify-center`}
            >
              <ArrowClockwise size={14} /> Limpar
            </button>
          </div>
        </div>
      </div>

      {autoErro && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 text-sm">
          Painel de Vendas indisponível: {autoErro} — exibindo últimos valores
          conhecidos; canais automáticos podem estar desatualizados.
        </div>
      )}

      {/* Painel de ajuste das semanas */}
      {editSemanas && (
        <div className="bg-white rounded-lg shadow-md border border-amber-200 p-4">
          <p className="text-sm font-bold text-[#000638] mb-3">
            Datas das semanas ({ddmm(periodo.ini)} – {ddmm(periodo.fim)})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {semanasDef.map((w, idx) => (
              <div key={w.s} className="border border-[#000638]/10 rounded-lg p-2.5">
                <p className="text-xs font-semibold text-[#000638] mb-1.5">
                  Semana {w.s}
                </p>
                <input
                  type="date"
                  value={w.datemin}
                  onChange={(e) => setSemanaData(idx, 'datemin', e.target.value)}
                  className="w-full border border-[#000638]/20 rounded-md px-2 py-1 text-xs mb-1.5 focus:outline-none focus:ring-1 focus:ring-[#000638]/40"
                />
                <input
                  type="date"
                  value={w.datemax}
                  onChange={(e) => setSemanaData(idx, 'datemax', e.target.value)}
                  className="w-full border border-[#000638]/20 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000638]/40"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={aplicarSemanas}
              className="bg-[#000638] text-white rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-[#fe0000] transition-colors"
            >
              Aplicar e buscar
            </button>
            <button onClick={resetSemanas} className={btnSec}>
              Voltar ao padrão
            </button>
          </div>
        </div>
      )}

      {/* Cards resumo — estilo Painel de Vendas */}
      <div
        className={`grid grid-cols-2 gap-3 ${
          focoCanais.length > 0 || focoSemanas.length > 0
            ? 'lg:grid-cols-5'
            : 'lg:grid-cols-4'
        }`}
      >
        {(focoCanais.length > 0 || focoSemanas.length > 0) && (
          <ResumoCard
            icon={Crosshair}
            color="text-violet-700"
            bg="bg-violet-100"
            label={foco.label}
            value={
              foco.brl === 0 && foco.und > 0
                ? `${formatInt(foco.und)} und`
                : foco.und > 0
                  ? `${formatBRL(foco.brl)} + ${formatInt(foco.und)} und`
                  : formatBRL(foco.brl)
            }
            destaque
          />
        )}
        <ResumoCard
          icon={CurrencyDollar}
          color="text-emerald-600"
          bg="bg-emerald-50"
          label="Realizado"
          value={formatBRL(totals.realizado)}
        />
        <ResumoCard
          icon={Target}
          color="text-blue-600"
          bg="bg-blue-50"
          label="Meta"
          value={formatBRL(totals.meta)}
        />
        <ResumoCard
          icon={Percent}
          color={pctColor(totalPct)}
          bg={totalPct >= 100 ? 'bg-emerald-50' : totalPct >= 60 ? 'bg-amber-50' : 'bg-rose-50'}
          label="% Concluído"
          value={`${totalPct.toFixed(1)}%`}
        />
        <ResumoCard
          icon={Warning}
          color="text-rose-600"
          bg="bg-rose-50"
          label="Falta"
          value={formatBRL(totals.falta)}
        />
      </div>

      {/* Foco de apresentação ativo */}
      {(focoCanais.length > 0 || focoSemanas.length > 0) && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-gray-500">Foco:</span>
          {focoCanais.map((canal) => (
            <button
              key={canal}
              onClick={() => toggleCanal(canal)}
              title="Remover do foco"
              className="bg-violet-600 text-white rounded-full px-2.5 py-1 font-semibold hover:bg-violet-700"
            >
              {canal} ×
            </button>
          ))}
          {focoSemanas.map((s) => (
            <button
              key={s}
              onClick={() => toggleSemana(s)}
              title="Remover do foco"
              className="bg-violet-600 text-white rounded-full px-2.5 py-1 font-semibold hover:bg-violet-700"
            >
              Semana {s} ×
            </button>
          ))}
          <button
            onClick={() => {
              setFocoCanais([]);
              setFocoSemanas([]);
            }}
            className="text-gray-500 hover:text-[#000638] underline underline-offset-2"
          >
            limpar tudo
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-[#000638]/5 text-[#000638]">
              <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-[#f5f5f8] z-10">
                Canal
              </th>
              {semanasDef.map((w) => {
                const colFoco = focoSemanas.includes(w.s);
                return (
                  <th
                    key={w.s}
                    className={`text-right font-semibold px-3 py-3 transition-colors ${
                      colFoco ? 'bg-violet-600 text-white' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleSemana(w.s)}
                      title="Clique para destacar esta semana"
                      className={`text-right rounded px-1 -mx-1 transition ${
                        colFoco ? 'font-bold' : 'hover:text-violet-700'
                      }`}
                    >
                      Semana {w.s}
                      <div
                        className={`text-[10px] font-normal ${
                          colFoco ? 'text-violet-100' : 'text-gray-400'
                        }`}
                      >
                        {ddmm(w.datemin)}–{ddmm(w.datemax)}
                      </div>
                    </button>
                  </th>
                );
              })}
              <th className="text-right font-semibold px-3 py-3 bg-[#000638]/10">
                Realizado
              </th>
              <th className="text-right font-semibold px-3 py-3">Meta</th>
              <th className="text-center font-semibold px-3 py-3 w-[180px]">
                % Concluído
              </th>
              <th className="text-right font-semibold px-3 py-3">Falta</th>
            </tr>
          </thead>
          <tbody>
            {CANAIS_BASE.map((c, idx) => {
              const { realizado, pct, falta } = calc(c);
              const linhaFoco = focoCanais.includes(c.canal);
              // zebra suave nas linhas sem foco
              const zebra = idx % 2 === 1 ? 'bg-[#000638]/[0.02]' : '';
              return (
                <tr
                  key={c.canal}
                  className={`border-t transition-colors ${
                    linhaFoco
                      ? 'border-violet-200 bg-violet-50'
                      : `border-gray-100 ${zebra} hover:bg-gray-50/60`
                  }`}
                >
                  <td
                    className={`px-4 py-1.5 font-medium sticky left-0 z-10 whitespace-nowrap transition-colors ${
                      linhaFoco
                        ? 'bg-violet-100 text-violet-900'
                        : `${idx % 2 === 1 ? 'bg-[#fbfbfc]' : 'bg-white'} text-[#000638]`
                    }`}
                  >
                    <button
                      onClick={() => toggleCanal(c.canal)}
                      title="Clique para destacar esta linha"
                      className={`inline-flex items-center gap-1.5 rounded px-1 -mx-1 transition ${
                        linhaFoco ? 'font-bold' : 'hover:text-violet-700'
                      }`}
                    >
                      {c.canal}
                      {c.fonte && (
                        <span
                          title="Alimentado pelo Painel de Vendas"
                          className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400"
                        />
                      )}
                    </button>
                  </td>
                  {semanasDef.map((w) => {
                    const k = `s${w.s}`;
                    const ovr = isOverridden(c, k);
                    const colFoco = focoSemanas.includes(w.s);
                    const cruz = linhaFoco && colFoco;
                    return (
                      <td
                        key={k}
                        className={`px-1 py-1 transition-colors ${
                          colFoco && !linhaFoco ? 'bg-violet-50' : ''
                        }`}
                      >
                        <button
                          onClick={() => abrirCelula(c, w)}
                          title="Clique para detalhar / ajustar"
                          className={`w-full text-right px-2 py-1.5 rounded-md text-sm transition hover:bg-[#000638]/5 hover:ring-1 hover:ring-[#000638]/20 ${
                            cruz
                              ? 'bg-violet-600 text-white font-bold ring-2 ring-violet-700 hover:bg-violet-700'
                              : ovr
                                ? 'bg-amber-50 text-amber-800 font-semibold'
                                : 'text-gray-700'
                          }`}
                        >
                          {fmtValor(parseNum(cellValue(c, k)), c.qtd)}
                        </button>
                      </td>
                    );
                  })}
                  <td
                    className={`px-3 py-1.5 text-right font-semibold text-[#000638] whitespace-nowrap ${
                      linhaFoco ? 'bg-violet-100' : 'bg-[#000638]/5'
                    }`}
                  >
                    {c.fonte ? (
                      <button
                        onClick={() => abrirRealizado(c)}
                        title="Ver o consolidado do período"
                        className="w-full text-right rounded-md px-1 py-0.5 hover:bg-[#000638]/10 hover:ring-1 hover:ring-[#000638]/20 transition"
                      >
                        {fmtValor(realizado, c.qtd)}
                      </button>
                    ) : (
                      fmtValor(realizado, c.qtd)
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <MoneyInput
                      value={metaValue(c)}
                      onChange={(v) => setMeta(c, v)}
                      strong
                      qtd={c.qtd}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold w-12 text-right ${pctColor(pct)}`}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">
                    {falta > 0 ? fmtValor(falta, c.qtd) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#000638]/20 bg-[#000638]/5 font-semibold text-[#000638]">
              <td className="px-4 py-3 sticky left-0 bg-[#f5f5f8] z-10">TOTAL</td>
              {semanasDef.map((w) => {
                const colFoco = focoSemanas.includes(w.s);
                return (
                  <td
                    key={w.s}
                    className={`px-3 py-3 text-right transition-colors ${
                      colFoco ? 'bg-violet-600 text-white font-bold' : ''
                    }`}
                  >
                    {formatBRL(totals[`s${w.s}`])}
                  </td>
                );
              })}
              <td className="px-3 py-3 text-right bg-[#000638]/10">
                {formatBRL(totals.realizado)}
              </td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.meta)}</td>
              <td className={`px-3 py-3 text-center ${pctColor(totalPct)}`}>
                {totalPct.toFixed(1)}%
              </td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.falta)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 mr-1" />
        canal alimentado pelo Painel de Vendas. Clique numa célula para ver o
        detalhamento e ajustar o valor; células âmbar têm ajuste manual.
        Semanas, metas e ajustes ficam salvos no servidor.
      </p>

      {/* Modal de drill da célula */}
      {drill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDrill(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2 min-w-0">
                {drill.stack.length > 1 && (
                  <button
                    onClick={popView}
                    className="p-1 rounded hover:bg-gray-100 shrink-0"
                    title="Voltar"
                  >
                    <CaretLeft size={16} className="text-gray-600" />
                  </button>
                )}
                <h2 className="text-sm font-bold text-[#000638] uppercase tracking-wide truncate">
                  {drillView?.titulo || drill.canal.canal}
                  <span className="text-gray-400 font-normal normal-case">
                    {' '}
                    {drill.week
                      ? `— Semana ${drill.week.s} (${ddmm(drill.week.datemin)}–${ddmm(drill.week.datemax)})`
                      : `— Realizado (${ddmm(periodo.ini)}–${ddmm(periodo.fim)})`}
                  </span>
                </h2>
              </div>
              <button
                onClick={() => setDrill(null)}
                className="p-1 rounded hover:bg-gray-100 shrink-0"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">{renderDrill()}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ResumoCard = ({ icon: Icon, color, bg, label, value, destaque }) => (
  <div
    className={`bg-white rounded-lg shadow-md p-4 flex items-center gap-3 ${
      destaque
        ? 'border-2 border-violet-500 ring-2 ring-violet-200'
        : 'border border-[#000638]/10'
    }`}
  >
    <div className={`p-2 rounded-full ${bg} shrink-0`}>
      <Icon size={20} className={color} />
    </div>
    <div className="min-w-0">
      <p
        className={`text-xs font-medium truncate ${
          destaque ? 'text-violet-700' : 'text-gray-500'
        }`}
        title={label}
      >
        {label}
      </p>
      <p className="text-base font-bold text-[#000638] truncate" title={value}>
        {value}
      </p>
    </div>
  </div>
);

export default NewForecast;
