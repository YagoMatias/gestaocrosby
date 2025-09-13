import React, { useEffect, useState, useRef, useCallback } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import { ChartLineUp } from '@phosphor-icons/react';

const ReceitaLiquida = () => {
  // CSS para a tabela
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .receita-table {
        border-collapse: collapse;
        width: 100%;
      }
      
      .receita-table th,
      .receita-table td {
        padding: 3px 4px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 9px;
        line-height: 1.2;
      }
      
      .receita-table th:last-child,
      .receita-table td:last-child {
        border-right: none;
      }
      
      .receita-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 8px;
        letter-spacing: 0.05em;
      }
      
      .receita-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      
      .receita-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      
      .receita-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  const apiClient = useApiClient();
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Totais gerais
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalLiquido, setTotalLiquido] = useState(0);
  const [totalIcms, setTotalIcms] = useState(0);
  const [totalDesconto, setTotalDesconto] = useState(0);
  const [totalPis, setTotalPis] = useState(0);
  const [totalCofins, setTotalCofins] = useState(0);
  const [linhasTabela, setLinhasTabela] = useState([]);

  // =========================
  // Otimizações de performance e cache (baseado em Consolidado)
  // =========================
  const CACHE_VERSION = 'v1';
  const MAX_CACHE_SIZE = 50;
  const DEBOUNCE_DELAY = 300;
  const MAX_CONCURRENT_REQUESTS = 4;

  const debounceRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeRequestsRef = useRef(0);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingImpostos, setLoadingImpostos] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(null); // { fromCache, at }
  const initializedRef = useRef(false);

  const defaultEmpresas = [
    { cd_empresa: '1' }, { cd_empresa: '2' }, { cd_empresa: '200' }, { cd_empresa: '75' },
    { cd_empresa: '31' }, { cd_empresa: '6' }, { cd_empresa: '85' }, { cd_empresa: '11' },
    { cd_empresa: '99' }, { cd_empresa: '92' }, { cd_empresa: '5' }, { cd_empresa: '500' },
    { cd_empresa: '55' }, { cd_empresa: '550' }, { cd_empresa: '65' }, { cd_empresa: '650' },
    { cd_empresa: '93' }, { cd_empresa: '930' }, { cd_empresa: '94' }, { cd_empresa: '940' },
    { cd_empresa: '95' }, { cd_empresa: '950' }, { cd_empresa: '96' }, { cd_empresa: '960' },
    { cd_empresa: '97' }, { cd_empresa: '970' }, { cd_empresa: '90' }, { cd_empresa: '91' },
    { cd_empresa: '890' }, { cd_empresa: '910' }, { cd_empresa: '920' }
  ];

  const toISO = (d) => new Date(d).toISOString().slice(0, 10);
  const normEmpresas = (arr) => {
    if (!arr || !arr.length) return 'default';
    const only = arr.map(e => (e?.cd_empresa || e)).sort();
    return only.join(',');
  };
  const makeCacheKey = (dt_inicio, dt_fim, empresas) => [
    'receitaliquida', CACHE_VERSION, toISO(dt_inicio || '1970-01-01'), toISO(dt_fim || '1970-01-01'), `emp:${normEmpresas(empresas)}`
  ].join('|');
  const compressData = (data) => {
    try { return btoa(JSON.stringify(data)); } catch { return JSON.stringify(data); }
  };
  const decompressData = (compressed) => {
    try { return JSON.parse(atob(compressed)); } catch { return JSON.parse(compressed); }
  };
  const cleanOldCache = () => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('receitaliquida|'));
      if (keys.length > MAX_CACHE_SIZE) {
        const entries = keys.map(k => ({ k, ts: JSON.parse(localStorage.getItem(k) || '{}').ts || 0 }))
          .sort((a,b)=>a.ts-b.ts);
        const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE + 5);
        toRemove.forEach(e => localStorage.removeItem(e.k));
      }
    } catch {}
  };
  const writeCache = (key, data) => {
    try {
      cleanOldCache();
      const compressed = compressData(data);
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: compressed }));
    } catch {}
  };
  const readCache = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      return { ts: entry.ts, data: decompressData(entry.data) };
    } catch { return null; }
  };
  const isExpired = (ts, ttlMs) => (Date.now() - ts) > ttlMs;
  const ttlForRange = (dt_fim) => {
    const end = new Date(toISO(dt_fim || new Date()));
    const today = new Date(new Date().toISOString().slice(0,10));
    const isCurrentOrFuture = end >= today;
    const hour = new Date().getHours();
    const business = hour >= 8 && hour <= 18;
    if (isCurrentOrFuture) return business ? 15*60*1000 : 45*60*1000;
    return 4*60*60*1000;
  };

  // Helpers de cálculo
  const applyRevendaRule = useCallback((arr) => {
    const dados = Array.isArray(arr) ? arr : [];
    const apenasPermitidos = dados.filter(row => {
      const cls = String(row.cd_classificacao ?? '').trim();
      return cls === '1' || cls === '3' || cls === '2' || cls === '4' || cls === '';
    });
    return apenasPermitidos.filter((row, _idx, array) => {
      const currentPessoa = row.cd_pessoa;
      const currentClass = String(row.cd_classificacao ?? '').trim();
      if (currentClass === '3') return true;
      if (currentClass === '1') {
        const hasClass3 = array.some(item => item.cd_pessoa === currentPessoa && String(item.cd_classificacao ?? '').trim() === '3');
        return !hasClass3;
      }
      return true;
    });
  }, []);

  const sumField = useCallback((arr, field) => (arr || []).reduce((acc, r) => {
    const q = Number(r.qt_faturado) || 1;
    const value = (Number(r[field]) || 0) * q;
    if (r.tp_operacao === 'S') return acc + value;
    if (r.tp_operacao === 'E') return acc - value;
    return acc;
  }, 0), []);

  // Variante: permite escolher se entradas devem ser subtraídas
  const sumFieldWithMode = useCallback((arr, field, subtractEntries) => (arr || []).reduce((acc, r) => {
    const q = Number(r.qt_faturado) || 1;
    const value = (Number(r[field]) || 0) * q;
    if (r.tp_operacao === 'S') return acc + value;
    if (subtractEntries && r.tp_operacao === 'E') return acc - value;
    return acc;
  }, 0), []);

  // Função para buscar dados de impostos da rota VLIMPOSTO com lotes
  // Retorna um mapa por transação e totais gerais (padrão centro de custo)
  const buscarImpostos = useCallback(async (nrTransacoes, onProgress) => {
    if (!nrTransacoes || nrTransacoes.length === 0) return { byTransacao: {}, totals: { icms: 0, pis: 0, cofins: 0 } };
    
    setLoadingImpostos(true);
    
    try {
      const TAMANHO_LOTE = 500;
      const lotes = [];
      for (let i = 0; i < nrTransacoes.length; i += TAMANHO_LOTE) lotes.push(nrTransacoes.slice(i, i + TAMANHO_LOTE));

      console.log(`🔍 Buscando impostos reais em ${lotes.length} lotes de até ${TAMANHO_LOTE} transações cada`);

      const MAX_CONCURRENT_BATCHES = 3;
      const resultados = [];
      for (let i = 0; i < lotes.length; i += MAX_CONCURRENT_BATCHES) {
        const batchGroup = lotes.slice(i, i + MAX_CONCURRENT_BATCHES);
        const batchPromises = batchGroup.map(async (lote) => {
          const response = await apiClient.sales.vlimposto({ nr_transacao: lote });
          if (response.success && response.data) return response.data;
          console.warn('Resposta inválida para lote:', response);
          return [];
        });
        try {
          const batchResults = await Promise.all(batchPromises);
          resultados.push(...batchResults.flat());
        } catch (error) {
          console.error(`Erro em lote ${i}-${i + MAX_CONCURRENT_BATCHES}:`, error);
        }
        const progress = Math.round(((i + MAX_CONCURRENT_BATCHES) / lotes.length) * 100);
        if (onProgress) onProgress(Math.min(progress, 100));
      }

      // Montar mapa por transação e totais gerais
      const byTransacao = {};
      const totals = { icms: 0, pis: 0, cofins: 0 };
      for (const item of resultados) {
        const nr = String(item.nr_transacao);
        const valor = parseFloat(item.valorimposto || 0) || 0;
        const cd = Number(item.cd_imposto);
        if (!byTransacao[nr]) byTransacao[nr] = { icms: 0, pis: 0, cofins: 0 };
        if (cd === 1) { byTransacao[nr].icms += valor; totals.icms += valor; }
        else if (cd === 5) { byTransacao[nr].cofins += valor; totals.cofins += valor; }
        else if (cd === 6) { byTransacao[nr].pis += valor; totals.pis += valor; }
      }

      console.log('✅ Impostos reais agregados:', { totals, sample: Object.entries(byTransacao).slice(0,2) });
      return { byTransacao, totals };
    } catch (error) {
      console.error('Erro crítico ao buscar impostos:', error);
      throw error;
    } finally {
      setLoadingImpostos(false);
    }
  }, [apiClient]);

  const handleBuscar = useCallback(async () => {
    setErro('');
    if (!empresasSelecionadas.length || !dataInicio || !dataFim) return;

    // Evita excesso de requisições
    if (activeRequestsRef.current >= MAX_CONCURRENT_REQUESTS) return;

    // Cancela anteriores
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    activeRequestsRef.current++;
    setLoading(true);
    setLoadingProgress(0);
    setCacheInfo(null);

    const key = makeCacheKey(dataInicio, dataFim, empresasSelecionadas);
    const ttl = ttlForRange(dataFim);
    try {
      const cached = readCache(key);
      if (cached && !isExpired(cached.ts, ttl)) {
        const c = cached.data;
        setTotalBruto(c.totals.totalBruto || 0);
        setTotalLiquido(c.totals.totalLiquido || 0);
        setTotalIcms(c.totals.totalIcms || 0);
        setTotalDesconto(c.totals.totalDesconto || 0);
        setTotalPis(c.totals.totalPis || 0);
        setTotalCofins(c.totals.totalCofins || 0);
        setLinhasTabela(c.rows || []);
        setLoading(false);
        setLoadingProgress(100);
        setCacheInfo({ fromCache: true, at: cached.ts });
        return;
      }

      const empresas = empresasSelecionadas.map(e => e.cd_empresa || e);

      // chunking
      const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
      };
      const companyChunks = chunkArray(empresas, 12);
      const fetchAllChunks = async (routeFn) => {
        const results = await Promise.allSettled(
          companyChunks.map(chunk => routeFn({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: chunk }))
        );
        const ok = results.filter(r => r.status === 'fulfilled');
        const data = ok.flatMap(r => Array.isArray(r.value?.data) ? r.value.data : []);
        const anyFail = results.some(r => r.status === 'rejected' || (r.value && r.value.success === false));
        return { success: !anyFail, data };
      };

      const [rFat, rRev, rFrq, rMtm] = await Promise.all([
        fetchAllChunks(apiClient.sales.faturamento).then(r => { setLoadingProgress(p => p + 25); return r; }),
        fetchAllChunks(apiClient.sales.faturamentoRevenda).then(r => { setLoadingProgress(p => p + 25); return r; }),
        fetchAllChunks(apiClient.sales.faturamentoFranquia).then(r => { setLoadingProgress(p => p + 25); return r; }),
        fetchAllChunks(apiClient.sales.faturamentoMtm).then(r => { setLoadingProgress(p => p + 25); return r; })
      ]);

      if (!rFat.success || !rRev.success || !rFrq.success || !rMtm.success) throw new Error('Falha em alguma rota');

      const fatVarejo = Array.isArray(rFat.data) ? rFat.data : [];
      const revenda = Array.isArray(rRev.data) ? rRev.data : [];
      const franquia = Array.isArray(rFrq.data) ? rFrq.data : [];
      const multimarcas = Array.isArray(rMtm.data) ? rMtm.data : [];

      // Coletar todos os nr_transacao para buscar impostos
      const todasTransacoes = [
        ...fatVarejo.filter(r => r.tp_operacao === 'S').map(r => r.nr_transacao),
        ...revenda.filter(r => r.tp_operacao === 'S').map(r => r.nr_transacao),
        ...franquia.filter(r => r.tp_operacao === 'S').map(r => r.nr_transacao),
        ...multimarcas.filter(r => r.tp_operacao === 'S').map(r => r.nr_transacao)
      ].filter((nr, index, arr) => nr && arr.indexOf(nr) === index); // Remove duplicatas

      // Buscar dados de impostos reais da rota VLIMPOSTO
      let impostosData;
      try {
        impostosData = await buscarImpostos(todasTransacoes, (progress) => {
          setLoadingProgress(80 + (progress * 0.2)); // 80% base + 20% para impostos
        });
      } catch (error) {
        console.error('Falha crítica ao buscar impostos reais:', error);
        setErro('Erro ao buscar dados de impostos. Verifique a conexão e tente novamente.');
        return;
      }

      // Bruto por canal (Preço de Tabela):
      // Revenda e Varejo: S - E; Franquia e Multimarcas: apenas S (igual Consolidado)
      const brutoVarejo = sumFieldWithMode(fatVarejo, 'vl_unitbruto', true);
      const brutoRevenda = sumFieldWithMode(revenda, 'vl_unitbruto', true);
      const brutoFranquia = sumFieldWithMode(franquia, 'vl_unitbruto', false);
      const brutoMultimarcas = sumFieldWithMode(multimarcas, 'vl_unitbruto', false);
      const bruto = brutoVarejo + brutoRevenda + brutoFranquia + brutoMultimarcas;

      // Líquido conforme Consolidado (Vendas após Desconto):
      // Revenda: aplicar regra 1/3 e S - E
      // Varejo: apenas S
      // Franquia e Multimarcas: S - E
      const liquidoRevenda = sumField(applyRevendaRule(revenda), 'vl_unitliquido');
      const liquidoVarejo = sumFieldWithMode(fatVarejo, 'vl_unitliquido', false);
      const liquidoFranquia = sumField(franquia, 'vl_unitliquido');
      const liquidoMultimarcas = sumField(multimarcas, 'vl_unitliquido');
      const liquido = liquidoRevenda + liquidoVarejo + liquidoFranquia + liquidoMultimarcas;
      
      // Usar dados reais de impostos da rota VLIMPOSTO (totais agregados)
      const icms = impostosData.totals.icms;
      const pis = impostosData.totals.pis;
      const cofins = impostosData.totals.cofins;
      const desconto = bruto - liquido;

      setTotalBruto(bruto);
      setTotalLiquido(liquido);
      setTotalIcms(icms);
      setTotalDesconto(desconto);
      setTotalPis(pis);
      setTotalCofins(cofins);

      const mkRow = async (canal, arr, options = {}) => {
        const { applyRev = false, subtractEntries = true, mode } = options;
        const base = applyRev ? applyRevendaRule(arr) : arr;
        
        // Somar impostos do canal usando o mapa por transação já obtido
        const transacoesCanal = base
          .filter(r => r.tp_operacao === 'S')
          .map(r => String(r.nr_transacao))
          .filter((nr, index, arr) => nr && arr.indexOf(nr) === index);
        let iCanal = 0, pisCanal = 0, cofinsCanal = 0;
        transacoesCanal.forEach(nr => {
          const imp = impostosData.byTransacao[nr];
          if (imp) {
            iCanal += imp.icms || 0;
            pisCanal += imp.pis || 0;
            cofinsCanal += imp.cofins || 0;
          }
        });
        
        if (mode === 'varejo') {
          const b = sumFieldWithMode(base, 'vl_unitbruto', true); // S - E
          const lSE = sumField(base, 'vl_unitliquido'); // S - E
          const d = b - lSE; // igual Consolidado: Tabela - Vendas (S-E)
          const i = iCanal;
          const pis = pisCanal;
          const cofins = cofinsCanal;
          const rl = b - d - i - pis - cofins;
          return { canal, bruto: b, desconto: d, vendasAposDesconto: lSE, icms: i, pis, cofins, receitaLiquida: rl };
        }
        const b = sumField(base, 'vl_unitbruto');
        const l = sumFieldWithMode(base, 'vl_unitliquido', subtractEntries);
        const i = iCanal;
        const d = b - l;
        const pis = pisCanal;
        const cofins = cofinsCanal;
        const rl = b - d - i - pis - cofins;
        return { canal, bruto: b, desconto: d, vendasAposDesconto: l, icms: i, pis, cofins, receitaLiquida: rl };
      };
      const rows = await Promise.all([
        mkRow('Varejo', fatVarejo, { mode: 'varejo' }),
        mkRow('Franquia', franquia, { subtractEntries: true }),
        mkRow('Multimarca', multimarcas, { subtractEntries: true }),
        mkRow('Revenda', revenda, { applyRev: true, subtractEntries: true })
      ]);
      setLinhasTabela(rows);

      writeCache(key, { totals: { totalBruto: bruto, totalLiquido: liquido, totalIcms: icms, totalDesconto: desconto, totalPis: pis, totalCofins: cofins }, rows });
      setCacheInfo({ fromCache: false, at: Date.now() });
      setLoadingProgress(100);
    } catch (err) {
      setErro('Falha ao carregar receita líquida.');
    } finally {
      activeRequestsRef.current--;
      setLoading(false);
    }
  }, [empresasSelecionadas, dataInicio, dataFim, apiClient, applyRevendaRule, sumField]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Persistência leve dos filtros
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const savedInicio = localStorage.getItem('rl_dt_inicio');
    const savedFim = localStorage.getItem('rl_dt_fim');
    const savedEmp = localStorage.getItem('rl_empresas');
    setDataInicio(savedInicio || primeiroDia.toISOString().split('T')[0]);
    setDataFim(savedFim || ultimoDia.toISOString().split('T')[0]);

    // Pré-selecionar empresas (usuário pode alterar) - mesmas do Consolidado
    if (savedEmp) {
      try {
        const parsed = JSON.parse(savedEmp);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEmpresasSelecionadas(parsed);
        } else {
          setEmpresasSelecionadas(defaultEmpresas);
        }
      } catch {
        setEmpresasSelecionadas(defaultEmpresas);
      }
    } else {
      setEmpresasSelecionadas(defaultEmpresas);
    }

    // marca inicialização para evitar sobrescrever localStorage com []
    setTimeout(() => { initializedRef.current = true; }, 0);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('rl_dt_inicio', dataInicio || ''); } catch {}
  }, [dataInicio]);
  useEffect(() => {
    try { localStorage.setItem('rl_dt_fim', dataFim || ''); } catch {}
  }, [dataFim]);
  useEffect(() => {
    if (!initializedRef.current) return;
    try { localStorage.setItem('rl_empresas', JSON.stringify(empresasSelecionadas || [])); } catch {}
  }, [empresasSelecionadas]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle 
        title="Receita Líquida" 
        subtitle="Análise detalhada da receita líquida por empresa e período"
        icon={ChartLineUp}
        iconColor="text-blue-600"
      />

      <div className="mb-4">
        <form onSubmit={(e)=>{ e.preventDefault(); if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(()=>handleBuscar(), DEBOUNCE_DELAY); }} className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-[#000638]/10">
          <div className="flex items-center justify-center gap-2 mb-2">{
            cacheInfo && (
              <span className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-700 bg-gray-100">
                {cacheInfo.fromCache ? '⚡ Cache' : '🔄 Atualizado'} • {cacheInfo.at ? new Date(cacheInfo.at).toLocaleString('pt-BR') : ''}
              </span>
            )}
            <button type="button" disabled={loading} onClick={()=>{ try{ const key = makeCacheKey(dataInicio, dataFim, empresasSelecionadas); localStorage.removeItem(key); }catch{} handleBuscar(); }} className="text-xs px-3 py-1 rounded-md bg-[#000638] text-white hover:bg-[#fe0000] disabled:opacity-50 transition">Atualizar</button>
          </div>
          {loading && loadingProgress > 0 && (
            <div className="w-64 self-center bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-[#000638] h-2 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
            </div>
          )}
          {loadingImpostos && (
            <div className="text-center text-sm text-blue-600 mb-2">
              🔍 Buscando dados de impostos...
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
            <div className="lg:col-span-2">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
                apenasEmpresa101={false}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            <div className="flex items-center">
              <button
                type="submit"
                disabled={loading || !dataInicio || !dataFim || !empresasSelecionadas.length}
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Cards Totais (Bruto, Líquido, ICMS, Desconto, PIS, COFINS) */}
      {!!(totalBruto || totalLiquido || totalIcms || totalDesconto || totalPis || totalCofins) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="shadow rounded-lg bg-white px-3 pb-3 border border-[#000638]/10">
            <div className="text-[10px] text-gray-500">Faturamento Bruto</div>
            <div className="text-base font-extrabold text-purple-700">{totalBruto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white px-3 pb-3 border border-[#000638]/10">
            <div className="text-[10px] text-gray-500">Faturamento Líquido</div>
            <div className="text-base font-extrabold text-green-700">{totalLiquido.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white px-3 pb-3 border border-[#000638]/10">
            <div className="text-[10px] text-gray-500">ICMS Total</div>
            <div className="text-base font-extrabold text-teal-700">{totalIcms.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white px-3 pb-3 border border-[#000638]/10">
            <div className="text-[10px] text-gray-500">Desconto Total</div>
            <div className="text-base font-extrabold text-orange-700">{totalDesconto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white px-3 pb-3 border border-[#000638]/10">
            <div className="text-[10px] text-gray-500">PIS</div>
            <div className="text-base font-extrabold text-blue-700">{totalPis.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white px-3 pb-3 border border-[#000638]/10">
            <div className="text-[10px] text-gray-500">COFINS</div>
            <div className="text-base font-extrabold text-pink-700">{totalCofins.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
        </div>
      )}
      {erro && (
        <div className="mt-4 text-sm text-red-600">{erro}</div>
      )}

      {/* Tabela por canal (modelo semelhante às tabelas do app) */}
      {linhasTabela.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="receita-table min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">Canal</th>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">Faturamento Bruto</th>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">Desconto</th>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">Vendas após Desconto</th>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">ICMS</th>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">PIS</th>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">COFINS</th>
                <th className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors">Receita Líquida</th>
              </tr>
            </thead>
            <tbody>
              {linhasTabela.map((row, idx) => (
                <tr key={idx} className="text-gray-700 hover:bg-gray-50">
                  <td className="px-0.5 py-0.5 text-center text-[8px] font-medium">{row.canal}</td>
                  <td className="px-0.5 py-0.5 text-center text-[8px]">{(row.bruto ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-0.5 py-0.5 text-center text-[8px]">{(row.desconto ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-0.5 py-0.5 text-center text-[8px]">{(row.vendasAposDesconto ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-0.5 py-0.5 text-center text-[8px]">{(row.icms ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-0.5 py-0.5 text-center text-[8px]">{(row.pis ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-0.5 py-0.5 text-center text-[8px]">{(row.cofins ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-0.5 py-0.5 text-center text-[8px] font-semibold text-[#000638]">{(row.receitaLiquida ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ReceitaLiquida;


