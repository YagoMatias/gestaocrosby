import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../components/AuthContext';
import useApiClient from '../hooks/useApiClient';
import { 
  ChartLineUp, 
  Money, 
  Buildings, 
  Users, 
  Trophy,
  TrendUp,
  ShoppingCart,
  Spinner
} from '@phosphor-icons/react';

const Dashboard = () => {
  const { user } = useAuth();
  const apiClient = useApiClient();
  
  const [stats, setStats] = useState({
    faturamentoTotal: { value: 'R$ 0', change: '0%', changeType: 'neutral' },
    contasAPagar: { value: 'R$ 0', change: '0%', changeType: 'neutral' },
    contasAReceber: { value: 'R$ 0', change: '0%', changeType: 'neutral' },
    lojasAtivas: { value: '0', change: '0', changeType: 'neutral' }
  });
  
  const [loading, setLoading] = useState(true);

  // Função para formatar valores monetários
  const formatCurrency = (value) => {
    if (typeof value === 'number') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    }
    return value;
  };

  // Função para calcular a data de hoje e de 2 meses atrás
  const getDateRange = () => {
    const hoje = new Date();
    const doisMesesAtras = new Date();
    doisMesesAtras.setMonth(hoje.getMonth() - 2);
    
    // Calcular primeiro e último dia do mês atual
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    return {
      hoje: hoje.toISOString().split('T')[0],
      doisMesesAtras: doisMesesAtras.toISOString().split('T')[0],
      primeiroDiaMes: primeiroDiaMes.toISOString().split('T')[0],
      ultimoDiaMes: ultimoDiaMes.toISOString().split('T')[0]
    };
  };

  // Função para buscar dados do faturamento
  const buscarFaturamento = async () => {
    try {
      const { primeiroDiaMes, ultimoDiaMes } = getDateRange();
      const params = {
        dt_inicio: primeiroDiaMes,
        dt_fim: ultimoDiaMes,
        cd_grupoempresa_ini: 1,
        cd_grupoempresa_fim: 9999
      };

      const result = await apiClient.company.faturamentoLojas(params);
      
      if (result.success && result.data) {
        const totalFaturamento = result.data.reduce((acc, item) => acc + parseFloat(item.faturamento || 0), 0);
        setStats(prev => ({
          ...prev,
          faturamentoTotal: {
            value: formatCurrency(totalFaturamento),
            change: '+0%',
            changeType: 'positive'
          }
        }));
      } else {
        console.warn('API de faturamento não retornou dados válidos:', result);
      }
    } catch (error) {
      console.error('Erro ao buscar faturamento:', error);
    }
  };

  // Função para buscar dados de contas a pagar
  const buscarContasAPagar = async () => {
    try {
      const { primeiroDiaMes, ultimoDiaMes } = getDateRange();
      
      // Usar apenas as empresas do FiltroEmpresa (mesmas empresas usadas no sistema)
      const codigosEmpresas = ['1','2','5','6','7','11','31','55','65','75','85','90','91','92','93','94','95','96','97','99','100','111','200','311','500','550','600','650','700','750','850','890','910','920','930','940','950','960','970','990'];
      
      if (codigosEmpresas.length === 0) {
        console.warn('Nenhuma empresa encontrada para contas a pagar');
        return;
      }

      // Fazer chamadas individuais para cada empresa (como na página original)
      const todasAsPromises = codigosEmpresas.map(async (cdEmpresa) => {
        try {
          const params = {
            dt_inicio: primeiroDiaMes,
            dt_fim: ultimoDiaMes,
            cd_empresa: cdEmpresa
          };

                     const result = await apiClient.financial.contasPagar(params);
           
           console.log(`🏢 Contas a Pagar - Empresa ${cdEmpresa}:`, result);
           
           if (result.success && result.data) {
             // A API retorna os dados em result.data.data
             const dados = result.data.data || result.data;
             console.log(`📋 Dados da empresa ${cdEmpresa}:`, dados);
             return dados;
           }
           return [];
        } catch (error) {
          console.warn(`Erro ao buscar empresa ${cdEmpresa}:`, error);
          return [];
        }
      });

             const resultados = await Promise.all(todasAsPromises);
       const todosOsDados = resultados.flat();
       
       console.log('📊 Contas a Pagar - Dados obtidos:', {
         totalRegistros: todosOsDados.length,
         amostra: todosOsDados.slice(0, 3),
         camposDisponiveis: todosOsDados.length > 0 ? Object.keys(todosOsDados[0]) : []
       });
       
       // Aplicar os mesmos filtros da página ContasAPagar
       // Filtro por situação: NORMAIS (apenas tp_situacao = 'N')
       const dadosFiltradosSituacao = todosOsDados.filter(item => item.tp_situacao === 'N');
       
       // Filtro por status: Todos (não filtra por status)
       const dadosFiltradosCompletos = dadosFiltradosSituacao;
       
       console.log('🔍 Contas a Pagar - Após filtros:', {
         totalOriginal: todosOsDados.length,
         totalAposSituacao: dadosFiltradosSituacao.length,
         totalFinal: dadosFiltradosCompletos.length
       });
       
       const totalContasPagar = dadosFiltradosCompletos.reduce((acc, item) => acc + parseFloat(item.vl_duplicata || 0), 0);
      setStats(prev => ({
        ...prev,
        contasAPagar: {
          value: formatCurrency(totalContasPagar),
          change: '+0%',
          changeType: 'negative'
        }
      }));
    } catch (error) {
      console.error('Erro ao buscar contas a pagar:', error);
    }
  };

  // Função para buscar dados de contas a receber
  const buscarContasAReceber = async () => {
    try {
      const { primeiroDiaMes, ultimoDiaMes } = getDateRange();
      
      // Usar apenas as empresas do FiltroEmpresa (mesmas empresas usadas no sistema)
      const codigosEmpresas = ['1','2','5','6','7','11','31','55','65','75','85','90','91','92','93','94','95','96','97','99','100','111','200','311','500','550','600','650','700','750','850','890','910','920','930','940','950','960','970','990'];
      
      if (codigosEmpresas.length === 0) {
        console.warn('Nenhuma empresa encontrada para contas a receber');
        return;
      }

      // Fazer chamadas individuais para cada empresa (como na página original)
      const todasAsPromises = codigosEmpresas.map(async (cdEmpresa) => {
        try {
          const params = {
            dt_inicio: primeiroDiaMes,
            dt_fim: ultimoDiaMes,
            cd_empresa: cdEmpresa
          };

                     const result = await apiClient.financial.contasReceber(params);
           
           if (result.success && result.data) {
             // A API retorna os dados em result.data.data
             return result.data.data || result.data;
           }
           return [];
        } catch (error) {
          console.warn(`Erro ao buscar empresa ${cdEmpresa}:`, error);
          return [];
        }
      });

             const resultados = await Promise.all(todasAsPromises);
       const todosOsDados = resultados.flat();
       
       // Aplicar os mesmos filtros da página ContasAReceber
       // Filtro por situação: NORMAIS (apenas itens que NÃO têm data de cancelamento)
       const dadosFiltradosSituacao = todosOsDados.filter(item => !item.dt_cancelamento);
       
       // Filtro por status: Todos (não filtra por status)
       const dadosFiltradosCompletos = dadosFiltradosSituacao;
       
       // Log para debug dos valores de cancelamento
       const itensComCancelamento = todosOsDados.filter(item => item.dt_cancelamento);
       const itensSemCancelamento = todosOsDados.filter(item => !item.dt_cancelamento);
       
       console.log('🔍 Contas a Receber - Debug cancelamento:', {
         totalOriginal: todosOsDados.length,
         itensComCancelamento: itensComCancelamento.length,
         itensSemCancelamento: itensSemCancelamento.length,
         totalAposSituacao: dadosFiltradosSituacao.length,
         totalFinal: dadosFiltradosCompletos.length,
         amostraComCancelamento: itensComCancelamento.slice(0, 2),
         amostraSemCancelamento: itensSemCancelamento.slice(0, 2)
       });
       
       const totalContasReceber = dadosFiltradosCompletos.reduce((acc, item) => acc + parseFloat(item.vl_fatura || 0), 0);
      setStats(prev => ({
        ...prev,
        contasAReceber: {
          value: formatCurrency(totalContasReceber),
          change: '+0%',
          changeType: 'positive'
        }
      }));
    } catch (error) {
      console.error('Erro ao buscar contas a receber:', error);
    }
  };

  // Função para buscar número de lojas ativas
  const buscarLojasAtivas = async () => {
    try {
      const { doisMesesAtras, hoje } = getDateRange();
      const params = {
        dt_inicio: doisMesesAtras,
        dt_fim: hoje,
        cd_grupoempresa_ini: 1,
        cd_grupoempresa_fim: 9999
      };

      const result = await apiClient.company.faturamentoLojas(params);
      
      if (result.success && result.data) {
        // Contar lojas únicas que tiveram faturamento
        const lojasUnicas = new Set(result.data.map(item => item.cd_grupoempresa || item.nm_grupoempresa));
        setStats(prev => ({
          ...prev,
          lojasAtivas: {
            value: lojasUnicas.size.toString(),
            change: '+0',
            changeType: 'positive'
          }
        }));
      } else {
        console.warn('API de lojas ativas não retornou dados válidos:', result);
      }
    } catch (error) {
      console.error('Erro ao buscar lojas ativas:', error);
    }
  };

  // Carregar todos os dados
  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true);
      try {
        await Promise.all([
          buscarFaturamento(),
          buscarContasAPagar(),
          buscarContasAReceber(),
          buscarLojasAtivas()
        ]);
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, []);

  const statsCards = [
    {
      title: 'Faturamento Total',
      value: stats.faturamentoTotal.value,
      change: stats.faturamentoTotal.change,
      changeType: stats.faturamentoTotal.changeType,
      icon: ChartLineUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Contas a Pagar',
      value: stats.contasAPagar.value,
      change: stats.contasAPagar.change,
      changeType: stats.contasAPagar.changeType,
      icon: Money,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Contas a Receber',
      value: stats.contasAReceber.value,
      change: stats.contasAReceber.change,
      changeType: stats.contasAReceber.changeType,
      icon: Money,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Lojas Ativas',
      value: stats.lojasAtivas.value,
      change: stats.lojasAtivas.change,
      changeType: stats.lojasAtivas.changeType,
      icon: Buildings,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  const quickActions = [
    {
      title: 'Ranking Faturamento',
      description: 'Visualizar ranking de faturamento',
      icon: Trophy,
      href: '/ranking-faturamento',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Ranking Vendedores',
      description: 'Ver performance dos vendedores',
      icon: Users,
      href: '/ranking-vendedores',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Fluxo de Caixa',
      description: 'Análise do fluxo de caixa',
      icon: TrendUp,
      href: '/fluxo-caixa',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'Compras Franquias',
      description: 'Gestão de compras das franquias',
      icon: ShoppingCart,
      href: '/compras-franquias',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <Layout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-barlow">
              Dashboard
            </h1>
            <p className="text-gray-600 mt-2 font-barlow">
              Bem-vindo, {user?.name}. Aqui está um resumo das principais métricas.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {loading ? (
              // Loading state
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse"></div>
                      <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-100">
                      <Spinner size={24} className="text-gray-400 animate-spin" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-24 ml-2 animate-pulse"></div>
                  </div>
                </div>
              ))
            ) : (
              // Data state
              statsCards.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 font-barlow">
                          {stat.title}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1 font-barlow">
                          {stat.value}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                        <IconComponent size={24} className={stat.color} />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center">
                      <span className={`text-sm font-medium ${
                        stat.changeType === 'positive' ? 'text-green-600' : 
                        stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-500 ml-2 font-barlow">
                        {stat.title === 'Lojas Ativas' ? 'últimos 2 meses' : 'vs mês anterior'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
              Ações Rápidas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <a
                    key={index}
                    href={action.href}
                    className="group block p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className={`p-3 rounded-lg ${action.bgColor} w-fit mb-3`}>
                      <IconComponent size={20} className={action.color} />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 font-barlow">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600 font-barlow">
                      {action.description}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
              Atividade Recente
            </h2>
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-4"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 font-barlow">
                    Nova fatura processada
                  </p>
                  <p className="text-xs text-gray-500 font-barlow">
                    Fatura #12345 foi processada com sucesso
                  </p>
                </div>
                <span className="text-xs text-gray-500 font-barlow">2 min atrás</span>
              </div>
              
              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-4"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 font-barlow">
                    Relatório gerado
                  </p>
                  <p className="text-xs text-gray-500 font-barlow">
                    Relatório de fluxo de caixa foi gerado
                  </p>
                </div>
                <span className="text-xs text-gray-500 font-barlow">15 min atrás</span>
              </div>
              
              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-4"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 font-barlow">
                    Atualização de ranking
                  </p>
                  <p className="text-xs text-gray-500 font-barlow">
                    Ranking de vendedores foi atualizado
                  </p>
                </div>
                <span className="text-xs text-gray-500 font-barlow">1 hora atrás</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
