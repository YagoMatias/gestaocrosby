import React, { useState, useEffect, useMemo } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import Table from '../components/ui/Table';
import { Users, Calendar, Funnel, Spinner } from '@phosphor-icons/react';
import FiltroNomeFantasia from '../components/FiltroNomeFantasia';
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

  // Filtros de classificação
  const [filtroTipoClass, setFiltroTipoClass] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('');

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
    const base = filtroTipoClass
      ? clientesFiltrados.filter((c) => String(c.cd_tipoclas) === String(filtroTipoClass))
      : clientesFiltrados;
    const set = new Set(
      base
        .map((c) => c.cd_classificacao)
        .filter((v) => v !== null && v !== undefined && v !== '')
    );
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [clientesFiltrados, filtroTipoClass]);

  // Aplicar filtros de Tipo Classificação e Classificação
  const clientesFiltradosFinais = useMemo(() => {
    let data = clientesFiltrados;
    if (filtroTipoClass) {
      data = data.filter((c) => String(c.cd_tipoclas) === String(filtroTipoClass));
    }
    if (filtroClassificacao) {
      data = data.filter((c) => String(c.cd_classificacao) === String(filtroClassificacao));
    }
    return data;
  }, [clientesFiltrados, filtroTipoClass, filtroClassificacao]);

  // Garantir chave única por linha na tabela (evita warnings de keys duplicadas)
  const clientesParaTabela = useMemo(() => {
    return clientesFiltradosFinais.map((c, i) => ({
      id: `${c.cd_pessoa ?? 'p'}-${c.cd_operacao ?? 'op'}-${c.dt_transacao ?? 'dt'}-${i}`,
      ...c
    }));
  }, [clientesFiltradosFinais]);

  // Definição das colunas da tabela
  const colunas = useMemo(() => [
    {
      key: 'cd_pessoa',
      title: 'Código',
      sortable: true,
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'nm_pessoa',
      title: 'Nome',
      sortable: true,
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]'
    },
    {
      key: 'nm_fantasia',
      title: 'Nome Fantasia',
      sortable: true,
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]'
    },
    {
      key: 'nr_cpfcnpj',
      title: 'CPF/CNPJ',
      sortable: true,
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]',
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
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]',
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
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]'
    },
    {
      key: 'cd_classificacao',
      title: 'Class',
      sortable: true,
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]'
    },
    {
      key: 'dt_transacao',
      title: 'Dt Trans',
      sortable: true,
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]',
      render: (value) => {
        if (!value) return '-';
        // Formatar data
        const data = new Date(value);
        return data.toLocaleDateString('pt-BR');
      }
    },
    {
      key: 'cd_empresa',
      title: 'Emp',
      sortable: true,
      className: 'px-2 py-1 text-[0.7rem]',
      cellClassName: 'px-2 py-1 text-[0.69rem]'
    }
  ], []);

  // Cálculo da página atual com base no total filtrado (front-end)
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(clientesFiltradosFinais.length / pagination.limit) || 1;

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-2 mb-3">
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
              <div className="lg:col-span-3">
                <FiltroNomeFantasia
                  nomesFantasiaSelecionados={nomesFantasiaSelecionados}
                  onSelectNomesFantasia={setNomesFantasiaSelecionados}
                  dadosNomesFantasia={dadosNomesFantasia}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Tipo Classificação</label>
                <select
                  value={filtroTipoClass}
                  onChange={(e) => {
                    setFiltroTipoClass(e.target.value);
                    // Reset classificação se não existir dentro do novo tipo
                    if (e.target.value === '' || !opcoesClassificacao.includes(filtroClassificacao)) {
                      setFiltroClassificacao('');
                    }
                  }}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
                >
                  <option value="">TODOS</option>
                  {opcoesTipoClass.map((opt) => (
                    <option key={`tp-${opt}`} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Classificação</label>
                <select
                  value={filtroClassificacao}
                  onChange={(e) => setFiltroClassificacao(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
                >
                  <option value="">TODAS</option>
                  {opcoesClassificacao.map((opt) => (
                    <option key={`clas-${opt}`} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <button 
                  type="submit"
                  className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
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
          </form>
        </div>

        {/* Tabela de dados */}
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            <p>{error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
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
              className="text-[0.69rem]"
              containerClassName="text-[0.69rem]"
            />
            
            {!loading && clientesFiltradosFinais.length > 0 && (
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  {(() => {
                    const start = (currentPage - 1) * pagination.limit + 1;
                    const end = Math.min(currentPage * pagination.limit, clientesFiltradosFinais.length);
                    return `Mostrando ${clientesFiltradosFinais.length === 0 ? 0 : start} a ${end} de ${clientesFiltradosFinais.length} registros`;
                  })()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
  );
};

export default Clientes;
