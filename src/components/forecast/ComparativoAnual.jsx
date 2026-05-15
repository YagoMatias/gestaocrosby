// Comparativo Anual — mesmo mês: ano anterior (cheio + acumulado) vs ano atual (real até hoje)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CaretDoubleUp,
  CaretDoubleDown,
  ArrowsClockwise,
  Storefront,
  Buildings,
  TShirt,
  Tag,
  Briefcase,
  Package,
  ChartBar,
  TrendUp,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { Card, CardContent } from '../ui/cards';
import { API_BASE_URL } from '../../config/constants';
import EnviarWhatsappModal from './EnviarWhatsappModal';

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
  if (pct >= 0) return 'text-emerald-600 bg-emerald-50';
  if (pct >= -30) return 'text-amber-600 bg-amber-50';
  return 'text-rose-600 bg-rose-50';
};

const CANAL_CFG = {
  varejo:           { icon: Storefront, text: 'text-blue-600' },
  revenda:          { icon: Package,    text: 'text-emerald-600' },
  multimarcas:      { icon: TShirt,     text: 'text-purple-600' },
  inbound_david:    { icon: TShirt,     text: 'text-pink-600' },
  inbound_rafael:   { icon: TShirt,     text: 'text-fuchsia-600' },
  franquia:         { icon: Buildings,  text: 'text-amber-700' },
  bazar:            { icon: Tag,        text: 'text-orange-600' },
  fabrica:          { icon: Buildings,  text: 'text-cyan-700' },
  business:         { icon: Briefcase,  text: 'text-slate-700' },
  ricardoeletro:    { icon: Storefront, text: 'text-red-600' },
  showroom:         { icon: Buildings,  text: 'text-cyan-600' },
  novidadesfranquia:{ icon: Buildings,  text: 'text-cyan-600' },
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function ComparativoAnual() {
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
      const r = await fetch(`${API_BASE_URL}/api/forecast/comparativo-anual${qs}`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setData(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [ano, mes, untilToday]);

  useEffect(() => { carregar(); }, [carregar]);

  const canais = data?.canais || [];
  const total = data?.total || {};

  return (
    <div ref={cardRef}>
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendUp size={20} className="text-blue-700" />
            <h3 className="text-lg font-semibold text-gray-800">
              Comparativo {data?.ano_anterior || ano - 1} × {data?.ano_atual || ano}
            </h3>
            <span className="text-xs text-gray-500">
              ({MESES[mes - 1]}/{ano}{data?.dia_referencia ? ` · até dia ${data.dia_referencia}` : ''})
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Toggle: até ontem (D-1) ↔ até hoje */}
            <button
              onClick={() => setUntilToday((v) => !v)}
              className={`text-xs px-2.5 py-1.5 rounded border inline-flex items-center gap-1 transition ${
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
              className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
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

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">{erro}</div>}

        {/* Banner "atualizando" quando refetching com dados visíveis */}
        {loading && canais.length > 0 && (
          <div className="mb-2 text-[11px] text-blue-600 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Atualizando valores 2026... (consulta TOTVS pode demorar)
          </div>
        )}

        {loading && !canais.length ? (
          /* Skeleton inicial */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {[1,2,3,4,5,6,7].map((i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-3"><LoadingValue width={100} /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-right"><LoadingValue /></td>
                    <td className="py-3 px-3 text-center"><LoadingValue width={50} /></td>
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
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {data?.ano_anterior || ano - 1}
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {data?.ano_anterior || ano - 1} Acumulado
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Real {data?.ano_atual || ano}
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Diferença</th>
                  <th className="py-2 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Comparativo</th>
                </tr>
              </thead>
              <tbody>
                {canais.map((c) => {
                  const cfg = CANAL_CFG[c.canal_key] || { icon: ChartBar, text: 'text-gray-600' };
                  const Icon = cfg.icon;
                  // Usa o label vindo do backend (já configurado: B2M, B2R, B2C, etc)
                  const label = c.nome;
                  const Arrow = c.comparativo_pct >= 0 ? CaretDoubleUp : CaretDoubleDown;
                  const arrowColor = c.comparativo_pct >= 0 ? 'text-emerald-600' : 'text-rose-600';
                  const hasData = c.fat_ano_anterior_acumulado > 0 || c.fat_ano_atual_real > 0;
                  return (
                    <tr key={c.canal_key} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-medium text-gray-800">
                        <div className="inline-flex items-center gap-2">
                          <Icon size={14} weight="bold" className={cfg.text} />
                          {label}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 bg-cyan-50/40">
                        R$ {formatBRL(c.fat_ano_anterior_full)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        R$ {formatBRL(c.fat_ano_anterior_acumulado)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                        {loading ? <LoadingValue /> : `R$ ${formatBRL(c.fat_ano_atual_real)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                        {loading ? <LoadingValue /> : `R$ ${c.diferenca < 0 ? '-' : ''}${formatBRL(Math.abs(c.diferenca))}`}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {loading ? (
                          <LoadingValue width={50} />
                        ) : hasData ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${pctColor(c.comparativo_pct)}`}>
                            <Arrow size={10} weight="bold" className={arrowColor} />
                            {c.comparativo_pct >= 0 ? '+' : ''}{c.comparativo_pct.toFixed(0)}%
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
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800 bg-cyan-50/40">
                    R$ {formatBRL(total.fat_ano_anterior_full)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    R$ {formatBRL(total.fat_ano_anterior_acumulado)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    {loading ? <LoadingValue /> : `R$ ${formatBRL(total.fat_ano_atual_real)}`}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                    {loading ? <LoadingValue /> : `R$ ${total.diferenca < 0 ? '-' : ''}${formatBRL(Math.abs(total.diferenca || 0))}`}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {(total.fat_ano_anterior_acumulado || 0) > 0 ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${pctColor(total.comparativo_pct)}`}>
                        {(total.comparativo_pct || 0) >= 0
                          ? <CaretDoubleUp size={10} weight="bold" className="text-emerald-600" />
                          : <CaretDoubleDown size={10} weight="bold" className="text-rose-600" />
                        }
                        {(total.comparativo_pct || 0) >= 0 ? '+' : ''}{Number(total.comparativo_pct || 0).toFixed(0)}%
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
        tipo="comparativo"
        titulo={`Comparativo ${ano - 1} × ${ano} (${MESES[mes - 1]})`}
        params={{ ano, mes }}
        onClose={() => setShowWhats(false)}
      />
    )}
    </div>
  );
}
