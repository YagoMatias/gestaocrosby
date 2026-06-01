// Faturamento de Ontem por Canal — quadro de leitura rápida.
// Reaproveita o endpoint /forecast/promessa-semanal (cacheado + coalescido):
// quando este componente e o PromessaSemanal carregam juntos, as duas
// requisições colapsam em UM único processamento no TOTVS (FATSEG_INFLIGHT).
// Mostra apenas o fat_dia_anterior (faturamento do dia anterior) por canal.
import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Storefront,
  Buildings,
  TShirt,
  Tag,
  Briefcase,
  Package,
  CreditCard,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import {
  MetricaHeader,
  LoadingValue,
  formatBRL,
} from './MetricasDiariasUI';

const CANAL_CFG = {
  varejo:         { label: 'Varejo',             icon: Storefront, text: 'text-blue-600',    bg: 'bg-blue-50',    bar: 'bg-blue-500' },
  revenda:        { label: 'Revenda',            icon: Package,    text: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
  multimarcas:    { label: 'Multimarcas',        icon: TShirt,     text: 'text-purple-600',  bg: 'bg-purple-50',  bar: 'bg-purple-500' },
  inbound_david:  { label: 'MTM Inbound David',  icon: TShirt,     text: 'text-pink-600',    bg: 'bg-pink-50',    bar: 'bg-pink-500' },
  inbound_rafael: { label: 'MTM Inbound Rafael', icon: TShirt,     text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', bar: 'bg-fuchsia-500' },
  franquia:       { label: 'Franquia',           icon: Buildings,  text: 'text-amber-700',   bg: 'bg-amber-50',   bar: 'bg-amber-500' },
  bazar:          { label: 'Bazar',              icon: Tag,        text: 'text-orange-600',  bg: 'bg-orange-50',  bar: 'bg-orange-500' },
  fabrica:        { label: 'Fábrica (Kleiton)',  icon: Buildings,  text: 'text-cyan-700',    bg: 'bg-cyan-50',    bar: 'bg-cyan-500' },
  business:       { label: 'Business',           icon: Briefcase,  text: 'text-slate-700',   bg: 'bg-slate-50',   bar: 'bg-slate-500' },
  ricardoeletro:  { label: 'Ricardo Eletro',     icon: Storefront, text: 'text-red-600',     bg: 'bg-red-50',     bar: 'bg-red-500' },
  bluecard:       { label: 'BlueCard',           icon: CreditCard, text: 'text-sky-600',     bg: 'bg-sky-50',     bar: 'bg-sky-500' },
};

const fmtDataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
};

export default function FaturamentoOntemCanal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      // Sem until_today: o fat_dia_anterior é o faturamento do dia anterior
      // (ontem em dia útil; ou sábado quando referência é a semana passada).
      const r = await fetch(`${API_BASE_URL}/api/forecast/promessa-semanal`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.message || `HTTP ${r.status}`);
      setData(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Só canais monetários (exclui BlueCard que é quantidade), com fat > 0,
  // ordenado do maior pro menor.
  const canais = (data?.canais || [])
    .filter((c) => !c.is_quantity)
    .map((c) => ({
      key: c.canal_key,
      cfg: CANAL_CFG[c.canal_key] || { label: c.nome, text: 'text-gray-600', bg: 'bg-gray-50', bar: 'bg-gray-400' },
      valor: Number(c.fat_dia_anterior || 0),
    }))
    .sort((a, b) => b.valor - a.valor);

  const totalOntem = Number(data?.total?.fat_dia_anterior || 0);
  const maxValor = canais.reduce((m, c) => Math.max(m, c.valor), 0);
  const diaRef = data?.dia_anterior;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <MetricaHeader
        title="Faturamento de Ontem por Canal"
        subtitle={diaRef ? `Dia ${fmtDataBr(diaRef)} · líquido por canal` : 'Faturamento do dia anterior'}
        icon={CalendarCheck}
        color="emerald"
        onRefresh={carregar}
        loading={loading}
      />

      {/* Total do dia */}
      <div className="px-5 py-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-bold text-gray-500">
          Total Faturado Ontem
        </span>
        <span className="text-xl font-extrabold tabular-nums text-emerald-700">
          {loading ? <LoadingValue width={120} /> : `R$ ${formatBRL(totalOntem)}`}
        </span>
      </div>

      {erro && (
        <div className="px-5 py-3 text-xs text-rose-700 bg-rose-50 border-b border-rose-200">
          Erro ao carregar: {erro}
        </div>
      )}

      <div className="p-3 space-y-1.5">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
          ))
        ) : canais.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            Sem faturamento registrado no dia anterior.
          </p>
        ) : (
          canais.map((c) => {
            const Icon = c.cfg.icon;
            const pct = totalOntem > 0 ? (c.valor / totalOntem) * 100 : 0;
            const barW = maxValor > 0 ? (c.valor / maxValor) * 100 : 0;
            return (
              <div
                key={c.key}
                className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition"
              >
                <div className={`${c.cfg.bg} p-1.5 rounded-lg shrink-0`}>
                  {Icon && <Icon size={16} weight="duotone" className={c.cfg.text} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-gray-700 truncate">
                      {c.cfg.label}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-gray-900 whitespace-nowrap">
                      R$ {formatBRL(c.valor)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${c.cfg.bar} rounded-full transition-all`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-gray-400 w-10 text-right shrink-0">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
