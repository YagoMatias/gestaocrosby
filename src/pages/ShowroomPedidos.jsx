// Aba "Pedidos" do Showroom — lista pedidos do Wix sincronizados com items
// (quantidade + produto por pedido).
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package,
  MagnifyingGlass,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  CalendarBlank,
  CurrencyDollar,
  Receipt,
  ShoppingBag,
  User,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

const STATUS_INFO = {
  APPROVED:    { label: 'Aprovado',   bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', rowBg: 'bg-emerald-50/50 hover:bg-emerald-100/50',     barColor: 'bg-emerald-500' },
  INITIALIZED: { label: 'Iniciado',   bg: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400',    rowBg: 'bg-gray-50/50 hover:bg-gray-100/50',           barColor: 'bg-gray-400' },
  CANCELED:    { label: 'Cancelado',  bg: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-500',    rowBg: 'bg-rose-50/60 hover:bg-rose-100/60',           barColor: 'bg-rose-500' },
  PENDING:     { label: 'Pendente',   bg: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500',   rowBg: 'bg-amber-50/50 hover:bg-amber-100/50',         barColor: 'bg-amber-500' },
  FULFILLED:   { label: 'Entregue',   bg: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500',    rowBg: 'bg-blue-50/50 hover:bg-blue-100/50',           barColor: 'bg-blue-500' },
};

// Classificações de cliente (auto-detectadas via pes_pessoa do TOTVS)
const CLASSIFICACOES = {
  varejo:      { label: 'Varejo',      bg: 'bg-blue-100 text-blue-700' },
  multimarcas: { label: 'Multimarcas', bg: 'bg-violet-100 text-violet-700' },
  franquia:    { label: 'Franquia',    bg: 'bg-amber-100 text-amber-700' },
  outros:      { label: 'Outros',      bg: 'bg-gray-100 text-gray-700' },
};

// Vendedores fixos do showroom
const VENDEDORES = ['Renato', 'Arthur', 'Rafael', 'David', 'Walter', 'Jhemyson'];

// Formas de pagamento (manual — preenchido pelo admin quando confirmar)
const FORMAS_PAGAMENTO = [
  { v: '',          label: '—',         bg: 'bg-gray-100 text-gray-400' },
  { v: 'pix',       label: 'PIX',       bg: 'bg-emerald-100 text-emerald-700' },
  { v: 'cartao',    label: 'Cartão',    bg: 'bg-blue-100 text-blue-700' },
  { v: 'boleto',    label: 'Boleto',    bg: 'bg-amber-100 text-amber-700' },
  { v: 'deposito',  label: 'Depósito',  bg: 'bg-indigo-100 text-indigo-700' },
  { v: 'crediario', label: 'Crediário', bg: 'bg-purple-100 text-purple-700' },
  { v: 'dinheiro',  label: 'Dinheiro',  bg: 'bg-teal-100 text-teal-700' },
  { v: 'outro',     label: 'Outro',     bg: 'bg-slate-100 text-slate-700' },
];
const FORMA_MAP = Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f.v, f]));

const fmtBRL = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
const fmtDateOnly = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
};

const HOJE = new Date().toISOString().slice(0, 10);
// Janela padrão de 12 meses. Antes o padrão era o 1º dia do mês corrente, o que
// escondia todos os pedidos (e marcações de vendedor) dos meses anteriores —
// dava a impressão de que os dados tinham sumido. 12 meses mostra o histórico
// todo hoje e continua sensato conforme a base cresce.
const JANELA_INI = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 365);
  return d.toISOString().slice(0, 10);
})();

