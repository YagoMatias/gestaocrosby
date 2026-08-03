// Modal de solicitação de baixa de fatura.
// Mesmo fluxo usado na Inadimplência MTM: anexa o comprovante no Storage
// (bucket comprovantes_baixa) e grava a solicitação em `solicitacoes_baixa`
// com status "pendente", para ser aprovada/processada em /solicitacao-baixa.
import React, { useState } from 'react';
import {
  PaperPlaneRight,
  X,
  UploadSimple,
  FileText,
  Spinner,
} from '@phosphor-icons/react';
import { supabaseAdmin } from '../lib/supabase';
import { useAuth } from './AuthContext';

export const FORMAS_PAGAMENTO = [
  { id: 'confianca', label: 'Confiança', paidType: 4 },
  { id: 'sicredi', label: 'Sicredi', paidType: 4 },
  { id: 'adiantamento', label: 'Adiantamento (PIX TOTVS)', paidType: 3 },
  { id: 'cartao_credito', label: 'Cartão de Crédito', paidType: 1 },
  { id: 'cartao_debito', label: 'Cartão de Débito', paidType: 2 },
  { id: 'credev', label: 'CREDEV', paidType: 5 },
];

const formatarMoeda = (valor) =>
  (parseFloat(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatarData = (data) => {
  if (!data) return '--';
  const str = String(data).substring(0, 10);
  const [y, m, d] = str.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '--';
};

const ModalSolicitacaoBaixa = ({ fatura, onClose, onNotify }) => {
  const { user } = useAuth();
  const [comprovante, setComprovante] = useState(null);
  const [previewComprovante, setPreviewComprovante] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [dadosCartao, setDadosCartao] = useState({
    bandeira: '',
    autorizacao: '',
    nsu: '',
  });
  const [loading, setLoading] = useState(false);

  if (!fatura) return null;

  const isCartao =
    formaPagamento === 'cartao_credito' || formaPagamento === 'cartao_debito';

  const handleComprovanteChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setComprovante(file);
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewComprovante(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewComprovante(null);
    }
  };

  const handleEnviar = async () => {
    if (!comprovante) {
      onNotify?.({
        type: 'error',
        message: 'Selecione o comprovante de pagamento.',
      });
      return;
    }

    if (!dataPagamento) {
      onNotify?.({ type: 'error', message: 'Informe a data de pagamento.' });
      return;
    }

    if (!formaPagamento) {
      onNotify?.({ type: 'error', message: 'Selecione a forma de pagamento.' });
      return;
    }

    if (
      isCartao &&
      (!dadosCartao.bandeira || !dadosCartao.autorizacao || !dadosCartao.nsu)
    ) {
      onNotify?.({
        type: 'error',
        message:
          'Preencha todos os dados do cartão (bandeira, autorização e NSU).',
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Upload do comprovante no Supabase Storage
      const fileExt = comprovante.name.split('.').pop();
      const fileName = `${fatura.cd_empresa}_${fatura.cd_cliente}_${fatura.nr_fat || fatura.nr_fatura}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('comprovantes_baixa')
        .upload(filePath, comprovante, { upsert: false });

      if (uploadError)
        throw new Error(`Erro no upload: ${uploadError.message}`);

      // 2. Obter URL pública
      const { data: urlData } = supabaseAdmin.storage
        .from('comprovantes_baixa')
        .getPublicUrl(filePath);

      const comprovanteUrl = urlData?.publicUrl;

      // 3. Salvar solicitação no banco
      const { error: insertError } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .insert({
          cd_empresa: fatura.cd_empresa,
          cd_cliente: fatura.cd_cliente,
          nm_cliente: fatura.nm_cliente || '',
          nr_fat: fatura.nr_fat || fatura.nr_fatura,
          nr_parcela: fatura.nr_parcela || 1,
          vl_fatura: parseFloat(fatura.vl_fatura) || 0,
          vl_juros: parseFloat(fatura.vl_juros) || 0,
          dt_vencimento: fatura.dt_vencimento
            ? fatura.dt_vencimento.split('T')[0]
            : null,
          dt_emissao: fatura.dt_emissao ? fatura.dt_emissao.split('T')[0] : null,
          cd_portador: fatura.cd_portador || null,
          nm_portador: fatura.nm_portador || null,
          comprovante_url: comprovanteUrl,
          comprovante_path: filePath,
          status: 'pendente',
          user_id: user?.id || null,
          user_nome: user?.name || 'Usuário',
          user_email: user?.email || '',
          observacao: observacao || null,
          dt_pagamento: dataPagamento || null,
          forma_pagamento: formaPagamento || null,
          dados_cartao: isCartao ? dadosCartao : null,
        });

      if (insertError) throw new Error(`Erro ao salvar: ${insertError.message}`);

      onNotify?.({
        type: 'success',
        message: 'Solicitação de baixa enviada com sucesso!',
      });
      onClose?.();
    } catch (error) {
      console.error('Erro ao enviar solicitação de baixa:', error);
      onNotify?.({
        type: 'error',
        message: error.message || 'Erro ao enviar solicitação.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <PaperPlaneRight size={20} weight="bold" />
            Solicitação de Baixa
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:text-red-300 transition-colors"
          >
            <X size={22} weight="bold" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Dados da fatura */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Cliente:</span>
              <span className="font-semibold">{fatura.nm_cliente || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fatura:</span>
              <span className="font-semibold">
                {fatura.nr_fat || fatura.nr_fatura}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Parcela:</span>
              <span className="font-semibold">{fatura.nr_parcela || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Valor:</span>
              <span className="font-bold text-red-600">
                {formatarMoeda(fatura.vl_fatura)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vencimento:</span>
              <span className="font-semibold">
                {formatarData(fatura.dt_vencimento)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Portador:</span>
              <span className="font-semibold">
                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">
                  {fatura.nm_portador || fatura.cd_portador || '--'}
                </span>
              </span>
            </div>
          </div>

          {/* Data de Pagamento */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Data de Pagamento *
            </label>
            <input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
              max={new Date().toISOString().split('T')[0]}
              required
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Data que consta no comprovante de pagamento
            </p>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Forma de Pagamento *
            </label>
            <select
              value={formaPagamento}
              onChange={(e) => {
                setFormaPagamento(e.target.value);
                setDadosCartao({ bandeira: '', autorizacao: '', nsu: '' });
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
              required
            >
              <option value="">Selecione...</option>
              {FORMAS_PAGAMENTO.map((fp) => (
                <option key={fp.id} value={fp.id}>
                  {fp.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dados do cartão (se cartão de crédito ou débito) */}
          {isCartao && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-yellow-800">
                Dados do Cartão
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                  Bandeira *
                </label>
                <input
                  type="text"
                  value={dadosCartao.bandeira}
                  onChange={(e) =>
                    setDadosCartao((prev) => ({
                      ...prev,
                      bandeira: e.target.value,
                    }))
                  }
                  placeholder="Ex: Visa, Mastercard, Elo..."
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                    Nº Autorização *
                  </label>
                  <input
                    type="text"
                    value={dadosCartao.autorizacao}
                    onChange={(e) =>
                      setDadosCartao((prev) => ({
                        ...prev,
                        autorizacao: e.target.value,
                      }))
                    }
                    placeholder="Nº autorização"
                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                    NSU *
                  </label>
                  <input
                    type="text"
                    value={dadosCartao.nsu}
                    onChange={(e) =>
                      setDadosCartao((prev) => ({
                        ...prev,
                        nsu: e.target.value,
                      }))
                    }
                    placeholder="NSU"
                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Upload do comprovante */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Comprovante de Pagamento *
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#000638] transition-colors"
              onClick={() =>
                document.getElementById('comprovante-baixa-input').click()
              }
            >
              {previewComprovante ? (
                <div className="space-y-2">
                  {comprovante?.type?.startsWith('image/') ? (
                    <img
                      src={previewComprovante}
                      alt="Preview"
                      className="max-h-40 mx-auto rounded-lg"
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-[#000638]">
                      <FileText size={32} />
                      <span className="font-medium">{comprovante?.name}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Clique para trocar o arquivo
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-gray-400">
                  <UploadSimple size={32} className="mx-auto" />
                  <p className="text-sm">Clique para anexar o comprovante</p>
                  <p className="text-xs">Imagens (JPG, PNG) ou PDF</p>
                </div>
              )}
            </div>
            <input
              id="comprovante-baixa-input"
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleComprovanteChange}
            />
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Observação (opcional)
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Pagamento via PIX em 20/02..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleEnviar}
              disabled={
                loading ||
                !comprovante ||
                !dataPagamento ||
                !formaPagamento ||
                (isCartao &&
                  (!dadosCartao.bandeira ||
                    !dadosCartao.autorizacao ||
                    !dadosCartao.nsu))
              }
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#000638] rounded-lg hover:bg-[#fe0000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Spinner size={16} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <PaperPlaneRight size={16} weight="bold" />
                  Enviar Solicitação
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalSolicitacaoBaixa;
