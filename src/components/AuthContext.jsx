import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import { supabase, supabaseSession } from '../lib/supabase';
import { getUserPermissions } from '../services/permissionsService';
import { getUserCompanies } from '../services/userCompaniesService';

// Roles disponíveis no sistema (ordenados por hierarquia)
const ROLES = [
  'owner',
  'admin',
  'manager',
  'user',
  'guest',
  'vendedor',
  'franquias',
];

// Configuração de roles com labels e níveis
const ROLE_CONFIG = {
  owner: {
    label: 'Proprietário',
    level: 1,
    color: '#9c27b0',
  },
  admin: {
    label: 'Administrador',
    level: 2,
    color: '#ff4747',
  },
  manager: {
    label: 'Gerente',
    level: 3,
    color: '#ff6b35',
  },
  user: {
    label: 'Financeiro',
    level: 4,
    color: '#4CAF50',
  },
  guest: {
    label: 'Convidado',
    level: 5,
    color: '#757575',
  },
  vendedor: {
    label: 'Vendedor',
    level: 60,
    color: '#10b981',
  },
  franquias: {
    label: 'Franquias',
    level: 50,
    color: '#3b82f6',
  },
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ref para rastrear o usuário atual (para evitar recarregamentos desnecessários)
  const userRef = useRef(null);

  // Cache de permissões para evitar múltiplas chamadas
  const permissionsCache = useRef({});
  const loadingPermissions = useRef(new Set());

  // Flag para controlar se estamos no carregamento inicial
  const isInitialLoad = useRef(true);

  // Helper para atualizar usuário (state + ref)
  const updateUser = (userData) => {
    userRef.current = userData;
    setUser(userData);
  };

  // Função auxiliar para carregar empresas vinculadas do banco
  const loadUserCompanies = async (userId, userRole) => {
    try {
      // Apenas usuários do tipo franquias têm empresas vinculadas
      if (userRole !== 'franquias') {
        return null; // null = todas as empresas disponíveis
      }

      const { data, error } = await getUserCompanies(userId);

      if (error) {
        console.error('❌ Erro ao carregar empresas vinculadas:', error);
        return []; // Array vazio = nenhuma empresa
      }

      // Retornar array de códigos de empresas
      const companies = data || [];
      console.log('✅ Empresas vinculadas carregadas:', companies);
      return companies;
    } catch (error) {
      console.error('❌ Erro crítico ao carregar empresas vinculadas:', error);
      return [];
    }
  };

  // Função auxiliar para carregar permissões do banco
  const loadUserPermissions = async (userId, userRole, forceReload = false) => {
    try {
      // Owner tem acesso a todas as páginas (não precisa carregar do banco)
      if (userRole === 'owner') {
        console.log('👑 Owner detectado - acesso total concedido');
        return '*'; // '*' significa acesso a todas as páginas
      }

      // Verificar cache (válido por 5 minutos)
      const cached = permissionsCache.current[userId];
      const now = Date.now();
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

      if (!forceReload && cached && now - cached.timestamp < CACHE_DURATION) {
        console.log('💾 Usando permissões do cache:', cached.permissions);
        return cached.permissions;
      }

      // Evitar múltiplas chamadas simultâneas para o mesmo usuário
      if (loadingPermissions.current.has(userId)) {
        console.log('⏳ Já existe um carregamento em andamento, aguardando...');
        // Aguardar até 12 segundos checando o cache a cada 500ms
        const maxWaitTime = 12000; // 12 segundos
        const checkInterval = 500; // 500ms
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          const cachedAfterWait = permissionsCache.current[userId];
          if (cachedAfterWait) {
            console.log(
              '💾 Usando permissões após aguardar:',
              cachedAfterWait.permissions,
            );
            return cachedAfterWait.permissions;
          }
          // Se o carregamento já terminou mas não há cache, sair do loop
          if (!loadingPermissions.current.has(userId)) {
            break;
          }
        }

        // Se chegou aqui, timeout ou erro no carregamento original
        console.warn('⏱️ Timeout ao aguardar carregamento em andamento');
        return [];
      }

      // Marcar que estamos carregando
      loadingPermissions.current.add(userId);

      // Para outros usuários, buscar permissões do banco
      console.log('📋 Carregando permissões do banco para:', userId);

      // Adicionar timeout de 15 segundos para evitar travamentos
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => {
          console.warn('⏱️ TIMEOUT: Permissões demoraram mais de 15s');
          loadingPermissions.current.delete(userId);
          // Se temos cache antigo, usar ele mesmo expirado
          if (cached) {
            console.log('💾 Usando cache expirado como fallback');
            resolve({ data: cached.permissions, error: null });
          } else {
            console.warn('⚠️ Sem cache disponível, retornando array vazio');
            resolve({ data: [], error: new Error('Timeout') });
          }
        }, 15000),
      );

      const permissionsPromise = getUserPermissions(userId);

      try {
        const result = await Promise.race([permissionsPromise, timeoutPromise]);
        const { data, error } = result;

        // Remover da lista de carregamento
        loadingPermissions.current.delete(userId);

        if (error) {
          console.error('❌ Erro ao carregar permissões:', error);
          // Se temos cache antigo, usar ele
          if (cached) {
            console.log('💾 Usando cache antigo devido a erro');
            return cached.permissions;
          }
          console.log('⚠️ Usuário continuará sem permissões customizadas');
          return [];
        }

        // Salvar no cache
        const permissions = data || [];
        permissionsCache.current[userId] = {
          permissions,
          timestamp: now,
        };

        console.log('✅ Permissões carregadas e cacheadas:', permissions);
        return permissions;
      } catch (err) {
        console.error('❌ Erro ao aguardar permissões:', err);
        loadingPermissions.current.delete(userId);
        // Se temos cache antigo, usar ele
        if (cached) {
          console.log('💾 Usando cache antigo devido a erro');
          return cached.permissions;
        }
        return [];
      }
    } catch (error) {
      console.error('❌ Erro crítico ao carregar permissões:', error);
      loadingPermissions.current.delete(userId);
      console.log('⚠️ Usuário continuará sem permissões customizadas');
      return [];
    }
  };

  // Função de login
  const login = async (email, password, rememberMe = true) => {
    try {
      console.log('🔐 Tentando login com:', email);
      setLoading(true);

      const client = rememberMe ? supabase : supabaseSession;

      const { data: authData, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error);
        throw error;
      }

      console.log('✅ Login bem-sucedido:', authData.user.email);

      // Obter role do metadata do usuário
      const userRole = authData.user.user_metadata?.role || 'guest';
      console.log('👤 Role do usuário:', userRole);

      // Verificar se o role é válido
      const validRole = ROLES.includes(userRole) ? userRole : 'guest';
      const roleConfig = ROLE_CONFIG[validRole];

      // Carregar permissões do banco
      console.log('🔄 Iniciando carregamento de permissões...');
      const allowedPages = await loadUserPermissions(
        authData.user.id,
        validRole,
      );
      console.log('✅ Permissões carregadas, configurando usuário...');

      // Carregar empresas vinculadas (APENAS para franquias)
      const allowedCompanies = await loadUserCompanies(
        authData.user.id,
        validRole,
      );

      // Configurar usuário
      const userData = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || 'Usuário',
        role: validRole,
        allowedPages, // Adicionar permissões customizadas
        allowedCompanies, // Adicionar empresas vinculadas
        profile: {
          name: validRole,
          label: roleConfig.label,
          level: roleConfig.level,
          color: roleConfig.color,
        },
      };

      console.log('✅ Dados do usuário configurados:', userData);
      console.log('🎯 Setando usuário e finalizando login...');
      updateUser(userData);
      setLoading(false);

      console.log('✅ Login finalizado com sucesso!');
      return { success: true, user: userData };
    } catch (error) {
      console.error('❌ Erro no login:', error);
      setLoading(false);
      throw error;
    }
  };

  // Função de logout
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await supabaseSession.auth.signOut();
      updateUser(null);
      // Limpar cache
      permissionsCache.current = {};
      loadingPermissions.current.clear();
      // Resetar flag de carregamento inicial
      isInitialLoad.current = true;
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  // Função para recarregar permissões (sem fazer logout)
  const refreshPermissions = async () => {
    if (!user) return;

    try {
      console.log('🔄 Recarregando permissões (forçando reload)...');
      const allowedPages = await loadUserPermissions(user.id, user.role, true); // forceReload = true

      const updatedUser = {
        ...user,
        allowedPages,
      };
      updateUser(updatedUser);

      console.log('✅ Permissões atualizadas');
    } catch (error) {
      console.error('❌ Erro ao recarregar permissões:', error);
    }
  };

  // Verificar sessão inicial
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('🔄 Verificando sessão inicial...');
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          console.log('✅ Sessão encontrada:', session.user.email);
          const userRole = session.user.user_metadata?.role || 'guest';

          // Verificar se o role é válido
          const validRole = ROLES.includes(userRole) ? userRole : 'guest';
          const roleConfig = ROLE_CONFIG[validRole];

          // Carregar permissões do banco
          const allowedPages = await loadUserPermissions(
            session.user.id,
            validRole,
          );

          // Carregar empresas vinculadas
          const allowedCompanies = await loadUserCompanies(
            session.user.id,
            validRole,
          );

          updateUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 'Usuário',
            role: validRole,
            allowedPages, // Adicionar permissões customizadas
            allowedCompanies, // Adicionar empresas vinculadas
            profile: {
              name: validRole,
              label: roleConfig.label,
              level: roleConfig.level,
              color: roleConfig.color,
            },
          });
        } else {
          console.log('❌ Nenhuma sessão encontrada');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar sessão:', error);
      } finally {
        setLoading(false);
        // Marcar que o carregamento inicial foi concluído
        setTimeout(() => {
          isInitialLoad.current = false;
          console.log('✅ Carregamento inicial concluído');
        }, 500);
      }
    };

    checkSession();

    // Listener para mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Evento de autenticação:', event);

      // Ignorar eventos durante carregamento inicial (checkSession cuida disso)
      if (
        isInitialLoad.current &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        console.log('⏭️ Ignorando evento durante carregamento inicial');
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Evitar recarregar se já temos o mesmo usuário logado (evita loops)
        if (userRef.current && userRef.current.id === session.user.id) {
          console.log('ℹ️ Usuário já está logado, usando cache de permissões');
          return;
        }

        console.log('✅ Usuário fez login:', session.user.email);
        const userRole = session.user.user_metadata?.role || 'guest';

        // Verificar se o role é válido
        const validRole = ROLES.includes(userRole) ? userRole : 'guest';
        const roleConfig = ROLE_CONFIG[validRole];

        // Carregar permissões do banco (usará cache se disponível)
        const allowedPages = await loadUserPermissions(
          session.user.id,
          validRole,
        );

        // Carregar empresas vinculadas
        const allowedCompanies = await loadUserCompanies(
          session.user.id,
          validRole,
        );

        updateUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Usuário',
          role: validRole,
          allowedPages, // Adicionar permissões customizadas
          allowedCompanies, // Adicionar empresas vinculadas
          profile: {
            name: validRole,
            label: roleConfig.label,
            level: roleConfig.level,
            color: roleConfig.color,
          },
        });
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 Usuário fez logout');
        updateUser(null);
        // Limpar cache de permissões ao fazer logout
        permissionsCache.current = {};
        loadingPermissions.current.clear();
        isInitialLoad.current = true; // Resetar para próximo login
        setLoading(false);
      }
    });

    // Também ouvir mudanças do cliente baseado em sessionStorage
    const {
      data: { subscription: subscriptionSession },
    } = supabaseSession.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Evento de autenticação (session):', event);

      // Ignorar eventos durante carregamento inicial (checkSession cuida disso)
      if (
        isInitialLoad.current &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        console.log(
          '⏭️ Ignorando evento (session) durante carregamento inicial',
        );
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Evitar recarregar se já temos o mesmo usuário logado
        if (userRef.current && userRef.current.id === session.user.id) {
          console.log('ℹ️ Usuário já está logado (session), usando cache');
          return;
        }

        const userRole = session.user.user_metadata?.role || 'guest';
        const validRole = ROLES.includes(userRole) ? userRole : 'guest';
        const roleConfig = ROLE_CONFIG[validRole];

        // Carregar permissões do banco (usará cache se disponível)
        const allowedPages = await loadUserPermissions(
          session.user.id,
          validRole,
        );

        // Carregar empresas vinculadas
        const allowedCompanies = await loadUserCompanies(
          session.user.id,
          validRole,
        );

        updateUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Usuário',
          role: validRole,
          allowedPages, // Adicionar permissões customizadas
          allowedCompanies, // Adicionar empresas vinculadas
          profile: {
            name: validRole,
            label: roleConfig.label,
            level: roleConfig.level,
            color: roleConfig.color,
          },
        });
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        updateUser(null);
        // Limpar cache ao fazer logout (session)
        permissionsCache.current = {};
        loadingPermissions.current.clear();
        isInitialLoad.current = true; // Resetar para próximo login
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      subscriptionSession.unsubscribe();
    };
  }, []);

  // Funções de verificação de permissão
  const hasRole = (requiredRole) => {
    // Se for um array, usar hasAnyRole
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user?.role);
    }
    // Se for uma string, verificar se o role é igual
    return user?.role === requiredRole;
  };

  const hasAnyRole = (requiredRoles) => {
    return requiredRoles.includes(user?.role);
  };

  const hasPermission = (requiredLevel) => {
    return user?.profile?.level >= requiredLevel;
  };

  const getRoleConfig = (role) => {
    return ROLE_CONFIG[role] || ROLE_CONFIG.guest;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshPermissions,
    hasRole,
    hasAnyRole,
    hasPermission,
    getRoleConfig,
    ROLES,
    ROLE_CONFIG,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
