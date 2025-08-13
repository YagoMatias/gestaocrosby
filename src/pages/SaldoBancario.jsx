import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import DropdownContas from '../components/DropdownContas';
import { contas } from '../utils/contas';
import useApiClient from '../hooks/useApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { 
  Bank, 
  Money, 
  TrendUp, 
  TrendDown,
  Spinner,
  Plus,
  Minus,
  ArrowsClockwise,
  Receipt,
  CaretUp,
  CaretDown
} from '@phosphor-icons/react';

const SaldoBancario = () => {
  const apiClient = useApiClient();
  
  // Estados dos filtros
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Estados dos dados
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [saldosContas, setSaldosContas] = useState([]);
  const [saldoTotal, setSaldoTotal] = useState(0);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  
  // Estado para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Função para formatar valores monetários
  const formatCurrency = (value) => {
    if (typeof value === 'number') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    }
    return 'R$ 0,00';
  };

  // Função para formatar percentual
  const formatPercentage = (value) => {
    if (typeof value === 'number') {
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }
    return '0%';
  };

  // Handler para seleção de empresas
  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  // Função para determinar a origem da conta
  const getOrigemConta = (nomeConta) => {
    if (nomeConta.includes('CROSBY')) return 'CROSBY';
    if (nomeConta.includes('FABIO')) return 'FABIO';
    if (nomeConta.includes('IRMÃOS CR')) return 'IRMÃOS CR';
    if (nomeConta.includes('FLAVIO')) return 'FLAVIO';
    return 'OUTROS';
  };

  // Função para obter as cores da origem
  const getOrigemColors = (origem) => {
    switch (origem) {
      case 'CROSBY':
        return 'bg-blue-100 text-blue-800';
      case 'FABIO':
        return 'bg-yellow-100 text-yellow-800';
      case 'IRMÃOS CR':
        return 'bg-orange-100 text-orange-800';
      case 'FLAVIO':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };



  // Função para buscar saldos das contas
  const buscarSaldosContas = async (e) => {
    e.preventDefault();
    
    if (!dataInicio || !dataFim) {
      setErro('Por favor, selecione as datas de início e fim.');
      return;
    }

    if (contasSelecionadas.length === 0) {
      setErro('Por favor, selecione pelo menos uma conta.');
      return;
    }

    setLoading(true);
    setErro('');
    setDadosCarregados(false);
    
    try {
      const saldosPromises = contasSelecionadas.map(async (nr_ctapes) => {
        const params = {
          nr_ctapes,
          dt_inicio: dataInicio,
          dt_fim: dataFim
        };

        const result = await apiClient.financial.saldoConta(params);
        
        if (result.success) {
          const conta = contas.find(c => c.numero === nr_ctapes);
          // A API retorna o saldo em result.data.data.saldo (estrutura aninhada)
          const saldo = result.data?.data?.saldo || result.data?.saldo || 0;
          const nomeConta = conta ? conta.nome : `Conta ${nr_ctapes}`;
          return {
            numero: nr_ctapes,
            nome: nomeConta,
            origem: getOrigemConta(nomeConta),
            saldo: parseFloat(saldo),
            filtros: result.data?.filtros || result.filtros
          };
        } else {
          throw new Error(result.message || 'Erro ao buscar saldo da conta');
        }
      });

      const saldos = await Promise.all(saldosPromises);
      setSaldosContas(saldos);
      
      // Calcular saldo total
      const total = saldos.reduce((acc, conta) => acc + conta.saldo, 0);
      setSaldoTotal(total);
      
      setDadosCarregados(true);
    } catch (error) {
      console.error('Erro ao buscar saldos das contas:', error);
      setErro('Erro ao buscar dados do servidor.');
      setSaldosContas([]);
      setSaldoTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Calcular estatísticas
  const estatisticas = useMemo(() => {
    if (saldosContas.length === 0) {
      return {
        totalContas: 0,
        contasPositivas: 0,
        contasNegativas: 0,
        maiorSaldo: 0,
        menorSaldo: 0,
        saldoPorGrupo: {
          CROSBY: 0,
          FABIO: 0,
          'IRMÃOS CR': 0,
          FLAVIO: 0,
          OUTROS: 0
        }
      };
    }

    const contasPositivas = saldosContas.filter(conta => conta.saldo > 0).length;
    const contasNegativas = saldosContas.filter(conta => conta.saldo < 0).length;
    const maiorSaldo = Math.max(...saldosContas.map(conta => conta.saldo));
    const menorSaldo = Math.min(...saldosContas.map(conta => conta.saldo));

    // Calcular saldo por grupo
    const saldoPorGrupo = saldosContas.reduce((acc, conta) => {
      acc[conta.origem] = (acc[conta.origem] || 0) + conta.saldo;
      return acc;
    }, {
      CROSBY: 0,
      FABIO: 0,
      'IRMÃOS CR': 0,
      FLAVIO: 0,
      OUTROS: 0
    });

    return {
      totalContas: saldosContas.length,
      contasPositivas,
      contasNegativas,
      maiorSaldo,
      menorSaldo,
      saldoPorGrupo
    };
  }, [saldosContas]);

  const getVariacaoColor = (saldo) => {
    if (saldo > 0) return 'text-green-600';
    if (saldo < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getVariacaoIcon = (saldo) => {
    if (saldo > 0) return <TrendUp size={20} className="text-green-600" />;
    if (saldo < 0) return <TrendDown size={20} className="text-red-600" />;
    return null;
  };

  // Função para ordenar dados
  const handleOrdenar = (campo) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Função para obter ícone de ordenação
  const getIconeOrdenacao = (campo) => {
    if (ordenacao.campo !== campo) return null;
    return ordenacao.direcao === 'asc' ? 
      <CaretUp size={12} className="ml-1" /> : 
      <CaretDown size={12} className="ml-1" />;
  };

  // Dados ordenados
  const dadosOrdenados = useMemo(() => {
    if (!ordenacao.campo) return saldosContas;
    
    return [...saldosContas].sort((a, b) => {
      let valorA = a[ordenacao.campo];
      let valorB = b[ordenacao.campo];
      
      // Tratamento para valores monetários
      if (ordenacao.campo === 'saldo') {
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
  }, [saldosContas, ordenacao]);

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-barlow">
              Saldo Bancário
            </h1>
            <p className="text-gray-600 mt-2 font-barlow">
              Acompanhe o saldo das contas bancárias por período.
            </p>
          </div>

          {/* Formulário de Filtros */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <form onSubmit={buscarSaldosContas}>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt size={22} className="text-[#000638]" />
                  <span className="text-lg font-bold text-[#000638] font-barlow">
                    Filtros
                  </span>
                </div>
                <span className="text-sm text-gray-500 font-barlow">
                  Selecione o período, empresa e conta para análise
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="lg:col-span-2">
                  <FiltroEmpresa
                    empresasSelecionadas={empresasSelecionadas}
                    onSelectEmpresas={handleSelectEmpresas}
                  />
                </div>
                <div>
                  <label className="w-full block text-xs font-semibold mb-1 text-[#000638] font-barlow">
                    Contas
                  </label>
                  <DropdownContas
                    contas={contas}
                    contasSelecionadas={contasSelecionadas}
                    setContasSelecionadas={setContasSelecionadas}
                    minWidth={300}
                    maxWidth={400}
                    placeholder="Selecione as contas"
                    hideLabel={true}
                    className="!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-sm !overflow-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638] font-barlow">
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 font-barlow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638] font-barlow">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 font-barlow"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-[#000638] hover:bg-[#fe0000] disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition h-10 text-sm font-bold shadow-md tracking-wide uppercase font-barlow"
                >
                  {loading ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <ArrowsClockwise size={18} weight="bold" />
                  )}
                  {loading ? 'Carregando...' : 'Buscar Saldos'}
                </button>
              </div>
            </form>
            
            {erro && (
              <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center font-barlow">
                {erro}
              </div>
            )}
          </div>

                     {/* Cards de Resumo */}
           {dadosCarregados && (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8 max-w-7xl mx-auto">
               {/* Saldo Total */}
               <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                 <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <Bank size={18} className="text-blue-600" />
                     <CardTitle className="text-sm font-bold text-blue-700">Saldo Total</CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 px-4 pb-4">
                   <div className="text-lg font-extrabold text-blue-600 mb-1 break-words">
                     {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : 
                       formatCurrency(saldoTotal)
                     }
                   </div>
                   <CardDescription className="text-xs text-gray-500">{estatisticas.totalContas} conta(s) analisada(s)</CardDescription>
                 </CardContent>
               </Card>

               {/* Contas Positivas */}
               <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                 <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <TrendUp size={18} className="text-green-600" />
                     <CardTitle className="text-sm font-bold text-green-700">Contas Positivas</CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 px-4 pb-4">
                   <div className="text-2xl font-extrabold text-green-600 mb-1">
                     {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                       estatisticas.contasPositivas
                     }
                   </div>
                   <CardDescription className="text-xs text-gray-500">Saldo positivo</CardDescription>
                 </CardContent>
               </Card>

               {/* Contas Negativas */}
               <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                 <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <TrendDown size={18} className="text-red-600" />
                     <CardTitle className="text-sm font-bold text-red-700">Contas Negativas</CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 px-4 pb-4">
                   <div className="text-2xl font-extrabold text-red-600 mb-1">
                     {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                       estatisticas.contasNegativas
                     }
                   </div>
                   <CardDescription className="text-xs text-gray-500">Saldo negativo</CardDescription>
                 </CardContent>
               </Card>

               {/* Maior Saldo */}
               <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                 <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <Plus size={18} className="text-purple-600" />
                     <CardTitle className="text-sm font-bold text-purple-700">Maior Saldo</CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 px-4 pb-4">
                   <div className="text-lg font-extrabold text-purple-600 mb-1 break-words">
                     {loading ? <Spinner size={24} className="animate-spin text-purple-600" /> : 
                       formatCurrency(estatisticas.maiorSaldo)
                     }
                   </div>
                   <CardDescription className="text-xs text-gray-500">Valor mais alto</CardDescription>
                 </CardContent>
               </Card>

               {/* Saldo por Grupo - CROSBY */}
               <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                 <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <Bank size={18} className="text-blue-600" />
                     <CardTitle className="text-sm font-bold text-blue-700">CROSBY</CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 px-4 pb-4">
                   <div className={`text-lg font-extrabold ${getVariacaoColor(estatisticas.saldoPorGrupo.CROSBY)} mb-1 break-words`}>
                     {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : 
                       formatCurrency(estatisticas.saldoPorGrupo.CROSBY)
                     }
                   </div>
                   <CardDescription className="text-xs text-gray-500">Saldo total CROSBY</CardDescription>
                 </CardContent>
               </Card>

               {/* Saldo por Grupo - FABIO */}
               <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                 <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <Bank size={18} className="text-yellow-600" />
                     <CardTitle className="text-sm font-bold text-yellow-700">FABIO</CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 px-4 pb-4">
                   <div className={`text-lg font-extrabold ${getVariacaoColor(estatisticas.saldoPorGrupo.FABIO)} mb-1 break-words`}>
                     {loading ? <Spinner size={24} className="animate-spin text-yellow-600" /> : 
                       formatCurrency(estatisticas.saldoPorGrupo.FABIO)
                     }
                   </div>
                   <CardDescription className="text-xs text-gray-500">Saldo total FABIO</CardDescription>
                 </CardContent>
               </Card>

               {/* Saldo por Grupo - IRMÃOS CR */}
               <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                 <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <Bank size={18} className="text-orange-600" />
                     <CardTitle className="text-sm font-bold text-orange-700">IRMÃOS CR</CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 px-4 pb-4">
                   <div className={`text-lg font-extrabold ${getVariacaoColor(estatisticas.saldoPorGrupo['IRMÃOS CR'])} mb-1 break-words`}>
                     {loading ? <Spinner size={24} className="animate-spin text-orange-600" /> : 
                       formatCurrency(estatisticas.saldoPorGrupo['IRMÃOS CR'])
                     }
                   </div>
                   <CardDescription className="text-xs text-gray-500">Saldo total IRMÃOS CR</CardDescription>
                 </CardContent>
               </Card>

                               {/* Saldo por Grupo - FLAVIO */}
                <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Bank size={18} className="text-green-600" />
                      <CardTitle className="text-sm font-bold text-green-700">FLAVIO</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-4">
                    <div className={`text-lg font-extrabold ${getVariacaoColor(estatisticas.saldoPorGrupo.FLAVIO)} mb-1 break-words`}>
                      {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                        formatCurrency(estatisticas.saldoPorGrupo.FLAVIO)
                      }
                    </div>
                    <CardDescription className="text-xs text-gray-500">Saldo total FLAVIO</CardDescription>
                  </CardContent>
                </Card>

                
             </div>
           )}

          {/* Tabela de Saldos */}
          {dadosCarregados && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                Saldos por Conta
              </h2>
              
              <div className="overflow-x-auto">
                                 <table className="w-full">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th 
                         className="text-left py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('numero')}
                       >
                         <div className="flex items-center">
                           Conta
                           {getIconeOrdenacao('numero')}
                         </div>
                       </th>
                       <th 
                         className="text-left py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('nome')}
                       >
                         <div className="flex items-center">
                           Nome
                           {getIconeOrdenacao('nome')}
                         </div>
                       </th>
                       <th 
                         className="text-center py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('origem')}
                       >
                         <div className="flex items-center justify-center">
                           Origem
                           {getIconeOrdenacao('origem')}
                         </div>
                       </th>
                       <th 
                         className="text-right py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('saldo')}
                       >
                         <div className="flex items-center justify-end">
                           Saldo
                           {getIconeOrdenacao('saldo')}
                         </div>
                       </th>
                       <th className="text-center py-3 px-4 font-semibold text-gray-900 font-barlow">
                         Status
                       </th>
                     </tr>
                   </thead>
                                     <tbody>
                     {dadosOrdenados.map((conta) => (
                       <tr key={conta.numero} className="border-b border-gray-100 hover:bg-gray-50">
                         <td className="py-3 px-4 font-medium text-gray-900 font-barlow">
                           {conta.numero}
                         </td>
                         <td className="py-3 px-4 text-gray-600 font-barlow">
                           {conta.nome}
                         </td>
                         <td className="py-3 px-4 text-center">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrigemColors(conta.origem)} font-barlow`}>
                             {conta.origem}
                           </span>
                         </td>
                         <td className="py-3 px-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                             <span className={`font-semibold text-lg ${getVariacaoColor(conta.saldo)} font-barlow`}>
                               {formatCurrency(conta.saldo)}
                             </span>
                             {getVariacaoIcon(conta.saldo)}
                           </div>
                         </td>
                         <td className="py-3 px-4 text-center">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                             conta.saldo > 0 
                               ? 'bg-green-100 text-green-800' 
                               : conta.saldo < 0
                               ? 'bg-red-100 text-red-800'
                               : 'bg-gray-100 text-gray-800'
                           } font-barlow`}>
                             {conta.saldo > 0 ? 'Positivo' : conta.saldo < 0 ? 'Negativo' : 'Zerado'}
                           </span>
                         </td>
                       </tr>
                     ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Estado inicial */}
          {!dadosCarregados && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Bank size={64} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2 font-barlow">
                Nenhum saldo carregado
              </h3>
              <p className="text-gray-600 font-barlow">
                Selecione os filtros e clique em "Buscar Saldos" para visualizar os dados.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SaldoBancario;
