import React, { useState } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import LoadingCircle from '../components/LoadingCircle';
import { CaretDown, CaretRight, ArrowsClockwise, Receipt, CurrencyDollar, Money } from '@phosphor-icons/react';

export default function FundoPropaganda() {
  const [filtros, setFiltros] = useState({
    cd_empresa: '',
    nm_fantasia: '',
    dt_inicio: '',
    dt_fim: ''
  });
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [nmFantasiaSelecionados, setNmFantasiaSelecionados] = useState([]);
  const [dadosCredev, setDadosCredev] = useState([]);
  const [loadingCredev, setLoadingCredev] = useState(false);
  const [erroCredev, setErroCredev] = useState('');

  // Estados para expandir/minimizar as tabelas
  const [expandFaturamento, setExpandFaturamento] = useState(true);
  const [expandCredev, setExpandCredev] = useState(true);
  const [expandResumo, setExpandResumo] = useState(true);

  const fetchSugestoes = async (texto) => {
    if (!texto || texto.length < 1) {
      setSugestoes([]);
      return;
    }
    try {
      const res = await fetch(`https://manualtotvs.vercel.app/autocomplete/nm_fantasia?q=${encodeURIComponent(texto)}`);
      if (!res.ok) return;
      const json = await res.json();
      setSugestoes(json);
      setShowSugestoes(true);
    } catch {
      setSugestoes([]);
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

  const handleFiltrar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setLoadingCredev(true);
    setErroCredev('');
    try {
      const params = new URLSearchParams();
      if (filtros.cd_empresa) params.append('cd_empresa', filtros.cd_empresa);
      if (nmFantasiaSelecionados.length > 0) {
        nmFantasiaSelecionados.forEach(nm => params.append('nm_fantasia', nm));
      }
      if (filtros.dt_inicio) params.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) params.append('dt_fim', filtros.dt_fim);
      // Busca dados da tabela principal
      const res = await fetch(`https://manualtotvs.vercel.app/fundopropaganda?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar dados do servidor');
      const json = await res.json();
      setDados(json);
      // Busca dados da tabela credev
      const paramsCredev = new URLSearchParams();
      if (filtros.dt_inicio) paramsCredev.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) paramsCredev.append('dt_fim', filtros.dt_fim);
      const resCredev = await fetch(`https://manualtotvs.vercel.app/franquiascredev?${paramsCredev.toString()}`);
      if (!resCredev.ok) throw new Error('Erro ao buscar dados credev');
      const jsonCredev = await resCredev.json();
      setDadosCredev(jsonCredev);
    } catch (err) {
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
      setErroCredev('Erro ao buscar dados credev.');
      setDadosCredev([]);
    } finally {
      setLoading(false);
      setLoadingCredev(false);
    }
  };

  // Função para formatar data para o padrão brasileiro
  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  // Função para agrupar e somar os valores por empresa e nome fantasia
  function agruparPorEmpresaENome(dados) {
    const mapa = new Map();
    dados.forEach(row => {
      const chave = `${row.cd_empresa}||${row.nm_fantasia}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, { ...row, vl_total: Number(row.vl_total) });
      } else {
        const atual = mapa.get(chave);
        atual.vl_total += Number(row.vl_total);
        mapa.set(chave, atual);
      }
    });
    return Array.from(mapa.values());
  }

  // Função para agrupar e somar os valores por cliente e nome fantasia na CREDEV
  function agruparCredevPorClienteENome(dados) {
    const mapa = new Map();
    dados.forEach(row => {
      const chave = `${row.cd_cliente}||${row.nm_fantasia}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, { ...row, vl_pago: Number(row.vl_pago) });
      } else {
        const atual = mapa.get(chave);
        atual.vl_pago += Number(row.vl_pago);
        mapa.set(chave, atual);
      }
    });
    return Array.from(mapa.values());
  }

  // Função para juntar os dados das duas tabelas e calcular o valor final, relacionando apenas por nm_fantasia
  function juntarResumoFinalPorNomeFantasia(dadosFaturamento, dadosCredev) {
    // Mapear valor pago do credev por nome fantasia
    const mapCredev = new Map();
    dadosCredev.forEach(row => {
      const chave = row.nm_fantasia;
      if (!mapCredev.has(chave)) {
        mapCredev.set(chave, Number(row.vl_pago));
      } else {
        mapCredev.set(chave, mapCredev.get(chave) + Number(row.vl_pago));
      }
    });
    // Para cada linha do faturamento, buscar o valor pago do credev pelo mesmo nome fantasia
    return dadosFaturamento.map(row => {
      const valor_pago = mapCredev.get(row.nm_fantasia) || 0;
      return {
        empresa: row.cd_empresa,
        nm_fantasia: row.nm_fantasia,
        valor_total: Number(row.vl_total),
        valor_pago,
        valor_final: Number(row.vl_total) - valor_pago
      };
    });
  }

  // Funções de exportação CSV
  function exportarCSVFaturamento() {
    const dadosExport = agruparPorEmpresaENome(dados);
    if (!dadosExport || dadosExport.length === 0) return;
    const header = [
      'Empresa',
      'Nome Fantasia',
      'Data Transação',
      'Valor Total'
    ];
    const rows = dadosExport.map(row => [
      row.cd_empresa,
      row.nm_fantasia,
      formatarDataBR(row.dt_transacao),
      Number(row.vl_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);
    const csvContent = [header, ...rows]
      .map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'faturamento_bruto.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportarCSVCredev() {
    const dadosExport = dadosCredev
      .filter(row => nmFantasiaSelecionados.length === 0 || nmFantasiaSelecionados.includes(row.nm_fantasia))
      .reduce((acc, row) => {
        const chave = `${row.cd_cliente}||${row.nm_fantasia}`;
        if (!acc.map.has(chave)) {
          acc.map.set(chave, { ...row, vl_pago: Number(row.vl_pago) });
          acc.arr.push(acc.map.get(chave));
        } else {
          acc.map.get(chave).vl_pago += Number(row.vl_pago);
        }
        return acc;
      }, { map: new Map(), arr: [] }).arr;
    if (!dadosExport || dadosExport.length === 0) return;
    const header = [
      'Cliente',
      'Nome Fantasia',
      'Valor Pago',
      'Tipo Documento'
    ];
    const rows = dadosExport.map(row => [
      row.cd_cliente,
      row.nm_fantasia,
      Number(row.vl_pago).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      row.tp_documento
    ]);
    const csvContent = [header, ...rows]
      .map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'credev.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportarCSVResumoFinal() {
    const dadosFaturamento = agruparPorEmpresaENome(dados).filter(row => Number(row.cd_empresa) < 99);
    const dadosCredevExport = dadosCredev
      .filter(row => nmFantasiaSelecionados.length === 0 || nmFantasiaSelecionados.includes(row.nm_fantasia))
      .reduce((acc, row) => {
        const chave = `${row.cd_cliente}||${row.nm_fantasia}`;
        if (!acc.map.has(chave)) {
          acc.map.set(chave, { ...row, vl_pago: Number(row.vl_pago) });
          acc.arr.push(acc.map.get(chave));
        } else {
          acc.map.get(chave).vl_pago += Number(row.vl_pago);
        }
        return acc;
      }, { map: new Map(), arr: [] }).arr;
    const dadosExport = juntarResumoFinalPorNomeFantasia(dadosFaturamento, dadosCredevExport);
    if (!dadosExport || dadosExport.length === 0) return;
    const header = [
      'Empresa',
      'Nome Fantasia',
      'Valor Total',
      'Valor Pago',
      'Valor Final'
    ];
    const rows = dadosExport.map(row => [
      row.empresa,
      row.nm_fantasia,
      Number(row.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      Number(row.valor_pago).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      Number(row.valor_final).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);
    const csvContent = [header, ...rows]
      .map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'resumo_final.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Cálculo dos totais para os cards
  const totalFaturamento = agruparPorEmpresaENome(dados).reduce((acc, row) => acc + Number(row.vl_total), 0);
  const totalCredev = dadosCredev
    .filter(row => nmFantasiaSelecionados.length === 0 || nmFantasiaSelecionados.includes(row.nm_fantasia))
    .reduce((acc, row) => acc + Number(row.vl_pago), 0);
  const totalFinal = totalFaturamento - totalCredev;

  return (
    <Layout>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Fundo de Propaganda</h1>
            <div className="mb-8">
              <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
                <div className="mb-6">
                  <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
                  <span className="text-sm text-gray-500 mt-1">Selecione o período, empresa ou nome fantasia para análise</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 w-full mb-6">
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
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Transação Inicial</label>
                    <input
                      type="date"
                      name="dt_inicio"
                      value={filtros.dt_inicio}
                      onChange={handleChange}
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Transação Final</label>
                    <input
                      type="date"
                      name="dt_fim"
                      value={filtros.dt_fim}
                      onChange={handleChange}
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                    />
                  </div>
                  {/* FiltroEmpresa 1 */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Nome Fantasia</label>
                    <input
                      type="text"
                      name="nm_fantasia"
                      value={filtros.nm_fantasia}
                      onChange={handleChange}
                      onFocus={() => fetchSugestoes(filtros.nm_fantasia)}
                      onBlur={handleBlur}
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                      placeholder="Digite o nome fantasia"
                    />
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
                  </div>
                  {/* FiltroEmpresa 2 (duplicado) */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Nome Fantasia</label>
                    <input
                      type="text"
                      name="nm_fantasia"
                      value={filtros.nm_fantasia}
                      onChange={handleChange}
                      onFocus={() => fetchSugestoes(filtros.nm_fantasia)}
                      onBlur={handleBlur}
                      className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                      placeholder="Digite o nome fantasia"
                    />
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
            {/* CARDS DE RESUMO */}
            <div className="flex flex-wrap gap-6 justify-center mb-8">
              {/* Card Valor Total */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#000638]">
                <span className="mr-4"><Receipt size={32} color="#000638" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#000638] mb-1 tracking-wide">FATURAMENTO</span>
                  <span className="text-2xl font-extrabold text-green-600 mb-1">
                    {loading ? <LoadingCircle size={32} /> : totalFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
              {/* Card Valor CREDEV */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#fe0000]">
                <span className="mr-4"><CurrencyDollar size={32} color="#fe0000" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#fe0000] mb-1 tracking-wide">CREDEV</span>
                  <span className="text-2xl font-extrabold text-[#fe0000] mb-1">
                    {loadingCredev ? <LoadingCircle size={32} /> : totalCredev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
              {/* Card Valor Final */}
              <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#000000]">
                <span className="mr-4"><Money size={32} color="#000000" weight="duotone" /></span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-[#000000] mb-1 tracking-wide">LIQUIDO</span>
                  <span className="text-2xl font-extrabold text-[#000000] mb-1">
                    {(loading || loadingCredev) ? <LoadingCircle size={32} /> : totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>
            {/* Botão CSV Faturamento Bruto */}
            <div className="flex justify-end mb-2 mt-4">
              <button
                onClick={exportarCSVFaturamento}
                className="flex items-center gap-2 bg-[#000638] hover:bg-[#fe0000] text-white px-6 py-2 rounded-xl transition h-12 text-base font-bold shadow-md tracking-wide uppercase"
                disabled={agruparPorEmpresaENome(dados).length === 0}
              >
                <ArrowsClockwise size={18} weight="bold" /> BAIXAR CSV
              </button>
            </div>
            {/* Tabela FATURAMENTO BRUTO (dropdown) */}
            <div className="rounded-2xl shadow-lg bg-white mt-2 border border-[#000638]/10">
              <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandFaturamento(e => !e)}>
                <h2 className="text-xl font-bold text-[#000638]">Faturamento Bruto</h2>
                <span className="flex items-center">
                  {expandFaturamento ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
                </span>
              </div>
              {expandFaturamento && (
                <div className="overflow-y-auto max-h-[500px]">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#000638] text-white">
                        <th className="px-4 py-2 font-semibold">Empresa</th>
                        <th className="px-4 py-2 font-semibold">Nome Fantasia</th>
                        <th className="px-4 py-2 font-semibold">Nº Transação</th>
                        <th className="px-4 py-2 font-semibold">Data Transação</th>
                        <th className="px-4 py-2 font-semibold">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={4} className="text-center py-8"><LoadingCircle size={32} /></td></tr>
                      ) : dados.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                      ) : (
                        agruparPorEmpresaENome(dados).map((row, i) => (
                          <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                            <td className="px-4 py-2 text-center text-[#000638]">{row.cd_empresa}</td>
                            <td className="px-4 py-2 text-[#000000]">{row.nm_fantasia}</td>
                            <td className="px-4 py-2 text-center text-[#000638]">{row.nr_transacao}</td>
                            <td className="px-4 py-2 text-center text-[#000000]">{formatarDataBR(row.dt_transacao)}</td>
                            <td className="px-4 py-2 text-right font-bold text-green-600">{Number(row.vl_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Botão CSV CREDEV */}
            <div className="flex justify-end mb-2 mt-4">
              <button
                onClick={exportarCSVCredev}
                className="flex items-center gap-2 bg-[#000638] hover:bg-[#fe0000] text-white px-6 py-2 rounded-xl transition h-12 text-base font-bold shadow-md tracking-wide uppercase"
                disabled={dadosCredev.length === 0}
              >
                <ArrowsClockwise size={18} weight="bold" /> BAIXAR CSV
              </button>
            </div>
            {/* Tabela CREDEV (dropdown) */}
            <div className="rounded-2xl shadow-lg bg-white mt-2 border border-[#fe0000]/10">
              <div className="p-4 border-b border-[#fe0000]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandCredev(e => !e)}>
                <h2 className="text-xl font-bold text-[#fe0000]">CREDEV</h2>
                <span className="flex items-center">
                  {expandCredev ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
                </span>
              </div>
              {expandCredev && (
                <div className="overflow-y-auto max-h-[500px]">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#000638] text-white">
                        <th className="px-4 py-2 font-semibold">Cliente</th>
                        <th className="px-4 py-2 font-semibold">Nome Fantasia</th>
                        <th className="px-4 py-2 font-semibold">Valor Pago</th>
                        <th className="px-4 py-2 font-semibold">Tipo Documento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingCredev ? (
                        <tr><td colSpan={4} className="text-center py-8"><LoadingCircle size={32} /></td></tr>
                      ) : (
                        (dadosCredev
                          .filter(row => nmFantasiaSelecionados.length === 0 || nmFantasiaSelecionados.includes(row.nm_fantasia))
                          .reduce((acc, row) => {
                            const chave = `${row.cd_cliente}||${row.nm_fantasia}`;
                            if (!acc.map.has(chave)) {
                              acc.map.set(chave, { ...row, vl_pago: Number(row.vl_pago) });
                              acc.arr.push(acc.map.get(chave));
                            } else {
                              acc.map.get(chave).vl_pago += Number(row.vl_pago);
                            }
                            return acc;
                          }, { map: new Map(), arr: [] }).arr
                        ).length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                        ) : (
                          dadosCredev
                            .filter(row => nmFantasiaSelecionados.length === 0 || nmFantasiaSelecionados.includes(row.nm_fantasia))
                            .reduce((acc, row) => {
                              const chave = `${row.cd_cliente}||${row.nm_fantasia}`;
                              if (!acc.map.has(chave)) {
                                acc.map.set(chave, { ...row, vl_pago: Number(row.vl_pago) });
                                acc.arr.push(acc.map.get(chave));
                              } else {
                                acc.map.get(chave).vl_pago += Number(row.vl_pago);
                              }
                              return acc;
                            }, { map: new Map(), arr: [] }).arr
                            .map((row, i) => (
                              <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                                <td className="px-4 py-2 text-center text-[#000638]">{row.cd_cliente}</td>
                                <td className="px-4 py-2 text-[#000000]">{row.nm_fantasia}</td>
                                <td className="px-4 py-2 text-right font-bold text-[#fe0000]">{Number(row.vl_pago).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="px-4 py-2 text-center text-[#000000]">{row.tp_documento}</td>
                              </tr>
                            ))
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Botão CSV Resumo Final */}
            <div className="flex justify-end mb-2 mt-4">
              <button
                onClick={exportarCSVResumoFinal}
                className="flex items-center gap-2 bg-[#000638] hover:bg-[#fe0000] text-white px-6 py-2 rounded-xl transition h-12 text-base font-bold shadow-md tracking-wide uppercase"
                disabled={agruparPorEmpresaENome(dados).filter(row => Number(row.cd_empresa) < 99).length === 0}
              >
                <ArrowsClockwise size={18} weight="bold" /> BAIXAR CSV
              </button>
            </div>
            {/* Tabela RESUMO FINAL (dropdown) */}
            <div className="rounded-2xl shadow-lg bg-white mt-2 border border-[#000000]/10">
              <div className="p-4 border-b border-[#000000]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandResumo(e => !e)}>
                <h2 className="text-xl font-bold text-[#000000]">Resumo Final</h2>
                <span className="flex items-center">
                  {expandResumo ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
                </span>
              </div>
              {expandResumo && (
                <div className="overflow-y-auto max-h-[500px]">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#000638] text-white">
                        <th className="px-4 py-2 font-semibold">Empresa</th>
                        <th className="px-4 py-2 font-semibold">Nome Fantasia</th>
                        <th className="px-4 py-2 font-semibold">Valor Total</th>
                        <th className="px-4 py-2 font-semibold">Valor Pago</th>
                        <th className="px-4 py-2 font-semibold">Valor Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading || loadingCredev ? (
                        <tr><td colSpan={5} className="text-center py-8"><LoadingCircle size={32} /></td></tr>
                      ) : (
                        juntarResumoFinalPorNomeFantasia(
                          agruparPorEmpresaENome(dados).filter(row => Number(row.cd_empresa) < 99),
                          dadosCredev
                            .filter(row => nmFantasiaSelecionados.length === 0 || nmFantasiaSelecionados.includes(row.nm_fantasia))
                            .reduce((acc, row) => {
                              const chave = `${row.cd_cliente}||${row.nm_fantasia}`;
                              if (!acc.map.has(chave)) {
                                acc.map.set(chave, { ...row, vl_pago: Number(row.vl_pago) });
                                acc.arr.push(acc.map.get(chave));
                              } else {
                                acc.map.get(chave).vl_pago += Number(row.vl_pago);
                              }
                              return acc;
                            }, { map: new Map(), arr: [] }).arr
                        ).length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                        ) : (
                          juntarResumoFinalPorNomeFantasia(
                            agruparPorEmpresaENome(dados).filter(row => Number(row.cd_empresa) < 99),
                            dadosCredev
                              .filter(row => nmFantasiaSelecionados.length === 0 || nmFantasiaSelecionados.includes(row.nm_fantasia))
                              .reduce((acc, row) => {
                                const chave = `${row.cd_cliente}||${row.nm_fantasia}`;
                                if (!acc.map.has(chave)) {
                                  acc.map.set(chave, { ...row, vl_pago: Number(row.vl_pago) });
                                  acc.arr.push(acc.map.get(chave));
                                } else {
                                  acc.map.get(chave).vl_pago += Number(row.vl_pago);
                                }
                                return acc;
                              }, { map: new Map(), arr: [] }).arr
                          ).map((row, i) => (
                            <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                              <td className="px-4 py-2 text-center text-[#000638]">{row.empresa}</td>
                              <td className="px-4 py-2 text-[#000000]">{row.nm_fantasia}</td>
                              <td className="px-4 py-2 text-right font-bold text-green-600">{Number(row.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className="px-4 py-2 text-right font-bold text-[#fe0000]">{Number(row.valor_pago).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className={`px-4 py-2 text-right font-bold ${row.valor_final < 0 ? 'text-[#fe0000]' : 'text-[#000000]'}`}>{Number(row.valor_final).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            </tr>
                          ))
                        )
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
}
