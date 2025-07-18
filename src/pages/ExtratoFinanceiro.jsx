import React, { useState, useRef } from 'react';
import Layout from '../components/Layout';
import DropdownContas from '../components/DropdownContas';
import { contas } from "../utils/contas";
import { ArrowsClockwise, CaretDown, CaretRight, ArrowCircleDown, ArrowCircleUp, Receipt } from '@phosphor-icons/react';

const PAGE_SIZE = 5000;

const ExtratoFinanceiro = () => {
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    cd_empresa: '',
    nr_ctapes: [], // agora é array
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [page, setPage] = useState(1);
  const [expandTabela, setExpandTabela] = useState(true);

  // Lista de contas para o dropdown
  // Remover a lista de contas daqui

  // Função para buscar dados
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
      const res = await fetch(`https://crosby-pd5x7.ondigitalocean.app/extrato?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar dados do servidor');
      const json = await res.json();
      setDados(json.rows || []);
      setTotal(json.total || 0);
    } catch (err) {
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const handleContaCheckbox = (numero) => {
    setFiltros((prev) => {
      const jaSelecionado = prev.nr_ctapes.includes(numero);
      return {
        ...prev,
        nr_ctapes: jaSelecionado
          ? prev.nr_ctapes.filter((n) => n !== numero)
          : [...prev.nr_ctapes, numero],
      };
    });
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDados({ ...filtros, [e.target.name]: e.target.value }, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchDados(filtros, newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Função para formatar datas no padrão brasileiro
  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  // Função para exportar CSV
  function exportarCSV() {
    if (!dados || dados.length === 0) return;
    const header = [
      'Conta',
      'Data Lançamento',
      'Histórico',
      'Operação',
      'Valor',
      'Data Conciliação'
    ];
    const rows = dados.map(row => [
      row.nr_ctapes,
      formatarDataBR(row.dt_lancto),
      row.ds_histbco,
      row.tp_operbco,
      row.vl_lancto !== null && row.vl_lancto !== undefined ? Number(row.vl_lancto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-',
      formatarDataBR(row.dt_conciliacao)
    ]);
    const csvContent = [header, ...rows]
      .map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extrato_financeiro.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Extrato Financeiro</h1>
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período, empresa, conta ou data para análise</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 w-full mb-6">
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Empresa</label>
                <input name="cd_empresa" value={filtros.cd_empresa} onChange={handleChange} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" placeholder="Empresa" />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Contas</label>
                <DropdownContas
                  contas={contas}
                  contasSelecionadas={Array.isArray(filtros.nr_ctapes) ? filtros.nr_ctapes : []}
                  setContasSelecionadas={fn =>
                    setFiltros(prev => ({
                      ...prev,
                      nr_ctapes: typeof fn === 'function' ? fn(Array.isArray(prev.nr_ctapes) ? prev.nr_ctapes : []) : fn
                    }))
                  }
                  minWidth={200}
                  maxWidth={400}
                  placeholder="Selecione as contas"
                  hideLabel={true}
                  className="!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-base"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
                <input type="date" name="dt_movim_ini" value={filtros.dt_movim_ini} onChange={handleChange} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
                <input type="date" name="dt_movim_fim" value={filtros.dt_movim_fim} onChange={handleChange} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
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
        {/* Cards de resumo de Débito e Crédito */}
        <div className="flex flex-wrap gap-6 justify-center mb-8">
          {/* Card Débito */}
          <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-[#fe0000]">
            <span className="mr-4"><ArrowCircleDown size={32} color="#fe0000" weight="duotone" /></span>
            <div className="flex flex-col items-start">
              <span className="text-base font-bold text-[#fe0000] mb-1 tracking-wide">DÉBITOS (D)</span>
              <span className="text-2xl font-extrabold text-[#fe0000] mb-1">
                {dados.filter(row => row.tp_operbco === 'D').length}
              </span>
              <span className="text-xs text-gray-500">Quantidade</span>
              <span className="text-xl font-bold text-[#fe0000] mt-2">
                {dados.filter(row => row.tp_operbco === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="text-xs text-gray-500">Soma dos valores</span>
            </div>
          </div>
          {/* Card Crédito */}
          <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-row items-center w-full max-w-xs border-l-8 border-green-600">
            <span className="mr-4"><ArrowCircleUp size={32} color="#16a34a" weight="duotone" /></span>
            <div className="flex flex-col items-start">
              <span className="text-base font-bold text-green-600 mb-1 tracking-wide">CRÉDITOS (C)</span>
              <span className="text-2xl font-extrabold text-green-600 mb-1">
                {dados.filter(row => row.tp_operbco === 'C').length}
              </span>
              <span className="text-xs text-gray-500">Quantidade</span>
              <span className="text-xl font-bold text-green-600 mt-2">
                {dados.filter(row => row.tp_operbco === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="text-xs text-gray-500">Soma dos valores</span>
            </div>
          </div>
        </div>
        {/* Botão de exportação CSV */}
        <div className="flex justify-end mb-2">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 bg-[#000638] hover:bg-[#fe0000] text-white px-6 py-2 rounded-xl transition h-12 text-sm font-semibold shadow-md tracking-wide uppercase"
            disabled={dados.length === 0}
          >
            <ArrowsClockwise size={18} weight="bold" /> Baixar CSV
          </button>
        </div>
        {/* Tabela de dados (dropdown) */}
        <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
            <h2 className="text-xl font-bold text-[#000638]">Extrato Financeiro</h2>
            <span className="flex items-center">
              {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
            </span>
          </div>
          {expandTabela && (
            <div className="overflow-y-auto max-h-[500px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-4 py-2 font-semibold">Conta</th>
                    <th className="px-4 py-2 font-semibold">Data Lançamento</th>
                    <th className="px-4 py-2 font-semibold">Histórico</th>
                    <th className="px-4 py-2 font-semibold">Operação</th>
                    <th className="px-4 py-2 font-semibold">Valor</th>
                    <th className="px-4 py-2 font-semibold">Data Conciliação</th>
                  </tr>
                </thead>
                <tbody className="overflow-y-auto">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-8">Carregando...</td></tr>
                  ) : dados.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                  ) : (
                    dados.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                        <td className={`px-4 py-2 text-center text-xs ${(() => {
                          const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                          return conta ? corConta(conta.nome) : '';
                        })()}`}>{
                          (() => {
                            const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                            return conta ? `${conta.numero} - ${conta.nome}` : row.nr_ctapes;
                          })()
                        }</td>
                        <td className="px-4 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_lancto)}</td>
                        <td className="px-4 py-2 text-[#000000]">{row.ds_histbco}</td>
                        <td className="px-4 py-2 text-center text-[#000000]">{row.tp_operbco}</td>
                        <td className={`px-4 py-2 text-right font-bold ${row.tp_operbco === 'D' ? 'text-[#fe0000]' : row.tp_operbco === 'C' ? 'text-green-600' : ''}`}>{row.vl_lancto?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_conciliacao)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Paginação */}
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
    </Layout>
  );
};

export default ExtratoFinanceiro; 