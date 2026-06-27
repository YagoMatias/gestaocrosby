// Criar Vouchers — busca clientes do TOTVS OU upload CSV e cria vouchers
// de desconto em lote pra cada cliente via API TOTVS. Salva histórico de
// batches no Supabase pra consulta posterior.
import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  MagnifyingGlass,
  Spinner,
  CheckCircle,
  XCircle,
  Download,
  Buildings,
  Percent,
  CalendarBlank,
  Funnel,
  PlayCircle,
  ClockCounterClockwise,
  Upload,
  Database,
  Eye,
  ArrowLeft,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';

const API_KEY = import.meta.env.VITE_API_KEY || '';

function fmtCNPJ(s) {
  if (!s) return '—';
  const d = String(s).replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return s;
}

function exportCSV(results, filename) {
  const headers = ['Customer Code', 'Voucher Number', 'Voucher Code', 'Status', 'Erro'];
  const csv = [
    headers.join(';'),
    ...results.map((r) => [
      r.customerCode,
      r.voucherNumber || '',
      r.voucherCode || '',
      r.success ? 'OK' : 'FALHA',
      `"${(r.error || '').replace(/"/g, '""')}"`,
    ].join(';')),
  ].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `vouchers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Parser de CSV simples (espera colunas: codigo|cd_pessoa|customer_code + opcional nome|name)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { contatos: [], erro: 'CSV vazio ou sem cabeçalho' };
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const codigoIdx = header.findIndex((h) =>
    ['codigo', 'cod', 'cd_pessoa', 'customer_code', 'customercode', 'code'].includes(h),
  );
  const nomeIdx = header.findIndex((h) => ['nome', 'name', 'cliente'].includes(h));
  if (codigoIdx < 0) {
    return { contatos: [], erro: 'CSV precisa de coluna "codigo" ou "cd_pessoa"' };
  }
  const contatos = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    const codigo = Number(cols[codigoIdx]);
    if (!Number.isFinite(codigo) || codigo <= 0) continue;
    contatos.push({
      cd_pessoa: codigo,
      name: nomeIdx >= 0 ? cols[nomeIdx] : '',
      cpf_cnpj: '',
      nr_telefone: '',
      invoiceCount: 0,
    });
  }
  return { contatos, erro: null };
}

export default function CriarVouchers() {
  const [tab, setTab] = useState('criar'); // 'criar' | 'historico'

  // Origem dos contatos (Criar tab)
  const [origem, setOrigem] = useState('totvs'); // 'totvs' | 'csv'

  // Filtros TOTVS
  const [operacoes, setOperacoes] = useState([]);
  const [operacaoId, setOperacaoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresas, setSelectedEmpresas] = useState([]);

  // Contatos resultantes
  const [contatos, setContatos] = useState([]);
  const [selectedContatos, setSelectedContatos] = useState(new Set());
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [erro, setErro] = useState('');

  // CSV upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvErro, setCsvErro] = useState('');

  // Config do voucher
  const [branchCodeRegistration, setBranchCodeRegistration] = useState(95);
  const [voucherType, setVoucherType] = useState(1);
  const [prefixCode, setPrefixCode] = useState('CROSBY');
  const [printTemplateCode, setPrintTemplateCode] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  });
  const [percentage, setPercentage] = useState(20);
  const [voucherBranchesStr, setVoucherBranchesStr] = useState('95');

  // Resultado da criação
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState(null);

  // Histórico
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchDetail, setBatchDetail] = useState(null);

  // ── Carga inicial: operações + empresas TOTVS
  useEffect(() => {
    (async () => {
      try {
        const r1 = await fetch(`${API_BASE_URL}/api/meta/totvs-operations`, {
          headers: { 'x-api-key': API_KEY },
        });
        const j1 = await r1.json();
        setOperacoes(j1?.data || []);
      } catch (e) { /* silencia */ }
      try {
        const r2 = await fetch(`${API_BASE_URL}/api/meta/totvs-branches`, {
          headers: { 'x-api-key': API_KEY },
        });
        const j2 = await r2.json();
        setEmpresas(j2?.data || []);
      } catch (e) { /* silencia */ }
    })();
  }, []);

  const carregarHistorico = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/tech/vouchers/batches?limit=100`, {
        headers: { 'x-api-key': API_KEY },
      });
      const j = await r.json();
      setBatches(j?.data || []);
    } catch (e) {
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'historico' && !batchDetail) carregarHistorico();
  }, [tab, batchDetail, carregarHistorico]);

  const applyQuickFilter = (type) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    if (type === 'ativos') {
      start.setDate(today.getDate() - 60);
    } else if (type === 'inativos') {
      start.setDate(today.getDate() - 365);
      end.setDate(today.getDate() - 61);
    } else if (type === '6meses') {
      start.setMonth(today.getMonth() - 6);
    }
    setDataInicio(start.toISOString().split('T')[0]);
    setDataFim(end.toISOString().split('T')[0]);
  };

  const handleBuscarContatos = async () => {
    if (!operacaoId) { setErro('Selecione a operação.'); return; }
    if (!dataInicio || !dataFim) { setErro('Selecione o período.'); return; }
    const operacao = operacoes.find((o) => String(o.id) === String(operacaoId));
    if (!operacao) { setErro('Operação inválida.'); return; }

    setLoadingContatos(true);
    setErro('');
    setContatos([]);
    setSelectedContatos(new Set());
    setResults(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/tech/vouchers/totvs-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          operacao,
          data_inicio: dataInicio,
          data_fim: dataFim,
          empresas: selectedEmpresas.map(Number),
        }),
      });
      const j = await r.json();
      const lista = j?.data?.data || j?.data || [];
      setContatos(lista);
      setSelectedContatos(new Set(lista.map((c) => c.cd_pessoa)));
      if (lista.length === 0) setErro('Nenhum contato retornado pelo TOTVS pra esses filtros.');
    } catch (e) {
      setErro('Erro ao buscar contatos: ' + e.message);
    } finally {
      setLoadingContatos(false);
    }
  };

  const handleCsvFile = (file) => {
    setCsvFile(file);
    setCsvErro('');
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { contatos: parsed, erro: parseErr } = parseCSV(e.target.result);
      if (parseErr) {
        setCsvErro(parseErr);
        return;
      }
      setContatos(parsed);
      setSelectedContatos(new Set(parsed.map((c) => c.cd_pessoa)));
      setResults(null);
    };
    reader.readAsText(file);
  };

  const toggleContato = (cd) => {
    const next = new Set(selectedContatos);
    if (next.has(cd)) next.delete(cd); else next.add(cd);
    setSelectedContatos(next);
  };
  const selecionarTodos = () => setSelectedContatos(new Set(contatos.map((c) => c.cd_pessoa)));
  const desmarcarTodos = () => setSelectedContatos(new Set());

  const handleCriarVouchers = async () => {
    if (selectedContatos.size === 0) { alert('Selecione ao menos 1 contato.'); return; }
    if (!startDate || !endDate || !percentage || !prefixCode) {
      alert('Preencha todos os campos do voucher.');
      return;
    }
    if (!window.confirm(`Criar ${selectedContatos.size} vouchers de ${percentage}% válidos de ${startDate} a ${endDate}?`)) return;

    setCreating(true);
    setResults(null);
    try {
      const customerCodes = [...selectedContatos];
      const voucherBranches = voucherBranchesStr
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const r = await fetch(`${API_BASE_URL}/api/tech/vouchers/create-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          branchCodeRegistration: Number(branchCodeRegistration),
          voucherType: Number(voucherType),
          prefixCode,
          printTemplateCode: Number(printTemplateCode),
          startDate,
          endDate,
          percentage: Number(percentage),
          voucherBranches: voucherBranches.length > 0 ? voucherBranches : [Number(branchCodeRegistration)],
          customerCodes,
          origem,
        }),
      });
      const j = await r.json();
      if (!r.ok || j?.success === false) throw new Error(j?.message || `HTTP ${r.status}`);
      setResults(j.data);
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleVerBatch = async (id) => {
    setLoadingBatches(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/tech/vouchers/batches/${id}`, {
        headers: { 'x-api-key': API_KEY },
      });
      const j = await r.json();
      setBatchDetail(j?.data || null);
    } finally {
      setLoadingBatches(false);
    }
  };

  const visiveisCount = selectedContatos.size;
  const podeCriar = visiveisCount > 0 && !!startDate && !!endDate && Number(percentage) > 0 && !!prefixCode;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto space-y-5">
        <PageTitle
          title="Criar Vouchers"
          subtitle="Cria vouchers de desconto em lote pra clientes do TOTVS"
          icon={Ticket}
        />

        {/* ABAS */}
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 w-fit shadow-sm">
          <button
            onClick={() => { setTab('criar'); setBatchDetail(null); }}
            className={`px-4 py-1.5 text-xs font-bold rounded ${tab === 'criar' ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Ticket size={14} weight="bold" className="inline mr-1" /> Criar
          </button>
          <button
            onClick={() => setTab('historico')}
            className={`px-4 py-1.5 text-xs font-bold rounded ${tab === 'historico' ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <ClockCounterClockwise size={14} weight="bold" className="inline mr-1" /> Histórico {batches.length > 0 && `(${batches.length})`}
          </button>
        </div>

        {/* ================ ABA CRIAR ================ */}
        {tab === 'criar' && (
          <>
            {/* 1. ORIGEM DOS CONTATOS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2">
                <MagnifyingGlass size={16} weight="bold" className="text-indigo-600" /> 1. Origem dos Contatos
              </h2>

              {/* Tabs origem */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setOrigem('totvs')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${origem === 'totvs' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <Database size={14} weight="bold" /> TOTVS (por operação)
                </button>
                <button
                  onClick={() => setOrigem('csv')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${origem === 'csv' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <Upload size={14} weight="bold" /> Upload CSV
                </button>
              </div>

              {origem === 'totvs' && (
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Operação Comercial</label>
                    <select
                      value={operacaoId}
                      onChange={(e) => setOperacaoId(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">Selecione...</option>
                      {operacoes.map((o) => (
                        <option key={o.id} value={o.id}>{o.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-7 flex items-end gap-2 flex-wrap">
                    <button onClick={() => applyQuickFilter('ativos')} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold hover:bg-green-100 flex items-center gap-1">
                      <Funnel size={12} /> Ativos (60d)
                    </button>
                    <button onClick={() => applyQuickFilter('inativos')} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100 flex items-center gap-1">
                      <Funnel size={12} /> Inativos (1 ano)
                    </button>
                    <button onClick={() => applyQuickFilter('6meses')} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold hover:bg-blue-100 flex items-center gap-1">
                      <Funnel size={12} /> 6 meses
                    </button>
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Início</label>
                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white" />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fim</label>
                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white" />
                  </div>
                  <div className="col-span-12 md:col-span-6 flex items-end">
                    <button
                      onClick={handleBuscarContatos}
                      disabled={loadingContatos}
                      className="w-full md:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {loadingContatos ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />}
                      {loadingContatos ? 'Buscando...' : 'Buscar Contatos'}
                    </button>
                  </div>
                </div>
              )}

              {origem === 'csv' && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">
                    Cole arquivo CSV (separador <code className="bg-gray-100 px-1 rounded">;</code> ou <code className="bg-gray-100 px-1 rounded">,</code>) com pelo menos a coluna <b>codigo</b> (ou <b>cd_pessoa</b>). Opcional: coluna <b>nome</b>.
                  </p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => handleCsvFile(e.target.files?.[0])}
                    className="text-sm"
                  />
                  {csvFile && contatos.length > 0 && (
                    <p className="text-xs text-emerald-700 mt-2 font-bold">
                      ✓ {contatos.length} contatos carregados do arquivo {csvFile.name}
                    </p>
                  )}
                  {csvErro && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mt-2">{csvErro}</p>
                  )}
                </div>
              )}

              {erro && origem === 'totvs' && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mt-3">{erro}</p>
              )}
            </div>

            {/* 2. CONFIG DO VOUCHER (só aparece se há contatos) */}
            {contatos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2">
                  <Ticket size={16} weight="bold" className="text-purple-600" /> 2. Configuração do Voucher
                </h2>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Filial Registro</label>
                    <input type="number" value={branchCodeRegistration} onChange={(e) => setBranchCodeRegistration(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Prefixo</label>
                    <input type="text" value={prefixCode} onChange={(e) => setPrefixCode(e.target.value.toUpperCase())} maxLength={10} className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono" />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Percent size={11} weight="bold" /> Desconto %</label>
                    <input type="number" min={1} max={100} value={percentage} onChange={(e) => setPercentage(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold text-purple-700" />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo</label>
                    <input type="number" value={voucherType} onChange={(e) => setVoucherType(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Print Template</label>
                    <input type="number" value={printTemplateCode} onChange={(e) => setPrintTemplateCode(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Filiais válidas</label>
                    <input type="text" value={voucherBranchesStr} onChange={(e) => setVoucherBranchesStr(e.target.value)} placeholder="ex: 95,2,87" className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono" />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><CalendarBlank size={11} /> Início validade</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><CalendarBlank size={11} /> Fim validade</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* 3. LISTA DE CONTATOS + AÇÃO */}
            {contatos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Buildings size={16} weight="bold" className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-gray-800">
                      {contatos.length} contatos · {visiveisCount} selecionados
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={selecionarTodos} className="text-[11px] px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50">Marcar todos</button>
                    <button onClick={desmarcarTodos} className="text-[11px] px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50">Desmarcar</button>
                    <button
                      onClick={handleCriarVouchers}
                      disabled={creating || !podeCriar}
                      className="text-xs px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {creating ? <Spinner size={14} className="animate-spin" /> : <PlayCircle size={14} weight="bold" />}
                      {creating ? 'Criando...' : `Criar ${visiveisCount} vouchers`}
                    </button>
                  </div>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b">
                        <th className="py-2.5 px-3 w-10"></th>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">CPF/CNPJ</th>
                        <th className="py-2.5 px-3">Telefone</th>
                        <th className="py-2.5 px-3 text-right">NFs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contatos.map((c) => (
                        <tr key={c.cd_pessoa} className="border-b border-gray-100 hover:bg-indigo-50/30">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selectedContatos.has(c.cd_pessoa)}
                              onChange={() => toggleContato(c.cd_pessoa)}
                              className="w-4 h-4 accent-purple-600"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-600">#{c.cd_pessoa}</td>
                          <td className="py-2 px-3 font-semibold text-gray-800 truncate max-w-[260px]">{c.name || '—'}</td>
                          <td className="py-2 px-3 text-xs font-mono text-gray-600">{fmtCNPJ(c.cpf_cnpj)}</td>
                          <td className="py-2 px-3 text-xs font-mono text-gray-600">{c.nr_telefone || '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-xs">{c.invoiceCount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. RESULTADOS */}
            {results && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-cyan-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-800">Resultado</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="font-bold text-emerald-700">{results.sucessos} sucessos</span> ·
                      <span className="font-bold text-rose-700 ml-1">{results.falhas} falhas</span> ·
                      <span className="ml-1">{results.total} total</span>
                      {results.batchId && <span className="ml-2 text-gray-400 font-mono">batch #{results.batchId}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => exportCSV(results.results)}
                    className="text-xs px-3 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    <Download size={12} weight="bold" /> Exportar CSV
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b">
                        <th className="py-2.5 px-3 w-10"></th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Voucher Number</th>
                        <th className="py-2.5 px-3">Voucher Code</th>
                        <th className="py-2.5 px-3">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((r) => (
                        <tr key={r.customerCode} className={`border-b border-gray-100 ${r.success ? '' : 'bg-rose-50/40'}`}>
                          <td className="py-2 px-3">
                            {r.success
                              ? <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                              : <XCircle size={16} weight="fill" className="text-rose-600" />}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs">#{r.customerCode}</td>
                          <td className="py-2 px-3 font-mono text-xs font-bold text-purple-700">{r.voucherNumber || '—'}</td>
                          <td className="py-2 px-3 font-mono text-xs">{r.voucherCode || '—'}</td>
                          <td className="py-2 px-3 text-xs text-rose-700">{r.error || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================ ABA HISTÓRICO ================ */}
        {tab === 'historico' && !batchDetail && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockCounterClockwise size={16} weight="fill" className="text-purple-600" />
                <h3 className="text-sm font-bold text-gray-800">Batches de vouchers criados</h3>
              </div>
              <button onClick={carregarHistorico} className="text-xs px-2 py-1 rounded hover:bg-white/60 text-gray-600">↻ Atualizar</button>
            </div>
            {loadingBatches ? (
              <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                <Spinner size={18} className="animate-spin" />
                <span className="text-xs">Carregando histórico...</span>
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Nenhum batch criado ainda.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b">
                    <th className="py-2.5 px-3">Quando</th>
                    <th className="py-2.5 px-3">Prefixo</th>
                    <th className="py-2.5 px-3">Validade</th>
                    <th className="py-2.5 px-3 text-right">%</th>
                    <th className="py-2.5 px-3">Origem</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Sucesso</th>
                    <th className="py-2.5 px-3 text-right">Falhas</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-purple-50/30">
                      <td className="py-2.5 px-3 text-xs text-gray-600">{new Date(b.created_at).toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 px-3 font-mono text-xs font-bold text-purple-700">{b.prefix_code}</td>
                      <td className="py-2.5 px-3 text-xs">{b.start_date} → {b.end_date}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-purple-700">{b.percentage}%</td>
                      <td className="py-2.5 px-3 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${b.origem === 'csv' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {b.origem?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{b.total_clientes}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-bold">{b.sucessos}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-rose-700 font-bold">{b.falhas}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => handleVerBatch(b.id)} className="p-1.5 rounded hover:bg-purple-100 text-purple-700" title="Ver detalhe">
                          <Eye size={14} weight="bold" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'historico' && batchDetail && (
          <div className="space-y-3">
            <button onClick={() => setBatchDetail(null)} className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5">
              <ArrowLeft size={14} /> Voltar pra lista
            </button>
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl px-5 py-4 shadow-md flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Batch #{batchDetail.id} · {batchDetail.prefix_code}</h2>
                <p className="text-xs text-purple-100 mt-0.5">
                  {batchDetail.start_date} → {batchDetail.end_date} · {batchDetail.percentage}% · {new Date(batchDetail.created_at).toLocaleString('pt-BR')}
                  {batchDetail.created_by && <> · {batchDetail.created_by}</>}
                </p>
                <p className="text-xs text-purple-100 mt-1">
                  ✅ {batchDetail.sucessos} sucessos · ❌ {batchDetail.falhas} falhas · {batchDetail.total_clientes} total
                </p>
              </div>
              <button
                onClick={() => exportCSV(batchDetail.resultados || [], `vouchers-batch-${batchDetail.id}.csv`)}
                className="text-xs px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 border border-white/20 flex items-center gap-1.5"
              >
                <Download size={14} weight="bold" /> Exportar CSV
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b">
                      <th className="py-2.5 px-3 w-10"></th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Voucher Number</th>
                      <th className="py-2.5 px-3">Voucher Code</th>
                      <th className="py-2.5 px-3">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batchDetail.resultados || []).map((r, idx) => (
                      <tr key={r.customerCode + ':' + idx} className={`border-b border-gray-100 ${r.success ? '' : 'bg-rose-50/40'}`}>
                        <td className="py-2 px-3">
                          {r.success
                            ? <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                            : <XCircle size={16} weight="fill" className="text-rose-600" />}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">#{r.customerCode}</td>
                        <td className="py-2 px-3 font-mono text-xs font-bold text-purple-700">{r.voucherNumber || '—'}</td>
                        <td className="py-2 px-3 font-mono text-xs">{r.voucherCode || '—'}</td>
                        <td className="py-2 px-3 text-xs text-rose-700">{r.error || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
