import React, { useState, useEffect } from 'react';
import { Receipt, MagnifyingGlass, CircleNotch } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import SEOHead from '../components/ui/SEOHead';
import useApiClient from '../hooks/useApiClient';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/cards';
import LoadingSpinner from '../components/LoadingSpinner';
import Notification from '../components/ui/Notification';

const AnaliseTransacao = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Estados para filtro de data
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(
    firstDay.toISOString().split('T')[0],
  );
  const [dataFim, setDataFim] = useState(today.toISOString().split('T')[0]);

  // Estados para filtros
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroNomeGrupo, setFiltroNomeGrupo] = useState('');
  const [filtroTransacao, setFiltroTransacao] = useState('');

  // Função para buscar dados da API
  const fetchDados = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando dados de fatvarejo...');

      const params = {
        dataInicio,
        dataFim,
      };

      const response = await apiClient.sales.faturamentoVarejo(params);

      // Verificar estrutura da resposta
      let dadosRecebidos = [];
      if (response?.success && response?.data) {
        dadosRecebidos = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        dadosRecebidos = response;
      }

      console.log('📊 Dados recebidos de fatvarejo:', dadosRecebidos);
      setDados(dadosRecebidos);

      if (dadosRecebidos.length === 0) {
        setNotification({
          type: 'info',
          message: 'Nenhuma transação encontrada',
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados de fatvarejo:', error);
      setNotification({
        type: 'error',
        message: 'Erro ao carregar dados de transações',
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchDados();
  }, []);

  // Função para formatar moeda
  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  // Filtrar dados baseado nos filtros
  const dadosFiltrados = dados.filter((transacao) => {
    const grupoMatch =
      !filtroGrupo ||
      (transacao.cd_grupoempresa &&
        transacao.cd_grupoempresa
          .toString()
          .toLowerCase()
          .includes(filtroGrupo.toLowerCase()));

    const nomeGrupoMatch =
      !filtroNomeGrupo ||
      (transacao.nm_grupoempresa &&
        transacao.nm_grupoempresa
          .toLowerCase()
          .includes(filtroNomeGrupo.toLowerCase()));

    const transacaoMatch =
      !filtroTransacao ||
      (transacao.nr_transacao &&
        transacao.nr_transacao
          .toString()
          .toLowerCase()
          .includes(filtroTransacao.toLowerCase()));

    return grupoMatch && nomeGrupoMatch && transacaoMatch;
  });

  // Calcular totais de transações (usando dados filtrados)
  const totalTransacoes = dadosFiltrados.length;
  const valorTotalSemDesconto = dadosFiltrados.reduce(
    (acc, item) => acc + (parseFloat(item.valor_sem_desconto) || 0),
    0,
  );
  const valorTotalComDesconto = dadosFiltrados.reduce(
    (acc, item) => acc + (parseFloat(item.valor_com_desconto) || 0),
    0,
  );

  return (
    <div className="w-full">
      <SEOHead
        title="Análise de Transação - Crosby"
        description="Análise detalhada das transações do varejo"
      />

      <div className="max-w-7xl mx-auto p-6">
        <PageTitle
          title="Análise de Transação"
          subtitle="Análise detalhada das transações do varejo"
          icon={Receipt}
          iconColor="text-blue-600"
        />

        {/* Filtro Unificado */}
        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MagnifyingGlass size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Filtros
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <CardDescription className="text-xs text-gray-500 mb-4">
              Configure os filtros para análise das transações
              {(filtroGrupo || filtroNomeGrupo || filtroTransacao) && (
                <span className="ml-2 text-blue-600 font-semibold">
                  ({dadosFiltrados.length} de {dados.length} transações)
                </span>
              )}
            </CardDescription>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Data Início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Código do Grupo
                </label>
                <input
                  type="text"
                  placeholder="Código do grupo..."
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Nome do Grupo
                </label>
                <input
                  type="text"
                  placeholder="Nome do grupo..."
                  value={filtroNomeGrupo}
                  onChange={(e) => setFiltroNomeGrupo(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Número da Transação
                </label>
                <input
                  type="text"
                  placeholder="Número da transação..."
                  value={filtroTransacao}
                  onChange={(e) => setFiltroTransacao(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchDados}
                  disabled={loading}
                  className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors w-full justify-center"
                >
                  {loading ? (
                    <>
                      <CircleNotch size={16} className="animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <MagnifyingGlass size={16} />
                      Buscar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Botão para limpar filtros */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setFiltroGrupo('');
                  setFiltroNomeGrupo('');
                  setFiltroTransacao('');
                }}
                className="flex items-center gap-2 bg-gray-500 text-white px-3 py-1.5 rounded-lg hover:bg-gray-600 font-medium transition-colors text-xs"
              >
                <MagnifyingGlass size={14} />
                Limpar Filtros
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700">
                  Total de Transações
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-blue-600 mb-0.5">
                {totalTransacoes}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Transações encontradas
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-700">
                  Valor Sem Desconto
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-orange-600 mb-0.5">
                {formatarMoeda(valorTotalSemDesconto)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor total sem desconto
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">
                  Valor Com Desconto
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-green-600 mb-0.5">
                {formatarMoeda(valorTotalComDesconto)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor total com desconto
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Transações */}
        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Lista de Transações
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <CardDescription className="text-xs text-gray-500 mb-4">
              Detalhes de todas as transações encontradas
            </CardDescription>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" text="Carregando transações..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">Código Empresa</th>
                      <th className="px-4 py-3">Nome Empresa</th>
                      <th className="px-4 py-3">Número da Transação</th>
                      <th className="px-4 py-3">Valor Sem Desconto</th>
                      <th className="px-4 py-3">Valor Com Desconto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          {dados.length === 0
                            ? 'Nenhuma transação encontrada'
                            : 'Nenhuma transação corresponde aos filtros aplicados'}
                        </td>
                      </tr>
                    ) : (
                      dadosFiltrados.map((transacao, index) => (
                        <tr
                          key={index}
                          className="bg-white border-b hover:bg-blue-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded">
                              {transacao.cd_grupoempresa || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded">
                              {transacao.nm_grupoempresa || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                              {transacao.nr_transacao || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-orange-600">
                            {formatarMoeda(transacao.valor_sem_desconto)}
                          </td>
                          <td className="px-4 py-3 font-medium text-green-600">
                            {formatarMoeda(transacao.valor_com_desconto)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notificação */}
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </div>
  );
};

export default AnaliseTransacao;
