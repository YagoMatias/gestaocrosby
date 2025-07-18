import React, { useState } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import LoadingCircle from '../components/LoadingCircle';
import { ArrowsClockwise, CaretDown, CaretRight, ArrowCircleDown, ArrowCircleUp, CurrencyDollar } from '@phosphor-icons/react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import custoProdutos from '../custoprodutos.json';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Franquias = () => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    cd_empresa: '', // agora será preenchido pelo filtro
    nm_grupoempresa: ''
  });
  const [expandTabela, setExpandTabela] = useState(true);
  const [expandRankProdutos, setExpandRankProdutos] = useState(true);
  const [nmGrupoEmpresaSelecionados, setNmGrupoEmpresaSelecionados] = useState([]);
  const [nm_grupoempresa, setNmGrupoEmpresa] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

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

  const handleChangeGrupoEmpresa = (e) => {
    setNmGrupoEmpresa(e.target.value);
  };
  const handleSugestaoGrupoEmpresaToggle = (s) => {
    setNmGrupoEmpresaSelecionados((prev) => {
      if (prev.includes(s)) {
        return prev.filter(nm => nm !== s);
      } else {
        return [...prev, s];
      }
    });
  };
  const handleRemoveGrupoEmpresaSelecionado = (nm) => {
    setNmGrupoEmpresaSelecionados((prev) => prev.filter(n => n !== nm));
  };

  // Buscar automaticamente ao selecionar/desmarcar empresa
  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
    // Não busca automaticamente!
  };

  const handleSelectEmpresa = (empresaObj) => {
    if (empresaObj) {
      setFiltros(f => ({ ...f, cd_empresa: empresaObj.cd_empresa, nm_grupoempresa: empresaObj.nm_grupoempresa }));
    } else {
      setFiltros(f => ({ ...f, cd_empresa: '', nm_grupoempresa: '' }));
    }
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
      const res = await fetch(`https://crosby-pd5x7.ondigitalocean.app/faturamentofranquia?${params.toString()}`);
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

  // Função para exportar o ranking para Excel
  const exportarRankParaExcel = () => {
    // Agrupa por cd_nivel e soma os valores (igual ao render)
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
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'rank_produtos_franquias.xlsx');
  };

  return (
    <Layout>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
            <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Faturamento - Franquias</h1>
            {/* Filtros */}
            <div className="mb-8">
              <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
                <div className="mb-6">
                  <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><CurrencyDollar size={22} weight="bold" />Filtros</span>
                  <span className="text-sm text-gray-500 mt-1">Selecione o período, grupo empresa ou data para análise</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 w-full mb-6">
                  <FiltroEmpresa
                    empresasSelecionadas={empresasSelecionadas}
                    onSelectEmpresas={handleSelectEmpresas}
                  />
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
                <div className="flex justify-end w-full mt-8">
                  <button type="submit" className="flex items-center gap-2 bg-[#000638] text-white px-10 py-3 rounded-xl hover:bg-[#fe0000] transition h-12 text-base font-bold shadow-md tracking-wide uppercase">
                    <ArrowsClockwise size={22} weight="bold" /> Filtrar
                  </button>
                </div>
              </form>
              {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
            </div>
            {/* Cards de Resumo */}
            <div className="flex flex-wrap gap-6 justify-center mb-8">
              {/* Card Faturamento Total */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#000638]">
                <span className="mr-4"><CurrencyDollar size={32} color="#000638" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#000638] mb-1 tracking-wide">FATURAMENTO TOTAL</span>
                  <span className="text-2xl font-extrabold text-[#000638] mb-1">
                    {loading ? <LoadingCircle size={32} /> : (() => {
                      const somaSaidas = dados.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
                      const somaEntradas = dados.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
                      const faturamentoTotal = somaSaidas - somaEntradas;
                      return faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
                  </span>
                  <span className="text-xs text-gray-500">S - E</span>
                </div>
              </div>
              {/* Card Produtos Saíram */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-green-600">
                <span className="mr-4"><ArrowCircleUp size={32} color="#16a34a" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-green-600 mb-1 tracking-wide">PRODUTOS SAÍRAM (S)</span>
                  <span className="text-2xl font-extrabold text-green-600 mb-1">
                    {loading ? <LoadingCircle size={32} /> : dados.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + (Number(row.qt_faturado) || 1), 0)}
                  </span>
                  <span className="text-xs text-gray-500">Quantidade</span>
                </div>
              </div>
              {/* Card Produtos Entraram */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#fe0000]">
                <span className="mr-4"><ArrowCircleDown size={32} color="#fe0000" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#fe0000] mb-1 tracking-wide">PRODUTOS ENTRARAM (E)</span>
                  <span className="text-2xl font-extrabold text-[#fe0000] mb-1">
                    {loading ? <LoadingCircle size={32} /> : dados.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + (Number(row.qt_faturado) || 1), 0)}
                  </span>
                  <span className="text-xs text-gray-500">Quantidade</span>
                </div>
              </div>
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
                        <th className="px-4 py-2 font-semibold">Franquia</th>
                        <th className="px-4 py-2 font-semibold">Data Transação</th>
                        <th className="px-4 py-2 font-semibold">Situação</th>
                        <th className="px-4 py-2 font-semibold">Operação</th>
                        <th className="px-4 py-2 font-semibold">Modelo</th>
                        <th className="px-4 py-2 font-semibold">Qt. Faturado</th>
                        <th className="px-4 py-2 font-semibold">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="overflow-y-auto">
                      {loading ? (
                        <tr><td colSpan={8} className="text-center py-8"><LoadingCircle size={32} /></td></tr>
                      ) : dados.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                      ) : (
                        dados.map((row, i) => {
                          const qtFaturado = Number(row.qt_faturado) || 1;
                          const valorTotal = (Number(row.vl_unitliquido) || 0) * qtFaturado;
                          return (
                            <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                              <td className="px-4 py-2">{row.nr_transacao}</td>
                              <td className="px-4 py-2">{row.cd_empresa}</td>
                              <td className="px-4 py-2">{row.nm_fantasia}</td>
                              <td className="px-4 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_transacao)}</td>
                              <td className="px-4 py-2 text-center text-[#000000]">{row.tp_situacao}</td>
                              <td className="px-4 py-2 text-center text-[#000000]">{row.tp_operacao}</td>
                              <td className="px-4 py-2">{row.ds_nivel}</td>
                              <td className="px-4 py-2 text-center">{qtFaturado}</td>
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
              {expandRankProdutos && (
                <div className="p-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-[#000638] text-white">
                          <th className="px-4 py-2 text-left font-semibold">Rank</th>
                          <th className="px-4 py-2 font-semibold">Código Modelo</th>
                          <th className="px-4 py-2 text-left font-semibold">Modelo</th>
                          <th className="px-4 py-2 text-center font-semibold">Quantidade</th>
                          <th className="px-4 py-2 text-right font-semibold">Valor</th>
                          <th className="px-4 py-2 text-right font-semibold">Custo</th>
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
                                    if (custoTotal && custoTotal !== 0) {
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
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Franquias; 