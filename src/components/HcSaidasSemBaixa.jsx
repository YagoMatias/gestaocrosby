// ============================================================================
// LIBERAÇÃO DE PAGAMENTO HEADCOACH › aba INCLUÍDOS — SAÍDAS DO BANCO SEM BAIXA
// (Yago, 27/11/2026: "todo pagamento deve ser linkado a uma linha e dado baixa
// automática"). Mostra as saídas dos extratos que não têm baixa nem inclusão e,
// para cada uma, deixa:
//   • CASAR com uma duplicata em aberto do Contas a Pagar (a sugerida, outra das
//     possíveis, ou qualquer uma achada pela busca) — a saída é conciliada com
//     ela e a baixa entra na hora: valor igual quita; saída maior = juros e
//     multa; saída menor = baixa parcial; previsão passa a valer o valor da saída;
//   • GERAR a duplicata que casa com a saída (fornecedor + despesa + centro de
//     custo), já baixada e conciliada;
//   • SOLICITAÇÕES CROSBY (todos os status): escolhida uma, aprova o que falta, envia ao
//     Contas a Pagar e casa com a saída (a de patrimônio aguardando conciliação é
//     conciliada com a saída e lançada já paga);
//   • CONTAS A PAGAR DO TOTVS: consulta os títulos de lá; o escolhido vira duplicata no
//     Contas a Pagar HeadCoach e é casado com a saída;
//   • CASAR VÁRIAS DE UMA VEZ: marca as saídas que têm duplicata sugerida e casa
//     todas (cada duplicata paga uma saída só; a tela mostra os pares antes).
// API: /api/hc/contas-pagar/liberacoes/saidas-sem-baixa (services/hcCpSaidasSemBaixa.js).
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bank, Spinner, MagnifyingGlass, X, ArrowsClockwise, CheckCircle, Plus, LinkSimple, Warning } from '@phosphor-icons/react';
import { apiJson } from '../utils/apiAuth';

const CP = '/api/hc/contas-pagar';
const API = `${CP}/liberacoes/saidas-sem-baixa`;
const POR_PAGINA = 50;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const centavos = (v) => Math.round(Math.abs(Number(v) || 0) * 100);
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500';
const TIPOS = {
  igual: { rotulo: 'VALOR IGUAL', cls: 'bg-green-100 text-green-800' },
  acrescimo: { rotulo: 'COM JUROS E MULTA', cls: 'bg-amber-100 text-amber-900' },
  previsao: { rotulo: 'PREVISÃO', cls: 'bg-sky-100 text-sky-800' },
  parcial: { rotulo: 'PARCIAL', cls: 'bg-gray-200 text-gray-700' },
};

// o que acontece ao casar a saída com a duplicata (a mesma conta do servidor, para mostrar antes de confirmar)
function consequencia(saidaValor, d) {
  const S = centavos(saidaValor);
  const F = centavos(d.falta);
  if (d.previsao && S !== F) return { tipo: 'previsao', texto: `É previsão: a duplicata passa a valer ${fmtBRL(saidaValor)} e fica paga.` };
  if (S === F) return { tipo: 'igual', texto: 'Valor igual: a duplicata fica paga.' };
  if (S > F) return { tipo: 'acrescimo', texto: `A saída é ${fmtBRL((S - F) / 100)} maior: a duplicata fica paga e a diferença entra como juros e multa.` };
  return { tipo: 'parcial', texto: `A saída é menor: baixa parcial, ficam ${fmtBRL((F - S) / 100)} em aberto na duplicata.` };
}
// só vem pré-escolhida a duplicata do mesmo fornecedor que fecha a conta (igual, juros ou previsão)
const serveDeSugestao = (c) => c.mesmoFornecedor && c.tipo !== 'parcial';
const sugerida = (s) => (s.candidatas || []).find(serveDeSugestao) || null;
// casar em lote: cada saída fica com a sua duplicata sugerida, e a mesma duplicata não paga duas saídas
function montarPares(lista) {
  const usadas = new Set();
  const pares = [];
  const semPar = [];
  for (const s of lista) {
    const c = (s.candidatas || []).find((x) => serveDeSugestao(x) && !usadas.has(x.tituloId));
    if (c) {
      usadas.add(c.tituloId);
      pares.push({ s, c });
    } else semPar.push(s);
  }
  return { pares, semPar };
}

function Selo({ tipo }) {
  const t = TIPOS[tipo];
  return t ? <span className={`ml-1 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-bold ${t.cls}`}>{t.rotulo}</span> : null;
}

