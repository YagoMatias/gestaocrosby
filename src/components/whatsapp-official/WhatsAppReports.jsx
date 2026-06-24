import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/cards';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  ChartBar, TrendUp, Users, CheckCircle, Eye as EyeIcon, CurrencyDollar,
  CaretDown, ArrowClockwise, Export, ChatTeardropText, DownloadSimple, Trophy,
} from '@phosphor-icons/react';
import useDownloadAsImage from '../../hooks/useDownloadAsImage';

const API_BASE = import.meta.env.VITE_API_URL || '';
const COTACAO_DOLAR = 5.8;

const formatCurrency = (value, currency = 'BRL') =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency });

const categoryLabel = (name) => {
  const map = { MARKETING: 'Marketing', UTILITY: 'Utilitário', AUTHENTICATION: 'Autenticação', SERVICE: 'Serviço' };
  return map[name?.toUpperCase()] || name;
};

const WhatsAppReports = ({ accounts, activeAccount }) => {
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [templateAnalytics, setTemplateAnalytics] = useState([]);
  const [templateStats, setTemplateStats] = useState([]);
  const [templateStatsAllLojas, setTemplateStatsAllLojas] = useState([]);
  const [contasCanal, setContasCanal] = useState([]);
  const [syncingStats, setSyncingStats] = useState(false);
  const [syncingMass, setSyncingMass] = useState(null);
  const [filterCanalVenda, setFilterCanalVenda] = useState('all');
  const [filterGrupo, setFilterGrupo] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTemplate, setFilterTemplate] = useState('all');
  const [editingGrupoId, setEditingGrupoId] = useState(null);
  const [editingGrupoValue, setEditingGrupoValue] = useState('');
  const [sortKey, setSortKey] = useState('scheduledAt');
  const [sortDir, setSortDir] = useState('desc');

  const today = new Date().toISOString().split('T')[0];
  // Meta API limita template_analytics a 30 dias úteis (chunks de 20d)
  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(trintaDiasAtras);
  const [endDate, setEndDate] = useState(today);
  const { ref: lojasCardRef, baixar: baixarLojasCard } = useDownloadAsImage(
    () => `relatorio-${filterCanalVenda !== 'all' ? filterCanalVenda + '-' : ''}${startDate}-${endDate}`,
  );

  useEffect(() => {
    // Se veio activeAccount do pai, usa ele; senão usa o primeiro da lista
    if (activeAccount) {
      setSelectedAccount(activeAccount);
    } else if (accounts?.length && !selectedAccount) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts, activeAccount]);

  const fetchData = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const [campaignsRes, analyticsRes, templateAnalyticsRes, statsRes, allLojasRes, contasRes] = await Promise.all([
        fetch(`${API_BASE}/api/meta/campaigns?accountId=${selectedAccount.id}&startDate=${startDate}&endDate=${endDate}`),
        fetch(`${API_BASE}/api/meta/analytics/${selectedAccount.id}?startDate=${startDate}&endDate=${endDate}`),
        fetch(`${API_BASE}/api/meta/template-analytics/${selectedAccount.id}?startDate=${startDate}&endDate=${endDate}`),
        fetch(`${API_BASE}/api/meta/template-stats?waba_id=${selectedAccount.waba_id}&order=sent`),
        fetch(`${API_BASE}/api/meta/template-stats?order=sent`),
        fetch(`${API_BASE}/api/meta/template-stats/contas`),
      ]);
      const [campaignsJson, analyticsJson, templateAnalyticsJson, statsJson, allLojasJson, contasJson] = await Promise.all([
        campaignsRes.json(), analyticsRes.json(), templateAnalyticsRes.json(),
        statsRes.json(), allLojasRes.json(), contasRes.json(),
      ]);
      setCampaigns(campaignsJson.data || (Array.isArray(campaignsJson) ? campaignsJson : []));
      const analyticsData = analyticsJson.data || (analyticsJson.analytics || analyticsJson.pricing || analyticsJson.summary ? analyticsJson : null);
      setAnalytics(analyticsData);
      const tplRaw = templateAnalyticsJson.data || templateAnalyticsJson;
      setTemplateAnalytics(tplRaw?.templates || (Array.isArray(tplRaw) ? tplRaw : []));
      setTemplateStats(statsJson.data || []);
      setTemplateStatsAllLojas(allLojasJson.data || []);
      setContasCanal(contasJson.data || []);
    } catch (err) {
      console.error('[DEBUG API] Erro no fetchData:', err);
      console.error('[DEBUG API] URL base:', API_BASE);
      console.error('[DEBUG API] Conta selecionada:', selectedAccount);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveGrupo = async (id, grupo) => {
    try {
      await fetch(`${API_BASE}/api/meta/template-stats/${id}/grupo`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo: grupo || null }),
      });
      setTemplateStats((prev) => prev.map((t) => (t.id === id ? { ...t, grupo: grupo?.toLowerCase() || null } : t)));
      setTemplateStatsAllLojas((prev) => prev.map((t) => (t.id === id ? { ...t, grupo: grupo?.toLowerCase() || null } : t)));
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setEditingGrupoId(null); setEditingGrupoValue(''); }
  };
  const handleSyncTemplateStats = async () => {
    if (!selectedAccount) return;
    setSyncingStats(true);
    try {
      await fetch(`${API_BASE}/api/meta/template-stats/sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waba_id: selectedAccount.waba_id, start: startDate, end: endDate }),
      });
      fetchData();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSyncingStats(false); }
  };
  const handleSyncMassaCanal = async () => {
    if (filterCanalVenda === 'all') return alert('Selecione um canal antes');
    const contas = contasCanal.filter((c) => (c.canal_venda || '').toLowerCase() === filterCanalVenda);
    if (!contas.length) return;
    setSyncingMass({ canal: filterCanalVenda, current: 0, total: contas.length });
    for (let i = 0; i < contas.length; i++) {
      setSyncingMass({ canal: filterCanalVenda, current: i + 1, total: contas.length, currentName: contas[i].name });
      try {
        await fetch(`${API_BASE}/api/meta/template-stats/sync`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waba_id: contas[i].waba_id, start: startDate, end: endDate }),
        });
      } catch {}
    }
    setSyncingMass(null);
    fetchData();
  };

  // Métricas globais
  const totals = campaigns.reduce((acc, c) => {
    acc.total += c.total;
    acc.sent += c.sent;
    acc.delivered += c.delivered;
    acc.read += c.read;
    acc.replied += c.replied;
    acc.failed += c.failed;
    return acc;
  }, { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 });

  // Quando não há campanhas no DB, usar dados da Meta API (analytics.summary)
  const metaSent = analytics?.summary?.sent || analytics?.analytics?.sent || 0;
  const metaDelivered = analytics?.summary?.delivered || analytics?.analytics?.delivered || 0;
  const metaVolume = analytics?.summary?.totalVolume || 0;

  const effectiveSent = totals.sent || metaSent;
  const effectiveDelivered = totals.delivered || metaDelivered;
  const effectiveRead = totals.read || 0;
  const effectiveTotal = totals.total || metaVolume || effectiveSent;

  const deliveryRate = effectiveSent > 0 ? ((effectiveDelivered / effectiveSent) * 100).toFixed(1) : 0;
  const readRate = effectiveDelivered > 0 ? ((effectiveRead / effectiveDelivered) * 100).toFixed(1) : 0;
  const totalCostUSD = analytics?.summary?.totalCost || 0;
  const totalCost = totalCostUSD * COTACAO_DOLAR;

  const sorted = [...campaigns].sort((a, b) => {
    let va = a[sortKey];
    let vb = b[sortKey];
    if (sortKey === 'scheduledAt') {
      va = new Date(va).getTime();
      vb = new Date(vb).getTime();
    }
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  // Custo médio por mensagem por categoria (vindo do pricing analytics)
  const costPerMsg = {};
  if (analytics?.pricing?.dataPoints) {
    const byCategory = {};
    for (const p of analytics.pricing.dataPoints) {
      const cat = String(p.pricing_category || '').toLowerCase();
      if (!byCategory[cat]) byCategory[cat] = { cost: 0, volume: 0 };
      byCategory[cat].cost += Number(p.cost || 0);
      byCategory[cat].volume += Number(p.volume || 0);
    }
    for (const [cat, vals] of Object.entries(byCategory)) {
      costPerMsg[cat] = vals.volume > 0 ? vals.cost / vals.volume : 0;
    }
  }

  // Enriquecer templateAnalytics com taxa de leitura vinda das campanhas
  const readByCampaignTemplate = campaigns.reduce((acc, c) => {
    const key = c.templateName || '';
    if (!acc[key]) acc[key] = { delivered: 0, read: 0 };
    acc[key].delivered += c.delivered;
    acc[key].read += c.read;
    return acc;
  }, {});

  // Montar dados da tabela de templates a partir do message_queue (via backend)
  // O backend já retorna sent/delivered/read quando há dados; caso contrário retorna por categoria
  const templateTableData = templateAnalytics
    .filter(t => (t.sent || t.volume || 0) > 0)
    .map(t => {
      const name = t.templateName || t.category || '—';
      const cat = (t.category || 'MARKETING').toUpperCase();
      const sent = Number(t.sent || t.volume || 0);
      const delivered = Number(t.delivered || 0);
      const read = Number(t.read || 0);
      // Custo: vindo do backend (real_cost > estimated_cost > proporcional Meta)
      // Se ainda 0, estimar pelo custo médio da categoria do Meta pricing
      let custo = Number(t.cost || 0);
      if (!custo && sent > 0) {
        const catKey = Object.keys(costPerMsg).find(k => cat.toLowerCase().includes(k)) || '';
        custo = (costPerMsg[catKey] || 0) * sent;
      }
      // Taxa de leitura: prioriza os campos do backend, cai para dados de campanha
      let taxaLeitura = 0;
      if (delivered > 0 && read > 0) {
        taxaLeitura = (read / delivered) * 100;
      } else {
        const campaignRead = readByCampaignTemplate[name];
        if (campaignRead && campaignRead.delivered > 0) {
          taxaLeitura = (campaignRead.read / campaignRead.delivered) * 100;
        }
      }
      return { templateName: name, category: cat, sent, delivered, read, cost: custo * COTACAO_DOLAR, costUSD: custo, taxaLeitura };
    })
    .sort((a, b) => b.sent - a.sent);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const headers = ['Campanha', 'Template', 'Categoria', 'Data', 'Total', 'Enviadas', 'Entregues', 'Lidas', 'Respondidas', 'Falharam', 'Taxa Entrega', 'Taxa Leitura'];
    const rows = sorted.map(c => [
      c.campaignName,
      c.templateName,
      c.templateCategory,
      new Date(c.scheduledAt).toLocaleDateString('pt-BR'),
      c.total,
      c.sent,
      c.delivered,
      c.read,
      c.replied,
      c.failed,
      c.sent > 0 ? ((c.delivered / c.sent) * 100).toFixed(1) + '%' : '0%',
      c.delivered > 0 ? ((c.read / c.delivered) * 100).toFixed(1) + '%' : '0%',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_campanhas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="shadow-md rounded-xl bg-white">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Seletor de conta: só mostra se não veio activeAccount do pai */}
            {!activeAccount && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conta</label>
                <div className="relative">
                  <select
                    value={selectedAccount?.id || ''}
                    onChange={(e) => setSelectedAccount(accounts.find(a => String(a.id) === e.target.value))}
                    className="appearance-none bg-[#f8f9fb] border border-[#000638]/20 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-[#000638] focus:ring-2 focus:ring-[#000638]/30 outline-none"
                  >
                    {accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <CaretDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-[#f8f9fb] border border-[#000638]/20 rounded-lg px-3 py-2 text-sm text-[#000638] focus:ring-2 focus:ring-[#000638]/30 outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[#f8f9fb] border border-[#000638]/20 rounded-lg px-3 py-2 text-sm text-[#000638] focus:ring-2 focus:ring-[#000638]/30 outline-none"
              />
            </div>

            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all disabled:opacity-50">
              <ArrowClockwise size={16} weight="bold" />
              Atualizar
            </button>

            <button onClick={exportCSV} disabled={campaigns.length === 0} className="flex items-center gap-2 px-4 py-2 bg-[#000638] text-white rounded-lg text-sm font-semibold hover:bg-[#000638]/90 transition-all ml-auto disabled:opacity-50">
              <Export size={16} weight="bold" />
              Exportar CSV
            </button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <>
          {/* Chips de canal */}
          {contasCanal.length > 0 && (() => {
            const m = new Map();
            for (const c of contasCanal) {
              const k = c.canal_venda || 'sem_canal';
              m.set(k, (m.get(k) || 0) + 1);
            }
            const cores = { varejo: 'bg-blue-500', multimarcas: 'bg-purple-500', revenda: 'bg-emerald-500', franquia: 'bg-amber-500', hunter: 'bg-pink-500', financeiro: 'bg-slate-500' };
            return (
              <Card className="shadow-md rounded-xl bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Filtrar por canal</span>
                    {filterCanalVenda !== 'all' && (
                      <button onClick={() => setFilterCanalVenda('all')} className="text-[10px] text-blue-600 hover:underline font-semibold">× limpar</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterCanalVenda('all')} className={`text-xs font-bold px-3 py-1.5 rounded-full ring-1 transition ${filterCanalVenda === 'all' ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 ring-gray-200'}`}>
                      Todos canais <span className="ml-1.5 text-[10px] opacity-70">({contasCanal.length})</span>
                    </button>
                    {Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([c, n]) => {
                      const ativo = filterCanalVenda === c;
                      return (
                        <button key={c} onClick={() => setFilterCanalVenda(c)} className={`text-xs font-bold px-3 py-1.5 rounded-full ring-1 capitalize transition ${ativo ? `${cores[c] || 'bg-gray-500'} text-white ring-2` : 'bg-white text-gray-700 hover:bg-gray-50 ring-gray-300'}`}>
                          {c === 'sem_canal' ? 'Sem canal' : c}
                          <span className={`ml-1.5 text-[10px] ${ativo ? 'opacity-80' : 'opacity-60'}`}>({n})</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* RESULTADOS POR LOJA */}
          {(() => {
            const filtrados = templateStatsAllLojas.filter((t) => {
              if (filterCanalVenda !== 'all' && (t.canal_venda || '').toLowerCase() !== filterCanalVenda) return false;
              if (filterGrupo !== 'all' && (filterGrupo === '__sem_grupo__' ? !!t.grupo : (t.grupo || '').toLowerCase() !== filterGrupo)) return false;
              if (filterCategory !== 'all' && (t.template_category || '').toUpperCase() !== filterCategory) return false;
              if (filterTemplate !== 'all' && t.template_name !== filterTemplate) return false;
              return true;
            });
            const porLoja = new Map();
            for (const t of filtrados) {
              if (!porLoja.has(t.waba_id)) porLoja.set(t.waba_id, { waba_id: t.waba_id, name: t.account_name || t.waba_id, canal_venda: t.canal_venda, templates: 0, sent: 0, delivered: 0, read: 0, replied: 0, cost_usd: 0 });
              const g = porLoja.get(t.waba_id);
              g.templates++; g.sent += +t.sent || 0; g.delivered += +t.delivered || 0; g.read += +t.read || 0; g.replied += +t.replied || 0; g.cost_usd += +t.cost_usd || 0;
            }
            const synced = new Set(templateStatsAllLojas.map((t) => t.waba_id));
            for (const c of contasCanal) {
              if (filterCanalVenda !== 'all' && (c.canal_venda || '').toLowerCase() !== filterCanalVenda) continue;
              if (!porLoja.has(c.waba_id)) porLoja.set(c.waba_id, { waba_id: c.waba_id, name: c.name, canal_venda: c.canal_venda, templates: 0, sent: 0, delivered: 0, read: 0, replied: 0, cost_usd: 0, sem_sync: !synced.has(c.waba_id) });
            }
            const lojas = Array.from(porLoja.values()).sort((a, b) => b.sent - a.sent);
            const tot = lojas.reduce((s, l) => ({ sent: s.sent + l.sent, delivered: s.delivered + l.delivered, read: s.read + l.read, replied: s.replied + l.replied, cost_usd: s.cost_usd + l.cost_usd }), { sent: 0, delivered: 0, read: 0, replied: 0, cost_usd: 0 });
            if (lojas.length === 0) return null;
            const nomesTemplates = Array.from(new Set(templateStatsAllLojas
              .filter((t) => filterCanalVenda === 'all' || (t.canal_venda || '').toLowerCase() === filterCanalVenda)
              .filter((t) => filterGrupo === 'all' || (filterGrupo === '__sem_grupo__' ? !t.grupo : (t.grupo || '').toLowerCase() === filterGrupo))
              .map((t) => t.template_name))).sort();
            return (
              <Card ref={lojasCardRef} className="shadow-md rounded-xl bg-white overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-[#000638] via-[#1a2461] to-[#000638] text-white">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <div className="bg-white/10 p-1.5 rounded-lg"><Users size={18} weight="duotone" /></div>
                      Resultados por Loja
                      {filterCanalVenda !== 'all' && <span className="text-[10px] font-bold bg-blue-500/30 ring-1 ring-blue-300/40 px-2 py-0.5 rounded-full uppercase tracking-wider">{filterCanalVenda}</span>}
                      {filterGrupo !== 'all' && <span className="text-[10px] font-bold bg-emerald-500/30 ring-1 ring-emerald-300/40 px-2 py-0.5 rounded-full">{filterGrupo === '__sem_grupo__' ? 'sem grupo' : filterGrupo}</span>}
                      {filterTemplate !== 'all' && <span className="text-[10px] font-bold bg-purple-500/30 ring-1 ring-purple-300/40 px-2 py-0.5 rounded-full">{filterTemplate}</span>}
                    </CardTitle>
                    <div className="flex items-center gap-2" data-h2c-ignore="true">
                      <button onClick={baixarLojasCard} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center gap-1.5 border border-white/20 transition">
                        <DownloadSimple size={12} weight="bold" /> Baixar
                      </button>
                      {filterCanalVenda !== 'all' && (
                        <button onClick={handleSyncMassaCanal} disabled={!!syncingMass} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white inline-flex items-center gap-1.5 transition disabled:opacity-60">
                          <ArrowClockwise size={12} weight="bold" className={syncingMass ? 'animate-spin' : ''} />
                          {syncingMass ? `${syncingMass.current}/${syncingMass.total}…` : `Sincronizar todas ${filterCanalVenda}`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3 text-[11px] text-white/70">
                    <div className="flex items-center gap-4 tabular-nums">
                      <span><b className="text-white">{lojas.length}</b> lojas</span><span>·</span>
                      <span><b className="text-white">{tot.sent.toLocaleString('pt-BR')}</b> enviadas</span><span>·</span>
                      <span><b className="text-emerald-200">{tot.delivered.toLocaleString('pt-BR')}</b> entregues</span><span>·</span>
                      <span><b className="text-amber-200">{tot.replied.toLocaleString('pt-BR')}</b> respostas</span><span>·</span>
                      <span><b className="text-emerald-200">{formatCurrency(tot.cost_usd * COTACAO_DOLAR)}</b></span>
                    </div>
                    <span className="text-[10px] text-white/50">{startDate} → {endDate}</span>
                  </div>
                  {nomesTemplates.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap" data-h2c-ignore="true">
                      <label className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Template:</label>
                      <select value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)} className="appearance-none bg-white/10 border border-white/20 rounded-lg px-3 py-1 pr-7 text-xs font-semibold text-white focus:ring-2 focus:ring-purple-300 outline-none cursor-pointer min-w-[240px]">
                        <option value="all" className="text-gray-900">Todos os templates ({nomesTemplates.length})</option>
                        {nomesTemplates.map((n) => <option key={n} value={n} className="text-gray-900">{n}</option>)}
                      </select>
                      {filterTemplate !== 'all' && <button onClick={() => setFilterTemplate('all')} className="text-[10px] text-white/70 hover:text-white font-semibold">× limpar</button>}
                    </div>
                  )}
                  {syncingMass && (
                    <div className="mt-3 flex items-center gap-2 bg-emerald-500/20 ring-1 ring-emerald-300/40 rounded-lg px-3 py-2">
                      <ArrowClockwise size={14} weight="bold" className="animate-spin text-emerald-200" />
                      <span className="text-[12px] text-emerald-100 font-semibold">Sincronizando {syncingMass.canal} — {syncingMass.current}/{syncingMass.total}{syncingMass.currentName && <> · {syncingMass.currentName}</>}</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {lojas.map((l, idx) => {
                      const tEntrega = l.sent > 0 ? (l.delivered / l.sent) * 100 : 0;
                      const tLeitura = l.delivered > 0 ? (l.read / l.delivered) * 100 : 0;
                      const tResp = l.delivered > 0 ? (l.replied / l.delivered) * 100 : 0;
                      const maxS = lojas[0]?.sent || 1;
                      const barW = (l.sent / maxS) * 100;
                      const top3 = idx < 3 && l.sent > 0;
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                      return (
                        <div key={l.waba_id} className={`px-5 py-3.5 hover:bg-gray-50/50 transition ${l.sem_sync ? 'opacity-60' : ''}`}>
                          <div className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${top3 ? (idx === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300' : idx === 1 ? 'bg-gray-100 text-gray-700 ring-2 ring-gray-300' : 'bg-orange-100 text-orange-700 ring-2 ring-orange-300') : 'bg-gray-50 text-gray-500'}`}>{medal || `#${idx + 1}`}</div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-sm font-bold text-[#000638] truncate">{l.name}</h4>
                                  {l.sem_sync && <span className="text-[9px] uppercase font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">sem sync</span>}
                                </div>
                                <p className="text-[10px] text-gray-400 truncate">{l.sem_sync ? 'Aguardando sincronização' : `${l.templates} template${l.templates !== 1 ? 's' : ''} · ${l.canal_venda || ''}`}</p>
                              </div>
                            </div>
                            <div className="col-span-6">
                              <div className="grid grid-cols-4 gap-2 mb-1.5">
                                <div className="text-center"><p className="text-[9px] uppercase tracking-wider font-bold text-gray-500">Enviadas</p><p className="text-sm font-bold text-[#000638] tabular-nums">{l.sent.toLocaleString('pt-BR')}</p></div>
                                <div className="text-center"><p className="text-[9px] uppercase tracking-wider font-bold text-emerald-600">Entregues</p><p className="text-sm font-bold text-emerald-700 tabular-nums">{l.delivered.toLocaleString('pt-BR')}<span className="text-[9px] text-emerald-500 ml-0.5">{l.sent > 0 ? `(${tEntrega.toFixed(0)}%)` : ''}</span></p></div>
                                <div className="text-center"><p className="text-[9px] uppercase tracking-wider font-bold text-indigo-600">Lidas</p><p className="text-sm font-bold text-indigo-700 tabular-nums">{l.read.toLocaleString('pt-BR')}<span className="text-[9px] text-indigo-500 ml-0.5">{l.delivered > 0 ? `(${tLeitura.toFixed(0)}%)` : ''}</span></p></div>
                                <div className="text-center"><p className="text-[9px] uppercase tracking-wider font-bold text-amber-600">Respostas</p><p className="text-sm font-bold text-amber-700 tabular-nums">{l.replied.toLocaleString('pt-BR')}<span className="text-[9px] text-amber-500 ml-0.5">{l.delivered > 0 ? `(${tResp.toFixed(1)}%)` : ''}</span></p></div>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${top3 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-blue-300 to-blue-500'}`} style={{ width: `${barW}%` }} />
                              </div>
                            </div>
                            <div className="col-span-3 text-right">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500">Custo</p>
                              <p className="text-base font-extrabold text-emerald-700 tabular-nums leading-tight">{formatCurrency(l.cost_usd * COTACAO_DOLAR)}</p>
                              <p className="text-[9px] text-gray-400 tabular-nums">{formatCurrency(l.cost_usd, 'USD')}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-gradient-to-r from-[#000638] via-[#1a2461] to-[#000638] text-white px-5 py-3">
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-3 flex items-center gap-2"><Trophy size={16} weight="fill" className="text-yellow-300" /><span className="text-[11px] font-bold uppercase tracking-wider">Total {lojas.length} lojas</span></div>
                      <div className="col-span-6 grid grid-cols-4 gap-2 text-center text-xs tabular-nums font-bold">
                        <div><p className="text-[9px] uppercase tracking-wider text-white/60">Enviadas</p><p>{tot.sent.toLocaleString('pt-BR')}</p></div>
                        <div><p className="text-[9px] uppercase tracking-wider text-emerald-300">Entregues</p><p className="text-emerald-200">{tot.delivered.toLocaleString('pt-BR')}</p></div>
                        <div><p className="text-[9px] uppercase tracking-wider text-indigo-300">Lidas</p><p className="text-indigo-200">{tot.read.toLocaleString('pt-BR')}</p></div>
                        <div><p className="text-[9px] uppercase tracking-wider text-amber-300">Respostas</p><p className="text-amber-200">{tot.replied.toLocaleString('pt-BR')}</p></div>
                      </div>
                      <div className="col-span-3 text-right"><p className="text-[9px] uppercase tracking-wider text-emerald-300">Custo total</p><p className="text-base font-extrabold text-emerald-200 tabular-nums leading-tight">{formatCurrency(tot.cost_usd * COTACAO_DOLAR)}</p></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* KPI Cards - 4 Indicadores Principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-md rounded-xl bg-white border-l-4 border-blue-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total de Mensagens</p>
                    <p className="text-2xl font-bold text-[#000638]">{effectiveTotal.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-gray-400 mt-1">{campaigns.length > 0 ? `${campaigns.length} campanha${campaigns.length !== 1 ? 's' : ''}` : 'Via Meta API'}</p>
                  </div>
                  <div className="bg-blue-500 p-3 rounded-xl">
                    <ChatTeardropText size={24} weight="bold" className="text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md rounded-xl bg-white border-l-4 border-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Taxa de Entrega</p>
                    <p className="text-2xl font-bold text-[#000638]">{deliveryRate}%</p>
                    <p className="text-xs text-gray-400 mt-1">{effectiveDelivered.toLocaleString('pt-BR')} de {effectiveSent.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-emerald-500 p-3 rounded-xl">
                    <CheckCircle size={24} weight="bold" className="text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md rounded-xl bg-white border-l-4 border-indigo-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Taxa de Leitura</p>
                    <p className="text-2xl font-bold text-[#000638]">{readRate}%</p>
                    <p className="text-xs text-gray-400 mt-1">{effectiveRead.toLocaleString('pt-BR')} de {effectiveDelivered.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-indigo-500 p-3 rounded-xl">
                    <EyeIcon size={24} weight="bold" className="text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md rounded-xl bg-white border-l-4 border-emerald-600">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Custo Total</p>
                    <p className="text-2xl font-bold text-[#000638]">{formatCurrency(totalCost)}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatCurrency(totalCostUSD, 'USD')} · Câmbio R$ {COTACAO_DOLAR.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-600 p-3 rounded-xl">
                    <CurrencyDollar size={24} weight="bold" className="text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela resumo por Template - padrão Meta Insights */}
          <Card className="shadow-md rounded-xl bg-white overflow-hidden">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-bold text-[#000638] flex items-center gap-2">
                  <CurrencyDollar size={20} weight="bold" />
                  Resumo por Template
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {templateTableData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f8f9fb] border-b">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Template</th>
                        <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Categoria</th>
                        <th className="text-right p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Msgs Enviadas</th>
                        <th className="text-right p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Taxa de Leitura</th>
                        <th className="text-right p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Custo (USD)</th>
                        <th className="text-right p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Custo (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateTableData.map((t, i) => {
                        const catLower = t.category.toLowerCase();
                        const catBadge = catLower.includes('marketing') ? 'bg-orange-100 text-orange-700' :
                          catLower.includes('utility') ? 'bg-blue-100 text-blue-700' :
                          catLower.includes('auth') ? 'bg-purple-100 text-purple-700' :
                          catLower.includes('service') ? 'bg-indigo-100 text-indigo-700' :
                          'bg-gray-100 text-gray-600';

                        let readBadge = 'bg-gray-100 text-gray-500';
                        if (t.taxaLeitura >= 50) readBadge = 'bg-emerald-100 text-emerald-700';
                        else if (t.taxaLeitura >= 30) readBadge = 'bg-amber-100 text-amber-700';
                        else if (t.taxaLeitura > 0) readBadge = 'bg-red-100 text-red-700';

                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-semibold text-[#000638] max-w-[220px] truncate">{t.templateName}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${catBadge}`}>
                                {categoryLabel(t.category)}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-right">{t.sent.toLocaleString('pt-BR')}</td>
                            <td className="p-3 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${readBadge}`}>
                                {t.taxaLeitura > 0 ? `${t.taxaLeitura.toFixed(1)}%` : '—'}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-gray-600 text-right">{formatCurrency(t.costUSD, 'USD')}</td>
                            <td className="p-3 font-bold text-emerald-700 text-right">{formatCurrency(t.cost)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-[#f8f9fb] border-t-2 border-[#000638]/10">
                      <tr className="font-bold text-[#000638]">
                        <td className="p-3">TOTAL</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right">{templateTableData.reduce((s, t) => s + t.sent, 0).toLocaleString('pt-BR')}</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-gray-600 text-right">{formatCurrency(templateTableData.reduce((s, t) => s + t.costUSD, 0), 'USD')}</td>
                        <td className="p-3 text-emerald-700 text-right">{formatCurrency(templateTableData.reduce((s, t) => s + t.cost, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ChartBar size={36} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-medium">Nenhum dado de template para o período selecionado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela de campanhas */}
          {campaigns.length > 0 ? (
            <Card className="shadow-md rounded-xl bg-white overflow-hidden">
              <CardHeader className="pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-[#000638] flex items-center gap-2">
                  <TrendUp size={20} weight="bold" />
                  Performance por Campanha
                </CardTitle>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Atualizar dados"
                >
                  <ArrowClockwise size={14} weight="bold" className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Atualizando...' : 'Atualizar'}
                </button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f8f9fb] border-b">
                      <tr>
                        {[
                          { key: 'campaignName', label: 'Campanha' },
                          { key: 'templateName', label: 'Template' },
                          { key: 'scheduledAt', label: 'Data' },
                          { key: 'total', label: 'Total' },
                          { key: 'sent', label: 'Enviadas' },
                          { key: 'delivered', label: 'Entregues' },
                          { key: 'read', label: 'Lidas' },
                          { key: 'replied', label: 'Respondidas' },
                          { key: 'failed', label: 'Falharam' },
                        ].map(col => (
                          <th
                            key={col.key}
                            onClick={() => toggleSort(col.key)}
                            className="text-left p-3 font-semibold text-gray-500 cursor-pointer hover:text-[#000638] transition-colors text-xs uppercase tracking-wide select-none"
                          >
                            {col.label} {sortKey === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                          </th>
                        ))}
                        <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Entrega</th>
                        <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Leitura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(c => {
                        const dr = c.sent > 0 ? ((c.delivered / c.sent) * 100).toFixed(1) : 0;
                        const rr = c.delivered > 0 ? ((c.read / c.delivered) * 100).toFixed(1) : 0;
                        return (
                          <tr key={c.campaignId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-semibold text-[#000638] max-w-[180px] truncate">{c.campaignName}</td>
                            <td className="p-3 text-gray-600">{c.templateName}</td>
                            <td className="p-3 text-gray-500 text-xs">{new Date(c.scheduledAt).toLocaleDateString('pt-BR')}</td>
                            <td className="p-3 font-semibold">{c.total}</td>
                            <td className="p-3">{c.sent}</td>
                            <td className="p-3">{c.delivered}</td>
                            <td className="p-3">{c.read}</td>
                            <td className="p-3">{c.replied}</td>
                            <td className="p-3 text-red-600 font-semibold">{c.failed}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${Number(dr) >= 90 ? 'bg-emerald-100 text-emerald-700' : Number(dr) >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {dr}%
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${Number(rr) >= 50 ? 'bg-emerald-100 text-emerald-700' : Number(rr) >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {rr}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-[#f8f9fb] border-t-2 border-[#000638]/10">
                      <tr className="font-bold text-[#000638]">
                        <td className="p-3">TOTAL</td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3">{totals.total.toLocaleString('pt-BR')}</td>
                        <td className="p-3">{totals.sent.toLocaleString('pt-BR')}</td>
                        <td className="p-3">{totals.delivered.toLocaleString('pt-BR')}</td>
                        <td className="p-3">{totals.read.toLocaleString('pt-BR')}</td>
                        <td className="p-3">{totals.replied.toLocaleString('pt-BR')}</td>
                        <td className="p-3 text-red-600">{totals.failed.toLocaleString('pt-BR')}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#000638] text-white">{totals.sent > 0 ? ((totals.delivered / totals.sent) * 100).toFixed(1) : '0.0'}%</span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#000638] text-white">{totals.delivered > 0 ? ((totals.read / totals.delivered) * 100).toFixed(1) : '0.0'}%</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16">
              <ChartBar size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Nenhum dado de campanha para exibir</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WhatsAppReports;
