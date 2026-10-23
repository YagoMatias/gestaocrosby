import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  CaretRight,
  CaretDown,
  CaretUp,
  CaretUpDown,
  Plus,
  X,
  Flag,
  Scissors,
  Trash,
  ArrowsClockwise,
  CloudArrowDown,
  UploadSimple,
  Spinner,
  Check,
  LockSimple,
  LockSimpleOpen,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import { authHeaders } from '../../utils/apiAuth';
import {
  useDespesasGerais,
  groupOf,
  fmtBRL,
  STATUS_LIST,
  EMPRESAS_DRE,
  CONSULTA_VERSAO,
  MES_SEQ,
  ANO,
  mesCongelado,
} from './store';
import { CardBox, StatusBadge, EditableText, ActionBtn } from './comum';
import { parseBonificacoes } from './bonificacoesPlanilha';

// despesas manuais das bonificações (não existem no TOTVS). Se o financeiro já
// criou a despesa no mês com outro nome parecido, a importação usa a existente.
const BONIF = {
  geral: { nome: 'BONIFICACOES GERAIS', rotulo: 'bonificação geral', casa: (c) => /BONIFICA/.test(c) && !/MARKETING|MKT/.test(c) },
  marketing: { nome: 'BONIFICACOES MARKETING', rotulo: 'bonificação marketing', casa: (c) => /BONIFICA/.test(c) && /MARKETING|MKT/.test(c) },
};

const VERDE = '#12a150';
const VERMELHO = '#dc2626';

// 'DD/MM/YYYY' → Date (ou null)
const parseBR = (s) => {
  const [d, m, y] = String(s || '').split('/').map(Number);
  return y ? new Date(y, m - 1, d) : null;
};

// situação de pagamento da duplicata: pago · vencido · aberto
const situacaoPagamento = (d) => {
  if (d.liq || d.estag === 'Liquidado') return 'pago';
  const v = parseBR(d.venc);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (v && v < hoje) return 'vencido';
  return 'aberto';
};