export default function HcSaidasSemBaixa({ onMudou, avisar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [soSugeridas, setSoSugeridas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState(null); // a saída no modal
  const [selecionadas, setSelecionadas] = useState(() => new Set()); // saídas marcadas para casar de uma vez
  const [lote, setLote] = useState(null); // { pares, semPar, feitas, resultado } — a janela do casar em lote
  const [op, setOp] = useState(null); // despesas e centros de custo (para gerar a duplicata)

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(API);
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    if (!aberta || op) return;
    apiJson(`${CP}/opcoes`)
      .then((j) => setOp(j.data))
      .catch(() => setOp({ despesas: [], centrosCusto: [] }));
  }, [aberta, op]);

  const saidas = dados?.saidas || [];
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return saidas.filter((s) => {
      if (soSugeridas && !sugerida(s)) return false;
      if (!t) return true;
      return `${s.para || ''} ${s.memo || ''} ${s.banco || ''} ${s.empresa || ''} ${Number(s.valor).toFixed(2)} ${fmtBRL(s.valor)} ${fmtData(s.data)}`.toLowerCase().includes(t);
    });
  }, [saidas, busca, soSugeridas]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pag = Math.min(pagina, totalPaginas);
  const daPagina = filtradas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const comSugestao = saidas.filter((s) => sugerida(s)).length;
  // seleção: só entra saída que tem duplicata sugerida
  const marcaveis = filtradas.filter((s) => sugerida(s));
  const marcadas = saidas.filter((s) => selecionadas.has(s.lancamentoId) && sugerida(s));
  const todasMarcadas = marcaveis.length > 0 && marcaveis.every((s) => selecionadas.has(s.lancamentoId));
  const marcar = (ids, sim) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      ids.forEach((id) => (sim ? novo.add(id) : novo.delete(id)));
      return novo;
    });
  // casa os pares um a um (cada baixa é uma chamada; o servidor confere tudo de novo) e mostra o andamento
  const casarLote = async () => {
    const pares = lote.pares;
    const ok = [];
    const erros = [];
    setLote((l) => ({ ...l, rodando: true, feitas: 0 }));
    for (let i = 0; i < pares.length; i += 1) {
      const { s, c } = pares[i];
      try {
        const j = await apiJson(`${API}/casar`, { method: 'POST', body: { lancamentoId: s.lancamentoId, chave: s.chave, tituloId: c.tituloId } });
        ok.push({ s, c, msg: j?.message || 'casada' });
      } catch (e) {
        erros.push({ s, c, motivo: e.message });
      }
      setLote((l) => (l ? { ...l, feitas: i + 1 } : l));
    }
    const resolvidas = new Set(ok.map((x) => x.s.lancamentoId));
    const titulosUsados = new Set(ok.map((x) => x.c.tituloId));
    setDados((d) => (d ? { ...d, saidas: d.saidas.filter((x) => !resolvidas.has(x.lancamentoId)).map((x) => ({ ...x, candidatas: x.candidatas.filter((k) => !titulosUsados.has(k.tituloId)) })) } : d));
    setSelecionadas(new Set(erros.map((x) => x.s.lancamentoId)));
    setLote((l) => (l ? { ...l, rodando: false, resultado: { ok, erros } } : l));
    if (ok.length) {
      avisar?.(erros.length ? 'erro' : 'ok', `${ok.length} saída(s) casada(s) e baixada(s)${erros.length ? ` · ${erros.length} não casou(aram)` : ''}`);
      onMudou?.();
    }
  };

  // tira a saída resolvida da lista sem recarregar tudo (a lista leva uns 20 segundos)
  const resolvida = (lancamentoId, tituloId, msg) => {
    setDados((d) => (d ? { ...d, saidas: d.saidas.filter((s) => s.lancamentoId !== lancamentoId).map((s) => ({ ...s, candidatas: tituloId ? s.candidatas.filter((c) => c.tituloId !== tituloId) : s.candidatas })) } : d));
    setAberta(null);
    avisar?.('ok', msg);
    onMudou?.();
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2">
        <Bank size={18} weight="bold" className="text-[#000638]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#000638]">
            Saídas do banco sem baixa{dados ? ` (${saidas.length})` : ''}
            {dados ? <span className="ml-2 font-normal text-gray-600">{fmtBRL(saidas.reduce((t, s) => t + Number(s.valor), 0))}</span> : null}
          </p>
          <p className="text-[11px] text-gray-500">
            Saíram do banco e ainda não têm duplicata baixada nem pagamento incluído
            {dados?.periodo ? ` · extratos de ${fmtData(dados.periodo.de)} a ${fmtData(dados.periodo.ate)}` : ''}. Escolha a duplicata que casa com a saída, ou gere a duplicata.
            {dados?.naBaixaAutomatica ? ` ${dados.naBaixaAutomatica} saída(s) já casam com duplicata incluída e ficam com a Baixa automática.` : ''}
          </p>
        </div>
        <button type="button" onClick={carregar} disabled={carregando} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40">
          {carregando ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} weight="bold" />} {carregando ? 'LENDO OS EXTRATOS…' : 'ATUALIZAR'}
        </button>
      </div>

      {erro && <p className="m-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {carregando && !dados && <p className="px-3 py-6 text-center text-xs text-gray-500">Lendo os extratos e procurando as duplicatas que casam… leva uns 20 segundos.</p>}

      {(dados?.baixasSemLinha || []).length > 0 && (
        <div className="m-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">
          <p className="flex items-center gap-1 font-bold">
            <Warning size={14} weight="bold" /> {dados.baixasSemLinha.length} baixa(s) sem linha do extrato ligada
          </p>
          <p className="mb-1 text-[11px]">Foram baixadas direto no Contas a Pagar, sem casar com uma saída do banco. Confira se a saída está na lista abaixo.</p>
          {dados.baixasSemLinha.slice(0, 12).map((b) => (
            <div key={b.baixaId}>
              {fmtData(b.data)} · <b>{b.fornecedor}</b> · {b.rotulo} · emp. {b.empresa} · {fmtBRL(b.valor)} · {b.conta || 'sem banco'} · {b.por || '—'}
            </div>
          ))}
        </div>
      )}

      {dados && (
        <>
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="relative min-w-[220px] flex-1">
              <MagnifyingGlass size={14} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar por quem recebeu, valor, banco ou data"
                className={`${inputCls} pl-7`}
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={soSugeridas}
                onChange={(e) => {
                  setSoSugeridas(e.target.checked);
                  setPagina(1);
                }}
                className="h-4 w-4 accent-[#000638]"
              />
              só as que têm duplicata sugerida ({comSugestao})
            </label>
          </div>
          <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50/60 px-3 py-2 text-xs text-[#000638]">
            {marcadas.length > 0 ? (
              <span>
                <b>{marcadas.length}</b> saída(s) marcada(s) · <b>{fmtBRL(marcadas.reduce((t, x) => t + Number(x.valor), 0))}</b>
              </span>
            ) : (
              <span className="text-gray-600">Marque as saídas que têm duplicata sugerida para casar todas de uma vez.</span>
            )}
            {marcaveis.length > 0 && !todasMarcadas && (
              <button type="button" onClick={() => marcar(marcaveis.map((x) => x.lancamentoId), true)} className="font-semibold text-green-800 underline">
                marcar as {marcaveis.length} com duplicata sugerida
              </button>
            )}
            {marcadas.length > 0 && (
              <button type="button" onClick={() => setSelecionadas(new Set())} className="font-semibold text-gray-600 underline">
                limpar
              </button>
            )}
            <button type="button" disabled={!marcadas.length} onClick={() => setLote({ ...montarPares(marcadas), feitas: 0, rodando: false, resultado: null })} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
              <CheckCircle size={14} weight="bold" /> CASAR {marcadas.length || ''} SELECIONADA(S)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-1.5">
                    <input type="checkbox" title="Marcar todas as que têm duplicata sugerida (do filtro)" disabled={!marcaveis.length} checked={todasMarcadas} onChange={(e) => marcar(marcaveis.map((x) => x.lancamentoId), e.target.checked)} className="h-4 w-4 shrink-0 accent-green-600" />
                  </th>
                  <th className="px-2 py-1.5">Saiu em</th>
                  <th className="px-2 py-1.5">Banco</th>
                  <th className="px-2 py-1.5">Para quem</th>
                  <th className="px-2 py-1.5 text-right">Valor</th>
                  <th className="px-2 py-1.5">Duplicata que casa</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-gray-400">
                      {saidas.length ? 'Nenhuma saída com esse filtro.' : 'Nenhuma saída do banco sem baixa nesse período.'}
                    </td>
                  </tr>
                )}
                {daPagina.map((s) => {
                  const c = sugerida(s);
                  const outras = (s.candidatas || []).length - (c ? 1 : 0);
                  return (
                    <tr key={s.lancamentoId} className={`align-top hover:bg-indigo-50/40 ${selecionadas.has(s.lancamentoId) ? 'bg-green-50/60' : ''}`}>
                      <td className="px-2 py-1.5">
                        {c && <input type="checkbox" checked={selecionadas.has(s.lancamentoId)} onChange={(e) => marcar([s.lancamentoId], e.target.checked)} className="h-4 w-4 shrink-0 accent-green-600" />}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtData(s.data)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5" title={s.empresa || ''}>
                        {s.banco || s.conta}
                      </td>
                      <td className="max-w-[280px] px-2 py-1.5" title={s.memo || ''}>
                        <span className="font-semibold">{s.para || '—'}</span>
                        {s.tarifa && <span className="ml-1 rounded bg-gray-200 px-1 py-0.5 text-[10px] font-bold text-gray-700">TARIFA</span>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-bold tabular-nums">{fmtBRL(s.valor)}</td>
                      <td className="px-2 py-1.5">
                        {c ? (
                          <span>
                            <b>{c.fornecedor}</b> · {c.rotulo} · emp. {c.empresa} · vence {fmtData(c.vencimento)} · {fmtBRL(c.falta)}
                            <Selo tipo={c.tipo} />
                            {c.acrescimo > 0 && <span className="ml-1 text-[11px] text-amber-800">+ {fmtBRL(c.acrescimo)}</span>}
                            {c.liberacao && <span className="ml-1 text-[10px] text-indigo-700">na Liberação ({c.liberacao})</span>}
                            {outras > 0 && <span className="ml-1 text-[10px] text-gray-500">+{outras} possível(is)</span>}
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            {outras > 0 ? `${outras} duplicata(s) possível(is), nenhuma certa` : 'nenhuma duplicata em aberto parecida'}
                            {s.sugestao?.fornecedorNome ? ` · gerar para ${s.sugestao.fornecedorNome}${s.sugestao.despesaNome ? ` (${s.sugestao.despesaNome})` : ''}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        <button type="button" onClick={() => setAberta(s)} className={`rounded px-2 py-1 text-[10px] font-bold text-white ${c ? 'bg-green-600 hover:bg-green-700' : 'bg-[#000638] hover:bg-indigo-900'}`}>
                          {c ? 'CASAR' : 'RESOLVER'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-end gap-2 px-3 py-2 text-xs text-gray-600">
              <button type="button" disabled={pag <= 1} onClick={() => setPagina(pag - 1)} className="rounded px-2 py-1 ring-1 ring-gray-300 disabled:opacity-40">
                anterior
              </button>
              página {pag} de {totalPaginas} · {filtradas.length} saída(s)
              <button type="button" disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)} className="rounded px-2 py-1 ring-1 ring-gray-300 disabled:opacity-40">
                próxima
              </button>
            </div>
          )}
        </>
      )}

      {aberta && <ModalDaSaida s={aberta} op={op} onFechar={() => setAberta(null)} onResolvida={resolvida} />}

      {/* CASAR VÁRIAS DE UMA VEZ: mostra os pares (saída → duplicata) antes de gravar */}
      {lote && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => !lote.rodando && setLote(null)}>
          <div className="my-6 w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start gap-2">
              <h3 className="flex-1 text-lg font-bold text-[#000638]">{lote.resultado ? 'Resultado' : `Casar ${lote.pares.length} saída(s) com as duplicatas sugeridas`}</h3>
              {!lote.rodando && (
                <button onClick={() => setLote(null)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
                  <X size={18} />
                </button>
              )}
            </div>

            {!lote.resultado && (
              <>
                <p className="mb-2 text-xs text-gray-600">Cada saída abaixo será conciliada com a duplicata ao lado, e a duplicata recebe a baixa com a data e o banco da saída. Não tem estorno: confira os pares antes de confirmar.</p>
                <div className="mb-2 max-h-[50vh] overflow-auto rounded-lg ring-1 ring-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5">Saída do banco</th>
                        <th className="px-2 py-1.5 text-right">Valor</th>
                        <th className="px-2 py-1.5">Duplicata que recebe a baixa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lote.pares.map(({ s: sd, c }, i) => (
                        <tr key={sd.lancamentoId} className={`align-top ${lote.rodando && i < lote.feitas ? 'bg-green-50' : ''}`}>
                          <td className="px-2 py-1.5">
                            {fmtData(sd.data)} · {sd.banco || sd.conta} · <b>{sd.para || '—'}</b>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-bold tabular-nums">{fmtBRL(sd.valor)}</td>
                          <td className="px-2 py-1.5">
                            <b>{c.fornecedor}</b> · {c.rotulo} · emp. {c.empresa} · vence {fmtData(c.vencimento)} · {fmtBRL(c.falta)}
                            <Selo tipo={c.tipo} />
                            {c.acrescimo > 0 && <span className="ml-1 text-[11px] text-amber-800">+ {fmtBRL(c.acrescimo)} de juros e multa</span>}
                            {c.tipo === 'previsao' && <span className="ml-1 text-[11px] text-sky-800">passa a valer {fmtBRL(sd.valor)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lote.semPar.length > 0 && (
                  <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                    <b>{lote.semPar.length} saída(s) marcada(s) ficam de fora</b>: a duplicata sugerida para elas já está neste lote com outra saída (cada duplicata paga uma só). Resolva essas uma a uma depois: {lote.semPar.map((x) => `${x.para || '—'} ${fmtBRL(x.valor)}`).join(' · ')}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <p className="mr-auto text-sm">
                    {lote.pares.length} saída(s) · <b className="text-green-700">{fmtBRL(lote.pares.reduce((t, x) => t + Number(x.s.valor), 0))}</b>
                    {lote.rodando && <span className="ml-2 text-xs text-gray-600">casando {lote.feitas} de {lote.pares.length}…</span>}
                  </p>
                  <button disabled={lote.rodando} onClick={() => setLote(null)} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40">
                    Voltar
                  </button>
                  <button disabled={lote.rodando || !lote.pares.length} onClick={casarLote} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
                    {lote.rodando ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />} CASAR E DAR BAIXA EM {lote.pares.length}
                  </button>
                </div>
              </>
            )}

            {lote.resultado && (
              <>
                <p className="mb-2 text-sm">
                  <b className="text-green-700">{lote.resultado.ok.length} casada(s) e baixada(s)</b>
                  {lote.resultado.ok.length ? ` · ${fmtBRL(lote.resultado.ok.reduce((t, x) => t + Number(x.s.valor), 0))}` : ''}
                  {lote.resultado.erros.length > 0 && <b className="ml-2 text-rose-700">{lote.resultado.erros.length} não casou(aram)</b>}
                </p>
                {lote.resultado.erros.length > 0 && (
                  <div className="mb-2 max-h-56 overflow-y-auto rounded-lg bg-rose-50 p-2 text-xs text-rose-800 ring-1 ring-rose-200">
                    {lote.resultado.erros.map((x) => (
                      <div key={x.s.lancamentoId} className="py-0.5">
                        {fmtData(x.s.data)} · <b>{x.s.para || '—'}</b> · {fmtBRL(x.s.valor)} → {x.c.fornecedor} {x.c.rotulo}: {x.motivo}
                      </div>
                    ))}
                    <p className="mt-1 text-[11px]">Essas continuam na lista e ficaram marcadas.</p>
                  </div>
                )}
                {lote.resultado.ok.length > 0 && (
                  <div className="mb-2 max-h-56 overflow-y-auto rounded-lg bg-green-50 p-2 text-xs text-green-900 ring-1 ring-green-200">
                    {lote.resultado.ok.map((x) => (
                      <div key={x.s.lancamentoId} className="py-0.5">
                        {x.msg}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => setLote(null)} className="h-9 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white hover:bg-indigo-900">
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── modal: casar com uma duplicata ou gerar a duplicata ─────────────────────
function ModalDaSaida({ s, op, onFechar, onResolvida }) {
  const pre = sugerida(s);
  const [aba, setAba] = useState((s.candidatas || []).length ? 'casar' : 'gerar');
  const [escolhida, setEscolhida] = useState(pre || null); // a duplicata escolhida (das possíveis ou da busca)
  const [termo, setTermo] = useState('');
  const [achadas, setAchadas] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  // gerar
  const [fornecedor, setFornecedor] = useState(s.sugestao?.fornecedorCodigo ? { code: s.sugestao.fornecedorCodigo, nome: s.sugestao.fornecedorNome } : null);
  const [termoForn, setTermoForn] = useState('');
  const [fornecedores, setFornecedores] = useState(null);
  const [despesa, setDespesa] = useState(s.sugestao?.despesaCodigo ? String(s.sugestao.despesaCodigo) : '');
  const [centro, setCentro] = useState('');
  // solicitações crosby
  const [sols, setSols] = useState(null);
  const [termoSol, setTermoSol] = useState('');
  const [solEscolhida, setSolEscolhida] = useState(null);
  // contas a pagar do TOTVS
  const maisDias = (iso, n) => {
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const [fornT, setFornT] = useState(s.sugestao?.fornecedorCodigo ? { code: s.sugestao.fornecedorCodigo, nome: s.sugestao.fornecedorNome } : null);
  const [termoFornT, setTermoFornT] = useState('');
  const [fornecedoresT, setFornecedoresT] = useState(null);
  const [deT, setDeT] = useState(maisDias(s.data, -90));
  const [ateT, setAteT] = useState(maisDias(s.data, 30));
  const [dupT, setDupT] = useState('');
  const [titulosT, setTitulosT] = useState(null);
  const [itemT, setItemT] = useState(null);

  const buscarSolicitacoes = async (q = '') => {
    setBuscando(true);
    setErro('');
    try {
      const qs = new URLSearchParams({ lancamentoId: String(s.lancamentoId), ...(s.chave ? { chave: s.chave } : {}), ...(q.trim() ? { q: q.trim() } : {}) }).toString();
      const j = await apiJson(`${API}/solicitacoes?${qs}`);
      setSols(j.data?.solicitacoes || []);
      setSolEscolhida(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };
  const buscarFornecedoresT = async () => {
    if (!termoFornT.trim()) return;
    setBuscando(true);
    setErro('');
    try {
      const j = await apiJson(`${CP}/fornecedores?q=${encodeURIComponent(termoFornT.trim())}`);
      setFornecedoresT(j.data?.fornecedores || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };
  // a mesma consulta da tela "Consulta do Contas a Pagar" (títulos do TOTVS): por fornecedor, por número
  // da duplicata, ou — sem nenhum dos dois — pelos títulos de valor igual ou até 10% menor que a saída
  const buscarTotvs = async () => {
    const empresas = (op?.empresas || []).map((e) => Number(e.code)).filter((n) => n > 0);
    if (!empresas.length) {
      setErro('Não achei as empresas para consultar.');
      return;
    }
    setBuscando(true);
    setErro('');
    setItemT(null);
    try {
      const body = { dt_inicio: deT, dt_fim: ateT, branches: empresas, modo: 'vencimento', situacao: 'N', previsao: 'TODOS', filtroPagamento: 'TODOS' };
      const dup = String(dupT).replace(/\D/g, '');
      if (fornT) body.supplierCodeList = [Number(fornT.code)];
      if (dup) body.duplicateCodeList = [Number(dup)];
      if (!fornT && !dup) Object.assign(body, { valorInicial: Math.floor((Number(s.valor) / 1.1) * 100) / 100, valorFinal: Number(s.valor) });
      const j = await apiJson('/api/totvs/accounts-payable/search', { method: 'POST', body, timeoutMs: 180000 });
      const lista = Array.isArray(j?.data) ? j.data : Array.isArray(j?.data?.data) ? j.data.data : Array.isArray(j?.metadata?.data) ? j.metadata.data : [];
      setTitulosT(lista);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };
  useEffect(() => {
    if (aba === 'solicitacao' && sols === null && !buscando) buscarSolicitacoes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const buscarDuplicatas = async () => {
    if (!termo.trim()) return;
    setBuscando(true);
    setErro('');
    try {
      const qs = new URLSearchParams({ situacao: 'aberto', campoData: 'vencimento', de: '2020-01-01', ate: '2099-12-31', fornecedor: termo.trim() }).toString();
      const j = await apiJson(`${CP}/titulos?${qs}`);
      setAchadas((j.data?.titulos || []).map((t) => ({ tituloId: t.id, empresa: t.empresa, fornecedor: t.fornecedor_nome, rotulo: `${t.duplicata}/${t.parcela}`, documento: t.documento_fiscal, despesa: t.despesa_nome, vencimento: t.vencimento, valor: Number(t.valor), falta: Number(t.tela?.saldo ?? t.valor), previsao: t.previsao === 'previsao', liberacao: t.liberacao?.status || null })));
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };
  const buscarFornecedores = async () => {
    if (!termoForn.trim()) return;
    setBuscando(true);
    setErro('');
    try {
      const j = await apiJson(`${CP}/fornecedores?q=${encodeURIComponent(termoForn.trim())}`);
      setFornecedores(j.data?.fornecedores || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };
  const enviar = async (caminho, body, tituloId) => {
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}${caminho}`, { method: 'POST', body });
      onResolvida(s.lancamentoId, tituloId, j?.message || 'Feito');
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  const Linha = ({ d }) => {
    const marcada = escolhida?.tituloId === d.tituloId;
    const c = consequencia(s.valor, d);
    return (
      <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs ring-1 ${marcada ? 'bg-green-50 ring-green-300' : 'ring-gray-200 hover:bg-gray-50'}`}>
        <input type="radio" name="dup" checked={marcada} onChange={() => setEscolhida(d)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-600" />
        <span className="min-w-0 flex-1">
          <b>{d.fornecedor}</b> · {d.rotulo} · emp. {d.empresa} · vence {fmtData(d.vencimento)}
          {d.documento ? ` · doc ${d.documento}` : ''}
          {d.despesa ? ` · ${d.despesa}` : ''}
          <span className="ml-1 font-bold tabular-nums">{fmtBRL(d.falta)}</span>
          <Selo tipo={c.tipo} />
          {d.mesmoFornecedor === false && <span className="ml-1 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-bold text-rose-800">OUTRO NOME</span>}
          {d.liberacao && <span className="ml-1 text-[10px] text-indigo-700">na Liberação ({d.liberacao})</span>}
        </span>
      </label>
    );
  };
  const abaCls = (k) => `rounded-t-lg px-3 py-1.5 text-xs font-bold ${aba === k ? 'bg-white text-[#000638] ring-1 ring-gray-200' : 'text-gray-500 hover:text-[#000638]'}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[#000638]">Saída de {fmtBRL(s.valor)}</h3>
            <p className="text-xs text-gray-600">
              {fmtData(s.data)} · {s.banco || s.conta} · para <b>{s.para || '—'}</b>
              {s.empresa ? ` · ${s.empresa}` : ''}
            </p>
            {s.memo && s.memo !== s.para && <p className="text-[11px] text-gray-500">{s.memo}</p>}
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          <button type="button" onClick={() => setAba('casar')} className={abaCls('casar')}>
            <LinkSimple size={13} weight="bold" className="mr-1 inline" /> Casar com duplicata em aberto
          </button>
          <button type="button" onClick={() => setAba('solicitacao')} className={abaCls('solicitacao')}>
            Solicitações Crosby
          </button>
          <button type="button" onClick={() => setAba('totvs')} className={abaCls('totvs')}>
            Contas a Pagar do TOTVS
          </button>
          <button type="button" onClick={() => setAba('gerar')} className={abaCls('gerar')}>
            <Plus size={13} weight="bold" className="mr-1 inline" /> Gerar a duplicata
          </button>
        </div>

        {aba === 'casar' && (
          <div className="pt-3">
            {(s.candidatas || []).length > 0 ? (
              <>
                <p className={labelCls}>Duplicatas que podem ser este pagamento</p>
                <div className="mb-3 max-h-56 space-y-1 overflow-y-auto">
                  {s.candidatas.map((d) => (
                    <Linha key={d.tituloId} d={d} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600 ring-1 ring-gray-200">Não achei duplicata em aberto parecida com esta saída. Busque abaixo ou gere a duplicata.</p>
            )}
            <p className={labelCls}>Buscar outra duplicata em aberto (fornecedor, código ou CPF/CNPJ)</p>
            <div className="mb-2 flex gap-2">
              <input value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarDuplicatas()} className={inputCls} />
              <button type="button" onClick={buscarDuplicatas} disabled={buscando || !termo.trim()} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40">
                {buscando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} BUSCAR
              </button>
            </div>
            {achadas && (
              <div className="mb-3 max-h-56 space-y-1 overflow-y-auto">
                {achadas.length === 0 && <p className="text-xs text-gray-500">Nenhuma duplicata em aberto para essa busca.</p>}
                {achadas.map((d) => (
                  <Linha key={`b-${d.tituloId}`} d={d} />
                ))}
              </div>
            )}
            {escolhida && (
              <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-900 ring-1 ring-green-200">
                <b>
                  {escolhida.fornecedor} · {escolhida.rotulo}
                </b>{' '}
                — {consequencia(s.valor, escolhida).texto} A baixa usa a data e o banco da saída, e a saída fica conciliada. Não tem estorno.
              </p>
            )}
            {erro && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onFechar} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
                Voltar
              </button>
              <button disabled={busy || !escolhida} onClick={() => enviar('/casar', { lancamentoId: s.lancamentoId, chave: s.chave, tituloId: escolhida.tituloId }, escolhida.tituloId)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
                {busy ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />} CASAR E DAR BAIXA
              </button>
            </div>
          </div>
        )}

        {aba === 'solicitacao' && (
          <div className="pt-3">
            <p className={labelCls}>Buscar solicitação (fornecedor, solicitante, CPF/CNPJ, número ou valor) — em branco mostra as parecidas com a saída</p>
            <div className="mb-2 flex gap-2">
              <input value={termoSol} onChange={(e) => setTermoSol(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarSolicitacoes(termoSol)} className={inputCls} />
              <button type="button" onClick={() => buscarSolicitacoes(termoSol)} disabled={buscando} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40">
                {buscando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} BUSCAR
              </button>
            </div>
            {sols === null && buscando && <p className="mb-2 text-xs text-gray-500">Procurando as solicitações parecidas com esta saída…</p>}
            {sols && (
              <div className="mb-3 max-h-72 space-y-1 overflow-y-auto">
                {sols.length === 0 && <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600 ring-1 ring-gray-200">Nenhuma solicitação {termoSol.trim() ? 'com essa busca' : 'de valor ou recebedor parecido com esta saída'}.</p>}
                {sols.map((x) => {
                  const marcada = solEscolhida?.id === x.id;
                  const mesmoValor = centavos(x.valor) === centavos(s.valor);
                  return (
                    <label key={x.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ring-1 ${!x.pode ? 'cursor-not-allowed bg-gray-50 text-gray-500 ring-gray-200' : marcada ? 'cursor-pointer bg-green-50 ring-green-300' : 'cursor-pointer ring-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="sol" disabled={!x.pode} checked={marcada} onChange={() => setSolEscolhida(x)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-600" />
                      <span className="min-w-0 flex-1">
                        <span className="mr-1 rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-bold text-indigo-800">{x.statusRotulo}</span>
                        <b>{x.fornecedor || '—'}</b> · <b className={`tabular-nums ${mesmoValor ? 'text-green-700' : ''}`}>{fmtBRL(x.valor)}</b>
                        {mesmoValor && <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-[10px] font-bold text-green-800">VALOR IGUAL</span>} · vence {fmtData(x.vencimento)} · {x.solicitante || '—'}
                        {x.setor ? ` (${x.setor})` : ''} · pedida em {fmtData(x.criadaEm)}
                        {x.notaFiscal && <span className="ml-1 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-bold text-orange-800">{x.escriturada ? 'NF ESCRITURADA' : 'NF NÃO ESCRITURADA'}</span>}
                        {x.duplicatas.length > 0 && <span className="ml-1 text-[10px] text-indigo-700">duplicata {x.duplicatas.map((d) => `${d.rotulo} (${d.situacao})`).join(', ')}</span>}
                        {x.descricao && <span className="block truncate text-[11px] text-gray-500">{x.descricao}</span>}
                        {!x.pode && <span className="block text-[11px] text-rose-700">{x.motivo}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {solEscolhida && (
              <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-900 ring-1 ring-green-200">
                {solEscolhida.acao === 'casar' && 'Esta solicitação já tem duplicata em aberto no Contas a Pagar: a saída é casada com ela e a baixa entra.'}
                {solEscolhida.acao === 'conciliar-lancar' && `Produto de patrimônio: a solicitação é conciliada com esta saída (fica paga) e a duplicata entra no Contas a Pagar já paga.${centavos(solEscolhida.valor) !== centavos(s.valor) ? ' ATENÇÃO: o valor da solicitação é diferente do da saída — essa conciliação exige valor igual e vai recusar.' : ''}`}
                {solEscolhida.acao === 'aprovar-enviar-casar' &&
                  `Aprova o que falta (gestor e financeiro, no seu nome), envia ao Contas a Pagar e casa a duplicata com esta saída.${centavos(s.valor) > centavos(solEscolhida.valor) ? ` A saída é ${fmtBRL((centavos(s.valor) - centavos(solEscolhida.valor)) / 100)} maior: a diferença entra como juros e multa.` : centavos(s.valor) < centavos(solEscolhida.valor) ? ` A saída é menor: baixa parcial, ficam ${fmtBRL((centavos(solEscolhida.valor) - centavos(s.valor)) / 100)} em aberto.` : ''}`}{' '}
                Não tem estorno.
              </p>
            )}
            {erro && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onFechar} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
                Voltar
              </button>
              <button disabled={busy || !solEscolhida} onClick={() => enviar('/solicitacao', { lancamentoId: s.lancamentoId, chave: s.chave, solicitacaoId: solEscolhida.id }, solEscolhida.duplicatas?.[0]?.tituloId || null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
                {busy ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />} {solEscolhida?.acao === 'casar' ? 'CASAR E DAR BAIXA' : solEscolhida?.acao === 'conciliar-lancar' ? 'CONCILIAR E LANÇAR' : 'APROVAR, ENVIAR E CASAR'}
              </button>
            </div>
          </div>
        )}

        {aba === 'totvs' && (
          <div className="pt-3">
            <p className="mb-2 text-xs text-gray-600">Consulta os títulos do contas a pagar do TOTVS. O escolhido vira duplicata no Contas a Pagar HeadCoach (com a marca TOTVS) e é casado com esta saída.</p>
            <p className={labelCls}>Fornecedor (em branco busca pelos títulos de valor igual ou até 10% menor que a saída)</p>
            {fornT ? (
              <p className="mb-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs ring-1 ring-gray-200">
                <b className="flex-1">
                  {fornT.code} · {fornT.nome}
                </b>
                <button type="button" onClick={() => setFornT(null)} className="font-semibold text-indigo-700 underline">
                  tirar
                </button>
              </p>
            ) : (
              <>
                <div className="mb-2 flex gap-2">
                  <input value={termoFornT} onChange={(e) => setTermoFornT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarFornecedoresT()} placeholder="código, nome ou CPF/CNPJ" className={inputCls} />
                  <button type="button" onClick={buscarFornecedoresT} disabled={buscando || !termoFornT.trim()} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40">
                    ACHAR
                  </button>
                </div>
                {fornecedoresT && (
                  <div className="mb-2 max-h-32 overflow-y-auto rounded-lg ring-1 ring-gray-200">
                    {fornecedoresT.length === 0 && <p className="p-2 text-xs text-gray-500">Nenhum fornecedor com essa busca.</p>}
                    {fornecedoresT.map((x) => (
                      <button key={x.code} type="button" onClick={() => setFornT({ code: x.code, nome: x.nome })} className="block w-full px-2 py-1 text-left text-xs hover:bg-indigo-50">
                        <b>{x.code}</b> · {x.nome} {x.cpf_cnpj ? `· ${x.cpf_cnpj}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Vencimento de</label>
                <input type="date" value={deT} onChange={(e) => setDeT(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Até</label>
                <input type="date" value={ateT} onChange={(e) => setAteT(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nº da duplicata</label>
                <input value={dupT} onChange={(e) => setDupT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarTotvs()} className={inputCls} />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={buscarTotvs} disabled={buscando || !op} className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg px-3 text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40">
                  {buscando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} CONSULTAR
                </button>
              </div>
            </div>
            {titulosT && (
              <div className="mb-3 max-h-64 space-y-1 overflow-y-auto">
                {titulosT.length === 0 && <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600 ring-1 ring-gray-200">Nenhum título no contas a pagar do TOTVS com esses filtros.</p>}
                {titulosT.map((t, i) => {
                  const marcado = itemT === t;
                  const baixado = Boolean(t.dt_liq) || Number(t.vl_pago) > 0;
                  const mesmoValor = centavos(t.vl_duplicata) === centavos(s.valor);
                  return (
                    <label key={`${t.cd_empresa}-${t.cd_fornecedor}-${t.nr_duplicata}-${t.nr_parcela}-${i}`} className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs ring-1 ${marcado ? 'bg-green-50 ring-green-300' : 'ring-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="tot" checked={marcado} onChange={() => setItemT(t)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-600" />
                      <span className="min-w-0 flex-1">
                        emp. {t.cd_empresa} · <b>{t.nm_fornecedor || `fornecedor ${t.cd_fornecedor}`}</b> · dup {t.nr_duplicata}/{t.nr_parcela} · vence {fmtData(t.dt_vencimento)} · <b className={`tabular-nums ${mesmoValor ? 'text-green-700' : ''}`}>{fmtBRL(t.vl_duplicata)}</b>
                        {mesmoValor && <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-[10px] font-bold text-green-800">VALOR IGUAL</span>}
                        {t.ds_despesaitem ? ` · ${t.ds_despesaitem}` : ''}
                        {baixado ? <span className="ml-1 rounded bg-gray-200 px-1 py-0.5 text-[10px] font-bold text-gray-700">BAIXADO NO TOTVS{t.dt_liq ? ` EM ${fmtData(t.dt_liq)}` : ''}</span> : <span className="ml-1 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-bold text-sky-800">EM ABERTO NO TOTVS</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {itemT && (
              <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-900 ring-1 ring-green-200">
                <b>
                  dup {itemT.nr_duplicata}/{itemT.nr_parcela}
                </b>{' '}
                — {consequencia(s.valor, { falta: Number(itemT.vl_duplicata), previsao: false }).texto} A duplicata nasce no Contas a Pagar HeadCoach (se já existir lá em aberto, é usada) e recebe a baixa com a data e o banco da saída. Não tem estorno.
              </p>
            )}
            {erro && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onFechar} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
                Voltar
              </button>
              <button disabled={busy || !itemT} onClick={() => enviar('/totvs', { lancamentoId: s.lancamentoId, chave: s.chave, item: itemT }, null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
                {busy ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />} GERAR NO HEADCOACH E CASAR
              </button>
            </div>
          </div>
        )}

        {aba === 'gerar' && (
          <div className="pt-3">
            <p className="mb-2 text-xs text-gray-600">
              A duplicata nasce no Contas a Pagar com o valor ({fmtBRL(s.valor)}) e a data ({fmtData(s.data)}) da saída, na empresa da conta{s.empresa ? ` (${s.empresa})` : ''}, já baixada e com a saída conciliada.
              {s.sugestao?.fonte ? ` Sugestão de fornecedor e despesa: ${String(s.sugestao.fonte).replace(" no TOTVS", "")}.` : ''}
            </p>
            <p className={labelCls}>Fornecedor</p>
            {fornecedor ? (
              <p className="mb-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs ring-1 ring-gray-200">
                <b className="flex-1">
                  {fornecedor.code} · {fornecedor.nome}
                </b>
                <button type="button" onClick={() => setFornecedor(null)} className="font-semibold text-indigo-700 underline">
                  trocar
                </button>
              </p>
            ) : (
              <>
                <div className="mb-2 flex gap-2">
                  <input value={termoForn} onChange={(e) => setTermoForn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarFornecedores()} placeholder="código, nome ou CPF/CNPJ" className={inputCls} />
                  <button type="button" onClick={buscarFornecedores} disabled={buscando || !termoForn.trim()} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40">
                    {buscando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} BUSCAR
                  </button>
                </div>
                {fornecedores && (
                  <div className="mb-2 max-h-40 overflow-y-auto rounded-lg ring-1 ring-gray-200">
                    {fornecedores.length === 0 && <p className="p-2 text-xs text-gray-500">Nenhum fornecedor com essa busca.</p>}
                    {fornecedores.map((f) => (
                      <button key={f.code} type="button" onClick={() => setFornecedor({ code: f.code, nome: f.nome })} className="block w-full px-2 py-1 text-left text-xs hover:bg-indigo-50">
                        <b>{f.code}</b> · {f.nome} {f.cpf_cnpj ? `· ${f.cpf_cnpj}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Despesa</label>
                <select value={despesa} onChange={(e) => setDespesa(e.target.value)} className={inputCls}>
                  <option value="">Escolha…</option>
                  {(op?.despesas || []).map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} · {d.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Centro de custo (em branco = 10 · Matriz)</label>
                <select value={centro} onChange={(e) => setCentro(e.target.value)} className={inputCls}>
                  <option value="">10 · padrão</option>
                  {(op?.centrosCusto || []).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {erro && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={onFechar} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
                Voltar
              </button>
              <button disabled={busy || !fornecedor || !despesa} onClick={() => enviar('/gerar', { lancamentoId: s.lancamentoId, chave: s.chave, fornecedorCode: fornecedor.code, despesaCode: Number(despesa), centroCustoCode: centro ? Number(centro) : null }, null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white hover:bg-indigo-900 disabled:opacity-40">
                {busy ? <Spinner size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />} GERAR DUPLICATA E DAR BAIXA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
