import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import { CurrencyDollar, Percent, TrendUp, Question, Spinner, Truck } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
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
   OTIMIZAÇÕES DE PERFORMANCE
   ========================= */
const CACHE_VERSION = 'v2';
const MAX_CACHE_SIZE = 50; // Máximo de entradas no cache
const DEBOUNCE_DELAY = 300; // ms para debounce
const MAX_CONCURRENT_REQUESTS = 4; // Máximo de requisições simultâneas

// Compressão simples para cache
function compressData(data) {
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return JSON.stringify(data);
  }
}

function decompressData(compressed) {
  try {
    return JSON.parse(atob(compressed));
  } catch {
    return JSON.parse(compressed);
  }
}

// Cache helpers otimizados
function toISO(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function normEmpresas(arr) {
  if (!arr || !arr.length) return 'default';
  return [...arr].sort().join(',');
}
function makeCacheKey(dt_inicio, dt_fim, empresasSelecionadas) {
  return [
    'consolidado', CACHE_VERSION,
    toISO(dt_inicio || '1970-01-01'),
    toISO(dt_fim || '1970-01-01'),
    `emp:${normEmpresas(empresasSelecionadas)}`
  ].join('|');
}

function writeCache(key, data) {
  try {
    // Limpa cache antigo se necessário
    cleanOldCache();
    
    const compressed = compressData(data);
    const entry = { ts: Date.now(), data: compressed, size: JSON.stringify(data).length };
    localStorage.setItem(key, JSON.stringify(entry));
    
    // Atualiza índice de cache
    updateCacheIndex(key, entry.size);
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    
    const entry = JSON.parse(raw);
    const data = decompressData(entry.data);
    
    return { ts: entry.ts, data };
  } catch { return null; }
}

function cleanOldCache() {
  try {
    const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('consolidado|'));
    if (cacheKeys.length > MAX_CACHE_SIZE) {
      // Remove os mais antigos
      const entries = cacheKeys.map(key => ({
        key,
        ts: JSON.parse(localStorage.getItem(key) || '{}').ts || 0
      })).sort((a, b) => a.ts - b.ts);
      
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE + 5);
      toRemove.forEach(entry => localStorage.removeItem(entry.key));
    }
  } catch (e) {
    console.warn('Cache cleanup failed:', e);
  }
}

function updateCacheIndex(key, size) {
  try {
    const index = JSON.parse(localStorage.getItem('cache_index') || '{}');
    index[key] = { ts: Date.now(), size };
    localStorage.setItem('cache_index', JSON.stringify(index));
  } catch {}
}

function isExpired(ts, ttlMs) {
  return (Date.now() - ts) > ttlMs;
}

