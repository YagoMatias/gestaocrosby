// Card otimizado pra captura via html2canvas → envio WhatsApp.
// Layout vertical, fontes grandes, contraste alto, proporção retrato.
// Tipos suportados: 'semanal', 'mensal', 'comparativo'.
import React from 'react';

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtQty = (v, unit = 'un') => `${Math.round(Number(v || 0))} ${unit}`;

const fmtVal = (canal, v) => {
  if (canal?.is_quantity) return fmtQty(v, canal.unit || 'un');
  return `R$ ${formatBRL(v)}`;
};

// Threshold consistente com o display arredondado (.toFixed(0)) — evita
// "100%" visual ficar amarelo quando o valor real é 99,6%.
const pctBarColor = (pct) => {
  const r = Math.round(Number(pct) || 0);
  if (r >= 100) return 'bg-emerald-500';
  if (r >= 70) return 'bg-amber-400';
  return 'bg-rose-500';
};
const pctTextColor = (pct) => {
  const r = Math.round(Number(pct) || 0);
  if (r >= 100) return 'text-emerald-700';
  if (r >= 70) return 'text-amber-700';
  return 'text-rose-700';
};
const pctBg = (pct) => {
  const r = Math.round(Number(pct) || 0);
  if (r >= 100) return 'bg-emerald-50 border-emerald-200';
  if (r >= 70) return 'bg-amber-50 border-amber-200';
  return 'bg-rose-50 border-rose-200';
};
const statusEmoji = (pct) => {
  const r = Math.round(Number(pct) || 0);
  if (r >= 100) return '🟢';
  if (r >= 70) return '🟡';
  return '🔴';
};

