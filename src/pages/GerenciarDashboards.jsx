import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchAllDashboards,
  createDashboard,
  deleteDashboard,
  fetchDashboardPermissions,
  addPermission,
  removePermission,
} from '../lib/dashboardSupabase';
import { normalizeRole, isAdminOrOwner } from '../utils/roleUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import WidgetBuilderModal from '../components/WidgetBuilderModal';

/**
 * Página GerenciarDashboards (Admin/Proprietário)
 * Interface para criar dashboards e atribuir a usuários
 * - Dashboards salvos no SUPABASE
 * - Dados do ERP consultados via Render API
 */
export default function GerenciarDashboards() {
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [permissionForm, setPermissionForm] = useState({
    userEmail: '',
    canView: true,
    canExport: false,
  });

  useEffect(() => {
    async function getUserData() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (user) {
          const email = user.email;
          const rawRole = user.user_metadata?.role || 'usuario';
          // Normalizar role usando função utilitária
          const role = normalizeRole(rawRole);

          setUserEmail(email);
          setUserRole(role);

          if (isAdminOrOwner(role)) {
            fetchDashboardsData(role);
          } else {
            setError('Você não tem permissão para acessar esta página');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar usuário:', err);
        setError('Erro ao verificar autenticação');
        setLoading(false);
      }
    }

    getUserData();
  }, []);

  const fetchDashboardsData = async (role) => {
    try {
      setLoading(true);

      const result = await fetchAllDashboards(role);

      if (!result.success) {
        throw new Error(result.error);
      }

      setDashboards(result.data);
    } catch (err) {
      console.error('Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async (e) => {
    e.preventDefault();

    try {
      // Normalizar role usando função utilitária
      const normalizedRole = normalizeRole(userRole);

      // Validar role usando função utilitária
      if (!isAdminOrOwner(normalizedRole)) {
        throw new Error(
          'Role inválido. Apenas admin ou proprietario podem criar dashboards.',
        );
      }

      const dashboardData = {
        ...formData,
        created_by: userEmail,
        created_by_role: normalizedRole,
      };

      const result = await createDashboard(dashboardData);

      if (!result.success) {
        throw new Error(result.error);
      }

      setSuccess('Dashboard criado com sucesso!');
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      fetchDashboardsData(userRole);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteDashboard = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este dashboard?')) return;

    try {
      const result = await deleteDashboard(id);

      if (!result.success) {
        throw new Error(result.error);
      }

      setSuccess('Dashboard deletado com sucesso!');
      fetchDashboardsData(userRole);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchPermissionsData = async (dashboardId) => {
    try {
      const result = await fetchDashboardPermissions(dashboardId);

      if (!result.success) {
        throw new Error(result.error);
      }

      setPermissions(result.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddPermission = async (e) => {
    e.preventDefault();

    try {
      const permissionData = {
        dashboard_id: selectedDashboard,
        user_email: permissionForm.userEmail,
        granted_by: userEmail,
        can_view: permissionForm.canView,
        can_export: permissionForm.canExport,
      };

      const result = await addPermission(permissionData);

      if (!result.success) {
        throw new Error(result.error);
      }

      setSuccess('Permissão adicionada com sucesso!');
      setPermissionForm({ userEmail: '', canView: true, canExport: false });
      fetchPermissionsData(selectedDashboard);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemovePermission = async (userEmailToRemove) => {
    if (!confirm(`Remover acesso de ${userEmailToRemove}?`)) return;

    try {
      const result = await removePermission(
        selectedDashboard,
        userEmailToRemove,
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      setSuccess('Permissão removida com sucesso!');
      fetchPermissionsData(selectedDashboard);
    } catch (err) {
      setError(err.message);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Gerenciar Dashboards
            </h1>
            <p className="text-gray-600 mt-2">
              Crie dashboards e atribua a usuários
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ➕ Novo Dashboard
          </button>
        </div>
      </div>

      {/* Toasts */}
      {error && (
        <Toast message={error} type="error" onClose={() => setError(null)} />
      )}
      {success && (
        <Toast
          message={success}
          type="success"
          onClose={() => setSuccess(null)}
        />
      )}

      {/* Lista de Dashboards */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dashboard
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuários
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Widgets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado por
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboards.map((dashboard) => (
                <tr key={dashboard.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {dashboard.name}
                      </div>
                      {dashboard.description && (
                        <div className="text-sm text-gray-500">
                          {dashboard.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dashboard.total_users || 0} usuários
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dashboard.total_widgets || 0} widgets
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dashboard.created_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedDashboard(dashboard.id);
                        setShowWidgetModal(true);
                      }}
                      className="text-green-600 hover:text-green-900 mr-4"
                      title="Adicionar Widget"
                    >
                      ➕ Widget
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDashboard(dashboard.id);
                        setShowPermissionModal(true);
                        fetchPermissionsData(dashboard.id);
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      👥 Usuários
                    </button>
                    <button
                      onClick={() => handleDeleteDashboard(dashboard.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {dashboards.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum dashboard criado ainda</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal - Criar Dashboard */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Novo Dashboard</h2>
            <form onSubmit={handleCreateDashboard}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Dashboard Financeiro"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Descrição do dashboard..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Gerenciar Permissões */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Gerenciar Usuários</h2>
              <button
                onClick={() => setShowPermissionModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Form - Adicionar Usuário */}
            <form
              onSubmit={handleAddPermission}
              className="mb-6 p-4 bg-gray-50 rounded-lg"
            >
              <h3 className="font-medium mb-3">Adicionar Usuário</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="email"
                  required
                  value={permissionForm.userEmail}
                  onChange={(e) =>
                    setPermissionForm({
                      ...permissionForm,
                      userEmail: e.target.value,
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="email@exemplo.com"
                />
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={permissionForm.canView}
                      onChange={(e) =>
                        setPermissionForm({
                          ...permissionForm,
                          canView: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    Visualizar
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={permissionForm.canExport}
                      onChange={(e) =>
                        setPermissionForm({
                          ...permissionForm,
                          canExport: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    Exportar
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ➕ Adicionar
              </button>
            </form>

            {/* Lista de Usuários com Acesso */}
            <div>
              <h3 className="font-medium mb-3">Usuários com Acesso</h3>
              {permissions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhum usuário com acesso ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{perm.user_email}</div>
                        <div className="text-sm text-gray-500">
                          {perm.can_view && '✓ Visualizar '}
                          {perm.can_export && '✓ Exportar'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePermission(perm.user_email)}
                        className="text-red-600 hover:text-red-800"
                      >
                        🗑️ Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal - Widget Builder */}
      <WidgetBuilderModal
        dashboardId={selectedDashboard}
        isOpen={showWidgetModal}
        onClose={() => setShowWidgetModal(false)}
        onSuccess={(message) => {
          setSuccess(message);
          fetchDashboardsData(userRole);
          setShowWidgetModal(false);
        }}
      />
    </div>
  );
}