// TTL dinâmico baseado no período e horário
function ttlForRange(dt_fim) {
  const end = new Date(toISO(dt_fim || new Date().toISOString().slice(0, 10)));
  const today = new Date(new Date().toISOString().slice(0, 10));
  const isCurrentOrFuture = end >= today;
  const currentHour = new Date().getHours();
  
  // Horário comercial: cache mais curto
  const isBusinessHours = currentHour >= 8 && currentHour <= 18;
  
  if (isCurrentOrFuture) {
    return isBusinessHours ? (15 * 60 * 1000) : (45 * 60 * 1000); // 15min ou 45min
  }
  
  return (4 * 60 * 60 * 1000); // 4 horas para dados históricos
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
  const debounceRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeRequestsRef = useRef(0);

  const [filtros, setFiltros] = useState({ dt_inicio: '', dt_fim: '' });
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

  const [faturamento, setFaturamento] = useState({
    revenda: 0,
    varejo: 0,
    franquia: 0,
    multimarcas: 0,
  });

  // Loading unificado para melhor UX
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [dadosCarregados, setDadosCarregados] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', description: '', calculation: '' });

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

  // Função auxiliar para processar dados de revenda
  const processRevendaData = useCallback((data) => {
    const filtrados = data.filter(row => {
      const cls = String(row.cd_classificacao ?? '').trim();
      return cls === '1' || cls === '3';
    }).filter((row, index, array) => {
      const currentPessoa = row.cd_pessoa;
      const currentClass = String(row.cd_classificacao ?? '').trim();
      
      if (currentClass === '3') return true;
      if (currentClass === '1') {
        const hasClass3 = array.some(item => 
          item.cd_pessoa === currentPessoa && 
          String(item.cd_classificacao ?? '').trim() === '3'
        );
        return !hasClass3;
      }
      return false;
    });

    const saidas = filtrados.filter(r => r.tp_operacao === 'S')
      .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
    const entradas = filtrados.filter(r => r.tp_operacao === 'E')
      .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
    
    return { filtrados, total: saidas - entradas };
  }, []);

  // Função auxiliar para processar dados gerais
  const processGeneralData = useCallback((data) => {
    const saidas = data.filter(r => r.tp_operacao === 'S')
      .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
    const entradas = data.filter(r => r.tp_operacao === 'E')
      .reduce((acc, r) => acc + ((Number(r.vl_unitliquido) || 0) * (Number(r.qt_faturado) || 1)), 0);
    
    return { total: saidas - entradas };
  }, []);

  const handleFiltrar = useCallback(async (e) => {
    e?.preventDefault?.();
    
    // Validação obrigatória de empresas
    if (!empresasSelecionadas?.length) {
      console.warn('⚠️ Nenhuma empresa selecionada');
      return;
    }
    
    // Previne sobrecarga de requisições
    if (activeRequestsRef.current >= MAX_CONCURRENT_REQUESTS) {
      console.warn('⚠️ Muitas requisições ativas, aguardando...');
      return;
    }
    
    // Cancela requisições anteriores
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    activeRequestsRef.current++;
    setLoading(true);
    setLoadingProgress(0);
    setCacheInfo(null);
    setAgg(null);

    try {
      const key = makeCacheKey(
        filtros.dt_inicio,
        filtros.dt_fim,
        empresasSelecionadas.map(emp => emp.cd_empresa || emp)
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
        setDadosRevenda([]); 
        setDadosVarejo([]); 
        setDadosFranquia([]); 
        setDadosMultimarcas([]);
        setLoading(false);
        setLoadingProgress(100);
        setDadosCarregados(true);
        setCacheInfo({ fromCache: true, at: cached.ts });
        return;
      }

      // 2) MISS de cache → chama todas as APIs em paralelo
      console.log('🚀 Iniciando chamadas paralelas das APIs...');
      // Extrair códigos das empresas do formato de objeto
      const codigosEmpresas = empresasSelecionadas.map(emp => emp.cd_empresa || emp);

      // Helper: dividir empresas em lotes menores para evitar 500 no backend
      const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      // Tamanho do lote: 12 empresas por requisição (ajustável)
      const companyChunks = chunkArray(codigosEmpresas, 12);

      // Helper: buscar todos os lotes para uma rota e concatenar resultados
      const fetchAllChunks = async (routeFn) => {
        const results = await Promise.allSettled(
          companyChunks.map(chunk => routeFn({ dt_inicio: filtros.dt_inicio, dt_fim: filtros.dt_fim, cd_empresa: chunk }))
        );
        const okResults = results.filter(r => r.status === 'fulfilled' && r.value?.success).map(r => r.value);
        const dataConcat = okResults.flatMap(r => Array.isArray(r.data) ? r.data : []);
        const totalsSum = okResults.reduce((acc, r) => {
          const t = r.totals || r.metadata?.totals || {};
          acc.totalBruto += Number(t.totalBruto || 0);
          acc.totalLiquido += Number(t.totalLiquido || 0);
          acc.totalQuantidade += Number(t.totalQuantidade || 0);
          return acc;
        }, { totalBruto: 0, totalLiquido: 0, totalQuantidade: 0 });
        const anyFailure = results.some(r => r.status === 'rejected' || (r.value && !r.value.success));
        return { success: !anyFailure, data: dataConcat, totals: totalsSum };
      };
      
      console.log('📊 Parâmetros:', {
        periodo: { dt_inicio: filtros.dt_inicio, dt_fim: filtros.dt_fim },
        empresasSelecionadas: empresasSelecionadas.length,
        codigosEmpresas: codigosEmpresas
      });
      const startTime = Date.now();

      const [resultRevenda, resultVarejo, resultFranquia, resultMultimarcas] = await Promise.all([
        fetchAllChunks(apiClient.sales.faturamentoRevenda).then(r => { setLoadingProgress(prev => prev + 25); return r; }),
        fetchAllChunks(apiClient.sales.faturamento).then(r => { setLoadingProgress(prev => prev + 25); return r; }),
        fetchAllChunks(apiClient.sales.faturamentoFranquia).then(r => { setLoadingProgress(prev => prev + 25); return r; }),
        fetchAllChunks(apiClient.sales.faturamentoMtm).then(r => { setLoadingProgress(prev => prev + 25); return r; })
      ]);

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      console.log(`⚡ Performance: ${totalTime}ms (${totalTime < 2000 ? 'EXCELENTE' : totalTime < 5000 ? 'BOM' : 'LENTO'})`);

      // Validar respostas com logs detalhados
      console.log('📋 Resultados das APIs:', {
        revenda: { success: resultRevenda.success, dataLength: resultRevenda.data?.length || 0 },
        varejo: { success: resultVarejo.success, dataLength: resultVarejo.data?.length || 0 },
        franquia: { success: resultFranquia.success, dataLength: resultFranquia.data?.length || 0 },
        multimarcas: { success: resultMultimarcas.success, dataLength: resultMultimarcas.data?.length || 0 }
      });

      if (!resultRevenda.success) {
        console.error('❌ Erro em faturamento-revenda:', resultRevenda);
        throw new Error(`Erro ao buscar faturamento de revenda: ${resultRevenda.message || 'Erro desconhecido'}`);
      }
      if (!resultVarejo.success) {
        console.error('❌ Erro em faturamento:', resultVarejo);
        throw new Error(`Erro ao buscar faturamento de varejo: ${resultVarejo.message || 'Erro desconhecido'}`);
      }
      if (!resultFranquia.success) {
        console.error('❌ Erro em faturamento-franquia:', resultFranquia);
        throw new Error(`Erro ao buscar faturamento de franquia: ${resultFranquia.message || 'Erro desconhecido'}`);
      }
      if (!resultMultimarcas.success) {
        console.error('❌ Erro em faturamento-mtm:', resultMultimarcas);
        throw new Error(`Erro ao buscar faturamento de multimarcas: ${resultMultimarcas.message || 'Erro desconhecido'}`);
      }

      // Processar dados
      const { filtrados: filtradosRevenda, total: totalRevenda } = processRevendaData(resultRevenda.data);
      const { total: totalVarejo } = processGeneralData(resultVarejo.data);
      const { total: totalFranquia } = processGeneralData(resultFranquia.data);
      const { total: totalMultimarcas } = processGeneralData(resultMultimarcas.data);

      // Atualizar estados
      setFaturamento({
        revenda: totalRevenda,
        varejo: totalVarejo,
        franquia: totalFranquia,
        multimarcas: totalMultimarcas,
      });

      setDadosRevenda(filtradosRevenda);
        setDadosVarejo(resultVarejo.data);
        setDadosFranquia(resultFranquia.data);
        setDadosMultimarcas(resultMultimarcas.data);

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
      setLoadingProgress(100);
      setDadosCarregados(true);

    } catch (error) {
      console.error('❌ Erro ao buscar dados:', error);
      setFaturamento({ revenda: 0, varejo: 0, franquia: 0, multimarcas: 0 });
      setDadosRevenda([]); 
      setDadosVarejo([]); 
      setDadosFranquia([]); 
      setDadosMultimarcas([]);
      setAgg(null);
      setCacheInfo(null);
      setDadosCarregados(false);
    } finally {
      activeRequestsRef.current--;
      setLoading(false);
    }
  }, [filtros, empresasSelecionadas, processRevendaData, processGeneralData, apiClient]);

  // Debounced handleFiltrar
  const debouncedFiltrar = useCallback((e) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      handleFiltrar(e);
    }, DEBOUNCE_DELAY);
  }, [handleFiltrar]);

  // Pré-carregamento simplificado (apenas mês anterior se não estiver em cache)
  const preloadPreviousMonth = useCallback(async () => {
    const hoje = new Date();
    const mesAnterior = {
      dt_inicio: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10),
      dt_fim: new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10)
    };

    const key = makeCacheKey(mesAnterior.dt_inicio, mesAnterior.dt_fim, empresasSelecionadas.map(emp => emp.cd_empresa || emp));
    const cached = readCache(key);
    const ttl = ttlForRange(mesAnterior.dt_fim);
    
    // Só faz preload se não estiver em cache e após um delay maior
    if (!cached || isExpired(cached.ts, ttl)) {
      setTimeout(async () => {
        try {
          console.log('🔄 Preload: carregando mês anterior em background...');
          const tempFiltros = { ...filtros, ...mesAnterior };
          
          // Chama handleFiltrar com os filtros temporários sem alterar o estado
          await handleFiltrar({ preventDefault: () => {} });
        } catch (error) {
          console.warn('Preload do mês anterior falhou:', error);
        }
      }, 5000); // 5 segundos de delay
    }
  }, [empresasSelecionadas, filtros, handleFiltrar]);

  // Inicialização com datas e empresas pré-selecionadas (sem carregar dados)
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setFiltros({
      dt_inicio: primeiroDia.toISOString().slice(0, 10),
      dt_fim: ultimoDia.toISOString().slice(0, 10)
    });

    // Pré-selecionar empresas principais (usuário pode alterar)
    setEmpresasSelecionadas([
      { cd_empresa: '1' }, { cd_empresa: '2' }, { cd_empresa: '200' }, { cd_empresa: '75' }, 
      { cd_empresa: '31' }, { cd_empresa: '6' }, { cd_empresa: '85' }, { cd_empresa: '11' }, 
      { cd_empresa: '99' }, { cd_empresa: '92' }, { cd_empresa: '5' }, { cd_empresa: '500' }, 
      { cd_empresa: '55' }, { cd_empresa: '550' }, { cd_empresa: '65' }, { cd_empresa: '650' }, 
      { cd_empresa: '93' }, { cd_empresa: '930' }, { cd_empresa: '94' }, { cd_empresa: '940' }, 
      { cd_empresa: '95' }, { cd_empresa: '950' }, { cd_empresa: '96' }, { cd_empresa: '960' }, 
      { cd_empresa: '97' }, { cd_empresa: '970' }, { cd_empresa: '90' }, { cd_empresa: '91' }, 
      { cd_empresa: '890' }, { cd_empresa: '910' }, { cd_empresa: '920' }
    ]);
    
    // Dados só serão carregados quando o usuário clicar em "Filtrar"
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ======= DERIVADOS PARA UI COM MEMOIZAÇÃO =======
  const totalGeralUI = useMemo(() => {
    if (agg?.faturamento.totalGeral) return agg.faturamento.totalGeral;
    
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
    
    return revendaCard + varejoCard + franquiaCard + multimarcasCard;
  }, [agg, dadosRevenda, dadosVarejo, dadosFranquia, dadosMultimarcas]);

  const custoBrutoRevenda = useMemo(() => 
    agg?.custos.custoBrutoRevenda ?? calcularCustoBruto(dadosRevenda, true), 
    [agg, dadosRevenda]
  );
  const custoBrutoVarejo = useMemo(() => 
    agg?.custos.custoBrutoVarejo ?? calcularCustoBruto(dadosVarejo), 
    [agg, dadosVarejo]
  );
  const custoBrutoFranquia = useMemo(() => 
    agg?.custos.custoBrutoFranquia ?? calcularCustoBruto(dadosFranquia, true), 
    [agg, dadosFranquia]
  );
  const custoBrutoMultimarcas = useMemo(() => 
    agg?.custos.custoBrutoMultimarcas ?? calcularCustoBruto(dadosMultimarcas, true), 
    [agg, dadosMultimarcas]
  );
  const custoTotalBrutoUI = useMemo(() => 
    agg?.custos.custoTotalBruto ?? (custoBrutoRevenda + custoBrutoVarejo + custoBrutoFranquia + custoBrutoMultimarcas),
    [agg, custoBrutoRevenda, custoBrutoVarejo, custoBrutoFranquia, custoBrutoMultimarcas]
  );

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
      <div className="w-full max-w-4xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle 
        title="Consolidado" 
        subtitle="Visão consolidada de vendas e performance por período e empresa"
        icon={CurrencyDollar}
        iconColor="text-green-600"
      />

      {/* Badge de cache + botão Atualizar + Progress */}
      <div className="flex flex-col items-center justify-center gap-2 mb-3">
        <div className="flex items-center gap-2">
        {cacheInfo && (
          <span className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-700 bg-gray-100">
              {cacheInfo.fromCache ? '⚡ Cache' : '🔄 Atualizado'} • {cacheInfo.at ? new Date(cacheInfo.at).toLocaleString('pt-BR') : ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            const key = makeCacheKey(
              filtros.dt_inicio, filtros.dt_fim,
                empresasSelecionadas.map(emp => emp.cd_empresa || emp)
            );
            try { localStorage.removeItem(key); } catch {}
            handleFiltrar({ preventDefault: () => {} });
          }}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-md bg-[#000638] text-white hover:bg-[#fe0000] disabled:opacity-50 transition"
        >
          Atualizar
        </button>
        </div>
        
        {/* Barra de Progresso */}
        {loading && loadingProgress > 0 && (
          <div className="w-64 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#000638] h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        )}
      </div>

        {/* Filtros */}
        <div className="mb-4">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-[#000638]/10">
            <div className="mb-2">
              <span className="text-xs font-bold text-[#000638] flex items-center gap-1"><CurrencyDollar size={10} weight="bold" />Filtros</span>
              <span className="text-xs text-gray-500 mt-1">Selecione o período, empresa ou data para análise</span>
            </div>
            <div className="flex flex-row gap-x-6 w-full">
              <div className="w-full">
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={setEmpresasSelecionadas}
                  apenasEmpresa101={false}
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Data Inicial</label>
                <input
                  type="date"
                  name="dt_inicio"
                  value={filtros.dt_inicio}
                  onChange={e => setFiltros({ ...filtros, dt_inicio: e.target.value })}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Data Final</label>
                <input
                  type="date"
                  name="dt_fim"
                  value={filtros.dt_fim}
                  onChange={e => setFiltros({ ...filtros, dt_fim: e.target.value })}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end w-full">
              <button 
                type="submit" 
                disabled={loading || !empresasSelecionadas?.length}
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition h-7 text-xs font-bold shadow-md tracking-wide uppercase"
              >
                {loading ? (
                  <>
                    <Spinner size={10} className="animate-spin" />
                    {loadingProgress > 0 && loadingProgress < 100 && (
                      <span className="text-xs">{Math.round(loadingProgress)}%</span>
                    )}
                  </>
                ) : (
                  <>
                    <CurrencyDollar size={18} weight="bold" />
                    Filtrar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Cards Totais */}
        {dadosCarregados && (
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
                {loading
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
                {loading
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
                {loading
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
                {loading
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
                {loading
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
                {loading
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
                {loading
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
                {loading
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
                {loading
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
        )}

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
                {loading ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.revenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {loading ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoRevenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                {loading ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasRevendaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteRevendaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {loading ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.varejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {loading ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoVarejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                {loading ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasVarejoUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteVarejoUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {loading ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.franquia || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {loading ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoFranquia || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                {loading ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasFranquiaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteFranquiaUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {loading ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamento.multimarcas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                {loading ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoMultimarcas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                {loading ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-700 animate-spin" /> : (entradasMultimarcasUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
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
                  {loading ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteMultimarcasUI || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
