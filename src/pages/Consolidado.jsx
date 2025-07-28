import React, { useState } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import { CurrencyDollar, ChartBar, Percent, TrendUp } from '@phosphor-icons/react';
import custoProdutos from '../custoprodutos.json';
import LoadingCircle from '../components/LoadingCircle';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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

  // Cálculo do custo total bruto de todos os canais
  function calcularCustoBruto(dados) {
    if (!Array.isArray(dados) || dados.length === 0) return 0;
    const custoMap = {};
    custoProdutos.forEach(item => {
      if (item.Codigo && item.Custo !== undefined) {
        custoMap[item.Codigo.trim()] = item.Custo;
      }
    });
    const saidas = dados.filter(row => row.tp_operacao === 'S');
    let custoTotal = 0;
    saidas.forEach(row => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const custoUnit = custoMap[row.cd_nivel?.trim()];
      if (custoUnit !== undefined) {
        custoTotal += qtFaturado * custoUnit;
      }
    });
    return custoTotal;
  }

  // Função para calcular a margem por canal
  function calcularMargemCanal(faturamento, custo) {
    if (faturamento > 0 && custo > 0) {
      return ((faturamento - custo) / faturamento) * 100;
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
  const custoBrutoRevenda = calcularCustoBruto(dadosRevenda);
  const custoBrutoVarejo = calcularCustoBruto(dadosVarejo);
  const custoBrutoFranquia = calcularCustoBruto(dadosFranquia);
  const custoBrutoMultimarcas = calcularCustoBruto(dadosMultimarcas);
  const custoTotalBruto = custoBrutoRevenda + custoBrutoVarejo + custoBrutoFranquia + custoBrutoMultimarcas;

  const cmvRevenda = calcularCMV(dadosRevenda);
  const cmvVarejo = calcularCMV(dadosVarejo);
  const cmvFranquia = calcularCMV(dadosFranquia);
  const cmvMultimarcas = calcularCMV(dadosMultimarcas);
  const somaFaturamentos = faturamento.revenda + faturamento.varejo + faturamento.franquia + faturamento.multimarcas;
  const cmvTotal = (somaFaturamentos > 0 && custoTotalBruto > 0) ? (custoTotalBruto / somaFaturamentos) * 100 : null;

  // Cálculo do Markup total ponderado
  let markupTotal = null;
  if (custoTotalBruto > 0) {
    markupTotal = somaFaturamentos / custoTotalBruto;
  }

  // Cálculo da margem por canal
  const margemRevenda = calcularMargemCanal(faturamento.revenda, custoBrutoRevenda);
  const margemVarejo = calcularMargemCanal(faturamento.varejo, custoBrutoVarejo);
  const margemFranquia = calcularMargemCanal(faturamento.franquia, custoBrutoFranquia);
  const margemMultimarcas = calcularMargemCanal(faturamento.multimarcas, custoBrutoMultimarcas);

  // Dados para gráfico de Faturamento
  const dataGraficoFaturamento = {
    labels: ['Revenda', 'Varejo', 'Franquia', 'Multimarcas'],
    datasets: [
      {
        label: 'Faturamento',
        data: [faturamento.revenda, faturamento.varejo, faturamento.franquia, faturamento.multimarcas],
        backgroundColor: [
          'rgba(59,130,246,0.8)', // Revenda - Azul
          'rgba(34,197,94,0.8)',  // Varejo - Verde
          'rgba(251,191,36,0.8)', // Franquia - Amarelo
          'rgba(249,115,22,0.8)'  // Multimarcas - Laranja
        ],
        borderColor: [
          '#3b82f6', // Revenda - Azul
          '#22c55e', // Varejo - Verde
          '#fbbf24', // Franquia - Amarelo
          '#f97316'  // Multimarcas - Laranja
        ],
        borderWidth: 2
      },
    ],
  };

  // Dados para gráfico de CMV
  const dataGraficoCMV = {
    labels: ['Revenda', 'Varejo', 'Franquia', 'Multimarcas'],
    datasets: [
      {
        label: 'CMV',
        data: [cmvRevenda, cmvVarejo, cmvFranquia, cmvMultimarcas],
        backgroundColor: [
          'rgba(59,130,246,0.8)', // Revenda - Azul
          'rgba(34,197,94,0.8)',  // Varejo - Verde
          'rgba(251,191,36,0.8)', // Franquia - Amarelo
          'rgba(249,115,22,0.8)'  // Multimarcas - Laranja
        ],
        borderColor: [
          '#3b82f6', // Revenda - Azul
          '#22c55e', // Varejo - Verde
          '#fbbf24', // Franquia - Amarelo
          '#f97316'  // Multimarcas - Laranja
        ],
        borderWidth: 2
      },
    ],
  };

  // Dados para gráfico de Markup
  const dataGraficoMarkup = {
    labels: ['Revenda', 'Varejo', 'Franquia', 'Multimarcas'],
    datasets: [
      {
        label: 'Markup',
        data: [
          custoBrutoRevenda > 0 ? faturamento.revenda / custoBrutoRevenda : 0,
          custoBrutoVarejo > 0 ? faturamento.varejo / custoBrutoVarejo : 0,
          custoBrutoFranquia > 0 ? faturamento.franquia / custoBrutoFranquia : 0,
          custoBrutoMultimarcas > 0 ? faturamento.multimarcas / custoBrutoMultimarcas : 0
        ],
        backgroundColor: [
          'rgba(59,130,246,0.8)', // Revenda - Azul
          'rgba(34,197,94,0.8)',  // Varejo - Verde
          'rgba(251,191,36,0.8)', // Franquia - Amarelo
          'rgba(249,115,22,0.8)'  // Multimarcas - Laranja
        ],
        borderColor: [
          '#3b82f6', // Revenda - Azul
          '#22c55e', // Varejo - Verde
          '#fbbf24', // Franquia - Amarelo
          '#f97316'  // Multimarcas - Laranja
        ],
        borderWidth: 2
      },
    ],
  };

  // Dados para gráfico de Custo
  const dataGraficoCusto = {
    labels: ['Revenda', 'Varejo', 'Franquia', 'Multimarcas'],
    datasets: [
      {
        label: 'Custo',
        data: [custoBrutoRevenda, custoBrutoVarejo, custoBrutoFranquia, custoBrutoMultimarcas],
        backgroundColor: [
          'rgba(59,130,246,0.8)', // Revenda - Azul
          'rgba(34,197,94,0.8)',  // Varejo - Verde
          'rgba(251,191,36,0.8)', // Franquia - Amarelo
          'rgba(249,115,22,0.8)'  // Multimarcas - Laranja
        ],
        borderColor: [
          '#3b82f6', // Revenda - Azul
          '#22c55e', // Varejo - Verde
          '#fbbf24', // Franquia - Amarelo
          '#f97316'  // Multimarcas - Laranja
        ],
        borderWidth: 2
      },
    ],
  };

  // Opções para gráficos de valores monetários
  const optionsGraficoMonetario = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Comparativo por Canal',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          }
        }
      }
    }
  };

  // Opções para gráfico de porcentagem (Markup)
  const optionsGraficoPercentual = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Comparativo por Canal',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value.toFixed(2) + '%';
          }
        }
      }
    }
  };

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 scale-90">
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
          {/* Faturamento Total */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/5 bg-white cursor-pointer text-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={22} className="text-green-700" />
                <CardTitle className="text-sm font-bold text-green-700">Faturamento Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-6">
              <div className="text-2xl font-extrabold text-green-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#16a34a" />
                  : totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-gray-500">Soma dos canais</CardDescription>
            </CardContent>
          </Card>
          {/* Custo Total */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/5 bg-white cursor-pointer text-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={22} className="text-red-700" />
                <CardTitle className="text-base font-bold text-red-700">Custo Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-2xl font-extrabold text-red-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#dc2626" />
                  : custoTotalBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-gray-500">Soma dos custos dos canais</CardDescription>
            </CardContent>
          </Card>
          {/* CMV Total */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/5 bg-white cursor-pointer text-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={22} className="text-orange-700" />
                <CardTitle className="text-base font-bold text-orange-700">CMV Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-2xl font-extrabold text-orange-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#ea580c" />
                  : (cmvTotal !== null ? cmvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
              </div>
              <CardDescription className="text-gray-500">Custo Total / Faturamento Total</CardDescription>
            </CardContent>
          </Card>
          {/* Margem Total */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/5 bg-white cursor-pointer text-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={22} className="text-yellow-700" />
                <CardTitle className="text-base font-bold text-yellow-700">Margem</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#a16207" />
                  : (totalGeral > 0 && custoTotalBruto > 0 
                      ? (((totalGeral - custoTotalBruto) / totalGeral) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--')}
              </div>
              <CardDescription className="text-gray-500">Faturamento - Custo Total</CardDescription>
            </CardContent>
          </Card>
          {/* Markup Total */}
          <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/5 bg-white cursor-pointer text-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <TrendUp size={22} className="text-blue-700" />
                <CardTitle className="text-base font-bold text-blue-700">Markup Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pl-12">
              <div className="text-2xl font-extrabold text-blue-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <LoadingCircle size={32} color="#2563eb" />
                  : (markupTotal !== null ? markupTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--')}
              </div>
              <CardDescription className="text-gray-500">Média ponderada dos canais</CardDescription>
            </CardContent>
          </Card>
        </div>
        {/* Divider após cards totais */}
        <div className="w-full border-t-2 border-gray-200 my-6"></div>
        
        {/* Linhas por canal */}
        <div className="flex flex-col gap-8 mb-8">
          {/* Seção Revenda */}
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Revenda</h3>
            <div className="flex flex-row gap-4 lg:gap-6 justify-center items-stretch">
            {/* Faturamento Revenda */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-900">Faturamento Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-green-600 mb-1">
                  {loadingRevenda ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.revenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Total Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Revenda */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-red-700 mb-1">
                  {loadingRevenda ? <LoadingCircle size={28} color="#dc2626" /> : custoBrutoRevenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Custo total da Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Revenda */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-orange-600" />
                  <CardTitle className="text-base font-bold text-orange-600">CMV Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingRevenda ? <LoadingCircle size={28} color="#ea580c" /> : (
                    faturamento.revenda > 0 && custoBrutoRevenda > 0
                      ? ((custoBrutoRevenda / faturamento.revenda) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">CMV Revenda (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Revenda */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-yellow-700 mb-1">
                  {loadingRevenda ? <LoadingCircle size={28} color="#a16207" /> : (margemRevenda !== null ? margemRevenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-gray-500">Margem da Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Revenda */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={20} className="text-blue-600" />
                  <CardTitle className="text-base font-bold text-blue-600">Markup Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingRevenda ? <LoadingCircle size={28} color="#2563eb" /> : (
                    custoBrutoRevenda > 0
                      ? (faturamento.revenda / custoBrutoRevenda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">Markup Revenda</CardDescription>
              </CardContent>
            </Card>
          </div>
        
        {/* Divider entre seções */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        
        {/* Seção Varejo */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Varejo</h3>
          <div className="flex flex-row gap-4 lg:gap-6 justify-center items-stretch">
            {/* Faturamento Varejo */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-900">Faturamento Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-green-600 mb-1">
                  {loadingVarejo ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.varejo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Total Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Varejo */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-red-700 mb-1">
                  {loadingVarejo ? <LoadingCircle size={28} color="#dc2626" /> : custoBrutoVarejo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Custo total do Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Varejo */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-orange-600" />
                  <CardTitle className="text-base font-bold text-orange-600">CMV Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingVarejo ? <LoadingCircle size={28} color="#ea580c" /> : (
                    faturamento.varejo > 0 && custoBrutoVarejo > 0
                      ? ((custoBrutoVarejo / faturamento.varejo) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">CMV Varejo (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Varejo */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-yellow-700 mb-1">
                  {loadingVarejo ? <LoadingCircle size={28} color="#a16207" /> : (margemVarejo !== null ? margemVarejo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-gray-500">Margem do Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Varejo */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={20} className="text-blue-600" />
                  <CardTitle className="text-base font-bold text-blue-600">Markup Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingVarejo ? <LoadingCircle size={28} color="#2563eb" /> : (
                    custoBrutoVarejo > 0
                      ? (faturamento.varejo / custoBrutoVarejo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">Markup Varejo</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Divider entre seções */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        
        {/* Seção Franquia */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Franquia</h3>
          <div className="flex flex-row gap-4 lg:gap-6 justify-center items-stretch">
            {/* Faturamento Franquia */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-900">Faturamento Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-green-600 mb-1">
                  {loadingFranquia ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.franquia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Total Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Franquia */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-red-700 mb-1">
                  {loadingFranquia ? <LoadingCircle size={28} color="#dc2626" /> : custoBrutoFranquia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Custo total da Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Franquia */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-orange-600" />
                  <CardTitle className="text-base font-bold text-orange-600">CMV Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingFranquia ? <LoadingCircle size={28} color="#ea580c" /> : (
                    faturamento.franquia > 0 && custoBrutoFranquia > 0
                      ? ((custoBrutoFranquia / faturamento.franquia) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">CMV Franquia (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Franquia */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-yellow-700 mb-1">
                  {loadingFranquia ? <LoadingCircle size={28} color="#a16207" /> : (margemFranquia !== null ? margemFranquia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-gray-500">Margem da Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Franquia */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={20} className="text-blue-600" />
                  <CardTitle className="text-base font-bold text-blue-600">Markup Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingFranquia ? <LoadingCircle size={28} color="#2563eb" /> : (
                    custoBrutoFranquia > 0
                      ? (faturamento.franquia / custoBrutoFranquia).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">Markup Franquia</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Divider entre seções */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        
        {/* Seção Multimarcas */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Multimarcas</h3>
          <div className="flex flex-row gap-4 lg:gap-6 justify-center items-stretch">
            {/* Faturamento Multimarcas */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-900">Faturamento Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-green-600 mb-1">
                  {loadingMultimarcas ? <LoadingCircle size={28} color="#16a34a" /> : faturamento.multimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Total Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Multimarcas */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={20} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-red-700 mb-1">
                  {loadingMultimarcas ? <LoadingCircle size={28} color="#dc2626" /> : custoBrutoMultimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-gray-500">Custo total da Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Multimarcas */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-orange-600" />
                  <CardTitle className="text-base font-bold text-orange-600">CMV Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingMultimarcas ? <LoadingCircle size={28} color="#ea580c" /> : (
                    faturamento.multimarcas > 0 && custoBrutoMultimarcas > 0
                      ? ((custoBrutoMultimarcas / faturamento.multimarcas) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">CMV Multimarcas (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Multimarcas */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={20} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-6">
                <div className="text-xl font-extrabold text-yellow-700 mb-1">
                  {loadingMultimarcas ? <LoadingCircle size={28} color="#a16207" /> : (margemMultimarcas !== null ? margemMultimarcas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-gray-500">Margem da Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Multimarcas */}
            <Card className="shadow-2xl transition-all duration-200 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 rounded-2xl w-full lg:w-1/6 bg-white cursor-pointer text-sm">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={20} className="text-blue-600" />
                  <CardTitle className="text-base font-bold text-blue-600">Markup Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pl-12">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingMultimarcas ? <LoadingCircle size={28} color="#2563eb" /> : (
                    custoBrutoMultimarcas > 0
                      ? (faturamento.multimarcas / custoBrutoMultimarcas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-gray-500">Markup Multimarcas</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
            {/* Seção de Gráficos */}
      <div className="mt-12 w-full max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8 text-[#000638]">Gráficos Comparativos</h2>
        
        {/* Grid de gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gráfico de Faturamento */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-center mb-4 text-[#000638]">Faturamento por Canal</h3>
            <Bar data={dataGraficoFaturamento} options={{...optionsGraficoMonetario, plugins: {...optionsGraficoMonetario.plugins, title: {...optionsGraficoMonetario.plugins.title, text: 'Faturamento por Canal'}}}} />
          </div>

          {/* Gráfico de CMV */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-center mb-4 text-[#000638]">CMV por Canal</h3>
            <Bar data={dataGraficoCMV} options={{...optionsGraficoMonetario, plugins: {...optionsGraficoMonetario.plugins, title: {...optionsGraficoMonetario.plugins.title, text: 'CMV por Canal'}}}} />
          </div>

          {/* Gráfico de Markup */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-center mb-4 text-[#000638]">Markup por Canal</h3>
            <Bar data={dataGraficoMarkup} options={{...optionsGraficoPercentual, plugins: {...optionsGraficoPercentual.plugins, title: {...optionsGraficoPercentual.plugins.title, text: 'Markup por Canal (%)'}}}} />
          </div>

          {/* Gráfico de Custo */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-center mb-4 text-[#000638]">Custo por Canal</h3>
            <Bar data={dataGraficoCusto} options={{...optionsGraficoMonetario, plugins: {...optionsGraficoMonetario.plugins, title: {...optionsGraficoMonetario.plugins.title, text: 'Custo por Canal'}}}} />
          </div>
        </div>
      </div>
    </div>
    </div>    
  </Layout>
  );
};

export default Consolidado; 