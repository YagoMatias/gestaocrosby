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
  Eye,
} from '@phosphor-icons/react';
import { editarDespesaManual } from '../services/despesasManuaisService';
import { salvarObservacaoDespesa } from '../services/observacoesDespesasService';
import LoadingSpinner from './LoadingSpinner';

const ModalDetalhesDespesaManual = ({
  modalDespManual,
  setModalDespManual,
  despesa,
  onSave,
  periodoAtual, // 🆕 Receber período atual para salvar observação
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

  // 🆕 Detectar se é despesa manual ou TOTVS
  const isDespesaManual = despesa?._isDespesaManual || false;

  useEffect(() => {
    if (despesa) {
      console.log('📋 Despesa carregada no modal:', {
        ...despesa,
        isDespesaManual,
      });
      // Na tabela, 'fornecedor' é o nome principal da despesa
      setDadosEditados({
        nome: despesa.fornecedor || despesa.label || '',
        valor: Math.abs(despesa.valor || despesa.value || 0),
        fornecedor: despesa.fornecedor || '',
        observacoes: despesa.observacoes || despesa._observacaoTotvs || '',
      });
    }
  }, [despesa, isDespesaManual]);

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

      if (isDespesaManual) {
        // ============ DESPESA MANUAL: Edição completa ============
        const despesaId = despesa.id || despesa._idDespesaManual;

        if (!despesaId) {
          console.error('❌ Despesa manual sem ID:', despesa);
          throw new Error('ID da despesa manual não encontrado.');
        }

        console.log('💾 Salvando alterações da DESPESA MANUAL:', {
          id: despesaId,
          despesaCompleta: despesa,
          dados: dadosEditados,
        });

        // Preparar dados para envio (usar os nomes de campo corretos do banco)
        const dadosParaAtualizar = {
          fornecedor: dadosEditados.nome || dadosEditados.fornecedor,
          valor: dadosEditados.valor,
          observacoes: dadosEditados.observacoes || null,
        };

        // Chamar API para atualizar no Supabase
        const resultado = await editarDespesaManual(
          despesaId,
          dadosParaAtualizar,
        );

        console.log('✅ Despesa manual atualizada com sucesso:', resultado);
      } else {
        // ============ DESPESA TOTVS: Apenas salvar observação ============
        if (!periodoAtual?.dt_inicio || !periodoAtual?.dt_fim) {
          throw new Error('Período atual não encontrado.');
        }

        console.log('💾 Salvando OBSERVAÇÃO de despesa TOTVS:', {
          despesa,
          observacao: dadosEditados.observacoes,
          periodo: periodoAtual,
        });

        // Extrair dados da despesa TOTVS da descrição
        const descricaoParts = despesa.description?.split(' | ') || [];
        const empresaMatch = descricaoParts[0]?.match(/Empresa: (\d+)/);
        const fornecedorMatch = descricaoParts[1]?.match(/Fornecedor: (\d+)/);

        const dadosObservacao = {
          cd_empresa: empresaMatch ? parseInt(empresaMatch[1]) : null,
          cd_despesaitem: despesa.cd_despesaitem || null,
          cd_fornecedor: fornecedorMatch
            ? parseInt(fornecedorMatch[1])
            : despesa.cd_fornecedor || null,
          nr_duplicata: despesa.nr_duplicata || 'N/A',
          nr_parcela: despesa.nr_parcela || 0,
          observacao: dadosEditados.observacoes,
          dt_inicio: periodoAtual.dt_inicio,
          dt_fim: periodoAtual.dt_fim,
        };

        console.log('📋 Dados da observação:', dadosObservacao);

        // Salvar observação
        const resultado = await salvarObservacaoDespesa(dadosObservacao);

        console.log('✅ Observação salva com sucesso:', resultado);
      }

      // Chamar callback de sucesso (recarregar dados)
      if (onSave) {
        onSave({
          ...despesa,
          ...dadosEditados,
          value: -Math.abs(dadosEditados.valor),
          _observacaoTotvs: !isDespesaManual
            ? dadosEditados.observacoes
            : undefined,
        });
      }

      setModoEdicao(false);
      setModalDespManual(false);
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      setErro(error.message || 'Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleCancelar = () => {
    // Restaurar dados originais
    setDadosEditados({
      nome: despesa.fornecedor || despesa.label || '',
      valor: Math.abs(despesa.valor || despesa.value || 0),
      fornecedor: despesa.fornecedor || '',
      observacoes: despesa.observacoes || despesa._observacaoTotvs || '',
    });
    setErro('');
    setModoEdicao(false);
  };

  // 🆕 Definir título baseado no tipo de despesa
  const getTitulo = () => {
    if (isDespesaManual) {
      return modoEdicao
        ? 'Editar Despesa Manual'
        : 'Detalhes da Despesa Manual';
    } else {
      return modoEdicao ? 'Adicionar Observação' : 'Detalhes da Despesa TOTVS';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#000638] to-[#000856] text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDespesaManual ? (
              <FileText size={24} weight="bold" />
            ) : (
              <Eye size={24} weight="bold" />
            )}
            <h2 className="text-xl font-bold">{getTitulo()}</h2>
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
          {/* Tipo de Despesa Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isDespesaManual
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {isDespesaManual ? '✏️ DESPESA MANUAL' : '📊 DESPESA TOTVS'}
            </span>
          </div>

          {/* Título/Label */}
          <div className="border-b border-gray-200 pb-4">
            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Descrição / Nome da Despesa
            </label>
            {modoEdicao && isDespesaManual ? (
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
              {modoEdicao && isDespesaManual ? (
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
                  despesa._observacaoTotvs ||
                  'Sem observações'}
              </p>
            )}
          </div>

          {/* Detalhes Adicionais - Somente para despesas TOTVS */}
          {!isDespesaManual && (
            <>
              {/* Seção: Identificação */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                  📋 Identificação
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {despesa.cd_empresa && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Empresa
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.cd_empresa}
                      </p>
                    </div>
                  )}
                  {despesa.cd_despesaitem && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Item Despesa
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.cd_despesaitem}
                      </p>
                    </div>
                  )}
                  {despesa.cd_fornecedor && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Cód. Fornecedor
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.cd_fornecedor}
                      </p>
                    </div>
                  )}
                  {despesa.cd_ccusto && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Centro de Custo
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.cd_ccusto}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção: Documento */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                  📄 Documento
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {despesa.nr_duplicata && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Nº Duplicata
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.nr_duplicata}
                      </p>
                    </div>
                  )}
                  {despesa.nr_parcela !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Nº Parcela
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.nr_parcela}
                      </p>
                    </div>
                  )}
                  {despesa.nr_portador && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Nº Portador
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.nr_portador}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção: Datas */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                  📅 Datas
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {despesa.dt_entrada && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Data Entrada
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(despesa.dt_entrada)}
                      </p>
                    </div>
                  )}
                  {despesa.dt_liq && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Data Liquidação
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(despesa.dt_liq)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção: Valores Financeiros */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                  💰 Valores Financeiros
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {despesa.vl_duplicata !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Valor Duplicata
                      </label>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(despesa.vl_duplicata)}
                      </p>
                    </div>
                  )}
                  {despesa.vl_rateio !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Valor Rateio
                      </label>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(despesa.vl_rateio)}
                      </p>
                    </div>
                  )}
                  {despesa.vl_pago !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Valor Pago
                      </label>
                      <p className="text-sm font-bold text-green-600">
                        {formatCurrency(despesa.vl_pago)}
                      </p>
                    </div>
                  )}
                  {despesa.vl_juros !== undefined && despesa.vl_juros !== 0 && (
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <label className="text-xs font-semibold text-red-700 mb-1 block">
                        Juros
                      </label>
                      <p className="text-sm font-bold text-red-600">
                        {formatCurrency(despesa.vl_juros)}
                      </p>
                    </div>
                  )}
                  {despesa.vl_acrescimo !== undefined &&
                    despesa.vl_acrescimo !== 0 && (
                      <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                        <label className="text-xs font-semibold text-red-700 mb-1 block">
                          Acréscimo
                        </label>
                        <p className="text-sm font-bold text-red-600">
                          {formatCurrency(despesa.vl_acrescimo)}
                        </p>
                      </div>
                    )}
                  {despesa.vl_desconto !== undefined &&
                    despesa.vl_desconto !== 0 && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <label className="text-xs font-semibold text-green-700 mb-1 block">
                          Desconto
                        </label>
                        <p className="text-sm font-bold text-green-600">
                          {formatCurrency(despesa.vl_desconto)}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Seção: Status */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                  ✅ Status
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {despesa.tp_situacao && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Situação
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.tp_situacao === 'N'
                          ? 'Normal'
                          : despesa.tp_situacao}
                      </p>
                    </div>
                  )}
                  {despesa.tp_estagio && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Estágio
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.tp_estagio}
                      </p>
                    </div>
                  )}
                  {despesa.tp_previsaoreal && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Previsão/Real
                      </label>
                      <p className="text-sm font-medium text-gray-900">
                        {despesa.tp_previsaoreal === '2'
                          ? 'Real'
                          : despesa.tp_previsaoreal}
                      </p>
                    </div>
                  )}
                  {despesa.in_aceite !== undefined &&
                    despesa.in_aceite !== null && (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">
                          Aceite
                        </label>
                        <p className="text-sm font-medium text-gray-900">
                          {despesa.in_aceite || 'Não informado'}
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </>
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
