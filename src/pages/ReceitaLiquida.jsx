import React, { useEffect, useMemo, useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { Funnel, Calendar, Spinner, CurrencyDollar, Percent, TrendUp, Truck } from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import custoProdutos from '../custoprodutos.json';

const ReceitaLiquida = () => {
  const apiClient = useApiClient();
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);

  // Dados por segmento
  const [dadosRevenda, setDadosRevenda] = useState([]);
  const [dadosVarejo, setDadosVarejo] = useState([]);
  const [dadosFranquia, setDadosFranquia] = useState([]);
  const [dadosMultimarcas, setDadosMultimarcas] = useState([]);

  // Totais por segmento
  const [fatRevenda, setFatRevenda] = useState(0);
  const [fatVarejo, setFatVarejo] = useState(0);
  const [fatFranquia, setFatFranquia] = useState(0);
  const [fatMultimarcas, setFatMultimarcas] = useState(0);

  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(ultimoDia.toISOString().split('T')[0]);
    
    // Empresas pré-selecionadas (usuário pode alterar)
    setEmpresasSelecionadas(['1','2', '200', '75', '31', '6', '85', '11','99','92']);
  }, []);

  const handleFiltrar = async (e) => {
    e.preventDefault();
    if (!dataInicio || !dataFim || !empresasSelecionadas.length) return;
    setLoading(true);
    try {
      // Buscas detalhadas em paralelo usando empresas selecionadas pelo usuário
      const [rRevenda, rVarejo, rFranquia, rMtm] = await Promise.all([
        apiClient.sales.faturamentoRevenda({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresasSelecionadas }),
        apiClient.sales.faturamento({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresasSelecionadas }),
        apiClient.sales.faturamentoFranquia({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresasSelecionadas }),
        apiClient.sales.faturamentoMtm({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresasSelecionadas })
      ]);

      // Revenda: filtrar classificações 1 e 3, evitando duplicidade entre 1 e 3 por pessoa
      if (rRevenda.success) {
        const filtrados = rRevenda.data.filter(row => {
          const cls = String(row.cd_classificacao ?? '').trim();
          return cls === '1' || cls === '3';
        }).filter((row, index, array) => {
          const currentPessoa = row.cd_pessoa;
          const currentClass = String(row.cd_classificacao ?? '').trim();
          if (currentClass === '3') return true;
          if (currentClass === '1') {
            const hasClass3 = array.some(item => item.cd_pessoa === currentPessoa && String(item.cd_classificacao ?? '').trim() === '3');
            return !hasClass3;
          }
          return false;
        });
        const saidas = filtrados.filter(r => r.tp_operacao === 'S').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const entradas = filtrados.filter(r => r.tp_operacao === 'E').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        setFatRevenda(saidas - entradas);
        setDadosRevenda(filtrados);
      } else { setFatRevenda(0); setDadosRevenda([]); }

      // Varejo (lojas)
      if (rVarejo.success) {
        const saidas = rVarejo.data.filter(r => r.tp_operacao === 'S').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const entradas = rVarejo.data.filter(r => r.tp_operacao === 'E').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        setFatVarejo(saidas - entradas);
        setDadosVarejo(rVarejo.data);
      } else { setFatVarejo(0); setDadosVarejo([]); }

      // Franquia
      if (rFranquia.success) {
        const saidas = rFranquia.data.filter(r => r.tp_operacao === 'S').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const entradas = rFranquia.data.filter(r => r.tp_operacao === 'E').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        setFatFranquia(saidas - entradas);
        setDadosFranquia(rFranquia.data);
      } else { setFatFranquia(0); setDadosFranquia([]); }

      // MTM
      if (rMtm.success) {
        const saidas = rMtm.data.filter(r => r.tp_operacao === 'S').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const entradas = rMtm.data.filter(r => r.tp_operacao === 'E').reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        setFatMultimarcas(saidas - entradas);
        setDadosMultimarcas(rMtm.data);
      } else { setFatMultimarcas(0); setDadosMultimarcas([]); }

      setDadosCarregados(true);
    } catch (e) {
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  // Helpers de custo e agregados (baseados no Consolidado)
  const custoMap = useMemo(() => {
    const map = {};
    (custoProdutos || []).forEach(item => {
      if (item?.Codigo && item?.Custo !== undefined) map[item.Codigo.trim()] = item.Custo;
    });
    return map;
  }, []);

  const calcCusto = (dados, compensaEntrada = false) => (dados || [])
    .reduce((acc, r) => {
      const q = Number(r.qt_faturado) || 1;
      const c = custoMap[r.cd_nivel?.trim()];
      if (r.tp_operacao === 'S') return acc + (c !== undefined ? q * c : 0);
      if (compensaEntrada && r.tp_operacao === 'E') return acc - (c !== undefined ? q * c : 0);
      return acc;
    }, 0);

  const somaBrutoSaida = (dados, compensaEntrada = false) => {
    let total = 0;
    (dados || []).forEach(row => {
      const q = Number(row.qt_faturado) || 1;
      const bruto = (Number(row.vl_unitbruto) || 0) * q;
      if (row.tp_operacao === 'S') total += bruto;
      if (compensaEntrada && row.tp_operacao === 'E') total -= bruto;
    });
    return total;
  };
  const somaFrete = (dados, compensaEntrada = true) => {
    let total = 0;
    (dados || []).forEach(row => {
      const frete = Number(row.vl_freterat) || 0;
      if (row.tp_operacao === 'S') total += frete;
      if (compensaEntrada && row.tp_operacao === 'E') total -= frete;
    });
    return total;
  };
  // Função removida - ICMS não está mais disponível nas rotas
  const somaEntradas = (dados) => {
    let total = 0;
    (dados || []).forEach(row => {
      if (row.tp_operacao === 'E') {
        const q = Number(row.qt_faturado) || 1;
        const valor = (Number(row.vl_unitliquido) || 0) * q;
        total += valor;
      }
    });
    return total;
  };

  // Agregados para os cards
  const agregados = useMemo(() => {
    const custoBrutoRevenda = calcCusto(dadosRevenda, true);
    const custoBrutoVarejo = calcCusto(dadosVarejo);
    const custoBrutoFranquia = calcCusto(dadosFranquia, true);
    const custoBrutoMultimarcas = calcCusto(dadosMultimarcas, true);
    const custoTotalBruto = custoBrutoRevenda + custoBrutoVarejo + custoBrutoFranquia + custoBrutoMultimarcas;

    const precoTabelaRevenda = somaBrutoSaida(dadosRevenda, true);
    const precoTabelaVarejo = somaBrutoSaida(dadosVarejo, true);
    const precoTabelaFranquia = somaBrutoSaida(dadosFranquia, true);
    const precoTabelaMultimarcas = somaBrutoSaida(dadosMultimarcas, true);
    const precoTabelaTotal = precoTabelaRevenda + precoTabelaVarejo + precoTabelaFranquia + precoTabelaMultimarcas;

    const faturamentoTotal = fatRevenda + fatVarejo + fatFranquia + fatMultimarcas;
    const descontoTotal = precoTabelaTotal - faturamentoTotal;

    const freteTotal = somaFrete(dadosRevenda, true) + somaFrete(dadosVarejo, true) + somaFrete(dadosFranquia, true) + somaFrete(dadosMultimarcas, true);
    const devolucoesTotal = somaEntradas(dadosRevenda) + somaEntradas(dadosVarejo) + somaEntradas(dadosFranquia) + somaEntradas(dadosMultimarcas);
    // ICMS removido das rotas - não calculamos mais
    const icmsTotal = 0;

    const cmvTotal = (faturamentoTotal > 0 && custoTotalBruto > 0) ? (custoTotalBruto / faturamentoTotal) * 100 : null;
    const markupTotal = custoTotalBruto > 0 ? (faturamentoTotal / custoTotalBruto) : null;

    return {
      faturamentoTotal,
      custoTotalBruto,
      precoTabelaTotal,
      descontoTotal,
      freteTotal,
      devolucoesTotal,
      icmsTotal,
      cmvTotal,
      markupTotal,
    };
  }, [dadosRevenda, dadosVarejo, dadosFranquia, dadosMultimarcas, fatRevenda, fatVarejo, fatFranquia, fatMultimarcas]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#000638] font-barlow">Receita Líquida</h1>

      <div className="mb-8">
        <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
          <div className="mb-6">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-2">
              <Funnel size={22} weight="bold" />
              Filtros
            </span>
            <span className="text-sm text-gray-500 mt-1">Selecione o período e empresa para análise</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-2">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
                apenasEmpresa101={false}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
            </div>
            <div className="flex items-center">
              <button type="submit" className="flex items-center gap-2 bg-[#000638] text-white px-6 py-4 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-10 text-sm font-bold shadow-md tracking-wide uppercase" disabled={loading || !dataInicio || !dataFim || !empresasSelecionadas.length}>
                {loading ? (
                  <>
                    <Spinner size={18} className="animate-spin" />
                    <span></span>
                  </>
                ) : (
                  <>
                    <Calendar size={18} />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {dadosCarregados && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-7xl mx-auto">
          <Card className="shadow-lg rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">Faturamento Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-green-600 mb-1 break-words">
                {agregados.faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Saídas - Entradas</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-700">Desconto Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-orange-600 mb-1 break-words">
                {agregados.descontoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Preço Tabela - Faturamento</CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700">Frete Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-blue-600 mb-1 break-words">
                {agregados.freteTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Somatório de frete (saídas - entradas)</CardDescription>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReceitaLiquida;


