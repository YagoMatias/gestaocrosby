// Resultado da venda HEADCOACH: venda registrada + situação da nota fiscal.
// Ações: imprimir cupom/DANFE, baixar XML, tentar emitir de novo (rejeitada),
// consultar na SEFAZ, cancelar a nota (com justificativa) e nova venda.
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Warning, Printer, DownloadSimple, ArrowsClockwise, Prohibit, Spinner, Database, Ticket } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import { imprimirDocumento, gerarHtmlCupomTroca, abrirImpressao } from '../../utils/documentoFiscalHtml';
import { fetchSefaz } from '../../utils/fetchSefaz';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtChave = (k) => String(k || '').replace(/(\d{4})(?=\d)/g, '$1 ');

export default function ResultadoFiscalModal({ resultado, onNovaVenda, onFechar, onReemitir, onAtualizar, onEspelhar, showToast }) {
  // `troca` = troca feita no mesmo atendimento (VENDA | TROCA); `vendaPendente` =
  // a nota da troca não saiu e a venda está esperando no carrinho
  const { venda, nota, emitente, erro, troca, vendaPendente } = resultado;
  const [busy, setBusy] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [just, setJust] = useState('');
  const [espelhando, setEspelhando] = useState(false);
  const espelhar = async () => {
    if (!onEspelhar) return;
    setEspelhando(true);
    try {
      await onEspelhar();
    } finally {
      setEspelhando(false);
    }
  };

  const autorizada = nota?.status === 'autorizada';
  const cancelada = nota?.status === 'cancelada';

  // CUPOM DE TROCA: toda VENDA com a nota autorizada ganha o seu, na hora, para
  // imprimir junto com a nota e entregar ao cliente (uma venda = um cupom; o
  // servidor devolve o mesmo se já existir).
  const [cupom, setCupom] = useState(null);
  const [cupomErro, setCupomErro] = useState('');
  const vendaId = venda?.id;
  const ehVenda = venda && venda.tipo_venda !== 'troca';
  useEffect(() => {
    setCupom(null);
    setCupomErro('');
    if (!vendaId || !ehVenda || !autorizada) return undefined;
    let vivo = true;
    const dia = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date(venda.criado_em || Date.now()));
    fetch(`${API_BASE_URL}/api/pdv-crosby/cupons-troca`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa: venda.empresa,
        transacaoCode: venda.id,
        transacaoDate: dia,
        total: venda.total,
        clienteCode: venda.cliente_code || null,
        clienteNome: venda.cliente_nome || null,
        vendedorCode: venda.vendedor_code || null,
        vendedorNome: venda.vendedor_nome || null,
        itens: (venda.itens || []).map((i) => ({ productCode: i.product_code, name: i.nome, quantity: i.quantidade })),
        por: venda.criado_por || null,
      }),
    })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (!vivo) return;
        if (r.ok && j.success) setCupom(j.data);
        else setCupomErro(j?.message || 'Cupom de troca não gerado');
      })
      .catch((e) => vivo && setCupomErro(e.message));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendaId, ehVenda, autorizada]);
  const imprimirCupomTroca = () => cupom && abrirImpressao(gerarHtmlCupomTroca({ cupom, empresaNome: emitente?.xFant || venda?.empresa_nome || null }));
  const modeloLabel = nota ? (Number(nota.modelo) === 65 ? 'NFC-e' : 'NF-e') : venda?.tipo_venda === 'nfce' ? 'NFC-e' : 'NF-e';

  const consultar = async () => {
    setBusy(true);
    try {
      const { r, j } = await fetchSefaz(
        `${API_BASE_URL}/api/pdv-crosby/notas/${nota.id}/consultar`,
        { method: 'POST' },
      );
      showToast?.(r.ok ? 'ok' : 'erro', j?.message || 'Consulta feita');
      onAtualizar?.();
    } catch (e) {
      showToast?.('erro', e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async () => {
    if (just.trim().length < 15) return showToast?.('erro', 'Justificativa com pelo menos 15 caracteres');
    setBusy(true);
    try {
      const { r, j } = await fetchSefaz(
        `${API_BASE_URL}/api/pdv-crosby/notas/${nota.id}/cancelar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ justificativa: just.trim() }),
        },
      );
      if (!r.ok || !j?.success) throw new Error(j?.message || 'SEFAZ recusou o cancelamento');
      showToast?.('ok', j?.message || 'Nota cancelada na SEFAZ');
      setCancelando(false);
      setJust('');
      onAtualizar?.();
    } catch (e) {
      showToast?.('erro', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
        {autorizada ? (
          <CheckCircle size={44} weight="fill" className="mx-auto mb-2 text-emerald-500" />
        ) : cancelada ? (
          <Prohibit size={44} weight="fill" className="mx-auto mb-2 text-gray-400" />
        ) : (
          <XCircle size={44} weight="fill" className="mx-auto mb-2 text-rose-500" />
        )}
        <h3 className="text-lg font-bold text-[#000638]">
          {autorizada ? `${modeloLabel} autorizada!` : cancelada ? `${modeloLabel} cancelada` : nota ? `${modeloLabel} rejeitada` : 'Nota não emitida'}
        </h3>

        {venda && (
          <p className="mt-1 text-sm text-gray-600">
            Venda HeadCoach <b>#{venda.id}</b> · {fmtBRL(venda.total)} · {venda.qtd_pecas} pç
          </p>
        )}

        {nota && (
          <div className="mt-3 text-left text-xs bg-gray-50 rounded-xl ring-1 ring-gray-200 p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Número / série</span>
              <span className="font-mono font-bold text-[#000638]">
                {nota.numero} / {nota.serie}
              </span>
            </div>
            {nota.chave && (
              <div>
                <span className="text-gray-500">Chave</span>
                <p className="font-mono text-[11px] break-all text-[#000638]">{fmtChave(nota.chave)}</p>
              </div>
            )}
            {nota.protocolo && (
              <div className="flex justify-between">
                <span className="text-gray-500">Protocolo</span>
                <span className="font-mono">{nota.protocolo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">SEFAZ</span>
              <span className={autorizada ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                {nota.cstat} — {nota.xmotivo || nota.erro || nota.status}
              </span>
            </div>
            {Number(nota.ambiente) === 2 && (
              <p className="text-amber-700 bg-amber-50 rounded px-2 py-1 ring-1 ring-amber-200 inline-flex items-center gap-1">
                <Warning size={12} weight="bold" /> Ambiente de homologação — sem valor fiscal
              </p>
            )}
          </div>
        )}
        {!nota && erro && <p className="mt-3 text-xs text-rose-700 bg-rose-50 rounded-xl p-2.5 ring-1 ring-rose-200 text-left">{erro}</p>}

        {/* VENDA | TROCA: a troca que foi fechada junto com esta venda */}
        {troca && (
          <div className="mt-3 rounded-xl bg-purple-50 p-3 text-left text-xs text-purple-900 ring-1 ring-purple-200">
            <p className="font-bold">
              Troca #{troca.venda?.id} no mesmo atendimento
              {troca.nota?.numero ? ` · NF-e de devolução ${troca.nota.numero}/${troca.nota.serie}` : ''}
            </p>
            <p className="mt-0.5">
              Credev gerado <b>{fmtBRL(troca.total)}</b> · usado nesta venda <b>{fmtBRL(troca.credevUsado)}</b>
              {troca.total - troca.credevUsado > 0.004 ? (
                <>
                  {' '}
                  · sobra <b>{fmtBRL(troca.total - troca.credevUsado)}</b> de Credev para o cliente nesta loja
                </>
              ) : null}
              {Number(venda?.total) - troca.credevUsado > 0.004 ? (
                <>
                  {' '}
                  · diferença paga <b>{fmtBRL(Number(venda.total) - troca.credevUsado)}</b>
                </>
              ) : null}
            </p>
            {troca.nota && (
              <button
                onClick={() => imprimirDocumento({ nota: troca.nota, venda: troca.venda, emitente: troca.emitente || emitente })}
                className="mt-2 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-purple-800 bg-white ring-1 ring-purple-300 hover:bg-purple-100 inline-flex items-center gap-1"
              >
                <Printer size={12} /> Imprimir a nota da troca
              </button>
            )}
          </div>
        )}
        {vendaPendente && !autorizada && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-left text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            A troca está registrada, mas a nota de devolução não foi autorizada — sem ela o Credev não é gerado. As peças da venda continuam no carrinho: emita a nota de novo e a
            venda segue sozinha.
          </p>
        )}

        {/* TROCA autorizada: o valor devolvido virou CREDEV do cliente nesta loja */}
        {venda && venda.tipo_venda === 'troca' && autorizada && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-left text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            CREDEV de {fmtBRL(venda.total)} gerado para {venda.cliente_nome || 'o cliente'}, para usar na empresa {venda.empresa}. Na próxima compra, escolha a forma de pagamento
            “Credev”.
          </p>
        )}

        {/* Espelho no TOTVS: documento interno + recebimento (contas a receber) */}
        {venda && venda.tipo_venda !== 'troca' && (
          <div className={`mt-3 text-left text-xs rounded-xl ring-1 p-3 ${venda.totvs_status === 4 ? 'bg-emerald-50 ring-emerald-200' : venda.totvs_erro ? 'bg-rose-50 ring-rose-200' : 'bg-gray-50 ring-gray-200'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#000638] inline-flex items-center gap-1">
                <Database size={13} weight="bold" /> TOTVS · documento interno
              </span>
              {venda.totvs_status === 4 ? (
                <span className="text-emerald-700 font-semibold">recebida ✓</span>
              ) : venda.totvs_transacao_code ? (
                <span className="text-amber-700 font-semibold">em andamento</span>
              ) : (
                <span className="text-gray-500">não espelhada</span>
              )}
            </div>
            {venda.totvs_transacao_code && (
              <p className="mt-1 text-gray-600">
                Transação <b className="font-mono text-[#000638]">{venda.totvs_transacao_code}</b>
                {venda.totvs_doc_interno_seq ? <> · fatura <b className="font-mono">{venda.totvs_doc_interno_seq}</b></> : null}
                {venda.totvs_status === 4 ? ' · contas a receber lançado' : ' · recebimento pendente'}
              </p>
            )}
            {venda.totvs_erro && venda.totvs_status !== 4 && <p className="mt-1 text-rose-700">{venda.totvs_erro}</p>}
            {venda.totvs_status !== 4 && (
              <button onClick={espelhar} disabled={espelhando || !onEspelhar} className="mt-2 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-40 inline-flex items-center gap-1">
                {espelhando ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />} {venda.totvs_transacao_code ? 'Receber no TOTVS de novo' : 'Espelhar no TOTVS'}
              </button>
            )}
          </div>
        )}

        {autorizada && nota.qrDataUrl && Number(nota.modelo) === 65 && <img src={nota.qrDataUrl} alt="QR Code NFC-e" className="mx-auto mt-3 w-28 h-28" />}

        {/* CUPOM DE TROCA da venda: sai junto com a nota */}
        {ehVenda && autorizada && (
          <button
            onClick={imprimirCupomTroca}
            disabled={!cupom}
            className="mt-3 w-full h-11 rounded-xl bg-purple-700 text-white text-sm font-bold hover:bg-purple-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            title="Cupom para o cliente trocar o produto (sem valores, serve para presente)"
          >
            {cupom ? (
              <>
                <Ticket size={18} weight="bold" /> IMPRIMIR CUPOM DE TROCA <span className="font-mono text-xs font-semibold">{cupom.codigo}</span>
              </>
            ) : cupomErro ? (
              <>Cupom de troca não gerado</>
            ) : (
              <>
                <Spinner size={15} className="animate-spin" /> Gerando o cupom de troca…
              </>
            )}
          </button>
        )}
        {cupomErro && ehVenda && autorizada && <p className="mt-1 text-[11px] text-rose-600">{cupomErro}</p>}

        <div className="mt-4 grid grid-cols-2 gap-1.5">
          {(autorizada || cancelada) && (
            <>
              <button onClick={() => imprimirDocumento({ nota, venda, emitente })} className="h-9 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center justify-center gap-1">
                <Printer size={14} /> Imprimir {Number(nota.modelo) === 65 ? 'cupom' : 'DANFE'}
              </button>
              <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${nota.id}/xml`} target="_blank" rel="noreferrer" className="h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center justify-center gap-1">
                <DownloadSimple size={14} /> Baixar XML
              </a>
            </>
          )}
          {nota && !autorizada && !cancelada && (
            <button onClick={onReemitir} disabled={busy} className="h-9 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center justify-center gap-1 disabled:opacity-40">
              <ArrowsClockwise size={14} /> Tentar emitir de novo
            </button>
          )}
          {!nota && venda && (
            <button onClick={onReemitir} disabled={busy} className="h-9 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center justify-center gap-1 disabled:opacity-40 col-span-2">
              <ArrowsClockwise size={14} /> Tentar emitir de novo
            </button>
          )}
          {nota?.chave && (
            <button onClick={consultar} disabled={busy} className="h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center justify-center gap-1 disabled:opacity-40">
              {busy ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />} Consultar SEFAZ
            </button>
          )}
          {autorizada && (
            <button onClick={() => setCancelando((v) => !v)} className="h-9 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 inline-flex items-center justify-center gap-1">
              <Prohibit size={14} /> Cancelar nota
            </button>
          )}
        </div>

        {cancelando && (
          <div className="mt-2 text-left space-y-1.5">
            <input value={just} onChange={(e) => setJust(e.target.value)} placeholder="Justificativa (mín. 15 caracteres)" className="w-full h-9 px-2 rounded-lg border border-rose-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
            <button onClick={cancelar} disabled={busy} className="w-full h-9 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
              {busy ? (
                <>
                  <Spinner size={13} className="animate-spin" /> Enviando evento à SEFAZ…
                </>
              ) : (
                'Confirmar cancelamento na SEFAZ'
              )}
            </button>
          </div>
        )}

        <div className="mt-4 space-y-1.5">
          <button onClick={onNovaVenda} className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
            Nova venda
          </button>
          <button onClick={onFechar} className="w-full h-9 rounded-xl text-xs font-semibold text-gray-500 ring-1 ring-gray-300 hover:bg-gray-50">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
