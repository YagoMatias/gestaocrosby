import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Circle,
  CheckCircle,
  Calendar,
  Eye,
} from '@phosphor-icons/react';
import { useAuth } from './AuthContext';
import { useNotices } from '../hooks/useNotices';

/**
 * Modal que exibe todos os avisos do usuário
 * Aberto ao clicar no sino de notificações
 *
 * PERMISSÃO: Todos os usuários autenticados podem visualizar seus avisos
 * Não requer permissão específica no gerenciador de acessos
 */
const NoticesModal = ({ onClose }) => {
  const { user } = useAuth();
  const { getUserNotices, confirmRead } = useNotices();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await getUserNotices(user.id);
      if (result.success) {
        setNotices(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRead = async (noticeId) => {
    if (confirming) return;

    setConfirming(true);
    try {
      await confirmRead(noticeId, user.id);
      // Atualizar lista após confirmação
      await loadNotices();
      setSelectedNotice(null);
    } catch (error) {
      console.error('Erro ao confirmar leitura:', error);
    } finally {
      setConfirming(false);
    }
  };

  const filteredNotices = notices.filter((notice) => {
    if (filter === 'unread') return !notice.is_confirmed;
    if (filter === 'read') return notice.is_confirmed;
    return true;
  });

  const unreadCount = notices.filter((n) => !n.is_confirmed).length;
  const readCount = notices.filter((n) => n.is_confirmed).length;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col  h-4/5">
        {/* Header */}
        <div className="bg-[#000638] from-blue-600 to-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-0.5">Meus Avisos</h2>
              <p className="text-xs text-blue-100">
                {unreadCount > 0
                  ? `Você tem ${unreadCount} aviso${
                      unreadCount > 1 ? 's' : ''
                    } não lido${unreadCount > 1 ? 's' : ''}`
                  : 'Todos os avisos foram lidos'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors"
              title="Fechar"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          {/* Filtros */}
          <div className="flex gap-1.5 mt-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Todos ({notices.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'unread'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Não Lidos ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'read'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Lidos ({readCount})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Lista de avisos */}
          <div
            className={`${
              selectedNotice ? 'w-1/3' : 'w-full'
            } border-r border-gray-200 overflow-y-auto transition-all`}
          >
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 p-3">
                <Circle size={48} weight="thin" className="mb-3" />
                <p className="text-sm font-semibold">Nenhum aviso encontrado</p>
                <p className="text-xs text-center mt-1.5">
                  {filter === 'unread'
                    ? 'Você está em dia com todos os avisos!'
                    : filter === 'read'
                    ? 'Você ainda não leu nenhum aviso'
                    : 'Não há avisos para exibir'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredNotices.map((notice) => (
                  <button
                    key={notice.id}
                    onClick={() => setSelectedNotice(notice)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedNotice?.id === notice.id ? 'bg-blue-50' : ''
                    } ${
                      !notice.is_confirmed ? 'bg-yellow-50 bg-opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Indicador de leitura */}
                      <div className="mt-0.5">
                        {notice.is_confirmed ? (
                          <CheckCircle
                            size={16}
                            weight="fill"
                            className="text-green-500"
                          />
                        ) : (
                          <Circle
                            size={16}
                            weight="bold"
                            className="text-orange-500 animate-pulse"
                          />
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`text-sm font-semibold text-gray-900 truncate ${
                            !notice.is_confirmed ? 'font-bold' : ''
                          }`}
                        >
                          {notice.title}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
                          <Calendar size={12} />
                          <span>{formatDate(notice.created_at)}</span>
                        </div>
                        {!notice.is_confirmed && (
                          <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded">
                            Novo
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detalhes do aviso selecionado */}
          {selectedNotice && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header do aviso */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900 mb-1">
                      {selectedNotice.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} />
                        <span>{formatDate(selectedNotice.created_at)}</span>
                      </div>
                      {selectedNotice.is_confirmed && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={13} weight="fill" />
                          <span>
                            Lido em {formatDate(selectedNotice.confirmed_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNotice(null)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Conteúdo do aviso */}
              <div className="flex-1 overflow-y-auto p-4">
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
                />
              </div>

              {/* Footer com ações */}
              {!selectedNotice.is_confirmed && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => handleConfirmRead(selectedNotice.id)}
                    disabled={confirming}
                    className="w-full py-2 bg-[#000638] from-green-600 to-emerald-600 text-white text-sm rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {confirming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Confirmando...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} weight="bold" />
                        <span>Marcar como Lido</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticesModal;
