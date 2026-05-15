// Painel Competição B2R × B2M — Scoreboard estilo "estádio"
// Modo tela cheia, auto-refresh 1h, design dramático para monitor de TV.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Trophy,
  Package,
  TShirt,
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
];

// ─── Componente principal ──────────────────────────────────────────
export default function PainelCompeticao() {
  const [dadosDia, setDadosDia] = useState({});
  const [dadosSemana, setDadosSemana] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(3600);
  const containerRef = useRef(null);

  // Atualiza referência de "hoje" a cada chamada — mantém data correta após meia-noite
  const [refDate, setRefDate] = useState(() => new Date());
  const hojeIso = ymd(refDate);
  const semanaInicio = ymd(startOfIsoWeek(refDate));

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    // Atualiza data de referência (importante após meia-noite)
    setRefDate(new Date());
    try {
      const fetchCanal = async (modulo, datemin, datemax) => {
        const r = await fetch(`${API_BASE_URL}/api/crm/canal-totals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modulo, datemin, datemax }),
        });
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
        return j.data;
      };

      // Tempo real: DIA = hoje (HH:00 → agora); SEMANA = segunda → hoje
      const [revDia, mmDia, revSem, mmSem] = await Promise.all([
        fetchCanal('revenda', hojeIso, hojeIso),
        fetchCanal('multimarcas', hojeIso, hojeIso),
        fetchCanal('revenda', semanaInicio, hojeIso),
        fetchCanal('multimarcas', semanaInicio, hojeIso),
      ]);

      setDadosDia({ revenda: revDia, multimarcas: mmDia });
      setDadosSemana({ revenda: revSem, multimarcas: mmSem });
      setLastUpdate(new Date());
      setNextRefreshIn(3600);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [hojeIso, semanaInicio]);

  useEffect(() => { carregar(); }, [carregar]);

  // Auto-refresh a cada 1h + countdown visual
  useEffect(() => {
    const tick = setInterval(() => {
      setNextRefreshIn((s) => {
        if (s <= 1) {
          carregar();
          return 3600;
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

  // ─── Determina líderes (usa gross — vendas brutas, sem devoluções) ─────
  const liderDia = useMemo(() => {
    const r = Number(dadosDia.revenda?.invoice_value ?? 0);
    const m = Number(dadosDia.multimarcas?.invoice_value ?? 0);
    if (r === m) return null;
    return r > m ? 'revenda' : 'multimarcas';
  }, [dadosDia]);

  const liderSemana = useMemo(() => {
    const r = Number(dadosSemana.revenda?.invoice_value ?? 0);
    const m = Number(dadosSemana.multimarcas?.invoice_value ?? 0);
    if (r === m) return null;
    return r > m ? 'revenda' : 'multimarcas';
  }, [dadosSemana]);

  // ─── RENDER ─────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`${
        fullscreen
          ? 'fixed inset-0 bg-gradient-to-br from-[#0a0e27] via-[#0f1635] to-[#0a0e27] overflow-hidden flex flex-col'
          : 'w-full max-w-7xl mx-auto py-3 px-2 sm:px-4'
      } font-barlow`}
    >
      {/* Decoração de fundo no fullscreen */}
      {fullscreen && (
        <>
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 bg-amber-500/5 rounded-full blur-3xl" />
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
            .leader-glow { animation: glow-pulse 2s ease-in-out infinite; }
            .shimmer-bar::after {
              content: '';
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
              animation: shimmer 2s infinite;
            }
            .float { animation: float 3s ease-in-out infinite; }
          `}</style>
        </>
      )}

      <div className={`relative z-10 ${fullscreen ? 'flex-1 flex flex-col p-3 lg:p-4 min-h-0' : ''}`}>
        {/* ═════ HEADER ═════ */}
        <Header
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          loading={loading}
          lastUpdate={lastUpdate}
          nextRefreshIn={nextRefreshIn}
          onRefresh={carregar}
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
          dadosDia={dadosDia}
          dadosSemana={dadosSemana}
          liderDia={liderDia}
          liderSemana={liderSemana}
          loading={loading}
          fullscreen={fullscreen}
        />

        {/* ═════ PODIUM DE VENDEDORES ═════ */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 ${fullscreen ? 'gap-3 mt-3 flex-1 min-h-0' : 'gap-4 mt-5'}`}>
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
    <div className={`flex items-center justify-between ${fullscreen ? 'mb-2 flex-shrink-0' : 'mb-4'}`}>
      <div className="flex items-center gap-2">
        <div
          className={`relative ${fullscreen ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl flex items-center justify-center ${
            fullscreen
              ? 'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-lg shadow-amber-500/50'
              : 'bg-gradient-to-br from-amber-400 to-amber-600'
          }`}
        >
          <Trophy size={fullscreen ? 22 : 26} weight="fill" className="text-white drop-shadow-lg" />
          {fullscreen && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse ring-2 ring-emerald-300/50" />
          )}
        </div>
        <div className="leading-tight">
          <h1 className={`${fullscreen ? 'text-xl lg:text-2xl' : 'text-2xl'} font-black tracking-tight ${fullscreen ? 'text-white' : 'text-[#000638]'}`}>
            {fullscreen ? (
              <span className="bg-gradient-to-r from-emerald-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">
                COMPETIÇÃO B2R × B2M
              </span>
            ) : (
              'Painel Competição'
            )}
          </h1>
          <p className={`${fullscreen ? 'text-[10px] text-slate-400 tracking-wider uppercase' : 'text-sm text-gray-600'}`}>
            {fullscreen
              ? `⚡ HOJE ${fmtDataBr(hojeIso)} · Semana desde ${fmtDataBr(semanaInicio)}`
              : `B2R × B2M · HOJE (${fmtDataBr(hojeIso)}) · Semana desde ${fmtDataBr(semanaInicio)} · tempo real`}
          </p>
        </div>
      </div>

      <div className={`flex items-center ${fullscreen ? 'gap-1' : 'gap-2'}`}>
        {!loading && lastUpdate && (
          <div className={`hidden md:flex items-center gap-1.5 ${fullscreen ? 'px-2 py-1' : 'px-3 py-2'} rounded-lg ${fullscreen ? 'bg-white/5 border border-white/10' : 'bg-gray-100'}`}>
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            <span className={`${fullscreen ? 'text-[10px]' : 'text-xs'} font-semibold ${fullscreen ? 'text-slate-300' : 'text-gray-700'}`}>
              AO VIVO · {nextRefreshIn}s
            </span>
          </div>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          className={`${fullscreen ? 'p-1.5' : 'p-2.5'} rounded-lg transition disabled:opacity-50 ${
            fullscreen ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title="Atualizar agora"
        >
          <ArrowsClockwise size={fullscreen ? 16 : 20} weight="bold" className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={toggleFullscreen}
          className={`${fullscreen ? 'p-1.5' : 'p-2.5'} rounded-lg transition ${
            fullscreen
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/50'
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
function VsHero({ dadosDia, dadosSemana, liderDia, liderSemana, loading, fullscreen }) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 ${fullscreen ? 'gap-3 flex-shrink-0' : 'gap-4'}`}>
      <PlacarPeriodo
        titulo="DIA"
        icon={Fire}
        iconColor="text-orange-400"
        dados={dadosDia}
        lider={liderDia}
        loading={loading}
        fullscreen={fullscreen}
      />
      <PlacarPeriodo
        titulo="SEMANA"
        icon={Lightning}
        iconColor="text-amber-400"
        dados={dadosSemana}
        lider={liderSemana}
        loading={loading}
        fullscreen={fullscreen}
      />
    </div>
  );
}

function PlacarPeriodo({ titulo, icon: TitleIcon, iconColor, dados, lider, loading, fullscreen }) {
  // LÍQUIDO = vendas reais com credev/devolução já subtraídos.
  const r = Number(dados.revenda?.invoice_value ?? 0);
  const m = Number(dados.multimarcas?.invoice_value ?? 0);
  const diff = Math.abs(r - m);
  const total = r + m || 1;
  const pctR = (r / total) * 100;
  const pctM = (m / total) * 100;

  return (
    <div
      className={`relative rounded-3xl overflow-hidden ${
        fullscreen
          ? 'bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl'
          : 'bg-white border border-gray-200 shadow-md'
      }`}
    >
      {/* Faixa decorativa superior */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-purple-500" />

      <div className={`${fullscreen ? 'p-3' : 'p-5'}`}>
        {/* Cabeçalho do placar */}
        <div className={`flex items-center justify-between ${fullscreen ? 'mb-2' : 'mb-4'}`}>
          <div className="flex items-center gap-2">
            <TitleIcon size={fullscreen ? 18 : 18} weight="fill" className={iconColor} />
            <h2 className={`${fullscreen ? 'text-base' : 'text-lg'} font-black tracking-widest ${fullscreen ? 'text-white' : 'text-[#000638]'}`}>
              {titulo}
            </h2>
          </div>
          {lider && (
            <div
              className={`inline-flex items-center gap-1 ${fullscreen ? 'px-2 py-0.5' : 'px-2 py-0.5'} rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-amber-900 ${fullscreen ? 'text-[10px]' : 'text-[10px]'} font-black uppercase tracking-widest shadow-lg`}
            >
              <Crown size={fullscreen ? 11 : 11} weight="fill" />
              LÍDER {lider === 'revenda' ? 'B2R' : 'B2M'}
            </div>
          )}
        </div>

        {/* Cards vs */}
        <div className={`grid grid-cols-2 ${fullscreen ? 'gap-2' : 'gap-3'} relative`}>
          <CanalScoreCard
            canal={CANAIS[0]}
            valor={r}
            isLider={lider === 'revenda'}
            loading={loading}
            fullscreen={fullscreen}
          />
          {/* VS no centro */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div
              className={`${fullscreen ? 'w-9 h-9 text-sm' : 'w-10 h-10 text-sm'} rounded-full flex items-center justify-center font-black ${
                fullscreen
                  ? 'bg-slate-900 text-amber-300 border-2 border-amber-500 shadow-xl shadow-amber-500/50'
                  : 'bg-[#000638] text-amber-300 border-2 border-amber-400 shadow-lg'
              }`}
            >
              VS
            </div>
          </div>
          <CanalScoreCard
            canal={CANAIS[1]}
            valor={m}
            isLider={lider === 'multimarcas'}
            loading={loading}
            fullscreen={fullscreen}
          />
        </div>

        {/* Barra de proporção */}
        <div className={`${fullscreen ? 'mt-2' : 'mt-4'} relative`}>
          <div className={`flex ${fullscreen ? 'h-2' : 'h-3'} rounded-full overflow-hidden ${fullscreen ? 'bg-slate-800' : 'bg-gray-200'}`}>
            <div
              className="bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700 ease-out"
              style={{ width: `${pctR}%` }}
            />
            <div
              className="bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-700 ease-out"
              style={{ width: `${pctM}%` }}
            />
          </div>
          <div className={`flex justify-between mt-1 ${fullscreen ? 'text-[10px]' : 'text-xs'} font-bold`}>
            <span className={fullscreen ? 'text-emerald-300' : 'text-emerald-600'}>{pctR.toFixed(0)}%</span>
            <span className={fullscreen ? 'text-purple-300' : 'text-purple-600'}>{pctM.toFixed(0)}%</span>
          </div>
        </div>

        {/* Diferença */}
        {(r > 0 || m > 0) && (
          <div className={`${fullscreen ? 'mt-1.5' : 'mt-3'} text-center`}>
            {lider ? (
              <div className={`inline-flex items-center gap-1.5 ${fullscreen ? 'text-xs' : 'text-sm'} ${fullscreen ? 'text-amber-300' : 'text-amber-700'}`}>
                <Star size={fullscreen ? 11 : 12} weight="fill" />
                <span className="font-semibold">
                  Diferença: <strong>{fmtBRL(diff)}</strong>
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
          ? `bg-gradient-to-br ${canal.gradient} text-white scale-105 ${fullscreen ? 'leader-glow' : `shadow-2xl ${canal.shadow}`}`
          : fullscreen
            ? 'bg-slate-800/50 border border-white/5 text-slate-300'
            : 'bg-gray-50 border border-gray-200 text-gray-700'
      } ${fullscreen ? 'p-2.5' : 'p-3'}`}
      style={isLider && fullscreen ? { ['--glow-color']: canal.glow } : undefined}
    >
      {/* Sparkle decorativo do líder */}
      {isLider && fullscreen && (
        <div className="absolute top-1.5 right-1.5 float">
          <Crown size={14} weight="fill" className="text-amber-300 drop-shadow-lg" />
        </div>
      )}

      <div className={`flex items-center gap-1.5 ${fullscreen ? 'mb-1' : 'mb-2'}`}>
        <Icon size={fullscreen ? 16 : 16} weight={isLider ? 'fill' : 'bold'} />
        <div>
          <div className={`${fullscreen ? 'text-[11px]' : 'text-[10px]'} font-black uppercase tracking-widest opacity-80`}>{canal.label}</div>
          <div className={`${fullscreen ? 'text-[9px]' : 'text-[9px]'} opacity-60 uppercase tracking-wider`}>{canal.nome}</div>
        </div>
      </div>

      <div className={`${fullscreen ? 'text-2xl lg:text-3xl' : 'text-xl'} font-black tabular-nums leading-none ${fullscreen ? 'mt-1' : 'mt-2'}`}>
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

  // Usa LÍQUIDO por vendedor (invoice_value já tem credev subtraído)
  const liqSeller = (s) => Number(s.invoice_value || 0);

  // Indexa por seller_code combinando dia+semana (usando LÍQUIDO)
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

  const medalhas = ['🥇', '🥈', '🥉'];

  return (
    <div
      className={`rounded-3xl overflow-hidden transition-all duration-500 ${
        fullscreen ? 'h-full flex flex-col min-h-0' : ''
      } ${
        fullscreen
          ? `bg-slate-900/80 backdrop-blur-xl border ${isLiderSemana ? 'border-amber-400/50' : 'border-white/10'} ${isLiderSemana ? 'shadow-2xl shadow-amber-500/20' : 'shadow-xl'}`
          : `bg-white border ${isLiderSemana ? canal.border + ' border-2' : 'border-gray-200'} shadow-md ${isLiderSemana ? canal.shadow + ' shadow-xl' : ''}`
      }`}
    >
      {/* Header colorido */}
      <div
        className={`relative ${fullscreen ? 'px-3 py-2 flex-shrink-0' : 'px-4 py-3'} bg-gradient-to-r ${canal.gradient} text-white overflow-hidden`}
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
            <div className={`inline-flex items-center gap-1 ${fullscreen ? 'px-2 py-0.5' : 'px-2 py-0.5'} rounded-full bg-amber-400 text-amber-900 ${fullscreen ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-widest shadow-lg animate-pulse`}>
              <Crown size={fullscreen ? 10 : 10} weight="fill" /> Campeão
            </div>
          )}
        </div>
      </div>

      {/* Tabela vendedores */}
      <div className={`${fullscreen ? 'bg-slate-900/50 flex-1 flex flex-col min-h-0' : 'bg-white'}`}>
        <div className={`grid grid-cols-12 ${fullscreen ? 'px-3 py-1 flex-shrink-0' : 'px-4 py-2'} text-[9px] font-black uppercase tracking-widest ${fullscreen ? 'text-slate-400 bg-slate-900/40 border-b border-white/5' : 'text-gray-500 bg-gray-50 border-b border-gray-200'}`}>
          <div className="col-span-7">Vendedor</div>
          <div className="col-span-2 text-right">Dia</div>
          <div className="col-span-3 text-right">Semana</div>
        </div>

        <div className={fullscreen ? 'flex-1 overflow-y-auto min-h-0' : ''}>
        {loading && sellers.length === 0 ? (
          [1, 2, 3].map((i) => (
            <div key={i} className={`grid grid-cols-12 ${fullscreen ? 'px-3 py-1.5' : 'px-4 py-2.5'} ${fullscreen ? 'border-b border-white/5' : 'border-b border-gray-100'}`}>
              <div className="col-span-7">
                <div className={`h-3 ${fullscreen ? 'bg-slate-700' : 'bg-gray-200'} rounded animate-pulse w-3/4`} />
              </div>
              <div className="col-span-2 text-right">
                <div className={`h-3 ${fullscreen ? 'bg-slate-700' : 'bg-gray-200'} rounded animate-pulse ml-auto w-2/3`} />
              </div>
              <div className="col-span-3 text-right">
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
                className={`grid grid-cols-12 items-center ${fullscreen ? 'px-3 py-1' : 'px-4 py-2.5'} ${
                  fullscreen ? 'border-b border-white/5' : 'border-b border-gray-100'
                } ${top3 && idx === 0 ? (fullscreen ? 'bg-amber-500/5' : canal.bgSoft) : ''} transition-colors`}
              >
                {/* Vendedor */}
                <div className="col-span-7 flex items-center gap-2">
                  {top3 ? (
                    <span className={`${fullscreen ? 'text-base' : 'text-lg'} leading-none`}>{medalhas[idx]}</span>
                  ) : (
                    <span className={`${fullscreen ? 'w-5 text-[10px]' : 'w-5 text-xs'} text-center font-bold ${fullscreen ? 'text-slate-500' : 'text-gray-400'}`}>
                      #{idx + 1}
                    </span>
                  )}
                  <span className={`${fullscreen ? 'text-xs' : 'text-sm'} font-bold uppercase tracking-wide ${fullscreen ? 'text-white' : 'text-gray-800'} truncate`}>
                    {s.seller_name}
                  </span>
                </div>

                {/* Dia */}
                <div className={`col-span-2 text-right tabular-nums ${fullscreen ? 'text-[11px]' : 'text-xs'} font-semibold ${
                  s.dia > 0
                    ? fullscreen ? 'text-emerald-300' : canal.text
                    : fullscreen ? 'text-slate-700' : 'text-gray-300'
                }`}>
                  {s.dia > 0 ? fmtBRLcompacto(s.dia) : '—'}
                </div>

                {/* Semana */}
                <div className={`col-span-3 text-right tabular-nums ${fullscreen ? 'text-xs' : 'text-sm'} font-black ${fullscreen ? 'text-white' : 'text-gray-900'}`}>
                  {s.semana > 0 ? fmtBRLcompacto(s.semana) : <span className={fullscreen ? 'text-slate-700' : 'text-gray-300'}>—</span>}
                </div>
              </div>
            );
          })
        )}
        </div>

        {/* Total final */}
        {sellers.length > 0 && (
          <div
            className={`grid grid-cols-12 items-center ${fullscreen ? 'px-3 py-1.5 flex-shrink-0' : 'px-4 py-3'} border-t-2 ${
              fullscreen ? 'border-white/10 bg-slate-900/80' : `${canal.border} ${canal.bgSoft}`
            }`}
          >
            <div className={`col-span-7 ${fullscreen ? 'text-xs text-white' : 'text-base text-gray-900'} font-black tracking-wide uppercase`}>
              Total
            </div>
            <div className={`col-span-2 text-right tabular-nums ${fullscreen ? 'text-xs text-emerald-300' : 'text-sm ' + canal.text} font-black`}>
              {fmtBRL(dadosDia?.invoice_value ?? 0)}
            </div>
            <div className={`col-span-3 text-right tabular-nums ${fullscreen ? 'text-sm text-white' : 'text-base text-gray-900'} font-black`}>
              {fmtBRL(dadosSemana?.invoice_value ?? 0)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