const PAY_CFG = {
  pago: { label: 'Pago', cls: 'bg-green-100 text-green-700' },
  aberto: { label: 'Em aberto', cls: 'bg-amber-100 text-amber-700' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-700' },
};

function PagamentoBadge({ d }) {
  const sit = situacaoPagamento(d);
  const cfg = PAY_CFG[sit];
  return (
    <span
      title={
        sit === 'pago'
          ? `Liquidado em ${d.liq || '—'}`
          : `Vencimento: ${d.venc || '—'}`
      }
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// célula de variação Realizado − Forecast
function Variacao({ real, fc }) {
  if (fc === null || fc === undefined || isNaN(fc))
    return <span className="text-gray-300 text-[11px]">preencher →</span>;
  const diff = real - fc;
  const pct = fc > 0 ? ((diff / fc) * 100).toFixed(1) : '—';
  const estourou = diff > 0.005;
  return (
    <span
      className="font-semibold whitespace-nowrap"
      style={{ color: estourou ? VERMELHO : VERDE }}
    >
      {estourou ? '▲' : '▼'} {fmtBRL(Math.abs(diff))}
      <span className="text-[10px] font-normal ml-1">({pct}%)</span>
    </span>
  );
}

// célula de forecast editável. `auto` = valor é o padrão (realizado do mês
// anterior), ainda não editado na mão; renderiza esmaecido mas continua editável.
function FcCell({ fcKey, value, onCommit, auto }) {
  return (
    <EditableText
      value={
        value === undefined || value === null
          ? ''
          : Number(value).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
      }
      placeholder="definir"
      title={auto ? 'padrão: realizado do mês anterior — clique para editar' : 'clique para definir o forecast'}
      className={auto ? 'font-normal text-violet-400 italic' : 'font-medium text-violet-700'}
      onCommit={(raw) => {
        const v = parseFloat(String(raw).replace(/\./g, '').replace(',', '.'));
        onCommit(fcKey, isNaN(v) ? '' : v);
      }}
    />
  );
}

export default function DreAnalitica() {
  const {
    months,
    activeMonth,
    forecasts,
    fontes,
    carregandoMes,
    erroMes,
    carregarMesTotvs,
    fcKeyFor,
    fcTotalFor,
    forecastPadraoFor,
    mergeRealizedG,
    importarMesesHtml,
    travarMes,
    mesTravado,
    catAnalisada,
    toggleAnalisada,
    catTravada,
    toggleTravaDespesa,
    ultimaSyncDespesa,
    limparUltimaSyncDespesa,
    setForecast,
    updateRow,
    deleteRow,
    addRow,
    addCategory,
    deleteCategory,
    importarBonificacoes,
    flagKeyFor,
    toggleFlag,
    flags,
  } = useDespesasGerais();

  const mo = months[activeMonth];
  const fonte = fontes[activeMonth] || {};
  const carregando = carregandoMes === activeMonth;
  const congelado = mesCongelado(activeMonth); // regra: jan–ago (importação manual)
  const travado = mesTravado(activeMonth); // botão "Travar mês" (após análise)
  const bloqueado = congelado || travado; // sem Sincronizar e sem recarga automática
  const [somenteGerais, setSomenteGerais] = useState(
    fonte.somenteGerais !== false,
  );

  // primeira visita ao mês, mês vazio ou regra de consulta desatualizada
  // → busca os títulos reais no TOTVS. Mês CONGELADO (jan–ago): carrega só na
  // primeira vez (quando vazio) e nunca re-sincroniza, pra não alterar o histórico.
  useEffect(() => {
    const bloq = mesCongelado(activeMonth) || mesTravado(activeMonth);
    const precisa = bloq
      ? !mo || mo.cnt === 0
      : fonte.origem !== 'totvs' || mo.cnt === 0 || fonte.consulta !== CONSULTA_VERSAO;
    if (precisa && !carregandoMes) carregarMesTotvs(activeMonth, { somenteGerais });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth]);

  // forecast = realizado do mês anterior → carrega também o mês anterior
  // (quando o mês atual terminar de carregar), pra o padrão aparecer preenchido
  useEffect(() => {
    const i = MES_SEQ.indexOf(activeMonth);
    const pm = i > 0 ? MES_SEQ[i - 1] : null;
    if (!pm || carregandoMes) return;
    const pmo = months[pm];
    const pf = fontes[pm] || {};
    const precisa = mesCongelado(pm) || mesTravado(pm)
      ? !pmo || pmo.cnt === 0 // congelado/travado: só carrega se vazio; não re-sincroniza
      : !pmo || pmo.cnt === 0 || pf.origem !== 'totvs' || pf.consulta !== CONSULTA_VERSAO;
    if (precisa) carregarMesTotvs(pm, { somenteGerais });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth, carregandoMes]);

  // importação de observações por planilha (botão)
  const obsFileRef = useRef(null);
  const [importandoObs, setImportandoObs] = useState(false);
  const [msgImportObs, setMsgImportObs] = useState(null);
  // importação do histórico (HTML da ferramenta antiga) — jan a ago
  const histFileRef = useRef(null);
  const [importandoHist, setImportandoHist] = useState(false);
  const importarHistoricoHtml = async (file) => {
    if (!file) return;
    setImportandoHist(true);
    setMsgImportObs(null);
    try {
      const html = await file.text();
      // carrega jan–ago (valores + lançamentos + observações) direto do HTML
      const r = importarMesesHtml(html);
      setMsgImportObs({
        tipo: 'ok',
        texto:
          `Histórico importado (${r.origem === 'saved' ? 'estado salvo do arquivo' : 'base do arquivo'}): ` +
          `${r.meses.length} meses (${r.meses.join(', ')}), ${r.totalLancamentos} lançamentos, ` +
          `${r.forecasts} forecasts e ${r.flags} flags (${r.manuais} lançamentos manuais) — espelho do arquivo, congelado. Abra cada mês para ver.` +
          (r.pulados && r.pulados.length ? ` Meses travados não alterados: ${r.pulados.join(', ')}.` : ''),
      });
    } catch (e) {
      setMsgImportObs({ tipo: 'erro', texto: e.message });
    } finally {
      setImportandoHist(false);
      if (histFileRef.current) histFileRef.current.value = '';
    }
  };

  // importador geral (menu "Importar"): observações · bonificação geral ·
  // bonificação marketing · histórico HTML
  const [menuImportar, setMenuImportar] = useState(false);
  const bonifFileRef = useRef(null);
  const [bonifTipo, setBonifTipo] = useState('geral');
  const [importandoBonif, setImportandoBonif] = useState(false);
  const importarBonifPlanilha = async (file, tipo) => {
    if (!file) return;
    setImportandoBonif(true);
    setMsgImportObs(null);
    try {
      if (bloqueado) throw new Error(travado ? 'Mês travado — destrave para importar.' : 'Mês congelado (histórico) — não aceita importação.');
      const r = parseBonificacoes(await file.arrayBuffer());
      if (!r.prontas.length) {
        throw new Error(
          `Nenhuma linha válida na planilha${r.headers.length ? ` (colunas lidas: ${r.headers.filter(Boolean).join(', ')})` : ''}. Precisa de uma coluna de fornecedor/nome e uma de valor.`,
        );
      }
      const cfg = BONIF[tipo];
      const existente = mo.summary.map((s) => s.cat).find(cfg.casa);
      const cat = existente || cfg.nome;
      const res = importarBonificacoes(activeMonth, cat, r.prontas, tipo);
      const ignoradas = r.linhas.length - r.prontas.length;
      setMsgImportObs({
        tipo: 'ok',
        texto:
          `${cfg.rotulo[0].toUpperCase() + cfg.rotulo.slice(1)} importada em ${mo.label}: ${res.gravadas} lançamentos (${fmtBRL(r.total)}) na despesa "${res.cat}"` +
          (res.removidas ? ` — substituiu ${res.removidas} importados antes` : '') +
          (ignoradas ? ` · ${ignoradas} linha${ignoradas > 1 ? 's' : ''} ignorada${ignoradas > 1 ? 's' : ''} (sem nome ou valor)` : '') +
          '.',
      });
      setExpanded((prev) => new Set(prev).add(res.cat));
    } catch (e) {
      setMsgImportObs({ tipo: 'erro', texto: e.message });
    } finally {
      setImportandoBonif(false);
      if (bonifFileRef.current) bonifFileRef.current.value = '';
    }
  };

  const importarObsPlanilha = async (file) => {
    if (!file) return;
    setImportandoObs(true);
    setMsgImportObs(null);
    try {
      const num = MES_SEQ.indexOf(activeMonth) + 1;
      const pad = (n) => String(n).padStart(2, '0');
      const ultimoDia = new Date(ANO, num, 0).getDate();
      const fd = new FormData();
      fd.append('arquivo', file);
      fd.append('dt_inicio', `${ANO}-${pad(num)}-01`);
      fd.append('dt_fim', `${ANO}-${pad(num)}-${pad(ultimoDia)}`);
      const headers = await authHeaders();
      const resp = await fetch(`${API_BASE_URL}/api/dre-observacoes/importar`, {
        method: 'POST',
        headers,
        body: fd,
      });
      const j = await resp.json();
      if (!resp.ok || j.success === false)
        throw new Error(j.message || `HTTP ${resp.status}`);
      setMsgImportObs({
        tipo: 'ok',
        texto: `Importado: ${j.data.gravadas} observações gravadas, ${j.data.puladas} já existiam${j.data.erros ? `, ${j.data.erros} com erro` : ''}.`,
      });
      await carregarMesTotvs(activeMonth, { somenteGerais }); // recarrega pra mostrar
    } catch (e) {
      setMsgImportObs({ tipo: 'erro', texto: e.message });
    } finally {
      setImportandoObs(false);
      if (obsFileRef.current) obsFileRef.current.value = '';
    }
  };
  const [expanded, setExpanded] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fornFilter, setFornFilter] = useState('');
  const [catFornFilter, setCatFornFilter] = useState({}); // 'mes||cat' -> [forns]
  const [catSort, setCatSort] = useState({}); // 'mes||cat' -> 'asc'|'desc'
  const [catPayFilter, setCatPayFilter] = useState({}); // 'mes||cat' -> 'pago'|'aberto'
  // ordenação da tabela principal por cabeçalho (clique): col + direção
  const [mainSort, setMainSort] = useState({ col: null, dir: 'desc' });

  const toggleExpand = useCallback((cat) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  // lista global de fornecedores do mês (datalist)
  const fornecedores = useMemo(() => {
    const set = new Set();
    Object.values(mo.details).forEach((rows) =>
      rows.forEach((r) => r.forn && set.add(r.forn)),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [mo]);

  // categorias visíveis conforme filtros globais
  const visible = useMemo(() => {
    const sq = search.toLowerCase();
    const ff = fornFilter.toLowerCase();
    return mo.summary.filter((s) => {
      if (sq && !s.cat.toLowerCase().includes(sq)) return false;
      const dets = mo.details[s.cat] || [];
      if (statusFilter && !dets.some((d) => situacaoPagamento(d) === statusFilter))
        return false;
      if (ff && !dets.some((d) => (d.forn || '').toLowerCase().includes(ff)))
        return false;
      return true;
    });
  }, [mo, search, statusFilter, fornFilter]);

  // agrupamento de forecast mesclado presente no mês
  const catToGroup = useMemo(() => {
    const map = new Map();
    // membros visíveis de cada grupo, na ordem em que aparecem
    const grupos = [];
    const done = new Set();
    visible.forEach((s) => {
      const g = groupOf(s.cat);
      if (!g || done.has(g.canon)) return;
      done.add(g.canon);
      const members = visible.filter((x) => groupOf(x.cat) === g);
      if (members.length) grupos.push({ g, members });
    });
    grupos.forEach((gp) => gp.members.forEach((s) => map.set(s.cat, gp)));
    return map;
  }, [visible]);

  const fcTotal = fcTotalFor(activeMonth);

  // valor de cada coluna por categoria (grupos de forecast único somam os membros)
  const valorColuna = (sc) => {
    const gp = catToGroup.get(sc.cat);
    if (gp && gp.members.length > 1) {
      const fcKey = fcKeyFor(gp.members[0].cat);
      const fc =
        forecasts[fcKey] !== undefined
          ? parseFloat(forecasts[fcKey])
          : forecastPadraoFor(gp.members[0].cat, activeMonth);
      const real = mergeRealizedG(gp.g, activeMonth);
      return { cat: gp.members[0].cat, realizado: real, forecast: fc, variacao: real - fc, pct: mo.total > 0 ? real / mo.total : 0 };
    }
    const fcKey = fcKeyFor(sc.cat);
    const fc =
      forecasts[fcKey] !== undefined
        ? parseFloat(forecasts[fcKey])
        : forecastPadraoFor(sc.cat, activeMonth);
    return { cat: sc.cat, realizado: sc.total, forecast: fc, variacao: sc.total - fc, pct: mo.total > 0 ? sc.total / mo.total : 0 };
  };

  // ordena as categorias conforme o cabeçalho clicado; mantém os membros de um
  // mesmo grupo (forecast único) juntos, pois compartilham o valor do grupo.
  const visibleOrdenado = useMemo(() => {
    if (!mainSort.col) return visible;
    const dir = mainSort.dir === 'asc' ? 1 : -1;
    return visible
      .map((sc, i) => ({ sc, i, v: valorColuna(sc) }))
      .sort((a, b) => {
        const ka = a.v[mainSort.col];
        const kb = b.v[mainSort.col];
        let c;
        if (typeof ka === 'string') c = ka.localeCompare(kb, 'pt-BR');
        else c = (ka || 0) - (kb || 0);
        return c !== 0 ? dir * c : a.i - b.i;
      })
      .map((x) => x.sc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, catToGroup, mainSort, forecasts, activeMonth, mo.total]);

  const toggleSort = (col) =>
    setMainSort((p) =>
      p.col !== col
        ? { col, dir: 'desc' }
        : p.dir === 'desc'
          ? { col, dir: 'asc' }
          : { col: null, dir: 'desc' },
    );
  const sortArrow = (col) =>
    mainSort.col !== col ? (
      <CaretUpDown size={10} className="opacity-40" />
    ) : mainSort.dir === 'desc' ? (
      <CaretDown size={10} weight="bold" />
    ) : (
      <CaretUp size={10} weight="bold" />
    );

  // bloco de lançamentos de uma categoria expandida
  const detailBlock = (cat) => {
    const allRows = (mo.details[cat] || []).map((d, i) => ({ d, i }));
    const catKey = activeMonth + '||' + cat;
    const selForns = catFornFilter[catKey] || [];
    let dets = allRows;
    if (selForns.length)
      dets = dets.filter((x) => selForns.includes(x.d.forn));
    // resumo pago × em aberto (sobre o conjunto já filtrado por fornecedor)
    const somaPor = (sits) =>
      dets
        .filter((x) => sits.includes(situacaoPagamento(x.d)))
        .reduce(
          (acc, x) => ({
            n: acc.n + 1,
            v: acc.v + (parseFloat(x.d.val) || 0),
          }),
          { n: 0, v: 0 },
        );
    const rPago = somaPor(['pago']);
    const rAberto = somaPor(['aberto', 'vencido']);
    const rVencido = somaPor(['vencido']);
    const payFilter = catPayFilter[catKey];
    if (payFilter === 'pago')
      dets = dets.filter((x) => situacaoPagamento(x.d) === 'pago');
    else if (payFilter === 'aberto')
      dets = dets.filter((x) => situacaoPagamento(x.d) !== 'pago');
    const sortDir = catSort[catKey];
    if (sortDir)
      dets = dets
        .slice()
        .sort((a, b) =>
          sortDir === 'desc' ? b.d.val - a.d.val : a.d.val - b.d.val,
        );
    const forns = Array.from(
      new Set(allRows.map((x) => x.d.forn).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const available = forns.filter((f) => !selForns.includes(f));
    const sub = dets.reduce((s, x) => s + (parseFloat(x.d.val) || 0), 0);

    return (
      <tr key={cat + '::detail'}>
        <td colSpan={6} className="p-0 bg-gray-50/70">
          <div className="mx-3 my-2 border border-gray-200 rounded-lg bg-white overflow-hidden">
            {/* toolbar: filtro de fornecedor da despesa */}
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">
                Fornecedor:
              </span>
              <select
                value=""
                onChange={(e) => {
                  const f = e.target.value;
                  if (!f) return;
                  setCatFornFilter((p) => ({
                    ...p,
                    [catKey]: [...(p[catKey] || []), f],
                  }));
                }}
                className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 max-w-[220px]"
              >
                <option value="">+ filtrar fornecedor…</option>
                {available.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              {selForns.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2 py-0.5 text-[10px] font-medium"
                >
                  {f}
                  <button
                    onClick={() =>
                      setCatFornFilter((p) => ({
                        ...p,
                        [catKey]: (p[catKey] || []).filter((x) => x !== f),
                      }))
                    }
                    className="text-blue-400 hover:text-blue-700"
                  >
                    <X size={10} weight="bold" />
                  </button>
                </span>
              ))}
              {selForns.length > 0 && (
                <button
                  onClick={() =>
                    setCatFornFilter((p) => ({ ...p, [catKey]: [] }))
                  }
                  className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                >
                  limpar todos
                </button>
              )}
              {/* resumo e filtro: pago × em aberto */}
              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() =>
                    setCatPayFilter((p) => ({
                      ...p,
                      [catKey]: p[catKey] === 'pago' ? undefined : 'pago',
                    }))
                  }
                  title="Mostrar só os títulos pagos"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                    payFilter === 'pago'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  }`}
                >
                  ● Pago: {rPago.n} · {fmtBRL(rPago.v)}
                </button>
                <button
                  onClick={() =>
                    setCatPayFilter((p) => ({
                      ...p,
                      [catKey]: p[catKey] === 'aberto' ? undefined : 'aberto',
                    }))
                  }
                  title="Mostrar só os títulos em aberto (inclui vencidos)"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                    payFilter === 'aberto'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  ● Em aberto: {rAberto.n} · {fmtBRL(rAberto.v)}
                </button>
                {rVencido.n > 0 && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200"
                    title="Títulos em aberto com vencimento já passado"
                  >
                    {rVencido.n} vencido{rVencido.n > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {catTravada(activeMonth, cat) && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <LockSimple size={10} weight="bold" /> despesa travada
                </span>
              )}
              <button
                onClick={() => carregarMesTotvs(activeMonth, { somenteGerais, apenasCat: cat })}
                disabled={carregando || bloqueado || catTravada(activeMonth, cat)}
                className={`${catTravada(activeMonth, cat) ? 'ml-3' : 'ml-auto'} inline-flex items-center gap-1 text-[10px] text-[#000638] hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                title={
                  catTravada(activeMonth, cat)
                    ? 'Despesa travada — destrave (cadeado) para sincronizar'
                    : bloqueado
                      ? 'Mês bloqueado — destrave para sincronizar'
                      : 'Puxa do TOTVS só os lançamentos desta despesa (as outras não mudam)'
                }
              >
                <ArrowsClockwise size={11} className={carregando ? 'animate-spin' : ''} /> sincronizar despesa
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Excluir a despesa "${cat}" e todos os seus lançamentos de ${activeMonth.toUpperCase()}?`,
                    )
                  )
                    deleteCategory(activeMonth, cat);
                }}
                disabled={catTravada(activeMonth, cat)}
                className="ml-3 inline-flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Excluir esta despesa (categoria) inteira"
              >
                <Trash size={11} /> excluir despesa
              </button>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="px-2 py-1.5 text-left font-semibold">Emp.</th>
                  <th className="px-2 py-1.5 text-left font-semibold">
                    Fornecedor
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold">
                    Nr. Dupl.
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold">Emissão</th>
                  <th className="px-2 py-1.5 text-left font-semibold">
                    Vencimento
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold">
                    Liquidação
                  </th>
                  <th
                    className="px-2 py-1.5 text-right font-semibold cursor-pointer select-none hover:text-[#000638]"
                    title="Clique para ordenar por valor"
                    onClick={() =>
                      setCatSort((p) => ({
                        ...p,
                        [catKey]:
                          p[catKey] === 'desc'
                            ? 'asc'
                            : p[catKey] === 'asc'
                              ? undefined
                              : 'desc',
                      }))
                    }
                  >
                    Valor {sortDir === 'desc' ? '▼' : sortDir === 'asc' ? '▲' : '⇅'}
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold">Status</th>
                  <th className="px-2 py-1.5 text-left font-semibold">
                    Observação
                  </th>
                  <th className="px-2 py-1.5 text-center font-semibold">
                    Enviar p/
                  </th>
                  <th className="px-2 py-1.5 text-center font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {dets.map(({ d, i }) => {
                  const fk = flagKeyFor(activeMonth, cat, d, i);
                  const fl = flags[fk];
                  return (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-blue-50/40"
                    >
                      <td className="px-2 py-1 text-gray-400">
                        <EditableText
                          value={d.emp}
                          onCommit={(v) => updateRow(activeMonth, cat, i, 'emp', v)}
                        />
                      </td>
                      <td
                        className="px-2 py-1 max-w-[200px] truncate"
                        title={d.forn}
                      >
                        <EditableText
                          value={d.forn}
                          onCommit={(v) =>
                            updateRow(activeMonth, cat, i, 'forn', v)
                          }
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-gray-500">
                        <EditableText
                          value={d.dupl}
                          onCommit={(v) =>
                            updateRow(activeMonth, cat, i, 'dupl', v)
                          }
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-gray-500">
                        <EditableText
                          value={d.emis}
                          onCommit={(v) =>
                            updateRow(activeMonth, cat, i, 'emis', v)
                          }
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-gray-500">
                        <EditableText
                          value={d.venc}
                          onCommit={(v) =>
                            updateRow(activeMonth, cat, i, 'venc', v)
                          }
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-gray-500">
                        {d.liq || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1 text-right font-medium">
                        <EditableText
                          value={fmtBRL(d.val)}
                          onCommit={(v) =>
                            updateRow(
                              activeMonth,
                              cat,
                              i,
                              'val',
                              v.replace(/[R$\s]/g, ''),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        {d.id ? (
                          <PagamentoBadge d={d} />
                        ) : (
                          <select
                            value={d.estag}
                            onChange={(e) =>
                              updateRow(
                                activeMonth,
                                cat,
                                i,
                                'estag',
                                e.target.value,
                              )
                            }
                            className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white"
                          >
                            {STATUS_LIST.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td
                        className="px-2 py-1 max-w-[220px] text-gray-500"
                        title={d.obs || ''}
                      >
                        <EditableText
                          value={d.obs}
                          textarea
                          placeholder="—"
                          onCommit={(v) =>
                            updateRow(activeMonth, cat, i, 'obs', v)
                          }
                          className="block truncate"
                        />
                      </td>
                      <td className="px-2 py-1 text-center whitespace-nowrap">
                        <button
                          onClick={() =>
                            toggleFlag('correcao', activeMonth, cat, i, d)
                          }
                          title="Enviar para Correções DRE"
                          className={`p-1 rounded transition ${
                            fl?.tipo === 'correcao'
                              ? 'bg-amber-100 text-amber-600'
                              : 'text-gray-300 hover:text-amber-500'
                          }`}
                        >
                          <Flag size={13} weight={fl?.tipo === 'correcao' ? 'fill' : 'regular'} />
                        </button>
                        <button
                          onClick={() =>
                            toggleFlag('corte', activeMonth, cat, i, d)
                          }
                          title="Enviar para Corte de custo"
                          className={`p-1 rounded transition ${
                            fl?.tipo === 'corte'
                              ? 'bg-red-100 text-red-600'
                              : 'text-gray-300 hover:text-red-500'
                          }`}
                        >
                          <Scissors size={13} weight={fl?.tipo === 'corte' ? 'fill' : 'regular'} />
                        </button>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => {
                            if (window.confirm('Excluir este lançamento?'))
                              deleteRow(activeMonth, cat, i);
                          }}
                          className="text-gray-300 hover:text-red-600 transition"
                          title="Excluir este lançamento"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={6} className="px-2 py-1.5 text-right text-gray-500">
                    Subtotal
                    {selForns.length
                      ? ` (${selForns.length} fornecedor${selForns.length > 1 ? 'es' : ''})`
                      : ''}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[#000638]">
                    {fmtBRL(sub)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
                <tr>
                  <td colSpan={11} className="px-2 py-1.5">
                    <button
                      onClick={() => addRow(activeMonth, cat)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#000638] font-semibold hover:underline"
                    >
                      <Plus size={11} weight="bold" /> Adicionar lançamento
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    );
  };

  // linhas da tabela principal
  const bodyRows = [];
  const groupsDone = new Set();
  // marcação "analisada" por despesa (pedido do financeiro em 21/10/2026)
  const nAnalisadas = visible.filter((s) => catAnalisada(activeMonth, s.cat)).length;
  const analisadaBtn = (cat) => {
    const ok = catAnalisada(activeMonth, cat);
    const trav = catTravada(activeMonth, cat);
    return (
      <span className="ml-2 inline-flex items-center gap-1 align-middle">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleAnalisada(activeMonth, cat);
          }}
          title={ok ? 'Despesa analisada — clique para desmarcar' : 'Marcar esta despesa como analisada'}
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition ${
            ok
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-300 border-gray-200 hover:border-green-400 hover:text-green-600'
          }`}
        >
          <Check size={11} weight="bold" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTravaDespesa(activeMonth, cat);
          }}
          title={
            trav
              ? 'Despesa travada — não muda com Sincronizar TOTVS nem aceita edição. Clique para destravar.'
              : 'Travar esta despesa (sem sincronizar com o TOTVS e sem editar/excluir lançamentos até destravar)'
          }
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition ${
            trav
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-gray-300 border-gray-200 hover:border-amber-400 hover:text-amber-600'
          }`}
        >
          {trav ? <LockSimple size={11} weight="bold" /> : <LockSimpleOpen size={11} weight="bold" />}
        </button>
      </span>
    );
  };
  const rowCls = (cat) =>
    catTravada(activeMonth, cat) ? 'bg-amber-50/60' : catAnalisada(activeMonth, cat) ? 'bg-green-50/60' : '';
  visibleOrdenado.forEach((s) => {
    const gp = catToGroup.get(s.cat);
    const pct = mo.total > 0 ? ((s.total / mo.total) * 100).toFixed(1) : '0.0';
    const isOpen = expanded.has(s.cat);

    const arrow = (cat) => (
      <span className="inline-flex items-center text-gray-400">
        {expanded.has(cat) ? <CaretDown size={12} /> : <CaretRight size={12} />}
      </span>
    );

    if (gp && gp.members.length > 1) {
      if (groupsDone.has(gp.g.canon)) return;
      groupsDone.add(gp.g.canon);
      const fcKey = fcKeyFor(gp.members[0].cat);
      const fcManual = forecasts[fcKey] !== undefined;
      const fc = fcManual
        ? parseFloat(forecasts[fcKey])
        : forecastPadraoFor(gp.members[0].cat, activeMonth);
      const realComb = mergeRealizedG(gp.g, activeMonth);
      const n = gp.members.length;
      gp.members.forEach((gm, idx) => {
        const gmPct =
          mo.total > 0 ? ((gm.total / mo.total) * 100).toFixed(1) : '0.0';
        bodyRows.push(
          <tr
            key={gm.cat}
            onClick={() => toggleExpand(gm.cat)}
            className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50/40 ${rowCls(gm.cat)} ${
              idx === 0 ? 'border-t-2 border-t-violet-200' : ''
            } ${idx === n - 1 ? 'border-b-2 border-b-violet-200' : ''}`}
          >
            <td className="px-3 py-2 w-7">{arrow(gm.cat)}</td>
            <td className="px-2 py-2 font-medium text-[#000638]">
              {gm.cat}
              {analisadaBtn(gm.cat)}
              {idx === 0 && (
                <span
                  className="ml-2 text-[9px] font-bold uppercase text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0.5"
                  title="Estas despesas compartilham um único forecast"
                >
                  forecast único
                </span>
              )}
            </td>
            <td className="px-2 py-2 text-right">{fmtBRL(gm.total)}</td>
            {idx === 0 && (
              <td
                rowSpan={n}
                className="px-2 py-2 text-right align-middle bg-violet-50/50 border-l border-violet-100"
                onClick={(e) => e.stopPropagation()}
              >
                <FcCell fcKey={fcKey} value={fc} onCommit={setForecast} auto={!fcManual} />
              </td>
            )}
            {idx === 0 && (
              <td
                rowSpan={n}
                className="px-2 py-2 text-right align-middle bg-violet-50/50 border-r border-violet-100"
              >
                <Variacao real={realComb} fc={fc} />
              </td>
            )}
            <td className="px-2 py-2 text-right text-gray-400">{gmPct}%</td>
          </tr>,
        );
      });
      gp.members.forEach((gm) => {
        if (expanded.has(gm.cat)) bodyRows.push(detailBlock(gm.cat));
      });
      return;
    }

    const fcKey = fcKeyFor(s.cat);
    const fcManual = forecasts[fcKey] !== undefined;
    const fc = fcManual
      ? parseFloat(forecasts[fcKey])
      : forecastPadraoFor(s.cat, activeMonth);
    bodyRows.push(
      <tr
        key={s.cat}
        onClick={() => toggleExpand(s.cat)}
        className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50/40 ${rowCls(s.cat)}`}
      >
        <td className="px-3 py-2 w-7">{arrow(s.cat)}</td>
        <td className="px-2 py-2 font-medium text-[#000638]">
          {s.cat}
          {analisadaBtn(s.cat)}
        </td>
        <td className="px-2 py-2 text-right">{fmtBRL(s.total)}</td>
        <td
          className="px-2 py-2 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <FcCell fcKey={fcKey} value={fc} onCommit={setForecast} auto={!fcManual} />
        </td>
        <td className="px-2 py-2 text-right">
          <Variacao real={s.total} fc={fc} />
        </td>
        <td className="px-2 py-2 text-right text-gray-400">{pct}%</td>
      </tr>,
    );
    if (isOpen) bodyRows.push(detailBlock(s.cat));
  });

  const totalVisivel = visible.reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-4">
      {/* fonte de dados TOTVS */}
      <div className="bg-white border border-[#000638]/10 rounded-xl shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-3">
        <CloudArrowDown size={16} className="text-[#000638]" weight="bold" />
        {fonte.origem === 'totvs' ? (
          <span className="text-[11px] text-gray-500">
            <b className="text-green-700">Dados reais do TOTVS</b> — títulos{' '}
            <b>emitidos</b> em {mo.label} (só normais · abertos e pagos) ·
            sincronizado em{' '}
            {fonte.atualizadoEm
              ? new Date(fonte.atualizadoEm).toLocaleString('pt-BR')
              : '—'}
          </span>
        ) : (
          <span className="text-[11px] text-gray-500">
            <b className="text-amber-600">Dados da planilha importada</b> —
            clique em sincronizar para puxar os pagamentos reais do TOTVS
          </span>
        )}
        {congelado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5" title="Mês de importação manual — não sincroniza com o TOTVS">
            🔒 mês congelado
          </span>
        )}
        {travado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5" title="Mês travado após a análise — sem Sincronizar TOTVS e sem alteração de valores/forecast. Clique em Destravar para editar.">
            🔒 mês travado
          </span>
        )}
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={somenteGerais}
            onChange={(e) => setSomenteGerais(e.target.checked)}
            className="accent-[#000638]"
          />
          somente Despesas Gerais
        </label>
        <div className="ml-auto flex items-center gap-2">
          {erroMes && erroMes.m === activeMonth && (
            <span className="text-[11px] text-red-600">{erroMes.msg}</span>
          )}
          <button
            onClick={() => carregarMesTotvs(activeMonth, { somenteGerais })}
            disabled={carregando || bloqueado}
            title={
              travado
                ? 'Mês travado após a análise — destrave para sincronizar'
                : congelado
                  ? 'Mês congelado (importação manual) — o Sincronizar TOTVS fica desabilitado pra não alterar o histórico'
                  : 'Puxa os títulos reais do TOTVS para este mês'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#000638] text-white hover:bg-[#000638]/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            <ArrowsClockwise
              size={13}
              weight="bold"
              className={carregando ? 'animate-spin' : ''}
            />
            {travado ? '🔒 Mês travado' : congelado ? '🔒 Mês congelado' : carregando ? 'Consultando TOTVS…' : 'Sincronizar TOTVS'}
          </button>
          {/* sincroniza SÓ uma despesa (categoria); as outras do mês ficam como estão */}
          <select
            value=""
            disabled={carregando || bloqueado}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              let cat = v;
              if (v === '__outra__') {
                cat = window.prompt(
                  'Nome da despesa (categoria) exatamente como no TOTVS — ex.: SERVICOS PRESTADOS POR TERCEIROS',
                );
                if (!cat || !cat.trim()) return;
              }
              carregarMesTotvs(activeMonth, { somenteGerais, apenasCat: cat.trim().toUpperCase() });
            }}
            title={
              bloqueado
                ? 'Mês bloqueado — destrave para sincronizar'
                : 'Puxa do TOTVS só os lançamentos de UMA despesa; as outras despesas do mês não mudam'
            }
            className="text-xs font-semibold border border-[#000638] text-[#000638] bg-white rounded-lg px-2 py-1.5 max-w-[200px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">🔄 só uma despesa…</option>
            {mo.summary.map((s) => (
              <option key={s.cat} value={s.cat} disabled={catTravada(activeMonth, s.cat)}>
                {catTravada(activeMonth, s.cat) ? '🔒 ' : ''}
                {s.cat}
              </option>
            ))}
            <option value="__outra__">+ outra despesa (digitar o nome)</option>
          </select>
          <button
            onClick={() => {
              const msg = travado
                ? `Destravar ${mo.label}? O mês volta a aceitar alterações e sincronização.`
                : `Travar ${mo.label}? Depois da trava, o mês não sincroniza com o TOTVS e não aceita alteração de lançamentos, valores ou forecast (dá pra destravar depois).`;
              if (window.confirm(msg)) travarMes(activeMonth, !travado);
            }}
            title={travado ? 'Destravar este mês (volta a permitir alterações e sincronização)' : 'Travar este mês após a análise (sem sincronizar, sem alterar valores)'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              travado
                ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                : 'border-[#000638] text-[#000638] bg-white hover:bg-[#000638]/5'
            }`}
          >
            {travado ? '🔓 Destravar mês' : '🔒 Travar mês'}
          </button>
          <input
            ref={obsFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => importarObsPlanilha(e.target.files?.[0])}
          />
          <input
            ref={bonifFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => importarBonifPlanilha(e.target.files?.[0], bonifTipo)}
          />
          <input
            ref={histFileRef}
            type="file"
            accept=".html,.htm"
            className="hidden"
            onChange={(e) => importarHistoricoHtml(e.target.files?.[0])}
          />
          {/* importador geral: um botão, várias planilhas */}
          <div className="relative">
            <button
              onClick={() => setMenuImportar((v) => !v)}
              disabled={importandoObs || importandoBonif || importandoHist}
              title="Importar planilhas para este mês: observações, bonificações (geral / marketing) ou o histórico (HTML)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#000638] text-[#000638] bg-white hover:bg-[#000638]/5 disabled:opacity-60 transition"
            >
              {importandoObs || importandoBonif || importandoHist ? (
                <Spinner size={13} className="animate-spin" />
              ) : (
                <UploadSimple size={13} weight="bold" />
              )}
              {importandoObs
                ? 'Importando observações…'
                : importandoBonif
                  ? 'Importando bonificação…'
                  : importandoHist
                    ? 'Importando histórico…'
                    : 'Importar'}
              <CaretDown size={11} weight="bold" />
            </button>
            {menuImportar && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuImportar(false)} />
                <div className="absolute right-0 mt-1 z-30 w-72 bg-white border border-[#000638]/15 rounded-xl shadow-lg py-1 text-xs">
                  {[
                    {
                      k: 'obs',
                      titulo: 'Importar observação',
                      desc: 'planilha mensal do Contas a Pagar — preenche a coluna Observação',
                      acao: () => obsFileRef.current?.click(),
                    },
                    {
                      k: 'bgeral',
                      titulo: 'Importar bonificação geral',
                      desc: `cada linha vira um lançamento da despesa ${BONIF.geral.nome}`,
                      acao: () => {
                        setBonifTipo('geral');
                        bonifFileRef.current?.click();
                      },
                      bloq: bloqueado,
                    },
                    {
                      k: 'bmkt',
                      titulo: 'Importar bonificação marketing',
                      desc: `cada linha vira um lançamento da despesa ${BONIF.marketing.nome}`,
                      acao: () => {
                        setBonifTipo('marketing');
                        bonifFileRef.current?.click();
                      },
                      bloq: bloqueado,
                    },
                    {
                      k: 'hist',
                      titulo: 'Importar histórico (HTML)',
                      desc: 'jan–ago da análise antiga (valores, lançamentos e observações)',
                      acao: () => histFileRef.current?.click(),
                    },
                  ].map((it) => (
                    <button
                      key={it.k}
                      disabled={it.bloq}
                      onClick={() => {
                        setMenuImportar(false);
                        it.acao();
                      }}
                      title={it.bloq ? 'Mês bloqueado (congelado/travado) — não aceita importação' : undefined}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="font-semibold text-[#000638]">{it.titulo}</div>
                      <div className="text-[10px] text-gray-500">{it.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {ultimaSyncDespesa && ultimaSyncDespesa.m === activeMonth && (
        <div className="rounded-xl px-4 py-2.5 text-xs border bg-emerald-50 text-emerald-800 border-emerald-200 flex flex-wrap items-center gap-2">
          <ArrowsClockwise size={13} weight="bold" />
          <span>
            <b>{ultimaSyncDespesa.cat}</b> sincronizada com o TOTVS às{' '}
            {new Date(ultimaSyncDespesa.em).toLocaleTimeString('pt-BR')}:{' '}
            {ultimaSyncDespesa.depois.n} lançamento{ultimaSyncDespesa.depois.n === 1 ? '' : 's'} ·{' '}
            {fmtBRL(ultimaSyncDespesa.depois.total)}
            {ultimaSyncDespesa.antes.n === ultimaSyncDespesa.depois.n &&
            Math.abs(ultimaSyncDespesa.antes.total - ultimaSyncDespesa.depois.total) < 0.01 ? (
              <> — <b>nada mudou</b> (a DRE já estava igual ao TOTVS).</>
            ) : (
              <>
                {' '}
                — antes: {ultimaSyncDespesa.antes.n} · {fmtBRL(ultimaSyncDespesa.antes.total)}.
                As outras despesas do mês não foram alteradas.
              </>
            )}
          </span>
          <button
            onClick={limparUltimaSyncDespesa}
            className="ml-auto text-emerald-500 hover:text-emerald-800"
            title="Fechar"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      )}

      {msgImportObs && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-semibold border ${
            msgImportObs.tipo === 'erro'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {msgImportObs.texto}
        </div>
      )}

      {carregando && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
          Buscando contas a pagar emitidas em {mo.label} no TOTVS (
          {EMPRESAS_DRE.length} empresas)… isso pode levar alguns segundos.
        </div>
      )}

      {/* filtros globais */}
      <div className="bg-white border border-[#000638]/10 rounded-xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoria…"
          className="border border-[#000638]/20 rounded-lg px-2.5 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-1 focus:ring-[#000638] w-52"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#000638]/20 rounded-lg px-2 py-1.5 text-xs bg-[#f8f9fb] text-[#000638]"
        >
          <option value="">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="aberto">Em aberto</option>
          <option value="vencido">Vencido</option>
        </select>
        <input
          value={fornFilter}
          onChange={(e) => setFornFilter(e.target.value)}
          list="dg-forn-list"
          placeholder="Filtrar fornecedor…"
          className="border border-[#000638]/20 rounded-lg px-2.5 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-1 focus:ring-[#000638] w-60"
        />
        <datalist id="dg-forn-list">
          {fornecedores.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <div className="ml-auto">
          <ActionBtn
            variant="primary"
            onClick={() => {
              const nome = window.prompt(
                'Nome da nova despesa (categoria) para ' +
                  mo.label +
                  ':',
              );
              if (nome && !addCategory(activeMonth, nome))
                window.alert('Já existe uma despesa com esse nome no mês.');
            }}
          >
            <Plus size={12} weight="bold" /> Nova despesa
          </ActionBtn>
        </div>
      </div>

      <CardBox
        title={`DRE Analítica — ${mo.label}`}
        subtitle="clique na categoria para ver os lançamentos · clique no forecast para editar · ✔ marca a despesa como analisada · 🔒 trava a despesa"
        actions={
          visible.length > 0 && (
            <span
              className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border ${
                nAnalisadas === visible.length
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
              title="Despesas marcadas como analisadas neste mês"
            >
              ✔ {nAnalisadas} de {visible.length} analisadas
            </span>
          )
        }
      >
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#000638] text-white">
                <th className="px-3 py-2 w-7"></th>
                <th
                  onClick={() => toggleSort('cat')}
                  title="Clique para ordenar (A→Z, depois Z→A)"
                  className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:bg-white/10"
                >
                  <span className="inline-flex items-center gap-1">Categoria {sortArrow('cat')}</span>
                </th>
                <th
                  onClick={() => toggleSort('realizado')}
                  title="Clique para ordenar (maior→menor, depois menor→maior)"
                  className="px-2 py-2 text-right font-semibold cursor-pointer select-none hover:bg-white/10"
                >
                  <span className="inline-flex items-center justify-end gap-1">Realizado {sortArrow('realizado')}</span>
                </th>
                <th
                  onClick={() => toggleSort('forecast')}
                  title="Clique para ordenar (maior→menor, depois menor→maior)"
                  className="px-2 py-2 text-right font-semibold cursor-pointer select-none hover:bg-white/10"
                >
                  <span className="inline-flex items-center justify-end gap-1">Forecast {sortArrow('forecast')}</span>
                </th>
                <th
                  onClick={() => toggleSort('variacao')}
                  title="Clique para ordenar (maior→menor, depois menor→maior)"
                  className="px-2 py-2 text-right font-semibold cursor-pointer select-none hover:bg-white/10"
                >
                  <span className="inline-flex items-center justify-end gap-1">Variação {sortArrow('variacao')}</span>
                </th>
                <th
                  onClick={() => toggleSort('pct')}
                  title="Clique para ordenar (maior→menor, depois menor→maior)"
                  className="px-2 py-2 text-right font-semibold cursor-pointer select-none hover:bg-white/10"
                >
                  <span className="inline-flex items-center justify-end gap-1">% Total {sortArrow('pct')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bodyRows}
              <tr className="bg-gray-100 font-bold text-[#000638]">
                <td className="px-3 py-2"></td>
                <td className="px-2 py-2">Total</td>
                <td className="px-2 py-2 text-right">{fmtBRL(totalVisivel)}</td>
                <td className="px-2 py-2 text-right text-violet-700">
                  {fcTotal > 0 ? fmtBRL(fcTotal) : '—'}
                </td>
                <td className="px-2 py-2 text-right">
                  {fcTotal > 0 ? <Variacao real={mo.total} fc={fcTotal} /> : '—'}
                </td>
                <td className="px-2 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardBox>
    </div>
  );
}
