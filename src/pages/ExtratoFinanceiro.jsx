import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import DropdownContas from '../components/DropdownContas';
import { contas } from "../utils/contas";
import { 
  ArrowsClockwise, 
  CaretDown, 
  CaretRight, 
  ArrowCircleDown, 
  ArrowCircleUp, 
  Receipt, 
  CheckCircle, 
  XCircle, 
  Question,
  CaretUp,
  CaretUpDown,
  Download,
  Spinner
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import LoadingCircle from '../components/LoadingCircle';
import useApiClient from '../hooks/useApiClient';
import ExtratoTotvsTable from '../components/ExtratoTotvsTable';
import ErrorBoundary from '../components/ui/ErrorBoundary';

const PAGE_SIZE = 20; // Paginação client-side com 20 itens por página

const ExtratoFinanceiro = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dadosTotvs, setDadosTotvs] = useState([]);
  const [totalTotvs, setTotalTotvs] = useState(0);
  const [loadingTotvs, setLoadingTotvs] = useState(false);
  const [erroTotvs, setErroTotvs] = useState('');
  const [expandTabelaTotvs, setExpandTabelaTotvs] = useState(true);
  const [filtros, setFiltros] = useState({
    nr_ctapes: [], // agora é array
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [expandTabela, setExpandTabela] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', description: '', calculation: '' });

  // Estados para paginação client-side
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageTotvs, setCurrentPageTotvs] = useState(1);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });
  
  // Estados para seleção de linhas
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());
  


  // CSS customizado para a tabela
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      .extrato-table {
        border-collapse: collapse;
        width: 100%;
      }
      .extrato-table th,
      .extrato-table td {
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
      }
      .extrato-table th:last-child,
      .extrato-table td:last-child {
        border-right: none;
      }
      .extrato-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      .extrato-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      .extrato-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      .extrato-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
      /* CSS para coluna fixa */
      .extrato-table thead th:first-child,
      .extrato-table tbody td:first-child {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        border-right: 2px solid #e5e7eb !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important;
      }
      .extrato-table thead th:first-child {
        background: #000638 !important;
        z-index: 20 !important;
        border-right: 2px solid #374151 !important;
      }
      .extrato-table tbody tr:nth-child(even) td:first-child {
        background: #fafafa !important;
      }
      .extrato-table tbody tr:nth-child(odd) td:first-child {
        background: #ffffff !important;
      }
      .extrato-table tbody tr:hover td:first-child {
        background: #f0f9ff !important;
      }
      .extrato-table tbody tr.bg-blue-100 td:first-child {
        background: #dbeafe !important;
      }
      .extrato-table tbody tr.bg-blue-100:hover td:first-child {
        background: #bfdbfe !important;
      }
      .extrato-table th:first-child input[type="checkbox"] {
        transform: scale(1.1);
      }
      .extrato-table td:first-child input[type="checkbox"] {
        transform: scale(1.1);
      }
    `;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Hook para debounce do filtro de texto


  // Função para ordenação
  const handleSort = useCallback((campo) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Função para ícone de ordenação
  const getSortIcon = useCallback((campo) => {
    if (ordenacao.campo !== campo) {
      return <CaretUpDown size={12} className="opacity-50" />;
    }
    return ordenacao.direcao === 'asc' ? 
      <CaretUp size={12} /> : 
      <CaretDown size={12} />;
  }, [ordenacao]);

  // Função para selecionar/deselecionar linha
  const toggleLinhaSelecionada = useCallback((index) => {
    setLinhasSelecionadas(prev => {
      const nova = new Set(prev);
      if (nova.has(index)) {
        nova.delete(index);
      } else {
        nova.add(index);
      }
      return nova;
    });
  }, []);

  // Dados filtrados e ordenados
  const dadosProcessados = useMemo(() => {
    let dadosFiltrados = [...dados];

    // Aplicar ordenação
    if (ordenacao.campo) {
      dadosFiltrados.sort((a, b) => {
        let valorA = a[ordenacao.campo];
        let valorB = b[ordenacao.campo];

        // Tratamento especial para datas
        if (ordenacao.campo.includes('dt_')) {
          valorA = valorA ? new Date(valorA) : new Date(0);
          valorB = valorB ? new Date(valorB) : new Date(0);
        }

        // Tratamento especial para valores numéricos
        if (ordenacao.campo === 'vl_lancto') {
          valorA = parseFloat(valorA) || 0;
          valorB = parseFloat(valorB) || 0;
        }

        // Tratamento para strings
        if (typeof valorA === 'string') {
          valorA = valorA.toLowerCase();
          valorB = valorB.toLowerCase();
        }

        if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return dadosFiltrados;
  }, [dados, ordenacao]);

  // Dados paginados para exibição
  const dadosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return dadosProcessados.slice(startIndex, endIndex);
  }, [dadosProcessados, currentPage]);

  // Total de páginas para paginação client-side
  const totalPages = Math.ceil(dadosProcessados.length / PAGE_SIZE);

  // Função para selecionar todas as linhas
  const selecionarTodasLinhas = useCallback(() => {
    const todosIndices = dadosProcessados.map((_, index) => index);
    setLinhasSelecionadas(new Set(todosIndices));
  }, [dadosProcessados]);

  // Função para deselecionar todas as linhas
  const deselecionarTodasLinhas = useCallback(() => {
    setLinhasSelecionadas(new Set());
  }, []);

  // Limpar seleção quando dados mudarem
  useEffect(() => {
    setLinhasSelecionadas(new Set());
  }, [dados]);

  // Resetar página quando dados mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [dados]);

  // Resetar página TOTVS quando dados TOTVS mudarem
  useEffect(() => {
    setCurrentPageTotvs(1);
  }, [dadosTotvs]);

  // Função para buscar dados
  const fetchDados = async (filtrosParam = filtros) => {
    setLoading(true);
    setErro('');
    try {
      const params = {
        nr_ctapes: filtrosParam.nr_ctapes,
        dt_movim_ini: filtrosParam.dt_movim_ini,
        dt_movim_fim: filtrosParam.dt_movim_fim,
        limit: 1000000, // Buscar todos os dados de uma vez
        offset: 0
      };

      const result = await apiClient.financial.extrato(params);
      
      if (result.success) {
        setDados(result.data || []);
        setTotal(result.total || 0);
      } else {
        throw new Error(result.message || 'Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar extrato:', err);
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setDadosCarregados(true);
    }
    
    // Buscar também dados do TOTVS
    setLoadingTotvs(true);
    setErroTotvs('');
    try {
      const params = {
        nr_ctapes: filtrosParam.nr_ctapes,
        dt_movim_ini: filtrosParam.dt_movim_ini,
        dt_movim_fim: filtrosParam.dt_movim_fim,
        limit: 1000000, // Buscar todos os dados de uma vez
        offset: 0
      };

      const resultTotvs = await apiClient.financial.extratoTotvs(params);
      
      if (resultTotvs.success) {
        setDadosTotvs(resultTotvs.data || []);
        setTotalTotvs(resultTotvs.total || 0);
      } else {
        throw new Error(resultTotvs.message || 'Erro ao buscar dados TOTVS');
      }
    } catch (err) {
      console.error('Erro ao buscar extrato TOTVS:', err);
      setErroTotvs('Erro ao buscar dados do servidor TOTVS.');
      setDadosTotvs([]);
      setTotalTotvs(0);
    } finally {
      setLoadingTotvs(false);
    }
  };

  const handleChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const handleContaCheckbox = (numero) => {
    setFiltros((prev) => {
      const jaSelecionado = prev.nr_ctapes.includes(numero);
      return {
        ...prev,
        nr_ctapes: jaSelecionado
          ? prev.nr_ctapes.filter((n) => n !== numero)
          : [...prev.nr_ctapes, numero],
      };
    });
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset para primeira página ao filtrar
    fetchDados({ ...filtros, [e.target.name]: e.target.value });
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePageChangeTotvs = (newPage) => {
    setCurrentPageTotvs(newPage);
  };

  // Funções para o modal de ajuda
  const showHelpModal = (title, description, calculation) => {
    setModalContent({ title, description, calculation });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  // Função para formatar datas no padrão brasileiro
  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  // Função para exportar CSV
  function exportarCSV() {
    if (!dados || dados.length === 0) return;
    const header = [
      'Conta',
      'Data Lançamento',
      'Histórico',
      'Operação',
      'Valor',
      'Data Conciliação'
    ];
    const rows = dados.map(row => [
      row.nr_ctapes,
      formatarDataBR(row.dt_lancto),
      row.ds_histbco,
      row.tp_operbco,
      row.vl_lancto !== null && row.vl_lancto !== undefined ? Number(row.vl_lancto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-',
      formatarDataBR(row.dt_conciliacao)
    ]);
    const csvContent = [header, ...rows]
      .map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extrato_financeiro.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Função para cor da fonte da conta
  function corConta(nome) {
    if (!nome) return '';
    if (nome.includes('CROSBY')) return 'text-blue-500';
    if (nome.includes('FABIO')) return 'text-yellow-600';
    if (nome.includes('IRMÃOS CR')) return 'text-orange-500';
    if (nome.includes('FLAVIO')) return 'text-green-500';
    return '';
  }

  // Cálculos dos cards usando dados processados
  const estatisticas = useMemo(() => {
    const qtdDebitos = dadosProcessados.filter(row => row.tp_operbco === 'D').length;
    const valorDebitos = dadosProcessados.filter(row => row.tp_operbco === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
    const qtdCreditos = dadosProcessados.filter(row => row.tp_operbco === 'C').length;
    const valorCreditos = dadosProcessados.filter(row => row.tp_operbco === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
    const qtdConciliadas = dadosProcessados.filter(row => !!row.dt_conciliacao).length;
    const qtdDesconciliadas = dadosProcessados.filter(row => !row.dt_conciliacao).length;
    const valorConciliadas = dadosProcessados.filter(row => !!row.dt_conciliacao).reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
    const valorDesconciliadas = dadosProcessados.filter(row => !row.dt_conciliacao).reduce((acc, row) => acc + (row.vl_lancto || 0), 0);

    return {
      qtdDebitos,
      valorDebitos,
      qtdCreditos,
      valorCreditos,
      qtdConciliadas,
      qtdDesconciliadas,
      valorConciliadas,
      valorDesconciliadas
    };
  }, [dadosProcessados]);

  // Dados processados TOTVS (filtrados e ordenados)
  const dadosProcessadosTotvs = useMemo(() => {
    return [...dadosTotvs]; // Por enquanto sem filtros adicionais, apenas os dados originais
  }, [dadosTotvs]);

  // Dados paginados TOTVS para exibição
  const dadosPaginadosTotvs = useMemo(() => {
    const startIndex = (currentPageTotvs - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return dadosProcessadosTotvs.slice(startIndex, endIndex);
  }, [dadosProcessadosTotvs, currentPageTotvs]);

  // Total de páginas para paginação TOTVS
  const totalPagesTotvs = Math.ceil(dadosProcessadosTotvs.length / PAGE_SIZE);

  // Cards TOTVs
  const estatisticasTotvs = useMemo(() => {
  const qtdDebitosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'D').length;
  const valorDebitosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
  const qtdCreditosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'C').length;
  const valorCreditosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);

    return {
      qtdDebitosTotvs,
      valorDebitosTotvs,
      qtdCreditosTotvs,
      valorCreditosTotvs
    };
  }, [dadosTotvs]);

  // (Removido: cards de transação desconciliada por banco nesta página)

  // Cálculo do saldo por conta
  const saldoPorConta = useMemo(() => {
    const saldo = {};
    
    // Processar dados do extrato financeiro
    dadosProcessados.forEach(row => {
      const contaNumero = String(row.nr_ctapes);
      if (!saldo[contaNumero]) {
        saldo[contaNumero] = {
          numero: contaNumero,
          nome: contas.find(c => c.numero === contaNumero)?.nome || contaNumero,
          creditos: 0,
          debitos: 0,
          saldo: 0,
          creditosTotvs: 0,
          debitosTotvs: 0,
          saldoExtrato: 0
        };
      }

      if (row.tp_operbco === 'C') {
        saldo[contaNumero].creditos += parseFloat(row.vl_lancto) || 0;
      } else if (row.tp_operbco === 'D') {
        saldo[contaNumero].debitos += parseFloat(row.vl_lancto) || 0;
      }
      saldo[contaNumero].saldo = saldo[contaNumero].creditos - saldo[contaNumero].debitos;
    });

    // Processar dados do TOTVS
    dadosTotvs.forEach(row => {
      const contaNumero = String(row.nr_ctapes);
      if (!saldo[contaNumero]) {
        saldo[contaNumero] = {
          numero: contaNumero,
          nome: contas.find(c => c.numero === contaNumero)?.nome || contaNumero,
          creditos: 0,
          debitos: 0,
          saldo: 0,
          creditosTotvs: 0,
          debitosTotvs: 0,
          saldoExtrato: 0
        };
      }

      if (row.tp_operacao === 'C') {
        saldo[contaNumero].creditosTotvs += parseFloat(row.vl_lancto) || 0;
      } else if (row.tp_operacao === 'D') {
        saldo[contaNumero].debitosTotvs += parseFloat(row.vl_lancto) || 0;
      }
      saldo[contaNumero].saldoExtrato = saldo[contaNumero].creditosTotvs - saldo[contaNumero].debitosTotvs;
    });
    
    return Object.values(saldo).sort((a, b) => a.numero.localeCompare(b.numero));
  }, [dadosProcessados, dadosTotvs, contas]);

  return (
    <ErrorBoundary 
      message="Erro ao carregar a página de Extrato Financeiro"
      onError={(error, errorInfo) => { 
        console.error('ExtratoFinanceiro Error:', error, errorInfo); 
      }}
    >
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Extrato Financeiro</h1>
        <div className="mb-4">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período e as contas para análise</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2 w-full mb-4">
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Contas</label>
                <DropdownContas
                  contas={contas}
                  contasSelecionadas={Array.isArray(filtros.nr_ctapes) ? filtros.nr_ctapes : []}
                  setContasSelecionadas={fn =>
                    setFiltros(prev => ({
                      ...prev,
                      nr_ctapes: typeof fn === 'function' ? fn(Array.isArray(prev.nr_ctapes) ? prev.nr_ctapes : []) : fn
                    }))
                  }
                  minWidth={200}
                  maxWidth={400}
                  placeholder="Selecione as contas"
                  hideLabel={true}
                  className="!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-base"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
                <input type="date" name="dt_movim_ini" value={filtros.dt_movim_ini} onChange={handleChange} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
                <input type="date" name="dt_movim_fim" value={filtros.dt_movim_fim} onChange={handleChange} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
              </div>
            </div>
            <div className="flex justify-end w-full mt-1">
              <button 
                type="submit" 
                className="flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <Spinner size={18} className="animate-spin" />
                ) : (
                  <ArrowsClockwise size={18} weight="bold" />
                )}
                {loading ? 'Carregando...' : 'Filtrar'}
              </button>
            </div>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>
        {/* (Removido: seção de transação desconciliada por banco) */}
        {/* Cards em linha, ainda menores */}
        <div className="flex flex-row gap-2 mb-8 max-w-full justify-center items-stretch flex-wrap">
          {/* Card Débitos Financeiro */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleDown size={15} className="text-[#fe0000]" />
                <CardTitle className="text-xs font-bold text-[#fe0000]">Déb. Fin. (D)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">
                {loading ? <Spinner size={18} className="animate-spin text-[#fe0000]" /> : estatisticas.qtdDebitos}
              </div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">
                {loading ? '...' : estatisticas.valorDebitos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center mt-1">
                <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Débitos Financeiros',
                    'Mostra a quantidade e valor total de todas as movimentações de débito (D) no extrato financeiro.',
                    'Dados referentes ao componente FCCFP023'
                  )}
                  className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={10} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Card Créditos Financeiro */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleUp size={15} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-600">Créd. Fin. (C)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">
                {loading ? <Spinner size={18} className="animate-spin text-green-600" /> : estatisticas.qtdCreditos}
              </div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">
                {loading ? '...' : estatisticas.valorCreditos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center mt-1">
                <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Créditos Financeiros',
                    'Mostra a quantidade e valor total de todas as movimentações de crédito (C) no extrato financeiro.',
                    'Dados referentes ao componente FCCFP023'
                  )}
                  className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={10} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Card Conciliadas */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <CheckCircle size={15} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-600">Conciliadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">
                {loading ? <Spinner size={18} className="animate-spin text-green-600" /> : estatisticas.qtdConciliadas}
              </div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">
                {loading ? '...' : estatisticas.valorConciliadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center mt-1">
                <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Transações Conciliadas',
                    'Mostra a quantidade e valor total de todas as movimentações que já foram conciliadas com o sistema TOTVS.',
                    'Dados referentes ao componente FCCFP023'
                  )}
                  className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={10} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Card Desconciliadas */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <XCircle size={15} className="text-[#fe0000]" />
                <CardTitle className="text-xs font-bold text-[#fe0000]">Desconciliadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">
                {loading ? <Spinner size={18} className="animate-spin text-[#fe0000]" /> : estatisticas.qtdDesconciliadas}
              </div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">
                {loading ? '...' : estatisticas.valorDesconciliadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center mt-1">
                <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Transações Desconciliadas',
                    'Mostra a quantidade e valor total de todas as movimentações que estão pendentes de conciliação com o sistema TOTVS.',
                    'Dados referentes ao componente FCCFP023'
                  )}
                  className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={10} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Card Débitos TOTVs */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-blue-100 cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleDown size={15} className="text-[#fe0000]" />
                <CardTitle className="text-xs font-bold text-[#fe0000]">Déb. TOTVs (D)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">{estatisticasTotvs.qtdDebitosTotvs}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">{estatisticasTotvs.valorDebitosTotvs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div className="flex justify-between items-center mt-1">
                <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Débitos TOTVS',
                    'Mostra a quantidade e valor total de todas as movimentações de débito (D) no sistema TOTVS.',
                    'Dados referentes ao componente FCCFL004'
                  )}
                  className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={10} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Card Créditos TOTVs */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-blue-100 cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleUp size={15} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-600">Créd. TOTVs (C)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">{estatisticasTotvs.qtdCreditosTotvs}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">{estatisticasTotvs.valorCreditosTotvs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div className="flex justify-between items-center mt-1">
                <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Créditos TOTVS',
                    'Mostra a quantidade e valor total de todas as movimentações de crédito (C) no sistema TOTVS.',
                    'Dados referentes ao componente FCCFL004'
                  )}
                  className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={10} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Botão de exportação */}
        <div className="flex justify-end mb-4">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] transition-all duration-200 text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || dadosProcessados.length === 0}
          >
            {loading ? (
              <Spinner size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {loading ? 'Carregando...' : 'Baixar Excel'}
          </button>
        </div>

        {/* Tabela de Saldo por Conta */}
        {saldoPorConta.length > 0 && (
          <div className="rounded-2xl shadow-lg bg-white border border-[#000638]/10 mb-6">
            <div className="p-4 border-b border-[#000638]/10">
              <h2 className="text-xl font-bold text-[#000638]">Saldo por Conta</h2>
              <p className="text-sm text-gray-500 mt-1">
                Resumo financeiro por conta (Créditos - Débitos) e Saldo do Extrato TOTVS
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#000638] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Conta</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Créditos</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Débitos</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Saldo</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Saldo Extrato</th>
                  </tr>
                </thead>
                <tbody>
                  {saldoPorConta.map((conta, index) => (
                    <tr 
                      key={conta.numero}
                      className={`border-b ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-gray-100 transition-colors`}
                    >
                      <td className="px-4 py-3">
                        <div className={`font-medium ${corConta(conta.nome)}`}>
                          {conta.numero} - {conta.nome}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {conta.creditos.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {conta.debitos.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        conta.saldo > 0 ? 'text-green-600' : 
                        conta.saldo < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {conta.saldo.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        conta.saldoExtrato > 0 ? 'text-green-600' : 
                        conta.saldoExtrato < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {conta.saldoExtrato.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-[#000638]">
                  <tr>
                    <td className="px-4 py-3 font-bold text-[#000638]">TOTAL</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">
                      {saldoPorConta.reduce((acc, conta) => acc + conta.creditos, 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {saldoPorConta.reduce((acc, conta) => acc + conta.debitos, 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      saldoPorConta.reduce((acc, conta) => acc + conta.saldo, 0) > 0 ? 'text-green-600' : 
                      saldoPorConta.reduce((acc, conta) => acc + conta.saldo, 0) < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {saldoPorConta.reduce((acc, conta) => acc + conta.saldo, 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      saldoPorConta.reduce((acc, conta) => acc + conta.saldoExtrato, 0) > 0 ? 'text-green-600' : 
                      saldoPorConta.reduce((acc, conta) => acc + conta.saldoExtrato, 0) < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {saldoPorConta.reduce((acc, conta) => acc + conta.saldoExtrato, 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        {/* Tabela modernizada */}
        <div className="rounded-2xl shadow-lg bg-white border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#000638]">Detalhamento do Extrato Financeiro</h2>
              {dadosProcessados.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {dadosProcessados.length} movimentação{dadosProcessados.length > 1 ? 'ões' : ''} encontrada{dadosProcessados.length > 1 ? 's' : ''}
                  {totalPages > 1 && ` - Página ${currentPage} de ${totalPages} (${PAGE_SIZE} por página)`}
                </p>
              )}
            </div>
            <button
              onClick={() => setExpandTabela(!expandTabela)}
              className="flex items-center text-gray-500 hover:text-gray-700"
            >
              {expandTabela ? <CaretDown size={20} /> : <CaretRight size={20} />}
            </button>
          </div>
          
          {expandTabela && (
            <>
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="flex items-center gap-3">
                    <Spinner size={32} className="animate-spin text-blue-600" />
                    <span className="text-gray-600">Carregando dados...</span>
                  </div>
                </div>
              ) : !dadosCarregados ? (
                <div className="flex justify-center items-center py-20">
                  <div className="text-center">
                    <div className="text-gray-500 text-lg mb-2">Clique em "Filtrar" para carregar as informações</div>
                    <div className="text-gray-400 text-sm">Selecione o período e as contas desejadas</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="table-container max-w-full mx-auto">
                    <table 
                      className="border-collapse rounded-lg overflow-hidden shadow-lg extrato-table"
                      style={{ minWidth: '1200px' }}
                    >
                      <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                        <tr>
                          {/* Checkbox para seleção */}
                          <th 
                            className="px-2 py-1 text-center text-[10px]" 
                            style={{ width: '50px', minWidth: '50px', position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#000638' }}
                          >
                            <input
                              type="checkbox"
                              checked={linhasSelecionadas.size === dadosProcessados.length && dadosProcessados.length > 0}
                              onChange={() => {
                                if (linhasSelecionadas.size === dadosProcessados.length) {
                                  deselecionarTodasLinhas();
                                } else {
                                  selecionarTodasLinhas();
                                }
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </th>
                          
                          {/* Colunas ordenáveis */}
                          <th 
                            className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                            onClick={() => handleSort('nr_ctapes')}
                          >
                            <div className="flex items-center justify-center">
                              Conta
                              {getSortIcon('nr_ctapes')}
                            </div>
                          </th>
                          
                          <th 
                            className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                            onClick={() => handleSort('dt_lancto')}
                          >
                            <div className="flex items-center justify-center">
                              Data Lançamento
                              {getSortIcon('dt_lancto')}
                            </div>
                          </th>
                          
                          <th 
                            className="px-3 py-1 text-left text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                            onClick={() => handleSort('ds_histbco')}
                          >
                            <div className="flex items-center">
                              Histórico
                              {getSortIcon('ds_histbco')}
                            </div>
                          </th>
                          
                          <th 
                            className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                            onClick={() => handleSort('tp_operbco')}
                          >
                            <div className="flex items-center justify-center">
                              Operação
                              {getSortIcon('tp_operbco')}
                            </div>
                          </th>
                          
                          <th 
                            className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                            onClick={() => handleSort('vl_lancto')}
                          >
                            <div className="flex items-center justify-center">
                              Valor
                              {getSortIcon('vl_lancto')}
                            </div>
                          </th>
                          
                          <th 
                            className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                            onClick={() => handleSort('dt_conciliacao')}
                          >
                            <div className="flex items-center justify-center">
                              Data Conciliação
                              {getSortIcon('dt_conciliacao')}
                            </div>
                          </th>
                    </tr>
                  </thead>
                      
                      <tbody>
                        {dadosPaginados.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center py-20">
                              <div className="text-center">
                                <div className="text-gray-500 text-lg mb-2">Nenhum dado encontrado</div>
                                <div className="text-gray-400 text-sm">
                                  Verifique os filtros selecionados
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          dadosPaginados.map((row, index) => {
                            const globalIndex = (currentPage - 1) * PAGE_SIZE + index;
                            return (
                            <tr
                              key={globalIndex}
                              className={`text-[11px] border-b transition-colors cursor-pointer ${
                                linhasSelecionadas.has(globalIndex)
                                  ? 'bg-blue-100 hover:bg-blue-200'
                                  : index % 2 === 0
                                  ? 'bg-white hover:bg-gray-100'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              {/* Checkbox de seleção */}
                              <td 
                                className="px-2 py-1 text-center" 
                                style={{ width: '50px', minWidth: '50px', position: 'sticky', left: 0, zIndex: 10 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={linhasSelecionadas.has(globalIndex)}
                                  onChange={() => toggleLinhaSelecionada(globalIndex)}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                              </td>
                              
                              {/* Conta */}
                              <td className={`px-2 py-1 text-center text-xs ${(() => {
                            const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                            return conta ? corConta(conta.nome) : '';
                              })()}`}>
                                {(() => {
                              const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                              return conta ? `${conta.numero} - ${conta.nome}` : row.nr_ctapes;
                                })()}
                              </td>
                              
                              {/* Data Lançamento */}
                              <td className="px-2 py-1 text-center text-[#000638] font-medium">
                                {formatarDataBR(row.dt_lancto)}
                              </td>
                              
                              {/* Histórico */}
                              <td className="px-2 py-1 text-gray-800">
                                <div className="max-w-xs truncate" title={row.ds_histbco}>
                                  {row.ds_histbco}
                                </div>
                              </td>
                              
                              {/* Operação */}
                              <td className="px-2 py-1 text-center">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  row.tp_operbco === 'D' 
                                    ? 'bg-red-100 text-red-800' 
                                    : row.tp_operbco === 'C' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {row.tp_operbco}
                                </span>
                              </td>
                              
                              {/* Valor */}
                              <td className={`px-2 py-1 text-right font-bold ${
                                row.tp_operbco === 'D' ? 'text-red-600' : 
                                row.tp_operbco === 'C' ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {row.vl_lancto?.toLocaleString('pt-BR', { 
                                  style: 'currency', 
                                  currency: 'BRL' 
                                })}
                              </td>
                              
                              {/* Data Conciliação */}
                              <td className="px-2 py-1 text-center">
                                {row.dt_conciliacao ? (
                                  <span className="text-green-600 font-medium">
                                    {formatarDataBR(row.dt_conciliacao)}
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-medium">
                                    Pendente
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
                  </div>

                  {/* Resumo das linhas selecionadas */}
                  {linhasSelecionadas.size > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              {linhasSelecionadas.size} linha{linhasSelecionadas.size > 1 ? 's' : ''} selecionada{linhasSelecionadas.size > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              Total: {Array.from(linhasSelecionadas).reduce((acc, index) => {
                                return acc + (dadosProcessados[index]?.vl_lancto || 0);
                              }, 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={deselecionarTodasLinhas}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Limpar seleção
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Paginação Melhorada */}
          {totalPages > 1 && (
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Informações da página */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="font-medium">
                    Página {currentPage} de {totalPages}
                  </span>
                  <span className="text-gray-500">
                    {dadosProcessados.length} registros • {PAGE_SIZE} por página
                  </span>
                </div>

                {/* Controles de navegação */}
                <div className="flex items-center gap-2">
                  {/* Botão Primeira Página */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || loading}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Primeira
                  </button>

                  {/* Botão Anterior */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>

                  {/* Números das páginas */}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                      
                      if (endPage - startPage + 1 < maxVisiblePages) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => handlePageChange(i)}
                            disabled={loading}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              currentPage === i
                                ? 'bg-[#000638] text-white border border-[#000638]'
                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {i}
                          </button>
                        );
                      }
                      return pages;
                    })()}
                  </div>

                  {/* Botão Próxima */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima
                  </button>

                  {/* Botão Última Página */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages || loading}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Última
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Tabela Extrato TOTVS */}
        <ExtratoTotvsTable
          dados={dadosPaginadosTotvs}
          dadosCompletos={dadosTotvs}
          loading={loadingTotvs}
          erro={erroTotvs}
          expandTabela={expandTabelaTotvs}
          setExpandTabela={setExpandTabelaTotvs}
          contas={contas}
          corConta={corConta}
          currentPage={currentPageTotvs}
          totalPages={totalPagesTotvs}
          totalRegistros={dadosProcessadosTotvs.length}
          onPageChange={handlePageChangeTotvs}
          pageSize={PAGE_SIZE}
        />

      </div>

      {/* Modal de Ajuda */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{modalContent.title}</h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">{modalContent.description}</p>
              <div className="bg-gray-100 p-3 rounded">
                <p className="text-xs text-gray-700 font-mono">{modalContent.calculation}</p>
              </div>
            </div>
            <button
              onClick={closeModal}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default ExtratoFinanceiro; 