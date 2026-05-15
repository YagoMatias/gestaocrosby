// Visualização da competição em formato "ring de luta"
// Renderiza as lojas como lutadoras com barra de progresso, coroa pro líder
// e animação sutil.
import React from 'react';
import { Trophy, Crown, HandFist, Fire } from 'phosphor-react';

function formatBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function formatBRLCompact(v) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`;
  return `R$ ${formatBRL(n)}`;
}

// Cores cíclicas para os "boxeadores" (cantos)
const CORNER_COLORS = [
  { from: '#dc2626', via: '#ef4444', to: '#fca5a5', label: 'red' },     // canto vermelho
  { from: '#2563eb', via: '#3b82f6', to: '#93c5fd', label: 'blue' },    // canto azul
  { from: '#16a34a', via: '#22c55e', to: '#86efac', label: 'green' },
  { from: '#ca8a04', via: '#eab308', to: '#fde047', label: 'yellow' },
  { from: '#9333ea', via: '#a855f7', to: '#d8b4fe', label: 'purple' },
  { from: '#0891b2', via: '#06b6d4', to: '#67e8f9', label: 'cyan' },
  { from: '#db2777', via: '#ec4899', to: '#f9a8d4', label: 'pink' },
  { from: '#ea580c', via: '#f97316', to: '#fed7aa', label: 'orange' },
];

export default function CompeticaoRing({ competicao, ranking }) {
  if (!ranking || ranking.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
        Aguardando dados da competição...
      </div>
    );
  }

  const maxValor = Math.max(...ranking.map((r) => r.invoice_value || 0), 1);
  const totalCombinado = ranking.reduce(
    (s, r) => s + Number(r.invoice_value || 0),
    0,
  );
  const lider = ranking[0];
  const segundo = ranking[1];
  const lideranca =
    lider && segundo
      ? Number(lider.invoice_value || 0) - Number(segundo.invoice_value || 0)
      : 0;

  // Calcula progresso temporal da competição (0-100%)
  const hoje = new Date();
  const dataInicio = new Date(competicao.data_inicio);
  const dataFim = new Date(competicao.data_fim);
  const totalDias = Math.max(
    1,
    Math.ceil((dataFim - dataInicio) / 86400000) + 1,
  );
  const decorrido = Math.max(
    0,
    Math.min(
      totalDias,
      Math.ceil((hoje - dataInicio) / 86400000) + 1,
    ),
  );
  const progressoTempo = Math.round((decorrido / totalDias) * 100);
  const restante = Math.max(0, totalDias - decorrido);

  const encerrada = competicao.status === 'encerrada';

  return (
    <div className="relative bg-gradient-to-br from-amber-950 via-red-950 to-amber-950 rounded-xl overflow-hidden shadow-2xl border-4 border-amber-700/60">
      {/* Lonas/textura de fundo */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent 0 10px, rgba(255,255,255,0.05) 10px 11px)',
        }}
      />
      {/* Lâmpada/glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative px-5 py-4 border-b-2 border-amber-700/40 bg-black/30 backdrop-blur-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HandFist
                size={22}
                weight="duotone"
                className="text-yellow-300"
              />
              <h3 className="text-lg font-bold text-yellow-100 tracking-wide">
                {competicao.nome}
              </h3>
              {encerrada && (
                <span className="text-[10px] uppercase tracking-wider bg-gray-500/30 text-gray-200 px-2 py-0.5 rounded-full border border-gray-400/30">
                  Encerrada
                </span>
              )}
              {competicao.status === 'cancelada' && (
                <span className="text-[10px] uppercase tracking-wider bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-full">
                  Cancelada
                </span>
              )}
            </div>
            {competicao.descricao && (
              <p className="text-xs text-amber-200/80">
                {competicao.descricao}
              </p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-amber-200/70 mt-1 flex-wrap">
              <span>
                📅 {competicao.data_inicio} → {competicao.data_fim}
              </span>
              <span className="opacity-50">•</span>
              <span>{ranking.length} lutadoras</span>
              {competicao.premiacao && (
                <>
                  <span className="opacity-50">•</span>
                  <span className="text-yellow-200">
                    🏆 {competicao.premiacao}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1">
              Pote Total
            </div>
            <div className="text-2xl font-bold text-yellow-100 tabular-nums">
              {formatBRLCompact(totalCombinado)}
            </div>
          </div>
        </div>

        {/* Barra de tempo decorrido (round atual) */}
        {!encerrada && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-amber-200/80 mb-1">
              <span>
                ⏱ Round em andamento — {decorrido} de {totalDias} dias
              </span>
              <span>{progressoTempo}% • restam {restante} {restante === 1 ? 'dia' : 'dias'}</span>
            </div>
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 transition-all duration-500"
                style={{ width: `${progressoTempo}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* RING */}
      <div className="relative px-6 py-6">
        {/* Cordas (3 linhas horizontais) */}
        <div className="absolute inset-x-6 top-12 h-1 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700 rounded opacity-60" />
        <div className="absolute inset-x-6 top-1/2 h-1 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700 rounded opacity-60" />
        <div className="absolute inset-x-6 bottom-12 h-1 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700 rounded opacity-60" />
        {/* Postes dos cantos */}
        <div className="absolute top-8 left-4 w-2 h-[calc(100%-4rem)] bg-gradient-to-b from-amber-600 to-amber-900 rounded shadow-lg" />
        <div className="absolute top-8 right-4 w-2 h-[calc(100%-4rem)] bg-gradient-to-b from-amber-600 to-amber-900 rounded shadow-lg" />

        {/* Lutadoras */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ranking.map((row, idx) => {
            const cor = CORNER_COLORS[idx % CORNER_COLORS.length];
            const pctMax = maxValor > 0 ? (row.invoice_value / maxValor) * 100 : 0;
            const isLider = idx === 0;
            const isVencedor =
              encerrada && competicao.vencedor_branch === row.branch_code;
            // Extrai cidade/nome curto removendo "CROSBY" e "SHOPPING"
            const cidadeShort = String(row.branch_name || '')
              .replace(/^CROSBY\s+/i, '')
              .replace(/^SHOPPING\s+/i, '')
              .trim();
            const initial = cidadeShort
              ? cidadeShort.charAt(0).toUpperCase()
              : String(row.branch_code).charAt(0);
            return (
              <div
                key={row.branch_code}
                className={`relative rounded-xl overflow-hidden transition-all ${
                  isLider && !encerrada
                    ? 'shadow-2xl scale-105 ring-2 ring-yellow-400 animate-pulse-slow'
                    : 'shadow-lg'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${cor.from} 0%, ${cor.via} 60%, ${cor.to} 100%)`,
                }}
              >
                {/* Posição no canto superior */}
                <div className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white font-bold text-sm">
                  {idx + 1}
                </div>
                {(isLider || isVencedor) && (
                  <div className="absolute top-2 right-2 z-10">
                    {isVencedor ? (
                      <Trophy size={28} weight="fill" className="text-yellow-300 drop-shadow-lg" />
                    ) : (
                      <Crown size={28} weight="fill" className="text-yellow-300 drop-shadow-lg" />
                    )}
                  </div>
                )}

                <div className="px-4 pt-12 pb-4 text-white">
                  {/* Avatar inicial gigante */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur flex items-center justify-center text-2xl font-bold shadow-inner border-2 border-white/40">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs opacity-80 uppercase tracking-wider truncate">
                        Filial #{row.branch_code}
                      </div>
                      <div className="font-bold text-sm truncate" title={row.branch_name}>
                        {cidadeShort || row.branch_name || `Loja ${row.branch_code}`}
                      </div>
                    </div>
                  </div>

                  {/* Faturamento */}
                  <div className="mb-2">
                    <div className="text-[10px] uppercase tracking-wider opacity-80">
                      Faturamento
                    </div>
                    <div className="text-2xl font-bold tabular-nums drop-shadow">
                      R$ {formatBRL(row.invoice_value)}
                    </div>
                  </div>

                  {/* Barra de "vida"/golpes */}
                  <div className="h-3 bg-black/40 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-300 to-orange-200 shadow-glow transition-all duration-700 relative"
                      style={{ width: `${Math.max(2, pctMax)}%` }}
                    >
                      {isLider && !encerrada && (
                        <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 animate-pulse" />
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] opacity-80 mt-1 flex justify-between">
                    <span>{pctMax.toFixed(1)}% do líder</span>
                    <span className="font-semibold">
                      {row.invoice_qty || 0} NFs
                    </span>
                  </div>

                  {/* Distância pra próximo (se não for o líder) */}
                  {idx > 0 && (
                    <div className="text-[10px] mt-2 pt-2 border-t border-white/20 text-yellow-100">
                      ⬆ a {formatBRLCompact(
                        Number(ranking[idx - 1].invoice_value || 0) -
                          Number(row.invoice_value || 0),
                      )}{' '}
                      do {idx}º
                    </div>
                  )}
                </div>

                {/* "Fogo" no líder */}
                {isLider && !encerrada && (
                  <div className="absolute -bottom-1 right-2 text-2xl animate-bounce">
                    🔥
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: vantagem do líder */}
        {ranking.length >= 2 && !encerrada && (
          <div className="mt-5 text-center text-xs text-amber-200/70">
            <Fire
              size={12}
              weight="fill"
              className="inline text-orange-400 mr-1"
            />
            Vantagem do líder: <b className="text-yellow-100">{formatBRLCompact(lideranca)}</b>{' '}
            sobre o 2º lugar
          </div>
        )}
        {encerrada && competicao.vencedor_branch && (
          <div className="mt-5 text-center">
            <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/40 px-4 py-2 rounded-full text-yellow-100">
              <Trophy size={18} weight="fill" />
              <b>VENCEDORA:</b>{' '}
              {ranking[0]?.branch_name || `Filial ${competicao.vencedor_branch}`}
              {' '}— R$ {formatBRL(competicao.vencedor_valor)}
            </div>
          </div>
        )}
      </div>

      {/* CSS extra inline */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1.05); }
          50% { opacity: 0.95; transform: scale(1.07); }
        }
        .animate-pulse-slow { animation: pulse-slow 2.5s ease-in-out infinite; }
        .shadow-glow { box-shadow: 0 0 12px rgba(252, 211, 77, 0.6); }
      `}</style>
    </div>
  );
}
