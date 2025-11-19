import React, { useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import { supabase } from '../lib/supabase';
import { CreditCard, MagnifyingGlass } from '@phosphor-icons/react';

const MeusCartoes = () => {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [cartoesEnriquecidos, setCartoesEnriquecidos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Novos filtros
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroCdPessoa, setFiltroCdPessoa] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const { apiCall } = useApiClient();

  const buscarCartoes = async () => {
    if (empresasSelecionadas.length === 0) {
      alert('Por favor, selecione pelo menos uma empresa');
      return;
    }

    // Extrair códigos de todas as empresas selecionadas
    const empresasIds = empresasSelecionadas.map((empresa) =>
      typeof empresa === 'object' ? empresa.cd_empresa : empresa,
    );

    // Juntar os IDs com vírgula para enviar na query
    const empresasParam = empresasIds.join(',');

    setLoading(true);

    try {
      console.log('🔍 Buscando cartões das empresas:', empresasParam);

      const response = await apiCall(
        `/api/utils/lista-cartoes?cd_empcad=${empresasParam}`,
      );

      console.log('📊 Resposta da API:', response);

      if (response.success && response.data) {
        const cartoesDaAPI = response.data;
        setCartoes(cartoesDaAPI);
        console.log('✅ Cartões encontrados:', cartoesDaAPI.length);

        // Buscar dados do Supabase para enriquecer
        // IMPORTANTE: Fazer trim() nos sufixos pois vêm com espaços extras do banco
        const sufixos = cartoesDaAPI
          .map((c) => c.cd_sufixo?.trim())
          .filter(Boolean);

        if (sufixos.length > 0) {
          console.log('🔍 Buscando tipos de cartões no Supabase...');
          console.log('📝 Sufixos (primeiros 5):', sufixos.slice(0, 5));
          const { data: supabaseData, error: supabaseError } = await supabase
            .from('cliente_cartao')
            .select('sufixo_voucher, vl_cartao')
            .in('sufixo_voucher', sufixos);

          if (!supabaseError && supabaseData) {
            console.log(
              '✅ Tipos de cartões obtidos do Supabase:',
              supabaseData,
            );

            // Criar mapa de sufixo -> vl_cartao
            const mapSupabase = {};
            supabaseData.forEach((item) => {
              mapSupabase[item.sufixo_voucher] = item.vl_cartao;
            });

            // Enriquecer os cartões com tipo e limite
            const cartoesComTipo = cartoesDaAPI.map((cartao) => {
              const sufixoTrimmed = cartao.cd_sufixo?.trim();
              const vlCartao = mapSupabase[sufixoTrimmed];
              let tipo = null;
              let limiteMocado = 0;

              // Determinar tipo e limite baseado no vl_cartao
              if (vlCartao === 'Clean - 100') {
                tipo = 'Platinum';
                limiteMocado = cartao.situacao_uso === 'NÃO USADO' ? 100 : 0;
              } else if (vlCartao === 'Cian - 200') {
                tipo = 'Cian';
                limiteMocado = cartao.situacao_uso === 'NÃO USADO' ? 200 : 0;
              } else if (vlCartao === 'Blue - 300') {
                tipo = 'Blue';
                limiteMocado = cartao.situacao_uso === 'NÃO USADO' ? 300 : 0;
              }

              return {
                ...cartao,
                tipo_cartao: tipo,
                limite_mocado: limiteMocado,
              };
            });

            setCartoesEnriquecidos(cartoesComTipo);
            console.log('✅ Cartões enriquecidos:', cartoesComTipo[0]);
          } else {
            console.error('❌ Erro ao buscar no Supabase:', supabaseError);
            setCartoesEnriquecidos(cartoesDaAPI);
          }
        } else {
          setCartoesEnriquecidos(cartoesDaAPI);
        }
      } else {
        setCartoes([]);
        setCartoesEnriquecidos([]);
        console.log('❌ Nenhum cartão encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar cartões:', error);
      alert(
        `Erro ao buscar cartões: ${
          error.response?.data?.message || error.message
        }`,
      );
      setCartoes([]);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '--';
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarValor = (valor) => {
    if (!valor) return 'R$ 0,00';
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
  };

  const obterCorTipo = (tipo) => {
    if (tipo === 'Platinum') return 'text-gray-600';
    if (tipo === 'Cian') return 'text-cyan-600';
    if (tipo === 'Blue') return 'text-blue-600';
    return 'text-gray-400';
  };

  // Aplicar filtros nos cartões
  const cartoesFiltrados = cartoesEnriquecidos.filter((cartao) => {
    // Filtro de Tipo
    if (filtroTipo !== 'todos') {
      if (filtroTipo === 'platinum' && cartao.tipo_cartao !== 'Platinum')
        return false;
      if (filtroTipo === 'cian' && cartao.tipo_cartao !== 'Cian') return false;
      if (filtroTipo === 'blue' && cartao.tipo_cartao !== 'Blue') return false;
    }

    // Filtro de Código Pessoa
    if (filtroCdPessoa && !cartao.cd_pessoa?.includes(filtroCdPessoa)) {
      return false;
    }

    // Filtro de Nome
    if (
      filtroNome &&
      !cartao.nm_pessoa?.toLowerCase().includes(filtroNome.toLowerCase())
    ) {
      return false;
    }

    // Filtro de Status
    if (filtroStatus !== 'todos') {
      if (filtroStatus === 'usado' && cartao.situacao_uso !== 'USADO')
        return false;
      if (filtroStatus === 'nao-usado' && cartao.situacao_uso !== 'NÃO USADO')
        return false;
    }

    return true;
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <PageTitle
        title="Meus Cartões"
        icon={CreditCard}
        subtitle="Visualize todos os cartões da empresa"
      />

      <div className="max-w-7xl mx-auto mt-6 space-y-4">
        {/* Card de Filtros */}
        <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4">
          <div className="flex items-center gap-2 mb-4">
            <MagnifyingGlass size={20} className="text-[#000638]" />
            <h2 className="text-sm font-bold text-[#000638] font-barlow">
              Filtros de Busca
            </h2>
          </div>

          <div className="space-y-3">
            {/* Primeira linha: Empresa e Buscar */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">
              <div className="lg:col-span-4">
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={setEmpresasSelecionadas}
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={buscarCartoes}
                  disabled={loading}
                  className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase w-full justify-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <MagnifyingGlass size={12} weight="bold" />
                      <span>Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Segunda linha: Filtros adicionais */}
            {cartoesEnriquecidos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-3 border-t border-[#000638]/10">
                {/* Filtro Tipo */}
                <div>
                  <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                    Tipo de Cartão
                  </label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
                  >
                    <option value="todos">TODOS</option>
                    <option value="platinum">PLATINUM</option>
                    <option value="cian">CIAN</option>
                    <option value="blue">BLUE</option>
                  </select>
                </div>

                {/* Filtro Código Pessoa */}
                <div>
                  <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                    Cód. Pessoa
                  </label>
                  <input
                    type="text"
                    value={filtroCdPessoa}
                    onChange={(e) => setFiltroCdPessoa(e.target.value)}
                    placeholder="Buscar código..."
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                  />
                </div>

                {/* Filtro Nome */}
                <div>
                  <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                    placeholder="Buscar nome..."
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                  />
                </div>

                {/* Filtro Status */}
                <div>
                  <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
                  >
                    <option value="todos">TODOS</option>
                    <option value="usado">USADO</option>
                    <option value="nao-usado">NÃO USADO</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabela de Cartões */}
        {cartoesEnriquecidos.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md border border-[#000638]/10">
            <div className="p-3 border-b border-[#000638]/10 flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#000638] font-barlow">
                Lista de Cartões
              </h2>
              <div className="text-xs text-gray-600">
                Exibindo{' '}
                <span className="font-semibold">{cartoesFiltrados.length}</span>{' '}
                de{' '}
                <span className="font-semibold">
                  {cartoesEnriquecidos.length}
                </span>{' '}
                cartões
              </div>
            </div>
            <div className="p-3 overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Cód. Pessoa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nº Voucher
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      CVV
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Limite Disponível
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Valor Original
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nº Transação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Data Transação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {cartoesFiltrados.map((cartao, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cartao.cd_empcad || '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cartao.cd_pessoa || '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cartao.nm_pessoa || '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cartao.nr_voucher || '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cartao.cd_sufixo || '--'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {cartao.tipo_cartao ? (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-bold rounded ${
                              cartao.tipo_cartao === 'Platinum'
                                ? 'bg-gray-100 text-gray-700'
                                : cartao.tipo_cartao === 'Cian'
                                ? 'bg-cyan-100 text-cyan-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {cartao.tipo_cartao}
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        {formatarValor(cartao.limite_mocado)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                        {formatarValor(cartao.vl_voucher)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-bold rounded ${
                            cartao.situacao_uso === 'NÃO USADO'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {cartao.situacao_uso || '--'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cartao.nr_transacao || '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatarData(cartao.dt_transacao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md border border-[#000638]/10">
            <div className="p-3 border-b border-[#000638]/10">
              <h2 className="text-sm font-bold text-[#000638] font-barlow">
                Lista de Cartões
              </h2>
            </div>
            <div className="p-12 text-center">
              <CreditCard size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-sm font-semibold text-gray-600 mb-1">
                Nenhum cartão encontrado
              </h3>
              <p className="text-xs text-gray-500">
                Selecione uma empresa e clique em "Buscar" para visualizar os
                dados
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusCartoes;
