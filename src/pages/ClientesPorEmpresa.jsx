// Clientes por Filial — busca clientes que compraram em uma filial específica.
// Input: branch_code → lista clientes com nome, telefone, CPF/CNPJ, vendedor,
// total comprado, NFs, última compra. Suporta busca, filtros UF/vendedor e CSV.
import React, { useState, useCallback } from 'react';
import {
  Buildings,
  MagnifyingGlass,
  Spinner,
  Download,
  ChatCircleText,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';

const API_KEY = import.meta.env.VITE_API_KEY || '';

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtTel(t) {
  if (!t) return '—';
  const d = String(t).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}
function fmtCNPJ(s) {
  if (!s) return '—';
  const d = String(s).replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return s;
}

function exportCSV(contatos, branch) {
  const headers = [
    'Code', 'Nome', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Cidade', 'UF',
    'Vendedor', 'Total Comprado (R$)', 'NFs', '1ª Compra', 'Última Compra',
  ];
  const csv = [
    headers.join(';'),
    ...contatos.map((c) => [
      c.person_code,
      `"${(c.person_name || '').replace(/"/g, '""')}"`,
      c.cpf_cnpj || '',
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
  a.download = `clientes-filial-${branch}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientesPorEmpresa() {
  const [branchInput, setBranchInput] = useState('');
  const [branchAtivo, setBranchAtivo] = useState(null);
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('all');
  const [seller, setSeller] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [data, setData] = useState({ contatos: [], total: 0, ufs: [], vendedores: [] });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async (branch, params = {}) => {
    if (!branch) return;
    setLoading(true);
    setErro('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/tech/clientes-por-empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          branch_code: branch,
          search: params.search ?? search,
          page: params.page ?? page,
          pageSize,
        }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      const d = json?.data || json || {};
      setData({
        contatos: d.contatos || [],
        total: d.total || 0,
        ufs: d.ufs || [],
        vendedores: d.vendedores || [],
        nf_total: d.nf_total || 0,
      });
    } catch (e) {
      setErro(e.message);
      setData({ contatos: [], total: 0, ufs: [], vendedores: [] });
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const b = Number(branchInput);
    if (!Number.isFinite(b) || b <= 0) {
      setErro('Informe um número de filial válido');
      return;
    }
    setBranchAtivo(b);
    setPage(1);
    setSearch('');
    setUf('all');
    setSeller('all');
    carregar(b, { search: '', page: 1 });
  };

  // Filtros client-side (UF + vendedor sobre dados paginados — aplica em todo data.contatos)
  let visiveis = data.contatos;
  if (uf !== 'all') visiveis = visiveis.filter((c) => c.uf === uf);
  if (seller !== 'all') visiveis = visiveis.filter((c) => String(c.vendedor_code) === String(seller));

  const totalPaginas = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto space-y-5">
        <PageTitle
          title="Clientes por Filial"
          subtitle="Busca clientes que compraram em uma filial específica"
          icon={Buildings}
        />

        {/* Form de busca */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            Número da Filial (Branch Code)
          </label>
          <div className="flex gap-2 items-stretch">
            <div className="relative flex-1 max-w-xs">
              <Buildings size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                placeholder="ex: 99, 2, 87..."
                className="w-full pl-10 pr-3 py-2.5 text-base font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Spinner size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
              {loading ? 'Carregando...' : 'Buscar Clientes'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Exemplos: <b>99</b> Blue House · <b>2</b> João Pessoa · <b>95</b> Midway · <b>88</b> Guararapes · <b>97</b> Teresina
          </p>
          {erro && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mt-3">{erro}</p>
          )}
        </form>

        {/* Resultados */}
        {branchAtivo && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white rounded-xl px-5 py-4 shadow-md flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Filial {branchAtivo}</h2>
                <p className="text-xs text-cyan-100 mt-0.5">
                  {data.total.toLocaleString('pt-BR')} clientes · {(data.nf_total || 0).toLocaleString('pt-BR')} NFs no histórico
                </p>
              </div>
              <button
                onClick={() => exportCSV(visiveis, branchAtivo)}
                disabled={!visiveis.length}
                className="text-xs px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 border border-white/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} weight="bold" />
                Exportar CSV
              </button>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { setPage(1); carregar(branchAtivo, { search, page: 1 }); }
                    }}
                    placeholder="Buscar nome, código, telefone, CNPJ... (Enter pra buscar)"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {data.vendedores && data.vendedores.length > 0 && (
                  <select
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-[180px]"
                  >
                    <option value="all">Todos vendedores ({data.vendedores.length})</option>
                    {data.vendedores.map((v) => (
                      <option key={v.code} value={v.code}>{v.nome}</option>
                    ))}
                  </select>
                )}
                {data.ufs && data.ufs.length > 0 && (
                  <select
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-[120px]"
                  >
                    <option value="all">Todos UFs ({data.ufs.length})</option>
                    {data.ufs.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loading && visiveis.length === 0 && (
                <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                  <Spinner size={18} className="animate-spin" />
                  <span className="text-xs">Carregando clientes...</span>
                </div>
              )}
              {!loading && visiveis.length === 0 && !erro && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Nenhum cliente encontrado nessa filial.
                </div>
              )}
              {visiveis.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b border-gray-200">
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">CPF/CNPJ</th>
                        <th className="py-2.5 px-3">Telefone</th>
                        <th className="py-2.5 px-3">Local</th>
                        <th className="py-2.5 px-3">Vendedor</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">NFs</th>
                        <th className="py-2.5 px-3 text-right">Última</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((c) => (
                        <tr key={c.person_code} className="border-b border-gray-100 hover:bg-indigo-50/30 transition">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-gray-800 truncate max-w-[280px]">{c.person_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">#{c.person_code}</p>
                          </td>
                          <td className="py-2.5 px-3 text-xs font-mono text-gray-600">{fmtCNPJ(c.cpf_cnpj)}</td>
                          <td className="py-2.5 px-3">
                            {c.telefone ? (
                              <a
                                href={`https://wa.me/55${String(c.telefone).replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1.5 font-mono text-xs"
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
                              <>{c.city || '—'}{c.uf && <span className="text-gray-400"> · {c.uf}</span>}</>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            {c.vendedor_nome ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">{c.vendedor_nome}</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums text-gray-800">R$ {fmtBRL(c.total_value)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{c.num_nfs}</td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">{c.last_purchase}</td>
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
                    Página <b>{page}</b> de <b>{totalPaginas}</b> · {data.total.toLocaleString('pt-BR')} clientes
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { const p = Math.max(1, page - 1); setPage(p); carregar(branchAtivo, { page: p }); }}
                      disabled={page <= 1 || loading}
                      className="text-xs px-3 py-1 rounded border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={() => { const p = Math.min(totalPaginas, page + 1); setPage(p); carregar(branchAtivo, { page: p }); }}
                      disabled={page >= totalPaginas || loading}
                      className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