function ProgressBar({ pct }) {
  const w = Math.max(0, Math.min(100, Number(pct || 0)));
  return (
    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
      <div
        className={`h-full ${pctBarColor(pct)} transition-all`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

const fmtDataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ═══════════════════════════════════════════════════════════════
// Componente principal
// data = { canais, total, periodInfo, tipo }
// tipo: 'semanal' | 'mensal' | 'comparativo'
// ═══════════════════════════════════════════════════════════════
export default function WhatsappReportCard({ tipo, data, titulo }) {
  if (!data) return null;
  // Largura fixa pra ficar consistente — html2canvas captura no tamanho real
  return (
    <div
      style={{ width: '720px' }}
      className="bg-gradient-to-br from-slate-50 to-white border border-gray-300 rounded-2xl shadow-xl overflow-hidden"
    >
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#000638] to-[#1a2461] text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-blue-200 font-semibold">
              Crosby · Forecast
            </div>
            <h1 className="text-2xl font-extrabold mt-0.5">
              {titulo}
            </h1>
            <PeriodLabel tipo={tipo} data={data} />
          </div>
          <div className="text-right text-[10px] text-blue-200 leading-tight">
            <div>Gerado em</div>
            <div className="font-mono text-white">
              {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* CORPO */}
      <div className="px-5 py-4 space-y-3">
        {tipo === 'semanal' && <BodySemanal data={data} />}
        {tipo === 'mensal' && <BodyMensal data={data} />}
        {tipo === 'comparativo' && <BodyComparativo data={data} />}
        {tipo === 'vendedores' && <BodyVendedores data={data} />}
      </div>

      {/* FOOTER */}
      <div className="bg-gray-50 border-t border-gray-200 px-5 py-2.5 flex items-center justify-between text-[10px] text-gray-500">
        <span>🟢 ≥100% &nbsp; 🟡 70-99% &nbsp; 🔴 &lt;70%</span>
        <span className="font-mono">gestaocrosby</span>
      </div>
    </div>
  );
}

function PeriodLabel({ tipo, data }) {
  if (tipo === 'semanal') {
    return (
      <div className="text-sm text-blue-100 mt-1.5">
        Semana {data.semana_iso}/{data.ano} · {fmtDataBr(data.data_inicio)} → {fmtDataBr(data.data_fim)}
        {data.dias_uteis_total ? (
          <span className="ml-2 text-[11px] text-blue-200">
            ({data.dias_uteis_decorridos}/{data.dias_uteis_total} dias úteis)
          </span>
        ) : null}
      </div>
    );
  }
  if (tipo === 'mensal') {
    return (
      <div className="text-sm text-blue-100 mt-1.5">
        {MESES[data.mes - 1]}/{data.ano}
        {data.dias_uteis_total ? (
          <span className="ml-2 text-[11px] text-blue-200">
            ({data.dias_uteis_decorridos}/{data.dias_uteis_total} dias úteis)
          </span>
        ) : null}
      </div>
    );
  }
  if (tipo === 'comparativo') {
    return (
      <div className="text-sm text-blue-100 mt-1.5">
        {MESES[data.mes - 1]} · {data.ano_anterior} vs {data.ano_atual}
        {data.dia_referencia ? (
          <span className="ml-2 text-[11px] text-blue-200">
            (até dia {data.dia_referencia})
          </span>
        ) : null}
      </div>
    );
  }
  if (tipo === 'vendedores') {
    return (
      <div className="text-sm text-blue-100 mt-1.5">
        Semana {data.semana_iso}/{data.ano} · B2R · B2M
      </div>
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// VENDEDORES (cards B2R/B2M)
// ═══════════════════════════════════════════════════════════════
function BodyVendedores({ data }) {
  const cards = data.cards || [];
  return (
    <>
      {cards.map((card) => {
        const total = card.total || {};
        const pct = Number(total.percentual || 0);
        return (
          <div key={card.code} className="bg-white border-2 border-gray-300 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-[#000638] text-white px-4 py-2 flex items-center justify-between">
              <div className="font-bold text-sm tracking-wide">{card.label}</div>
              <div className={`text-xs font-extrabold tabular-nums px-2 py-0.5 rounded ${Math.round(pct) >= 100 ? 'bg-emerald-400/30 text-emerald-100' : Math.round(pct) >= 70 ? 'bg-amber-400/30 text-amber-100' : 'bg-rose-400/30 text-rose-100'}`}>
                {statusEmoji(pct)} {pct.toFixed(0)}%
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {(card.vendedores || []).map((v) => {
                const vpct = Number(v.percentual || 0);
                return (
                  <div key={v.nome} className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 text-sm uppercase">
                        {v.nome}
                      </span>
                      {v.convidado && (
                        <span className="text-[9px] text-blue-600 normal-case bg-blue-50 px-1.5 py-0.5 rounded">
                          {v.canal_origem}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-gray-500">
                        R$ {formatBRL(v.meta)}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-[#000638]">
                        R$ {formatBRL(v.real)}
                      </span>
                      <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded border ${pctBg(vpct)} ${pctTextColor(vpct)}`}>
                        {vpct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {(card.extras || []).map((v) => (
                <div key={`extra-${v.nome}`} className="flex items-center justify-between px-4 py-1.5 bg-gray-50/60">
                  <span className="text-xs italic text-gray-600 uppercase">{v.nome}</span>
                  <span className="text-xs tabular-nums text-gray-600">
                    R$ {formatBRL(v.real)} <span className="text-[9px] text-gray-400">(extra)</span>
                  </span>
                </div>
              ))}
              {/* Total do card */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 font-bold">
                <span className="text-xs uppercase tracking-wide text-gray-700">Total</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-gray-600">
                    R$ {formatBRL(total.meta || 0)}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-[#000638]">
                    R$ {formatBRL(total.real || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEMANAL
// ═══════════════════════════════════════════════════════════════
function BodySemanal({ data }) {
  const canais = (data.canais || []).filter(
    (c) => c.meta_realista > 0 || c.faturamento_real > 0,
  );
  const total = data.total || {};
  return (
    <>
      {/* Total destacado */}
      <TotalBlock
        labelLeft="Meta da semana"
        valueLeft={`R$ ${formatBRL(total.meta_realista)}`}
        labelRight="Realizado"
        valueRight={`R$ ${formatBRL(total.faturamento_real)}`}
        pct={total.percentual || 0}
      />
      {/* Canais */}
      <div className="grid grid-cols-1 gap-2">
        {canais.map((c) => (
          <CanalRow
            key={c.canal_key}
            canal={c}
            primaryLabel="Real"
            primaryValue={fmtVal(c, c.faturamento_real)}
            secondaryLabel="Meta"
            secondaryValue={fmtVal(c, c.meta_realista)}
            tertiaryLabel="Ontem"
            tertiaryValue={fmtVal(c, c.fat_dia_anterior)}
            pct={c.percentual}
          />
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MENSAL
// ═══════════════════════════════════════════════════════════════
function BodyMensal({ data }) {
  const canais = (data.canais || []).filter(
    (c) => c.forecast_mensal > 0 || c.real_acumulado > 0,
  );
  const total = data.total || {};
  return (
    <>
      <TotalBlock
        labelLeft="Forecast do mês"
        valueLeft={`R$ ${formatBRL(total.forecast_mensal)}`}
        labelRight="Realizado"
        valueRight={`R$ ${formatBRL(total.real_acumulado)}`}
        pct={total.percentual || 0}
        hint={`Qnt deveria: R$ ${formatBRL(total.qnt_deveria || 0)}`}
      />
      <div className="grid grid-cols-1 gap-2">
        {canais.map((c) => (
          <CanalRow
            key={c.canal_key}
            canal={c}
            primaryLabel="Real"
            primaryValue={fmtVal(c, c.real_acumulado)}
            secondaryLabel="Forecast"
            secondaryValue={fmtVal(c, c.forecast_mensal)}
            tertiaryLabel="Qnt Dev."
            tertiaryValue={fmtVal(c, c.qnt_deveria)}
            pct={c.percentual}
          />
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPARATIVO ANUAL
// ═══════════════════════════════════════════════════════════════
function BodyComparativo({ data }) {
  const canais = (data.canais || []).filter(
    (c) => c.fat_ano_anterior_full > 0 || c.fat_ano_atual_real > 0,
  );
  const total = data.total || {};
  const pct = Number(total.comparativo_pct || 0);
  const arrowUp = pct >= 0;
  return (
    <>
      {/* Total ano vs ano */}
      <div className="bg-white border-2 border-gray-300 rounded-xl p-4 shadow-sm">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
          Total · {data.ano_anterior} acum vs {data.ano_atual} real
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <div className="text-[10px] text-gray-500 uppercase">{data.ano_anterior}</div>
            <div className="text-xl font-extrabold text-gray-700 tabular-nums">
              R$ {formatBRL(total.fat_ano_anterior_acumulado)}
            </div>
          </div>
          <div className="border-l-2 border-blue-200 pl-4">
            <div className="text-[10px] text-blue-600 uppercase font-bold">{data.ano_atual}</div>
            <div className="text-xl font-extrabold text-[#000638] tabular-nums">
              R$ {formatBRL(total.fat_ano_atual_real)}
            </div>
          </div>
        </div>
        <div className={`mt-3 text-center text-base font-bold px-3 py-1.5 rounded-lg ${arrowUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {arrowUp ? '🟢 ⬆️' : '🔴 ⬇️'} {arrowUp ? '+' : ''}{pct.toFixed(1)}%
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {canais.map((c) => {
          const cpct = Number(c.comparativo_pct || 0);
          const up = cpct >= 0;
          return (
            <div
              key={c.canal_key}
              className={`bg-white border rounded-lg px-4 py-2.5 ${up ? 'border-emerald-200' : 'border-rose-200'}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-gray-800 text-sm">{c.nome}</div>
                <div className={`text-xs font-bold tabular-nums ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {up ? '⬆️ +' : '⬇️ '}{cpct.toFixed(0)}%
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div>
                  <div className="text-[9px] text-gray-400 uppercase">{data.ano_anterior} acum</div>
                  <div className="text-sm font-semibold text-gray-600 tabular-nums">
                    {fmtVal(c, c.fat_ano_anterior_acumulado)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-blue-500 uppercase">{data.ano_atual} real</div>
                  <div className="text-sm font-bold text-[#000638] tabular-nums">
                    {fmtVal(c, c.fat_ano_atual_real)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-componentes
// ═══════════════════════════════════════════════════════════════
function TotalBlock({ labelLeft, valueLeft, labelRight, valueRight, pct, hint }) {
  return (
    <div className="bg-white border-2 border-gray-300 rounded-xl p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
            {labelLeft}
          </div>
          <div className="text-xl font-extrabold text-gray-700 tabular-nums leading-tight">
            {valueLeft}
          </div>
        </div>
        <div className="border-l-2 border-blue-200 pl-4">
          <div className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">
            {labelRight}
          </div>
          <div className="text-xl font-extrabold text-[#000638] tabular-nums leading-tight">
            {valueRight}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <ProgressBar pct={pct} />
        </div>
        <div className={`text-base font-extrabold tabular-nums px-2.5 py-0.5 rounded-md border ${pctBg(pct)} ${pctTextColor(pct)}`}>
          {statusEmoji(pct)} {Number(pct || 0).toFixed(0)}%
        </div>
      </div>
      {hint && (
        <div className="text-[10px] text-gray-500 mt-1.5 font-mono">{hint}</div>
      )}
    </div>
  );
}

function CanalRow({
  canal,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  tertiaryLabel,
  tertiaryValue,
  pct,
}) {
  const isQty = canal?.is_quantity;
  return (
    <div className={`bg-white border rounded-lg px-4 py-2.5 ${pctBg(pct).split(' ')[1]}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="font-bold text-gray-800 text-sm">{canal.nome}</div>
          {isQty && (
            <span className="text-[9px] uppercase tracking-wider font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
              qty
            </span>
          )}
        </div>
        <div className={`text-xs font-extrabold tabular-nums px-2 py-0.5 rounded ${pctBg(pct)} ${pctTextColor(pct)}`}>
          {statusEmoji(pct)} {Number(pct || 0).toFixed(0)}%
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[9px] text-gray-400 uppercase font-semibold">{secondaryLabel}</div>
          <div className="text-xs font-semibold text-gray-600 tabular-nums">{secondaryValue}</div>
        </div>
        <div>
          <div className="text-[9px] text-blue-500 uppercase font-bold">{primaryLabel}</div>
          <div className="text-sm font-extrabold text-[#000638] tabular-nums">{primaryValue}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400 uppercase font-semibold">{tertiaryLabel}</div>
          <div className="text-xs font-semibold text-gray-600 tabular-nums">{tertiaryValue}</div>
        </div>
      </div>
      <ProgressBar pct={pct} />
    </div>
  );
}
