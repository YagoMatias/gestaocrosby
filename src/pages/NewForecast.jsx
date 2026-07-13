// New Forecast — réplica editável da planilha "FORCAST" (Grupo Crosby).
// Canais nas linhas × Semanas 1..4 (campos editáveis) + Realizado (soma das semanas)
// + Meta do Mês (quanto precisa atingir) + % Concluído + Falta.
// Os valores digitados são persistidos em localStorage por período (YYYY-MM).
import React, { useEffect, useMemo, useState } from 'react';
import { ChartLineUp, ArrowClockwise, Target } from '@phosphor-icons/react';

// --- Canais + metas padrão (extraídos da planilha FORCAST 0607) ---------------
// s1/s2/s3/s4 = faturamento por semana; meta = objetivo do mês.
const CANAIS_BASE = [
  { canal: 'BAZAR', s1: 0, s2: 26626.6, s3: 0, s4: 0, meta: 20000 },
  { canal: 'NOVIDADES', s1: 1992.8, s2: 1650, s3: 0, s4: 0, meta: 0 },
  { canal: 'FARDAMENTO', s1: 0, s2: 68589, s3: 0, s4: 0, meta: 0 },
  { canal: 'SHOWROOM / FABRICAS', s1: 0, s2: 51669.83, s3: 0, s4: 0, meta: 350000 },
  { canal: 'FRANQUIAS', s1: 6451.54, s2: 22588.27, s3: 0, s4: 0, meta: 150000 },
  { canal: 'REVENDA', s1: 26224.81, s2: 29843.47, s3: 0, s4: 0, meta: 165000 },
  { canal: 'MTM RAFAEL', s1: 867.365, s2: 25828.34, s3: 0, s4: 0, meta: 100000 },
  { canal: 'MTM DAVID', s1: 3031.21, s2: 3170.5, s3: 0, s4: 0, meta: 65000 },
  { canal: 'MTM ARTHUR', s1: 1045.63, s2: 22894.13, s3: 0, s4: 0, meta: 90000 },
  { canal: 'VAREJO', s1: 51004.87, s2: 64009.89, s3: 0, s4: 0, meta: 363400 },
  { canal: 'BLUECRED', s1: 0, s2: 0, s3: 0, s4: 0, meta: 25000 },
  { canal: 'RICARDO ELETRO', s1: 550, s2: 7300, s3: 0, s4: 0, meta: 12000 },
  { canal: 'MALA', s1: 0, s2: 0, s3: 0, s4: 0, meta: 10 },
  { canal: 'CARTÃO PB', s1: 0, s2: 0, s3: 0, s4: 0, meta: 50 },
  { canal: 'CARTÃO RN', s1: 0, s2: 0, s3: 0, s4: 0, meta: 100 },
  { canal: 'CARTÃO PI', s1: 0, s2: 0, s3: 0, s4: 0, meta: 50 },
  { canal: 'CARTÃO PE', s1: 0, s2: 0, s3: 0, s4: 0, meta: 50 },
  { canal: 'CARTÃO PB - PATOS', s1: 0, s2: 0, s3: 0, s4: 0, meta: 50 },
];

const SEMANAS = ['s1', 's2', 's3', 's4'];
const STORAGE_PREFIX = 'new_forecast_v1_';

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

// Converte texto digitado ("1.234,56" ou "1234.56") em número.
const parseNum = (str) => {
  if (str === '' || str == null) return 0;
  let s = String(str).trim().replace(/\s|R\$/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const loadPeriod = (period) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + period);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length) return saved;
    }
  } catch (_) {
    /* ignore */
  }
  // Sem dados salvos: começa a partir da base (planilha) só no mês corrente,
  // demais meses começam zerados mantendo as metas.
  return CANAIS_BASE.map((c) =>
    period === currentPeriod() ? { ...c } : { ...c, s1: 0, s2: 0, s3: 0, s4: 0 },
  );
};

