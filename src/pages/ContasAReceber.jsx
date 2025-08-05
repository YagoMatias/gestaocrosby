import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
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

const ContasAReceber = () => {
  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('Todos');
  const [situacao, setSituacao] = useState('NORMAIS');
  const [cliente, setCliente] = useState('');
  const [duplicata, setDuplicata] = useState('');
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

  const BaseURL = 'https://apigestaocrosby-bw2v.onrender.com/api/financial/';

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
        case 'cd_cliente':
          aValue = a.item.cd_cliente || '';
          bValue = b.item.cd_cliente || '';
          break;
        case 'nr_fatura':
          aValue = a.item.nr_fatura || '';
          bValue = b.item.nr_fatura || '';
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
      // Buscar dados das empresas selecionadas
      const todasAsPromises = empresasSelecionadas.map(async (empresa) => {
        try {
          const res = await fetch(`${BaseURL}contas-receber?dt_inicio=${inicio}&dt_fim=${fim}&cd_empresa=${empresa.cd_empresa}`);
          
          if (!res.ok) {
            console.warn(`Erro ao buscar empresa ${empresa.cd_empresa}: HTTP ${res.status}`);
            return [];
          }
          
          const data = await res.json();
          console.log(`Resposta da API para empresa ${empresa.cd_empresa}:`, data);
          
          // Verificar se data é um array
          let dadosArray = [];
          if (Array.isArray(data)) {
            dadosArray = data;
          } else if (data && typeof data === 'object') {
            // Se for um objeto, tentar extrair array de propriedades
            if (data.dados && Array.isArray(data.dados)) {
              dadosArray = data.dados;
            } else if (data.data && Array.isArray(data.data)) {
              dadosArray = data.data;
            } else if (data.result && Array.isArray(data.result)) {
              dadosArray = data.result;
            } else if (data.contas && Array.isArray(data.contas)) {
              dadosArray = data.contas;
            } else {
              // Se não encontrar array, converter objeto em array
              dadosArray = Object.values(data);
            }
          }
          
          // Filtrar apenas itens válidos
          return dadosArray.filter(item => 
            item && typeof item === 'object'
          );
        } catch (err) {
          console.warn(`Erro ao buscar empresa ${empresa.cd_empresa}:`, err);
          return [];
        }
      });
      
      // Aguardar todas as requisições
      const resultados = await Promise.all(todasAsPromises);
      
      // Combinar todos os dados
      const todosOsDados = resultados.flat();
      
      setDados(todosOsDados);
      setDadosCarregados(true);
      console.log('Dados finais processados (empresas selecionadas):', todosOsDados);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
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
    
    // Filtro por cliente
    if (cliente) {
      const cdCliente = item.cd_cliente || '';
      if (!cdCliente.toString().toLowerCase().includes(cliente.toLowerCase())) {
        return false;
      }
    }
    
    // Filtro por fatura
    if (duplicata) {
      const nrFatura = item.nr_fatura || '';
      if (!nrFatura.toString().toLowerCase().includes(duplicata.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  });

  // Função para agrupar dados idênticos
  const agruparDadosIdenticos = (dados) => {
    const grupos = new Map();
    
    dados.forEach((item) => {
          // Criar chave única baseada APENAS em CLIENTE e FATURA
    // Se CLIENTE e FATURA são iguais = AGRUPA
    // Se CLIENTE igual mas FATURA diferente = NÃO AGRUPA
    // Se CLIENTE diferente mas FATURA igual = NÃO AGRUPA
    const chave = `${item.cd_cliente}|${item.nr_fatura}|${item.nr_parcela}|${item.cd_empresa}|${item.dt_emissao}|${item.dt_vencimento}|${item.dt_entrada}|${item.dt_liq}|${item.tp_situacao}|${item.vl_fatura}|${item.vl_juros}|${item.vl_acrescimo}|${item.vl_desconto}|${item.vl_pago}`;
      
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
      cd_cliente: grupo.item.cd_cliente,
      nm_cliente: grupo.item.nm_cliente,
      nr_fatura: grupo.item.nr_fatura,
      nr_parcela: grupo.item.nr_parcela,
      valor_fatura: grupo.item.vl_fatura,
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
      'Empresa': item.cd_empresa,
      'Cliente': item.cd_cliente,
      'Nome Cliente': item.nm_cliente,
      'Fatura': item.nr_fatura,
      'Parcela': item.nr_parcela,
      'Portador': item.nr_portador,
      'Emissão': item.dt_emissao,
      'Vencimento': item.dt_vencimento,
      'Cancelamento': item.dt_cancelamento,
      'Liquidação': item.dt_liq,
      'Valor Fatura': item.vl_fatura,
      'Valor Original': item.vl_original,
      'Abatimento': item.vl_abatimento,
      'Valor Pago': item.vl_pago,
      'Desconto': item.vl_desconto,
      'Valor Líquido': item.vl_liquido,
      'Acréscimo': item.vl_acrescimo,
      'Multa': item.vl_multa,
      'Juros': item.vl_juros,
      'Status': getStatusFromData(item),
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
    link.setAttribute('download', `contas_a_receber_${dataInicio}_${dataFim}.csv`);
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
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Contas a Receber</h1>
        
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
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Cliente</label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Fatura</label>
                <input
                  type="text"
                  value={duplicata}
                  onChange={(e) => setDuplicata(e.target.value)}
                  placeholder="Buscar fatura..."
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
            <h2 className="text-xl font-bold text-[#000638]">Detalhamento de Contas a Receber</h2>
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
                <div className="overflow-x-auto max-w-6xl mx-auto">
                  <table className="w-full border-collapse rounded-lg overflow-hidden shadow-lg">
                    <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                      <tr>
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
                          onClick={() => handleSort('cd_cliente')}
                        >
                          <div className="flex items-center justify-center">
                            Cliente
                            {getSortIcon('cd_cliente')}
                          </div>
                        </th>
                        <th 
                          className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('nr_fatura')}
                        >
                          <div className="flex items-center justify-center">
                            Fatura
                            {getSortIcon('nr_fatura')}
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
                          onClick={() => handleSort('dt_vencimento')}
                        >
                          <div className="flex items-center justify-center">
                            Vencimento
                            {getSortIcon('dt_vencimento')}
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
                          onClick={() => handleSort('vl_duplicata')}
                        >
                          <div className="flex items-center justify-center">
                            Valor
                            {getSortIcon('vl_duplicata')}
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
                          className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 text-[10px] border-b transition-colors cursor-pointer"
                          onClick={() => abrirModalObservacoes(grupo)}
                        >
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.cd_empresa || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.cd_cliente || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.nr_fatura || 'N/A'}
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
                            {grupo.item.dt_vencimento ? 
                              new Date(grupo.item.dt_vencimento).toLocaleDateString('pt-BR') 
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
                          <td className="px-0.5 py-0.5 text-center font-semibold text-green-600">
                            {(parseFloat(grupo.item.vl_duplicata) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
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
                          <td colSpan="18" className="text-center py-8 text-gray-500 text-sm">
                            Nenhuma conta encontrada para os filtros selecionados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

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
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Cliente:</label>
                  <span className="text-lg font-bold text-[#000638]">{dadosModal.cd_cliente} - {dadosModal.nm_cliente}</span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Fatura:</label>
                  <span className="text-lg font-bold text-[#000638]">{dadosModal.nr_fatura}</span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Parcela:</label>
                  <span className="text-lg font-bold text-[#000638]">{dadosModal.nr_parcela}</span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Valor Fatura:</label>
                  <span className="text-lg font-bold text-blue-600">
                    {(parseFloat(dadosModal.valor_fatura) || 0).toLocaleString('pt-BR', {
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

export default ContasAReceber; 