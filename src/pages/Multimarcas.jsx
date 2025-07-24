import React, { useState } from 'react';
import Layout from '../components/Layout';
import LoadingCircle from '../components/LoadingCircle';
import FiltroEmpresa from '../components/FiltroEmpresa';
import custoProdutos from '../custoprodutos.json';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ArrowsClockwise, CaretDown, CaretRight, ArrowCircleDown, ArrowCircleUp, CurrencyDollar, Package } from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';

const Multimarcas = () => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    cd_empresa: '95'
  });
  const [expandTabela, setExpandTabela] = useState(true);
  const [expandRankProdutos, setExpandRankProdutos] = useState(true);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([
    { cd_empresa: '2' },
    { cd_empresa: '75' },
    { cd_empresa: '31' },
    { cd_empresa: '6' },
    { cd_empresa: '11' },
  ]);

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  const fetchDados = async (empresasParam = empresasSelecionadas) => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtros.dt_inicio) params.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) params.append('dt_fim', filtros.dt_fim);
      empresasParam.forEach(emp => {
        params.append('cd_empresa', emp.cd_empresa);
      });
      const res = await fetch(`https://apigestaocrosby.onrender.com/faturamentomtm?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar dados do servidor');
      const json = await res.json();
      setDados(json);
    } catch (err) {
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma loja para consultar!');
      return;
    }
    fetchDados(empresasSelecionadas);
  };

  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  // Cria um Map para lookup rápido do custo pelo código
  const custoMap = React.useMemo(() => {
    const map = {};
    custoProdutos.forEach(item => {
      if (item.Codigo && item.Custo !== undefined) {
        map[item.Codigo.trim()] = item.Custo;
      }
    });
    return map;
  }, []);

  // Função para exportar o ranking para Excel
  const exportarRankParaExcel = () => {
    const rankProdutos = dados.reduce((acc, row) => {
      const nivel = row.cd_nivel;
      if (!acc[nivel]) {
        acc[nivel] = {
          cd_nivel: nivel,
          modelo: row.ds_nivel,
          valorTotal: 0,
          quantidade: 0
        };
      }
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') {
        acc[nivel].valorTotal += valor;
        acc[nivel].quantidade += qtFaturado;
      } else if (row.tp_operacao === 'E') {
        acc[nivel].valorTotal -= valor;
        acc[nivel].quantidade -= qtFaturado;
      }
      return acc;
    }, {});
    const custoMap = {};
    custoProdutos.forEach(item => {
      if (item.Codigo && item.Custo !== undefined) {
        custoMap[item.Codigo.trim()] = item.Custo;
      }
    });
    const rankArray = Object.values(rankProdutos)
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map(produto => {
        const custoUnit = custoMap[produto.cd_nivel?.trim()];
        const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
        const markup = custoTotal && custoTotal !== 0 ? produto.valorTotal / custoTotal : undefined;
        const margem = (produto.valorTotal && custoTotal !== undefined && produto.valorTotal !== 0)
          ? ((produto.valorTotal - custoTotal) / produto.valorTotal) * 100 : undefined;
        return {
          'Código Modelo': produto.cd_nivel,
          'Modelo': produto.modelo,
          'Quantidade': produto.quantidade,
          'Valor': produto.valorTotal,
          'Custo': custoTotal,
          'Markup': markup,
          'Margem %': margem
        };
      });
    const ws = XLSX.utils.json_to_sheet(rankArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RankProdutos');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'rank_produtos_multimarcas.xlsx');
  };

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Faturamento - Multimarcas</h1>
        {/* Filtros */}
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><CurrencyDollar size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período, grupo empresa ou data para análise</span>
            </div>
            <div className="flex flex-row gap-x-6 w-full">
              <div className="w-full">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={handleSelectEmpresas}
              />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
                <input 
                  type="date" 
                  name="dt_inicio" 
                  value={filtros.dt_inicio} 
                  onChange={e => setFiltros({ ...filtros, dt_inicio: e.target.value })} 
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
                <input 
                  type="date" 
                  name="dt_fim" 
                  value={filtros.dt_fim} 
                  onChange={e => setFiltros({ ...filtros, dt_fim: e.target.value })} 
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                />
              </div>
            </div>
            <div className="flex justify-end w-full">
              <button type="submit" className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] transition h-10 text-sm font-bold shadow-md tracking-wide uppercase">
                <ArrowsClockwise size={18} weight="bold" /> Filtrar
              </button>
            </div>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>
        {/* Cards de Resumo */}
        <div className="flex flex-col gap-6 mb-8 lg:flex-row lg:gap-8 lg:justify-center">
          {/* Card Faturamento Total */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={20} className="text-gray-700" />
                <CardTitle className="text-base font-bold text-gray-900">Faturamento Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-green-600 mb-1">
                {loading ? <LoadingCircle size={32} /> : (() => {
                  const somaSaidas = dados.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
                  const somaEntradas = dados.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
                  const faturamentoTotal = somaSaidas - somaEntradas;
                  return faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                })()}
              </div>
              <CardDescription className="text-gray-500">S - E</CardDescription>
            </CardContent>
          </Card>
          {/* Card Produtos Saíram */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <ArrowCircleUp size={20} className="text-green-600" />
                <CardTitle className="text-base font-bold text-green-600">Produtos Saíram (S)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-green-600 mb-1">
                {loading ? <LoadingCircle size={32} /> : dados.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + (Number(row.qt_faturado) || 1), 0)}
              </div>
              <CardDescription className="text-gray-500">Quantidade</CardDescription>
            </CardContent>
          </Card>
          {/* Card Produtos Entraram */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <ArrowCircleDown size={20} className="text-[#fe0000]" />
                <CardTitle className="text-base font-bold text-[#fe0000]">Produtos Entraram (E)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-[#fe0000] mb-1">
                {loading ? <LoadingCircle size={32} /> : dados.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + (Number(row.qt_faturado) || 1), 0)}
              </div>
              <CardDescription className="text-gray-500">Quantidade</CardDescription>
            </CardContent>
          </Card>
          {/* Card Markup */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Package size={20} className="text-blue-600" />
                <CardTitle className="text-base font-bold text-blue-600">Markup</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              {loading ? <LoadingCircle size={32} /> : (() => {
                let custoTotal = 0;
                let valorTotalVenda = 0;
                dados.forEach(row => {
                  if (row.tp_operacao === 'S') {
                    const qtFaturado = Number(row.qt_faturado) || 1;
                    const custoUnit = custoMap[row.cd_nivel?.trim()];
                    if (custoUnit !== undefined) {
                      custoTotal += qtFaturado * custoUnit;
                    }
                    valorTotalVenda += (Number(row.vl_unitliquido) || 0) * qtFaturado;
                  }
                });
                const markup = custoTotal > 0 ? (valorTotalVenda / custoTotal) : null;
                return (
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-4xl font-extrabold text-blue-700">{markup ? markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</span>
                    <span className="text-sm text-gray-500">Markup (Venda / Custo)</span>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          {/* Card CMV Total */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Package size={20} className="text-orange-600" />
                <CardTitle className="text-base font-bold text-orange-600">CMV Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              {loading ? <LoadingCircle size={32} /> : (() => {
                let custoTotal = 0;
                let valorTotalVenda = 0;
                dados.forEach(row => {
                  if (row.tp_operacao === 'S') {
                    const qtFaturado = Number(row.qt_faturado) || 1;
                    const custoUnit = custoMap[row.cd_nivel?.trim()];
                    if (custoUnit !== undefined) {
                      custoTotal += qtFaturado * custoUnit;
                    }
                    valorTotalVenda += (Number(row.vl_unitliquido) || 0) * qtFaturado;
                  }
                });
                const cmv = valorTotalVenda > 0 ? (custoTotal / valorTotalVenda) : null;
                return (
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-4xl font-extrabold text-orange-700">{cmv !== null ? (cmv * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '-'}</span>
                    <span className="text-sm text-gray-500">CMV Total (Custo / Venda)</span>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
        {/* Tabela de Transações */}
        <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
            <h2 className="text-xl font-bold text-[#000638]">Transações</h2>
            <span className="flex items-center">
              {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
            </span>
          </div>
          {expandTabela && (
            <div className="overflow-y-auto max-h-[500px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-4 py-2 font-semibold">Transação</th>
                    <th className="px-4 py-2 font-semibold">Empresa</th>
                    <th className="px-4 py-2 font-semibold">Nome Cliente</th>
                    <th className="px-4 py-2 font-semibold">Classificação</th>
                    <th className="px-4 py-2 font-semibold">Data Transação</th>
                    <th className="px-4 py-2 font-semibold">Modelo</th>
                    <th className="px-4 py-2 font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody className="overflow-y-auto">
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-8"><LoadingCircle size={32} /></td></tr>
                  ) : dados.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                  ) : (
                    dados.map((row, i) => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorTotal = (Number(row.vl_unitliquido) || 0) * qtFaturado;
                      return (
                        <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                          <td className="px-4 py-2">{row.nr_transacao}</td>
                          <td className="px-4 py-2">{row.cd_empresa}</td>
                          <td className="px-4 py-2">{row.nm_pessoa}</td>
                          <td className="px-4 py-2">{row.cd_classificacao}</td>
                          <td className="px-4 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_transacao)}</td>
                          <td className="px-4 py-2">{row.ds_nivel}</td>
                          <td className={`px-4 py-2 text-right font-bold ${row.tp_operacao === 'E' ? 'text-[#fe0000]' : row.tp_operacao === 'S' ? 'text-green-600' : ''}`}>{valorTotal !== null && valorTotal !== undefined ? valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Card Rank Produtos */}
        <div className="mt-8 rounded-2xl shadow-lg bg-white border border-[#000638]/10">
          <div className="flex items-center justify-between p-4 border-b border-[#000638]/10">
            <h2 className="text-xl font-bold text-[#000638]">Rank Produtos</h2>
            <button
              className="ml-4 px-4 py-2 bg-[#000638] text-white rounded-lg text-sm font-semibold hover:bg-[#001060] transition shadow"
              onClick={exportarRankParaExcel}
              type="button"
            >
              Baixar Excel
            </button>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-4 py-2 text-left font-semibold">Rank</th>
                    <th className="px-4 py-2 text-left font-semibold">Código Modelo</th>
                    <th className="px-4 py-2 text-left font-semibold">Modelo</th>
                    <th className="px-4 py-2 text-center font-semibold">Quantidade</th>
                    <th className="px-4 py-2 text-right font-semibold">Valor</th>
                    <th className="px-4 py-2 text-right font-semibold">Custo</th>
                    <th className="px-4 py-2 text-right font-semibold">CMV</th>
                    <th className="px-4 py-2 text-right font-semibold">Markup</th>
                    <th className="px-4 py-2 text-right font-semibold">Margem %</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Agrupa por cd_nivel e soma os valores
                    const rankProdutos = dados.reduce((acc, row) => {
                      const nivel = row.cd_nivel;
                      if (!acc[nivel]) {
                        acc[nivel] = {
                          cd_nivel: nivel,
                          modelo: row.ds_nivel,
                          valorTotal: 0,
                          quantidade: 0
                        };
                      }
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
                      if (row.tp_operacao === 'S') {
                        acc[nivel].valorTotal += valor;
                        acc[nivel].quantidade += qtFaturado;
                      } else if (row.tp_operacao === 'E') {
                        acc[nivel].valorTotal -= valor;
                        acc[nivel].quantidade -= qtFaturado;
                      }
                      return acc;
                    }, {});
                    // Converte para array e ordena por valor total (decrescente)
                    const rankArray = Object.values(rankProdutos)
                      .sort((a, b) => b.valorTotal - a.valorTotal);
                    if (loading) {
                      return <tr><td colSpan={4} className="text-center py-8"><LoadingCircle size={32} /></td></tr>;
                    }
                    return rankArray.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-500">Nenhum produto encontrado.</td></tr>
                    ) : (
                      rankArray.map((produto, index) => (
                        <tr key={index} className="bg-[#f8f9fb] border-b">
                          <td className="px-4 py-2 text-blue-600 font-bold">#{index + 1}</td>
                          <td className="px-4 py-2">{produto.cd_nivel}</td>
                          <td className="px-4 py-2">{produto.modelo}</td>
                          <td className="px-4 py-2 text-center">{produto.quantidade}</td>
                          <td className="px-4 py-2 text-right">{produto.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="px-4 py-2 text-right">
                            {custoMap[produto.cd_nivel?.trim()] !== undefined
                              ? (produto.quantidade * custoMap[produto.cd_nivel.trim()]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {(() => {
                              const custoUnit = custoMap[produto.cd_nivel?.trim()];
                              const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                              if (custoTotal !== undefined && produto.valorTotal > 0) {
                                const cmv = custoTotal / produto.valorTotal;
                                return (cmv * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                              }
                              return '-';
                            })()}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {(() => {
                              const custoUnit = custoMap[produto.cd_nivel?.trim()];
                              const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                              if (produto.valorTotal && custoTotal !== undefined && produto.valorTotal !== 0) {
                                const markup = produto.valorTotal / custoTotal;
                                return markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              }
                              return '-';
                            })()}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {(() => {
                              const custoUnit = custoMap[produto.cd_nivel?.trim()];
                              const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                              if (produto.valorTotal && custoTotal !== undefined && produto.valorTotal !== 0) {
                                const margem = ((produto.valorTotal - custoTotal) / produto.valorTotal) * 100;
                                return margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                              }
                              return '-';
                            })()}
                          </td>
                        </tr>
                      ))
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Multimarcas; 