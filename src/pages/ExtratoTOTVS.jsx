import React, { useState } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DropdownContas from '../components/DropdownContas';
import { contas } from '../utils/contas';

const PAGE_SIZE = 5000;

const ExtratoTOTVS = () => {
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    cd_empresa: '',
    nr_ctapes: [],
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [page, setPage] = useState(1);

  const fetchDados = async (filtrosParam = filtros, pageParam = page) => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtrosParam.cd_empresa) params.append('cd_empresa', filtrosParam.cd_empresa);
      if (filtrosParam.nr_ctapes && filtrosParam.nr_ctapes.length > 0) {
        filtrosParam.nr_ctapes.forEach((nr) => params.append('nr_ctapes', Number(nr)));
      }
      if (filtrosParam.dt_movim_ini) params.append('dt_movim_ini', filtrosParam.dt_movim_ini);
      if (filtrosParam.dt_movim_fim) params.append('dt_movim_fim', filtrosParam.dt_movim_fim);
      params.append('limit', PAGE_SIZE);
      params.append('offset', (pageParam - 1) * PAGE_SIZE);
      const res = await fetch(`http://localhost:4000/extratototvs?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar dados do servidor');
      const json = await res.json();
      setDados(json.rows || json);
      setTotal(json.total || (json.length ?? 0));
    } catch (err) {
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDados({ ...filtros }, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchDados(filtros, newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  // Função para cor da fonte da conta
  function corConta(nome) {
    if (!nome) return '';
    if (nome.includes('CROSBY')) return 'text-blue-500';
    if (nome.includes('FABIO')) return 'text-yellow-600';
    if (nome.includes('IRMÃOS CR')) return 'text-orange-500';
    if (nome.includes('FLAVIO')) return 'text-green-500';
    return '';
  }

  // Função para exportar CSV
  function exportarCSV() {
    if (!dados || dados.length === 0) return;
    const header = [
      'Conta',
      'Data Lançamento',
      'Documento',
      'Estorno',
      'Operação',
      'Auxiliar',
      'Valor',
      'Data Liquidação'
    ];
    const rows = dados.map(row => {
      const conta = contas.find(c => c.numero === String(row.nr_ctapes));
      const contaStr = conta ? `${conta.numero} - ${conta.nome}` : row.nr_ctapes;
      return [
        contaStr,
        formatarDataBR(row.dt_movim),
        row.ds_doc,
        row.in_estorno,
        row.tp_operacao,
        row.ds_aux,
        row.vl_lancto !== null && row.vl_lancto !== undefined ? Number(row.vl_lancto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-',
        formatarDataBR(row.dt_liq)
      ];
    });
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
  }

  return (
    <Layout>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Extrato TOTVS</h1>
            <div className="mb-8">
              <form onSubmit={handleFiltrar} className="flex flex-col items-center bg-white p-4 rounded-lg shadow">
                <div className="flex flex-row w-full justify-center gap-2 flex-wrap">
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Empresa</label>
                    <input name="cd_empresa" value={filtros.cd_empresa} onChange={e => setFiltros({ ...filtros, cd_empresa: e.target.value })} className="border rounded px-3 py-2 w-40" placeholder="Empresa" />
                  </div>
                  <DropdownContas
                    contas={contas}
                    contasSelecionadas={Array.isArray(filtros.nr_ctapes) ? filtros.nr_ctapes : []}
                    setContasSelecionadas={fn =>
                      setFiltros(prev => ({
                        ...prev,
                        nr_ctapes: typeof fn === 'function' ? fn(Array.isArray(prev.nr_ctapes) ? prev.nr_ctapes : []) : fn
                      }))
                    }
                    minWidth={400}
                    maxWidth={800}
                  />
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Data Inicial</label>
                    <input type="date" name="dt_movim_ini" value={filtros.dt_movim_ini} onChange={e => setFiltros({ ...filtros, dt_movim_ini: e.target.value })} className="border rounded px-3 py-2 w-40" />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Data Final</label>
                    <input type="date" name="dt_movim_fim" value={filtros.dt_movim_fim} onChange={e => setFiltros({ ...filtros, dt_movim_fim: e.target.value })} className="border rounded px-3 py-2 w-40" />
                  </div>
                </div>
                <div className="flex justify-center w-full mt-2">
                  <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition h-10">Filtrar</button>
                </div>
              </form>
              {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
            </div>
            {/* Cards de resumo de Débito e Crédito */}
            <div className="flex flex-wrap gap-6 justify-center mb-8">
              {/* Card Débito */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-red-500">
                <span className="text-lg font-semibold text-red-700 mb-2">Débitos (D)</span>
                <span className="text-2xl font-bold text-red-600 mb-1">
                  {dados.filter(row => row.tp_operacao === 'D').length}
                </span>
                <span className="text-sm text-gray-500">Quantidade</span>
                <span className="text-xl font-bold text-red-700 mt-2">
                  {dados.filter(row => row.tp_operacao === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-sm text-gray-500">Soma dos valores</span>
              </div>
              {/* Card Crédito */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-green-500">
                <span className="text-lg font-semibold text-green-700 mb-2">Créditos (C)</span>
                <span className="text-2xl font-bold text-green-600 mb-1">
                  {dados.filter(row => row.tp_operacao === 'C').length}
                </span>
                <span className="text-sm text-gray-500">Quantidade</span>
                <span className="text-xl font-bold text-green-700 mt-2">
                  {dados.filter(row => row.tp_operacao === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-sm text-gray-500">Soma dos valores</span>
              </div>
            </div>
            {/* Botão de exportação CSV */}
            <div className="flex justify-start mb-2">
              <button
                onClick={exportarCSV}
                className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded transition h-10 text-sm font-semibold"
                disabled={dados.length === 0}
              >
                Baixar CSV
              </button>
            </div>
            <div className="rounded-lg shadow bg-white">
              <div className="overflow-y-auto max-h-[500px]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-4 py-2">Conta</th>
                      <th className="px-4 py-2">Data Lançamento</th>
                      <th className="px-4 py-2">Documento</th>
                      <th className="px-4 py-2">Estorno</th>
                      <th className="px-4 py-2">Operação</th>
                      <th className="px-4 py-2">Auxiliar</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Data Liquidação</th>
                    </tr>
                  </thead>
                  <tbody className="overflow-y-auto">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-8">Carregando...</td></tr>
                    ) : dados.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                    ) : (
                      dados.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className={`px-4 py-2 text-center text-xs ${(() => {
                            const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                            return conta ? corConta(conta.nome) : '';
                          })()}`}>{
                            (() => {
                              const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                              return conta ? `${conta.numero} - ${conta.nome}` : row.nr_ctapes;
                            })()
                          }</td>
                          <td className="px-4 py-2 text-center">{formatarDataBR(row.dt_movim)}</td>
                          <td className="px-4 py-2">{row.ds_doc}</td>
                          <td className="px-4 py-2 text-center">{row.in_estorno}</td>
                          <td className="px-4 py-2 text-center">{row.tp_operacao}</td>
                          <td className="px-4 py-2">{row.ds_aux}</td>
                          <td className={`px-4 py-2 text-right ${row.tp_operacao === 'D' ? 'text-red-600 font-bold' : row.tp_operacao === 'C' ? 'text-green-600 font-bold' : ''}`}>{row.vl_lancto !== null && row.vl_lancto !== undefined ? Number(row.vl_lancto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                          <td className="px-4 py-2 text-center">{formatarDataBR(row.dt_liq)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || loading}
                >
                  Anterior
                </button>
                <span className="mx-2">Página {page} de {totalPages}</span>
                <button
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages || loading}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ExtratoTOTVS; 