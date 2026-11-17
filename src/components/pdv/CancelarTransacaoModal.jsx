// CANCELAMENTO DE TRANSAÇÃO do PDV Crosby (Yago, 17/11/2026).
// Uma tela só para cancelar tudo de uma vez: a nota fiscal na SEFAZ, a
// transação e os títulos do contas a receber. Lista as transações do PDV da
// empresa no período; ao escolher uma, mostra o que ela tem (nota, pagamentos,
// títulos) e os avisos; com o motivo escrito, cancela.
// Regra do servidor: com nota autorizada a SEFAZ decide — se ela recusa, nada
// é cancelado. Credev/adiantamento usados voltam para o cliente; o Credev que
// uma troca gerou sai (e a troca só cancela com esse Credev inteiro).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Spinner, ArrowsClockwise, Prohibit, MagnifyingGlass, CheckCircle, XCircle, Warning } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import { fetchSefaz } from '../../utils/fetchSefaz';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fmtHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDia = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

const TIPO = { nfce: 'NFC-e', nfe: 'NF-e', troca: 'TROCA' };
const FORMA = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Cartão crédito', debito: 'Cartão débito', credito_loja: 'Credev', adiantamento: 'Adiantamento', vale_troca: 'Vale-troca', boleto: 'Boleto', saldo_bonus: 'Saldo bônus' };
const STATUS = {
  registrada: 'bg-gray-100 text-gray-600 ring-gray-200',
  emitindo: 'bg-amber-50 text-amber-700 ring-amber-200',
  autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejeitada: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-200',
};
const SIT_TITULO = { pago: 'text-emerald-700', aberto: 'text-amber-700', cancelado: 'text-gray-400 line-through' };
const JUST_MIN = 15;

