import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import DropdownContas from '../components/DropdownContas';
import { contas } from "../utils/contas";
import { 
  ArrowsClockwise, 
  CaretDown, 
  CaretRight, 
  ArrowCircleDown, 
  ArrowCircleUp, 
  Receipt, 
  CheckCircle, 
  XCircle, 
  Question,
  CaretUp,
  CaretUpDown,
  Download,
  Spinner
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import LoadingCircle from '../components/LoadingCircle';
import useApiClient from '../hooks/useApiClient';
import ExtratoTotvsTable from '../components/ExtratoTotvsTable';
import { useApi } from '../hooks/useApi';
import ErrorBoundary from '../components/ui/ErrorBoundary';

const PAGE_SIZE = 20; // Paginação client-side com 20 itens por página

const SaldoBancarioTotvs = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dadosTotvs, setDadosTotvs] = useState([]);
  const [totalTotvs, setTotalTotvs] = useState(0);
  const [loadingTotvs, setLoadingTotvs] = useState(false);
  const [erroTotvs, setErroTotvs] = useState('');
  const [expandTabelaTotvs, setExpandTabelaTotvs] = useState(true);
  const [filtros, setFiltros] = useState({
    nr_ctapes: [], // agora é array
    dt_movim_ini: '2024-01-01',
    dt_movim_fim: '',
  });
  const [expandTabela, setExpandTabela] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', description: '', calculation: '' });

  // Estados para paginação client-side
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageTotvs, setCurrentPageTotvs] = useState(1);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });
  
  // Estados para seleção de linhas
  const [linhasSelecionadas, setLinhasSelecionadas] = useState(new Set());
  

  // CSS customizado para a tabela
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .table-container { overflow-x: auto; position: relative; max-width: 100%; }
      .extrato-table { border-collapse: collapse; width: 100%; }
      .extrato-table th, .extrato-table td { padding: 6px 8px !important; border-right: 1px solid #f3f4f6; word-wrap: break-word; white-space: normal; font-size: 11px; line-height: 1.3; }
      .extrato-table th:last-child, .extrato-table td:last-child { border-right: none; }
      .extrato-table th { background-color: #000638; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
      .extrato-table tbody tr:nth-child(odd) { background-color: white; }
      .extrato-table tbody tr:nth-child(even) { background-color: #fafafa; }
      .extrato-table tbody tr:hover { background-color: #f0f9ff; transition: background-color 0.2s ease; }
      .extrato-table thead th:first-child, .extrato-table tbody td:first-child { position: sticky !important; left: 0 !important; z-index: 10 !important; border-right: 2px solid #e5e7eb !important; box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important; }
      .extrato-table thead th:first-child { background: #000638 !important; z-index: 20 !important; border-right: 2px solid #374151 !important; }
      .extrato-table tbody tr:nth-child(even) td:first-child { background: #fafafa !important; }
      .extrato-table tbody tr:nth-child(odd) td:first-child { background: #ffffff !important; }
      .extrato-table tbody tr:hover td:first-child { background: #f0f9ff !important; }
      .extrato-table tbody tr.bg-blue-100 td:first-child { background: #dbeafe !important; }
      .extrato-table tbody tr.bg-blue-100:hover td:first-child { background: #bfdbfe !important; }
      .extrato-table th:first-child input[type="checkbox"], .extrato-table td:first-child input[type="checkbox"] { transform: scale(1.1); }
    `;
    document.head.appendChild(styleElement);
    return () => { document.head.removeChild(styleElement); };
  }, []);

  // Função para ordenação
  const handleSort = useCallback((campo) => {
    setOrdenacao(prev => ({ campo, direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc' }));
  }, []);

  const getSortIcon = useCallback((campo) => {
    if (ordenacao.campo !== campo) return <CaretUpDown size={12} className="opacity-50" />;
    return ordenacao.direcao === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />;
  }, [ordenacao]);

  const toggleLinhaSelecionada = useCallback((index) => {
    setLinhasSelecionadas(prev => { const nova = new Set(prev); nova.has(index) ? nova.delete(index) : nova.add(index); return nova; });
  }, []);

  const dadosProcessados = useMemo(() => {
    let dadosFiltrados = [...dados];
    if (ordenacao.campo) {
      dadosFiltrados.sort((a, b) => {
        let valorA = a[ordenacao.campo];
        let valorB = b[ordenacao.campo];
        if (ordenacao.campo.includes('dt_')) { valorA = valorA ? new Date(valorA) : new Date(0); valorB = valorB ? new Date(valorB) : new Date(0); }
        if (ordenacao.campo === 'vl_lancto') { valorA = parseFloat(valorA) || 0; valorB = parseFloat(valorB) || 0; }
        if (typeof valorA === 'string') { valorA = valorA.toLowerCase(); valorB = valorB.toLowerCase(); }
        if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return dadosFiltrados;
  }, [dados, ordenacao]);

  const dadosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return dadosProcessados.slice(startIndex, endIndex);
  }, [dadosProcessados, currentPage]);

  const totalPages = Math.ceil(dadosProcessados.length / PAGE_SIZE);

  useEffect(() => { setLinhasSelecionadas(new Set()); }, [dados]);
  useEffect(() => { setCurrentPage(1); }, [dados]);
  useEffect(() => { setCurrentPageTotvs(1); }, [dadosTotvs]);

  const fetchDados = async (filtrosParam = filtros) => {
    setLoading(true);
    setErro('');
    try {
      const contasUsadas = (Array.isArray(filtrosParam.nr_ctapes) && filtrosParam.nr_ctapes.length > 0)
        ? filtrosParam.nr_ctapes
        : contas.map(c => c.numero);
      const params = { nr_ctapes: contasUsadas, dt_movim_ini: filtrosParam.dt_movim_ini, dt_movim_fim: filtrosParam.dt_movim_fim, limit: 1000000, offset: 0 };
      const result = await apiClient.financial.extrato(params);
      if (result.success) { setDados(result.data || []); setTotal(result.total || 0); } else { throw new Error(result.message || 'Erro ao buscar dados'); }
    } catch (err) { console.error('Erro ao buscar extrato:', err); setErro('Erro ao buscar dados do servidor.'); setDados([]); setTotal(0); } 
    finally { setLoading(false); setDadosCarregados(true); }

    setLoadingTotvs(true); setErroTotvs('');
    try {
      const contasUsadasTotvs = (Array.isArray(filtrosParam.nr_ctapes) && filtrosParam.nr_ctapes.length > 0)
        ? filtrosParam.nr_ctapes
        : contas.map(c => c.numero);
      const params = { nr_ctapes: contasUsadasTotvs, dt_movim_ini: filtrosParam.dt_movim_ini, dt_movim_fim: filtrosParam.dt_movim_fim, limit: 1000000, offset: 0 };
      const resultTotvs = await apiClient.financial.extratoTotvs(params);
      if (resultTotvs.success) { setDadosTotvs(resultTotvs.data || []); setTotalTotvs(resultTotvs.total || 0); } else { throw new Error(resultTotvs.message || 'Erro ao buscar dados TOTVS'); }
    } catch (err) { console.error('Erro ao buscar extrato TOTVS:', err); setErroTotvs('Erro ao buscar dados do servidor TOTVS.'); setDadosTotvs([]); setTotalTotvs(0); } 
    finally { setLoadingTotvs(false); }
  };

  const handleChange = (e) => { setFiltros({ ...filtros, [e.target.name]: e.target.value }); };
  const handleFiltrar = (e) => { e.preventDefault(); setCurrentPage(1); fetchDados({ ...filtros, [e.target.name]: e.target.value }); };

  function formatarDataBR(data) { if (!data) return '-'; const d = new Date(data); if (isNaN(d)) return '-'; return d.toLocaleDateString('pt-BR'); }
  function corConta(nome) { if (!nome) return ''; if (nome.includes('CROSBY')) return 'text-blue-500'; if (nome.includes('FABIO')) return 'text-yellow-600'; if (nome.includes('IRMÃOS CR')) return 'text-orange-500'; if (nome.includes('FLAVIO')) return 'text-green-500'; return ''; }

  const contasSelecionadas = contas.filter(c => filtros.nr_ctapes.includes(c.numero));

  // Cálculo do saldo por conta (igual ao Extrato Financeiro)
  const saldoPorConta = useMemo(() => {
    const saldo = {};
    // Financeiro
    dadosProcessados.forEach(row => {
      const contaNumero = String(row.nr_ctapes);
      if (!saldo[contaNumero]) {
        saldo[contaNumero] = {
          numero: contaNumero,
          nome: contas.find(c => c.numero === contaNumero)?.nome || contaNumero,
          creditos: 0,
          debitos: 0,
          saldo: 0,
          creditosTotvs: 0,
          debitosTotvs: 0,
          saldoExtrato: 0
        };
      }
      if (row.tp_operbco === 'C') saldo[contaNumero].creditos += parseFloat(row.vl_lancto) || 0;
      else if (row.tp_operbco === 'D') saldo[contaNumero].debitos += parseFloat(row.vl_lancto) || 0;
      saldo[contaNumero].saldo = saldo[contaNumero].creditos - saldo[contaNumero].debitos;
    });
    // TOTVS
    dadosTotvs.forEach(row => {
      const contaNumero = String(row.nr_ctapes);
      if (!saldo[contaNumero]) {
        saldo[contaNumero] = {
          numero: contaNumero,
          nome: contas.find(c => c.numero === contaNumero)?.nome || contaNumero,
          creditos: 0,
          debitos: 0,
          saldo: 0,
          creditosTotvs: 0,
          debitosTotvs: 0,
          saldoExtrato: 0
        };
      }
      if (row.tp_operacao === 'C') saldo[contaNumero].creditosTotvs += parseFloat(row.vl_lancto) || 0;
      else if (row.tp_operacao === 'D') saldo[contaNumero].debitosTotvs += parseFloat(row.vl_lancto) || 0;
      saldo[contaNumero].saldoExtrato = saldo[contaNumero].creditosTotvs - saldo[contaNumero].debitosTotvs;
    });
    // Garantir que todas as contas apareçam mesmo sem dados
    contas.forEach(c => {
      const numero = String(c.numero);
      if (!saldo[numero]) {
        saldo[numero] = {
          numero,
          nome: c.nome,
          creditos: 0,
          debitos: 0,
          saldo: 0,
          creditosTotvs: 0,
          debitosTotvs: 0,
          saldoExtrato: 0
        };
      }
    });
    return Object.values(saldo).sort((a, b) => a.numero.localeCompare(b.numero));
  }, [dadosProcessados, dadosTotvs, contas]);

  // Ordenação A-Z para a tabela de saldo por conta
  const [ordenacaoSaldo, setOrdenacaoSaldo] = useState({ campo: 'nome', direcao: 'asc' });
  const handleSortSaldo = useCallback((campo) => {
    setOrdenacaoSaldo(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  const getSortIconSaldo = useCallback((campo) => {
    if (ordenacaoSaldo.campo !== campo) return <CaretUpDown size={12} className="opacity-50 inline-block ml-1" />;
    return ordenacaoSaldo.direcao === 'asc' ? <CaretUp size={12} className="inline-block ml-1" /> : <CaretDown size={12} className="inline-block ml-1" />;
  }, [ordenacaoSaldo]);
  const saldoOrdenado = useMemo(() => {
    const arr = [...saldoPorConta];
    arr.sort((a, b) => {
      let aVal = a[ordenacaoSaldo.campo];
      let bVal = b[ordenacaoSaldo.campo];
      // Numeros
      if (['creditos','debitos','saldo','saldoExtrato'].includes(ordenacaoSaldo.campo)) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (ordenacaoSaldo.direcao === 'asc') return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    });
    return arr;
  }, [saldoPorConta, ordenacaoSaldo]);

  // Filtro por banco (includes no nome da conta)
  const [filtroBanco, setFiltroBanco] = useState('TODOS');
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS');
  const saldoFiltrado = useMemo(() => {
    if (!filtroBanco || filtroBanco === 'TODOS') return saldoOrdenado;
    const termo = filtroBanco.toUpperCase();
    return saldoOrdenado.filter(c => {
      const nome = (c.nome || '').toUpperCase();
      switch (termo) {
        case 'CAIXA':
          return nome.includes('CAIXA');
        case 'BB':
          return nome.includes('BB') || nome.includes('BRASIL') || nome.includes('BANCO DO BRASIL');
        case 'SICREDI':
          return nome.includes('SICREDI');
        case 'SANT':
          return nome.includes('SANTANDER') || nome.includes('SANT');
        case 'BNB':
          return nome.includes('BNB') || nome.includes('BANCO DO NORDESTE');
        case 'BRADESCO':
          return nome.includes('BRADESCO');
        case 'ITAU':
          return nome.includes('ITAU') || nome.includes('ITAÚ');
        case 'UNICRED':
          return nome.includes('UNICRED');
        default:
          return nome.includes(termo);
      }
    });
  }, [saldoOrdenado, filtroBanco]);

  // Aplicar filtro por Grupo sobre o resultado do filtro por Banco
  const saldoFiltradoGrupo = useMemo(() => {
    if (!filtroGrupo || filtroGrupo === 'TODOS') return saldoFiltrado;
    const g = filtroGrupo.toUpperCase();
    return saldoFiltrado.filter(c => {
      const nome = (c.nome || '').toUpperCase();
      if (g === 'FABIO') return nome.includes('FABIO');
      if (g === 'CROSBY') return nome.includes('CROSBY');
      if (g === 'IRMAOS CR' || g === 'IRMÃOS CR') return nome.includes('IRMAOS CR') || nome.includes('IRMÃOS CR');
      if (g === 'FLAVIO') return nome.includes('FLAVIO');
      return true;
    });
  }, [saldoFiltrado, filtroGrupo]);

  return (
    <ErrorBoundary 
      message="Erro ao carregar a página de Saldo Bancário TOTVS"
      onError={(error, errorInfo) => { console.error('SaldoBancarioTotvs Error:', error, errorInfo); }}
    >
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Saldo Bancário TOTVS</h1>
        <div className="mb-4">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período e as contas para análise</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2 w-full mb-4">
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Contas</label>
                <DropdownContas contas={contas} contasSelecionadas={Array.isArray(filtros.nr_ctapes) ? filtros.nr_ctapes : []} setContasSelecionadas={fn => setFiltros(prev => ({ ...prev, nr_ctapes: typeof fn === 'function' ? fn(Array.isArray(prev.nr_ctapes) ? prev.nr_ctapes : []) : fn }))} minWidth={200} maxWidth={400} placeholder="Selecione as contas" hideLabel={true} className="!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-base" />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
                <input type="date" name="dt_movim_ini" value={filtros.dt_movim_ini} readOnly disabled className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full bg-gray-100 text-[#000638] cursor-not-allowed" />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
                <input type="date" name="dt_movim_fim" value={filtros.dt_movim_fim} onChange={handleChange} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
              </div>
            </div>
            <div className="flex justify-end w-full mt-1">
              <button type="submit" className="flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
                {loading ? (<Spinner size={18} className="animate-spin" />) : (<ArrowsClockwise size={18} weight="bold" />)}
                {loading ? 'Carregando...' : 'Filtrar'}
              </button>
            </div>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>

        {/* Tabela de Saldo por Conta (sempre visível; valores atualizam ao filtrar) */}
        <div className="rounded-2xl shadow-lg bg-white border border-[#000638]/10 mb-6">
            <div className="p-4 border-b border-[#000638]/10">
              <h2 className="text-xl font-bold text-[#000638]">Saldo por Conta</h2>
              <p className="text-sm text-gray-500 mt-1">Resumo financeiro por conta (Créditos - Débitos) e Saldo do Extrato TOTVS</p>
            </div>
            {/* Filtro por Banco (includes no nome da conta) */}
            <div className="px-4 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-[#000638]">Filtrar por Banco</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {['TODOS','CAIXA','BB','SICREDI','SANT','BNB','BRADESCO','ITAU','UNICRED'].map(b => (
                  <button
                    key={b}
                    onClick={() => setFiltroBanco(b)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filtroBanco === b ? 'bg-[#000638] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              {/* Filtro por Grupo */}
              <div className="flex items-center gap-2 mt-3 mb-2">
                <span className="text-xs font-semibold text-[#000638]">Filtrar por Grupo</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {['TODOS','FABIO','CROSBY','IRMAOS CR','FLAVIO'].map(g => (
                  <button
                    key={g}
                    onClick={() => setFiltroGrupo(g)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filtroGrupo === g ? 'bg-[#000638] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#000638] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold cursor-pointer" onClick={() => handleSortSaldo('nome')}>
                      <span className="inline-flex items-center">Conta {getSortIconSaldo('nome')}</span>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold cursor-pointer" onClick={() => handleSortSaldo('creditos')}>
                      <span className="inline-flex items-center">Créditos {getSortIconSaldo('creditos')}</span>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold cursor-pointer" onClick={() => handleSortSaldo('debitos')}>
                      <span className="inline-flex items-center">Débitos {getSortIconSaldo('debitos')}</span>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold cursor-pointer" onClick={() => handleSortSaldo('saldo')}>
                      <span className="inline-flex items-center">Saldo {getSortIconSaldo('saldo')}</span>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold cursor-pointer" onClick={() => handleSortSaldo('saldoExtrato')}>
                      <span className="inline-flex items-center">Saldo Extrato {getSortIconSaldo('saldoExtrato')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {saldoFiltradoGrupo.map((conta, index) => (
                    <tr key={conta.numero} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}>
                      <td className="px-4 py-3"><div className={`font-medium ${corConta(conta.nome)}`}>{conta.numero} - {conta.nome}</div></td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">{conta.creditos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{conta.debitos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className={`px-4 py-3 text-right font-bold ${conta.saldo > 0 ? 'text-green-600' : conta.saldo < 0 ? 'text-red-600' : 'text-gray-600'}`}>{conta.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className={`px-4 py-3 text-right font-bold ${conta.saldoExtrato > 0 ? 'text-green-600' : conta.saldoExtrato < 0 ? 'text-red-600' : 'text-gray-600'}`}>{conta.saldoExtrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-[#000638]">
                  <tr>
                    <td className="px-4 py-3 font-bold text-[#000638]">TOTAL</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{saldoFiltradoGrupo.reduce((acc, c) => acc + c.creditos, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{saldoFiltradoGrupo.reduce((acc, c) => acc + c.debitos, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className={`px-4 py-3 text-right font-bold ${saldoFiltradoGrupo.reduce((acc, c) => acc + c.saldo, 0) > 0 ? 'text-green-600' : saldoFiltradoGrupo.reduce((acc, c) => acc + c.saldo, 0) < 0 ? 'text-red-600' : 'text-gray-600'}`}>{saldoFiltradoGrupo.reduce((acc, c) => acc + c.saldo, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className={`px-4 py-3 text-right font-bold ${saldoFiltradoGrupo.reduce((acc, c) => acc + c.saldoExtrato, 0) > 0 ? 'text-green-600' : saldoFiltradoGrupo.reduce((acc, c) => acc + c.saldoExtrato, 0) < 0 ? 'text-red-600' : 'text-gray-600'}`}>{saldoFiltradoGrupo.reduce((acc, c) => acc + c.saldoExtrato, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        {/* Tabela TOTVS já existente abaixo (mantida) */}
      </div>
    </ErrorBoundary>
  );
};

export default SaldoBancarioTotvs;


