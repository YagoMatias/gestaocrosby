// Forecast — menu abaixo do DRE (Niziany, 27/10/2026).
// DRE projetada de 2026 a partir da planilha base "FORECAST PESSIMISTA /
// Conservador": Realizado (jan–set) + Previsão (out–dez), mês a mês.
// Layout no padrão das demais páginas do HeadCoach (azul #000638, cabeçalho
// cinza, cards com borda). Os valores vêm de src/data/forecastBase.json; as
// visões e blocos extras seguem no JSON caso precise voltar.
import React, { useMemo } from 'react';
import { ChartLineUp } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import base from '../data/forecastBase.json';

const TIPO_ROTULO = { realizado: 'Realizado', forecast: 'Previsão' };

// Cabeçalho superior agrupado por tipo (Realizado / Previsão)
const TIPO_CABECALHO = {
  realizado: 'bg-[#000638] text-white',
  forecast: 'bg-blue-600 text-white',
};

// Realce suave da coluna de previsão no corpo da tabela
const TIPO_CELULA = {
  realizado: '',
  forecast: 'bg-blue-50/70',
};

const fmtMoeda = (v) =>
  v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const fmtInt = (v) =>
  v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v) =>
  v == null
    ? '–'
    : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
      '%';

function formatar(valor, fmtLinha) {
  if (fmtLinha === 'pct') return fmtPct(valor);
  if (fmtLinha === 'int') return fmtInt(valor);
  return fmtMoeda(valor);
}

// Agrupa colunas consecutivas do mesmo tipo para a linha de cabeçalho superior
function agruparColunas(colunas) {
  const grupos = [];
  for (const c of colunas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.tipo === c.tipo) ultimo.qtd += 1;
    else grupos.push({ tipo: c.tipo, qtd: 1 });
  }
  return grupos;
}

export default function Forecast() {
  // Só 2026 (jan–set Realizado, out–dez Previsão), visão mensal.
  const colunas = useMemo(
    () => base.colunas.filter((c) => c.grupo === 'mensal' && c.ano !== 2025),
    [],
  );
  const grupos = useMemo(() => agruparColunas(colunas), [colunas]);
  const linhas = base.blocos.dre || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <PageTitle
        title="Forecast"
        subtitle="DRE projetada de 2026 — Realizado (jan–set) e Previsão (out–dez)"
        icon={ChartLineUp}
        iconColor="text-[#000638]"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Barra de topo: cenário + legenda */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase text-gray-500">Cenário</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              {base.cenario}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#000638]" /> Realizado
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Previsão
            </span>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-auto max-h-[calc(100vh-250px)]">
          <table className="min-w-full text-[11px] border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-200 px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600 min-w-[240px]">
                  DRE Forecast
                </th>
                {grupos.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.qtd}
                    className={
                      'border-b border-l border-white/20 px-2 py-1.5 text-center text-[11px] font-bold uppercase ' +
                      TIPO_CABECALHO[g.tipo]
                    }
                  >
                    {TIPO_ROTULO[g.tipo]}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-200 px-3 py-1.5 text-left text-[10px] text-gray-400 font-normal">
                  em R$
                </th>
                {colunas.map((c) => (
                  <th
                    key={c.key}
                    className={
                      'border-b border-gray-200 px-2 py-1.5 text-right font-semibold text-gray-600 whitespace-nowrap bg-gray-100 ' +
                      TIPO_CELULA[c.tipo]
                    }
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const destaque = l.bold && l.nivel === 0;
                return (
                  <tr key={l.id} className={destaque ? 'bg-gray-50' : 'hover:bg-blue-50/40'}>
                    <td
                      className={
                        'sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-1.5 whitespace-nowrap ' +
                        (destaque
                          ? 'bg-gray-50 font-bold text-[#000638]'
                          : 'bg-white text-gray-700') +
                        (l.nivel === 1 ? ' pl-7 text-gray-500' : '')
                      }
                    >
                      {l.label}
                    </td>
                    {colunas.map((c) => {
                      const v = l.valores[c.key];
                      const negativo = typeof v === 'number' && v < 0;
                      return (
                        <td
                          key={c.key}
                          className={
                            'border-b border-gray-100 px-2 py-1.5 text-right tabular-nums whitespace-nowrap ' +
                            TIPO_CELULA[c.tipo] +
                            (destaque ? ' font-semibold' : '') +
                            (negativo
                              ? ' text-red-600'
                              : v == null
                                ? ' text-gray-300'
                                : ' text-gray-800')
                          }
                        >
                          {formatar(v, l.fmt)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 px-1 mt-3">
        Base: {base.origem}. Valores negativos em vermelho; coluna de Previsão destacada em azul.
      </p>
    </div>
  );
}
