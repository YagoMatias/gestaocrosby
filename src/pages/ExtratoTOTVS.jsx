import React, { useState, useEffect, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import DropdownContas from '../components/DropdownContas';
import { contas } from '../utils/contas';
import useApiClient from '../hooks/useApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { 
  ArrowsClockwise, 
  Receipt, 
  Spinner,
  Download,
  CaretUp,
  CaretDown,
  ArrowCircleUp,
  ArrowCircleDown,
  Minus
} from '@phosphor-icons/react';

const PAGE_SIZE = 20;

const ExtratoTOTVS = () => {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

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
        border-collapse: collapse;
        width: 100%;
      }
      .extrato-table th,
      .extrato-table td {
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
      }
      .extrato-table th:last-child,
      .extrato-table td:last-child {
        border-right: none;
      }
      .extrato-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      .extrato-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      .extrato-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      .extrato-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
      .extrato-table thead th:first-child,
      .extrato-table tbody td:first-child {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        border-right: 2px solid #e5e7eb !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important;
      }
      .extrato-table thead th:first-child {
        background-color: #000638 !important;
      }
      .extrato-table tbody tr:nth-child(even) td:first-child {
        background-color: #fafafa !important;
      }
      .extrato-table tbody tr:nth-child(odd) td:first-child {
        background-color: white !important;
      }
      .extrato-table tbody tr:hover td:first-child {
        background-color: #f0f9ff !important;
      }
      

    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  const handleFiltrar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setCurrentPage(1);
    
    try {
      const params = {
        nr_ctapes: contasSelecionadas,
        dt_movim_ini: dataInicio,
        dt_movim_fim: dataFim,
        limit: 1000000, // Buscar todos os dados
        offset: 0
      };

      const result = await apiClient.financial.extratoTotvs(params);
      
      if (result.success) {
        setDados(result.data || []);
        setTotal(result.total || result.count || 0);
      } else {
        throw new Error(result.message || 'Erro ao buscar dados');
      }
    } catch (error) {
      console.error('Erro ao buscar extrato TOTVS:', error);
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = () => {
    if (dados.length === 0) return;
    
    const header = [
      'Empresa',
      'Conta',
      'Data Movimento',
      'Documento',
      'Data Liquidação',
      'Estorno',
      'Operação',
      'Auxiliar',
      'Valor'
    ];
    
    const rows = dados.map(row => [
      row.cd_empresa,
      row.nr_ctapes,
      new Date(row.dt_movim).toLocaleDateString('pt-BR'),
      row.ds_doc,
      row.dt_liq ? new Date(row.dt_liq).toLocaleDateString('pt-BR') : '-',
      row.in_estorno,
      row.tp_operacao,
      row.ds_aux,
      row.vl_lancto ? Number(row.vl_lancto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'
    ]);
    
    const csvContent = [header, ...rows]
      .map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extrato_totvs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOrdenar = (campo) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getIconeOrdenacao = (campo) => {
    if (ordenacao.campo !== campo) return null;
    return ordenacao.direcao === 'asc' ? 
      <CaretUp size={12} className="ml-1" /> : 
      <CaretDown size={12} className="ml-1" />;
  };

  // Dados processados com ordenação
  const dadosProcessados = useMemo(() => {
    if (!ordenacao.campo) return dados;
    
    return [...dados].sort((a, b) => {
      let valorA = a[ordenacao.campo];
      let valorB = b[ordenacao.campo];
      
      // Tratamento para valores monetários
      if (ordenacao.campo === 'vl_lancto') {
        valorA = parseFloat(valorA) || 0;
        valorB = parseFloat(valorB) || 0;
      }
      
      // Tratamento para datas
      if (ordenacao.campo === 'dt_movim' || ordenacao.campo === 'dt_liq') {
        valorA = new Date(valorA || 0);
        valorB = new Date(valorB || 0);
      }
      
      // Tratamento para strings
      if (typeof valorA === 'string') {
        valorA = valorA.toLowerCase();
        valorB = valorB.toLowerCase();
      }
      
      if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
      if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
      return 0;
    });
  }, [dados, ordenacao]);

  // Dados paginados
  const dadosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return dadosProcessados.slice(startIndex, endIndex);
  }, [dadosProcessados, currentPage]);

  const totalPages = Math.ceil(dadosProcessados.length / PAGE_SIZE);

  // Cálculos dos valores
  const valoresCalculados = useMemo(() => {
    const creditos = dadosProcessados
      .filter(item => item.tp_operacao === 'C')
      .reduce((acc, item) => acc + (parseFloat(item.vl_lancto) || 0), 0);
    
    const debitos = dadosProcessados
      .filter(item => item.tp_operacao === 'D')
      .reduce((acc, item) => acc + (parseFloat(item.vl_lancto) || 0), 0);
    
    const saldo = debitos - creditos;
    
    return {
      creditos,
      debitos,
      saldo
    };
  }, [dadosProcessados]);

  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const formatarValor = (valor) => {
    if (!valor) return '-';
    try {
      return Number(valor).toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-barlow">
              Extrato TOTVS
            </h1>
            <p className="text-gray-600 mt-2 font-barlow">
              Visualize e analise os extratos do sistema TOTVS.
            </p>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <form onSubmit={handleFiltrar}>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt size={22} className="text-[#000638]" />
                  <span className="text-lg font-bold text-[#000638] font-barlow">
                    Filtros
                  </span>
                </div>
                <span className="text-sm text-gray-500 font-barlow">
                  Selecione o período, empresa e conta para análise
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="lg:col-span-2">
                  <FiltroEmpresa
                    empresasSelecionadas={empresasSelecionadas}
                    onSelectEmpresas={handleSelectEmpresas}
                  />
                </div>
                <div>
                  <label className="w-full block text-xs font-semibold mb-1 text-[#000638] font-barlow">
                    Contas
                  </label>
                  <DropdownContas
                    contas={contas}
                    contasSelecionadas={contasSelecionadas}
                    setContasSelecionadas={setContasSelecionadas}
                    minWidth={300}
                    maxWidth={400}
                    placeholder="Selecione as contas"
                    hideLabel={true}
                    className="!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-sm !overflow-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638] font-barlow">
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 font-barlow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638] font-barlow">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 font-barlow"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={handleExportar}
                  disabled={dados.length === 0 || loading}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition h-10 text-xs font-semibold shadow-md tracking-wide uppercase font-barlow"
                >
                  <Download size={16} weight="bold" />
                  Exportar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-[#000638] hover:bg-[#fe0000] disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition h-10 text-sm font-bold shadow-md tracking-wide uppercase font-barlow"
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
              <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center font-barlow">
                {erro}
              </div>
            )}
          </div>

          {/* Cards de Resumo */}
          {dados.length > 0 && (
            <div className="flex flex-col gap-6 mb-8 lg:flex-row lg:gap-8 lg:justify-center">
              <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
                <CardHeader className="pb-0">
                  <div className="flex flex-row items-center gap-2">
                    <ArrowCircleDown size={20} className="text-[#fe0000]" />
                    <CardTitle className="text-base font-bold text-[#fe0000] font-barlow">Débitos (D)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pl-12">
                  <div className="text-3xl font-extrabold text-[#fe0000] mb-1 font-barlow">
                    {valoresCalculados.debitos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <CardDescription className="text-gray-500 font-barlow">
                    Total de débitos
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
                <CardHeader className="pb-0">
                  <div className="flex flex-row items-center gap-2">
                    <ArrowCircleUp size={20} className="text-green-600" />
                    <CardTitle className="text-base font-bold text-green-600 font-barlow">Créditos (C)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pl-12">
                  <div className="text-3xl font-extrabold text-green-600 mb-1 font-barlow">
                    {valoresCalculados.creditos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <CardDescription className="text-gray-500 font-barlow">
                    Total de créditos
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
                <CardHeader className="pb-0">
                  <div className="flex flex-row items-center gap-2">
                    <Minus size={20} className={valoresCalculados.saldo >= 0 ? "text-[#fe0000]" : "text-green-600"} />
                    <CardTitle className={`text-base font-bold font-barlow ${valoresCalculados.saldo >= 0 ? "text-[#fe0000]" : "text-green-600"}`}>
                      Saldo (D-C)
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pl-12">
                  <div className={`text-3xl font-extrabold mb-1 font-barlow ${valoresCalculados.saldo >= 0 ? "text-[#fe0000]" : "text-green-600"}`}>
                    {valoresCalculados.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <CardDescription className="text-gray-500 font-barlow">
                    Débitos - Créditos
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resultados */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 font-barlow">
                Resultados
              </h2>
              <span className="text-sm text-gray-500 font-barlow">
                {dados.length} registros encontrados
              </span>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <Spinner size={24} className="animate-spin text-blue-600" />
                  <span className="text-gray-600 font-barlow">Carregando dados...</span>
                </div>
              </div>
            ) : dados.length > 0 ? (
              <>
                <div className="table-container">
                  <table className="border-collapse rounded-lg overflow-hidden shadow-lg extrato-table">
                    <thead>
                      <tr>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('cd_empresa')}
                        >
                          <div className="flex items-center">
                            Empresa
                            {getIconeOrdenacao('cd_empresa')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('nr_ctapes')}
                        >
                          <div className="flex items-center">
                            Conta
                            {getIconeOrdenacao('nr_ctapes')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('dt_movim')}
                        >
                          <div className="flex items-center">
                            Data Movimento
                            {getIconeOrdenacao('dt_movim')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('ds_doc')}
                        >
                          <div className="flex items-center">
                            Documento
                            {getIconeOrdenacao('ds_doc')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('dt_liq')}
                        >
                          <div className="flex items-center">
                            Data Liquidação
                            {getIconeOrdenacao('dt_liq')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('in_estorno')}
                        >
                          <div className="flex items-center">
                            Estorno
                            {getIconeOrdenacao('in_estorno')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('tp_operacao')}
                        >
                          <div className="flex items-center">
                            Operação
                            {getIconeOrdenacao('tp_operacao')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('ds_aux')}
                        >
                          <div className="flex items-center">
                            Auxiliar
                            {getIconeOrdenacao('ds_aux')}
                          </div>
                        </th>
                        <th 
                          className="cursor-pointer select-none"
                          onClick={() => handleOrdenar('vl_lancto')}
                        >
                          <div className="flex items-center">
                            Valor
                            {getIconeOrdenacao('vl_lancto')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosPaginados.map((item, index) => (
                        <tr key={`${item.cd_empresa}-${item.nr_ctapes}-${item.dt_movim}-${index}`}>
                          <td className="font-medium">{item.cd_empresa}</td>
                          <td>{item.nr_ctapes}</td>
                          <td>{formatarData(item.dt_movim)}</td>
                          <td>{item.ds_doc || '-'}</td>
                          <td>{formatarData(item.dt_liq)}</td>
                          <td>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.in_estorno === 'T' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {item.in_estorno === 'T' ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.tp_operacao === 'C' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.tp_operacao === 'C' ? 'Crédito' : 'Débito'}
                            </span>
                          </td>
                          <td>{item.ds_aux || '-'}</td>
                          <td className="font-semibold">
                            <span className={item.tp_operacao === 'C' ? 'text-green-600' : 'text-red-600'}>
                              {formatarValor(item.vl_lancto)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <button
                      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm font-barlow"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </button>
                    <span className="mx-2 text-sm font-barlow">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm font-barlow"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 font-barlow">
                  Nenhum registro encontrado. Ajuste os filtros e tente novamente.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
};

export default ExtratoTOTVS;