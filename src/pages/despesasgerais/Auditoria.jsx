import React, { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, LinkSimple, LinkSimpleBreak } from '@phosphor-icons/react';
import { useDespesasGerais, MONTH_KEYS, MES_NOME, MES_SHORT, fmtBRL } from './store';
import { CardBox, ActionBtn } from './comum';
import { apiJson } from '../../utils/apiAuth';

// Auditoria: confronta a DRE Analítica com o que está registrado no Dryland.
// Primeira despesa auditada: SERVICOS PRESTADOS POR TERCEIROS × Contratos PJ
// (área DP do Dryland, pagamentos por competência). O Dryland é a fonte da
// verdade — o que diverge é a DRE que precisa de correção.

const CATEGORIA = 'SERVICOS PRESTADOS POR TERCEIROS';
const ANO = 2026;
const VINCULOS_KEY = 'dre-auditoria-pj:vinculos:v1';

const MES_NUM = Object.fromEntries(MONTH_KEYS.map((m, i) => [m, i + 1]));
const compDe = (m) => `${ANO}-${String(MES_NUM[m]).padStart(2, '0')}`;

// palavras que não ajudam a casar nome de contrato com fornecedor do TOTVS
const RUIDO = new Set([
  'LTDA', 'ME', 'MEI', 'EPP', 'EIRELI', 'SA', 'S', 'A', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'E',
  'SERVICOS', 'SERVICO', 'PRESTACAO', 'CONSULTORIA', 'COMERCIO', 'CIA', 'LTDA.', 'PJ',
]);
const tokens = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 3 && !RUIDO.has(t));

