import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { Clock, ArrowsClockwise, Calendar, FunnelSimple } from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import Table from '../components/ui/Table';
import FilterDropdown from '../components/ui/FilterDropdown';

const Clientes = () => {
  const apiClient = useApiClient();
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: ''
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

  // Definir datas padrão (mês atual)
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setFiltros({
      dataInicio: primeiroDia.toISOString().split('T')[0],
      dataFim: ultimoDia.toISOString().split('T')[0]
    });
  }, []);

  // Função para buscar dados da API
  const buscarDados = useCallback(async () => {
    if (!filtros.dataInicio || !filtros.dataFim) return;
    
    setLoading(true);
    setErro('');
    
    try {
      const response = await apiClient.utils.cadastroPessoa({
        dt_inicio: filtros.dataInicio,
        dt_fim: filtros.dataFim
      });
      
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

  // Dados filtrados e ordenados
  const dadosFiltrados = useMemo(() => {
    let currentData = [...dados];

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

    // Aplicar ordenação
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
  }, [dados, columnFilters]);

  // Dados de classificação - uma linha por cliente com badges das classificações
  const dadosClassificacao = useMemo(() => {
    const clientesMap = new Map();
    
    dados.forEach(item => {
      const chaveCliente = `${item.cd_empresa}-${item.nr_cpfcnpj}`;
      
      if (!clientesMap.has(chaveCliente)) {
        clientesMap.set(chaveCliente, {
          cd_empresa: item.cd_empresa,
          nr_cpfcnpj: item.nr_cpfcnpj,
          nm_pessoa: item.nm_pessoa,
          nm_fantasia: item.nm_fantasia,
          classificacoes: []
        });
      }
      
      const cliente = clientesMap.get(chaveCliente);
      const chaveClassificacao = `${item.ds_tipoclas}-${item.ds_classificacao}`;
      
      // Evitar duplicatas da mesma classificação
      if (!cliente.classificacoes.some(c => c.key === chaveClassificacao)) {
        cliente.classificacoes.push({
          key: chaveClassificacao,
          tipo: item.ds_tipoclas,
          classificacao: item.ds_classificacao,
          dt_transacao: item.dt_transacao
        });
      }
    });
    
    return Array.from(clientesMap.values()).map(cliente => ({
      ...cliente,
      totalClassificacoes: cliente.classificacoes.length
    }));
  }, [dados]);

  // Dados de classificação filtrados
  const dadosClassificacaoFiltrados = useMemo(() => {
    let currentData = [...dadosClassificacao];

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

    // Aplicar ordenação
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
  }, [dadosClassificacao, columnFilters]);

  // Dados paginados baseados no modo de visualização
  const dadosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const dadosAtuais = viewMode === 'dados' ? dadosFiltrados : dadosClassificacaoFiltrados;
    return dadosAtuais.slice(startIndex, endIndex);
  }, [dadosFiltrados, dadosClassificacaoFiltrados, currentPage, itemsPerPage, viewMode]);

  // Cálculos de paginação baseados no modo de visualização
  const dadosAtuais = viewMode === 'dados' ? dadosFiltrados : dadosClassificacaoFiltrados;
  const totalPages = Math.ceil(dadosAtuais.length / itemsPerPage);
  const startRecord = (currentPage - 1) * itemsPerPage + 1;
  const endRecord = Math.min(currentPage * itemsPerPage, dadosAtuais.length);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, dados]);

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
      )
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
      )
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
      )
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
      )
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
      )
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
      )
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
      )
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
      )
    }
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
      )
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
      )
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
      )
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
      )
    },
    {
      key: 'tiposClassificacao',
      title: 'Tipo Classificação',
      render: (_, row) => {
        const classificacoes = row.classificacoes || [];
        if (classificacoes.length === 0) {
          return (
            <span className="bg-gray-50 text-gray-500 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm dark:bg-gray-800 dark:text-gray-400">
              Nenhum
            </span>
          );
        }
        
        return (
          <div className="flex flex-wrap gap-1">
            {classificacoes.map((c, index) => (
              <span key={index} className="bg-green-50 text-green-700 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm dark:bg-green-900/20 dark:text-green-400">
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
      )
    },
    {
      key: 'classificacoes',
      title: 'Classificação',
      render: (_, row) => {
        const classificacoes = row.classificacoes || [];
        if (classificacoes.length === 0) {
          return (
            <span className="bg-gray-50 text-gray-500 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm dark:bg-gray-800 dark:text-gray-400">
              Nenhuma
            </span>
          );
        }
        
        return (
          <div className="flex flex-wrap gap-1">
            {classificacoes.map((c, index) => (
              <span key={index} className="bg-purple-50 text-purple-700 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm dark:bg-purple-900/20 dark:text-purple-400">
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
      )
    }
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
        <form onSubmit={handleFiltrar} className="bg-white p-4 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-[#000638]/10">
          {/* Header do Filtro */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-[#000638]" />
              <h2 className="text-lg font-bold text-[#000638]">Filtros de Período</h2>
            </div>
            <p className="text-sm text-gray-600">Selecione o período para análise das transações dos clientes</p>
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
                onChange={e => setFiltros({ ...filtros, dataInicio: e.target.value })} 
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] focus:border-[#000638] bg-white text-[#000638] placeholder:text-gray-400 transition-all duration-200 text-sm" 
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
                onChange={e => setFiltros({ ...filtros, dataFim: e.target.value })} 
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] focus:border-[#000638] bg-white text-[#000638] placeholder:text-gray-400 transition-all duration-200 text-sm" 
                placeholder="Data final"
              />
            </div>

            {/* Botão de Ação */}
            <div className="flex flex-col justify-center">
              <button 
                type="submit" 
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#001060] transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {viewMode === 'dados' ? 'Dados dos Clientes' : 'Classificação dos Clientes'}
          </h3>
          <div className="text-sm text-gray-600">
            Período: {filtros.dataInicio} até {filtros.dataFim}
            {dados.length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                Mostrando {startRecord}-{endRecord} de {dadosAtuais.length} registros
                {dadosAtuais.length !== dados.length && ` (${dados.length} total)`}
              </span>
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
              rowKey={(row, index) => `${row.cd_empresa}-${row.nr_cpfcnpj}-${index}`}
              containerClassName="clientes-table"
              className="clientes-table"
              columns={(viewMode === 'dados' ? tableColumnsDados : tableColumnsClassificacao).map(col => ({
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
                        data={dadosFiltrados}
                        currentFilter={columnFilters[column.key]}
                        onApplyFilter={handleApplyFilter}
                        onClose={() => toggleFilterDropdown(null)}
                      />
                    )}
                  </div>
                )
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
              : 'Nenhum cliente corresponde aos filtros aplicados'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default Clientes;
