import React, { useState } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const FundoPropaganda = () => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    cd_empresa: '',
    cd_cliente: '',
    dt_inicio: '',
    dt_fim: '',
    nm_fantasia: '' // usado apenas para digitação
  });
  const [sugestoes, setSugestoes] = useState([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [nmFantasiaSelecionados, setNmFantasiaSelecionados] = useState([]);

  const fetchSugestoes = async (texto) => {
    if (!texto || texto.length < 1) {
      setSugestoes([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:4000/autocomplete/nm_fantasia?q=${encodeURIComponent(texto)}`);
      if (!res.ok) return;
      const json = await res.json();
      setSugestoes(json);
      setShowSugestoes(true);
    } catch {
      setSugestoes([]);
    }
  };

  const fetchDados = async () => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtros.cd_empresa) params.append('cd_empresa', filtros.cd_empresa);
      if (filtros.cd_cliente) params.append('cd_cliente', filtros.cd_cliente);
      if (filtros.dt_inicio) params.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) params.append('dt_fim', filtros.dt_fim);
      if (nmFantasiaSelecionados.length > 0) {
        nmFantasiaSelecionados.forEach(nm => params.append('nm_fantasia', nm));
      }
      const res = await fetch(`http://localhost:4000/fundopropaganda?${params.toString()}`);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFiltros({ ...filtros, [name]: value });
    if (name === 'nm_fantasia') {
      fetchSugestoes(value);
    }
  };

  const handleSugestaoToggle = (sugestao) => {
    setNmFantasiaSelecionados((prev) => {
      if (prev.includes(sugestao)) {
        return prev.filter(nm => nm !== sugestao);
      } else {
        return [...prev, sugestao];
      }
    });
  };

  const handleRemoveSelecionado = (nm) => {
    setNmFantasiaSelecionados((prev) => prev.filter(n => n !== nm));
  };

  const handleBlur = () => {
    setTimeout(() => setShowSugestoes(false), 150);
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

  // Função para agrupar e somar valor faturado, ignorando tp_documento = 20
  function agruparDadosPorClienteFantasiaCliente(dados) {
    const mapa = new Map();
    dados.forEach(row => {
      if (String(row.tp_documento) === '20') {
        // Ignora operações com tp_documento = 20
        return;
      }
      const chave = `${row.cd_cliente}||${row.nm_fantasia}||${row.nm_cliente}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          cd_empresa: row.cd_empresa,
          cd_cliente: row.cd_cliente,
          nm_cliente: row.nm_cliente,
          nm_fantasia: row.nm_fantasia,
          vl_fatura: 0,
        });
      }
      mapa.get(chave).vl_fatura += Number(row.vl_fatura) || 0;
    });
    return Array.from(mapa.values());
  }

  return (
    <Layout>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Fundo de Propaganda</h1>
            
            {/* Filtros */}
            <div className="mb-8">
              <form onSubmit={handleFiltrar} className="flex flex-col items-center bg-white p-4 rounded-lg shadow">
                <div className="flex flex-row w-full justify-center gap-2 flex-wrap">
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Empresa</label>
                    <input 
                      type="text" 
                      name="cd_empresa" 
                      value={filtros.cd_empresa} 
                      onChange={handleChange} 
                      className="border rounded px-3 py-2 w-40" 
                      placeholder="Código da empresa" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Cliente</label>
                    <input 
                      type="text" 
                      name="cd_cliente" 
                      value={filtros.cd_cliente} 
                      onChange={handleChange} 
                      className="border rounded px-3 py-2 w-40" 
                      placeholder="Código do cliente" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Data Inicial</label>
                    <input 
                      type="date" 
                      name="dt_inicio" 
                      value={filtros.dt_inicio} 
                      onChange={handleChange} 
                      className="border rounded px-3 py-2 w-40" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Data Final</label>
                    <input 
                      type="date" 
                      name="dt_fim" 
                      value={filtros.dt_fim} 
                      onChange={handleChange} 
                      className="border rounded px-3 py-2 w-40" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      name="nm_fantasia"
                      autoComplete="off"
                      value={filtros.nm_fantasia}
                      onChange={handleChange}
                      onFocus={() => fetchSugestoes(filtros.nm_fantasia)}
                      onBlur={handleBlur}
                      className="border rounded px-3 py-2 w-60"
                      placeholder="Digite o nome fantasia"
                    />
                  </div>
                </div>
                {/* Sugestões abaixo dos filtros */}
                {showSugestoes && sugestoes.length > 0 && (
                  <ul className="z-10 bg-white border rounded shadow w-full max-w-4xl mx-auto max-h-40 overflow-y-auto mt-2 flex flex-col">
                    {sugestoes.map((s, i) => (
                      <li
                        key={i}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between gap-2 select-none"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleSugestaoToggle(s)}
                      >
                        <span className="text-left w-full">{s}</span>
                        <input
                          type="checkbox"
                          checked={nmFantasiaSelecionados.includes(s)}
                          readOnly
                          className="accent-blue-600 ml-2 pointer-events-none"
                          id={`sugestao-${i}`}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {/* Nomes selecionados */}
                {nmFantasiaSelecionados.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 w-full max-w-4xl mx-auto">
                    {nmFantasiaSelecionados.map((nm, idx) => (
                      <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-1 text-sm">
                        {nm}
                        <button type="button" className="ml-1 text-blue-700 hover:text-red-600" onClick={() => handleRemoveSelecionado(nm)} title="Remover">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-center w-full mt-2">
                  <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition h-10">Filtrar</button>
                </div>
              </form>
              {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
            </div>

            {/* Cards de Resumo */}
            <div className="flex flex-wrap gap-6 justify-center mb-8">
              {/* Card Total de Faturas */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-blue-500">
                <span className="text-lg font-semibold text-blue-700 mb-2">Total de Faturas</span>
                <span className="text-2xl font-bold text-blue-600 mb-1">
                  {dados.length}
                </span>
                <span className="text-sm text-gray-500">Quantidade</span>
              </div>
              
              {/* Card Valor Total Faturado */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-green-500">
                <span className="text-lg font-semibold text-green-700 mb-2">Valor Total Faturado</span>
                <span className="text-2xl font-bold text-green-600 mb-1">
                  {dados.reduce((acc, row) => acc + (Number(row.vl_fatura) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-sm text-gray-500">Soma dos valores</span>
              </div>
              
              {/* Card Valor Total Pago */}
              <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-orange-500">
                <span className="text-lg font-semibold text-orange-700 mb-2">Valor Total Pago</span>
                <span className="text-2xl font-bold text-orange-600 mb-1">
                  {dados.reduce((acc, row) => acc + (Number(row.vl_pago) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-sm text-gray-500">Soma dos valores</span>
              </div>
            </div>

            {/* Tabela de Dados */}
            <div className="rounded-lg shadow bg-white">
              <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-800">Dados do Fundo de Propaganda</h2>
              </div>
              <div className="overflow-y-auto max-h-[500px]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-4 py-2">Empresa</th>
                      <th className="px-4 py-2">Cliente</th>
                      <th className="px-4 py-2">Nome Cliente</th>
                      <th className="px-4 py-2">Nome Fantasia</th>
                      <th className="px-4 py-2">Valor Faturado</th>
                    </tr>
                  </thead>
                  <tbody className="overflow-y-auto">
                    {loading ? (
                      <tr><td colSpan={5} className="text-center py-8">Carregando...</td></tr>
                    ) : agruparDadosPorClienteFantasiaCliente(dados).length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                    ) : (
                      agruparDadosPorClienteFantasiaCliente(dados).map((row, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 text-center">{row.cd_empresa}</td>
                          <td className="px-4 py-2 text-center">{row.cd_cliente}</td>
                          <td className="px-4 py-2">{row.nm_cliente}</td>
                          <td className="px-4 py-2">{row.nm_fantasia}</td>
                          <td className="px-4 py-2 text-right font-bold text-green-600">
                            {(Number(row.vl_fatura) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FundoPropaganda; 