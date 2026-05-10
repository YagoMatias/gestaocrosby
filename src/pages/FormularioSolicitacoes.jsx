import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ClipboardText,
  ShoppingCart,
  Wrench,
  CurrencyCircleDollar,
  CheckCircle,
  Spinner,
  Storefront,
  User,
  Buildings,
  Warning,
  PaperPlaneTilt,
  CalendarBlank,
  Money,
  Plus,
  Trash,
  CaretDown,
  CaretUp,
  Hash,
  IdentificationBadge,
  FileText,
  MagnifyingGlass,
  XCircle,
  Receipt,
  CreditCard,
  Link as LinkIcon,
  Image as ImageIcon,
  Phone,
  UploadSimple,
} from '@phosphor-icons/react';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { API_BASE_URL } from '../config/constants';
import CENTROS_CUSTO from '../config/centrosCusto.json';
import DESPESAS_JSON from '../config/despesas.json';

const CENTROS_CUSTO_OPTIONS = Object.entries(CENTROS_CUSTO).sort(
  (a, b) => parseInt(a[0]) - parseInt(b[0]),
);

const DESPESAS_OPTIONS = Object.entries(DESPESAS_JSON)
  .filter(([code]) => parseInt(code) >= 1000)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

// =====================================================================
// CONSTANTES
// =====================================================================
const TIPOS = [
  {
    id: 'pagamento',
    label: 'Solicitação de Pagamento',
    icon: CurrencyCircleDollar,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    selectedBg: 'bg-emerald-600',
  },
  {
    id: 'reembolso',
    label: 'Solicitação de Reembolso',
    icon: Receipt,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    selectedBg: 'bg-purple-600',
  },
  {
    id: 'compra',
    label: 'Solicitação de Compra',
    icon: ShoppingCart,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    selectedBg: 'bg-blue-600',
  },
  {
    id: 'manutencao',
    label: 'Solicitação de Manutenção',
    icon: Wrench,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    selectedBg: 'bg-orange-600',
  },
];

const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Débito' },
  { value: 'boleto', label: 'Boleto' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: `credito_${i + 1}x`,
    label: `Crédito ${i + 1}x`,
  })),
];

const STORAGE_BUCKET = 'solicitacoes-crosby';

// Tipos de documento — enum TOTVS DocumentType
const DOCUMENT_TYPES = [
  { value: 'Duplicate', label: 'Duplicata' },
  { value: 'InvoicePrint', label: 'Boleto bancário' },
  { value: 'Invoice', label: 'Nota fiscal' },
  { value: 'Receipt', label: 'Recibo' },
  { value: 'Voucher', label: 'Vale' },
  { value: 'AdvanceMoney', label: 'Adiantamento' },
  { value: 'FreightKnowledge', label: 'Conhecimento de frete' },
  { value: 'Loan', label: 'Empréstimo' },
  { value: 'Commission', label: 'Comissão' },
  { value: 'TedDoc', label: 'TED / DOC' },
  { value: 'BankDeposit', label: 'Depósito bancário' },
  { value: 'OutherTitle', label: 'Outro título' },
];

const PREVISION_TYPES = [
  { value: 'Forecast', label: 'Previsão' },
  { value: 'Real', label: 'Real' },
  { value: 'Consignment', label: 'Consignação' },
];

const STAGE_TYPES = [
  { value: 'InvoiceNotConfered', label: 'Título não conferido' },
  { value: 'ReleasedForPayment', label: 'Liberado para pagamento' },
  { value: 'InvoiceAccept', label: 'Título aceito' },
];

// =====================================================================
// HELPERS
// =====================================================================
const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');

