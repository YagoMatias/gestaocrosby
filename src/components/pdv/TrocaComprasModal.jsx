// TROCA no PDV Crosby: escolhe as peças que estão voltando a partir de
//  • COMPRAS DO CLIENTE — notas (nota fiscal, fatura e produtos) do cliente
//    selecionado no caixa; ou
//  • CUPOM DE TROCA — código impresso em toda venda (presente): leva à
//    transação/nota original sem precisar dos dados de quem comprou.
// O valor da troca é o valor PAGO na nota, e a nota escolhida é a que será
// referenciada no TOTVS ao finalizar a transação de troca.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Spinner, ArrowsLeftRight, MagnifyingGlass, Minus, Plus, Warning, Ticket, Receipt } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const isoDia = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Recife' });
const inputCls =
  'h-9 px-2 mb-0 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300';

// chave única de uma linha de nota
export const chaveTroca = (nota, item) => `${nota.branchCode}-${nota.invoiceSequence}-${item.sequence}-${item.productCode}`;

export default function TrocaComprasModal({ customer, branch, selecionados = [], onConfirm, onClose }) {
  const [aba, setAba] = useState(customer ? 'compras' : 'cupom');
  // key → quantidade escolhida
  const [escolha, setEscolha] = useState(() => Object.fromEntries(selecionados.map((s) => [s.key, s.quantity])));

  // ── compras do cliente ──
  const [de, setDe] = useState(() => isoDia(new Date(Date.now() - 90 * 86400000)));
  const [ate, setAte] = useState(() => isoDia(new Date()));
  const [soEstaLoja, setSoEstaLoja] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [notas, setNotas] = useState(null);

  // ── cupom de troca ──
  const [codigo, setCodigo] = useState('');
  const [cupomBusy, setCupomBusy] = useState(false);
  const [cupomErro, setCupomErro] = useState(null);
  const [notasCupom, setNotasCupom] = useState([]); // notas trazidas por cupom (com .cupom)

  const buscar = useCallback(async () => {
    if (!customer) return;
    setLoading(true);
    setErro(null);
    try {
      const qs = new URLSearchParams({ customer: customer.code, de, ate });
      if (soEstaLoja && branch) qs.set('branch', branch);
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/customer-purchases?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao buscar as compras');
      setNotas(j.data.notas || []);
    } catch (e) {
      setErro(e.message);
      setNotas([]);
    } finally {
      setLoading(false);
    }
  }, [customer, branch, de, ate, soEstaLoja]);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarCupom = async (e) => {
    e?.preventDefault();
    const cod = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cod) return;
    setCupomBusy(true);
    setCupomErro(null);
    try {
      const rc = await fetch(`${API_BASE_URL}/api/pdv-crosby/cupons-troca/${cod}`);
      const jc = await rc.json();
      if (!rc.ok || !jc.success) throw new Error(jc?.message || 'Cupom não encontrado');
      const cupom = jc.data;
      // a nota da transação de origem (só existe depois de a venda ser atendida no caixa)
      const qs = new URLSearchParams({
        branch: cupom.empresa,
        code: cupom.transacao_code,
        date: String(cupom.transacao_date).slice(0, 10),
        dados: 'compra',
      });
      const rn = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-invoice?${qs}`);
      const jn = await rn.json();
      if (!rn.ok || !jn.success) {
        throw new Error(
          jn?.error === 'INVOICE_NOT_FOUND'
            ? `A venda do cupom (transação ${cupom.transacao_code}) ainda não tem nota fiscal — ela foi finalizada no caixa?`
            : jn?.message || 'Não foi possível abrir a nota do cupom',
        );
      }
      // desconta o que já foi trocado com este cupom
      const usado = new Map();
      for (const u of cupom.usos || []) usado.set(Number(u.productCode), (usado.get(Number(u.productCode)) || 0) + Number(u.quantity || 0));
      const compra = jn.data.compra;
      const itens = compra.itens.map((it) => {
        const ja = Math.min(usado.get(it.productCode) || 0, it.quantity);
        usado.set(it.productCode, (usado.get(it.productCode) || 0) - ja);
        return { ...it, disponivel: it.quantity - ja };
      });
      const nota = {
        ...compra,
        itens,
        cupom: cupom.codigo,
        comprador: { code: cupom.cliente_code || compra.personCode, name: cupom.cliente_nome || compra.personName },
      };
      setNotasCupom((l) => [nota, ...l.filter((n) => n.cupom !== cupom.codigo)]);
      setCodigo('');
    } catch (er) {
      setCupomErro(er.message);
    } finally {
      setCupomBusy(false);
    }
  };

  const visiveis = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f || !notas) return notas || [];
    return notas
      .map((n) => {
        const notaBate = String(n.invoiceCode).includes(f) || String(n.invoiceSequence).includes(f);
        const itens = notaBate ? n.itens : n.itens.filter((i) => String(i.name).toLowerCase().includes(f) || String(i.productCode).includes(f));
        return { ...n, itens };
      })
      .filter((n) => n.itens.length > 0);
  }, [notas, filtro]);

  // Tudo o que está marcado: das duas abas + o que já estava na troca e não
  // foi carregado de novo nesta abertura (para não se perder ao confirmar)
  const escolhidos = useMemo(() => {
    const out = [];
    const vistos = new Set();
    for (const n of [...notasCupom, ...(notas || [])]) {
      for (const it of n.itens) {
        const key = chaveTroca(n, it);
        if (vistos.has(key)) continue;
        vistos.add(key);
        const q = escolha[key];
        if (q > 0) {
          out.push({
            key,
            productCode: it.productCode,
            name: it.name,
            quantity: q,
            unit: it.unitNet,
            cfop: it.cfop,
            ...(n.cupom ? { cupom: n.cupom } : {}),
            nota: {
              branchCode: n.branchCode,
              invoiceCode: n.invoiceCode,
              serialCode: n.serialCode,
              invoiceSequence: n.invoiceSequence,
              invoiceDate: n.invoiceDate,
              accessKey: n.accessKey,
              documentType: n.documentType,
            },
          });
        }
      }
    }
    for (const s of selecionados) if (!vistos.has(s.key)) out.push(s);
    return out;
  }, [notas, notasCupom, escolha, selecionados]);
  const totalEscolhido = escolhidos.reduce((s, i) => s + i.quantity * i.unit, 0);

  const setQtd = (key, q, max) =>
    setEscolha((e) => {
      const v = Math.max(0, Math.min(max, q));
      const novo = { ...e };
      if (v > 0) novo[key] = v;
      else delete novo[key];
      return novo;
    });

  const confirmar = () => {
    // sem cliente no caixa: a troca vai no nome de quem comprou (dono do cupom)
    const comprador = notasCupom.find((n) => n.comprador?.code && n.itens.some((it) => escolha[chaveTroca(n, it)] > 0))?.comprador;
    onConfirm(escolhidos, comprador || null);
  };

  const renderNota = (n) => (
    <div key={`${n.cupom || ''}${n.branchCode}-${n.invoiceSequence}`} className="rounded-xl ring-1 ring-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {n.cupom && (
          <span className="inline-flex items-center gap-1 px-1.5 rounded-full bg-purple-600 text-white font-bold">
            <Ticket size={11} weight="bold" /> {n.cupom}
          </span>
        )}
        <span className="font-bold text-[#000638]">
          {n.documentType === 65 ? 'NFC-e' : 'NF'} {n.invoiceCode}/{n.serialCode}
        </span>
        <span className="text-gray-500">fatura {n.invoiceSequence}</span>
        <span className="text-gray-500">{fmtData(n.invoiceDate)}</span>
        <span className="text-gray-500">empresa {n.branchCode}</span>
        {n.comprador?.name && <span className="text-gray-500">comprou: {n.comprador.name}</span>}
        <span className="ml-auto font-semibold text-[#000638] tabular-nums">{fmtBRL(n.totalValue)}</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {n.itens.map((it) => {
          const key = chaveTroca(n, it);
          const q = escolha[key] || 0;
          const max = it.disponivel ?? it.quantity;
          return (
            <li key={key} className={`px-3 py-1.5 flex items-center gap-2 text-xs ${q > 0 ? 'bg-purple-50' : ''} ${max <= 0 ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={q > 0}
                disabled={max <= 0}
                onChange={(e) => setQtd(key, e.target.checked ? 1 : 0, max)}
                className="w-4 h-4 p-0 mb-0 accent-purple-600 shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium text-[#000638]">{it.name}</span>
                <span className="text-[10px] text-gray-400">
                  cód. {it.productCode} · comprou {it.quantity} · pago {fmtBRL(it.unitNet)} cada
                  {it.unitDiscount > 0 && ` (de ${fmtBRL(it.unitGross)})`}
                  {it.disponivel != null && it.disponivel < it.quantity && (
                    <b className="text-rose-600"> · {max <= 0 ? 'já trocada com este cupom' : `${it.quantity - it.disponivel} já trocada(s)`}</b>
                  )}
                </span>
              </span>
              {q > 0 && max > 1 && (
                <span className="inline-flex items-center gap-1">
                  <button onClick={() => setQtd(key, q - 1, max)} className="w-5 h-5 rounded ring-1 ring-purple-300 text-purple-700 inline-flex items-center justify-center">
                    <Minus size={10} weight="bold" />
                  </button>
                  <span className="w-5 text-center font-bold tabular-nums">{q}</span>
                  <button onClick={() => setQtd(key, q + 1, max)} className="w-5 h-5 rounded ring-1 ring-purple-300 text-purple-700 inline-flex items-center justify-center">
                    <Plus size={10} weight="bold" />
                  </button>
                </span>
              )}
              <span className="w-20 text-right font-semibold tabular-nums text-[#000638]">{fmtBRL(it.unitNet)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-5 max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-purple-800 inline-flex items-center gap-2">
              <ArrowsLeftRight size={18} weight="bold" /> Troca
            </h3>
            <p className="text-xs text-gray-500">Marque as peças que estão voltando; elas entram na troca pelo valor pago na nota.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mb-3 inline-flex self-start rounded-lg bg-gray-100 p-0.5">
          {[
            { id: 'compras', label: 'COMPRAS DO CLIENTE', icon: Receipt },
            { id: 'cupom', label: 'CUPOM DE TROCA', icon: Ticket },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAba(t.id)}
                className={`h-8 px-3 rounded-md text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${aba === t.id ? 'bg-purple-700 text-white' : 'text-purple-800 hover:bg-white'}`}
              >
                <Icon size={14} weight="bold" /> {t.label}
              </button>
            );
          })}
        </div>

        {aba === 'compras' ? (
          !customer ? (
            <p className="flex-1 py-10 text-center text-xs text-gray-400">
              Selecione o cliente no PDV para ver as compras dele — ou use a aba CUPOM DE TROCA.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-600">
                {customer.code} — {customer.name}
              </p>
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-0.5">De</label>
                  <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-0.5">Até</label>
                  <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} />
                </div>
                <label className="h-9 inline-flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
                  <input type="checkbox" checked={soEstaLoja} onChange={(e) => setSoEstaLoja(e.target.checked)} className="w-4 h-4 p-0 mb-0 accent-purple-600" />
                  só empresa {branch}
                </label>
                <button onClick={buscar} disabled={loading} className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 inline-flex items-center gap-1.5">
                  {loading ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} Buscar
                </button>
                <div className="flex-1 min-w-[10rem]">
                  <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar: nota, fatura ou produto" className={`${inputCls} w-full`} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[12rem]">
                {loading && (
                  <p className="py-10 text-center text-xs text-gray-400">
                    <Spinner size={20} className="animate-spin mx-auto mb-1.5" />
                    Procurando as compras nas lojas…
                  </p>
                )}
                {erro && (
                  <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200 flex items-start gap-1.5">
                    <Warning size={14} weight="bold" className="shrink-0 mt-0.5" /> {erro}
                  </p>
                )}
                {!loading && !erro && notas && visiveis.length === 0 && (
                  <p className="py-10 text-center text-xs text-gray-400">
                    {notas.length === 0 ? 'Nenhuma compra deste cliente no período.' : 'Nada encontrado com esse filtro.'}
                  </p>
                )}
                {!loading && visiveis.map(renderNota)}
              </div>
            </>
          )
        ) : (
          <>
            <form onSubmit={buscarCupom} className="flex flex-wrap items-end gap-2 mb-2">
              <div className="flex-1 min-w-[12rem]">
                <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-0.5">Código do cupom de troca</label>
                <input
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ex.: K7MP 2QXW"
                  className={`${inputCls} w-full font-mono tracking-widest uppercase`}
                />
              </div>
              <button type="submit" disabled={cupomBusy || !codigo.trim()} className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 inline-flex items-center gap-1.5">
                {cupomBusy ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} Buscar cupom
              </button>
            </form>
            {cupomErro && (
              <p className="mb-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200 flex items-start gap-1.5">
                <Warning size={14} weight="bold" className="shrink-0 mt-0.5" /> {cupomErro}
              </p>
            )}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[12rem]">
              {notasCupom.length === 0 && !cupomBusy && (
                <p className="py-10 text-center text-xs text-gray-400">
                  <Ticket size={26} className="mx-auto mb-1.5 text-gray-300" />
                  Digite o código impresso no cupom para abrir a venda original.
                </p>
              )}
              {notasCupom.map(renderNota)}
            </div>
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <p className="text-sm text-purple-800">
            <b>{escolhidos.reduce((s, i) => s + i.quantity, 0)}</b> peça(s) na troca · <b className="tabular-nums">{fmtBRL(totalEscolhido)}</b>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-10 px-4 rounded-lg text-xs font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={confirmar} disabled={loading || cupomBusy} className="h-10 px-5 rounded-lg text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50">
              USAR NA TROCA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
