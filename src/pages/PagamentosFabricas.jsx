import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import {
  Package,
  Plus,
  PencilSimple,
  Trash,
  X,
  MagnifyingGlass,
  Export,
  Warning,
  Spinner,
  CurrencyDollar,
  CheckCircle,
  Buildings,
  IdentificationBadge,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ── Empresas permitidas ──────────────────────────────────────────────
const EMPRESAS = [
  { cd: 1, nome: 'CROSBY MATRIZ' },
  { cd: 99, nome: 'CROSBY BREJINHO' },
];

// ── Status (definidos no cadastro / editáveis por todos) ──────────────
const STATUS_CADASTRO = [
  'Aguardando Nota',
  'Pendente de Escrituração',
  'Aguardando Pagamento',
];
const STATUS_LIST = [...STATUS_CADASTRO, 'Pago'];

const STATUS_COLORS = {
  'Aguardando Nota': 'bg-blue-100 text-blue-800 border-blue-300',
  'Pendente de Escrituração': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Aguardando Pagamento': 'bg-orange-100 text-orange-800 border-orange-300',
  Pago: 'bg-green-100 text-green-800 border-green-300',
};

// ── Forma de pagamento (cadastro) ─────────────────────────────────────
const TIPOS_PAGAMENTO = [
  { valor: 'PIX', label: 'Chave PIX' },
  { valor: 'BOLETO', label: 'Boleto' },
  { valor: 'CARTAO', label: 'Cartão' },
];
const INFO_LABEL = { PIX: 'Chave PIX', BOLETO: 'Linha digitável do boleto', CARTAO: 'Cartão / observação' };
const FORMA_DISPLAY = { PIX: 'PIX', BOLETO: 'Boleto', CARTAO: 'Cartão', CREDITO: 'Cartão', DEBITO: 'Débito' };

const fmt = (v) =>
  v != null && v !== ''
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return dt.toLocaleDateString('pt-BR');
};

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

