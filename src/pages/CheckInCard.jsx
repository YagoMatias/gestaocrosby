import React, { useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import {
  MagnifyingGlass,
  CreditCard as CreditCardIcon,
} from '@phosphor-icons/react';

const CheckInCard = () => {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [cvv, setCvv] = useState('');
  const [cartaoEncontrado, setCartaoEncontrado] = useState(false);
  const [cartaoAtual, setCartaoAtual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const { apiCall } = useApiClient();

  const handleBuscar = async () => {
    if (empresasSelecionadas.length === 0 || !cvv) {
      alert('Por favor, selecione uma empresa e informe o CVV');
      return;
    }

    // Extrair o código da empresa do objeto
    const empresaSelecionada = empresasSelecionadas[0];
    const empresaId =
      typeof empresaSelecionada === 'object'
        ? empresaSelecionada.cd_empresa
        : empresaSelecionada;

    setLoading(true);
    setCartaoEncontrado(false);
    setCartaoAtual(null);

    try {
      console.log('🔍 Buscando cartões para empresa:', empresaId);
      console.log('🔍 CVV digitado:', cvv);

      // Buscar dados da API
      const response = await apiCall(
        `/api/utils/acao-cartoes?cd_empcad=${empresaId}&cd_sufixo=${cvv}`,
      );

      console.log('📊 Resposta da API:', response);

      if (response.success && response.data.length > 0) {
        const cartaoData = response.data[0];
        console.log('✅ Cartão encontrado:', cartaoData);

        // Determinar o tipo de cartão baseado no valor do voucher
        let tipo = 'Blue';
        let bgColor = 'bg-[#000638]';
        let corTipo = 'text-blue-600';
        let textColor = 'text-white';

        if (cartaoData.vl_voucher >= 300) {
          tipo = 'Blue';
          bgColor = 'bg-[#000638]';
          corTipo = 'text-blue-600';
        } else if (cartaoData.vl_voucher >= 200) {
          tipo = 'Black';
          bgColor = 'bg-black';
          corTipo = 'text-gray-900';
        } else {
          tipo = 'Platinum';
          bgColor = 'bg-gradient-to-br from-gray-300 to-gray-400';
          corTipo = 'text-gray-600';
          textColor = 'text-gray-800';
        }

        // Determinar o status (invertido: NÃO USADO = Ativo / USADO = Inativo)
        const status =
          cartaoData.situacao_uso === 'NÃO USADO' ? 'Ativo' : 'Inativo';

        // Mockar o limite conforme as regras solicitadas:
        // status 'Ativo' => Platinum=100, Blue=200, Black=300
        // status 'Inativo' => 0 para todos
        let mockedLimite = 0;
        if (status === 'Ativo') {
          switch (tipo) {
            case 'Platinum':
              mockedLimite = 100;
              break;
            case 'Blue':
              mockedLimite = 200;
              break;
            case 'Black':
              mockedLimite = 300;
              break;
            default:
              mockedLimite = 0;
          }
        } else {
          mockedLimite = 0;
        }

        setCartaoAtual({
          cd_pessoa: cartaoData.cd_pessoa,
          // usar nm_pessoa quando disponível (foi adicionado no backend)
          nm_pessoa: cartaoData.nm_pessoa || null,
          // campo 'name' para compatibilidade com a UI - preferir nm_pessoa
          name:
            (cartaoData.nm_pessoa && cartaoData.nm_pessoa.toString()) ||
            'Cliente',
          cvv: cartaoData.cd_sufixo,
          // valor exibido (mockado) conforme regra
          limite: mockedLimite,
          // manter o valor original caso precise para referência
          originalLimite: parseFloat(cartaoData.vl_voucher || 0),
          status: status,
          situacao_uso: cartaoData.situacao_uso,
          tipo: tipo,
          bgColor: bgColor,
          corTipo: corTipo,
          textColor: textColor,
          nr_voucher: cartaoData.nr_voucher,
          dt_cadastro: cartaoData.dt_cadastro,
          cd_empcad: cartaoData.cd_empcad,
          // Informações da transação (quando o voucher foi usado)
          nr_transacao: cartaoData.nr_transacao,
          dt_transacao: cartaoData.dt_transacao,
          cd_empresa_transacao: cartaoData.cd_empresa_transacao,
          vl_total: cartaoData.vl_total,
          vl_desconto: cartaoData.vl_desconto,
          vl_bruto: cartaoData.vl_bruto,
          pct_desconto_bruto: cartaoData.pct_desconto_bruto,
        });

        setCartaoEncontrado(true);

        // Se o status for Inativo, abrir o modal automaticamente
        if (status === 'Inativo') {
          setModalAberto(true);
        }
      } else {
        console.log('❌ Nenhum cartão encontrado');
        setCartaoEncontrado(false);
        alert(
          `CVV incorreto ou cartão não encontrado para esta empresa.\n\nVerifique o CVV e tente novamente.`,
        );
      }
    } catch (error) {
      console.error('❌ Erro ao buscar cartão:', error);
      alert(
        `Erro ao buscar cartão: ${
          error.response?.data?.message || error.message
        }`,
      );
      setCartaoEncontrado(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <PageTitle
        title="Check-in Card"
        icon={CreditCardIcon}
        subtitle="Consulte informações de cartões corporativos"
      />

      <div className="max-w-6xl mx-auto mt-6 space-y-6">
        {/* Card de Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CreditCardIcon size={24} className="text-blue-600" />
            Filtros de Busca
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Filtro de Empresa */}
            <div>
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>

            {/* Filtro de CVV */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                CVV do Cartão
              </label>
              <input
                type="text"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                placeholder="Digite o CVV"
                className="w-full px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Botão de Busca */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleBuscar}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Buscando...
                </>
              ) : (
                <>
                  <MagnifyingGlass size={20} weight="bold" />
                  Buscar Cartão
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card do Cartão */}
        {cartaoAtual && (
          <div className="space-y-6">
            {/* Informações do Cartão - Acima do cartão visual */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tipo do Cartão */}
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Tipo do Cartão</p>
                  <div className="flex items-center justify-center gap-2">
                    <CreditCardIcon size={24} className={cartaoAtual.corTipo} />
                    <p className={`text-xl font-bold ${cartaoAtual.corTipo}`}>
                      {cartaoAtual.tipo}
                    </p>
                  </div>
                </div>

                {/* Limite Disponível */}
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    Limite Disponível
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {cartaoAtual.limite.toFixed(2)}
                  </p>
                </div>

                {/* Status */}
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Status</p>
                  <span
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                      cartaoAtual.status === 'Ativo'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {cartaoAtual.status === 'Ativo' ? '✓ Ativo' : '✕ Inativo'}
                  </span>
                  {cartaoAtual.status === 'Inativo' && (
                    <button
                      onClick={() => setModalAberto(true)}
                      className="mt-3 text-xs text-red-600 hover:text-red-800 underline font-medium"
                    >
                      Ver detalhes da transação
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8 justify-center flex-wrap">
              {/* Cartão Visual Front */}
              <div className="flex justify-center">
                <div
                  className={`w-11/12 h-64 m-auto ${
                    cartaoAtual.bgColor
                  } rounded-xl relative ${
                    cartaoAtual.textColor || 'text-white'
                  } shadow-2xl transition-transform transform hover:scale-105 duration-300`}
                >
                  <img
                    className="relative object-cover w-full h-full rounded-xl opacity-15"
                    src="https://i.imgur.com/kGkSg1v.png"
                    alt="Card Background"
                  />

                  <div className="w-full px-4  absolute top-7">
                    <div className="flex items-end justify-end">
                      <img
                        className="w-40 h-30"
                        src="../dist/logobranco2.png"
                        alt="logobranco"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cartão Visual Back */}
              <div className="flex justify-center">
                <div
                  className={`w-11/12 h-64 m-auto ${
                    cartaoAtual.bgColor
                  } rounded-xl relative ${
                    cartaoAtual.textColor || 'text-white'
                  } shadow-2xl transition-transform transform hover:scale-105 duration-300`}
                >
                  <img
                    className="relative object-cover w-full h-full rounded-xl opacity-15"
                    src="https://i.imgur.com/kGkSg1v.png"
                    alt="Card Background"
                  />

                  <div className="w-full px-8 absolute top-6">
                    <div className="flex flex-col items-center justify-center">
                      <h2 className="font-bold">CARTÃO EXCLUSIVO CROSBY</h2>
                      <p className="text-[8px] text-center">
                        Este cartão oferece R$100 nas compras [preço de varejo]
                        para ser usado em até 07 dias. Intransferível, não
                        cumulativo e deve ser apresentado na loja Crosby.
                      </p>
                    </div>
                    <div className="flex flex-col items-center pt-8">
                      <p className="font-medium tracking-wider text-lg">
                        {cartaoAtual.name}
                      </p>
                    </div>

                    <div className="pt-6">
                      <div className="flex flex-col">
                        <div className="flex items-center justify-center h-10 bg-black mx-[-32px]">
                          <p className="font-bold tracking-wider text-sm text-gray-400 ">
                            {cartaoAtual.cvv}
                          </p>
                        </div>

                        <div className="flex items-center justify-center pt-4">
                          <p className="font-bold tracking-[0.6rem] text-sm">
                            INSPIRE SUCESSO
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mensagem quando não há cartão encontrado */}
        {!cartaoAtual && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <CreditCardIcon size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              Nenhum cartão selecionado
            </h3>
            <p className="text-gray-500">
              Selecione uma empresa e informe o CVV para visualizar os dados do
              cartão
            </p>
          </div>
        )}
      </div>

      {/* Modal de Informações da Transação (Cartão Inativo) */}
      {modalAberto && cartaoAtual && cartaoAtual.status === 'Inativo' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="bg-red-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCardIcon size={32} weight="bold" />
                  <div>
                    <h2 className="text-2xl font-bold">Cartão Inativo</h2>
                    <p className="text-red-100 text-sm">
                      Informações da transação de uso
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalAberto(false)}
                  className="text-white hover:bg-red-700 rounded-full p-2 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-6">
              {/* Informações do Voucher */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                  📋 Dados do Voucher
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 mb-1">Empresa Cad.</p>
                    <p className="font-semibold text-gray-800">
                      {cartaoAtual.cd_empcad || '--'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 mb-1">Código Pessoa</p>
                    <p className="font-semibold text-gray-800">
                      {cartaoAtual.cd_pessoa || '--'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 mb-1">Número Voucher</p>
                    <p className="font-semibold text-gray-800">
                      {cartaoAtual.nr_voucher || '--'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 mb-1">CVV / Sufixo</p>
                    <p className="font-semibold text-gray-800">
                      {cartaoAtual.cvv || '--'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded col-span-2">
                    <p className="text-xs text-gray-600 mb-1">
                      Situação de Uso
                    </p>
                    <p className="font-semibold text-red-600">
                      {cartaoAtual.situacao_uso || '--'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações da Transação */}
              {cartaoAtual.nr_transacao ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                    🛒 Transação de Uso
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Nº Transação</p>
                      <p className="font-semibold text-blue-800">
                        {cartaoAtual.nr_transacao}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">
                        Data Transação
                      </p>
                      <p className="font-semibold text-blue-800">
                        {cartaoAtual.dt_transacao
                          ? new Date(cartaoAtual.dt_transacao).toLocaleString(
                              'pt-BR',
                            )
                          : '--'}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Empresa</p>
                      <p className="font-semibold text-blue-800">
                        {cartaoAtual.cd_empresa_transacao || '--'}
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Valor Total</p>
                      <p className="font-semibold text-green-700 text-lg">
                        R${' '}
                        {cartaoAtual.vl_total
                          ? parseFloat(cartaoAtual.vl_total).toFixed(2)
                          : '0.00'}
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Desconto</p>
                      <p className="font-semibold text-yellow-700 text-lg">
                        R${' '}
                        {cartaoAtual.vl_desconto
                          ? parseFloat(cartaoAtual.vl_desconto).toFixed(2)
                          : '0.00'}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded">
                      <p className="text-xs text-gray-600 mb-1">Valor Bruto</p>
                      <p className="font-semibold text-purple-700 text-lg">
                        R${' '}
                        {cartaoAtual.vl_bruto
                          ? parseFloat(cartaoAtual.vl_bruto).toFixed(2)
                          : '0.00'}
                      </p>
                    </div>
                    {cartaoAtual.pct_desconto_bruto && (
                      <div className="bg-orange-50 p-3 rounded col-span-2">
                        <p className="text-xs text-gray-600 mb-1">
                          % Desconto sobre Bruto
                        </p>
                        <p className="font-semibold text-orange-700 text-lg">
                          {parseFloat(cartaoAtual.pct_desconto_bruto).toFixed(
                            2,
                          )}
                          %
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <p className="text-gray-600">
                    ℹ️ Nenhuma transação registrada para este voucher
                  </p>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-100 p-4 rounded-b-lg flex justify-end">
              <button
                onClick={() => setModalAberto(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInCard;
