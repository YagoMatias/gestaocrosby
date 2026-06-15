// Comparativo Anual — mesmo mês: ano anterior (cheio + acumulado) vs ano atual (real até hoje)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CaretDoubleUp,
  CaretDoubleDown,
  Storefront,
  Buildings,
  TShirt,
  Tag,
  Briefcase,
  Package,
  ChartBar,
  TrendUp,
  TrendDown,
  CreditCard,
  CurrencyDollar,
  Scales,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import EnviarWhatsappModal from './EnviarWhatsappModal';
import {
  MetricaHeader,
  KpiStripe,
  LoadingRow,
  LoadingValue,
  InfoBanner,
  formatBRL,
} from './MetricasDiariasUI';

const pctColorDelta = (pct) => {
  if (pct >= 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (pct >= -30) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const CANAL_CFG = {
  varejo:           { icon: Storefront, text: 'text-blue-600', bg: 'bg-blue-50' },
  revenda:          { icon: Package,    text: 'text-emerald-600', bg: 'bg-emerald-50' },
  multimarcas:      { icon: TShirt,     text: 'text-purple-600', bg: 'bg-purple-50' },
  inbound_david:    { icon: TShirt,     text: 'text-pink-600', bg: 'bg-pink-50' },
  inbound_rafael:   { icon: TShirt,     text: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
  franquia:         { icon: Buildings,  text: 'text-amber-700', bg: 'bg-amber-50' },
  bazar:            { icon: Tag,        text: 'text-orange-600', bg: 'bg-orange-50' },
  fabrica:          { icon: Buildings,  text: 'text-cyan-700', bg: 'bg-cyan-50' },
  business:         { icon: Briefcase,  text: 'text-slate-700', bg: 'bg-slate-50' },
  ricardoeletro:    { icon: Storefront, text: 'text-red-600', bg: 'bg-red-50' },
  showroom:         { icon: Buildings,  text: 'text-cyan-600', bg: 'bg-cyan-50' },
  novidadesfranquia:{ icon: Buildings,  text: 'text-cyan-600', bg: 'bg-cyan-50' },
  bluecard:         { icon: CreditCard, text: 'text-sky-600', bg: 'bg-sky-50' },
  b2m_total:        { icon: TShirt,     text: 'text-purple-700', bg: 'bg-purple-50' },
};

const fmtCanalValor = (canal, valor) => {
  if (canal?.is_quantity) {
    const n = Math.round(Number(valor || 0));
    return `${n} ${canal.unit || 'un'}`;
  }
  return `R$ ${formatBRL(valor)}`;
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
  const [untilToday, setUntilToday] = useState(false);
  const cardRef = useRef(null);
  // Token anti-race: cada nova chamada incrementa, só aplica state se ainda
  // for a mais recente. Evita "pisca de valor" quando filtros mudam rápido.
  const reqIdRef = useRef(0);

  const carregar = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    setErro('');
    try {
      const qs = `?ano=${ano}&mes=${mes}${untilToday ? '&until_today=true' : ''}`;
      const r = await fetch(`${API_BASE_URL}/api/forecast/comparativo-anual${qs}`);
      const j = await r.json();
      if (myId !== reqIdRef.current) return; // resposta obsoleta — descarta
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setData(j.data);
    } catch (e) {
      if (myId !== reqIdRef.current) return;
      setErro(e.message);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
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
  const anoAnt = data?.ano_anterior || ano - 1;
  const anoAtual = data?.ano_atual || ano;

  const totalPct = Number(total.comparativo_pct || 0);
  const totalUp = totalPct >= 0;

  const kpis = data ? [
    {
      label: `${anoAnt} Mês Completo`,
      valor: `R$ ${formatBRL(total.fat_ano_anterior_full || 0)}`,
      icon: CurrencyDollar,
      color: 'gray',
      sub: `${MESES[mes - 1]}/${anoAnt}`,
    },
    {
      label: `${anoAnt} Acumulado`,
      valor: `R$ ${formatBRL(total.fat_ano_anterior_acumulado || 0)}`,
      icon: ChartBar,
      color: 'blue',
      sub: data?.dia_referencia ? `Até dia ${data.dia_referencia}` : 'Mês fechado',
    },
    {
      label: `${anoAtual} Real`,
      valor: `R$ ${formatBRL(total.fat_ano_atual_real || 0)}`,
      icon: CurrencyDollar,
      color: 'emerald',
      sub: untilToday ? 'Até hoje (parcial)' : 'Até ontem',
    },
    {
      label: 'Diferença',
      valor: `${total.diferenca < 0 ? '-' : ''}R$ ${formatBRL(Math.abs(total.diferenca || 0))}`,
      icon: Scales,
      color: total.diferenca < 0 ? 'emerald' : 'rose',
      sub: total.diferenca < 0 ? `${anoAtual} ganhou` : `${anoAtual} perdeu`,
    },
    {
      label: 'Comparativo',
      valor: `${totalUp ? '+' : ''}${totalPct.toFixed(1)}%`,
      icon: totalUp ? TrendUp : TrendDown,
      color: totalUp ? 'emerald' : 'rose',
      sub: `vs ${anoAnt}`,
    },
  ] : [];

  return (
    <div ref={cardRef} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <MetricaHeader
        title={`Comparativo ${anoAnt} × ${anoAtual}`}
        subtitle={`${MESES[mes - 1]}${data?.dia_referencia ? ` · até dia ${data.dia_referencia}` : ''}`}
        icon={TrendUp}
        color="purple"
        onPrev={mesAnterior}
        onNext={mesProximo}
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
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-cyan-50/30">
                {anoAnt} <span className="text-[9px] text-gray-400 normal-case">cheio</span>
              </th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {anoAnt} <span className="text-[9px] text-gray-400 normal-case">acum.</span>
              </th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50/30">
                {anoAtual} <span className="text-[9px] text-blue-500 normal-case">real</span>
              </th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Δ</th>
              <th className="py-2.5 px-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[100px]">Comparativo</th>
            </tr>
          </thead>
          <tbody>
            {loading && canais.length === 0
              ? [1,2,3,4,5,6,7].map((i) => <LoadingRow key={i} cols={6} />)
              : canais.map((c, idx) => {
                  const cfg = CANAL_CFG[c.canal_key] || { icon: ChartBar, text: 'text-gray-600', bg: 'bg-gray-50' };
                  const Icon = cfg.icon;
                  const label = c.nome;
                  // comparativo_pct === null indica canal NOVO (sem referência ano anterior)
                  const isNewCanal = c.is_new === true || c.comparativo_pct === null;
                  const cpct = isNewCanal ? 0 : Number(c.comparativo_pct || 0);
                  const up = cpct >= 0;
                  const Arrow = up ? CaretDoubleUp : CaretDoubleDown;
                  const arrowColor = up ? 'text-emerald-600' : 'text-rose-600';
                  const hasData = c.fat_ano_anterior_acumulado > 0 || c.fat_ano_atual_real > 0;
                  const isQty = c.is_quantity;
                  const zebraBg = isQty ? 'bg-sky-50/30' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40');
                  const fmtDif = (v) => {
                    if (isQty) return `${v < 0 ? '-' : ''}${Math.abs(Math.round(v))} ${c.unit || 'un'}`;
                    return `R$ ${v < 0 ? '-' : ''}${formatBRL(Math.abs(v))}`;
                  };
                  return (
                    <tr
                      key={c.canal_key}
                      className={`border-b border-gray-100 transition-colors hover:bg-purple-50/40 ${zebraBg}`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-2">
                          <div className={`${cfg.bg} p-1 rounded`}>
                            <Icon size={12} weight="bold" className={cfg.text} />
                          </div>
                          <span className="font-semibold text-gray-800 text-[13px]">{label}</span>
                          {isQty && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                              qty
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 text-[12px] bg-cyan-50/20">
                        {fmtCanalValor(c, c.fat_ano_anterior_full)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 text-[12px]">
                        {fmtCanalValor(c, c.fat_ano_anterior_acumulado)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 font-semibold bg-blue-50/20">
                        {loading ? <LoadingValue /> : fmtCanalValor(c, c.fat_ano_atual_real)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 text-[12px]">
                        {loading ? <LoadingValue /> : fmtDif(c.diferenca)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex justify-center">
                          {loading ? (
                            <LoadingValue width={50} />
                          ) : isNewCanal ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold tabular-nums bg-cyan-50 border-cyan-200 text-cyan-700"
                              title="Canal novo (sem faturamento no mesmo período do ano anterior)"
                            >
                              ⚡ NOVO
                            </span>
                          ) : hasData ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold tabular-nums ${pctColorDelta(cpct)}`}
                            >
                              <Arrow size={10} weight="bold" className={arrowColor} />
                              {up ? '+' : ''}{cpct.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            {!loading && canais.length > 0 && (
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 font-bold border-t-2 border-gray-300">
                <td className="py-3 px-3 text-gray-800 text-[13px] uppercase tracking-wider">Total</td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800 bg-cyan-50/30">
                  R$ {formatBRL(total.fat_ano_anterior_full)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                  R$ {formatBRL(total.fat_ano_anterior_acumulado)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-900 font-extrabold text-[13px] bg-blue-50/30">
                  {loading ? <LoadingValue /> : `R$ ${formatBRL(total.fat_ano_atual_real)}`}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-800">
                  {loading ? <LoadingValue /> : `R$ ${total.diferenca < 0 ? '-' : ''}${formatBRL(Math.abs(total.diferenca || 0))}`}
                </td>
                <td className="py-3 px-3">
                  <div className="flex justify-center">
                    {(total.fat_ano_anterior_acumulado || 0) > 0 ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-sm font-extrabold tabular-nums ${pctColorDelta(totalPct)}`}>
                        {totalUp
                          ? <CaretDoubleUp size={12} weight="bold" className="text-emerald-600" />
                          : <CaretDoubleDown size={12} weight="bold" className="text-rose-600" />
                        }
                        {totalUp ? '+' : ''}{totalPct.toFixed(0)}%
                      </span>
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
          tipo="comparativo"
          reportTipo="comparativo"
          reportData={data}
          titulo={`Comparativo ${anoAnt} × ${anoAtual} (${MESES[mes - 1]})`}
          params={{ ano, mes }}
          onClose={() => setShowWhats(false)}
        />
      )}
    </div>
  );
}
