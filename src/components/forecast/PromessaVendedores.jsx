// Detalhe por vendedor — B2R e B2M (semana corrente)
// Cada card mostra: vendedor | Promessa | Realizado | Percentual
// Promessa = meta_canal_semana / N vendedores titulares
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  ArrowsClockwise,
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

const pctColor = (pct) => {
  if (pct >= 100) return 'text-emerald-600 bg-emerald-50';
  if (pct >= 70) return 'text-amber-600 bg-amber-50';
  return 'text-rose-600 bg-rose-50';
};

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { ano: d.getUTCFullYear(), semana: weekNo };
}

// Skeleton para célula de valor quando carregando
function LoadingValue() {
  return (
    <span className="inline-block bg-gray-200 rounded animate-pulse" style={{ width: '70px', height: '14px' }}>&nbsp;</span>
  );
}

function CardVendedores({ card, loading }) {
  const { vendedores = [], extras = [], total = {}, label } = card;
  return (
    <Card className={loading ? 'opacity-95' : ''}>
      <CardContent className="pt-4">
        <div className="bg-[#000638] text-white text-center px-3 py-2 rounded-t -mx-6 -mt-4 mb-3 flex items-center justify-center gap-2">
          <h4 className="font-bold uppercase text-xs tracking-wide">{label}</h4>
          {loading && (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-200 font-normal normal-case bg-white/10 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
              atualizando
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Promessa</th>
                <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Realizado</th>
                <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Percentual</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.nome} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-gray-800 uppercase text-xs">
                    {v.nome}
                    {v.convidado && (
                      <span className="ml-2 text-[10px] font-normal text-blue-600 normal-case" title={`Meta vem de: ${v.canal_origem}`}>
                        ({v.canal_origem})
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                    {v.meta > 0 ? `R$ ${formatBRL(v.meta)}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                    {loading ? <LoadingValue /> : `R$ ${formatBRL(v.real)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {loading ? (
                      <LoadingValue />
                    ) : v.meta > 0 ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctColor(v.percentual)}`}>
                        {v.percentual.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {extras.map((v) => (
                <tr key={`extra-${v.nome}`} className="border-b border-gray-100 bg-gray-50/40">
                  <td className="py-2.5 px-3 font-medium text-gray-600 italic uppercase text-xs">{v.nome}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-400">—</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                    {loading ? <LoadingValue /> : `R$ ${formatBRL(v.real)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-400 text-xs">—</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                <td className="py-3 px-3 text-gray-800">TOTAL</td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">R$ {formatBRL(total.meta)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                  {loading ? <LoadingValue /> : `R$ ${formatBRL(total.real)}`}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {loading ? (
                    <LoadingValue />
                  ) : total.meta > 0 ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctColor(total.percentual)}`}>
                      {Number(total.percentual || 0).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PromessaVendedores() {
  const cur = isoWeek(new Date());
  const [ano] = useState(cur.ano);
  const [semana] = useState(cur.semana);
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
      const qs = `?ano=${ano}&semana=${semana}${untilToday ? '&until_today=true' : ''}`;
      const r = await fetch(`${API_BASE_URL}/api/forecast/promessa-vendedores${qs}`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setData(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [ano, semana, untilToday]);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>;
  }
  // Quando não há dados ainda (1ª carga sem cache), mostra cards skeleton
  if (!data?.cards?.length) {
    if (loading) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Users size={18} className="text-blue-700" />
              Detalhe por Vendedor — <span className="text-gray-400 text-sm">carregando…</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <CardVendedores
                key={i}
                loading
                card={{
                  label: i === 1 ? 'PROMETIDO B2R - …' : 'PROMETIDO B2M - …',
                  vendedores: [
                    { nome: '...........', meta: 1, real: 0, percentual: 0 },
                    { nome: '...........', meta: 1, real: 0, percentual: 0 },
                    { nome: '...........', meta: 1, real: 0, percentual: 0 },
                  ],
                  extras: [],
                  total: { meta: 1, real: 0, percentual: 0 },
                }}
              />
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-3" ref={cardRef}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Users size={18} className="text-blue-700" />
          Detalhe por Vendedor — Semana {data.semana_iso}
        </h3>
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
            <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.cards.map((card) => (
          <CardVendedores key={card.code} card={card} loading={loading} />
        ))}
      </div>
      {showWhats && (
        <EnviarWhatsappModal
          targetRef={cardRef}
          tipo="vendedores"
          titulo={`Detalhe por Vendedor — Semana ${data.semana_iso}`}
          params={{ ano, semana }}
          onClose={() => setShowWhats(false)}
        />
      )}
    </div>
  );
}
