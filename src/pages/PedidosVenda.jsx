// Página: Expedição → Pedido de Venda
// A lista é a FILA DE FATURAMENTO do Painel do Dryland
// (dryland-missao-separacao.vercel.app/frete → Painel): uma venda por card, de
// todos os canais, com pagamento (forma, NSU, autorização, Pix, Pagar.me),
// comprovantes, NF e pedido TOTVS. O pedido do site junta a SEPARAÇÃO
// (/separar: aguardando / em separação / separado) — é ela que monta o Kanban.
// Tudo copiado para o HeadCoach a cada 5 min (/api/pedidos-venda).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Kanban,
  ListBullets,
  CreditCard,
  FileText,
  User,
  Phone,
  ArrowSquareOut,
  Receipt,
  Copy,
  PresentationChart,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import PainelExpedicao from '../components/pedidosVenda/PainelExpedicao';
import { API_BASE_URL } from '../config/constants';

const fmtBRL = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtDataHora = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const hojeBR = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
const fmtDoc = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v || null;
};
const CANAIS = {
  varejo: { label: 'Varejo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  revenda: { label: 'Revenda', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  franquias: { label: 'Franquias', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  mtm: { label: 'MTM', cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
};
const SEPARACAO = {
  aguardando: { label: 'Aguardando separação', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  em_separacao: { label: 'Em separação', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  separado: { label: 'Separado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};
const corFat = (s) =>
  /faturad|enviado|conclu/i.test(s || '')
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : /falta|erro|bloq/i.test(s || '')
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : /^a faturar$/i.test(s || '')
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-blue-50 text-blue-700 ring-blue-200';
const COLUNAS_KANBAN = ['aguardando', 'em_separacao', 'separado'];
const inputCls = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

function Selo({ cls, children }) {
  return <span className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}
const SeloCanal = ({ canal }) => <Selo cls={CANAIS[canal]?.cls || 'bg-gray-100 text-gray-600 ring-gray-200'}>{CANAIS[canal]?.label || canal || '—'}</Selo>;
const SeloFat = ({ s }) => (s ? <Selo cls={corFat(s)}>{s}</Selo> : <Selo cls="bg-gray-100 text-gray-500 ring-gray-200">sem card na fila</Selo>);
const SeloSep = ({ s }) => (s ? <Selo cls={SEPARACAO[s]?.cls}>{SEPARACAO[s]?.label}</Selo> : null);

function Progresso({ sep }) {
  if (!sep) return <span className="text-[11px] text-gray-400">—</span>;
  const pct = sep.qtd_pecas ? Math.round((100 * sep.qtd_separada) / sep.qtd_pecas) : 0;
  return (
    <div className="min-w-[70px]">
      <div className="text-[11px] tabular-nums text-gray-600">
        <b className="text-[#000638]">{fmtNum(sep.qtd_separada)}</b>/{fmtNum(sep.qtd_pecas)} pç
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

function Linha({ rotulo, children }) {
  if (children == null || children === '' || children === false) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-0.5 text-xs">
      <span className="text-gray-500 shrink-0">{rotulo}</span>
      <span className="text-right font-medium text-[#000638] break-all">{children}</span>
    </div>
  );
}

function Bloco({ titulo, icone: Icone, children }) {
  return (
    <div className="rounded-xl ring-1 ring-gray-200 p-3">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        {Icone && <Icone size={12} weight="bold" />} {titulo}
      </p>
      {children}
    </div>
  );
}

// Cartão do pedido (celular e Kanban)
const podeFaturar = (p) => p?.separacao?.status === 'separado';

// Selo da transação gerada na tela Faturamento
const SeloFaturado = ({ f }) =>
  f ? (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200" title={`Faturado no HeadCoach em ${fmtDataHora(f.em)}`}>
      {f.nf ? `NF ${f.nf}` : `tx ${f.transacao}`}
      {!f.nf && f.status === 4 ? ' · atendida' : ''}
    </span>
  ) : null;

function BotaoFaturar({ p, onFaturar, pequeno = false }) {
  if (!podeFaturar(p)) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onFaturar(p);
      }}
      className={`${pequeno ? 'px-2 py-0.5' : 'h-8 px-3'} rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]`}
    >
      FATURAR
    </button>
  );
}

function CartaoPedido({ p, onDetalhar, onFaturar, noKanban = false }) {
  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold text-[#000638] truncate">{p.numero_site || p.transacao || p.pedido_totvs || '—'}</span>
        <SeloCanal canal={p.canal} />
      </div>
      <p className="mt-1 text-sm font-semibold text-gray-800 truncate">{p.cliente || p.titulo || '—'}</p>
      <p className="text-[11px] text-gray-500 truncate">
        {fmtDataHora(p.criado_em)} · {p.vendedor || 'sem vendedor'}
        {p.forma_pagamento ? ` · ${p.forma_pagamento}` : ''}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        {noKanban ? <SeloFat s={p.status_fat} /> : <SeloSep s={p.separacao?.status} />}
        <Progresso sep={p.separacao} />
        <span className="text-sm font-bold text-[#000638] tabular-nums">{fmtBRL(p.valor)}</span>
      </div>
      {!noKanban && (
        <div className="mt-1">
          <SeloFat s={p.status_fat} />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-400 truncate">
          {p.comprovantes > 0 ? `🧾 ${p.comprovantes} comprovante(s)` : 'sem comprovante'}
          {p.nf_numero ? ` · NF ${p.nf_numero}` : ''}
        </span>
        <SeloFaturado f={p.faturamento} />
        <div className="flex items-center gap-1.5 shrink-0">
          <BotaoFaturar p={p} onFaturar={onFaturar} />
          <button
            type="button"
            onClick={() => onDetalhar(p)}
            className="h-8 px-3 rounded-lg text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90 active:scale-[0.98]"
          >
            Detalhar
          </button>
        </div>
      </div>
    </div>
  );
}

const PedidosVenda = () => {
  const [visao, setVisao] = useState(() => {
    try {
      return localStorage.getItem('pedidos_venda_visao') || 'lista';
    } catch {
      return 'lista';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('pedidos_venda_visao', visao);
    } catch {
      /* sem armazenamento */
    }
  }, [visao]);
  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [statusFatOpcoes, setStatusFatOpcoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [canal, setCanal] = useState('');
  const [statusFat, setStatusFat] = useState('');
  const [separacao, setSeparacao] = useState('');
  const [transferencias, setTransferencias] = useState(false);
  const [de, setDe] = useState(() => new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hojeBR());
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState(null); // { linha, dados }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const qs = new URLSearchParams();
      if (canal) qs.set('canal', canal);
      if (statusFat) qs.set('status', statusFat);
      if (separacao) qs.set('separacao', separacao);
      if (transferencias) qs.set('transferencias', '1');
      if (de) qs.set('de', de);
      if (ate) qs.set('ate', ate);
      if (busca.trim()) qs.set('busca', busca.trim());
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao carregar os pedidos');
      setItems(j.data.items || []);
      setResumo(j.data.resumo || null);
      setStatusFatOpcoes(j.data.statusFat || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [canal, statusFat, separacao, transferencias, de, ate, busca]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal, statusFat, separacao, transferencias, de, ate]);

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

  const navigate = useNavigate();
  const faturar = (linha) => navigate(`/expedicao/faturamento?chave=${encodeURIComponent(linha.chave)}`);

  const abrir = async (linha) => {
    setDetalhe({ linha, dados: null });
    try {
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/${encodeURIComponent(linha.chave)}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir o pedido');
      setDetalhe({ linha, dados: j.data });
    } catch (e) {
      setErro(e.message);
      setDetalhe(null);
    }
  };

  const porColuna = useMemo(() => {
    const m = { aguardando: [], em_separacao: [], separado: [] };
    for (const p of items) if (p.separacao && m[p.separacao.status]) m[p.separacao.status].push(p);
    return m;
  }, [items]);
  const foraDoKanban = items.filter((p) => !p.separacao).length;

  const copiar = (t) => navigator.clipboard?.writeText(String(t));

  // ── detalhe ──
  const D = detalhe?.dados;
  const card = D?.card;
  const dd = card?.dados || {};
  const sep = D?.separacao;
  const pi = sep?.pagamento_info || dd.pago_info || {};
  const bol = dd.boleto_faturado && typeof dd.boleto_faturado === 'object' ? dd.boleto_faturado : null;
  const fmtData = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : null);
  const pecas = useMemo(() => {
    if (D?.itens?.length) {
      return [...D.itens]
        .sort((a, b) => (a.separado >= a.qtd) - (b.separado >= b.qtd) || String(a.descricao).localeCompare(String(b.descricao)))
        .map((i) => ({ key: i.dryland_id, descricao: i.descricao, cor: i.cor, tam: i.tamanho, cod: i.cod, qtd: i.qtd, separado: i.separado, preco: i.preco, estoque: i.estoque, totvs: i.totvs }));
    }
    return (Array.isArray(dd.itens) ? dd.itens : []).map((i, k) => ({ key: k, descricao: i.descricao, cor: i.cor, tam: i.tam, cod: i.cod, qtd: i.qtd, separado: null, preco: i.preco }));
  }, [D, dd.itens]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-2 sm:p-3 lg:p-4">
      <div className="max-w-7xl mx-auto">
        <PageTitle
          title="Pedido de Venda"
          subtitle="Vendas da fila de faturamento do Dryland (todos os canais) com pagamento, comprovantes, NF e a separação dos pedidos do site"
          icon={ShoppingBag}
        />

        {resumo && visao !== 'painel' && (
          <div className="mb-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
            <Card label="Vendas" valor={fmtNum(resumo.pedidos)} />
            <Card label="Valor" valor={fmtBRL(resumo.valor)} />
            <Card label="A faturar" valor={fmtNum(resumo.aFaturar)} cor="text-amber-700" />
            <Card label="Faturadas" valor={fmtNum(resumo.faturados)} cor="text-emerald-700" sub="faturado / enviado" />
            <Card label="Aguardando separação" valor={fmtNum(resumo.aguardando)} cor="text-amber-700" />
            <Card label="Em separação" valor={fmtNum(resumo.emSeparacao)} cor="text-blue-700" />
            <Card label="Separados" valor={fmtNum(resumo.separados)} cor="text-emerald-700" />
            <Card label="Com comprovante" valor={fmtNum(resumo.comComprovante)} />
          </div>
        )}

        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-3 flex flex-wrap items-end gap-2">
          {visao !== 'painel' && (
          <>
          <div className="relative w-full sm:w-72">
            <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregar()}
              placeholder="Pedido, cliente, vendedor, TOTVS, NF, NSU…"
              className={`${inputCls} pl-8 w-full`}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Canal</label>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {Object.entries(CANAIS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Faturamento</label>
            <select value={statusFat} onChange={(e) => setStatusFat(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {statusFatOpcoes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Separação</label>
            <select value={separacao} onChange={(e) => setSeparacao(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {Object.entries(SEPARACAO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
              <option value="sem">Sem separação</option>
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
          </>
          )}
          <div className="flex-1" />
          <div className="inline-flex rounded-lg ring-1 ring-gray-200 p-0.5 bg-white">
            {[
              { id: 'lista', label: 'Lista', icon: ListBullets },
              { id: 'kanban', label: 'Kanban', icon: Kanban },
              { id: 'painel', label: 'Painel', icon: PresentationChart },
            ].map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVisao(v.id)}
                  className={`h-8 px-2.5 rounded-md text-xs font-bold inline-flex items-center gap-1 ${visao === v.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'}`}
                >
                  <Icon size={14} weight="bold" /> {v.label}
                </button>
              );
            })}
          </div>
          {visao !== 'painel' && (
          <button
            onClick={sincronizar}
            disabled={sincronizando}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            title="Copia agora a fila e a separação do Dryland (a cópia automática roda a cada 5 min)"
          >
            <ArrowsClockwise size={14} className={sincronizando || loading ? 'animate-spin' : ''} /> Atualizar do Dryland
          </button>
          )}
        </div>

        {erro && (
          <p className="mb-2 text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-2 ring-1 ring-rose-200 inline-flex items-center gap-1.5">
            <Warning size={14} weight="bold" /> {erro}
          </p>
        )}
        {aviso && (
          <p className="mb-2 ml-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 ring-1 ring-emerald-200 inline-flex items-center gap-1.5">
            <CheckCircle size={14} weight="bold" /> {aviso}
          </p>
        )}

        {visao === 'painel' && <PainelExpedicao />}

        {/* Kanban da separação */}
        {visao === 'kanban' && (
          <>
            {foraDoKanban > 0 && (
              <p className="mb-2 text-[11px] text-gray-500">
                {fmtNum(foraDoKanban)} venda(s) sem separação (vendedor, showroom…) não entram no Kanban — veja na Lista.
              </p>
            )}
            <div className="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto snap-x snap-mandatory pb-2">
              {COLUNAS_KANBAN.map((col) => (
                <div key={col} className="snap-start shrink-0 w-[85vw] md:w-auto rounded-xl bg-gray-200/60 p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <SeloSep s={col} />
                    <span className="text-xs font-bold text-gray-600 tabular-nums">
                      {fmtNum(porColuna[col].length)} · {fmtBRL(porColuna[col].reduce((s, p) => s + Number(p.valor || 0), 0))}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-0.5">
                    {porColuna[col].length === 0 && <p className="py-6 text-center text-xs text-gray-400">Nenhum pedido.</p>}
                    {porColuna[col].map((p) => (
                      <CartaoPedido key={p.chave} p={p} onDetalhar={abrir} onFaturar={faturar} noKanban />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Lista — celular: cartões */}
        <div className={`md:hidden space-y-2 ${visao !== 'lista' ? 'hidden' : ''}`}>
          {loading && items.length === 0 && (
            <div className="py-10 text-center text-gray-400">
              <Spinner size={20} className="animate-spin mx-auto" />
            </div>
          )}
          {!loading && items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhuma venda no período.</p>}
          {items.map((p) => (
            <CartaoPedido key={p.chave} p={p} onDetalhar={abrir} onFaturar={faturar} />
          ))}
        </div>

        {/* Lista — computador: tabela */}
        <div className={`hidden ${visao === 'lista' ? 'md:block' : ''} bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`}>
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
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-left">Separação</th>
                  <th className="px-2 py-2 text-left">Faturamento</th>
                  <th className="px-2 py-2 text-center">🧾</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && items.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-gray-400">
                      <Spinner size={20} className="animate-spin mx-auto" />
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-gray-400">
                      <Package size={26} className="mx-auto mb-1.5 text-gray-300" />
                      Nenhuma venda no período.
                    </td>
                  </tr>
                )}
                {items.map((p) => (
                  <tr key={p.chave} onClick={() => abrir(p)} className={`hover:bg-gray-50/80 cursor-pointer ${p.sumiu_do_dryland_em ? 'opacity-70' : ''}`}>
                    <td className="px-2 py-1.5">
                      <p className="font-mono font-bold text-[#000638]">{p.numero_site || '—'}</p>
                      <p className="text-[10px] text-gray-400">
                        {p.transacao ? `tx ${p.transacao}` : p.pedido_totvs ? `TOTVS ${p.pedido_totvs}` : ''}
                        {p.nf_numero ? ` · NF ${p.nf_numero}` : ''}
                      </p>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(p.criado_em)}</td>
                    <td className="px-2 py-1.5">
                      <SeloCanal canal={p.canal} />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-[#000638] truncate max-w-[220px]" title={p.titulo}>
                      {p.cliente || p.titulo || '—'}
                    </td>
                    <td className="px-2 py-1.5 truncate max-w-[140px]">{p.vendedor || '—'}</td>
                    <td className="px-2 py-1.5">
                      <p className="truncate max-w-[140px]">{p.forma_pagamento || '—'}</p>
                      {p.nsu && <p className="text-[10px] text-gray-400">NSU {p.nsu}</p>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(p.valor)}</td>
                    <td className="px-2 py-1.5">
                      {p.separacao ? (
                        <div className="space-y-0.5">
                          <SeloSep s={p.separacao.status} />
                          <Progresso sep={p.separacao} />
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <SeloFat s={p.status_fat} />
                      {p.faturamento && (
                        <div className="mt-0.5">
                          <SeloFaturado f={p.faturamento} />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{p.comprovantes || '—'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <BotaoFaturar p={p} onFaturar={faturar} pequeno />
                      </span>{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrir(p);
                        }}
                        className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90"
                      >
                        Detalhar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ───────── Detalhe ───────── */}
        {detalhe && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => setDetalhe(null)}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-4xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#000638]">{detalhe.linha.titulo || detalhe.linha.cliente}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <SeloCanal canal={detalhe.linha.canal} />
                    <SeloFat s={detalhe.linha.status_fat} />
                    <SeloSep s={detalhe.linha.separacao?.status} />
                    <SeloFaturado f={detalhe.linha.faturamento} />
                    <BotaoFaturar p={detalhe.linha} onFaturar={faturar} />
                  </div>
                </div>
                <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={18} weight="bold" />
                </button>
              </div>

              {!D ? (
                <div className="py-10 text-center text-gray-400">
                  <Spinner size={20} className="animate-spin mx-auto" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                    <Bloco titulo="Cliente" icone={User}>
                      <Linha rotulo="Nome">{dd.nome_cliente || sep?.cliente}</Linha>
                      <Linha rotulo="Código">{dd.codigo_cliente}</Linha>
                      <Linha rotulo="CPF/CNPJ">{fmtDoc(dd.cnpj_cliente || dd.doc || sep?.cliente_doc)}</Linha>
                      <Linha rotulo="Tipo">{[dd.tipo_cliente, dd.pf_pj].filter(Boolean).join(' · ') || null}</Linha>
                      <Linha rotulo="Telefone">
                        {(dd.telefone || dd.whats_cliente || sep?.cliente_telefone) && (
                          <a
                            href={`https://wa.me/${String(dd.whats_cliente || `55${dd.telefone || sep?.cliente_telefone}`).replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                          >
                            <Phone size={11} /> {dd.telefone || dd.whats_cliente || sep?.cliente_telefone}
                          </a>
                        )}
                      </Linha>
                      <Linha rotulo="Entrega">{[dd.forma_envio, dd.transportadora].filter(Boolean).join(' · ') || null}</Linha>
                      <Linha rotulo="Endereço">{[dd.endereco, dd.cep, dd.estado].filter(Boolean).join(' · ') || null}</Linha>
                    </Bloco>

                    <Bloco titulo="Venda" icone={Receipt}>
                      <Linha rotulo="Pedido do site">{dd.numero_pedido_site || sep?.ref}</Linha>
                      <Linha rotulo="Vendedor">{dd.vendedor || sep?.vendedor_nome}</Linha>
                      <Linha rotulo="Cód. vendedor">{dd.cod_vendedor || dd.cod_auxiliar || sep?.vendedor_code}</Linha>
                      <Linha rotulo="Loja">{dd.loja || dd.loja_retirada}</Linha>
                      <Linha rotulo="Criado em">{fmtDataHora(card?.criado_em || sep?.criado_em)}</Linha>
                      <Linha rotulo="Criado por">{card?.criado_por}</Linha>
                      <Linha rotulo="Pedido TOTVS">{dd.pedido_totvs || (sep?.totvs_pedidos || []).join(', ') || null}</Linha>
                      <Linha rotulo="Transação">{dd.transacao}</Linha>
                      <Linha rotulo="Nota fiscal">{dd.nf_numero ? `${dd.nf_numero}${dd.nf_serie ? `/${dd.nf_serie}` : ''}` : null}</Linha>
                      {dd.nf_chave && (
                        <Linha rotulo="Chave NF">
                          <button type="button" onClick={() => copiar(dd.nf_chave)} className="inline-flex items-center gap-1 hover:underline" title="Copiar">
                            <Copy size={11} /> {dd.nf_chave.slice(0, 12)}…
                          </button>
                        </Linha>
                      )}
                      <Linha rotulo="Separado em">{sep?.separado_em ? fmtDataHora(sep.separado_em) : null}</Linha>
                    </Bloco>

                    <Bloco titulo="Pagamento" icone={CreditCard}>
                      <Linha rotulo="Forma">{dd.forma_pagamento || sep?.pagamento}</Linha>
                      <Linha rotulo="Parcelamento">
                        {(() => {
                          const n = parseInt(String(dd.parcelamento || pi.parcelas || '').replace(/\D/g, ''), 10);
                          return n > 1 ? `${n}x` : null;
                        })()}
                      </Linha>
                      <Linha rotulo="Valor do pedido">{fmtBRL(card?.valor_pedido ?? sep?.valor_total)}</Linha>
                      <Linha rotulo="Valor cheio">{dd.valor_cheio != null ? fmtBRL(dd.valor_cheio) : null}</Linha>
                      <Linha rotulo="Desconto">{Number(dd.desconto) > 0 ? fmtBRL(dd.desconto) : null}</Linha>
                      <Linha rotulo="Desconto Pix">{Number(dd.desconto_pix) > 0 ? fmtBRL(dd.desconto_pix) : null}</Linha>
                      <Linha rotulo="Frete">{Number(dd.valor_frete) > 0 ? fmtBRL(dd.valor_frete) : null}</Linha>
                      <Linha rotulo="Credev">{dd.credev && !/^n(ã|a)o$/i.test(dd.credev) ? dd.credev : null}</Linha>
                      <Linha rotulo="NSU">{card?.cartao_nsu || pi.nsu}</Linha>
                      <Linha rotulo="Autorização">{card?.cartao_autorizacao || pi.autorizacao}</Linha>
                      <Linha rotulo="Cartão">
                        {card?.cartao_bandeira || pi.bandeira
                          ? `${card?.cartao_bandeira || pi.bandeira}${card?.cartao_final || pi.cartao_final ? ` final ${card?.cartao_final || pi.cartao_final}` : ''}`
                          : null}
                      </Linha>
                      <Linha rotulo="Pix (end-to-end)">{card?.pix_e2e || pi.end_to_end_id}</Linha>
                      <Linha rotulo="Cobrança Pagar.me">{card?.pagarme_charge || pi.charge_id}</Linha>
                      {bol && (
                        <div className="mt-1 border-t border-gray-100 pt-1">
                          <Linha rotulo="Boleto">{[bol.forma, bol.condicao && `${bol.condicao} dias`].filter(Boolean).join(' · ') || 'faturado'}</Linha>
                          <Linha rotulo="Parcelas">{bol.parcelas ? `${bol.parcelas}x de ${fmtBRL(bol.valor_parcela)}` : null}</Linha>
                          <Linha rotulo="Vencimentos">{(bol.vencimentos || []).map(fmtData).filter(Boolean).join(', ') || null}</Linha>
                          <Linha rotulo="Valor faturado">{bol.valor != null ? fmtBRL(bol.valor) : null}</Linha>
                          <Linha rotulo="Faturado por">{bol.por ? `${bol.por}${bol.em ? ` em ${fmtDataHora(bol.em)}` : ''}` : null}</Linha>
                        </div>
                      )}
                      {(dd.duplicata_link || dd.duplicata_assinada_url) && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {dd.duplicata_assinada_url ? (
                            <a href={dd.duplicata_assinada_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline">
                              <FileText size={12} /> duplicata assinada{dd.duplicata_assinada_em ? ` (${fmtData(dd.duplicata_assinada_em)})` : ''} <ArrowSquareOut size={10} />
                            </a>
                          ) : (
                            <a href={dd.duplicata_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline">
                              <FileText size={12} /> duplicata para assinar (ainda não assinada) <ArrowSquareOut size={10} />
                            </a>
                          )}
                        </div>
                      )}
                      {dd.pagamento_detalhe && <p className="mt-1 text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1">{dd.pagamento_detalhe}</p>}
                    </Bloco>
                  </div>

                  {/* Comprovantes do Dryland */}
                  <Bloco titulo={`Comprovante de pagamento (${(card?.comprovantes_url || []).length})`} icone={FileText}>
                    {(card?.comprovantes_url || []).length === 0 ? (
                      <p className="text-[11px] text-gray-400">O Dryland não tem comprovante desta venda.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {card.comprovantes_url.map((c, i) => {
                          const img = /\.(png|jpe?g|webp|gif)$/i.test(c.path);
                          return (
                            <a key={c.path} href={c.url} target="_blank" rel="noreferrer" className="block rounded-lg ring-1 ring-gray-200 overflow-hidden bg-gray-50 hover:ring-[#000638]" title="Abrir em tamanho real">
                              {img ? (
                                <img src={c.url} alt={`Comprovante ${i + 1}`} className="w-full max-h-[60vh] object-contain bg-white" loading="lazy" />
                              ) : (
                                <span className="flex h-24 items-center justify-center gap-2 text-sm font-semibold text-[#000638]">
                                  <FileText size={22} /> abrir comprovante {i + 1} (PDF)
                                </span>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </Bloco>

                  {dd.obs && <p className="mt-2 text-[11px] text-gray-600 bg-amber-50 rounded-xl ring-1 ring-amber-200 px-3 py-2">{dd.obs}</p>}

                  {/* Peças */}
                  <p className="mt-3 mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Peças ({fmtNum(pecas.reduce((s, i) => s + Number(i.qtd || 0), 0))}){D.itens?.length ? ' · da separação' : ''}
                  </p>
                  {pecas.length === 0 ? (
                    <p className="text-xs text-gray-400">Sem lista de peças no Dryland para esta venda.</p>
                  ) : (
                    <div className="rounded-xl ring-1 ring-gray-200 divide-y divide-gray-100">
                      {pecas.map((i) => {
                        const ok = i.separado == null || i.separado >= i.qtd;
                        return (
                          <div key={i.key} className={`flex items-start gap-2 px-3 py-2 ${ok ? '' : 'bg-amber-50/40'}`}>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-[#000638] leading-tight">{i.descricao}</p>
                              <p className="text-[11px] text-gray-500">
                                {[i.cor, i.tam && `tam. ${i.tam}`, i.cod && `cód. ${i.cod}`, i.estoque && `estoque ${i.estoque}`].filter(Boolean).join(' · ')}
                                {i.totvs ? ` · TOTVS ${i.totvs}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {i.separado != null ? (
                                <p className={`text-xs font-bold tabular-nums ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {ok ? <CheckCircle size={12} weight="fill" className="inline -mt-0.5 mr-0.5" /> : <Clock size={12} className="inline -mt-0.5 mr-0.5" />}
                                  {i.separado}/{i.qtd}
                                </p>
                              ) : (
                                <p className="text-xs font-bold tabular-nums text-[#000638]">{i.qtd} un.</p>
                              )}
                              <p className="text-[11px] text-gray-500 tabular-nums">{i.preco != null ? fmtBRL(Number(i.preco) * Number(i.qtd || 0)) : '—'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {card?.titulo && (
                    <p className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                      <ArrowSquareOut size={10} /> card da fila de faturamento do Dryland: {card.titulo}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PedidosVenda;
