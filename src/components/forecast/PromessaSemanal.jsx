// Promessa Semanal por Canal — visualização (padrão "Faturamento × Meta")
// Metas vêm da aba "Métricas por Canal" → Faturamento × Meta.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target,
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Spinner,
  Storefront,
  Buildings,
  TShirt,
  Tag,
  Briefcase,
  Package,
  ChartBar,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { Card, CardContent } from '../ui/cards';
import { API_BASE_URL } from '../../config/constants';
import EnviarWhatsappModal from './EnviarWhatsappModal';

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Placeholder pulsando para cells em loading
function LoadingValue({ width = 70 }) {
  return (
    <span className="inline-block bg-gray-200 rounded animate-pulse" style={{ width: width + 'px', height: '14px' }}>&nbsp;</span>
  );
}

const pctColor = (pct) => {
  if (pct >= 100) return 'text-emerald-600 bg-emerald-50';
  if (pct >= 70) return 'text-amber-600 bg-amber-50';
  return 'text-rose-600 bg-rose-50';
};

// Config visual de cada canal (alinhado com Forecast "Por Canal")
const CANAL_CFG = {
  varejo:         { label: 'Varejo',             icon: Storefront, text: 'text-blue-600' },
  revenda:        { label: 'Revenda',            icon: Package,    text: 'text-emerald-600' },
  multimarcas:    { label: 'Multimarcas',        icon: TShirt,     text: 'text-purple-600' },
  inbound_david:  { label: 'MTM Inbound David',  icon: TShirt,     text: 'text-pink-600' },
  inbound_rafael: { label: 'MTM Inbound Rafael', icon: TShirt,     text: 'text-fuchsia-600' },
  franquia:       { label: 'Franquia',           icon: Buildings,  text: 'text-amber-700' },
  bazar:          { label: 'Bazar',              icon: Tag,        text: 'text-orange-600' },
  fabrica:        { label: 'Fábrica (Kleiton)',  icon: Buildings,  text: 'text-cyan-700' },
  business:       { label: 'Business',           icon: Briefcase,  text: 'text-slate-700' },
  ricardoeletro:  { label: 'Ricardo Eletro',     icon: Storefront, text: 'text-red-600' },
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

// Última semana completa (segunda passada → domingo passado).
// Mesma referência usada na aba "Métricas por Canal".
function lastCompletedIsoWeek() {
  const today = new Date();
  const dow = today.getUTCDay();
  const daysSinceLastSunday = dow === 0 ? 7 : dow;
  const sun = new Date(today);
  sun.setUTCDate(today.getUTCDate() - daysSinceLastSunday);
  return isoWeek(sun);
}

const fmtDataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export default function PromessaSemanal() {
  // Default: semana corrente (ISO em curso) — visão operacional do dia
  const cur = isoWeek(new Date());
  const [ano, setAno] = useState(cur.ano);
  const [semana, setSemana] = useState(cur.semana);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showWhats, setShowWhats] = useState(false);
  const [untilToday, setUntilToday] = useState(false); // false = até ontem (D-1); true = até hoje
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

  return (
    <div ref={cardRef}>
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Target size={20} className="text-blue-700" />
            <h3 className="text-lg font-semibold text-gray-800">Promessa Semanal por Canal</h3>
            <span className="text-xs text-gray-500">
              ({data?.period_key || `${ano}-W${String(semana).padStart(2, '0')}`}
              {data?.data_inicio && ` [${fmtDataBr(data.data_inicio)}–${fmtDataBr(data.data_fim)}]`}
              {' · '}
              {data ? `${data.dias_uteis_decorridos}/${data.dias_uteis_total} dias úteis` : ''})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={semanaAnterior}
              className="p-1.5 text-gray-500 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
              title="Semana anterior"
            >
              <CaretLeft size={12} />
            </button>
            <button
              onClick={irParaAtual}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              title="Ir para semana atual"
            >
              Hoje
            </button>
            <button
              onClick={semanaProxima}
              className="p-1.5 text-gray-500 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
              title="Próxima semana"
            >
              <CaretRight size={12} />
            </button>
            {/* Toggle: até ontem (D-1) ↔ até hoje */}
            <button
              onClick={() => setUntilToday((v) => !v)}
              className={`text-xs px-2.5 py-1.5 rounded border inline-flex items-center gap-1 ml-1 transition ${
                untilToday
                  ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title={untilToday ? 'Mostrando dados até HOJE (parcial)' : 'Mostrando dados até ONTEM (fechado)'}
            >
              <span className={`w-2 h-2 rounded-full ${untilToday ? 'bg-emerald-300 animate-pulse' : 'bg-gray-400'}`} />
              {untilToday ? 'Hoje' : 'Até ontem'}
            </button>
            <button
              onClick={carregar}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50 ml-1"
              title="Atualizar"
            >
              <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
            <button
              onClick={() => setShowWhats(true)}
              className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1"
              title="Enviar via WhatsApp"
            >
              <WhatsappLogo size={12} weight="bold" /> WhatsApp
            </button>
          </div>
        </div>

        {erro && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {erro}
          </div>
        )}

        {/* Banner global de "atualizando" quando refetching com dados visíveis */}
        {loading && canais.length > 0 && (
          <div className="mb-2 text-[11px] text-blue-600 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Atualizando valores...
          </div>
        )}

        {loading && canais.length === 0 ? (
          /* Skeleton inicial */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Canal</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta Realista</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturamento Real</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qnt Deveria</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta do Dia</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Fat. Dia Anterior</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody>
                {[1,2,3,4,5,6,7].map((i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-3"><LoadingValue width={90} /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue width={40} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Canal</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta Realista</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturamento Real</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qnt Deveria</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta do Dia</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Fat. Dia Anterior</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody>
                {canais.map((c) => {
                  const cfg = CANAL_CFG[c.canal_key] || { label: c.nome, icon: ChartBar, text: 'text-gray-600' };
                  const Icon = cfg.icon;
                  const hasMeta = c.meta_realista > 0;
                  return (
                    <tr key={c.canal_key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-800">
                        <div className="inline-flex items-center gap-2">
                          <Icon size={14} weight="bold" className={cfg.text} />
                          {cfg.label}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {hasMeta ? `R$ ${formatBRL(c.meta_realista)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                        {loading ? <LoadingValue /> : `R$ ${formatBRL(c.faturamento_real)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {hasMeta ? `R$ ${formatBRL(c.qnt_deveria)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {c.meta_do_dia > 0 ? `R$ ${formatBRL(c.meta_do_dia)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {loading ? <LoadingValue /> : `R$ ${formatBRL(c.fat_dia_anterior)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {hasMeta ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctColor(c.percentual)}`}>
                            {c.percentual.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="py-3 px-3 text-gray-800">Total</td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    R$ {formatBRL(total.meta_realista)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
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
                  <td className="py-3 px-3 text-right tabular-nums">
                    {total.meta_realista > 0 ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctColor(total.percentual || 0)}`}>
                        {Number(total.percentual || 0).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    {showWhats && (
      <EnviarWhatsappModal
        targetRef={cardRef}
        tipo="semanal"
        titulo={`Promessa Semanal ${data?.period_key || `${ano}-W${semana}`}`}
        params={{ ano, semana }}
        onClose={() => setShowWhats(false)}
      />
    )}
    </div>
  );
}
