import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import ModalDetalhesConta from '../components/ModalDetalhesConta';
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
  TrendDown,
  FileArrowDown
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getCategoriaPorCodigo } from '../config/categoriasDespesas';

// Função para criar Date object sem problemas de fuso horário
const criarDataSemFusoHorario = (dataString) => {
  if (!dataString) return null;
  if (dataString.includes('T')) {
    // Para datas ISO, usar apenas a parte da data
    const dataPart = dataString.split('T')[0];
    const [ano, mes, dia] = dataPart.split('-');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  // Para datas já no formato DD/MM/YYYY
  if (dataString.includes('/')) {
    const [dia, mes, ano] = dataString.split('/');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  return new Date(dataString);
};

// Função para formatar data
const formatarData = (data) => {
  if (!data) return '';
  if (data.includes('T')) {
    // Para datas ISO, criar a data considerando apenas a parte da data (YYYY-MM-DD)
    const dataPart = data.split('T')[0];
    const [ano, mes, dia] = dataPart.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return data;
};

const ContasAPagar = () => {
  const apiClient = useApiClient();

  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [modalDetalhes, setModalDetalhes] = useState({ isOpen: false, conta: null });

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
  const [previsao, setPrevisao] = useState('TODOS');
  const [fornecedor, setFornecedor] = useState('');
  const [despesa, setDespesa] = useState('');
  const [duplicata, setDuplicata] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());
  


  // Estados para filtro mensal
  const [filtroMensal, setFiltroMensal] = useState('ANO');
  const [filtroDia, setFiltroDia] = useState(null);

  // Estados para modais dos cards
  const [modalCardAberto, setModalCardAberto] = useState(false);
  const [tipoCardSelecionado, setTipoCardSelecionado] = useState('');
  const [dadosCardModal, setDadosCardModal] = useState([]);





  // Função para lidar com mudança de filtro mensal
  const handleFiltroMensalChange = (novoFiltro) => {
    setFiltroMensal(novoFiltro);
    setFiltroDia(null); // Limpar filtro de dia quando mudar o mês
  };

  // Função para abrir modal do card
  const abrirModalCard = (tipo) => {
    console.log('🔍 Abrindo modal do card:', tipo);
    console.log('📊 Total de dados disponíveis:', dadosOrdenadosParaCards.length);
    
    let dadosFiltrados = [];
    
    switch (tipo) {
      case 'vencidas':
        dadosFiltrados = dadosOrdenadosParaCards.filter(grupo => {
          const status = getStatusFromData(grupo.item);
          return status === 'Vencido';
        }).map(grupo => grupo.item);
        break;
      case 'aVencer':
        dadosFiltrados = dadosOrdenadosParaCards.filter(grupo => {
          const status = getStatusFromData(grupo.item);
          return status === 'A Vencer';
        }).map(grupo => grupo.item);
        break;
      case 'proximasVencer':
        dadosFiltrados = dadosOrdenadosParaCards.filter(grupo => {
          const status = getStatusFromData(grupo.item);
          return status === 'Próxima a Vencer';
        }).map(grupo => grupo.item);
        break;
      case 'pagas':
        dadosFiltrados = dadosOrdenadosParaCards.filter(grupo => {
          const status = getStatusFromData(grupo.item);
          return status === 'Pago';
        }).map(grupo => grupo.item);
        break;
      case 'faltaPagar':
        dadosFiltrados = dadosOrdenadosParaCards.filter(grupo => {
          const status = getStatusFromData(grupo.item);
          return status !== 'Pago';
        }).map(grupo => grupo.item);
        break;
      case 'descontos':
        dadosFiltrados = dadosOrdenadosParaCards.filter(grupo => {
          return parseFloat(grupo.item.vl_desconto || 0) > 0;
        }).map(grupo => grupo.item);
        break;
      default:
        dadosFiltrados = [];
    }
    
    console.log('✅ Dados filtrados encontrados:', dadosFiltrados.length);
    console.log('📋 Amostra dos dados filtrados:', dadosFiltrados.slice(0, 2));
    
    setDadosCardModal(dadosFiltrados);
    setTipoCardSelecionado(tipo);
    setModalCardAberto(true);
  };

  // Função para fechar modal do card
  const fecharModalCard = () => {
    setModalCardAberto(false);
    setTipoCardSelecionado('');
    setDadosCardModal([]);
  };

  // Função para obter título do modal
  const getTituloModal = (tipo) => {
    switch (tipo) {
      case 'vencidas':
        return 'Contas Vencidas';
      case 'aVencer':
        return 'Contas a Vencer';
      case 'proximasVencer':
        return 'Próximas a Vencer';
      case 'pagas':
        return 'Contas Pagas';
      case 'faltaPagar':
        return 'Falta Pagar';
      case 'descontos':
        return 'Descontos Ganhos';
      default:
        return 'Detalhes';
    }
  };
  
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

  // Limpar seleção quando os dados mudarem
  useEffect(() => {
    setLinhasSelecionadas(new Set());
  }, [dados]);

  // Limpar seleção quando o filtro mensal mudar
  useEffect(() => {
    setLinhasSelecionadas(new Set());
  }, [filtroMensal]);

  // Limpar filtro de dia quando o filtro mensal mudar
  useEffect(() => {
    setFiltroDia(null);
  }, [filtroMensal]);

  // Empresas pré-selecionadas (serão carregadas do banco de dados)
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  
  // Estados para o modal de observações
  const [modalAberto, setModalAberto] = useState(false);
  const [dadosModal, setDadosModal] = useState(null);

  // Estados para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: 'dt_vencimento',
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

  // Função para filtrar dados por status
  const filtrarDadosPorStatus = (dadosOriginais) => {
    if (!dadosOriginais || dadosOriginais.length === 0) return [];
    
    switch (status) {
      case 'Todos':
        // Mostra todos os itens
        return dadosOriginais;
      case 'Pago':
        // Mostra apenas itens pagos
        return dadosOriginais.filter(item => parseFloat(item.vl_pago) > 0);
      case 'Vencido':
        // Mostra apenas itens vencidos
        return dadosOriginais.filter(item => {
          if (!item.dt_vencimento) return false;
          const dataVencimento = criarDataSemFusoHorario(item.dt_vencimento);
          const hoje = new Date();
          return dataVencimento < hoje;
        });
      case 'A Vencer':
        // Mostra apenas itens a vencer
        return dadosOriginais.filter(item => {
          if (!item.dt_vencimento) return true;
          const dataVencimento = criarDataSemFusoHorario(item.dt_vencimento);
          const hoje = new Date();
          return dataVencimento >= hoje;
        });
      default:
        return dadosOriginais;
    }
  };

  // Função para filtrar dados por previsão
  const filtrarDadosPorPrevisao = (dadosOriginais) => {
    if (!dadosOriginais || dadosOriginais.length === 0) return [];
    
    switch (previsao) {
      case 'TODOS':
        // Mostra todos os itens
        return dadosOriginais;
      case 'PREVISÃO':
        // Mostra apenas itens com tp_previsaoreal = 'P' (Previsão)
        return dadosOriginais.filter(item => item.tp_previsaoreal === '1');
      case 'REAL':
        // Mostra apenas itens com tp_previsaoreal = 'R' (Real)
        return dadosOriginais.filter(item => item.tp_previsaoreal === '2');
      case 'CONSIGNADO':
        // Mostra apenas itens com tp_previsaoreal = 'C' (Consignado)
        return dadosOriginais.filter(item => item.tp_previsaoreal === '3');
      default:
        return dadosOriginais;
    }
  };

  // Dados filtrados por situação, status E previsão
  const dadosFiltradosCompletos = filtrarDadosPorPrevisao(filtrarDadosPorStatus(dadosFiltrados));

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

  // Função para obter dias do mês
  const obterDiasDoMes = (mes) => {
    const meses = {
      'JAN': 31, 'FEV': 28, 'MAR': 31, 'ABR': 30, 'MAI': 31, 'JUN': 30,
      'JUL': 31, 'AGO': 31, 'SET': 30, 'OUT': 31, 'NOV': 30, 'DEZ': 31
    };
    return meses[mes] || 0;
  };

  // Função para aplicar filtro mensal e por dia
  const aplicarFiltroMensal = (dados, filtro, diaFiltro = null) => {
    return dados.filter((item) => {
      // Usar dt_vencimento como base para o filtro mensal (data de vencimento)
      const dataVencimento = item.dt_vencimento;
      if (!dataVencimento) return false;
      
      const data = criarDataSemFusoHorario(dataVencimento);
      if (!data) return false;
      
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1
      const dia = data.getDate();
      
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
        // Se há filtro por dia, verificar também o dia
        if (diaFiltro !== null) {
          return mes === mesDoFiltro && dia === diaFiltro;
        }
        return mes === mesDoFiltro;
      }
      
      return true;
    });
  };

  // Função para agrupar dados idênticos (igual ao FluxoCaixa)
  const agruparDadosIdenticos = (dados) => {
    const grupos = new Map();
    
    dados.forEach((item) => {
      // Criar chave única SEM vl_rateio para manter totais corretos
      // O vl_rateio será usado apenas para separação visual no componente
      const chave = `${item.cd_fornecedor}|${item.nm_fornecedor}|${item.nr_duplicata}|${item.nr_parcela}|${item.cd_empresa}|${item.dt_emissao}|${item.dt_vencimento}|${item.dt_entrada}|${item.dt_liq}|${item.tp_situacao}|${item.tp_previsaoreal}|${item.vl_duplicata}|${item.vl_juros}|${item.vl_acrescimo}|${item.vl_desconto}|${item.vl_pago}`;
      
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          item: item,
          observacoes: [],
          situacoes: [],
          datasEmissao: [],
          datasVencimento: [],
          datasEntrada: [],
          datasLiquidacao: [],
          rateios: [], // Array para armazenar diferentes rateios
          quantidade: 0
        });
      }
      
      const grupo = grupos.get(chave);
      grupo.quantidade += 1;
      
      // Adicionar rateio se não existir
      if (item.vl_rateio && !grupo.rateios.includes(item.vl_rateio)) {
        grupo.rateios.push(item.vl_rateio);
      }
      
      // Adicionar observação se existir e for diferente
      if (item.ds_observacao && !grupo.observacoes.includes(item.ds_observacao)) {
        grupo.observacoes.push(item.ds_observacao);
      }
      
      // Adicionar situação se existir e for diferente
      if (item.tp_situacao && !grupo.situacoes.includes(item.tp_situacao)) {
        grupo.situacoes.push(item.tp_situacao);
      }
      
      // Adicionar previsão se existir e for diferente
      if (item.tp_previsaoreal && !grupo.previsoes) {
        grupo.previsoes = [];
      }
      if (item.tp_previsaoreal && !grupo.previsoes.includes(item.tp_previsaoreal)) {
        grupo.previsoes.push(item.tp_previsaoreal);
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
      
      // Se há múltiplas previsões, priorizar REAL (R) sobre PREVISÃO (P) sobre CONSIGNADO (C)
      let previsaoFinal = grupo.item.tp_previsaoreal;
      
      if (grupo.previsoes && grupo.previsoes.length > 1) {
        // Prioridade: REAL > PREVISÃO > CONSIGNADO
        if (grupo.previsoes.includes('R')) {
          previsaoFinal = 'R';
        } else if (grupo.previsoes.includes('P')) {
          previsaoFinal = 'P';
        } else if (grupo.previsoes.includes('C')) {
          previsaoFinal = 'C';
        }
        // Se não há nenhum dos valores esperados, manter o primeiro
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
          tp_previsaoreal: previsaoFinal,
          dt_emissao: dtEmissaoFinal,
          dt_vencimento: dtVencimentoFinal,
          dt_entrada: dtEntradaFinal,
          dt_liq: dtLiquidacaoFinal
        }
      };
    });
  };

  // Função para ordenar os dados
  const sortDadosAgrupados = (dados) => {
    if (!dados || dados.length === 0) return dados;

    return [...dados].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'cd_empresa':
          aValue = a.cd_empresa || '';
          bValue = b.cd_empresa || '';
          break;
        case 'cd_fornecedor':
          aValue = a.cd_fornecedor || '';
          bValue = b.cd_fornecedor || '';
          break;
        case 'nm_fornecedor':
          aValue = a.nm_fornecedor || '';
          bValue = b.nm_fornecedor || '';
          break;
        case 'ds_despesaitem':
          aValue = a.ds_despesaitem || '';
          bValue = b.ds_despesaitem || '';
          break;
        case 'ds_ccusto':
          aValue = a.ds_ccusto || '';
          bValue = b.ds_ccusto || '';
          break;
        case 'nr_duplicata':
          aValue = a.nr_duplicata || '';
          bValue = b.nr_duplicata || '';
          break;
        case 'nr_portador':
          aValue = a.nr_portador || '';
          bValue = b.nr_portador || '';
          break;
        case 'dt_emissao':
          aValue = a.dt_emissao ? criarDataSemFusoHorario(a.dt_emissao) : new Date(0);
          bValue = b.dt_emissao ? criarDataSemFusoHorario(b.dt_emissao) : new Date(0);
          break;
        case 'dt_vencimento':
          aValue = a.dt_vencimento ? criarDataSemFusoHorario(a.dt_vencimento) : new Date(0);
          bValue = b.dt_vencimento ? criarDataSemFusoHorario(b.dt_vencimento) : new Date(0);
          break;
        case 'dt_entrada':
          aValue = a.dt_entrada ? criarDataSemFusoHorario(a.dt_entrada) : new Date(0);
          bValue = b.dt_entrada ? criarDataSemFusoHorario(b.dt_entrada) : new Date(0);
          break;
        case 'dt_liq':
          aValue = a.dt_liq ? criarDataSemFusoHorario(a.dt_liq) : new Date(0);
          bValue = b.dt_liq ? criarDataSemFusoHorario(b.dt_liq) : new Date(0);
          break;
        case 'tp_situacao':
          aValue = a.tp_situacao || '';
          bValue = b.tp_situacao || '';
          break;
        case 'tp_estagio':
          aValue = a.tp_estagio || '';
          bValue = b.tp_estagio || '';
          break;
        case 'tp_previsaoreal':
          aValue = a.tp_previsaoreal || '';
          bValue = b.tp_previsaoreal || '';
          break;
        case 'vl_duplicata':
          aValue = parseFloat(a.vl_duplicata) || 0;
          bValue = parseFloat(b.vl_duplicata) || 0;
          break;
        case 'vl_juros':
          aValue = parseFloat(a.vl_juros) || 0;
          bValue = parseFloat(b.vl_juros) || 0;
          break;
        case 'vl_acrescimo':
          aValue = parseFloat(a.vl_acrescimo) || 0;
          bValue = parseFloat(b.vl_acrescimo) || 0;
          break;
        case 'vl_desconto':
          aValue = parseFloat(a.vl_desconto) || 0;
          bValue = parseFloat(b.vl_desconto) || 0;
          break;
        case 'vl_pago':
          aValue = parseFloat(a.vl_pago) || 0;
          bValue = parseFloat(b.vl_pago) || 0;
          break;
        case 'in_aceite':
          aValue = a.in_aceite || '';
          bValue = b.in_aceite || '';
          break;
        case 'nr_parcela':
          aValue = parseInt(a.nr_parcela) || 0;
          bValue = parseInt(b.nr_parcela) || 0;
          break;
        default:
          aValue = a[sortConfig.key] || '';
          bValue = b[sortConfig.key] || '';
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
      
      console.log('🔍 Resultado da API:', {
        success: result.success,
        dataLength: result.data?.length,
        message: result.message,
        metadata: result.metadata
      });
      
      if (result.success) {
        const dadosArray = Array.isArray(result.data) ? result.data : [];
        
        // Verificar se todos os campos necessários estão presentes
        if (dadosArray.length > 0) {
          const primeiroItem = dadosArray[0];
          console.log('🔍 Campos disponíveis no primeiro item:', Object.keys(primeiroItem));
          
          // Verificar campos obrigatórios
          const camposObrigatorios = ['cd_empresa', 'cd_fornecedor', 'nr_duplicata', 'dt_vencimento', 'vl_duplicata'];
          const camposFaltando = camposObrigatorios.filter(campo => !(campo in primeiroItem));
          
          if (camposFaltando.length > 0) {
            console.warn('⚠️ Campos faltando na resposta da API:', camposFaltando);
          }
          
          // Verificar campos opcionais que podem estar faltando
          const camposOpcionais = ['in_aceite', 'vl_rateio'];
          const camposOpcionaisFaltando = camposOpcionais.filter(campo => !(campo in primeiroItem));
          
          if (camposOpcionaisFaltando.length > 0) {
            console.log('ℹ️ Campos opcionais não presentes:', camposOpcionaisFaltando);
          }
        }
        
        console.log('✅ Dados obtidos:', {
          total: dadosArray.length,
          amostra: dadosArray.slice(0, 2),
          empresas: codigosEmpresas,
          metadata: result.metadata,
          estrutura: result.metadata?.periodo ? 'Nova estrutura' : 'Estrutura antiga'
        });
        
        // Garantir que todos os campos necessários tenham valores padrão
        const dadosProcessados = dadosArray.map(item => ({
          ...item,
          ds_observacao: item.ds_observacao || '',
          in_aceite: item.in_aceite || '',
          vl_rateio: item.vl_rateio || 0,
          tp_aceite: item.in_aceite || '' // Mantém compatibilidade
        }));
        
        setDados(dadosProcessados);
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
      const vencimento = criarDataSemFusoHorario(item.dt_vencimento);
      const diasParaVencer = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
      
      if (vencimento < hoje) {
        return 'Vencido';
      } else if (diasParaVencer >= 0 && diasParaVencer <= 7) {
        return 'Próxima a Vencer';
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

  // Aplicar filtros adicionais aos dados já filtrados por situação e status
  const dadosComFiltrosAdicionais = dadosFiltradosCompletos.filter((item) => {
    
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
  const dadosComFiltroMensal = aplicarFiltroMensal(dadosComFiltrosAdicionais, filtroMensal, filtroDia);

  // Aplicar ordenação aos dados filtrados (cada registro já é um rateio específico)
  const dadosOrdenadosComFiltroMensal = sortDadosAgrupados(dadosComFiltroMensal);

  // ===== LÓGICA SEPARADA PARA OS CARDS (igual ao Fluxo de Caixa) =====
  // Agrupar dados APENAS para os cards (não afeta a tabela)
  const dadosAgrupadosParaCards = agruparDadosIdenticos(dadosComFiltroMensal);
  const dadosOrdenadosParaCards = sortDadosAgrupados(dadosAgrupadosParaCards);

  // Cálculos dos cards (baseados em dados agrupados - igual ao Fluxo de Caixa)
  const totalContasCards = dadosOrdenadosParaCards.length;
  const totalValorCards = dadosOrdenadosParaCards.reduce((acc, grupo) => acc + (parseFloat(grupo.item.vl_duplicata) || 0), 0);
  
  const contasVencidasCards = dadosOrdenadosParaCards.filter(grupo => {
    const status = getStatusFromData(grupo.item);
    return status.toLowerCase().includes('vencido');
  });
  
  const totalContasVencidasCards = contasVencidasCards.length;
  const valorContasVencidasCards = contasVencidasCards.reduce((acc, grupo) => 
    acc + (parseFloat(grupo.item.vl_duplicata) || 0), 0
  );
  
  const contasAVencerCards = dadosOrdenadosParaCards.filter(grupo => {
    const status = getStatusFromData(grupo.item);
    return status.toLowerCase().includes('vencer');
  });
  
  const totalContasAVencerCards = contasAVencerCards.length;
  const valorContasAVencerCards = contasAVencerCards.reduce((acc, grupo) => 
    acc + (parseFloat(grupo.item.vl_duplicata) || 0), 0
  );

  // Cálculo para contas próximas a vencer (próximos 7 dias)
  const hoje = new Date();
  const contasProximasVencerCards = dadosOrdenadosParaCards.filter(grupo => {
    if (!grupo.item.dt_vencimento) return false;
    const dataVencimento = criarDataSemFusoHorario(grupo.item.dt_vencimento);
    const diasParaVencer = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
    return diasParaVencer >= 0 && diasParaVencer <= 7 && !grupo.item.dt_liq;
  });
  
  const totalContasProximasVencerCards = contasProximasVencerCards.length;
  const valorContasProximasVencerCards = contasProximasVencerCards.reduce((acc, grupo) => 
    acc + (parseFloat(grupo.item.vl_duplicata) || 0), 0
  );

  // Cálculo para contas pagas
  const contasPagasCards = dadosOrdenadosParaCards.filter(grupo => {
    const status = getStatusFromData(grupo.item);
    return status.toLowerCase().includes('pago');
  });
  
  const totalContasPagasCards = contasPagasCards.length;
  const valorContasPagasCards = contasPagasCards.reduce((acc, grupo) => 
    acc + (parseFloat(grupo.item.vl_pago) || 0), 0
  );

  // Cálculo para valor que falta pagar
  const valorFaltaPagarCards = totalValorCards - valorContasPagasCards;

  // Cálculo para descontos ganhos
  const totalDescontosCards = dadosOrdenadosParaCards.reduce((acc, grupo) => 
    acc + (parseFloat(grupo.item.vl_desconto) || 0), 0
  );

  // Função para lidar com seleção de empresas
  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas([...empresas]); // Garantir que é um novo array
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

  // Função para fechar modal
  const fecharModal = () => {
    setModalAberto(false);
    setDadosModal(null);
  };

  // Funções para modal de detalhes da conta
  const abrirModalDetalhes = (conta) => {
    setModalDetalhes({ isOpen: true, conta });
  };

  const fecharModalDetalhes = () => {
    setModalDetalhes({ isOpen: false, conta: null });
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
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Data Início
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
                  Data Fim
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
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Previsão</label>
                <select
                  value={previsao}
                  onChange={(e) => setPrevisao(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="TODOS">TODOS</option>
                  <option value="PREVISÃO">PREVISÃO</option>
                  <option value="REAL">REAL</option>
                  <option value="CONSIGNADO">CONSIGNADO</option>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8 max-w-7xl mx-auto">
          {/* Total de Contas */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700">Total de Contas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-blue-600 mb-1">
                  {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : totalContasCards}
              </div>
              <CardDescription className="text-xs text-gray-500">Contas no período</CardDescription>
            </CardContent>
          </Card>

          {/* Valor Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Valor Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-green-600 mb-1 break-words">
                {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                                     totalValorCards.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                    })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Valor total das contas</CardDescription>
            </CardContent>
          </Card>

          {/* Contas Vencidas */}
          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => abrirModalCard('vencidas')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Warning size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">Contas Vencidas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                                     totalContasVencidasCards
                }
              </div>
              <div className="text-xs font-medium text-red-500">
                {loading ? '...' : 
                                     valorContasVencidasCards.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Contas em atraso</CardDescription>
            </CardContent>
          </Card>

          {/* Contas A Vencer */}
          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => abrirModalCard('aVencer')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-yellow-600" />
                <CardTitle className="text-sm font-bold text-yellow-700">A Vencer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-yellow-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-yellow-600" /> : 
                                     totalContasAVencerCards
                }
              </div>
              <div className="text-xs font-medium text-yellow-500">
                {loading ? '...' : 
                                     valorContasAVencerCards.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Contas futuras</CardDescription>
            </CardContent>
          </Card>

          {/* Próximas a Vencer (próximos 7 dias) */}
          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => abrirModalCard('proximasVencer')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ArrowUp size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-700">Próximas a Vencer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-orange-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-orange-600" /> : 
                                     totalContasProximasVencerCards
                }
              </div>
              <div className="text-xs font-medium text-orange-500">
                                {loading ? '...' : 
                                     valorContasProximasVencerCards.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                    })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Próximos 7 dias</CardDescription>
            </CardContent>
          </Card>

          {/* Contas Pagas */}
          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => abrirModalCard('pagas')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Contas Pagas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                                     totalContasPagasCards
                }
              </div>
              <div className="text-xs font-medium text-green-500">
                {loading ? '...' : 
                                      valorContasPagasCards.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                    })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Contas liquidadas</CardDescription>
            </CardContent>
          </Card>

          {/* Falta Pagar */}
          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => abrirModalCard('faltaPagar')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ArrowDown size={18} className="text-purple-600" />
                <CardTitle className="text-sm font-bold text-purple-700">Falta Pagar</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-purple-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-purple-600" /> : 
                                     (totalContasCards - totalContasPagasCards)
                }
              </div>
              <div className="text-xs font-medium text-purple-500">
                {loading ? '...' : 
                                      valorFaltaPagarCards.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                    })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Contas pendentes</CardDescription>
            </CardContent>
          </Card>

          {/* Descontos Ganhos */}
          <Card 
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => abrirModalCard('descontos')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendDown size={18} className="text-emerald-600" />
                <CardTitle className="text-sm font-bold text-emerald-700">Descontos Ganhos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-emerald-600 mb-1">
                {loading ? <Spinner size={24} className="animate-spin text-emerald-600" /> : 
                                     dadosOrdenadosParaCards.filter(grupo => parseFloat(grupo.item.vl_desconto || 0) > 0).length
                }
              </div>
              <div className="text-xs font-medium text-emerald-500">
                {loading ? '...' : 
                                      totalDescontosCards.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                    })
                }
              </div>
              <CardDescription className="text-xs text-gray-500">Total de descontos obtidos</CardDescription>
            </CardContent>
          </Card>
          </div>
          
        {/* Conteúdo principal */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-8xl mx-auto w-full">
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
                {/* Detalhamento de Contas */}
                <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full mb-6">
                  <div className="p-6 border-b border-[#000638]/10">
                    <h2 className="text-xl font-bold text-[#000638]">Detalhamento de Contas</h2>
                  </div>
                  
                  <div className="p-6">
                    <DespesasPorCategoria 
                      dados={dadosOrdenadosComFiltroMensal}
                      totalContas={dadosOrdenadosComFiltroMensal.length}
                      linhasSelecionadas={linhasSelecionadas}
                      toggleLinhaSelecionada={toggleLinhaSelecionada}
                      filtroMensal={filtroMensal}
                      setFiltroMensal={setFiltroMensal}
                      dadosOriginais={dadosComFiltrosAdicionais}
                      filtroDia={filtroDia}
                      setFiltroDia={setFiltroDia}
                      handleFiltroMensalChange={handleFiltroMensalChange}
                      obterDiasDoMes={obterDiasDoMes}
                      abrirModalDetalhes={abrirModalDetalhes}
                    />
                          </div>
                          </div>


              </>
            )}
                          </div>
                          </div>
                          </div>

            {/* Modal para exibir observações */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header do Modal */}
            <div className="bg-[#000638] text-white p-6 rounded-t-lg">
              <h2 className="text-xl font-bold">Observações</h2>
              <p className="text-sm opacity-90 mt-1">
                Detalhes das observações para a conta selecionada
              </p>
                          </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {dadosModal && dadosModal.observacoes && dadosModal.observacoes.length > 0 ? (
                <div className="space-y-3">
                  {dadosModal.observacoes.map((obs, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-gray-800 text-sm leading-relaxed">{obs}</p>
                          </div>
                  ))}
                          </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-lg font-medium">Nenhuma observação encontrada</p>
                  <p className="text-sm">Este registro não possui observações cadastradas.</p>
                          </div>
              )}
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

      {/* Modal para exibir dados dos cards */}
      {modalCardAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Header do Modal */}
            <div className="bg-[#000638] text-white p-6 rounded-t-lg">
              <h2 className="text-xl font-bold">{getTituloModal(tipoCardSelecionado)}</h2>
              <p className="text-sm opacity-90 mt-1">
                {dadosCardModal.length} registro{dadosCardModal.length !== 1 ? 's' : ''} encontrado{dadosCardModal.length !== 1 ? 's' : ''}
              </p>
                          </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {dadosCardModal.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Vencimento</th>
                        <th className="px-2 py-2 text-right font-medium text-gray-700">Valor</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Fornecedor</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Despesa</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Duplicata</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Status</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Previsão</th>
                        {tipoCardSelecionado === 'descontos' && (
                          <th className="px-2 py-2 text-right font-medium text-gray-700">Desconto</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dadosCardModal.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-2 py-2 text-sm text-gray-900">
                            {formatarData(item.dt_vencimento)}
                          </td>
                          <td className="px-2 py-2 text-sm text-right font-medium text-green-600">
                            {parseFloat(item.vl_duplicata || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-2 py-2 text-sm text-center text-gray-900">
                            {item.nm_fornecedor || ''}
                          </td>
                          <td className="px-2 py-2 text-sm text-gray-900">
                            {item.ds_despesaitem || ''}
                          </td>
                          <td className="px-2 py-2 text-sm text-center text-gray-900">
                            {item.nr_duplicata || ''}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(getStatusFromData(item))}`}>
                              {getStatusIcon(getStatusFromData(item))}
                              <span className="ml-1">{getStatusFromData(item)}</span>
                                  </span>
                          </td>
                          <td className="px-2 py-2 text-center text-gray-900">
                            {item.tp_previsaoreal || ''}
                          </td>
                          {tipoCardSelecionado === 'descontos' && (
                            <td className="px-2 py-2 text-sm text-right font-medium text-emerald-600">
                              {parseFloat(item.vl_desconto || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                  <p className="text-lg font-medium">Nenhum registro encontrado</p>
                  <p className="text-sm">Não há registros para o filtro selecionado.</p>
                        </div>
              )}
                        </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
                      <button
                onClick={fecharModalCard}
                className="bg-[#000638] text-white px-6 py-2 rounded-lg hover:bg-[#fe0000] transition-colors font-medium"
                      >
                Fechar
                      </button>
            </div>
                    </div>
                  </div>
                )}

      {/* Modal de Detalhes da Conta */}
      <ModalDetalhesConta
        conta={modalDetalhes.conta}
        isOpen={modalDetalhes.isOpen}
        onClose={fecharModalDetalhes}
      />
    </Layout>
  );
};

// Componente para agrupar despesas por categoria
const DespesasPorCategoria = ({ dados, totalContas, linhasSelecionadas, toggleLinhaSelecionada, filtroMensal, setFiltroMensal, dadosOriginais, filtroDia, setFiltroDia, handleFiltroMensalChange, obterDiasDoMes, abrirModalDetalhes }) => {
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(new Set());
  const [todosExpandidos, setTodosExpandidos] = useState(false);

  // Função para classificar despesa por código
  const classificarDespesa = (cdDespesa) => {
    const codigo = parseInt(cdDespesa) || 0;
    
    const categoriaExcecao = getCategoriaPorCodigo(codigo);
    if (categoriaExcecao) {
      return categoriaExcecao;
    }

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
  const dadosAgrupados = useMemo(() => {
    const categorias = {};
    
    dados.forEach((item, index) => {
      const cdDespesa = item.cd_despesaitem;
      const nomeDespesa = item.ds_despesaitem || 'SEM DESCRIÇÃO';
      const nomeFornecedor = item.nm_fornecedor || 'SEM FORNECEDOR';
      const vlRateio = item.vl_rateio || 0;
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
      
      // Criar chave única para o fornecedor incluindo duplicata, parcela e rateio
      const chaveFornecedor = `${nomeFornecedor}|${item.nr_duplicata}|${item.nr_parcela}|${vlRateio}`;
      
      // Criar sub-tópico do fornecedor se não existir
      if (!categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor]) {
        categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor] = {
          nome: nomeFornecedor,
          nrDuplicata: item.nr_duplicata,
          nrParcela: item.nr_parcela,
          vlRateio: vlRateio,
          itens: [],
          total: 0,
          quantidade: 0,
          expandida: false
        };
      }
      
      // Adicionar item ao fornecedor específico
      categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor].itens.push({ item, indiceOriginal: index });
      
      // Usar o valor de rateio como total para este item específico
      categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor].total = parseFloat(vlRateio || 0);
      categorias[categoria].despesas[nomeDespesa].fornecedores[chaveFornecedor].quantidade = 1;
      
      // Adicionar totais da despesa e categoria usando o rateio
      categorias[categoria].despesas[nomeDespesa].total += parseFloat(vlRateio || 0);
      categorias[categoria].despesas[nomeDespesa].quantidade += 1;
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

  const toggleFornecedor = (nomeCategoria, nomeDespesa, nomeFornecedor, nrDuplicata, nrParcela, vlRateio) => {
    const chave = `${nomeCategoria}|${nomeDespesa}|${nomeFornecedor}|${nrDuplicata}|${nrParcela}|${vlRateio}`;
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



  // Função para exportar dados da última linha de hierarquia para Excel
  const exportarDadosUltimaLinha = () => {
    if (!dadosAgrupados || dadosAgrupados.length === 0) {
      alert('Nenhum dado disponível para exportar');
      return;
    }

    // Coletar todos os dados da última linha de hierarquia (itens individuais)
    const dadosParaExportar = [];
    
    dadosAgrupados.forEach(categoria => {
      categoria.despesasArray.forEach(despesa => {
        despesa.fornecedoresArray.forEach(fornecedor => {
          fornecedor.itens.forEach(grupo => {
            const item = grupo.item;
            dadosParaExportar.push({
              'Categoria': categoria.nome,
              'Despesa': despesa.nome,
              'Fornecedor': fornecedor.nome,
              'Duplicata': fornecedor.nrDuplicata,
              'Rateio': fornecedor.vlRateio,
              'Vencimento': formatarData(item.dt_vencimento),
              'Valor': parseFloat(item.vl_duplicata || 0),
              'Código Fornecedor': item.cd_fornecedor || '',
              'Nome Fornecedor': item.nm_fornecedor || '',
              'Despesa Item': item.ds_despesaitem || '',
              'Centro de Custo': item.ds_ccusto || '',
              'Empresa': item.cd_empresa || '',
              'Portador': item.nr_portador || '',
              'Emissão': formatarData(item.dt_emissao),
              'Entrada': formatarData(item.dt_entrada),
              'Liquidação': formatarData(item.dt_liq),
              'Situação': item.tp_situacao || '',
              'Estágio': item.tp_estagio || '',
              'Juros': parseFloat(item.vl_juros || 0),
              'Acréscimo': parseFloat(item.vl_acrescimo || 0),
              'Desconto': parseFloat(item.vl_desconto || 0),
              'Pago': parseFloat(item.vl_pago || 0),
              'Aceite': item.in_aceite || '',
              'Parcela': item.nr_parcela || '',
              'Rateio Item': item.vl_rateio || '',
              'Observação': item.ds_observacao || '',
              'Previsão': item.tp_previsaoreal || ''
            });
          });
        });
      });
    });

    if (dadosParaExportar.length === 0) {
      alert('Nenhum dado encontrado para exportar');
      return;
    }

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosParaExportar);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 20 }, // Categoria
      { wch: 30 }, // Despesa
      { wch: 25 }, // Fornecedor
      { wch: 12 }, // Duplicata
      { wch: 12 }, // Rateio
      { wch: 12 }, // Vencimento
      { wch: 15 }, // Valor
      { wch: 15 }, // Código Fornecedor
      { wch: 30 }, // Nome Fornecedor
      { wch: 30 }, // Despesa Item
      { wch: 25 }, // Centro de Custo
      { wch: 10 }, // Empresa
      { wch: 10 }, // Portador
      { wch: 12 }, // Emissão
      { wch: 12 }, // Entrada
      { wch: 12 }, // Liquidação
      { wch: 10 }, // Situação
      { wch: 10 }, // Estágio
      { wch: 12 }, // Juros
      { wch: 12 }, // Acréscimo
      { wch: 12 }, // Desconto
      { wch: 12 }, // Pago
      { wch: 10 }, // Aceite
      { wch: 10 }, // Parcela
      { wch: 10 }, // Rateio
      { wch: 30 }, // Observação
      { wch: 12 }  // Previsão
    ];
    ws['!cols'] = colWidths;

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar');

    // Gerar arquivo e fazer download
    const fileName = `contas_a_pagar_${new Date().toISOString().split('T')[0]}.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, fileName);

    console.log(`✅ Exportados ${dadosParaExportar.length} registros para Excel`);
  };

  // Calcular dados mensais para mostrar quantidades nos botões
  const calcularDadosMensais = () => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dadosMensais = {};
    
    // Calcular ANO ATUAL
    const anoAtual = new Date().getFullYear();
    dadosMensais['ANO'] = dadosOriginais.filter(item => {
      if (!item.dt_vencimento) return false;
      const data = criarDataSemFusoHorario(item.dt_vencimento);
      const ano = data.getFullYear();
      return ano === anoAtual;
    }).length;
    
    // Calcular cada mês
    meses.forEach((mes, index) => {
      const numeroMes = index + 1;
      dadosMensais[mes] = dadosOriginais.filter(item => {
        if (!item.dt_vencimento) return false;
        const data = criarDataSemFusoHorario(item.dt_vencimento);
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
            onClick={() => handleFiltroMensalChange('ANO')}
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
              onClick={() => handleFiltroMensalChange(mes)}
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
          {filtroDia && <span className="ml-1">- Dia {filtroDia}</span>}
          <span className="ml-2">({dados.length} registro{dados.length !== 1 ? 's' : ''})</span>
        </div>

        {/* Filtro por Dia - aparece apenas quando um mês está selecionado */}
        {filtroMensal !== 'ANO' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-[#000638]" />
              <h4 className="font-bold text-sm text-[#000638]">Filtro por Dia - {filtroMensal}</h4>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {/* Botão "Todos os Dias" */}
                      <button
                onClick={() => setFiltroDia(null)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filtroDia === null
                    ? 'bg-[#000638] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                TODOS
                      </button>

              {/* Botões dos dias */}
              {Array.from({ length: obterDiasDoMes(filtroMensal) }, (_, i) => i + 1).map((dia) => (
                <button
                  key={dia}
                  onClick={() => setFiltroDia(dia)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    filtroDia === dia
                      ? 'bg-[#000638] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {dia}
                </button>
              ))}
              </div>
          </div>
        )}
            </div>

      {/* Categorias de Despesas */}
      <div className="space-y-2">
        {/* Botões de ação */}
        {dadosAgrupados.length > 0 && (
          <div className="flex justify-between items-center">
            {/* Botão discreto para expandir/colapsar todos */}
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

            {/* Botão para baixar Excel */}
            <button
              onClick={exportarDadosUltimaLinha}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              title="Exportar todos os dados da última linha de hierarquia para Excel"
            >
              <FileArrowDown size={16} />
              BAIXAR EXCEL
            </button>
          </div>
        )}
        
        {dadosAgrupados.map((categoria, categoriaIndex) => {
          const isCategoriaExpanded = categoriasExpandidas.has(categoria.nome);
          
          return (
            <div key={`categoria-${categoriaIndex}-${categoria.nome}`} className="border border-gray-200 rounded-lg overflow-hidden">
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
                  {categoria.despesasArray.map((despesa, despesaIndex) => {
                    const chaveExpansao = `${categoria.nome}|${despesa.nome}`;
                    const isDespesaExpanded = categoriasExpandidas.has(chaveExpansao);
                    
                    return (
                      <div key={`despesa-${categoriaIndex}-${despesaIndex}-${despesa.nome}`} className="border-b border-gray-100 last:border-b-0">
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
                                                    {despesa.fornecedoresArray.map((fornecedor, fornecedorIndex) => {
                          const chaveExpansaoFornecedor = `${categoria.nome}|${despesa.nome}|${fornecedor.nome}|${fornecedor.nrDuplicata}|${fornecedor.nrParcela}|${fornecedor.vlRateio}`;
                          const isFornecedorExpanded = categoriasExpandidas.has(chaveExpansaoFornecedor);
                          
                          return (
                            <div key={`fornecedor-${categoriaIndex}-${despesaIndex}-${fornecedorIndex}-${fornecedor.nome}-${fornecedor.nrDuplicata}-${fornecedor.nrParcela}`} className="border-b border-gray-50 last:border-b-0">
                                  {/* Cabeçalho do fornecedor */}
                                  <div
                                    className="bg-gray-25 hover:bg-gray-50 cursor-pointer transition-colors px-9 py-2 flex items-center justify-between"
                                    onClick={() => toggleFornecedor(categoria.nome, despesa.nome, fornecedor.nome, fornecedor.nrDuplicata, fornecedor.nrParcela, fornecedor.vlRateio)}
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
                                            (Dup: {fornecedor.nrDuplicata} | Parc: {fornecedor.nrParcela || '-'})
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
                                              <th className="px-1 py-1 text-center text-[10px]">Previsão</th>
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
                                                  <td className="px-1 py-1 text-center">{grupo.item.tp_previsaoreal || ''}</td>
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
