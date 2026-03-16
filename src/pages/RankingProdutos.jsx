import React, { useEffect, useState, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import PageTitle from '../components/ui/PageTitle';
import {
  Trophy,
  Funnel,
  CaretUp,
  CaretDown,
  CaretUpDown,
  FileArrowDown,
  Package,
  ShoppingCart,
  CurrencyDollar,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const RankingProdutos = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [periodo, setPeriodo] = useState({ dt_inicio: '', dt_fim: '' });
  const [totais, setTotais] = useState({
    totalOrderQuantity: 0,
    totalItemQuantity: 0,
    totalOrderValue: 0,
  });

  // Ordenação
  const [ordenacao, setOrdenacao] = useState({
    campo: 'item_quantity',
    direcao: 'desc',
  });

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  // Filiais TOTVS
  const [filiaisCodigos, setFiliaisCodigos] = useState([]);
  const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

  useEffect(() => {
    const buscarFiliais = async () => {
      try {
        const response = await fetch(`${TotvsURL}branches`);
        if (response.ok) {
          const result = await response.json();
          let empresasArray = [];
          if (result.success && result.data) {
            if (result.data.data && Array.isArray(result.data.data)) {
              empresasArray = result.data.data;
            } else if (Array.isArray(result.data)) {
              empresasArray = result.data;
            }
          }
          const codigos = empresasArray
            .map((branch) => parseInt(branch.cd_empresa))
            .filter((code) => !isNaN(code) && code > 0);
          setFiliaisCodigos(codigos);
        }
      } catch (error) {
        console.error('Erro ao carregar filiais:', error);
        setFiliaisCodigos([1, 2, 6, 100, 101, 99, 990, 200, 400, 4, 850, 85]);
      }
    };
    buscarFiliais();
  }, []);

  // Período padrão: mês atual
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    setPeriodo({ dt_inicio: primeiroDia, dt_fim: ultimoDia });
  }, []);

  // CSS tabela
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .ranking-table { border-collapse: collapse; width: 100%; }
      .ranking-table th, .ranking-table td {
        padding: 6px 8px !important; border-right: 1px solid #f3f4f6;
        word-wrap: break-word; white-space: normal; font-size: 12px; line-height: 1.4;
      }
      .ranking-table th:last-child, .ranking-table td:last-child { border-right: none; }
      .ranking-table th {
        background-color: #000638; color: white; font-weight: 600;
        text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;
      }
      .ranking-table tbody tr:nth-child(odd) { background-color: white; }
      .ranking-table tbody tr:nth-child(even) { background-color: #f9fafb; }
      .ranking-table tbody tr:hover { background-color: #f3f4f6; }
    `;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement);
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);

  const handleSort = (campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (campo) => {
    if (ordenacao.campo !== campo)
      return <CaretUpDown size={12} className="opacity-50" />;
    return ordenacao.direcao === 'asc' ? (
      <CaretUp size={12} />
    ) : (
      <CaretDown size={12} />
    );
  };

  const dadosProcessados = useMemo(() => {
    let sorted = [...dados];
    if (ordenacao.campo) {
      sorted.sort((a, b) => {
        let vA = a[ordenacao.campo];
        let vB = b[ordenacao.campo];
        if (
          ['item_quantity', 'order_value', 'product_code'].includes(
            ordenacao.campo,
          )
        ) {
          vA = parseFloat(vA) || 0;
          vB = parseFloat(vB) || 0;
        }
        if (typeof vA === 'string') {
          vA = vA.toLowerCase();
          vB = (vB || '').toLowerCase();
        }
        if (vA < vB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (vA > vB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [dados, ordenacao]);

  const dadosPaginados = useMemo(() => {
    const start = (paginaAtual - 1) * itensPorPagina;
    return dadosProcessados.slice(start, start + itensPorPagina);
  }, [dadosProcessados, paginaAtual]);

  const totalPages = Math.ceil(dadosProcessados.length / itensPorPagina);

  const handleSelectEmpresas = (empresas) => setEmpresasSelecionadas(empresas);

  const buscarDados = async () => {
    if (!periodo.dt_inicio || !periodo.dt_fim) {
      alert('Selecione o período inicial e final!');
      return;
    }

    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa!');
      return;
    }

    setLoading(true);
    setPaginaAtual(1);
    try {
      const branchs = empresasSelecionadas
        .map((e) => parseInt(e.cd_empresa))
        .filter((c) => !isNaN(c) && c > 0);

      const body = {
        branchs,
        datemin: new Date(periodo.dt_inicio + 'T00:00:00').toISOString(),
        datemax: new Date(periodo.dt_fim + 'T23:59:59').toISOString(),
      };

      const result = await apiClient.totvs.bestSellingProducts(body);

      if (result.success && result.data) {
        const responseData = result.data;
        setDados(responseData.dataRow || []);
        setTotais({
          totalOrderQuantity: responseData.totalOrderQuantity || 0,
          totalItemQuantity: responseData.totalItemQuantity || 0,
          totalOrderValue: responseData.totalOrderValue || 0,
        });
        setDadosCarregados(true);
      } else {
        setDados([]);
        setTotais({
          totalOrderQuantity: 0,
          totalItemQuantity: 0,
          totalOrderValue: 0,
        });
        setDadosCarregados(true);
      }
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
      alert('Erro ao buscar ranking de produtos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    if (dadosProcessados.length === 0) return;
    const dados_export = dadosProcessados.map((item, i) => ({
      '#': i + 1,
      'Cód. Produto': item.product_code,
      'Nome do Produto': item.product_name || '--',
      Quantidade: item.item_quantity,
      'Valor (R$)': item.order_value,
    }));
    const ws = XLSX.utils.json_to_sheet(dados_export);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ranking Produtos');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(
      blob,
      `ranking_produtos_${periodo.dt_inicio}_${periodo.dt_fim}.xlsx`,
    );
  };

  return (
    <div className="p-2 sm:p-4 space-y-4 max-w-[1600px] mx-auto">
      <PageTitle
        title="Ranking de Produtos"
        subtitle="Produtos mais vendidos por período"
        icon={Trophy}
        iconColor="text-amber-600"
      />

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Funnel size={16} /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <FiltroEmpresa
              empresasSelecionadas={empresasSelecionadas}
              onSelectEmpresas={handleSelectEmpresas}
            />

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={periodo.dt_inicio}
                  onChange={(e) =>
                    setPeriodo((p) => ({ ...p, dt_inicio: e.target.value }))
                  }
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={periodo.dt_fim}
                  onChange={(e) =>
                    setPeriodo((p) => ({ ...p, dt_fim: e.target.value }))
                  }
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={buscarDados}
                disabled={loading}
                className="px-4 py-1.5 bg-[#000638] text-white rounded-md text-xs font-medium hover:bg-[#000638]/90 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <LoadingSpinner size="sm" /> : <Funnel size={14} />}
                {loading ? 'Buscando...' : 'Buscar'}
              </button>

              {dadosCarregados && dadosProcessados.length > 0 && (
                <button
                  onClick={exportarExcel}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 flex items-center gap-2"
                >
                  <FileArrowDown size={14} /> Exportar Excel
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Totais */}
      {dadosCarregados && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total de Vendas</p>
                <p className="text-lg font-bold text-gray-900">
                  {totais.totalOrderQuantity.toLocaleString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total de Itens</p>
                <p className="text-lg font-bold text-gray-900">
                  {totais.totalItemQuantity.toLocaleString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollar size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Valor Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(totais.totalOrderValue)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <Card>
          <CardContent className="p-8 flex justify-center">
            <LoadingSpinner size="lg" text="Buscando ranking de produtos..." />
          </CardContent>
        </Card>
      ) : dadosCarregados ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy size={16} className="text-amber-600" />
                Ranking de Produtos ({dadosProcessados.length} produtos)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dadosProcessados.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                Nenhum produto encontrado para o período selecionado.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th className="text-center w-12">#</th>
                        <th
                          className="cursor-pointer select-none"
                          onClick={() => handleSort('product_code')}
                        >
                          <span className="flex items-center gap-1">
                            Código {getSortIcon('product_code')}
                          </span>
                        </th>
                        <th
                          className="cursor-pointer select-none"
                          onClick={() => handleSort('product_name')}
                        >
                          <span className="flex items-center gap-1">
                            Produto {getSortIcon('product_name')}
                          </span>
                        </th>
                        <th
                          className="cursor-pointer select-none text-right"
                          onClick={() => handleSort('item_quantity')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            Qtd {getSortIcon('item_quantity')}
                          </span>
                        </th>
                        <th
                          className="cursor-pointer select-none text-right"
                          onClick={() => handleSort('order_value')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            Valor {getSortIcon('order_value')}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosPaginados.map((item, idx) => {
                        const posicao =
                          (paginaAtual - 1) * itensPorPagina + idx + 1;
                        return (
                          <tr key={`${item.product_code}-${idx}`}>
                            <td className="text-center font-bold">
                              {posicao <= 3 ? (
                                <span
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${
                                    posicao === 1
                                      ? 'bg-yellow-500'
                                      : posicao === 2
                                        ? 'bg-gray-400'
                                        : 'bg-amber-700'
                                  }`}
                                >
                                  {posicao}
                                </span>
                              ) : (
                                <span className="text-gray-500">{posicao}</span>
                              )}
                            </td>
                            <td className="text-gray-700">
                              {item.product_code}
                            </td>
                            <td className="font-medium text-gray-900">
                              {item.product_name || '--'}
                            </td>
                            <td className="text-right font-semibold text-blue-700">
                              {(item.item_quantity || 0).toLocaleString(
                                'pt-BR',
                              )}
                            </td>
                            <td className="text-right font-semibold text-green-700">
                              {formatCurrency(item.order_value)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t">
                    <span className="text-xs text-gray-500">
                      Página {paginaAtual} de {totalPages} (
                      {dadosProcessados.length} produtos)
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setPaginaAtual((p) => Math.max(1, p - 1))
                        }
                        disabled={paginaAtual === 1}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() =>
                          setPaginaAtual((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={paginaAtual === totalPages}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-gray-500 text-sm">
            Selecione a empresa e o período, depois clique em{' '}
            <strong>Buscar</strong> para consultar o ranking.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RankingProdutos;
