// Componentes visuais compartilhados pelas Métricas Diárias (Promessa Mensal,
// Semanal, Comparativo e Vendedores). Padroniza header, KPIs e status.
import React from 'react';
import {
  Spinner,
  CaretLeft,
  CaretRight,
  ArrowsClockwise,
  WhatsappLogo,
  CheckCircle,
  WarningCircle,
  Circle,
  DownloadSimple,
} from '@phosphor-icons/react';

// ─── Formatadores ────────────────────────────────────────────────────────────
export const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatBRLCompact = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${formatBRL(n)}`;
};

// Threshold consistente com o DISPLAY arredondado: o pill mostra
// `.toFixed(0)` (ex: 99,6% → "100%"), então a cor segue o mesmo round.
// Antes, Ricardo Eletro em 99,6% (real 1.504,40 / meta 1.510,37) aparecia
// como "100%" mas em AMARELO — visual confuso.
export const pctColor = (pct) => {
  const r = Math.round(Number(pct) || 0);
  if (r >= 100) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (r >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

export const pctBarColor = (pct) => {
  const r = Math.round(Number(pct) || 0);
  if (r >= 100) return 'bg-emerald-500';
  if (r >= 70) return 'bg-amber-400';
  return 'bg-rose-500';
};

export const statusIcon = (pct) => {
  const r = Math.round(Number(pct) || 0);
  if (r >= 100) return <CheckCircle size={12} weight="fill" className="text-emerald-600" />;
  if (r >= 70) return <WarningCircle size={12} weight="fill" className="text-amber-500" />;
  return <Circle size={12} weight="fill" className="text-rose-500" />;
};

// ─── Header padronizado ──────────────────────────────────────────────────────
// title: string ou JSX
// subtitle: string complementar (período etc)
// icon: Phosphor icon
// color: 'blue' | 'amber' | 'purple' | 'emerald' (tom do header)
// onPrev / onNext / onToday: callbacks de navegação (opcionais)
// untilToday / setUntilToday: toggle hoje/ontem (opcional)
// onRefresh / loading: atualizar
// onWhatsapp: enviar
export function MetricaHeader({
  title,
  subtitle,
  icon: Icon,
  color = 'blue',
  onPrev,
  onNext,
  onToday,
  untilToday,
  setUntilToday,
  mode,        // NOVO: 'ontem' | 'hoje' | 'sabado' (3-estado, opcional)
  setMode,     // NOVO: setter do mode (opcional)
  onRefresh,
  loading,
  onWhatsapp,
  onDownload,
}) {
  const colorMap = {
    blue: { bg: 'bg-gradient-to-r from-[#000638] via-[#1a2461] to-[#000638]', accent: 'text-blue-200' },
    amber: { bg: 'bg-gradient-to-r from-amber-700 via-amber-800 to-amber-700', accent: 'text-amber-200' },
    purple: { bg: 'bg-gradient-to-r from-purple-800 via-purple-900 to-purple-800', accent: 'text-purple-200' },
    emerald: { bg: 'bg-gradient-to-r from-emerald-800 via-emerald-900 to-emerald-800', accent: 'text-emerald-200' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} text-white px-5 py-4 rounded-t-xl flex items-center justify-between flex-wrap gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
            <Icon size={20} weight="duotone" className="text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight">{title}</h3>
          {subtitle && (
            <p className={`text-xs ${c.accent} font-medium mt-0.5 truncate`}>{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap" data-h2c-ignore="true">
        {onPrev && (
          <button
            onClick={onPrev}
            className="p-1.5 text-white/70 hover:text-white border border-white/20 rounded hover:bg-white/10 transition"
            title="Anterior"
          >
            <CaretLeft size={12} weight="bold" />
          </button>
        )}
        {onToday && (
          <button
            onClick={onToday}
            className="text-[11px] px-2.5 py-1.5 border border-white/20 rounded hover:bg-white/10 text-white/90 hover:text-white font-medium transition"
            title="Voltar para o mês atual"
          >
            Mês atual
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="p-1.5 text-white/70 hover:text-white border border-white/20 rounded hover:bg-white/10 transition"
            title="Próximo"
          >
            <CaretRight size={12} weight="bold" />
          </button>
        )}
        {setMode && (
          <div
            className="inline-flex items-center bg-white/5 border border-white/20 rounded p-0.5 ml-1"
            role="group"
            aria-label="Período de exibição"
          >
            {[
              { key: 'hoje',   label: 'Hoje',         title: 'Dados até HOJE (parcial)' },
              { key: 'ontem',  label: 'Até ontem',    title: 'Dados da semana atual até ONTEM (D-1)' },
              { key: 'sabado', label: 'Sem. passada', title: 'Semana passada completa (Mon→Sun) — pra apresentar na segunda' },
            ].map((opt) => {
              const active = mode === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  title={opt.title}
                  className={`text-[10px] px-2 py-1 rounded transition font-medium inline-flex items-center gap-1 ${
                    active
                      ? 'bg-emerald-500/40 text-white shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {active && opt.key === 'hoje' && (
                    <span className="w-1 h-1 rounded-full bg-emerald-200 animate-pulse" />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
        {!setMode && setUntilToday && (
          <button
            onClick={() => setUntilToday((v) => !v)}
            className={`text-[11px] px-2.5 py-1.5 rounded border inline-flex items-center gap-1.5 ml-1 transition font-medium ${
              untilToday
                ? 'bg-emerald-500/30 text-white border-emerald-300/40 hover:bg-emerald-500/40'
                : 'bg-white/5 text-white/80 border-white/20 hover:bg-white/10'
            }`}
            title={untilToday ? 'Mostrando dados até HOJE (parcial)' : 'Mostrando dados até ONTEM (fechado)'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${untilToday ? 'bg-emerald-300 animate-pulse' : 'bg-white/50'}`} />
            {untilToday ? 'Hoje' : 'Até ontem'}
          </button>
        )}
        {onDownload && (
          <button
            onClick={onDownload}
            className="text-[11px] px-2.5 py-1.5 rounded border border-white/20 hover:bg-white/10 text-white/90 inline-flex items-center gap-1 transition"
            title="Baixar card como imagem (PNG)"
          >
            <DownloadSimple size={12} weight="bold" />
            PNG
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-[11px] px-2.5 py-1.5 rounded border border-white/20 hover:bg-white/10 text-white/90 inline-flex items-center gap-1 disabled:opacity-50 transition"
            title="Atualizar"
          >
            <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} weight="bold" />
            {loading ? '...' : ''}
          </button>
        )}
        {onWhatsapp && (
          <button
            onClick={onWhatsapp}
            className="text-[11px] px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-white inline-flex items-center gap-1.5 font-semibold shadow-sm transition"
            title="Enviar via WhatsApp"
          >
            <WhatsappLogo size={14} weight="fill" /> Enviar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Period picker (mês/ano ou semana/ano) ───────────────────────────────────
// Sub-toolbar abaixo do header com dropdowns rápidos, atalhos e
// indicador de histórico salvo (snapshot).
//
// tipo: 'mensal' | 'semanal'
// historicoSet: Set<string> com period_keys que têm snapshot ('2025-06', '2025-W22'…)
const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function periodKeyMensal(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}
function periodKeySemanal(ano, semana) {
  return `${ano}-W${String(semana).padStart(2, '0')}`;
}
function isoSemanaInicio(ano, semana) {
  // Segunda da semana ISO `ano-W{semana}`.
  const simple = new Date(Date.UTC(ano, 0, 1 + (semana - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else          monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d) =>
    `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export function PeriodoToolbar({
  tipo,                  // 'mensal' | 'semanal'
  ano, setAno,
  mes, setMes,           // só mensal
  semana, setSemana,     // só semanal
}) {
  const anoAtual = new Date().getFullYear();
  const anos = [];
  for (let a = anoAtual + 1; a >= 2023; a--) anos.push(a);

  // Geração de semanas: 1..53
  const semanas = [];
  if (tipo === 'semanal') {
    for (let w = 1; w <= 53; w++) semanas.push(w);
  }

  // Atalhos
  const atalhos = [];
  if (tipo === 'mensal') {
    atalhos.push({
      label: 'Mês passado',
      onClick: () => {
        const d = new Date(ano, mes - 1, 1);
        d.setMonth(d.getMonth() - 1);
        setAno(d.getFullYear());
        setMes(d.getMonth() + 1);
      },
    });
    atalhos.push({
      label: '3 meses atrás',
      onClick: () => {
        const d = new Date(ano, mes - 1, 1);
        d.setMonth(d.getMonth() - 3);
        setAno(d.getFullYear());
        setMes(d.getMonth() + 1);
      },
    });
    atalhos.push({
      label: 'Mesmo mês ano passado',
      onClick: () => setAno(ano - 1),
    });
  } else {
    atalhos.push({
      label: 'Semana passada',
      onClick: () => {
        if (semana <= 1) { setAno(ano - 1); setSemana(52); }
        else setSemana(semana - 1);
      },
    });
    atalhos.push({
      label: 'Há 4 semanas',
      onClick: () => {
        let s = semana - 4;
        let a = ano;
        while (s <= 0) { s += 52; a -= 1; }
        setAno(a);
        setSemana(s);
      },
    });
    atalhos.push({
      label: 'Mesma semana ano passado',
      onClick: () => setAno(ano - 1),
    });
  }

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mr-1">
        Pesquisar período
      </span>
      {tipo === 'mensal' ? (
        <>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Mês"
          >
            {MESES_NOMES.map((nome, idx) => (
              <option key={idx + 1} value={idx + 1}>{nome}</option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Ano"
          >
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </>
      ) : (
        <>
          <select
            value={semana}
            onChange={(e) => setSemana(Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-[180px]"
            title="Semana ISO"
          >
            {semanas.map((w) => (
              <option key={w} value={w}>
                S{String(w).padStart(2,'0')} · {isoSemanaInicio(ano, w)}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Ano"
          >
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </>
      )}

      <span className="text-gray-300 mx-1">|</span>

      {atalhos.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-600 hover:text-amber-700 font-medium transition"
        >
          {a.label}
        </button>
      ))}

    </div>
  );
}

// ─── KPI bar (4-5 cards de resumo no topo) ───────────────────────────────────
// items: [{ label, valor, sub, color, icon }]
export function KpiStripe({ items, loading }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-3 py-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
      {items.map((kpi, idx) => (
        <KpiTile key={kpi.label + idx} {...kpi} loading={loading} />
      ))}
    </div>
  );
}

function KpiTile({ label, valor, sub, color = 'gray', icon: Icon, loading }) {
  const colorMap = {
    gray: 'text-gray-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    purple: 'text-purple-700',
    sky: 'text-sky-700',
  };
  const iconBg = {
    gray: 'bg-gray-100',
    blue: 'bg-blue-100',
    emerald: 'bg-emerald-100',
    amber: 'bg-amber-100',
    rose: 'bg-rose-100',
    purple: 'bg-purple-100',
    sky: 'bg-sky-100',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 hover:shadow-sm transition">
      <div className="flex items-center gap-2 mb-1">
        {Icon && (
          <div className={`${iconBg[color] || iconBg.gray} p-1 rounded`}>
            <Icon size={11} weight="bold" className={colorMap[color] || colorMap.gray} />
          </div>
        )}
        <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 truncate">
          {label}
        </p>
      </div>
      {loading ? (
        <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
      ) : (
        <p className={`text-base font-extrabold tabular-nums ${colorMap[color] || colorMap.gray} leading-none`}>
          {valor}
        </p>
      )}
      {sub && (
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
      )}
    </div>
  );
}

// ─── Pílula de % com barra de progresso ──────────────────────────────────────
export function PctPill({ pct, withIcon = true, size = 'sm' }) {
  const sizeCls = size === 'lg'
    ? 'text-sm px-2.5 py-1'
    : size === 'md'
      ? 'text-xs px-2 py-0.5'
      : 'text-[11px] px-1.5 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-bold tabular-nums ${sizeCls} ${pctColor(pct)}`}>
      {withIcon && statusIcon(pct)}
      {Number(pct || 0).toFixed(0)}%
    </span>
  );
}

// ─── Barra de progresso fina (pra inline em cells) ───────────────────────────
export function MiniProgress({ pct, height = 3 }) {
  const w = Math.max(0, Math.min(100, Number(pct || 0)));
  return (
    <div
      className="w-full bg-gray-100 rounded-full overflow-hidden"
      style={{ height: `${height}px` }}
    >
      <div
        className={`h-full ${pctBarColor(pct)} transition-all`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

// ─── Skeleton row pra tabela em loading ─────────────────────────────────────
export function LoadingRow({ cols }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-2.5 px-3">
          <span
            className="inline-block bg-gray-200 rounded animate-pulse"
            style={{ width: i === 0 ? '90px' : '60px', height: '12px' }}
          >&nbsp;</span>
        </td>
      ))}
    </tr>
  );
}

// ─── Loading inline pra cells ───────────────────────────────────────────────
export function LoadingValue({ width = 70 }) {
  return (
    <span
      className="inline-block bg-gray-200 rounded animate-pulse"
      style={{ width: `${width}px`, height: '12px' }}
    >&nbsp;</span>
  );
}

// ─── Banner de info/aviso ────────────────────────────────────────────────────
export function InfoBanner({ children, tone = 'blue', icon = null }) {
  const toneMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
  };
  return (
    <div className={`px-3 py-2 rounded text-xs flex items-start gap-2 border ${toneMap[tone] || toneMap.blue}`}>
      {icon}
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Spinner inline com texto ───────────────────────────────────────────────
export function InlineLoader({ text = 'Atualizando...', tone = 'blue' }) {
  const toneMap = {
    blue: 'text-blue-600 bg-blue-50 border-blue-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    gray: 'text-gray-600 bg-gray-50 border-gray-200',
  };
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border ${toneMap[tone] || toneMap.blue}`}
    >
      <Spinner size={10} className="animate-spin" weight="bold" />
      {text}
    </div>
  );
}
