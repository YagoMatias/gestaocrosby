import React, { useMemo } from 'react';
import { Plus, X, Flag, Scissors } from '@phosphor-icons/react';
import {
  useDespesasGerais,
  MONTH_KEYS,
  MES_NOME,
  FLAG_STATUS,
  fmtBRL,
} from './store';
import { CardBox, EditableText, ActionBtn, flagStatusClasses } from './comum';

const ORDEM = Object.fromEntries(MONTH_KEYS.map((m, i) => [m, i + 1]));

export default function PaginaFlags({ tipo }) {
  const {
    flags,
    flagRowData,
    updateFlag,
    removeFlag,
    addManualFlag,
    months,
  } = useDespesasGerais();

  const keys = useMemo(() => {
    const ks = Object.keys(flags).filter((k) => flags[k].tipo === tipo);
    ks.sort((a, b) => {
      const A = flagRowData(a);
      const B = flagRowData(b);
      return (
        (ORDEM[A.m] || 99) - (ORDEM[B.m] || 99) ||
        (parseFloat(B.d.val) || 0) - (parseFloat(A.d.val) || 0)
      );
    });
    return ks;
  }, [flags, tipo, flagRowData]);

  const total = keys.reduce(
    (s, k) => s + (parseFloat(flagRowData(k).d.val) || 0),
    0,
  );
  const cnt = useMemo(() => {
    const c = {};
    FLAG_STATUS.forEach((s) => (c[s] = 0));
    keys.forEach((k) => {
      c[flags[k].status || FLAG_STATUS[0]]++;
    });
    return c;
  }, [keys, flags]);

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
          {keys.length > 0 && (
            <div className="text-[11px] text-gray-500 text-right">
              <b className="text-[#000638] text-sm mr-1">{fmtBRL(total)}</b>
              {keys.length} lançamento{keys.length === 1 ? '' : 's'} ·{' '}
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
      {keys.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Nenhum lançamento marcado ainda.
          <br />
          Na <b>DRE Analítica</b>, expanda uma despesa e clique em{' '}
          <Icone size={14} className="inline text-[#000638]" /> na coluna
          &ldquo;Enviar p/&rdquo;.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-3 py-2 text-left font-semibold">Mês</th>
                <th className="px-2 py-2 text-left font-semibold">Despesa</th>
                <th className="px-2 py-2 text-left font-semibold">Fornecedor</th>
                <th className="px-2 py-2 text-left font-semibold">Nr. Dupl.</th>
                <th className="px-2 py-2 text-left font-semibold">Vencimento</th>
                <th className="px-2 py-2 text-right font-semibold">Valor</th>
                <th className="px-2 py-2 text-left font-semibold min-w-[220px]">
                  {ehCorrecao ? 'O que precisa corrigir' : 'Ação / observação'}
                </th>
                <th className="px-2 py-2 text-left font-semibold w-32">Status</th>
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
                          {!r.existe && (
                            <span className="ml-1 text-[9px] text-red-500">
                              (lançamento excluído)
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
                  Total marcado
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
