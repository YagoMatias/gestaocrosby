// Página: Expedição Brejinho → Pedidos
// Pedidos das franquias controlados no Dryland (dryland-missao-separacao.vercel.app/brejinho),
// lidos ao vivo (/api/brejinho, cache de 60 s). Status: aguardando cliente ·
// em separação · aguardando pagamento · pendência financeira · faturado · cancelado.
// Cada card é uma remessa de um pedido do showroom (nº do pedido de venda do
// TOTVS, filial 99); as peças vêm da transação TOTVS do card.
// "Aguardando pagamento" tem FATURAR → /expedicao/brejinho/faturamento.
// Só leitura: mudar status e campos continua no Dryland.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Storefront,
  ArrowsClockwise,
  Spinner,
  MagnifyingGlass,
  X,
  Warning,
  Kanban,
  ListBullets,
  ArrowSquareOut,
  Package,
  Receipt,
  Truck,
  ClockCounterClockwise,
  CreditCard,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';

const DRYLAND_BREJINHO = 'https://dryland-missao-separacao.vercel.app/brejinho';
const fmtBRL = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtData = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
const fmtDataHora = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const inputCls = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

const STATUS = {
  'aguardando cliente': { label: 'Aguardando cliente', cls: 'bg-gray-100 text-gray-700 ring-gray-300', cor: 'text-gray-700' },
  'em separação': { label: 'Em separação', cls: 'bg-blue-50 text-blue-700 ring-blue-200', cor: 'text-blue-700' },
  'aguardando pagamento': { label: 'Aguardando pagamento', cls: 'bg-amber-50 text-amber-700 ring-amber-200', cor: 'text-amber-700' },
  'pendência financeira': { label: 'Pendência financeira', cls: 'bg-rose-50 text-rose-700 ring-rose-200', cor: 'text-rose-700' },
  faturado: { label: 'Faturado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', cor: 'text-emerald-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500 ring-gray-200', cor: 'text-gray-500' },
};
const ORDEM = Object.keys(STATUS);
// faturado e cancelado têm milhares: o Kanban mostra só os últimos (igual ao Dryland)
const HISTORICO = ['faturado', 'cancelado'];
const HIST_N = 12;
const TX_STATUS = { 1: 'em andamento', 2: 'encerrada', 4: 'atendida', 6: 'cancelada' };

