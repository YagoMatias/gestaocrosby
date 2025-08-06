import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import FluxoCaixaGraficos from '../components/FluxoCaixaGraficos';
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
  ChartBar
} from '@phosphor-icons/react';

const FluxoCaixa = () => {
  const apiClient = useApiClient();

  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
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
  
  // Empresas pré-selecionadas
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  
  // Estados para o modal de observações
  const [modalAberto, setModalAberto] = useState(false);
  const [dadosModal, setDadosModal] = useState(null);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(30);

  // Estados para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: 'dt_liq',
    direction: 'asc'
  });

  // Estado para controlar exibição dos gráficos
  const [mostrarGraficos, setMostrarGraficos] = useState(false);

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
      
      // Buscar dados das empresas selecionadas usando a nova API
      const todasAsPromises = empresasSelecionadas.map(async (empresa) => {
        try {
          console.log(`📡 Buscando dados para empresa ${empresa.cd_empresa}...`);
          
          const params = {
            dt_inicio: inicio,
            dt_fim: fim,
            cd_empresa: empresa.cd_empresa
          };
          
          const result = await apiClient.financial.fluxoCaixa(params);
          
          if (result.success) {
            const dadosArray = Array.isArray(result.data) ? result.data : [];
            console.log(`✅ Sucesso para empresa ${empresa.cd_empresa}:`, {
              total: dadosArray.length,
              amostra: dadosArray.slice(0, 2),
              tipoDado: typeof result.data,
              éArray: Array.isArray(result.data),
              dadoCompleto: result
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
      
      // Aguardar todas as requisições
      const resultados = await Promise.all(todasAsPromises);
      
      // Combinar todos os dados
      const todosOsDados = resultados.flat();
      
      console.log('📊 Resultado final:', {
        totalRegistros: todosOsDados.length,
        empresasComDados: resultados.filter(r => r.length > 0).length,
        primeirosRegistros: todosOsDados.slice(0, 3)
      });
      
      setDados(todosOsDados);
      setDadosCarregados(true);
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

  // Função para lidar com seleção de empresas
  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas([...empresas]); // Garantir que é um novo array
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

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

  // Agrupar dados filtrados
  const dadosAgrupados = agruparDadosIdenticos(dadosFiltrados);

  // Aplicar ordenação aos dados agrupados
  const dadosOrdenados = sortDadosAgrupados(dadosAgrupados);

  // Logs de debug para monitorar dados
  console.log('🔍 Debug FluxoCaixa:', {
    dadosOriginais: dados.length,
    dadosFiltrados: dadosFiltrados.length,
    dadosAgrupados: dadosAgrupados.length,
    dadosOrdenados: dadosOrdenados.length,
    filtrosAtivos: { status, situacao, fornecedor, despesa, duplicata, centroCusto },
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
    <Layout>
      <div className="w-full max-w-xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
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

        {/* Botão para mostrar/ocultar gráficos */}
        {dadosCarregados && dados.length > 0 && (
          <div className="mb-6 flex justify-center">
            <button
              onClick={() => setMostrarGraficos(!mostrarGraficos)}
              className="flex items-center gap-2 bg-[#000638] text-white px-6 py-3 rounded-lg hover:bg-[#fe0000] transition-colors font-medium shadow-md"
            >
              <ChartBar size={20} />
              {mostrarGraficos ? 'Ocultar Gráficos' : 'Mostrar Gráficos'}
            </button>
          </div>
        )}

        {/* Gráficos */}
        {mostrarGraficos && dadosCarregados && dados.length > 0 && (
          <div className="mb-8">
            <FluxoCaixaGraficos dadosAgrupados={dadosAgrupados} />
          </div>
        )}

        {/* Área para a tabela será adicionada aqui */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full">
          <div className="p-6 border-b border-[#000638]/10 flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#000638]">Detalhamento de Fluxo de Caixa</h2>
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
              <div className="text-center py-8">
                <div className="text-gray-600 text-lg mb-2">
                  {totalContas} registros encontrados
                </div>
                <div className="text-gray-400 text-sm">
                  Tabela será implementada em breve
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FluxoCaixa;