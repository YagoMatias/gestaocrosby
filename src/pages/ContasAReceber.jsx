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
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);

  const BaseURL = 'https://apigestaocrosby-bw2v.onrender.com/api/financial/';

  // Definir datas padrão (mês atual)
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(ultimoDia.toISOString().split('T')[0]);
  }, []);

  const buscarDados = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) return;
    
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }
    
    setLoading(true);
    setPaginaAtual(1); // Reset para primeira página ao buscar novos dados
    try {
      const todasAsPromises = empresasSelecionadas.map(async (empresa) => {
        try {
          const res = await fetch(`${BaseURL}contas-receber?dt_inicio=${inicio}&dt_fim=${fim}&cd_empresa=${empresa.cd_empresa}`);
          
          if (!res.ok) {
            console.warn(`Erro ao buscar empresa ${empresa.cd_empresa}: HTTP ${res.status}`);
            return [];
          }
          
          const data = await res.json();
          console.log(`Resposta da API para empresa ${empresa.cd_empresa}:`, data);
          
          let dadosArray = [];
          if (Array.isArray(data)) {
            dadosArray = data;
          } else if (data && typeof data === 'object') {
            if (data.dados && Array.isArray(data.dados)) {
              dadosArray = data.dados;
            } else if (data.data && Array.isArray(data.data)) {
              dadosArray = data.data;
            } else if (data.data && data.data.data && Array.isArray(data.data.data)) {
              dadosArray = data.data.data;
            } else if (data.result && Array.isArray(data.result)) {
              dadosArray = data.result;
            } else if (data.contas && Array.isArray(data.contas)) {
              dadosArray = data.contas;
            } else {
              dadosArray = Object.values(data);
            }
          }
          
          return dadosArray.filter(item => item && typeof item === 'object');
        } catch (err) {
          console.warn(`Erro ao buscar empresa ${empresa.cd_empresa}:`, err);
          return [];
        }
      });
      
      const resultados = await Promise.all(todasAsPromises);
      const todosOsDados = resultados.flat();
      
      console.log('📊 Total de dados:', todosOsDados.length);
      setDados(todosOsDados);
      setDadosCarregados(true);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  // Funções para paginação
  const irParaPagina = (pagina) => {
    setPaginaAtual(pagina);
  };

  const paginaAnterior = () => {
    if (paginaAtual > 1) {
      setPaginaAtual(paginaAtual - 1);
    }
  };

  const proximaPagina = () => {
    const totalPaginas = Math.ceil(dados.length / itensPorPagina);
    if (paginaAtual < totalPaginas) {
      setPaginaAtual(paginaAtual + 1);
    }
  };

  // Calcular totais para os cards
  const calcularTotais = () => {
    const totais = dados.reduce((acc, item) => {
      acc.valorFaturado += parseFloat(item.vl_fatura) || 0;
      acc.valorPago += parseFloat(item.vl_pago) || 0;
      acc.valorCorrigido += parseFloat(item.vl_corrigido) || 0;
      return acc;
    }, {
      valorFaturado: 0,
      valorPago: 0,
      valorCorrigido: 0
    });

    // Valor a receber = Valor faturado - Valor pago
    totais.valorAPagar = totais.valorFaturado - totais.valorPago;

    return totais;
  };

  const totais = calcularTotais();

  // Gerar array de páginas para exibição
  const gerarPaginas = () => {
    const totalPaginas = Math.ceil(dados.length / itensPorPagina);
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
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Contas a Receber</h1>



        {/* Formulário de Filtros */}
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
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Cliente</label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Buscar por código ou nome do cliente..."
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
        {dados.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8 max-w-7xl mx-auto">
            {/* Valor Total Faturado */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-700">Valor Total Faturado</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-blue-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : 
                    totais.valorFaturado.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor total faturado no período</CardDescription>
              </CardContent>
            </Card>

            {/* Valor Pago */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-600" />
                  <CardTitle className="text-sm font-bold text-green-700">Valor Pago</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-green-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                    totais.valorPago.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor total pago no período</CardDescription>
              </CardContent>
            </Card>

            {/* Valor Corrigido */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-700">Valor Corrigido</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-purple-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-purple-600" /> : 
                    totais.valorCorrigido.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor total corrigido no período</CardDescription>
              </CardContent>
            </Card>

            {/* Valor a Receber */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Warning size={18} className="text-red-600" />
                  <CardTitle className="text-sm font-bold text-red-700">Valor a Receber</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-red-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                    totais.valorAPagar.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor pendente a receber</CardDescription>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full">
          <div className="p-6 border-b border-[#000638]/10 flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#000638]">Detalhamento de Contas a Receber</h2>
            <div className="text-sm text-gray-600">
              {dadosCarregados ? `${dados.length} registros encontrados` : 'Nenhum dado carregado'}
            </div>
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
              <div className="overflow-x-auto">
                <table className="w-full border-collapse rounded-lg overflow-hidden shadow-lg">
                  <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Empresa
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Nome Cliente
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Parcela
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Emissão
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Vencimento
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Cancelamento
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Liquidação
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Cobrança
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Documento
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Faturamento
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Inclusão
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Baixa
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Situação
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Valor Fatura
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Valor Original
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Abatimento
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Valor Pago
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Desconto
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Valor Líquido
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Acréscimo
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Multa
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Portador
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Renegociação
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Valor Corrigido
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        Juros
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        % Juros/Mês
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-medium text-white uppercase tracking-wider">
                        % Multa
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      const totalPaginas = Math.ceil(dados.length / itensPorPagina);
                      const indiceInicial = (paginaAtual - 1) * itensPorPagina;
                      const indiceFinal = indiceInicial + itensPorPagina;
                      const dadosPaginaAtual = dados.slice(indiceInicial, indiceFinal);
                      
                      return dadosPaginaAtual.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 text-[10px] border-b transition-colors">
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.cd_empresa || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.cd_cliente || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.nm_cliente || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.nr_parcela || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.dt_emissao ? 
                            new Date(item.dt_emissao).toLocaleDateString('pt-BR') 
                            : 'N/A'
                          }
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.dt_vencimento ? 
                            new Date(item.dt_vencimento).toLocaleDateString('pt-BR') 
                            : 'N/A'
                          }
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.dt_cancelamento ? 
                            new Date(item.dt_cancelamento).toLocaleDateString('pt-BR') 
                            : 'N/A'
                          }
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.dt_liq ? 
                            new Date(item.dt_liq).toLocaleDateString('pt-BR') 
                            : 'N/A'
                          }
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.tp_cobranca || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.tp_documento || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.tp_faturamento || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.tp_inclusao || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.tp_baixa || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.tp_situacao || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center font-semibold text-green-600">
                          {(parseFloat(item.vl_fatura) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_original) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_abatimento) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center font-semibold text-blue-600">
                          {(parseFloat(item.vl_pago) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_desconto) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_liquido) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_acrescimo) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_multa) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.nr_portador || 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_renegociacao) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_corrigido) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {(parseFloat(item.vl_juros) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.pr_juromes ? `${parseFloat(item.pr_juromes).toFixed(2)}%` : 'N/A'}
                        </td>
                        <td className="px-1 py-1 text-center text-gray-900">
                          {item.pr_multa ? `${parseFloat(item.pr_multa).toFixed(2)}%` : 'N/A'}
                                                 </td>
                       </tr>
                     ));
                   })()}
                   </tbody>
                </table>
                                 <div className="mt-4 text-center text-sm text-gray-600">
                   Total de {dados.length} registros
                 </div>
                 
                 {/* Paginação */}
                 {dados.length > itensPorPagina && (
                   <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-gray-200">
                     <div className="text-sm text-gray-600 mb-4 sm:mb-0">
                       Mostrando {((paginaAtual - 1) * itensPorPagina) + 1} a {Math.min(paginaAtual * itensPorPagina, dados.length)} de {dados.length} registros
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
                         disabled={paginaAtual === Math.ceil(dados.length / itensPorPagina)}
                         className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                       >
                         Próximo
                         <CaretRight size={16} />
                       </button>
                     </div>
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ContasAReceber; 