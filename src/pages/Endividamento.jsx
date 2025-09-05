import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import SEOHead from '../components/ui/SEOHead';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import { FunnelSimple } from '@phosphor-icons/react';
import FilterDropdown from '../components/ui/FilterDropdown';
import { createEndividamento, listEndividamentos, updateEndividamento, deleteEndividamento, importEndividamentosFromExcel, deleteAllEndividamentos } from '../lib/endividamentoApi';
import { usePermissions } from '../hooks/usePermissions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Question } from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19B8'];

const Endividamento = () => {
  const { canAccessAdmin } = usePermissions();
  const [form, setForm] = useState({
    instituicao: '',
    razaoSocialTomador: '',
    cnpjTomador: '',
    ag: '',
    cc: '',
    linhaCredito: '',
    numeroContrato: '',
    dataContratacao: '',
    vencimentoFinal: '',
    // Campos monetários armazenados como centavos (string de dígitos)
    limiteAprovado: '',
    saldoDevedorSemJuros: '',
    saldoDevedorComJuros: '',
    valorMensalPMT: '',
    quantidadePMT: '',
    pmtPagas: '',
    diferencaPMTVencer: '',
    dataInicialPagamento: '',
    taxaJurosMes: '',
    avalista: '',
    garantias: '',
    anexoContrato: null
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState(null);
  const [view, setView] = useState('dashboard');
  const [confirmMassDeleteOpen, setConfirmMassDeleteOpen] = useState(false);
  const [massDeleting, setMassDeleting] = useState(false);

  // Estado para o modal de explicação
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);
  const [explanationModalTitle, setExplanationModalTitle] = useState('');
  const [explanationModalContent, setExplanationModalContent] = useState('');

  const openExplanationModal = useCallback((title, content) => {
    setExplanationModalTitle(title);
    setExplanationModalContent(content);
    setIsExplanationModalOpen(true);
  }, []);

  const closeExplanationModal = useCallback(() => {
    setIsExplanationModalOpen(false);
    setExplanationModalTitle('');
    setExplanationModalContent('');
  }, []);

  const handleViewChange = () => {
    setView('table');
  };

  const handleDashboard = () => {
    setView('dashboard');
  };

  const handleTable = () => {
    setView('table');
  };

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const [columnFilters, setColumnFilters] = useState({}); // { colKey: { sortDirection: 'asc', searchTerm: '', selected: ['val1', 'val2'] } }
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null); // colKey of the open dropdown

  const toggleFilterDropdown = useCallback((colKey) => {
    setOpenFilterDropdown((prev) => (prev === colKey ? null : colKey));
  }, []);

  const handleApplyFilter = useCallback((columnKey, filterConfig) => {
    setColumnFilters((prev) => {
      if (filterConfig) {
        return { ...prev, [columnKey]: filterConfig };
      } else {
        const newState = { ...prev };
        delete newState[columnKey];
        return newState;
      }
    });
  }, []);

  const filteredAndSortedRows = useMemo(() => {
    let currentData = [...rows];

    // Aplicar filtros
    Object.keys(columnFilters).forEach((key) => {
      const filter = columnFilters[key];
      if (filter.searchTerm) {
        currentData = currentData.filter((row) =>
          String(row[key]).toLowerCase().includes(filter.searchTerm.toLowerCase())
        );
      }
      if (filter.selected && filter.selected.length > 0) {
        currentData = currentData.filter((row) => filter.selected.includes(String(row[key])))
      }
    });

    // Aplicar ordenação (apenas uma coluna por vez, se houver)
    const activeSortKey = Object.keys(columnFilters).find(key => columnFilters[key]?.sortDirection);
    if (activeSortKey) {
      const { sortDirection } = columnFilters[activeSortKey];
      currentData.sort((a, b) => {
        const aValue = String(a[activeSortKey]).toLowerCase();
        const bValue = String(b[activeSortKey]).toLowerCase();

        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }

    return currentData;
  }, [rows, columnFilters]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listEndividamentos();
        if (mounted) setRows(data);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Helpers para moeda BRL (centavos)
  const formatBRL = (centsValue) => {
    const cents = Number(centsValue || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const handleCurrencyChange = (name) => (e) => {
    const digits = (e.target.value || '').replace(/\D/g, '');
    setForm((prev) => ({ ...prev, [name]: digits }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setForm((prev) => ({ ...prev, anexoContrato: file }));
  };

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return value;
    }
  };

  const formatPercent = (value) => {
    if (value === '' || value === null || value === undefined) return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    const percent = num <= 1 ? num * 100 : num;
    return `${percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} % a.m`;
  };

  // Definição das colunas da tabela (base)
  const tableColumnsBase = [
    {
      key: 'instituicao',
      title: 'Instituição',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'razaoSocialTomador',
      title: 'Razão Social',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'cnpjTomador',
      title: 'CNPJ',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'ag',
      title: 'AG',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'cc',
      title: 'CC',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'linhaCredito',
      title: 'Linha de Crédito',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'numeroContrato',
      title: 'Contrato',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'dataContratacao',
      title: 'Data da Contratação',
      render: (v) => formatDate(v),
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'vencimentoFinal',
      title: 'Vencimento Final',
      render: (v) => formatDate(v),
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'limiteAprovado',
      title: 'Valor do Contrato',
      render: (v) => v ? formatBRL(v) : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'saldoDevedorSemJuros',
      title: 'Saldo s/ Juros',
      render: (v) => v ? formatBRL(v) : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'valorMensalPMT',
      title: 'PMT Mensal',
      render: (v) => v ? formatBRL(v) : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'quantidadePMT',
      title: 'Quantidade PMT',
      render: (v) => (v !== '' && v !== null && v !== undefined) ? Number(v).toLocaleString('pt-BR') : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'pmtPagas',
      title: 'PMT Pagas',
      render: (v) => (v !== '' && v !== null && v !== undefined) ? Number(v).toLocaleString('pt-BR') : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'diferencaPMTVencer',
      title: 'Diferença PMT a Vencer',
      render: (v) => v ? formatBRL(v) : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'dataInicialPagamento',
      title: 'Data Inicial Pagamento',
      render: (v) => formatDate(v),
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'taxaJurosMes',
      title: 'Taxa juros % a.m',
      render: (v) => formatPercent(v),
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'avalista',
      title: 'Avalista',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'garantias',
      title: 'Garantias',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'saldoDevedorComJuros',
      title: 'Saldo c/ Juros',
      render: (v) => v ? formatBRL(v) : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    },
    {
      key: 'anexoContrato',
      title: 'Anexo',
      render: (file) => file ? (file.name || 'Arquivo selecionado') : '-',
      headerRender: ({ column }) => (
        <div className="flex items-center space-x-1">
          <span>{column.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFilterDropdown(column.key);
            }}
            className="text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            aria-label={`Filtrar por ${column.title}`}
          >
            <FunnelSimple size={16} />
          </button>
        </div>
      )
    }
  ];

  const validate = () => {
    const newErrors = {};
    if (!form.instituicao) newErrors.instituicao = 'Obrigatório';
    if (!form.razaoSocialTomador) newErrors.razaoSocialTomador = 'Obrigatório';
    if (form.cnpjTomador && !/^\d{14}$/.test(form.cnpjTomador.replace(/\D/g, ''))) newErrors.cnpjTomador = 'CNPJ inválido';
    if (form.taxaJurosMes && Number(form.taxaJurosMes) < 0) newErrors.taxaJurosMes = 'Valor inválido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      instituicao: '',
      razaoSocialTomador: '',
      cnpjTomador: '',
      ag: '',
      cc: '',
      linhaCredito: '',
      numeroContrato: '',
      dataContratacao: '',
      vencimentoFinal: '',
      limiteAprovado: '',
      saldoDevedorSemJuros: '',
      saldoDevedorComJuros: '',
      valorMensalPMT: '',
      quantidadePMT: '',
      pmtPagas: '',
      diferencaPMTVencer: '',
      dataInicialPagamento: '',
      taxaJurosMes: '',
      avalista: '',
      garantias: '',
      anexoContrato: null
    });
    setIsModalOpen(true);
  };

  const handleRowClick = (row) => {
    setEditingId(row.id);
    setForm({ ...row });
    setIsModalOpen(true);
  };

  const handleClickDelete = () => {
    if (!editingId) return;
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!editingId) return;
    setDeleting(true);
    try {
      await deleteEndividamento(editingId);
      setRows((prev) => prev.filter((r) => r.id !== editingId));
      setConfirmDeleteOpen(false);
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        const saved = await updateEndividamento(editingId, form, form.anexoContrato);
        setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      } else {
        const saved = await createEndividamento(form, form.anexoContrato);
        setRows((prev) => [saved, ...prev]);
      }
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar endividamento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    console.log('Exportar para Excel (placeholder)');
    // Implementar lógica de exportação para Excel
    // Pode usar bibliotecas como SheetJS, XLSX, etc.
    // Para exemplo, vamos apenas imprimir no console
    alert('Exportar para Excel (placeholder)');
  };

  const triggerExcelPicker = () => fileInputRef.current?.click();

  const handleFilePicked = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setSelectedImportFile(file);
    setConfirmImportOpen(true);
  };

  const doImportExcel = async () => {
    if (!selectedImportFile) return;
    setImporting(true);
    try {
      const inserted = await importEndividamentosFromExcel(selectedImportFile);
      const data = await listEndividamentos();
      setRows(data);
      setConfirmImportOpen(false);
      setSelectedImportFile(null);
    } catch (err) {
      console.error(err);
      alert('Falha ao importar o Excel');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMassDelete = async () => {
    setMassDeleting(true);
    try {
      await deleteAllEndividamentos();
      setRows([]);
      setConfirmMassDeleteOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao remover todos os registros');
    } finally {
      setMassDeleting(false);
    }
  };

  const { 
    totalDividaBruta,
    wacdMensal,
    wacdAnualizado,
    wamMeses,
    servicoDivida12m,
    maturityWallData,
    concentracaoInstituicaoData,
    top10Contratos,
    alerts
  } = useMemo(() => {
    // Funções auxiliares para cálculos
    const parseCurrencyToNumber = (value) => Number(value || 0) / 100;
    const parsePercentToDecimal = (value) => Number(value || 0);

    const calculateMonthsUntil = (dateString) => {
      if (!dateString) return 0;
      const today = new Date();
      const vencimento = new Date(dateString);
      return (vencimento.getFullYear() - today.getFullYear()) * 12 + (vencimento.getMonth() - today.getMonth());
    };

    // Inicializar valores
    let totalDividaBruta = 0;
    let sumWeightedTaxa = 0;
    let sumSaldoForWACD = 0;
    let sumWeightedWam = 0;
    let sumSaldoForWAM = 0;
    let servicoDivida12m = 0;
    const maturityWallMap = new Map(); // { 'YYYY-MM': sumPMT }
    const concentracaoInstituicaoMap = new Map(); // { 'Instituicao': sumSaldo }
    const contratosList = [];

    rows.forEach(item => {
      const saldoComJuros = parseCurrencyToNumber(item.saldoDevedorComJuros);
      const taxaJurosMes = parsePercentToDecimal(item.taxaJurosMes);
      const valorMensalPMT = parseCurrencyToNumber(item.valorMensalPMT);
      const quantidadePMT = Number(item.quantidadePMT || 0);
      const pmtPagas = Number(item.pmtPagas || 0);
      const vencimentoFinal = item.vencimentoFinal;
      const dataInicialPagamento = item.dataInicialPagamento;

      // Dívida Bruta
      totalDividaBruta += saldoComJuros;

      // WACD
      if (saldoComJuros > 0 && taxaJurosMes > 0) {
        sumWeightedTaxa += saldoComJuros * taxaJurosMes;
        sumSaldoForWACD += saldoComJuros;
      }

      // WAM
      if (saldoComJuros > 0 && vencimentoFinal) {
        const mesesAteVencimento = calculateMonthsUntil(vencimentoFinal);
        if (mesesAteVencimento > 0) {
          sumWeightedWam += saldoComJuros * mesesAteVencimento;
          sumSaldoForWAM += saldoComJuros;
        }
      }

      // Serviço da Dívida 12m e Maturity Wall
      if (valorMensalPMT > 0 && quantidadePMT > pmtPagas && vencimentoFinal && dataInicialPagamento) {
        const parcelasRestantes = quantidadePMT - pmtPagas;
        const hoje = new Date();
        const dataInicioPagamento = new Date(dataInicialPagamento);

        for (let i = pmtPagas; i < quantidadePMT; i++) {
          const dataVencimentoPMT = new Date(dataInicioPagamento.getFullYear(), dataInicioPagamento.getMonth() + i, 1);
          
          if (dataVencimentoPMT > hoje && dataVencimentoPMT <= new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate())) {
            // Dentro dos próximos 12 meses
            servicoDivida12m += valorMensalPMT;
          }

          // Maturity Wall para os próximos 18 meses
          if (dataVencimentoPMT > hoje && dataVencimentoPMT <= new Date(hoje.getFullYear() + 1, hoje.getMonth() + 6, hoje.getDate())) { // 18 meses
            const monthKey = `${dataVencimentoPMT.getFullYear()}-${(dataVencimentoPMT.getMonth() + 1).toString().padStart(2, '0')}`;
            maturityWallMap.set(monthKey, (maturityWallMap.get(monthKey) || 0) + valorMensalPMT);
          }
        }
      }

      // Concentração por Instituição
      if (item.instituicao && saldoComJuros > 0) {
        concentracaoInstituicaoMap.set(item.instituicao, (concentracaoInstituicaoMap.get(item.instituicao) || 0) + saldoComJuros);
      }

      // Top 10 Contratos
      contratosList.push({
        instituicao: item.instituicao,
        numeroContrato: item.numeroContrato,
        linhaCredito: item.linhaCredito,
        saldoDevedorComJuros: saldoComJuros,
        taxaJurosMes: taxaJurosMes,
        valorMensalPMT: valorMensalPMT,
        vencimentoFinal: item.vencimentoFinal,
      });
    });

    // Finalizar cálculos dos KPIs
    const wacdMensal = sumSaldoForWACD > 0 ? (sumWeightedTaxa / sumSaldoForWACD) : 0;
    const wacdAnualizado = (((1 + wacdMensal / 100) ** 12) - 1) * 100;
    const wamMeses = sumSaldoForWAM > 0 ? (sumWeightedWam / sumSaldoForWAM) : 0;

    // Preparar dados para gráficos
    const maturityWallData = Array.from(maturityWallMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({ month, value }));

    const concentracaoInstituicaoData = Array.from(concentracaoInstituicaoMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Ordena do maior para o menor

    const top10Contratos = contratosList.sort((a, b) => b.saldoDevedorComJuros - a.saldoDevedorComJuros).slice(0, 10);

    // Alertas
    const alerts = [];
    if (wamMeses > 0 && wamMeses < 6) {
      alerts.push('WAM < 6 meses: Risco de rolagem elevado. O prazo médio da dívida está muito curto.');
    }
    if (wacdAnualizado > 30) {
      alerts.push('WACD anual > 30%: Custo da dívida caro. Avaliar renegociação ou busca por linhas mais baratas.');
    }
    const maiorConcentracao = concentracaoInstituicaoData.length > 0 ? (concentracaoInstituicaoData[0].value / totalDividaBruta) * 100 : 0;
    if (maiorConcentracao > 40) {
      alerts.push(`Concentração > 40% em ${concentracaoInstituicaoData[0].name}: Risco de concentração elevado. Buscar diversificação das fontes de dívida.`);
    }

    return {
      totalDividaBruta,
      wacdMensal,
      wacdAnualizado,
      wamMeses,
      servicoDivida12m,
      maturityWallData,
      concentracaoInstituicaoData,
      top10Contratos,
      alerts
    };
  }, [rows]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <SEOHead title="Endividamento" description="Indicadores de endividamento" />
        <h1 className="text-xl font-semibold text-[#000638]">Endividamento</h1>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="mr-2" loading={importing} onClick={handleDashboard}>DASHBOARD</Button>
          <Button variant="secondary" className="mr-2" loading={importing} onClick={handleTable}>TABELA</Button>
        </div>
        <div className="flex items-center">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFilePicked} className="hidden" />
          <Button variant="secondary" onClick={triggerExcelPicker} className="mr-2" loading={importing}>
            ADICIONAR ARQUIVO EXCEL
          </Button>
          {canAccessAdmin() && (
            <Button variant="danger" onClick={() => setConfirmMassDeleteOpen(true)} className="mr-2">
              REMOVER TODOS OS REGISTROS
            </Button>
          )}
          <Button variant="primary" onClick={openCreate}>
            ADICIONAR NOVO
          </Button>
          <Button variant="secondary" onClick={handleExportExcel} className="ml-2">
            BAIXAR EXCEL
          </Button>
        </div>
      </div>

      {/* Botão Limpar Filtros */}
      {Object.keys(columnFilters).length > 0 && (
        <div className="mb-4 text-right">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setColumnFilters({})}
            leftIcon={<FunnelSimple size={14} className="text-gray-500" />}
          >
            Limpar Filtros
          </Button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Editar Endividamento" : "Adicionar novo endividamento"} size="3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Instituição"
            name="instituicao"
            value={form.instituicao}
            onChange={handleChange}
            required
            error={errors.instituicao}
          />
          <Input
            label="Razão Social - Tomador"
            name="razaoSocialTomador"
            value={form.razaoSocialTomador}
            onChange={handleChange}
            required
            error={errors.razaoSocialTomador}
          />

          <Input
            label="CNPJ Tomador"
            name="cnpjTomador"
            value={form.cnpjTomador}
            onChange={handleChange}
            placeholder="Apenas números"
            maxLength={18}
            error={errors.cnpjTomador}
          />
          <Input
            label="AG"
            name="ag"
            value={form.ag}
            onChange={handleChange}
          />

          <Input
            label="CC"
            name="cc"
            value={form.cc}
            onChange={handleChange}
          />
          <Input
            label="Linha de Crédito"
            name="linhaCredito"
            value={form.linhaCredito}
            onChange={handleChange}
          />

          <Input
            label="Número do contrato"
            name="numeroContrato"
            value={form.numeroContrato}
            onChange={handleChange}
          />
          <Input
            type="date"
            label="Data da Contratação"
            name="dataContratacao"
            value={form.dataContratacao}
            onChange={handleChange}
          />

          <Input
            type="date"
            label="Vencimento Final da Operação"
            name="vencimentoFinal"
            value={form.vencimentoFinal}
            onChange={handleChange}
          />
          <Input
            type="text"
            label="Limites Aprovados/ Valor do Contrato"
            name="limiteAprovado"
            value={form.limiteAprovado ? formatBRL(form.limiteAprovado) : ''}
            onChange={handleCurrencyChange('limiteAprovado')}
            placeholder="R$ 0,00"
            inputMode="numeric"
          />

          <Input
            type="text"
            label="Saldo devedor nominal s/ juros"
            name="saldoDevedorSemJuros"
            value={form.saldoDevedorSemJuros ? formatBRL(form.saldoDevedorSemJuros) : ''}
            onChange={handleCurrencyChange('saldoDevedorSemJuros')}
            placeholder="R$ 0,00"
            inputMode="numeric"
          />
          <Input
            type="text"
            label="Saldo devedor total c/ juros"
            name="saldoDevedorComJuros"
            value={form.saldoDevedorComJuros ? formatBRL(form.saldoDevedorComJuros) : ''}
            onChange={handleCurrencyChange('saldoDevedorComJuros')}
            placeholder="R$ 0,00"
            inputMode="numeric"
          />

          <Input
            type="text"
            label="Valor Mensal PMT"
            name="valorMensalPMT"
            value={form.valorMensalPMT ? formatBRL(form.valorMensalPMT) : ''}
            onChange={handleCurrencyChange('valorMensalPMT')}
            placeholder="R$ 0,00"
            inputMode="numeric"
          />
          <Input
            type="number"
            label="Quantidade PMT"
            name="quantidadePMT"
            value={form.quantidadePMT}
            onChange={handleChange}
            placeholder="0"
            inputMode="numeric"
          />

          <Input
            type="number"
            label="Quantas já pagamos PMT paga"
            name="pmtPagas"
            value={form.pmtPagas}
            onChange={handleChange}
            placeholder="0"
            inputMode="numeric"
          />
          <Input
            type="text"
            label="Diferença PMT a vencer"
            name="diferencaPMTVencer"
            value={form.diferencaPMTVencer ? formatBRL(form.diferencaPMTVencer) : ''}
            onChange={handleCurrencyChange('diferencaPMTVencer')}
            placeholder="R$ 0,00"
            inputMode="numeric"
          />

          <Input
            type="date"
            label="Data inicial de pagamento"
            name="dataInicialPagamento"
            value={form.dataInicialPagamento}
            onChange={handleChange}
          />
          <Input
            type="number"
            step="0.0001"
            label="Taxa juros % a.m"
            name="taxaJurosMes"
            value={form.taxaJurosMes}
            onChange={handleChange}
            error={errors.taxaJurosMes}
          />

          <Input
            label="Avalista"
            name="avalista"
            value={form.avalista}
            onChange={handleChange}
          />
          <Input
            label="Garantias"
            name="garantias"
            value={form.garantias}
            onChange={handleChange}
          />
        </div>

        {/* Anexo de contrato */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Anexo do contrato (PDF ou Word)</label>
          <input
            type="file"
            name="anexoContrato"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-200 file:text-gray-800 hover:file:bg-gray-300"
          />
          {form.anexoContrato && (
            <div className="text-sm text-gray-600 flex items-center gap-3">
              <span>Selecionado: {form.anexoContrato.name}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setForm((prev) => ({ ...prev, anexoContrato: null }))}
              >
                Remover
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={submitting}>
            Salvar
          </Button>
          <Button type="button" variant="secondary" onClick={() => setForm({
            instituicao: '',
            razaoSocialTomador: '',
            cnpjTomador: '',
            ag: '',
            cc: '',
            linhaCredito: '',
            numeroContrato: '',
            dataContratacao: '',
            vencimentoFinal: '',
            limiteAprovado: '',
            saldoDevedorSemJuros: '',
            saldoDevedorComJuros: '',
            valorMensalPMT: '',
            quantidadePMT: '',
            pmtPagas: '',
            diferencaPMTVencer: '',
            dataInicialPagamento: '',
            taxaJurosMes: '',
            avalista: '',
            garantias: '',
            anexoContrato: null
          })}>
            Limpar
          </Button>
          {editingId && (
            <Button type="button" variant="danger" onClick={handleClickDelete}>
              DELETAR  REGISTRO
            </Button>
          )}
        </div>
      </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="DESEJA REALMENTE REMOVER O REGISTRO?"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Essa ação não pode ser desfeita.</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteOpen(false)}>
              NÃO
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>
              SIM
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação de importação */}
      <Modal
        isOpen={confirmImportOpen}
        onClose={() => { setConfirmImportOpen(false); setSelectedImportFile(null); }}
        title="DESEJA REALMENTE IMPORTAR O ARQUIVO?"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Arquivo: {selectedImportFile?.name}</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setConfirmImportOpen(false); setSelectedImportFile(null); }}>
              NÃO
            </Button>
            <Button variant="primary" size="sm" onClick={doImportExcel} loading={importing}>
              SIM
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação de remoção em massa */}
      <Modal
        isOpen={confirmMassDeleteOpen}
        onClose={() => setConfirmMassDeleteOpen(false)}
        title="DESEJA REALMENTE REMOVER TODOS OS REGISTROS?"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Essa ação é irreversível.</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmMassDeleteOpen(false)}>
              NÃO
            </Button>
            <Button variant="danger" size="sm" onClick={handleMassDelete} loading={massDeleting}>
              SIM
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de explicação */}
      <Modal
        isOpen={isExplanationModalOpen}
        onClose={closeExplanationModal}
        title={explanationModalTitle}
        size="lg"
      >
        <div className="space-y-4 text-sm">
          {/* Conteúdo dinâmico da explicação */}
          {explanationModalContent}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={closeExplanationModal}>Fechar</Button>
          </div>
        </div>
      </Modal>

      {/* Tabela de registros adicionados */}
      {view === 'table' && (
      <div className="mt-4">
        <Table
          data={filteredAndSortedRows}
          rowKey="id"
          containerClassName="text-sm"
          className="text-sm"
          onRowClick={(row) => handleRowClick(row)}
          columns={tableColumnsBase.map(col => ({
            ...col,
            headerRender: ({ column, sortConfig, handleSort, getSortIcon }) => (
              <div className="relative flex items-center space-x-1">
                <span>{column.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFilterDropdown(column.key);
                  }}
                  className={`hover:text-gray-700 focus:outline-none focus:text-gray-700 ${
                    columnFilters[column.key] ? 'text-blue-600' : 'text-gray-400'
                  }`}
                  aria-label={`Filtrar por ${column.title}`}
                >
                  <FunnelSimple size={16} />
                </button>
                {openFilterDropdown === column.key && (
                  <FilterDropdown
                    columnKey={column.key}
                    columnTitle={column.title}
                    data={filteredAndSortedRows} // Passa os dados já filtrados e ordenados
                    currentFilter={columnFilters[column.key]}
                    onApplyFilter={handleApplyFilter}
                    onClose={() => toggleFilterDropdown(null)}
                  />
                )}
                {/* Adicionar ícone de ordenação padrão se não houver filtro ativo e a coluna for sortable */}
                {!columnFilters[column.key]?.sortDirection && column.sortable !== false && (
                  <span 
                    className="cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSort(column.key);
                    }}
                  >
                    {getSortIcon(column.key)}
                  </span>
                )}
              </div>
            )
          }))}
          emptyMessage="Nenhum endividamento adicionado ainda"
        />
      </div>
    )}
    {view === 'dashboard' && (
      <div className="p-6 space-y-8 text-sm">
        <h2 className="text-2xl font-bold text-[#000638]">Dashboard de Endividamento</h2>

        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Question size={18} className="text-blue-700" /> {/* Ícone para Dívida Bruta */}
                <CardTitle className="text-sm font-bold text-blue-700 flex items-center">
                  Dívida Bruta Total
                  <button
                    type="button"
                    onClick={() => openExplanationModal(
                      'Dívida Bruta Total',
                      <> 
                        <p>Pense na **Dívida Bruta** como o valor total de todas as suas dívidas com bancos e outras instituições.</p>
                        <p className="mt-2">**Como calculamos:** Somamos o *saldo devedor com juros* de todos os seus empréstimos.</p>
                      </>
                    )}
                    className="ml-2 cursor-pointer text-gray-400 hover:text-gray-700"
                    aria-label="Explicar Dívida Bruta Total"
                  >
                    <Question size={16} />
                  </button>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-blue-700 mb-1">
                {formatBRL(totalDividaBruta * 100)}
              </div>
              <CardDescription className="text-xs text-gray-500">Soma de todos os saldos com juros</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Question size={18} className="text-green-700" /> {/* Ícone para WACD */}
                <CardTitle className="text-sm font-bold text-green-700 flex items-center">
                  Custo Médio Ponderado (WACD)
                  <button
                    type="button"
                    onClick={() => openExplanationModal(
                      'Custo Médio Ponderado (WACD)',
                      <> 
                        <p>O **WACD** é como se fosse a *média das taxas de juros* que você paga em todos os seus empréstimos, levando em conta o tamanho de cada dívida. Se você tem uma dívida grande com juros altos, ela pesa mais na média.</p>
                        <p className="mt-2">**Como calculamos (Mensal):** Somamos (cada saldo devedor &times; sua taxa de juros) e dividimos pela soma de todos os saldos.</p>
                        <p className="mt-1">**Como calculamos (Anualizado):** Transformamos a taxa mensal em uma taxa anual para ver o custo ao longo de 12 meses.</p>
                      </>
                    )}
                    className="ml-2 cursor-pointer text-gray-400 hover:text-gray-700"
                    aria-label="Explicar Custo Médio Ponderado (WACD)"
                  >
                    <Question size={16} />
                  </button>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-bold text-green-700 mb-1">
                Mensal: {formatPercent(wacdMensal)}<br/>
                Anualizado: {formatPercent(wacdAnualizado)}
              </div>
              <CardDescription className="text-xs text-gray-500">Custo efetivo da dívida</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Question size={18} className="text-orange-700" /> {/* Ícone para WAM */}
                <CardTitle className="text-sm font-bold text-orange-700 flex items-center">
                  Prazo Médio (WAM)
                  <button
                    type="button"
                    onClick={() => openExplanationModal(
                      'Prazo Médio (WAM)',
                      <> 
                        <p>O **WAM** é como a *média de tempo* que você ainda tem para pagar todos os seus empréstimos, considerando o tamanho de cada dívida. Se você tem uma dívida grande que vence logo, ela puxa a média para baixo.</p>
                        <p className="mt-2">**Como calculamos:** Somamos (cada saldo devedor &times; meses até o vencimento) e dividimos pela soma de todos os saldos.</p>
                      </>
                    )}
                    className="ml-2 cursor-pointer text-gray-400 hover:text-gray-700"
                    aria-label="Explicar Prazo Médio (WAM)"
                  >
                    <Question size={16} />
                  </button>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-orange-700 mb-1">
                {wamMeses.toFixed(1)} meses
              </div>
              <CardDescription className="text-xs text-gray-500">Tempo médio para vencimento</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Question size={18} className="text-red-700" /> {/* Ícone para Serviço da Dívida */}
                <CardTitle className="text-sm font-bold text-red-700 flex items-center">
                  Serviço da Dívida 12m
                  <button
                    type="button"
                    onClick={() => openExplanationModal(
                      'Serviço da Dívida 12m',
                      <> 
                        <p>O **Serviço da Dívida 12m** é o *valor total das parcelas (PMTs)* que você terá que pagar nos próximos 12 meses.</p>
                        <p className="mt-2">**Como calculamos:** Somamos as parcelas que ainda vão vencer nos próximos 12 meses, de acordo com o valor mensal de cada PMT.</p>
                      </>
                    )}
                    className="ml-2 cursor-pointer text-gray-400 hover:text-gray-700"
                    aria-label="Explicar Serviço da Dívida 12m"
                  >
                    <Question size={16} />
                  </button>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-700 mb-1">
                {formatBRL(servicoDivida12m * 100)}
              </div>
              <CardDescription className="text-xs text-gray-500">PMTs a vencer nos próximos 12 meses</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg" role="alert">
            <p className="font-bold flex items-center">
              Alertas Inteligentes
              <button
                type="button"
                onClick={() => openExplanationModal(
                  'Alertas Inteligentes',
                  <> 
                    <p>Estes são *avisos automáticos* que aparecem quando algo na sua dívida merece atenção. É como um semáforo que acende o amarelo ou vermelho para te alertar!</p>
                    <p className="mt-2">**Quando ele te avisa:**</p>
                    <ul className="list-disc list-inside ml-4">
                      <li>`WAM &lt; 6 meses`: Se você tem pouco tempo para pagar suas dívidas, há um *risco de ter que pedir dinheiro novo muito rápido*.</li>
                      <li>`WACD anual &gt; 30%`: Se o *custo médio anual dos juros está muito alto*, talvez seja hora de negociar taxas melhores.</li>
                      <li>`Concentração &gt; 40% em um banco`: Se você *deve muito dinheiro para um único banco*, pode ser arriscado se algo acontecer com ele. É bom ter dívidas com vários bancos.</li>
                    </ul>
                  </>
                )}
                className="ml-2 cursor-pointer text-yellow-700 hover:text-yellow-800"
                aria-label="Explicar Alertas Inteligentes"
              >
                <Question size={16} />
              </button>
            </p>
            <ul className="mt-2 list-disc list-inside">
              {alerts.map((alert, index) => <li key={index}>{alert}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Maturity Wall Chart */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              Parede de Vencimentos (Próximos 18 meses)
              <button
                type="button"
                onClick={() => openExplanationModal(
                  'Parede de Vencimentos (Maturity Wall)',
                  <> 
                    <p>Imagine uma *parede de blocos*, onde cada bloco é o total que você tem a pagar em um determinado mês. Este gráfico mostra quanto de dívida (em parcelas) vence em cada um dos próximos 18 meses.</p>
                    <p className="mt-2">**Para que serve:** Ajuda a ver se você terá que pagar muito em algum mês específico, para se preparar e não ser pego de surpresa.</p>
                  </>
                )}
                className="ml-2 cursor-pointer text-gray-400 hover:text-gray-700"
                aria-label="Explicar Parede de Vencimentos (Maturity Wall)"
              >
                <Question size={16} />
              </button>
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={maturityWallData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatBRL(value * 100)} />
                <Tooltip formatter={(value) => formatBRL(value * 100)} />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="PMT Mensal" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Concentração por Instituição Chart */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              Concentração por Instituição
              <button
                type="button"
                onClick={() => openExplanationModal(
                  'Concentração por Instituição',
                  <> 
                    <p>Este gráfico de pizza mostra *para quais bancos você mais deve*. Cada fatia representa um banco e o tamanho da fatia mostra a proporção da sua dívida total com aquele banco.</p>
                    <p className="mt-2">**Como calculamos:** Somamos o saldo devedor com juros que você tem com cada banco e mostramos a fatia que ele representa no total.</p>
                    <p className="mt-1">**Para que serve:** Ajuda a ver se você está muito dependente de um único banco, o que pode ser um risco.</p>
                  </>
                )}
                className="ml-2 cursor-pointer text-gray-400 hover:text-gray-700"
                aria-label="Explicar Concentração por Instituição"
              >
                <Question size={16} />
              </button>
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={concentracaoInstituicaoData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {concentracaoInstituicaoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatBRL(value * 100)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 10 Contratos Table */}
        <div className="bg-white p-4 rounded-lg shadow overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            Top 10 Contratos por Saldo
            <button
                type="button"
                onClick={() => openExplanationModal(
                  'Top 10 Contratos por Saldo',
                  <> 
                    <p>Esta é uma tabela com os *10 maiores empréstimos* que você tem, do maior para o menor.</p>
                    <p className="mt-2">**O que você vê:** Instituição (o banco), Contrato (o número do seu empréstimo), Linha de Crédito (o tipo de empréstimo), Saldo c/ Juros (quanto você ainda deve com juros), Taxa juros % a.m (quanto de juros por mês), PMT Mensal (o valor da parcela mensal), Vencimento Final (quando você termina de pagar).</p>
                    <p className="mt-1">**Para que serve:** Ajuda a focar nos empréstimos que mais impactam suas finanças.</p>
                  </>
                )}
                className="ml-2 cursor-pointer text-gray-400 hover:text-gray-700"
                aria-label="Explicar Top 10 Contratos por Saldo"
              >
                <Question size={16} />
              </button>
          </h3>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Instituição</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Contrato</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Linha de Crédito</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Saldo c/ Juros</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Taxa juros % a.m</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PMT Mensal</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Vencimento Final</th>
              </tr>
            </thead>{/* <!-- Fix for linter -->*/}
            <tbody className="bg-white divide-y divide-gray-200">
              {top10Contratos.length > 0 ? (top10Contratos.map((contrato, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">{contrato.instituicao}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{contrato.numeroContrato}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{contrato.linhaCredito}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatBRL(contrato.saldoDevedorComJuros * 100)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatPercent(contrato.taxaJurosMes)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatBRL(contrato.valorMensalPMT * 100)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(contrato.vencimentoFinal).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))) : (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">Nenhum contrato encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
    </div>
  );
};

export default Endividamento;



