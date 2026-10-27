// Forecast — menu abaixo do DRE (Niziany, 27/10/2026).
// Estrutura inicial montada em cima da planilha base "FORECAST PESSIMISTA /
// Conservador": DRE mês a mês (Realizado jan/25–set/26 + Forecast out–dez/26),
// visões trimestral, semestral, anual (2025R, 2026F, 2026B) e projeções
// 2027F–2030F, análise vertical (% da ROL) e indicadores.
// Os valores vêm de src/data/forecastBase.json (extraído da planilha); a
// ligação com o DRE do HeadCoach e a edição dos cenários vêm nas próximas
// orientações.
import React, { useMemo, useState } from 'react';
import { ChartLineUp } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import base from '../data/forecastBase.json';

// Niziany (27/10/2026): manter só a visão Mensal; as demais (trimestral,
// semestral, anual) foram retiradas. Os dados delas seguem no JSON caso
// precise voltar.
const VISOES = [{ id: 'mensal', label: 'Mensal' }];

const BLOCOS = [
  { id: 'dre', label: 'DRE Forecast' },
  { id: 'vertical', label: 'Análise vertical (% ROL)' },
  { id: 'indicadores', label: 'Indicadores' },
];

const TIPO_ROTULO = {
  realizado: 'Realizado',
  forecast: 'Forecast',
  budget: 'Budget',
  var: 'Variação',
  varpct: 'Variação',
  projecao: 'Projeção',
};

const TIPO_CABECALHO = {
  realizado: 'bg-slate-200 text-slate-700',
  forecast: 'bg-fuchsia-200 text-fuchsia-900',
  budget: 'bg-sky-200 text-sky-900',
  var: 'bg-amber-200 text-amber-900',
  varpct: 'bg-amber-200 text-amber-900',
  projecao: 'bg-violet-200 text-violet-900',
};

const TIPO_CELULA = {
  realizado: '',
  forecast: 'bg-fuchsia-50/60',
  budget: 'bg-sky-50/60',
  var: 'bg-amber-50/60',
  varpct: 'bg-amber-50/60',
  projecao: 'bg-violet-50/60',
};

const fmtMoeda = (v) =>
  v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const fmtInt = (v) => (v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v));
const fmtPct = (v) =>
  v == null
    ? '–'
    : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

function formatar(valor, fmtLinha, coluna) {
  if (coluna.tipo === 'varpct') return fmtPct(valor);
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
  const [visao, setVisao] = useState('mensal');
  const [bloco, setBloco] = useState('dre');

  // Niziany (27/10/2026): analisar só 2026 — meses de 2025 retirados da visão.
  const colunas = useMemo(
    () => base.colunas.filter((c) => c.grupo === visao && c.ano !== 2025),
    [visao],
  );
  const grupos = useMemo(() => agruparColunas(colunas), [colunas]);
  const linhas = base.blocos[bloco] || [];

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col items-stretch justify-start py-3 px-2 gap-3">
      <PageTitle
        title="Forecast"
        subtitle="DRE projetada — realizado, forecast, budget e projeções"
        icon={ChartLineUp}
        iconColor="text-[#000638]"
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-gray-500">Cenário</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-800">
            {base.cenario}
          </span>
        </div>
        {/* Niziany (27/10/2026): deixar só esta tela (DRE Forecast mensal).
            Os seletores de VISÃO e BLOCO foram retirados; os dados e blocos
            seguem no JSON caso precise voltar. */}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
          {Object.keys(TIPO_ROTULO)
            .filter((t) => t !== 'varpct')
            .map((t) => (
              <span key={t} className={'px-2 py-0.5 rounded ' + TIPO_CABECALHO[t]}>
                {TIPO_ROTULO[t]}
              </span>
            ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-auto max-h-[calc(100vh-230px)]">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-white border-b border-r border-gray-200 px-3 py-1.5 text-left text-[11px] font-bold uppercase text-gray-500 min-w-[260px]">
                {BLOCOS.find((b) => b.id === bloco)?.label}
              </th>
              {grupos.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.qtd}
                  className={
                    'border-b border-l border-gray-200 px-2 py-1 text-center text-[11px] font-bold uppercase ' +
                    TIPO_CABECALHO[g.tipo]
                  }
                >
                  {TIPO_ROTULO[g.tipo]}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-30 bg-white border-b border-r border-gray-200 px-3 py-1.5 text-left text-[11px] text-gray-400 font-normal">
                {base.cenario} · em R$
              </th>
              {colunas.map((c) => (
                <th
                  key={c.key}
                  className={
                    'border-b border-gray-200 px-2 py-1.5 text-right font-semibold text-gray-700 whitespace-nowrap bg-white ' +
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
                <tr key={l.id} className={destaque ? 'bg-gray-50' : 'hover:bg-gray-50/60'}>
                  <td
                    className={
                      'sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-1 whitespace-nowrap ' +
                      (destaque ? 'bg-gray-50 font-bold text-gray-900' : 'bg-white text-gray-700') +
                      (l.nivel === 1 ? ' pl-7 text-gray-600' : '')
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
                          'border-b border-gray-100 px-2 py-1 text-right tabular-nums whitespace-nowrap ' +
                          TIPO_CELULA[c.tipo] +
                          (destaque ? ' font-semibold' : '') +
                          (negativo ? ' text-red-700' : v == null ? ' text-gray-300' : ' text-gray-800')
                        }
                      >
                        {formatar(v, l.fmt, c)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 px-1">
        Estrutura inicial montada a partir da planilha base ({base.origem}). Valores negativos em
        vermelho; colunas Forecast, Budget, Variação e Projeção destacadas por cor. A ligação com o
        DRE do HeadCoach e a edição dos cenários entram nas próximas etapas.
      </p>
    </div>
  );
}
