import React, { useState } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import { CurrencyDollar, ChartBar, Percent, TrendUp } from '@phosphor-icons/react';
import custoProdutos from '../custoprodutos.json';
import LoadingCircle from '../components/LoadingCircle';

const Consolidado = () => {
  const [filtros, setFiltros] = useState({ dt_inicio: '', dt_fim: '' });
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [faturamento, setFaturamento] = useState({
    revenda: 0,
    varejo: 0,
    franquia: 0,
    multimarcas: 0,
  });
  const [loadingRevenda, setLoadingRevenda] = useState(false);
  const [loadingVarejo, setLoadingVarejo] = useState(false);
  const [loadingFranquia, setLoadingFranquia] = useState(false);
  const [loadingMultimarcas, setLoadingMultimarcas] = useState(false);

  // Empresas fixas para Revenda e Franquia
  const empresasFixas = ['2', '200', '75', '31', '6', '85', '11'];
  // Empresas fixas para Varejo
  const empresasVarejoFixas = ['2','5','55','65','95','92','93','94','95','96','97','200','500','550','650','950','920','930','940','950','960','970'];

  // Estados para armazenar os dados brutos de cada segmento para cálculo do CMV
  const [dadosRevenda, setDadosRevenda] = useState([]);
  const [dadosVarejo, setDadosVarejo] = useState([]);
  const [dadosFranquia, setDadosFranquia] = useState([]);
  const [dadosMultimarcas, setDadosMultimarcas] = useState([]);

  // Função para calcular o CMV (%) dado um array de dados
  function calcularCMV(dados) {
    if (!Array.isArray(dados) || dados.length === 0) return null;
    // Cria um map de custos
    const custoMap = {};
    custoProdutos.forEach(item => {
      if (item.Codigo && item.Custo !== undefined) {
        custoMap[item.Codigo.trim()] = item.Custo;
      }
    });
    // Só considera saídas
    const saidas = dados.filter(row => row.tp_operacao === 'S');
    let custoTotal = 0;
    let valorTotal = 0;
    saidas.forEach(row => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const custoUnit = custoMap[row.cd_nivel?.trim()];
      if (custoUnit !== undefined) {
        custoTotal += qtFaturado * custoUnit;
      }
      valorTotal += (Number(row.vl_unitliquido) || 0) * qtFaturado;
    });
    if (valorTotal > 0) {
      return (custoTotal / valorTotal) * 100;
    }
    return null;
  }

  // Função para calcular o Markup (%) dado um array de dados
  function calcularMarkup(dados) {
    if (!Array.isArray(dados) || dados.length === 0) return null;
    // Cria um map de custos
    const custoMap = {};
    custoProdutos.forEach(item => {
      if (item.Codigo && item.Custo !== undefined) {
        custoMap[item.Codigo.trim()] = item.Custo;
      }
    });
    // Só considera saídas
    const saidas = dados.filter(row => row.tp_operacao === 'S');
    let custoTotal = 0;
    let valorTotal = 0;
    saidas.forEach(row => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const custoUnit = custoMap[row.cd_nivel?.trim()];
      if (custoUnit !== undefined) {
        custoTotal += qtFaturado * custoUnit;
      }
      valorTotal += (Number(row.vl_unitliquido) || 0) * qtFaturado;
    });
    if (custoTotal > 0) {
      return valorTotal / custoTotal;
    }
    return null;
  }

  const handleFiltrar = async (e) => {
    e.preventDefault();
    setLoadingRevenda(true);
    setLoadingVarejo(true);
    setLoadingFranquia(true);
    setLoadingMultimarcas(true);
    try {
      const paramsBase = new URLSearchParams();
      if (filtros.dt_inicio) paramsBase.append('dt_inicio', filtros.dt_inicio);
      if (filtros.dt_fim) paramsBase.append('dt_fim', filtros.dt_fim);
      // Revenda (apenas empresas fixas)
      const paramsRevenda = new URLSearchParams(paramsBase.toString());
      empresasFixas.forEach(cd => paramsRevenda.append('cd_empresa', cd));
      const resRevenda = await fetch(`https://apigestaocrosby.onrender.com/faturamentorevenda?${paramsRevenda.toString()}`);
      if (!resRevenda.ok) throw new Error('Erro ao buscar faturamento de revenda');
      const jsonRevenda = await resRevenda.json();
      const filtradosRevenda = jsonRevenda.filter(row => row.cd_classificacao == 3);
      const somaSaidasRevenda = filtradosRevenda.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const somaEntradasRevenda = filtradosRevenda.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const totalRevenda = somaSaidasRevenda - somaEntradasRevenda;
      setFaturamento(fat => ({ ...fat, revenda: totalRevenda }));
      setDadosRevenda(filtradosRevenda);
      setLoadingRevenda(false);
      // Varejo (apenas empresas fixas para Varejo)
      const paramsVarejo = new URLSearchParams(paramsBase.toString());
      empresasVarejoFixas.forEach(cd => paramsVarejo.append('cd_empresa', cd));
      const resVarejo = await fetch(`https://apigestaocrosby.onrender.com/faturamento?${paramsVarejo.toString()}`);
      if (!resVarejo.ok) throw new Error('Erro ao buscar faturamento de varejo');
      const jsonVarejo = await resVarejo.json();
      const somaSaidasVarejo = jsonVarejo.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const somaEntradasVarejo = jsonVarejo.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const totalVarejo = somaSaidasVarejo - somaEntradasVarejo;
      setFaturamento(fat => ({ ...fat, varejo: totalVarejo }));
      setDadosVarejo(jsonVarejo);
      setLoadingVarejo(false);
      // Franquia (apenas empresas fixas)
      const paramsFranquia = new URLSearchParams(paramsBase.toString());
      empresasFixas.forEach(cd => paramsFranquia.append('cd_empresa', cd));
      const resFranquia = await fetch(`https://apigestaocrosby.onrender.com/faturamentofranquia?${paramsFranquia.toString()}`);
      if (!resFranquia.ok) throw new Error('Erro ao buscar faturamento de franquia');
      const jsonFranquia = await resFranquia.json();
      const somaSaidasFranquia = jsonFranquia.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const somaEntradasFranquia = jsonFranquia.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const totalFranquia = somaSaidasFranquia - somaEntradasFranquia;
      setFaturamento(fat => ({ ...fat, franquia: totalFranquia }));
      setDadosFranquia(jsonFranquia);
      setLoadingFranquia(false);
      // Multimarcas (apenas empresas fixas)
      const paramsMultimarcas = new URLSearchParams(paramsBase.toString());
      empresasFixas.forEach(cd => paramsMultimarcas.append('cd_empresa', cd));
      const resMultimarcas = await fetch(`https://apigestaocrosby.onrender.com/faturamentomtm?${paramsMultimarcas.toString()}`);
      if (!resMultimarcas.ok) throw new Error('Erro ao buscar faturamento de multimarcas');
      const jsonMultimarcas = await resMultimarcas.json();
      const somaSaidasMultimarcas = jsonMultimarcas.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const somaEntradasMultimarcas = jsonMultimarcas.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
      const totalMultimarcas = somaSaidasMultimarcas - somaEntradasMultimarcas;
      setFaturamento(fat => ({ ...fat, multimarcas: totalMultimarcas }));
      setDadosMultimarcas(jsonMultimarcas);
      setLoadingMultimarcas(false);
    } catch {
      setFaturamento(fat => ({ ...fat, revenda: 0, varejo: 0, franquia: 0, multimarcas: 0 }));
      setDadosRevenda([]);
      setDadosVarejo([]);
      setDadosFranquia([]);
      setDadosMultimarcas([]);
      setLoadingRevenda(false);
      setLoadingVarejo(false);
      setLoadingFranquia(false);
      setLoadingMultimarcas(false);
    }
  };

  // Cálculo do total geral e porcentagens
  const totalGeral = faturamento.revenda + faturamento.varejo + faturamento.franquia + faturamento.multimarcas;
  const getPercent = (valor) => {
    if (totalGeral > 0) {
      // Corrige para nunca passar de 100% e arredonda corretamente
      const percent = (valor / totalGeral) * 100;
      return Math.min(percent, 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
    return '-';
  };

  // Cálculo do CMV total ponderado
  const cmvRevenda = calcularCMV(dadosRevenda);
  const cmvVarejo = calcularCMV(dadosVarejo);
  const cmvFranquia = calcularCMV(dadosFranquia);
  const cmvMultimarcas = calcularCMV(dadosMultimarcas);
  const somaFaturamentos = faturamento.revenda + faturamento.varejo + faturamento.franquia + faturamento.multimarcas;
  let cmvTotal = null;
  if (somaFaturamentos > 0) {
    let somaCMV = 0;
    if (cmvRevenda !== null) somaCMV += (faturamento.revenda * cmvRevenda / 100);
    if (cmvVarejo !== null) somaCMV += (faturamento.varejo * cmvVarejo / 100);
    if (cmvFranquia !== null) somaCMV += (faturamento.franquia * cmvFranquia / 100);
    if (cmvMultimarcas !== null) somaCMV += (faturamento.multimarcas * cmvMultimarcas / 100);
    cmvTotal = (somaCMV / somaFaturamentos) * 100;
  }
  // Cálculo do Markup total ponderado
  const markupRevenda = calcularMarkup(dadosRevenda);
  const markupVarejo = calcularMarkup(dadosVarejo);
  const markupFranquia = calcularMarkup(dadosFranquia);
  const markupMultimarcas = calcularMarkup(dadosMultimarcas);
  let markupTotal = null;
  if (somaFaturamentos > 0) {
    let somaMarkup = 0;
    if (markupRevenda !== null) somaMarkup += (faturamento.revenda * markupRevenda);
    if (markupVarejo !== null) somaMarkup += (faturamento.varejo * markupVarejo);
    if (markupFranquia !== null) somaMarkup += (faturamento.franquia * markupFranquia);
    if (markupMultimarcas !== null) somaMarkup += (faturamento.multimarcas * markupMultimarcas);
    markupTotal = somaMarkup / somaFaturamentos;
  }

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Consolidado</h1>
        {/* Filtros */}
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><CurrencyDollar size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período, empresa ou data para análise</span>
            </div>
            <div className="flex flex-row gap-x-6 w-full">
              <div className="w-full">
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={setEmpresasSelecionadas}
                />
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
                <CurrencyDollar size={18} weight="bold" /> Filtrar
              </button>
            </div>
          </form>
        </div>
        {/* Cards Totais no topo */}
        <div className="flex flex-col gap-6 mb-8 lg:flex-row lg:gap-8 lg:justify-center">
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={22} className="text-green-700" />
                <CardTitle className="text-base font-bold text-green-700">Faturamento Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-green-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#16a34a" />
                  : totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-gray-500">Soma dos canais</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={22} className="text-orange-700" />
                <CardTitle className="text-base font-bold text-orange-700">CMV Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-orange-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#ea580c" />
                  : (cmvTotal !== null ? cmvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
              </div>
              <CardDescription className="text-gray-500">Média ponderada dos canais</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/3 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <TrendUp size={22} className="text-blue-700" />
                <CardTitle className="text-base font-bold text-blue-700">Markup Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-blue-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#2563eb" />
                  : (markupTotal !== null ? markupTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--')}
              </div>
              <CardDescription className="text-gray-500">Média ponderada dos canais</CardDescription>
            </CardContent>
          </Card>
        </div>
        {/* Divider */}
        <div className="w-full border-t-2 border-gray-200 my-4"></div>
        {/* Cards de Faturamento Total */}
        <div className="flex flex-col gap-6 mb-8 lg:flex-row lg:gap-8 lg:justify-center">
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={20} className="text-gray-700" />
                <CardTitle className="text-base font-bold text-gray-900">Faturamento Revenda</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-green-600 mb-1">
                {loadingRevenda ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.revenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-gray-500">Total Revenda</CardDescription>
              <div className="flex items-center gap-2 mt-4">
                <ChartBar size={28} className="text-blue-700" />
                <span className="text-xl font-extrabold text-blue-700">{getPercent(faturamento.revenda)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={20} className="text-gray-700" />
                <CardTitle className="text-base font-bold text-gray-900">Faturamento Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-green-600 mb-1">
                {loadingVarejo ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.varejo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-gray-500">Total Varejo</CardDescription>
              <div className="flex items-center gap-2 mt-4">
                <ChartBar size={28} className="text-blue-700" />
                <span className="text-xl font-extrabold text-blue-700">{getPercent(faturamento.varejo)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={20} className="text-gray-700" />
                <CardTitle className="text-base font-bold text-gray-900">Faturamento Franquia</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-green-600 mb-1">
                {loadingFranquia ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.franquia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-gray-500">Total Franquia</CardDescription>
              <div className="flex items-center gap-2 mt-4">
                <ChartBar size={28} className="text-blue-700" />
                <span className="text-xl font-extrabold text-blue-700">{getPercent(faturamento.franquia)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={20} className="text-gray-700" />
                <CardTitle className="text-base font-bold text-gray-900">Faturamento Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-green-600 mb-1">
                {loadingMultimarcas ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.multimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-gray-500">Total Multimarcas</CardDescription>
              <div className="flex items-center gap-2 mt-4">
                <ChartBar size={28} className="text-blue-700" />
                <span className="text-xl font-extrabold text-blue-700">{getPercent(faturamento.multimarcas)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Divider */}
        <div className="w-full border-t-2 border-gray-200 my-4"></div>
        {/* Cards de CMV */}
        <div className="flex flex-col gap-6 mb-8 lg:flex-row lg:gap-8 lg:justify-center">
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={20} className="text-orange-600" />
                <CardTitle className="text-base font-bold text-orange-600">CMV Revenda</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-orange-700 mb-1">
                {loadingRevenda ? <LoadingCircle size={28} color="#ea580c" /> : (() => {
                  const cmv = calcularCMV(dadosRevenda);
                  return cmv !== null ? cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">CMV Revenda (%)</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={20} className="text-orange-600" />
                <CardTitle className="text-base font-bold text-orange-600">CMV Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-orange-700 mb-1">
                {loadingVarejo ? <LoadingCircle size={28} color="#ea580c" /> : (() => {
                  const cmv = calcularCMV(dadosVarejo);
                  return cmv !== null ? cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">CMV Varejo (%)</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={20} className="text-orange-600" />
                <CardTitle className="text-base font-bold text-orange-600">CMV Franquia</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-orange-700 mb-1">
                {loadingFranquia ? <LoadingCircle size={28} color="#ea580c" /> : (() => {
                  const cmv = calcularCMV(dadosFranquia);
                  return cmv !== null ? cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">CMV Franquia (%)</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={20} className="text-orange-600" />
                <CardTitle className="text-base font-bold text-orange-600">CMV Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-orange-700 mb-1">
                {loadingMultimarcas ? <LoadingCircle size={28} color="#ea580c" /> : (() => {
                  const cmv = calcularCMV(dadosMultimarcas);
                  return cmv !== null ? cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">CMV Multimarcas (%)</CardDescription>
            </CardContent>
          </Card>
        </div>
        {/* Divider */}
        <div className="w-full border-t-2 border-gray-200 my-4"></div>
        {/* Cards de Markup */}
        <div className="flex flex-col gap-6 mb-8 lg:flex-row lg:gap-8 lg:justify-center">
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <TrendUp size={20} className="text-blue-600" />
                <CardTitle className="text-base font-bold text-blue-600">Markup Revenda</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-blue-700 mb-1">
                {loadingRevenda ? <LoadingCircle size={28} color="#2563eb" /> : (() => {
                  const markup = calcularMarkup(dadosRevenda);
                  return markup !== null ? markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">Markup Revenda</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <TrendUp size={20} className="text-blue-600" />
                <CardTitle className="text-base font-bold text-blue-600">Markup Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-blue-700 mb-1">
                {loadingVarejo ? <LoadingCircle size={28} color="#2563eb" /> : (() => {
                  const markup = calcularMarkup(dadosVarejo);
                  return markup !== null ? markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">Markup Varejo</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <TrendUp size={20} className="text-blue-600" />
                <CardTitle className="text-base font-bold text-blue-600">Markup Franquia</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-blue-700 mb-1">
                {loadingFranquia ? <LoadingCircle size={28} color="#2563eb" /> : (() => {
                  const markup = calcularMarkup(dadosFranquia);
                  return markup !== null ? markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">Markup Franquia</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/4 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <TrendUp size={20} className="text-blue-600" />
                <CardTitle className="text-base font-bold text-blue-600">Markup Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-3xl font-extrabold text-blue-700 mb-1">
                {loadingMultimarcas ? <LoadingCircle size={28} color="#2563eb" /> : (() => {
                  const markup = calcularMarkup(dadosMultimarcas);
                  return markup !== null ? markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
                })()}
              </div>
              <CardDescription className="text-gray-500">Markup Multimarcas</CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Consolidado; 