export default function ShowroomPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    datemin: JANELA_INI,
    datemax: HOJE,
    status: '',
    busca: '',
    forma_pagamento: '', // '' = todos, 'sem' = sem pagamento marcado, 'pix'/'cartao'/...
    vendedor: '',        // '' = todos, 'sem' = sem vendedor, 'Renato'/...
  });
  const [expandidos, setExpandidos] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandidos((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (filtros.datemin) qs.set('datemin', filtros.datemin);
      if (filtros.datemax) qs.set('datemax', filtros.datemax);
      if (filtros.status) qs.set('status', filtros.status);
      if (filtros.busca) qs.set('busca', filtros.busca);
      qs.set('limit', '500');
      const [rP, rS] = await Promise.all([
        fetch(`${API_BASE_URL}/api/wix/pedidos?${qs}`),
        fetch(`${API_BASE_URL}/api/wix/stats?${qs}`),
      ]);
      const jP = await rP.json();
      const jS = await rS.json();
      if (!rP.ok) throw new Error(jP?.error || 'Erro');
      setPedidos(jP.pedidos || []);
      setStats(jS.ok ? jS : null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  // PATCH genérico de campos editáveis do pedido (forma_pag, vendedor, cliente)
  const patchPedido = useCallback(async (pedidoId, patch) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/wix/pedidos/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'erro');
      setPedidos((arr) =>
        arr.map((p) =>
          p.id === pedidoId
            ? { ...p, ...j.pedido, itens: p.itens, itens_qty: p.itens_qty }
            : p,
        ),
      );
      return j.pedido;
    } catch (e) {
      alert('Falha ao salvar: ' + e.message);
      return null;
    }
  }, []);

  const atualizarFormaPagamento = useCallback(
    (id, v) => patchPedido(id, { forma_pagamento: v || null }),
    [patchPedido],
  );
  const atualizarVendedor = useCallback(
    (id, v) => patchPedido(id, { vendedor: v || null }),
    [patchPedido],
  );
  const atualizarParcelas = useCallback(
    (id, v) => patchPedido(id, { parcelas: v ? Number(v) : null }),
    [patchPedido],
  );

  // Modal de troca de cliente
  const [editClientePedido, setEditClientePedido] = useState(null);

  const syncManual = async () => {
    setSyncing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/wix/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (j.ok) {
        alert(`✓ Sync OK\n${j.pedidos} pedidos / ${j.itens} itens em ${j.duracao_s}s`);
        carregar();
      } else {
        alert(`❌ ${j.erro || 'erro'}`);
      }
    } catch (e) {
      alert('Falha: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  // Lista de status visíveis nos dados (pra montar filtro)
  const statusDisponiveis = useMemo(() => {
    const set = new Set();
    for (const p of pedidos) if (p.status) set.add(p.status);
    return [...set];
  }, [pedidos]);

  // Filtros client-side (forma_pagamento + vendedor)
  const pedidosFiltrados = useMemo(() => {
    let arr = pedidos;
    if (filtros.forma_pagamento === 'sem') {
      arr = arr.filter((p) => !p.forma_pagamento);
    } else if (filtros.forma_pagamento) {
      arr = arr.filter((p) => p.forma_pagamento === filtros.forma_pagamento);
    }
    if (filtros.vendedor === 'sem') {
      arr = arr.filter((p) => !p.vendedor);
    } else if (filtros.vendedor) {
      arr = arr.filter((p) => p.vendedor === filtros.vendedor);
    }
    return arr;
  }, [pedidos, filtros.forma_pagamento, filtros.vendedor]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={ShoppingBag} label="Pedidos" value={stats.total_pedidos} color="blue" />
          <KpiCard icon={CurrencyDollar} label="Faturamento" value={`R$ ${fmtBRL(stats.total_valor)}`} color="emerald" />
          <KpiCard icon={Receipt} label="Ticket médio" value={`R$ ${fmtBRL(stats.ticket_medio)}`} color="purple" />
          <KpiCard
            icon={CheckCircle}
            label="Aprovados"
            value={stats.por_status?.APPROVED?.qty || 0}
            color="green"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 bg-gray-50 rounded-lg ring-1 ring-gray-200 px-3 py-1.5">
          <CalendarBlank size={14} className="text-gray-400" />
          <input
            type="date"
            value={filtros.datemin}
            onChange={(e) => setFiltros((s) => ({ ...s, datemin: e.target.value }))}
            className="text-sm bg-transparent focus:outline-none tabular-nums w-[120px]"
          />
          <span className="text-gray-300">→</span>
          <input
            type="date"
            value={filtros.datemax}
            onChange={(e) => setFiltros((s) => ({ ...s, datemax: e.target.value }))}
            className="text-sm bg-transparent focus:outline-none tabular-nums w-[120px]"
          />
        </div>

        <select
          value={filtros.status}
          onChange={(e) => setFiltros((s) => ({ ...s, status: e.target.value }))}
          className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos status</option>
          {statusDisponiveis.map((s) => (
            <option key={s} value={s}>{STATUS_INFO[s]?.label || s}</option>
          ))}
        </select>

        <select
          value={filtros.forma_pagamento}
          onChange={(e) => setFiltros((s) => ({ ...s, forma_pagamento: e.target.value }))}
          className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          title="Filtro por forma de pagamento"
        >
          <option value="">Todos pagamentos</option>
          <option value="sem">⚠️ Sem pagamento marcado</option>
          {FORMAS_PAGAMENTO.filter((f) => f.v).map((f) => (
            <option key={f.v} value={f.v}>{f.label}</option>
          ))}
        </select>

        <select
          value={filtros.vendedor}
          onChange={(e) => setFiltros((s) => ({ ...s, vendedor: e.target.value }))}
          className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          title="Filtro por vendedor"
        >
          <option value="">Todos vendedores</option>
          <option value="sem">⚠️ Sem vendedor</option>
          {VENDEDORES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar número, nome ou email..."
            value={filtros.busca}
            onChange={(e) => setFiltros((s) => ({ ...s, busca: e.target.value }))}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <button
          onClick={carregar}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
        <button
          onClick={syncManual}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm disabled:opacity-50"
          title="Buscar pedidos novos no Wix"
        >
          <ArrowsClockwise size={14} weight="bold" className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando…' : 'Sync Wix'}
        </button>
      </div>

      {erro && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">
          {erro}
        </div>
      )}

      {/* Tabela de pedidos */}
      {loading && pedidos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400 text-sm">
          <ArrowsClockwise size={20} className="animate-spin inline mr-2" />
          Carregando pedidos…
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Package size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhum pedido encontrado nos filtros.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_90px_1fr_150px_120px_115px_115px_90px_115px_100px_115px] items-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 bg-gray-50/40">
            <div></div>
            <div>Pedido</div>
            <div>Cliente</div>
            <div>Cliente TOTVS</div>
            <div>Classif.</div>
            <div>Vendedor</div>
            <div>Pagamento</div>
            <div>Parcelas</div>
            <div>Data</div>
            <div className="text-right">Itens</div>
            <div className="text-right">Total</div>
          </div>

          {pedidosFiltrados.map((p) => {
            const isOpen = expandidos.has(p.id);
            const st = STATUS_INFO[p.status] || { label: p.status, bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
            return (
              <React.Fragment key={p.id}>
                <div
                  onClick={() => toggleExpand(p.id)}
                  className={`relative grid grid-cols-[40px_90px_1fr_150px_120px_115px_115px_90px_115px_100px_115px] items-center gap-2 px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${
                    isOpen ? 'bg-blue-50/40' : (st.rowBg || 'hover:bg-blue-50/30')
                  }`}
                  title={`Status: ${st.label}`}
                >
                  {/* Barra vertical colorida na esquerda = status */}
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${st.barColor || 'bg-gray-300'}`}
                    aria-hidden="true"
                  />
                  <div>
                    {isOpen ? (
                      <CaretDown size={14} className="text-gray-400" weight="bold" />
                    ) : (
                      <CaretRight size={14} className="text-gray-400" weight="bold" />
                    )}
                  </div>
                  <div className="font-mono font-bold text-[13px] text-gray-800">
                    #{p.numero}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-[13px] truncate">
                      {[p.buyer_nome, p.buyer_sobrenome].filter(Boolean).join(' ') || '—'}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {p.buyer_email || '—'}
                    </div>
                  </div>
                  {/* Cliente TOTVS — botão Trocar */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {p.cliente_totvs_code ? (
                      <button
                        onClick={() => setEditClientePedido(p)}
                        className="text-left text-[11px] hover:bg-blue-50 px-1.5 py-1 rounded-md min-w-0 w-full"
                        title="Trocar cliente"
                      >
                        <div className="font-mono font-bold text-blue-700">
                          #{p.cliente_totvs_code}
                        </div>
                        <div className="text-gray-500 truncate text-[10px]">
                          {p.cliente_totvs_nome || '—'}
                        </div>
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditClientePedido(p)}
                        className="text-[11px] text-gray-400 hover:text-blue-600 px-1.5 py-1 rounded-md hover:bg-blue-50"
                      >
                        + Vincular
                      </button>
                    )}
                  </div>

                  {/* Classificação */}
                  <div>
                    {p.cliente_classificacao ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${(CLASSIFICACOES[p.cliente_classificacao] || CLASSIFICACOES.outros).bg}`}>
                        {(CLASSIFICACOES[p.cliente_classificacao] || CLASSIFICACOES.outros).label}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-[11px]">—</span>
                    )}
                  </div>

                  {/* Vendedor */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      value={p.vendedor || ''}
                      onChange={(e) => atualizarVendedor(p.id, e.target.value)}
                      className={`text-[11px] font-semibold rounded-md px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 border-0 w-full ${
                        p.vendedor
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <option value="">—</option>
                      {VENDEDORES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Forma de pagamento */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      value={p.forma_pagamento || ''}
                      onChange={(e) => atualizarFormaPagamento(p.id, e.target.value)}
                      className={`text-[11px] font-bold rounded-md px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 border-0 w-full ${
                        (FORMA_MAP[p.forma_pagamento || '']?.bg) || 'bg-gray-100 text-gray-400'
                      }`}
                      title={p.data_pagamento ? `Pago em ${fmtDate(p.data_pagamento)}` : 'Marcar forma de pagamento'}
                    >
                      {FORMAS_PAGAMENTO.map((f) => (
                        <option key={f.v} value={f.v}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Parcelas */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      value={p.parcelas || ''}
                      onChange={(e) => atualizarParcelas(p.id, e.target.value)}
                      className={`text-[11px] font-semibold rounded-md px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 border-0 w-full ${
                        p.parcelas
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                      title="Em quantas vezes foi parcelado"
                    >
                      <option value="">—</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                  </div>

                  {/* Data */}
                  <div className="text-[11px] text-gray-600 tabular-nums">
                    {fmtDate(p.criado_em)}
                  </div>
                  <div className="text-right text-[12px] text-gray-600 tabular-nums">
                    <span className="font-semibold text-gray-800">{p.itens_qty}</span> pç ·{' '}
                    <span className="text-gray-400">{p.itens?.length || 0} prod</span>
                  </div>
                  <div className="text-right font-bold text-emerald-700 tabular-nums">
                    R$ {fmtBRL(p.total)}
                  </div>
                </div>

                {/* Detalhe expandido — items */}
                {isOpen && (
                  <DetalhesPedido pedido={p} />
                )}
              </React.Fragment>
            );
          })}

          <div className="px-4 py-2.5 text-[11px] text-gray-400 text-center bg-gray-50/40 border-t border-gray-100">
            {pedidosFiltrados.length} de {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} no período
          </div>
        </div>
      )}

      {/* Modal trocar cliente TOTVS */}
      {editClientePedido && (
        <TrocarClienteModal
          pedido={editClientePedido}
          onClose={() => setEditClientePedido(null)}
          onSaved={(novo) => {
            setPedidos((arr) =>
              arr.map((p) => (p.id === novo.id ? { ...p, ...novo, itens: p.itens, itens_qty: p.itens_qty } : p)),
            );
            setEditClientePedido(null);
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Modal: trocar cliente TOTVS de um pedido
// Digita o personCode → busca em pes_pessoa → preview com classificação → confirma
// ────────────────────────────────────────────────────────────────────────
function TrocarClienteModal({ pedido, onClose, onSaved }) {
  const [code, setCode] = useState(pedido.cliente_totvs_code || '');
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const buscar = async () => {
    if (!code) return;
    setBuscando(true);
    setErro('');
    setResultado(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/wix/cliente-totvs/${code}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'erro');
      setResultado(j.cliente);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const confirmar = async () => {
    if (!resultado) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/wix/pedidos/${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_totvs_code: resultado.code,
          cliente_totvs_nome: resultado.nome,
          cliente_totvs_doc: resultado.doc,
          cliente_classificacao: resultado.classificacao,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'erro');
      onSaved(j.pedido);
    } catch (e) {
      alert('Falha: ' + e.message);
    }
  };

  const desvincular = async () => {
    if (!window.confirm('Desvincular cliente TOTVS deste pedido?')) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/wix/pedidos/${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_totvs_code: null,
          cliente_totvs_nome: null,
          cliente_totvs_doc: null,
          cliente_classificacao: null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'erro');
      onSaved(j.pedido);
    } catch (e) {
      alert('Falha: ' + e.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <User size={18} weight="duotone" className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">Vincular cliente TOTVS</h2>
            <p className="text-[12px] text-gray-500 leading-tight truncate">
              Pedido #{pedido.numero} · {pedido.buyer_nome} {pedido.buyer_sobrenome}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-700 leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/60">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gray-500 font-bold block mb-1.5">
              Código do cliente no TOTVS
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder="Ex: 51616"
                autoFocus
                className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono tabular-nums"
              />
              <button
                onClick={buscar}
                disabled={!code || buscando}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {buscando ? <ArrowsClockwise size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />}
                Buscar
              </button>
            </div>
          </div>

          {erro && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
              <XCircle size={16} weight="duotone" /> {erro}
            </div>
          )}

          {resultado && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700">Cliente encontrado</span>
                <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${(CLASSIFICACOES[resultado.classificacao] || CLASSIFICACOES.outros).bg}`}>
                  {(CLASSIFICACOES[resultado.classificacao] || CLASSIFICACOES.outros).label}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">{resultado.nome}</p>
              {resultado.fantasia && <p className="text-xs text-gray-600">{resultado.fantasia}</p>}
              <div className="flex items-center gap-3 text-[11px] text-gray-500 pt-1">
                <span className="font-mono">#{resultado.code}</span>
                {resultado.doc && <span className="font-mono">{resultado.doc}</span>}
                <span>{resultado.tipo_pessoa}</span>
                {resultado.is_inactive && (
                  <span className="text-amber-700 font-semibold">⚠ Inativo</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between gap-2">
          {pedido.cliente_totvs_code ? (
            <button
              onClick={desvincular}
              className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium"
            >
              Desvincular atual
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!resultado}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50"
            >
              Confirmar vínculo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color = 'blue' }) {
  const cores = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500' },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
  };
  const c = cores[color] || cores.blue;
  return (
    <div className="bg-white rounded-xl ring-1 ring-gray-200 p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon size={20} weight="duotone" className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${c.text} leading-tight truncate`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function DetalhesPedido({ pedido }) {
  const p = pedido;
  const formaPag = FORMA_MAP[p.forma_pagamento || ''];
  return (
    <div className="bg-gray-50/40 px-4 pl-14 py-4 border-b border-gray-100 space-y-3">
      {/* Banner de pagamento se já confirmado */}
      {p.forma_pagamento && (
        <div className={`flex items-center gap-2 ${formaPag.bg.replace('text-', 'border-').replace('-100', '-200').replace('-700', '-200')} ring-1 rounded-lg px-3 py-2 text-xs`}>
          <CheckCircle size={14} weight="fill" className="text-emerald-600" />
          <span className="font-semibold">Pago via</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] ${formaPag.bg}`}>
            {formaPag.label}
          </span>
          {p.data_pagamento && (
            <span className="text-gray-500">em {fmtDate(p.data_pagamento)}</span>
          )}
          {p.observacao_pagamento && (
            <span className="text-gray-500 italic">· {p.observacao_pagamento}</span>
          )}
        </div>
      )}
      {/* Resumo cliente + endereço */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-white rounded-lg ring-1 ring-gray-200/60 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">
            <User size={11} weight="bold" /> Cliente
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-gray-800">
              {[p.buyer_nome, p.buyer_sobrenome].filter(Boolean).join(' ') || '—'}
            </p>
            <p className="text-gray-600">{p.buyer_email || '—'}</p>
            {p.buyer_telefone && <p className="text-gray-600 font-mono">{p.buyer_telefone}</p>}
            {p.buyer_cpf && <p className="text-gray-500 font-mono">CPF: {p.buyer_cpf}</p>}
          </div>
        </div>
        {(p.ship_logradouro || p.ship_cidade) && (
          <div className="bg-white rounded-lg ring-1 ring-gray-200/60 p-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">
              Entrega
            </div>
            <div className="space-y-0.5 text-gray-700">
              <p>
                {p.ship_logradouro}{p.ship_numero ? `, ${p.ship_numero}` : ''}
              </p>
              {p.ship_complemento && <p className="text-gray-600">{p.ship_complemento}</p>}
              <p>
                {p.ship_cidade}{p.ship_uf ? ` - ${p.ship_uf}` : ''}
                {p.ship_cep ? ` · ${p.ship_cep}` : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg ring-1 ring-gray-200/60 overflow-hidden">
        <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
          Itens do pedido ({p.itens?.length || 0} produtos · {p.itens_qty} peças)
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <th className="text-left py-2 px-3 font-semibold">Produto</th>
              <th className="text-left py-2 px-3 font-semibold w-[100px]">SKU</th>
              <th className="text-right py-2 px-3 font-semibold w-[60px]">Qtd</th>
              <th className="text-right py-2 px-3 font-semibold w-[100px]">Unit.</th>
              <th className="text-right py-2 px-3 font-semibold w-[110px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {(p.itens || []).map((it) => (
              <tr key={it.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {it.imagem && (
                      <img
                        src={it.imagem}
                        alt=""
                        className="w-9 h-9 rounded object-cover shrink-0 border border-gray-200"
                        loading="lazy"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-gray-800 truncate" title={it.nome}>
                        {it.nome}
                      </div>
                      {(it.cor || it.tamanho) && (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {it.cor && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-gray-600 bg-gray-100 px-1.5 py-[1px] rounded"
                              title={`Cor: ${it.cor}`}
                            >
                              {it.cor_hex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0"
                                  style={{ backgroundColor: it.cor_hex }}
                                />
                              )}
                              {it.cor}
                            </span>
                          )}
                          {it.tamanho && (
                            <span
                              className="inline-flex items-center text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-[1px] rounded"
                              title={`Tamanho: ${it.tamanho}`}
                            >
                              {it.tamanho}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3 font-mono text-gray-500">
                  {it.sku || '—'}
                </td>
                <td className="py-2 px-3 text-right font-bold tabular-nums text-gray-800">
                  {it.quantidade}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                  R$ {fmtBRL(it.preco_unit)}
                </td>
                <td className="py-2 px-3 text-right font-bold tabular-nums text-emerald-700">
                  R$ {fmtBRL(it.preco_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50/60">
            <tr>
              <td colSpan={2} className="py-2 px-3 text-[11px] text-gray-500">
                Subtotal · Frete · Desconto · Imposto
              </td>
              <td colSpan={3} className="py-2 px-3 text-right text-[11px] text-gray-600 tabular-nums">
                R$ {fmtBRL(p.subtotal)} · R$ {fmtBRL(p.frete)} · −R$ {fmtBRL(p.desconto)} · R$ {fmtBRL(p.imposto)}
              </td>
            </tr>
            <tr className="border-t border-gray-200">
              <td colSpan={2} className="py-2 px-3 font-bold text-gray-800 uppercase text-[11px]">
                Total
              </td>
              <td colSpan={3} className="py-2 px-3 text-right text-base font-extrabold text-emerald-700 tabular-nums">
                R$ {fmtBRL(p.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
