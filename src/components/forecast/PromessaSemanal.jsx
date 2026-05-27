// Promessa Semanal por Canal — visualização (padrão "Faturamento × Meta")
// Metas vêm da aba "Métricas por Canal" → Faturamento × Meta.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target,
  Storefront,
  Buildings,
  TShirt,
  Tag,
  Briefcase,
  Package,
  ChartBar,
  CreditCard,
  TrendUp,
  CurrencyDollar,
  Lightning,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import EnviarWhatsappModal from './EnviarWhatsappModal';
import {
  MetricaHeader,
  KpiStripe,
  PctPill,
  MiniProgress,
  LoadingRow,
  LoadingValue,
  InfoBanner,
  formatBRL,
  formatBRLCompact,
  pctColor,
} from './MetricasDiariasUI';

// Config visual de cada canal
const CANAL_CFG = {
  varejo:         { label: 'Varejo',             icon: Storefront, text: 'text-blue-600', bg: 'bg-blue-50' },
  revenda:        { label: 'Revenda',            icon: Package,    text: 'text-emerald-600', bg: 'bg-emerald-50' },
  multimarcas:    { label: 'Multimarcas',        icon: TShirt,     text: 'text-purple-600', bg: 'bg-purple-50' },
  inbound_david:  { label: 'MTM Inbound David',  icon: TShirt,     text: 'text-pink-600', bg: 'bg-pink-50' },
  inbound_rafael: { label: 'MTM Inbound Rafael', icon: TShirt,     text: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
  franquia:       { label: 'Franquia',           icon: Buildings,  text: 'text-amber-700', bg: 'bg-amber-50' },
  bazar:          { label: 'Bazar',              icon: Tag,        text: 'text-orange-600', bg: 'bg-orange-50' },
  fabrica:        { label: 'Fábrica (Kleiton)',  icon: Buildings,  text: 'text-cyan-700', bg: 'bg-cyan-50' },
  business:       { label: 'Business',           icon: Briefcase,  text: 'text-slate-700', bg: 'bg-slate-50' },
  ricardoeletro:  { label: 'Ricardo Eletro',     icon: Storefront, text: 'text-red-600', bg: 'bg-red-50' },
  bluecard:       { label: 'BlueCard',           icon: CreditCard, text: 'text-sky-600', bg: 'bg-sky-50' },
};

const fmtCanalValor = (canal, valor, opts = {}) => {
  if (canal?.is_quantity) {
    const n = Math.round(Number(valor || 0));
    if (opts.compact) return `${n}`;
    return `${n} ${canal.unit || 'un'}`;
  }
  if (opts.compact) return formatBRLCompact(valor);
  return `R$ ${formatBRL(valor)}`;
};

const api = {
  async req(path) {
    const r = await fetch(`${API_BASE_URL}/api/forecast${path}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) throw new Error(j?.message || `HTTP ${r.status}`);
    return j.data;
  },
};

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { ano: d.getUTCFullYear(), semana: weekNo };
}

const fmtDataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export default function PromessaSemanal() {
  // Recomputa "agora" a cada minuto pra cobrir virada de dia/semana em
  // wall-displays abertos por dias.
  const [nowKey, setNowKey] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowKey(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const cur = isoWeek(new Date(nowKey));
  const [ano, setAno] = useState(cur.ano);
  const [semana, setSemana] = useState(cur.semana);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showWhats, setShowWhats] = useState(false);
  const [untilToday, setUntilToday] = useState(false);
  const cardRef = useRef(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = `?ano=${ano}&semana=${semana}${untilToday ? '&until_today=true' : ''}`;
      const d = await api.req(`/promessa-semanal${qs}`);
      setData(d);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [ano, semana, untilToday]);

  useEffect(() => { carregar(); }, [carregar]);

  const semanaAnterior = () => {
    if (semana <= 1) { setAno(ano - 1); setSemana(52); } else setSemana(semana - 1);
  };
  const semanaProxima = () => {
    if (semana >= 53) { setAno(ano + 1); setSemana(1); } else setSemana(semana + 1);
  };
  const irParaAtual = () => { setAno(cur.ano); setSemana(cur.semana); };

  const canais = data?.canais || [];
  const total = data?.total || {};

  // KPIs do topo (filtrando canais monetários do total)
  const kpis = data ? [
    {
      label: 'Meta Semana',
      valor: `R$ ${formatBRL(total.meta_realista || 0)}`,
      icon: Target,
      color: 'blue',
      sub: `${data.dias_uteis_decorridos || 0}/${data.dias_uteis_total || 0} dias úteis`,
    },
    {
      label: 'Real Acumulado',
      valor: `R$ ${formatBRL(total.faturamento_real || 0)}`,
      icon: CurrencyDollar,
      color: 'emerald',
      sub: data?.data_inicio ? `${fmtDataBr(data.data_inicio)} → ${fmtDataBr(data.data_fim)}` : '',
    },
    {
      label: 'Qnt Deveria',
      valor: `R$ ${formatBRL(total.qnt_deveria || 0)}`,
      icon: TrendUp,
      color: 'amber',
      sub: 'Ritmo esperado',
    },
    {
      label: 'Fat. Ontem',
      valor: `R$ ${formatBRL(total.fat_dia_anterior || 0)}`,
      icon: Lightning,
      color: 'purple',
      sub: 'Dia anterior',
    },
    {
      label: '% Realizado',
      valor: `${Number(total.percentual || 0).toFixed(0)}%`,
      icon: ChartBar,
      color: Math.round(total.percentual || 0) >= 100 ? 'emerald' : Math.round(total.percentual || 0) >= 70 ? 'amber' : 'rose',
      sub: `Real / Meta`,
    },
  ] : [];

  return (
    <div ref={cardRef} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <MetricaHeader
        title="Promessa Semanal por Canal"
        subtitle={
          data
            ? `Semana ${data.semana_iso}/${data.ano} · ${fmtDataBr(data.data_inicio)}–${fmtDataBr(data.data_fim)}`
            : `Semana ${semana}/${ano}`
        }
        icon={Target}
        color="blue"
        onPrev={semanaAnterior}
        onNext={semanaProxima}
        onToday={irParaAtual}
        untilToday={untilToday}
        setUntilToday={setUntilToday}
        onRefresh={carregar}
        loading={loading}
        onWhatsapp={() => setShowWhats(true)}
      />

      {data && <KpiStripe items={kpis} loading={loading && canais.length === 0} />}

      {erro && (
        <div className="p-4">
          <InfoBanner tone="rose">{erro}</InfoBanner>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
              <th className="py-2.5 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Canal</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Meta</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Real</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Qnt Dev.</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Meta/Dia</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Fat. Ontem</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[120px]">% Realizado</th>
            </tr>
          </thead>
          <tbody>
            {loading && canais.length === 0
              ? [1,2,3,4,5,6,7].map((i) => <LoadingRow key={i} cols={7} />)
              : canais.map((c, idx) => {
                  const cfg = CANAL_CFG[c.canal_key] || { label: c.nome, icon: ChartBar, text: 'text-gray-600', bg: 'bg-gray-50' };
                  const Icon = cfg.icon;
                  const hasMeta = c.meta_realista > 0;
                  const isQty = c.is_quantity;
                  // Zebra: linha par usa branco, ímpar usa cinza muito suave.
                  // Quando é canal quantitativo (BlueCard), prevalece o sky/30.
                  const zebraBg = isQty ? 'bg-sky-50/30' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40');
                  return (
                    <tr
                      key={c.canal_key}
                      className={`border-b border-gray-100 transition-colors hover:bg-blue-50/40 ${zebraBg}`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-2">
                          <div className={`${cfg.bg} p-1 rounded`}>
                            <Icon size={12} weight="bold" className={cfg.text} />
                          </div>
                          <span className="font-semibold text-gray-800 text-[13px]">{cfg.label}</span>
                          {isQty && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                              qty
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 text-[12px]">
                        {hasMeta ? fmtCanalValor(c, c.meta_realista) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 font-semibold">
                        {loading ? <LoadingValue /> : fmtCanalValor(c, c.faturamento_real)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 text-[12px]">
                        {hasMeta ? fmtCanalValor(c, c.qnt_deveria) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 text-[12px]">
                        {c.meta_do_dia > 0 ? fmtCanalValor(c, c.meta_do_dia) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 text-[12px]">
                        {loading ? <LoadingValue /> : fmtCanalValor(c, c.fat_dia_anterior)}
                      </td>
                      <td className="py-2.5 px-3">
                        {hasMeta ? (
                          <div className="flex flex-col items-end gap-1">
                            <PctPill pct={c.percentual} />
                            <div className="w-full max-w-[100px]">
                              <MiniProgress pct={c.percentual} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs flex justify-end">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            {!loading && canais.length > 0 && (
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 font-bold border-t-2 border-gray-300">
                <td className="py-3 px-3 text-gray-800 text-[13px] uppercase tracking-wider">Total</td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                  R$ {formatBRL(total.meta_realista)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-900 font-extrabold text-[13px]">
                  {loading ? <LoadingValue /> : `R$ ${formatBRL(total.faturamento_real)}`}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                  R$ {formatBRL(total.qnt_deveria)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                  R$ {formatBRL(total.meta_do_dia)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                  {loading ? <LoadingValue /> : `R$ ${formatBRL(total.fat_dia_anterior)}`}
                </td>
                <td className="py-3 px-3">
                  <div className="flex justify-end">
                    {total.meta_realista > 0 ? (
                      <PctPill pct={total.percentual || 0} size="md" />
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showWhats && (
        <EnviarWhatsappModal
          targetRef={cardRef}
          tipo="semanal"
          reportTipo="semanal"
          reportData={data}
          titulo={`Promessa Semanal ${data?.period_key || `${ano}-W${semana}`}`}
          params={{ ano, semana }}
          onClose={() => setShowWhats(false)}
        />
      )}
    </div>
  );
}
