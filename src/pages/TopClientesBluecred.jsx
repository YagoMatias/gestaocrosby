// Top Clientes por Filial (BlueCred) — ranking de clientes de uma loja/filial
// Crosby, com filtro de data. Retorna Código, Nome, Telefone e Data da última
// compra, ordenado por valor comprado (top clientes).
import React, { useState, useCallback, useEffect } from 'react';
import {
  Buildings,
  MagnifyingGlass,
  Spinner,
  Download,
  CalendarBlank,
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
function fmtData(s) {
  if (!s) return '—';
  const d = String(s).slice(0, 10);
  const [y, m, dd] = d.split('-');
  if (!y || !m || !dd) return d;
  return `${dd}/${m}/${y}`;
}

function exportCSV(contatos, branch) {
  const headers = ['Codigo', 'Nome', 'Telefone', 'Ultima Compra', 'Total (R$)'];
  const csv = [
    headers.join(';'),
    ...contatos.map((c) => [
      c.person_code,
      `"${(c.person_name || '').replace(/"/g, '""')}"`,
      c.telefone || '',
      c.last_purchase || '',
      Number(c.total_value || 0).toFixed(2).replace('.', ','),
    ].join(';')),
  ].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `top-clientes-filial-${branch}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TopClientesBluecred() {
  const [branches, setBranches] = useState([]);
  const [branchInput, setBranchInput] = useState('');
  const [datemin, setDatemin] = useState('');
  const [datemax, setDatemax] = useState('');
  const [search, setSearch] = useState('');
  const [contatos, setContatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [buscou, setBuscou] = useState(false);

  // Carrega lista de filiais para o dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/totvs/branches`);
        const json = await res.json();
        let arr = [];
        if (json?.data?.data && Array.isArray(json.data.data)) arr = json.data.data;
        else if (Array.isArray(json?.data)) arr = json.data;
        const norm = arr
          .map((e) => ({
            code: Number(e.cd_empresa ?? e.branchCode ?? e.code),
            nome: e.nm_grupoempresa || e.fantasyName || e.name || `Filial ${e.cd_empresa}`,
          }))
          .filter((e) => Number.isFinite(e.code))
          .sort((a, b) => a.code - b.code);
        setBranches(norm);
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  const carregar = useCallback(async () => {
    const b = Number(branchInput);
    if (!Number.isFinite(b) || b <= 0) {
      setErro('Selecione uma filial');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/tech/clientes-por-empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          branch_code: b,
          search: search || undefined,
          datemin: datemin || undefined,
          datemax: datemax || undefined,
          page: 1,
          pageSize: 10000,
        }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      const d = json?.data || json || {};
      setContatos(d.contatos || []);
      setTotal(d.total || 0);
      setBuscou(true);
    } catch (e) {
      setErro(e.message);
      setContatos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [branchInput, search, datemin, datemax]);

  const handleSubmit = (e) => {
    e.preventDefault();
    carregar();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <PageTitle
          title="Top Clientes por Filial"
          subtitle="BlueCred — clientes de uma loja Crosby com filtro de data"
          icon={Buildings}
        />

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 mb-1">Filial</label>
            <select
              value={branchInput}
              onChange={(e) => setBranchInput(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[220px] focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione…</option>
              {branches.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} — {b.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 mb-1">De</label>
            <div className="relative">
              <CalendarBlank size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={datemin}
                onChange={(e) => setDatemin(e.target.value)}
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 mb-1">Até</label>
            <div className="relative">
              <CalendarBlank size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={datemax}
                onChange={(e) => setDatemax(e.target.value)}
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-gray-500 mb-1">Buscar</label>
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, código ou telefone"
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg px-5 py-2 text-sm flex items-center gap-2"
          >
            {loading ? <Spinner size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
            Buscar
          </button>

          {contatos.length > 0 && (
            <button
              type="button"
              onClick={() => exportCSV(contatos, branchInput)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-4 py-2 text-sm flex items-center gap-2"
            >
              <Download size={16} /> CSV
            </button>
          )}
        </form>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            {erro}
          </div>
        )}

        {buscou && !loading && (
          <div className="text-sm text-gray-500 mb-2">
            {total.toLocaleString('pt-BR')} cliente(s) encontrado(s)
            {(datemin || datemax) && (
              <span> · período {datemin ? fmtData(datemin) : '…'} a {datemax ? fmtData(datemax) : '…'}</span>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">#</th>
                  <th className="text-left px-4 py-3 font-semibold">Código</th>
                  <th className="text-left px-4 py-3 font-semibold">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                  <th className="text-left px-4 py-3 font-semibold">Última compra</th>
                  <th className="text-right px-4 py-3 font-semibold">Total comprado</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      <Spinner size={22} className="animate-spin inline" /> Carregando…
                    </td>
                  </tr>
                )}
                {!loading && contatos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      {buscou ? 'Nenhum cliente encontrado.' : 'Selecione uma filial e clique em Buscar.'}
                    </td>
                  </tr>
                )}
                {!loading && contatos.map((c, i) => (
                  <tr key={c.person_code} className="border-t border-gray-100 hover:bg-blue-50/40">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">{c.person_code}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{c.person_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{fmtTel(c.telefone)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{fmtData(c.last_purchase)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">R$ {fmtBRL(c.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
