import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageTitle from '../components/ui/PageTitle';
import FiltroTipoClassificacao from '../components/FiltroTipoClassificacao';
import FiltroClassificacao from '../components/FiltroClassificacao';
import FiltroCdPessoa from '../components/FiltroCdPessoa';
import FiltroNomePessoa from '../components/FiltroNomePessoa';
import {
  Clock,
  ArrowsClockwise,
  Calendar,
  FunnelSimple,
} from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import Table from '../components/ui/Table';
import FilterDropdown from '../components/ui/FilterDropdown';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Clientes = () => {
  const apiClient = useApiClient();
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
  });
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Estados para filtros e ordenação da tabela
  const [columnFilters, setColumnFilters] = useState({});
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Estado para alternar entre visualizações
  const [viewMode, setViewMode] = useState('dados'); // 'dados' ou 'classificacao'

  // Estados para seleção múltipla de filtros
  const [tiposClassificacaoSelecionados, setTiposClassificacaoSelecionados] =
    useState([]);
  const [classificacoesSelecionadas, setClassificacoesSelecionadas] = useState(
    [],
  );
  const [cdPessoasSelecionados, setCdPessoasSelecionados] = useState([]);
  const [nomesPessoaSelecionados, setNomesPessoaSelecionados] = useState([]);

  // Dados para os filtros (opções disponíveis)
  const dadosTipoClassificacao = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.ds_tipoclas || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);

  const dadosClassificacaoFiltro = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.ds_classificacao || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);

  const dadosCdPessoa = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.cd_pessoa || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);

  const dadosNomePessoa = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.nm_pessoa || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);

  // Definir datas padrão (mês atual)
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    setFiltros({
      dataInicio: primeiroDia.toISOString().split('T')[0],
      dataFim: ultimoDia.toISOString().split('T')[0],
    });
  }, []);

  // Função para buscar dados da API
  const buscarDados = useCallback(async () => {
    if (!filtros.dataInicio || !filtros.dataFim) return;

    setLoading(true);
    setErro('');

    try {
      // Preparar parâmetros para a API
      const params = {
        dt_inicio: filtros.dataInicio,
        dt_fim: filtros.dataFim,
      };

      const response = await apiClient.utils.cadastroPessoa(params);

      if (response.success) {
        setDados(response.data || []);
      } else {
        setErro(response.message || 'Erro ao buscar dados');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setErro('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  }, [filtros.dataInicio, filtros.dataFim, apiClient]);

  // Função para aplicar filtros
  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

  // Função para toggle do dropdown de filtros
  const toggleFilterDropdown = useCallback((colKey) => {
    setOpenFilterDropdown((prev) => (prev === colKey ? null : colKey));
  }, []);

  // Função para aplicar filtros da tabela
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

  // Estados de seleção múltipla ao estilo "Fornecedor"
  const [selTipoClass, setSelTipoClass] = useState([]);
  const [selClassificacao, setSelClassificacao] = useState([]);
  const [selCdPessoa, setSelCdPessoa] = useState([]);
  const [selNmPessoa, setSelNmPessoa] = useState([]);

  const [buscaTipo, setBuscaTipo] = useState('');
  const [buscaClass, setBuscaClass] = useState('');
  const [buscaCd, setBuscaCd] = useState('');
  const [buscaNm, setBuscaNm] = useState('');

  // Filtro por quantidade de tipos por cliente: TODOS | UNICO | MULTIPLOS
  const [filtroQtdTipos, setFiltroQtdTipos] = useState('TODOS');

  // Opções únicas para seletores
  const opcoesTipoClass = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.ds_tipoclas || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);
  const opcoesClassificacao = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.ds_classificacao || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);
  const opcoesCdPessoa = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.cd_pessoa || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);
  const opcoesNmPessoa = useMemo(() => {
    return Array.from(
      new Set(
        (dados || [])
          .map((d) => String(d.nm_pessoa || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [dados]);

  // Dados filtrados e ordenados
  // Pré-filtro base por Tipo Classificação e Classificação
  const dadosBase = useMemo(() => {
    // Os filtros já são aplicados na API, então não precisamos filtrar novamente aqui
    return dados;
  }, [dados]);

  const dadosFiltrados = useMemo(() => {
    // Aplicar seleções (multi-select com busca) antes dos filtros da tabela
    let currentData = [...dadosBase];
    // Filtro por quantidade de tipos: baseia-se nas classificações agrupadas
    if (filtroQtdTipos !== 'TODOS') {
      // construir mapa cliente -> conjunto de tipos
      const tiposPorCliente = new Map();
      dadosBase.forEach((row) => {
        const key = `${row.cd_empresa}-${row.nr_cpfcnpj}`;
        const set = tiposPorCliente.get(key) || new Set();
        if (row.ds_tipoclas) set.add(String(row.ds_tipoclas).trim());
        tiposPorCliente.set(key, set);
      });
      currentData = currentData.filter((row) => {
        const key = `${row.cd_empresa}-${row.nr_cpfcnpj}`;
        const qtd = (tiposPorCliente.get(key) || new Set()).size;
        return filtroQtdTipos === 'UNICO' ? qtd === 1 : qtd > 1;
      });
    }
    if (selTipoClass.length > 0) {
      currentData = currentData.filter((row) =>
        selTipoClass.includes(String(row.ds_tipoclas || '').trim()),
      );
    }
    if (selClassificacao.length > 0) {
      currentData = currentData.filter((row) =>
        selClassificacao.includes(String(row.ds_classificacao || '').trim()),
      );
    }
    if (selCdPessoa.length > 0) {
      currentData = currentData.filter((row) =>
        selCdPessoa.includes(String(row.cd_pessoa || '').trim()),
      );
    }
    if (selNmPessoa.length > 0) {
      currentData = currentData.filter((row) =>
        selNmPessoa.includes(String(row.nm_pessoa || '').trim()),
      );
    }

    // Aplicar filtros
    Object.keys(columnFilters).forEach((key) => {
      const filter = columnFilters[key];
      if (filter.searchTerm) {
        currentData = currentData.filter((row) =>
          String(row[key])
            .toLowerCase()
            .includes(filter.searchTerm.toLowerCase()),
        );
      }
      if (filter.selected && filter.selected.length > 0) {
        currentData = currentData.filter((row) =>
          filter.selected.includes(String(row[key])),
        );
      }
    });

    // Aplicar ordenação
    const activeSortKey = Object.keys(columnFilters).find(
      (key) => columnFilters[key]?.sortDirection,
    );
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
  }, [
    dadosBase,
    columnFilters,
    selTipoClass,
    selClassificacao,
    selCdPessoa,
    selNmPessoa,
    filtroQtdTipos,
  ]);

  // Dados de classificação - uma linha por cliente com badges das classificações
  const dadosClassificacao = useMemo(() => {
    const clientesMap = new Map();

    dadosBase.forEach((item) => {
      const chaveCliente = `${item.cd_empresa}-${item.nr_cpfcnpj}`;

      if (!clientesMap.has(chaveCliente)) {
        clientesMap.set(chaveCliente, {
          cd_empresa: item.cd_empresa,
          nr_cpfcnpj: item.nr_cpfcnpj,
          cd_pessoa: item.cd_pessoa,
          nm_pessoa: item.nm_pessoa,
          nm_fantasia: item.nm_fantasia,
          classificacoes: [],
        });
      }

      const cliente = clientesMap.get(chaveCliente);
      const chaveClassificacao = `${item.ds_tipoclas}-${item.ds_classificacao}`;

      // Evitar duplicatas da mesma classificação
      if (!cliente.classificacoes.some((c) => c.key === chaveClassificacao)) {
        cliente.classificacoes.push({
          key: chaveClassificacao,
          tipo: item.ds_tipoclas,
          classificacao: item.ds_classificacao,
          dt_transacao: item.dt_transacao,
        });
      }
    });

    return Array.from(clientesMap.values()).map((cliente) => ({
      ...cliente,
      totalClassificacoes: cliente.classificacoes.length,
    }));
  }, [dadosBase]);

  // Dados de classificação filtrados
  const dadosClassificacaoFiltrados = useMemo(() => {
    let currentData = [...dadosClassificacao];

    // Aplicar seleções também na visão de classificação
    if (selCdPessoa.length > 0) {
      currentData = currentData.filter((row) =>
        selCdPessoa.includes(String(row.cd_pessoa || '').trim()),
      );
    }
    if (selNmPessoa.length > 0) {
      currentData = currentData.filter((row) =>
        selNmPessoa.includes(String(row.nm_pessoa || '').trim()),
      );
    }
    if (selTipoClass.length > 0) {
      currentData = currentData.filter((row) =>
        (row.classificacoes || []).some((c) =>
          selTipoClass.includes(String(c.tipo || '').trim()),
        ),
      );
    }
    if (selClassificacao.length > 0) {
      currentData = currentData.filter((row) =>
        (row.classificacoes || []).some((c) =>
          selClassificacao.includes(String(c.classificacao || '').trim()),
        ),
      );
    }

    // Filtro por quantidade de tipos por cliente
    if (filtroQtdTipos !== 'TODOS') {
      currentData = currentData.filter((row) => {
        const tiposUnicos = Array.from(
          new Set(
            (row.classificacoes || []).map((c) => String(c.tipo || '').trim()),
          ),
        );
        return filtroQtdTipos === 'UNICO'
          ? tiposUnicos.length === 1
          : tiposUnicos.length > 1;
      });
    }

    // Aplicar filtros
    Object.keys(columnFilters).forEach((key) => {
      const filter = columnFilters[key];
      if (filter.searchTerm) {
        currentData = currentData.filter((row) =>
          String(row[key])
            .toLowerCase()
            .includes(filter.searchTerm.toLowerCase()),
        );
      }
      if (filter.selected && filter.selected.length > 0) {
        currentData = currentData.filter((row) =>
          filter.selected.includes(String(row[key])),
        );
      }
    });

    // Aplicar ordenação
    const activeSortKey = Object.keys(columnFilters).find(
      (key) => columnFilters[key]?.sortDirection,
    );
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
  }, [
    dadosClassificacao,
    columnFilters,
    selTipoClass,
    selClassificacao,
    selCdPessoa,
    selNmPessoa,
    filtroQtdTipos,
  ]);

  // Dados paginados baseados no modo de visualização
  const dadosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const dadosAtuais =
      viewMode === 'dados' ? dadosFiltrados : dadosClassificacaoFiltrados;
    return dadosAtuais.slice(startIndex, endIndex);
  }, [
    dadosFiltrados,
    dadosClassificacaoFiltrados,
    currentPage,
    itemsPerPage,
    viewMode,
  ]);

  // Cálculos de paginação baseados no modo de visualização
  const dadosAtuais =
    viewMode === 'dados' ? dadosFiltrados : dadosClassificacaoFiltrados;
  const totalPages = Math.ceil(dadosAtuais.length / itemsPerPage);
  const startRecord = (currentPage - 1) * itemsPerPage + 1;
  const endRecord = Math.min(currentPage * itemsPerPage, dadosAtuais.length);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [
    columnFilters,
    dados,
    selTipoClass,
    selClassificacao,
    selCdPessoa,
    selNmPessoa,
    filtroQtdTipos,
  ]);

  // CSS customizado para tabela com fonte pequena
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .clientes-table {
        font-size: 10px !important;
      }
      .clientes-table th,
      .clientes-table td {
        font-size: 10px !important;
        padding: 4px 6px !important;
        line-height: 1.2 !important;
      }
      .clientes-table th {
        font-weight: 600 !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Formatação de data
  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return value;
    }
  };

  // Exportar para Excel (dados filtrados do modo atual)
  const handleExportExcel = () => {
    const rows =
      viewMode === 'dados' ? dadosFiltrados : dadosClassificacaoFiltrados;
    if (!rows || rows.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    let exportRows;
    if (viewMode === 'dados') {
      exportRows = rows.map((r) => ({
        'CD Pessoa': r.cd_pessoa ?? '',
        'Nome Pessoa': r.nm_pessoa ?? '',
        'Nome Fantasia': r.nm_fantasia ?? '',
        'CPF/CNPJ': r.nr_cpfcnpj ?? '',
        Empresa: r.cd_empresa ?? '',
        'Tipo Classificação': r.ds_tipoclas ?? '',
        Classificação: r.ds_classificacao ?? '',
        'Data Transação': formatDate(r.dt_transacao),
      }));
    } else {
      exportRows = rows.map((r) => ({
        'CD Pessoa': r.cd_pessoa ?? '',
        'Nome Pessoa': r.nm_pessoa ?? '',
        'Nome Fantasia': r.nm_fantasia ?? '',
        'Qtde Classificações': r.totalClassificacoes ?? 0,
        Tipos: (r.classificacoes || []).map((c) => c.tipo).join(', '),
        Classificações: (r.classificacoes || [])
          .map((c) => c.classificacao)
          .join(', '),
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      viewMode === 'dados' ? 'Dados' : 'Classificacao',
    );
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    saveAs(blob, `clientes-${viewMode}-${hoje}.xlsx`);
  };

  // Definição das colunas da tabela de dados
  const tableColumnsDados = [
    {
      key: 'cd_empresa',
      title: 'Código Empresa',
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
      ),
    },
    {
      key: 'nr_cpfcnpj',
      title: 'CPF/CNPJ',
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
      ),
    },
    {
      key: 'cd_pessoa',
      title: 'CD Pessoa',
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
      ),
    },
    {
      key: 'nm_pessoa',
      title: 'Nome da Pessoa',
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
      ),
    },
    {
      key: 'nm_fantasia',
      title: 'Nome Fantasia',
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
      ),
    },
    {
      key: 'cd_operacao',
      title: 'Código Operação',
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
      ),
    },
    {
      key: 'ds_tipoclas',
      title: 'Descrição Tipo Classificação',
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
      ),
    },
    {
      key: 'ds_classificacao',
      title: 'Descrição Classificação',
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
      ),
    },
    {
      key: 'dt_transacao',
      title: 'Data Transação',
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
      ),
    },
  ];

  // Definição das colunas da tabela de classificação
  const tableColumnsClassificacao = [
    {
      key: 'cd_empresa',
      title: 'Código Cliente',
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
      ),
    },
    {
      key: 'cd_pessoa',
      title: 'CD Pessoa',
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
      ),
    },
    {
      key: 'nm_pessoa',
      title: 'Nome Pessoa',
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
      ),
    },
    {
      key: 'nm_fantasia',
      title: 'Nome Fantasia',
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
      ),
    },
    {
      key: 'totalClassificacoes',
      title: 'Total',
      render: (v) => v || 0,
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
      ),
    },
    {
      key: 'tiposClassificacao',
      title: 'Tipo Classificação',
      render: (_, row) => {
        const classificacoes = row.classificacoes || [];
        if (classificacoes.length === 0) {
          return (
            <span className="inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-full text-xs font-medium bg-gray-800 text-white dark:bg-white dark:text-neutral-800">
              Nenhum
            </span>
          );
        }

        // Paleta de cores por tipo
        const palette = [
          'bg-indigo-600 text-white',
          'bg-emerald-600 text-white',
          'bg-amber-600 text-white',
          'bg-rose-600 text-white',
          'bg-sky-600 text-white',
          'bg-violet-600 text-white',
          'bg-lime-600 text-white',
          'bg-fuchsia-600 text-white',
        ];
        const colorFor = (key) => {
          const idx =
            Math.abs(
              String(key)
                .split('')
                .reduce((a, c) => a + c.charCodeAt(0), 0),
            ) % palette.length;
          return palette[idx];
        };

        return (
          <div className="flex flex-wrap gap-1">
            {classificacoes.map((c, index) => (
              <span
                key={index}
                className={`inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-[10px] font-medium ${colorFor(
                  c.tipo,
                )} dark:bg-white dark:text-neutral-800`}
              >
                {c.tipo}
              </span>
            ))}
          </div>
        );
      },
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
      ),
    },
    {
      key: 'classificacoes',
      title: 'Classificação',
      render: (_, row) => {
        const classificacoes = row.classificacoes || [];
        if (classificacoes.length === 0) {
          return (
            <span className="inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-full text-xs font-medium bg-gray-800 text-white dark:bg-white dark:text-neutral-800">
              Nenhuma
            </span>
          );
        }

        // Paleta de cores por classificação
        const palette = [
          'bg-gray-800 text-white',
          'bg-blue-600 text-white',
          'bg-green-600 text-white',
          'bg-yellow-600 text-white',
          'bg-red-600 text-white',
          'bg-cyan-600 text-white',
          'bg-purple-600 text-white',
          'bg-pink-600 text-white',
        ];
        const colorFor = (key) => {
          const idx =
            Math.abs(
              String(key)
                .split('')
                .reduce((a, c) => a + c.charCodeAt(0), 0),
            ) % palette.length;
          return palette[idx];
        };

        return (
          <div className="flex flex-wrap gap-1">
            {classificacoes.map((c, index) => (
              <span
                key={index}
                className={`inline-flex items-center gap-x-1 py-0.5 px-2 rounded-full text-[10px] font-medium ${colorFor(
                  c.classificacao,
                )} dark:bg-white dark:text-neutral-800`}
              >
                {c.classificacao}
              </span>
            ))}
          </div>
        );
      },
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
      ),
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
      <PageTitle
        title="Classificação de Clientes"
        subtitle="Análise da classificação de clientes baseado nas transações por período"
        icon={Clock}
        iconColor="text-green-600"
      />

      {/* Filtros */}
      <div className="mb-6">
        <form
          onSubmit={handleFiltrar}
          className="bg-white p-4 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-[#000638]/10"
        >
          {/* Header do Filtro */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-[#000638]" />
              <h2 className="text-lg font-bold text-[#000638]">
                Filtros de Período
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              Selecione o período para análise das transações dos clientes
            </p>
          </div>

          {/* Campos do Filtro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Data Inicial */}
            <div className="flex flex-col">
              <label className="block text-sm font-semibold mb-2 text-[#000638]">
                Data Transação Inicial
              </label>
              <input
                type="date"
                name="dataInicio"
                value={filtros.dataInicio}
                onChange={(e) =>
                  setFiltros({ ...filtros, dataInicio: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-[#000638] focus:border-[#000638] bg-white text-[#000638] placeholder:text-gray-400 transition-all duration-200 text-xs"
                placeholder="Data inicial"
              />
            </div>

            {/* Data Final */}
            <div className="flex flex-col">
              <label className="block text-sm font-semibold mb-2 text-[#000638]">
                Data Transação Final
              </label>
              <input
                type="date"
                name="dataFim"
                value={filtros.dataFim}
                onChange={(e) =>
                  setFiltros({ ...filtros, dataFim: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-[#000638] focus:border-[#000638] bg-white text-[#000638] placeholder:text-gray-400 transition-all duration-200 text-xs"
                placeholder="Data final"
              />
            </div>

            {/* Quantidade de Tipos */}
            <div className="flex flex-col">
              <label className="block text-sm font-semibold mb-2 text-[#000638]">
                Quantidade de Tipos
              </label>
              <select
                value={filtroQtdTipos}
                onChange={(e) => setFiltroQtdTipos(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 w-full text-xs bg-white"
              >
                <option value="TODOS">TODOS</option>
                <option value="UNICO">ÚNICO</option>
                <option value="MULTIPLOS">MÚLTIPLOS</option>
              </select>
            </div>

            {/* Tipo Classificação - Componente Filtro */}
            <div className="flex flex-col">
              <FiltroTipoClassificacao
                tiposClassificacaoSelecionados={selTipoClass}
                onSelectTiposClassificacao={setSelTipoClass}
                dadosTipoClassificacao={dadosTipoClassificacao}
              />
            </div>

            {/* Classificação - Componente Filtro */}
            <div className="flex flex-col">
              <FiltroClassificacao
                classificacoesSelecionadas={selClassificacao}
                onSelectClassificacoes={setSelClassificacao}
                dadosClassificacao={dadosClassificacaoFiltro}
              />
            </div>

            {/* CD Pessoa - Componente Filtro */}
            <div className="flex flex-col">
              <FiltroCdPessoa
                cdPessoasSelecionados={selCdPessoa}
                onSelectCdPessoas={setSelCdPessoa}
                dadosCdPessoa={dadosCdPessoa}
              />
            </div>

            {/* Nome Pessoa - Componente Filtro */}
            <div className="flex flex-col">
              <FiltroNomePessoa
                nomesPessoaSelecionados={selNmPessoa}
                onSelectNomesPessoa={setSelNmPessoa}
                dadosNomePessoa={dadosNomePessoa}
              />
            </div>

            {/* Botão de Ação */}
            <div className="flex flex-col justify-center">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-[#000638] text-white px-3 py-1.5 rounded-md hover:bg-[#001060] transition-all duration-200 text-xs font-semibold shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Filtrando...
                  </>
                ) : (
                  <>
                    <ArrowsClockwise size={16} weight="bold" />
                    Filtrar Dados
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Botão Limpar Filtros */}
      {Object.keys(columnFilters).length > 0 && (
        <div className="mb-4 text-right">
          <button
            onClick={() => setColumnFilters({})}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FunnelSimple size={14} />
            Limpar Filtros
          </button>
        </div>
      )}

      {/* Botões de alternância */}
      <div className="mb-4 flex justify-center">
        <div className="bg-gray-100 rounded-lg p-1 flex">
          <button
            onClick={() => setViewMode('dados')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              viewMode === 'dados'
                ? 'bg-white text-[#000638] shadow-sm'
                : 'text-gray-600 hover:text-[#000638]'
            }`}
          >
            DADOS CLIENTES
          </button>
          <button
            onClick={() => setViewMode('classificacao')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              viewMode === 'classificacao'
                ? 'bg-white text-[#000638] shadow-sm'
                : 'text-gray-600 hover:text-[#000638]'
            }`}
          >
            CLASSIFICAÇÃO CLIENTES
          </button>
        </div>
      </div>

      {/* Área de conteúdo */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#000638]">
            {viewMode === 'dados'
              ? 'Dados dos Clientes'
              : 'Classificação dos Clientes'}
          </h3>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              Período: {filtros.dataInicio} até {filtros.dataFim}
              {dados.length > 0 && (
                <span className="ml-2 text-blue-600 font-medium">
                  Mostrando {startRecord}-{endRecord} de {dadosAtuais.length}{' '}
                  registros
                  {dadosAtuais.length !== dados.length &&
                    ` (${dados.length} total)`}
                </span>
              )}
            </div>
            {dadosAtuais.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700"
                title="Baixar Excel dos dados filtrados"
              >
                Baixar Excel
              </button>
            )}
          </div>
        </div>

        {/* Mensagem de erro */}
        {erro && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {erro}
          </div>
        )}

        {/* Tabela */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#000638]"></div>
            <span className="ml-2 text-gray-600">Carregando dados...</span>
          </div>
        ) : dadosAtuais.length > 0 ? (
          <>
            <Table
              data={dadosPaginados}
              rowKey={(row, index) =>
                `${row.cd_empresa}-${row.nr_cpfcnpj}-${index}`
              }
              containerClassName="clientes-table"
              className="clientes-table"
              columns={(viewMode === 'dados'
                ? tableColumnsDados
                : tableColumnsClassificacao
              ).map((col) => ({
                ...col,
                headerRender: ({ column }) => (
                  <div className="relative flex items-center space-x-1">
                    <span>{column.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFilterDropdown(column.key);
                      }}
                      className={`hover:text-gray-700 focus:outline-none focus:text-gray-700 ${
                        columnFilters[column.key]
                          ? 'text-blue-600'
                          : 'text-gray-400'
                      }`}
                      aria-label={`Filtrar por ${column.title}`}
                    >
                      <FunnelSimple size={16} />
                    </button>
                    {openFilterDropdown === column.key && (
                      <FilterDropdown
                        columnKey={column.key}
                        columnTitle={column.title}
                        data={dadosFiltrados}
                        currentFilter={columnFilters[column.key]}
                        onApplyFilter={handleApplyFilter}
                        onClose={() => toggleFilterDropdown(null)}
                      />
                    )}
                  </div>
                ),
              }))}
              emptyMessage="Nenhum cliente encontrado para o período selecionado"
            />

            {/* Controles de Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Primeira
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                </div>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`px-3 py-1 text-sm border rounded ${
                          currentPage === pageNumber
                            ? 'bg-[#000638] text-white border-[#000638]'
                            : 'border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Última
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {dados.length === 0
              ? 'Nenhum cliente encontrado para o período selecionado'
              : 'Nenhum cliente corresponde aos filtros aplicados'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Clientes;
