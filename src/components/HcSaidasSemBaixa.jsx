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
//     custo), já baixada e conciliada.
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
const sugerida = (s) => (s.candidatas || []).find((c) => c.mesmoFornecedor && c.tipo !== 'parcial') || null;

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
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
                    <td colSpan={6} className="px-2 py-8 text-center text-gray-400">
                      {saidas.length ? 'Nenhuma saída com esse filtro.' : 'Nenhuma saída do banco sem baixa nesse período.'}
                    </td>
                  </tr>
                )}
                {daPagina.map((s) => {
                  const c = sugerida(s);
                  const outras = (s.candidatas || []).length - (c ? 1 : 0);
                  return (
                    <tr key={s.lancamentoId} className="align-top hover:bg-indigo-50/40">
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
              <button disabled={busy || !escolhida} onClick={() => enviar('/casar', { lancamentoId: s.lancamentoId, tituloId: escolhida.tituloId }, escolhida.tituloId)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
                {busy ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />} CASAR E DAR BAIXA
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
              <button disabled={busy || !fornecedor || !despesa} onClick={() => enviar('/gerar', { lancamentoId: s.lancamentoId, fornecedorCode: fornecedor.code, despesaCode: Number(despesa), centroCustoCode: centro ? Number(centro) : null }, null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white hover:bg-indigo-900 disabled:opacity-40">
                {busy ? <Spinner size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />} GERAR DUPLICATA E DAR BAIXA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
