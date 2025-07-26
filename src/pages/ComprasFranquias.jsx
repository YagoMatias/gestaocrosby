import React, { useState } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { ArrowsClockwise, CurrencyDollar } from '@phosphor-icons/react';

const ComprasFranquias = () => {
  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    cd_empresa: '',
    nm_grupoempresa: ''
  });
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([
    { cd_empresa: '2' },
    { cd_empresa: '75' },
    { cd_empresa: '31' },
    { cd_empresa: '6' },
    { cd_empresa: '11' },
  ]);
  const [nmFantasia, setNmFantasia] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [nmFantasiaSelecionados, setNmFantasiaSelecionados] = useState([]);
  const [dados, setDados] = useState([]);
  const [dadosVendas, setDadosVendas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  const fetchSugestoes = async (texto) => {
    if (!texto || texto.length < 1) {
      setSugestoes([]);
      return;
    }
    try {
      const res = await fetch(`https://apigestaocrosby.onrender.com/autocomplete/nm_fantasia?q=${encodeURIComponent(texto)}`);
      if (!res.ok) return;
      const json = await res.json();
      setSugestoes(json);
      setShowSugestoes(true);
    } catch {
      setSugestoes([]);
    }
  };

  const handleChangeNmFantasia = (e) => {
    setNmFantasia(e.target.value);
    fetchSugestoes(e.target.value);
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

  const handleFiltrar = async (e) => {
    e.preventDefault();
    if (empresasSelecionadas.length === 0) {
      setErro('Selecione pelo menos uma loja para consultar!');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      empresasSelecionadas.forEach(emp => params.append('cd_empresa', emp.cd_empresa));
      if (filtros.dt_inicio) params.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) params.append('dt_fim', filtros.dt_fim);
      if (nmFantasiaSelecionados.length > 0) {
        params.append('nm_fantasia', nmFantasiaSelecionados[0]);
      }
      // Compras
      const res = await fetch(`https://apigestaocrosby.onrender.com/faturamentofranquia?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar dados do servidor');
      const json = await res.json();
      setDados(json);
      // Vendas Franquias
      const paramsVendas = new URLSearchParams();
      paramsVendas.append('cd_grupoempresa_ini', 1);
      paramsVendas.append('cd_grupoempresa_fim', 8000);
      if (filtros.dt_inicio) paramsVendas.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) paramsVendas.append('dt_fim', filtros.dt_fim);
      if (nmFantasiaSelecionados.length > 0) {
        paramsVendas.append('nm_fantasia', nmFantasiaSelecionados[0]);
      }
      const resVendas = await fetch(`https://apigestaocrosby.onrender.com/faturamentolojas?${paramsVendas.toString()}`);
      if (resVendas.ok) {
        const jsonVendas = await resVendas.json();
        setDadosVendas(jsonVendas);
      } else {
        setDadosVendas([]);
      }
    } catch (err) {
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
      setDadosVendas([]);
    } finally {
      setLoading(false);
    }
  };

  // Função para agrupar por nome fantasia e somar compras, devoluções e trazer faturamento da loja correspondente
  function agruparPorNomeFantasiaComprasEVendas(dadosCompras, dadosVendas) {
    // Pega todos os nomes fantasia únicos de compras
    const nomes = new Set([
      ...dadosCompras.map(row => row.nm_fantasia)
    ]);
    console.log(dadosVendas);

    return Array.from(nomes).map(nm_fantasia => {
      // Compras
      const comprasRows = dadosCompras.filter(row => row.nm_fantasia === nm_fantasia);
      const devolucao = comprasRows
        .filter(row => row.tp_operacao === 'E')
        .reduce((acc, row) => acc + Number(row.vl_unitliquido) * Number(row.qt_faturado), 0);
      const compras = comprasRows
        .filter(row => row.tp_operacao === 'S')
        .reduce((acc, row) => acc + Number(row.vl_unitliquido) * Number(row.qt_faturado), 0);
      // Grupo empresa (pega do primeiro registro de compras, se existir)
      const nm_grupoempresa = comprasRows[0]?.nm_grupoempresa || '';
      // Vendas: pega todos os faturamentos do nome fantasia correspondente
      const vendas = dadosVendas
        .filter(v => v.nm_fantasia === nm_fantasia)
        .map(v => Number(v.faturamento || 0));
      const vendasTotalStr = vendas.length
        ? vendas.map(val => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })).join(', ')
        : '-';

      return {
        nm_grupoempresa,
        nm_fantasia,
        devolucao,
        compras,
        total: compras - devolucao,
        vendasTotal: vendasTotalStr
      };
    }).sort((a, b) => b.compras - a.compras);
  }

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Compras Franquias</h1>
        {/* Filtros */}
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><CurrencyDollar size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período, a loja e a franquia</span>
            </div>
            <div className="flex flex-row gap-x-6 w-full">
              <div className="w-full">
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={handleSelectEmpresas}
                />
              </div>
              <div className="flex flex-col min-w-[220px]">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Nome Fantasia</label>
                <input
                  type="text"
                  name="nm_fantasia"
                  autoComplete="off"
                  value={nmFantasia}
                  onChange={handleChangeNmFantasia}
                  onFocus={() => fetchSugestoes(nmFantasia)}
                  onBlur={handleBlur}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                  placeholder="Digite o nome fantasia"
                />
                {/* Sugestões */}
                {showSugestoes && sugestoes.length > 0 && (
                  <ul className="z-10 bg-white border rounded shadow w-full max-h-40 overflow-y-auto mt-2 flex flex-col">
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
                {/* Selecionados */}
                {nmFantasiaSelecionados.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
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
        {/* Tabela de resultados detalhada */}
        <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#000638]">Ranking de Compras Franquias</h2>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12"><span className='animate-spin mr-2'>⏳</span> Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-4 py-2 font-semibold">Grupo Empresa</th>
                    <th className="px-4 py-2 font-semibold">Nome Fantasia</th>
                    <th className="px-4 py-2 font-semibold">Devolução</th>
                    <th className="px-4 py-2 font-semibold">Compras</th>
                    <th className="px-4 py-2 font-semibold">Dev - Compras</th>
                    <th className="px-4 py-2 font-semibold">Vendas Franquias</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.length === 0 && dadosVendas.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                  ) : (
                    agruparPorNomeFantasiaComprasEVendas(dados, dadosVendas).map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-[#f8f9fb]">
                        <td className="px-4 py-2">{row.nm_grupoempresa}</td>
                        <td className="px-4 py-2">{row.nm_fantasia}</td>
                        <td className="px-4 py-2 text-right text-red-600 font-bold">{row.devolucao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-2 text-right text-green-600 font-bold">{row.compras.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-2 text-right text-blue-700 font-bold">{(row.compras - row.devolucao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-2 text-right text-indigo-700 font-bold">{row.vendasTotal}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ComprasFranquias; 