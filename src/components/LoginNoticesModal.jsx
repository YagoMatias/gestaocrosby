import React, { useState, useEffect } from 'react';
import { X, Warning, Check } from '@phosphor-icons/react';
import { useAuth } from './AuthContext';
import { useNotices } from '../hooks/useNotices';

/**
 * Modal de avisos exibido automaticamente ao fazer login
 * Mostra avisos não lidos do dia com countdown de 5 segundos
 */
const LoginNoticesModal = ({ onClose }) => {
  const { user } = useAuth();
  const { getTodayUnreadNotices, confirmRead } = useNotices();
  const [notices, setNotices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Carregar avisos do dia ao montar
  useEffect(() => {
    loadTodayNotices();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && notices.length > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, notices]);

  const loadTodayNotices = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await getTodayUnreadNotices(user.id);
      if (result.success && result.data.length > 0) {
        setNotices(result.data);
      } else {
        // Não há avisos do dia, fechar modal
        onClose();
      }
    } catch (error) {
      console.error('Erro ao carregar avisos do dia:', error);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (countdown > 0 || confirming) return;

    const currentNotice = notices[currentIndex];
    setConfirming(true);

    try {
      await confirmRead(currentNotice.id, user.id);

      // Se houver mais avisos, ir para o próximo
      if (currentIndex < notices.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setCountdown(5); // Resetar countdown
      } else {
        // Todos os avisos foram confirmados
        onClose();
      }
    } catch (error) {
      console.error('Erro ao confirmar leitura:', error);
    } finally {
      setConfirming(false);
    }
  };

  // Não renderizar se estiver carregando ou não houver avisos
  if (loading || notices.length === 0) return null;

  const currentNotice = notices[currentIndex];
  const hasMultiple = notices.length > 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-fade-in-scale">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Warning size={32} weight="fill" className="animate-pulse" />
              <h2 className="text-2xl font-bold">Aviso Importante</h2>
            </div>
            {hasMultiple && (
              <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full font-semibold">
                {currentIndex + 1} de {notices.length}
              </span>
            )}
          </div>
          <p className="text-sm text-white text-opacity-90">
            Por favor, leia com atenção antes de continuar
          </p>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            {currentNotice.title}
          </h3>
          <div
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: currentNotice.content }}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex flex-col gap-3">
            {/* Progress bar do countdown */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>

            {/* Botão de confirmação */}
            <button
              onClick={handleConfirm}
              disabled={countdown > 0 || confirming}
              className={`w-full py-3 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                countdown > 0 || confirming
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transform hover:scale-105'
              }`}
            >
              {confirming ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Confirmando...</span>
                </>
              ) : countdown > 0 ? (
                <>
                  <span className="text-2xl font-bold">{countdown}</span>
                  <span>segundos para continuar...</span>
                </>
              ) : (
                <>
                  <Check size={24} weight="bold" />
                  <span>Li e Compreendi</span>
                </>
              )}
            </button>

            {/* Informações adicionais */}
            <div className="text-xs text-gray-500 text-center">
              {hasMultiple && currentIndex < notices.length - 1 ? (
                <p>
                  Após confirmar, você verá o próximo aviso (
                  {notices.length - currentIndex - 1} restante
                  {notices.length - currentIndex - 1 > 1 ? 's' : ''})
                </p>
              ) : (
                <p>Após confirmar, você será redirecionado para o sistema</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginNoticesModal;
