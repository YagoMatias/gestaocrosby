import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
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
  Download 
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import LoadingCircle from '../components/LoadingCircle';
import useApiClient from '../hooks/useApiClient';
import ExtratoTotvsTable from '../components/ExtratoTotvsTable';
import { useApi } from '../hooks/useApi';
import { useDebounce } from '../hooks/useDebounce';
import ErrorBoundary from '../components/ui/ErrorBoundary';

const PAGE_SIZE = 100000;

const ExtratoFinanceiro = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosTotvs, setDadosTotvs] = useState([]);
  const [totalTotvs, setTotalTotvs] = useState(0);
  const [loadingTotvs, setLoadingTotvs] = useState(false);
  const [erroTotvs, setErroTotvs] = useState('');
  const [expandTabelaTotvs, setExpandTabelaTotvs] = useState(true);
  const [filtros, setFiltros] = useState({
    cd_empresa: '',
    nr_ctapes: [], // agora é array
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [page, setPage] = useState(1);
  const [expandTabela, setExpandTabela] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', description: '', calculation: '' });

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });
  
  // Estados para seleção de linhas
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());
  
  // Estado para filtros de texto
  const [filtroTexto, setFiltroTexto] = useState('');

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
  const filtroTextoDebounced = useDebounce(filtroTexto, 300);

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

  // Função para selecionar todas as linhas
  const selecionarTodasLinhas = useCallback(() => {
    const todosIndices = dados.map((_, index) => index);
    setLinhasSelecionadas(new Set(todosIndices));
  }, [dados]);

  // Função para deselecionar todas as linhas
  const deselecionarTodasLinhas = useCallback(() => {
    setLinhasSelecionadas(new Set());
  }, []);

  // Dados filtrados e ordenados
  const dadosProcessados = useMemo(() => {
    let dadosFiltrados = [...dados];

    // Aplicar filtro de texto
    if (filtroTextoDebounced) {
      const filtroLower = filtroTextoDebounced.toLowerCase();
      dadosFiltrados = dadosFiltrados.filter(row => 
        row.ds_histbco?.toLowerCase().includes(filtroLower) ||
        row.tp_operbco?.toLowerCase().includes(filtroLower) ||
        String(row.nr_ctapes).toLowerCase().includes(filtroLower) ||
        row.vl_lancto?.toString().includes(filtroLower)
      );
    }

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
  }, [dados, filtroTextoDebounced, ordenacao]);

  // Limpar seleção quando dados mudarem
  useEffect(() => {
    setLinhasSelecionadas(new Set());
  }, [dados]);

  // Função para buscar dados
  const fetchDados = async (filtrosParam = filtros, pageParam = page) => {
    setLoading(true);
    setErro('');
    try {
      const params = {
        cd_empresa: filtrosParam.cd_empresa,
        nr_ctapes: filtrosParam.nr_ctapes,
        dt_movim_ini: filtrosParam.dt_movim_ini,
        dt_movim_fim: filtrosParam.dt_movim_fim,
        limit: PAGE_SIZE,
        offset: (pageParam - 1) * PAGE_SIZE
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
    }
    
    // Buscar também dados do TOTVS
    setLoadingTotvs(true);
    setErroTotvs('');
    try {
      const params = {
        cd_empresa: filtrosParam.cd_empresa,
        nr_ctapes: filtrosParam.nr_ctapes,
        dt_movim_ini: filtrosParam.dt_movim_ini,
        dt_movim_fim: filtrosParam.dt_movim_fim,
        limit: PAGE_SIZE,
        offset: (pageParam - 1) * PAGE_SIZE
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
    setPage(1);
    fetchDados({ ...filtros, [e.target.name]: e.target.value }, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchDados(filtros, newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

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

  // Verifica contas selecionadas
  const [expandBancos, setExpandBancos] = useState(false);
  const contasSelecionadas = contas.filter(c => filtros.nr_ctapes.includes(c.numero));

  // Calcula data da transação desconciliada mais antiga por banco
  let ultimasDesconciliadas = [];
  if (contasSelecionadas.length > 0) {
    ultimasDesconciliadas = contasSelecionadas.map(conta => {
      const transacoesDesconciliadas = dados.filter(row => String(row.nr_ctapes) === conta.numero && !row.dt_conciliacao);
      let dataMaisAntiga = null;
      if (transacoesDesconciliadas.length > 0) {
        dataMaisAntiga = transacoesDesconciliadas.reduce((min, row) => {
          const data = new Date(row.dt_lancto);
          return (!min || data < new Date(min)) ? row.dt_lancto : min;
        }, null);
      }
      return {
        numero: conta.numero,
        nome: conta.nome,
        maisAntigaDesconciliada: dataMaisAntiga
      };
    });
  }

  return (
    <ErrorBoundary 
      message="Erro ao carregar a página de Extrato Financeiro"
      onError={(error, errorInfo) => { 
        console.error('ExtratoFinanceiro Error:', error, errorInfo); 
      }}
    >
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Extrato Financeiro</h1>
        <div className="mb-4">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período, empresa, conta ou data para análise</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-2 w-full mb-4">
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Empresa</label>
                <input name="cd_empresa" value={filtros.cd_empresa} onChange={handleChange} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" placeholder="Empresa" />
              </div>
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
              <button type="submit" className="flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px]">
                <ArrowsClockwise size={18} weight="bold" /> Filtrar
              </button>
            </div>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>
        {/* Cards de bancos: última transação desconciliada em dropdown */}
        {contasSelecionadas.length > 0 && (
           <div className="rounded-2xl shadow-lg bg-white mb-4 border border-[#000638]/10 max-w-5xl mx-auto">
             <div className="p-3 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandBancos(e => !e)}>
               <span className="text-base font-bold text-[#000638]">Transação desconciliada mais antiga por banco</span>
               <span className="flex items-center">
                 {expandBancos ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
               </span>
             </div>
             {expandBancos && (
               <div className="flex flex-row gap-2 p-3 flex-wrap justify-center items-stretch">
                 {ultimasDesconciliadas.map(banco => (
                   <Card key={banco.numero} className="min-w-[140px] max-w-[180px] shadow-md rounded-lg bg-white cursor-pointer p-1 border border-gray-200">
                     <CardHeader className="pb-0 px-1 pt-1">
                       <div className="flex flex-row items-center gap-1">
                         <CardTitle className="text-xs font-bold text-blue-900 truncate">{banco.nome}</CardTitle>
                       </div>
                     </CardHeader>
                     <CardContent className="pt-1 pl-2">
                       <div className="text-[10px] text-gray-500">Data mais antiga desconciliada</div>
                       <div className="text-xs font-bold text-gray-700 mt-0.5">
                         {loading ? <LoadingCircle size={18} /> : (
                           banco.maisAntigaDesconciliada
                             ? <span className="text-[#fe0000] font-bold">{new Date(banco.maisAntigaDesconciliada).toLocaleDateString('pt-BR')}</span>
                             : <span className="text-green-600 font-bold">Conciliações realizadas no período</span>
                         )}
                       </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
           </div>
         )}
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
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">{estatisticas.qtdDebitos}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">{estatisticas.valorDebitos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
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
              <div className="text-lg font-extrabold text-green-600 mb-0.5">{estatisticas.qtdCreditos}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">{estatisticas.valorCreditos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
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
              <div className="text-lg font-extrabold text-green-600 mb-0.5">{estatisticas.qtdConciliadas}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">{estatisticas.valorConciliadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
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
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">{estatisticas.qtdDesconciliadas}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">{estatisticas.valorDesconciliadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
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
        {/* Barra de filtros e ações */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          {/* Filtro de texto */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar no histórico, conta, operação ou valor..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000638] focus:border-transparent"
            />
          </div>
          
          {/* Botão de exportação */}
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] transition-all duration-200 text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={dadosProcessados.length === 0}
          >
            <Download size={18} />
            Baixar Excel
          </button>
        </div>
        {/* Tabela modernizada */}
        <div className="rounded-2xl shadow-lg bg-white border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#000638]">Detalhamento do Extrato Financeiro</h2>
              {dadosProcessados.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {dadosProcessados.length} movimentação{dadosProcessados.length > 1 ? 'ões' : ''} encontrada{dadosProcessados.length > 1 ? 's' : ''}
                  {filtroTextoDebounced && ` (filtrado de ${dados.length})`}
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
                  <div className="text-center">
                    <LoadingCircle size={32} />
                    <div className="text-gray-500 text-lg mb-2 mt-4">Carregando dados...</div>
                    <div className="text-gray-400 text-sm">Aguarde um momento</div>
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
                        {dadosProcessados.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center py-20">
                              <div className="text-center">
                                <div className="text-gray-500 text-lg mb-2">Nenhum dado encontrado</div>
                                <div className="text-gray-400 text-sm">
                                  {filtroTextoDebounced ? 'Tente ajustar o filtro de busca' : 'Verifique os filtros selecionados'}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          dadosProcessados.map((row, index) => (
                            <tr
                              key={index}
                              className={`text-[11px] border-b transition-colors cursor-pointer ${
                                linhasSelecionadas.has(index)
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
                                  checked={linhasSelecionadas.has(index)}
                                  onChange={() => toggleLinhaSelecionada(index)}
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
                      ))
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
        </div>
        {/* Tabela Extrato TOTVS */}
        <ExtratoTotvsTable
          dados={dadosTotvs}
          loading={loadingTotvs}
          erro={erroTotvs}
          expandTabela={expandTabelaTotvs}
          setExpandTabela={setExpandTabelaTotvs}
          contas={contas}
          corConta={corConta}
        />
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
            >
              Anterior
            </button>
            <span className="mx-2">Página {page} de {totalPages}</span>
            <button
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages || loading}
            >
              Próxima
            </button>
          </div>
        )}
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
    </Layout>
    </ErrorBoundary>
  );
};

export default ExtratoFinanceiro; 