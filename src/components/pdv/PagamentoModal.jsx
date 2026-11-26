// Modal de pagamento do PDV Crosby.
// Permite múltiplas formas; cartão de crédito/débito exige NSU e/ou
// autorização (vão para o <card> da NF-e e ficam gravados na venda).
// Na TROCA não há pagamento: mostra a(s) nota(s) de origem que o sistema achou
// nas compras do cliente e que a NF-e de devolução vai referenciar. O valor
// devolvido vira CREDEV do cliente nesta loja.
// Credev e Adiantamento: formas distintas, limitadas ao saldo do cliente na loja
// (prop `saldos` = { credev, adiantamento }); o servidor confere de novo.
// BLUECARD (25/11/2026): o PDV pede a compra ao BlueCard, o cliente aprova no app (10 minutos) e
// só então a venda fecha. Prop `bluecard` = { cpf, empresa, empresaNome, vendedorCode, vendedorNome, itens }.
// As parcelas e os vencimentos são os do BlueCard; o servidor confere a aprovação de novo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash, Spinner, CreditCard, Money, QrCode, Receipt, CheckCircle, Warning, DeviceMobile } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

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
// (as parcelas e os vencimentos do BlueCard vêm do app, na aprovação do cliente)
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
export default function PagamentoModal({ total, tipoVenda, notasTroca = [], saldos = null, temCliente = false, inicial = null, trocaFeita = null, bluecard = null, busy, onConfirm, onClose }) {
  const troca = tipoVenda === 'troca';
  const [pags, setPags] = useState(() =>
    troca
      ? []
      : inicial?.length
        ? inicial.map((p) => ({ parcelas: 1, bandeira: '', nsu: '', autorizacao: '', ...p }))
        : [{ forma: 'pix', valor: round2(total), parcelas: 1, bandeira: '', nsu: '', autorizacao: '' }],
  );
  const [erro, setErro] = useState('');

  // ─── BlueCard: limite, pedido de aprovação e acompanhamento ───────────────
  // bc = { limite, pedindo, compraId, status: pendente|aprovada|recusada|cancelada|expirada, expiraEm, valor, parcelas, vencimentos, erro }
  const [bc, setBc] = useState({ limite: null });
  const [agora, setAgora] = useState(Date.now());
  const pagBluecard = pags.find((p) => p.forma === 'bluecard') || null;
  const valorBluecard = round2(pagBluecard?.valor || 0);
  const cpfBluecard = String(bluecard?.cpf || '').replace(/\D/g, '');
  const bcAprovada = bc.status === 'aprovada';
  const bcPendente = bc.status === 'pendente';
  const bcTravado = bcAprovada || bcPendente || !!bc.pedindo; // valor e parcelas não mudam com pedido em aberto
  // limite do cliente (e as parcelas possíveis para o valor) — consulta ao escolher BlueCard ou mudar o valor
  useEffect(() => {
    if (!pagBluecard || cpfBluecard.length !== 11 || bcTravado) return undefined;
    let vivo = true;
    const espera = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/pdv-crosby/bluecard/limite?cpf=${cpfBluecard}${valorBluecard > 0 ? `&valor=${valorBluecard}` : ''}`)
        .then((r) => r.json())
        .then((j) => vivo && setBc((x) => ({ ...x, limite: j?.success ? j.data : { erro: j?.message || 'Não consegui consultar o BlueCard' } })))
        .catch(() => vivo && setBc((x) => ({ ...x, limite: { erro: 'Não consegui consultar o BlueCard' } })));
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [!!pagBluecard, cpfBluecard, valorBluecard, bcTravado]); // eslint-disable-line react-hooks/exhaustive-deps
  // acompanha a compra pedida até o cliente aprovar (ou recusar / expirar)
  const compraRef = useRef(null);
  compraRef.current = bc.compraId;
  useEffect(() => {
    if (!bc.compraId || bc.status !== 'pendente') return undefined;
    const consultar = () =>
      fetch(`${API_BASE_URL}/api/pdv-crosby/bluecard/compras/${encodeURIComponent(bc.compraId)}`)
        .then((r) => r.json())
        .then((j) => {
          if (!j?.success || compraRef.current !== bc.compraId) return;
          if (j.data.status !== 'pendente') {
            setBc((x) => ({ ...x, status: j.data.status, vencimentos: j.data.vencimentos || [] }));
            setErro(''); // some o aviso de "aguardando" de um clique anterior
          }
        })
        .catch(() => {});
    const laco = setInterval(consultar, 3000);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => {
      clearInterval(laco);
      clearInterval(relogio);
    };
  }, [bc.compraId, bc.status]);
  const pedirAprovacao = async () => {
    if (!pagBluecard || bc.pedindo) return;
    setErro('');
    setBc((x) => ({ ...x, pedindo: true, erro: null, semResposta: false, status: null, compraId: null }));
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/bluecard/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: bluecard?.empresa, empresaNome: bluecard?.empresaNome || null, cpf: cpfBluecard, valor: valorBluecard, parcelas: Number(pagBluecard.parcelas) || 1, vendedorCode: bluecard?.vendedorCode || null, vendedorNome: bluecard?.vendedorNome || null, itens: bluecard?.itens || [] }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw Object.assign(new Error(j?.message || 'O BlueCard não aceitou o pedido'), { codigo: j?.error || null, http: r.status });
      setAgora(Date.now()); // o relógio do prazo começa agora
      setBc((x) => ({ ...x, pedindo: false, compraId: j.data.compraId, status: 'pendente', expiraEm: j.data.expiraEm, valor: valorBluecard, parcelas: Number(pagBluecard.parcelas) || 1, vencimentos: [] }));
    } catch (e) {
      // o BlueCard não respondeu (fora do ar, sem acesso, rede): não é recusa — o caixa não pode ficar travado por isso
      const semResposta = !e.codigo || ['BLUECARD_FORA', 'BLUECARD_NAO_AUTORIZADO', 'BLUECARD_ERROR'].includes(e.codigo) || e.http >= 500;
      setBc((x) => ({ ...x, pedindo: false, erro: e.message, semResposta }));
    }
  };
  const desistirBluecard = () => {
    setErro('');
    setBc((x) => ({ limite: x.limite }));
  };
  const restaSeg = bc.expiraEm ? Math.max(0, Math.round((new Date(bc.expiraEm).getTime() - agora) / 1000)) : null;

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
    if (pags.filter((p) => p.forma === 'bluecard').length > 1) return setErro('Só um pagamento em BlueCard por venda');
    if (pagBluecard && Number(pagBluecard.valor) > 0) {
      // sem resposta do BlueCard ao pedido: a venda fecha como antes (o cliente aprova no aplicativo dele)
      if (!bcAprovada && !bc.semResposta) return setErro(bcPendente ? 'BlueCard: aguardando o cliente aprovar no app' : 'BlueCard: peça a aprovação do cliente no app antes de fechar a venda');
      if (bcAprovada && (Math.abs(Number(bc.valor) - valorBluecard) > 0.005 || Number(bc.parcelas) !== (Number(pagBluecard.parcelas) || 1))) return setErro('BlueCard: o valor ou as parcelas mudaram depois da aprovação — peça de novo');
    }
    for (const p of pags) {
      if (!(Number(p.valor) > 0)) return setErro('Informe o valor de cada pagamento');
      if ((p.forma === 'credito' || p.forma === 'debito') && !p.nsu.trim() && !p.autorizacao.trim())
        return setErro('Cartão: informe o NSU e/ou o código de autorização');
    }
    if (!fecha) return setErro(`Falta ${fmtBRL(restante)} para fechar o total`);
    // troco: abate do pagamento em dinheiro
    const lista = pags.map((p) => ({ ...p, valor: round2(p.valor), troco: 0, ...(p.forma === 'bluecard' && bcAprovada && bc.compraId ? { bluecardCompraId: bc.compraId } : {}) }));
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
                    <select value={p.forma} onChange={(e) => upd(i, { forma: e.target.value })} disabled={p.forma === 'bluecard' && bcTravado} className={`${inputCls} flex-1 disabled:bg-gray-100`}>
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
                      disabled={p.forma === 'bluecard' && bcTravado}
                      className={`${inputCls} w-28 text-right tabular-nums disabled:bg-gray-100`}
                    />
                    <button onClick={() => del(i)} disabled={pags.length === 1 || (p.forma === 'bluecard' && bcTravado)} className="text-gray-300 hover:text-rose-500 disabled:opacity-30" title="Remover">
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
                    <div className="space-y-1.5" data-bluecard>
                      {!temCliente || cpfBluecard.length !== 11 ? (
                        <p className="text-[11px] font-semibold text-rose-600">BlueCard exige o cliente identificado na venda, com CPF.</p>
                      ) : (
                        <>
                          {/* limite do cliente no BlueCard */}
                          {bc.limite?.erro ? (
                            <p className="text-[11px] font-semibold text-amber-700">{bc.limite.erro}</p>
                          ) : bc.limite ? (
                            <p className={`text-[11px] font-semibold ${bc.limite.pode ? 'text-blue-800' : 'text-rose-600'}`} data-bluecard-limite>
                              Limite disponível no BlueCard: {fmtBRL(bc.limite.disponivel)}
                              {!bc.limite.pode && bc.limite.motivo ? ` — ${bc.limite.motivo}` : ''}
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-400">Consultando o limite no BlueCard…</p>
                          )}
                          <select value={p.parcelas} onChange={(e) => upd(i, { parcelas: parseInt(e.target.value, 10) })} disabled={bcTravado} className={`${inputCls} w-full disabled:bg-gray-100`}>
                            {(bc.limite?.parcelasPossiveis?.length ? bc.limite.parcelasPossiveis : Array.from({ length: BLUECARD_MAX_PARCELAS }, (_, n) => n + 1)).map((n) => (
                              <option key={n} value={n}>
                                {n}x de {fmtBRL(Number(p.valor || 0) / n)}
                              </option>
                            ))}
                          </select>
                          {bcAprovada ? (
                            <div className="rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-900 ring-1 ring-emerald-200" data-bluecard-aprovada>
                              <p className="flex items-center gap-1 font-bold">
                                <CheckCircle size={14} weight="fill" /> Aprovada pelo cliente no app · {fmtBRL(bc.valor)} em {bc.parcelas}x
                              </p>
                              {bc.vencimentos?.length > 0 && <p className="mt-0.5">Vencimentos: {bc.vencimentos.map((v) => `${fmtData(v.vencimento)} ${fmtBRL(v.valor_cents / 100)}`).join(' · ')}</p>}
                              <button type="button" onClick={desistirBluecard} disabled={busy} className="mt-1 font-semibold text-emerald-800 underline disabled:opacity-50">
                                Trocar o valor ou as parcelas (pede nova aprovação)
                              </button>
                            </div>
                          ) : bcPendente ? (
                            <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 ring-1 ring-amber-200" data-bluecard-pendente>
                              <p className="flex items-center gap-1 font-bold">
                                <DeviceMobile size={14} weight="bold" /> Aguardando o cliente aprovar no app do BlueCard…
                                {restaSeg != null && <span className="ml-auto tabular-nums">{Math.floor(restaSeg / 60)}:{String(restaSeg % 60).padStart(2, '0')}</span>}
                              </p>
                              <p className="mt-0.5">Pedido de {fmtBRL(bc.valor)} em {bc.parcelas}x enviado. A venda destrava sozinha quando ele aprovar.</p>
                              <button type="button" onClick={desistirBluecard} className="mt-1 font-semibold text-amber-800 underline">
                                Desistir deste pedido
                              </button>
                            </div>
                          ) : (
                            <>
                              {['recusada', 'cancelada', 'expirada'].includes(bc.status) && (
                                <p className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200" data-bluecard-negada>
                                  <Warning size={13} weight="fill" /> {bc.status === 'recusada' ? 'O cliente recusou no app.' : bc.status === 'expirada' ? 'O prazo de 10 minutos acabou sem aprovação.' : 'A compra foi cancelada no BlueCard.'} Peça de novo ou use outra forma.
                                </p>
                              )}
                              {bc.erro && !bc.semResposta && <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">{bc.erro}</p>}
                              {bc.semResposta && (
                                <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 ring-1 ring-amber-200" data-bluecard-sem-resposta>
                                  <b>O BlueCard não respondeu ao pedido.</b> Tente de novo. Se continuar, a venda pode ser fechada como antes: o cliente faz e aprova a compra no aplicativo dele, e você registra a venda aqui.
                                  <span className="mt-0.5 block text-[10.5px] text-amber-700">{bc.erro}</span>
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={pedirAprovacao}
                                disabled={bc.pedindo || !(valorBluecard > 0) || bc.limite?.pode === false}
                                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-700 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-40"
                                data-bluecard-pedir
                              >
                                {bc.pedindo ? <Spinner size={14} className="animate-spin" /> : <DeviceMobile size={14} weight="bold" />} Pedir aprovação do cliente no app
                              </button>
                              <p className="text-[10.5px] text-gray-500">O cliente recebe o pedido no app do BlueCard e tem 10 minutos para aprovar. Sem a aprovação a venda não fecha no BlueCard.</p>
                            </>
                          )}
                        </>
                      )}
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
