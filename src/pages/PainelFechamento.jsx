// Painel de FECHAMENTO DE MÊS — tela cheia para TVs (horizontal e vertical).
// Pública (mesmo padrão do /apresentacao/forecast). Lê sales_closing_records
// via GET /api/totvs/sale-panel/closing e faz auto-refresh.
//
// Orientação: detecta automaticamente pela proporção da tela; pode forçar com
//   ?orientacao=vertical  |  ?orientacao=horizontal   (ou ?v=1)
// Mês: usa o corrente (fuso de Natal, no backend); pode forçar com ?mes=YYYY-MM.
import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';
const REFRESH_MS = 60_000; // 1 min (fonte tem cache ~30min; isso mantém a TV viva)

const CANAL_LABELS = {
  VAREJO: 'Varejo',
  FRANQUIAS: 'Franquias',
  REVENDA: 'Revenda',
  MTM_RAFAEL: 'MTM Rafael',
  MTM_DAVID: 'MTM David',
  MTM_ARTHUR: 'MTM Arthur',
  NOVIDADES: 'Novidades',
  SHOWROOM: 'Showroom',
  BAZAR: 'Bazar',
  RICARDO_ELETRO: 'Ricardo Eletro',
  BLUECRED: 'BlueCred',
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtBRLCompact(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(2).replace('.', ',') + 'M';
  if (v >= 1_000) return 'R$ ' + (v / 1_000).toFixed(1).replace('.', ',') + 'k';
  return 'R$ ' + fmtBRL(v);
}
function nomeMes(mes) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return '';
  const [y, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} / ${y}`;
}
function fmtHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Fortaleza',
    });
  } catch {
    return '—';
  }
}

const _hoje = new Date();
const _mesDemo = `${_hoje.getFullYear()}-${String(_hoje.getMonth() + 1).padStart(2, '0')}`;
const _c = (canal, s1, s2, s3, s4, s5) => ({
  canal, s1, s2, s3, s4, s5, total_mes: s1 + s2 + s3 + s4 + s5,
});
const DEMO_CANAIS = [
  _c('VAREJO', 78000, 82000, 91000, 88000, 30000),
  _c('FRANQUIAS', 41000, 39000, 44000, 47000, 15000),
  _c('REVENDA', 22000, 25000, 21000, 28000, 9000),
  _c('MTM_RAFAEL', 8000, 9500, 7800, 10200, 3100),
  _c('MTM_DAVID', 7200, 6800, 8100, 7600, 2400),
  _c('MTM_ARTHUR', 5100, 4800, 5600, 6100, 1900),
  _c('NOVIDADES', 3200, 2800, 3600, 3100, 1200),
  _c('SHOWROOM', 2100, 1900, 2400, 2200, 800),
  _c('BAZAR', 1500, 1200, 1800, 1600, 600),
];
const DEMO_DADOS = {
  mes: _mesDemo,
  fechado: false,
  atualizado_em: new Date().toISOString(),
  total_geral: {
    canal: 'TOTAL_GERAL',
    total_mes: DEMO_CANAIS.reduce((a, c) => a + c.total_mes, 0),
  },
  canais: DEMO_CANAIS,
};

export default function PainelFechamento() {
  const params = new URLSearchParams(window.location.search);
  const mesParam = params.get('mes') || '';
  const orientParam = (params.get('orientacao') || (params.get('v') ? 'vertical' : '')).toLowerCase();

  const [vertical, setVertical] = useState(() => {
    if (orientParam === 'vertical') return true;
    if (orientParam === 'horizontal') return false;
    return window.innerHeight > window.innerWidth;
  });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [relogio, setRelogio] = useState('');

  // Orientação automática (se não foi forçada por querystring)
  useEffect(() => {
    if (orientParam) return;
    const onResize = () => setVertical(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [orientParam]);

  // Relógio ao vivo
  useEffect(() => {
    const tick = () =>
      setRelogio(
        new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Fortaleza',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const buscar = useCallback(async () => {
    // Modo demo: dados de exemplo para posicionar/testar a TV sem depender do backend.
    if (params.get('demo')) {
      setDados(DEMO_DADOS);
      setErro('');
      return;
    }
    try {
      const url = new URL('/api/totvs/sale-panel/closing', API_BASE_URL);
      if (mesParam) url.searchParams.set('mes', mesParam);
      const r = await fetch(url.toString(), {
        headers: API_KEY ? { 'x-api-key': API_KEY } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setDados(j?.data || j);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Falha ao carregar');
    }
  }, [mesParam]);

  useEffect(() => {
    buscar();
    const id = setInterval(buscar, REFRESH_MS);
    return () => clearInterval(id);
  }, [buscar]);

  const canais = dados?.canais || [];
  const total = Number(dados?.total_geral?.total_mes || 0);
  const maxCanal = canais.reduce((m, c) => Math.max(m, Number(c.total_mes || 0)), 0) || 1;
  const fechado = dados?.fechado;

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col"
      style={{
        background:
          'radial-gradient(1200px 800px at 50% -10%, #0a1a5a 0%, #000638 45%, #00021f 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Cabeçalho */}
      <header className="flex items-center justify-between px-[3vw] pt-[3vh] pb-[1.5vh]">
        <div className="flex items-center gap-[1.5vw]">
          <span
            className="font-black tracking-[0.15em] text-white/95"
            style={{ fontSize: vertical ? '3.6vw' : '2.2vw' }}
          >
            CROSBY
          </span>
          <div
            className="w-[2px] self-stretch bg-white/20 mx-[0.5vw]"
            style={{ minHeight: '5vh' }}
          />
          <div>
            <div
              className="font-black tracking-tight leading-none"
              style={{ fontSize: vertical ? '3.2vw' : '2.6vw' }}
            >
              FECHAMENTO DO MÊS
            </div>
            <div
              className="text-blue-200/80 font-semibold leading-none mt-[0.6vh]"
              style={{ fontSize: vertical ? '2.6vw' : '1.4vw' }}
            >
              {nomeMes(dados?.mes || mesParam)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className="font-mono font-bold tabular-nums leading-none"
            style={{ fontSize: vertical ? '2.6vw' : '1.9vw' }}
          >
            {relogio}
          </div>
          <div
            className="text-blue-200/70 mt-[0.6vh]"
            style={{ fontSize: vertical ? '1.9vw' : '1vw' }}
          >
            atualizado {fmtHora(dados?.atualizado_em)}
          </div>
          {fechado && (
            <div
              className="inline-block mt-[0.8vh] px-[1.2vw] py-[0.3vh] rounded-full bg-red-600 font-black tracking-wide"
              style={{ fontSize: vertical ? '1.8vw' : '1vw' }}
            >
              MÊS FECHADO
            </div>
          )}
        </div>
      </header>

      {/* Total geral (herói) */}
      <section className="px-[3vw] py-[1.5vh]">
        <div
          className="rounded-[1.5vw] px-[3vw] py-[2.5vh] text-center"
          style={{
            background: 'linear-gradient(90deg, rgba(254,0,0,0.18), rgba(255,255,255,0.04))',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div
            className="text-blue-100/80 font-semibold uppercase tracking-[0.2em]"
            style={{ fontSize: vertical ? '2vw' : '1.1vw' }}
          >
            Faturamento total do mês
          </div>
          <div
            className="font-black tabular-nums leading-none mt-[1vh]"
            style={{
              fontSize: vertical ? '7.5vw' : '6.5vw',
              textShadow: '0 0 30px rgba(120,160,255,0.35)',
            }}
          >
            R$ {fmtBRL(total)}
          </div>
        </div>
      </section>

      {/* Erro / loading */}
      {erro && (
        <div className="px-[3vw]">
          <div className="rounded-lg bg-red-900/50 border border-red-500/40 px-[2vw] py-[1.5vh] text-center" style={{ fontSize: vertical ? '2vw' : '1.1vw' }}>
            Falha ao carregar dados ({erro}). Tentando de novo em 1 min…
          </div>
        </div>
      )}
      {!erro && !dados && (
        <div className="flex-1 flex items-center justify-center text-blue-200/70" style={{ fontSize: '2vw' }}>
          Carregando…
        </div>
      )}
      {!erro && dados && canais.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-blue-200/70 text-center px-[4vw]" style={{ fontSize: vertical ? '2.4vw' : '1.5vw' }}>
          Ainda sem dados para {nomeMes(dados?.mes)}. Assim que a primeira sincronização rodar, os canais aparecem aqui.
        </div>
      )}

      {/* Canais */}
      {canais.length > 0 && (
        <section className="flex-1 px-[3vw] pb-[3vh]">
          <div
            className="grid gap-[1.4vw] h-full content-start"
            style={{
              gridTemplateColumns: vertical
                ? 'repeat(2, minmax(0, 1fr))'
                : `repeat(${canais.length > 6 ? 3 : 2}, minmax(0, 1fr))`,
            }}
          >
            {canais.map((c) => {
              const val = Number(c.total_mes || 0);
              const pct = Math.max(2, Math.round((val / maxCanal) * 100));
              const label = CANAL_LABELS[c.canal] || c.canal;
              return (
                <div
                  key={c.canal}
                  className="rounded-[1vw] px-[1.8vw] py-[1.6vh]"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className="font-bold text-blue-50"
                      style={{ fontSize: vertical ? '2vw' : '1.5vw' }}
                    >
                      {label}
                    </span>
                    <span
                      className="font-black tabular-nums"
                      style={{ fontSize: vertical ? '2.2vw' : '1.7vw' }}
                    >
                      {fmtBRLCompact(val)}
                    </span>
                  </div>
                  {/* barra proporcional */}
                  <div className="mt-[1vh] h-[1.2vh] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #4f7bff, #fe0000)',
                      }}
                    />
                  </div>
                  {/* semanas */}
                  <div
                    className="mt-[1vh] flex flex-wrap gap-x-[1.4vw] gap-y-[0.4vh] text-blue-200/70 tabular-nums"
                    style={{ fontSize: vertical ? '1.15vw' : '0.85vw' }}
                  >
                    {['s1', 's2', 's3', 's4', 's5'].map((s, i) =>
                      Number(c[s]) ? (
                        <span key={s}>
                          <span className="text-blue-300/60">S{i + 1}</span> {fmtBRLCompact(c[s])}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
