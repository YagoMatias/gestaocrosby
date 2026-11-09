// Página: Expedição → Pedido de Venda
// Pedidos feitos no Dryland (site / vendedores) e separados em
// dryland-missao-separacao.vercel.app/separar. O pedido mostrado é o DO
// DRYLAND (ref RV###, VJ###, MT###, PE###, FR###…), copiado para o HeadCoach a
// cada 5 min (/api/pedidos-venda) — não o pedido que o Dryland abre no TOTVS,
// que aparece só como referência.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  ArrowsClockwise,
  Spinner,
  MagnifyingGlass,
  X,
  CheckCircle,
  Warning,
  Package,
  Clock,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtDataHora = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const hojeBR = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());

const CANAIS = {
  revenda: { label: 'Revenda', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  varejo: { label: 'Varejo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  multimarca: { label: 'Multimarca', cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
  franquia: { label: 'Franquia', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  transferencia: { label: 'Transferência', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  brinde: { label: 'Brinde', cls: 'bg-pink-50 text-pink-700 ring-pink-200' },
};
const STATUS = {
  aguardando: { label: 'Aguardando separação', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  em_separacao: { label: 'Em separação', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  separado: { label: 'Separado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};
const PAGAMENTO = { pix: 'Pix', cartao: 'Cartão', boleto_faturado: 'Boleto faturado', credev: 'Credev', boleto: 'Boleto' };
const inputCls = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

function Selo({ mapa, valor }) {
  const s = mapa[valor] || { label: valor || '—', cls: 'bg-gray-100 text-gray-600 ring-gray-200' };
  return <span className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

function Progresso({ sep, tot }) {
  const pct = tot ? Math.round((100 * sep) / tot) : 0;
  return (
    <div className="min-w-[70px]">
      <div className="text-[11px] tabular-nums text-gray-600">
        <b className="text-[#000638]">{fmtNum(sep)}</b>/{fmtNum(tot)}
      </div>
      <div className="mt-0.5 h-1.5 rounded bg-gray-100 overflow-hidden">
        <div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Card({ label, valor, cor = 'text-[#000638]', sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className={`text-base sm:text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  );
}

const PedidosVenda = () => {
  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [canal, setCanal] = useState('');
  const [status, setStatus] = useState('');
  const [transferencias, setTransferencias] = useState(false);
  const [de, setDe] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hojeBR());
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const qs = new URLSearchParams();
      if (canal) qs.set('canal', canal);
      if (status) qs.set('status', status);
      if (transferencias) qs.set('transferencias', '1');
      if (de) qs.set('de', de);
      if (ate) qs.set('ate', ate);
      if (busca.trim()) qs.set('busca', busca.trim());
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao carregar os pedidos');
      setItems(j.data.items || []);
      setResumo(j.data.resumo || null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [canal, status, transferencias, de, ate, busca]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal, status, transferencias, de, ate]);

  const sincronizar = async () => {
    setSincronizando(true);
    setErro(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/sincronizar`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao atualizar do Dryland');
      setAviso(j.message);
      setTimeout(() => setAviso(null), 4000);
      carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSincronizando(false);
    }
  };

  const abrir = async (p) => {
    setDetalhe({ ...p, itens: null });
    try {
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/${encodeURIComponent(p.ref)}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir o pedido');
      setDetalhe(j.data);
    } catch (e) {
      setErro(e.message);
      setDetalhe(null);
    }
  };

  const itensDetalhe = useMemo(() => {
    if (!detalhe?.itens) return [];
    // o que falta separar primeiro
    return [...detalhe.itens].sort((a, b) => (a.separado >= a.qtd) - (b.separado >= b.qtd) || String(a.descricao).localeCompare(String(b.descricao)));
  }, [detalhe]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-2 sm:p-3 lg:p-4">
      <div className="max-w-7xl mx-auto">
        <PageTitle
          title="Pedido de Venda"
          subtitle="Pedidos feitos no Dryland e separados na Missão Separação — o pedido do Dryland, guardado no HeadCoach"
          icon={ShoppingBag}
        />

        {resumo && (
          <div className="mb-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
            <Card label="Pedidos" valor={fmtNum(resumo.pedidos)} />
            <Card label="Valor" valor={fmtBRL(resumo.valor)} />
            <Card label="Peças" valor={`${fmtNum(resumo.separadas)}/${fmtNum(resumo.pecas)}`} sub="separadas / total" />
            <Card label="Aguardando" valor={fmtNum(resumo.aguardando)} cor="text-amber-700" />
            <Card label="Em separação" valor={fmtNum(resumo.emSeparacao)} cor="text-blue-700" />
            <Card label="Separados" valor={fmtNum(resumo.separados)} cor="text-emerald-700" />
          </div>
        )}

        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-3 flex flex-wrap items-end gap-2">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregar()}
              placeholder="Pedido, cliente, vendedor, nº TOTVS…"
              className={`${inputCls} pl-8 w-full`}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Canal</label>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {Object.entries(CANAIS)
                .filter(([k]) => transferencias || !['transferencia', 'brinde'].includes(k))
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Situação</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputCls} w-auto`} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputCls} w-auto`} />
          </div>
          <label className="flex items-center gap-1.5 h-9 text-xs text-gray-600 select-none">
            <input type="checkbox" checked={transferencias} onChange={(e) => setTransferencias(e.target.checked)} className="w-4 h-4 p-0 mb-0" />
            incluir transferências
          </label>
          <div className="flex-1" />
          <button
            onClick={sincronizar}
            disabled={sincronizando}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            title="Copia agora os pedidos do Dryland (a cópia automática roda a cada 5 min)"
          >
            <ArrowsClockwise size={14} className={sincronizando || loading ? 'animate-spin' : ''} /> Atualizar do Dryland
          </button>
        </div>

        {erro && (
          <p className="mb-2 text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-2 ring-1 ring-rose-200 inline-flex items-center gap-1.5">
            <Warning size={14} weight="bold" /> {erro}
          </p>
        )}
        {aviso && (
          <p className="mb-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 ring-1 ring-emerald-200 inline-flex items-center gap-1.5">
            <CheckCircle size={14} weight="bold" /> {aviso}
          </p>
        )}

        {/* Celular: cartões */}
        <div className="md:hidden space-y-2">
          {loading && items.length === 0 && (
            <div className="py-10 text-center text-gray-400">
              <Spinner size={20} className="animate-spin mx-auto" />
            </div>
          )}
          {!loading && items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum pedido no período.</p>}
          {items.map((p) => (
            <button key={p.ref} onClick={() => abrir(p)} className="w-full text-left bg-white rounded-xl border border-gray-200 p-3 active:bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#000638]">{p.ref}</span>
                <Selo mapa={STATUS} valor={p.status} />
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-800 truncate">{p.cliente || '—'}</p>
              <p className="text-[11px] text-gray-500">
                {fmtDataHora(p.criado_em)} · {p.vendedor_nome || 'sem vendedor'}
                {p.pagamento ? ` · ${PAGAMENTO[p.pagamento] || p.pagamento}` : ''}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <Selo mapa={CANAIS} valor={p.canal} />
                <Progresso sep={p.qtd_separada} tot={p.qtd_pecas} />
                <span className="text-sm font-bold text-[#000638] tabular-nums">{fmtBRL(p.valor_total)}</span>
              </div>
              {(p.totvs_pedidos || []).length > 0 && <p className="mt-1 text-[11px] text-gray-400">TOTVS {p.totvs_pedidos.join(', ')}</p>}
            </button>
          ))}
        </div>

        {/* Computador: tabela */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Pedido</th>
                  <th className="px-2 py-2 text-left">Criado em</th>
                  <th className="px-2 py-2 text-left">Canal</th>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-left">Vendedor</th>
                  <th className="px-2 py-2 text-left">Pagamento</th>
                  <th className="px-2 py-2 text-left">Peças</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-left">TOTVS</th>
                  <th className="px-2 py-2 text-left">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-gray-400">
                      <Spinner size={20} className="animate-spin mx-auto" />
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-gray-400">
                      <Package size={26} className="mx-auto mb-1.5 text-gray-300" />
                      Nenhum pedido no período.
                    </td>
                  </tr>
                )}
                {items.map((p) => (
                  <tr key={p.ref} onClick={() => abrir(p)} className={`hover:bg-gray-50/80 cursor-pointer ${p.sumiu_do_dryland_em ? 'opacity-70' : ''}`}>
                    <td className="px-2 py-1.5 font-mono font-bold text-[#000638]">{p.ref}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(p.criado_em)}</td>
                    <td className="px-2 py-1.5">
                      <Selo mapa={CANAIS} valor={p.canal} />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-[#000638] truncate max-w-[220px]">{p.cliente || '—'}</td>
                    <td className="px-2 py-1.5 truncate max-w-[150px]">
                      {p.vendedor_nome || '—'}
                      {p.vendedor_code ? <span className="text-gray-400"> · {p.vendedor_code}</span> : null}
                    </td>
                    <td className="px-2 py-1.5">{p.pagamento ? PAGAMENTO[p.pagamento] || p.pagamento : '—'}</td>
                    <td className="px-2 py-1.5">
                      <Progresso sep={p.qtd_separada} tot={p.qtd_pecas} />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(p.valor_total)}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-600">{(p.totvs_pedidos || []).join(', ') || '—'}</td>
                    <td className="px-2 py-1.5">
                      <Selo mapa={STATUS} valor={p.status} />
                      {p.sumiu_do_dryland_em && <span className="block text-[10px] text-gray-400">saiu do Dryland em {fmtDataHora(p.sumiu_do_dryland_em)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalhe do pedido */}
        {detalhe && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => setDetalhe(null)}>
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#000638]">
                    Pedido <span className="font-mono">{detalhe.ref}</span> · {detalhe.cliente}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {fmtDataHora(detalhe.criado_em)} · {detalhe.vendedor_nome || 'sem vendedor'}
                    {detalhe.vendedor_code ? ` (${detalhe.vendedor_code})` : ''}
                    {detalhe.pagamento ? ` · ${PAGAMENTO[detalhe.pagamento] || detalhe.pagamento}` : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Selo mapa={CANAIS} valor={detalhe.canal} />
                    <Selo mapa={STATUS} valor={detalhe.status} />
                    {(detalhe.totvs_pedidos || []).length > 0 && (
                      <span className="text-[11px] text-gray-500">pedido TOTVS {detalhe.totvs_pedidos.join(', ')}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2">
                  <p className="text-[10px] text-gray-500 uppercase">Peças</p>
                  <p className="font-bold tabular-nums">
                    {fmtNum(detalhe.qtd_separada)}/{fmtNum(detalhe.qtd_pecas)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2">
                  <p className="text-[10px] text-gray-500 uppercase">Valor</p>
                  <p className="font-bold tabular-nums">{fmtBRL(detalhe.valor_total)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2">
                  <p className="text-[10px] text-gray-500 uppercase">Separado em</p>
                  <p className="font-bold text-xs">{detalhe.separado_em ? fmtDataHora(detalhe.separado_em) : '—'}</p>
                </div>
              </div>

              {detalhe.obs && <p className="mb-3 text-[11px] text-gray-600 bg-amber-50 rounded-xl ring-1 ring-amber-200 px-3 py-2">{detalhe.obs}</p>}

              {!detalhe.itens ? (
                <div className="py-8 text-center text-gray-400">
                  <Spinner size={20} className="animate-spin mx-auto" />
                </div>
              ) : (
                <div className="rounded-xl ring-1 ring-gray-200 divide-y divide-gray-100">
                  {itensDetalhe.map((i) => {
                    const ok = i.separado >= i.qtd;
                    return (
                      <div key={i.dryland_id} className={`flex items-start gap-2 px-3 py-2 ${ok ? '' : 'bg-amber-50/40'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#000638] leading-tight">{i.descricao}</p>
                          <p className="text-[11px] text-gray-500">
                            {[i.cor, i.tamanho && `tam. ${i.tamanho}`, `cód. ${i.cod}`, i.estoque && `estoque ${i.estoque}`].filter(Boolean).join(' · ')}
                            {i.totvs ? ` · TOTVS ${i.totvs}` : ''}
                          </p>
                          {i.troca_pendente && <p className="text-[11px] text-amber-700">troca pendente: {String(i.troca_pendente)}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold tabular-nums ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {ok ? <CheckCircle size={12} weight="fill" className="inline -mt-0.5 mr-0.5" /> : <Clock size={12} className="inline -mt-0.5 mr-0.5" />}
                            {i.separado}/{i.qtd}
                          </p>
                          <p className="text-[11px] text-gray-500 tabular-nums">{i.preco != null ? fmtBRL(i.preco * i.qtd) : '—'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PedidosVenda;
