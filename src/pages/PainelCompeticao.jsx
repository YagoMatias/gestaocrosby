// Painel Competição B2R × B2M — Scoreboard estilo "estádio"
// Modo tela cheia, auto-refresh 1h, design dramático para monitor de TV.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Trophy,
  Package,
  TShirt,
  Storefront,
  ArrowsOut,
  ArrowsIn,
  ArrowsClockwise,
  Crown,
  Lightning,
  Fire,
  Star,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

// ─── Formatadores ──────────────────────────────────────────────────
const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtBRLcompacto = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
};

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Formata segundos para mm:ss (countdown do refresh)
const formatRefreshCountdown = (s) => {
  if (s == null || isNaN(s)) return '—';
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const fmtDataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const startOfIsoWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

// ─── Configuração visual de cada canal ─────────────────────────────
const CANAIS = [
  {
    key: 'revenda',
    label: 'B2R',
    nome: 'REVENDA',
    icon: Package,
    primary: '#10b981',    // emerald-500
    primaryDark: '#047857', // emerald-700
    glow: 'rgba(16, 185, 129, 0.6)',
    gradient: 'from-emerald-400 via-emerald-500 to-emerald-700',
    gradientLight: 'from-emerald-50 to-emerald-100',
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-50',
    text: 'text-emerald-600',
    textLight: 'text-emerald-300',
    border: 'border-emerald-400',
    ring: 'ring-emerald-400',
    shadow: 'shadow-emerald-500/50',
  },
  {
    key: 'multimarcas',
    label: 'B2M',
    nome: 'MULTIMARCAS',
    icon: TShirt,
    primary: '#a855f7',    // purple-500
    primaryDark: '#7e22ce', // purple-700
    glow: 'rgba(168, 85, 247, 0.6)',
    gradient: 'from-purple-400 via-purple-500 to-purple-700',
    gradientLight: 'from-purple-50 to-purple-100',
    bg: 'bg-purple-500',
    bgSoft: 'bg-purple-50',
    text: 'text-purple-600',
    textLight: 'text-purple-300',
    border: 'border-purple-400',
    ring: 'ring-purple-400',
    shadow: 'shadow-purple-500/50',
  },
  {
    key: 'franquia',
    label: 'B2L',
    nome: 'FRANQUIA',
    icon: Storefront,
    primary: '#3b82f6',    // blue-500
    primaryDark: '#1d4ed8', // blue-700
    glow: 'rgba(59, 130, 246, 0.6)',
    gradient: 'from-blue-400 via-blue-500 to-blue-700',
    gradientLight: 'from-blue-50 to-blue-100',
    bg: 'bg-blue-500',
    bgSoft: 'bg-blue-50',
    text: 'text-blue-600',
    textLight: 'text-blue-300',
    border: 'border-blue-400',
    ring: 'ring-blue-400',
    shadow: 'shadow-blue-500/50',
  },
];

// Intervalo de auto-refresh — sincronizado com cache TTL do backend (1h realtime).
// 2h dá margem confortável: cache do canal-totals expira em 1h, então o 2º
// refresh recompila uma vez; depois fica em cache de novo. Reduz 50% das
// chamadas TOTVS comparado ao refresh de 1h.
// IMPORTANTE: a página é exibida em TVs de loja — 2h é aceitável visualmente.
const AUTO_REFRESH_SECS = 7200; // 2h (era 1h)
// Circuit-breaker: após N erros consecutivos, para de tentar até user clicar atualizar
const MAX_ERROS_CONSECUTIVOS = 3;

// ─── Componente principal ──────────────────────────────────────────
export default function PainelCompeticao() {
  const [dadosDia, setDadosDia] = useState({});
  const [dadosSemana, setDadosSemana] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(AUTO_REFRESH_SECS);
  const errosRef = useRef(0); // contador de erros consecutivos (circuit-breaker)
  const containerRef = useRef(null);

  // Atualiza referência de "hoje" a cada chamada — mantém data correta após meia-noite
  const [refDate, setRefDate] = useState(() => new Date());
  const hojeIso = ymd(refDate);
  const semanaInicio = ymd(startOfIsoWeek(refDate));

  const carregar = useCallback(async ({ manual = false } = {}) => {
    // Lê a data NO momento da chamada — evita usar valor stale do closure
    // (importante na virada de meia-noite, onde hojeIso/semanaInicio do state
    // ainda estão um instante atrás)
    const agora = new Date();
    const hojeNow = ymd(agora);
    const semanaInicioNow = ymd(startOfIsoWeek(agora));
    setLoading(true);
    setErro('');
    setRefDate(agora); // sincroniza display do header
    try {
      // Endpoint consolidado: 1 HTTP roundtrip → backend faz 8 canal-totals
      // cached e combina os 3 canais B2M (multimarcas+inbound_david+inbound_rafael)
      // server-side. Reduz drasticamente o tráfego HTTP do frontend e mantém
      // a TOTVS API protegida pelo cache.
      const r = await fetch(`${API_BASE_URL}/api/crm/competicao-totais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datemin_dia: hojeNow,
          datemax_dia: hojeNow,
          datemin_sem: semanaInicioNow,
          datemax_sem: hojeNow,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      const { dia, semana } = j.data || {};

      setDadosDia(dia || {});
      setDadosSemana(semana || {});
      setLastUpdate(new Date());
      setNextRefreshIn(AUTO_REFRESH_SECS);
      errosRef.current = 0; // reset circuit-breaker SÓ em sucesso
    } catch (e) {
      errosRef.current += 1;
      const breaker = errosRef.current >= MAX_ERROS_CONSECUTIVOS;
      const msg = breaker
        ? `${e.message} — auto-refresh PAUSADO após ${errosRef.current} erros consecutivos. Clique em "Atualizar" pra tentar de novo.`
        : `${e.message} (tentativa ${errosRef.current}/${MAX_ERROS_CONSECUTIVOS})`;
      setErro(msg);
      // NÃO resetar o contador em refresh manual com erro — proteção
      // anti-overload: se o user fica clicando enquanto TOTVS está fora,
      // não devemos abrir caminho. O contador só zera no sucesso.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Auto-refresh + countdown visual. Circuit-breaker: pausa após N erros
  // consecutivos, evita bombardear TOTVS quando ele tá fora.
  useEffect(() => {
    const tick = setInterval(() => {
      setNextRefreshIn((s) => {
        if (s <= 1) {
          // Só re-fetch se circuit-breaker não acionou
          if (errosRef.current < MAX_ERROS_CONSECUTIVOS) {
            carregar();
          }
          return AUTO_REFRESH_SECS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [carregar]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── LÍQUIDOS por canal ──────────────────────────────────────────────
  // Regra: credev NUNCA conta como faturamento.
  // Cálculo: usa `invoice_value` do canal-totals (já é líquido bruto −
  // credev_in_payments − SaleReturns) clamped a 0 quando negativo. Esse
  // valor é a fonte ÚNICA da verdade — bate com Forecast e demais consumidores.
  // Caso o backend exponha `liquid_floored: true` (líquido seria ≤ 0 com
  // bruto > 0), o invoice_value já vem como bruto — comportamento atual.
  const liqCanal = (canalData) => {
    if (!canalData) return 0;
    return Math.max(0, Number(canalData.invoice_value || 0));
  };

  const liqDia = useMemo(
    () => ({
      revenda: liqCanal(dadosDia.revenda),
      multimarcas: liqCanal(dadosDia.multimarcas),
      franquia: liqCanal(dadosDia.franquia),
    }),
    [dadosDia],
  );
  const liqSemana = useMemo(
    () => ({
      revenda: liqCanal(dadosSemana.revenda),
      multimarcas: liqCanal(dadosSemana.multimarcas),
      franquia: liqCanal(dadosSemana.franquia),
    }),
    [dadosSemana],
  );

  // ─── Determina líder = canal com maior líquido ──────────────────
  const acharLider = (q) => {
    const arr = [
      ['revenda', q.revenda || 0],
      ['multimarcas', q.multimarcas || 0],
      ['franquia', q.franquia || 0],
    ].sort((a, b) => b[1] - a[1]);
    if (arr[0][1] === 0) return null;
    if (arr[0][1] === arr[1][1]) return null; // empate
    return arr[0][0];
  };
  const liderDia = useMemo(() => acharLider(liqDia), [liqDia]);
  const liderSemana = useMemo(() => acharLider(liqSemana), [liqSemana]);

  // ─── RENDER ─────────────────────────────────────────────────────
  // Tema CROSBY · CURLING: rock-on-ice (esporte do curling).
  // Elementos visuais: pedra de curling (curling stone) com handle vermelho,
  // alvo do curling ("house" — círculos concêntricos vermelho/branco/azul/branco)
  // como decoração no fundo, "sheets" (linhas paralelas no gelo) sutis.
  // Paleta: vermelho Crosby (cabo/pedra), branco (gelo), azul (pista glacial).
  return (
    <div
      ref={containerRef}
      className={`${
        fullscreen
          ? 'fixed inset-0 bg-gradient-to-br from-[#08152a] via-[#0a1f3d] to-[#08152a] overflow-hidden flex flex-col'
          : 'w-full max-w-7xl mx-auto py-3 px-2 sm:px-4'
      } font-barlow`}
    >
      {/* Decoração de fundo no fullscreen — TEMA CURLING */}
      {fullscreen && (
        <>
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            {/* Brilho glacial */}
            <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] bg-sky-400/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] bg-cyan-300/10 rounded-full blur-3xl" />
            <div className="absolute top-1/3 -left-32 w-96 h-96 bg-[#fe0000]/8 rounded-full blur-3xl" />
            <div className="absolute bottom-1/3 -right-32 w-96 h-96 bg-[#fe0000]/8 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 w-[700px] h-[700px] -translate-x-1/2 -translate-y-1/2 bg-white/3 rounded-full blur-3xl" />

            {/* "House" do curling — alvo de aros concêntricos no canto */}
            <svg className="absolute top-6 right-6 w-40 h-40 opacity-[0.08]" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="#fe0000" />
              <circle cx="50" cy="50" r="36" fill="#ffffff" />
              <circle cx="50" cy="50" r="24" fill="#1e88e5" />
              <circle cx="50" cy="50" r="12" fill="#ffffff" />
              <circle cx="50" cy="50" r="3" fill="#fe0000" />
            </svg>
            <svg className="absolute bottom-6 left-6 w-32 h-32 opacity-[0.06]" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="#fe0000" />
              <circle cx="50" cy="50" r="36" fill="#ffffff" />
              <circle cx="50" cy="50" r="24" fill="#1e88e5" />
              <circle cx="50" cy="50" r="12" fill="#ffffff" />
              <circle cx="50" cy="50" r="3" fill="#fe0000" />
            </svg>

            {/* Linhas paralelas (sheets do gelo de curling) — sutis no fundo */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'repeating-linear-gradient(180deg, transparent 0, transparent 80px, rgba(255,255,255,0.5) 80px, rgba(255,255,255,0.5) 81px)',
            }} />

            {/* Pedras de curling deslizando — sweep horizontal */}
            <div className="curl-stone-container absolute inset-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="curling-stone"
                  style={{
                    top: `${20 + i * 18}%`,
                    animationDelay: `${i * 4}s`,
                    animationDuration: `${16 + (i % 2) * 4}s`,
                  }}
                >
                  <svg viewBox="0 0 60 60" className="w-10 h-10">
                    {/* Granito (base da pedra) */}
                    <ellipse cx="30" cy="42" rx="26" ry="8" fill="#2d3748" />
                    <ellipse cx="30" cy="40" rx="26" ry="8" fill="url(#stoneGrad)" />
                    {/* Cabo (handle vermelho) */}
                    <rect x="20" y="20" width="20" height="14" rx="3" fill="#fe0000" stroke="#8b0000" strokeWidth="0.5" />
                    <rect x="24" y="14" width="12" height="8" rx="2" fill="#fe0000" stroke="#8b0000" strokeWidth="0.5" />
                    <rect x="28" y="10" width="4" height="6" fill="#8b0000" />
                    <defs>
                      <linearGradient id="stoneGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4a5568" />
                        <stop offset="50%" stopColor="#718096" />
                        <stop offset="100%" stopColor="#2d3748" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              ))}
            </div>

            {/* Snowflakes (mais sutis agora — tema é curling, não neve) */}
            <div className="snowflake-container absolute inset-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <span
                  key={i}
                  className="snowflake"
                  style={{
                    left: `${(i * 12.5) % 100}%`,
                    animationDelay: `${(i * 1.5) % 14}s`,
                    animationDuration: `${14 + (i % 3) * 3}s`,
                    fontSize: `${8 + (i % 3) * 3}px`,
                    opacity: 0.12 + (i % 3) * 0.05,
                  }}
                >
                  ❄
                </span>
              ))}
            </div>
          </div>
          <style>{`
            @keyframes glow-pulse {
              0%, 100% { box-shadow: 0 0 40px var(--glow-color), 0 0 80px var(--glow-color); }
              50% { box-shadow: 0 0 60px var(--glow-color), 0 0 120px var(--glow-color); }
            }
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-6px); }
            }
            @keyframes ice-shimmer {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.6; }
            }
            @keyframes snowfall {
              0%   { transform: translateY(-20px) translateX(0px); opacity: 0; }
              10%  { opacity: 1; }
              90%  { opacity: 1; }
              100% { transform: translateY(110vh) translateX(40px); opacity: 0; }
            }
            @keyframes curl-slide {
              0%   { transform: translateX(-15vw) rotate(0deg); opacity: 0; }
              5%   { opacity: 0.5; }
              50%  { opacity: 0.6; }
              95%  { opacity: 0.5; }
              100% { transform: translateX(115vw) rotate(720deg); opacity: 0; }
            }
            .leader-glow { animation: glow-pulse 2s ease-in-out infinite; }
            .shimmer-bar::after {
              content: '';
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
              animation: shimmer 2s infinite;
            }
            .float { animation: float 3s ease-in-out infinite; }
            .ice-border {
              border: 1px solid rgba(255, 255, 255, 0.15);
              box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.15),
                0 8px 32px rgba(8, 21, 42, 0.6);
            }
            .canada-stripe {
              background: linear-gradient(90deg,
                #fe0000 0%, #fe0000 18%,
                #ffffff 18%, #ffffff 82%,
                #fe0000 82%, #fe0000 100%);
            }
            .ice-glow {
              background: linear-gradient(135deg,
                rgba(56, 189, 248, 0.08) 0%,
                rgba(255, 255, 255, 0.04) 50%,
                rgba(56, 189, 248, 0.08) 100%);
              backdrop-filter: blur(20px);
            }
            .snowflake {
              position: absolute;
              top: -20px;
              color: rgba(255, 255, 255, 0.6);
              animation: snowfall linear infinite;
              pointer-events: none;
              user-select: none;
              text-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
            }
            .red-glow-text {
              text-shadow: 0 0 12px rgba(254, 0, 0, 0.5),
                           0 0 24px rgba(254, 0, 0, 0.3);
            }
            .curling-stone {
              position: absolute;
              left: -15vw;
              animation: curl-slide linear infinite;
              pointer-events: none;
              filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
            }
          `}</style>
        </>
      )}

      <div className={`relative z-10 ${fullscreen ? 'flex-1 flex flex-col p-5 lg:p-7 min-h-0' : ''}`}>
        {/* ═════ HEADER ═════ */}
        <Header
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          loading={loading}
          lastUpdate={lastUpdate}
          nextRefreshIn={nextRefreshIn}
          onRefresh={() => carregar({ manual: true })}
          hojeIso={hojeIso}
          semanaInicio={semanaInicio}
        />

        {erro && (
          <div className="mb-2 bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm flex-shrink-0">
            ⚠️ {erro}
          </div>
        )}

        {/* ═════ HERO SCOREBOARD ═════ */}
        <VsHero
          liqDia={liqDia}
          liqSemana={liqSemana}
          liderDia={liderDia}
          liderSemana={liderSemana}
          loading={loading}
          fullscreen={fullscreen}
        />

        {/* ═════ PODIUM DE VENDEDORES — 3 colunas (B2R / B2M / B2L) ═════ */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 ${fullscreen ? 'gap-4 mt-5 flex-1 min-h-0' : 'gap-3 mt-5'}`}>
          {CANAIS.map((c) => (
            <PodiumCanal
              key={c.key}
              canal={c}
              dadosDia={dadosDia[c.key]}
              dadosSemana={dadosSemana[c.key]}
              isLiderSemana={liderSemana === c.key}
              loading={loading}
              fullscreen={fullscreen}
            />
          ))}
        </div>

        {fullscreen && (
          <div className="text-center mt-2 text-slate-500 text-[10px] tracking-wider flex-shrink-0">
            ⟲ atualização automática · ESC para sair · {lastUpdate?.toLocaleTimeString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════
function Header({ fullscreen, toggleFullscreen, loading, lastUpdate, nextRefreshIn, onRefresh, hojeIso, semanaInicio }) {
  return (
    <div className={`flex items-center justify-between ${fullscreen ? 'mb-4 flex-shrink-0' : 'mb-4'}`}>
      <div className="flex items-center gap-3">
        <div
          className={`relative ${fullscreen ? 'w-14 h-14' : 'w-12 h-12'} rounded-xl flex items-center justify-center ${
            fullscreen
              ? 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 shadow-lg shadow-[#fe0000]/30 ring-2 ring-white/20'
              : 'bg-gradient-to-br from-[#fe0000] to-[#8b0000]'
          }`}
        >
          {/* Pedra de curling com cabo vermelho — esporte rock-on-ice */}
          {fullscreen ? (
            <svg viewBox="0 0 60 60" className="w-11 h-11 drop-shadow-lg">
              {/* Corpo da pedra (granito) */}
              <ellipse cx="30" cy="42" rx="22" ry="6" fill="#1a202c" />
              <ellipse cx="30" cy="40" rx="22" ry="6" fill="url(#stoneGradHdr)" />
              {/* Cabo (handle) vermelho — Crosby */}
              <rect x="22" y="22" width="16" height="12" rx="2" fill="#fe0000" stroke="#8b0000" strokeWidth="0.5" />
              <rect x="25" y="16" width="10" height="8" rx="1.5" fill="#fe0000" stroke="#8b0000" strokeWidth="0.5" />
              <rect x="28" y="12" width="4" height="6" fill="#8b0000" />
              {/* Reflexo brilho gelo */}
              <ellipse cx="22" cy="38" rx="6" ry="1.5" fill="rgba(255,255,255,0.2)" />
              <defs>
                <linearGradient id="stoneGradHdr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a5568" />
                  <stop offset="50%" stopColor="#718096" />
                  <stop offset="100%" stopColor="#1a202c" />
                </linearGradient>
              </defs>
            </svg>
          ) : (
            <Trophy size={26} weight="fill" className="text-white drop-shadow-lg" />
          )}
          {fullscreen && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-sky-400 rounded-full animate-pulse ring-2 ring-sky-200/50" />
          )}
        </div>
        <div className="leading-tight">
          <h1 className={`${fullscreen ? 'text-xl lg:text-2xl' : 'text-2xl'} font-black tracking-tight ${fullscreen ? 'text-white' : 'text-[#000638]'}`}>
            {fullscreen ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-[#fe0000] red-glow-text">CROSBY</span>
                <span className="text-white/80">·</span>
                <span className="bg-gradient-to-r from-emerald-300 via-white to-blue-300 bg-clip-text text-transparent">
                  B2R × B2M × B2L
                </span>
              </span>
            ) : (
              'Painel Competição'
            )}
          </h1>
          <p className={`${fullscreen ? 'text-[10px] text-sky-200/70 tracking-[0.2em] uppercase' : 'text-sm text-gray-600'}`}>
            {fullscreen
              ? `🥌 CURLING · A PEDRA NO GELO · HOJE ${fmtDataBr(hojeIso)} · Semana desde ${fmtDataBr(semanaInicio)}`
              : `B2R × B2M × B2L · HOJE (${fmtDataBr(hojeIso)}) · Semana desde ${fmtDataBr(semanaInicio)} · tempo real`}
          </p>
        </div>
      </div>

      <div className={`flex items-center ${fullscreen ? 'gap-1.5' : 'gap-2'}`}>
        {!loading && lastUpdate && (
          <div className={`hidden md:flex items-center gap-1.5 ${fullscreen ? 'px-2.5 py-1' : 'px-3 py-2'} rounded-lg ${fullscreen ? 'bg-white/8 border border-sky-300/20 backdrop-blur' : 'bg-gray-100'}`}>
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-sky-300 opacity-75" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-sky-400" />
            </span>
            <span className={`${fullscreen ? 'text-[10px]' : 'text-xs'} font-semibold tracking-wider ${fullscreen ? 'text-sky-100' : 'text-gray-700'}`}>
              AO VIVO · {formatRefreshCountdown(nextRefreshIn)}
            </span>
          </div>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          className={`${fullscreen ? 'p-2' : 'p-2.5'} rounded-lg transition disabled:opacity-50 ${
            fullscreen ? 'bg-white/8 hover:bg-white/15 text-white border border-sky-300/20 backdrop-blur' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title="Atualizar agora"
        >
          <ArrowsClockwise size={fullscreen ? 16 : 20} weight="bold" className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={toggleFullscreen}
          className={`${fullscreen ? 'p-2' : 'p-2.5'} rounded-lg transition ${
            fullscreen
              ? 'bg-gradient-to-br from-[#fe0000] to-[#8b0000] hover:from-[#ff1818] hover:to-[#a30000] text-white shadow-lg shadow-[#fe0000]/40 ring-1 ring-white/20'
              : 'bg-gradient-to-br from-[#000638] to-[#0a1450] hover:from-[#0a1450] hover:to-[#1a2570] text-white shadow-md'
          }`}
          title={fullscreen ? 'Sair de tela cheia' : 'Tela cheia (modo TV)'}
        >
          {fullscreen ? <ArrowsIn size={16} weight="bold" /> : <ArrowsOut size={20} weight="bold" />}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HERO: 2 placar grandes (Dia + Semana) lado-a-lado, com canal vs canal
// ═══════════════════════════════════════════════════════════════════
function VsHero({ liqDia, liqSemana, liderDia, liderSemana, loading, fullscreen }) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 ${fullscreen ? 'gap-6 flex-shrink-0' : 'gap-4'}`}>
      <PlacarPeriodo
        titulo="DIA"
        icon={Fire}
        iconColor="text-orange-400"
        valores={liqDia}
        lider={liderDia}
        loading={loading}
        fullscreen={fullscreen}
      />
      <PlacarPeriodo
        titulo="SEMANA"
        icon={Lightning}
        iconColor="text-amber-400"
        valores={liqSemana}
        lider={liderSemana}
        loading={loading}
        fullscreen={fullscreen}
      />
    </div>
  );
}

function PlacarPeriodo({ titulo, icon: TitleIcon, iconColor, valores, lider, loading, fullscreen }) {
  // LÍQUIDO = soma dos per_seller (bruto − credev_value). Credev não conta.
  const r = Number(valores?.revenda ?? 0);
  const m = Number(valores?.multimarcas ?? 0);
  const f = Number(valores?.franquia ?? 0);
  const valoresArr = [
    ['revenda', r],
    ['multimarcas', m],
    ['franquia', f],
  ].sort((a, b) => b[1] - a[1]);
  const maior = valoresArr[0][1];
  const segundo = valoresArr[1][1];
  const diff = Math.abs(maior - segundo);
  const total = r + m + f || 1;
  const pctR = (r / total) * 100;
  const pctM = (m / total) * 100;
  const pctF = (f / total) * 100;
  const liderLabel = lider === 'revenda' ? 'B2R' : lider === 'multimarcas' ? 'B2M' : lider === 'franquia' ? 'B2L' : '';

  return (
    <div
      className={`relative rounded-3xl overflow-hidden ${
        fullscreen
          ? 'ice-glow ice-border'
          : 'bg-white border border-gray-200 shadow-md'
      }`}
    >
      {/* Faixa decorativa superior — VERMELHO·BRANCO·VERMELHO (Canadá) */}
      <div className="h-1.5 canada-stripe" />

      <div className={`${fullscreen ? 'p-5' : 'p-5'}`}>
        {/* Cabeçalho do placar */}
        <div className={`flex items-center justify-between ${fullscreen ? 'mb-3' : 'mb-4'}`}>
          <div className="flex items-center gap-2">
            <TitleIcon size={fullscreen ? 20 : 18} weight="fill" className={iconColor} />
            <h2 className={`${fullscreen ? 'text-lg' : 'text-lg'} font-black tracking-widest ${fullscreen ? 'text-white' : 'text-[#000638]'}`}>
              {titulo}
            </h2>
          </div>
          {lider && (
            <div
              className={`inline-flex items-center gap-1 ${fullscreen ? 'px-2 py-0.5' : 'px-2 py-0.5'} rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-amber-900 ${fullscreen ? 'text-[10px]' : 'text-[10px]'} font-black uppercase tracking-widest shadow-lg`}
            >
              <Crown size={fullscreen ? 11 : 11} weight="fill" />
              LÍDER {liderLabel}
            </div>
          )}
        </div>

        {/* Cards 3 canais (B2R / B2M / B2L) */}
        <div className={`grid grid-cols-3 ${fullscreen ? 'gap-2' : 'gap-2'} relative`}>
          <CanalScoreCard
            canal={CANAIS[0]}
            valor={r}
            isLider={lider === 'revenda'}
            loading={loading}
            fullscreen={fullscreen}
          />
          <CanalScoreCard
            canal={CANAIS[1]}
            valor={m}
            isLider={lider === 'multimarcas'}
            loading={loading}
            fullscreen={fullscreen}
          />
          <CanalScoreCard
            canal={CANAIS[2]}
            valor={f}
            isLider={lider === 'franquia'}
            loading={loading}
            fullscreen={fullscreen}
          />
        </div>

        {/* Barra de proporção — 3 segmentos (B2R / B2M / B2L) */}
        <div className={`${fullscreen ? 'mt-3' : 'mt-4'} relative`}>
          <div className={`flex ${fullscreen ? 'h-2.5' : 'h-3'} rounded-full overflow-hidden ${fullscreen ? 'bg-slate-800' : 'bg-gray-200'}`}>
            <div
              className="bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700 ease-out"
              style={{ width: `${pctR}%` }}
            />
            <div
              className="bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-700 ease-out"
              style={{ width: `${pctM}%` }}
            />
            <div
              className="bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700 ease-out"
              style={{ width: `${pctF}%` }}
            />
          </div>
          <div className={`grid grid-cols-3 mt-1.5 ${fullscreen ? 'text-xs' : 'text-xs'} font-bold`}>
            <span className={fullscreen ? 'text-emerald-300' : 'text-emerald-600'}>B2R {pctR.toFixed(0)}%</span>
            <span className={`text-center ${fullscreen ? 'text-purple-300' : 'text-purple-600'}`}>B2M {pctM.toFixed(0)}%</span>
            <span className={`text-right ${fullscreen ? 'text-blue-300' : 'text-blue-600'}`}>B2L {pctF.toFixed(0)}%</span>
          </div>
        </div>

        {/* Diferença líder vs segundo */}
        {(r > 0 || m > 0 || f > 0) && (
          <div className={`${fullscreen ? 'mt-3' : 'mt-3'} text-center`}>
            {lider ? (
              <div className={`inline-flex items-center gap-1.5 ${fullscreen ? 'text-sm' : 'text-sm'} ${fullscreen ? 'text-amber-300' : 'text-amber-700'}`}>
                <Star size={fullscreen ? 11 : 12} weight="fill" />
                <span className="font-semibold">
                  Vantagem: <strong>{fmtBRL(diff)}</strong>
                </span>
              </div>
            ) : (
              <div className={`${fullscreen ? 'text-xs text-slate-400' : 'text-sm text-gray-500'} font-semibold`}>
                ⚖️ Empate técnico
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CanalScoreCard({ canal, valor, isLider, loading, fullscreen }) {
  const Icon = canal.icon;
  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-500 ${
        isLider
          ? `bg-gradient-to-br ${canal.gradient} text-white scale-105 ${fullscreen ? 'leader-glow ring-2 ring-[#fe0000]/40' : `shadow-2xl ${canal.shadow}`}`
          : fullscreen
            ? 'bg-slate-900/40 backdrop-blur border border-sky-300/15 text-slate-300'
            : 'bg-gray-50 border border-gray-200 text-gray-700'
      } ${fullscreen ? 'p-4' : 'p-3'}`}
      style={isLider && fullscreen ? { ['--glow-color']: canal.glow } : undefined}
    >
      {/* Pedra de curling decorativa no líder + alvo do curling no canto */}
      {isLider && fullscreen && (
        <>
          <div className="absolute top-2 right-2 float">
            <Crown size={16} weight="fill" className="text-amber-300 drop-shadow-lg" />
          </div>
          {/* "House" do curling (alvo concêntrico) no canto */}
          <svg
            viewBox="0 0 100 100"
            className="absolute -bottom-4 -right-4 w-20 h-20 opacity-25"
          >
            <circle cx="50" cy="50" r="48" fill="#fe0000" />
            <circle cx="50" cy="50" r="36" fill="#ffffff" />
            <circle cx="50" cy="50" r="24" fill="#1e88e5" />
            <circle cx="50" cy="50" r="12" fill="#ffffff" />
            <circle cx="50" cy="50" r="3" fill="#fe0000" />
          </svg>
        </>
      )}

      <div className={`flex items-center gap-2 ${fullscreen ? 'mb-2' : 'mb-2'}`}>
        <Icon size={fullscreen ? 18 : 16} weight={isLider ? 'fill' : 'bold'} />
        <div>
          <div className={`${fullscreen ? 'text-xs' : 'text-[10px]'} font-black uppercase tracking-widest opacity-80`}>{canal.label}</div>
          <div className={`${fullscreen ? 'text-[10px]' : 'text-[9px]'} opacity-60 uppercase tracking-wider`}>{canal.nome}</div>
        </div>
      </div>

      <div className={`${fullscreen ? 'text-3xl lg:text-4xl' : 'text-xl'} font-black tabular-nums leading-none ${fullscreen ? 'mt-2' : 'mt-2'}`}>
        {loading ? (
          <span className="opacity-40">R$ ...</span>
        ) : valor === 0 ? (
          <span className="opacity-50">R$ 0,00</span>
        ) : (
          fmtBRL(valor)
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PODIUM: tabela de vendedores por canal
// ═══════════════════════════════════════════════════════════════════
function PodiumCanal({ canal, dadosDia, dadosSemana, isLiderSemana, loading, fullscreen }) {
  const Icon = canal.icon;

  // LÍQUIDO por vendedor = invoice_value (bruto) − credev_value.
  // Credev é pagamento com saldo anterior do cliente, NÃO entra caixa novo.
  // Regra do negócio: credev nunca conta como faturamento.
  const liqSeller = (s) =>
    Math.max(0, Number(s.invoice_value || 0) - Number(s.credev_value || 0));

  // Indexa por seller_code combinando dia+semana (sempre LÍQUIDO)
  const sellers = useMemo(() => {
    const map = new Map();
    for (const s of dadosSemana?.per_seller || []) {
      map.set(String(s.seller_code), {
        seller_code: s.seller_code,
        seller_name: s.seller_name || s.name || `Vendedor ${s.seller_code}`,
        semana: liqSeller(s),
        dia: 0,
      });
    }
    for (const s of dadosDia?.per_seller || []) {
      const k = String(s.seller_code);
      const cur = map.get(k);
      if (cur) cur.dia = liqSeller(s);
      else map.set(k, {
        seller_code: s.seller_code,
        seller_name: s.seller_name || s.name || `Vendedor ${s.seller_code}`,
        semana: 0,
        dia: liqSeller(s),
      });
    }
    return Array.from(map.values()).sort((a, b) => b.semana - a.semana);
  }, [dadosDia, dadosSemana]);

  // Total = SOMA dos líquidos dos vendedores (não usa invoice_value do canal,
  // que pode incluir SaleReturns adicional não atribuível a vendedor).
  // Assim a soma dos vendedores SEMPRE bate com o total exibido.
  const totalLiqDia = useMemo(
    () => sellers.reduce((s, x) => s + (Number(x.dia) || 0), 0),
    [sellers],
  );
  const totalLiqSemana = useMemo(
    () => sellers.reduce((s, x) => s + (Number(x.semana) || 0), 0),
    [sellers],
  );

  const medalhas = ['🥇', '🥈', '🥉'];

  return (
    <div
      className={`rounded-3xl overflow-hidden transition-all duration-500 ${
        fullscreen ? 'h-full flex flex-col min-h-0' : ''
      } ${
        fullscreen
          ? `ice-glow ice-border ${isLiderSemana ? 'ring-2 ring-[#fe0000]/40 shadow-2xl shadow-[#fe0000]/20' : ''}`
          : `bg-white border ${isLiderSemana ? canal.border + ' border-2' : 'border-gray-200'} shadow-md ${isLiderSemana ? canal.shadow + ' shadow-xl' : ''}`
      }`}
    >
      {/* Header colorido com faixa Canadá no topo */}
      {fullscreen && <div className="h-1 canada-stripe" />}
      <div
        className={`relative ${fullscreen ? 'px-5 py-3 flex-shrink-0' : 'px-4 py-3'} bg-gradient-to-r ${canal.gradient} text-white overflow-hidden`}
      >
        {/* Shimmer no líder */}
        {isLiderSemana && (
          <div className="shimmer-bar absolute inset-0 overflow-hidden" />
        )}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`${fullscreen ? 'w-8 h-8' : 'w-9 h-9'} rounded-xl bg-white/20 backdrop-blur flex items-center justify-center`}>
              <Icon size={fullscreen ? 16 : 18} weight="fill" />
            </div>
            <div>
              <h3 className={`${fullscreen ? 'text-base' : 'text-lg'} font-black leading-none tracking-tight`}>
                {canal.label} · {canal.nome}
              </h3>
              <p className={`${fullscreen ? 'text-[9px] mt-0.5' : 'text-[11px] mt-0.5'} opacity-80 uppercase tracking-wider`}>
                {sellers.length} vendedor{sellers.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          {isLiderSemana && (
            <div className={`inline-flex items-center gap-1 ${fullscreen ? 'px-2 py-0.5' : 'px-2 py-0.5'} rounded-full bg-[#fe0000] text-white ${fullscreen ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-widest shadow-lg animate-pulse ring-1 ring-white/30`}>
              <Crown size={fullscreen ? 10 : 10} weight="fill" /> Campeão
            </div>
          )}
        </div>
      </div>

      {/* Tabela vendedores */}
      <div className={`${fullscreen ? 'bg-slate-900/50 flex-1 flex flex-col min-h-0' : 'bg-white'}`}>
        <div className={`grid grid-cols-12 ${fullscreen ? 'px-5 py-2 flex-shrink-0 text-[10px]' : 'px-4 py-2 text-[9px]'} font-black uppercase tracking-widest ${fullscreen ? 'text-slate-400 bg-slate-900/40 border-b border-white/5' : 'text-gray-500 bg-gray-50 border-b border-gray-200'}`}>
          <div className="col-span-5">Vendedor</div>
          <div className="col-span-3 text-right">Dia</div>
          <div className="col-span-4 text-right">Semana</div>
        </div>

        <div className={fullscreen ? 'flex-1 overflow-y-auto min-h-0' : ''}>
        {loading && sellers.length === 0 ? (
          [1, 2, 3].map((i) => (
            <div key={i} className={`grid grid-cols-12 ${fullscreen ? 'px-5 py-2.5' : 'px-4 py-2.5'} ${fullscreen ? 'border-b border-white/5' : 'border-b border-gray-100'}`}>
              <div className="col-span-5">
                <div className={`h-3 ${fullscreen ? 'bg-slate-700' : 'bg-gray-200'} rounded animate-pulse w-3/4`} />
              </div>
              <div className="col-span-3 text-right">
                <div className={`h-3 ${fullscreen ? 'bg-slate-700' : 'bg-gray-200'} rounded animate-pulse ml-auto w-2/3`} />
              </div>
              <div className="col-span-4 text-right">
                <div className={`h-3 ${fullscreen ? 'bg-slate-700' : 'bg-gray-200'} rounded animate-pulse ml-auto w-3/4`} />
              </div>
            </div>
          ))
        ) : sellers.length === 0 ? (
          <div className={`text-center ${fullscreen ? 'py-6 text-slate-500 text-xs' : 'py-8 text-gray-400 text-sm'}`}>
            Sem vendas no período
          </div>
        ) : (
          sellers.map((s, idx) => {
            const top3 = idx < 3;
            return (
              <div
                key={s.seller_code}
                className={`grid grid-cols-12 items-center ${fullscreen ? 'px-5 py-2.5' : 'px-4 py-2.5'} ${
                  fullscreen ? 'border-b border-white/5' : 'border-b border-gray-100'
                } ${top3 && idx === 0 ? (fullscreen ? 'bg-amber-500/5' : canal.bgSoft) : ''} transition-colors`}
              >
                {/* Vendedor */}
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  {top3 ? (
                    <span className={`${fullscreen ? 'text-lg' : 'text-lg'} leading-none flex-shrink-0`}>{medalhas[idx]}</span>
                  ) : (
                    <span className={`${fullscreen ? 'w-6 text-xs' : 'w-5 text-xs'} text-center font-bold ${fullscreen ? 'text-slate-500' : 'text-gray-400'} flex-shrink-0`}>
                      #{idx + 1}
                    </span>
                  )}
                  <span className={`${fullscreen ? 'text-sm' : 'text-sm'} font-bold uppercase tracking-wide ${fullscreen ? 'text-white' : 'text-gray-800'} truncate`}>
                    {s.seller_name}
                  </span>
                </div>

                {/* Dia */}
                <div className={`col-span-3 text-right tabular-nums ${fullscreen ? 'text-xs' : 'text-xs'} font-semibold ${
                  s.dia > 0
                    ? fullscreen ? 'text-emerald-300' : canal.text
                    : fullscreen ? 'text-slate-700' : 'text-gray-300'
                }`}>
                  {s.dia > 0 ? fmtBRL(s.dia) : '—'}
                </div>

                {/* Semana */}
                <div className={`col-span-4 text-right tabular-nums ${fullscreen ? 'text-sm' : 'text-sm'} font-black ${fullscreen ? 'text-white' : 'text-gray-900'}`}>
                  {s.semana > 0 ? fmtBRL(s.semana) : <span className={fullscreen ? 'text-slate-700' : 'text-gray-300'}>—</span>}
                </div>
              </div>
            );
          })
        )}
        </div>

        {/* Total final — SOMA dos vendedores líquidos (sempre bate com a tabela) */}
        {sellers.length > 0 && (
          <div
            className={`grid grid-cols-12 items-center ${fullscreen ? 'px-5 py-3 flex-shrink-0' : 'px-4 py-3'} border-t-2 ${
              fullscreen ? 'border-white/10 bg-slate-900/80' : `${canal.border} ${canal.bgSoft}`
            }`}
          >
            <div className={`col-span-5 ${fullscreen ? 'text-sm text-white' : 'text-base text-gray-900'} font-black tracking-wide uppercase`}>
              Total
            </div>
            <div className={`col-span-3 text-right tabular-nums ${fullscreen ? 'text-sm text-emerald-300' : 'text-sm ' + canal.text} font-black`}>
              {fmtBRL(totalLiqDia)}
            </div>
            <div className={`col-span-4 text-right tabular-nums ${fullscreen ? 'text-base text-white' : 'text-base text-gray-900'} font-black`}>
              {fmtBRL(totalLiqSemana)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
