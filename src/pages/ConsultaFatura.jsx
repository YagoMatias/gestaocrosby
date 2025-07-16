import React, { useState } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { CaretDown, CaretRight, ArrowsClockwise, Receipt, CurrencyDollar, Money, User } from '@phosphor-icons/react';

const ConsultaFatura = () => {
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
  // Estados para expandir/minimizar a tabela
  const [expandTabela, setExpandTabela] = useState(true);

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
            <h1 className="text-3xl font-bold mb-6 text-center">Consulta de Fatura</h1>
            
            {/* Filtros */}
            <div className="mb-8">
              <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-3xl mx-auto border border-[#000638]/10">
                <div className="mb-6">
                  <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
                  <span className="text-sm text-gray-500 mt-1">Selecione o período, empresa ou cliente para análise</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-x-6 gap-y-4 w-full mb-6">
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Empresa</label>
                    <input 
                      type="text" 
                      name="cd_empresa" 
                      value={filtros.cd_empresa} 
                      onChange={handleChange} 
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                      placeholder="Código da empresa" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Cliente</label>
                    <input 
                      type="text" 
                      name="cd_cliente" 
                      value={filtros.cd_cliente} 
                      onChange={handleChange} 
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                      placeholder="Código do cliente" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Início</label>
                    <input 
                      type="date" 
                      name="dt_inicio" 
                      value={filtros.dt_inicio} 
                      onChange={handleChange} 
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Fim</label>
                    <input 
                      type="date" 
                      name="dt_fim" 
                      value={filtros.dt_fim} 
                      onChange={handleChange} 
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Nome Fantasia</label>
                    <input
                      type="text"
                      name="nm_fantasia"
                      autoComplete="off"
                      value={filtros.nm_fantasia}
                      onChange={handleChange}
                      onFocus={() => fetchSugestoes(filtros.nm_fantasia)}
                      onBlur={handleBlur}
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
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
                          className="accent-[#000638] ml-2 pointer-events-none"
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
                      <span key={idx} className="bg-[#000638] text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm">
                        {nm}
                        <button type="button" className="ml-1 text-white hover:text-[#fe0000]" onClick={() => handleRemoveSelecionado(nm)} title="Remover">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-end w-full mt-8">
                  <button type="submit" className="flex items-center gap-2 bg-[#000638] text-white px-8 py-3 rounded-xl hover:bg-[#fe0000] transition h-12 text-base font-bold shadow-md tracking-wide uppercase">
                    <ArrowsClockwise size={22} weight="bold" /> Atualizar
                  </button>
                </div>
              </form>
              {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
            </div>

            {/* Cards de Resumo */}
            <div className="flex flex-wrap gap-6 justify-center mb-8">
              {/* Card Total de Faturas */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#000638]">
                <span className="mr-4"><Receipt size={32} color="#000638" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#000638] mb-1 tracking-wide">TOTAL DE FATURAS</span>
                  <span className="text-2xl font-extrabold text-[#000638] mb-1">
                    {dados.length}
                  </span>
                  <span className="text-xs text-gray-500">Quantidade</span>
                </div>
              </div>
              {/* Card Valor Total Faturado */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#fe0000]">
                <span className="mr-4"><CurrencyDollar size={32} color="#fe0000" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#fe0000] mb-1 tracking-wide">VALOR FATURADO</span>
                  <span className="text-2xl font-extrabold text-[#fe0000] mb-1">
                    {dados.reduce((acc, row) => acc + (Number(row.vl_fatura) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-xs text-gray-500">Soma dos valores</span>
                </div>
              </div>
              {/* Card Valor Total Pago */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#000000]">
                <span className="mr-4"><Money size={32} color="#000000" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#000000] mb-1 tracking-wide">VALOR PAGO</span>
                  <span className="text-2xl font-extrabold text-[#000000] mb-1">
                    {dados.reduce((acc, row) => acc + (Number(row.vl_pago) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-xs text-gray-500">Soma dos valores</span>
                </div>
              </div>
            </div>

            {/* Tabela de Dados (dropdown) */}
            <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
              <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
                <h2 className="text-xl font-bold text-[#000638]">Dados da Consulta de Fatura</h2>
                <span className="flex items-center">
                  {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
                </span>
              </div>
              {expandTabela && (
                <div className="overflow-y-auto max-h-[500px]">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#000638] text-white">
                        <th className="px-4 py-2 font-semibold">Empresa</th>
                        <th className="px-4 py-2 font-semibold">Cliente</th>
                        <th className="px-4 py-2 font-semibold">Nome Cliente</th>
                        <th className="px-4 py-2 font-semibold">Nome Fantasia</th>
                        <th className="px-4 py-2 font-semibold">Valor Faturado</th>
                      </tr>
                    </thead>
                    <tbody className="overflow-y-auto">
                      {loading ? (
                        <tr><td colSpan={5} className="text-center py-8">Carregando...</td></tr>
                      ) : agruparDadosPorClienteFantasiaCliente(dados).length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                      ) : (
                        agruparDadosPorClienteFantasiaCliente(dados).map((row, i) => (
                          <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                            <td className="px-4 py-2 text-center text-[#000638]">{row.cd_empresa}</td>
                            <td className="px-4 py-2 text-center text-[#000638]">{row.cd_cliente}</td>
                            <td className="px-4 py-2 text-[#000000]">{row.nm_cliente}</td>
                            <td className="px-4 py-2 text-[#000000]">{row.nm_fantasia}</td>
                            <td className="px-4 py-2 text-right font-bold text-[#fe0000]">
                              {(Number(row.vl_fatura) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ConsultaFatura; 