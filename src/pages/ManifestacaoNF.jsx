import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { 
  Receipt, 
  Calendar, 
  Funnel, 
  Spinner,
  CurrencyDollar,
  Clock,
  Warning,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  FileText,
  MagnifyingGlass,
  Eye,
  Download,
  X,
  FileArrowDown
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const ManifestacaoNF = () => {
  const apiClient = useApiClient();

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Estados para os filtros
  const [filtroLancamento, setFiltroLancamento] = useState('Todos');
  const [situacao, setSituacao] = useState('TODAS');
  const [numeroNF, setNumeroNF] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [filtroDocFiscal, setFiltroDocFiscal] = useState('NFE');
  const [filtroSituacao, setFiltroSituacao] = useState('AUTORIZADA');
  
  // Estados para seleção de linhas
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());

  // Injetar CSS customizado para a tabela
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      
      .table-container table {
        position: relative;
      }
      
      .manifestacao-table {
        border-collapse: collapse;
        width: 100%;
      }
      
      .manifestacao-table th,
      .manifestacao-table td {
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
      }
      
      .manifestacao-table th:last-child,
      .manifestacao-table td:last-child {
        border-right: none;
      }
      
      .manifestacao-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      
      .manifestacao-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      
      .manifestacao-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      
      .manifestacao-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
      
      /* CSS para coluna fixa */
      .manifestacao-table thead th:first-child,
      .manifestacao-table tbody td:first-child {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        border-right: 2px solid #e5e7eb !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important;
      }
      
      .manifestacao-table thead th:first-child {
        background: #000638 !important;
        z-index: 20 !important;
        min-width: 50px !important;
        width: 50px !important;
      }
      
      .manifestacao-table tbody td:first-child {
        background: white !important;
        min-width: 50px !important;
        width: 50px !important;
      }
      
      .manifestacao-table tbody tr:nth-child(even) td:first-child {
        background: #fafafa !important;
      }
      
      .manifestacao-table tbody tr:hover td:first-child {
        background: #f0f9ff !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const toggleLinhaSelecionada = (index) => {
    setLinhasSelecionadas(prev => {
      const novoSet = new Set(prev);
      if (novoSet.has(index)) {
        novoSet.delete(index);
      } else {
        novoSet.add(index);
      }
      return novoSet;
    });
  };

  const selecionarTodasLinhas = () => {
    const dadosPagina = dadosOrdenados.slice(indiceInicial, indiceFinal);
    const todasLinhas = new Set(dadosPagina.map((_, index) => indiceInicial + index));
    setLinhasSelecionadas(todasLinhas);
  };

  const deselecionarTodasLinhas = () => {
    setLinhasSelecionadas(new Set());
  };

  // Limpar seleção quando os dados mudarem
  useEffect(() => {
    setLinhasSelecionadas(new Set());
  }, [dados]);

  // Empresas pré-selecionadas
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(30);

  // Estados para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: 'dt_emissao',
    direction: 'desc'
  });

  // Função para ordenar os dados
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Função para obter o ícone de ordenação
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <CaretDown size={12} className="ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <CaretUp size={12} className="ml-1" />
      : <CaretDown size={12} className="ml-1" />;
  };

  const buscarDados = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) return;
    
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }
    
    setLoading(true);
    setPaginaAtual(1);
    try {
      console.log('🔍 Iniciando busca de manifestação de NF...');
      console.log('📅 Período:', { inicio, fim });
      console.log('🏢 Empresas selecionadas:', empresasSelecionadas);
      
      // Buscar dados das empresas selecionadas (uma requisição por empresa)
      const todasAsPromises = empresasSelecionadas.map(async (empresa) => {
        try {
          console.log(`📡 Buscando dados para empresa ${empresa.cd_empresa}...`);
          
          const params = {
            dt_inicio: inicio,
            dt_fim: fim,
            cd_empresa: empresa.cd_empresa
          };
          
          const result = await apiClient.financial.nfManifestacao(params);
          
          if (result.success) {
            const dadosArray = Array.isArray(result.data) ? result.data : [];
            console.log(`✅ Sucesso para empresa ${empresa.cd_empresa}:`, {
              total: dadosArray.length,
              amostra: dadosArray.slice(0, 2)
            });
            return dadosArray;
          } else {
            console.warn(`⚠️ Falha para empresa ${empresa.cd_empresa}:`, result.message);
            return [];
          }
        } catch (err) {
          console.error(`❌ Erro para empresa ${empresa.cd_empresa}:`, err);
          return [];
        }
      });

      // Aguardar todas as promessas e combinar os resultados
      const resultadosEmpresas = await Promise.all(todasAsPromises);
      const todosDados = resultadosEmpresas.flat(); // Combinar arrays

      console.log('✅ Dados de manifestação obtidos de todas as empresas:', {
        totalEmpresas: empresasSelecionadas.length,
        totalRegistros: todosDados.length,
        registrosPorEmpresa: resultadosEmpresas.map((dados, index) => ({
          empresa: empresasSelecionadas[index].cd_empresa,
          registros: dados.length
        }))
      });

      setDados(todosDados);
      setDadosCarregados(true);
    } catch (err) {
      console.error('❌ Erro ao buscar dados:', err);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (valor) => {
    if (!valor || isNaN(valor)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(parseFloat(valor));
  };

  const formatarData = (data) => {
    if (!data) return '';
    try {
      return new Date(data).toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  const getStatusFromData = (item) => {
    // Mapear tp_situacaoman para status legíveis
    const situacao = item.tp_situacaoman?.toString() || '';
    
    switch (situacao) {
      case '1':
        return 'Confirmada';
      case '2':
        return 'Desconhecida';
      case '3':
        return 'Não Realizada';
      case '4':
        return 'Ciência';
      default:
        return 'Pendente';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmada':
        return 'bg-green-100 text-green-800';
      case 'desconhecida':
        return 'bg-red-100 text-red-800';
      case 'não realizada':
        return 'bg-yellow-100 text-yellow-800';
      case 'ciência':
        return 'bg-blue-100 text-blue-800';
      case 'pendente':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmada':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'desconhecida':
        return <Warning size={16} className="text-red-600" />;
      case 'não realizada':
        return <Clock size={16} className="text-yellow-600" />;
      case 'ciência':
        return <Eye size={16} className="text-blue-600" />;
      case 'pendente':
        return <ArrowUp size={16} className="text-gray-600" />;
      default:
        return <ArrowDown size={16} className="text-gray-600" />;
    }
  };

  const getTipoDocumento = (modelo) => {
    const modeloStr = modelo?.toString() || '';
    switch (modeloStr) {
      case '55':
        return 'NFE';
      case '57':
        return 'CTE';
      default:
        return modeloStr;
    }
  };

  const getSituacaoDocumento = (situacao) => {
    const situacaoStr = situacao?.toString() || '';
    switch (situacaoStr) {
      case 'A':
        return 'AUTORIZADA';
      case 'C':
        return 'CANCELADA';
      case 'D':
        return 'DENEGADA';
      default:
        return situacaoStr;
    }
  };

  const isLancada = (item) => {
    return item.nr_fatura && item.nr_fatura.toString().trim() !== '';
  };

  const getLancadaIcon = (item) => {
    if (isLancada(item)) {
      return <CheckCircle size={16} className="text-green-600" />;
    } else {
      return <X size={16} className="text-red-600" />;
    }
  };

  const exportarExcel = () => {
    try {
      // Preparar dados para exportação
      const dadosExportacao = dadosOrdenados.map(item => ({
        'Empresa': item.cd_empresa || '',
        'Chave de Acesso': item.ds_chaveacesso || '',
        'Número NF': item.nr_nf || '',
        'NSU': item.nr_nsu || '',
        'Série': item.cd_serie || '',
        'Data Emissão': formatarData(item.dt_emissao),
        'Data Cadastro': formatarData(item.dt_cadastro),
        'CNPJ Emitente': item.nr_cnpjemi || '',
        'CNPJ Fornecedor': item.cd_cgc || '',
        'Razão Social': item.nm_razaosocial || '',
        'Valor Total': parseFloat(item.vl_totalnota || 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }),
        'Status Manifestação': getStatusFromData(item),
        'Lançada': isLancada(item) ? 'Sim' : 'Não',
        'Operação': item.tp_operacao || '',
        'Operador': item.cd_operador || '',
        'Tipo Documento': getTipoDocumento(item.tp_moddctofiscal),
        'Situação Documento': getSituacaoDocumento(item.tp_situacao),
        'Número Fatura': item.nr_fatura || '',
        'Data Fatura': formatarData(item.dt_fatura),
        'Valor Fatura': parseFloat(item.vl_fatura || 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        })
      }));

      // Criar workbook
      const ws = XLSX.utils.json_to_sheet(dadosExportacao);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Manifestação NF');

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 10 }, // Empresa
        { wch: 50 }, // Chave de Acesso
        { wch: 15 }, // Número NF
        { wch: 12 }, // NSU
        { wch: 10 }, // Série
        { wch: 12 }, // Data Emissão
        { wch: 12 }, // Data Cadastro
        { wch: 20 }, // CNPJ Emitente
        { wch: 20 }, // CNPJ Fornecedor
        { wch: 40 }, // Razão Social
        { wch: 15 }, // Valor Total
        { wch: 18 }, // Status Manifestação
        { wch: 10 }, // Lançada
        { wch: 12 }, // Operação
        { wch: 12 }, // Operador
        { wch: 15 }, // Tipo Documento
        { wch: 18 }, // Situação Documento
        { wch: 15 }, // Número Fatura
        { wch: 12 }, // Data Fatura
        { wch: 15 }  // Valor Fatura
      ];
      ws['!cols'] = colWidths;

      // Gerar arquivo
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Nome do arquivo com data atual
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `manifestacao-nf-${dataAtual}.xlsx`;
      
      saveAs(data, nomeArquivo);

      console.log('✅ Excel exportado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao exportar Excel:', error);
      alert('Erro ao exportar dados para Excel. Tente novamente.');
    }
  };

  useEffect(() => {
    // Definir datas padrão (mês atual)
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(ultimoDia.toISOString().split('T')[0]);
  }, []);

  // Filtros aplicados
  const dadosFiltrados = dados.filter((item) => {
    // Filtro por lançamento
    if (filtroLancamento !== 'Todos') {
      const lancada = isLancada(item);
      if (filtroLancamento === 'Lançadas' && !lancada) {
        return false;
      }
      if (filtroLancamento === 'Não Lançadas' && lancada) {
        return false;
      }
    }
    
    // Filtro por Doc Fiscal (NFE/CTE)
    if (filtroDocFiscal !== 'TODOS') {
      const modeloDoc = item.tp_moddctofiscal?.toString() || '';
      if (filtroDocFiscal === 'NFE' && modeloDoc !== '55') {
        return false;
      }
      if (filtroDocFiscal === 'CTE' && modeloDoc !== '57') {
        return false;
      }
    }

    // Filtro por Situação (AUTORIZADA/CANCELADA/DENEGADA)
    if (filtroSituacao !== 'TODAS') {
      const situacaoDoc = item.tp_situacao?.toString() || '';
      if (filtroSituacao === 'AUTORIZADA' && situacaoDoc !== 'A') {
        return false;
      }
      if (filtroSituacao === 'CANCELADA' && situacaoDoc !== 'C') {
        return false;
      }
      if (filtroSituacao === 'DENEGADA' && situacaoDoc !== 'D') {
        return false;
      }
    }
    
    // Filtro por número da NF
    if (numeroNF) {
      const nrNF = item.nr_nf || '';
      if (!nrNF.toString().toLowerCase().includes(numeroNF.toLowerCase())) {
        return false;
      }
    }

    // Filtro por fornecedor
    if (fornecedor) {
      const cnpjEmi = item.nr_cnpjemi || '';
      const razaoSocial = item.nm_razaosocial || '';
      const buscaFornecedor = fornecedor.toLowerCase();
      
      if (!cnpjEmi.toString().toLowerCase().includes(buscaFornecedor) && 
          !razaoSocial.toLowerCase().includes(buscaFornecedor)) {
        return false;
      }
    }

    // Filtro por chave de acesso
    if (chaveAcesso) {
      const chave = item.ds_chaveacesso || '';
      if (!chave.toLowerCase().includes(chaveAcesso.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  });

  // Função para ordenar os dados
  const sortDados = (dados) => {
    if (!dados || dados.length === 0) return dados;

    return [...dados].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'cd_empresa':
          aValue = a.cd_empresa || '';
          bValue = b.cd_empresa || '';
          break;
        case 'nr_nf':
          aValue = a.nr_nf || '';
          bValue = b.nr_nf || '';
          break;
        case 'cd_serie':
          aValue = a.cd_serie || '';
          bValue = b.cd_serie || '';
          break;
        case 'nr_cnpjemi':
          aValue = a.nr_cnpjemi || '';
          bValue = b.nr_cnpjemi || '';
          break;
        case 'nm_razaosocial':
          aValue = a.nm_razaosocial || '';
          bValue = b.nm_razaosocial || '';
          break;
        case 'vl_totalnota':
          aValue = parseFloat(a.vl_totalnota) || 0;
          bValue = parseFloat(b.vl_totalnota) || 0;
          break;
        case 'tp_situacaoman':
          aValue = a.tp_situacaoman || '';
          bValue = b.tp_situacaoman || '';
          break;
        case 'nr_fatura':
          aValue = a.nr_fatura || '';
          bValue = b.nr_fatura || '';
          break;
        case 'dt_emissao':
          aValue = a.dt_emissao ? new Date(a.dt_emissao) : new Date(0);
          bValue = b.dt_emissao ? new Date(b.dt_emissao) : new Date(0);
          break;
        case 'dt_cadastro':
          aValue = a.dt_cadastro ? new Date(a.dt_cadastro) : new Date(0);
          bValue = b.dt_cadastro ? new Date(b.dt_cadastro) : new Date(0);
          break;
        case 'ds_chaveacesso':
          aValue = a.ds_chaveacesso || '';
          bValue = b.ds_chaveacesso || '';
          break;
        case 'tp_moddctofiscal':
          aValue = a.tp_moddctofiscal || '';
          bValue = b.tp_moddctofiscal || '';
          break;
        case 'tp_situacao':
          aValue = a.tp_situacao || '';
          bValue = b.tp_situacao || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Dados ordenados
  const dadosOrdenados = sortDados(dadosFiltrados);

  // Paginação
  const indiceInicial = (paginaAtual - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const dadosPaginaAtual = dadosOrdenados.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.ceil(dadosOrdenados.length / itensPorPagina);

  // Calcular totais das linhas selecionadas
  const totalLinhasSelecionadas = linhasSelecionadas.size;
  const valorTotalSelecionado = Array.from(linhasSelecionadas)
    .reduce((total, index) => {
      const item = dadosOrdenados[index];
      return total + (parseFloat(item?.vl_totalnota) || 0);
    }, 0);

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  // Dados só são buscados quando o usuário clicar em "Buscar Dados"

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#000638] mb-2">Manifestação de Notas Fiscais</h1>
          <p className="text-gray-600">Gerencie e manifeste notas fiscais eletrônicas de fornecedores</p>
        </div>

        {/* Filtros */}
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2">
                <Funnel size={22} weight="bold" />
                Filtros
              </span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período e empresa para análise</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <div className="lg:col-span-2">
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={handleSelectEmpresas}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Lançamento</label>
                <select
                  value={filtroLancamento}
                  onChange={(e) => setFiltroLancamento(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="Todos">TODOS</option>
                  <option value="Lançadas">LANÇADAS</option>
                  <option value="Não Lançadas">NÃO LANÇADAS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Doc Fiscal</label>
                <select
                  value={filtroDocFiscal}
                  onChange={(e) => setFiltroDocFiscal(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="TODOS">TODOS</option>
                  <option value="NFE">NFE</option>
                  <option value="CTE">CTE</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Situação</label>
                <select
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="TODAS">TODAS</option>
                  <option value="AUTORIZADA">AUTORIZADA</option>
                  <option value="CANCELADA">CANCELADA</option>
                  <option value="DENEGADA">DENEGADA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Número NF</label>
                <input
                  type="text"
                  value={numeroNF}
                  onChange={(e) => setNumeroNF(e.target.value)}
                  placeholder="Buscar por número da NF..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Fornecedor</label>
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Buscar por CNPJ ou razão social..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Chave de Acesso</label>
                <input
                  type="text"
                  value={chaveAcesso}
                  onChange={(e) => setChaveAcesso(e.target.value)}
                  placeholder="Buscar por chave de acesso..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-end">
                <button 
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-[#000638] text-white px-6 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-10 text-sm font-bold shadow-md tracking-wide uppercase"
                  disabled={loading || !dataInicio || !dataFim}
                >
                  {loading ? (
                    <>
                      <Spinner size={18} className="animate-spin" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <Calendar size={18} />
                      <span>Buscar Dados</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Cards de Resumo */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700">Total de NFs</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-blue-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : dadosOrdenados.length}
              </div>
              <CardDescription className="text-xs text-gray-500">Notas no período</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Valor Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-600 mb-1 break-words">
                {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                  dadosOrdenados.reduce((total, item) => total + (parseFloat(item.vl_totalnota) || 0), 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Valor total das notas</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Warning size={18} className="text-yellow-600" />
                <CardTitle className="text-sm font-bold text-yellow-700">Pendentes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-yellow-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-yellow-600" /> : 
                  dadosOrdenados.filter(item => getStatusFromData(item) === 'Pendente').length
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Aguardando manifestação</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Confirmadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                  dadosOrdenados.filter(item => getStatusFromData(item) === 'Confirmada').length
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Manifestadas</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">Desconhecidas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                  dadosOrdenados.filter(item => getStatusFromData(item) === 'Desconhecida').length
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Requerem atenção</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Lançadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                  dadosOrdenados.filter(item => isLancada(item)).length
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Com número de fatura</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <X size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">Não Lançadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                  dadosOrdenados.filter(item => !isLancada(item)).length
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Sem número de fatura</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full">
          <div className="p-6 border-b border-[#000638]/10 flex justify-between items-center">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-xl font-bold text-[#000638]">Manifestação de Notas Fiscais</h2>
              
              <div className="flex items-center gap-4">
                {dadosCarregados && dadosOrdenados.length > 0 && (
                  <button
                    onClick={exportarExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm shadow-md"
                    title="Exportar dados para Excel"
                  >
                    <FileArrowDown size={18} />
                    <span>Baixar Excel</span>
                  </button>
                )}
                
                {dadosCarregados && (
                  <span className="text-gray-600 text-sm">
                    Exibindo {dadosPaginaAtual.length} de {dadosOrdenados.length} registros
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner size={32} className="text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600">Carregando dados...</p>
              </div>
            ) : !dadosCarregados ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Nenhuma consulta realizada</p>
                <p className="text-sm text-gray-500">Selecione as empresas e o período desejado, depois clique em "Buscar"</p>
              </div>
            ) : dadosOrdenados.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhuma nota fiscal encontrada</p>
                <p className="text-sm text-gray-500">Tente ajustar os filtros ou o período de busca</p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table className="manifestacao-table">
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, zIndex: 20, background: '#000638', minWidth: '50px', width: '50px' }}>
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={totalLinhasSelecionadas === dadosPaginaAtual.length && dadosPaginaAtual.length > 0}
                              onChange={(e) => e.target.checked ? selecionarTodasLinhas() : deselecionarTodasLinhas()}
                            />
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('cd_empresa')}
                        >
                          <div className="flex items-center">
                            EMPRESA
                            {getSortIcon('cd_empresa')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('ds_chaveacesso')}
                        >
                          <div className="flex items-center">
                            CHAVE ACESSO
                            {getSortIcon('ds_chaveacesso')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('nr_nf')}
                        >
                          <div className="flex items-center">
                            NR NF
                            {getSortIcon('nr_nf')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('cd_serie')}
                        >
                          <div className="flex items-center">
                            SÉRIE
                            {getSortIcon('cd_serie')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('nr_nsu')}
                        >
                          <div className="flex items-center">
                            NSU
                            {getSortIcon('nr_nsu')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('dt_emissao')}
                        >
                          <div className="flex items-center">
                            DT EMISSÃO
                            {getSortIcon('dt_emissao')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('nr_cnpjemi')}
                        >
                          <div className="flex items-center">
                            CNPJ EMITENTE
                            {getSortIcon('nr_cnpjemi')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('nm_razaosocial')}
                        >
                          <div className="flex items-center">
                            RAZÃO SOCIAL
                            {getSortIcon('nm_razaosocial')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('vl_totalnota')}
                        >
                          <div className="flex items-center">
                            VALOR TOTAL
                            {getSortIcon('vl_totalnota')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('tp_situacaoman')}
                        >
                          <div className="flex items-center">
                            STATUS MANIFESTAÇÃO
                            {getSortIcon('tp_situacaoman')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('nr_fatura')}
                        >
                          <div className="flex items-center">
                            LANÇADA
                            {getSortIcon('nr_fatura')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('tp_operacao')}
                        >
                          <div className="flex items-center">
                            OPERAÇÃO
                            {getSortIcon('tp_operacao')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('cd_operador')}
                        >
                          <div className="flex items-center">
                            OPERADOR
                            {getSortIcon('cd_operador')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('tp_moddctofiscal')}
                        >
                          <div className="flex items-center">
                            TIPO DOC
                            {getSortIcon('tp_moddctofiscal')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('tp_situacao')}
                        >
                          <div className="flex items-center">
                            SITUAÇÃO DOC
                            {getSortIcon('tp_situacao')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('nr_fatura')}
                        >
                          <div className="flex items-center">
                            NR FATURA
                            {getSortIcon('nr_fatura')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('dt_fatura')}
                        >
                          <div className="flex items-center">
                            DT FATURA
                            {getSortIcon('dt_fatura')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer hover:bg-blue-800 transition-colors"
                          onClick={() => handleSort('dt_cadastro')}
                        >
                          <div className="flex items-center">
                            DT CADASTRO
                            {getSortIcon('dt_cadastro')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosPaginaAtual.map((item, index) => {
                        const indiceReal = indiceInicial + index;
                        const isSelected = linhasSelecionadas.has(indiceReal);
                        const status = getStatusFromData(item);
                        const StatusIcon = getStatusIcon(status);
                        
                        return (
                          <tr key={`${item.cd_empresa}-${item.nr_nf}-${item.cd_serie}-${index}`} className={isSelected ? 'bg-blue-50' : ''}>
                            <td style={{ position: 'sticky', left: 0, zIndex: 10, background: isSelected ? '#dbeafe' : 'inherit', minWidth: '50px', width: '50px' }}>
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleLinhaSelecionada(indiceReal)}
                                />
                              </div>
                            </td>
                            <td className="text-center font-medium">{item.cd_empresa || ''}</td>
                            <td className="max-w-32 truncate font-mono text-xs" title={item.ds_chaveacesso}>
                              {item.ds_chaveacesso || ''}
                            </td>
                            <td className="font-medium text-blue-600">{item.nr_nf || ''}</td>
                            <td className="text-center">{item.cd_serie || ''}</td>
                            <td className="text-center">{item.nr_nsu || ''}</td>
                            <td className="text-center">{formatarData(item.dt_emissao)}</td>
                            <td className="text-center font-mono text-xs">{item.nr_cnpjemi || ''}</td>
                            <td className="max-w-48 truncate" title={item.nm_razaosocial}>
                              {item.nm_razaosocial || ''}
                            </td>
                            <td className="text-right font-medium text-green-600">
                              {formatarMoeda(item.vl_totalnota)}
                            </td>
                            <td className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                                      {StatusIcon}
                                      {status}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Status: {status}</p>
                                    <p>Código: {item.tp_situacaoman}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="flex items-center justify-center">
                                      {getLancadaIcon(item)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{isLancada(item) ? 'Lançada na fatura' : 'Não lançada'}</p>
                                    {item.nr_fatura && <p>Fatura: {item.nr_fatura}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="text-center">{item.tp_operacao || ''}</td>
                            <td className="text-center">{item.cd_operador || ''}</td>
                            <td className="text-center font-medium">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.tp_moddctofiscal === '55' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : item.tp_moddctofiscal === '57'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {getTipoDocumento(item.tp_moddctofiscal)}
                              </span>
                            </td>
                            <td className="text-center font-medium">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.tp_situacao === 'A' 
                                  ? 'bg-green-100 text-green-800' 
                                  : item.tp_situacao === 'C'
                                  ? 'bg-red-100 text-red-800'
                                  : item.tp_situacao === 'D'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {getSituacaoDocumento(item.tp_situacao)}
                              </span>
                            </td>
                            <td className="text-center">{item.nr_fatura || ''}</td>
                            <td className="text-center">{formatarData(item.dt_fatura)}</td>
                            <td className="text-center">{formatarData(item.dt_cadastro)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        Página {paginaAtual} de {totalPaginas}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                        disabled={paginaAtual === 1}
                        className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        <CaretLeft size={16} />
                      </button>
                      
                      {/* Números das páginas */}
                      {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                        let pageNum;
                        if (totalPaginas <= 5) {
                          pageNum = i + 1;
                        } else if (paginaAtual <= 3) {
                          pageNum = i + 1;
                        } else if (paginaAtual >= totalPaginas - 2) {
                          pageNum = totalPaginas - 4 + i;
                        } else {
                          pageNum = paginaAtual - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPaginaAtual(pageNum)}
                            className={`px-3 py-1 border rounded-lg ${
                              paginaAtual === pageNum 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                        disabled={paginaAtual === totalPaginas}
                        className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        <CaretRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Resumo de Seleção */}
        {totalLinhasSelecionadas > 0 && (
          <Card className="mt-6 bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-blue-600" />
                    <span className="font-medium text-blue-800">
                      {totalLinhasSelecionadas} linha(s) selecionada(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CurrencyDollar size={20} className="text-green-600" />
                    <span className="font-medium text-green-800">
                      Valor Total: {formatarMoeda(valorTotalSelecionado)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={deselecionarTodasLinhas}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Limpar Seleção
                  </button>
                  <button
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Download size={14} />
                    Exportar Selecionados
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


      </div>
    </Layout>
  );
};

export default ManifestacaoNF; 