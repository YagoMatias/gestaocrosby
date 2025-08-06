import React, { useState } from 'react';
import Layout from '../components/Layout';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import { CurrencyDollar, ChartBar, Percent, TrendUp, Question, Spinner } from '@phosphor-icons/react';
import custoProdutos from '../custoprodutos.json';
import { Bar } from 'react-chartjs-2';
import useApiClient from '../hooks/useApiClient';
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
  const apiClient = useApiClient();
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
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', description: '', calculation: '' });

  // Empresas fixas para Revenda e Franquia
  const empresasFixas = ['2', '200', '75', '31', '6', '85', '11'];
  // Empresas fixas para Varejo
  const empresasVarejoFixas = ['2', '5', '500', '55', '550', '65', '650', '93', '930', '94', '940', '95', '950', '96', '960', '97', '970'];

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
      // Revenda (apenas empresas fixas)
      const paramsRevenda = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixas
      };
      
      console.log('🔄 Buscando dados de Revenda...');
      const resultRevenda = await apiClient.sales.faturamentoRevenda(paramsRevenda);
      
      if (resultRevenda.success) {
        console.log('✅ Dados de Revenda recebidos:', {
          total: resultRevenda.data.length,
          amostra: resultRevenda.data.slice(0, 2)
        });
        
        const filtradosRevenda = resultRevenda.data.filter(row => row.cd_classificacao == 3);
        const somaSaidasRevenda = filtradosRevenda
          .filter(row => row.tp_operacao === 'S')
          .reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
        
        setFaturamento(fat => ({ ...fat, revenda: somaSaidasRevenda }));
        setDadosRevenda(filtradosRevenda);
      } else {
        throw new Error(resultRevenda.message || 'Erro ao buscar faturamento de revenda');
      }
      setLoadingRevenda(false);

      // Varejo (apenas empresas fixas para Varejo)
      const paramsVarejo = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasVarejoFixas
      };
      
      console.log('🔄 Buscando dados de Varejo...');
      const resultVarejo = await apiClient.sales.faturamento(paramsVarejo);
      
      if (resultVarejo.success) {
        console.log('✅ Dados de Varejo recebidos:', {
          total: resultVarejo.data.length,
          amostra: resultVarejo.data.slice(0, 2)
        });
        
        const somaSaidasVarejo = resultVarejo.data
          .filter(row => row.tp_operacao === 'S')
          .reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
        const somaEntradasVarejo = resultVarejo.data
          .filter(row => row.tp_operacao === 'E')
          .reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
        const totalVarejo = somaSaidasVarejo - somaEntradasVarejo;
        
        setFaturamento(fat => ({ ...fat, varejo: totalVarejo }));
        setDadosVarejo(resultVarejo.data);
      } else {
        throw new Error(resultVarejo.message || 'Erro ao buscar faturamento de varejo');
      }
      setLoadingVarejo(false);

      // Franquia (apenas empresas fixas)
      const paramsFranquia = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixas
      };
      
      console.log('🔄 Buscando dados de Franquia...');
      const resultFranquia = await apiClient.sales.faturamentoFranquia(paramsFranquia);
      
      if (resultFranquia.success) {
        console.log('✅ Dados de Franquia recebidos:', {
          total: resultFranquia.data.length,
          amostra: resultFranquia.data.slice(0, 2)
        });
        
        const somaSaidasFranquia = resultFranquia.data
          .filter(row => row.tp_operacao === 'S')
          .reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
        
        setFaturamento(fat => ({ ...fat, franquia: somaSaidasFranquia }));
        setDadosFranquia(resultFranquia.data);
      } else {
        throw new Error(resultFranquia.message || 'Erro ao buscar faturamento de franquia');
      }
      setLoadingFranquia(false);

      // Multimarcas (apenas empresas fixas)
      const paramsMultimarcas = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixas
      };
      
      console.log('🔄 Buscando dados de Multimarcas...');
      const resultMultimarcas = await apiClient.sales.faturamentoMtm(paramsMultimarcas);
      
      if (resultMultimarcas.success) {
        console.log('✅ Dados de Multimarcas recebidos:', {
          total: resultMultimarcas.data.length,
          amostra: resultMultimarcas.data.slice(0, 2)
        });
        
        const somaSaidasMultimarcas = resultMultimarcas.data
          .filter(row => row.tp_operacao === 'S')
          .reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
        
        setFaturamento(fat => ({ ...fat, multimarcas: somaSaidasMultimarcas }));
        setDadosMultimarcas(resultMultimarcas.data);
      } else {
        throw new Error(resultMultimarcas.message || 'Erro ao buscar faturamento de multimarcas');
      }
      setLoadingMultimarcas(false);
    } catch (error) {
      console.error('❌ Erro ao buscar dados:', error);
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
  // Função para calcular representatividade garantindo soma = 100%
  const getPercent = (valor, canalIndex = 0) => {
    if (totalGeral > 0) {
      // Calcula todos os percentuais primeiro
      const percentRevenda = (faturamento.revenda / totalGeral) * 100;
      const percentVarejo = (faturamento.varejo / totalGeral) * 100;
      const percentFranquia = (faturamento.franquia / totalGeral) * 100;
      const percentMultimarcas = (faturamento.multimarcas / totalGeral) * 100;
      
      // Arredonda para 2 casas decimais
      const percentRevendaRounded = Math.round(percentRevenda * 100) / 100;
      const percentVarejoRounded = Math.round(percentVarejo * 100) / 100;
      const percentFranquiaRounded = Math.round(percentFranquia * 100) / 100;
      const percentMultimarcasRounded = Math.round(percentMultimarcas * 100) / 100;
      
      // Calcula a soma total arredondada
      const somaTotal = percentRevendaRounded + percentVarejoRounded + percentFranquiaRounded + percentMultimarcasRounded;
      
      // Se a soma for maior que 100%, ajusta o maior valor
      if (somaTotal > 100) {
        const excesso = somaTotal - 100;
        
        // Encontra o maior valor para reduzir
        const valores = [
          { valor: percentRevendaRounded, index: 0 },
          { valor: percentVarejoRounded, index: 1 },
          { valor: percentFranquiaRounded, index: 2 },
          { valor: percentMultimarcasRounded, index: 3 }
        ];
        
        const maiorValor = valores.reduce((max, atual) => atual.valor > max.valor ? atual : max);
        
        // Retorna o valor ajustado baseado no canal
        if (canalIndex === maiorValor.index) {
          const valorAjustado = maiorValor.valor - excesso;
          return valorAjustado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        } else {
          // Retorna o valor normal para os outros canais
          const valoresAjustados = [
            canalIndex === 0 ? percentRevendaRounded : (maiorValor.index === 0 ? percentRevendaRounded - excesso : percentRevendaRounded),
            canalIndex === 1 ? percentVarejoRounded : (maiorValor.index === 1 ? percentVarejoRounded - excesso : percentVarejoRounded),
            canalIndex === 2 ? percentFranquiaRounded : (maiorValor.index === 2 ? percentFranquiaRounded - excesso : percentFranquiaRounded),
            canalIndex === 3 ? percentMultimarcasRounded : (maiorValor.index === 3 ? percentMultimarcasRounded - excesso : percentMultimarcasRounded)
          ];
          return valoresAjustados[canalIndex].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        }
      }
      
      // Se a soma for menor que 100%, ajusta o menor valor
      if (somaTotal < 100) {
        const deficit = 100 - somaTotal;
        
        // Encontra o menor valor para aumentar
        const valores = [
          { valor: percentRevendaRounded, index: 0 },
          { valor: percentVarejoRounded, index: 1 },
          { valor: percentFranquiaRounded, index: 2 },
          { valor: percentMultimarcasRounded, index: 3 }
        ];
        
        const menorValor = valores.reduce((min, atual) => atual.valor < min.valor ? atual : min);
        
        // Retorna o valor ajustado baseado no canal
        if (canalIndex === menorValor.index) {
          const valorAjustado = menorValor.valor + deficit;
          return valorAjustado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        } else {
          // Retorna o valor normal para os outros canais
          const valoresAjustados = [
            canalIndex === 0 ? percentRevendaRounded : (menorValor.index === 0 ? percentRevendaRounded + deficit : percentRevendaRounded),
            canalIndex === 1 ? percentVarejoRounded : (menorValor.index === 1 ? percentVarejoRounded + deficit : percentVarejoRounded),
            canalIndex === 2 ? percentFranquiaRounded : (menorValor.index === 2 ? percentFranquiaRounded + deficit : percentFranquiaRounded),
            canalIndex === 3 ? percentMultimarcasRounded : (menorValor.index === 3 ? percentMultimarcasRounded + deficit : percentMultimarcasRounded)
          ];
          return valoresAjustados[canalIndex].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        }
      }
      
      // Se a soma for exatamente 100%, retorna o valor normal
      const valores = [percentRevendaRounded, percentVarejoRounded, percentFranquiaRounded, percentMultimarcasRounded];
      return valores[canalIndex].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
    return '-';
  };

  const showHelpModal = (title, description, calculation) => {
    setModalContent({ title, description, calculation });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  // Cálculo do CMV percentual ponderado
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

  // Dados para gráfico de Vendas após Desconto
  const dataGraficoFaturamento = {
    labels: ['Revenda', 'Varejo', 'Franquia', 'Multimarcas'],
    datasets: [
      {
        label: 'Vendas após Desconto',
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
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          {/* Vendas após Desconto */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={18} className="text-green-700" />
                <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-green-600 animate-spin" />
                  : totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Soma dos canais</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Vendas após Desconto',
                    'O valor das vendas menos o desconto aplicado. Representa as vendas após desconto total.',
                    'Exemplo: R$1000,00 (Venda) - R$100,00 (Desconto) = R$900,00 (Resultado)'
                  )}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* CMV */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={18} className="text-red-700" />
                <CardTitle className="text-sm font-bold text-red-700">CMV</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-red-600 animate-spin" />
                  : custoTotalBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Soma dos custos dos canais</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'CMV (Custo da Mercadoria Vendida)',
                    'Soma dos custos de produção dos produtos, de todos os canais.',
                    'CMV Percentual = CMV Revenda + CMV Varejo + CMV Franquia + CMV Multimarcas'
                  )}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* CMV Percentual */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={18} className="text-orange-700" />
                <CardTitle className="text-sm font-bold text-orange-700">CMV Percentual</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-orange-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-orange-600 animate-spin" />
                  : (cmvTotal !== null ? cmvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">CMV / Vendas após Desconto</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'CMV Percentual (%)',
                    'Percentual do CMV em relação às vendas após desconto. Indica a proporção do custo sobre as vendas.',
                    'CMV Percentual % = (CMV Percentual / Vendas após Desconto) × 100'
                  )}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Margem Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Percent size={18} className="text-yellow-700" />
                <CardTitle className="text-sm font-bold text-yellow-700">Margem</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-yellow-600 animate-spin" />
                  : (totalGeral > 0 && custoTotalBruto > 0 
                      ? (((totalGeral - custoTotalBruto) / totalGeral) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--')}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Vendas após Desconto - CMV</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Margem Total (%)',
                    'Percentual de lucro bruto em relação às vendas após desconto. Representa a rentabilidade geral.',
                    'Margem % = ((Vendas após Desconto - CMV Percentual) / Vendas após Desconto) × 100'
                  )}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Markup Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <TrendUp size={18} className="text-blue-700" />
                <CardTitle className="text-sm font-bold text-blue-700">Markup Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-blue-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-blue-600 animate-spin" />
                  : (markupTotal !== null ? markupTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--')}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Média ponderada dos canais</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Markup Total',
                    'Média ponderada do markup de todos os canais. Indica quantas vezes o preço de venda é maior que o custo.',
                    'Markup Total = Vendas após Desconto / CMV Percentual'
                  )}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Preço Total de Tabela */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={18} className="text-purple-700" />
                <CardTitle className="text-sm font-bold text-purple-700">Preço Total de Tabela</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-purple-700 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-purple-600 animate-spin" />
                  : (() => {
                      let valorBrutoTotal = 0;
                      [dadosRevenda, dadosVarejo, dadosFranquia, dadosMultimarcas].forEach(dados => {
                        dados.forEach(row => {
                          const qtFaturado = Number(row.qt_faturado) || 1;
                          const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                          if (row.tp_operacao === 'S') {
                            valorBrutoTotal += valorBruto;
                          }
                        });
                      });
                      return valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Preço Total de Tabela dos Canais</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Preço Total de Tabela',
                    'Soma dos valores tabelados (sem desconto) de todos os canais de venda. Representa as vendas antes dos descontos.',
                    'Preço Total de Tabela = Preço de Tabela Revenda + Varejo + Franquia + Multimarcas'
                  )}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
          {/* Desconto Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-600">Desconto Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-orange-600 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-orange-600 animate-spin" />
                  : (() => {
                      // Calcula o preço total de tabela
                      let precoTabelaTotal = 0;
                      [dadosRevenda, dadosVarejo, dadosFranquia, dadosMultimarcas].forEach(dados => {
                        dados.forEach(row => {
                          const qtFaturado = Number(row.qt_faturado) || 1;
                          const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                          if (row.tp_operacao === 'S') {
                            precoTabelaTotal += valorBruto;
                          }
                        });
                      });
                      
                      // Desconto total = Preço Total de Tabela - Vendas após Desconto
                      const descontoTotal = precoTabelaTotal - totalGeral;
                      return descontoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Desconto Total dos Canais</CardDescription>
                <button
                  onClick={() => showHelpModal(
                    'Desconto Total',
                    'Diferença entre o preço total de tabela e as vendas após desconto. Representa o total de descontos aplicados em todos os canais.',
                    'Desconto Total = Preço Total de Tabela - Vendas após Desconto'
                  )}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
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
            <div className="flex flex-wrap gap-4 justify-start">
            {/* Vendas após Desconto Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-green-600 animate-spin" /> : faturamento.revenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-red-600 animate-spin" /> : custoBrutoRevenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV da Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    faturamento.revenda > 0 && custoBrutoRevenda > 0
                      ? ((custoBrutoRevenda / faturamento.revenda) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Revenda (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (margemRevenda !== null ? margemRevenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem da Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    custoBrutoRevenda > 0
                      ? (faturamento.revenda / custoBrutoRevenda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* Preço de Tabela Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-600 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (() => {
                    let valorBrutoTotal = 0;
                    dadosRevenda.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                       if (row.tp_operacao === 'S') {
                        valorBrutoTotal += valorBruto;
                      }
                    });
                    return valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela da Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* Desconto Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-600 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (() => {
                    // Calcula o preço de tabela da revenda
                    let precoTabelaRevenda = 0;
                    dadosRevenda.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      if (row.tp_operacao === 'S') {
                        precoTabelaRevenda += valorBruto;
                      }
                    });
                    
                    // Desconto revenda = Preço de Tabela Revenda - Vendas após Desconto Revenda
                    const descontoRevenda = precoTabelaRevenda - faturamento.revenda;
                    return descontoRevenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto da Revenda</CardDescription>
              </CardContent>
            </Card>
            {/* Representatividade Revenda */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-indigo-600">Representatividade Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-indigo-600 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-indigo-600 animate-spin" /> : getPercent(faturamento.revenda, 0)}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
              </CardContent>
            </Card>
          </div>
        
        {/* Divider entre seções */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        
        {/* Seção Varejo */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Varejo</h3>
          <div className="flex flex-wrap gap-4 justify-start">
            {/* Vendas após Desconto Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-green-600 animate-spin" /> : faturamento.varejo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-red-600 animate-spin" /> : custoBrutoVarejo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV do Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    faturamento.varejo > 0 && custoBrutoVarejo > 0
                      ? ((custoBrutoVarejo / faturamento.varejo) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Varejo (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (margemVarejo !== null ? margemVarejo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem do Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    custoBrutoVarejo > 0
                      ? (faturamento.varejo / custoBrutoVarejo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* Preço de Tabela Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-600 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (() => {
                    let valorBrutoTotal = 0;
                    dadosVarejo.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      
                      if (row.tp_operacao === 'S') {
                        valorBrutoTotal += valorBruto;
                      } else if (row.tp_operacao === 'E') {
                        valorBrutoTotal -= valorBruto;
                      }
                    });
                    return valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela do Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* Desconto Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-600 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (() => {
                    // Calcula o preço de tabela do varejo
                    let precoTabelaVarejo = 0;
                    dadosVarejo.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      
                      if (row.tp_operacao === 'S') {
                        precoTabelaVarejo += valorBruto;
                      } else if (row.tp_operacao === 'E') {
                        precoTabelaVarejo -= valorBruto;
                      }
                    });
                    
                    // Desconto varejo = Preço de Tabela Varejo - Vendas após Desconto Varejo
                    const descontoVarejo = precoTabelaVarejo - faturamento.varejo;
                    return descontoVarejo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto do Varejo</CardDescription>
              </CardContent>
            </Card>
            {/* Representatividade Varejo */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-indigo-600">Representatividade Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-indigo-600 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-indigo-600 animate-spin" /> : getPercent(faturamento.varejo, 1)}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Divider entre seções */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        
        {/* Seção Franquia */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Franquia</h3>
          <div className="flex flex-wrap gap-4 justify-start">
            {/* Vendas após Desconto Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-green-600 animate-spin" /> : faturamento.franquia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-red-600 animate-spin" /> : custoBrutoFranquia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV da Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    faturamento.franquia > 0 && custoBrutoFranquia > 0
                      ? ((custoBrutoFranquia / faturamento.franquia) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Franquia (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (margemFranquia !== null ? margemFranquia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem da Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    custoBrutoFranquia > 0
                      ? (faturamento.franquia / custoBrutoFranquia).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* Preço de Tabela Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-600 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (() => {
                    let valorBrutoTotal = 0;
                    dadosFranquia.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      
                      if (row.tp_operacao === 'S') {
                        valorBrutoTotal += valorBruto;
                      }
                    });
                    return valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela da Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* Desconto Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-600 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (() => {
                    // Calcula o preço de tabela da franquia
                    let precoTabelaFranquia = 0;
                    dadosFranquia.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      if (row.tp_operacao === 'S') {
                        precoTabelaFranquia += valorBruto;
                      }
                    });
                    
                    // Desconto franquia = Preço de Tabela Franquia - Vendas após Desconto Franquia
                    const descontoFranquia = precoTabelaFranquia - faturamento.franquia;
                    return descontoFranquia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto da Franquia</CardDescription>
              </CardContent>
            </Card>
            {/* Representatividade Franquia */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-indigo-600">Representatividade Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-indigo-600 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-indigo-600 animate-spin" /> : getPercent(faturamento.franquia, 2)}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Divider entre seções */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        
        {/* Seção Multimarcas */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Multimarcas</h3>
          <div className="flex flex-wrap gap-4 justify-start">
            {/* Vendas após Desconto Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-green-600 animate-spin" /> : faturamento.multimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* Custo Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-red-600 animate-spin" /> : custoBrutoMultimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV da Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* CMV Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    faturamento.multimarcas > 0 && custoBrutoMultimarcas > 0
                      ? ((custoBrutoMultimarcas / faturamento.multimarcas) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Multimarcas (%)</CardDescription>
              </CardContent>
            </Card>
            {/* Margem Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (margemMultimarcas !== null ? margemMultimarcas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem da Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* Markup Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    custoBrutoMultimarcas > 0
                      ? (faturamento.multimarcas / custoBrutoMultimarcas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* Preço de Tabela Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-600 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (() => {
                    let valorBrutoTotal = 0;
                    dadosMultimarcas.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado; 
                      if (row.tp_operacao === 'S') {
                        valorBrutoTotal += valorBruto;
                      }
                    });
                    return valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela da Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* Desconto Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-600 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (() => {
                    // Calcula o preço de tabela da multimarcas
                    let precoTabelaMultimarcas = 0;
                    dadosMultimarcas.forEach(row => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      if (row.tp_operacao === 'S') {
                        precoTabelaMultimarcas += valorBruto;
                      }
                    });
                    
                    // Desconto multimarcas = Preço de Tabela Multimarcas - Vendas após Desconto Multimarcas
                    const descontoMultimarcas = precoTabelaMultimarcas - faturamento.multimarcas;
                    return descontoMultimarcas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto da Multimarcas</CardDescription>
              </CardContent>
            </Card>
            {/* Representatividade Multimarcas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex flex-row items-center gap-2">
                  <Percent size={18} className="text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-indigo-600">Representatividade Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-indigo-600 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-indigo-600 animate-spin" /> : getPercent(faturamento.multimarcas, 3)}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
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
          {/* Gráfico de Vendas após Desconto */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-center mb-4 text-[#000638]">Vendas após Desconto por Canal</h3>
            <Bar data={dataGraficoFaturamento} options={{...optionsGraficoMonetario, plugins: {...optionsGraficoMonetario.plugins, title: {...optionsGraficoMonetario.plugins.title, text: 'Vendas após Desconto por Canal'}}}} />
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

    {/* Modal de Ajuda */}
    {showModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">{modalContent.title}</h3>
            <button
              onClick={closeModal}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">{modalContent.description}</p>
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-xs text-gray-700 font-mono">{modalContent.calculation}</p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    )}
  </Layout>
  );
};

export default Consolidado; 