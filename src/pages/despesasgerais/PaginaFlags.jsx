import React, { useMemo, useState } from 'react';
import {
  Plus,
  X,
  Flag,
  Scissors,
  CaretUp,
  CaretDown,
  CaretUpDown,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import {
  useDespesasGerais,
  MONTH_KEYS,
  MES_NOME,
  FLAG_STATUS,
  fmtBRL,
} from './store';
import { CardBox, EditableText, ActionBtn, flagStatusClasses } from './comum';

const ORDEM = Object.fromEntries(MONTH_KEYS.map((m, i) => [m, i + 1]));

// 'DD/MM/AAAA' → tempo (p/ ordenar vencimento); 0 quando vazio/ inválido
const vencTime = (s) => {
  const [d, m, y] = String(s || '').split('/').map(Number);
  return y ? new Date(y, m - 1, d).getTime() : 0;
};

export default function PaginaFlags({ tipo }) {
  const {
    flags,
    flagRowData,
    updateFlag,
    removeFlag,
    addManualFlag,
    months,
  } = useDespesasGerais();

  const [busca, setBusca] = useState('');
  const [statusFil, setStatusFil] = useState('');
  const [mesFil, setMesFil] = useState('');
  const [sort, setSort] = useState({ col: null, dir: 'desc' });

  // todas as linhas desse tipo (correção/corte) com dados resolvidos
  const linhas = useMemo(() => {
    return Object.keys(flags)
      .filter((k) => flags[k].tipo === tipo)
      .map((k) => ({ k, r: flagRowData(k), f: flags[k] }));
  }, [flags, tipo, flagRowData]);

  // meses presentes (para o filtro)
  const mesesPresentes = useMemo(() => {
    const set = new Set(linhas.map((x) => x.r.m).filter(Boolean));
    return MONTH_KEYS.filter((m) => set.has(m));
  }, [linhas]);

  // aplica busca + filtro de status/mês
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter(({ r, f }) => {
      if (statusFil && (f.status || FLAG_STATUS[0]) !== statusFil) return false;
      if (mesFil && r.m !== mesFil) return false;
      if (q) {
        const alvo = `${r.cat || ''} ${r.d.forn || ''} ${r.d.dupl || ''} ${f.nota || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [linhas, busca, statusFil, mesFil]);

  // ordena conforme o cabeçalho (padrão: mês asc, depois valor desc)
  const ordenadas = useMemo(() => {
    const arr = filtradas.slice();
    const dir = sort.dir === 'asc' ? 1 : -1;
    const valor = (x, col) => {
      switch (col) {
        case 'mes': return ORDEM[x.r.m] || 99;
        case 'cat': return (x.r.cat || '').toLowerCase();
        case 'forn': return (x.r.d.forn || '').toLowerCase();
        case 'venc': return vencTime(x.r.d.venc);
        case 'val': return parseFloat(x.r.d.val) || 0;
        case 'status': return FLAG_STATUS.indexOf(x.f.status || FLAG_STATUS[0]);
        default: return 0;
      }
    };
    if (!sort.col) {
      arr.sort(
        (a, b) =>
          (ORDEM[a.r.m] || 99) - (ORDEM[b.r.m] || 99) ||
          (parseFloat(b.r.d.val) || 0) - (parseFloat(a.r.d.val) || 0),
      );
      return arr;
    }
    arr.sort((a, b) => {
      const ka = valor(a, sort.col);
      const kb = valor(b, sort.col);
      let c;
      if (typeof ka === 'string') c = ka.localeCompare(kb, 'pt-BR');
      else c = ka - kb;
      return c !== 0 ? dir * c : 0;
    });
    return arr;
  }, [filtradas, sort]);

  const keys = ordenadas.map((x) => x.k);

  const total = ordenadas.reduce(
    (s, x) => s + (parseFloat(x.r.d.val) || 0),
    0,
  );
  const cnt = useMemo(() => {
    const c = {};
    FLAG_STATUS.forEach((s) => (c[s] = 0));
    ordenadas.forEach((x) => {
      c[x.f.status || FLAG_STATUS[0]]++;
    });
    return c;
  }, [ordenadas]);

  // lista de despesas para autocomplete do lançamento manual
  const catList = useMemo(() => {
    const set = new Set();
    MONTH_KEYS.forEach((m) =>
      Object.keys(months[m].details).forEach((c) => set.add(c)),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [months]);

  const ehCorrecao = tipo === 'correcao';
  const Icone = ehCorrecao ? Flag : Scissors;
  const temFiltro = busca || statusFil || mesFil;

  // ciclo: desc → asc → padrão
  const clickSort = (col) =>
    setSort((p) =>
      p.col !== col
        ? { col, dir: 'desc' }
        : p.dir === 'desc'
          ? { col, dir: 'asc' }
          : { col: null, dir: 'desc' },
    );
  const arrow = (col) =>
    sort.col !== col ? (
      <CaretUpDown size={10} className="opacity-40" />
    ) : sort.dir === 'desc' ? (
      <CaretDown size={10} weight="bold" />
    ) : (
      <CaretUp size={10} weight="bold" />
    );
  const Th = ({ col, children, align = 'left', cls = '' }) => (
    <th
      onClick={() => clickSort(col)}
      className={`px-2 py-2 text-${align} font-semibold cursor-pointer select-none hover:bg-white/10 ${cls}`}
      title="Clique para ordenar"
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {children} {arrow(col)}
      </span>
    </th>
  );

  return (
    <CardBox
      title={ehCorrecao ? 'Correções DRE' : 'Corte de custo'}
      subtitle={
        ehCorrecao
          ? 'lançamentos marcados na DRE Analítica que precisam de correção · clique na observação para escrever o que corrigir'
          : 'lançamentos marcados como oportunidade de corte · clique na observação para descrever a ação'
      }
      actions={
        <div className="flex items-center gap-3">
          {ordenadas.length > 0 && (
            <div className="text-[11px] text-gray-500 text-right">
              <b className="text-[#000638] text-sm mr-1">{fmtBRL(total)}</b>
              {ordenadas.length} lançamento{ordenadas.length === 1 ? '' : 's'} ·{' '}
              {FLAG_STATUS.map((s) => `${cnt[s]} ${s.toLowerCase()}`).join(' · ')}
            </div>
          )}
          <ActionBtn variant="primary" onClick={() => addManualFlag(tipo)}>
            <Plus size={12} weight="bold" /> Incluir lançamento manual
          </ActionBtn>
        </div>
      }
    >
      <datalist id="dg-cat-list">
        {catList.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* barra de filtros */}
      {linhas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
          <div className="relative">
            <MagnifyingGlass
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="buscar despesa, fornecedor, duplicata ou nota…"
              className="text-[11px] border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 bg-white w-64"
            />
          </div>
          <select
            value={statusFil}
            onChange={(e) => setStatusFil(e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">Todos os status</option>
            {FLAG_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={mesFil}
            onChange={(e) => setMesFil(e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">Todos os meses</option>
            {mesesPresentes.map((m) => (
              <option key={m} value={m}>
                {MES_NOME[m]}
              </option>
            ))}
          </select>
          {temFiltro && (
            <button
              onClick={() => {
                setBusca('');
                setStatusFil('');
                setMesFil('');
              }}
              className="text-[11px] text-gray-500 hover:text-gray-700 underline"
            >
              limpar filtros
            </button>
          )}
          <span className="ml-auto text-[11px] text-gray-400">
            {ordenadas.length} de {linhas.length}
          </span>
        </div>
      )}

      {linhas.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Nenhum lançamento marcado ainda.
          <br />
          Na <b>DRE Analítica</b>, expanda uma despesa e clique em{' '}
          <Icone size={14} className="inline text-[#000638]" /> na coluna
          &ldquo;Enviar p/&rdquo;.
        </div>
      ) : ordenadas.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Nenhum lançamento encontrado com esse filtro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#000638] text-white">
                <Th col="mes">Mês</Th>
                <Th col="cat">Despesa</Th>
                <Th col="forn">Fornecedor</Th>
                <th className="px-2 py-2 text-left font-semibold">Nr. Dupl.</th>
                <Th col="venc">Vencimento</Th>
                <Th col="val" align="right">Valor</Th>
                <th className="px-2 py-2 text-left font-semibold min-w-[220px]">
                  {ehCorrecao ? 'O que precisa corrigir' : 'Ação / observação'}
                </th>
                <Th col="status" cls="w-32">Status</Th>
                <th className="px-2 py-2 text-center font-semibold w-16">
                  Remover
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const r = flagRowData(k);
                const f = flags[k];
                const man = !!f.manual;
                return (
                  <tr
                    key={k}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      man ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      {man ? (
                        <select
                          value={f.mes}
                          onChange={(e) => updateFlag(k, { mes: e.target.value })}
                          className="text-[11px] border border-gray-200 rounded px-1 py-0.5 bg-white"
                        >
                          {MONTH_KEYS.map((m) => (
                            <option key={m} value={m}>
                              {MES_NOME[m]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        MES_NOME[r.m] || r.m
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-medium text-[#000638]">
                      {man ? (
                        <input
                          list="dg-cat-list"
                          value={f.cat}
                          onChange={(e) =>
                            updateFlag(k, { cat: e.target.value.toUpperCase() })
                          }
                          placeholder="despesa…"
                          className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white w-48"
                        />
                      ) : (
                        <>
                          {r.cat || '—'}
                          {(!r.existe || r.excluido) && (
                            <span
                              className="ml-1 text-[9px] text-red-500"
                              title="O lançamento foi excluído na DRE Analítica; esta linha continua aqui com os dados salvos"
                            >
                              (lançamento excluído da DRE)
                            </span>
                          )}
                        </>
                      )}
                      {man && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase text-amber-600 bg-amber-100 rounded-full px-1.5 py-0.5">
                          manual
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 max-w-[200px] truncate" title={r.d.forn}>
                      {man ? (
                        <EditableText
                          value={r.d.forn}
                          placeholder="clique…"
                          onCommit={(v) => updateFlag(k, { 'snap.forn': v })}
                        />
                      ) : (
                        r.d.forn || '—'
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-gray-500">
                      {man ? (
                        <EditableText
                          value={r.d.dupl}
                          placeholder="clique…"
                          onCommit={(v) => updateFlag(k, { 'snap.dupl': v })}
                        />
                      ) : (
                        r.d.dupl || '—'
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-gray-500">
                      {man ? (
                        <EditableText
                          value={r.d.venc}
                          placeholder="clique…"
                          onCommit={(v) => updateFlag(k, { 'snap.venc': v })}
                        />
                      ) : (
                        r.d.venc || '—'
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-[#000638]">
                      {man ? (
                        <EditableText
                          value={fmtBRL(r.d.val || 0)}
                          onCommit={(v) => {
                            const n = parseFloat(
                              String(v)
                                .replace(/[R$\s]/g, '')
                                .replace(/\./g, '')
                                .replace(',', '.'),
                            );
                            updateFlag(k, {
                              'snap.val': isNaN(n) ? 0 : Math.round(n * 100) / 100,
                            });
                          }}
                        />
                      ) : (
                        fmtBRL(r.d.val || 0)
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">
                      <EditableText
                        value={f.nota}
                        textarea
                        placeholder="clique para escrever…"
                        onCommit={(v) => updateFlag(k, { nota: v })}
                        className="block"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={f.status || FLAG_STATUS[0]}
                        onChange={(e) => updateFlag(k, { status: e.target.value })}
                        className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${flagStatusClasses(
                          f.status || FLAG_STATUS[0],
                        )}`}
                      >
                        {FLAG_STATUS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => removeFlag(k)}
                        title="Remover desta lista"
                        className="text-gray-300 hover:text-red-600 transition"
                      >
                        <X size={13} weight="bold" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 font-bold text-[#000638]">
                <td colSpan={5} className="px-3 py-2">
                  {temFiltro ? 'Total filtrado' : 'Total marcado'}
                </td>
                <td className="px-2 py-2 text-right">{fmtBRL(total)}</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </CardBox>
  );
}