const formatCnpjCpf = (v) => {
  const d = onlyDigits(v);
  if (!d) return '';
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toIsoDateTime = (yyyymmdd) => {
  if (!yyyymmdd) return null;
  return new Date(`${yyyymmdd}T00:00:00.000Z`).toISOString();
};

// =====================================================================
// PARCELA — estado inicial
// =====================================================================
const novaExpense = () => ({
  expenseCode: '',
  costCenterCode: '',
  proratedPercentage: '',
});

const novaParcela = (numero = 1, base = null) => ({
  installmentCode: numero,
  bearerCode: base?.bearerCode ?? '',
  document: base?.document ?? 'Duplicate',
  prevision: base?.prevision ?? 'Forecast',
  stage: base?.stage ?? 'InvoiceNotConfered',
  issueDate: base?.issueDate ?? todayISO(),
  dueDate: base?.dueDate ?? '',
  arrivalDate: base?.arrivalDate ?? todayISO(),
  duplicateValue: '',
  expenses: base?.expenses
    ? base.expenses.map((e) => ({ ...e }))
    : [novaExpense()],
  observation: base?.observation ?? '',
});

// =====================================================================
// SUB-COMPONENTE Field
// =====================================================================
const inputCls =
  'w-full border-2 border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#000638] transition-colors bg-white';

const Field = ({ label, hint, icon, children }) => (
  <div>
    <label className="text-[11px] font-bold text-[#000638] flex items-center gap-1 mb-1">
      {icon}
      {label}
      {hint && (
        <span className="text-[9px] text-gray-400 font-mono normal-case ml-1">
          {hint}
        </span>
      )}
    </label>
    {children}
  </div>
);

// Combobox pesquisável para despesas
const DespesaCombobox = ({ value, onChange }) => {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  const selectedLabel = value
    ? `${value} — ${DESPESAS_JSON[String(value)] || value}`
    : '';

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return DESPESAS_OPTIONS;
    return DESPESAS_OPTIONS.filter(
      ([code, name]) => code.includes(q) || name.toLowerCase().includes(q),
    );
  }, [search]);

  // Fecha ao clicar fora
  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (code) => {
    onChange(code);
    setSearch('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? search : selectedLabel}
        placeholder="Digite código ou nome..."
        className={inputCls}
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border-2 border-[#000638] rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 italic">
              Nenhuma despesa encontrada
            </div>
          ) : (
            filtered.map(([code, name]) => (
              <button
                key={code}
                type="button"
                onClick={() => select(code)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#000638] hover:text-white transition-colors flex gap-2 ${
                  value === code ? 'bg-[#000638]/10 font-bold' : ''
                }`}
              >
                <span className="font-mono text-[#000638] hover:text-white shrink-0">
                  {code}
                </span>
                <span className="truncate">{name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================
const FormularioSolicitacoes = () => {
  const [empresas, setEmpresas] = useState([]);
  const [empresasLoading, setEmpresasLoading] = useState(true);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);
  const [empresaSearch, setEmpresaSearch] = useState('');
  const [empresaDropdownOpen, setEmpresaDropdownOpen] = useState(false);
  const empresaRef = useRef(null);

  const [solicitante, setSolicitante] = useState('');
  const [solicitanteEmail, setSolicitanteEmail] = useState('');
  const [setor, setSetor] = useState('');

  const SETORES = [
    'VAREJO',
    'FINANCEIRO',
    'RH',
    'MULTIMARCAS',
    'REVENDA',
    'PRODUÇÃO',
    'EXPEDIÇÃO',
    'MARKETING',
    'TRÁFEGO',
    'TECNOLOGIA',
    'CENTRAL DE FRANQUIAS',
  ];
  const [tipo, setTipo] = useState('');

  const [fornecedorCpfCnpj, setFornecedorCpfCnpj] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [fornecedorBuscando, setFornecedorBuscando] = useState(false);
  const [fornecedorModal, setFornecedorModal] = useState(false);
  const [duplicateCode, setDuplicateCode] = useState('');

  const [parcelas, setParcelas] = useState([novaParcela(1)]);

  const [descricao, setDescricao] = useState('');
  const [observacao, setObservacao] = useState('');

  const [mostrarAvancado, setMostrarAvancado] = useState(false);
  const [numParcelasInput, setNumParcelasInput] = useState('');
  const [showParcelasPopover, setShowParcelasPopover] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(null);

  // Forma de pagamento (pagamento + reembolso)
  const [formaPagamento, setFormaPagamento] = useState('');

  // Reembolso: comprovante (1 arquivo)
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [comprovantePreview, setComprovantePreview] = useState('');

  // Compra: link + imagens de exemplo
  const [linkExemplo, setLinkExemplo] = useState('');
  const [imagensExemploFiles, setImagensExemploFiles] = useState([]);

  // Manuten\u00e7\u00e3o: contatos de prestadores
  const [contatosPrestadores, setContatosPrestadores] = useState([
    { nome: '', telefone: '', observacao: '' },
  ]);

  const [uploading, setUploading] = useState(false);

  // Corrige o body que globalmente tem h-screen e overflow-x:hidden (index.css)
  useEffect(() => {
    const prevHeight = document.body.style.height;
    const prevOverflow = document.body.style.overflow;
    const prevJustify = document.body.style.justifyContent;
    const prevAlign = document.body.style.alignItems;
    const prevDisplay = document.body.style.display;
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100%';
    document.body.style.overflow = 'auto';
    document.body.style.display = 'block';
    document.body.style.justifyContent = '';
    document.body.style.alignItems = '';
    return () => {
      document.body.style.height = prevHeight;
      document.body.style.minHeight = '';
      document.body.style.overflow = prevOverflow;
      document.body.style.display = prevDisplay;
      document.body.style.justifyContent = prevJustify;
      document.body.style.alignItems = prevAlign;
    };
  }, []);

  useEffect(() => {
    const buscarEmpresas = async () => {
      setEmpresasLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/totvs/branches`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        let lista = [];
        if (result?.data?.data && Array.isArray(result.data.data)) {
          lista = result.data.data;
        } else if (Array.isArray(result?.data)) {
          lista = result.data;
        }
        lista.sort((a, b) => parseInt(a.cd_empresa) - parseInt(b.cd_empresa));
        setEmpresas(lista);
      } catch (err) {
        console.error('Erro ao buscar empresas:', err);
        setEmpresas([]);
      } finally {
        setEmpresasLoading(false);
      }
    };
    buscarEmpresas();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (empresaRef.current && !empresaRef.current.contains(e.target)) {
        setEmpresaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const empresasFiltradas = useMemo(() => {
    const termo = empresaSearch.trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter(
      (e) =>
        String(e.cd_empresa).toLowerCase().includes(termo) ||
        (e.nm_grupoempresa || '').toLowerCase().includes(termo) ||
        (e.cnpj || '').toLowerCase().includes(termo),
    );
  }, [empresas, empresaSearch]);

  const tipoSelecionado = useMemo(
    () => TIPOS.find((t) => t.id === tipo),
    [tipo],
  );

  const updateParcela = (idx, patch) => {
    setParcelas((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };

  const addExpense = (parcelaIdx) => {
    setParcelas((prev) =>
      prev.map((p, i) =>
        i === parcelaIdx
          ? { ...p, expenses: [...p.expenses, novaExpense()] }
          : p,
      ),
    );
  };

  const removeExpense = (parcelaIdx, expIdx) => {
    setParcelas((prev) =>
      prev.map((p, i) =>
        i === parcelaIdx
          ? { ...p, expenses: p.expenses.filter((_, j) => j !== expIdx) }
          : p,
      ),
    );
  };

  const updateExpense = (parcelaIdx, expIdx, patch) => {
    setParcelas((prev) =>
      prev.map((p, i) =>
        i === parcelaIdx
          ? {
              ...p,
              expenses: p.expenses.map((e, j) =>
                j === expIdx ? { ...e, ...patch } : e,
              ),
            }
          : p,
      ),
    );
  };

  const removeParcela = (idx) => {
    setParcelas((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length
        ? next.map((p, i) => ({ ...p, installmentCode: i + 1 }))
        : [novaParcela(1)];
    });
  };

  const valorTotal = useMemo(
    () =>
      parcelas.reduce((acc, p) => acc + (parseFloat(p.duplicateValue) || 0), 0),
    [parcelas],
  );

  const parcelarEm = (n) => {
    const num = parseInt(n);
    if (!num || num < 1 || num > 120) return;
    const base = parcelas[parcelas.length - 1] || parcelas[0];
    const total = valorTotal || parseFloat(base?.duplicateValue) || 0;
    const valorBase = total > 0 ? Math.floor((total / num) * 100) / 100 : 0;
    const ultimo =
      total > 0 ? parseFloat((total - valorBase * (num - 1)).toFixed(2)) : 0;

    // Data de vencimento base (hoje se não preenchida)
    const baseDueDate = base?.dueDate || todayISO();
    const addMonths = (yyyymmdd, months) => {
      const d = new Date(`${yyyymmdd}T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + months);
      return d.toISOString().slice(0, 10);
    };

    const novasParcelas = Array.from({ length: num }, (_, i) => ({
      ...novaParcela(i + 1, base),
      duplicateValue: i === num - 1 ? ultimo : valorBase,
      dueDate: addMonths(baseDueDate, i), // +0, +1, +2... meses
    }));
    setParcelas(novasParcelas);
    setShowParcelasPopover(false);
    setNumParcelasInput('');
  };

  const buscarFornecedor = async () => {
    const digits = onlyDigits(fornecedorCpfCnpj);
    if (digits.length !== 11 && digits.length !== 14) return;
    setFornecedorBuscando(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/supplier/search?cpfCnpj=${digits}`,
      );
      if (resp.status === 404) {
        setFornecedorNome('');
        setFornecedorModal(true);
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setFornecedorNome(data?.data?.name || '');
    } catch (err) {
      console.error('Erro ao buscar fornecedor:', err);
    } finally {
      setFornecedorBuscando(false);
    }
  };

  const resetForm = () => {
    setEmpresaSelecionada(null);
    setEmpresaSearch('');
    setSolicitante('');
    setSolicitanteEmail('');
    setSetor('');
    setTipo('');
    setFornecedorCpfCnpj('');
    setFornecedorNome('');
    setFornecedorModal(false);
    setDuplicateCode('');
    setParcelas([novaParcela(1)]);
    setDescricao('');
    setObservacao('');
    setErro(null);
    setMostrarAvancado(false);
    setNumParcelasInput('');
    setShowParcelasPopover(false);
    setFormaPagamento('');
    setComprovanteFile(null);
    setComprovantePreview('');
    setLinkExemplo('');
    setImagensExemploFiles([]);
    setContatosPrestadores([{ nome: '', telefone: '', observacao: '' }]);
  };

  // Upload de arquivo \u00fanico (comprovante reembolso)
  const handleComprovanteChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErro('Comprovante muito grande (m\u00e1x. 10MB).');
      return;
    }
    setComprovanteFile(file);
    if (file.type.startsWith('image/')) {
      setComprovantePreview(URL.createObjectURL(file));
    } else {
      setComprovantePreview('');
    }
  };

  // Upload de m\u00faltiplas imagens (compra)
  const handleImagensChange = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) return false;
      return f.type.startsWith('image/');
    });
    setImagensExemploFiles((prev) => [...prev, ...validFiles].slice(0, 8));
  };

  const removeImagem = (idx) => {
    setImagensExemploFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Upload helper para Supabase Storage
  const uploadArquivo = async (file, prefix) => {
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${prefix}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  // Helpers contatos prestadores
  const addContatoPrestador = () =>
    setContatosPrestadores((prev) => [
      ...prev,
      { nome: '', telefone: '', observacao: '' },
    ]);
  const removeContatoPrestador = (idx) =>
    setContatosPrestadores((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ nome: '', telefone: '', observacao: '' }];
    });
  const updateContatoPrestador = (idx, patch) =>
    setContatosPrestadores((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );

  const validar = () => {
    if (!tipo) return 'Selecione o tipo de solicitação.';
    if (!empresaSelecionada) return 'Selecione a loja.';
    if (!empresaSelecionada.cnpj)
      return 'A loja selecionada não possui CNPJ cadastrado.';
    if (!solicitante.trim()) return 'Informe o nome do solicitante.';
    if (!setor) return 'Selecione o setor do solicitante.';
    if (!descricao.trim())
      return 'Descreva brevemente a solicitação (descrição).';

    const exigeFornecedor = !!tipo;
    const exigeParcelas = !!tipo;
    const exigeFormaPagamento = !!tipo;

    if (exigeFornecedor) {
      if (onlyDigits(fornecedorCpfCnpj).length < 11)
        return 'Informe um CPF/CNPJ válido para o fornecedor.';
      if (!fornecedorNome.trim()) return 'Informe o nome do fornecedor.';
    }

    if (exigeFormaPagamento && !formaPagamento)
      return 'Selecione a forma de pagamento.';

    if (tipo === 'reembolso' && !comprovanteFile)
      return 'Anexe o comprovante (foto ou PDF).';

    if (tipo === 'compra') {
      if (!linkExemplo.trim() || !/^https?:\/\//i.test(linkExemplo.trim()))
        return 'Informe um link de exemplo válido (começando com http/https).';
    }

    if (tipo === 'manutencao') {
      const algumPreenchido = contatosPrestadores.some(
        (c) => c.nome.trim() || c.telefone.trim(),
      );
      if (!algumPreenchido)
        return 'Informe ao menos um contato de prestador (nome ou telefone).';
    }

    if (exigeParcelas) {
      if (!duplicateCode || isNaN(parseInt(duplicateCode)))
        return 'Informe o código da duplicata.';

      for (let i = 0; i < parcelas.length; i++) {
        const p = parcelas[i];
        const prefixo = `Parcela ${i + 1}: `;
        if (!p.bearerCode || isNaN(parseInt(p.bearerCode)))
          return prefixo + 'informe o portador (bearerCode).';
        if (!p.dueDate) return prefixo + 'informe a data de vencimento.';
        if (p.dueDate <= todayISO())
          return prefixo + 'a data de vencimento deve ser posterior a hoje.';
        if (!p.issueDate) return prefixo + 'informe a data de emissão.';
        if (!p.arrivalDate) return prefixo + 'informe a data de chegada.';
        if (!p.duplicateValue || parseFloat(p.duplicateValue) <= 0)
          return prefixo + 'informe um valor da duplicata maior que zero.';
        if (!p.expenses || p.expenses.length === 0)
          return prefixo + 'adicione pelo menos uma despesa/centro de custo.';
        for (let j = 0; j < p.expenses.length; j++) {
          const exp = p.expenses[j];
          const pref2 = `Parcela ${i + 1}, despesa ${j + 1}: `;
          if (!exp.expenseCode || isNaN(parseInt(exp.expenseCode)))
            return pref2 + 'informe o código da despesa.';
          if (!exp.costCenterCode || isNaN(parseInt(exp.costCenterCode)))
            return pref2 + 'informe o centro de custo.';
          const pct = parseFloat(exp.proratedPercentage);
          if (isNaN(pct) || pct < 0) return pref2 + 'percentual inválido.';
        }
        const totalPct = p.expenses.reduce(
          (s, e) => s + (parseFloat(e.proratedPercentage) || 0),
          0,
        );
        if (Math.abs(totalPct - 100) > 0.01)
          return (
            prefixo +
            `total dos rateios deve ser 100% (atual: ${totalPct.toFixed(2)}%).`
          );
        if (!p.observation || p.observation.trim().length < 50)
          return prefixo + 'a observação deve ter no mínimo 50 caracteres.';
      }
    }
    return null;
  };

  const buildTotvsPayload = () => {
    const branchCnpj = onlyDigits(empresaSelecionada.cnpj);
    const supplierCpfCnpj = onlyDigits(fornecedorCpfCnpj);

    const installments = parcelas.map((p) => ({
      installmentCode: parseInt(p.installmentCode) || 1,
      bearerCode: parseInt(p.bearerCode),
      issueDate: toIsoDateTime(p.issueDate),
      dueDate: toIsoDateTime(p.dueDate),
      arrivalDate: toIsoDateTime(p.arrivalDate),
      document: p.document || 'Duplicate',
      prevision: p.prevision || 'Forecast',
      stage: p.stage || 'InvoiceNotConfered',
      duplicateValue: parseFloat(p.duplicateValue) || 0,
      expenses: p.expenses.map((e) => ({
        expenseCode: parseInt(e.expenseCode),
        costCenterCode: parseInt(e.costCenterCode),
        proratedPercentage: parseFloat(e.proratedPercentage) || 0,
      })),
      observations: p.observation
        ? [{ observation: p.observation.slice(0, 80) }]
        : [],
    }));

    return {
      branchCnpj,
      supplierCpfCnpj,
      duplicateCode: parseInt(duplicateCode),
      installments,
    };
  };

  const handleEnviar = async (e) => {
    e.preventDefault();
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const exigeParcelas = !!tipo;
      const exigeFornecedor = !!tipo;
      const exigeFormaPagamento = !!tipo;

      // Uploads pr\u00e9vios para Supabase Storage
      let comprovanteUrl = null;
      let imagensUrls = [];
      if (
        comprovanteFile ||
        (tipo === 'compra' && imagensExemploFiles.length > 0)
      ) {
        setUploading(true);
        try {
          if (comprovanteFile) {
            comprovanteUrl = await uploadArquivo(
              comprovanteFile,
              'comprovantes',
            );
          }
          if (tipo === 'compra' && imagensExemploFiles.length > 0) {
            imagensUrls = await Promise.all(
              imagensExemploFiles.map((f) => uploadArquivo(f, 'compras')),
            );
          }
        } finally {
          setUploading(false);
        }
      }

      const payloadTotvs = exigeParcelas ? buildTotvsPayload() : null;
      const primeira = exigeParcelas ? parcelas[0] : null;

      const insertData = {
        cd_empresa: parseInt(empresaSelecionada.cd_empresa),
        nm_empresa: empresaSelecionada.nm_grupoempresa || null,
        solicitante: solicitante.trim(),
        solicitante_email: solicitanteEmail.trim() || null,
        setor: setor || null,
        tipo_solicitacao: tipo,
        nivel_urgencia: 'normal',
        descricao: descricao.trim(),
        observacao: observacao.trim() || null,
        status: 'pendente',
        data_solicitacao: new Date().toISOString(),

        branch_cnpj: onlyDigits(empresaSelecionada.cnpj),
        supplier_cpf_cnpj: exigeFornecedor
          ? onlyDigits(fornecedorCpfCnpj)
          : onlyDigits(fornecedorCpfCnpj) || null,
        supplier_name: fornecedorNome.trim() || null,

        forma_pagamento: exigeFormaPagamento ? formaPagamento : null,
        comprovante_url: comprovanteUrl,
        link_exemplo: tipo === 'compra' ? linkExemplo.trim() : null,
        imagens_exemplo_urls: imagensUrls.length ? imagensUrls : [],
        contatos_prestadores:
          tipo === 'manutencao'
            ? contatosPrestadores.filter(
                (c) => c.nome.trim() || c.telefone.trim(),
              )
            : [],
      };

      if (exigeParcelas && payloadTotvs) {
        insertData.duplicate_code = payloadTotvs.duplicateCode;
        insertData.valor_total = valorTotal;
        insertData.dt_emissao = primeira.issueDate || null;
        insertData.dt_vencimento = primeira.dueDate || null;
        insertData.dt_chegada = primeira.arrivalDate || null;
        insertData.document_type = primeira.document;
        insertData.prevision_type = primeira.prevision;
        insertData.stage_type = primeira.stage;
        insertData.payload_totvs = payloadTotvs;
      }

      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .insert([insertData]);

      if (error) throw error;
      setEnviado(true);
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err);
      setErro(
        err?.message ||
          'Erro ao enviar solicitação. Tente novamente em instantes.',
      );
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f4f6fb] to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle size={40} weight="fill" className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#000638] mb-2">
            Solicitação enviada!
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Sua solicitação foi registrada e seguirá o fluxo:
            <br />
            <span className="font-semibold text-[#000638]">
              Aprovação do gestor → Aprovação financeira → Envio ao TOTVS.
            </span>
          </p>
          <button
            onClick={() => {
              resetForm();
              setEnviado(false);
            }}
            className="w-full px-4 py-2.5 bg-[#000638] text-white rounded-lg font-bold hover:bg-[#fe0000] transition-colors text-sm"
          >
            Enviar nova solicitação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-[#f4f6fb] to-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm mb-3">
            <ClipboardText
              size={28}
              weight="light"
              className="text-[#000638]"
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#000638] tracking-tight">
            Solicitação Crosby — Criação de Duplicata
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Pagamento, compra ou manutenção. Após aprovação do gestor e do
            financeiro, a duplicata será criada no TOTVS.
          </p>
        </div>

        <form
          onSubmit={handleEnviar}
          className="bg-white rounded-2xl shadow-lg border p-6 md:p-8 space-y-7"
        >
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              <Warning
                size={18}
                weight="bold"
                className="flex-shrink-0 mt-0.5"
              />
              <span>{erro}</span>
            </div>
          )}

          {/* TIPO */}
          <section>
            <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide mb-2">
              1 · Tipo de Solicitação *
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                const selected = tipo === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTipo(t.id)}
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg border-2 transition-all text-xs font-semibold text-center leading-tight ${
                      selected
                        ? `${t.selectedBg} text-white border-transparent shadow-md`
                        : `${t.bg} ${t.color} ${t.border} hover:shadow`
                    }`}
                  >
                    <Icon size={22} weight={selected ? 'fill' : 'bold'} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* LOJA / SOLICITANTE */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide">
              2 · Dados da Loja e Solicitante
            </h2>

            <div ref={empresaRef} className="relative">
              <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                <Storefront size={14} weight="bold" />
                Loja (filial) *
              </label>
              <button
                type="button"
                onClick={() => setEmpresaDropdownOpen((o) => !o)}
                disabled={empresasLoading}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:border-[#000638] disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-[#000638]/40"
              >
                <span
                  className={
                    empresaSelecionada
                      ? 'text-[#000638] font-semibold'
                      : 'text-gray-400'
                  }
                >
                  {empresasLoading
                    ? 'Carregando lojas...'
                    : empresaSelecionada
                      ? `${empresaSelecionada.cd_empresa} - ${empresaSelecionada.nm_grupoempresa}`
                      : 'Selecione a loja'}
                </span>
                <CaretDown
                  size={16}
                  className={`transition-transform ${empresaDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {empresaSelecionada?.cnpj && (
                <p className="mt-1 text-[11px] text-gray-500">
                  CNPJ:{' '}
                  <span className="font-mono text-[#000638]">
                    {formatCnpjCpf(empresaSelecionada.cnpj)}
                  </span>
                </p>
              )}
              {empresaDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Buscar por código, nome ou CNPJ..."
                      value={empresaSearch}
                      onChange={(e) => setEmpresaSearch(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {empresasFiltradas.length === 0 ? (
                      <div className="p-3 text-sm text-gray-400 text-center">
                        Nenhuma loja encontrada
                      </div>
                    ) : (
                      empresasFiltradas.map((emp) => (
                        <button
                          key={emp.cd_empresa}
                          type="button"
                          onClick={() => {
                            setEmpresaSelecionada(emp);
                            setEmpresaDropdownOpen(false);
                            setEmpresaSearch('');
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                            empresaSelecionada?.cd_empresa === emp.cd_empresa
                              ? 'bg-blue-50 font-semibold'
                              : ''
                          }`}
                        >
                          <span className="text-[#000638]">
                            {emp.cd_empresa}
                          </span>
                          <span className="text-gray-700">
                            {' '}
                            - {emp.nm_grupoempresa}
                          </span>
                          {emp.cnpj && (
                            <span className="block text-[10px] text-gray-400 font-mono">
                              {formatCnpjCpf(emp.cnpj)}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                  <User size={14} weight="bold" />
                  Solicitante *
                </label>
                <input
                  type="text"
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value)}
                  maxLength={120}
                  placeholder="Nome de quem está solicitando"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#000638] mb-1.5 block">
                  Setor *
                </label>
                <select
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors bg-white"
                >
                  <option value="">Selecione o setor</option>
                  {SETORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-[#000638] mb-1.5 block">
                E-mail (opcional)
              </label>
              <input
                type="email"
                value={solicitanteEmail}
                onChange={(e) => setSolicitanteEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors"
              />
            </div>
          </section>

          {/* MODAL FORNECEDOR NÃO ENCONTRADO */}
          {fornecedorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border">
                <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <Warning size={32} weight="fill" className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-[#000638] mb-2">
                  FORNECEDOR NÃO CADASTRADO
                </h3>
                <p className="text-sm text-gray-600 mb-5">
                  Realize o cadastro do fornecedor no TOTVS e pesquise
                  novamente.
                </p>
                <button
                  type="button"
                  onClick={() => setFornecedorModal(false)}
                  className="w-full px-4 py-2.5 bg-[#000638] text-white rounded-lg font-bold hover:bg-[#fe0000] transition-colors text-sm"
                >
                  Entendi
                </button>
              </div>
            </div>
          )}

          {/* FORNECEDOR / DUPLICATA — todos os tipos */}
          {!!tipo && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide">
                3 · Fornecedor e Duplicata
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                    <IdentificationBadge size={14} weight="bold" />
                    CPF / CNPJ do Fornecedor *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formatCnpjCpf(fornecedorCpfCnpj)}
                      onChange={(e) => {
                        setFornecedorCpfCnpj(e.target.value);
                        setFornecedorNome('');
                      }}
                      maxLength={18}
                      placeholder="00.000.000/0000-00"
                      className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#000638] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={buscarFornecedor}
                      disabled={
                        fornecedorBuscando ||
                        (onlyDigits(fornecedorCpfCnpj).length !== 11 &&
                          onlyDigits(fornecedorCpfCnpj).length !== 14)
                      }
                      className="shrink-0 flex items-center gap-1 px-2.5 py-2.5 w-20 h-10 bg-[#000638] text-white rounded-lg hover:bg-[#fe0000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                    >
                      {fornecedorBuscando ? (
                        <Spinner size={13} className="animate-spin" />
                      ) : (
                        <MagnifyingGlass size={13} weight="bold" />
                      )}
                      Buscar
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                    <Buildings size={14} weight="bold" />
                    Nome do Fornecedor *
                  </label>
                  <input
                    type="text"
                    value={fornecedorNome}
                    onChange={(e) => setFornecedorNome(e.target.value)}
                    maxLength={120}
                    placeholder="Preenchido ao buscar ou manualmente"
                    className={`w-full border-2 rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors ${
                      fornecedorNome
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200'
                    } focus:border-[#000638]`}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                    <Hash size={14} weight="bold" />
                    Código da Duplicata *
                  </label>
                  <input
                    type="number"
                    value={duplicateCode}
                    onChange={(e) => setDuplicateCode(e.target.value)}
                    placeholder="Ex.: 12345"
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    Campo "Duplicata" do componente FCPFM004 — máx. 10 dígitos
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                    <CreditCard size={14} weight="bold" />
                    Forma de Pagamento *
                  </label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors bg-white"
                  >
                    <option value="">Selecione...</option>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* REEMBOLSO — comprovante */}
          {tipo === 'reembolso' && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide">
                4 · Comprovante de Pagamento *
              </h2>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-[#000638] transition-colors bg-gray-50/40">
                <UploadSimple size={28} className="text-gray-400 mb-2" />
                <span className="text-sm font-bold text-[#000638]">
                  {comprovanteFile
                    ? comprovanteFile.name
                    : 'Clique para anexar foto ou PDF'}
                </span>
                <span className="text-[11px] text-gray-500 mt-1">
                  Tamanho máximo 10MB · JPG, PNG, PDF
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleComprovanteChange}
                  className="hidden"
                />
              </label>
              {comprovantePreview && (
                <div className="flex justify-center">
                  <img
                    src={comprovantePreview}
                    alt="Pré-visualização"
                    className="max-h-48 rounded-lg border"
                  />
                </div>
              )}
              {comprovanteFile && !comprovantePreview && (
                <div className="text-center text-[11px] text-gray-500 font-mono">
                  {(comprovanteFile.size / 1024).toFixed(0)} KB ·{' '}
                  {comprovanteFile.type}
                </div>
              )}
            </section>
          )}

          {/* COMPRA — link e imagens de exemplo */}
          {tipo === 'compra' && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide">
                4 · Detalhes da Compra
              </h2>
              <div>
                <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                  <LinkIcon size={14} weight="bold" />
                  Link de exemplo *
                </label>
                <input
                  type="url"
                  value={linkExemplo}
                  onChange={(e) => setLinkExemplo(e.target.value)}
                  placeholder="https://..."
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Onde encontrar o produto — site da loja, marketplace etc.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                  <ImageIcon size={14} weight="bold" />
                  Imagens de exemplo (opcional, até 8)
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-[#000638] transition-colors bg-gray-50/40">
                  <UploadSimple size={20} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-600">
                    Clique para adicionar imagens
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImagensChange}
                    className="hidden"
                  />
                </label>
                {imagensExemploFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {imagensExemploFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-lg overflow-hidden border"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-full h-20 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImagem(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle size={14} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* MANUTENÇÃO — contatos de prestadores */}
          {tipo === 'manutencao' && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide">
                4 · Contatos de Prestadores *
              </h2>
              <p className="text-[11px] text-gray-500 -mt-2">
                Liste prestadores de serviço da região que possam atender.
              </p>
              <div className="space-y-2">
                {contatosPrestadores.map((c, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr_auto] gap-2 items-end border border-gray-200 rounded-lg p-2 bg-gray-50/40"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={c.nome}
                        onChange={(e) =>
                          updateContatoPrestador(idx, { nome: e.target.value })
                        }
                        placeholder="Ex.: João da Silva"
                        className="w-full border-2 border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#000638]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        value={c.telefone}
                        onChange={(e) =>
                          updateContatoPrestador(idx, {
                            telefone: e.target.value,
                          })
                        }
                        placeholder="(00) 00000-0000"
                        className="w-full border-2 border-gray-200 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-[#000638]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">
                        Observação
                      </label>
                      <input
                        type="text"
                        value={c.observacao}
                        onChange={(e) =>
                          updateContatoPrestador(idx, {
                            observacao: e.target.value,
                          })
                        }
                        placeholder="Especialidade, indicação..."
                        className="w-full border-2 border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#000638]"
                      />
                    </div>
                    {contatosPrestadores.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContatoPrestador(idx)}
                        className="text-red-500 hover:text-red-700 p-1.5"
                      >
                        <Trash size={16} weight="bold" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addContatoPrestador}
                  className="flex items-center gap-1 text-xs font-bold text-[#000638] hover:text-[#fe0000] transition-colors"
                >
                  <Plus size={14} weight="bold" /> Adicionar contato
                </button>
              </div>
            </section>
          )}

          {/* PARCELAS — todos os tipos */}
          {!!tipo && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide">
                  5 · Parcelas *
                </h2>
                <div className="relative">
                  {showParcelasPopover ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={numParcelasInput}
                        onChange={(e) => setNumParcelasInput(e.target.value)}
                        placeholder="Qtd"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') parcelarEm(numParcelasInput);
                          if (e.key === 'Escape') setShowParcelasPopover(false);
                        }}
                        className="w-16 border-2 border-[#000638] rounded-md px-1.5 py-1 text-xs text-center focus:outline-none"
                      />
                      <span className="text-xs text-gray-500">parcela(s)</span>
                      <button
                        type="button"
                        onClick={() => parcelarEm(numParcelasInput)}
                        className="text-xs font-bold text-white bg-[#000638] px-2 py-1 rounded-md hover:bg-[#fe0000] transition-colors"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowParcelasPopover(false);
                          setNumParcelasInput('');
                        }}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowParcelasPopover(true)}
                      className="flex items-center gap-1 text-xs font-bold text-[#000638] hover:text-[#fe0000] transition-colors"
                    >
                      <Plus size={14} weight="bold" />
                      Parcelar
                    </button>
                  )}
                </div>
              </div>

              {parcelas.map((p, idx) => (
                <div
                  key={idx}
                  className="border-2 border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#000638]">
                      Parcela {idx + 1}
                    </span>
                    {parcelas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeParcela(idx)}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                      >
                        <Trash size={14} weight="bold" />
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Nº parcela *">
                      <input
                        type="number"
                        min="1"
                        value={p.installmentCode}
                        onChange={(e) =>
                          updateParcela(idx, {
                            installmentCode: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Portador *" hint="bearerCode">
                      <input
                        type="number"
                        value={p.bearerCode}
                        onChange={(e) =>
                          updateParcela(idx, { bearerCode: e.target.value })
                        }
                        placeholder="Ex.: 1"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Tipo documento *">
                      <select
                        value={p.document}
                        onChange={(e) =>
                          updateParcela(idx, { document: e.target.value })
                        }
                        className={inputCls}
                      >
                        {DOCUMENT_TYPES.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tipo previsão *">
                      <select
                        value={p.prevision}
                        onChange={(e) =>
                          updateParcela(idx, { prevision: e.target.value })
                        }
                        className={inputCls}
                      >
                        {PREVISION_TYPES.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field
                      label="Data emissão *"
                      icon={<CalendarBlank size={12} weight="bold" />}
                    >
                      <input
                        type="date"
                        value={p.issueDate}
                        onChange={(e) =>
                          updateParcela(idx, { issueDate: e.target.value })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field
                      label="Data vencimento *"
                      icon={<CalendarBlank size={12} weight="bold" />}
                    >
                      <input
                        type="date"
                        value={p.dueDate}
                        onChange={(e) =>
                          updateParcela(idx, { dueDate: e.target.value })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field
                      label="Data chegada *"
                      icon={<CalendarBlank size={12} weight="bold" />}
                    >
                      <input
                        type="date"
                        value={p.arrivalDate}
                        onChange={(e) =>
                          updateParcela(idx, { arrivalDate: e.target.value })
                        }
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Valor da duplicata *"
                      icon={<Money size={12} weight="bold" />}
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.duplicateValue}
                        onChange={(e) =>
                          updateParcela(idx, { duplicateValue: e.target.value })
                        }
                        placeholder="0,00"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Estágio *">
                      <select
                        value={p.stage}
                        onChange={(e) =>
                          updateParcela(idx, { stage: e.target.value })
                        }
                        className={inputCls}
                      >
                        {STAGE_TYPES.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="pt-2 border-t border-dashed space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#000638] uppercase tracking-wide">
                        Despesas / Centros de Custo *
                      </span>
                      <button
                        type="button"
                        onClick={() => addExpense(idx)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#000638] hover:text-[#fe0000] transition-colors"
                      >
                        <Plus size={12} weight="bold" />
                        Add C.Custo
                      </button>
                    </div>
                    {p.expenses.map((exp, expIdx) => (
                      <div
                        key={expIdx}
                        className="grid grid-cols-[1fr_1.4fr_70px_auto] gap-2 items-top"
                      >
                        <Field label={expIdx === 0 ? 'Despesa *' : undefined}>
                          <DespesaCombobox
                            value={exp.expenseCode}
                            onChange={(code) =>
                              updateExpense(idx, expIdx, { expenseCode: code })
                            }
                          />
                        </Field>
                        <Field label={expIdx === 0 ? 'C. Custo *' : undefined}>
                          <select
                            value={exp.costCenterCode}
                            onChange={(e) =>
                              updateExpense(idx, expIdx, {
                                costCenterCode: e.target.value,
                              })
                            }
                            className={inputCls}
                          >
                            <option value="">Selecione...</option>
                            {CENTROS_CUSTO_OPTIONS.map(([code, name]) => (
                              <option key={code} value={code}>
                                {code} — {name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={expIdx === 0 ? '% Rateio *' : undefined}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={exp.proratedPercentage}
                            onChange={(e) =>
                              updateExpense(idx, expIdx, {
                                proratedPercentage: e.target.value,
                              })
                            }
                            className={inputCls}
                          />
                        </Field>
                        {p.expenses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExpense(idx, expIdx)}
                            className="mb-0.5 text-red-400 hover:text-red-600 self-end"
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        )}
                      </div>
                    ))}
                    {p.expenses.length > 1 &&
                      (() => {
                        const totalPct = p.expenses.reduce(
                          (s, e) => s + (parseFloat(e.proratedPercentage) || 0),
                          0,
                        );
                        const ok = Math.abs(totalPct - 100) < 0.01;
                        return (
                          <p
                            className={`text-[11px] font-mono ${
                              ok ? 'text-green-600' : 'text-amber-600'
                            }`}
                          >
                            Total rateio: {totalPct.toFixed(2)}%{' '}
                            {ok ? '✓' : '← deve ser 100%'}
                          </p>
                        );
                      })()}
                  </div>

                  <Field label="Observação da parcela * (50–80 caracteres)">
                    <input
                      type="text"
                      minLength={50}
                      maxLength={80}
                      value={p.observation}
                      onChange={(e) =>
                        updateParcela(idx, { observation: e.target.value })
                      }
                      placeholder="Descreva a observação (mínimo 50 caracteres)"
                      className={`${inputCls} ${
                        p.observation.length > 0 && p.observation.length < 50
                          ? 'border-amber-400'
                          : ''
                      }`}
                    />
                    <p
                      className={`text-[10px] mt-0.5 font-mono ${
                        p.observation.length >= 50
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {p.observation.length}/80{' '}
                      {p.observation.length < 50
                        ? `(faltam ${50 - p.observation.length} caracteres)`
                        : '✓'}
                    </p>
                  </Field>
                </div>
              ))}

              <div className="flex items-center justify-end gap-2 text-sm pt-1">
                <span className="text-gray-500">Total:</span>
                <span className="font-bold text-[#000638] text-lg">
                  {valorTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
            </section>
          )}

          {/* DESCRIÇÃO */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-[#000638] uppercase tracking-wide">
              6 · Descrição da Solicitação
            </h2>
            <div>
              <label className="text-xs font-bold text-[#000638] flex items-center gap-1.5 mb-1.5">
                <FileText size={14} weight="bold" />
                Descrição *
              </label>
              <textarea
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o motivo / o que está sendo solicitado"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#000638] mb-1.5 block">
                Observação interna (opcional)
              </label>
              <textarea
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações adicionais para gestor / financeiro"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors resize-y"
              />
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={() => setMostrarAvancado((v) => !v)}
              className="text-xs font-bold text-gray-500 hover:text-[#000638] flex items-center gap-1"
            >
              {mostrarAvancado ? (
                <CaretUp size={12} weight="bold" />
              ) : (
                <CaretDown size={12} weight="bold" />
              )}
              Campos avançados (descontos, multa, mora, código de barras)
            </button>
            {mostrarAvancado && (
              <p className="mt-2 text-[11px] text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                Campos avançados (desconto pontual, antecipação 1/2, multa,
                mora, juros, despesa financeira, código de barras,
                classificações e impostos) podem ser preenchidos pelo financeiro
                antes do envio definitivo ao TOTVS.
              </p>
            )}
          </section>

          <button
            type="submit"
            disabled={enviando}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#000638] text-white font-bold hover:bg-[#fe0000] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {enviando ? (
              <>
                <Spinner size={18} className="animate-spin" />
                {uploading ? 'Enviando arquivos...' : 'Enviando...'}
              </>
            ) : (
              <>
                <PaperPlaneTilt size={18} weight="bold" />
                Enviar Solicitação
                {tipoSelecionado && ` · ${tipoSelecionado.label}`}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          HEADCOACH · Gestão Crosby
        </p>
      </div>
    </div>
  );
};

export default FormularioSolicitacoes;
