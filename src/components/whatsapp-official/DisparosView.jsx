// Aba "Disparos" do Crosby Manager — lista campanhas recentes com
// resumo (enviados, falharam, compraram, faturamento) e drill-down dos contatos.
import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Spinner,
  MagnifyingGlass,
  Eye,
  ArrowLeft,
  Download,
  ChatCircleText,
  CheckCircle,
  XCircle,
  ShoppingCart,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTel(t) {
  if (!t) return '—';
  const d = String(t).replace(/\D/g, '');
  if (d.length === 13) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return t;
}
function fmtCNPJ(s) {
  if (!s) return '—';
  const d = String(s).replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return s;
}

const STATUS_LABEL = {
  queued: { txt: 'Na fila', cls: 'bg-gray-100 text-gray-700' },
  sent: { txt: 'Enviada', cls: 'bg-blue-100 text-blue-700' },
  delivered: { txt: 'Entregue', cls: 'bg-emerald-100 text-emerald-700' },
  read: { txt: 'Lida', cls: 'bg-violet-100 text-violet-700' },
  replied: { txt: 'Respondida', cls: 'bg-amber-100 text-amber-700' },
  failed: { txt: 'Falhou', cls: 'bg-rose-100 text-rose-700' },
  error: { txt: 'Erro', cls: 'bg-rose-100 text-rose-700' },
};

