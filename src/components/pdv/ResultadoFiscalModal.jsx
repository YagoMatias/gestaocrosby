// Resultado da venda HEADCOACH: venda registrada + situação da nota fiscal.
// Ações: imprimir cupom/DANFE, baixar XML, tentar emitir de novo (rejeitada),
// consultar na SEFAZ, cancelar a nota (com justificativa) e nova venda.
import React, { useState } from 'react';
import { CheckCircle, XCircle, Warning, Printer, DownloadSimple, ArrowsClockwise, Prohibit, Spinner } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import { imprimirDocumento } from '../../utils/documentoFiscalHtml';
import { fetchSefaz } from '../../utils/fetchSefaz';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtChave = (k) => String(k || '').replace(/(\d{4})(?=\d)/g, '$1 ');

export default function ResultadoFiscalModal({ resultado, onNovaVenda, onFechar, onReemitir, onAtualizar, showToast }) {
  const { venda, nota, emitente, erro } = resultado;
  const [busy, setBusy] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [just, setJust] = useState('');

  const autorizada = nota?.status === 'autorizada';
  const cancelada = nota?.status === 'cancelada';
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

        {autorizada && nota.qrDataUrl && Number(nota.modelo) === 65 && <img src={nota.qrDataUrl} alt="QR Code NFC-e" className="mx-auto mt-3 w-28 h-28" />}

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