// similaridade por tokens: fração dos tokens do menor conjunto presentes no outro
function similaridade(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let comum = 0;
  A.forEach((t) => {
    if (B.has(t)) comum++;
  });
  return comum / Math.min(A.size, B.size);
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const STATUS = {
  ok: { label: 'OK', cls: 'bg-green-100 text-green-700 border-green-200' },
  valor: { label: 'Valor divergente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  falta_dre: { label: 'Falta na DRE', cls: 'bg-red-100 text-red-700 border-red-200' },
  so_dre: { label: 'Só na DRE', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
};

function lerVinculos() {
  try {
    return JSON.parse(localStorage.getItem(VINCULOS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

// Casa pagamentos do Dryland (competência) com lançamentos da DRE (mês).
// vinculos: { `${comp}|${contratoId}`: rowId } — vínculos manuais têm prioridade.
function confrontar(pagamentos, linhas, vinculos, comp) {
  const usadas = new Set();
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const resultado = [];

  // 1) vínculos manuais
  const pendentes = [];
  for (const p of pagamentos) {
    const rid = vinculos[`${comp}|${p.contratoId}`];
    const l = rid && porId.get(rid);
    if (l && !usadas.has(l.id)) {
      usadas.add(l.id);
      resultado.push({ pag: p, linha: l, manual: true });
    } else pendentes.push(p);
  }

  // 2) automático: melhor similaridade de nome; empate → valor mais próximo
  for (const p of pendentes) {
    let melhor = null;
    let melhorScore = 0;
    for (const l of linhas) {
      if (usadas.has(l.id)) continue;
      const s = similaridade(p.nome, l.forn);
      if (s < 0.5) continue;
      const dif = Math.abs(r2(l.val) - r2(p.valor_pago));
      const score = s + (dif < 0.01 ? 0.5 : 0) - Math.min(dif / 1e6, 0.1);
      if (score > melhorScore) {
        melhorScore = score;
        melhor = l;
      }
    }
    if (melhor) usadas.add(melhor.id);
    resultado.push({ pag: p, linha: melhor || null, manual: false });
  }

  const itens = resultado.map((r) => {
    const vDry = r2(r.pag.valor_pago);
    const vDre = r.linha ? r2(r.linha.val) : 0;
    const status = !r.linha ? 'falta_dre' : Math.abs(vDry - vDre) > 0.01 ? 'valor' : 'ok';
    return { ...r, vDry, vDre, dif: r2(vDre - vDry), status };
  });
  const soDre = linhas
    .filter((l) => !usadas.has(l.id))
    .map((l) => ({ pag: null, linha: l, vDry: 0, vDre: r2(l.val), dif: r2(l.val), status: 'so_dre', manual: false }));
  return [...itens, ...soDre];
}

export default function Auditoria() {
  const { months, activeMonth, setActiveMonth } = useDespesasGerais();
  const [pj, setPj] = useState(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [vinculos, setVinculos] = useState(lerVinculos);
  const [soDivergentes, setSoDivergentes] = useState(false);

  const carregar = async (refresh = false) => {
    setLoading(true);
    setErro('');
    try {
      const j = await apiJson(`/api/dre-auditoria/pj${refresh ? '?refresh=1' : ''}`);
      setPj(j.data);
    } catch (e) {
      setErro(e.message || 'Falha ao ler o Dryland');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    carregar();
  }, []);

  const salvarVinculo = (chave, rowId) => {
    const nv = { ...vinculos };
    if (rowId) nv[chave] = rowId;
    else delete nv[chave];
    setVinculos(nv);
    try {
      localStorage.setItem(VINCULOS_KEY, JSON.stringify(nv));
    } catch {
      /* sem persistência */
    }
  };

  const comp = compDe(activeMonth);
  const linhas = useMemo(
    () => ((months[activeMonth] && months[activeMonth].details[CATEGORIA]) || []).map((l) => ({ ...l })),
    [months, activeMonth],
  );

  // pagamentos do Dryland nessa competência (contratos ativos ou não — o que foi pago, foi pago)
  const pagamentos = useMemo(() => {
    if (!pj) return [];
    const out = [];
    for (const c of pj.contratos || []) {
      for (const p of c.pagamentos || []) {
        if (p.competencia !== comp) continue;
        out.push({
          contratoId: c.id,
          nome: c.nome,
          valor_contrato: c.valor,
          status_contrato: c.status,
          valor_pago: p.valor_pago,
          data_pagamento: p.data_pagamento,
        });
      }
    }
    return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [pj, comp]);

  const itens = useMemo(
    () => (pj ? confrontar(pagamentos, linhas, vinculos, comp) : []),
    [pj, pagamentos, linhas, vinculos, comp],
  );

  const resumo = useMemo(() => {
    const r = { dry: 0, dre: 0, ok: 0, valor: 0, falta_dre: 0, so_dre: 0 };
    itens.forEach((i) => {
      r.dry += i.vDry;
      r.dre += i.vDre;
      r[i.status]++;
    });
    r.dry = r2(r.dry);
    r.dre = r2(r.dre);
    return r;
  }, [itens]);

  // visão anual: Dryland × DRE por mês (só totais)
  const anual = useMemo(() => {
    const porComp = {};
    (pj?.contratos || []).forEach((c) =>
      (c.pagamentos || []).forEach((p) => {
        porComp[p.competencia] = r2((porComp[p.competencia] || 0) + p.valor_pago);
      }),
    );
    return MONTH_KEYS.map((m) => {
      const rows = (months[m] && months[m].details[CATEGORIA]) || [];
      const dre = r2(rows.reduce((a, l) => a + (Number(l.val) || 0), 0));
      const dry = porComp[compDe(m)] || 0;
      return { m, dre, dry, dif: r2(dre - dry), temDre: rows.length > 0 };
    });
  }, [pj, months]);

  const visiveis = soDivergentes ? itens.filter((i) => i.status !== 'ok') : itens;
  const linhasLivres = linhas.filter((l) => !itens.some((i) => i.linha && i.linha.id === l.id && i.pag));

  return (
    <div className="space-y-4">
      <CardBox
        title={`Dryland × DRE — ${CATEGORIA}`}
        subtitle="Totais por mês: pagamentos dos Contratos PJ (Dryland, fonte da verdade) contra os lançamentos da despesa na DRE Analítica · clique no mês para auditar"
        actions={
          <ActionBtn onClick={() => carregar(true)} title="Relê os Contratos PJ no Dryland">
            <ArrowsClockwise size={12} weight="bold" className={loading ? 'animate-spin' : ''} />
            {loading ? 'Lendo Dryland…' : 'Atualizar Dryland'}
          </ActionBtn>
        }
      >
        {erro && (
          <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Não consegui ler os Contratos PJ no Dryland: {erro}
          </div>
        )}
        <div className="overflow-x-auto p-3">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-2 py-2 text-left font-semibold">Mês</th>
                {MONTH_KEYS.map((m) => (
                  <th
                    key={m}
                    onClick={() => setActiveMonth(m)}
                    className={`px-2 py-2 text-right font-semibold cursor-pointer ${
                      m === activeMonth ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    {MES_SHORT[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-2 py-1.5 font-semibold text-[#000638]">Dryland (PJ pago)</td>
                {anual.map((a) => (
                  <td key={a.m} className="px-2 py-1.5 text-right font-mono">
                    {a.dry ? fmtBRL(a.dry) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-2 py-1.5 font-semibold text-[#000638]">DRE Analítica</td>
                {anual.map((a) => (
                  <td key={a.m} className="px-2 py-1.5 text-right font-mono">
                    {a.temDre ? fmtBRL(a.dre) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50 font-bold">
                <td className="px-2 py-1.5 text-[#000638]">Diferença (DRE − Dryland)</td>
                {anual.map((a) => (
                  <td
                    key={a.m}
                    className={`px-2 py-1.5 text-right font-mono ${
                      !a.temDre && !a.dry ? 'text-gray-300' : Math.abs(a.dif) > 0.01 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {!a.temDre && !a.dry ? '—' : fmtBRL(a.dif)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardBox>

      <CardBox
        title={`${MES_NOME[activeMonth]} / ${ANO} — lançamento a lançamento`}
        subtitle="Cada pagamento PJ do Dryland casado com o lançamento da DRE (por nome do fornecedor; vínculo manual quando o automático não acha)"
        actions={
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
            <input type="checkbox" checked={soDivergentes} onChange={(e) => setSoDivergentes(e.target.checked)} />
            só divergências
          </label>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 px-4 pt-3">
          <Kpi label="Dryland" valor={fmtBRL(resumo.dry)} />
          <Kpi label="DRE" valor={fmtBRL(resumo.dre)} />
          <Kpi
            label="Diferença"
            valor={fmtBRL(r2(resumo.dre - resumo.dry))}
            cor={Math.abs(resumo.dre - resumo.dry) > 0.01 ? 'text-red-600' : 'text-green-600'}
          />
          <Kpi label="OK" valor={resumo.ok} cor="text-green-600" />
          <Kpi label="Valor divergente" valor={resumo.valor} cor="text-amber-600" />
          <Kpi label="Faltam / só na DRE" valor={`${resumo.falta_dre} / ${resumo.so_dre}`} cor="text-red-600" />
        </div>

        {!pj && !erro ? (
          <div className="py-10 text-center text-sm text-gray-400">Lendo os Contratos PJ no Dryland…</div>
        ) : visiveis.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            {itens.length === 0
              ? `Nenhum pagamento PJ no Dryland nem lançamento na DRE em ${MES_NOME[activeMonth]}.`
              : 'Nenhuma divergência neste mês. ✅'}
          </div>
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#000638] text-white">
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                  <th className="px-2 py-2 text-left font-semibold">Contrato PJ (Dryland)</th>
                  <th className="px-2 py-2 text-right font-semibold">Pago Dryland</th>
                  <th className="px-2 py-2 text-left font-semibold">Pgto.</th>
                  <th className="px-2 py-2 text-left font-semibold">Fornecedor (DRE)</th>
                  <th className="px-2 py-2 text-left font-semibold">Nr. Dupl.</th>
                  <th className="px-2 py-2 text-left font-semibold">Venc.</th>
                  <th className="px-2 py-2 text-right font-semibold">Valor DRE</th>
                  <th className="px-2 py-2 text-right font-semibold">Diferença</th>
                  <th className="px-2 py-2 text-center font-semibold w-12">Vínc.</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i, idx) => {
                  const st = STATUS[i.status];
                  const chave = i.pag ? `${comp}|${i.pag.contratoId}` : null;
                  return (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-medium text-[#000638]">
                        {i.pag ? (
                          <>
                            {i.pag.nome}
                            {i.pag.status_contrato !== 'ativo' && (
                              <span className="ml-1 text-[9px] text-gray-400">(encerrado)</span>
                            )}
                            {i.pag.valor_contrato > 0 && Math.abs(i.pag.valor_contrato - i.vDry) > 0.01 && (
                              <div className="text-[9px] text-gray-400">contrato {fmtBRL(i.pag.valor_contrato)}/mês</div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 italic">não está no Dryland</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold">{i.pag ? fmtBRL(i.vDry) : '—'}</td>
                      <td className="px-2 py-1.5 font-mono text-gray-500">{i.pag?.data_pagamento ? fmtData(i.pag.data_pagamento) : '—'}</td>
                      <td className="px-2 py-1.5 max-w-[220px]">
                        {i.linha ? (
                          <span title={i.linha.forn}>{i.linha.forn}</span>
                        ) : (
                          <select
                            className="text-[11px] border border-red-200 rounded px-1 py-0.5 bg-white max-w-[220px]"
                            value=""
                            onChange={(e) => e.target.value && salvarVinculo(chave, e.target.value)}
                            title="Vincular manualmente a um lançamento da DRE que não foi casado"
                          >
                            <option value="">vincular lançamento da DRE…</option>
                            {linhasLivres.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.forn} · {fmtBRL(l.val)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-gray-500">{i.linha?.dupl || '—'}</td>
                      <td className="px-2 py-1.5 font-mono text-gray-500">{i.linha?.venc || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{i.linha ? fmtBRL(i.vDre) : '—'}</td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono font-semibold ${
                          i.status === 'ok' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {i.status === 'ok' ? '—' : fmtBRL(i.dif)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {i.manual ? (
                          <button
                            onClick={() => salvarVinculo(chave, null)}
                            title="Vínculo manual — clique para desfazer"
                            className="text-[#000638] hover:text-red-600"
                          >
                            <LinkSimpleBreak size={13} />
                          </button>
                        ) : i.pag && i.linha ? (
                          <LinkSimple size={13} className="text-gray-300 inline" title="casado automaticamente pelo nome" />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-100 font-bold text-[#000638]">
                  <td colSpan={2} className="px-2 py-2">Total do mês</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(resumo.dry)}</td>
                  <td colSpan={4}></td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(resumo.dre)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(r2(resumo.dre - resumo.dry))}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {pj?.lido_em && (
          <div className="px-4 pb-3 text-[10px] text-gray-400">
            Dryland lido em {new Date(pj.lido_em).toLocaleString('pt-BR')} · {pj.contratos?.length || 0} contratos
          </div>
        )}
      </CardBox>
    </div>
  );
}

function Kpi({ label, valor, cor = 'text-[#000638]' }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm font-bold ${cor}`}>{valor}</div>
    </div>
  );
}

function fmtData(iso) {
  const s = String(iso).slice(0, 10);
  const [a, m, d] = s.split('-');
  return a && m && d ? `${d}/${m}/${a}` : s;
}