const NewForecast = () => {
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState(() => loadPeriod(currentPeriod()));

  // Recarrega ao trocar de período.
  useEffect(() => {
    setRows(loadPeriod(period));
  }, [period]);

  // Persiste automaticamente.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + period, JSON.stringify(rows));
    } catch (_) {
      /* ignore */
    }
  }, [rows, period]);

  const setCell = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const calc = (r) => {
    const realizado = SEMANAS.reduce((acc, k) => acc + parseNum(r[k]), 0);
    const meta = parseNum(r.meta);
    const pct = meta > 0 ? (realizado / meta) * 100 : 0;
    const falta = Math.max(meta - realizado, 0);
    return { realizado, meta, pct, falta };
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const { realizado, meta, falta } = calc(r);
        acc.s1 += parseNum(r.s1);
        acc.s2 += parseNum(r.s2);
        acc.s3 += parseNum(r.s3);
        acc.s4 += parseNum(r.s4);
        acc.realizado += realizado;
        acc.meta += meta;
        acc.falta += falta;
        return acc;
      },
      { s1: 0, s2: 0, s3: 0, s4: 0, realizado: 0, meta: 0, falta: 0 },
    );
  }, [rows]);

  const totalPct = totals.meta > 0 ? (totals.realizado / totals.meta) * 100 : 0;

  const handleReset = () => {
    if (
      window.confirm(
        'Restaurar os valores da planilha original para este mês? Isso apaga as edições salvas do período.',
      )
    ) {
      localStorage.removeItem(STORAGE_PREFIX + period);
      setRows(loadPeriod(period));
    }
  };

  const pctColor = (pct) => {
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };
  const barColor = (pct) => {
    if (pct >= 100) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const NumInput = ({ value, onChange, strong }) => (
    <input
      type="text"
      inputMode="decimal"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(parseNum(e.target.value))}
      className={`w-full bg-transparent text-right px-2 py-1.5 rounded-md border border-transparent hover:border-gray-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-200 transition ${
        strong ? 'font-semibold text-gray-800' : 'text-gray-700'
      }`}
    />
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1300px] mx-auto w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100">
            <ChartLineUp size={26} weight="duotone" className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              New Forecast
            </h1>
            <p className="text-sm text-gray-500">
              Faturamento semanal por canal × meta do mês
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Mês:</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
          />
          <button
            onClick={handleReset}
            title="Restaurar valores da planilha"
            className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <ArrowClockwise size={16} /> Restaurar
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Realizado" value={formatBRL(totals.realizado)} tone="violet" />
        <SummaryCard label="Meta do Mês" value={formatBRL(totals.meta)} tone="slate" icon={Target} />
        <SummaryCard
          label="% Concluído"
          value={`${totalPct.toFixed(1)}%`}
          tone={totalPct >= 100 ? 'emerald' : totalPct >= 60 ? 'amber' : 'rose'}
        />
        <SummaryCard label="Falta" value={formatBRL(totals.falta)} tone="rose" />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-gray-50 z-10">
                Canal
              </th>
              <th className="text-right font-semibold px-3 py-3">Semana 1</th>
              <th className="text-right font-semibold px-3 py-3">Semana 2</th>
              <th className="text-right font-semibold px-3 py-3">Semana 3</th>
              <th className="text-right font-semibold px-3 py-3">Semana 4</th>
              <th className="text-right font-semibold px-3 py-3 bg-violet-50 text-violet-700">
                Realizado
              </th>
              <th className="text-right font-semibold px-3 py-3">Meta (Mês)</th>
              <th className="text-center font-semibold px-3 py-3 w-[180px]">
                % Concluído
              </th>
              <th className="text-right font-semibold px-3 py-3">Falta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const { realizado, pct, falta } = calc(r);
              return (
                <tr
                  key={r.canal}
                  className="border-t border-gray-100 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-1.5 font-medium text-gray-800 sticky left-0 bg-white z-10 whitespace-nowrap">
                    {r.canal}
                  </td>
                  {SEMANAS.map((k) => (
                    <td key={k} className="px-1 py-1">
                      <NumInput value={r[k]} onChange={(v) => setCell(idx, k, v)} />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold text-violet-700 bg-violet-50/40 whitespace-nowrap">
                    {formatBRL(realizado)}
                  </td>
                  <td className="px-1 py-1">
                    <NumInput
                      value={r.meta}
                      onChange={(v) => setCell(idx, 'meta', v)}
                      strong
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold w-12 text-right ${pctColor(pct)}`}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">
                    {falta > 0 ? formatBRL(falta) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
              <td className="px-4 py-3 sticky left-0 bg-gray-50 z-10">TOTAL</td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.s1)}</td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.s2)}</td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.s3)}</td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.s4)}</td>
              <td className="px-3 py-3 text-right text-violet-700 bg-violet-50">
                {formatBRL(totals.realizado)}
              </td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.meta)}</td>
              <td className={`px-3 py-3 text-center ${pctColor(totalPct)}`}>
                {totalPct.toFixed(1)}%
              </td>
              <td className="px-3 py-3 text-right">{formatBRL(totals.falta)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const toneMap = {
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
  slate: 'bg-slate-50 text-slate-700 border-slate-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
};

const SummaryCard = ({ label, value, tone = 'slate', icon: Icon }) => (
  <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
    <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
      {Icon && <Icon size={14} weight="bold" />}
      {label}
    </div>
    <div className="text-lg sm:text-xl font-bold mt-1">{value}</div>
  </div>
);

export default NewForecast;
