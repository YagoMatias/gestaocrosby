import React, { useState, useEffect, useMemo } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import Table from '../components/ui/Table';
import { Users, Calendar, Funnel, Spinner } from '@phosphor-icons/react';
import FiltroNomeFantasia from '../components/FiltroNomeFantasia';
import FiltroOperacao from '../components/FiltroOperacao';
import FiltroTipoClassificacao from '../components/FiltroTipoClassificacao';
import FiltroClassificacao from '../components/FiltroClassificacao';
import LoadingSpinner from '../components/LoadingSpinner';

const Clientes = () => {
  // Estados para armazenar os dados e o estado da requisição
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false
  });
  
  // Estados para filtros
  const [filtros, setFiltros] = useState({
    dt_inicio: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    dt_fim: new Date().toISOString().split('T')[0]
  });

  // Filtro Nome Fantasia
  const [nomesFantasiaSelecionados, setNomesFantasiaSelecionados] = useState([]);
  const [dadosNomesFantasia, setDadosNomesFantasia] = useState([]);

  // Filtros de classificação (seleção múltipla)
  const [tiposClassSelecionados, setTiposClassSelecionados] = useState([]);
  const [classificacoesSelecionadas, setClassificacoesSelecionadas] = useState([]);
  
  // Filtro de operação (seleção múltipla)
  const [operacoesSelecionadas, setOperacoesSelecionadas] = useState([]);
  
  // Estado para controlar a visualização ativa
  const [visualizacaoAtiva, setVisualizacaoAtiva] = useState('clienteGeral'); // 'clienteGeral' ou 'detalhamentoClassificacao'
  
  // Filtro de status para detalhamento de classificação
  const [filtroStatus, setFiltroStatus] = useState(''); // '', 'unico', 'multiplas'
  
  // Hook personalizado para fazer chamadas à API
  const { utils } = useApiClient();

  // Função para carregar os dados
  const carregarDados = async () => {
    setLoading(true);
    try {
      const response = await utils.cadastroPessoa({
        ...filtros,
      });

      if (response.success) {
        // Verificar se os dados incluem ds_tipoclas e ds_classificacao
        if (response.data && response.data.length > 0) {
          console.log('Amostra de dados recebidos:', response.data.slice(0, 3));
        }
        
        setClientes(response.data);
        // Como o backend não está mais paginando, controlamos apenas no front
        setPagination(prev => ({
          ...prev,
          total: response.data?.length || 0,
          hasMore: false
        }));
      } else {
        setError('Erro ao carregar dados de clientes');
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setError(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Removido o carregamento automático de dados quando os filtros mudam
  // Os dados só serão carregados quando o usuário clicar no botão "Buscar"


  // Atualiza lista de nomes fantasia disponíveis quando dados carregam
  useEffect(() => {
    if (!Array.isArray(clientes)) return;
    const unicos = [...new Map(
      clientes
        .filter((c) => c && (c.nm_fantasia || c.cd_pessoa))
        .map((c) => [String(c.cd_pessoa), { cd_cliente: String(c.cd_pessoa), nm_fantasia: c.nm_fantasia || '' }])
    ).values()];
    setDadosNomesFantasia(unicos);
  }, [clientes]);

  // Função para lidar com a mudança de página
  const handlePageChange = (newPage) => {
    const newOffset = (newPage - 1) * pagination.limit;
    setPagination(prev => ({
      ...prev,
      offset: newOffset
    }));
  };

  // Função para lidar com a mudança nos filtros
  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Função para aplicar os filtros
  const aplicarFiltros = (e) => {
    e.preventDefault();
    setPagination(prev => ({
      ...prev,
      offset: 0 // Volta para a primeira página ao aplicar filtros
    }));
    carregarDados();
  };

  // Dados filtrados por Nome Fantasia
  const clientesFiltrados = useMemo(() => {
    if (!nomesFantasiaSelecionados || nomesFantasiaSelecionados.length === 0) return clientes;
    const selecionadosSet = new Set(
      nomesFantasiaSelecionados.map((f) => String(f.cd_cliente))
    );
    return clientes.filter((c) => selecionadosSet.has(String(c.cd_pessoa)));
  }, [clientes, nomesFantasiaSelecionados]);

  // Opções dinâmicas com base nos dados já filtrados por Nome Fantasia
  const opcoesTipoClass = useMemo(() => {
    const set = new Set(
      clientesFiltrados
        .map((c) => c.cd_tipoclas)
        .filter((v) => v !== null && v !== undefined && v !== '')
    );
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [clientesFiltrados]);

  const opcoesClassificacao = useMemo(() => {
    // Se não há tipos selecionados, retorna todas as classificações disponíveis
    if (tiposClassSelecionados.length === 0) {
      const set = new Set(
        clientesFiltrados
          .map((c) => c.cd_classificacao)
          .filter((v) => v !== null && v !== undefined && v !== '')
      );
      return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
    }

    // Verifica se o tipo 20 está selecionado
    const temTipo20 = tiposClassSelecionados.includes('20');
    const temOutrosTipos = tiposClassSelecionados.some(tipo => tipo !== '20');

    if (temTipo20 && !temOutrosTipos) {
      // Se apenas tipo 20 está selecionado, mostra classificações específicas
      return ['1', '2', '3', '4', '5', '6'];
    } else if (!temTipo20 && temOutrosTipos) {
      // Se apenas outros tipos estão selecionados, mostra SIM/NÃO
      return ['1', '2'];
    } else if (temTipo20 && temOutrosTipos) {
      // Se tipo 20 e outros estão selecionados, mostra todas as classificações possíveis
      return ['1', '2', '3', '4', '5', '6'];
    }

    // Fallback: retorna todas as classificações disponíveis
    const set = new Set(
      clientesFiltrados
        .map((c) => c.cd_classificacao)
        .filter((v) => v !== null && v !== undefined && v !== '')
    );
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [clientesFiltrados, tiposClassSelecionados]);

  // Opções dinâmicas de operações
  const opcoesOperacao = useMemo(() => {
    const set = new Set(
      clientesFiltrados
        .map((c) => c.cd_operacao)
        .filter((v) => v !== null && v !== undefined && v !== '')
    );
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [clientesFiltrados]);


  // Aplicar filtros de Tipo Classificação, Classificação e Operação
  const clientesFiltradosFinais = useMemo(() => {
    let data = clientesFiltrados;
    
    if (tiposClassSelecionados.length > 0) {
      data = data.filter((c) => {
        // Se 'VAZIO' está selecionado, filtra registros sem tipo de classificação
        if (tiposClassSelecionados.includes('VAZIO')) {
          return !c.cd_tipoclas || c.cd_tipoclas === null || c.cd_tipoclas === undefined || c.cd_tipoclas === '';
        }
        // Caso contrário, filtra pelos tipos selecionados
        return tiposClassSelecionados.includes(String(c.cd_tipoclas));
      });
    }
    
    if (classificacoesSelecionadas.length > 0) {
      data = data.filter((c) => {
        // Se 'VAZIO' está selecionado, filtra registros sem classificação
        if (classificacoesSelecionadas.includes('VAZIO')) {
          return !c.cd_classificacao || c.cd_classificacao === null || c.cd_classificacao === undefined || c.cd_classificacao === '';
        }
        
        const tipoCliente = String(c.cd_tipoclas);
        const classificacaoCliente = String(c.cd_classificacao);
        
        // Se tipo 20 está selecionado, permite classificações 1-6
        if (tiposClassSelecionados.includes('20')) {
          if (tipoCliente === '20') {
            // Para tipo 20, permite classificações 1-6
            return classificacoesSelecionadas.includes(classificacaoCliente);
          } else {
            // Para outros tipos quando tipo 20 também está selecionado
            // Verifica se a classificação está nas selecionadas E é válida para o tipo
            if (['1', '2'].includes(classificacaoCliente)) {
              return classificacoesSelecionadas.includes(classificacaoCliente);
            }
          }
        } else {
          // Se apenas outros tipos (não 20) estão selecionados, permite apenas 1-2
          if (['1', '2'].includes(classificacaoCliente)) {
            return classificacoesSelecionadas.includes(classificacaoCliente);
          }
        }
        
        return false;
      });
    }
    
    if (operacoesSelecionadas.length > 0) {
      data = data.filter((c) => operacoesSelecionadas.includes(String(c.cd_operacao)));
    }
    
    return data;
  }, [clientesFiltrados, tiposClassSelecionados, classificacoesSelecionadas, operacoesSelecionadas]);

  // Agrupar registros duplicados baseado nos campos especificados
  const clientesAgrupados = useMemo(() => {
    const chaveAgrupamento = (cliente) => {
      return `${cliente.cd_pessoa || ''}-${cliente.nm_pessoa || ''}-${cliente.nm_fantasia || ''}-${cliente.nr_cpfcnpj || ''}-${cliente.nr_telefone || ''}-${cliente.cd_tipoclas || ''}-${cliente.cd_classificacao || ''}`;
    };

    const mapa = new Map();
    
    clientesFiltradosFinais.forEach(cliente => {
      const chave = chaveAgrupamento(cliente);
      
      if (!mapa.has(chave)) {
        // Se não existe, adiciona o primeiro registro
        mapa.set(chave, cliente);
      } else {
        // Se já existe, mantém o primeiro (ou pode implementar lógica para escolher o melhor)
        // Por exemplo, manter o que tem dt_transacao mais recente
        const existente = mapa.get(chave);
        if (cliente.dt_transacao && (!existente.dt_transacao || cliente.dt_transacao > existente.dt_transacao)) {
          mapa.set(chave, cliente);
        }
      }
    });

    return Array.from(mapa.values());
  }, [clientesFiltradosFinais]);

  // Dados para detalhamento de classificação
  const dadosDetalhamentoClassificacao = useMemo(() => {
    const mapaClientes = new Map();
    
    clientesFiltradosFinais.forEach(cliente => {
      const chaveCliente = `${cliente.cd_pessoa || ''}-${cliente.nm_pessoa || ''}-${cliente.nm_fantasia || ''}`;
      
      if (!mapaClientes.has(chaveCliente)) {
        mapaClientes.set(chaveCliente, {
          cd_pessoa: cliente.cd_pessoa,
          nm_pessoa: cliente.nm_pessoa,
          nm_fantasia: cliente.nm_fantasia,
          tiposClassificacao: new Set(),
          classificacoes: new Set()
        });
      }
      
      const dadosCliente = mapaClientes.get(chaveCliente);
      
      // Adiciona tipo de classificação se existir
      if (cliente.cd_tipoclas) {
        dadosCliente.tiposClassificacao.add(cliente.cd_tipoclas);
      }
      
      // Adiciona classificação se existir
      if (cliente.cd_classificacao) {
        dadosCliente.classificacoes.add(cliente.cd_classificacao);
      }
    });
    
    const dados = Array.from(mapaClientes.values()).map((cliente, i) => ({
      id: `det-${cliente.cd_pessoa}-${i}`,
      cd_pessoa: cliente.cd_pessoa,
      nm_pessoa: cliente.nm_pessoa,
      nm_fantasia: cliente.nm_fantasia,
      tiposClassificacao: Array.from(cliente.tiposClassificacao).sort(),
      classificacoes: Array.from(cliente.classificacoes).sort(),
      temMultiplasClassificacoes: cliente.tiposClassificacao.size > 1 || cliente.classificacoes.size > 1
    }));
    
    // Aplicar filtro de status se especificado
    if (filtroStatus) {
      return dados.filter(cliente => {
        if (filtroStatus === 'multiplas') {
          return cliente.temMultiplasClassificacoes;
        } else if (filtroStatus === 'unico') {
          return !cliente.temMultiplasClassificacoes;
        }
        return true;
      });
    }
    
    return dados;
  }, [clientesFiltradosFinais, filtroStatus]);

  // Garantir chave única por linha na tabela (evita warnings de keys duplicadas)
  const clientesParaTabela = useMemo(() => {
    return clientesAgrupados.map((c, i) => ({
      id: `${c.cd_pessoa ?? 'p'}-${c.cd_operacao ?? 'op'}-${c.dt_transacao ?? 'dt'}-${i}`,
      ...c
    }));
  }, [clientesAgrupados]);

  // Definição das colunas da tabela
  const colunas = useMemo(() => [
    {
      key: 'cd_pessoa',
      title: 'Código',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'nm_pessoa',
      title: 'Nome',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]'
    },
    {
      key: 'nm_fantasia',
      title: 'Nome Fantasia',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]'
    },
    {
      key: 'nr_cpfcnpj',
      title: 'CPF/CNPJ',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value) => {
        if (!value) return '-';
        // Formatar CPF ou CNPJ
        if (value.length <= 11) {
          return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else {
          return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
      }
    },
    {
      key: 'nr_telefone',
      title: 'Telefone',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value) => {
        if (!value) return '-';
        // Formatar telefone
        return value.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
    },
    {
      key: 'cd_tipoclas',
      title: 'Tp. Class',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value, row) => {
        if (!value) return <span className="text-gray-500 italic">Não classificado</span>;
        return <span className="font-medium">{value} - {row.ds_tipoclas || value}</span>;
      }
    },
    {
      key: 'cd_classificacao',
      title: 'Classificação',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value, row) => {
        if (!value) return <span className="text-gray-500 italic">Não classificado</span>;
        return <span className="font-medium">{value} - {row.ds_classificacao || value}</span>;
      }
    },
    {
      key: 'dt_transacao',
      title: 'Dt Trans',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value) => {
        if (!value) return '-';
        // Formatar data
        const data = new Date(value);
        return data.toLocaleDateString('pt-BR');
      }
    },
    {
      key: 'cd_operacao',
      title: 'Operação',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]'
    },
    {
      key: 'cd_empresa',
      title: 'Emp',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]'
    }
  ], []);

  // Definição das colunas para detalhamento de classificação
  const colunasDetalhamentoClassificacao = useMemo(() => [
    {
      key: 'cd_pessoa',
      title: 'Código',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'nm_pessoa',
      title: 'Nome',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]'
    },
    {
      key: 'nm_fantasia',
      title: 'Nome Fantasia',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]'
    },
    {
      key: 'tiposClassificacao',
      title: 'Tipos de Classificação',
      sortable: false,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value, row) => (
        <div className="flex flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-gray-400">-</span>
          ) : (
            value.map((tipo, index) => {
              // Buscar o tipo correspondente nos clientes filtrados
              const clienteComTipo = clientesFiltradosFinais.find(c => 
                String(c.cd_tipoclas) === String(tipo) && c.ds_tipoclas
              );
              
              const nomeTipo = clienteComTipo?.ds_tipoclas || tipo;
              
              return (
                <span
                  key={index}
                  className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                >
                  {tipo} - {nomeTipo}
                </span>
              );
            })
          )}
        </div>
      )
    },
    {
      key: 'classificacoes',
      title: 'Classificações',
      sortable: false,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value, row) => {
        return (
          <div className="flex flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-gray-400">-</span>
            ) : (
              value.map((classificacao, index) => {
                // Encontrar um cliente com esta classificação
                const clienteComClassificacao = clientesFiltradosFinais.find(c => 
                  String(c.cd_classificacao) === String(classificacao) && c.ds_classificacao
                );
                
                const nomeClassificacao = clienteComClassificacao?.ds_classificacao || classificacao;
                
                return (
                  <span
                    key={index}
                    className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"
                  >
                    {classificacao} - {nomeClassificacao}
                  </span>
                );
              })
            )}
          </div>
        );
      }
    },
    {
      key: 'temMultiplasClassificacoes',
      title: 'Status',
      sortable: true,
      className: 'px-2 py-1 text-[0.68rem] font-bold',
      cellClassName: 'px-2 py-1 text-[0.67rem]',
      render: (value) => (
        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
          value 
            ? 'bg-orange-100 text-orange-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {value ? 'Múltiplas' : 'Única'}
        </span>
      )
    }
  ], []);

  // Cálculo da página atual com base no total filtrado e agrupado (front-end)
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(clientesAgrupados.length / pagination.limit) || 1;
  
  // Cálculo da página atual para detalhamento de classificação
  const currentPageDetalhamento = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPagesDetalhamento = Math.ceil(dadosDetalhamentoClassificacao.length / pagination.limit) || 1;

  return (
      <div className="p-6 max-w-7xl mx-auto w-full">
        <PageTitle 
          title="Cadastro de Clientes" 
          subtitle="Consulte informações sobre os clientes cadastrados no sistema"
          icon={Users}
        />

        {/* Filtros - estilo alinhado com Contas a Receber */}
        <div className="mb-4">
          <form onSubmit={aplicarFiltros} className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-[#000638]/10">
            <div className="mb-2">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
                <Funnel size={18} weight="bold" />
                Filtros
              </span>
              <span className="text-xs text-gray-500 mt-1">Selecione o período de análise</span>
            </div>

            {/* Primeira linha - Período e Nome Fantasia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]" htmlFor="dt_inicio">
                  Data Início
                </label>
                <input
                  type="date"
                  id="dt_inicio"
                  name="dt_inicio"
                  value={filtros.dt_inicio}
                  onChange={handleFiltroChange}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]" htmlFor="dt_fim">
                  Data Fim
                </label>
                <input
                  type="date"
                  id="dt_fim"
                  name="dt_fim"
                  value={filtros.dt_fim}
                  onChange={handleFiltroChange}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                  required
                />
              </div>
              <div className="lg:col-span-2">
                <FiltroNomeFantasia
                  nomesFantasiaSelecionados={nomesFantasiaSelecionados}
                  onSelectNomesFantasia={setNomesFantasiaSelecionados}
                  dadosNomesFantasia={dadosNomesFantasia}
                />
              </div>
            </div>

            {/* Segunda linha - Filtros de Classificação e Operação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              <div>
                <FiltroOperacao
                  operacoesSelecionadas={operacoesSelecionadas}
                  onSelectOperacoes={setOperacoesSelecionadas}
                  dadosOperacoes={opcoesOperacao}
                />
              </div>
              <div>
                <FiltroTipoClassificacao
                  tiposSelecionados={tiposClassSelecionados}
                  onSelectTipos={(novosTipos) => {
                    setTiposClassSelecionados(novosTipos);
                    // Reset classificações se não existirem nos novos tipos selecionados
                    const classificacoesValidas = opcoesClassificacao.filter(c => 
                      novosTipos.length === 0 || 
                      clientesFiltrados.some(cliente => 
                        novosTipos.includes(String(cliente.cd_tipoclas)) && 
                        String(cliente.cd_classificacao) === c
                      )
                    );
                    setClassificacoesSelecionadas(
                      classificacoesSelecionadas.filter(c => classificacoesValidas.includes(c))
                    );
                  }}
                  dadosTipos={opcoesTipoClass}
                />
              </div>
              <div>
                <FiltroClassificacao
                  classificacoesSelecionadas={classificacoesSelecionadas}
                  onSelectClassificacoes={setClassificacoesSelecionadas}
                  dadosClassificacoes={opcoesClassificacao}
                />
              </div>
              <div className="flex items-end">
                <button 
                  type="submit"
                  className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase w-full justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner size={10} className="animate-spin" />
                      <span></span>
                    </>
                  ) : (
                    <>
                      <Calendar size={10} />
                      <span>Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Terceira linha - Filtro de Status (apenas para detalhamento) */}
            {visualizacaoAtiva === 'detalhamentoClassificacao' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <div>
                  <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
                  >
                    <option value="">TODOS</option>
                    <option value="unico">ÚNICO</option>
                    <option value="multiplas">MÚLTIPLAS</option>
                  </select>
                </div>
                <div></div>
                <div></div>
                <div></div>
              </div>
            )}
          </form>
        </div>

        {/* Botões de visualização */}
        <div className="mb-4 flex gap-2 justify-center">
          <button
            onClick={() => setVisualizacaoAtiva('clienteGeral')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              visualizacaoAtiva === 'clienteGeral'
                ? 'bg-[#000638] text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            CLIENTE GERAL
          </button>
          <button
            onClick={() => setVisualizacaoAtiva('detalhamentoClassificacao')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              visualizacaoAtiva === 'detalhamentoClassificacao'
                ? 'bg-[#000638] text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            DETALHAMENTO DE CLASSIFICAÇÃO
          </button>
        </div>

        {/* Tabela de dados */}
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            <p>{error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {visualizacaoAtiva === 'clienteGeral' ? (
              <>
            <Table
              data={clientesParaTabela}
              columns={colunas}
              loading={loading}
              pagination={true}
              pageSize={pagination.limit}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              emptyMessage="Nenhum cliente encontrado para o período selecionado"
              rowKey="id"
                  className="text-[0.67rem]"
                  containerClassName="text-[0.67rem]"
            />
            
                {!loading && clientesAgrupados.length > 0 && (
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  {(() => {
                    const start = (currentPage - 1) * pagination.limit + 1;
                        const end = Math.min(currentPage * pagination.limit, clientesAgrupados.length);
                        return `Mostrando ${clientesAgrupados.length === 0 ? 0 : start} a ${end} de ${clientesAgrupados.length} registros únicos`;
                      })()}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <Table
                  data={dadosDetalhamentoClassificacao}
                  columns={colunasDetalhamentoClassificacao}
                  loading={loading}
                  pagination={true}
                  pageSize={pagination.limit}
                  currentPage={currentPageDetalhamento}
                  onPageChange={handlePageChange}
                  emptyMessage="Nenhum cliente encontrado para o período selecionado"
                  rowKey="id"
                  className="text-[0.67rem]"
                  containerClassName="text-[0.67rem]"
                />
                
                {!loading && dadosDetalhamentoClassificacao.length > 0 && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      {(() => {
                        const start = (currentPageDetalhamento - 1) * pagination.limit + 1;
                        const end = Math.min(currentPageDetalhamento * pagination.limit, dadosDetalhamentoClassificacao.length);
                        const clientesMultiplas = dadosDetalhamentoClassificacao.filter(c => c.temMultiplasClassificacoes).length;
                        return `Mostrando ${dadosDetalhamentoClassificacao.length === 0 ? 0 : start} a ${end} de ${dadosDetalhamentoClassificacao.length} clientes únicos (${clientesMultiplas} com múltiplas classificações)`;
                  })()}
                </p>
              </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
  );
};

export default Clientes;
