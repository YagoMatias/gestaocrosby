// Movimento do dia da empresa no PDV Crosby: todas as vendas e devoluções,
// tanto as do TOTVS (notas fiscais do dia, inclusive as feitas direto no caixa)
// quanto as emitidas pelo HeadCoach. Mostra cliente, valor e pagamento, deixa
// detalhar os produtos e separa por vendedor.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Spinner, ArrowsClockwise, CaretDown, CaretRight, ChartBar, Warning } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hojeBR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Recife' });
const FORMAS_HC = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Cartão de crédito', debito: 'Cartão de débito', credito_loja: 'Crédito loja', vale_troca: 'Vale troca' };

export default function MovimentoDiaModal({ empresa, empresaNome, sellers = [], onClose }) {
  const [data, setData] = useState(hojeBR());
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [movs, setMovs] = useState([]);
  const [porVendedor, setPorVendedor] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState(''); // '' | venda | devolucao
  const [abertos, setAbertos] = useState(() => new Set());

  const nomeVendedor = useCallback(
    (code, fallback) => {
      if (code == null) return fallback || 'Sem vendedor';
      const s = sellers.find((x) => String(x.code) === String(code));
      return s ? `${s.code} — ${s.name}` : fallback ? `${code} — ${fallback}` : `Vendedor ${code}`;
    },
    [sellers],
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [rt, rh] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/totvs/pdv/day-movement?branch=${empresa}&date=${data}`).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/pdv-crosby/vendas?empresa=${empresa}&data=${data}&detalhes=1`).then((r) => r.json()),
      ]);
      const lista = [];
      if (rt.status === 'fulfilled' && rt.value?.success) {
        for (const m of rt.value.data.movimentos || []) lista.push({ ...m, key: `t-${m.invoiceSequence}` });
      } else {
        setErro(rt.value?.message || 'Não foi possível carregar as notas do TOTVS.');
      }
      // vendas emitidas pelo HeadCoach (não passam pelo TOTVS)
      if (rh.status === 'fulfilled' && rh.value?.success) {
        for (const v of rh.value.data?.items || []) {
          if (v.status === 'cancelada') continue;
          lista.push({
            key: `h-${v.id}`,
            origem: 'headcoach',
            tipo: v.tipo_venda === 'troca' ? 'devolucao' : 'venda',
            hora: v.criado_em ? new Date(v.criado_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Recife' }) : null,
            documentType: v.nota?.modelo,
            invoiceCode: v.nota?.numero,
            serialCode: v.nota?.serie,
            customerCode: v.cliente_code,
            customerName: v.cliente_nome || 'Consumidor não identificado',
            sellerCode: v.vendedor_code,
            sellerName: v.vendedor_nome,
            quantity: Number(v.qtd_pecas || 0),
            total: Number(v.total || 0),
            pagamentos: (v.pagamentos || []).map((p) => ({ forma: FORMAS_HC[p.forma] || p.forma, valor: Number(p.valor), parcelas: p.parcelas || 1 })),
            itens: (v.itens || []).map((i) => ({
              productCode: i.product_code,
              name: i.nome,
              quantity: Number(i.quantidade),
              unitGross: Number(i.valor_unit),
              unitDiscount: Number(i.desconto_unit || 0),
              unitNet: Number(i.valor_unit) - Number(i.desconto_unit || 0),
              total: Number(i.total),
            })),
          });
        }
      }
      lista.sort((a, b) => String(b.hora || '').localeCompare(String(a.hora || '')));
      setMovs(lista);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [empresa, data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resumo = useMemo(() => {
    const v = movs.filter((m) => m.tipo === 'venda');
    const d = movs.filter((m) => m.tipo === 'devolucao');
    const soma = (l, k) => l.reduce((s, m) => s + Number(m[k] || 0), 0);
    return { vendas: v.length, vendasValor: soma(v, 'total'), devol: d.length, devolValor: soma(d, 'total'), pecas: soma(v, 'quantity'), pecasDev: soma(d, 'quantity') };
  }, [movs]);

  const grupos = useMemo(() => {
    const lista = filtroTipo ? movs.filter((m) => m.tipo === filtroTipo) : movs;
    if (!porVendedor) return [{ nome: null, itens: lista }];
    const map = new Map();
    for (const m of lista) {
      const k = m.sellerCode ?? 'sem';
      if (!map.has(k)) map.set(k, { nome: nomeVendedor(m.sellerCode, m.sellerName), itens: [] });
      map.get(k).itens.push(m);
    }
    const liquido = (g) => g.itens.reduce((s, m) => s + (m.tipo === 'venda' ? m.total : -m.total), 0);
    return [...map.values()].sort((a, b) => liquido(b) - liquido(a));
  }, [movs, porVendedor, filtroTipo, nomeVendedor]);

  const toggle = (key) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const linha = (m) => {
    const aberto = abertos.has(m.key);
    const dev = m.tipo === 'devolucao';
    return (
      <React.Fragment key={m.key}>
        <tr className={`hover:bg-gray-50/60 cursor-pointer ${dev ? 'bg-purple-50/40' : ''}`} onClick={() => toggle(m.key)}>
          <td className="px-2 py-1.5 text-gray-400">{aberto ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}</td>
          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{String(m.hora || '').slice(0, 5) || '—'}</td>
          <td className="px-2 py-1.5">
            <span className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-bold ${dev ? 'bg-purple-50 text-purple-700 ring-purple-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
              {dev ? 'DEVOLUÇÃO' : 'VENDA'}
            </span>
            {m.origem === 'headcoach' && <span className="ml-1 inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold bg-blue-50 text-blue-700 ring-blue-200">HeadCoach</span>}
          </td>
          <td className="px-2 py-1.5 whitespace-nowrap">
            {m.invoiceCode ? `${Number(m.documentType) === 65 ? 'NFC-e' : 'NF'} ${m.invoiceCode}/${m.serialCode}` : 'sem nota'}
          </td>
          <td className="px-2 py-1.5 truncate max-w-[220px]">
            {m.customerName}
            {m.customerCode ? <span className="text-gray-400"> · {m.customerCode}</span> : null}
          </td>
          {!porVendedor && <td className="px-2 py-1.5 truncate max-w-[160px] text-gray-600">{nomeVendedor(m.sellerCode, m.sellerName)}</td>}
          <td className="px-2 py-1.5 text-right tabular-nums">{m.quantity}</td>
          <td className="px-2 py-1.5 text-gray-600">
            {(m.pagamentos || []).map((p) => `${p.forma}${p.parcelas > 1 ? ` ${p.parcelas}x` : ''} ${fmtBRL(p.valor)}`).join(' · ') || '—'}
          </td>
          <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${dev ? 'text-purple-700' : 'text-[#000638]'}`}>
            {dev ? '− ' : ''}
            {fmtBRL(m.total)}
          </td>
        </tr>
        {aberto && (
          <tr className="bg-gray-50">
            <td />
            <td colSpan={porVendedor ? 7 : 8} className="px-2 py-2">
              <table className="w-full text-[11px]">
                <thead className="text-[10px] uppercase text-gray-500">
                  <tr>
                    <th className="text-left font-semibold py-0.5">Produto</th>
                    <th className="text-right font-semibold w-12">Qtd</th>
                    <th className="text-right font-semibold w-24">Vl. unit.</th>
                    <th className="text-right font-semibold w-24">Desconto</th>
                    <th className="text-right font-semibold w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(m.itens || []).map((i, idx) => (
                    <tr key={idx} className="border-t border-gray-200/70">
                      <td className="py-0.5">
                        {i.name} <span className="text-gray-400">· cód. {i.productCode}</span>
                      </td>
                      <td className="text-right tabular-nums">{i.quantity}</td>
                      <td className="text-right tabular-nums">{fmtBRL(i.unitGross)}</td>
                      <td className="text-right tabular-nums">{i.unitDiscount > 0 ? `− ${fmtBRL(i.unitDiscount * i.quantity)}` : '—'}</td>
                      <td className="text-right tabular-nums font-semibold">{fmtBRL(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] text-gray-400">
                {m.operationName ? `${m.operationName} · ` : ''}
                {m.transactionCode ? `transação ${m.transactionCode} · ` : ''}
                {m.invoiceSequence ? `fatura ${m.invoiceSequence}` : ''}
              </p>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full p-5 max-h-[94vh] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-[#000638] inline-flex items-center gap-2">
              <ChartBar size={18} weight="bold" /> Vendas e devoluções do dia
            </h3>
            <p className="text-xs text-gray-500">
              Empresa {empresa}
              {empresaNome ? ` — ${empresaNome}` : ''} · inclui o que foi feito direto no TOTVS
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-2.5">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Vendas ({resumo.vendas})</p>
            <p className="text-lg font-bold text-emerald-800 tabular-nums">{fmtBRL(resumo.vendasValor)}</p>
            <p className="text-[11px] text-emerald-700">{resumo.pecas} peça(s)</p>
          </div>
          <div className="rounded-xl bg-purple-50 ring-1 ring-purple-200 p-2.5">
            <p className="text-[10px] font-bold uppercase text-purple-700">Devoluções ({resumo.devol})</p>
            <p className="text-lg font-bold text-purple-800 tabular-nums">− {fmtBRL(resumo.devolValor)}</p>
            <p className="text-[11px] text-purple-700">{resumo.pecasDev} peça(s)</p>
          </div>
          <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2.5">
            <p className="text-[10px] font-bold uppercase text-gray-600">Líquido</p>
            <p className="text-lg font-bold text-[#000638] tabular-nums">{fmtBRL(resumo.vendasValor - resumo.devolValor)}</p>
            <p className="text-[11px] text-gray-500">vendas − devoluções</p>
          </div>
          <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2.5">
            <p className="text-[10px] font-bold uppercase text-gray-600">Ticket médio</p>
            <p className="text-lg font-bold text-[#000638] tabular-nums">{fmtBRL(resumo.vendas ? resumo.vendasValor / resumo.vendas : 0)}</p>
            <p className="text-[11px] text-gray-500">por venda</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 px-2 mb-0 w-auto rounded-lg border border-gray-300 bg-white text-sm" />
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {[
              { id: '', label: 'Tudo' },
              { id: 'venda', label: 'Vendas' },
              { id: 'devolucao', label: 'Devoluções' },
            ].map((t) => (
              <button key={t.id} onClick={() => setFiltroTipo(t.id)} className={`h-8 px-3 rounded-md text-xs font-bold ${filtroTipo === t.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="h-9 inline-flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
            <input type="checkbox" checked={porVendedor} onChange={(e) => setPorVendedor(e.target.checked)} className="w-4 h-4 p-0 mb-0" />
            separar por vendedor
          </label>
          <div className="flex-1" />
          <button onClick={carregar} disabled={loading} className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-50 inline-flex items-center gap-1.5">
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {erro && (
          <p className="mb-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200 flex items-start gap-1.5">
            <Warning size={14} weight="bold" className="shrink-0 mt-0.5" /> {erro}
          </p>
        )}

        <div className="flex-1 overflow-y-auto min-h-[14rem] space-y-3 pr-1">
          {loading && movs.length === 0 && (
            <p className="py-10 text-center text-xs text-gray-400">
              <Spinner size={20} className="animate-spin mx-auto mb-1.5" /> Carregando o movimento do dia…
            </p>
          )}
          {!loading && movs.length === 0 && !erro && <p className="py-10 text-center text-xs text-gray-400">Nenhuma venda ou devolução neste dia.</p>}
          {grupos
            .filter((g) => g.itens.length > 0)
            .map((g, gi) => {
              const v = g.itens.filter((m) => m.tipo === 'venda');
              const d = g.itens.filter((m) => m.tipo === 'devolucao');
              const sv = v.reduce((s, m) => s + m.total, 0);
              const sd = d.reduce((s, m) => s + m.total, 0);
              return (
                <div key={g.nome || gi} className="rounded-xl ring-1 ring-gray-200 overflow-hidden">
                  {g.nome && (
                    <div className="bg-[#000638] text-white px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
                      <span className="font-bold">{g.nome}</span>
                      <span className="opacity-80">
                        {v.length} venda(s) {fmtBRL(sv)}
                      </span>
                      {d.length > 0 && (
                        <span className="opacity-80">
                          {d.length} devolução(ões) − {fmtBRL(sd)}
                        </span>
                      )}
                      <span className="ml-auto font-bold tabular-nums">líquido {fmtBRL(sv - sd)}</span>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="w-6" />
                          <th className="px-2 py-1.5 text-left">Hora</th>
                          <th className="px-2 py-1.5 text-left">Tipo</th>
                          <th className="px-2 py-1.5 text-left">Nota</th>
                          <th className="px-2 py-1.5 text-left">Cliente</th>
                          {!porVendedor && <th className="px-2 py-1.5 text-left">Vendedor</th>}
                          <th className="px-2 py-1.5 text-right">Peças</th>
                          <th className="px-2 py-1.5 text-left">Pagamento</th>
                          <th className="px-2 py-1.5 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">{g.itens.map(linha)}</tbody>
                    </table>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
