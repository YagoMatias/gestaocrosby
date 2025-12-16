import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageTitle from '../components/ui/PageTitle';
import DropdownContas from '../components/DropdownContas';
import { contas } from '../utils/contas';
import {
  ScalesIcon,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Receipt,
  CheckCircle,
  Spinner,
  CaretUp,
  CaretUpDown,
  Download,
} from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 20;

const AuditoriaConciliacao = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [filtros, setFiltros] = useState({
    nr_ctapes: [],
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [expandTabela, setExpandTabela] = useState(true);

  // Filtro de Mês/Ano
  const [anoSelecionado, setAnoSelecionado] = useState(
    new Date().getFullYear(),
  );
  const [mesSelecionado, setMesSelecionado] = useState('');

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Estados para seleção de linhas
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());

  // Estados para filtros locais
  const [filtroHistorico, setFiltroHistorico] = useState('');
  const [filtroDataLancamento, setFiltroDataLancamento] = useState('');

  // CSS customizado para a tabela
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      .extrato-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .extrato-table tbody tr:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      .table-container::-webkit-scrollbar {
        height: 12px;
      }
      .table-container::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 6px;
      }
      .table-container::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 6px;
      }
      .table-container::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
    `;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Função para ordenação
  const handleSort = useCallback((campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Função para ícone de ordenação
  const getSortIcon = useCallback(
    (campo) => {
      if (ordenacao.campo !== campo) {
        return <CaretUpDown size={14} className="ml-1" />;
      }
      return ordenacao.direcao === 'asc' ? (
        <CaretUp size={14} className="ml-1" />
      ) : (
        <CaretDown size={14} className="ml-1" />
      );
    },
    [ordenacao],
  );

  // Função para selecionar/deselecionar linha
  const toggleLinhaSelecionada = useCallback((index) => {
    setLinhasSelecionadas((prev) => {
      const novoSet = new Set(prev);
      if (novoSet.has(index)) {
        novoSet.delete(index);
      } else {
        novoSet.add(index);
      }
      return novoSet;
    });
  }, []);

  // Dados filtrados e ordenados
  const dadosProcessados = useMemo(() => {
    let resultado = [...dados];

    // Aplicar filtro de histórico
    if (filtroHistorico) {
      resultado = resultado.filter((row) =>
        row.ds_histbco?.toLowerCase().includes(filtroHistorico.toLowerCase()),
      );
    }

    // Aplicar filtro de data de lançamento
    if (filtroDataLancamento) {
      resultado = resultado.filter(
        (row) => row.dt_lancto?.split('T')[0] === filtroDataLancamento,
      );
    }

    // Aplicar ordenação
    if (ordenacao.campo) {
      resultado.sort((a, b) => {
        const valorA = a[ordenacao.campo];
        const valorB = b[ordenacao.campo];

        if (valorA === valorB) return 0;

        let comparacao = 0;
        if (typeof valorA === 'number' && typeof valorB === 'number') {
          comparacao = valorA - valorB;
        } else {
          comparacao = String(valorA).localeCompare(String(valorB));
        }

        return ordenacao.direcao === 'asc' ? comparacao : -comparacao;
      });
    }

    return resultado;
  }, [dados, ordenacao, filtroHistorico, filtroDataLancamento]);

  // Dados paginados para exibição
  const dadosPaginados = useMemo(() => {
    const inicio = (currentPage - 1) * PAGE_SIZE;
    return dadosProcessados.slice(inicio, inicio + PAGE_SIZE);
  }, [dadosProcessados, currentPage]);

  // Total de páginas
  const totalPages = Math.ceil(dadosProcessados.length / PAGE_SIZE);

  // Função para selecionar todas as linhas
  const selecionarTodasLinhas = useCallback(() => {
    setLinhasSelecionadas(new Set(dadosProcessados.map((_, i) => i)));
  }, [dadosProcessados]);

  // Função para deselecionar todas as linhas
  const deselecionarTodasLinhas = useCallback(() => {
    setLinhasSelecionadas(new Set());
  }, []);

  // Limpar seleção quando dados mudarem
  useEffect(() => {
    setLinhasSelecionadas(new Set());
  }, [dados]);

  // Resetar página quando dados mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [dados]);

  // Função para buscar dados
  const fetchDados = async (filtrosParam = filtros) => {
    setLoading(true);
    setErro('');
    try {
      const params = {};
      if (filtrosParam.nr_ctapes?.length > 0) {
        params.nr_ctapes = filtrosParam.nr_ctapes.join(',');
      }
      if (filtrosParam.dt_movim_ini) {
        params.dt_movim_ini = filtrosParam.dt_movim_ini;
      }
      if (filtrosParam.dt_movim_fim) {
        params.dt_movim_fim = filtrosParam.dt_movim_fim;
      }

      const response = await apiClient.financial.extrato(params);

      if (response.data && Array.isArray(response.data)) {
        setDados(response.data);
        setDadosCarregados(true);
      } else {
        setErro('Formato de resposta inválido');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setErro(error.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  // Aplica dt_inicio/dt_fim conforme ano/mês escolhidos
  const aplicarPeriodoMes = (ano, mes) => {
    let dt_ini = '';
    let dt_fim = '';

    if (mes === 'ANO') {
      dt_ini = `${ano}-01-01`;
      dt_fim = `${ano}-12-31`;
    } else if (mes !== '') {
      const mesNum = parseInt(mes, 10);
      const primeiroDia = new Date(ano, mesNum, 1);
      const ultimoDia = new Date(ano, mesNum + 1, 0);
      dt_ini = primeiroDia.toISOString().split('T')[0];
      dt_fim = ultimoDia.toISOString().split('T')[0];
    }

    setFiltros((prev) => ({
      ...prev,
      dt_movim_ini: dt_ini,
      dt_movim_fim: dt_fim,
    }));
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    fetchDados(filtros);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Função para formatar datas no padrão brasileiro
  function formatarDataBR(data) {
    if (!data) return '';
    const d = new Date(data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Função para exportar Excel
  function exportarCSV() {
    const dadosExport = dadosProcessados.map((row) => {
      const conta = contas.find((c) => c.numero === String(row.nr_ctapes));
      return {
        Conta: conta ? `${conta.numero} - ${conta.nome}` : row.nr_ctapes,
        'Data Lançamento': formatarDataBR(row.dt_lancto),
        Histórico: row.ds_histbco,
        Operação: row.tp_operbco,
        Valor: row.vl_lancto,
        'Data Conciliação': row.dt_conciliacao
          ? formatarDataBR(row.dt_conciliacao)
          : 'Pendente',
      };
    });

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato Financeiro');
    XLSX.writeFile(wb, 'extrato-financeiro.xlsx');
  }

  // Função para cor da fonte da conta
  function corConta(nome) {
    if (nome.includes('BB')) return 'text-yellow-600';
    if (nome.includes('BNB')) return 'text-orange-500';
    if (nome.includes('BRADESCO')) return 'text-red-600';
    if (nome.includes('CAIXA')) return 'text-blue-600';
    if (nome.includes('ITAÚ') || nome.includes('ITAU'))
      return 'text-orange-600';
    if (nome.includes('SANTANDER')) return 'text-red-700';
    return 'text-gray-700';
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
      <PageTitle
        title="Auditoria de Conciliação"
        subtitle="Realize a auditoria e conciliação de contas a receber"
        icon={ScalesIcon}
        iconColor="text-purple-600"
      />

      <div className="mb-4">
        <form
          onSubmit={handleFiltrar}
          className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10"
        >
          <div className="mb-6">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-2">
              <Receipt size={22} weight="bold" />
              Filtros
            </span>
            <span className="text-sm text-gray-500 mt-1">
              Selecione o período e as contas para análise
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2 w-full mb-4">
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Contas
              </label>
              <DropdownContas
                contas={contas}
                contasSelecionadas={
                  Array.isArray(filtros.nr_ctapes) ? filtros.nr_ctapes : []
                }
                setContasSelecionadas={(fn) =>
                  setFiltros((prev) => ({
                    ...prev,
                    nr_ctapes:
                      typeof fn === 'function'
                        ? fn(
                            Array.isArray(prev.nr_ctapes) ? prev.nr_ctapes : [],
                          )
                        : fn,
                  }))
                }
                minWidth={200}
                maxWidth={400}
                placeholder="Selecione as contas"
                hideLabel={true}
                className="!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-base"
              />
            </div>
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Ano
              </label>
              <select
                value={anoSelecionado}
                onChange={(e) => {
                  const novoAno = Number(e.target.value);
                  setAnoSelecionado(novoAno);
                  aplicarPeriodoMes(novoAno, mesSelecionado);
                }}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              >
                {Array.from({ length: 6 }).map((_, idx) => {
                  const y = new Date().getFullYear() - idx;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Mês
              </label>
              <select
                value={mesSelecionado}
                onChange={(e) => {
                  const novoMes = e.target.value;
                  setMesSelecionado(novoMes);
                  aplicarPeriodoMes(anoSelecionado, novoMes);
                }}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              >
                <option value="">— Selecionar —</option>
                <option value="ANO">Ano inteiro</option>
                <option value="0">Jan</option>
                <option value="1">Fev</option>
                <option value="2">Mar</option>
                <option value="3">Abr</option>
                <option value="4">Mai</option>
                <option value="5">Jun</option>
                <option value="6">Jul</option>
                <option value="7">Ago</option>
                <option value="8">Set</option>
                <option value="9">Out</option>
                <option value="10">Nov</option>
                <option value="11">Dez</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Data Inicial
              </label>
              <input
                type="date"
                name="dt_movim_ini"
                value={filtros.dt_movim_ini}
                onChange={handleChange}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              />
            </div>
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Data Final
              </label>
              <input
                type="date"
                name="dt_movim_fim"
                value={filtros.dt_movim_fim}
                onChange={handleChange}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="flex justify-end w-full mt-1">
            <button
              type="submit"
              className="flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <Spinner size={18} className="animate-spin" />
              ) : (
                <ArrowsClockwise size={18} weight="bold" />
              )}
              {loading ? 'Carregando...' : 'Filtrar'}
            </button>
          </div>
        </form>
        {erro && (
          <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">
            {erro}
          </div>
        )}
      </div>

      {/* Botão de exportação */}
      <div className="flex justify-end mb-4">
        <button
          onClick={exportarCSV}
          className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] transition-all duration-200 text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || dadosProcessados.length === 0}
        >
          {loading ? (
            <Spinner size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          {loading ? 'Carregando...' : 'Baixar Excel'}
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl shadow-lg bg-white border border-[#000638]/10">
        <div className="p-4 border-b border-[#000638]/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#000638]">
              Detalhamento do Extrato Financeiro
            </h2>
            {dadosProcessados.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {dadosProcessados.length} movimentação
                {dadosProcessados.length > 1 ? 'ões' : ''} encontrada
                {dadosProcessados.length > 1 ? 's' : ''}
                {totalPages > 1 &&
                  ` - Página ${currentPage} de ${totalPages} (${PAGE_SIZE} por página)`}
              </p>
            )}
          </div>
          <button
            onClick={() => setExpandTabela(!expandTabela)}
            className="flex items-center text-gray-500 hover:text-gray-700"
          >
            {expandTabela ? <CaretDown size={20} /> : <CaretRight size={20} />}
          </button>
        </div>

        {expandTabela && (
          <>
            {/* Filtros Locais */}
            {dadosCarregados && dados.length > 0 && (
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                    <label className="text-sm font-semibold text-[#000638] whitespace-nowrap">
                      Histórico:
                    </label>
                    <input
                      type="text"
                      placeholder="Buscar no histórico..."
                      value={filtroHistorico}
                      onChange={(e) => setFiltroHistorico(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000638] text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-[#000638] whitespace-nowrap">
                      Data Lançamento:
                    </label>
                    <input
                      type="date"
                      value={filtroDataLancamento}
                      onChange={(e) => setFiltroDataLancamento(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000638] text-sm"
                    />
                  </div>
                  {(filtroHistorico || filtroDataLancamento) && (
                    <button
                      onClick={() => {
                        setFiltroHistorico('');
                        setFiltroDataLancamento('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-[#fe0000] rounded-lg hover:bg-[#cc0000] transition-colors"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="flex items-center gap-3">
                  <Spinner size={32} className="animate-spin text-blue-600" />
                  <span className="text-gray-600">Carregando dados...</span>
                </div>
              </div>
            ) : !dadosCarregados ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">
                    Clique em "Filtrar" para carregar as informações
                  </div>
                  <div className="text-gray-400 text-sm">
                    Selecione o período e as contas desejadas
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="table-container max-w-full mx-auto">
                  <table
                    className="border-collapse rounded-lg overflow-hidden shadow-lg extrato-table"
                    style={{ minWidth: '1200px' }}
                  >
                    <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                      <tr>
                        {/* Checkbox para seleção */}
                        <th
                          className="px-2 py-1 text-center text-[10px]"
                          style={{
                            width: '50px',
                            minWidth: '50px',
                            position: 'sticky',
                            left: 0,
                            zIndex: 20,
                            backgroundColor: '#000638',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={
                              linhasSelecionadas.size ===
                                dadosProcessados.length &&
                              dadosProcessados.length > 0
                            }
                            onChange={() => {
                              if (
                                linhasSelecionadas.size ===
                                dadosProcessados.length
                              ) {
                                deselecionarTodasLinhas();
                              } else {
                                selecionarTodasLinhas();
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </th>

                        {/* Colunas ordenáveis */}
                        <th
                          className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('nr_ctapes')}
                        >
                          <div className="flex items-center justify-center">
                            Conta
                            {getSortIcon('nr_ctapes')}
                          </div>
                        </th>

                        <th
                          className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('dt_lancto')}
                        >
                          <div className="flex items-center justify-center">
                            Data Lançamento
                            {getSortIcon('dt_lancto')}
                          </div>
                        </th>

                        <th
                          className="px-3 py-1 text-left text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('ds_histbco')}
                        >
                          <div className="flex items-center">
                            Histórico
                            {getSortIcon('ds_histbco')}
                          </div>
                        </th>

                        <th
                          className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('tp_operbco')}
                        >
                          <div className="flex items-center justify-center">
                            Operação
                            {getSortIcon('tp_operbco')}
                          </div>
                        </th>

                        <th
                          className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('vl_lancto')}
                        >
                          <div className="flex items-center justify-center">
                            Valor
                            {getSortIcon('vl_lancto')}
                          </div>
                        </th>

                        <th
                          className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                          onClick={() => handleSort('dt_conciliacao')}
                        >
                          <div className="flex items-center justify-center">
                            Data Conciliação
                            {getSortIcon('dt_conciliacao')}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {dadosPaginados.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-20">
                            <div className="text-center">
                              <div className="text-gray-500 text-lg mb-2">
                                Nenhum dado encontrado
                              </div>
                              <div className="text-gray-400 text-sm">
                                Verifique os filtros selecionados
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        dadosPaginados.map((row, index) => {
                          const globalIndex =
                            (currentPage - 1) * PAGE_SIZE + index;
                          return (
                            <tr
                              key={globalIndex}
                              className={`text-[11px] border-b transition-colors cursor-pointer ${
                                linhasSelecionadas.has(globalIndex)
                                  ? 'bg-blue-100 hover:bg-blue-200'
                                  : index % 2 === 0
                                  ? 'bg-white hover:bg-gray-100'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              {/* Checkbox de seleção */}
                              <td
                                className="px-2 py-1 text-center"
                                style={{
                                  width: '50px',
                                  minWidth: '50px',
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 10,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={linhasSelecionadas.has(globalIndex)}
                                  onChange={() =>
                                    toggleLinhaSelecionada(globalIndex)
                                  }
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                              </td>

                              {/* Conta */}
                              <td
                                className={`px-2 py-1 text-center text-xs ${(() => {
                                  const conta = contas.find(
                                    (c) => c.numero === String(row.nr_ctapes),
                                  );
                                  return conta ? corConta(conta.nome) : '';
                                })()}`}
                              >
                                {(() => {
                                  const conta = contas.find(
                                    (c) => c.numero === String(row.nr_ctapes),
                                  );
                                  return conta
                                    ? `${conta.numero} - ${conta.nome}`
                                    : row.nr_ctapes;
                                })()}
                              </td>

                              {/* Data Lançamento */}
                              <td className="px-2 py-1 text-center text-[#000638] font-medium">
                                {formatarDataBR(row.dt_lancto)}
                              </td>

                              {/* Histórico */}
                              <td className="px-2 py-1 text-gray-800">
                                <div
                                  className="max-w-xs truncate"
                                  title={row.ds_histbco}
                                >
                                  {row.ds_histbco}
                                </div>
                              </td>

                              {/* Operação */}
                              <td className="px-2 py-1 text-center">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    row.tp_operbco === 'D'
                                      ? 'bg-red-100 text-red-800'
                                      : row.tp_operbco === 'C'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {row.tp_operbco}
                                </span>
                              </td>

                              {/* Valor */}
                              <td
                                className={`px-2 py-1 text-right font-bold ${
                                  row.tp_operbco === 'D'
                                    ? 'text-red-600'
                                    : row.tp_operbco === 'C'
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                                }`}
                              >
                                {row.vl_lancto?.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </td>

                              {/* Data Conciliação */}
                              <td className="px-2 py-1 text-center">
                                {row.dt_conciliacao ? (
                                  <span className="text-green-600 font-medium">
                                    {formatarDataBR(row.dt_conciliacao)}
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-medium">
                                    Pendente
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Resumo das linhas selecionadas */}
                {linhasSelecionadas.size > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            {linhasSelecionadas.size} linha
                            {linhasSelecionadas.size > 1 ? 's' : ''} selecionada
                            {linhasSelecionadas.size > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Receipt className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium text-green-800">
                            Total:{' '}
                            {Array.from(linhasSelecionadas)
                              .reduce((acc, index) => {
                                return (
                                  acc +
                                  (dadosProcessados[index]?.vl_lancto || 0)
                                );
                              }, 0)
                              .toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={deselecionarTodasLinhas}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Informações da página */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <span className="text-gray-500">
                  {dadosProcessados.length} registros • {PAGE_SIZE} por página
                </span>
              </div>

              {/* Controles de navegação */}
              <div className="flex items-center gap-2">
                {/* Botão Primeira Página */}
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Primeira
                </button>

                {/* Botão Anterior */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>

                {/* Indicador de página atual */}
                <span className="px-4 py-1 text-sm font-semibold text-[#000638] bg-gray-100 rounded-md">
                  {currentPage}
                </span>

                {/* Botão Próxima */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>

                {/* Botão Última Página */}
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Última
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditoriaConciliacao;