const formatCnpjCpf = (v) => {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// =====================================================================
// Busca de Fornecedor (CNPJ / Nome / Nome Fantasia) — usa pes_pessoa
// via /api/totvs/clientes/search-name (mesmo endpoint do Contas a Pagar)
// =====================================================================
const BuscaFornecedor = ({ fornecedor, onSelect }) => {
  const [tipo, setTipo] = useState('cnpj'); // cnpj | nome | fantasia
  const [termo, setTermo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setMostrarResultados(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const buscar = async () => {
    const t = termo.trim();
    if (!t) return;
    setBuscando(true);
    setResultados([]);
    try {
      let qp = '';
      if (tipo === 'nome') qp = `nome=${encodeURIComponent(t)}`;
      else if (tipo === 'fantasia') qp = `fantasia=${encodeURIComponent(t)}`;
      else qp = `cnpj=${encodeURIComponent(onlyDigits(t))}`;

      const resp = await fetch(`${API_BASE_URL}/api/totvs/clientes/search-name?${qp}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const lista = (data.success && data.data?.clientes ? data.data.clientes : []).map((f) => ({
        codigo: f.code != null ? String(f.code) : null,
        nome: f.nm_pessoa || f.fantasy_name || '',
        fantasia: f.fantasy_name || null,
        cnpj: f.cpf || null,
      }));
      if (lista.length === 0) {
        alert('Nenhum fornecedor encontrado com os critérios informados.');
      } else if (lista.length === 1) {
        selecionar(lista[0]);
      } else {
        setResultados(lista);
        setMostrarResultados(true);
      }
    } catch (err) {
      console.error('Erro ao buscar fornecedor:', err);
      alert('Erro ao buscar fornecedor. Tente novamente.');
    } finally {
      setBuscando(false);
    }
  };

  const selecionar = (f) => {
    onSelect(f);
    setMostrarResultados(false);
    setResultados([]);
    setTermo('');
  };

  const placeholders = {
    cnpj: '00.000.000/0000-00',
    nome: 'Razão social do fornecedor',
    fantasia: 'Nome fantasia',
  };

  return (
    <div className="relative" ref={boxRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">Fornecedor *</label>

      {/* Fornecedor selecionado */}
      {fornecedor?.nome ? (
        <div className="flex items-start gap-2 px-3 py-2.5 border-2 border-green-400 bg-green-50 rounded-lg">
          <CheckCircle size={18} weight="fill" className="text-green-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{fornecedor.nome}</p>
            <p className="text-[11px] text-gray-500">
              {fornecedor.codigo ? `Cód. ${fornecedor.codigo}` : ''}
              {fornecedor.cnpj ? ` • ${formatCnpjCpf(fornecedor.cnpj)}` : ''}
              {fornecedor.fantasia ? ` • ${fornecedor.fantasia}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="p-1 -mr-1 rounded hover:bg-green-100 text-gray-500 shrink-0"
            title="Limpar fornecedor"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-28 shrink-0 px-2 py-2.5 md:py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="cnpj">CNPJ/CPF</option>
              <option value="nome">Nome</option>
              <option value="fantasia">Fantasia</option>
            </select>
            <input
              type="text"
              value={tipo === 'cnpj' ? formatCnpjCpf(termo) : termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscar())}
              placeholder={placeholders[tipo]}
              maxLength={tipo === 'cnpj' ? 18 : undefined}
              className="flex-1 min-w-0 px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={buscar}
              disabled={buscando || !termo.trim()}
              className="shrink-0 flex items-center gap-1 px-3 py-2.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 text-sm font-medium"
            >
              {buscando ? <Spinner size={15} className="animate-spin" /> : <MagnifyingGlass size={15} />}
              <span className="hidden sm:inline">Buscar</span>
            </button>
          </div>
          <p className="mt-1 text-[10px] text-gray-400">
            Busque pelo CNPJ/CPF, nome (razão social) ou nome fantasia do fornecedor.
          </p>
        </>
      )}

      {/* Dropdown de resultados */}
      {mostrarResultados && resultados.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {resultados.map((f, i) => (
            <button
              type="button"
              key={`${f.codigo}-${i}`}
              onClick={() => selecionar(f)}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              <p className="text-sm font-medium text-gray-900 truncate">{f.nome}</p>
              <p className="text-[11px] text-gray-500">
                {f.codigo ? `Cód. ${f.codigo}` : ''}
                {f.cnpj ? ` • ${formatCnpjCpf(f.cnpj)}` : ''}
                {f.fantasia ? ` • ${f.fantasia}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const emptyForm = {
  cd_empresa: EMPRESAS[0].cd,
  fornecedor: null, // { codigo, nome, fantasia, cnpj }
  valor: '',
  data_lancamento: '',
  status: 'Aguardando Nota',
  tem_nota: false,
  transacao: '',
  nfe: '',
  tipo_pagamento: '',
  info_pagamento: '',
};

const PagamentosFabricas = () => {
  const { user } = useAuth?.() || { user: null };
  const role = user?.role || user?.user_metadata?.role;
  // Financeiro / administrador / proprietário podem liberar pagamento
  const isFinanceiro = role === 'owner' || role === 'admin' || role === 'user';
  const userNome =
    user?.name ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Usuário';

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalEditando, setModalEditando] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroEmpresa, setFiltroEmpresa] = useState('TODOS');
  const [processandoId, setProcessandoId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);

  const empresaNome = (cd) => EMPRESAS.find((e) => e.cd === Number(cd))?.nome || '';

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

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const dadosFiltrados = useMemo(() => {
    let filtered = [...dados];
    if (filtroStatus !== 'TODOS') filtered = filtered.filter((d) => d.status === filtroStatus);
    if (filtroEmpresa !== 'TODOS')
      filtered = filtered.filter((d) => Number(d.cd_empresa) === Number(filtroEmpresa));
    if (busca.trim()) {
      const q = busca.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.fornecedor?.toLowerCase().includes(q) ||
          d.fornecedor_cnpj?.toLowerCase().includes(q) ||
          d.nfe?.toLowerCase().includes(q) ||
          d.transacao?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [dados, filtroStatus, filtroEmpresa, busca]);

  const resumo = useMemo(() => {
    const total = dados.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const totalPago = dados
      .filter((d) => d.status === 'Pago')
      .reduce((s, d) => s + (Number(d.valor_pago ?? d.valor) || 0), 0);
    const pagos = dados.filter((d) => d.status === 'Pago').length;
    const pendentes = dados.filter((d) => d.status !== 'Pago').length;
    return { total, totalPago, pagos, pendentes, count: dados.length };
  }, [dados]);

  const abrirModal = () => {
    setModalEditando(null);
    setForm(emptyForm);
    setModalAberto(true);
  };

  const abrirEdicao = (item) => {
    setModalEditando(item.id);
    setForm({
      cd_empresa: item.cd_empresa ?? EMPRESAS[0].cd,
      fornecedor: item.fornecedor
        ? {
            codigo: item.fornecedor_codigo || null,
            nome: item.fornecedor,
            fantasia: null,
            cnpj: item.fornecedor_cnpj || null,
          }
        : null,
      valor: item.valor ?? '',
      data_lancamento: item.data_lancamento || '',
      status: item.status || 'Aguardando Nota',
      tem_nota: item.tem_nota ?? false,
      transacao: item.transacao || '',
      nfe: item.nfe || '',
      tipo_pagamento: item.tipo_pagamento || '',
      info_pagamento: item.info_pagamento || '',
    });
    setModalAberto(true);
  };

  // Validação do formulário
  const erroForm = useMemo(() => {
    if (!form.fornecedor?.nome) return 'Selecione o fornecedor.';
    if (form.valor === '' || Number(form.valor) <= 0) return 'Informe o valor.';
    if (!form.data_lancamento) return 'Informe a data de lançamento.';
    if (form.tem_nota) {
      if (!form.transacao.trim()) return 'Informe a transação.';
      if (!form.nfe.trim()) return 'Informe a nota fiscal.';
    }
    if (form.tipo_pagamento === 'PIX' && !form.info_pagamento.trim())
      return 'Informe a chave PIX.';
    if (form.tipo_pagamento === 'BOLETO' && !form.info_pagamento.trim())
      return 'Informe a linha digitável do boleto.';
    return null;
  }, [form]);

  const salvar = async () => {
    if (erroForm) {
      alert(erroForm);
      return;
    }
    setSalvando(true);
    const payload = {
      empresa: empresaNome(form.cd_empresa),
      cd_empresa: Number(form.cd_empresa),
      fornecedor: form.fornecedor.nome,
      fornecedor_cnpj: form.fornecedor.cnpj || null,
      fornecedor_codigo: form.fornecedor.codigo || null,
      valor: Number(form.valor),
      data_lancamento: form.data_lancamento || null,
      status: form.status,
      tem_nota: form.tem_nota,
      tem_transacao: form.tem_nota,
      transacao: form.tem_nota ? form.transacao.trim() || null : null,
      nfe: form.tem_nota ? form.nfe.trim() || null : null,
      tipo_pagamento: form.tipo_pagamento || null,
      info_pagamento: form.tipo_pagamento ? form.info_pagamento.trim() || null : null,
    };

    let error;
    if (modalEditando) {
      ({ error } = await supabase
        .from('pagamentos_fabricas')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', modalEditando));
    } else {
      ({ error } = await supabase.from('pagamentos_fabricas').insert(payload));
    }
    setSalvando(false);
    if (error) {
      alert('Erro ao salvar: ' + error.message);
      return;
    }
    setModalAberto(false);
    carregarDados();
  };

  // Alterar status inline (editável por todos)
  const alterarStatus = async (item, novoStatus) => {
    if (novoStatus === item.status) return;
    const { error } = await supabase
      .from('pagamentos_fabricas')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) {
      alert('Erro ao alterar status: ' + error.message);
      return;
    }
    setDados((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: novoStatus } : d)));
  };

  const excluir = async (id) => {
    if (!confirm('Deseja excluir este lançamento?')) return;
    const { error } = await supabase.from('pagamentos_fabricas').delete().eq('id', id);
    if (error) return alert('Erro ao excluir: ' + error.message);
    carregarDados();
  };

  // ── Liberar para pagamento (cria row em pagamentos_liberacao) ────────
  const liberarPagamento = async (item) => {
    if (!isFinanceiro) {
      alert('Apenas o financeiro pode liberar o pagamento.');
      return;
    }
    if (item.pagamento_liberacao_id) {
      alert('Este lançamento já foi liberado para pagamento.');
      return;
    }
    if (!item.valor) {
      alert('O lançamento precisa de um valor para ser liberado.');
      return;
    }
    if (
      !window.confirm(
        `Liberar o pagamento de ${item.fornecedor || ''} (${fmt(item.valor)}) para a fila de Liberação de Pagamento?`
      )
    )
      return;

    setProcessandoId(item.id);
    const now = new Date().toISOString();
    const tp = item.tipo_pagamento;
    const formaLib = tp === 'PIX' ? 'PIX' : tp === 'BOLETO' ? 'BOLETO' : tp === 'CARTAO' ? 'CREDITO' : null;

    const row = {
      status: 'PENDENTE',
      nm_empresa: item.empresa,
      cd_empresa: item.cd_empresa,
      nm_fornecedor: item.fornecedor,
      cd_fornecedor: item.fornecedor_codigo || null,
      nr_duplicata: item.nfe || item.transacao || null,
      dt_emissao: item.data_lancamento || null,
      dt_vencimento: item.data_lancamento || null,
      vl_duplicata: Number(item.valor),
      forma_pagamento: formaLib,
      chave_pix: tp === 'PIX' ? item.info_pagamento || null : null,
      codigo_barras: tp === 'BOLETO' ? item.info_pagamento || null : null,
      link_pagamento: tp === 'CARTAO' ? item.info_pagamento || null : null,
      observacao: `Pagamento Fábrica${item.transacao ? ` • Transação ${item.transacao}` : ''}`,
      enviado_por: user?.email || null,
      enviado_em: now,
      dados_completos: {
        origem: 'pagamento_fabrica',
        pagamento_fabrica_id: item.id,
        fornecedor_cnpj: item.fornecedor_cnpj || null,
        transacao: item.transacao || null,
        nfe: item.nfe || null,
      },
    };

    const { data: novo, error: errIns } = await supabase
      .from('pagamentos_liberacao')
      .insert([row])
      .select('id')
      .single();
    if (errIns) {
      setProcessandoId(null);
      alert('Erro ao liberar pagamento: ' + errIns.message);
      return;
    }

    const patch = {
      pagamento_liberacao_id: novo.id,
      liberado_pagamento_em: now,
      liberado_pagamento_por: user?.id || null,
      liberado_pagamento_por_nome: userNome,
      status: 'Aguardando Pagamento',
      updated_at: now,
    };
    const { error: errUpd } = await supabase
      .from('pagamentos_fabricas')
      .update(patch)
      .eq('id', item.id);
    setProcessandoId(null);
    if (errUpd) {
      alert('Pagamento liberado, mas houve erro ao vincular: ' + errUpd.message);
    }
    setDados((prev) => prev.map((d) => (d.id === item.id ? { ...d, ...patch } : d)));
  };

  const exportarExcel = () => {
    const rows = dadosFiltrados.map((d) => ({
      Empresa: d.empresa,
      Fornecedor: d.fornecedor,
      'CNPJ/CPF': d.fornecedor_cnpj || '',
      Valor: d.valor,
      Transação: d.transacao || '',
      'Nota Fiscal': d.nfe || '',
      Lançamento: d.data_lancamento ? fmtDate(d.data_lancamento) : '',
      'Forma (cadastro)': d.tipo_pagamento ? FORMA_DISPLAY[d.tipo_pagamento] || d.tipo_pagamento : '',
      Status: d.status,
      'Forma Pago': d.forma ? FORMA_DISPLAY[d.forma] || d.forma : '',
      'Valor Pago': d.valor_pago,
      'Data Pagamento': d.data_pagamento ? fmtDate(d.data_pagamento) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos Fábricas');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), 'pagamentos_fabricas.xlsx');
  };

  const StatusBadge = ({ status }) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-600 border-gray-300'
      }`}
    >
      {status === 'Aguardando Nota' && <Warning size={11} />}
      {status === 'Pago' && <CheckCircle size={11} weight="fill" />}
      {status}
    </span>
  );

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
          <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Em Aberto</p>
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
              placeholder="Buscar fornecedor, CNPJ, NF, transação..."
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
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="w-full md:w-auto px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todas Empresas</option>
              {EMPRESAS.map((e) => (
                <option key={e.cd} value={e.cd}>
                  {e.nome} - {e.cd}
                </option>
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
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-2 text-sm bg-[#000638] text-white rounded-lg hover:bg-[#fe0000] transition-colors font-medium"
            >
              <Plus size={16} weight="bold" /> Novo
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Tabela */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-[#000638] text-white sticky top-0">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Empresa</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Fornecedor</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide">Valor</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Transação</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Nota Fiscal</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Lançamento</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide">Pagamento</th>
                <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Carregando...
                    </div>
                  </td>
                </tr>
              ) : dadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map((d) => {
                  const pago = d.status === 'Pago';
                  const liberado = !!d.pagamento_liberacao_id;
                  return (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-gray-800">{empresaNome(d.cd_empresa) || d.empresa}</span>
                        <span className="block text-[10px] text-gray-400">Cód. {d.cd_empresa}</span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <span className="font-medium text-gray-900 truncate block" title={d.fornecedor}>
                          {d.fornecedor}
                        </span>
                        {d.fornecedor_cnpj && (
                          <span className="block text-[10px] text-gray-400 font-mono">
                            {formatCnpjCpf(d.fornecedor_cnpj)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold text-gray-900">
                        {fmt(d.valor)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-700">{d.transacao || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-700">{d.nfe || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{fmtDate(d.data_lancamento)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {pago ? (
                          <StatusBadge status={d.status} />
                        ) : (
                          <select
                            value={d.status}
                            onChange={(e) => alterarStatus(d, e.target.value)}
                            className={`text-[11px] font-bold border rounded-full px-2 py-0.5 cursor-pointer focus:ring-2 focus:ring-blue-500 ${
                              STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600 border-gray-300'
                            }`}
                            title="Alterar status"
                          >
                            {STATUS_CADASTRO.map((s) => (
                              <option key={s} value={s} className="bg-white text-gray-800">
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {pago ? (
                          <div className="text-[11px] leading-tight">
                            <span className="font-semibold text-green-700">{fmt(d.valor_pago ?? d.valor)}</span>
                            <span className="block text-gray-500">
                              {d.forma ? FORMA_DISPLAY[d.forma] || d.forma : '—'} • {fmtDate(d.data_pagamento)}
                            </span>
                          </div>
                        ) : liberado ? (
                          <span className="text-[10px] text-blue-600 font-semibold">Em liberação</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {isFinanceiro && !pago && !liberado && (
                            <button
                              onClick={() => liberarPagamento(d)}
                              disabled={processandoId === d.id}
                              title="Liberar para pagamento"
                              className="flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white text-[11px] font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {processandoId === d.id ? (
                                <Spinner size={13} className="animate-spin" />
                              ) : (
                                <CurrencyDollar size={13} weight="bold" />
                              )}
                              Liberar
                            </button>
                          )}
                          <button
                            onClick={() => abrirEdicao(d)}
                            title="Editar"
                            className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                          >
                            <PencilSimple size={16} />
                          </button>
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
                  );
                })
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
            {dadosFiltrados.map((d) => {
              const pago = d.status === 'Pago';
              const liberado = !!d.pagamento_liberacao_id;
              return (
                <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-3.5 pt-3 pb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.fornecedor}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {empresaNome(d.cd_empresa) || d.empresa}
                      </p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="px-3.5 pb-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Valor:</span>
                        <span className="font-semibold text-gray-900">{fmt(d.valor)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Lanç.:</span>
                        <span className="text-gray-700">{fmtDate(d.data_lancamento)}</span>
                      </div>
                      {d.transacao && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Transação:</span>
                          <span className="font-mono text-gray-700">{d.transacao}</span>
                        </div>
                      )}
                      {d.nfe && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">NF:</span>
                          <span className="font-mono text-gray-700">{d.nfe}</span>
                        </div>
                      )}
                      {pago && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pago:</span>
                            <span className="font-semibold text-green-700">{fmt(d.valor_pago ?? d.valor)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pgto:</span>
                            <span className="text-gray-700">
                              {d.forma ? FORMA_DISPLAY[d.forma] || d.forma : ''} {fmtDate(d.data_pagamento)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
                    {isFinanceiro && !pago && !liberado && (
                      <button
                        onClick={() => liberarPagamento(d)}
                        disabled={processandoId === d.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-green-700 font-medium hover:bg-green-50 active:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <CurrencyDollar size={15} weight="bold" /> Liberar
                      </button>
                    )}
                    {liberado && !pago && (
                      <span className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 font-medium">
                        Em liberação
                      </span>
                    )}
                    <button
                      onClick={() => abrirEdicao(d)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      <PencilSimple size={15} /> Editar
                    </button>
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
              );
            })}
            <div className="text-center text-xs text-gray-400 py-2">
              {dadosFiltrados.length} de {dados.length} lançamentos
            </div>
          </>
        )}
      </div>

      {/* FAB mobile */}
      <button
        onClick={abrirModal}
        className="md:hidden fixed bottom-6 right-4 w-14 h-14 bg-[#000638] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[#fe0000] active:bg-blue-800 transition-colors z-40"
      >
        <Plus size={24} weight="bold" />
      </button>

      {/* Modal Novo/Editar */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="bg-white w-full max-h-[92vh] md:max-h-[88vh] rounded-t-2xl md:rounded-2xl shadow-xl md:max-w-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-0 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">
                {modalEditando ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="p-2 -mr-1 rounded-lg hover:bg-gray-100 active:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-4 md:px-6 py-4 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Empresa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Buildings size={14} className="inline mr-1 -mt-0.5" />
                  Empresa *
                </label>
                <select
                  value={form.cd_empresa}
                  onChange={(e) => setForm({ ...form, cd_empresa: Number(e.target.value) })}
                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {EMPRESAS.map((e) => (
                    <option key={e.cd} value={e.cd}>
                      {e.nome} - {e.cd}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fornecedor */}
              <BuscaFornecedor
                fornecedor={form.fornecedor}
                onSelect={(f) => setForm({ ...form, fornecedor: f })}
              />

              {/* Valor + Data */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    placeholder="0,00"
                    className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data de Lançamento *</label>
                  <input
                    type="date"
                    value={form.data_lancamento}
                    onChange={(e) => setForm({ ...form, data_lancamento: e.target.value })}
                    className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status *</label>
                <select
                  value={form.status === 'Pago' ? 'Aguardando Pagamento' : form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  disabled={form.status === 'Pago'}
                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-60"
                >
                  {STATUS_CADASTRO.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {form.status === 'Pago' && (
                  <p className="mt-1 text-[10px] text-green-600 font-semibold">
                    Lançamento já pago pela Liberação de Pagamento.
                  </p>
                )}
              </div>

              {/* Flag tem nota fiscal */}
              <div>
                <label className="flex items-center gap-2.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.tem_nota}
                    onChange={(e) => setForm({ ...form, tem_nota: e.target.checked })}
                    className="w-5 h-5 md:w-4 md:h-4 rounded border-gray-300 text-blue-600"
                  />
                  Tem nota fiscal?
                </label>
                {form.tem_nota && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Transação *</label>
                      <input
                        type="text"
                        value={form.transacao}
                        onChange={(e) => setForm({ ...form, transacao: e.target.value })}
                        placeholder="Nº da transação"
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota Fiscal *</label>
                      <input
                        type="text"
                        value={form.nfe}
                        onChange={(e) => setForm({ ...form, nfe: e.target.value })}
                        placeholder="Nº da nota fiscal"
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
                {!form.tem_nota && (
                  <p className="mt-1.5 text-[10px] text-gray-400 flex items-center gap-1">
                    <Warning size={12} /> Sem nota fiscal informada.
                  </p>
                )}
              </div>

              {/* Forma de pagamento */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <IdentificationBadge size={14} className="inline mr-1 -mt-0.5" />
                    Forma de Pagamento
                  </label>
                  <select
                    value={form.tipo_pagamento}
                    onChange={(e) => setForm({ ...form, tipo_pagamento: e.target.value, info_pagamento: '' })}
                    className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Selecione</option>
                    {TIPOS_PAGAMENTO.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {form.tipo_pagamento && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {INFO_LABEL[form.tipo_pagamento]}
                      {form.tipo_pagamento !== 'CARTAO' ? ' *' : ''}
                    </label>
                    <input
                      type="text"
                      value={form.info_pagamento}
                      onChange={(e) => setForm({ ...form, info_pagamento: e.target.value })}
                      placeholder={INFO_LABEL[form.tipo_pagamento]}
                      className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {erroForm && (
                <p className="text-[12px] text-amber-600 font-semibold flex items-center gap-1">
                  <Warning size={14} /> {erroForm}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl safe-area-pb">
              <button
                onClick={() => setModalAberto(false)}
                className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={!!erroForm || salvando}
                className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm text-white bg-[#000638] rounded-lg hover:bg-[#fe0000] active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {salvando && <Spinner size={15} className="animate-spin" />}
                {modalEditando ? 'Salvar Alterações' : 'Adicionar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PagamentosFabricas;
