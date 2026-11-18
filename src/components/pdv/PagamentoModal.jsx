// Modal de pagamento do PDV Crosby.
// Permite múltiplas formas; cartão de crédito/débito exige NSU e/ou
// autorização (vão para o <card> da NF-e e ficam gravados na venda).
// Na TROCA não há pagamento: mostra a(s) nota(s) de origem que o sistema achou
// nas compras do cliente e que a NF-e de devolução vai referenciar. O valor
// devolvido vira CREDEV do cliente nesta loja.
// Credev e Adiantamento: formas distintas, limitadas ao saldo do cliente na loja
// (prop `saldos` = { credev, adiantamento }); o servidor confere de novo.
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
  // saldos do cliente NESTA loja (HeadCoach › Saldos de Clientes): cada um o seu
  { id: 'credito_loja', label: 'Credev', icon: Receipt },
  { id: 'adiantamento', label: 'Adiantamento', icon: Receipt },
  // crediário BlueCard: a prazo, em parcelas mensais; no contas a receber vira boleto / fatura
  { id: 'bluecard', label: 'BlueCard', icon: Receipt },
];
const BLUECARD_MAX_PARCELAS = 4;
// valores das parcelas como saem no contas a receber (igual ao TOTVS): reais inteiros,
// a diferença na 1ª — 148,00 em 3x = 50,00 + 49,00 + 49,00
const parcelasBluecard = (valor, n) => {
  if (n <= 1) return `1x de ${fmtBRL(valor)}`;
  const vn = Math.floor(valor / n) >= 1 ? Math.floor(valor / n) : Math.floor((valor / n) * 100) / 100;
  const primeira = round2(valor - vn * (n - 1));
  return Math.abs(primeira - vn) < 0.005 ? `${n}x de ${fmtBRL(vn)}` : `${n}x: 1ª de ${fmtBRL(primeira)} + ${n - 1} de ${fmtBRL(vn)}`;
};
// vencimentos das parcelas do BlueCard: mesmo dia do mês, a 1ª um mês depois da compra
const vencimentoBluecard = (n) => {
  const h = new Date();
  const alvo = new Date(h.getFullYear(), h.getMonth() + n, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(h.getDate(), ultimo));
  return alvo.toLocaleDateString('pt-BR');
};
// forma → saldo do cliente que ela consome
const SALDO_DA_FORMA = { credito_loja: 'credev', adiantamento: 'adiantamento' };
const NOME_SALDO = { credev: 'Credev', adiantamento: 'Adiantamento' };

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

const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

