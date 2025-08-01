import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
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
  ArrowDown
} from '@phosphor-icons/react';

const ContasAPagar = () => {
  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('Todos');
  const [fornecedor, setFornecedor] = useState('');
  const [cdEmpresa, setCdEmpresa] = useState('1'); // Valor padrão


  const BaseURL = 'https://apigestaocrosby.onrender.com/';

  const buscarDados = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) {
      console.error('Datas de início e fim são obrigatórias');
      return;
    }
    
    // Validar formato da data (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(inicio) || !dateRegex.test(fim)) {
      console.error('Formato de data inválido. Use YYYY-MM-DD');
      return;
    }
    
    setLoading(true);
    try {
      console.log('Parâmetros da requisição:', { dt_inicio: inicio, dt_fim: fim, cd_empresa: cdEmpresa });
      const res = await fetch(`${BaseURL}contasapagar?dt_inicio=${inicio}&dt_fim=${fim}&cd_empresa=${cdEmpresa}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Erro da API:', errorText);
        throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      console.log('Resposta da API Contas a Pagar:', data);
      
      // Log detalhado da estrutura dos dados
      if (data && data.dados && data.dados.length > 0) {
        console.log('Primeiro item da API:', data.dados[0]);
        console.log('Campos disponíveis:', Object.keys(data.dados[0]));
      }
      
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
        return <Clock size={16} className="text-blue-600" />;
      default:
        return <Clock size={16} className="text-gray-600" />;
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
    // Filtro por status
    if (status !== 'Todos') {
      const itemStatus = getStatusFromData(item);
      if (itemStatus.toLowerCase() !== status.toLowerCase()) {
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
    
    return true;
  });

  // Cálculos dos totais
  const totalContas = dadosFiltrados.length;
  const totalValor = dadosFiltrados.reduce((acc, item) => acc + (parseFloat(item.vl_duplicata) || 0), 0);
  const contasVencidas = dadosFiltrados.filter(item => {
    const status = getStatusFromData(item);
    return status.toLowerCase().includes('vencido');
  }).length;
  const contasAVencer = dadosFiltrados.filter(item => {
    const status = getStatusFromData(item);
    return status.toLowerCase().includes('vencer');
  }).length;

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#000638]">Contas a Pagar</h1>
            <p className="text-gray-600 mt-2">Gestão e controle de contas a pagar</p>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={24} className="text-blue-600" />
                <CardTitle className="text-lg text-gray-800">Total de Contas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalContas}</div>
              <p className="text-sm text-gray-500 mt-1">Contas no período</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={24} className="text-green-600" />
                <CardTitle className="text-lg text-gray-800">Valor Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 break-words">
                {totalValor.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-sm text-gray-500 mt-1">Valor total a pagar</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Warning size={24} className="text-red-600" />
                <CardTitle className="text-lg text-gray-800">Contas Vencidas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{contasVencidas}</div>
              <p className="text-sm text-gray-500 mt-1">Contas em atraso</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock size={24} className="text-yellow-600" />
                <CardTitle className="text-lg text-gray-800">A Vencer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{contasAVencer}</div>
              <p className="text-sm text-gray-500 mt-1">Contas próximas do vencimento</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Tabela */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Funnel size={24} className="text-[#000638]" />
              <CardTitle className="text-xl text-[#000638]">Filtros de Consulta</CardTitle>
            </div>
            <CardDescription>Selecione o período e filtros para análise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <div>
                <label htmlFor="data-inicio" className="block text-sm font-medium text-gray-700 mb-1">
                  Data Início
                </label>
                <input
                  type="date"
                  id="data-inicio"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="data-fim" className="block text-sm font-medium text-gray-700 mb-1">
                  Data Fim
                </label>
                <input
                  type="date"
                  id="data-fim"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Todos">TODOS</option>
                  <option value="Pago">PAGO</option>
                  <option value="Vencido">VENCIDO</option>
                  <option value="A Vencer">A VENCER</option>
                </select>
              </div>
              <div>
                <label htmlFor="fornecedor" className="block text-sm font-medium text-gray-700 mb-1">
                  Fornecedor
                </label>
                <input
                  type="text"
                  id="fornecedor"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Buscar fornecedor..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="cd-empresa" className="block text-sm font-medium text-gray-700 mb-1">
                  Empresa
                </label>
                <select
                  id="cd-empresa"
                  value={cdEmpresa}
                  onChange={(e) => setCdEmpresa(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1">Empresa 1</option>
                  <option value="2">Empresa 2</option>
                  <option value="3">Empresa 3</option>
                  <option value="4">Empresa 4</option>
                  <option value="5">Empresa 5</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                  onClick={() => buscarDados()}
                  disabled={loading || !dataInicio || !dataFim}
                >
                  {loading ? (
                    <>
                      <Spinner size={20} className="animate-spin" />
                      <span className="hidden sm:inline">Buscando...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Calendar size={20} />
                      <span className="hidden sm:inline">Buscar Dados</span>
                      <span className="sm:hidden">Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

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
                <div className="min-w-[1200px]">
                  <table className="w-full border-collapse rounded-lg overflow-hidden shadow-lg">
                    <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-1 py-1 text-center text-[8px]">Empresa</th>
                        <th className="px-1 py-1 text-center text-[8px]">Fornecedor</th>
                        <th className="px-1 py-1 text-center text-[8px]">Duplicata</th>
                        <th className="px-1 py-1 text-center text-[8px]">Portador</th>
                        <th className="px-1 py-1 text-center text-[8px]">Emissão</th>
                        <th className="px-1 py-1 text-center text-[8px]">Vencimento</th>
                        <th className="px-1 py-1 text-center text-[8px]">Entrada</th>
                        <th className="px-1 py-1 text-center text-[8px]">Liquidação</th>
                        <th className="px-1 py-1 text-center text-[8px]">Situação</th>
                        <th className="px-1 py-1 text-center text-[8px]">Estágio</th>
                        <th className="px-1 py-1 text-center text-[8px]">Valor</th>
                        <th className="px-1 py-1 text-center text-[8px]">Juros</th>
                        <th className="px-1 py-1 text-center text-[8px]">Acréscimo</th>
                        <th className="px-1 py-1 text-center text-[8px]">Desconto</th>
                        <th className="px-1 py-1 text-center text-[8px]">Pago</th>
                        <th className="px-1 py-1 text-center text-[8px]">Aceite</th>
                        <th className="px-1 py-1 text-center text-[8px]">Parcela</th>
                        <th className="px-1 py-1 text-center text-[8px]">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosFiltrados.map((item, index) => (
                        <tr
                          key={index}
                          className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 text-[8px] border-b transition-colors"
                        >
                          <td className="px-0.5 py-0.5 text-center">
                            {item.cd_empresa || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.cd_fornecedor || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.nr_duplicata || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.nr_portador || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.dt_emissao ? 
                              new Date(item.dt_emissao).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.dt_vencimento ? 
                              new Date(item.dt_vencimento).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.dt_entrada ? 
                              new Date(item.dt_entrada).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.dt_liq ? 
                              new Date(item.dt_liq).toLocaleDateString('pt-BR') 
                              : 'N/A'
                            }
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.tp_situacao || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.tp_estagio || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center font-semibold text-green-600">
                            {(parseFloat(item.vl_duplicata) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(parseFloat(item.vl_juros) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(parseFloat(item.vl_acrescimo) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {(parseFloat(item.vl_desconto) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center font-semibold text-blue-600">
                            {(parseFloat(item.vl_pago) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.in_aceite || 'N/A'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            {item.nr_parcela || '1'}
                          </td>
                          <td className="px-0.5 py-0.5 text-center max-w-[100px] truncate" title={item.ds_observacao || 'N/A'}>
                            {item.ds_observacao || 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {dadosFiltrados.length === 0 && !loading && (
                        <tr>
                                                  <td colSpan="18" className="text-center py-8 text-gray-500 text-sm">
                          Nenhuma conta encontrada para os filtros selecionados
                        </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


    </Layout>
  );
};

export default ContasAPagar; 