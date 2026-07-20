import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Circle,
  CheckCircle,
  Calendar,
  Bell,
  XCircle,
} from '@phosphor-icons/react';
import { useAuth } from './AuthContext';
import { useNotices } from '../hooks/useNotices';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { filtroNotificacaoSistema } from '../utils/notificacoesAcesso';

/**
 * Modal exibido ao clicar no sino de notificações.
 * Reúne duas fontes:
 *   - Avisos (notices) — criados por administradores.
 *   - Notificações de sistema (notificacoes_sistema) — geradas por jobs e
 *     por eventos do sistema (ex.: análises de crédito), segmentadas por
 *     papel (destinatario_roles) ou por usuário (destinatario_id).
 *
 * PERMISSÃO: qualquer usuário autenticado vê as próprias notificações.
 */
const NoticesModal = ({ onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getUserNotices, confirmRead } = useNotices();
  const [notices, setNotices] = useState([]);
  const [notificacoesSistema, setNotificacoesSistema] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [tipoFiltro, setTipoFiltro] = useState('todos'); // 'todos', 'avisos', 'sistema'
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedSistema, setSelectedSistema] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadNotices();
    loadNotificacoesSistema();

    // Listener em tempo real para notificações de sistema
    const channelSistema = supabase
      .channel('notificacoes_sistema_modal')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes_sistema',
        },
        () => {
          loadNotificacoesSistema();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSistema);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNotices = async () => {
    if (!user?.id) return;
    try {
      const result = await getUserNotices(user.id);
      if (result.success) {
        setNotices(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
    }
  };

  const loadNotificacoesSistema = async () => {
    const filtro = filtroNotificacaoSistema(user);
    if (!filtro) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notificacoes_sistema')
        .select('*')
        .or(filtro)
        .order('dt_criacao', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erro ao buscar notificações de sistema:', error);
        return;
      }

      // "lida" é por-usuário: presença do id no array lida_por
      const mapped = (data || []).map((n) => ({
        ...n,
        lida: (n.lida_por || []).includes(user.id),
      }));
      setNotificacoesSistema(mapped);
    } catch (error) {
      console.error('Erro ao buscar notificações de sistema:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarSistemaComoLida = async (notificacaoId) => {
    try {
      const { error } = await supabase.rpc('marcar_notificacao_sistema_lida', {
        p_id: notificacaoId,
        p_user: user.id,
      });
      if (error) throw error;
      setNotificacoesSistema((prev) =>
        prev.map((n) =>
          n.id === notificacaoId
            ? { ...n, lida: true, lida_por: [...(n.lida_por || []), user.id] }
            : n,
        ),
      );
    } catch (error) {
      console.error('Erro ao marcar notificação de sistema como lida:', error);
    }
  };

  const abrirNotificacaoSistema = (notificacao) => {
    if (!notificacao.lida) marcarSistemaComoLida(notificacao.id);
    setSelectedNotice(null);
    setSelectedSistema(notificacao);
  };

  const handleConfirmRead = async (noticeId) => {
    if (confirming) return;
    setConfirming(true);
    try {
      await confirmRead(noticeId, user.id);
      await loadNotices();
      setSelectedNotice(null);
    } catch (error) {
      console.error('Erro ao confirmar leitura:', error);
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIconeSistema = (nivel) => {
    switch (nivel) {
      case 'success':
        return (
          <CheckCircle size={16} weight="fill" className="text-green-500" />
        );
      case 'error':
        return <XCircle size={16} weight="fill" className="text-red-500" />;
      case 'warning':
        return <Bell size={16} weight="fill" className="text-orange-500" />;
      default:
        return <Bell size={16} weight="fill" className="text-blue-500" />;
    }
  };

  // Rota associada a uma notificação de sistema (quando aplicável)
  const rotaDaNotificacao = (notif) => {
    if (!notif?.tipo) return null;
    if (String(notif.tipo).startsWith('ANALISE_CREDITO'))
      return '/analise-credito';
    if (String(notif.tipo) === 'PROVISAO_LIBERACAO')
      return '/liberacao-pagamento';
    return null;
  };

  // Mesclar avisos + notificações de sistema
  const notificacoesMescladas = [
    ...notices.map((n) => ({
      ...n,
      tipo_fonte: 'aviso',
      data_ordenacao: new Date(n.created_at),
    })),
    ...notificacoesSistema.map((n) => ({
      ...n,
      tipo_fonte: 'sistema',
      data_ordenacao: new Date(n.dt_criacao),
    })),
  ].sort((a, b) => b.data_ordenacao - a.data_ordenacao);

  // Filtrar por tipo de notificação
  const notificacoesPorTipo = notificacoesMescladas.filter((notif) => {
    if (tipoFiltro === 'avisos') return notif.tipo_fonte === 'aviso';
    if (tipoFiltro === 'sistema') return notif.tipo_fonte === 'sistema';
    return true; // 'todos'
  });

  // Filtrar por status de leitura
  const filteredNotices = notificacoesPorTipo.filter((notif) => {
    const isUnread =
      notif.tipo_fonte === 'aviso' ? !notif.is_confirmed : !notif.lida;
    if (filter === 'unread') return isUnread;
    if (filter === 'read') return !isUnread;
    return true;
  });

  const unreadCount =
    notices.filter((n) => !n.is_confirmed).length +
    notificacoesSistema.filter((n) => !n.lida).length;
  const readCount =
    notices.filter((n) => n.is_confirmed).length +
    notificacoesSistema.filter((n) => n.lida).length;
  const avisosCount = notices.length;
  const sistemaCount = notificacoesSistema.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col h-4/5">
        {/* Header */}
        <div className="bg-[#000638] p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-0.5">Meus Avisos</h2>
              <p className="text-xs text-blue-100">
                {unreadCount > 0
                  ? `Você tem ${unreadCount} notificação${
                      unreadCount > 1 ? 'ões' : ''
                    } não lida${unreadCount > 1 ? 's' : ''}`
                  : 'Tudo lido por aqui'}
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

          {/* Filtros por Tipo */}
          <div className="flex gap-1.5 mt-3">
            <button
              onClick={() => setTipoFiltro('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tipoFiltro === 'todos'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Todos ({notificacoesMescladas.length})
            </button>
            <button
              onClick={() => setTipoFiltro('avisos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tipoFiltro === 'avisos'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Avisos ({avisosCount})
            </button>
            {sistemaCount > 0 && (
              <button
                onClick={() => setTipoFiltro('sistema')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tipoFiltro === 'sistema'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                }`}
              >
                Sistema ({sistemaCount})
              </button>
            )}
          </div>

          {/* Filtros por Status */}
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Todas ({notificacoesPorTipo.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'unread'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Não Lidas ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'read'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Lidas ({readCount})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Lista */}
          <div
            className={`${
              selectedNotice || selectedSistema ? 'w-1/3' : 'w-full'
            } border-r border-gray-200 overflow-y-auto transition-all`}
          >
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 p-3">
                <Circle size={48} weight="thin" className="mb-3" />
                <p className="text-sm font-semibold">
                  Nenhuma notificação encontrada
                </p>
                <p className="text-xs text-center mt-1.5">
                  {filter === 'unread'
                    ? 'Você está em dia!'
                    : filter === 'read'
                      ? 'Você ainda não leu nenhuma notificação'
                      : 'Não há notificações para exibir'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredNotices.map((notif) => {
                  const isAviso = notif.tipo_fonte === 'aviso';
                  const isUnread = isAviso ? !notif.is_confirmed : !notif.lida;
                  const title = isAviso ? notif.title : notif.titulo;
                  const dateField = isAviso
                    ? notif.created_at
                    : notif.dt_criacao;

                  return (
                    <button
                      key={`${notif.tipo_fonte}-${notif.id}`}
                      onClick={() => {
                        if (isAviso) {
                          setSelectedSistema(null);
                          setSelectedNotice(notif);
                        } else {
                          abrirNotificacaoSistema(notif);
                        }
                      }}
                      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedNotice?.id === notif.id ||
                        selectedSistema?.id === notif.id
                          ? 'bg-blue-50'
                          : ''
                      } ${isUnread ? 'bg-yellow-50 bg-opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Ícone indicador */}
                        <div className="mt-0.5">
                          {isAviso ? (
                            notif.is_confirmed ? (
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
                            )
                          ) : (
                            getIconeSistema(notif.nivel)
                          )}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`text-sm font-semibold text-gray-900 truncate ${
                              isUnread ? 'font-bold' : ''
                            }`}
                          >
                            {title}
                          </h3>
                          {!isAviso && notif.mensagem && (
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                              {notif.mensagem}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
                            <Calendar size={12} />
                            <span>{formatDate(dateField)}</span>
                          </div>
                          {isUnread && (
                            <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded">
                              Nova
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detalhes do aviso selecionado */}
          {selectedNotice && (
            <div className="flex-1 flex flex-col overflow-hidden">
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

              <div className="flex-1 overflow-y-auto p-4">
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
                />
              </div>

              {!selectedNotice.is_confirmed && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => handleConfirmRead(selectedNotice.id)}
                    disabled={confirming}
                    className="w-full py-2 bg-[#000638] text-white text-sm rounded-lg font-bold hover:bg-[#001060] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          {/* Detalhes da notificação de sistema selecionada */}
          {selectedSistema && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getIconeSistema(selectedSistema.nivel)}
                      <h3 className="text-base font-bold text-gray-900">
                        {selectedSistema.titulo}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Calendar size={13} />
                      <span>{formatDate(selectedSistema.dt_criacao)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSistema(null)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {selectedSistema.mensagem && (
                  <p className="text-sm text-gray-700 mb-3">
                    {selectedSistema.mensagem}
                  </p>
                )}

                {/* Resumo (quando houver) */}
                {selectedSistema.dados &&
                  (selectedSistema.dados.janela ||
                    selectedSistema.dados.inseridos !== undefined) && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        ['Período (venc.)', selectedSistema.dados.janela],
                        ['Encontrados', selectedSistema.dados.encontrados],
                        ['Provisionados', selectedSistema.dados.inseridos],
                        ['Já existentes', selectedSistema.dados.jaExistentes],
                      ]
                        .filter(([, v]) => v !== undefined && v !== null)
                        .map(([label, v]) => (
                          <div
                            key={label}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5"
                          >
                            <p className="text-[10px] font-bold uppercase text-gray-400">
                              {label}
                            </p>
                            <p className="text-sm font-semibold text-gray-800">
                              {String(v)}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}

                {/* Lista de duplicatas provisionadas (job) */}
                {Array.isArray(selectedSistema.dados?.duplicatas) &&
                  selectedSistema.dados.duplicatas.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                        Duplicatas provisionadas (
                        {selectedSistema.dados.duplicatas.length})
                      </p>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead className="bg-[#000638] text-white">
                            <tr>
                              <th className="px-2 py-1 text-left">Fornecedor</th>
                              <th className="px-2 py-1 text-left">Despesa</th>
                              <th className="px-2 py-1 text-left">Dupl.</th>
                              <th className="px-2 py-1 text-left">Venc.</th>
                              <th className="px-2 py-1 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSistema.dados.duplicatas.map((d, i) => (
                              <tr
                                key={i}
                                className="border-t border-gray-100 odd:bg-white even:bg-gray-50"
                              >
                                <td className="px-2 py-1 text-gray-800">
                                  {d.fornecedor || '—'}
                                </td>
                                <td className="px-2 py-1 text-gray-600">
                                  {d.despesa || '—'}
                                </td>
                                <td className="px-2 py-1 text-gray-600">
                                  {d.duplicata || '—'}
                                </td>
                                <td className="px-2 py-1 text-gray-600 whitespace-nowrap">
                                  {d.vencimento
                                    ? String(d.vencimento)
                                        .split('-')
                                        .reverse()
                                        .join('/')
                                    : '—'}
                                </td>
                                <td className="px-2 py-1 text-right font-semibold text-green-700 whitespace-nowrap">
                                  {(d.valor || 0).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {selectedSistema.dados.duplicatasTruncadas && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Lista truncada — veja todas na Liberação de Pagamento.
                        </p>
                      )}
                    </div>
                  )}

                {/* Ação de navegação (quando aplicável) */}
                {rotaDaNotificacao(selectedSistema) && (
                  <button
                    onClick={() => {
                      navigate(rotaDaNotificacao(selectedSistema));
                      onClose();
                    }}
                    className="w-full py-2 bg-[#000638] text-white text-sm rounded-lg font-bold hover:bg-[#001060] transition-all"
                  >
                    Abrir
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticesModal;