function Selo({ cls, children, title }) {
  return (
    <span title={title} className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}
const SeloStatus = ({ s }) => <Selo cls={STATUS[s]?.cls || 'bg-gray-100 text-gray-600 ring-gray-200'}>{STATUS[s]?.label || s || '—'}</Selo>;
const SeloFaturado = ({ f }) =>
  f ? (
    <Selo cls="bg-emerald-50 text-emerald-700 ring-emerald-200" title={`Faturado no HeadCoach em ${fmtDataHora(f.em)}`}>
      {f.nf ? `NF ${f.nf}` : `tx ${f.transacao}`}
    </Selo>
  ) : null;

function Card({ label, valor, cor = 'text-[#000638]', sub, ativo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-xl border shadow-sm p-2.5 sm:p-3 transition ${ativo ? 'border-[#000638] ring-2 ring-[#000638]/20' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className={`text-base sm:text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
    </button>
  );
}

function Linha({ rotulo, children }) {
  if (children == null || children === '' || children === false) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-0.5 text-xs">
      <span className="text-gray-500 shrink-0">{rotulo}</span>
      <span className="text-right font-medium text-[#000638] break-words">{children}</span>
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

const podeFaturar = (p) => p?.status === 'aguardando pagamento';

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
        <span className="font-mono text-xs font-bold text-[#000638] truncate">
          {p.pedido ? `Pedido ${p.pedido}` : `#${p.id}`}
          {p.transacao ? <span className="font-normal text-gray-400"> · tx {p.transacao}</span> : null}
        </span>
        {!noKanban && <SeloStatus s={p.status} />}
      </div>
      <p className="mt-1 text-sm font-semibold text-gray-800 truncate">{p.cliente || '—'}</p>
      <p className="text-[11px] text-gray-500 truncate">
        {fmtData(p.data_transacao || p.criado_em)}
        {p.uf ? ` · ${p.uf}` : ''}
        {p.showroom ? ` · ${p.showroom}` : ''}
        {p.cond_pagamento ? ` · ${p.cond_pagamento}${p.parcelas ? ` ${p.parcelas}x` : ''}` : ''}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[11px] text-gray-500 tabular-nums">
          {fmtNum(p.qtd_pecas)} pç{p.nota_fiscal ? ` · NF ${p.nota_fiscal}` : ''}
        </span>
        <span className="text-sm font-bold text-[#000638] tabular-nums">{fmtBRL(p.valor)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <SeloFaturado f={p.faturamento} />
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
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

const BrejinhoPedidos = () => {
  const navigate = useNavigate();
  const [visao, setVisao] = useState(() => {
    try {
      return localStorage.getItem('brejinho_pedidos_visao') || 'kanban';
    } catch {
      return 'kanban';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('brejinho_pedidos_visao', visao);
    } catch {
      /* sem armazenamento */
    }
  }, [visao]);

  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [filtros, setFiltros] = useState({ uf: [], showroom: [] });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [status, setStatus] = useState('__abertos');
  const [uf, setUf] = useState('');
  const [showroom, setShowroom] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [arquivados, setArquivados] = useState(false);
  const [detalhe, setDetalhe] = useState(null); // { linha, dados, erro }

  const carregar = useCallback(
    async (forcar = false) => {
      setLoading(true);
      setErro(null);
      try {
        const qs = new URLSearchParams();
        // o Kanban mostra todas as colunas; a lista respeita o filtro de status
        if (visao === 'lista' && status) qs.set('status', status);
        if (uf) qs.set('uf', uf);
        if (showroom) qs.set('showroom', showroom);
        if (de) qs.set('de', de);
        if (ate) qs.set('ate', ate);
        if (busca.trim()) qs.set('busca', busca.trim());
        if (arquivados) qs.set('arquivados', '1');
        if (forcar) qs.set('forcar', '1');
        const r = await fetch(`${API_BASE_URL}/api/brejinho?${qs}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao carregar os pedidos do Brejinho');
        setItems(j.data.items || []);
        setResumo(j.data.resumo || null);
        setFiltros(j.data.filtros || { uf: [], showroom: [] });
      } catch (e) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    },
    [visao, status, uf, showroom, de, ate, busca, arquivados],
  );

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, status, uf, showroom, de, ate, arquivados]);

  const faturar = (p) => navigate(`/expedicao/brejinho/faturamento?chave=${encodeURIComponent(p.chave)}`);

  const abrir = async (p) => {
    setDetalhe({ linha: p, dados: null, erro: null });
    try {
      const r = await fetch(`${API_BASE_URL}/api/brejinho/${p.id}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir o pedido');
      setDetalhe({ linha: p, dados: j.data, erro: null });
    } catch (e) {
      setDetalhe({ linha: p, dados: null, erro: e.message });
    }
  };

  const porColuna = useMemo(() => {
    const m = Object.fromEntries(ORDEM.map((s) => [s, []]));
    for (const p of items) if (m[p.status]) m[p.status].push(p);
    return m;
  }, [items]);

  const D = detalhe?.dados;
  const ped = D?.pedido || detalhe?.linha;
  const tx = D?.transacao;
  const somaTx = (tx?.itens || []).reduce((s, i) => s + i.total, 0);

  const cartoesResumo = resumo
    ? [
        { s: '__abertos', label: 'Em aberto', valor: fmtNum(resumo.abertos), sub: fmtBRL(resumo.valorAberto) },
        ...ORDEM.map((s) => ({ s, label: STATUS[s].label, valor: fmtNum(resumo.porStatus?.[s]?.n), sub: fmtBRL(resumo.porStatus?.[s]?.valor), cor: STATUS[s].cor })),
      ]
    : [];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-2 sm:p-3 lg:p-4">
      <div className="max-w-7xl mx-auto">
        <PageTitle
          title="Pedidos — Expedição Brejinho"
          subtitle="Pedidos das franquias do Dryland (Brejinho): remessas dos pedidos do showroom, do aguardando cliente ao faturado"
          icon={Storefront}
        />

        {resumo && (
          <div className="mb-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
            {cartoesResumo.map((c) => (
              <Card
                key={c.s}
                label={c.label}
                valor={c.valor}
                sub={c.sub}
                cor={c.cor}
                ativo={visao === 'lista' && status === c.s}
                onClick={() => {
                  setStatus(c.s);
                  setVisao('lista');
                }}
              />
            ))}
          </div>
        )}

        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-3 flex flex-wrap items-end gap-2">
          <div className="relative w-full sm:w-72">
            <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregar()}
              placeholder="Pedido, franquia, transação, NF…"
              className={`${inputCls} pl-8 w-full`}
            />
          </div>
          {visao === 'lista' && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                <option value="">Todos</option>
                <option value="__abertos">— tudo em aberto</option>
                {ORDEM.map((s) => (
                  <option key={s} value={s}>
                    {STATUS[s].label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">UF</label>
            <select value={uf} onChange={(e) => setUf(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {filtros.uf.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Showroom</label>
            <select value={showroom} onChange={(e) => setShowroom(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {filtros.showroom.map((s) => (
                <option key={s} value={s}>
                  {s}
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
            <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} className="w-4 h-4 p-0 mb-0" />
            ver arquivados
          </label>
          <div className="flex-1" />
          <div className="inline-flex rounded-lg ring-1 ring-gray-200 p-0.5 bg-white">
            {[
              { id: 'kanban', label: 'Kanban', icon: Kanban },
              { id: 'lista', label: 'Lista', icon: ListBullets },
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
          <button
            onClick={() => carregar(true)}
            disabled={loading}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            title="Lê de novo do Dryland agora"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} /> Atualizar do Dryland
          </button>
          <a
            href={DRYLAND_BREJINHO}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center gap-1.5"
            title="Mudar status e campos continua no Dryland"
          >
            <ArrowSquareOut size={14} /> Abrir no Dryland
          </a>
        </div>

        {erro && (
          <p className="mb-2 text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-2 ring-1 ring-rose-200 inline-flex items-center gap-1.5">
            <Warning size={14} weight="bold" /> {erro}
          </p>
        )}

        {/* Kanban por status */}
        {visao === 'kanban' && (
          <div className="flex xl:grid xl:grid-cols-6 gap-2 overflow-x-auto snap-x snap-mandatory pb-2">
            {ORDEM.map((col) => {
              const lista = porColuna[col] || [];
              const hist = HISTORICO.includes(col);
              const mostrados = hist ? lista.slice(0, HIST_N) : lista;
              return (
                <div key={col} className="snap-start shrink-0 w-[85vw] sm:w-[48vw] md:w-[32vw] xl:w-auto rounded-xl bg-gray-200/60 p-2">
                  <div className="mb-2 flex items-center justify-between gap-1 px-1">
                    <SeloStatus s={col} />
                    <span className="text-[11px] font-bold text-gray-600 tabular-nums text-right">
                      {fmtNum(lista.length)} · {fmtBRL(lista.reduce((s, p) => s + Number(p.valor || 0), 0))}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-0.5">
                    {loading && lista.length === 0 && (
                      <div className="py-6 text-center text-gray-400">
                        <Spinner size={18} className="animate-spin mx-auto" />
                      </div>
                    )}
                    {!loading && lista.length === 0 && <p className="py-6 text-center text-xs text-gray-400">Nenhum pedido.</p>}
                    {mostrados.map((p) => (
                      <CartaoPedido key={p.chave} p={p} onDetalhar={abrir} onFaturar={faturar} noKanban />
                    ))}
                    {hist && lista.length > HIST_N && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatus(col);
                          setVisao('lista');
                        }}
                        className="w-full py-2 text-[11px] font-semibold text-[#000638] hover:underline"
                      >
                        + {fmtNum(lista.length - HIST_N)} no histórico — ver na Lista
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lista — celular: cartões */}
        <div className={`md:hidden space-y-2 ${visao !== 'lista' ? 'hidden' : ''}`}>
          {loading && items.length === 0 && (
            <div className="py-10 text-center text-gray-400">
              <Spinner size={20} className="animate-spin mx-auto" />
            </div>
          )}
          {!loading && items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum pedido.</p>}
          {items.map((p) => (
            <CartaoPedido key={p.chave} p={p} onDetalhar={abrir} onFaturar={faturar} />
          ))}
        </div>

        {/* Lista — PC: tabela */}
        <div className={`hidden ${visao === 'lista' ? 'md:block' : ''} bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Pedido</th>
                  <th className="px-2 py-2 text-left">Franquia</th>
                  <th className="px-2 py-2 text-left">Data</th>
                  <th className="px-2 py-2 text-left">UF / destino</th>
                  <th className="px-2 py-2 text-left">Showroom</th>
                  <th className="px-2 py-2 text-left">Pagamento</th>
                  <th className="px-2 py-2 text-right">Peças</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-left">Transação / NF</th>
                  <th className="px-2 py-2 text-left">Status</th>
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
                      Nenhum pedido com esse filtro.
                    </td>
                  </tr>
                )}
                {items.map((p) => (
                  <tr key={p.chave} className={`hover:bg-gray-50/60 ${p.status === 'cancelado' ? 'opacity-60' : ''}`}>
                    <td className="px-2 py-1.5 font-mono font-bold text-[#000638] whitespace-nowrap">{p.pedido || `#${p.id}`}</td>
                    <td className="px-2 py-1.5 truncate max-w-[220px] font-medium text-gray-800">{p.cliente || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(p.data_transacao || p.criado_em)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {p.uf || '—'}
                      {p.destino && p.destino !== p.uf ? <span className="text-gray-400"> · {p.destino}</span> : null}
                    </td>
                    <td className="px-2 py-1.5 truncate max-w-[120px]">{p.showroom || '—'}</td>
                    <td className="px-2 py-1.5 truncate max-w-[140px]">
                      {p.cond_pagamento || '—'}
                      {p.parcelas ? <span className="text-gray-400"> · {p.parcelas}x</span> : null}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(p.qtd_pecas)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(p.valor)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {p.transacao ? <span className="font-mono">tx {p.transacao}</span> : <span className="text-gray-300">—</span>}
                      {p.nota_fiscal ? <span className="text-gray-500"> · NF {p.nota_fiscal}</span> : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <SeloStatus s={p.status} />
                        <SeloFaturado f={p.faturamento} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">
                      <span className="inline-flex gap-1">
                        <BotaoFaturar p={p} onFaturar={faturar} pequeno />
                        <button onClick={() => abrir(p)} className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90">
                          Detalhar
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-5 max-h-[94vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#000638]">{ped?.pedido ? `Pedido ${ped.pedido}` : `Card #${ped?.id}`}</h3>
                  <SeloStatus s={ped?.status} />
                  <SeloFaturado f={detalhe.linha?.faturamento} />
                </div>
                <p className="text-sm font-semibold text-gray-700 truncate">{ped?.cliente}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <BotaoFaturar p={ped} onFaturar={() => faturar(detalhe.linha)} />
                <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} weight="bold" />
                </button>
              </div>
            </div>

            {detalhe.erro && <p className="mb-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200">{detalhe.erro}</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <Bloco titulo="Pedido" icone={Receipt}>
                <Linha rotulo="Nº do pedido (TOTVS)">{ped?.pedido}</Linha>
                <Linha rotulo="Showroom">{ped?.showroom}</Linha>
                <Linha rotulo="Valor">{fmtBRL(ped?.valor)}</Linha>
                <Linha rotulo="Peças">{ped?.qtd_pecas != null ? fmtNum(ped.qtd_pecas) : null}</Linha>
                <Linha rotulo="Volume">{ped?.volume}</Linha>
                <Linha rotulo="Nota fiscal">{ped?.nota_fiscal}</Linha>
                <Linha rotulo="Consultor">{ped?.consultor}</Linha>
              </Bloco>
              <Bloco titulo="Pagamento" icone={CreditCard}>
                <Linha rotulo="Condição">{ped?.cond_pagamento || '—'}</Linha>
                <Linha rotulo="Parcelas">{ped?.parcelas}</Linha>
                <Linha rotulo="Transação TOTVS">{ped?.transacao}</Linha>
                <Linha rotulo="Data da transação">{ped?.data_transacao ? fmtData(ped.data_transacao) : null}</Linha>
                {tx && <Linha rotulo="Situação no TOTVS">{TX_STATUS[tx.status] || `status ${tx.status}`}</Linha>}
              </Bloco>
              <Bloco titulo="Expedição" icone={Truck}>
                <Linha rotulo="UF">{ped?.uf}</Linha>
                <Linha rotulo="Cidade">{ped?.cidade}</Linha>
                <Linha rotulo="Destino (rota)">{ped?.destino}</Linha>
                <Linha rotulo="Frete">{ped?.frete}</Linha>
                <Linha rotulo="Criado em">{fmtDataHora(ped?.criado_em)}</Linha>
                <Linha rotulo="Atualizado">{ped?.atualizado_em ? `${fmtDataHora(ped.atualizado_em)}${ped.atualizado_por ? ` · ${ped.atualizado_por}` : ''}` : null}</Linha>
              </Bloco>
            </div>

            {(ped?.parecer_comercial || ped?.parecer_consultor || ped?.justificativa || ped?.cancel_motivo_livre) && (
              <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {ped.parecer_comercial && (
                  <Bloco titulo="Parecer comercial">
                    <p className="text-xs text-gray-700 whitespace-pre-line">{ped.parecer_comercial}</p>
                  </Bloco>
                )}
                {ped.parecer_consultor && (
                  <Bloco titulo="Parecer consultor">
                    <p className="text-xs text-gray-700 whitespace-pre-line">{ped.parecer_consultor}</p>
                  </Bloco>
                )}
                {(ped.justificativa || ped.cancel_motivo_livre) && (
                  <Bloco titulo="Motivo do cancelamento">
                    <p className="text-xs text-gray-700 whitespace-pre-line">{[ped.justificativa, ped.cancel_motivo_livre].filter(Boolean).join(' — ')}</p>
                  </Bloco>
                )}
              </div>
            )}

            {/* Peças da transação */}
            <div className="mb-3">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                <Package size={12} weight="bold" /> Peças da remessa {tx ? `· transação ${tx.code} (${fmtNum(tx.itens.reduce((s, i) => s + i.quantidade, 0))} pç · ${fmtBRL(somaTx)})` : ''}
              </p>
              {!D && !detalhe.erro ? (
                <div className="py-6 text-center text-gray-400">
                  <Spinner size={18} className="animate-spin mx-auto" />
                </div>
              ) : D?.transacaoErro ? (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-amber-200">{D.transacaoErro}</p>
              ) : !tx ? (
                <p className="text-xs text-gray-400">Card sem transação no TOTVS ainda.</p>
              ) : (
                <div className="rounded-xl ring-1 ring-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Produto</th>
                        <th className="px-2 py-1.5 text-left">Cód.</th>
                        <th className="px-2 py-1.5 text-right">Qtd</th>
                        <th className="px-2 py-1.5 text-right">Vl. unit.</th>
                        <th className="px-2 py-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tx.itens.map((i) => (
                        <tr key={i.productCode}>
                          <td className="px-2 py-1">{i.nome || `Produto ${i.productCode}`}</td>
                          <td className="px-2 py-1 font-mono text-gray-500">{i.productCode}</td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold">{i.quantidade}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(i.valorUnit - i.descontoUnit)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(i.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tx && Number(ped?.valor) > 0 && Math.abs(Number(ped.valor) - somaTx) > 0.01 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  O valor do card ({fmtBRL(ped.valor)}) é diferente da soma da transação ({fmtBRL(somaTx)}) — desconto aplicado no Dryland.
                </p>
              )}
            </div>

            {/* Histórico */}
            {D?.pedido?.log?.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  <ClockCounterClockwise size={12} weight="bold" /> Histórico no Dryland
                </p>
                <ul className="rounded-xl ring-1 ring-gray-200 divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {[...D.pedido.log].reverse().map((l, k) => (
                    <li key={k} className="px-3 py-1.5 text-xs flex flex-wrap gap-x-2">
                      <span className="text-gray-400 tabular-nums">{fmtDataHora(l.em)}</span>
                      <span className="text-[#000638]">{l.o}</span>
                      {l.obs && <span className="text-gray-500">— {l.obs}</span>}
                      {l.por && <span className="text-gray-400">· {l.por}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrejinhoPedidos;
