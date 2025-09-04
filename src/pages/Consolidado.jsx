import React, { useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import { CurrencyDollar, Percent, TrendUp, Question, Spinner, Truck } from '@phosphor-icons/react';
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

/* =========================
   CACHE HELPERS (localStorage)
   ========================= */
const CACHE_VERSION = 'v1';

function toISO(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function normEmpresas(arr) {
  if (!arr || !arr.length) return 'default';
  return [...arr].sort().join(',');
}
function makeCacheKey(dt_inicio, dt_fim, empresasVarejoFixas, empresasFixas, empresasSelecionadas) {
  return [
    'consolidado', CACHE_VERSION,
    toISO(dt_inicio || '1970-01-01'),
    toISO(dt_fim || '1970-01-01'),
    `empSel:${normEmpresas(empresasSelecionadas)}`,
    `empFix:${normEmpresas(empresasFixas)}`,
    `empVarFix:${normEmpresas(empresasVarejoFixas)}`
  ].join('|');
}
function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function isExpired(ts, ttlMs) {
  return (Date.now() - ts) > ttlMs;
}
function ttlForRange(dt_fim) {
  const end = new Date(toISO(dt_fim || new Date().toISOString().slice(0, 10)));
  const today = new Date(new Date().toISOString().slice(0, 10));
  const isCurrentOrFuture = end >= today;
  return isCurrentOrFuture ? (30 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000);
}
// Build dos agregados usados nos cards (leve)
function buildAggregates({
  dadosRevenda, dadosVarejo, dadosFranquia, dadosMultimarcas,
  faturamento,
}) {
  const custoMap = {};
  (custoProdutos || []).forEach(item => {
    if (item?.Codigo && item?.Custo !== undefined) {
      custoMap[item.Codigo.trim()] = item.Custo;
    }
  });
  const calcCusto = (dados, compensaEntrada = false) => (dados || [])
    .reduce((acc, r) => {
      const q = Number(r.qt_faturado) || 1;
      const c = custoMap[r.cd_nivel?.trim()];
      if (r.tp_operacao === 'S') {
        return acc + (c !== undefined ? q * c : 0);
      }
      if (compensaEntrada && r.tp_operacao === 'E') {
        return acc - (c !== undefined ? q * c : 0);
      }
      return acc;
    }, 0);

  const custoBrutoRevenda = calcCusto(dadosRevenda, true);
  const custoBrutoVarejo = calcCusto(dadosVarejo);
  const custoBrutoFranquia = calcCusto(dadosFranquia, true);
  const custoBrutoMultimarcas = calcCusto(dadosMultimarcas, true);
  const custoTotalBruto = custoBrutoRevenda + custoBrutoVarejo + custoBrutoFranquia + custoBrutoMultimarcas;

  const somaFaturamentos = (faturamento.revenda || 0) + (faturamento.varejo || 0) + (faturamento.franquia || 0) + (faturamento.multimarcas || 0);
  const cmvTotal = (somaFaturamentos > 0 && custoTotalBruto > 0) ? (custoTotalBruto / somaFaturamentos) * 100 : null;
  const markupTotal = custoTotalBruto > 0 ? (somaFaturamentos / custoTotalBruto) : null;

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
  const precoTabelaRevenda = somaBrutoSaida(dadosRevenda, true);
  const precoTabelaVarejo = somaBrutoSaida(dadosVarejo, true);
  const precoTabelaFranquia = somaBrutoSaida(dadosFranquia, true);
  const precoTabelaMultimarcas = somaBrutoSaida(dadosMultimarcas, true);
  const precoTabelaTotal = precoTabelaRevenda + precoTabelaVarejo + precoTabelaFranquia + precoTabelaMultimarcas;

  const totalGeral = somaFaturamentos;
  const descontoTotal = precoTabelaTotal - totalGeral;

  const freteRevenda = somaFrete(dadosRevenda, true);
  const freteVarejo = somaFrete(dadosVarejo, true);
  const freteFranquia = somaFrete(dadosFranquia, true);
  const freteMultimarcas = somaFrete(dadosMultimarcas, true);
  const freteTotal = freteRevenda + freteVarejo + freteFranquia + freteMultimarcas;

  const entradasRevenda = somaEntradas(dadosRevenda);
  const entradasVarejo = somaEntradas(dadosVarejo);
  const entradasFranquia = somaEntradas(dadosFranquia);
  const entradasMultimarcas = somaEntradas(dadosMultimarcas);
  const entradasTotal = entradasRevenda + entradasVarejo + entradasFranquia + entradasMultimarcas;

  return {
    faturamento: { ...faturamento, totalGeral },
    custos: {
      custoBrutoRevenda, custoBrutoVarejo, custoBrutoFranquia, custoBrutoMultimarcas, custoTotalBruto
    },
    cmvTotal,
    markupTotal,
    precos: {
      precoTabelaRevenda, precoTabelaVarejo, precoTabelaFranquia, precoTabelaMultimarcas, precoTabelaTotal, descontoTotal
    },
    fretes: {
      freteRevenda, freteVarejo, freteFranquia, freteMultimarcas, freteTotal
    },
    devolucoes: {
      entradasRevenda, entradasVarejo, entradasFranquia, entradasMultimarcas, entradasTotal
    }
  };
}
/* ========================= */

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
  const empresasFixas = ['1','2', '200', '75', '31', '6', '85', '11','99','85','92'];
  // Empresas fixas para Varejo
  const empresasVarejoFixas = ['2', '5', '500', '55', '550', '65', '650', '93', '930', '94', '940', '95', '950', '96', '960', '97', '970','90','91','92','890','910','920'];

  // Estados para armazenar os dados brutos de cada segmento
  const [dadosRevenda, setDadosRevenda] = useState([]);
  const [dadosVarejo, setDadosVarejo] = useState([]);
  const [dadosFranquia, setDadosFranquia] = useState([]);
  const [dadosMultimarcas, setDadosMultimarcas] = useState([]);

  // Agregados de cache (quando houver)
  const [agg, setAgg] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null); // { fromCache: boolean, at?: number }

  // ---- Suas funções de cálculo (reaproveitadas pelos cards quando não há agg)
  function calcularCustoBruto(dados, compensaEntrada = false) {
    if (!Array.isArray(dados) || dados.length === 0) return 0;
    const custoMap = {};
    (custoProdutos || []).forEach(item => {
      if (item?.Codigo && item?.Custo !== undefined) {
        custoMap[item.Codigo.trim()] = item.Custo;
      }
    });
    let custoTotal = 0;
    dados.forEach(row => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const custoUnit = custoMap[row.cd_nivel?.trim()];
      if (custoUnit !== undefined) {
        if (row.tp_operacao === 'S') {
          custoTotal += qtFaturado * custoUnit;
        }
        if (compensaEntrada && row.tp_operacao === 'E') {
          custoTotal -= qtFaturado * custoUnit;
        }
      }
    });
    return custoTotal;
    }
  function calcularMargemCanal(fat, custo) {
    if (fat > 0 && custo > 0) return ((fat - custo) / fat) * 100;
    return null;
  }
  function calcularCMV(dados, compensaEntrada = false) {
    if (!Array.isArray(dados) || dados.length === 0) return null;
    const custoMap = {};
    (custoProdutos || []).forEach(item => {
      if (item?.Codigo && item?.Custo !== undefined) custoMap[item.Codigo.trim()] = item.Custo;
    });
    
    let custoTotal = 0;
    let valorTotal = 0;
    
    dados.forEach(row => {
      const qt = Number(row.qt_faturado) || 1;
      const custoUnit = custoMap[row.cd_nivel?.trim()];
      const valor = (Number(row.vl_unitliquido) || 0) * qt;
      
      if (row.tp_operacao === 'S') {
        if (custoUnit !== undefined) custoTotal += qt * custoUnit;
        valorTotal += valor;
      } else if (compensaEntrada && row.tp_operacao === 'E') {
        if (custoUnit !== undefined) custoTotal -= qt * custoUnit;
        valorTotal -= valor;
      }
    });
    
    if (valorTotal > 0) return (custoTotal / valorTotal) * 100;
    return null;
  }

  const showHelpModal = (title, description, calculation) => {
    setModalContent({ title, description, calculation });
    setShowModal(true);
  };
  const closeModal = () => setShowModal(false);

  const handleFiltrar = async (e) => {
    e.preventDefault();
    setLoadingRevenda(true);
    setLoadingVarejo(true);
    setLoadingFranquia(true);
    setLoadingMultimarcas(true);
    setCacheInfo(null);
    setAgg(null);

    try {
      const key = makeCacheKey(
        filtros.dt_inicio,
        filtros.dt_fim,
        empresasVarejoFixas,
        empresasFixas,
        empresasSelecionadas
      );
      const ttl = ttlForRange(filtros.dt_fim);
      const cached = readCache(key);

      // 1) HIT de cache
      if (cached && !isExpired(cached.ts, ttl)) {
        const a = cached.data;
        setAgg(a);
        setFaturamento({
          revenda: a.faturamento.revenda,
          varejo: a.faturamento.varejo,
          franquia: a.faturamento.franquia,
          multimarcas: a.faturamento.multimarcas,
        });
        // Não precisamos dos brutos pra exibir cards
        setDadosRevenda([]); setDadosVarejo([]); setDadosFranquia([]); setDadosMultimarcas([]);

        setLoadingRevenda(false); setLoadingVarejo(false); setLoadingFranquia(false); setLoadingMultimarcas(false);
        setCacheInfo({ fromCache: true, at: cached.ts });
        return;
      }

      // 2) MISS de cache → chama APIs
      // Revenda
      const paramsRevenda = { dt_inicio: filtros.dt_inicio, dt_fim: filtros.dt_fim, cd_empresa: empresasFixas };
      const resultRevenda = await apiClient.sales.faturamentoRevenda(paramsRevenda);
      if (!resultRevenda.success) throw new Error(resultRevenda.message || 'Erro ao buscar faturamento de revenda');
        // Filtra por classificação 1 e 3, priorizando classificação 3
        const filtradosRevenda = resultRevenda.data.filter(row => {
          const cls = String(row.cd_classificacao ?? '').trim();
          return cls === '1' || cls === '3';
        }).filter((row, index, array) => {
          const currentPessoa = row.cd_pessoa;
          const currentClass = String(row.cd_classificacao ?? '').trim();
          
          // Se a classificação atual é 3, sempre mantém
          if (currentClass === '3') return true;
          
          // Se a classificação atual é 1, verifica se existe classificação 3 para o mesmo cd_pessoa
          if (currentClass === '1') {
            const hasClass3 = array.some(item => 
              item.cd_pessoa === currentPessoa && 
              String(item.cd_classificacao ?? '').trim() === '3'
            );
            // Só mantém se NÃO existir classificação 3 para este cd_pessoa
            return !hasClass3;
          }
          
          return false;
        });
        const somaSaidasRevenda = filtradosRevenda
          .filter(row => row.tp_operacao === 'S')
          .reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
        const somaEntradasRevenda = filtradosRevenda
          .filter(row => row.tp_operacao === 'E')
          .reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
        const totalRevenda = somaSaidasRevenda - somaEntradasRevenda;
        setFaturamento(fat => ({ ...fat, revenda: totalRevenda }));
        setDadosRevenda(filtradosRevenda);
      setLoadingRevenda(false);

      // Varejo
      const paramsVarejo = { dt_inicio: filtros.dt_inicio, dt_fim: filtros.dt_fim, cd_empresa: empresasVarejoFixas };
      const resultVarejo = await apiClient.sales.faturamento(paramsVarejo);
      if (!resultVarejo.success) throw new Error(resultVarejo.message || 'Erro ao buscar faturamento de varejo');
        const somaSaidasVarejo = resultVarejo.data
        .filter(r => r.tp_operacao === 'S')
        .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const somaEntradasVarejo = resultVarejo.data
        .filter(r => r.tp_operacao === 'E')
        .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const totalVarejo = somaSaidasVarejo - somaEntradasVarejo;
        setFaturamento(fat => ({ ...fat, varejo: totalVarejo }));
        setDadosVarejo(resultVarejo.data);
      setLoadingVarejo(false);

      // Franquia
      const paramsFranquia = { dt_inicio: filtros.dt_inicio, dt_fim: filtros.dt_fim, cd_empresa: empresasFixas };
      const resultFranquia = await apiClient.sales.faturamentoFranquia(paramsFranquia);
      if (!resultFranquia.success) throw new Error(resultFranquia.message || 'Erro ao buscar faturamento de franquia');
        const somaSaidasFranquia = resultFranquia.data
        .filter(r => r.tp_operacao === 'S')
        .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const somaEntradasFranquia = resultFranquia.data
        .filter(r => r.tp_operacao === 'E')
        .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const totalFranquia = somaSaidasFranquia - somaEntradasFranquia;
        setFaturamento(fat => ({ ...fat, franquia: totalFranquia }));
        setDadosFranquia(resultFranquia.data);
      setLoadingFranquia(false);

      // Multimarcas
      const paramsMultimarcas = { dt_inicio: filtros.dt_inicio, dt_fim: filtros.dt_fim, cd_empresa: empresasFixas };
      const resultMultimarcas = await apiClient.sales.faturamentoMtm(paramsMultimarcas);
      if (!resultMultimarcas.success) throw new Error(resultMultimarcas.message || 'Erro ao buscar faturamento de multimarcas');
        const somaSaidasMultimarcas = resultMultimarcas.data
        .filter(r => r.tp_operacao === 'S')
        .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const somaEntradasMultimarcas = resultMultimarcas.data
        .filter(r => r.tp_operacao === 'E')
        .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
        const totalMultimarcas = somaSaidasMultimarcas - somaEntradasMultimarcas;
        setFaturamento(fat => ({ ...fat, multimarcas: totalMultimarcas }));
        setDadosMultimarcas(resultMultimarcas.data);
      setLoadingMultimarcas(false);

      // 3) Monta agregados e grava no cache
      const aggregates = buildAggregates({
        dadosRevenda: filtradosRevenda,
        dadosVarejo: resultVarejo.data,
        dadosFranquia: resultFranquia.data,
        dadosMultimarcas: resultMultimarcas.data,
        faturamento: {
          revenda: totalRevenda,
          varejo: totalVarejo,
          franquia: totalFranquia,
          multimarcas: totalMultimarcas,
        }
      });
      setAgg(aggregates);
      writeCache(key, aggregates);
      setCacheInfo({ fromCache: false, at: Date.now() });

    } catch (error) {
      console.error('❌ Erro ao buscar dados:', error);
      setFaturamento({ revenda: 0, varejo: 0, franquia: 0, multimarcas: 0 });
      setDadosRevenda([]); setDadosVarejo([]); setDadosFranquia([]); setDadosMultimarcas([]);
      setLoadingRevenda(false); setLoadingVarejo(false); setLoadingFranquia(false); setLoadingMultimarcas(false);
      setAgg(null);
      setCacheInfo(null);
    }
  };

  // ======= DERIVADOS PARA UI (preferindo agg quando existir) =======
  // Calcula o total baseado nos valores dos cards individuais para garantir consistência
  const totalGeralUI = agg?.faturamento.totalGeral ?? (() => {
    // Usa os mesmos cálculos dos cards individuais
    const revendaCard = dadosRevenda.reduce((acc, row) => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') acc += valor;
      else if (row.tp_operacao === 'E') acc -= valor;
      return acc;
    }, 0);
    
    const varejoCard = dadosVarejo.reduce((acc, row) => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') acc += valor;
      return acc;
    }, 0);
    
    const franquiaCard = dadosFranquia.reduce((acc, row) => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') acc += valor;
      else if (row.tp_operacao === 'E') acc -= valor;
      return acc;
    }, 0);
    
    const multimarcasCard = dadosMultimarcas.reduce((acc, row) => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') acc += valor;
      else if (row.tp_operacao === 'E') acc -= valor;
      return acc;
    }, 0);
    
    // Debug: mostra os valores calculados
    console.log('🔍 Debug - Valores calculados:', {
      revendaCard: revendaCard.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      varejoCard: varejoCard.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      franquiaCard: franquiaCard.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      multimarcasCard: multimarcasCard.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      totalCalculado: (revendaCard + varejoCard + multimarcasCard + franquiaCard).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      totalEstado: (faturamento.revenda + faturamento.varejo + faturamento.franquia + faturamento.multimarcas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    });
    
    return revendaCard + varejoCard + franquiaCard + multimarcasCard;
  })();

          const custoBrutoRevenda = agg?.custos.custoBrutoRevenda ?? calcularCustoBruto(dadosRevenda, true);
  const custoBrutoVarejo = agg?.custos.custoBrutoVarejo ?? calcularCustoBruto(dadosVarejo);
          const custoBrutoFranquia = agg?.custos.custoBrutoFranquia ?? calcularCustoBruto(dadosFranquia, true);
        const custoBrutoMultimarcas = agg?.custos.custoBrutoMultimarcas ?? calcularCustoBruto(dadosMultimarcas, true);
  const custoTotalBrutoUI = agg?.custos.custoTotalBruto ?? (custoBrutoRevenda + custoBrutoVarejo + custoBrutoFranquia + custoBrutoMultimarcas);

  const cmvRevenda = calcularCMV(dadosRevenda, true);
  const cmvVarejo = calcularCMV(dadosVarejo);
  const cmvFranquia = calcularCMV(dadosFranquia, true);
  const cmvMultimarcas = calcularCMV(dadosMultimarcas, true);

  const cmvTotalUI = agg?.cmvTotal ?? (
    totalGeralUI > 0 && custoTotalBrutoUI > 0 ? (custoTotalBrutoUI / totalGeralUI) * 100 : null
  );

  const markupTotalUI = agg?.markupTotal ?? (custoTotalBrutoUI > 0 ? totalGeralUI / custoTotalBrutoUI : null);

  const precoTabelaTotalUI = agg?.precos.precoTabelaTotal ?? (() => {
    let total = 0;
    [dadosRevenda, dadosVarejo, dadosFranquia, dadosMultimarcas].forEach((dados, idx) => {
      dados.forEach(row => {
        const q = Number(row.qt_faturado) || 1;
        const bruto = (Number(row.vl_unitbruto) || 0) * q;
        if (row.tp_operacao === 'S') total += bruto;
        // Revenda (idx 0), Franquia (idx 2) e Multimarcas (idx 3) compensam entrada
        if ((idx === 0 || idx === 2 || idx === 3) && row.tp_operacao === 'E') total -= bruto;
      });
    });
    return total;
  })();

  const descontoTotalUI = agg?.precos.descontoTotal ?? (precoTabelaTotalUI - totalGeralUI);

  // Fretes derivados para UI
  function calcularFrete(dados, compensaEntrada = true) {
    if (!Array.isArray(dados) || dados.length === 0) return 0;
    let total = 0;
    dados.forEach(row => {
      const frete = Number(row.vl_freterat) || 0;
      if (row.tp_operacao === 'S') total += frete;
      if (compensaEntrada && row.tp_operacao === 'E') total -= frete;
    });
    return total;
  }
  const freteRevendaUI = agg?.fretes?.freteRevenda ?? calcularFrete(dadosRevenda, true);
  const freteVarejoUI = agg?.fretes?.freteVarejo ?? calcularFrete(dadosVarejo, true);
  const freteFranquiaUI = agg?.fretes?.freteFranquia ?? calcularFrete(dadosFranquia, true);
  const freteMultimarcasUI = agg?.fretes?.freteMultimarcas ?? calcularFrete(dadosMultimarcas, true);

  // Devoluções (entradas 'E') derivados para UI
  const calcularEntradas = (dados) => {
    if (!Array.isArray(dados) || dados.length === 0) return 0;
    return dados.reduce((acc, row) => {
      if (row.tp_operacao === 'E') {
        const q = Number(row.qt_faturado) || 1;
        const valor = (Number(row.vl_unitliquido) || 0) * q;
        return acc + valor;
      }
      return acc;
    }, 0);
  };
  const entradasRevendaUI = agg?.devolucoes?.entradasRevenda ?? calcularEntradas(dadosRevenda);
  const entradasVarejoUI = agg?.devolucoes?.entradasVarejo ?? calcularEntradas(dadosVarejo);
  const entradasFranquiaUI = agg?.devolucoes?.entradasFranquia ?? calcularEntradas(dadosFranquia);
  const entradasMultimarcasUI = agg?.devolucoes?.entradasMultimarcas ?? calcularEntradas(dadosMultimarcas);
  const entradasTotalUI = agg?.devolucoes?.entradasTotal ?? (entradasRevendaUI + entradasVarejoUI + entradasFranquiaUI + entradasMultimarcasUI);

  // Vendas após desconto somadas ao frete (S - E de frete)
  const vendasRevendaComFrete = (faturamento.revenda || 0) + (freteRevendaUI || 0);
  const vendasVarejoComFrete = (faturamento.varejo || 0) + (freteVarejoUI || 0);
  const vendasFranquiaComFrete = (faturamento.franquia || 0) + (freteFranquiaUI || 0);
  const vendasMultimarcasComFrete = (faturamento.multimarcas || 0) + (freteMultimarcasUI || 0);
  const totalGeralComFreteUI = vendasRevendaComFrete + vendasVarejoComFrete + vendasFranquiaComFrete + vendasMultimarcasComFrete;

  

  // Representatividade (sua lógica original)
  const totalGeral = totalGeralComFreteUI;
  const getPercent = (valor, canalIndex = 0) => {
    if (totalGeral > 0) {
      const percentRevenda = (vendasRevendaComFrete / totalGeral) * 100;
      const percentVarejo = (vendasVarejoComFrete / totalGeral) * 100;
      const percentFranquia = (vendasFranquiaComFrete / totalGeral) * 100;
      const percentMultimarcas = (vendasMultimarcasComFrete / totalGeral) * 100;
      const r = Math.round(percentRevenda * 100) / 100;
      const v = Math.round(percentVarejo * 100) / 100;
      const f = Math.round(percentFranquia * 100) / 100;
      const m = Math.round(percentMultimarcas * 100) / 100;
      const somaTotal = r + v + f + m;

      const valores = [
        { valor: r, index: 0 },
        { valor: v, index: 1 },
        { valor: f, index: 2 },
        { valor: m, index: 3 }
      ];

      if (somaTotal > 100) {
        const excesso = somaTotal - 100;
        const maior = valores.reduce((max, a) => a.valor > max.valor ? a : max);
        const base = [r, v, f, m];
        if (canalIndex === maior.index) base[canalIndex] = maior.valor - excesso;
        return base[canalIndex].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
      }
      if (somaTotal < 100) {
        const deficit = 100 - somaTotal;
        const menor = valores.reduce((min, a) => a.valor < min.valor ? a : min);
        const base = [r, v, f, m];
        if (canalIndex === menor.index) base[canalIndex] = menor.valor + deficit;
        return base[canalIndex].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
      }
      const base = [r, v, f, m];
      return base[canalIndex].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
    return '-';
  };

  return (
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start mt-10">
      <h1 className="text-3xl font-bold mb-2 text-center text-[#000638]">Consolidado</h1>

      {/* Badge de cache + botão Atualizar */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {cacheInfo && (
          <span className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-700 bg-gray-100">
            {cacheInfo.fromCache ? 'Em cache' : 'Atualizado agora'} • {cacheInfo.at ? new Date(cacheInfo.at).toLocaleString('pt-BR') : ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            const key = makeCacheKey(
              filtros.dt_inicio, filtros.dt_fim,
              empresasVarejoFixas, empresasFixas, empresasSelecionadas
            );
            try { localStorage.removeItem(key); } catch {}
            // força refresh
            handleFiltrar({ preventDefault: () => {} });
          }}
          className="text-xs px-3 py-1 rounded-md bg-[#000638] text-white hover:bg-[#fe0000] transition"
        >
          Atualizar
        </button>
      </div>

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
                : totalGeralUI.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Soma dos canais</CardDescription>
                <button
                onClick={() => showHelpModal('Vendas após Desconto','O valor das vendas menos o desconto aplicado. Representa as vendas após desconto total.','Ex.: R$1.000,00 - R$100,00 = R$900,00')}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>

        {/* CMV total (R$) */}
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
                : (custoTotalBrutoUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Soma dos custos dos canais</CardDescription>
                <button
                onClick={() => showHelpModal('CMV (Custo da Mercadoria Vendida)','Soma dos custos de produção dos produtos, de todos os canais.','CMV Total = Σ( custos por canal )')}
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
                : (cmvTotalUI !== null ? cmvTotalUI.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--')}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">CMV / Vendas após Desconto</CardDescription>
                <button
                onClick={() => showHelpModal('CMV Percentual (%)','Percentual do CMV em relação às vendas após desconto.','CMV % = (CMV / Vendas) × 100')}
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
                : (totalGeralUI > 0 && custoTotalBrutoUI > 0
                    ? (((totalGeralUI - custoTotalBrutoUI) / totalGeralUI) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--')}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Vendas após Desconto - CMV</CardDescription>
                <button
                onClick={() => showHelpModal('Margem Total (%)','Percentual de lucro bruto em relação às vendas após desconto.','Margem % = ((Vendas - CMV) / Vendas) × 100')}
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
                : (markupTotalUI !== null ? markupTotalUI.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--')}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Média ponderada dos canais</CardDescription>
                <button
                onClick={() => showHelpModal('Markup Total','Quantas vezes o preço de venda é maior que o custo.','Markup = Vendas / CMV')}
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
                : (precoTabelaTotalUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
              <CardDescription className="text-xs text-gray-500">Vendas antes dos descontos</CardDescription>
                <button
                onClick={() => showHelpModal('Preço Total de Tabela','Soma dos valores tabelados (sem desconto) de todos os canais.','Σ Preço de Tabela por canal')}
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
                : (descontoTotalUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
              <CardDescription className="text-xs text-gray-500">Tabela - Pós-desconto</CardDescription>
                <button
                onClick={() => showHelpModal('Desconto Total','Diferença entre o preço total de tabela e as vendas após desconto.','Desconto = Tabela - Vendas')}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Frete Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <Truck size={18} className="text-gray-700" />
                <CardTitle className="text-sm font-bold text-gray-700">Frete Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-gray-800 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-gray-600 animate-spin" />
                : (freteRevendaUI + freteVarejoUI + freteFranquiaUI + freteMultimarcasUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Soma dos fretes de todos os canais</CardDescription>
                <button
                onClick={() => showHelpModal('Frete Total','Soma dos valores de frete rateado de todos os canais (S - E).','Frete Total = Σ Frete por canal')}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Devoluções Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex flex-row items-center gap-2">
                <CurrencyDollar size={18} className="text-gray-800" />
                <CardTitle className="text-sm font-bold text-gray-800">Devoluções</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-gray-900 mb-1">
                {(loadingRevenda || loadingVarejo || loadingFranquia || loadingMultimarcas)
                  ? <Spinner size={24} className="text-gray-700 animate-spin" />
                : (entradasTotalUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="flex justify-between items-center">
                <CardDescription className="text-xs text-gray-500">Soma das entradas (E) de todos os canais</CardDescription>
                <button
                  onClick={() => showHelpModal('Devoluções','Soma dos valores de transações de entrada (E) de todos os canais.','Devoluções = Σ Entradas (E) por canal')}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Question size={12} className="text-gray-600" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* ====== SEÇÕES POR CANAL (mantidas, agora com custos podendo vir do agg) ====== */}
      {/* Revenda */}
      <div className="w-full border-t-2 border-gray-200 my-6"></div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Revenda</h3>
            <div className="flex flex-wrap gap-4 justify-start">
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loadingRevenda ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.revenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Revenda</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                {loadingRevenda ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoRevenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV da Revenda</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                  (faturamento.revenda > 0 && custoBrutoRevenda > 0)
                      ? ((custoBrutoRevenda / faturamento.revenda) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Revenda (%)</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                {loadingRevenda ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
                  (() => {
                    const margem = calcularMargemCanal(faturamento.revenda, custoBrutoRevenda);
                    return margem !== null ? margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                  })()
                )}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem da Revenda</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                  custoBrutoRevenda > 0 ? (faturamento.revenda / custoBrutoRevenda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Revenda</CardDescription>
              </CardContent>
            </Card>

            {/* Preço de Tabela Revenda */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
                    (agg?.precos?.precoTabelaRevenda ?? (() => {
                      let total = 0;
                      (dadosRevenda || []).forEach(row => {
                        const q = Number(row.qt_faturado) || 1;
                        const bruto = (Number(row.vl_unitbruto) || 0) * q;
                        if (row.tp_operacao === 'S') total += bruto;
                        else if (row.tp_operacao === 'E') total -= bruto;
                      });
                      return total;
                    })()) || 0
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela da Revenda</CardDescription>
              </CardContent>
            </Card>

            {/* Desconto Revenda */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    (() => {
                      const precoTabela = agg?.precos?.precoTabelaRevenda ?? (() => {
                        let total = 0;
                        (dadosRevenda || []).forEach(row => {
                          const q = Number(row.qt_faturado) || 1;
                          const bruto = (Number(row.vl_unitbruto) || 0) * q;
                          if (row.tp_operacao === 'S') total += bruto;
                          else if (row.tp_operacao === 'E') total -= bruto;
                        });
                        return total;
                      })();
                      return (precoTabela - faturamento.revenda) || 0;
                    })()
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto da Revenda</CardDescription>
              </CardContent>
            </Card>

            {/* Devoluções Revenda */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-gray-800" />
                  <CardTitle className="text-sm font-bold text-gray-800">Devoluções Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-900 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasRevendaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Entradas (E) na Revenda</CardDescription>
              </CardContent>
            </Card>

            {/* Representatividade Revenda */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Representatividade Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    (() => {
                      const totalGeral = (faturamento.revenda || 0) + (faturamento.varejo || 0) + (faturamento.franquia || 0) + (faturamento.multimarcas || 0);
                      return totalGeral > 0 ? ((faturamento.revenda / totalGeral) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                    })()
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-700">Frete Revenda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-800 mb-1">
                  {loadingRevenda ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteRevendaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Frete rateado (S - E)</CardDescription>
              </CardContent>
            </Card>
          </div>
                </div>
        
      {/* Varejo */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Varejo</h3>
          <div className="flex flex-wrap gap-4 justify-start">
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loadingVarejo ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.varejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Varejo</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                {loadingVarejo ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoVarejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV do Varejo</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                  (faturamento.varejo > 0 && custoBrutoVarejo > 0)
                      ? ((custoBrutoVarejo / faturamento.varejo) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Varejo (%)</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                {loadingVarejo ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
                  (() => {
                    const margem = calcularMargemCanal(faturamento.varejo, custoBrutoVarejo);
                    return margem !== null ? margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                  })()
                )}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem do Varejo</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                  custoBrutoVarejo > 0 ? (faturamento.varejo / custoBrutoVarejo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Varejo</CardDescription>
              </CardContent>
            </Card>

            {/* Preço de Tabela Varejo */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
                    (agg?.precos?.precoTabelaVarejo ?? (() => {
                      let total = 0;
                      (dadosVarejo || []).forEach(row => {
                        const q = Number(row.qt_faturado) || 1;
                        const bruto = (Number(row.vl_unitbruto) || 0) * q;
                        if (row.tp_operacao === 'S') total += bruto;
                        if (row.tp_operacao === 'E') total -= bruto; // Compensação de entrada para varejo
                      });
                      return total;
                    })()) || 0
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela do Varejo</CardDescription>
              </CardContent>
            </Card>

            {/* Desconto Varejo */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    (() => {
                      const precoTabela = agg?.precos?.precoTabelaVarejo ?? (() => {
                        let total = 0;
                        (dadosVarejo || []).forEach(row => {
                          const q = Number(row.qt_faturado) || 1;
                          const bruto = (Number(row.vl_unitbruto) || 0) * q;
                          if (row.tp_operacao === 'S') total += bruto;
                          if (row.tp_operacao === 'E') total -= bruto; // Compensação de entrada para varejo
                        });
                        return total;
                      })();
                      return (precoTabela - faturamento.varejo) || 0;
                    })()
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto do Varejo</CardDescription>
              </CardContent>
            </Card>

            {/* Devoluções Varejo */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-gray-800" />
                  <CardTitle className="text-sm font-bold text-gray-800">Devoluções Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-900 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasVarejoUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Entradas (E) no Varejo</CardDescription>
              </CardContent>
            </Card>

            {/* Representatividade Varejo */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Representatividade Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    (() => {
                      const totalGeral = (faturamento.revenda || 0) + (faturamento.varejo || 0) + (faturamento.franquia || 0) + (faturamento.multimarcas || 0);
                      return totalGeral > 0 ? ((faturamento.varejo / totalGeral) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                    })()
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-700">Frete Varejo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-800 mb-1">
                  {loadingVarejo ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteVarejoUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Frete rateado (S - E)</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
        
      {/* Franquia */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Franquia</h3>
          <div className="flex flex-wrap gap-4 justify-start">
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loadingFranquia ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.franquia || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Franquia</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                {loadingFranquia ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoFranquia || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV da Franquia</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                  (faturamento.franquia > 0 && custoBrutoFranquia > 0)
                      ? ((custoBrutoFranquia / faturamento.franquia) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Franquia (%)</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                {loadingFranquia ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
                  (() => {
                    const margem = calcularMargemCanal(faturamento.franquia, custoBrutoFranquia);
                    return margem !== null ? margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                  })()
                )}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem da Franquia</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                  custoBrutoFranquia > 0 ? (faturamento.franquia / custoBrutoFranquia).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Franquia</CardDescription>
              </CardContent>
            </Card>

            {/* Preço de Tabela Franquia */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
                    (agg?.precos?.precoTabelaFranquia ?? (() => {
                      let total = 0;
                      (dadosFranquia || []).forEach(row => {
                        const q = Number(row.qt_faturado) || 1;
                        const bruto = (Number(row.vl_unitbruto) || 0) * q;
                        if (row.tp_operacao === 'S') total += bruto;
                      });
                      return total;
                    })()) || 0
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela da Franquia</CardDescription>
              </CardContent>
            </Card>

            {/* Desconto Franquia */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    (() => {
                      const precoTabela = agg?.precos?.precoTabelaFranquia ?? (() => {
                        let total = 0;
                        (dadosFranquia || []).forEach(row => {
                          const q = Number(row.qt_faturado) || 1;
                          const bruto = (Number(row.vl_unitbruto) || 0) * q;
                          if (row.tp_operacao === 'S') total += bruto;
                        });
                        return total;
                      })();
                      return (precoTabela - faturamento.franquia) || 0;
                    })()
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto da Franquia</CardDescription>
              </CardContent>
            </Card>

            {/* Devoluções Franquia */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-gray-800" />
                  <CardTitle className="text-sm font-bold text-gray-800">Devoluções Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-900 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasFranquiaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Entradas (E) na Franquia</CardDescription>
              </CardContent>
            </Card>

            {/* Representatividade Franquia */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Representatividade Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    (() => {
                      const totalGeral = (faturamento.revenda || 0) + (faturamento.varejo || 0) + (faturamento.franquia || 0) + (faturamento.multimarcas || 0);
                      return totalGeral > 0 ? ((faturamento.franquia / totalGeral) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                    })()
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-700">Frete Franquia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-800 mb-1">
                  {loadingFranquia ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteFranquiaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Frete rateado (S - E)</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
        
      {/* Multimarcas */}
        <div className="w-full border-t border-gray-200 my-4"></div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left ml-10">Multimarcas</h3>
          <div className="flex flex-wrap gap-4 justify-start">
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-green-700" />
                  <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loadingMultimarcas ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.multimarcas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Total Multimarcas</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-700" />
                  <CardTitle className="text-sm font-bold text-red-700">CMV Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-700 mb-1">
                {loadingMultimarcas ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoMultimarcas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV da Multimarcas</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">CMV Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                  (faturamento.multimarcas > 0 && custoBrutoMultimarcas > 0)
                      ? ((custoBrutoMultimarcas / faturamento.multimarcas) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                      : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">CMV Multimarcas (%)</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-yellow-700">Margem Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                {loadingMultimarcas ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
                  (() => {
                    const margem = calcularMargemCanal(faturamento.multimarcas, custoBrutoMultimarcas);
                    return margem !== null ? margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                  })()
                )}
                </div>
                <CardDescription className="text-xs text-gray-500">Margem da Multimarcas</CardDescription>
              </CardContent>
            </Card>

          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <TrendUp size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Markup Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                  custoBrutoMultimarcas > 0 ? (faturamento.multimarcas / custoBrutoMultimarcas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">Markup Multimarcas</CardDescription>
              </CardContent>
            </Card>

            {/* Preço de Tabela Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
                    (agg?.precos?.precoTabelaMultimarcas ?? (() => {
                      let total = 0;
                      (dadosMultimarcas || []).forEach(row => {
                        const q = Number(row.qt_faturado) || 1;
                        const bruto = (Number(row.vl_unitbruto) || 0) * q;
                        if (row.tp_operacao === 'S') total += bruto;
                      });
                      return total;
                    })()) || 0
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Preço de Tabela da Multimarcas</CardDescription>
              </CardContent>
            </Card>

            {/* Desconto Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-600">Desconto Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-orange-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                    (() => {
                      const precoTabela = agg?.precos?.precoTabelaMultimarcas ?? (() => {
                        let total = 0;
                        (dadosMultimarcas || []).forEach(row => {
                          const q = Number(row.qt_faturado) || 1;
                          const bruto = (Number(row.vl_unitbruto) || 0) * q;
                          if (row.tp_operacao === 'S') total += bruto;
                        });
                        return total;
                      })();
                      return (precoTabela - faturamento.multimarcas) || 0;
                    })()
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Desconto da Multimarcas</CardDescription>
              </CardContent>
            </Card>

            {/* Devoluções Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-gray-800" />
                  <CardTitle className="text-sm font-bold text-gray-800">Devoluções Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-900 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasMultimarcasUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Entradas (E) na Multimarcas</CardDescription>
              </CardContent>
            </Card>

            {/* Representatividade Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                  <Percent size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-600">Representatividade Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                    (() => {
                      const totalGeral = (faturamento.revenda || 0) + (faturamento.varejo || 0) + (faturamento.franquia || 0) + (faturamento.multimarcas || 0);
                      return totalGeral > 0 ? ((faturamento.multimarcas / totalGeral) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                    })()
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-gray-700" />
                  <CardTitle className="text-sm font-bold text-gray-700">Frete Multimarcas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-gray-800 mb-1">
                  {loadingMultimarcas ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteMultimarcasUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <CardDescription className="text-xs text-gray-500">Frete rateado (S - E)</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>

    {/* Modal de Ajuda */}
    {showModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">{modalContent.title}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-xl font-bold">×</button>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">{modalContent.description}</p>
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-xs text-gray-700 font-mono">{modalContent.calculation}</p>
            </div>
          </div>
            <button onClick={closeModal} className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium">
            Fechar
          </button>
        </div>
      </div>
    )}
    </div>
  );
};

export default Consolidado; 
