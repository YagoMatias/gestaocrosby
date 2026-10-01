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
  SHOWROOM: 'Showroom',
  REVENDA: 'Revenda',
  MULTIMARCAS: 'Multimarcas',
  BAZAR: 'Bazar',
  FRANQUIAS: 'Franquias',
  RICARDO_ELETRO: 'Ricardo Eletro',
  NOVIDADES: 'Novidades',
};

const MTM_KEYS = ['MTM_RAFAEL', 'MTM_DAVID', 'MTM_ARTHUR'];
// Canais que NÃO viram card próprio: TOTAL_GERAL (resumo) e BLUECRED (somado no Varejo).
const CANAIS_OCULTOS = new Set(['TOTAL_GERAL', 'BLUECRED', ...MTM_KEYS, 'VAREJO']);
const MTM_NOMES = { MTM_RAFAEL: 'Rafael', MTM_DAVID: 'David', MTM_ARTHUR: 'Arthur' };
// Nomes amigáveis das lojas varejo (alinha com o backend VAREJO_BRANCH_NAMES)
const VAREJO_LOJAS = {
  2: 'João Pessoa', 5: 'Nova Cruz', 55: 'Parnamirim', 65: 'Canguaretama',
  87: 'Cidade Jardim', 88: 'Guararapes', 90: 'Ayrton Senna', 93: 'Imperatriz',
  94: 'Patos', 95: 'Midway', 97: 'Teresina', 98: 'Shopping Recife',
};
// Rótulo do detalhe por canal (loja/vendedor)
const DETALHE_LABEL = {
  VAREJO: 'por loja',
  REVENDA: 'por vendedor',
  MULTIMARCAS: 'por vendedor',
  FRANQUIAS: 'por vendedor',
};

