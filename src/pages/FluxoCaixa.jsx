import React, { useEffect, useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import FiltroFornecedor from '../components/FiltroFornecedor';
import FiltroCentroCusto from '../components/FiltroCentroCusto';
import FiltroDespesas from '../components/FiltroDespesas';
import useApiClient from '../hooks/useApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

import ModalDetalhesConta from '../components/ModalDetalhesConta';
import Modal from '../components/ui/Modal';
import { getCategoriaPorCodigo } from '../config/categoriasDespesas';

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

} from '@phosphor-icons/react';

const FluxoCaixa = () => {
  const apiClient = useApiClient();

  // Formata datas YYYY-MM-DD (ou ISO) como dd/mm/aaaa sem aplicar timezone
  const formatDatePt = (dateStr) => {
    if (!dateStr) return '';
    try {
      const raw = String(dateStr);
      const onlyDate = raw.slice(0, 10); // YYYY-MM-DD
      const [y, m, d] = onlyDate.split('-');
      if (!y || !m || !d) return '';
      return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
    } catch (e) {
      return '';
    }
  };

  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('Todos');
  const [situacao, setSituacao] = useState('NORMAIS');

  const [duplicata, setDuplicata] = useState('');
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());
  
  // Estados para filtros dropdown
  const [dadosFornecedor, setDadosFornecedor] = useState([]);
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState([]);
  const [dadosCentroCusto, setDadosCentroCusto] = useState([]);
  const [centrosCustoSelecionados, setCentrosCustoSelecionados] = useState([]);
  const [dadosDespesa, setDadosDespesa] = useState([]);
  const [despesasSelecionadas, setDespesasSelecionadas] = useState([]);
  
  // Empresas pré-selecionadas
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  
  // Estados para o modal de observações
  const [modalAberto, setModalAberto] = useState(false);
  const [dadosModal, setDadosModal] = useState(null);
  
  // Estados para o modal de detalhes da conta
  const [modalDetalhes, setModalDetalhes] = useState({ isOpen: false, conta: null });
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(30);
  
  // Estados para Recebimentos (FluxoCaixa-Recebimento)
  const [dadosReceb, setDadosReceb] = useState([]);
  const [loadingReceb, setLoadingReceb] = useState(false);
  const [dadosRecebCarregados, setDadosRecebCarregados] = useState(false);
  const [mostrarTabelaReceb, setMostrarTabelaReceb] = useState(false);
  const [sortRecebConfig, setSortRecebConfig] = useState({ key: 'nm_cliente', direction: 'asc' });
  
  // Estados para modais de detalhamento
  const [modalRecebimentoOpen, setModalRecebimentoOpen] = useState(false);
  const [modalDespesasOpen, setModalDespesasOpen] = useState(false);

  // Estados para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: 'dt_liq',
    direction: 'asc'
  });

  // Função para filtrar dados por situação
  const filtrarDadosPorSituacao = (dadosOriginais) => {
    if (!dadosOriginais || dadosOriginais.length === 0) return [];
    
    switch (situacao) {
              case 'NORMAIS':
          // Mostra apenas itens com tp_situacao = 'N' (Normais)
          return dadosOriginais.filter(item => item.tp_situacao === 'N');
        case 'CANCELADAS':
          // Mostra apenas itens com tp_situacao = 'C' (Canceladas)
          return dadosOriginais.filter(item => item.tp_situacao === 'C');
      case 'TODAS':
        // Mostra todos os itens
        return dadosOriginais;
      default:
        return dadosOriginais;
    }
  };

  // Dados filtrados por situação
  const dadosFiltrados = filtrarDadosPorSituacao(dados);

  // Função para lidar com seleção de fornecedores
  const handleSelectFornecedores = (fornecedores) => {
    setFornecedoresSelecionados([...fornecedores]); // Garantir que é um novo array
  };

  // Função para lidar com seleção de centros de custo
  const handleSelectCentrosCusto = (centrosCusto) => {
    setCentrosCustoSelecionados([...centrosCusto]); // Garantir que é um novo array
  };

  // Função para lidar com seleção de despesas
  const handleSelectDespesas = (despesas) => {
    setDespesasSelecionadas([...despesas]); // Garantir que é um novo array
  };

  // Função para filtrar dados por status
  const filtrarDadosPorStatus = (dadosOriginais) => {
    if (!dadosOriginais || dadosOriginais.length === 0) return [];
    
    switch (status) {
      case 'Todos':
        // Mostra todos os itens
        return dadosOriginais;
      case 'Pago':
        // Mostra apenas itens pagos
        return dadosOriginais.filter(item => item.dt_liq || item.tp_situacao === '1' || item.tp_situacao === 'P');
      case 'Vencido':
        // Mostra apenas itens vencidos (data de vencimento menor que hoje)
        return dadosOriginais.filter(item => {
          if (item.dt_vencimento) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataVencimento = new Date(item.dt_vencimento);
            dataVencimento.setHours(0, 0, 0, 0);
            if (dataVencimento < hoje) return true;
          }
          if (item.tp_situacao === '2' || item.tp_situacao === 'V') return true;
          return false;
        });
      case 'A Vencer':
        // Mostra apenas itens a vencer (data de vencimento maior ou igual a hoje)
        return dadosOriginais.filter(item => {
          if (item.dt_vencimento) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataVencimento = new Date(item.dt_vencimento);
            dataVencimento.setHours(0, 0, 0, 0);
            if (dataVencimento >= hoje) return true;
          }
          if (item.tp_situacao === '3' || item.tp_situacao === 'A') return true;
          return false;
        });
      default:
        return dadosOriginais;
    }
  };

  // Dados filtrados por situação E status
  const dadosFiltradosCompletos = filtrarDadosPorStatus(dadosFiltrados);



  // Estado para controlar exibição da tabela de despesas
  const [mostrarTabela, setMostrarTabela] = useState(false);



  // Estados para filtro mensal
  const [filtroMensal, setFiltroMensal] = useState('ANO'); // 'ANO', 'JAN', 'FEV', etc.

  // Injetar CSS customizado para a tabela
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
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
      
      .contas-table tbody tr:hover {
        background-color: #f8fafc !important;
      }
      
      .contas-table tbody tr:nth-child(even) {
        background-color: #f8f9fa;
      }
      
      .contas-table tbody tr:nth-child(odd) {
        background-color: #ffffff;
      }
      
      .contas-table thead th:first-child {
        position: sticky;
        left: 0;
        z-index: 10;
        min-width: 50px !important;
        width: 50px !important;
        background: #000638 !important;
      }
      
      .contas-table tbody td:first-child {
        position: sticky;
        left: 0;
        z-index: 9;
        min-width: 50px !important;
        width: 50px !important;
      }
      
      .table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      
      .table-container table {
        position: relative;
      }
    `;
    
    document.head.appendChild(styleElement);
    
    return () => {
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, []);

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

  // Funções para modal de detalhes da conta
  const abrirModalDetalhes = (conta) => {
    setModalDetalhes({ isOpen: true, conta });
  };

  const fecharModalDetalhes = () => {
    setModalDetalhes({ isOpen: false, conta: null });
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
    setPaginaAtual(1); // Reset para primeira página ao buscar novos dados
    try {
      console.log('🔍 Iniciando busca de fluxo de caixa...');
      console.log('📅 Período (Data Liquidação):', { inicio, fim });
      console.log('🏢 Empresas selecionadas:', empresasSelecionadas);
      
      // Buscar dados usando a nova rota refatorada
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
      
      const result = await apiClient.financial.fluxoCaixa(params);
      
      let todosOsDados = [];
      
      if (result.success) {
        // Nova estrutura de resposta do backend refatorado
        // Aceitar tanto array direto (result.data) quanto objeto aninhado (result.data.data)
        const rawData = result.data;
        const dadosArray = Array.isArray(rawData)
          ? rawData
          : (rawData && Array.isArray(rawData.data))
            ? rawData.data
            : [];
        const responseData = Array.isArray(rawData) ? {} : (rawData || {});
        
        console.log('✅ Dados obtidos com nova rota refatorada:', {
          total: dadosArray.length,
          amostra: dadosArray.slice(0, 2),
          empresas: responseData.empresas,
          totais: responseData.totals,
          periodo: responseData.periodo,
          performance: responseData.performance,
          queryType: responseData.queryType
        });
        
        // Armazenar informações adicionais do backend
        if (responseData.totals) {
          console.log('💰 Totais do período:', responseData.totals);
        }
        
        if (responseData.performance) {
          console.log('⚡ Performance da query:', responseData.performance);
        }
        
        todosOsDados = dadosArray;
      } else {
        console.error('❌ Falha ao buscar dados:', result.message);
        setDados([]);
        setDadosCarregados(false);
        return;
      }
      
      console.log('📊 Resultado final:', {
        totalRegistros: todosOsDados.length,
        empresas: codigosEmpresas.length,
        primeirosRegistros: todosOsDados.slice(0, 3)
      });
      
      // Carregar dados de fornecedor, centro de custo e despesas
      const [dadosFornecedor, dadosCentroCusto, dadosDespesa] = await Promise.all([
        carregarDadosFornecedor(todosOsDados),
        carregarDadosCentroCusto(todosOsDados),
        carregarDadosDespesas(todosOsDados)
      ]);
      
      // Criar mapas para buscar rapidamente por código (normalizando como string)
      const fornecedorMap = new Map(
        (dadosFornecedor || []).map((f) => [String(f.cd_fornecedor), f])
      );
      const centroCustoMap = new Map(
        (dadosCentroCusto || []).map((c) => [String(c.cd_ccusto), c])
      );
      const despesaMap = new Map(
        (dadosDespesa || []).map((d) => [String(d.cd_despesaitem), d])
      );

      console.log('🗺️ Map sizes:', {
        fornecedores: fornecedorMap.size,
        centrosCusto: centroCustoMap.size,
        despesas: despesaMap.size,
        amostraFornecedor: Array.from(fornecedorMap.entries()).slice(0, 2),
        amostraCentroCusto: Array.from(centroCustoMap.entries()).slice(0, 2),
        amostraDespesa: Array.from(despesaMap.entries()).slice(0, 2)
      });

      // Mapear os dados de fornecedor, centro de custo e despesas aos dados principais
      const dadosCompletos = todosOsDados.map(item => {
        const chaveFornecedor = String(item.cd_fornecedor ?? '');
        const chaveCentroCusto = String(item.cd_ccusto ?? '');
        const chaveDespesa = String(item.cd_despesaitem ?? '');

        const fornecedor = fornecedorMap.get(chaveFornecedor);
        const centroCusto = centroCustoMap.get(chaveCentroCusto);
        const despesa = despesaMap.get(chaveDespesa);

        const resultado = {
          ...item,
          nm_fornecedor: fornecedor?.nm_fornecedor || item.nm_fornecedor || '',
          ds_ccusto: centroCusto?.ds_ccusto || item.ds_ccusto || '',
          ds_despesaitem: despesa?.ds_despesaitem || item.ds_despesaitem || ''
        };
        return resultado;
      });

      console.log('🧪 Amostra mapeada:', dadosCompletos.slice(0, 3).map(x => ({
        cd_fornecedor: x.cd_fornecedor,
        nm_fornecedor: x.nm_fornecedor,
        cd_ccusto: x.cd_ccusto,
        ds_ccusto: x.ds_ccusto,
        cd_despesaitem: x.cd_despesaitem,
        ds_despesaitem: x.ds_despesaitem
      })));
      
      console.log('✅ Dados mapeados com sucesso:', {
        total: dadosCompletos.length,
        fornecedores_encontrados: dadosFornecedor.length,
        centros_custo_encontrados: dadosCentroCusto.length,
        despesas_encontradas: dadosDespesa.length
      });
      
      setDados(dadosCompletos);
      setDadosCarregados(true);
    } catch (err) {
      console.error('❌ Erro geral ao buscar dados:', err);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar dados de fornecedor
  const carregarDadosFornecedor = async (dadosPrincipais) => {
    try {
      console.log('🔍 Carregando dados de fornecedor...');
      
      // Extrair códigos únicos de fornecedor dos dados principais
      const codigosFornecedor = [...new Set(dadosPrincipais.map(item => item.cd_fornecedor).filter(Boolean))];
      
      console.log('🔍 Códigos de fornecedor extraídos:', {
        total: codigosFornecedor.length,
        amostra: codigosFornecedor.slice(0, 5)
      });
      
      if (codigosFornecedor.length === 0) {
        console.log('⚠️ Nenhum código de fornecedor encontrado, retornando array vazio');
        setDadosFornecedor([]);
        return [];
      }
      
      const resultFornecedor = await apiClient.financial.fornecedor({ cd_fornecedor: codigosFornecedor });
      
      let dadosFornecedorArray = [];
      
      if (resultFornecedor.success) {
        // Aceitar array direto ou estrutura aninhada
        const rawData = resultFornecedor.data;
        dadosFornecedorArray = Array.isArray(rawData)
          ? rawData
          : (rawData && Array.isArray(rawData.data))
            ? rawData.data
            : [];
        const responseData = Array.isArray(rawData) ? {} : (rawData || {});
        console.log('✅ Dados de fornecedor carregados:', {
          total: dadosFornecedorArray.length,
          amostra: dadosFornecedorArray.slice(0, 2),
          fornecedores_buscados: responseData.fornecedores_buscados,
          fornecedores_encontrados: responseData.fornecedores_encontrados
        });
        
        setDadosFornecedor(dadosFornecedorArray);
        return dadosFornecedorArray;
      } else {
        console.warn('⚠️ Falha ao carregar dados de fornecedor:', resultFornecedor.message);
        setDadosFornecedor([]);
        return [];
      }
    } catch (err) {
      console.error('❌ Erro ao carregar dados de fornecedor:', err);
      setDadosFornecedor([]);
      return [];
    }
  };

  // Função para carregar dados de centro de custo
  const carregarDadosCentroCusto = async (dadosPrincipais) => {
    try {
      console.log('🔍 Carregando dados de centro de custo...');
      
      // Extrair códigos únicos de centro de custo dos dados principais
      const codigosCentroCusto = [...new Set(dadosPrincipais.map(item => item.cd_ccusto).filter(Boolean))];
      
      console.log('🔍 Códigos de centro de custo extraídos:', {
        total: codigosCentroCusto.length,
        amostra: codigosCentroCusto.slice(0, 5)
      });
      
      if (codigosCentroCusto.length === 0) {
        console.log('⚠️ Nenhum código de centro de custo encontrado, retornando array vazio');
        setDadosCentroCusto([]);
        return [];
      }
      
      const resultCentroCusto = await apiClient.financial.centrocusto({ cd_ccusto: codigosCentroCusto });
      
      let dadosCentroCustoArray = [];
      
      if (resultCentroCusto.success) {
        // Aceitar array direto ou estrutura aninhada
        const rawData = resultCentroCusto.data;
        dadosCentroCustoArray = Array.isArray(rawData)
          ? rawData
          : (rawData && Array.isArray(rawData.data))
            ? rawData.data
            : [];

        const responseData = Array.isArray(rawData) ? {} : (rawData || {});
        console.log('✅ Dados de centro de custo carregados:', {
          total: dadosCentroCustoArray.length,
          amostra: dadosCentroCustoArray.slice(0, 2),
          centros_custo_buscados: responseData.centros_custo_buscados,
          centros_custo_encontrados: responseData.centros_custo_encontrados
        });
        
        setDadosCentroCusto(dadosCentroCustoArray);
        return dadosCentroCustoArray;
            } else {
        console.warn('⚠️ Falha ao carregar dados de centro de custo:', resultCentroCusto.message);
        setDadosCentroCusto([]);
              return [];
            }
          } catch (err) {
      console.error('❌ Erro ao carregar dados de centro de custo:', err);
      setDadosCentroCusto([]);
            return [];
          }
  };

  // Função para carregar dados de despesas
  const carregarDadosDespesas = async (dadosPrincipais) => {
    try {
      console.log('🔍 Carregando dados de despesas...');
      
      // Extrair códigos únicos de despesa dos dados principais
      const codigosDespesa = [...new Set(dadosPrincipais.map(item => item.cd_despesaitem).filter(Boolean))];
      
      console.log('🔍 Códigos de despesa extraídos:', {
        total: codigosDespesa.length,
        amostra: codigosDespesa.slice(0, 5)
      });
      
      if (codigosDespesa.length === 0) {
        console.log('⚠️ Nenhum código de despesa encontrado, retornando array vazio');
        setDadosDespesa([]);
        return [];
      }
      
      // Compatibilidade: tentar /despesa e, se disponível, fallback para /despesas
      let resultDespesas = await apiClient.financial.despesa({ cd_despesaitem: codigosDespesa });
      if (!resultDespesas?.success && apiClient.financial.despesas) {
        try {
          resultDespesas = await apiClient.financial.despesas({ cd_despesaitem: codigosDespesa });
        } catch (e) {
          // manter o primeiro resultado
        }
      }
      
      let dadosDespesasArray = [];
      
      if (resultDespesas.success) {
        // Aceitar array direto ou estrutura aninhada
        const rawData = resultDespesas.data;
        dadosDespesasArray = Array.isArray(rawData)
          ? rawData
          : (rawData && Array.isArray(rawData.data))
            ? rawData.data
            : [];

        const responseData = Array.isArray(rawData) ? {} : (rawData || {});
        console.log('✅ Dados de despesas carregados:', {
          total: dadosDespesasArray.length,
          amostra: dadosDespesasArray.slice(0, 2),
          despesas_buscadas: responseData.despesas_buscadas,
          despesas_encontradas: responseData.despesas_encontradas
        });
        
        setDadosDespesa(dadosDespesasArray);
        return dadosDespesasArray;
      } else {
        console.warn('⚠️ Falha ao carregar dados de despesas:', resultDespesas.message);
        setDadosDespesa([]);
        return [];
      }
    } catch (err) {
      console.error('❌ Erro ao carregar dados de despesas:', err);
      setDadosDespesa([]);
      return [];
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
      hoje.setHours(0, 0, 0, 0);
      const vencimento = new Date(item.dt_vencimento);
      vencimento.setHours(0, 0, 0, 0);
      
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

  // Executar preparação dos dados quando dados, situação ou status mudarem
  useEffect(() => {
    // Recalcular dados filtrados quando situação ou status mudarem
    const dadosRecalculados = filtrarDadosPorStatus(filtrarDadosPorSituacao(dados));
    // Aqui você pode adicionar lógica adicional se necessário
  }, [dados, situacao, status]);

  // Função para lidar com seleção de empresas
  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas([...empresas]); // Garantir que é um novo array
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
    buscarRecebimentos();
  };

  // Buscar dados de Recebimento (por liquidação) usando rota fluxocaixa-recebimento
  const buscarRecebimentos = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) return;
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }
    try {
      setLoadingReceb(true);
      
      // Buscar dados de TODAS as empresas selecionadas
      const todasEmpresas = empresasSelecionadas.filter(e => e.cd_empresa);
      if (todasEmpresas.length === 0) {
        alert('Empresas selecionadas inválidas.');
        setLoadingReceb(false);
        return;
      }
      
      // Fazer requisições para todas as empresas em paralelo
      const promises = todasEmpresas.map(async (empresa) => {
        const params = new URLSearchParams();
        params.append('dt_inicio', inicio);
        params.append('dt_fim', fim);
        params.append('cd_empresa', empresa.cd_empresa);
        
      const url = `https://apigestaocrosby-bw2v.onrender.com/api/financial/fluxocaixa-recebimento?${params.toString()}`;
      const res = await fetch(url);
        
      if (!res.ok) {
          console.warn(`⚠️ Erro HTTP em fluxocaixa-recebimento para empresa ${empresa.cd_empresa}:`, res.status, res.statusText);
          return [];
        }
        
      const body = await res.json();
      // Aceitar tanto array direto quanto estrutura aninhada { data: { data: [...] } }
      let lista = [];
      if (Array.isArray(body)) lista = body;
      else if (Array.isArray(body?.data)) lista = body.data;
      else if (Array.isArray(body?.data?.data)) lista = body.data.data;
      else if (Array.isArray(body?.result)) lista = body.result;
        
        return lista || [];
      });
      
      // Aguardar todas as requisições e combinar os resultados
      const resultados = await Promise.all(promises);
      const todosRecebimentos = resultados.flat();
      
      console.log(`📊 Recebimentos carregados: ${todosRecebimentos.length} registros de ${todasEmpresas.length} empresa(s)`);
      
      setDadosReceb(todosRecebimentos);
      setDadosRecebCarregados(true);
    } catch (err) {
      console.error('❌ Erro ao buscar fluxocaixa-recebimento:', err);
      setDadosReceb([]);
      setDadosRecebCarregados(false);
    } finally {
      setLoadingReceb(false);
    }
  };

  // Função para aplicar filtro mensal
  const aplicarFiltroMensal = (dados, filtro) => {
    // Determinar o ano baseado nas datas de liquidação selecionadas
    let anoFiltro = null;
    
    if (dataInicio && dataFim) {
      // Usar o ano da data de início como referência
      const dataInicioObj = new Date(dataInicio);
      anoFiltro = dataInicioObj.getFullYear();
    } else {
      // Fallback para ano atual se não houver datas selecionadas
      anoFiltro = new Date().getFullYear();
    }
    
    console.log('🔍 Filtro Mensal:', {
      filtro,
      anoFiltro,
      dataInicio,
      dataFim,
      totalDados: dados.length
    });
    
    // Log adicional para debug dos dados
    if (dados.length > 0) {
      const anosPresentes = [...new Set(dados.map(item => {
        if (item.dt_liq) {
          return new Date(item.dt_liq).getFullYear();
        }
        return null;
      }).filter(ano => ano !== null))];
      
      console.log('📊 Anos presentes nos dados:', anosPresentes.sort());
      
      // Log adicional para verificar dados de 2025 especificamente
      const dados2025 = dados.filter(item => {
        if (item.dt_liq) {
          return new Date(item.dt_liq).getFullYear() === 2025;
        }
        return false;
      });
      
      console.log('🔍 Dados de 2025 encontrados:', dados2025.length);
      if (dados2025.length > 0) {
        console.log('📋 Amostra de dados 2025:', dados2025.slice(0, 2));
      }
    }
    
    return dados.filter((item) => {
      // Usar dt_liq como base para o filtro mensal (data de liquidação)
      const dataLiquidacao = item.dt_liq;
      if (!dataLiquidacao) return false;

      // Quando filtro for ANO, não aplicar restrição por ano (pass-through)
      if (filtro === 'ANO') {
        return true;
      }

      const data = new Date(dataLiquidacao);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1

      // Filtros por mês específico (do ano selecionado)
      const mesesMap = {
        'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4,
        'MAI': 5, 'JUN': 6, 'JUL': 7, 'AGO': 8,
        'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12
      };

      const mesDoFiltro = mesesMap[filtro];
      if (mesDoFiltro) {
        // Verificar se é o mês correto E do ano correto
        return mes === mesDoFiltro && ano === anoFiltro;
      }

      return true;
    });
  };

  // Aplicar filtros adicionais aos dados já filtrados por situação e status
  const dadosComFiltrosAdicionais = dadosFiltradosCompletos.filter((item) => {
    
    // Filtro por fornecedor (dropdown)
    if (fornecedoresSelecionados.length > 0) {
      const cdFornecedor = item.cd_fornecedor || '';
      const isSelected = fornecedoresSelecionados.some(fornecedor => fornecedor.cd_fornecedor === cdFornecedor);
      
      if (!isSelected) {
        return false;
      }
    }

    // Filtro por despesa (dropdown)
    if (despesasSelecionadas.length > 0) {
      const cdDespesa = item.cd_despesaitem || '';
      const isSelected = despesasSelecionadas.some(despesa => despesa.cd_despesaitem === cdDespesa);
      
      if (!isSelected) {
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

    // Filtro por centro de custo (dropdown)
    if (centrosCustoSelecionados.length > 0) {
      const cdCentroCusto = item.cd_ccusto || '';
      const isSelected = centrosCustoSelecionados.some(centro => centro.cd_ccusto === cdCentroCusto);
      
      if (!isSelected) {
        return false;
      }
    }
    
    return true;
  });

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

  // Função para agrupar dados idênticos (igual à ContasAPagar)
  const agruparDadosIdenticos = (dados) => {
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

  // Aplicar filtro mensal aos dados filtrados
  const dadosComFiltroMensal = aplicarFiltroMensal(dadosComFiltrosAdicionais, filtroMensal);

  // Log para verificar dados de 2025 após filtro mensal
  if (dadosComFiltroMensal.length > 0) {
    const dados2025AposFiltro = dadosComFiltroMensal.filter(item => {
      if (item.dt_liq) {
        return new Date(item.dt_liq).getFullYear() === 2025;
      }
      return false;
    });
    
    console.log('🔍 Dados de 2025 após filtro mensal:', dados2025AposFiltro.length);
  }

  // Agrupar dados filtrados (incluindo filtro mensal)
  const dadosAgrupados = agruparDadosIdenticos(dadosComFiltroMensal);

  // Aplicar ordenação aos dados agrupados
  const dadosOrdenados = sortDadosAgrupados(dadosAgrupados);

  // Logs de debug para monitorar dados
  console.log('🔍 Debug FluxoCaixa:', {
    dadosOriginais: dados.length,
    dadosFiltrados: dadosFiltradosCompletos.length,
    dadosComFiltroMensal: dadosComFiltroMensal.length,
    dadosAgrupados: dadosAgrupados.length,
    dadosOrdenados: dadosOrdenados.length,
            filtrosAtivos: { status, situacao, duplicata, filtroMensal },
    amostraDados: dados.slice(0, 2)
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

  // Total de Contas a Receber (soma dos valores pagos do detalhamento de contas a receber)
  const totalRecebimento = (dadosReceb || []).reduce((acc, item) => {
    const valor = parseFloat(item?.vl_pago) || 0;
    return acc + valor;
  }, 0);

  // Lista ordenada de recebimentos para o modal
  const dadosRecebOrdenados = React.useMemo(() => {
    const lista = Array.isArray(dadosReceb) ? [...dadosReceb] : [];
    const { key, direction } = sortRecebConfig || {};
    const dir = direction === 'desc' ? -1 : 1;
    return lista.sort((a, b) => {
      let va = a?.[key];
      let vb = b?.[key];
      // Normalizar strings para A-Z
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      // Converter datas para Date se a chave for data
      const isDateKey = ['dt_emissao','dt_vencimento','dt_liq'].includes(key);
      if (isDateKey) {
        const norm = (s) => {
          if (!s) return 0;
          const str = String(s).slice(0,10); // YYYY-MM-DD
          const ymd = str.replaceAll('-', '');
          return parseInt(ymd, 10) || 0; // compara como inteiro yyyymmdd
        };
        va = norm(va);
        vb = norm(vb);
      }
      // Converter números
      const isNumberKey = ['vl_fatura','vl_pago','cd_cliente','cd_empresa','nr_parcela'].includes(key);
      if (isNumberKey) {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [dadosReceb, sortRecebConfig]);

  // Saldo: Contas a Receber - Contas a Pagar
  const totalLiquidez = (totalRecebimento || 0) - (totalValor || 0);

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

  return (
    <div className="w-full w-8xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Fluxo de Caixa</h1>
        
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
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Data Liquidação Início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Data Liquidação Fim
                </label>
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
                <FiltroFornecedor
                  fornecedoresSelecionados={fornecedoresSelecionados}
                  onSelectFornecedores={handleSelectFornecedores}
                  dadosFornecedor={dadosFornecedor}
                />
              </div>
              <div>
                <FiltroDespesas
                  despesasSelecionadas={despesasSelecionadas}
                  onSelectDespesas={handleSelectDespesas}
                  dadosDespesa={dadosDespesa}
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
                <FiltroCentroCusto
                  centrosCustoSelecionados={centrosCustoSelecionados}
                  onSelectCentrosCusto={handleSelectCentrosCusto}
                  dadosCentroCusto={dadosCentroCusto}
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
          {/* Card Saldo */}
          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white"
          >
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className={'text-blue-600'} />
                <CardTitle className={"text-sm font-bold text-blue-700"}>Saldo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className={'text-blue-600 text-2xl font-extrabold mb-1 break-words'}>
                { (totalLiquidez || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
              </div>
              <CardDescription className="text-xs text-gray-500">Contas a Receber - Contas a Pagar</CardDescription>
            </CardContent>
          </Card>

          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer"
            onClick={() => setModalRecebimentoOpen(true)}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Contas a Receber</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-600 mb-1 break-words">
                {loadingReceb ? (
                  <Spinner size={24} className="animate-spin text-green-600" />
                ) : (
                  totalRecebimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">Soma dos valores de contas a receber</CardDescription>
            </CardContent>
          </Card>

          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer"
            onClick={() => setModalDespesasOpen(true)}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">Contas a Pagar</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-600 mb-1 break-words">
                {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : totalValor.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">Valor total das contas a pagar</CardDescription>
            </CardContent>
          </Card>
              </div>








        {/* Modal de Detalhes da Conta */}
        <ModalDetalhesConta
          conta={modalDetalhes.conta}
          isOpen={modalDetalhes.isOpen}
          onClose={fecharModalDetalhes}
        />

        {/* Modal de Detalhamento de Contas a Receber */}
        <Modal
          isOpen={modalRecebimentoOpen}
          onClose={() => setModalRecebimentoOpen(false)}
          title="Detalhamento de Contas a Receber"
          size="full"
        >
            <div className="p-6">
              {loadingReceb ? (
                <div className="flex justify-center items-center py-20">
                  <div className="flex items-center gap-3">
                    <Spinner size={32} className="animate-spin text-blue-600" />
                    <span className="text-gray-600">Carregando contas a receber...</span>
      </div>
          </div>
              ) : !dadosRecebCarregados ? (
                <div className="flex justify-center items-center py-20">
                  <div className="text-center">
                    <div className="text-gray-500 text-lg mb-2">Clique em "Buscar Dados" para carregar as contas a receber</div>
              </div>
            </div>
              ) : dadosReceb.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                  <div className="text-center">
                    <div className="text-gray-500 text-lg mb-2">Nenhuma conta a receber encontrada</div>
              </div>
            </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="contas-table w-full border-collapse">
                    <thead>
                      <tr className="bg-[#000638] text-white text-[10px]">
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'cd_cliente', direction: prev.key==='cd_cliente' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Cliente</th>
                      <th className="px-2 py-1 text-left cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'nm_cliente', direction: prev.key==='nm_cliente' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Nome Cliente</th>
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'dt_emissao', direction: prev.key==='dt_emissao' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Emissão</th>
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'dt_vencimento', direction: prev.key==='dt_vencimento' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Vencimento</th>
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'dt_liq', direction: prev.key==='dt_liq' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Liquidação</th>
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'vl_fatura', direction: prev.key==='vl_fatura' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Valor Fatura</th>
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'vl_pago', direction: prev.key==='vl_pago' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Valor Pago</th>
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'cd_empresa', direction: prev.key==='cd_empresa' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Empresa</th>
                      <th className="px-2 py-1 text-center cursor-pointer" onClick={() => setSortRecebConfig(prev => ({ key: 'nr_parcela', direction: prev.key==='nr_parcela' && prev.direction==='asc' ? 'desc' : 'asc' }))}>Parcela</th>
                      </tr>
                    </thead>
                    <tbody>
                    {dadosRecebOrdenados.map((it, idx) => (
                        <tr key={idx} className="text-[10px] border-b">
                          <td className="px-2 py-1 text-center">{it.cd_cliente || ''}</td>
                          <td className="px-2 py-1 text-left">{it.nm_cliente || ''}</td>
                        <td className="px-2 py-1 text-center">{formatDatePt(it.dt_emissao)}</td>
                        <td className="px-2 py-1 text-center">{formatDatePt(it.dt_vencimento)}</td>
                        <td className="px-2 py-1 text-center">{formatDatePt(it.dt_liq)}</td>
                          <td className="px-2 py-1 text-right font-medium text-green-600">{(parseFloat(it.vl_fatura) || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                          <td className="px-2 py-1 text-right font-medium text-blue-600">{(parseFloat(it.vl_pago) || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                          <td className="px-2 py-1 text-center">{it.cd_empresa || ''}</td>
                          <td className="px-2 py-1 text-center">{it.nr_parcela || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
          </div>
              )}
        </div>
        </Modal>

        {/* Modal de Detalhamento de Contas a Pagar */}
        <Modal
          isOpen={modalDespesasOpen}
          onClose={() => setModalDespesasOpen(false)}
          title="Detalhamento de Contas a Pagar"
          size="full"
        >
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="flex items-center gap-3">
                  <Spinner size={32} className="animate-spin text-blue-600" />
                  <span className="text-gray-600">Carregando contas a pagar...</span>
                </div>
              </div>
            ) : !dadosCarregados ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">Clique em "Buscar Dados" para carregar as contas a pagar</div>
                  <div className="text-gray-400 text-sm">Selecione o período e empresa desejados</div>
                </div>
              </div>
            ) : dados.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">Nenhuma conta a pagar encontrada</div>
                  <div className="text-gray-400 text-sm">Verifique o período selecionado ou tente novamente</div>
                </div>
              </div>
            ) : (
              <DespesasPorCategoria 
                dados={dadosOrdenados}
                totalContas={totalContas}
                linhasSelecionadas={linhasSelecionadas}
                toggleLinhaSelecionada={toggleLinhaSelecionada}
                filtroMensal={filtroMensal}
                setFiltroMensal={setFiltroMensal}
                dadosOriginais={dadosComFiltrosAdicionais}
                dataInicio={dataInicio}
                dataFim={dataFim}
                abrirModalDetalhes={abrirModalDetalhes}
              />
            )}
          </div>
        </Modal>
        </div>
  );
};



// Componente para agrupar contas a pagar por categoria
const DespesasPorCategoria = ({ dados, totalContas, linhasSelecionadas, toggleLinhaSelecionada, filtroMensal, setFiltroMensal, dadosOriginais, dataInicio, dataFim, abrirModalDetalhes }) => {
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(new Set());
  const [despesasExpandidas, setDespesasExpandidas] = useState(new Set());
  const [fornecedoresExpandidos, setFornecedoresExpandidos] = useState(new Set());
  const [todosExpandidos, setTodosExpandidos] = useState(false);

  // Função para classificar despesa por código
  const classificarDespesa = (cdDespesa) => {
    const codigo = parseInt(cdDespesa) || 0;
    
    // 1) exceções
    const categoriaExcecao = getCategoriaPorCodigo(codigo);
    if (categoriaExcecao) {
      return categoriaExcecao;
    }

    // 2) faixas
    if (codigo >= 1000 && codigo <= 1999) {
      return 'CUSTO DAS MERCADORIAS VENDIDAS';
    } else if (codigo >= 2000 && codigo <= 2999) {
      return 'DESPESAS OPERACIONAIS';
    } else if (codigo >= 3000 && codigo <= 3999) {
      return 'DESPESAS COM PESSOAL';
    } else if (codigo >= 4001 && codigo <= 4999) {
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
      const vlRateio = grupo.item.vl_rateio || 0;
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
      
      // Criar chave única para o fornecedor incluindo duplicata e rateio
      const chaveFornecedor = `${nomeFornecedor}|${grupo.item.nr_duplicata}|${vlRateio}`;
      
      // Criar sub-tópico do fornecedor se não existir
      if (!categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor]) {
        categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor] = {
          nome: nomeFornecedor,
          nrDuplicata: grupo.item.nr_duplicata,
          vlRateio: vlRateio,
          itens: [],
          total: 0,
          quantidade: 0,
          expandida: false
        };
      }
      
      // Adicionar item ao fornecedor específico
      categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor].itens.push({ ...grupo, indiceOriginal: index });
      
      // Usar o valor de rateio como total para este item específico
      categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor].total = parseFloat(vlRateio || 0);
      categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor].quantidade = 1;
      
      // Atualizar totais da despesa usando o rateio
      categorias[categoria].despesas[nomeDespesa].total += parseFloat(vlRateio || 0);
      categorias[categoria].despesas[nomeDespesa].quantidade += 1;
      
      // Atualizar totais da categoria principal usando o rateio
      categorias[categoria].total += parseFloat(vlRateio || 0);
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

  const toggleFornecedor = (nomeCategoria, nomeDespesa, nomeFornecedor, nrDuplicata, vlRateio) => {
    const chave = `${nomeCategoria}|${nomeDespesa}|${nomeFornecedor}|${nrDuplicata}|${vlRateio}`;
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

  const toggleTodosTopicos = () => {
    if (todosExpandidos) {
      // Colapsar todos
      setCategoriasExpandidas(new Set());
      setTodosExpandidos(false);
    } else {
      // Expandir todos
      const todasCategorias = new Set(dadosAgrupados.map(categoria => categoria.nome));
      setCategoriasExpandidas(todasCategorias);
      setTodosExpandidos(true);
    }
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
    
    // Determinar o ano baseado nas datas de liquidação selecionadas
    let anoFiltro = null;
    
    if (dataInicio && dataFim) {
      // Usar o ano da data de início como referência
      const dataInicioObj = new Date(dataInicio);
      anoFiltro = dataInicioObj.getFullYear();
    } else {
      // Fallback para ano atual se não houver datas selecionadas
      anoFiltro = new Date().getFullYear();
    }
    
    console.log('🔍 DespesasPorCategoria - calcularDadosMensais:', {
      anoFiltro,
      dataInicio,
      dataFim,
      totalDadosOriginais: dadosOriginais.length
    });
    
    // Log para verificar anos presentes nos dadosOriginais
    if (dadosOriginais.length > 0) {
      const anosPresentesOriginais = [...new Set(dadosOriginais.map(item => {
        if (item.dt_liq) {
          return new Date(item.dt_liq).getFullYear();
        }
        return null;
      }).filter(ano => ano !== null))];
      
      console.log('📊 Anos presentes nos dadosOriginais:', anosPresentesOriginais.sort());
    }
    
    // Calcular ANO (baseado nas datas selecionadas)
    dadosMensais['ANO'] = dadosOriginais.filter(item => {
      if (!item.dt_liq) return false;
      const ano = new Date(item.dt_liq).getFullYear();
      return ano === anoFiltro;
    }).length;
    
    // Calcular cada mês (do ano selecionado)
    meses.forEach((mes, index) => {
      const numeroMes = index + 1;
      dadosMensais[mes] = dadosOriginais.filter(item => {
        if (!item.dt_liq) return false;
        const data = new Date(item.dt_liq);
        return data.getMonth() + 1 === numeroMes && data.getFullYear() === anoFiltro;
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
          <h3 className="font-bold text-sm text-[#000638]">Filtro por Período (Data Liquidação)</h3>
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
          {dataInicio && dataFim && filtroMensal !== 'ANO' && (
            <span className="ml-1 text-blue-600">
              ({new Date(dataInicio).getFullYear()})
            </span>
          )}
          <span className="ml-2">({dados.length} registro{dados.length !== 1 ? 's' : ''})</span>
        </div>
      </div>

      {/* Categorias de Despesas */}
      <div className="space-y-2">
        {/* Botão discreto para expandir/colapsar todos */}
        {dadosAgrupados.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={toggleTodosTopicos}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
              title={todosExpandidos ? "Colapsar todos os tópicos" : "Expandir todos os tópicos"}
            >
              {todosExpandidos ? (
                <>
                  <span>−</span>
                  <span>Colapsar tudo</span>
                </>
              ) : (
                <>
                  <span>+</span>
                  <span>Expandir tudo</span>
                </>
              )}
            </button>
          </div>
        )}
        
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
                                                          const chaveExpansaoFornecedor = `${categoria.nome}|${despesa.nome}|${fornecedor.nome}|${fornecedor.nrDuplicata}|${fornecedor.vlRateio}`;
                            const isFornecedorExpanded = categoriasExpandidas.has(chaveExpansaoFornecedor);
                            
                            return (
                              <div key={`${fornecedor.nome}|${fornecedor.nrDuplicata}|${fornecedor.vlRateio}`} className="border-b border-gray-50 last:border-b-0">
                                {/* Cabeçalho do fornecedor */}
                                <div
                                  className="bg-gray-25 hover:bg-gray-50 cursor-pointer transition-colors px-9 py-2 flex items-center justify-between"
                                                                      onClick={() => toggleFornecedor(categoria.nome, despesa.nome, fornecedor.nome, fornecedor.nrDuplicata, fornecedor.vlRateio)}
                                >
                                  <div className="flex items-center space-x-2">
                                    {isFornecedorExpanded ? (
                                      <CaretDown size={12} className="text-gray-400" />
                                    ) : (
                                      <CaretRight size={12} className="text-gray-400" />
                                    )}
                                    <div>
                                      <h5 className="font-medium text-xs text-gray-600">
                                        {fornecedor.nome}
                                        <span className="ml-1 text-gray-400">
                                          (Dup: {fornecedor.nrDuplicata})
                                        </span>
                                        {fornecedor.vlRateio > 0 && (
                                          <span className="ml-1 text-gray-400">
                                            - Rateio: {parseFloat(fornecedor.vlRateio).toLocaleString('pt-BR', {
                                              style: 'currency',
                                              currency: 'BRL',
                                            })}
                                          </span>
                                        )}
                                      </h5>
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
                                            <th className="px-1 py-1 text-center text-[10px]">Rateio</th>
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
                                                className={`text-[10px] border-b transition-colors cursor-pointer ${
                                                  isSelected
                                                    ? 'bg-blue-100 hover:bg-blue-200'
                                                    : index % 2 === 0
                                                    ? 'bg-white hover:bg-gray-100'
                                                    : 'bg-gray-50 hover:bg-gray-100'
                                                }`}
                                                onClick={() => abrirModalDetalhes(grupo.item)}
                                                title="Clique para ver detalhes da conta"
                                              >
                                                <td className="px-2 py-1 text-center" style={{ width: '50px', minWidth: '50px', position: 'sticky', left: 0, zIndex: 10, background: isSelected ? '#dbeafe' : 'inherit' }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                      e.stopPropagation();
                                                      toggleLinhaSelecionada(indiceReal);
                                                    }}
                                                    className="rounded"
                                                    onClick={(e) => e.stopPropagation()}
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
                                                <td className="px-1 py-1 text-right">
                                                  {parseFloat(grupo.item.vl_rateio || 0).toLocaleString('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                  })}
                                                </td>
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

export default FluxoCaixa;