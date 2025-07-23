import React, { useState, useRef } from 'react';
import Layout from '../components/Layout';
import DropdownContas from '../components/DropdownContas';
import { contas } from "../utils/contas";
import { ArrowsClockwise, CaretDown, CaretRight, ArrowCircleDown, ArrowCircleUp, Receipt, CheckCircle, XCircle } from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import LoadingCircle from '../components/LoadingCircle';
import ExtratoTotvsTable from '../components/ExtratoTotvsTable';

const PAGE_SIZE = 100000;

const ExtratoFinanceiro = () => {
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosTotvs, setDadosTotvs] = useState([]);
  const [totalTotvs, setTotalTotvs] = useState(0);
  const [loadingTotvs, setLoadingTotvs] = useState(false);
  const [erroTotvs, setErroTotvs] = useState('');
  const [expandTabelaTotvs, setExpandTabelaTotvs] = useState(true);
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
      const res = await fetch(`https://apigestaocrosby.onrender.com/extrato?${params.toString()}`);
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
    // Buscar também dados do TOTVS
    setLoadingTotvs(true);
    setErroTotvs('');
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
      const resTotvs = await fetch(`https://apigestaocrosby.onrender.com/extratototvs?${params.toString()}`);
      if (!resTotvs.ok) throw new Error('Erro ao buscar dados do servidor TOTVS');
      const jsonTotvs = await resTotvs.json();
      setDadosTotvs(jsonTotvs.rows || jsonTotvs || []);
      setTotalTotvs(jsonTotvs.total || (jsonTotvs.length ?? 0));
    } catch (err) {
      setErroTotvs('Erro ao buscar dados do servidor TOTVS.');
      setDadosTotvs([]);
      setTotalTotvs(0);
    } finally {
      setLoadingTotvs(false);
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

  // Cálculos dos cards
  const qtdDebitos = dados.filter(row => row.tp_operbco === 'D').length;
  const valorDebitos = dados.filter(row => row.tp_operbco === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
  const qtdCreditos = dados.filter(row => row.tp_operbco === 'C').length;
  const valorCreditos = dados.filter(row => row.tp_operbco === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);

  // Cards TOTVs
  const qtdDebitosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'D').length;
  const valorDebitosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
  const qtdCreditosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'C').length;
  const valorCreditosTotvs = dadosTotvs.filter(row => row.tp_operacao === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);

  // Novos cards: conciliação
  const qtdConciliadas = dados.filter(row => !!row.dt_conciliacao).length;
  const qtdDesconciliadas = dados.filter(row => !row.dt_conciliacao).length;
  const valorConciliadas = dados.filter(row => !!row.dt_conciliacao).reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
  const valorDesconciliadas = dados.filter(row => !row.dt_conciliacao).reduce((acc, row) => acc + (row.vl_lancto || 0), 0);

  // Verifica contas selecionadas
  const [expandBancos, setExpandBancos] = useState(false);
  const contasSelecionadas = contas.filter(c => filtros.nr_ctapes.includes(c.numero));

  // Calcula data da transação desconciliada mais antiga por banco
  let ultimasDesconciliadas = [];
  if (contasSelecionadas.length > 0) {
    ultimasDesconciliadas = contasSelecionadas.map(conta => {
      const transacoesDesconciliadas = dados.filter(row => String(row.nr_ctapes) === conta.numero && !row.dt_conciliacao);
      let dataMaisAntiga = null;
      if (transacoesDesconciliadas.length > 0) {
        dataMaisAntiga = transacoesDesconciliadas.reduce((min, row) => {
          const data = new Date(row.dt_lancto);
          return (!min || data < new Date(min)) ? row.dt_lancto : min;
        }, null);
      }
      return {
        numero: conta.numero,
        nome: conta.nome,
        maisAntigaDesconciliada: dataMaisAntiga
      };
    });
  }

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Extrato Financeiro</h1>
        <div className="mb-4">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período, empresa, conta ou data para análise</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-2 w-full mb-4">
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
            <div className="flex justify-end w-full mt-1">
              <button type="submit" className="flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px]">
                <ArrowsClockwise size={18} weight="bold" /> Filtrar
              </button>
            </div>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>
        {/* Cards de bancos: última transação desconciliada em dropdown */}
        {contasSelecionadas.length > 0 && (
           <div className="rounded-2xl shadow-lg bg-white mb-4 border border-[#000638]/10 max-w-5xl mx-auto">
             <div className="p-3 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandBancos(e => !e)}>
               <span className="text-base font-bold text-[#000638]">Transação desconciliada mais antiga por banco</span>
               <span className="flex items-center">
                 {expandBancos ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
               </span>
             </div>
             {expandBancos && (
               <div className="flex flex-row gap-2 p-3 flex-wrap justify-center items-stretch">
                 {ultimasDesconciliadas.map(banco => (
                   <Card key={banco.numero} className="min-w-[140px] max-w-[180px] shadow-md rounded-lg bg-white cursor-pointer p-1 border border-gray-200">
                     <CardHeader className="pb-0 px-1 pt-1">
                       <div className="flex flex-row items-center gap-1">
                         <CardTitle className="text-xs font-bold text-blue-900 truncate">{banco.nome}</CardTitle>
                       </div>
                     </CardHeader>
                     <CardContent className="pt-1 pl-2">
                       <div className="text-[10px] text-gray-500">Data mais antiga desconciliada</div>
                       <div className="text-xs font-bold text-gray-700 mt-0.5">
                         {loading ? <LoadingCircle size={18} /> : (
                           banco.maisAntigaDesconciliada
                             ? <span className="text-[#fe0000] font-bold">{new Date(banco.maisAntigaDesconciliada).toLocaleDateString('pt-BR')}</span>
                             : <span className="text-green-600 font-bold">Conciliações realizadas no período</span>
                         )}
                       </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
           </div>
         )}
        {/* Cards em linha, ainda menores */}
        <div className="flex flex-row gap-2 mb-8 max-w-full justify-center items-stretch flex-wrap">
          {/* Card Débitos Financeiro */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleDown size={15} className="text-[#fe0000]" />
                <CardTitle className="text-xs font-bold text-[#fe0000]">Déb. Fin. (D)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">{qtdDebitos}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">{valorDebitos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
            </CardContent>
          </Card>
          {/* Card Créditos Financeiro */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleUp size={15} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-600">Créd. Fin. (C)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">{qtdCreditos}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">{valorCreditos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
            </CardContent>
          </Card>
          {/* Card Conciliadas */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <CheckCircle size={15} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-600">Conciliadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">{qtdConciliadas}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">{valorConciliadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
            </CardContent>
          </Card>
          {/* Card Desconciliadas */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <XCircle size={15} className="text-[#fe0000]" />
                <CardTitle className="text-xs font-bold text-[#fe0000]">Desconciliadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">{qtdDesconciliadas}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">{valorDesconciliadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
            </CardContent>
          </Card>
          {/* Card Débitos TOTVs */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-blue-100 cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleDown size={15} className="text-[#fe0000]" />
                <CardTitle className="text-xs font-bold text-[#fe0000]">Déb. TOTVs (D)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">{qtdDebitosTotvs}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">{valorDebitosTotvs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
            </CardContent>
          </Card>
          {/* Card Créditos TOTVs */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-blue-100 cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleUp size={15} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-600">Créd. TOTVs (C)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">{qtdCreditosTotvs}</div>
              <CardDescription className="text-[10px] text-gray-500">Qtd</CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">{valorCreditosTotvs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <CardDescription className="text-[10px] text-gray-500">Soma</CardDescription>
            </CardContent>
          </Card>
        </div>
        {/* Botão de exportação CSV */}
        <div className="flex justify-end mb-2">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px]"
            disabled={dados.length === 0}
          >
            <ArrowsClockwise size={18} weight="bold" /> Baixar CSV
          </button>
        </div>
        {/* Tabela de dados (dropdown) */}
        <div className="rounded-2xl shadow-lg bg-white mt-2 border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
            <h2 className="text-xl font-bold text-[#000638]">Extrato Financeiro</h2>
            <span className="flex items-center">
              {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
            </span>
          </div>
          {expandTabela && (
            <div className="overflow-y-auto max-h-[500px]">
              {loading ? (
                <div className="flex justify-center items-center py-8"><LoadingCircle size={32} /></div>
              ) : (
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
                    {dados.length === 0 ? (
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
              )}
            </div>
          )}
        </div>
        {/* Tabela Extrato TOTVS */}
        <ExtratoTotvsTable
          dados={dadosTotvs}
          loading={loadingTotvs}
          erro={erroTotvs}
          expandTabela={expandTabelaTotvs}
          setExpandTabela={setExpandTabelaTotvs}
          contas={contas}
          corConta={corConta}
        />
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