// Monta a lista de canais do painel a partir do retorno do backend:
//  • VAREJO soma o BLUECRED (crediário é venda de loja)
//  • MULTIMARCAS = soma dos 3 MTM (detalhe = os 3 vendedores)
//  • demais canais (Showroom, Revenda, Bazar, Franquias, Ricardo, Novidades) passam direto
//  • ordena por total desc. O total do painel = soma de tudo = faturamento cheio.
function montarPrincipais(canais) {
  const porCanal = Object.fromEntries((canais || []).map((c) => [c.canal, c]));
  const campos = ['s1', 's2', 's3', 's4', 's5', 'total_mes'];
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  // VAREJO + BLUECRED
  const varejo = porCanal.VAREJO || {};
  const bluecred = porCanal.BLUECRED || {};
  const varejoComBc = campos.reduce((acc, f) => {
    acc[f] = r2(Number(varejo[f] || 0) + Number(bluecred[f] || 0));
    return acc;
  }, {});
  const lojas = (Array.isArray(varejo.detalhe) ? varejo.detalhe : [])
    .map((it) => (it.branch_code ? { ...it, nome: VAREJO_LOJAS[it.branch_code] || it.nome } : it));

  // MULTIMARCAS = soma dos 3 MTM
  const somaMtm = campos.reduce((acc, f) => {
    acc[f] = r2(MTM_KEYS.reduce((s, k) => s + Number(porCanal[k]?.[f] || 0), 0));
    return acc;
  }, {});
  const detalheMtm = MTM_KEYS.map((k) => ({ nome: MTM_NOMES[k], valor: r2(porCanal[k]?.total_mes || 0) }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const lista = [
    { canal: 'VAREJO', ...varejoComBc, detalhe: lojas },
    { canal: 'MULTIMARCAS', ...somaMtm, detalhe: detalheMtm },
  ];
  for (const c of canais || []) {
    if (CANAIS_OCULTOS.has(c.canal)) continue; // oculta TOTAL_GERAL, BLUECRED, MTM_*, VAREJO
    lista.push({
      canal: c.canal,
      s1: r2(c.s1),
      s2: r2(c.s2),
      s3: r2(c.s3),
      s4: r2(c.s4),
      s5: r2(c.s5),
      total_mes: r2(c.total_mes),
      detalhe: Array.isArray(c.detalhe) ? c.detalhe : [],
    });
  }
  return lista.filter((c) => c.total_mes > 0).sort((a, b) => b.total_mes - a.total_mes);
}

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
const _c = (canal, s1, s2, s3, s4, s5, detalhe = []) => ({
  canal, s1, s2, s3, s4, s5, total_mes: s1 + s2 + s3 + s4 + s5, detalhe,
});
const DEMO_CANAIS = [
  _c('VAREJO', 78000, 82000, 91000, 88000, 30000, [
    { nome: 'Midway', valor: 92000 },
    { nome: 'Ayrton Senna', valor: 81000 },
    { nome: 'Guararapes', valor: 74000 },
    { nome: 'Shopping Recife', valor: 58000 },
    { nome: 'Cidade Jardim', valor: 44000 },
    { nome: 'Parnamirim', valor: 20000 },
  ]),
  _c('FRANQUIAS', 41000, 39000, 44000, 47000, 15000, [
    { nome: 'Equipe Franquias', valor: 186000 },
  ]),
  _c('REVENDA', 22000, 25000, 21000, 28000, 9000, [
    { nome: 'Carlos (B2R)', valor: 52000 },
    { nome: 'Marina (B2R)', valor: 33000 },
    { nome: 'João (B2R)', valor: 20000 },
  ]),
  _c('MTM_RAFAEL', 8000, 9500, 7800, 10200, 3100),
  _c('MTM_DAVID', 7200, 6800, 8100, 7600, 2400),
  _c('MTM_ARTHUR', 5100, 4800, 5600, 6100, 1900),
  _c('SHOWROOM', 52000, 48000, 55000, 50000, 16000),
  _c('BLUECRED', 12000, 13000, 14000, 11000, 5500),
  _c('BAZAR', 7000, 6000, 8000, 6500, 3200),
  _c('NOVIDADES', 3200, 2800, 3600, 3100, 1200),
  _c('RICARDO_ELETRO', 700, 600, 800, 400, 190),
];
// Demo com pequena variação a cada chamada, pra dar pra ver os efeitos de
// "mudança" (valores piscando/brilhando) sem depender do backend.
function demoDados() {
  const jitter = (v) => Math.round(v * (0.95 + Math.random() * 0.1));
  const canais = DEMO_CANAIS.map((c) => {
    const s = {
      s1: jitter(c.s1),
      s2: jitter(c.s2),
      s3: jitter(c.s3),
      s4: jitter(c.s4),
      s5: jitter(c.s5),
    };
    return { ...c, ...s, total_mes: s.s1 + s.s2 + s.s3 + s.s4 + s.s5 };
  });
  return {
    mes: _mesDemo,
    fechado: false,
    atualizado_em: new Date().toISOString(),
    total_geral: {
      canal: 'TOTAL_GERAL',
      total_mes: canais.reduce((a, c) => a + c.total_mes, 0),
    },
    canais,
  };
}

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
      setDados(demoDados());
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
    const ms = params.get('demo') ? 4000 : REFRESH_MS;
    const id = setInterval(buscar, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar]);

  const canais = dados ? montarPrincipais(dados.canais) : [];
  // Herói = soma de TODOS os canais do painel = faturamento cheio do mês.
  const total = canais.reduce((s, c) => s + Number(c.total_mes || 0), 0);
  const maxCanal = canais.reduce((m, c) => Math.max(m, Number(c.total_mes || 0)), 0) || 1;
  const fechado = dados?.fechado;
  const canaisDetalhe = canais.filter((c) => (c.detalhe || []).length > 0);
  const temDetalhe = canaisDetalhe.length > 0;
  // colunas do grid conforme a quantidade de cards
  const colsPara = (n) => (vertical ? (n > 4 ? 2 : 1) : n <= 4 ? 2 : n <= 6 ? 3 : 4);

  // Visão rotativa: resumo (4 canais) ⇄ detalhe (varejo por loja, resto por vendedor)
  const [modo, setModo] = useState('resumo');
  const RESUMO_MS = (Number(params.get('resumoSeg')) || (params.get('demo') ? 8 : 90)) * 1000;
  const DETALHE_MS = (Number(params.get('detSeg')) || (params.get('demo') ? 8 : 25)) * 1000;
  useEffect(() => {
    if (!temDetalhe) {
      setModo('resumo');
      return;
    }
    const dur = modo === 'resumo' ? RESUMO_MS : DETALHE_MS;
    const id = setTimeout(
      () => setModo((m) => (m === 'resumo' ? 'detalhe' : 'resumo')),
      dur,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, temDetalhe, RESUMO_MS, DETALHE_MS]);

  return (
    <div
      className="h-screen w-full text-white flex flex-col overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 800px at 50% -10%, #0a1a5a 0%, #000638 45%, #00021f 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <style>{`
        @keyframes flashVal {
          0% { transform: scale(1); }
          18% { transform: scale(1.07); color: #ffe4a3; text-shadow: 0 0 26px rgba(255,210,120,.85); }
          100% { transform: scale(1); }
        }
        @keyframes livePulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: .35; transform: scale(.8); }
        }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        @keyframes cardGlow {
          0% { box-shadow: 0 0 0 rgba(79,123,255,0); border-color: rgba(255,255,255,.10); }
          25% { box-shadow: 0 0 32px rgba(79,123,255,.45); border-color: rgba(130,170,255,.7); }
          100% { box-shadow: 0 0 0 rgba(79,123,255,0); border-color: rgba(255,255,255,.10); }
        }
        .flash-val { animation: flashVal .9s ease; }
        .card-glow { animation: cardGlow 1.1s ease; }
        @keyframes viewIn {
          from { opacity: 0; transform: translateY(2.5vh) scale(.99); }
          to { opacity: 1; transform: none; }
        }
        .view-in { animation: viewIn .55s ease; }
      `}</style>

      {/* Cabeçalho */}
      <header
        className={`flex px-[3vw] pt-[3vh] pb-[1.5vh] ${
          vertical
            ? 'flex-col items-center gap-[1.4vh] text-center'
            : 'items-center justify-between'
        }`}
      >
        {/* Marca + título */}
        <div className={`flex items-center ${vertical ? 'flex-col gap-[1vh]' : 'gap-[1.5vw]'}`}>
          <img
            src="/crosby-branca.png"
            alt="Crosby"
            className="w-auto object-contain"
            style={{ height: vertical ? '4vh' : '4.2vh' }}
            onError={(e) => {
              e.currentTarget.outerHTML =
                '<span style="font-weight:900;letter-spacing:.15em;color:rgba(255,255,255,.95);font-size:' +
                (vertical ? '4.5vw' : '2.2vw') +
                '">CROSBY</span>';
            }}
          />
          {!vertical && (
            <div
              className="w-[2px] self-stretch bg-white/20 mx-[0.5vw]"
              style={{ minHeight: '5vh' }}
            />
          )}
          <div className={vertical ? 'text-center' : ''}>
            <div
              className="font-black tracking-tight leading-none"
              style={{ fontSize: vertical ? '4vw' : '2.6vw' }}
            >
              FECHAMENTO DO MÊS
            </div>
            <div
              className="text-blue-200/80 font-semibold leading-none mt-[0.6vh]"
              style={{ fontSize: vertical ? '2.8vw' : '1.4vw' }}
            >
              {nomeMes(dados?.mes || mesParam)}
            </div>
          </div>
        </div>

        {/* Relógio + status */}
        <div
          className={
            vertical
              ? 'flex items-center justify-center gap-[3vw] flex-wrap'
              : 'text-right'
          }
        >
          <div className={`flex items-center gap-[0.5vw] ${vertical ? 'justify-center' : 'justify-end'}`}>
            {(() => {
              const [rh = '--', rm = '--', rs = '--'] = (relogio || '').split(':');
              const cellFs = vertical ? '3.4vw' : '2.2vw';
              const sepFs = vertical ? '2.6vw' : '1.7vw';
              const Cell = ({ children }) => (
                <span
                  className="font-mono font-black tabular-nums rounded-[0.6vw]"
                  style={{
                    fontSize: cellFs,
                    padding: vertical ? '0.7vh 1.4vw' : '0.6vh 0.9vw',
                    background: 'rgba(255,255,255,0.10)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                    color: '#eef3ff',
                    lineHeight: 1,
                  }}
                >
                  {children}
                </span>
              );
              const Sep = () => (
                <span
                  className="font-black text-blue-200/80"
                  style={{ fontSize: sepFs, animation: 'blink 1.2s ease-in-out infinite', lineHeight: 1 }}
                >
                  :
                </span>
              );
              return (
                <>
                  <Cell>{rh}</Cell>
                  <Sep />
                  <Cell>{rm}</Cell>
                  <Sep />
                  <Cell>{rs}</Cell>
                </>
              );
            })()}
          </div>
          <div
            className={`text-blue-200/70 flex items-center gap-[0.5vw] ${
              vertical ? 'justify-center' : 'justify-end mt-[0.6vh]'
            }`}
            style={{ fontSize: vertical ? '2vw' : '1vw' }}
          >
            <span
              className="inline-block rounded-full bg-green-400"
              style={{
                width: vertical ? '1.1vw' : '0.6vw',
                height: vertical ? '1.1vw' : '0.6vw',
                animation: 'livePulse 1.4s ease-in-out infinite',
              }}
            />
            <span key={dados?.atualizado_em || 'x'} className="flash-val">
              atualizado {fmtHora(dados?.atualizado_em)}
            </span>
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
            key={total}
            className="font-black tabular-nums leading-none mt-[1vh] flash-val"
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
      {!erro && dados && !dados?.canais?.length && (
        <div className="flex-1 flex items-center justify-center text-blue-200/70 text-center px-[4vw]" style={{ fontSize: vertical ? '2.4vw' : '1.5vw' }}>
          Ainda sem dados para {nomeMes(dados?.mes)}. Assim que a primeira sincronização rodar, os canais aparecem aqui.
        </div>
      )}

      {/* Canais — alterna entre resumo e detalhe (rotação animada) */}
      {dados?.canais?.length > 0 && (
        <section className="flex-1 px-[3vw] pb-[3vh] min-h-0">
          <div key={modo} className="view-in h-full">
            <div
              className="grid gap-[1.4vw] h-full"
              style={{
                gridAutoRows: '1fr',
                gridTemplateColumns: `repeat(${colsPara(
                  modo === 'resumo' ? canais.length : canaisDetalhe.length,
                )}, minmax(0, 1fr))`,
              }}
            >
              {modo === 'resumo'
                ? canais.map((c) => {
                    const val = Number(c.total_mes || 0);
                    const pct = Math.max(2, Math.round((val / maxCanal) * 100));
                    const label = CANAL_LABELS[c.canal] || c.canal;
                    return (
                      <div
                        key={c.canal}
                        className="relative rounded-[1vw] px-[2vw] py-[2vh] flex flex-col justify-center"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                      >
                        <div
                          key={`glow-${val}`}
                          className="card-glow absolute inset-0 rounded-[1vw] pointer-events-none"
                        />
                        <div>
                          <div className="font-bold text-blue-100/90 truncate" style={{ fontSize: vertical ? '2.4vw' : '1.35vw' }}>
                            {label}
                          </div>
                          <div
                            key={val}
                            className="font-black tabular-nums flash-val leading-none mt-[0.4vh]"
                            style={{ fontSize: vertical ? '3.2vw' : '2.1vw' }}
                          >
                            {fmtBRLCompact(val)}
                          </div>
                        </div>
                        <div className="mt-[1.4vh] h-[1.4vh] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, #4f7bff, #fe0000)',
                              transition: 'width .8s ease',
                            }}
                          />
                        </div>
                        <div
                          className="mt-[1.4vh] flex flex-wrap gap-x-[1.6vw] gap-y-[0.4vh] text-blue-200/70 tabular-nums"
                          style={{ fontSize: vertical ? '1.5vw' : '1vw' }}
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
                  })
                : canaisDetalhe.map((c) => {
                    const label = CANAL_LABELS[c.canal] || c.canal;
                    const lista = c.detalhe || [];
                    const maxItem = lista.reduce((m, i) => Math.max(m, Number(i.valor || 0)), 0) || 1;
                    const topN = vertical ? 5 : 6;
                    const itens = lista.slice(0, topN);
                    const extra = lista.length - itens.length;
                    return (
                      <div
                        key={c.canal}
                        className="rounded-[1vw] px-[2vw] py-[1.6vh] flex flex-col overflow-hidden"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-bold text-blue-50" style={{ fontSize: vertical ? '2.6vw' : '1.7vw' }}>
                            {label}{' '}
                            <span className="text-blue-300/60 font-semibold" style={{ fontSize: vertical ? '1.6vw' : '1vw' }}>
                              {DETALHE_LABEL[c.canal] || ''}
                            </span>
                          </span>
                          <span className="font-black tabular-nums text-blue-100" style={{ fontSize: vertical ? '2.4vw' : '1.6vw' }}>
                            {fmtBRLCompact(c.total_mes)}
                          </span>
                        </div>
                        <div className="mt-[1vh] flex flex-col gap-[0.7vh] flex-1 justify-center">
                          {itens.length === 0 && (
                            <span className="text-blue-200/50" style={{ fontSize: vertical ? '1.8vw' : '1.1vw' }}>
                              sem detalhe disponível
                            </span>
                          )}
                          {itens.map((it, idx) => {
                            const v = Number(it.valor || 0);
                            const pct = Math.max(3, Math.round((v / maxItem) * 100));
                            return (
                              <div key={idx} className="flex flex-col gap-[0.3vh]">
                                <div className="flex items-baseline justify-between gap-[1vw]">
                                  <span className="truncate text-blue-50/90" style={{ fontSize: vertical ? '1.9vw' : '1.2vw' }}>
                                    {it.nome}
                                  </span>
                                  <span className="font-bold tabular-nums whitespace-nowrap" style={{ fontSize: vertical ? '1.9vw' : '1.2vw' }}>
                                    {fmtBRLCompact(v)}
                                  </span>
                                </div>
                                <div className="h-[0.6vh] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4f7bff, #fe0000)' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {extra > 0 && (
                            <span className="text-blue-300/50" style={{ fontSize: vertical ? '1.5vw' : '0.95vw' }}>
                              +{extra} {c.canal === 'VAREJO' ? 'lojas' : 'vendedores'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