// VENDA | TROCA: `inicial` traz os pagamentos já preenchidos (Credev gerado pela
// troca + a diferença) e `trocaFeita` a troca registrada neste atendimento.
export default function PagamentoModal({ total, tipoVenda, notasTroca = [], saldos = null, temCliente = false, inicial = null, trocaFeita = null, busy, onConfirm, onClose }) {
  const troca = tipoVenda === 'troca';
  const [pags, setPags] = useState(() =>
    troca
      ? []
      : inicial?.length
        ? inicial.map((p) => ({ parcelas: 1, bandeira: '', nsu: '', autorizacao: '', ...p }))
        : [{ forma: 'pix', valor: round2(total), parcelas: 1, bandeira: '', nsu: '', autorizacao: '' }],
  );
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
  // quanto de cada saldo (credev / adiantamento) os pagamentos estão usando
  const usoSaldo = (tipo) => round2(pags.filter((p) => SALDO_DA_FORMA[p.forma] === tipo).reduce((s, p) => s + (Number(p.valor) || 0), 0));
  const saldoDe = (tipo) => round2(saldos?.[tipo] || 0);
  // põe o saldo como forma de pagamento: até o saldo e até o total; o resto fica na 1ª forma "normal"
  const usarSaldo = (tipo) => {
    const forma = Object.keys(SALDO_DA_FORMA).find((f) => SALDO_DA_FORMA[f] === tipo);
    setPags((prev) => {
      const outros = prev.filter((p) => p.forma !== forma);
      const jaOutrosSaldos = round2(outros.filter((p) => SALDO_DA_FORMA[p.forma]).reduce((s, p) => s + (Number(p.valor) || 0), 0));
      const valor = round2(Math.min(saldoDe(tipo), Math.max(0, total - jaOutrosSaldos)));
      if (!(valor > 0)) return prev;
      const normais = outros.filter((p) => !SALDO_DA_FORMA[p.forma]);
      const saldosUsados = outros.filter((p) => SALDO_DA_FORMA[p.forma]);
      const resto = round2(total - jaOutrosSaldos - valor);
      const lista = [...saldosUsados, { forma, valor, parcelas: 1, bandeira: '', nsu: '', autorizacao: '' }];
      if (resto > 0.004) lista.push({ ...(normais[0] || { forma: 'pix', parcelas: 1, bandeira: '', nsu: '', autorizacao: '' }), valor: resto }, ...normais.slice(1));
      return lista;
    });
  };

  const confirmar = () => {
    setErro('');
    // troca: a nota de origem é definida pelo servidor, que confere as compras de novo
    if (troca) return onConfirm({ pagamentos: [], nfReferenciada: null });
    for (const tipo of ['credev', 'adiantamento']) {
      const usado = usoSaldo(tipo);
      if (!(usado > 0)) continue;
      if (!temCliente) return setErro(`${NOME_SALDO[tipo]} exige o cliente identificado na venda`);
      if (usado > saldoDe(tipo) + 0.005) return setErro(`${NOME_SALDO[tipo]}: o cliente tem ${fmtBRL(saldoDe(tipo))} nesta loja e você lançou ${fmtBRL(usado)}`);
    }
    if (pags.some((p) => p.forma === 'bluecard' && Number(p.valor) > 0) && !temCliente) return setErro('BlueCard exige o cliente identificado na venda');
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {notasTroca.length > 1 ? 'Notas de origem (referenciadas automaticamente)' : 'Nota de origem (referenciada automaticamente)'}
            </p>
            {notasTroca.map((n) => (
              <div key={n.chave} className="rounded-lg bg-purple-50 ring-1 ring-purple-200 px-2.5 py-1.5 text-xs text-purple-900">
                <p>
                  {n.modelo === 65 ? 'NFC-e' : 'NF'} <b>{n.numero}/{n.serie}</b> · {fmtData(n.data)} · empresa <b>{n.empresa}</b>
                </p>
                <p className="font-mono text-[10px] text-purple-700 break-all">{n.chave}</p>
              </div>
            ))}
            <p className="text-[11px] text-gray-500">
              Será emitida uma NF-e de entrada (devolução, CFOP 1202) para o cliente selecionado, pelo valor pago na compra.
            </p>
            <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Com a nota autorizada, o cliente recebe {fmtBRL(total)} de CREDEV para usar nesta loja na próxima compra.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {trocaFeita && (
              <p className="rounded-xl bg-purple-50 px-2.5 py-2 text-[11px] font-semibold text-purple-900 ring-1 ring-purple-200">
                Troca #{trocaFeita.venda?.id} registrada{trocaFeita.nota?.numero ? ` (NF-e ${trocaFeita.nota.numero}/${trocaFeita.nota.serie})` : ''}: Credev de {fmtBRL(trocaFeita.total)} gerado e já
                lançado abaixo. Informe como o cliente paga a diferença.
              </p>
            )}
            {['credev', 'adiantamento'].some((t) => saldoDe(t) > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-blue-50 px-2.5 py-2 text-[11px] text-blue-900 ring-1 ring-blue-200">
                <span className="font-semibold">Saldo do cliente nesta loja:</span>
                {['credev', 'adiantamento'].filter((t) => saldoDe(t) > 0).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => usarSaldo(t)}
                    className="inline-flex h-7 items-center rounded-lg bg-white px-2 font-bold text-blue-800 ring-1 ring-blue-300 hover:bg-blue-100"
                    title={`Usar o ${NOME_SALDO[t]} como forma de pagamento`}
                  >
                    Usar {NOME_SALDO[t]} · {fmtBRL(saldoDe(t))}
                  </button>
                ))}
              </div>
            )}
            {pags.map((p, i) => {
              const cartao = p.forma === 'credito' || p.forma === 'debito';
              const tipoSaldo = SALDO_DA_FORMA[p.forma];
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
                  {tipoSaldo && (
                    <p className={`text-[11px] font-semibold ${usoSaldo(tipoSaldo) > saldoDe(tipoSaldo) + 0.005 ? 'text-rose-600' : 'text-blue-800'}`}>
                      {NOME_SALDO[tipoSaldo]} do cliente nesta loja: {fmtBRL(saldoDe(tipoSaldo))}
                      {usoSaldo(tipoSaldo) > saldoDe(tipoSaldo) + 0.005 ? ' — valor maior que o saldo' : ''}
                    </p>
                  )}
                  {p.forma === 'bluecard' && (
                    <div className="space-y-1">
                      <select value={p.parcelas} onChange={(e) => upd(i, { parcelas: parseInt(e.target.value, 10) })} className={`${inputCls} w-full`}>
                        {Array.from({ length: BLUECARD_MAX_PARCELAS }, (_, n) => n + 1).map((n) => (
                          <option key={n} value={n}>
                            {parcelasBluecard(Number(p.valor || 0), n)} · {n > 1 ? `1ª em ${vencimentoBluecard(1)}, última em ${vencimentoBluecard(n)}` : `vence em ${vencimentoBluecard(1)}`}
                          </option>
                        ))}
                      </select>
                      <p className={`text-[11px] font-semibold ${temCliente ? 'text-blue-800' : 'text-rose-600'}`}>
                        {temCliente ? 'Crediário BlueCard: entra no contas a receber como boleto / fatura em aberto.' : 'BlueCard exige o cliente identificado na venda.'}
                      </p>
                    </div>
                  )}
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
