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

const ContasAPagar = () => {
  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('Todos');
  const [situacao, setSituacao] = useState('NORMAIS');
  const [fornecedor, setFornecedor] = useState('');
  const [duplicata, setDuplicata] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(30);

  // Estados para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: 'dt_vencimento',
    direction: 'asc'
  });

  const BaseURL = 'https://apigestaocrosby.onrender.com/';

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
        case 'cd_fornecedor':
          aValue = a.item.cd_fornecedor || '';
          bValue = b.item.cd_fornecedor || '';
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
    
    setLoading(true);
    setPaginaAtual(1); // Reset para primeira página ao buscar novos dados
    try {
      // Se empresas foram selecionadas, usar a primeira para a API
      const empresaParaAPI = empresasSelecionadas.length > 0 ? empresasSelecionadas[0].cd_empresa : '1';
      
      const res = await fetch(`${BaseURL}contasapagar?dt_inicio=${inicio}&dt_fim=${fim}&cd_empresa=${empresaParaAPI}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Resposta da API:', data);
      
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
      } else {
        console.error('Formato de dados inesperado:', data);
        setDados([]);
        return;
      }
      
      // Filtrar apenas itens válidos
      const dadosValidos = dadosArray.filter(item => 
        item && typeof item === 'object'
      );
      
      setDados(dadosValidos);
      setDadosCarregados(true);
      console.log('Dados finais processados:', dadosValidos);
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
    
    // Filtro por fornecedor
    if (fornecedor) {
      const cdFornecedor = item.cd_fornecedor || '';
      if (!cdFornecedor.toString().toLowerCase().includes(fornecedor.toLowerCase())) {
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
    
    return true;
  });

  // Função para agrupar dados idênticos
  const agruparDadosIdenticos = (dados) => {
    const grupos = new Map();
    
    dados.forEach((item) => {
      // Criar chave única baseada em todos os campos exceto observação E situação
      // Removendo tp_situacao da chave para permitir agrupamento correto
      const chave = `${item.cd_empresa || ''}|${item.cd_fornecedor || ''}|${item.nr_duplicata || ''}|${item.nr_portador || ''}|${item.dt_emissao || ''}|${item.dt_vencimento || ''}|${item.dt_entrada || ''}|${item.dt_liq || ''}|${item.tp_estagio || ''}|${item.vl_duplicata || ''}|${item.vl_juros || ''}|${item.vl_acrescimo || ''}|${item.vl_desconto || ''}|${item.vl_pago || ''}|${item.in_aceite || ''}|${item.nr_parcela || ''}`;
      
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          item: item,
          observacoes: [],
          situacoes: [],
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
    });
    
    // Processar os grupos para determinar a situação final
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
      
      return {
        ...grupo,
        item: {
          ...grupo.item,
          tp_situacao: situacaoFinal
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
                  onSelectEmpresas={setEmpresasSelecionadas}
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
                  placeholder="Buscar fornecedor..."
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
              <CardDescription className="text-xs text-gray-500">Valor total a pagar</CardDescription>
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
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full">
          <div className="p-6 border-b border-[#000638]/10">
            <h2 className="text-xl font-bold text-[#000638]">Detalhamento de Contas</h2>
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
                          onClick={() => handleSort('cd_fornecedor')}
                        >
                          <div className="flex items-center justify-center">
                            Fornecedor
                            {getSortIcon('cd_fornecedor')}
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
                          className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 text-[10px] border-b transition-colors"
                        >
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.cd_empresa || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {grupo.item.cd_fornecedor || 'N/A'}
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
                          <td className="px-0.5 py-0.5 text-center max-w-[100px] truncate" title={grupo.observacoes.join(', ') || 'N/A'}>
                            {grupo.observacoes.length > 1 ? (
                              <span className="text-blue-600 font-semibold">
                                {grupo.observacoes.length} obs.
                              </span>
                            ) : (
                              grupo.observacoes.join(', ') || 'N/A'
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
    </Layout>
  );
};

export default ContasAPagar; 