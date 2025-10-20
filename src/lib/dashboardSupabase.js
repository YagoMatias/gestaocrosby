/**
 * Dashboard API - Supabase
 * Gerencia CRUD de dashboards, permissões e widgets no Supabase
 * Os dados do ERP são consultados via Render API
 */

import { supabase } from './supabase';
import { isAdminOrOwner } from '../utils/roleUtils';

// =============================================================================
// DASHBOARDS
// =============================================================================

/**
 * Buscar dashboards do usuário logado
 * @param {string} userEmail - Email do usuário
 * @returns {Promise} Lista de dashboards com permissões
 */
export async function fetchMyDashboards(userEmail) {
  try {
    // Buscar IDs dos dashboards que o usuário tem acesso
    const { data: permissions, error: permError } = await supabase
      .from('dashboard_permissions')
      .select('dashboard_id, can_view, can_export')
      .eq('user_email', userEmail)
      .eq('can_view', true);

    if (permError) throw permError;

    if (!permissions || permissions.length === 0) {
      return { success: true, data: [] };
    }

    const dashboardIds = permissions.map((p) => p.dashboard_id);

    // Buscar detalhes dos dashboards
    const { data: dashboards, error: dashError } = await supabase
      .from('dashboards')
      .select('*')
      .in('id', dashboardIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (dashError) throw dashError;

    // Combinar dashboards com permissões
    const dashboardsWithPerms = dashboards.map((dash) => {
      const perm = permissions.find((p) => p.dashboard_id === dash.id);
      return {
        ...dash,
        can_export: perm?.can_export || false,
      };
    });

    return { success: true, data: dashboardsWithPerms };
  } catch (error) {
    console.error('Erro ao buscar dashboards:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar detalhes de um dashboard específico
 * @param {number} dashboardId - ID do dashboard
 * @param {string} userEmail - Email do usuário
 * @returns {Promise} Dashboard com widgets
 */
export async function fetchDashboardDetails(dashboardId, userEmail) {
  try {
    // Verificar permissão
    const { data: permission, error: permError } = await supabase
      .from('dashboard_permissions')
      .select('can_view, can_export')
      .eq('dashboard_id', dashboardId)
      .eq('user_email', userEmail)
      .eq('can_view', true)
      .single();

    if (permError || !permission) {
      throw new Error('Você não tem permissão para acessar este dashboard');
    }

    // Buscar dashboard
    const { data: dashboard, error: dashError } = await supabase
      .from('dashboards')
      .select('*')
      .eq('id', dashboardId)
      .eq('is_active', true)
      .single();

    if (dashError) throw dashError;

    // Buscar widgets
    const { data: widgets, error: widgetsError } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .eq('is_active', true)
      .order('position_y', { ascending: true })
      .order('position_x', { ascending: true });

    if (widgetsError) throw widgetsError;

    // Registrar acesso (opcional)
    await supabase.from('dashboard_access_log').insert({
      dashboard_id: dashboardId,
      user_email: userEmail,
      accessed_at: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        ...dashboard,
        widgets: widgets || [],
        can_export: permission.can_export,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar detalhes do dashboard:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// ADMIN - DASHBOARDS
// =============================================================================

/**
 * Buscar todos os dashboards (Admin/Owner)
 * @param {string} userRole - Role do usuário (admin ou ownier)
 * @returns {Promise} Lista de todos os dashboards
 */
export async function fetchAllDashboards(userRole) {
  if (!isAdminOrOwner(userRole)) {
    return { success: false, error: 'Acesso negado' };
  }

  try {
    const { data, error } = await supabase
      .from('dashboards')
      .select(
        `
        *,
        permissions:dashboard_permissions(count),
        widgets:dashboard_widgets(count)
      `,
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao buscar dashboards:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Criar dashboard (Admin)
 * @param {object} dashboardData - Dados do dashboard
 * @returns {Promise} Dashboard criado
 */
export async function createDashboard(dashboardData) {
  try {
    const { data, error } = await supabase
      .from('dashboards')
      .insert([dashboardData])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao criar dashboard:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualizar dashboard (Admin)
 * @param {number} dashboardId - ID do dashboard
 * @param {object} updates - Dados para atualizar
 * @returns {Promise} Dashboard atualizado
 */
export async function updateDashboard(dashboardId, updates) {
  try {
    const { data, error } = await supabase
      .from('dashboards')
      .update(updates)
      .eq('id', dashboardId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao atualizar dashboard:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar dashboard (soft delete)
 * @param {number} dashboardId - ID do dashboard
 * @returns {Promise} Resultado
 */
export async function deleteDashboard(dashboardId) {
  try {
    const { error } = await supabase
      .from('dashboards')
      .update({ is_active: false })
      .eq('id', dashboardId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar dashboard:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// PERMISSÕES
// =============================================================================

/**
 * Buscar permissões de um dashboard
 * @param {number} dashboardId - ID do dashboard
 * @returns {Promise} Lista de permissões
 */
export async function fetchDashboardPermissions(dashboardId) {
  try {
    const { data, error } = await supabase
      .from('dashboard_permissions')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('granted_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao buscar permissões:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Adicionar permissão para usuário
 * @param {object} permissionData - Dados da permissão
 * @returns {Promise} Permissão criada
 */
export async function addPermission(permissionData) {
  try {
    const { data, error } = await supabase
      .from('dashboard_permissions')
      .insert([permissionData])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao adicionar permissão:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remover permissão de usuário
 * @param {number} dashboardId - ID do dashboard
 * @param {string} userEmail - Email do usuário
 * @returns {Promise} Resultado
 */
export async function removePermission(dashboardId, userEmail) {
  try {
    const { error } = await supabase
      .from('dashboard_permissions')
      .delete()
      .eq('dashboard_id', dashboardId)
      .eq('user_email', userEmail);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao remover permissão:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// WIDGETS
// =============================================================================

/**
 * Buscar widgets de um dashboard
 * @param {number} dashboardId - ID do dashboard
 * @returns {Promise} Lista de widgets
 */
export async function fetchWidgets(dashboardId) {
  try {
    const { data, error } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .eq('is_active', true)
      .order('position_y', { ascending: true })
      .order('position_x', { ascending: true });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao buscar widgets:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Criar widget
 * @param {object} widgetData - Dados do widget
 * @returns {Promise} Widget criado
 */
export async function createWidget(widgetData) {
  try {
    const { data, error } = await supabase
      .from('dashboard_widgets')
      .insert([widgetData])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao criar widget:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualizar widget
 * @param {number} widgetId - ID do widget
 * @param {object} updates - Dados para atualizar
 * @returns {Promise} Widget atualizado
 */
export async function updateWidget(widgetId, updates) {
  try {
    const { data, error } = await supabase
      .from('dashboard_widgets')
      .update(updates)
      .eq('id', widgetId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao atualizar widget:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar widget
 * @param {number} widgetId - ID do widget
 * @returns {Promise} Resultado
 */
export async function deleteWidget(widgetId) {
  try {
    const { error } = await supabase
      .from('dashboard_widgets')
      .update({ is_active: false })
      .eq('id', widgetId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar widget:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualizar posições de múltiplos widgets (drag & drop)
 * @param {Array} positions - Array de {id, position_x, position_y, width, height}
 * @returns {Promise} Resultado
 */
export async function updateWidgetPositions(positions) {
  try {
    const promises = positions.map((pos) =>
      supabase
        .from('dashboard_widgets')
        .update({
          position_x: pos.position_x,
          position_y: pos.position_y,
          width: pos.width,
          height: pos.height,
        })
        .eq('id', pos.id),
    );

    await Promise.all(promises);

    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar posições:', error);
    return { success: false, error: error.message };
  }
}
