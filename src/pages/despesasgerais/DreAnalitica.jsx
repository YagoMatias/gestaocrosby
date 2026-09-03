import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  CaretRight,
  CaretDown,
  Plus,
  X,
  Flag,
  Scissors,
  Trash,
  ArrowsClockwise,
  CloudArrowDown,
} from '@phosphor-icons/react';
import {
  useDespesasGerais,
  groupOf,
  fmtBRL,
  STATUS_LIST,
  EMPRESAS_DRE,
  CONSULTA_VERSAO,
} from './store';
import { CardBox, StatusBadge, EditableText, ActionBtn } from './comum';

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

// célula de forecast editável
function FcCell({ fcKey, value, onCommit }) {
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
      title="clique para definir o forecast"
      className="font-medium text-violet-700"
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
    mergeRealizedG,
    setForecast,
    updateRow,
    deleteRow,
    addRow,
    addCategory,
    deleteCategory,
    flagKeyFor,
    toggleFlag,
    flags,
  } = useDespesasGerais();

  const mo = months[activeMonth];
  const fonte = fontes[activeMonth] || {};
  const carregando = carregandoMes === activeMonth;
  const [somenteGerais, setSomenteGerais] = useState(
    fonte.somenteGerais !== false,
  );

  // primeira visita ao mês, mês vazio ou regra de consulta desatualizada
  // → busca os títulos reais no TOTVS
  useEffect(() => {
    const desatualizado =
      fonte.origem !== 'totvs' ||
      mo.cnt === 0 ||
      fonte.consulta !== CONSULTA_VERSAO;
    if (desatualizado && !carregandoMes)
      carregarMesTotvs(activeMonth, { somenteGerais });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fornFilter, setFornFilter] = useState('');
  const [catFornFilter, setCatFornFilter] = useState({}); // 'mes||cat' -> [forns]
  const [catSort, setCatSort] = useState({}); // 'mes||cat' -> 'asc'|'desc'
  const [catPayFilter, setCatPayFilter] = useState({}); // 'mes||cat' -> 'pago'|'aberto'

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
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Excluir a despesa "${cat}" e todos os seus lançamentos de ${activeMonth.toUpperCase()}?`,
                    )
                  )
                    deleteCategory(activeMonth, cat);
                }}
                className="ml-auto inline-flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700"
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
  visible.forEach((s) => {
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
      const fc =
        forecasts[fcKey] !== undefined ? parseFloat(forecasts[fcKey]) : null;
      const realComb = mergeRealizedG(gp.g, activeMonth);
      const n = gp.members.length;
      gp.members.forEach((gm, idx) => {
        const gmPct =
          mo.total > 0 ? ((gm.total / mo.total) * 100).toFixed(1) : '0.0';
        bodyRows.push(
          <tr
            key={gm.cat}
            onClick={() => toggleExpand(gm.cat)}
            className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50/40 ${
              idx === 0 ? 'border-t-2 border-t-violet-200' : ''
            } ${idx === n - 1 ? 'border-b-2 border-b-violet-200' : ''}`}
          >
            <td className="px-3 py-2 w-7">{arrow(gm.cat)}</td>
            <td className="px-2 py-2 font-medium text-[#000638]">
              {gm.cat}
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
                <FcCell fcKey={fcKey} value={fc} onCommit={setForecast} />
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
    const fc =
      forecasts[fcKey] !== undefined ? parseFloat(forecasts[fcKey]) : null;
    bodyRows.push(
      <tr
        key={s.cat}
        onClick={() => toggleExpand(s.cat)}
        className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40"
      >
        <td className="px-3 py-2 w-7">{arrow(s.cat)}</td>
        <td className="px-2 py-2 font-medium text-[#000638]">{s.cat}</td>
        <td className="px-2 py-2 text-right">{fmtBRL(s.total)}</td>
        <td
          className="px-2 py-2 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <FcCell fcKey={fcKey} value={fc} onCommit={setForecast} />
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
            disabled={carregando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#000638] text-white hover:bg-[#000638]/90 disabled:opacity-60 transition"
          >
            <ArrowsClockwise
              size={13}
              weight="bold"
              className={carregando ? 'animate-spin' : ''}
            />
            {carregando ? 'Consultando TOTVS…' : 'Sincronizar TOTVS'}
          </button>
        </div>
      </div>

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
        subtitle="clique na categoria para ver os lançamentos · clique no forecast para editar"
      >
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#000638] text-white">
                <th className="px-3 py-2 w-7"></th>
                <th className="px-2 py-2 text-left font-semibold">Categoria</th>
                <th className="px-2 py-2 text-right font-semibold">Realizado</th>
                <th className="px-2 py-2 text-right font-semibold">Forecast</th>
                <th className="px-2 py-2 text-right font-semibold">Variação</th>
                <th className="px-2 py-2 text-right font-semibold">% Total</th>
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
