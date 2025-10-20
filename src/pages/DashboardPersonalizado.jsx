import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchMyDashboards,
  fetchDashboardDetails,
} from '../lib/dashboardSupabase';
import { executeQuery } from '../lib/queryBuilderApi';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import WidgetRenderer from '../components/WidgetRenderer';

/**
 * Página DashboardPersonalizado
 * Exibe os dashboards que foram atribuídos ao usuário logado
 * - Dashboards salvos no SUPABASE
 * - Dados consultados no ERP via Render API
 */
export default function DashboardPersonalizado() {
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [dashboardDetails, setDashboardDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  // Buscar dados do usuário logado
  useEffect(() => {
    async function getUserData() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (user) {
          setUserEmail(user.email);
          fetchMyDashboardsData(user.email);
        } else {
          setError('Você precisa estar logado para ver os dashboards');
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao buscar usuário:', err);
        setError('Erro ao verificar autenticação');
        setLoading(false);
      }
    }

    getUserData();
  }, []);

  // Buscar dashboards do usuário
  const fetchMyDashboardsData = async (email) => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchMyDashboards(email);

      if (!result.success) {
        throw new Error(result.error);
      }

      setDashboards(result.data);

      // Selecionar primeiro dashboard automaticamente
      if (result.data.length > 0) {
        selectDashboard(result.data[0].id, email);
      }
    } catch (err) {
      console.error('Erro ao buscar dashboards:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Buscar detalhes de um dashboard específico
  const selectDashboard = async (dashboardId, email) => {
    try {
      setLoadingDetails(true);
      setSelectedDashboard(dashboardId);
      setError(null);

      const result = await fetchDashboardDetails(
        dashboardId,
        email || userEmail,
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      setDashboardDetails(result.data);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      setError(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboards Personalizados
        </h1>
        <p className="text-gray-600 mt-2">
          Visualize os dashboards que foram compartilhados com você
        </p>
      </div>

      {/* Toast de Erro */}
      {error && (
        <Toast message={error} type="error" onClose={() => setError(null)} />
      )}

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto">
        {dashboards.length === 0 ? (
          /* Nenhum Dashboard */
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Nenhum dashboard disponível
            </h3>
            <p className="mt-2 text-gray-500">
              Você ainda não tem nenhum dashboard atribuído a você.
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Entre em contato com o administrador para ter acesso.
            </p>
          </div>
        ) : (
          /* Grid Layout */
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar - Lista de Dashboards */}
            <div className="col-span-12 lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Meus Dashboards
                </h2>
                <div className="space-y-2">
                  {dashboards.map((dashboard) => (
                    <button
                      key={dashboard.id}
                      onClick={() => selectDashboard(dashboard.id, userEmail)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedDashboard === dashboard.id
                          ? 'bg-blue-50 border-2 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{dashboard.name}</div>
                      {dashboard.description && (
                        <div className="text-sm text-gray-500 mt-1">
                          {dashboard.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>📊 {dashboard.total_widgets || 0} widgets</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content - Dashboard Selecionado */}
            <div className="col-span-12 lg:col-span-9">
              {loadingDetails ? (
                <div className="bg-white rounded-lg shadow-sm p-12 flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : dashboardDetails ? (
                <div className="space-y-6">
                  {/* Header do Dashboard */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          {dashboardDetails.name}
                        </h2>
                        {dashboardDetails.description && (
                          <p className="text-gray-600 mt-1">
                            {dashboardDetails.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {dashboardDetails.can_export && (
                          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            📥 Exportar
                          </button>
                        )}
                        <button
                          onClick={() => fetchMyDashboards(userEmail)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          🔄 Atualizar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Widgets */}
                  {dashboardDetails.widgets.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                      <p className="text-gray-500">
                        Este dashboard ainda não possui widgets configurados.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-12 gap-4">
                      {dashboardDetails.widgets.map((widget) => (
                        <div
                          key={widget.id}
                          className={`col-span-${
                            widget.width || 6
                          } bg-white rounded-lg shadow-sm p-6`}
                          style={{
                            gridColumn: `span ${widget.width || 6}`,
                            minHeight: `${(widget.height || 4) * 100}px`,
                          }}
                        >
                          {/* Widget Header */}
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {widget.name}
                            </h3>
                            {widget.description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {widget.description}
                              </p>
                            )}
                          </div>

                          {/* Widget Content - Renderizar com dados reais */}
                          <WidgetRenderer widget={widget} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <p className="text-gray-500">
                    Selecione um dashboard para visualizar
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
