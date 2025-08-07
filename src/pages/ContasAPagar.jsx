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
  CaretDown
} from '@phosphor-icons/react';

const ContasAPagar = () => {
  const apiClient = useApiClient();

  const [dados, setDados] = useState([]);


  const [dataInicio, setDataInicio] = useState('');

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
      
      .contas-table {
        border-collapse: collapse;
        width: 100%;
      }
      
      .contas-table th,
      .contas-table td {
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
      }
      
      .contas-table th:last-child,
      .contas-table td:last-child {
        border-right: none;
      }
      
      .contas-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      
      .contas-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      
      .contas-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      
      .contas-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
      
      /* CSS para coluna fixa */
      .contas-table thead th:first-child,
      .contas-table tbody td:first-child {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        border-right: 2px solid #e5e7eb !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important;
      }
      
      .contas-table thead th:first-child {
        background: #000638 !important;
        z-index: 20 !important;
        border-right: 2px solid #374151 !important;
      }
      
      .contas-table tbody tr:nth-child(even) td:first-child {
        background: #fafafa !important;
      }
      
      .contas-table tbody tr:nth-child(odd) td:first-child {
        background: #ffffff !important;
      }
      
      .contas-table tbody tr:hover td:first-child {
        background: #f0f9ff !important;
      }
      
      .contas-table tbody tr.bg-blue-100 td:first-child {
        background: #dbeafe !important;
      }
      
      .contas-table tbody tr.bg-blue-100:hover td:first-child {
        background: #bfdbfe !important;
      }
      
      .contas-table th:first-child input[type="checkbox"] {
        transform: scale(1.1);
      }
      
      .contas-table td:first-child input[type="checkbox"] {
        transform: scale(1.1);
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('Todos');
  const [situacao, setSituacao] = useState('NORMAIS');
  const [fornecedor, setFornecedor] = useState('');
  const [despesa, setDespesa] = useState('');
  const [duplicata, setDuplicata] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());
  
  // Estado para controlar exibição da tabela de despesas
  const [mostrarTabela, setMostrarTabela] = useState(false);

  // Estados para filtro mensal
  const [filtroMensal, setFiltroMensal] = useState('ANO'); // 'ANO', 'JAN', 'FEV', etc.
  
  // Funções para seleção de linhas
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

  // Limpar seleção quando o filtro mensal mudar
  useEffect(() => {
    setLinhasSelecionadas(new Set());
  }, [filtroMensal]);



  // Empresas pré-selecionadas (serão carregadas do banco de dados)
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  
  // Estados para o modal de observações
  const [modalAberto, setModalAberto] = useState(false);
  const [dadosModal, setDadosModal] = useState(null);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(30);

  // Estados para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: 'dt_vencimento',
    direction: 'asc'
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

  // Função para aplicar filtro mensal
  const aplicarFiltroMensal = (dados, filtro) => {
    return dados.filter((item) => {
      // Usar dt_vencimento como base para o filtro mensal (data de vencimento)
      const dataVencimento = item.dt_vencimento;
      if (!dataVencimento) return false;
      
      const data = new Date(dataVencimento);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1
      
      if (filtro === 'ANO') {
        // Mostrar dados do ano atual
        const anoAtual = new Date().getFullYear();
        return ano === anoAtual;
      }
      
      // Filtros por mês específico
      const mesesMap = {
        'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4,
        'MAI': 5, 'JUN': 6, 'JUL': 7, 'AGO': 8,
        'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12
      };
      
      const mesDoFiltro = mesesMap[filtro];
      if (mesDoFiltro) {
        return mes === mesDoFiltro;
      }
      
      return true;
    });
  };

  // Função para agrupar dados idênticos (igual ao FluxoCaixa)
  const agruparDadosIdenticos = (dados) => {
    const grupos = new Map();
    
    dados.forEach((item) => {
      // Criar chave única baseada APENAS em FORNECEDOR e DUPLICATA
      const chave = `${item.cd_fornecedor}|${item.nm_fornecedor}|${item.nr_duplicata}|${item.nr_parcela}|${item.cd_empresa}|${item.dt_emissao}|${item.dt_vencimento}|${item.dt_entrada}|${item.dt_liq}|${item.tp_situacao}|${item.vl_duplicata}|${item.vl_juros}|${item.vl_acrescimo}|${item.vl_desconto}|${item.vl_pago}`;
      
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          item: item,
          observacoes: [],
          situacoes: [],
          datasEmissao: [],
          datasVencimento: [],
          datasEntrada: [],
          datasLiquidacao: [],
          quantidade: 0
        });
      }
      
      const grupo = grupos.get(chave);
      grupo.quantidade += 1;
      
      // Adicionar observação se existir e for diferente
      if (item.ds_observacao && !grupo.observacoes.includes(item.ds_observacao)) {
        grupo.observacoes.push(item.ds_observacao);
      }
      
      // Adicionar situação se existir e for diferente
      if (item.tp_situacao && !grupo.situacoes.includes(item.tp_situacao)) {
        grupo.situacoes.push(item.tp_situacao);
      }
      
      // Adicionar datas se existirem e forem diferentes
      if (item.dt_emissao && !grupo.datasEmissao.includes(item.dt_emissao)) {
        grupo.datasEmissao.push(item.dt_emissao);
      }
      if (item.dt_vencimento && !grupo.datasVencimento.includes(item.dt_vencimento)) {
        grupo.datasVencimento.push(item.dt_vencimento);
      }
      if (item.dt_entrada && !grupo.datasEntrada.includes(item.dt_entrada)) {
        grupo.datasEntrada.push(item.dt_entrada);
      }
      if (item.dt_liq && !grupo.datasLiquidacao.includes(item.dt_liq)) {
        grupo.datasLiquidacao.push(item.dt_liq);
      }
    });
    
    // Processar os grupos para determinar a situação final e datas mais relevantes
    return Array.from(grupos.values()).map(grupo => {
      // Se há múltiplas situações, priorizar CANCELADAS (C) sobre NORMAIS (N)
      let situacaoFinal = grupo.item.tp_situacao;
      
      if (grupo.situacoes.length > 1) {
        // Se há 'C' entre as situações, usar 'C' (cancelada tem prioridade)
        if (grupo.situacoes.includes('C')) {
          situacaoFinal = 'C';
        } else if (grupo.situacoes.includes('N')) {
          situacaoFinal = 'N';
        }
        // Se não há nem 'C' nem 'N', manter a primeira situação
      }
      
      // Para as datas, usar a mais recente ou a mais relevante
      const dtEmissaoFinal = grupo.datasEmissao.length > 0 ? 
        grupo.datasEmissao.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_emissao;
      
      const dtVencimentoFinal = grupo.datasVencimento.length > 0 ? 
        grupo.datasVencimento.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_vencimento;
      
      const dtEntradaFinal = grupo.datasEntrada.length > 0 ? 
        grupo.datasEntrada.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_entrada;
      
      const dtLiquidacaoFinal = grupo.datasLiquidacao.length > 0 ? 
        grupo.datasLiquidacao.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_liq;
      
      return {
        ...grupo,
        item: {
          ...grupo.item,
          tp_situacao: situacaoFinal,
          dt_emissao: dtEmissaoFinal,
          dt_vencimento: dtVencimentoFinal,
          dt_entrada: dtEntradaFinal,
          dt_liq: dtLiquidacaoFinal
        }
      };
    });
  };

  // Função para ordenar os dados agrupados
  const sortDadosAgrupados = (dados) => {
    if (!dados || dados.length === 0) return dados;

    return [...dados].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'cd_empresa':
          aValue = a.item.cd_empresa || '';
          bValue = b.item.cd_empresa || '';
          break;
        case 'cd_fornecedor':
          aValue = a.item.cd_fornecedor || '';
          bValue = b.item.cd_fornecedor || '';
          break;
        case 'nm_fornecedor':
          aValue = a.item.nm_fornecedor || '';
          bValue = b.item.nm_fornecedor || '';
          break;
        case 'ds_despesaitem':
          aValue = a.item.ds_despesaitem || '';
          bValue = b.item.ds_despesaitem || '';
          break;
        case 'ds_ccusto':
          aValue = a.item.ds_ccusto || '';
          bValue = b.item.ds_ccusto || '';
          break;
        case 'nr_duplicata':
          aValue = a.item.nr_duplicata || '';
          bValue = b.item.nr_duplicata || '';
          break;
        case 'nr_portador':
          aValue = a.item.nr_portador || '';
          bValue = b.item.nr_portador || '';
          break;
        case 'dt_emissao':
          aValue = a.item.dt_emissao ? new Date(a.item.dt_emissao) : new Date(0);
          bValue = b.item.dt_emissao ? new Date(b.item.dt_emissao) : new Date(0);
          break;
        case 'dt_vencimento':
          aValue = a.item.dt_vencimento ? new Date(a.item.dt_vencimento) : new Date(0);
          bValue = b.item.dt_vencimento ? new Date(b.item.dt_vencimento) : new Date(0);
          break;
        case 'dt_entrada':
          aValue = a.item.dt_entrada ? new Date(a.item.dt_entrada) : new Date(0);
          bValue = b.item.dt_entrada ? new Date(b.item.dt_entrada) : new Date(0);
          break;
        case 'dt_liq':
          aValue = a.item.dt_liq ? new Date(a.item.dt_liq) : new Date(0);
          bValue = b.item.dt_liq ? new Date(b.item.dt_liq) : new Date(0);
          break;
        case 'tp_situacao':
          aValue = a.item.tp_situacao || '';
          bValue = b.item.tp_situacao || '';
          break;
        case 'tp_estagio':
          aValue = a.item.tp_estagio || '';
          bValue = b.item.tp_estagio || '';
          break;
        case 'vl_duplicata':
          aValue = parseFloat(a.item.vl_duplicata) || 0;
          bValue = parseFloat(b.item.vl_duplicata) || 0;
          break;
        case 'vl_juros':
          aValue = parseFloat(a.item.vl_juros) || 0;
          bValue = parseFloat(b.item.vl_juros) || 0;
          break;
        case 'vl_acrescimo':
          aValue = parseFloat(a.item.vl_acrescimo) || 0;
          bValue = parseFloat(b.item.vl_acrescimo) || 0;
          break;
        case 'vl_desconto':
          aValue = parseFloat(a.item.vl_desconto) || 0;
          bValue = parseFloat(b.item.vl_desconto) || 0;
          break;
        case 'vl_pago':
          aValue = parseFloat(a.item.vl_pago) || 0;
          bValue = parseFloat(b.item.vl_pago) || 0;
          break;
        case 'in_aceite':
          aValue = a.item.in_aceite || '';
          bValue = b.item.in_aceite || '';
          break;
        case 'nr_parcela':
          aValue = parseInt(a.item.nr_parcela) || 0;
          bValue = parseInt(b.item.nr_parcela) || 0;
          break;
        default:
          aValue = a.item[sortConfig.key] || '';
          bValue = b.item[sortConfig.key] || '';
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  const buscarDados = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) return;
    
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }
    
    setLoading(true);
    setPaginaAtual(1); // Reset para primeira página ao buscar novos dados
    try {
      console.log('🔍 Iniciando busca de contas a pagar...');
      console.log('📅 Período:', { inicio, fim });
      console.log('🏢 Empresas selecionadas:', empresasSelecionadas);
      
      // Buscar dados usando a nova rota que aceita múltiplas empresas
      const params = {
        dt_inicio: inicio,
        dt_fim: fim
      };

      // Adicionar códigos das empresas selecionadas como array
      const codigosEmpresas = empresasSelecionadas
        .filter(empresa => empresa.cd_empresa)
        .map(empresa => empresa.cd_empresa);
      
      if (codigosEmpresas.length > 0) {
        params.cd_empresa = codigosEmpresas;
      }
      
      console.log('📋 Parâmetros da requisição:', params);
      console.log('🏢 Códigos das empresas:', codigosEmpresas);
      
      const result = await apiClient.financial.contasPagar(params);
      
      if (result.success) {
        const dadosArray = Array.isArray(result.data) ? result.data : [];
        console.log('✅ Dados obtidos:', {
          total: dadosArray.length,
          amostra: dadosArray.slice(0, 2),
          empresas: codigosEmpresas
        });
        
        setDados(dadosArray);
        setDadosCarregados(true);
      } else {
        console.warn('⚠️ Falha ao buscar dados:', result.message);
        setDados([]);
        setDadosCarregados(false);
      }
    } catch (err) {
      console.error('❌ Erro geral ao buscar dados:', err);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  const getStatusFromData = (item) => {
    // Se tem data de liquidação, está pago
    if (item.dt_liq) {
      return 'Pago';
    }
    
    // Se tem vencimento, verificar se está vencido
    if (item.dt_vencimento) {
      const hoje = new Date();
      const vencimento = new Date(item.dt_vencimento);
      
      if (vencimento < hoje) {
        return 'Vencido';
      } else {
        return 'A Vencer';
      }
    }
    
    // Verificar tp_situacao se disponível
    if (item.tp_situacao) {
      switch (item.tp_situacao.toString()) {
        case '1':
        case 'P':
          return 'Pago';
        case '2':
        case 'V':
          return 'Vencido';
        case '3':
        case 'A':
          return 'A Vencer';
        default:
          return 'Pendente';
      }
    }
    
    return 'Pendente';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pago':
      case 'liquidado':
        return 'bg-green-100 text-green-800';
      case 'vencido':
      case 'atrasado':
        return 'bg-red-100 text-red-800';
      case 'a vencer':
      case 'vencendo':
        return 'bg-yellow-100 text-yellow-800';
      case 'pendente':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pago':
      case 'liquidado':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'vencido':
      case 'atrasado':
        return <Warning size={16} className="text-red-600" />;
      case 'a vencer':
      case 'vencendo':
        return <Clock size={16} className="text-yellow-600" />;
      case 'pendente':
        return <ArrowUp size={16} className="text-blue-600" />;
      default:
        return <ArrowDown size={16} className="text-gray-600" />;
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

  // Filtros aplicados (todos os dados)
  const dadosFiltrados = dados.filter((item) => {
    // Filtro por status
    if (status !== 'Todos') {
      const itemStatus = getStatusFromData(item);
      if (itemStatus.toLowerCase() !== status.toLowerCase()) {
        return false;
      }
    }
    
    // Filtro por situação (N = NORMAIS, C = CANCELADAS)
    if (situacao !== 'TODAS') {
      const itemSituacao = item.tp_situacao || '';
      
      if (situacao === 'NORMAIS' && itemSituacao !== 'N') {
        return false;
      } else if (situacao === 'CANCELADAS' && itemSituacao !== 'C') {
        return false;
      }
    }
    
    // Filtro por fornecedor
    if (fornecedor) {
      const cdFornecedor = item.cd_fornecedor || '';
      const nmFornecedor = item.nm_fornecedor || '';
      const buscaFornecedor = fornecedor.toLowerCase();
      
      if (!cdFornecedor.toString().toLowerCase().includes(buscaFornecedor) && 
          !nmFornecedor.toLowerCase().includes(buscaFornecedor)) {
        return false;
      }
    }

    // Filtro por despesa
    if (despesa) {
      const dsDespesa = item.ds_despesaitem || '';
      const buscaDespesa = despesa.toLowerCase();
      
      if (!dsDespesa.toLowerCase().includes(buscaDespesa)) {
        return false;
      }
    }
    
    // Filtro por duplicata
    if (duplicata) {
      const nrDuplicata = item.nr_duplicata || '';
      if (!nrDuplicata.toString().toLowerCase().includes(duplicata.toLowerCase())) {
        return false;
      }
    }

    // Filtro por centro de custo
    if (centroCusto) {
      const dsCentroCusto = item.ds_ccusto || '';
      const buscaCentroCusto = centroCusto.toLowerCase();
      
      if (!dsCentroCusto.toLowerCase().includes(buscaCentroCusto)) {
        return false;
      }
    }
    
    return true;
  });

  // Aplicar filtro mensal aos dados filtrados
  const dadosComFiltroMensal = aplicarFiltroMensal(dadosFiltrados, filtroMensal);

  // Agrupar dados filtrados (incluindo filtro mensal)
  const dadosAgrupadosComFiltroMensal = agruparDadosIdenticos(dadosComFiltroMensal);

  // Aplicar ordenação aos dados agrupados
  const dadosOrdenadosComFiltroMensal = sortDadosAgrupados(dadosAgrupadosComFiltroMensal);

  // Função para agrupar dados idênticos (legado)
  const agruparDadosIdenticosLegado = (dados) => {
    const grupos = new Map();
    
    dados.forEach((item) => {
      // Criar chave única baseada APENAS em FORNECEDOR e DUPLICATA
      // Se FORNECEDOR e DUPLICATA são iguais = AGRUPA
      // Se FORNECEDOR igual mas DUPLICATA diferente = NÃO AGRUPA
      // Se FORNECEDOR diferente mas DUPLICATA igual = NÃO AGRUPA
      const chave = `${item.cd_fornecedor}|${item.nm_fornecedor}|${item.nr_duplicata}|${item.nr_parcela}|${item.cd_empresa}|${item.dt_emissao}|${item.dt_vencimento}|${item.dt_entrada}|${item.dt_liq}|${item.tp_situacao}|${item.vl_duplicata}|${item.vl_juros}|${item.vl_acrescimo}|${item.vl_desconto}|${item.vl_pago}`;
      
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          item: item,
          observacoes: [],
          situacoes: [],
          datasEmissao: [],
          datasVencimento: [],
          datasEntrada: [],
          datasLiquidacao: [],
          quantidade: 0
        });
      }
      
      const grupo = grupos.get(chave);
      grupo.quantidade += 1;
      
      // Adicionar observação se existir e for diferente
      if (item.ds_observacao && !grupo.observacoes.includes(item.ds_observacao)) {
        grupo.observacoes.push(item.ds_observacao);
      }
      
      // Adicionar situação se existir e for diferente
      if (item.tp_situacao && !grupo.situacoes.includes(item.tp_situacao)) {
        grupo.situacoes.push(item.tp_situacao);
      }
      
      // Adicionar datas se existirem e forem diferentes
      if (item.dt_emissao && !grupo.datasEmissao.includes(item.dt_emissao)) {
        grupo.datasEmissao.push(item.dt_emissao);
      }
      if (item.dt_vencimento && !grupo.datasVencimento.includes(item.dt_vencimento)) {
        grupo.datasVencimento.push(item.dt_vencimento);
      }
      if (item.dt_entrada && !grupo.datasEntrada.includes(item.dt_entrada)) {
        grupo.datasEntrada.push(item.dt_entrada);
      }
      if (item.dt_liq && !grupo.datasLiquidacao.includes(item.dt_liq)) {
        grupo.datasLiquidacao.push(item.dt_liq);
      }
    });
    
    // Processar os grupos para determinar a situação final e datas mais relevantes
    return Array.from(grupos.values()).map(grupo => {
      // Se há múltiplas situações, priorizar CANCELADAS (C) sobre NORMAIS (N)
      let situacaoFinal = grupo.item.tp_situacao;
      
      if (grupo.situacoes.length > 1) {
        // Se há 'C' entre as situações, usar 'C' (cancelada tem prioridade)
        if (grupo.situacoes.includes('C')) {
          situacaoFinal = 'C';
        } else if (grupo.situacoes.includes('N')) {
          situacaoFinal = 'N';
        }
        // Se não há nem 'C' nem 'N', manter a primeira situação
      }
      
      // Para as datas, usar a mais recente ou a mais relevante
      const dtEmissaoFinal = grupo.datasEmissao.length > 0 ? 
        grupo.datasEmissao.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_emissao;
      
      const dtVencimentoFinal = grupo.datasVencimento.length > 0 ? 
        grupo.datasVencimento.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_vencimento;
      
      const dtEntradaFinal = grupo.datasEntrada.length > 0 ? 
        grupo.datasEntrada.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_entrada;
      
      const dtLiquidacaoFinal = grupo.datasLiquidacao.length > 0 ? 
        grupo.datasLiquidacao.sort((a, b) => new Date(b) - new Date(a))[0] : 
        grupo.item.dt_liq;
      
      return {
        ...grupo,
        item: {
          ...grupo.item,
          tp_situacao: situacaoFinal,
          dt_emissao: dtEmissaoFinal,
          dt_vencimento: dtVencimentoFinal,
          dt_entrada: dtEntradaFinal,
          dt_liq: dtLiquidacaoFinal
        }
      };
    });
  };

  // Logs de debug para monitorar dados
  console.log('🔍 Debug ContasAPagar:', {
    dadosOriginais: dados.length,
    dadosFiltrados: dadosFiltrados.length,
          filtrosAtivos: { status, situacao, fornecedor, despesa, duplicata, centroCusto },
    amostraDados: dados.slice(0, 2)
  });

  // Agrupar dados filtrados (versão legada para tabela atual)
  const dadosAgrupados = agruparDadosIdenticosLegado(dadosFiltrados);

  // Aplicar ordenação aos dados agrupados (versão legada para tabela atual)
  const dadosOrdenados = sortDadosAgrupados(dadosAgrupados);

  console.log('📊 Dados processados:', {
    dadosAgrupados: dadosAgrupados.length,
    dadosOrdenados: dadosOrdenados.length,
    paginaAtual,
    itensPorPagina
  });



  // Cálculos dos totais (baseados em dados agrupados - apenas uma linha por grupo)
  const totalContas = dadosOrdenados.length;
  const totalValor = dadosOrdenados.reduce((acc, grupo) => acc + (parseFloat(grupo.item.vl_duplicata) || 0), 0);
  const contasVencidas = dadosOrdenados.filter(grupo => {
    const status = getStatusFromData(grupo.item);
    return status.toLowerCase().includes('vencido');
  }).length;
  const contasAVencer = dadosOrdenados.filter(grupo => {
    const status = getStatusFromData(grupo.item);
    return status.toLowerCase().includes('vencer');
  }).length;

  // Cálculo para contas próximas a vencer (mês atual)
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  
  const contasProximasVencer = dadosOrdenados.filter(grupo => {
    if (!grupo.item.dt_vencimento) return false;
    
    const dataVencimento = new Date(grupo.item.dt_vencimento);
    const status = getStatusFromData(grupo.item);
    
    // Verificar se está no mês atual E ainda não venceu E não foi pago
    return dataVencimento >= hoje && 
           dataVencimento <= fimMes && 
           !status.toLowerCase().includes('pago') &&
           !status.toLowerCase().includes('vencido');
  });
  
  const totalContasProximasVencer = contasProximasVencer.length;
  const valorContasProximasVencer = contasProximasVencer.reduce((acc, grupo) => 
    acc + (parseFloat(grupo.item.vl_duplicata) || 0), 0
  );

  // Cálculo para contas pagas
  const contasPagas = dadosOrdenados.filter(grupo => {
    const status = getStatusFromData(grupo.item);
    return status.toLowerCase().includes('pago');
  });
  
  const totalContasPagas = contasPagas.length;
  const valorContasPagas = contasPagas.reduce((acc, grupo) => 
    acc + (parseFloat(grupo.item.vl_pago) || 0), 0
  );

  // Cálculo para valor que falta pagar
  const valorFaltaPagar = totalValor - valorContasPagas;

  // Cálculos para paginação (usando dados ordenados)
  const totalPaginas = Math.ceil(dadosOrdenados.length / itensPorPagina);
  const indiceInicial = (paginaAtual - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const dadosPaginaAtual = dadosOrdenados.slice(indiceInicial, indiceFinal);

  // Calcular total das linhas selecionadas
  const totalLinhasSelecionadas = linhasSelecionadas.size;
  const valorTotalSelecionado = Array.from(linhasSelecionadas).reduce((total, index) => {
    const linha = dadosPaginaAtual[index - indiceInicial];
    return total + (parseFloat(linha?.item?.vl_duplicata) || 0);
  }, 0);

  // Funções para navegação
  const irParaPagina = (pagina) => {
    setPaginaAtual(pagina);
  };

  const paginaAnterior = () => {
    if (paginaAtual > 1) {
      setPaginaAtual(paginaAtual - 1);
    }
  };

  const proximaPagina = () => {
    if (paginaAtual < totalPaginas) {
      setPaginaAtual(paginaAtual + 1);
    }
  };

  // Gerar array de páginas para exibição
  const gerarPaginas = () => {
    const paginas = [];
    const maxPaginasVisiveis = 5;
    
    if (totalPaginas <= maxPaginasVisiveis) {
      // Mostrar todas as páginas se houver 5 ou menos
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      // Lógica para mostrar páginas com elipses
      if (paginaAtual <= 3) {
        // Páginas iniciais
        for (let i = 1; i <= 4; i++) {
          paginas.push(i);
        }
        paginas.push('...');
        paginas.push(totalPaginas);
      } else if (paginaAtual >= totalPaginas - 2) {
        // Páginas finais
        paginas.push(1);
        paginas.push('...');
        for (let i = totalPaginas - 3; i <= totalPaginas; i++) {
          paginas.push(i);
        }
      } else {
        // Páginas do meio
        paginas.push(1);
        paginas.push('...');
        for (let i = paginaAtual - 1; i <= paginaAtual + 1; i++) {
          paginas.push(i);
        }
        paginas.push('...');
        paginas.push(totalPaginas);
      }
    }
    
    return paginas;
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

  // Função para abrir modal com detalhes das observações
  const abrirModalObservacoes = (grupo) => {
    setDadosModal({
      cd_fornecedor: grupo.item.cd_fornecedor,
      nm_fornecedor: grupo.item.nm_fornecedor,
      nr_duplicata: grupo.item.nr_duplicata,
      nr_parcela: grupo.item.nr_parcela,
      valor_duplicata: grupo.item.vl_duplicata,
      valor_juros: grupo.item.vl_juros,
      valor_acrescimo: grupo.item.vl_acrescimo,
      valor_desconto: grupo.item.vl_desconto,
      valor_pago: grupo.item.vl_pago,
      observacoes: grupo.observacoes,
      ds_despesaitem: grupo.item.ds_despesaitem
    });
    setModalAberto(true);
  };

  // Função para fechar modal
  const fecharModal = () => {
    setModalAberto(false);
    setDadosModal(null);
  };

  // Função para baixar dados em Excel
  const baixarExcel = () => {
    if (!dadosCarregados || dados.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    // Preparar dados para exportação
    const dadosParaExportar = dados.map(item => ({
      'Vencimento': item.dt_vencimento,
      'Valor Duplicata': item.vl_duplicata,
      'Fornecedor': item.nm_fornecedor || item.cd_fornecedor,
      'Despesa': item.ds_despesaitem || 'N/A',
              'Centro de Custo': item.ds_ccusto || 'N/A',
      'Empresa': item.cd_empresa,
      'Duplicata': item.nr_duplicata,
      'Parcela': item.nr_parcela,
      'Portador': item.nr_portador,
      'Emissão': item.dt_emissao,
      'Entrada': item.dt_entrada,
      'Liquidação': item.dt_liq,
      'Situação': item.tp_situacao,
      'Estágio': item.tp_estagio,
      'Juros': item.vl_juros,
      'Acréscimo': item.vl_acrescimo,
      'Desconto': item.vl_desconto,
      'Valor Pago': item.vl_pago,
      'Aceite': item.in_aceite,
      'Observações': item.observacoes ? item.observacoes.join(', ') : ''
    }));

    // Converter para CSV
    const headers = Object.keys(dadosParaExportar[0]);
    const csvContent = [
      headers.join(','),
      ...dadosParaExportar.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escapar vírgulas e aspas no valor
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Criar e baixar arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contas_a_pagar_${dataInicio}_${dataFim}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função para lidar com seleção de empresas
  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas([...empresas]); // Garantir que é um novo array
  };

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Contas a Pagar</h1>
        
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="Todos">TODOS</option>
                  <option value="Pago">PAGO</option>
                  <option value="Vencido">VENCIDO</option>
                  <option value="A Vencer">A VENCER</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Situação</label>
                <select
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="NORMAIS">NORMAIS</option>
                  <option value="CANCELADAS">CANCELADAS</option>
                  <option value="TODAS">TODAS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Fornecedor</label>
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Buscar por código ou nome do fornecedor..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Despesa</label>
                <input
                  type="text"
                  value={despesa}
                  onChange={(e) => setDespesa(e.target.value)}
                  placeholder="Buscar por descrição da despesa..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Duplicata</label>
                <input
                  type="text"
                  value={duplicata}
                  onChange={(e) => setDuplicata(e.target.value)}
                  placeholder="Buscar duplicata..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Centro de Custo</label>
                <input
                  type="text"
                  value={centroCusto}
                  onChange={(e) => setCentroCusto(e.target.value)}
                  placeholder="Buscar por nome do centro de custo..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div className="flex items-center">
                <button 
                  type="submit"
                  className="flex items-center gap-2 bg-[#000638] text-white px-6 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-10 text-sm font-bold shadow-md tracking-wide uppercase"
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
                <CardTitle className="text-sm font-bold text-blue-700">Total de Contas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-blue-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : totalContas}
              </div>
              <CardDescription className="text-xs text-gray-500">Contas no período</CardDescription>
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
                {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : totalValor.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">Valor total das duplicatas</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Warning size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">Contas Vencidas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : contasVencidas}
              </div>
              <CardDescription className="text-xs text-gray-500">Contas em atraso</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-yellow-600" />
                <CardTitle className="text-sm font-bold text-yellow-700">A Vencer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-yellow-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-yellow-600" /> : contasAVencer}
              </div>
              <CardDescription className="text-xs text-gray-500">Contas futuras</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-purple-600" />
                <CardTitle className="text-sm font-bold text-purple-700">Próximas a Vencer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-purple-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-purple-600" /> : totalContasProximasVencer}
              </div>
              <CardDescription className="text-xs text-gray-500 mb-2">Este mês</CardDescription>
              <div className="text-sm font-semibold text-purple-600">
                {loading ? <Spinner size={16} className="animate-spin text-purple-600" /> : valorContasProximasVencer.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Contas Pagas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : totalContasPagas}
              </div>
              <CardDescription className="text-xs text-gray-500 mb-2">Liquidadas</CardDescription>
              <div className="text-sm font-semibold text-green-600">
                {loading ? <Spinner size={16} className="animate-spin text-green-600" /> : valorContasPagas.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <ArrowUp size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">Falta Pagar</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : valorFaltaPagar.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">Valor pendente</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full">
          <div className="p-6 border-b border-[#000638]/10 flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#000638]">Detalhamento de Contas</h2>
            <button
              onClick={() => baixarExcel()}
              disabled={!dadosCarregados || dados.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Baixar Excel
            </button>
          </div>
          
          <div className="p-6">
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
                  <div className="text-gray-500 text-lg mb-2">Clique em "Buscar Dados" para carregar as informações</div>
                  <div className="text-gray-400 text-sm">Selecione o período e empresa desejados</div>
                </div>
              </div>
            ) : dados.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">Nenhum dado encontrado</div>
                  <div className="text-gray-400 text-sm">Verifique o período selecionado ou tente novamente</div>
                </div>
              </div>
            ) : (
              <>
                {/* Dropdown do Detalhamento de Contas */}
                <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full mb-6">
                  <div 
                    className="p-6 border-b border-[#000638]/10 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setMostrarTabela(!mostrarTabela)}
                  >
                    <h2 className="text-xl font-bold text-[#000638]">Detalhamento de Contas</h2>
                    <div className="flex items-center gap-2">
                      {mostrarTabela ? (
                        <CaretUp size={20} className="text-[#000638]" />
                      ) : (
                        <CaretDown size={20} className="text-[#000638]" />
                      )}
                    </div>
                  </div>
                  
                  {mostrarTabela && (
                    <div className="p-6">
                      <DespesasPorCategoria 
                        dados={dadosOrdenadosComFiltroMensal}
                        totalContas={dadosOrdenadosComFiltroMensal.length}
                        linhasSelecionadas={linhasSelecionadas}
                        toggleLinhaSelecionada={toggleLinhaSelecionada}
                        filtroMensal={filtroMensal}
                        setFiltroMensal={setFiltroMensal}
                        dadosOriginais={dadosFiltrados}
                      />
                    </div>
                  )}
                </div>

                  <div className="table-container max-w-8xl mx-auto">
                    <table 
                      className="border-collapse rounded-lg overflow-hidden shadow-lg contas-table"
                      style={{ minWidth: '1800px' }}
                    >
                    <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-2 py-1 text-center text-[10px]" style={{ width: '50px', minWidth: '50px', position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#000638' }}>
                          <input
                            type="checkbox"
                            checked={totalLinhasSelecionadas === dadosPaginaAtual.length && dadosPaginaAtual.length > 0}
                            onChange={() => {
                              if (totalLinhasSelecionadas === dadosPaginaAtual.length) {
                                deselecionarTodasLinhas();
                              } else {
                                selecionarTodasLinhas();
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('dt_vencimento')}
                        >
                          <div className="flex items-center justify-center">
                            Vencimento
                            {getSortIcon('dt_vencimento')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('vl_duplicata')}
                        >
                          <div className="flex items-center justify-center">
                            Valor
                            {getSortIcon('vl_duplicata')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('cd_fornecedor')}
                        >
                          <div className="flex items-center justify-center">
                            Fornecedor
                            {getSortIcon('cd_fornecedor')}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('nm_fornecedor')}
                        >
                          <div className="flex items-center justify-center">
                            NM Fornecedor
                            {getSortIcon('nm_fornecedor')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('ds_despesaitem')}
                        >
                          <div className="flex items-center justify-center">
                            Despesa
                            {getSortIcon('ds_despesaitem')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('ds_ccusto')}
                        >
                          <div className="flex items-center justify-center">
                            NM CUSTO
                            {getSortIcon('ds_ccusto')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('cd_empresa')}
                        >
                          <div className="flex items-center justify-center">
                            Empresa
                            {getSortIcon('cd_empresa')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('nr_duplicata')}
                        >
                          <div className="flex items-center justify-center">
                            Duplicata
                            {getSortIcon('nr_duplicata')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('nr_portador')}
                        >
                          <div className="flex items-center justify-center">
                            Portador
                            {getSortIcon('nr_portador')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('dt_emissao')}
                        >
                          <div className="flex items-center justify-center">
                            Emissão
                            {getSortIcon('dt_emissao')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('dt_entrada')}
                        >
                          <div className="flex items-center justify-center">
                            Entrada
                            {getSortIcon('dt_entrada')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('dt_liq')}
                        >
                          <div className="flex items-center justify-center">
                            Liquidação
                            {getSortIcon('dt_liq')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('tp_situacao')}
                        >
                          <div className="flex items-center justify-center">
                            Situação
                            {getSortIcon('tp_situacao')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('tp_estagio')}
                        >
                          <div className="flex items-center justify-center">
                            Estágio
                            {getSortIcon('tp_estagio')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('vl_juros')}
                        >
                          <div className="flex items-center justify-center">
                            Juros
                            {getSortIcon('vl_juros')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('vl_acrescimo')}
                        >
                          <div className="flex items-center justify-center">
                            Acréscimo
                            {getSortIcon('vl_acrescimo')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('vl_desconto')}
                        >
                          <div className="flex items-center justify-center">
                            Desconto
                            {getSortIcon('vl_desconto')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('vl_pago')}
                        >
                          <div className="flex items-center justify-center">
                            Pago
                            {getSortIcon('vl_pago')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('in_aceite')}
                        >
                          <div className="flex items-center justify-center">
                            Aceite
                            {getSortIcon('in_aceite')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('nr_parcela')}
                        >
                          <div className="flex items-center justify-center">
                            Parcela
                            {getSortIcon('nr_parcela')}
                          </div>
                        </th>
                        <th className="px-1 py-1 text-center text-[10px]">
                          Observação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosPaginaAtual.map((grupo, index) => (
                        <tr
                          key={index}
                          className={`text-[10px] border-b transition-colors cursor-pointer ${
                            linhasSelecionadas.has(indiceInicial + index)
                              ? 'bg-blue-100 hover:bg-blue-200'
                              : index % 2 === 0
                              ? 'bg-white hover:bg-gray-100'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          onClick={() => abrirModalObservacoes(grupo)}
                        >
                          <td className="px-2 py-1 text-center" style={{ width: '50px', minWidth: '50px', position: 'sticky', left: 0, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={linhasSelecionadas.has(indiceInicial + index)}
                              onChange={() => toggleLinhaSelecionada(indiceInicial + index)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.dt_vencimento ? 
                              new Date(grupo.item.dt_vencimento).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center font-semibold text-green-600">
                            {(parseFloat(grupo.item.vl_duplicata) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.cd_fornecedor || 'N/A'}
                          </td>
                          <td className="px-2 py-0.5 text-center">
                            <span className="block whitespace-normal">
                              {grupo.item.nm_fornecedor || 'N/A'}
                            </span>
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(() => {
                              const despesas = grupo.item.ds_despesaitem || '';
                              if (!despesas || despesas.trim() === '') return 'N/A';
                              
                              // Se tem múltiplas despesas (separadas por vírgula, ponto e vírgula, quebra de linha, etc.)
                              const despesasArray = despesas.split(/[,;\n\r]/).filter(d => d.trim());
                              
                              if (despesasArray.length > 1) {
                                return (
                                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                    {despesasArray.length} despesas
                                  </span>
                                );
                              }
                              
                              // Para uma única despesa, mostrar completa
                              const despesaUnica = despesasArray[0] || despesas;
                              return (
                                <span className="block whitespace-normal">
                                  {despesaUnica}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(() => {
                              const centrosCusto = grupo.item.ds_ccusto || '';
                              if (!centrosCusto || centrosCusto.trim() === '') return 'N/A';
                              
                              // Se tem múltiplos centros de custo (separados por vírgula, ponto e vírgula, quebra de linha, etc.)
                              const centrosCustoArray = centrosCusto.split(/[,;\n\r]/).filter(c => c.trim());
                              
                              if (centrosCustoArray.length > 1) {
                                // Mostrar múltiplos centros separados por "|"
                                const centrosFormatados = centrosCustoArray.join(' | ');
                                return (
                                  <span className="block whitespace-normal text-xs">
                                    {centrosFormatados}
                                  </span>
                                );
                              }
                              
                              // Para um único centro de custo, mostrar completo
                              const centroCustoUnico = centrosCustoArray[0] || centrosCusto;
                              return (
                                <span className="block whitespace-normal">
                                  {centroCustoUnico}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.cd_empresa || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.nr_duplicata || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.nr_portador || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.dt_emissao ? 
                              new Date(grupo.item.dt_emissao).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.dt_entrada ? 
                              new Date(grupo.item.dt_entrada).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.dt_liq ? 
                              new Date(grupo.item.dt_liq).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.tp_situacao || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.tp_estagio || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(parseFloat(grupo.item.vl_juros) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(parseFloat(grupo.item.vl_acrescimo) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(parseFloat(grupo.item.vl_desconto) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center font-semibold text-blue-600">
                            {(parseFloat(grupo.item.vl_pago) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.in_aceite || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.nr_parcela || '1'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.observacoes.length > 0 ? (
                              <span className="text-blue-600 font-semibold bg-blue-100 px-1 py-0.5 text-[9px]">
                                {grupo.observacoes.length} obs.
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">0 obs.</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {dadosPaginaAtual.length === 0 && !loading && (
                        <tr>
                          <td colSpan="22" className="text-center py-8 text-gray-500 text-sm">
                            Nenhuma conta encontrada para os filtros selecionados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Resumo das Linhas Selecionadas */}
                {totalLinhasSelecionadas > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium text-blue-800">
                            {totalLinhasSelecionadas} linha{totalLinhasSelecionadas > 1 ? 's' : ''} selecionada{totalLinhasSelecionadas > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          <span className="text-sm font-medium text-green-800">
                            Total: {valorTotalSelecionado.toLocaleString('pt-BR', {
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

                {/* Paginação */}
                {totalPaginas > 1 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-4 sm:mb-0">
                      Mostrando {indiceInicial + 1} a {Math.min(indiceFinal, dadosOrdenados.length)} de {dadosOrdenados.length} registros únicos
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Botão Anterior */}
                      <button
                        onClick={paginaAnterior}
                        disabled={paginaAtual === 1}
                        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <CaretLeft size={16} />
                        Anterior
                      </button>

                      {/* Números das páginas */}
                      <div className="flex items-center gap-1">
                        {gerarPaginas().map((pagina, index) => (
                          <button
                            key={index}
                            onClick={() => typeof pagina === 'number' && irParaPagina(pagina)}
                            disabled={typeof pagina !== 'number'}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                              pagina === paginaAtual
                                ? 'bg-[#000638] text-white'
                                : typeof pagina === 'number'
                                ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                : 'text-gray-400 cursor-default'
                            }`}
                          >
                            {pagina}
                          </button>
                        ))}
                      </div>

                      {/* Botão Próximo */}
                      <button
                        onClick={proximaPagina}
                        disabled={paginaAtual === totalPaginas}
                        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Próximo
                        <CaretRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Observações */}
      {modalAberto && dadosModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-[#000638] text-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Detalhes das Observações</h3>
                <button
                  onClick={fecharModal}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Informações do Registro */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Fornecedor:</label>
                  <span className="text-lg font-bold text-[#000638]">
                    {dadosModal.nm_fornecedor || dadosModal.cd_fornecedor}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Duplicata:</label>
                  <span className="text-lg font-bold text-[#000638]">{dadosModal.nr_duplicata}</span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Parcela:</label>
                  <span className="text-lg font-bold text-[#000638]">{dadosModal.nr_parcela}</span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Valor Duplicata:</label>
                  <span className="text-lg font-bold text-blue-600">
                    {(parseFloat(dadosModal.valor_duplicata) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              </div>

              {/* Valores Financeiros */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Juros:</label>
                  <span className="text-lg font-bold text-red-600">
                    {(parseFloat(dadosModal.valor_juros) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Acréscimo:</label>
                  <span className="text-lg font-bold text-orange-600">
                    {(parseFloat(dadosModal.valor_acrescimo) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Desconto:</label>
                  <span className="text-lg font-bold text-purple-600">
                    {(parseFloat(dadosModal.valor_desconto) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Valor Pago:</label>
                  <span className="text-lg font-bold text-green-600">
                    {(parseFloat(dadosModal.valor_pago) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              </div>

              {/* Seção de Despesas */}
              <div>
                <h4 className="text-lg font-bold text-[#000638] mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Despesas
                </h4>
                
                {dadosModal.ds_despesaitem ? (
                  <div className="p-4 bg-purple-50 border-l-4 border-purple-500 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </span>
                      <p className="text-gray-800 leading-relaxed font-medium">{dadosModal.ds_despesaitem}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-sm">Nenhuma despesa cadastrada</p>
                  </div>
                )}
              </div>



              {/* Lista de Observações */}
              <div className="mt-6">
                <h4 className="text-lg font-bold text-[#000638] mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Observações ({dadosModal.observacoes.length})
                </h4>
                
                {dadosModal.observacoes.length > 0 ? (
                  <div className="space-y-3">
                    {dadosModal.observacoes.map((observacao, index) => (
                      <div key={index} className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                        <div className="flex items-start gap-3">
                          <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
                            {index + 1}
                          </span>
                          <p className="text-gray-800 leading-relaxed">{observacao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-medium">Nenhuma observação encontrada</p>
                    <p className="text-sm">Este registro não possui observações cadastradas.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={fecharModal}
                className="bg-[#000638] text-white px-6 py-2 rounded-lg hover:bg-[#fe0000] transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

// Componente para agrupar despesas por categoria
const DespesasPorCategoria = ({ dados, totalContas, linhasSelecionadas, toggleLinhaSelecionada, filtroMensal, setFiltroMensal, dadosOriginais }) => {
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(new Set());

  // Função para classificar despesa por código
  const classificarDespesa = (cdDespesa) => {
    const codigo = parseInt(cdDespesa) || 0;
    
    if (codigo >= 1000 && codigo <= 1999) {
      return 'CUSTO DAS MERCADORIAS VENDIDAS';
    } else if (codigo >= 2000 && codigo <= 2999) {
      return 'DESPESAS OPERACIONAIS';
    } else if (codigo >= 3000 && codigo <= 3999) {
      return 'DESPESAS COM PESSOAL';
    } else if (codigo >= 4000 && codigo <= 4999) {
      return 'ALUGUÉIS E ARRENDAMENTOS';
    } else if (codigo >= 5000 && codigo <= 5999) {
      return 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES';
    } else if (codigo >= 6000 && codigo <= 6999) {
      return 'DESPESAS GERAIS';
    } else if (codigo >= 7000 && codigo <= 7999) {
      return 'DESPESAS FINANCEIRAS';
    } else if (codigo >= 8000 && codigo <= 8999) {
      return 'OUTRAS DESPESAS OPERACIONAIS';
    } else if (codigo >= 9000 && codigo <= 9999) {
      return 'DESPESAS C/ VENDAS';
    } else {
      return 'SEM CLASSIFICAÇÃO';
    }
  };

  // Agrupar dados por classificação de despesa, nome da despesa e fornecedor
  const dadosAgrupados = React.useMemo(() => {
    const categorias = {};
    
    dados.forEach((grupo, index) => {
      const cdDespesa = grupo.item.cd_despesaitem;
      const nomeDespesa = grupo.item.ds_despesaitem || 'SEM DESCRIÇÃO';
      const nomeFornecedor = grupo.item.nm_fornecedor || 'SEM FORNECEDOR';
      const categoria = classificarDespesa(cdDespesa);
      
      // Criar categoria principal se não existir
      if (!categorias[categoria]) {
        categorias[categoria] = {
          nome: categoria,
          despesas: {},
          total: 0,
          quantidade: 0,
          expandida: false
        };
      }
      
      // Criar sub-tópico da despesa se não existir
      if (!categorias[categoria].despesas[nomeDespesa]) {
        categorias[categoria].despesas[nomeDespesa] = {
          nome: nomeDespesa,
          fornecedores: {},
          total: 0,
          quantidade: 0,
          expandida: false
        };
      }
      
      // Criar sub-tópico do fornecedor se não existir
      if (!categorias[categoria].despesas[nomeDespesa].fornecedores[nomeFornecedor]) {
        categorias[categoria].despesas[nomeDespesa].fornecedores[nomeFornecedor] = {
          nome: nomeFornecedor,
          itens: [],
          total: 0,
          quantidade: 0,
          expandida: false
        };
      }
      
      // Adicionar item ao fornecedor específico
      categorias[categoria].despesas[nomeDespesa].fornecedores[nomeFornecedor].itens.push({ ...grupo, indiceOriginal: index });
      categorias[categoria].despesas[nomeDespesa].fornecedores[nomeFornecedor].total += parseFloat(grupo.item.vl_duplicata || 0);
      categorias[categoria].despesas[nomeDespesa].fornecedores[nomeFornecedor].quantidade += 1;
      
      // Atualizar totais da despesa
      categorias[categoria].despesas[nomeDespesa].total += parseFloat(grupo.item.vl_duplicata || 0);
      categorias[categoria].despesas[nomeDespesa].quantidade += 1;
      
      // Atualizar totais da categoria principal
      categorias[categoria].total += parseFloat(grupo.item.vl_duplicata || 0);
      categorias[categoria].quantidade += 1;
    });

    // Definir ordem específica das categorias
    const ordemCategorias = [
      'CUSTO DAS MERCADORIAS VENDIDAS',
      'DESPESAS OPERACIONAIS',
      'DESPESAS COM PESSOAL',
      'ALUGUÉIS E ARRENDAMENTOS',
      'IMPOSTOS, TAXAS E CONTRIBUIÇÕES',
      'DESPESAS GERAIS',
      'DESPESAS FINANCEIRAS',
      'OUTRAS DESPESAS OPERACIONAIS',
      'DESPESAS C/ VENDAS',
      'SEM CLASSIFICAÇÃO'
    ];

    // Converter para array e ordenar pela ordem definida
    return ordemCategorias
      .filter(categoria => categorias[categoria]) // Só incluir categorias que têm dados
      .map(categoria => {
        const cat = categorias[categoria];
        // Converter despesas em array e ordenar por valor (maior primeiro)
        cat.despesasArray = Object.values(cat.despesas)
          .map(despesa => {
            // Converter fornecedores em array e ordenar por valor (maior primeiro)
            despesa.fornecedoresArray = Object.values(despesa.fornecedores).sort((a, b) => b.total - a.total);
            return despesa;
          })
          .sort((a, b) => b.total - a.total);
        return cat;
      });
  }, [dados]);

  const toggleCategoria = (nomeCategoria) => {
    setCategoriasExpandidas(prev => {
      const novoSet = new Set(prev);
      if (novoSet.has(nomeCategoria)) {
        novoSet.delete(nomeCategoria);
      } else {
        novoSet.add(nomeCategoria);
      }
      return novoSet;
    });
  };

  const toggleDespesa = (nomeCategoria, nomeDespesa) => {
    const chave = `${nomeCategoria}|${nomeDespesa}`;
    setCategoriasExpandidas(prev => {
      const novoSet = new Set(prev);
      if (novoSet.has(chave)) {
        novoSet.delete(chave);
      } else {
        novoSet.add(chave);
      }
      return novoSet;
    });
  };

  const toggleFornecedor = (nomeCategoria, nomeDespesa, nomeFornecedor) => {
    const chave = `${nomeCategoria}|${nomeDespesa}|${nomeFornecedor}`;
    setCategoriasExpandidas(prev => {
      const novoSet = new Set(prev);
      if (novoSet.has(chave)) {
        novoSet.delete(chave);
      } else {
        novoSet.add(chave);
      }
      return novoSet;
    });
  };

  const formatarData = (data) => {
    if (!data) return '';
    if (data.includes('T')) {
      return new Date(data).toLocaleDateString('pt-BR');
    }
    return data;
  };

  // Calcular dados mensais para mostrar quantidades nos botões
  const calcularDadosMensais = () => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dadosMensais = {};
    
    // Calcular ANO ATUAL
    const anoAtual = new Date().getFullYear();
    dadosMensais['ANO'] = dadosOriginais.filter(item => {
      if (!item.dt_vencimento) return false;
      const ano = new Date(item.dt_vencimento).getFullYear();
      return ano === anoAtual;
    }).length;
    
    // Calcular cada mês
    meses.forEach((mes, index) => {
      const numeroMes = index + 1;
      dadosMensais[mes] = dadosOriginais.filter(item => {
        if (!item.dt_vencimento) return false;
        const data = new Date(item.dt_vencimento);
        return data.getMonth() + 1 === numeroMes;
      }).length;
    });
    
    return dadosMensais;
  };

  const dadosMensais = calcularDadosMensais();

  return (
    <div className="space-y-4">
      {/* Filtros Mensais */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={18} className="text-[#000638]" />
          <h3 className="font-bold text-sm text-[#000638]">Filtro por Período (Data Vencimento)</h3>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Botão ANO */}
          <button
            onClick={() => setFiltroMensal('ANO')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filtroMensal === 'ANO'
                ? 'bg-[#000638] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ANO
          </button>
          
          {/* Botões dos Meses */}
          {['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map((mes) => (
            <button
              key={mes}
              onClick={() => setFiltroMensal(mes)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filtroMensal === mes
                  ? 'bg-[#000638] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {mes}
            </button>
          ))}
        </div>
        
        {/* Informação do filtro ativo */}
        <div className="mt-3 text-xs text-gray-500">
          <span className="font-medium">Filtro ativo:</span> {filtroMensal} 
          <span className="ml-2">({dados.length} registro{dados.length !== 1 ? 's' : ''})</span>
        </div>
      </div>

      {/* Categorias de Despesas */}
      <div className="space-y-2">
        {dadosAgrupados.map((categoria) => {
          const isCategoriaExpanded = categoriasExpandidas.has(categoria.nome);
          
          return (
            <div key={categoria.nome} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Cabeçalho da categoria principal */}
              <div
                className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors px-3 py-2 flex items-center justify-between"
                onClick={() => toggleCategoria(categoria.nome)}
              >
                <div className="flex items-center space-x-2">
                  {isCategoriaExpanded ? (
                    <CaretDown size={16} className="text-gray-600" />
                  ) : (
                    <CaretRight size={16} className="text-gray-600" />
                  )}
                  <div>
                    <h3 className="font-medium text-sm text-gray-800">{categoria.nome}</h3>
                    <div className="flex items-center space-x-3 text-xs text-gray-600">
                      <span>{categoria.quantidade} conta(s)</span>
                      <span>{categoria.despesasArray.length} despesa(s)</span>
                      <span className="font-medium text-red-600">
                        {categoria.total.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-tópicos de despesas */}
              {isCategoriaExpanded && (
                <div className="bg-white border-t border-gray-100">
                  {categoria.despesasArray.map((despesa) => {
                    const chaveExpansao = `${categoria.nome}|${despesa.nome}`;
                    const isDespesaExpanded = categoriasExpandidas.has(chaveExpansao);
                    
                    return (
                      <div key={despesa.nome} className="border-b border-gray-100 last:border-b-0">
                        {/* Cabeçalho da despesa específica */}
                        <div
                          className="bg-gray-25 hover:bg-gray-50 cursor-pointer transition-colors px-6 py-2 flex items-center justify-between"
                          onClick={() => toggleDespesa(categoria.nome, despesa.nome)}
                        >
                          <div className="flex items-center space-x-2">
                            {isDespesaExpanded ? (
                              <CaretDown size={14} className="text-gray-500" />
                            ) : (
                              <CaretRight size={14} className="text-gray-500" />
                            )}
                            <div>
                              <h4 className="font-medium text-xs text-gray-700">{despesa.nome}</h4>
                              <div className="flex items-center space-x-3 text-xs text-gray-500">
                                <span>{despesa.quantidade} conta(s)</span>
                                <span>{despesa.fornecedoresArray.length} fornecedor(es)</span>
                                <span className="font-medium text-red-500">
                                  {despesa.total.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Sub-tópicos de fornecedores */}
                        {isDespesaExpanded && (
                          <div className="bg-white border-t border-gray-50">
                            {despesa.fornecedoresArray.map((fornecedor) => {
                              const chaveExpansaoFornecedor = `${categoria.nome}|${despesa.nome}|${fornecedor.nome}`;
                              const isFornecedorExpanded = categoriasExpandidas.has(chaveExpansaoFornecedor);
                              
                              return (
                                <div key={fornecedor.nome} className="border-b border-gray-50 last:border-b-0">
                                  {/* Cabeçalho do fornecedor */}
                                  <div
                                    className="bg-gray-25 hover:bg-gray-50 cursor-pointer transition-colors px-9 py-2 flex items-center justify-between"
                                    onClick={() => toggleFornecedor(categoria.nome, despesa.nome, fornecedor.nome)}
                                  >
                                    <div className="flex items-center space-x-2">
                                      {isFornecedorExpanded ? (
                                        <CaretDown size={12} className="text-gray-400" />
                                      ) : (
                                        <CaretRight size={12} className="text-gray-400" />
                                      )}
                                      <div>
                                        <h5 className="font-medium text-xs text-gray-600">{fornecedor.nome}</h5>
                                        <div className="flex items-center space-x-3 text-xs text-gray-400">
                                          <span>{fornecedor.quantidade} conta(s)</span>
                                          <span className="font-medium text-red-400">
                                            {fornecedor.total.toLocaleString('pt-BR', {
                                              style: 'currency',
                                              currency: 'BRL',
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Tabela de detalhes do fornecedor */}
                                  {isFornecedorExpanded && (
                                    <div className="bg-white">
                                      <div className="overflow-x-auto">
                                        <table className="contas-table w-full border-collapse">
                                          <thead>
                                            <tr className="bg-[#000638] text-white text-[10px]">
                                              <th className="px-2 py-1 text-center text-[10px]" style={{ width: '50px', minWidth: '50px', position: 'sticky', left: 0, zIndex: 10, background: '#000638' }}>
                                                Selecionar
                                              </th>
                                              <th className="px-2 py-1 text-center text-[10px]">Vencimento</th>
                                              <th className="px-2 py-1 text-center text-[10px]">Valor</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Fornecedor</th>
                                              <th className="px-3 py-1 text-center text-[10px]">NM Fornecedor</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Despesa</th>
                                              <th className="px-1 py-1 text-center text-[10px]">NM CUSTO</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Empresa</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Duplicata</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Portador</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Emissão</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Entrada</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Liquidação</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Situação</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Estágio</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Juros</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Acréscimo</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Desconto</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Pago</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Aceite</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Parcela</th>
                                              <th className="px-1 py-1 text-center text-[10px]">Observação</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {fornecedor.itens.map((grupo, index) => {
                                              const indiceReal = grupo.indiceOriginal;
                                              const isSelected = linhasSelecionadas.has(indiceReal);
                                              
                                              return (
                                                <tr
                                                  key={`${grupo.item.cd_empresa}-${grupo.item.nr_duplicata}-${index}`}
                                                  className={`text-[10px] border-b transition-colors ${
                                                    isSelected
                                                      ? 'bg-blue-100 hover:bg-blue-200'
                                                      : index % 2 === 0
                                                      ? 'bg-white hover:bg-gray-100'
                                                      : 'bg-gray-50 hover:bg-gray-100'
                                                  }`}
                                                >
                                                  <td className="px-2 py-1 text-center" style={{ width: '50px', minWidth: '50px', position: 'sticky', left: 0, zIndex: 10, background: isSelected ? '#dbeafe' : 'inherit' }}>
                                                    <input
                                                      type="checkbox"
                                                      checked={isSelected}
                                                      onChange={() => toggleLinhaSelecionada(indiceReal)}
                                                      className="rounded"
                                                    />
                                                  </td>
                                                  <td className="px-2 py-1 text-center">{formatarData(grupo.item.dt_vencimento)}</td>
                                                  <td className="px-2 py-1 text-right font-medium text-green-600">
                                                    {parseFloat(grupo.item.vl_duplicata || 0).toLocaleString('pt-BR', {
                                                      style: 'currency',
                                                      currency: 'BRL',
                                                    })}
                                                  </td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.cd_fornecedor || ''}</td>
                                                  <td className="px-3 py-1 text-left max-w-32 truncate" title={grupo.item.nm_fornecedor}>
                                                    {grupo.item.nm_fornecedor || ''}
                                                  </td>
                                                  <td className="px-1 py-1 text-left max-w-24 truncate" title={grupo.item.ds_despesaitem}>
                                                    {grupo.item.ds_despesaitem || ''}
                                                  </td>
                                                  <td className="px-1 py-1 text-left max-w-24 truncate" title={grupo.item.ds_ccusto}>
                                                    {grupo.item.ds_ccusto || ''}
                                                  </td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.cd_empresa || ''}</td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.nr_duplicata || ''}</td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.nr_portador || ''}</td>
                                                  <td className="px-1 py-1 text-center">{formatarData(grupo.item.dt_emissao)}</td>
                                                  <td className="px-1 py-1 text-center">{formatarData(grupo.item.dt_entrada)}</td>
                                                  <td className="px-1 py-1 text-center">{formatarData(grupo.item.dt_liq)}</td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.tp_situacao || ''}</td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.tp_estagio || ''}</td>
                                                  <td className="px-1 py-1 text-right">
                                                    {parseFloat(grupo.item.vl_juros || 0).toLocaleString('pt-BR', {
                                                      style: 'currency',
                                                      currency: 'BRL',
                                                    })}
                                                  </td>
                                                  <td className="px-1 py-1 text-right">
                                                    {parseFloat(grupo.item.vl_acrescimo || 0).toLocaleString('pt-BR', {
                                                      style: 'currency',
                                                      currency: 'BRL',
                                                    })}
                                                  </td>
                                                  <td className="px-1 py-1 text-right">
                                                    {parseFloat(grupo.item.vl_desconto || 0).toLocaleString('pt-BR', {
                                                      style: 'currency',
                                                      currency: 'BRL',
                                                    })}
                                                  </td>
                                                  <td className="px-1 py-1 text-right">
                                                    {parseFloat(grupo.item.vl_pago || 0).toLocaleString('pt-BR', {
                                                      style: 'currency',
                                                      currency: 'BRL',
                                                    })}
                                                  </td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.in_aceite || ''}</td>
                                                  <td className="px-1 py-1 text-center">{grupo.item.nr_parcela || ''}</td>
                                                  <td className="px-1 py-1 text-left max-w-32 truncate" title={grupo.item.ds_observacao}>
                                                    {grupo.item.ds_observacao || ''}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {dadosAgrupados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhuma despesa encontrada para os filtros selecionados
          </div>
        )}
      </div>
    </div>
  );
};

export default ContasAPagar; 