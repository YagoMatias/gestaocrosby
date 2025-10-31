import React, { useState, useEffect } from 'react';
import { Bell } from '@phosphor-icons/react';
import { useAuth } from './AuthContext';
import { useNotices } from '../hooks/useNotices';
import NoticesModal from './NoticesModal';

/**
 * Componente de sino de notificações no Header
 * Exibe badge com contador de avisos não lidos
 */
const NotificationBell = () => {
  const { user } = useAuth();
  const { getUnreadCount } = useNotices();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Buscar avisos não lidos ao montar e periodicamente
  useEffect(() => {
    if (user?.id) {
      loadUnreadCount();

      // Polling a cada 2 minutos para verificar novos avisos
      const interval = setInterval(loadUnreadCount, 120000);

      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadUnreadCount = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const result = await getUnreadCount(user.id);
      if (result.success) {
        setUnreadCount(result.count);
      }
    } catch (error) {
      console.error('Erro ao carregar contagem de avisos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBellClick = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    // Recarregar contador após fechar modal
    loadUnreadCount();
  };

  return (
    <>
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors group"
        title="Avisos e Notificações"
      >
        <Bell
          size={24}
          className={`text-gray-600 group-hover:text-blue-600 transition-colors ${
            isLoading ? 'animate-pulse' : ''
          }`}
          weight={unreadCount > 0 ? 'fill' : 'regular'}
        />

        {/* Badge de contador */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Indicador visual de novos avisos */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-3 h-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          </span>
        )}
      </button>

      {/* Modal de avisos */}
      {showModal && <NoticesModal onClose={handleCloseModal} />}
    </>
  );
};

export default NotificationBell;
