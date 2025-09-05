import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import SEOHead from '../components/ui/SEOHead';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import { FunnelSimple } from '@phosphor-icons/react';
import FilterDropdown from '../components/ui/FilterDropdown';
import { createEndividamento, listEndividamentos, updateEndividamento, deleteEndividamento, importEndividamentosFromExcel } from '../lib/endividamentoApi';

const Endividamento = () => {
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
    return `${num.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} % a.m`;
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
      key: 'pmtPagas',
      title: 'PMT Pagas',
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

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <SEOHead title="Endividamento" description="Indicadores de endividamento" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#000638]">Endividamento</h1>
        <div className="flex items-center">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFilePicked} className="hidden" />
          <Button variant="secondary" onClick={triggerExcelPicker} className="mr-2" loading={importing}>
            ADICIONAR ARQUIVO EXCEL
          </Button>
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
            type="text"
            label="Quantidade PMT"
            name="quantidadePMT"
            value={form.quantidadePMT ? formatBRL(form.quantidadePMT) : ''}
            onChange={handleCurrencyChange('quantidadePMT')}
            placeholder="R$ 0,00"
            inputMode="numeric"
          />

          <Input
            type="text"
            label="Quantas já pagamos PMT paga"
            name="pmtPagas"
            value={form.pmtPagas ? formatBRL(form.pmtPagas) : ''}
            onChange={handleCurrencyChange('pmtPagas')}
            placeholder="R$ 0,00"
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

      {/* Tabela de registros adicionados */}
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
    </div>
  );
};

export default Endividamento;



