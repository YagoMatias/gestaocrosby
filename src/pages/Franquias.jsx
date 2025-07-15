import React, { useState } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const Franquias = () => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    cd_grupoempresa: '95'
  });

  const fetchDados = async () => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtros.dt_inicio) params.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) params.append('dt_fim', filtros.dt_fim);
      if (filtros.cd_grupoempresa) params.append('cd_grupoempresa', filtros.cd_grupoempresa);
      
      const res = await fetch(`http://localhost:4000/faturamento?${params.toString()}`);
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
    fetchDados();
  };

  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  return (
    <Layout>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Faturamento - Franquias</h1>
            
            {/* Filtros */}
            <div className="mb-8">
              <form onSubmit={handleFiltrar} className="flex flex-col items-center bg-white p-4 rounded-lg shadow">
                <div className="flex flex-row w-full justify-center gap-2 flex-wrap">
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Data Inicial</label>
                    <input 
                      type="date" 
                      name="dt_inicio" 
                      value={filtros.dt_inicio} 
                      onChange={e => setFiltros({ ...filtros, dt_inicio: e.target.value })} 
                      className="border rounded px-3 py-2 w-40" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Data Final</label>
                    <input 
                      type="date" 
                      name="dt_fim" 
                      value={filtros.dt_fim} 
                      onChange={e => setFiltros({ ...filtros, dt_fim: e.target.value })} 
                      className="border rounded px-3 py-2 w-40" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Grupo Empresa</label>
                    <input 
                      name="cd_grupoempresa" 
                      value={filtros.cd_grupoempresa} 
                      onChange={e => setFiltros({ ...filtros, cd_grupoempresa: e.target.value })} 
                      className="border rounded px-3 py-2 w-40" 
                      placeholder="95" 
                    />
                  </div>
                </div>
                <div className="flex justify-center w-full mt-2">
                  <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition h-10">Filtrar</button>
                </div>
              </form>
              {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
            </div>

            {/* Cards de Resumo */}
            <div className="flex flex-wrap gap-6 justify-center mb-8">
              {/* Card Faturamento Total */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-blue-500">
                <span className="text-lg font-semibold text-blue-700 mb-2">Faturamento Total</span>
                <span className="text-2xl font-bold text-blue-600 mb-1">
                  {(() => {
                    const somaSaidas = dados.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
                    const somaEntradas = dados.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
                    const faturamentoTotal = somaSaidas - somaEntradas;
                    return faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </span>
                <span className="text-sm text-gray-500">S - E</span>
              </div>
              
              {/* Card Produtos Saíram */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-green-500">
                <span className="text-lg font-semibold text-green-700 mb-2">Produtos Saíram (S)</span>
                <span className="text-2xl font-bold text-green-600 mb-1">
                  {dados.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + (Number(row.qt_faturado) || 1), 0)}
                </span>
                <span className="text-sm text-gray-500">Quantidade</span>
              </div>
              
              {/* Card Produtos Entraram */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-red-500">
                <span className="text-lg font-semibold text-red-700 mb-2">Produtos Entraram (E)</span>
                <span className="text-2xl font-bold text-red-600 mb-1">
                  {dados.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + (Number(row.qt_faturado) || 1), 0)}
                </span>
                <span className="text-sm text-gray-500">Quantidade</span>
              </div>
            </div>

            {/* Tabela de Transações */}
            <div className="rounded-lg shadow bg-white">
              <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-800">Transações</h2>
              </div>
              <div className="overflow-y-auto max-h-[500px]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-4 py-2">Transação</th>
                      <th className="px-4 py-2">Grupo Empresa</th>
                      <th className="px-4 py-2">Data Transação</th>
                      <th className="px-4 py-2">Situação</th>
                      <th className="px-4 py-2">Operação</th>
                      <th className="px-4 py-2">Modelo</th>
                      <th className="px-4 py-2">Qt. Faturado</th>
                      <th className="px-4 py-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="overflow-y-auto">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-8">Carregando...</td></tr>
                    ) : dados.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                    ) : (
                      dados.map((row, i) => {
                        console.log('Transação:', { nr_transacao: row.nr_transacao, ds_nivel: row.ds_nivel });
                        const qtFaturado = Number(row.qt_faturado) || 1;
                        const valorTotal = (Number(row.vl_unitliquido) || 0) * qtFaturado;
                        return (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2">{row.nr_transacao}</td>
                            <td className="px-4 py-2">{row.nm_grupoempresa}</td>
                            <td className="px-4 py-2 text-center">{formatarDataBR(row.dt_transacao)}</td>
                            <td className="px-4 py-2 text-center">{row.tp_situacao}</td>
                            <td className="px-4 py-2 text-center">{row.tp_operacao}</td>
                            <td className="px-4 py-2">{row.ds_nivel}</td>
                            <td className="px-4 py-2 text-center">{qtFaturado}</td>
                            <td className={`px-4 py-2 text-right ${row.tp_operacao === 'E' ? 'text-red-600 font-bold' : row.tp_operacao === 'S' ? 'text-green-600 font-bold' : ''}`}>{valorTotal !== null && valorTotal !== undefined ? valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Card Rank Produtos */}
            <div className="mt-8 rounded-lg shadow bg-white">
              <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-800">Rank Produtos</h2>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="px-4 py-2 text-left">Rank</th>
                        <th className="px-4 py-2 text-left">Modelo</th>
                        <th className="px-4 py-2 text-center">Quantidade</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Agrupa por cd_nivel e soma os valores
                        const rankProdutos = dados.reduce((acc, row) => {
                          const nivel = row.cd_nivel;
                          if (!acc[nivel]) {
                            acc[nivel] = {
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
                        
                        return rankArray.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-8 text-gray-500">Nenhum produto encontrado.</td></tr>
                        ) : (
                          rankArray.map((produto, index) => (
                            <tr key={index} className="bg-gray-50 border-b">
                              <td className="px-4 py-2 text-blue-600 font-bold">#{index + 1}</td>
                              <td className="px-4 py-2">{produto.modelo}</td>
                              <td className="px-4 py-2 text-center">{produto.quantidade}</td>
                              <td className="px-4 py-2 text-right">{produto.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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
        </div>
      </div>
    </Layout>
  );
};

export default Franquias; 