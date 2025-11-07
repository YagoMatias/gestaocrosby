import React, { useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import {
  MagnifyingGlass,
  CreditCard as CreditCardIcon,
} from '@phosphor-icons/react';

const CheckInCard = () => {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [cvv, setCvv] = useState('');
  const [cartaoEncontrado, setCartaoEncontrado] = useState(false);

  // Dados mockados de cartões por empresa
  const cartoesMockados = {
    95: {
      name: 'João Silva Santos',
      cardNumber: '4642 3489 9867 7632',
      valid: '11/20',
      expiry: '03/28',
      cvv: '123',
      bgColor: 'bg-[#000638]',
      tipo: 'Blue',
      limite: 300,
      status: 'Ativo',
      corTipo: 'text-blue-600',
      corBadge: 'bg-blue-100 text-blue-800',
    },
    96: {
      name: 'Maria Oliveira Costa',
      cardNumber: '5234 8765 4321 9876',
      valid: '05/21',
      expiry: '08/29',
      cvv: '456',
      bgColor: 'bg-black',
      tipo: 'Black',
      limite: 200,
      status: 'Ativo',
      corTipo: 'text-gray-900',
      corBadge: 'bg-gray-100 text-gray-800',
    },
    97: {
      name: 'Pedro Henrique Lima',
      cardNumber: '6011 1234 5678 9012',
      valid: '02/22',
      expiry: '12/27',
      cvv: '789',
      bgColor: 'bg-gradient-to-br from-gray-300 to-gray-400',
      tipo: 'Platinum',
      limite: 100,
      status: 'Inativo',
      corTipo: 'text-gray-600',
      corBadge: 'bg-gray-100 text-gray-600',
      textColor: 'text-gray-800',
    },
  };

  const handleBuscar = () => {
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

    console.log('🔍 Empresa selecionada:', empresaSelecionada);
    console.log('🔍 Empresa ID (extraído):', empresaId);
    console.log('🔍 CVV digitado:', cvv);
    console.log('🔍 Cartões disponíveis:', Object.keys(cartoesMockados));

    const cartao = cartoesMockados[empresaId];
    console.log('🔍 Cartão encontrado:', cartao);

    if (cartao && cartao.cvv === cvv) {
      console.log('✅ CVV correto! Exibindo cartão');
      setCartaoEncontrado(true);
    } else {
      console.log('❌ CVV incorreto ou cartão não encontrado');
      console.log('   CVV esperado:', cartao?.cvv);
      console.log('   CVV digitado:', cvv);
      setCartaoEncontrado(false);
      alert(
        `CVV incorreto ou cartão não encontrado para esta empresa.\n\nDica: Para empresa ${empresaId}, o CVV correto é ${
          cartao?.cvv || 'não cadastrado'
        }`,
      );
    }
  };

  const cartaoAtual =
    empresasSelecionadas.length > 0 && cartaoEncontrado
      ? cartoesMockados[
          typeof empresasSelecionadas[0] === 'object'
            ? empresasSelecionadas[0].cd_empresa
            : empresasSelecionadas[0]
        ]
      : null;

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
                maxLength="3"
                placeholder="Digite o CVV (3 dígitos)"
                className="w-full px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Botão de Busca */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleBuscar}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium shadow-md hover:shadow-lg"
            >
              <MagnifyingGlass size={20} weight="bold" />
              Buscar Cartão
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

                  <div className="w-full px-8 absolute top-8">
                    <div className="flex items-end justify-end">
                      <img
                        className="w-1/2 h-1/2"
                        src="/logobranco.png"
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
                      <p className="text-[8px]">
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
                          <p className="font-bold tracking-wider text-sm">
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

        {/* Informações adicionais */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Informação:</strong> Os dados exibidos são fictícios e
            apenas para fins demonstrativos. Para consultar dados reais, utilize
            o CVV correto associado à empresa selecionada.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckInCard;
