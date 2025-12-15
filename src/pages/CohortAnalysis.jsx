import React, { useState, useEffect } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import FiltroEmpresa from '../components/FiltroEmpresa';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Users,
  TrendUp,
  Calendar,
  Percent,
  Funnel,
  MagnifyingGlass,
} from '@phosphor-icons/react';

const CohortAnalysis = () => {
  const apiClient = useApiClient();

  const [cohortData, setCohortData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [anoSelecionado, setAnoSelecionado] = useState('');
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);

  // Função para buscar dados da API
  const fetchCohortData = async () => {
    setLoading(true);
    setError('');

    try {
      const params = {};

      // Se houver empresas selecionadas, enviar todas separadas por vírgula
      if (empresasSelecionadas.length > 0) {
        // FiltroEmpresa retorna array de objetos, precisamos extrair o cd_empresa de cada um
        const codigosEmpresas = empresasSelecionadas
          .map((emp) => emp.cd_empresa || emp)
          .join(',');
        params.cd_grupoempresa = codigosEmpresas;
      }

      if (anoSelecionado) params.cohort_year = anoSelecionado;
      if (mesSelecionado) params.cohort_month = mesSelecionado;

      console.log('📊 Buscando cohort com filtros:', params);
      console.log(
        `📊 ${empresasSelecionadas.length} empresas selecionadas:`,
        empresasSelecionadas.map((e) => e.nm_grupoempresa),
      );

      const response = await apiClient.apiCall(
        '/api/sales/cohort-analysis',
        params,
      );

      console.log('📊 Cohort Data:', response);

      if (response.success) {
        // Ordenar cohorts por ano e mês (ordem cronológica)
        const sortedData = {
          ...response.data,
          cohorts: response.data.cohorts.sort((a, b) => {
            // Primeiro ordena por ano
            if (a.cohort_year !== b.cohort_year) {
              return a.cohort_year - b.cohort_year;
            }
            // Depois por mês
            if (a.cohort_month !== b.cohort_month) {
              return a.cohort_month - b.cohort_month;
            }
            // Por último por empresa (se aplicável)
            return String(a.cd_grupoempresa).localeCompare(
              String(b.cd_grupoempresa),
            );
          }),
        };

        setCohortData(sortedData);
        setDadosCarregados(true);
      } else {
        setError(response.message || 'Erro ao buscar dados de cohort');
      }
    } catch (err) {
      console.error('❌ Erro ao buscar cohort:', err);
      setError(err.message || 'Erro ao carregar análise de cohort');
    } finally {
      setLoading(false);
    }
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setEmpresasSelecionadas([]);
    setAnoSelecionado('');
    setMesSelecionado('');
    setCohortData(null);
    setDadosCarregados(false);
    setError('');
  };

  // Função para formatar percentual
  const formatPercent = (value) => {
    return `${parseFloat(value || 0).toFixed(1)}%`;
  };

  // Função para obter cor baseada na taxa de retenção
  const getRetentionColor = (retention, isFirstMonth = false) => {
    if (isFirstMonth) return 'rgba(255, 255, 255, 1)'; // Branco para mês 0

    // Escala de cores invertida: 0-2 verde, 2.1-5 azul, 5.1-8 laranja, 8.1+ vermelho
    if (retention > 8) {
      // Vermelho: 8.1% ou mais
      const intensity = Math.min((retention - 8.1) / 91.9, 1); // 8.1-100%
      return `rgba(239, 68, 68, ${0.4 + intensity * 0.6})`; // Vermelho
    } else if (retention > 5) {
      // Laranja: 5.1-8%
      const intensity = (retention - 5.1) / 2.9; // 5.1-8%
      return `rgba(249, 115, 22, ${0.4 + intensity * 0.6})`; // Laranja
    } else if (retention > 2) {
      // Azul: 2.1-5%
      const intensity = (retention - 2.1) / 2.9; // 2.1-5%
      return `rgba(59, 130, 246, ${0.4 + intensity * 0.6})`; // Azul
    } else {
      // Verde: 0-2%
      const intensity = Math.max(retention / 2, 0.4); // 0-2%
      return `rgba(34, 197, 94, ${intensity})`; // Verde
    }
  };

  // Função para renderizar a matriz de cohort
  const renderCohortMatrix = () => {
    if (!cohortData?.cohorts || cohortData.cohorts.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado de cohort disponível para o período selecionado
        </div>
      );
    }

    // Encontrar o número máximo de meses para criar as colunas
    const maxMonths = Math.max(
      ...cohortData.cohorts.map((c) =>
        Math.max(...c.retention_by_month.map((r) => r.months_since_cohort)),
      ),
    );

    return (
      <div className="overflow-x-auto shadow-sm rounded-lg">
        <table className="min-w-full border-collapse bg-white">
          <thead>
            <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
              <th className="border border-gray-400 px-4 py-3 text-left font-bold text-sm sticky left-0 bg-gradient-to-r from-gray-700 to-gray-800 z-10">
                Cohort
              </th>
              <th className="border border-gray-400 px-3 py-3 text-center font-bold text-sm">
                Empresa
              </th>
              <th className="border border-gray-400 px-3 py-3 text-center font-bold text-sm bg-gray-600">
                Novos Clientes
              </th>
              {Array.from({ length: maxMonths }, (_, i) => (
                <th
                  key={i}
                  className="border border-gray-400 px-3 py-3 text-center font-bold text-xs whitespace-nowrap"
                >
                  Mês {i + 1}
                </th>
              ))}
              <th className="border border-gray-400 px-3 py-3 text-center font-bold text-xs whitespace-nowrap bg-yellow-100 text-gray-900">
                Total Clientes
              </th>
            </tr>
          </thead>
          <tbody>
            {cohortData.cohorts.map((cohort, idx) => {
              // Criar um mapa para acesso rápido aos dados de retenção
              const retentionMap = cohort.retention_by_month.reduce(
                (acc, r) => {
                  acc[r.months_since_cohort] = r;
                  return acc;
                },
                {},
              );

              return (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-sm bg-gray-50 sticky left-0 z-10">
                    {cohort.cohort_month_name}/{cohort.cohort_year}
                  </td>
                  <td className="border border-gray-300 px-3 py-3 text-center text-xs text-gray-600">
                    {cohort.nm_grupoempresa}
                  </td>
                  {/* Coluna de Novos Clientes (Mês 0) - sempre em branco */}
                  <td className="border border-gray-300 px-3 py-3 text-center font-bold bg-white">
                    <div className="flex flex-col items-center">
                      <span className="text-base text-gray-800">
                        {cohort.total_users}
                      </span>
                      <span className="text-xs text-gray-500 font-normal">
                        100%
                      </span>
                    </div>
                  </td>
                  {/* Demais meses com gradiente de cores */}
                  {Array.from({ length: maxMonths }, (_, monthIdx) => {
                    const retention = retentionMap[monthIdx + 1];
                    if (!retention) {
                      return (
                        <td
                          key={monthIdx}
                          className="border border-gray-300 px-3 py-3 text-center bg-gray-50"
                        >
                          <span className="text-gray-400 text-xs">-</span>
                        </td>
                      );
                    }

                    const bgColor = getRetentionColor(
                      retention.retention_pct,
                      false,
                    );
                    const textColor =
                      retention.retention_pct > 50
                        ? 'text-gray-800'
                        : 'text-gray-700';

                    return (
                      <td
                        key={monthIdx}
                        className={`border border-gray-300 px-3 py-3 text-center relative ${textColor}`}
                        style={{
                          backgroundColor: bgColor,
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-sm">
                            {formatPercent(retention.retention_pct)}
                          </span>
                          <span className="text-xs opacity-80 font-normal">
                            {retention.active_users}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  {/* Coluna Total de Clientes (soma apenas meses 1+, excluindo novos clientes) */}
                  <td className="border border-gray-300 px-3 py-3 text-center font-bold bg-yellow-50">
                    <div className="flex flex-col items-center">
                      <span className="text-base text-gray-800">
                        {cohort.retention_by_month
                          .filter((r) => r.months_since_cohort > 0)
                          .reduce(
                            (sum, r) => sum + parseInt(r.active_users || 0, 10),
                            0,
                          )}
                      </span>
                      <span className="text-xs text-gray-500 font-normal">
                        clientes
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200 font-bold">
              <td className="border border-gray-400 px-4 py-3 text-left font-bold text-sm sticky left-0 bg-gradient-to-r from-gray-100 to-gray-200 z-10">
                TOTAL
              </td>
              <td className="border border-gray-400 px-3 py-3 text-center text-xs">
                -
              </td>
              {/* Total de Novos Clientes */}
              <td className="border border-gray-400 px-3 py-3 text-center font-bold bg-gray-100">
                <div className="flex flex-col items-center">
                  <span className="text-base text-gray-800">
                    {cohortData.cohorts.reduce(
                      (sum, c) => sum + parseInt(c.total_users || 0, 10),
                      0,
                    )}
                  </span>
                  <span className="text-xs text-gray-600 font-normal">
                    novos
                  </span>
                </div>
              </td>
              {/* Total por mês */}
              {Array.from({ length: maxMonths }, (_, monthIdx) => {
                const totalMes = cohortData.cohorts.reduce((sum, cohort) => {
                  const retention = cohort.retention_by_month.find(
                    (r) => r.months_since_cohort === monthIdx + 1,
                  );
                  return sum + parseInt(retention?.active_users || 0, 10);
                }, 0);

                return (
                  <td
                    key={monthIdx}
                    className="border border-gray-400 px-3 py-3 text-center font-bold bg-gray-100"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-base text-gray-800">
                        {totalMes}
                      </span>
                      <span className="text-xs text-gray-600 font-normal">
                        clientes
                      </span>
                    </div>
                  </td>
                );
              })}
              {/* Total Geral de Clientes de Retorno */}
              <td className="border border-gray-400 px-3 py-3 text-center font-bold bg-yellow-100">
                <div className="flex flex-col items-center">
                  <span className="text-base text-gray-800">
                    {cohortData.cohorts.reduce((sum, cohort) => {
                      return (
                        sum +
                        cohort.retention_by_month
                          .filter((r) => r.months_since_cohort > 0)
                          .reduce(
                            (s, r) => s + parseInt(r.active_users || 0, 10),
                            0,
                          )
                      );
                    }, 0)}
                  </span>
                  <span className="text-xs text-gray-600 font-normal">
                    total
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  // Calcular métricas resumidas
  const calculateSummaryMetrics = () => {
    if (!cohortData?.cohorts || cohortData.cohorts.length === 0) {
      return {
        totalCustomers: 0,
        avgRetentionMonth1: 0,
        avgRetentionMonth3: 0,
        avgRetentionMonth6: 0,
      };
    }

    // Total de clientes únicos (soma de total_users de cada cohort)
    const totalCustomers = cohortData.cohorts.reduce(
      (sum, c) => sum + parseInt(c.total_users || 0, 10),
      0,
    );

    // Calcular média de retenção para um mês específico
    const getAvgRetention = (monthIdx) => {
      // Filtrar cohorts que têm dados para este mês
      const cohortsWithMonth = cohortData.cohorts.filter((c) =>
        c.retention_by_month.some((r) => r.months_since_cohort === monthIdx),
      );

      if (cohortsWithMonth.length === 0) return 0;

      // Somar as taxas de retenção de todos os cohorts para este mês
      const sumRetention = cohortsWithMonth.reduce((acc, c) => {
        const retention = c.retention_by_month.find(
          (r) => r.months_since_cohort === monthIdx,
        );
        return acc + parseFloat(retention?.retention_pct || 0);
      }, 0);

      // Retornar a média
      return sumRetention / cohortsWithMonth.length;
    };

    return {
      totalCustomers,
      avgRetentionMonth3: getAvgRetention(3),
      avgRetentionMonth6: getAvgRetention(6),
      avgRetentionMonth9: getAvgRetention(9),
    };
  };

  const metrics = calculateSummaryMetrics();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Análise de Cohort"
        subtitle="Análise de retenção de clientes por mês de primeira compra"
        icon={Users}
      />

      {/* Filtros */}
      <Card className="mb-6 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Funnel className="w-5 h-5" />
            Filtros de Pesquisa
          </CardTitle>
          <CardDescription className="text-sm">
            Selecione os filtros para análise de cohort
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            {/* Filtro de Empresas */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Empresa
              </label>
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>

            {/* Ano */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Ano
              </label>
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Todos</option>
                {[2022, 2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Mês */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Mês
              </label>
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Todos</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('pt-BR', {
                      month: 'short',
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Botões */}
            <div className="lg:col-span-3 flex gap-2">
              <button
                onClick={fetchCohortData}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-[#000638] text-white rounded-md hover:bg-[#fe0000] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                    <span className="text-xs">Buscando...</span>
                  </>
                ) : (
                  <>
                    <MagnifyingGlass size={16} weight="bold" />
                    <span className="text-xs">Buscar</span>
                  </>
                )}
              </button>

              <button
                onClick={limparFiltros}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                title="Limpar Filtros"
              >
                <span className="text-xs">Limpar</span>
              </button>
            </div>
          </div>

          {/* Indicador de dados carregados */}
          {dadosCarregados && cohortData && (
            <div className="flex items-center justify-between gap-2 text-xs font-medium mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                Dados carregados com sucesso
              </div>
              {cohortData.summary && (
                <div className="flex items-center gap-3 text-gray-600">
                  <span>
                    <strong>{cohortData.summary.total_cohorts}</strong> cohorts
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>
                    {cohortData.summary.is_multi_empresa ? (
                      <>
                        <strong>{empresasSelecionadas.length}</strong> empresas
                        agregadas
                      </>
                    ) : (
                      <>
                        <strong>
                          {
                            new Set(
                              cohortData.cohorts.map((c) => c.cd_grupoempresa),
                            ).size
                          }
                        </strong>{' '}
                        empresas
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métricas Resumidas */}
      {!loading && dadosCarregados && cohortData && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
          {/* Total de Clientes */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-blue-600" />
                <CardTitle className="text-xs font-bold text-blue-700">
                  Total de Clientes
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-blue-600 mb-0.5 break-words">
                {metrics.totalCustomers.toLocaleString('pt-BR')}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Novos clientes no período
              </CardDescription>
            </CardContent>
          </Card>

          {/* Retenção Mês 3 */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendUp size={14} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-700">
                  Retenção Mês 3
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-green-600 mb-0.5 break-words">
                {formatPercent(metrics.avgRetentionMonth3)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Taxa média de retenção
              </CardDescription>
            </CardContent>
          </Card>

          {/* Retenção Mês 6 */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendUp size={14} className="text-yellow-600" />
                <CardTitle className="text-xs font-bold text-yellow-700">
                  Retenção Mês 6
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-yellow-600 mb-0.5 break-words">
                {formatPercent(metrics.avgRetentionMonth6)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Taxa média de retenção
              </CardDescription>
            </CardContent>
          </Card>

          {/* Retenção Mês 9 */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendUp size={14} className="text-purple-600" />
                <CardTitle className="text-xs font-bold text-purple-700">
                  Retenção Mês 9
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-purple-600 mb-0.5 break-words">
                {formatPercent(metrics.avgRetentionMonth9)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Taxa média de retenção
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Matriz de Cohort */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Matriz de Retenção por Cohort
          </CardTitle>
          <CardDescription>
            {cohortData?.summary?.is_multi_empresa
              ? `Dados agregados de ${empresasSelecionadas.length} empresas selecionadas. Os valores de clientes e retenção são somados para cada mês/ano. Cada linha mostra a retenção consolidada de todas as empresas selecionadas.`
              : 'Porcentagem de clientes ativos em cada mês após a primeira compra'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner
                size="lg"
                text="Carregando análise de cohort..."
              />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 font-medium">{error}</p>
              <button
                onClick={fetchCohortData}
                className="mt-4 px-4 py-2 bg-[#000638] text-white rounded-md hover:bg-[#fe0000] transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : !dadosCarregados ? (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium mb-2">
                Nenhum dado carregado
              </p>
              <p className="text-gray-400 text-sm">
                Selecione os filtros e clique em "Buscar Cohort" para visualizar
                os dados
              </p>
            </div>
          ) : (
            renderCohortMatrix()
          )}
        </CardContent>
      </Card>

      {/* Legenda */}
      {!loading && dadosCarregados && cohortData && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Legenda e Interpretação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-semibold mb-2">
                  📊 Como ler o gráfico:
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Novos Clientes:</strong> Total de clientes que fizeram
                  a primeira compra naquele mês (sempre 100%)
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Mês 1, 2, 3...:</strong> Porcentagem de clientes que
                  voltaram a comprar após X meses
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Número abaixo:</strong> Quantidade absoluta de
                  clientes ativos naquele período
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-semibold mb-2">
                  🎨 Escala de cores:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }}
                    ></div>
                    <span className="text-sm text-gray-600">
                      <strong>Vermelho:</strong> Retenção excelente (≥8.1%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: 'rgba(249, 115, 22, 0.7)' }}
                    ></div>
                    <span className="text-sm text-gray-600">
                      <strong>Laranja:</strong> Retenção boa (5.1-8%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: 'rgba(59, 130, 246, 0.7)' }}
                    ></div>
                    <span className="text-sm text-gray-600">
                      <strong>Azul:</strong> Retenção baixa (2.1-5%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: 'rgba(34, 197, 94, 0.6)' }}
                    ></div>
                    <span className="text-sm text-gray-600">
                      <strong>Verde:</strong> Retenção crítica (0-2%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CohortAnalysis;
