import React, { useEffect, useState, useRef, useCallback } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';

const ReceitaLiquida = () => {
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
        fetchAllChunks(apiClient.sales.receitaliquidaFaturamento).then(r => { setLoadingProgress(p => p + 25); return r; }),
        fetchAllChunks(apiClient.sales.receitaliquidaRevenda).then(r => { setLoadingProgress(p => p + 25); return r; }),
        fetchAllChunks(apiClient.sales.receitaliquidaFranquias).then(r => { setLoadingProgress(p => p + 25); return r; }),
        fetchAllChunks(apiClient.sales.receitaliquidaMtm).then(r => { setLoadingProgress(p => p + 25); return r; })
      ]);

      if (!rFat.success || !rRev.success || !rFrq.success || !rMtm.success) throw new Error('Falha em alguma rota');

      const all = [
        ...(Array.isArray(rFat.data) ? rFat.data : []),
        ...(Array.isArray(rRev.data) ? rRev.data : []),
        ...(Array.isArray(rFrq.data) ? rFrq.data : []),
        ...(Array.isArray(rMtm.data) ? rMtm.data : [])
      ];

      const allAdjusted = applyRevendaRule(all);
      const bruto = sumField(allAdjusted, 'vl_unitbruto');
      const liquido = sumField(allAdjusted, 'vl_unitliquido');
      const icms = sumField(allAdjusted, 'vl_icms');
      const desconto = bruto - liquido;

      setTotalBruto(bruto);
      setTotalLiquido(liquido);
      setTotalIcms(icms);
      setTotalDesconto(desconto);

      const mkRow = (canal, arr, applyRev = false) => {
        const base = applyRev ? applyRevendaRule(arr) : arr;
        const b = sumField(base, 'vl_unitbruto');
        const l = sumField(base, 'vl_unitliquido');
        const i = sumField(base, 'vl_icms');
        const d = b - l;
        const pis = l * 0.0065;
        const cofins = l * 0.03;
        const rl = b - d - i - pis - cofins;
        return { canal, bruto: b, desconto: d, icms: i, pis, cofins, receitaLiquida: rl };
      };
      const rows = [
        mkRow('Faturamento', Array.isArray(rFat.data) ? rFat.data : []),
        mkRow('Franquia', Array.isArray(rFrq.data) ? rFrq.data : []),
        mkRow('Multimarca', Array.isArray(rMtm.data) ? rMtm.data : []),
        mkRow('Revenda', Array.isArray(rRev.data) ? rRev.data : [], true)
      ];
      setLinhasTabela(rows);

      writeCache(key, { totals: { totalBruto: bruto, totalLiquido: liquido, totalIcms: icms, totalDesconto: desconto }, rows });
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
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#000638] font-barlow">Receita Líquida</h1>

      <div className="mb-8">
        <form onSubmit={(e)=>{ e.preventDefault(); if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(()=>handleBuscar(), DEBOUNCE_DELAY); }} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
          <div className="flex items-center justify-center gap-3 mb-4">{
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
            <div className="lg:col-span-2">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
                apenasEmpresa101={false}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-center">
              <button
                type="submit"
                disabled={loading || !dataInicio || !dataFim || !empresasSelecionadas.length}
                className="flex items-center gap-2 bg-[#000638] text-white px-6 py-3 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-10 text-sm font-bold shadow-md tracking-wide uppercase"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Cards Totais (Bruto, Líquido, ICMS, Desconto) */}
      {!!(totalBruto || totalLiquido || totalIcms || totalDesconto) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">Faturamento Bruto</div>
            <div className="text-lg font-extrabold text-purple-700">{totalBruto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">Faturamento Líquido</div>
            <div className="text-lg font-extrabold text-green-700">{totalLiquido.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">ICMS Total</div>
            <div className="text-lg font-extrabold text-teal-700">{totalIcms.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">Desconto Total</div>
            <div className="text-lg font-extrabold text-orange-700">{totalDesconto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">PIS (0,65%)</div>
            <div className="text-lg font-extrabold text-blue-700">{(totalLiquido * 0.0065).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">COFINS (3,0%)</div>
            <div className="text-lg font-extrabold text-pink-700">{(totalLiquido * 0.03).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
        </div>
      )}
      {erro && (
        <div className="mt-4 text-sm text-red-600">{erro}</div>
      )}

      {/* Tabela por canal (modelo semelhante às tabelas do app) */}
      {linhasTabela.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full bg-white border border-[#000638]/10 rounded-lg overflow-hidden">
            <thead className="bg-[#f8f9fb]">
              <tr className="text-left text-xs font-semibold text-[#000638]">
                <th className="px-4 py-3 border-b">Canal</th>
                <th className="px-4 py-3 border-b">Faturamento Bruto</th>
                <th className="px-4 py-3 border-b">Desconto</th>
                <th className="px-4 py-3 border-b">ICMS</th>
                <th className="px-4 py-3 border-b">PIS</th>
                <th className="px-4 py-3 border-b">COFINS</th>
                <th className="px-4 py-3 border-b">Receita Líquida</th>
              </tr>
            </thead>
            <tbody>
              {linhasTabela.map((row, idx) => (
                <tr key={idx} className="text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-medium">{row.canal}</td>
                  <td className="px-4 py-2 border-b">{row.bruto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.desconto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.icms.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.pis.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.cofins.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b font-semibold text-[#000638]">{row.receitaLiquida.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
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


