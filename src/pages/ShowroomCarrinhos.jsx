// Aba "Carrinhos Abandonados" do Showroom
import React, { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart,
  MagnifyingGlass,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  WhatsappLogo,
  At,
  CalendarBlank,
  Package,
  Warning,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

const fmtBRL = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const HOJE = new Date().toISOString().slice(0, 10);
const MES_INI = (() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
})();

export default function ShowroomCarrinhos() {
  const [carrinhos, setCarrinhos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    datemin: MES_INI,
    datemax: HOJE,
    busca: '',
    recuperado: '', // '' | 'true' | 'false'
  });
  const [expand, setExpand] = useState(new Set());

  const toggle = (id) =>
    setExpand((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (filtros.datemin) qs.set('datemin', filtros.datemin);
      if (filtros.datemax) qs.set('datemax', filtros.datemax);
      if (filtros.busca) qs.set('busca', filtros.busca);
      if (filtros.recuperado) qs.set('recuperado', filtros.recuperado);
      qs.set('limit', '500');
      const r = await fetch(`${API_BASE_URL}/api/wix/carrinhos?${qs}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      setCarrinhos(j.carrinhos || []);
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

  const marcarRecuperado = async (c) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/wix/carrinhos/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recuperado: !c.recuperado }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'erro');
      setCarrinhos((arr) => arr.map((x) => (x.id === c.id ? { ...x, ...j.carrinho } : x)));
    } catch (e) {
      alert('Falha: ' + e.message);
    }
  };

  // KPIs
  const valorTotal = carrinhos.reduce((s, c) => s + Number(c.total || 0), 0);
  const recuperados = carrinhos.filter((c) => c.recuperado).length;
  const taxaRecup = carrinhos.length > 0 ? (recuperados / carrinhos.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Banner instrução se não tem nenhum */}
      {!loading && carrinhos.length === 0 && !filtros.busca && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Warning size={20} weight="duotone" className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-bold mb-1">Configure a automação no Wix pra começar a receber</p>
            <ol className="list-decimal ml-5 space-y-1 text-[13px]">
              <li>Acesse <a href="https://manage.wix.com/dashboard/bdedc285-046b-4313-aa6c-8867b7b1d1f9/automations" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Wix Automations</a></li>
              <li><b>+ New Automation</b> → escolhe trigger <b>"Cart Abandoned"</b> (ou "Checkout Abandoned")</li>
              <li>Action: <b>Send HTTP Request</b></li>
              <li>URL: <code className="bg-amber-100 px-2 py-0.5 rounded text-[12px] font-mono">{window.location.origin.replace(':3000', ':4100')}/api/wix/webhook/cart-abandoned</code></li>
              <li>Method: <b>POST</b> · Body: padrão do Wix · Activate</li>
            </ol>
          </div>
        </div>
      )}

      {/* KPIs */}
      {carrinhos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi icon={ShoppingCart} color="orange" label="Carrinhos" value={carrinhos.length} />
          <Kpi icon={Warning} color="rose" label="Valor abandonado" value={`R$ ${fmtBRL(valorTotal)}`} />
          <Kpi icon={CheckCircle} color="emerald" label="Recuperados" value={recuperados} />
          <Kpi icon={CheckCircle} color="blue" label="Taxa recuperação" value={`${taxaRecup.toFixed(0)}%`} />
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
          value={filtros.recuperado}
          onChange={(e) => setFiltros((s) => ({ ...s, recuperado: e.target.value }))}
          className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos</option>
          <option value="false">Não recuperados</option>
          <option value="true">Recuperados</option>
        </select>

        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar nome, email ou telefone..."
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
      </div>

      {erro && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">{erro}</div>
      )}

      {/* Lista */}
      {loading && carrinhos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400 text-sm">
          <ArrowsClockwise size={20} className="animate-spin inline mr-2" />
          Carregando…
        </div>
      ) : carrinhos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <ShoppingCart size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhum carrinho abandonado no período.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_180px_120px_120px_120px] items-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 bg-gray-50/40">
            <div></div>
            <div>Cliente</div>
            <div>Última atividade</div>
            <div>Itens</div>
            <div className="text-right">Valor</div>
            <div className="text-right">Ação</div>
          </div>
          {carrinhos.map((c) => {
            const aberto = expand.has(c.id);
            return (
              <React.Fragment key={c.id}>
                <div
                  onClick={() => toggle(c.id)}
                  className={`grid grid-cols-[40px_1fr_180px_120px_120px_120px] items-center gap-2 px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${
                    c.recuperado ? 'bg-emerald-50/50' : 'hover:bg-orange-50/30'
                  }`}
                >
                  <div>
                    {aberto ? <CaretDown size={14} weight="bold" className="text-gray-400" /> : <CaretRight size={14} weight="bold" className="text-gray-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-[13px] truncate">
                      {c.cliente_nome || '(sem nome)'}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      {c.cliente_email && (
                        <span className="inline-flex items-center gap-0.5">
                          <At size={10} /> {c.cliente_email}
                        </span>
                      )}
                      {c.cliente_telefone && (
                        <span className="inline-flex items-center gap-0.5 font-mono">
                          <WhatsappLogo size={10} className="text-emerald-600" /> {c.cliente_telefone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-600 tabular-nums">
                    {fmtDate(c.ultima_atividade)}
                  </div>
                  <div className="text-[12px] text-gray-600 tabular-nums">
                    <span className="font-semibold text-gray-800">{c.itens_qty}</span> pç
                  </div>
                  <div className="text-right font-bold text-gray-900 tabular-nums">
                    R$ {fmtBRL(c.total)}
                  </div>
                  <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    {c.recuperado ? (
                      <button
                        onClick={() => marcarRecuperado(c)}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      >
                        ✓ Recuperado
                      </button>
                    ) : (
                      <button
                        onClick={() => marcarRecuperado(c)}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        Marcar recup.
                      </button>
                    )}
                  </div>
                </div>
                {aberto && (
                  <div className="bg-gray-50/40 px-4 pl-14 py-4 border-b border-gray-100">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">
                      Itens do carrinho
                    </div>
                    <div className="bg-white rounded-lg ring-1 ring-gray-200/60 divide-y divide-gray-100">
                      {(c.itens || []).map((it, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                          {it.imagem && <img src={it.imagem} alt="" className="w-9 h-9 rounded object-cover border border-gray-200" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{it.nome}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {it.cor && (
                                <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-[1px] rounded">{it.cor}</span>
                              )}
                              {it.tamanho && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-[1px] rounded">{it.tamanho}</span>
                              )}
                              {it.sku && (
                                <span className="text-[10px] font-mono text-gray-400">{it.sku}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-800 tabular-nums">{it.qtd} pç</p>
                            <p className="text-[10px] text-gray-500 tabular-nums">R$ {fmtBRL(it.preco_unit)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          <div className="px-4 py-2.5 text-[11px] text-gray-400 text-center bg-gray-50/40 border-t border-gray-100">
            {carrinhos.length} carrinho{carrinhos.length === 1 ? '' : 's'} no período
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color = 'blue' }) {
  const cores = {
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
  };
  const c = cores[color];
  return (
    <div className="bg-white rounded-xl ring-1 ring-gray-200 p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon size={20} weight="duotone" className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${c.text} leading-tight truncate`}>{value}</p>
      </div>
    </div>
  );
}
