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
  const [selectedBiPanel, setSelectedBiPanel] = useState(0);

  // Array com todos os painéis BI
  const biPanels = [
    {
      id: 1,
      title: 'Gestão PCP',
      description: 'Métricas detalhadas de PCP',
      url: 'https://app.powerbi.com/view?r=eyJrIjoiMzczYTRkZjgtNTUwYS00ZWEzLTkzYTEtZDdhNTE3MGNmMTc3IiwidCI6IjRhZWQyODQ0LWFkZTktNDUzMC1hN2U4LWJmNzM3MjhmMTM4NSJ9'
    },
    {
      id: 2,
      title: 'Funil de Franquias',
      description: 'Painel de Funil das Franquias',
      url: 'https://app.powerbi.com/view?r=eyJrIjoiNjA1YjhkOGItYTgxYi00OGIzLTk4MDEtNTUyNzE0MjE2N2ZhIiwidCI6IjRhZWQyODQ0LWFkZTktNDUzMC1hN2U4LWJmNzM3MjhmMTM4NSJ9'
    },
    {
      id: 3,
      title: 'Indicadores de Cashback',
      description: 'Análise de Cashback utilizado pelos clientes',
      url: 'https://app.powerbi.com/view?r=eyJrIjoiYzE4NzZjZTEtYzRhNS00Y2I0LWEwYzEtMmI1ZDU3MThmNGQyIiwidCI6IjRhZWQyODQ0LWFkZTktNDUzMC1hN2U4LWJmNzM3MjhmMTM4NSJ9'
    },
    {
      id: 4,
      title: 'Performance Operacional',
      description: 'Métricas de eficiência e produtividade',
      url: 'https://app.powerbi.com/view?r=eyJrIjoiZDcxODA0OTMtYWY3ZC00MzY2LWFmODAtZGRiMzY4MTYwMzE3IiwidCI6IjRhZWQyODQ0LWFkZTktNDUzMC1hN2U4LWJmNzM3MjhmMTM4NSJ9'
    },
    {
      id: 5,
      title: 'Indicadores do Vigia',
      description: 'Análise detalhada do Vigia',
      url: 'https://app.powerbi.com/view?r=eyJrIjoiZTlkNDZkZjYtOTRmNC00MzMxLWJhMTAtM2U4NWQ4OWRlNzY5IiwidCI6IjRhZWQyODQ0LWFkZTktNDUzMC1hN2U4LWJmNzM3MjhmMTM4NSJ9'
    },
    {
      id: 6,
      title: 'Looker Studio Rafael',
      description: 'Relatórios avançados de Rafael',
      url: 'https://lookerstudio.google.com/u/0/reporting/fa465a90-1e72-4284-aa8a-2f5ba9cbf86b'
    }
  ];

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
      
      // Mesmas empresas usadas no sistema
      const codigosEmpresas = ['1','2','5','6','7','11','31','55','65','75','85','90','91','92','93','94','95','96','97','98','99','100','111','200','311','500','550','600','650','700','750','850','890','910','920','930','940','950','960','970','980','990'];
      if (codigosEmpresas.length === 0) {
        console.warn('Nenhuma empresa encontrada para contas a pagar');
        return;
      }

      const params = {
        dt_inicio: primeiroDiaMes,
        dt_fim: ultimoDiaMes,
        cd_empresa: codigosEmpresas
      };

      const result = await apiClient.financial.contasPagar(params);
      const todosOsDados = (result.success && Array.isArray(result.data)) ? result.data : [];
      
      // Aplicar os mesmos filtros da página ContasAPagar
      // Filtro por situação: NORMAIS (apenas tp_situacao = 'N')
      const dadosFiltradosSituacao = todosOsDados.filter(item => item.tp_situacao === 'N');
      
      // Filtro por status: Todos (não filtra por status)
      const dadosFiltradosCompletos = dadosFiltradosSituacao;
      
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
       const dadosFiltradosSituacaoReceber = todosOsDados.filter(item => !item.dt_cancelamento);
       
       // Filtro por status: Todos (não filtra por status)
       const dadosFiltradosCompletos = dadosFiltradosSituacaoReceber;
       
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
      title: 'Consolidado',
      description: 'Relatório consolidado geral',
      icon: ChartLineUp,
      href: '/consolidado',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
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
      title: 'Contas a Pagar',
      description: 'Gestão de contas a pagar',
      icon: Money,
      href: '/contas-pagar',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Looker Studio',
      description: 'Relatórios avançados do Google',
      icon: ChartLineUp,
      href: 'https://lookerstudio.google.com/u/0/reporting/fa465a90-1e72-4284-aa8a-2f5ba9cbf86b',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      external: true
    }
  ];

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {quickActions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <a
                    key={index}
                    href={action.href}
                    target={action.external ? "_blank" : undefined}
                    rel={action.external ? "noopener noreferrer" : undefined}
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

          {/* Painel BI */}
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 font-barlow">
                Painel BI
              </h2>
            </div>
            
            {/* Filtro de seleção do painel */}
            <div className="mb-6">
              <label htmlFor="bi-panel-select" className="block text-sm font-medium text-gray-700 mb-2 font-barlow">
                Selecione o Painel BI
              </label>
              <select
                id="bi-panel-select"
                value={selectedBiPanel}
                onChange={(e) => setSelectedBiPanel(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-barlow"
                disabled={loading}
              >
                {biPanels.map((panel, index) => (
                  <option key={panel.id} value={index}>
                    {panel.title}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Título do painel atual */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 font-barlow">
                {biPanels[selectedBiPanel].title}
              </h3>
              <p className="text-sm text-gray-600 font-barlow">
                {biPanels[selectedBiPanel].description}
              </p>
            </div>
            
            {/* Iframe do Power BI ou Botão para Looker Studio */}
            <div className="w-full">
              {biPanels[selectedBiPanel].title.includes('Looker Studio') ? (
                // Para Looker Studio, mostrar botão para abrir em nova aba
                <div className="flex flex-col items-center justify-center" style={{ height: '600px' }}>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ChartLineUp size={32} className="text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 font-barlow">
                      {biPanels[selectedBiPanel].title}
                    </h3>
                    <p className="text-gray-600 mb-6 font-barlow max-w-md">
                      Clique no botão abaixo para acessar o relatório no Looker Studio
                    </p>
                    <a
                      href={biPanels[selectedBiPanel].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-barlow font-semibold"
                    >
                      ABRIR LOOKER STUDIO
                    </a>
                  </div>
                </div>
              ) : (
                // Para Power BI, usar iframe normalmente
                <>
                  <div className="relative w-full" style={{ height: '600px' }}>
                    <iframe
                      title={`Painel BI - ${biPanels[selectedBiPanel].title}`}
                      src={biPanels[selectedBiPanel].url}
                      className="w-full h-full rounded-lg border border-gray-200"
                      frameBorder="0"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600 font-barlow">
                      Painel de Business Intelligence integrado - Visualize dados em tempo real
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

 
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