export default function CancelarTransacaoModal({ empresa, empresaNome, por, onClose, onCancelada, showToast }) {
  const [de, setDe] = useState(hoje());
  const [ate, setAte] = useState(hoje());
  const [busca, setBusca] = useState('');
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState([]);
  const [selId, setSelId] = useState(null);
  const [previa, setPrevia] = useState(null); // { venda, nota, titulos, avisos, bloqueio, podeCancelar, vaiCancelar }
  const [previaLoading, setPreviaLoading] = useState(false);
  const [just, setJust] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, mensagem, passos }

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas?empresa=${empresa}&de=${de}&ate=${ate}&origem=pdv`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao listar as transações');
      setLista(j.data?.items || []);
    } catch (e) {
      showToast?.('erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [empresa, de, ate, showToast]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = useCallback(
    async (id) => {
      setSelId(id);
      setPrevia(null);
      setJust('');
      setConfirmando(false);
      setResultado(null);
      setPreviaLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${id}/cancelamento`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir a transação');
        setPrevia(j.data);
      } catch (e) {
        showToast?.('erro', e.message);
        setSelId(null);
      } finally {
        setPreviaLoading(false);
      }
    },
    [showToast],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((v) => {
      if (!mostrarCanceladas && v.status === 'cancelada' && v.id !== selId) return false;
      if (!q) return true;
      return [v.id, v.nota?.numero, v.cliente_nome, v.cliente_code, v.vendedor_nome].some((x) => String(x ?? '').toLowerCase().includes(q));
    });
  }, [lista, busca, mostrarCanceladas, selId]);

  const cancelar = async () => {
    if (!previa?.podeCancelar || just.trim().length < JUST_MIN) return;
    setBusy(true);
    try {
      const { r, j } = await fetchSefaz(`${API_BASE_URL}/api/pdv-crosby/vendas/${previa.venda.id}/cancelar-transacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: just.trim(), por: por || null }),
      });
      if (!r.ok || !j?.success) {
        setResultado({ ok: false, mensagem: j?.message || 'Não foi possível cancelar', passos: j?.details?.passos || [] });
        showToast?.('erro', j?.message || 'Não foi possível cancelar');
        return;
      }
      setResultado({ ok: true, mensagem: j.message || 'Transação cancelada', passos: j.data?.passos || [] });
      showToast?.('ok', `Transação nº ${previa.venda.id} cancelada`);
      onCancelada?.(previa.venda.id);
      carregar();
      // recarrega a ficha (agora cancelada), mantendo o resultado na tela
      const rp = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${previa.venda.id}/cancelamento`);
      const jp = await rp.json();
      if (rp.ok && jp.success) setPrevia(jp.data);
    } catch (e) {
      setResultado({ ok: false, mensagem: e.message, passos: [] });
      showToast?.('erro', e.message);
    } finally {
      setBusy(false);
      setConfirmando(false);
    }
  };

  const v = previa?.venda;
  const nota = previa?.nota;
  const titulosAtivos = (previa?.titulos || []).filter((t) => t.situacao !== 'cancelado');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[92vh] flex flex-col">
        {/* cabeçalho */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Prohibit size={20} weight="bold" className="text-rose-600" />
          <div className="mr-auto">
            <h3 className="text-base font-bold text-[#000638] leading-tight">Cancelamento de transação</h3>
            <p className="text-[11px] text-gray-500">
              Empresa {empresa}
              {empresaNome ? ` — ${empresaNome}` : ''} · cancela a nota fiscal, a transação e o contas a receber de uma vez
            </p>
          </div>
          <label className="text-[11px] text-gray-500">
            De{' '}
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className="ml-1 h-8 px-2 rounded-lg border border-gray-300 text-xs" />
          </label>
          <label className="text-[11px] text-gray-500">
            até{' '}
            <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className="ml-1 h-8 px-2 rounded-lg border border-gray-300 text-xs" />
          </label>
          <button onClick={carregar} className="h-8 px-2 rounded-lg text-xs ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center gap-1">
            <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-600 disabled:opacity-40" title="Fechar">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* lista */}
          <div className="min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="relative flex-1">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nº da transação, nº da nota, cliente ou vendedor"
                  className="w-full h-9 pl-8 pr-2 mb-0 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
              </div>
              <label className="inline-flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap">
                <input type="checkbox" checked={mostrarCanceladas} onChange={(e) => setMostrarCanceladas(e.target.checked)} /> ver canceladas
              </label>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading && lista.length === 0 ? (
                <p className="p-6 text-center text-xs text-gray-400">
                  <Spinner size={16} className="inline animate-spin" /> Carregando…
                </p>
              ) : filtradas.length === 0 ? (
                <p className="p-6 text-center text-xs text-gray-400">Nenhuma transação do PDV neste período.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtradas.map((x) => {
                    const sel = x.id === selId;
                    const cancelada = x.status === 'cancelada';
                    return (
                      <li key={x.id}>
                        <button
                          type="button"
                          onClick={() => abrir(x.id)}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 ${sel ? 'bg-rose-50 border-l-4 border-rose-500' : 'border-l-4 border-transparent hover:bg-gray-50'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] font-semibold text-[#000638] ${cancelada ? 'line-through text-gray-400' : ''}`}>
                              nº {x.id} · {TIPO[x.tipo_venda] || x.tipo_venda}
                              {x.nota?.numero ? ` ${x.nota.numero}/${x.nota.serie}` : ''}
                            </p>
                            <p className="truncate text-[11px] text-gray-500">
                              {fmtHora(x.criado_em)} · {x.cliente_nome || 'consumidor'} · {x.vendedor_nome || '—'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-[13px] font-bold tabular-nums ${cancelada ? 'text-gray-400 line-through' : x.tipo_venda === 'troca' ? 'text-purple-700' : 'text-[#000638]'}`}>{fmtBRL(x.total)}</p>
                            <span className={`inline-flex px-1.5 rounded-full text-[10px] font-semibold ring-1 ${STATUS[x.status] || STATUS.registrada}`}>{x.status}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ficha da transação */}
          <div className="min-h-0 overflow-y-auto p-4">
            {!selId ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                <Prohibit size={36} className="mb-2" />
                <p className="text-sm">Escolha a transação que vai cancelar.</p>
                <p className="mt-1 max-w-sm text-[11px]">
                  Com nota autorizada, a SEFAZ precisa aceitar o cancelamento (prazo normal: 30 minutos para NFC-e e 24 horas para NF-e). Se ela recusar, nada é cancelado.
                </p>
              </div>
            ) : previaLoading || !previa ? (
              <p className="p-6 text-center text-xs text-gray-400">
                <Spinner size={16} className="inline animate-spin" /> Abrindo a transação…
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className="text-lg font-bold text-[#000638]">Transação nº {v.id}</h4>
                  <span className={`inline-flex px-2 rounded-full text-[11px] font-semibold ring-1 ${STATUS[v.status] || STATUS.registrada}`}>{v.status}</span>
                  <span className="ml-auto text-xl font-bold tabular-nums text-[#000638]">{fmtBRL(v.total)}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {TIPO[v.tipo_venda] || v.tipo_venda} · {fmtHora(v.criado_em)} · {v.qtd_pecas ?? (v.itens || []).reduce((s, i) => s + Number(i.quantidade || 0), 0)} pç · cliente{' '}
                  <b>{v.cliente_nome || 'consumidor'}</b> · vendedor <b>{v.vendedor_nome || '—'}</b>
                  {previa.caixa ? ` · caixa nº ${previa.caixa.id} (${fmtDia(previa.caixa.data_caixa)})` : ''}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* nota */}
                  <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Nota fiscal</p>
                    {nota ? (
                      <>
                        <p className="text-[13px] font-semibold text-[#000638]">
                          {Number(nota.modelo) === 65 ? 'NFC-e' : 'NF-e'} {nota.numero}/{nota.serie}
                        </p>
                        <p className={`text-[11px] font-semibold ${nota.status === 'autorizada' ? 'text-emerald-700' : nota.status === 'cancelada' ? 'text-gray-400' : 'text-rose-600'}`}>{nota.status}</p>
                        {nota.dh_autorizacao && <p className="text-[11px] text-gray-500">autorizada {fmtHora(nota.dh_autorizacao)}</p>}
                        {nota.cancel_em && <p className="text-[11px] text-gray-500">cancelada {fmtHora(nota.cancel_em)}</p>}
                      </>
                    ) : (
                      <p className="text-[11px] text-gray-500">sem nota</p>
                    )}
                  </div>
                  {/* pagamentos */}
                  <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Pagamento</p>
                    {(v.pagamentos || []).map((p) => (
                      <p key={p.id} className="flex justify-between text-[12px] text-gray-700">
                        <span>{FORMA[p.forma] || p.forma}</span>
                        <span className="tabular-nums font-semibold">{fmtBRL(Number(p.valor) - Number(p.troco || 0))}</span>
                      </p>
                    ))}
                  </div>
                  {/* contas a receber */}
                  <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Contas a receber</p>
                    {(previa.titulos || []).length === 0 ? (
                      <p className="text-[11px] text-gray-500">sem títulos</p>
                    ) : (
                      previa.titulos.map((t) => (
                        <p key={t.id} className={`flex justify-between text-[12px] ${SIT_TITULO[t.situacao] || 'text-gray-700'}`}>
                          <span>
                            {t.fatura}/{t.parcela} · {FORMA[t.forma] || t.forma}
                          </span>
                          <span className="tabular-nums font-semibold">
                            {fmtBRL(t.valor)} · {t.situacao}
                          </span>
                        </p>
                      ))
                    )}
                  </div>
                </div>

                {/* peças */}
                <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Peças</p>
                  {(v.itens || []).map((i) => (
                    <p key={i.id} className="flex justify-between gap-2 text-[12px] text-gray-700">
                      <span className="truncate">
                        {i.quantidade}× {i.nome} <span className="text-gray-400">cód. {i.product_code}</span>
                      </span>
                      <span className="tabular-nums font-semibold">{fmtBRL(i.total)}</span>
                    </p>
                  ))}
                </div>

                {/* resultado */}
                {resultado && (
                  <div className={`rounded-xl p-3 ring-1 ${resultado.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
                    <p className={`text-sm font-bold inline-flex items-center gap-1.5 ${resultado.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                      {resultado.ok ? <CheckCircle size={18} weight="fill" /> : <XCircle size={18} weight="fill" />} {resultado.ok ? 'Transação cancelada' : 'Não cancelou'}
                    </p>
                    {!resultado.ok && <p className="mt-1 text-xs text-rose-700">{resultado.mensagem}</p>}
                    {!resultado.ok && <p className="mt-1 text-[11px] text-rose-700/80">Nada foi cancelado: a nota, a transação e o contas a receber continuam como estavam.</p>}
                    <ul className="mt-1.5 space-y-0.5">
                      {resultado.passos.map((p) => (
                        <li key={p.nome} className={`text-xs inline-flex w-full items-start gap-1 ${p.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                          {p.ok ? <CheckCircle size={14} weight="fill" className="mt-px shrink-0" /> : <XCircle size={14} weight="fill" className="mt-px shrink-0" />}
                          <span>
                            <b>{p.nome}:</b> {p.detalhe}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* bloqueio / avisos */}
                {previa.bloqueio && !resultado?.ok && (
                  <p className="rounded-xl bg-gray-100 p-3 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">{previa.bloqueio}</p>
                )}
                {previa.podeCancelar && (
                  <>
                    <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
                      <p className="text-xs font-bold text-rose-800">Ao cancelar, de uma vez:</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-rose-800 space-y-0.5">
                        <li>{previa.vaiCancelar.nota ? `${previa.vaiCancelar.nota} é cancelada na SEFAZ` : 'não há nota autorizada para cancelar na SEFAZ'}</li>
                        <li>a transação nº {v.id} fica cancelada e sai do faturamento da loja e do caixa</li>
                        <li>
                          {titulosAtivos.length
                            ? `${titulosAtivos.length} título(s) do contas a receber ${titulosAtivos.length > 1 ? 'são cancelados' : 'é cancelado'} (${fmtBRL(titulosAtivos.reduce((s, t) => s + Number(t.valor), 0))})`
                            : 'não há título no contas a receber'}
                        </li>
                      </ul>
                    </div>
                    {previa.avisos.length > 0 && (
                      <ul className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 space-y-1">
                        {previa.avisos.map((a) => (
                          <li key={a} className="text-xs text-amber-900 inline-flex w-full items-start gap-1">
                            <Warning size={13} weight="bold" className="mt-px shrink-0" /> <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Motivo do cancelamento (vai para a SEFAZ, mínimo {JUST_MIN} caracteres)</label>
                      <textarea
                        value={just}
                        onChange={(e) => {
                          setJust(e.target.value.slice(0, 255));
                          setConfirmando(false);
                        }}
                        rows={2}
                        placeholder="Ex.: cliente desistiu da compra antes de sair da loja"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                      />
                      <p className="text-[10px] text-gray-400">{just.trim().length}/255</p>
                    </div>

                    {!confirmando ? (
                      <button
                        onClick={() => setConfirmando(true)}
                        disabled={busy || just.trim().length < JUST_MIN}
                        className="w-full h-12 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                      >
                        <Prohibit size={16} weight="bold" /> CANCELAR TRANSAÇÃO
                      </button>
                    ) : (
                      <div className="rounded-xl ring-2 ring-rose-500 p-3">
                        <p className="text-sm font-bold text-rose-700">Confirma o cancelamento da transação nº {v.id}, de {fmtBRL(v.total)}? Não dá para desfazer.</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button onClick={() => setConfirmando(false)} disabled={busy} className="h-11 rounded-lg ring-1 ring-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                            Voltar
                          </button>
                          <button onClick={cancelar} disabled={busy} className="h-11 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                            {busy ? (
                              <>
                                <Spinner size={15} className="animate-spin" /> Cancelando…
                              </>
                            ) : (
                              'Sim, cancelar tudo'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
