// Vendas HEADCOACH do dia (por empresa): reimpressão, XML, situação da nota,
// cancelamento de venda sem nota e abertura do resultado fiscal.
import React, { useCallback, useEffect, useState } from 'react';
import { X, Spinner, Printer, DownloadSimple, ArrowsClockwise, Prohibit } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import { imprimirDocumento } from '../../utils/documentoFiscalHtml';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const STATUS = {
  registrada: 'bg-gray-100 text-gray-600 ring-gray-200',
  emitindo: 'bg-amber-50 text-amber-700 ring-amber-200',
  autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejeitada: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-200 line-through',
};
const TIPO = { nfce: 'NFC-e', nfe: 'NF-e', troca: 'TROCA' };

export default function VendasDoDiaModal({ empresa, onClose, onAbrirResultado, showToast }) {
  const [data, setData] = useState(hoje());
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState([]);
  const [totais, setTotais] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas?empresa=${empresa}&data=${data}`);
      const j = await r.json();
      setLista(j?.data?.items || []);
      setTotais(j?.data?.totais || null);
    } catch (e) {
      showToast?.('erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [empresa, data, showToast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirNota = async (v) => {
    if (!v.nota) return;
    const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${v.nota.id}`);
    const j = await r.json();
    if (!r.ok || !j.success) return showToast?.('erro', j?.message || 'Falha ao abrir a nota');
    return j.data; // { nota, venda, emitente }
  };

  const imprimir = async (v) => {
    const d = await abrirNota(v);
    if (d) imprimirDocumento(d);
  };

  const cancelarVenda = async (v) => {
    const motivo = window.prompt(`Cancelar a venda #${v.id} (sem nota autorizada)? Motivo:`);
    if (motivo == null) return;
    const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${v.id}/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    });
    const j = await r.json();
    showToast?.(r.ok ? 'ok' : 'erro', j?.message || '');
    carregar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-5 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="text-base font-bold text-[#000638]">Vendas HeadCoach — empresa {empresa}</h3>
          <div className="flex items-center gap-2">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 px-2 rounded-lg border border-gray-300 text-xs" />
            <button onClick={carregar} className="h-8 px-2 rounded-lg text-xs ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center gap-1">
              <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        {totais && (
          <div className="flex gap-3 text-xs mb-2 text-gray-600">
            <span>
              Vendas: <b className="text-[#000638]">{totais.vendas}</b>
            </span>
            <span>
              Total: <b className="text-[#000638]">{fmtBRL(totais.valor)}</b>
            </span>
            <span>
              Trocas: <b className="text-[#000638]">{totais.trocas}</b>
            </span>
          </div>
        )}

        <div className="overflow-y-auto flex-1 rounded-xl ring-1 ring-gray-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500">
              <tr>
                <th className="px-2 py-1.5 text-left">#</th>
                <th className="px-2 py-1.5 text-left">Hora</th>
                <th className="px-2 py-1.5 text-left">Tipo</th>
                <th className="px-2 py-1.5 text-left">Cliente</th>
                <th className="px-2 py-1.5 text-left">Vendedor</th>
                <th className="px-2 py-1.5 text-right">Total</th>
                <th className="px-2 py-1.5 text-left">Nota</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && lista.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    <Spinner size={18} className="animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {!loading && lista.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Nenhuma venda nesta data.
                  </td>
                </tr>
              )}
              {lista.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/60">
                  <td className="px-2 py-1.5 font-mono">{v.id}</td>
                  <td className="px-2 py-1.5">{new Date(v.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' })}</td>
                  <td className="px-2 py-1.5 font-semibold">{TIPO[v.tipo_venda]}</td>
                  <td className="px-2 py-1.5 truncate max-w-[160px]">{v.cliente_nome || '—'}</td>
                  <td className="px-2 py-1.5 truncate max-w-[120px]">{v.vendedor_nome || v.vendedor_code}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(v.total)}</td>
                  <td className="px-2 py-1.5 font-mono">{v.nota ? `${v.nota.serie}/${v.nota.numero}` : '—'}</td>
                  <td className="px-2 py-1.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold ${STATUS[v.status] || STATUS.registrada}`} title={v.nota ? `${v.nota.cstat || ''} ${v.nota.xmotivo || ''}` : ''}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="inline-flex gap-1">
                      {v.nota && (v.nota.status === 'autorizada' || v.nota.status === 'cancelada') && (
                        <>
                          <button onClick={() => imprimir(v)} title="Imprimir" className="p-1 rounded hover:bg-gray-100 text-[#000638]">
                            <Printer size={14} />
                          </button>
                          <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${v.nota.id}/xml`} target="_blank" rel="noreferrer" title="XML" className="p-1 rounded hover:bg-gray-100 text-[#000638]">
                            <DownloadSimple size={14} />
                          </a>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          const d = v.nota ? await abrirNota(v) : null;
                          onAbrirResultado?.(d ? { venda: d.venda, nota: d.nota, emitente: d.emitente } : { venda: v, nota: null, emitente: null, erro: 'Venda sem nota emitida' });
                        }}
                        title="Abrir"
                        className="p-1 rounded hover:bg-gray-100 text-[#000638] text-[11px] font-semibold"
                      >
                        abrir
                      </button>
                      {v.status !== 'cancelada' && v.status !== 'autorizada' && (
                        <button onClick={() => cancelarVenda(v)} title="Cancelar venda" className="p-1 rounded hover:bg-rose-50 text-rose-500">
                          <Prohibit size={14} />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
