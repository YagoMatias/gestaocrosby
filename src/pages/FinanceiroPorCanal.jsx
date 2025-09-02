import React, { memo, useCallback, useMemo, useState } from 'react';
import SEOHead from '../components/ui/SEOHead';
import FiltroEmpresa from '../components/FiltroEmpresa';
import LoadingSpinner from '../components/LoadingSpinner';
import { CurrencyDollar, ArrowsClockwise } from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

const FinanceiroPorCanal = memo(() => {
  const api = useApiClient();

  // Filtros
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d) => d.toISOString().split('T')[0];
  const [dtInicio, setDtInicio] = useState(fmt(firstDay));
  const [dtFim, setDtFim] = useState(fmt(today));
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Dados dos canais
  const [dadosVarejo, setDadosVarejo] = useState([]);
  const [dadosFranquia, setDadosFranquia] = useState([]);
  const [dadosMultimarcas, setDadosMultimarcas] = useState([]);
  const [dadosRevenda, setDadosRevenda] = useState([]);

  const calcularVendasAposDesconto = useCallback((rows) => {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((acc, row) => {
      const qt = Number(row.qt_faturado) || 1;
      const liq = (Number(row.vl_unitliquido) || 0) * qt;
      if (row.tp_operacao === 'S') return acc + liq;
      if (row.tp_operacao === 'E') return acc - liq;
      return acc;
    }, 0);
  }, []);

  const totais = useMemo(() => ({
    varejo: calcularVendasAposDesconto(dadosVarejo),
    franquia: calcularVendasAposDesconto(dadosFranquia),
    multimarcas: calcularVendasAposDesconto(dadosMultimarcas),
    revenda: calcularVendasAposDesconto(dadosRevenda)
  }), [dadosVarejo, dadosFranquia, dadosMultimarcas, dadosRevenda, calcularVendasAposDesconto]);

  const pieData = useMemo(() => ([
    { name: 'Varejo', value: Math.max(0, totais.varejo) },
    { name: 'Franquias', value: Math.max(0, totais.franquia) },
    { name: 'Multimarcas', value: Math.max(0, totais.multimarcas) },
    { name: 'Revenda', value: Math.max(0, totais.revenda) },
  ]), [totais]);

  const PIE_COLORS = ['#16a34a', '#1d4ed8', '#7e22ce', '#ea580c'];
  const formatBRL = useCallback((v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  const handleBuscar = useCallback(async (e) => {
    e?.preventDefault?.();
    setErro('');
    if (!dtInicio || !dtFim) {
      setErro('Selecione o período.');
      return;
    }
    const empresas = (empresasSelecionadas || [])
      .filter(emp => emp.cd_empresa)
      .map(emp => emp.cd_empresa);
    if (empresas.length === 0) {
      setErro('Selecione pelo menos uma empresa.');
      return;
    }
    setLoading(true);
    try {
      const paramsBase = { dt_inicio: dtInicio, dt_fim: dtFim, cd_empresa: empresas };
      const [resVarejo, resFranquia, resMtm, resRev] = await Promise.all([
        api.sales.faturamento(paramsBase),
        api.sales.faturamentoFranquia(paramsBase),
        api.sales.faturamentoMtm(paramsBase),
        api.sales.faturamentoRevenda(paramsBase)
      ]);
      setDadosVarejo(resVarejo?.data || []);
      setDadosFranquia(resFranquia?.data || []);
      setDadosMultimarcas(resMtm?.data || []);
      setDadosRevenda(resRev?.data || []);
    } catch (err) {
      console.error('Erro ao buscar dados por canal:', err);
      setErro('Erro ao buscar dados. Tente novamente.');
      setDadosVarejo([]);
      setDadosFranquia([]);
      setDadosMultimarcas([]);
      setDadosRevenda([]);
    } finally {
      setLoading(false);
    }
  }, [api, dtInicio, dtFim, empresasSelecionadas]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <SEOHead title="Financeiro por Canal" description="Dashboard Financeiro por Canal" />
      <h1 className="text-2xl font-bold text-[#000638] mb-4">Financeiro por Canal</h1>

      {/* Filtros */}
      <form onSubmit={handleBuscar} className="bg-white p-6 rounded-2xl shadow-lg border border-[#000638]/10 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <CurrencyDollar size={20} className="text-[#000638]" />
          <span className="text-lg font-bold text-[#000638]">Filtros</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-3">
            <FiltroEmpresa
              empresasSelecionadas={empresasSelecionadas}
              onSelectEmpresas={setEmpresasSelecionadas}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
            <input type="date" value={dtInicio} onChange={e => setDtInicio(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
            <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading || (empresasSelecionadas ?? []).length === 0}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${
                loading || (empresasSelecionadas ?? []).length === 0
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-[#000638] hover:bg-[#fe0000] text-white'
              }`}>
              {loading ? <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Carregando...</> : <><ArrowsClockwise size={18} /> Buscar</>}
            </button>
          </div>
        </div>
        {erro && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center text-sm">{erro}</div>
        )}
      </form>

      {/* Seção: Venda após Desconto */}
      <div className="mb-3">
        <h2 className="text-sm font-bold tracking-wide text-gray-700">VENDA APÓS DESCONTO</h2>
      </div>

      {/* Layout 2 colunas: cards (esquerda) e gráfico (direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Cards (coluna esquerda) */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">Varejo (R$)</div>
            <div className="text-2xl font-extrabold text-green-700 mt-2">{totais.varejo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">Franquias (R$)</div>
            <div className="text-2xl font-extrabold text-blue-700 mt-2">{totais.franquia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">Multimarcas (R$)</div>
            <div className="text-2xl font-extrabold text-purple-700 mt-2">{totais.multimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">Revenda (R$)</div>
            <div className="text-2xl font-extrabold text-orange-700 mt-2">{totais.revenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        </div>

        {/* Gráfico Pizza por Canal (coluna direita) */}
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-md">
          <div className="text-sm font-semibold text-gray-700 mb-2">Distribuição por Canal (Vendas após Desconto)</div>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} 
                  label={({ value }) => formatBRL(value)}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend formatter={(value, entry) => `${value} ${formatBRL(entry?.payload?.value)}`} />
                <RechartsTooltip formatter={(v) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Indicador de loading geral */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" text="Carregando canais..." />
        </div>
      )}
    </div>
  );
});

FinanceiroPorCanal.displayName = 'FinanceiroPorCanal';

export default FinanceiroPorCanal;

