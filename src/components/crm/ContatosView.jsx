// Contatos — lista TODOS clientes que já compraram no canal (histórico completo).
// Inclui telefone, vendedor predominante, última compra, total comprado.
// Suporta busca, paginação e exportação CSV.
import React, { useEffect, useState, useCallback } from 'react';
import {
  MagnifyingGlass,
  Spinner,
  Download,
  ChatCircleText,
  Users,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const CANAL_LABEL = {
  varejo: 'Varejo',
  revenda: 'Revenda',
  multimarcas: 'Multimarcas',
  multimarcas_global: 'Multimarcas Global',
  inbound_david: 'MTM Inbound David',
  inbound_rafael: 'MTM Inbound Rafael',
};

// Map modulo da UI (Multimarcas/Revenda) → key backend
function moduloToCanal(modulo) {
  if (!modulo) return null;
  const lower = String(modulo).toLowerCase().trim();
  if (lower.includes('inbound') && lower.includes('david')) return 'inbound_david';
  if (lower.includes('inbound') && lower.includes('rafael')) return 'inbound_rafael';
  if (lower.includes('multimarc')) return 'multimarcas';
  if (lower.includes('revenda')) return 'revenda';
  if (lower.includes('varejo')) return 'varejo';
  return null;
}

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtTel(t) {
  if (!t) return '—';
  const onlyDigits = String(t).replace(/\D/g, '');
  if (onlyDigits.length === 11) {
    return `(${onlyDigits.slice(0, 2)}) ${onlyDigits.slice(2, 7)}-${onlyDigits.slice(7)}`;
  }
  if (onlyDigits.length === 10) {
    return `(${onlyDigits.slice(0, 2)}) ${onlyDigits.slice(2, 6)}-${onlyDigits.slice(6)}`;
  }
  return t;
}

function exportCSV(contatos, canal) {
  const headers = [
    'Person Code', 'Nome', 'Telefone', 'E-mail', 'Cidade', 'UF',
    'Vendedor', 'Total Comprado (R$)', 'NFs', '1ª Compra', 'Última Compra',
  ];
  const csv = [
    headers.join(';'),
    ...contatos.map((c) => [
      c.person_code,
      `"${(c.person_name || '').replace(/"/g, '""')}"`,
      c.telefone || '',
      c.email || '',
      c.city || '',
      c.uf || '',
      c.vendedor_nome || '',
      Number(c.total_value || 0).toFixed(2).replace('.', ','),
      c.num_nfs || 0,
      c.first_purchase || '',
      c.last_purchase || '',
    ].join(';')),
  ].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contatos-${canal}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContatosView({ modulo }) {
  const canalBase = moduloToCanal(modulo);
  const [globalMode, setGlobalMode] = useState(false);
  // Se modo global ativado e canal é multimarcas, troca pra multimarcas_global
  const canal = (globalMode && canalBase === 'multimarcas') ? 'multimarcas_global' : canalBase;
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sellerCode, setSellerCode] = useState('all');
  const [ufFiltro, setUfFiltro] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [data, setData] = useState({ contatos: [], total: 0, vendedores: [], ufs: [] });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Debounce na busca
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reseta filtros quando troca canal
  useEffect(() => {
    setSellerCode('all');
    setUfFiltro('all');
    setPage(1);
  }, [canal]);

  const carregar = useCallback(async () => {
    if (!canal) {
      setErro('Canal não suportado. Use Varejo, Revenda, Multimarcas, MTM Inbound David ou Rafael.');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/crm/contatos-canal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          canal,
          search: searchDebounced,
          sellerCode: sellerCode === 'all' ? null : sellerCode,
          uf: ufFiltro === 'all' ? null : ufFiltro,
          page,
          pageSize,
        }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      const d = json?.data || json || {};
      setData({
        contatos: d.contatos || [],
        total: d.total || 0,
        vendedores: d.vendedores || [],
        ufs: d.ufs || [],
      });
    } catch (e) {
      setErro(e.message);
      setData({ contatos: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [canal, searchDebounced, sellerCode, ufFiltro, page, pageSize]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalPaginas = Math.max(1, Math.ceil(data.total / pageSize));

  if (!canal) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-sm">
        Canal "{modulo}" não tem lista de contatos disponível. Selecione Varejo, Revenda,
        Multimarcas, MTM Inbound David ou Rafael.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-xl px-5 py-4 shadow-md flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white/15 p-2.5 rounded-lg">
            <Users size={22} weight="duotone" className="text-cyan-100" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Contatos — {CANAL_LABEL[canal]}</h2>
            <p className="text-xs text-cyan-100/90 mt-0.5">
              Todos os clientes que já compraram no canal · {data.total.toLocaleString('pt-BR')} contatos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(data.contatos, canal)}
            disabled={!data.contatos.length}
            className="text-xs px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 border border-white/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} weight="bold" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Search + filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, código ou telefone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          {data.vendedores && data.vendedores.length > 0 && (
            <select
              value={sellerCode}
              onChange={(e) => { setSellerCode(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white min-w-[180px]"
            >
              <option value="all">Todos vendedores ({data.vendedores.length})</option>
              {data.vendedores.map((v) => (
                <option key={v.code} value={v.code}>{v.nome}</option>
              ))}
            </select>
          )}
          {data.ufs && data.ufs.length > 0 && (
            <select
              value={ufFiltro}
              onChange={(e) => { setUfFiltro(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white min-w-[120px]"
            >
              <option value="all">Todos UFs ({data.ufs.length})</option>
              {data.ufs.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
        </div>
        {/* Toggle Multimarcas Global — só aparece pra canal Multimarcas */}
        {canalBase === 'multimarcas' && (
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={globalMode}
              onChange={(e) => { setGlobalMode(e.target.checked); setPage(1); }}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-700">
              <b>Multimarcas Global</b>
              <span className="text-gray-500 ml-1">— inclui David, Thalis e Rafael (todos vendedores B2M)</span>
            </span>
          </label>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && data.contatos.length === 0 && (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Spinner size={18} className="animate-spin" />
            <span className="text-xs">Carregando contatos...</span>
          </div>
        )}
        {erro && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 text-rose-700 text-sm">
            Erro: {erro}
          </div>
        )}
        {!loading && data.contatos.length === 0 && !erro && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhum contato encontrado.
          </div>
        )}
        {data.contatos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b border-gray-200">
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Telefone</th>
                  <th className="py-2.5 px-3">Local</th>
                  <th className="py-2.5 px-3">Vendedor</th>
                  <th className="py-2.5 px-3 text-right">Total Comprado</th>
                  <th className="py-2.5 px-3 text-right">NFs</th>
                  <th className="py-2.5 px-3 text-right">Última Compra</th>
                </tr>
              </thead>
              <tbody>
                {data.contatos.map((c) => (
                  <tr
                    key={c.person_code}
                    className="border-b border-gray-100 hover:bg-emerald-50/30 transition"
                  >
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-gray-800 truncate max-w-[280px]">
                        {c.person_name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">#{c.person_code}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      {c.telefone ? (
                        <a
                          href={`https://wa.me/55${String(c.telefone).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1.5 font-mono text-xs"
                          title="Abrir WhatsApp"
                        >
                          <ChatCircleText size={13} weight="bold" />
                          {fmtTel(c.telefone)}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">
                      {c.city || c.uf ? (
                        <>
                          {c.city || '—'}
                          {c.uf && <span className="text-gray-400"> · {c.uf}</span>}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {c.vendedor_nome ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                          {c.vendedor_nome}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-gray-800">
                      R$ {fmtBRL(c.total_value)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">
                      {c.num_nfs}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">
                      {c.last_purchase}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {data.total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Página <b>{page}</b> de <b>{totalPaginas}</b> · {data.total.toLocaleString('pt-BR')} contatos
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="text-xs px-3 py-1 rounded border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                disabled={page >= totalPaginas || loading}
                className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
