// Promessa Mensal de Canais — visualização (padrão "Faturamento × Meta")
// Metas vêm da aba "Métricas por Canal" → Faturamento × Meta.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target,
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
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

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function LoadingValue({ width = 70 }) {
  return (
    <span className="inline-block bg-gray-200 rounded animate-pulse" style={{ width: width + 'px', height: '14px' }}>&nbsp;</span>
  );
}

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pctColor = (pct) => {
  if (pct >= 100) return 'text-emerald-600 bg-emerald-50';
  if (pct >= 70) return 'text-amber-600 bg-amber-50';
  return 'text-rose-600 bg-rose-50';
};

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

export default function PromessaMensal() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showWhats, setShowWhats] = useState(false);
  const [untilToday, setUntilToday] = useState(false); // false = D-1 (default); true = até hoje
  const cardRef = useRef(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = `?ano=${ano}&mes=${mes}${untilToday ? '&until_today=true' : ''}`;
      const d = await api.req(`/promessa-mensal${qs}`);
      setData(d);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [ano, mes, untilToday]);

  useEffect(() => { carregar(); }, [carregar]);

  const mesAnterior = () => {
    if (mes <= 1) { setAno(ano - 1); setMes(12); } else setMes(mes - 1);
  };
  const mesProximo = () => {
    if (mes >= 12) { setAno(ano + 1); setMes(1); } else setMes(mes + 1);
  };
  const irParaAtual = () => { setAno(now.getFullYear()); setMes(now.getMonth() + 1); };

  const canais = data?.canais || [];
  const total = data?.total || {};

  return (
    <div ref={cardRef}>
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Target size={20} className="text-blue-700" />
            <h3 className="text-lg font-semibold text-gray-800">Promessa Mensal de Canais</h3>
            <span className="text-xs text-gray-500">
              ({data?.period_key || `${ano}-${String(mes).padStart(2, '0')}`} · {MESES[mes - 1]}/{ano}
              {data && ` · ${data.dias_uteis_decorridos}/${data.dias_uteis_total} dias úteis`})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={mesAnterior}
              className="p-1.5 text-gray-500 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
              title="Mês anterior"
            >
              <CaretLeft size={12} />
            </button>
            <button
              onClick={irParaAtual}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              title="Mês atual"
            >
              Hoje
            </button>
            <button
              onClick={mesProximo}
              className="p-1.5 text-gray-500 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
              title="Próximo mês"
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

        {/* Banner de "atualizando" enquanto refetching com dados visíveis */}
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
              <tbody>
                {[1,2,3,4,5,6,7].map((i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-3"><LoadingValue width={120} /></td>
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
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Forecast {MESES[mes - 1].substring(0, 5)}</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qnt Deveria</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Real</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta do Dia</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturado do Dia</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody>
                {canais.map((c) => {
                  const cfg = CANAL_CFG[c.canal_key] || { label: c.nome, icon: ChartBar, text: 'text-gray-600' };
                  const Icon = cfg.icon;
                  const hasMeta = c.forecast_mensal > 0;
                  return (
                    <tr key={c.canal_key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-800">
                        <div className="inline-flex items-center gap-2">
                          <Icon size={14} weight="bold" className={cfg.text} />
                          {cfg.label}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {hasMeta ? `R$ ${formatBRL(c.forecast_mensal)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {hasMeta ? `R$ ${formatBRL(c.qnt_deveria)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                        {loading ? <LoadingValue /> : `R$ ${formatBRL(c.real_acumulado)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {c.meta_do_dia > 0 ? `R$ ${formatBRL(c.meta_do_dia)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {loading ? <LoadingValue /> : `R$ ${formatBRL(c.faturado_do_dia)}`}
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
                    R$ {formatBRL(total.forecast_mensal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    R$ {formatBRL(total.qnt_deveria)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    {loading ? <LoadingValue /> : `R$ ${formatBRL(total.real_acumulado)}`}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    R$ {formatBRL(total.meta_do_dia)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    {loading ? <LoadingValue /> : `R$ ${formatBRL(total.faturado_do_dia)}`}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {total.qnt_deveria > 0 ? (
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
        tipo="mensal"
        titulo={`Promessa Mensal de ${MESES[mes - 1]}/${ano}`}
        params={{ ano, mes }}
        onClose={() => setShowWhats(false)}
      />
    )}
    </div>
  );
}
