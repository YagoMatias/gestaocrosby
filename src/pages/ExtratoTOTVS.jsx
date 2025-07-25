import React, { useState } from 'react';
import Layout from '../components/Layout';
import DropdownContas from '../components/DropdownContas';
import { contas } from '../utils/contas';
import { ArrowsClockwise, CaretDown, CaretRight, Receipt, CurrencyDollar, Money, ArrowCircleDown, ArrowCircleUp } from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import ExtratoTotvsTable from '../components/ExtratoTotvsTable';

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
  // Estado para expandir/minimizar tabela
  const [expandTabela, setExpandTabela] = useState(true);

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
      const res = await fetch(`https://apigestaocrosby.onrender.com/extratototvs?${params.toString()}`);
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

  // Cálculos dos cards
  const qtdDebitos = dados.filter(row => row.tp_operacao === 'D').length;
  const valorDebitos = dados.filter(row => row.tp_operacao === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
  const qtdCreditos = dados.filter(row => row.tp_operacao === 'C').length;
  const valorCreditos = dados.filter(row => row.tp_operacao === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0);

  return (
    <Layout>
      <div className="flex min-h-screen">
        <div className="flex-1 flex flex-col">
          <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4 pb-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Extrato TOTVS</h1>
            <div className="mb-8">
              <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-4 md:p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
                <div className="mb-6">
                  <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><Receipt size={22} weight="bold" />Filtros</span>
                  <span className="text-sm text-gray-500 mt-1">Selecione o período, empresa, conta ou data para análise</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 w-full mb-6">
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Empresa</label>
                    <input name="cd_empresa" value={filtros.cd_empresa} onChange={e => setFiltros({ ...filtros, cd_empresa: e.target.value })} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" placeholder="Empresa" />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Contas</label>
                    <div className="w-full">
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
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
                    <input type="date" name="dt_movim_ini" value={filtros.dt_movim_ini} onChange={e => setFiltros({ ...filtros, dt_movim_ini: e.target.value })} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
                    <input type="date" name="dt_movim_fim" value={filtros.dt_movim_fim} onChange={e => setFiltros({ ...filtros, dt_movim_fim: e.target.value })} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
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
            {/* Cards de resumo de Débito e Crédito no novo padrão */}
            <div className="flex flex-col gap-6 mb-8 lg:flex-row lg:gap-8 lg:justify-center">
              <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
                <CardHeader className="pb-0">
                  <div className="flex flex-row items-center gap-2">
                    <ArrowCircleDown size={20} className="text-[#fe0000]" />
                    <CardTitle className="text-base font-bold text-[#fe0000]">Débitos (D)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pl-12">
                  <div className="text-3xl font-extrabold text-[#fe0000] mb-1">{qtdDebitos}</div>
                  <CardDescription className="text-gray-500">Quantidade</CardDescription>
                  <div className="text-xl font-bold text-[#fe0000] mt-2">{valorDebitos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  <CardDescription className="text-gray-500">Soma dos valores</CardDescription>
                </CardContent>
              </Card>
              <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
                <CardHeader className="pb-0">
                  <div className="flex flex-row items-center gap-2">
                    <ArrowCircleUp size={20} className="text-green-600" />
                    <CardTitle className="text-base font-bold text-green-600">Créditos (C)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pl-12">
                  <div className="text-3xl font-extrabold text-green-600 mb-1">{qtdCreditos}</div>
                  <CardDescription className="text-gray-500">Quantidade</CardDescription>
                  <div className="text-xl font-bold text-green-600 mt-2">{valorCreditos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  <CardDescription className="text-gray-500">Soma dos valores</CardDescription>
                </CardContent>
              </Card>
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
            <ExtratoTotvsTable
              dados={dados}
              loading={loading}
              erro={erro}
              expandTabela={expandTabela}
              setExpandTabela={setExpandTabela}
              contas={contas}
              corConta={corConta}
            />
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