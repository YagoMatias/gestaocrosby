// Modal de detalhes da conversão CRM:
// lista clientes (leads) com loja onde compraram, telefone, vendedor, valor.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Users,
  ArrowsClockwise,
  Storefront,
  Phone,
  CheckCircle,
  CircleDashed,
  ArrowSquareOut,
  MagnifyingGlass,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
};
const fmtPhone = (s) => {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s || '—';
};

export default function ConversaoClientesModal({ canal = 'varejo', datemin, datemax, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all'); // all|fechados|abertos
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (canal) qs.set('canal', canal);
      if (datemin) qs.set('datemin', datemin);
      if (datemax) qs.set('datemax', datemax);
      if (filtroStatus) qs.set('status', filtroStatus);
      const r = await fetch(`${API_BASE_URL}/api/crm/conversao-clientes?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setData(j.data || null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [canal, datemin, datemax, filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  const clientes = useMemo(() => {
    const lista = data?.clientes || [];
    if (!busca.trim()) return lista;
    const q = busca.toLowerCase();
    return lista.filter((c) =>
      (c.lead_titulo || '').toLowerCase().includes(q)
      || (c.person_nome || '').toLowerCase().includes(q)
      || (c.lead_telefone || '').includes(busca)
      || (c.nf_principal?.branch_name || '').toLowerCase().includes(q)
    );
  }, [data, busca]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-5 shadow-2xl font-barlow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-[#000638] flex items-center gap-2">
              <Users size={20} weight="bold" className="text-violet-600" />
              Clientes do CRM — Conversão por Loja
            </h3>
            <p className="text-xs text-gray-500">
              Canal: <strong>{canal}</strong>
              {datemin && datemax && ` · ${datemin} → ${datemax}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, telefone, loja..."
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs w-full focus:ring-2 focus:ring-[#000638] outline-none"
            />
          </div>
          {['all', 'fechados', 'abertos'].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full transition ${
                filtroStatus === s ? 'bg-[#000638] text-white font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'fechados' ? 'Convertidos' : 'Não convertidos'}
            </button>
          ))}
          <button
            onClick={carregar}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">{erro}</div>}

        {loading && (!data || !clientes.length) ? (
          <p className="text-center text-sm text-gray-400 py-8">Carregando clientes...</p>
        ) : clientes.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Nenhum cliente nesse filtro.</p>
        ) : (
          <>
            {/* Sumário */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <div className="bg-gray-50 p-2 rounded-lg text-center">
                <div className="text-[10px] text-gray-500 uppercase">Total leads</div>
                <div className="text-base font-bold text-[#000638]">{data?.total_leads || 0}</div>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg text-center">
                <div className="text-[10px] text-emerald-600 uppercase">Validados por NF</div>
                <div className="text-base font-bold text-emerald-700">{data?.total_validados || 0}</div>
              </div>
              <div className="bg-violet-50 p-2 rounded-lg text-center">
                <div className="text-[10px] text-violet-600 uppercase">Mostrando</div>
                <div className="text-base font-bold text-violet-700">{clientes.length}</div>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg text-center">
                <div className="text-[10px] text-amber-700 uppercase">Receita</div>
                <div className="text-sm font-bold text-amber-700">
                  {fmtBRL(clientes.reduce((s, c) => s + (c.valor_total || 0), 0))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Telefone</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Loja</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Data NF</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.lead_id} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="px-3 py-2">
                        {c.validado_nf ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            <CheckCircle size={11} weight="fill" /> Comprou
                          </span>
                        ) : c.lead_status_fechado ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <CheckCircle size={11} weight="bold" /> Status
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            <CircleDashed size={11} /> Aberto
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-[#000638] truncate max-w-[200px]">
                          {c.person_nome || c.lead_titulo}
                        </div>
                        {c.person_nome && c.lead_titulo !== c.person_nome && (
                          <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{c.lead_titulo}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 font-mono whitespace-nowrap">
                        {c.lead_telefone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} weight="bold" className="text-gray-400" />
                            {fmtPhone(c.lead_telefone)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {c.nf_principal ? (
                          <span className="inline-flex items-center gap-1">
                            <Storefront size={11} weight="bold" className="text-violet-500" />
                            {c.nf_principal.branch_name}
                            {c.total_nfs > 1 && (
                              <span className="text-[10px] text-gray-400">(+{c.total_nfs - 1})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-700 whitespace-nowrap">
                        {c.nf_principal ? fmtDate(c.nf_principal.issue_date) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">
                        {c.valor_total > 0 ? fmtBRL(c.valor_total) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[120px]">
                        {c.lead_vendedor || '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {c.lead_url && (
                          <a
                            href={c.lead_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#000638] hover:underline inline-flex items-center gap-0.5 text-[10px]"
                          >
                            ClickUp <ArrowSquareOut size={9} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="text-[10px] text-gray-400 mt-3 text-right">
          Comprou = validado por NF · Status = só marcado no ClickUp · Aberto = sem nenhum dos dois
        </div>
      </div>
    </div>
  );
}
