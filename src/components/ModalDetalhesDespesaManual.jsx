import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  CurrencyDollar,
  FileText,
  Tag,
  PencilSimple,
  FloppyDisk,
  User,
} from '@phosphor-icons/react';
import { editarDespesaManual } from '../services/despesasManuaisService';
import LoadingSpinner from './LoadingSpinner';

const ModalDetalhesDespesaManual = ({
  modalDespManual,
  setModalDespManual,
  despesa,
  onSave,
}) => {
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosEditados, setDadosEditados] = useState({
    nome: '',
    valor: 0,
    fornecedor: '',
    observacoes: '',
  });

  useEffect(() => {
    if (despesa) {
      console.log('📋 Despesa carregada no modal:', despesa);
      // Na tabela, 'fornecedor' é o nome principal da despesa
      setDadosEditados({
        nome: despesa.fornecedor || despesa.label || '',
        valor: Math.abs(despesa.valor || despesa.value || 0),
        fornecedor: despesa.fornecedor || '',
        observacoes: despesa.observacoes || despesa.description || '',
      });
    }
  }, [despesa]);

  if (!despesa) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleInputChange = (field, value) => {
    setDadosEditados((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      setErro('');

      // Verificar se a despesa tem ID (é uma despesa manual do Supabase)
      const despesaId = despesa.id || despesa._idDespesaManual;

      if (!despesaId) {
        console.error('❌ Despesa sem ID:', despesa);
        throw new Error(
          'ID da despesa não encontrado. Não é possível editar despesas que não são manuais.',
        );
      }

      console.log('💾 Salvando alterações da despesa:', {
        id: despesaId,
        despesaCompleta: despesa,
        dados: dadosEditados,
      });

      // Preparar dados para envio (usar os nomes de campo corretos do banco)
      // A tabela despesas_manuais_dre usa 'fornecedor' para o nome da despesa
      const dadosParaAtualizar = {
        fornecedor: dadosEditados.nome || dadosEditados.fornecedor, // Nome da despesa
        valor: dadosEditados.valor,
        observacoes: dadosEditados.observacoes || null,
      };

      // Chamar API para atualizar no Supabase
      const resultado = await editarDespesaManual(
        despesaId,
        dadosParaAtualizar,
      );

      console.log('✅ Despesa atualizada com sucesso:', resultado);

      // Chamar callback de sucesso (recarregar dados)
      if (onSave) {
        onSave({
          ...despesa,
          ...dadosEditados,
          value: -Math.abs(dadosEditados.valor), // Para compatibilidade com DRE
        });
      }

      setModoEdicao(false);
      setModalDespManual(false);
    } catch (error) {
      console.error('❌ Erro ao salvar despesa:', error);
      setErro(error.message || 'Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleCancelar = () => {
    // Restaurar dados originais
    // Na tabela, 'fornecedor' é o nome principal da despesa
    setDadosEditados({
      nome: despesa.fornecedor || despesa.label || '',
      valor: Math.abs(despesa.valor || despesa.value || 0),
      fornecedor: despesa.fornecedor || '',
      observacoes: despesa.observacoes || despesa.description || '',
    });
    setErro('');
    setModoEdicao(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#000638] to-[#000856] text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={24} weight="bold" />
            <h2 className="text-xl font-bold">
              {modoEdicao
                ? 'Editar Despesa Manual'
                : 'Detalhes da Despesa Manual'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!modoEdicao && (
              <button
                onClick={() => setModoEdicao(true)}
                className="hover:bg-white/20 rounded-full p-2 transition-colors"
                title="Editar"
              >
                <PencilSimple size={24} weight="bold" />
              </button>
            )}
            <button
              onClick={() => {
                setModoEdicao(false);
                setModalDespManual(false);
              }}
              className="hover:bg-white/20 rounded-full p-2 transition-colors"
              title="Fechar"
            >
              <X size={24} weight="bold" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Título/Label */}
          <div className="border-b border-gray-200 pb-4">
            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Descrição / Nome da Despesa
            </label>
            {modoEdicao ? (
              <input
                type="text"
                value={dadosEditados.nome}
                onChange={(e) => handleInputChange('nome', e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-[#000638] transition-colors"
                placeholder="Nome da despesa"
              />
            ) : (
              <h3 className="text-2xl font-bold text-gray-900">
                {despesa.fornecedor || despesa.label}
              </h3>
            )}
          </div>

          {/* Detalhes em Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Valor */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <CurrencyDollar
                  size={20}
                  weight="bold"
                  className="text-[#000638]"
                />
                <label className="text-sm font-semibold text-gray-600">
                  Valor
                </label>
              </div>
              {modoEdicao ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-red-600">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={dadosEditados.valor}
                    onChange={(e) =>
                      handleInputChange(
                        'valor',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-full text-xl font-bold text-red-600 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-[#000638] transition-colors"
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <p
                  className={`text-2xl font-bold ${
                    (despesa.valor || despesa.value) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {(despesa.valor || despesa.value) < 0 && '-'}
                  {formatCurrency(despesa.valor || despesa.value)}
                </p>
              )}
            </div>

            {/* ID */}
            {despesa.id && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={20} weight="bold" className="text-[#000638]" />
                  <label className="text-sm font-semibold text-gray-600">
                    ID
                  </label>
                </div>
                <p className="text-xl font-mono text-gray-900">{despesa.id}</p>
              </div>
            )}

            {/* Data de Emissão */}
            {despesa.dt_emissao && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar
                    size={20}
                    weight="bold"
                    className="text-[#000638]"
                  />
                  <label className="text-sm font-semibold text-gray-600">
                    Data de Emissão
                  </label>
                </div>
                <p className="text-lg text-gray-900">
                  {formatDate(despesa.dt_emissao)}
                </p>
              </div>
            )}

            {/* Data de Vencimento */}
            {despesa.dt_vencimento && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar
                    size={20}
                    weight="bold"
                    className="text-[#000638]"
                  />
                  <label className="text-sm font-semibold text-gray-600">
                    Data de Vencimento
                  </label>
                </div>
                <p className="text-lg text-gray-900">
                  {formatDate(despesa.dt_vencimento)}
                </p>
              </div>
            )}
          </div>

          {/* Observações/Descrição */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <label className="text-sm font-semibold text-blue-900 mb-2 block">
              Observações
            </label>
            {modoEdicao ? (
              <textarea
                value={dadosEditados.observacoes}
                onChange={(e) =>
                  handleInputChange('observacoes', e.target.value)
                }
                rows={4}
                className="w-full text-gray-700 border-2 border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-[#000638] transition-colors resize-none"
                placeholder="Adicione observações sobre esta despesa..."
              />
            ) : (
              <p className="text-gray-700 leading-relaxed">
                {despesa.observacoes ||
                  despesa.description ||
                  'Sem observações'}
              </p>
            )}
          </div>

          {/* Dados adicionais (se houver) */}
          {despesa.cd_empresa && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <label className="text-sm font-semibold text-gray-600 mb-2 block">
                Código da Empresa
              </label>
              <p className="text-lg text-gray-900">{despesa.cd_empresa}</p>
            </div>
          )}

          {despesa.cd_despesaitem && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <label className="text-sm font-semibold text-gray-600 mb-2 block">
                Código do Item de Despesa
              </label>
              <p className="text-lg text-gray-900">{despesa.cd_despesaitem}</p>
            </div>
          )}
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{erro}</p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-between items-center border-t border-gray-200">
          {salvando ? (
            <div className="w-full flex items-center justify-center py-2">
              <LoadingSpinner size="sm" text="Salvando alterações..." />
            </div>
          ) : modoEdicao ? (
            <>
              <button
                onClick={handleCancelar}
                className="bg-gray-400 text-white px-6 py-2.5 rounded-lg hover:bg-gray-500 transition-colors font-semibold shadow-md flex items-center gap-2"
                disabled={salvando}
              >
                <X size={20} weight="bold" />
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={salvando}
              >
                <FloppyDisk size={20} weight="bold" />
                Salvar Alterações
              </button>
            </>
          ) : (
            <button
              onClick={() => setModalDespManual(false)}
              className="bg-[#000638] text-white px-6 py-2.5 rounded-lg hover:bg-[#000856] transition-colors font-semibold shadow-md flex items-center gap-2 ml-auto"
            >
              <X size={20} weight="bold" />
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalDetalhesDespesaManual;
