// Modal de pagamento do PDV Crosby (modo HEADCOACH).
// Permite múltiplas formas; cartão de crédito/débito exige NSU e/ou
// autorização (vão para o <card> da NF-e e ficam gravados na venda).
// Na TROCA não há pagamento: só o campo opcional da chave da NF de origem.
import React, { useMemo, useState } from 'react';
import { X, Plus, Trash, Spinner, CreditCard, Money, QrCode, Receipt } from '@phosphor-icons/react';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export const FORMAS = [
  { id: 'dinheiro', label: 'Dinheiro', icon: Money },
  { id: 'pix', label: 'PIX', icon: QrCode },
  { id: 'debito', label: 'Cartão débito', icon: CreditCard },
  { id: 'credito', label: 'Cartão crédito', icon: CreditCard },
  { id: 'credito_loja', label: 'Crédito loja', icon: Receipt },
];

export const BANDEIRAS = [
  ['', 'Bandeira…'],
  ['visa', 'Visa'],
  ['mastercard', 'Mastercard'],
  ['elo', 'Elo'],
  ['amex', 'American Express'],
  ['hipercard', 'Hipercard'],
  ['diners', 'Diners'],
  ['outros', 'Outra'],
];

const inputCls =
  'h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

export default function PagamentoModal({ total, tipoVenda, busy, onConfirm, onClose }) {
  const troca = tipoVenda === 'troca';
  const [pags, setPags] = useState(() => (troca ? [] : [{ forma: 'pix', valor: round2(total), parcelas: 1, bandeira: '', nsu: '', autorizacao: '' }]));
  const [nfRef, setNfRef] = useState('');
  const [erro, setErro] = useState('');

  const soma = useMemo(() => round2(pags.reduce((s, p) => s + (Number(p.valor) || 0), 0)), [pags]);
  const restante = round2(total - soma);
  // Troco só faz sentido quando há dinheiro e a soma passa do total
  const dinheiro = pags.filter((p) => p.forma === 'dinheiro').reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const troco = restante < 0 && dinheiro > 0 ? Math.min(round2(-restante), round2(dinheiro)) : 0;
  const fecha = troca || Math.abs(restante) < 0.005 || (restante < 0 && troco > 0 && Math.abs(round2(-restante) - troco) < 0.005);

  const upd = (i, patch) => setPags((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const add = () =>
    setPags((prev) => [...prev, { forma: 'dinheiro', valor: restante > 0 ? restante : 0, parcelas: 1, bandeira: '', nsu: '', autorizacao: '' }]);
  const del = (i) => setPags((prev) => prev.filter((_, j) => j !== i));

  const confirmar = () => {
    setErro('');
    if (troca) {
      const chave = nfRef.replace(/\D/g, '');
      if (chave && chave.length !== 44) return setErro('A chave da NF de origem tem 44 dígitos');
      return onConfirm({ pagamentos: [], nfReferenciada: chave || null });
    }
    for (const p of pags) {
      if (!(Number(p.valor) > 0)) return setErro('Informe o valor de cada pagamento');
      if ((p.forma === 'credito' || p.forma === 'debito') && !p.nsu.trim() && !p.autorizacao.trim())
        return setErro('Cartão: informe o NSU e/ou o código de autorização');
    }
    if (!fecha) return setErro(`Falta ${fmtBRL(restante)} para fechar o total`);
    // troco: abate do pagamento em dinheiro
    const lista = pags.map((p) => ({ ...p, valor: round2(p.valor), troco: 0 }));
    if (troco > 0) {
      const i = lista.findIndex((p) => p.forma === 'dinheiro');
      lista[i].troco = troco;
    }
    onConfirm({ pagamentos: lista, nfReferenciada: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#000638]">{troca ? 'Registrar troca' : 'Pagamento'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={busy}>
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="flex justify-between items-baseline mb-3 px-3 py-2 rounded-xl bg-gray-50 ring-1 ring-gray-200">
          <span className="text-sm text-gray-600">{troca ? 'Valor devolvido' : 'Total da venda'}</span>
          <span className="text-2xl font-bold text-[#000638] tabular-nums">{fmtBRL(total)}</span>
        </div>

        {troca ? (
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Chave da NF-e/NFC-e de origem (opcional, 44 dígitos)
            </label>
            <input
              value={nfRef}
              onChange={(e) => setNfRef(e.target.value)}
              placeholder="Chave de acesso da venda original"
              className={`${inputCls} w-full font-mono text-xs`}
            />
            <p className="text-[11px] text-gray-500">
              Será emitida uma NF-e de entrada (devolução, CFOP 1202) para o cliente selecionado. O vale-troca fica registrado na venda.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {pags.map((p, i) => {
              const cartao = p.forma === 'credito' || p.forma === 'debito';
              return (
                <div key={i} className="rounded-xl ring-1 ring-gray-200 p-2.5 space-y-2">
                  <div className="flex gap-2">
                    <select value={p.forma} onChange={(e) => upd(i, { forma: e.target.value })} className={`${inputCls} flex-1`}>
                      {FORMAS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.valor}
                      onChange={(e) => upd(i, { valor: e.target.value })}
                      className={`${inputCls} w-28 text-right tabular-nums`}
                    />
                    <button onClick={() => del(i)} disabled={pags.length === 1} className="text-gray-300 hover:text-rose-500 disabled:opacity-30" title="Remover">
                      <Trash size={16} />
                    </button>
                  </div>
                  {cartao && (
                    <div className="grid grid-cols-2 gap-2">
                      {p.forma === 'credito' && (
                        <select value={p.parcelas} onChange={(e) => upd(i, { parcelas: parseInt(e.target.value, 10) })} className={inputCls}>
                          {Array.from({ length: 12 }, (_, n) => n + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}x {n > 1 ? `de ${fmtBRL(Number(p.valor || 0) / n)}` : 'à vista'}
                            </option>
                          ))}
                        </select>
                      )}
                      <select value={p.bandeira} onChange={(e) => upd(i, { bandeira: e.target.value })} className={inputCls}>
                        {BANDEIRAS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <input value={p.nsu} onChange={(e) => upd(i, { nsu: e.target.value })} placeholder="NSU" className={inputCls} />
                      <input
                        value={p.autorizacao}
                        onChange={(e) => upd(i, { autorizacao: e.target.value })}
                        placeholder="Cód. autorização"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={add} className="w-full h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-dashed ring-gray-300 hover:bg-gray-50 inline-flex items-center justify-center gap-1">
              <Plus size={12} weight="bold" /> Adicionar forma de pagamento
            </button>
            <div className="flex justify-between text-sm px-1">
              <span className="text-gray-500">Pago</span>
              <span className="tabular-nums font-semibold">{fmtBRL(soma)}</span>
            </div>
            {troco > 0 ? (
              <div className="flex justify-between text-sm px-1 text-emerald-700 font-semibold">
                <span>Troco</span>
                <span className="tabular-nums">{fmtBRL(troco)}</span>
              </div>
            ) : (
              <div className={`flex justify-between text-sm px-1 ${Math.abs(restante) < 0.005 ? 'text-emerald-700' : 'text-rose-600'} font-semibold`}>
                <span>{restante > 0 ? 'Falta' : restante < 0 ? 'Excedente' : 'Fechado'}</span>
                <span className="tabular-nums">{Math.abs(restante) < 0.005 ? '✓' : fmtBRL(Math.abs(restante))}</span>
              </div>
            )}
          </div>
        )}

        {erro && <p className="mt-2 text-xs text-rose-600 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200">{erro}</p>}

        <button
          onClick={confirmar}
          disabled={busy || (!troca && !fecha)}
          className="mt-4 w-full h-11 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Spinner size={16} className="animate-spin" /> Registrando e emitindo…
            </>
          ) : troca ? (
            'Registrar troca e emitir NF-e de devolução'
          ) : (
            `Registrar venda e emitir ${tipoVenda === 'nfe' ? 'NF-e' : 'NFC-e'}`
          )}
        </button>
      </div>
    </div>
  );
}
