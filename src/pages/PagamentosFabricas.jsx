import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import PageTitle from '../components/ui/PageTitle';
import {
  Package,
  Plus,
  PencilSimple,
  Trash,
  X,
  Check,
  CaretUp,
  CaretDown,
  MagnifyingGlass,
  Export,
  Warning,
  FunnelSimple,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const STATUS_COLORS = {
  Pago: 'bg-green-100 text-green-800 border-green-300',
  Pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Parcial: 'bg-orange-100 text-orange-800 border-orange-300',
  Divergente: 'bg-red-100 text-red-800 border-red-300',
  Duplicado: 'bg-pink-100 text-pink-800 border-pink-300',
  'Aguardando Nota': 'bg-blue-100 text-blue-800 border-blue-300',
};

const EMPRESAS = ['Crosby brejinho', 'Crosby Matriz'];
const STATUS_LIST = ['Pendente', 'Pago', 'Parcial', 'Divergente', 'Duplicado', 'Aguardando Nota'];
const FORMAS = ['PIX', 'Cartão', 'Boleto'];

const fmt = (v) =>
  v != null
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('pt-BR');
};

const PagamentosFabricas = () => {
  const { user, hasRole } = useAuth?.() || { user: null, hasRole: () => false };
  const isFinanceiro = hasRole('owner') || hasRole('admin') || hasRole('manager');

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalEditando, setModalEditando] = useState(null);
  const [modalFinanceiro, setModalFinanceiro] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroEmpresa, setFiltroEmpresa] = useState('TODOS');
  const [sortConfig, setSortConfig] = useState({ key: 'data_lancamento', direction: 'desc' });

  const [form, setForm] = useState({
    empresa: EMPRESAS[0],
    transacao: '',
    fornecedor: '',
    nfe: '',
    valor: '',
    data_lancamento: '',
    tem_nota: true,
    tem_transacao: true,
  });

  const [formFin, setFormFin] = useState({
    status: 'Pendente',
    data_pagamento: '',
    forma: '',
    cartao_conta: '',
    parcelas: '',
    valor_pago: '',
    observacao: '',
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pagamentos_fabricas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar pagamentos_fabricas:', error);
      setDados([]);
    } else {
      setDados(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const dadosFiltrados = useMemo(() => {
    let filtered = [...dados];
    if (filtroStatus !== 'TODOS') filtered = filtered.filter((d) => d.status === filtroStatus);
    if (filtroEmpresa !== 'TODOS') filtered = filtered.filter((d) => d.empresa === filtroEmpresa);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.fornecedor?.toLowerCase().includes(q) ||
          d.nfe?.toLowerCase().includes(q) ||
          d.transacao?.toLowerCase().includes(q) ||
          d.observacao?.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => {
      const va = a[sortConfig.key];
      const vb = b[sortConfig.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortConfig.direction === 'asc' ? -1 : 1;
      if (va > vb) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [dados, filtroStatus, filtroEmpresa, busca, sortConfig]);

  const resumo = useMemo(() => {
    const total = dados.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const totalPago = dados.reduce((s, d) => s + (Number(d.valor_pago) || 0), 0);
    const pendentes = dados.filter((d) => d.status === 'Pendente' || d.status === 'Aguardando Nota').length;
    const pagos = dados.filter((d) => d.status === 'Pago').length;
    return { total, totalPago, pendentes, pagos, count: dados.length };
  }, [dados]);

  const abrirModal = () => {
    setModalEditando(null);
    setForm({ empresa: EMPRESAS[0], transacao: '', fornecedor: '', nfe: '', valor: '', data_lancamento: '', tem_nota: true, tem_transacao: true });
    setModalAberto(true);
  };

  const abrirEdicao = (item) => {
    setModalEditando(item.id);
    setForm({
      empresa: item.empresa || EMPRESAS[0],
      transacao: item.transacao || '',
      fornecedor: item.fornecedor || '',
      nfe: item.nfe || '',
      valor: item.valor ?? '',
      data_lancamento: item.data_lancamento || '',
      tem_nota: item.tem_nota ?? true,
      tem_transacao: item.tem_transacao ?? true,
    });
    setModalAberto(true);
  };

  const abrirFinanceiro = (item) => {
    setModalFinanceiro(item.id);
    setFormFin({
      status: item.status || 'Pendente',
      data_pagamento: item.data_pagamento || '',
      forma: item.forma || '',
      cartao_conta: item.cartao_conta || '',
      parcelas: item.parcelas ?? '',
      valor_pago: item.valor_pago ?? '',
      observacao: item.observacao || '',
    });
  };

  const salvar = async () => {
    const payload = {
      empresa: form.empresa,
      fornecedor: form.fornecedor,
      transacao: form.tem_transacao ? form.transacao || null : null,
      nfe: form.tem_nota ? form.nfe || null : null,
      valor: form.valor ? Number(form.valor) : null,
      data_lancamento: form.data_lancamento || null,
      tem_nota: form.tem_nota,
      tem_transacao: form.tem_transacao,
      status: !form.tem_nota || !form.tem_transacao ? 'Aguardando Nota' : 'Pendente',
    };

    if (modalEditando) {
      const { error } = await supabase.from('pagamentos_fabricas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modalEditando);
      if (error) return alert('Erro ao atualizar: ' + error.message);
    } else {
      const { error } = await supabase.from('pagamentos_fabricas').insert(payload);
      if (error) return alert('Erro ao inserir: ' + error.message);
    }
    setModalAberto(false);
    carregarDados();
  };

  const salvarFinanceiro = async () => {
    const payload = {
      status: formFin.status,
      data_pagamento: formFin.data_pagamento || null,
      forma: formFin.forma || null,
      cartao_conta: formFin.cartao_conta || null,
      parcelas: formFin.parcelas ? Number(formFin.parcelas) : null,
      valor_pago: formFin.valor_pago ? Number(formFin.valor_pago) : null,
      observacao: formFin.observacao || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('pagamentos_fabricas').update(payload).eq('id', modalFinanceiro);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    setModalFinanceiro(null);
    carregarDados();
  };

  const completarNota = async (item) => {
    setModalEditando(item.id);
    setForm({
      empresa: item.empresa || EMPRESAS[0],
      transacao: item.transacao || '',
      fornecedor: item.fornecedor || '',
      nfe: item.nfe || '',
      valor: item.valor ?? '',
      data_lancamento: item.data_lancamento || '',
      tem_nota: true,
      tem_transacao: true,
    });
    setModalAberto(true);
  };

  const excluir = async (id) => {
    if (!confirm('Deseja excluir este lançamento?')) return;
    const { error } = await supabase.from('pagamentos_fabricas').delete().eq('id', id);
    if (error) return alert('Erro ao excluir: ' + error.message);
    carregarDados();
  };

  const exportarExcel = () => {
    const rows = dadosFiltrados.map((d) => ({
      Empresa: d.empresa,
      Transação: d.transacao,
      Fornecedor: d.fornecedor,
      NFE: d.nfe,
      Valor: d.valor,
      'Data Lanç.': d.data_lancamento ? fmtDate(d.data_lancamento) : '',
      Status: d.status,
      'Data Pgto': d.data_pagamento ? fmtDate(d.data_pagamento) : '',
      Forma: d.forma,
      'Cartão/Conta': d.cartao_conta,
      Parcelas: d.parcelas,
      'Valor Pago': d.valor_pago,
      Observação: d.observacao,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos Fábricas');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), 'pagamentos_fabricas.xlsx');
  };

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return null;
    return sortConfig.direction === 'asc' ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle title="Pagamentos Fábricas" icon={Package} />

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4 mb-4 md:mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Total Lançado</p>
          <p className="text-base md:text-xl font-bold text-gray-900 mt-0.5">{fmt(resumo.total)}</p>
          <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{resumo.count} lançamentos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Total Pago</p>
          <p className="text-base md:text-xl font-bold text-green-600 mt-0.5">{fmt(resumo.totalPago)}</p>
          <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{resumo.pagos} pagos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Saldo Pendente</p>
          <p className="text-base md:text-xl font-bold text-orange-600 mt-0.5">{fmt(resumo.total - resumo.totalPago)}</p>
          <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{resumo.pendentes} pendentes</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">% Pago</p>
          <p className="text-base md:text-xl font-bold text-blue-600 mt-0.5">
            {resumo.total > 0 ? ((resumo.totalPago / resumo.total) * 100).toFixed(1) + '%' : '0%'}
          </p>
        </div>
      </div>

      {/* Filtros e Ações */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4 mb-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
          <div className="relative flex-1 min-w-0 md:min-w-[200px]">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar fornecedor, NFE, transação..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:contents">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full md:w-auto px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos os Status</option>
              {STATUS_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="w-full md:w-auto px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todas Empresas</option>
              {EMPRESAS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 md:contents">
            <button
              onClick={exportarExcel}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 md:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Export size={16} /> Exportar
            </button>
            <button
              onClick={abrirModal}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus size={16} weight="bold" /> Novo
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Tabela */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th colSpan={6} className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 text-left uppercase tracking-wide">Expedição</th>
                <th colSpan={7} className="px-3 py-2 text-xs font-semibold text-green-700 bg-green-50 text-left uppercase tracking-wide">Financeiro</th>
                <th className="px-3 py-2 bg-gray-50"></th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[
                  { key: 'empresa', label: 'Empresa', bg: 'bg-blue-50/50' },
                  { key: 'transacao', label: 'Transação', bg: 'bg-blue-50/50' },
                  { key: 'fornecedor', label: 'Fornecedor', bg: 'bg-blue-50/50' },
                  { key: 'nfe', label: 'NFE', bg: 'bg-blue-50/50' },
                  { key: 'valor', label: 'Valor', bg: 'bg-blue-50/50' },
                  { key: 'data_lancamento', label: 'Data Lanç.', bg: 'bg-blue-50/50' },
                  { key: 'status', label: 'Status', bg: 'bg-green-50/50' },
                  { key: 'data_pagamento', label: 'Data Pgto', bg: 'bg-green-50/50' },
                  { key: 'forma', label: 'Forma', bg: 'bg-green-50/50' },
                  { key: 'cartao_conta', label: 'Cartão/Conta', bg: 'bg-green-50/50' },
                  { key: 'parcelas', label: 'Parc.', bg: 'bg-green-50/50' },
                  { key: 'valor_pago', label: 'Valor Pago', bg: 'bg-green-50/50' },
                  { key: 'observacao', label: 'Obs.', bg: 'bg-green-50/50' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap ${col.bg}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label} <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Carregando...
                    </div>
                  </td>
                </tr>
              ) : dadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-gray-400">Nenhum lançamento encontrado</td>
                </tr>
              ) : (
                dadosFiltrados.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{d.empresa}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono">{d.transacao || '—'}</td>
                    <td className="px-3 py-2.5 text-xs max-w-[200px] truncate" title={d.fornecedor}>{d.fornecedor}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono">{d.nfe || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-right">{fmt(d.valor)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtDate(d.data_lancamento)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                        {d.status === 'Aguardando Nota' && <Warning size={12} className="mr-1" />}
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtDate(d.data_pagamento)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{d.forma || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{d.cartao_conta || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-center">{d.parcelas || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-right text-green-700">{fmt(d.valor_pago)}</td>
                    <td className="px-3 py-2.5 text-xs max-w-[180px] truncate text-gray-500" title={d.observacao}>{d.observacao || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        {d.status === 'Aguardando Nota' && (
                          <button
                            onClick={() => completarNota(d)}
                            title="Completar dados da nota/transação"
                            className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                          >
                            <Warning size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => abrirEdicao(d)}
                          title="Editar lançamento"
                          className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                        >
                          <PencilSimple size={16} />
                        </button>
                        {isFinanceiro && (
                          <button
                            onClick={() => abrirFinanceiro(d)}
                            title="Preencher dados financeiros"
                            className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        {isFinanceiro && (
                          <button
                            onClick={() => excluir(d.id)}
                            title="Excluir"
                            className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          {dadosFiltrados.length} de {dados.length} lançamentos
        </div>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : dadosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum lançamento encontrado</div>
        ) : (
          <>
            {dadosFiltrados.map((d) => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header do card */}
                <div className="px-3.5 pt-3 pb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.fornecedor}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{d.empresa}</p>
                  </div>
                  <span className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                    {d.status === 'Aguardando Nota' && <Warning size={11} className="mr-0.5" />}
                    {d.status}
                  </span>
                </div>

                {/* Valores principais */}
                <div className="px-3.5 pb-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Valor:</span>
                      <span className="font-semibold text-gray-900">{fmt(d.valor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pago:</span>
                      <span className="font-semibold text-green-700">{fmt(d.valor_pago)}</span>
                    </div>
                    {d.transacao && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Transação:</span>
                        <span className="font-mono text-gray-700">{d.transacao}</span>
                      </div>
                    )}
                    {d.nfe && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">NFE:</span>
                        <span className="font-mono text-gray-700">{d.nfe}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lanç.:</span>
                      <span className="text-gray-700">{fmtDate(d.data_lancamento)}</span>
                    </div>
                    {d.data_pagamento && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pgto:</span>
                        <span className="text-gray-700">{fmtDate(d.data_pagamento)}</span>
                      </div>
                    )}
                    {d.forma && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Forma:</span>
                        <span className="text-gray-700">{d.forma}{d.parcelas ? ` (${d.parcelas}x)` : ''}</span>
                      </div>
                    )}
                    {d.cartao_conta && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Conta:</span>
                        <span className="text-gray-700 truncate ml-1">{d.cartao_conta}</span>
                      </div>
                    )}
                  </div>
                  {d.observacao && (
                    <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2 italic">{d.observacao}</p>
                  )}
                </div>

                {/* Ações do card */}
                <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
                  {d.status === 'Aguardando Nota' && (
                    <button
                      onClick={() => completarNota(d)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                    >
                      <Warning size={15} /> Completar
                    </button>
                  )}
                  <button
                    onClick={() => abrirEdicao(d)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <PencilSimple size={15} /> Editar
                  </button>
                  {isFinanceiro && (
                    <button
                      onClick={() => abrirFinanceiro(d)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-green-600 hover:bg-green-50 active:bg-green-100 transition-colors"
                    >
                      <Check size={15} /> Financeiro
                    </button>
                  )}
                  {isFinanceiro && (
                    <button
                      onClick={() => excluir(d.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                    >
                      <Trash size={15} /> Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="text-center text-xs text-gray-400 py-2">
              {dadosFiltrados.length} de {dados.length} lançamentos
            </div>
          </>
        )}
      </div>

      {/* FAB - Botão flutuante mobile */}
      <button
        onClick={abrirModal}
        className="md:hidden fixed bottom-6 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:bg-blue-800 transition-colors z-40"
      >
        <Plus size={24} weight="bold" />
      </button>

      {/* Modal Novo/Editar Lançamento (Expedição) */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4" onClick={() => setModalAberto(false)}>
          <div
            className="bg-white w-full max-h-[92vh] md:max-h-[85vh] rounded-t-2xl md:rounded-2xl shadow-xl md:max-w-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle mobile */}
            <div className="flex justify-center pt-2 pb-0 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">
                {modalEditando ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h3>
              <button onClick={() => setModalAberto(false)} className="p-2 -mr-1 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                <X size={20} />
              </button>
            </div>
            <div className="px-4 md:px-6 py-4 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Empresa *</label>
                <select
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                >
                  {EMPRESAS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2.5 text-sm text-gray-700">
                  <input type="checkbox" checked={form.tem_transacao} onChange={(e) => setForm({ ...form, tem_transacao: e.target.checked })} className="w-5 h-5 md:w-4 md:h-4 rounded border-gray-300 text-blue-600" />
                  Tem transação?
                </label>
                <label className="flex items-center gap-2.5 text-sm text-gray-700">
                  <input type="checkbox" checked={form.tem_nota} onChange={(e) => setForm({ ...form, tem_nota: e.target.checked })} className="w-5 h-5 md:w-4 md:h-4 rounded border-gray-300 text-blue-600" />
                  Tem nota fiscal?
                </label>
              </div>

              {!form.tem_transacao && !form.tem_nota && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <Warning size={16} className="shrink-0 mt-0.5" />
                  <span>O lançamento ficará com status "Aguardando Nota" até os dados serem preenchidos.</span>
                </div>
              )}

              {form.tem_transacao && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Transação</label>
                  <input type="text" value={form.transacao} onChange={(e) => setForm({ ...form, transacao: e.target.value })} placeholder="Nº da transação" className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Fornecedor *</label>
                <input type="text" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} placeholder="Nome do fornecedor" className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>

              {form.tem_nota && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">NFE</label>
                  <input type="text" value={form.nfe} onChange={(e) => setForm({ ...form, nfe: e.target.value })} placeholder="Nº da nota fiscal" className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor (R$)</label>
                  <input type="number" step="0.01" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data Lançamento</label>
                  <input type="date" value={form.data_lancamento} onChange={(e) => setForm({ ...form, data_lancamento: e.target.value })} className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl safe-area-pb">
              <button onClick={() => setModalAberto(false)} className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors">Cancelar</button>
              <button
                onClick={salvar}
                disabled={!form.fornecedor || !form.empresa}
                className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {modalEditando ? 'Salvar Alterações' : 'Adicionar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Financeiro */}
      {modalFinanceiro && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4" onClick={() => setModalFinanceiro(null)}>
          <div
            className="bg-white w-full max-h-[92vh] md:max-h-[85vh] rounded-t-2xl md:rounded-2xl shadow-xl md:max-w-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle mobile */}
            <div className="flex justify-center pt-2 pb-0 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">Dados do Financeiro</h3>
              <button onClick={() => setModalFinanceiro(null)} className="p-2 -mr-1 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                <X size={20} />
              </button>
            </div>
            <div className="px-4 md:px-6 py-4 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={formFin.status}
                  onChange={(e) => setFormFin({ ...formFin, status: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 bg-white appearance-none"
                >
                  {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data Pagamento</label>
                  <input type="date" value={formFin.data_pagamento} onChange={(e) => setFormFin({ ...formFin, data_pagamento: e.target.value })} className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Forma</label>
                  <select
                    value={formFin.forma}
                    onChange={(e) => setFormFin({ ...formFin, forma: e.target.value })}
                    className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 bg-white appearance-none"
                  >
                    <option value="">Selecione</option>
                    {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cartão/Conta</label>
                <input type="text" value={formFin.cartao_conta} onChange={(e) => setFormFin({ ...formFin, cartao_conta: e.target.value })} placeholder="Ex: NUBANK SARA, STONE - 1007" className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Parcelas</label>
                  <input type="number" inputMode="numeric" value={formFin.parcelas} onChange={(e) => setFormFin({ ...formFin, parcelas: e.target.value })} placeholder="Qtd." className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor Pago (R$)</label>
                  <input type="number" step="0.01" inputMode="decimal" value={formFin.valor_pago} onChange={(e) => setFormFin({ ...formFin, valor_pago: e.target.value })} placeholder="0,00" className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Observação</label>
                <textarea value={formFin.observacao} onChange={(e) => setFormFin({ ...formFin, observacao: e.target.value })} rows={3} placeholder="Detalhes extras..." className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl safe-area-pb">
              <button onClick={() => setModalFinanceiro(null)} className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors">Cancelar</button>
              <button onClick={salvarFinanceiro} className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PagamentosFabricas;