function exportCSV(contatos, campanhaName) {
  const headers = ['Code', 'Nome', 'CPF/CNPJ', 'Telefone', 'Status', 'Enviado em', 'Comprou', 'Valor Compra', 'Data Compra'];
  const csv = [
    headers.join(';'),
    ...contatos.map((c) => [
      c.person_code || '',
      `"${(c.contact_name || '').replace(/"/g, '""')}"`,
      c.cpf_cnpj || '',
      c.phone_number || '',
      c.status || '',
      c.sent_at || '',
      c.comprou ? 'SIM' : 'NÃO',
      Number(c.valor_compra || 0).toFixed(2).replace('.', ','),
      c.data_compra || '',
    ].join(';')),
  ].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `disparo-${(campanhaName || 'campanha').replace(/[^a-z0-9]+/gi, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DisparosView({ selectedAccount }) {
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [days, setDays] = useState(30);

  const [campanhaAtual, setCampanhaAtual] = useState(null); // { campaign_id, ... }
  const [contatos, setContatos] = useState([]);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [searchContato, setSearchContato] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroComprou, setFiltroComprou] = useState('all');

  const fetchCampanhas = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const wabaParam = selectedAccount?.waba_id ? `&waba_id=${selectedAccount.waba_id}` : '';
      const res = await fetch(`${API_BASE_URL}/api/meta/disparos?days=${days}&limit=100${wabaParam}`, {
        headers: { 'x-api-key': API_KEY },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setCampanhas(json?.data || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [days, selectedAccount]);

  const fetchContatos = useCallback(async (campanha) => {
    setLoadingContatos(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/meta/disparos/${campanha.campaign_id}/contatos?pageSize=500`,
        { headers: { 'x-api-key': API_KEY } },
      );
      const json = await res.json();
      setContatos(json?.data?.contatos || []);
    } finally {
      setLoadingContatos(false);
    }
  }, []);

  useEffect(() => {
    fetchCampanhas();
  }, [fetchCampanhas]);

  let visiveis = contatos;
  if (searchContato.trim()) {
    const q = searchContato.toLowerCase();
    visiveis = visiveis.filter(
      (c) =>
        (c.contact_name || '').toLowerCase().includes(q)
        || (c.phone_number || '').includes(q)
        || (c.cpf_cnpj || '').includes(q)
        || String(c.person_code || '').includes(q),
    );
  }
  if (filtroStatus !== 'all') visiveis = visiveis.filter((c) => c.status === filtroStatus);
  if (filtroComprou === 'sim') visiveis = visiveis.filter((c) => c.comprou);
  if (filtroComprou === 'nao') visiveis = visiveis.filter((c) => !c.comprou);

  // ============ DRILL-DOWN ============
  if (campanhaAtual) {
    const totalCompraram = contatos.filter((c) => c.comprou).length;
    const faturamento = contatos.reduce((s, c) => s + Number(c.valor_compra || 0), 0);
    return (
      <div className="space-y-3 animate-in fade-in duration-300">
        <button
          onClick={() => { setCampanhaAtual(null); setContatos([]); }}
          className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Voltar pra lista
        </button>

        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white rounded-xl px-5 py-4 shadow-md flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{campanhaAtual.campaign_name}</h2>
            <p className="text-xs text-amber-50 mt-0.5">
              Template <b>{campanhaAtual.template_name}</b>
              {campanhaAtual.origem && <> · Origem: {campanhaAtual.origem}</>}
              · {campanhaAtual.total} contatos · enviados em {new Date(campanhaAtual.primeiro_envio).toLocaleString('pt-BR')}
            </p>
          </div>
          <button
            onClick={() => exportCSV(contatos, campanhaAtual.campaign_name)}
            disabled={!contatos.length}
            className="text-xs px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 border border-white/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} weight="bold" /> Exportar CSV
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-gray-500">Total</p>
            <p className="text-xl font-extrabold text-gray-800">{contatos.length.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-emerald-600">Enviadas</p>
            <p className="text-xl font-extrabold text-emerald-700">{contatos.filter((c) => ['sent', 'delivered', 'read', 'replied'].includes(c.status)).length}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-violet-600">Compraram</p>
            <p className="text-xl font-extrabold text-violet-700">{totalCompraram}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-amber-600">Faturamento</p>
            <p className="text-xl font-extrabold text-amber-700">R$ {fmtBRL(faturamento)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchContato}
              onChange={(e) => setSearchContato(e.target.value)}
              placeholder="Buscar nome, telefone, CPF..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Todos status</option>
            <option value="sent">Enviada</option>
            <option value="delivered">Entregue</option>
            <option value="read">Lida</option>
            <option value="replied">Respondida</option>
            <option value="failed">Falhou</option>
          </select>
          <select
            value={filtroComprou}
            onChange={(e) => setFiltroComprou(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Comprou: todos</option>
            <option value="sim">Comprou: SIM</option>
            <option value="nao">Comprou: NÃO</option>
          </select>
        </div>

        {/* Tabela contatos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loadingContatos ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Spinner size={18} className="animate-spin" />
              <span className="text-xs">Carregando contatos...</span>
            </div>
          ) : visiveis.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhum contato encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b">
                    <th className="py-2.5 px-3">Contato</th>
                    <th className="py-2.5 px-3">CPF/CNPJ</th>
                    <th className="py-2.5 px-3">Telefone</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Enviado</th>
                    <th className="py-2.5 px-3 text-center">Comprou?</th>
                    <th className="py-2.5 px-3 text-right">Valor compra</th>
                    <th className="py-2.5 px-3">Data compra</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => {
                    const st = STATUS_LABEL[c.status] || { txt: c.status, cls: 'bg-gray-100 text-gray-600' };
                    return (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-amber-50/30">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-gray-800 truncate max-w-[240px]">{c.contact_name || '—'}</p>
                          {c.person_code && <p className="text-[10px] text-gray-400 font-mono">#{c.person_code}</p>}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-mono text-gray-600">{fmtCNPJ(c.cpf_cnpj)}</td>
                        <td className="py-2.5 px-3">
                          {c.phone_number ? (
                            <a
                              href={`https://wa.me/${String(c.phone_number).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 font-mono text-xs"
                            >
                              <ChatCircleText size={13} weight="bold" />
                              {fmtTel(c.phone_number)}
                            </a>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.txt}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-600">{c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          {c.comprou ? (
                            <CheckCircle size={18} weight="fill" className="text-emerald-600 inline" />
                          ) : (
                            <XCircle size={18} className="text-gray-300 inline" />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-800">
                          {c.comprou ? `R$ ${fmtBRL(c.valor_compra)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-600">{c.data_compra ? new Date(c.data_compra).toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ LISTA DE CAMPANHAS ============
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Megaphone size={28} weight="fill" className="text-amber-600" />
          <div>
            <h2 className="text-base font-extrabold text-gray-800">Histórico de Disparos</h2>
            <p className="text-xs text-gray-600">Campanhas enviadas + conversão (cruzamento com notas fiscais)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-600">Período:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={60}>Últimos 60 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
          <button onClick={fetchCampanhas} className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50">↻</button>
        </div>
      </div>

      {erro && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{erro}</p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Spinner size={18} className="animate-spin" />
            <span className="text-xs">Carregando campanhas...</span>
          </div>
        ) : campanhas.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhum disparo encontrado nesse período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b">
                  <th className="py-2.5 px-3">Campanha</th>
                  <th className="py-2.5 px-3">Template</th>
                  <th className="py-2.5 px-3">Último envio</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Enviados</th>
                  <th className="py-2.5 px-3 text-right">Falharam</th>
                  <th className="py-2.5 px-3 text-right">Compraram</th>
                  <th className="py-2.5 px-3 text-right">Faturamento</th>
                  <th className="py-2.5 px-3 text-right">Conversão</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.campaign_id} className="border-b border-gray-100 hover:bg-amber-50/30">
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-gray-800 truncate max-w-[260px]">{c.campaign_name}</p>
                      {c.origem && <p className="text-[10px] text-gray-400">{c.origem}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-600">{c.template_name}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{c.ultimo_envio ? new Date(c.ultimo_envio).toLocaleString('pt-BR') : '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold">{c.total}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{c.enviados}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-rose-600">{c.falharam || 0}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-violet-700">
                      <span className="inline-flex items-center gap-1">
                        <ShoppingCart size={12} weight="bold" />
                        {c.compraram}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-amber-700">R$ {fmtBRL(c.faturamento)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.taxa_conversao >= 5 ? 'bg-emerald-100 text-emerald-700' : c.taxa_conversao >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.taxa_conversao}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => { setCampanhaAtual(c); fetchContatos(c); }}
                        className="p-1.5 rounded hover:bg-amber-100 text-amber-700"
                        title="Ver contatos"
                      >
                        <Eye size={14} weight="bold" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
