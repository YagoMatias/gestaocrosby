// Forecast — menu abaixo do DRE (Niziany, 27/10/2026).
// DRE projetada de 2026 a partir da planilha base "FORECAST PESSIMISTA /
// Conservador": Realizado (jan–set) + Previsão (out–dez), mês a mês.
// Layout no padrão das demais páginas do HeadCoach (azul #000638, cabeçalho
// cinza, cards com borda). Os valores vêm de src/data/forecastBase.json; as
// visões e blocos extras seguem no JSON caso precise voltar.
import React, { useEffect, useMemo, useState } from 'react';
import { ChartLineUp } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import base from '../data/forecastBase.json';
import { API_BASE_URL } from '../config/constants';

// Automação da receita bruta (Niziany, 27–28/10/2026): a partir de setembro/2026
// os canais vêm do New Forecast (GET /api/forecast-dre/receita-canais), já com
// o showroom separado por cliente. Jan–ago seguem com os números da planilha.
// É automático para os próximos meses: puxa todo mês de 2026 marcado como
// "realizado" a partir de setembro — não precisa ligar mês a mês.
const CANAL_POR_LINHA = {
  VAREJO: 'varejo',
  MULTIMARCAS: 'multimarcas',
  FRANQUIA: 'franquia',
  REVENDA: 'revenda',
  BAZAR: 'bazar',
};
const MES_ABREV = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
// Meses a puxar do New Forecast: colunas mensais de 2026, realizado, mês >= 9.
function mesesAutomaticos(colunas) {
  const out = [];
  for (const c of colunas) {
    if (c.grupo !== 'mensal' || c.ano !== 2026 || c.tipo !== 'realizado') continue;
    const abrev = String(c.label || '').slice(0, 3).toLowerCase();
    const m = MES_ABREV[abrev];
    if (!m || m < 9) continue;
    out.push({ col: c.key, mes: `2026-${String(m).padStart(2, '0')}` });
  }
  return out;
}

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

// Linhas de total/resultado com destaque forte (banda azul do HeadCoach).
const TOTAIS_FORTES = new Set([
  'RECEITA BRUTA',
  'RECEITA LÍQUIDA',
  'RECEITA OPERACIONAL LÍQUIDA',
  'LUCRO BRUTO',
  'LUCRO OPERACIONAL',
  'EBITDA',
  'LUCRO ANTES DO IR E CS',
  'LUCRO LÍQUIDO',
  'RESULTADO FINAL',
]);
// Linhas que abrem uma nova seção (ganham um traço superior mais marcado).
const INICIO_SECAO = new Set([
  'RECEITA LÍQUIDA',
  'CUSTO DAS MERCADORIAS VENDIDAS',
  'RECEITAS (DESPESAS) OPERACIONAIS',
  'LUCRO OPERACIONAL',
  'RECEITAS NÃO OPERACIONAIS',
  'INVESTIMENTOS',
]);

const tipoLinha = (l) => {
  if (l.fmt === 'pct') return 'pct';
  if (TOTAIS_FORTES.has(l.label)) return 'forte';
  if (l.nivel === 1) return 'sub';
  return 'normal';
};

export default function Forecast() {
  // Só 2026 (jan–set Realizado, out–dez Previsão), visão mensal.
  const colunas = useMemo(
    () => base.colunas.filter((c) => c.grupo === 'mensal' && c.ano !== 2025),
    [],
  );
  const grupos = useMemo(() => agruparColunas(colunas), [colunas]);
  const linhas = base.blocos.dre || [];

  // Overrides ao vivo por coluna: { [colKey]: { VAREJO: v, MULTIMARCAS: v, ... } }
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    let cancelado = false;
    const alvos = mesesAutomaticos(colunas);
    if (alvos.length === 0) return undefined;
    (async () => {
      const resultados = await Promise.all(
        alvos.map(async ({ col, mes }) => {
          try {
            const r = await fetch(
              `${API_BASE_URL}/api/forecast-dre/receita-canais?mes=${mes}`,
            );
            if (!r.ok) return null;
            const j = await r.json();
            const d = j?.data || j;
            if (!d || typeof d.varejo !== 'number') return null;
            return [col, d];
          } catch {
            return null; // falha → mantém o número da planilha
          }
        }),
      );
      if (cancelado) return;
      const novo = {};
      for (const item of resultados) {
        if (!item) continue;
        const [col, d] = item;
        novo[col] = {};
        for (const [linha, chave] of Object.entries(CANAL_POR_LINHA)) {
          if (typeof d[chave] === 'number') novo[col][linha] = d[chave];
        }
      }
      setOverrides(novo);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunas]);

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
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> New Forecast
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
              {linhas.map((l, idx) => {
                const tipo = tipoLinha(l);
                const forte = tipo === 'forte';
                const pct = tipo === 'pct';
                const sub = tipo === 'sub';
                const secao = INICIO_SECAO.has(l.label);
                const zebra = sub && idx % 2 === 1;
                const trBg = forte
                  ? 'bg-[#000638]/[0.04]'
                  : zebra
                    ? 'bg-gray-50/50'
                    : 'hover:bg-blue-50/40';
                const bordaTopo = secao ? 'border-t-2 border-[#000638]/15' : '';
                const labelCls = forte
                  ? 'font-bold text-[#000638]'
                  : pct
                    ? 'pl-8 text-gray-400 italic font-normal text-[10px]'
                    : sub
                      ? 'pl-8 text-gray-500 font-normal'
                      : 'font-semibold text-gray-700';
                const labelBg = forte ? 'bg-[#eef0f6]' : zebra ? 'bg-gray-50' : 'bg-white';
                return (
                  <tr key={l.id} className={trBg}>
                    <td
                      className={
                        'sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-2 whitespace-nowrap ' +
                        bordaTopo + ' ' + labelBg + ' ' + labelCls
                      }
                    >
                      {l.label}
                    </td>
                    {colunas.map((c) => {
                      const ovr = overrides[c.key]?.[l.label];
                      const auto = ovr !== undefined;
                      const v = auto ? ovr : l.valores[c.key];
                      const negativo = typeof v === 'number' && v < 0;
                      const corTexto = negativo
                        ? 'text-red-600'
                        : v == null
                          ? 'text-gray-300'
                          : auto
                            ? 'text-emerald-700'
                            : forte
                              ? 'text-[#000638]'
                              : pct
                                ? 'text-gray-400 italic'
                                : sub
                                  ? 'text-gray-600'
                                  : 'text-gray-800';
                      return (
                        <td
                          key={c.key}
                          title={auto ? 'Puxado do New Forecast' : undefined}
                          className={
                            'border-b border-gray-100 px-3 py-2 text-right tabular-nums whitespace-nowrap ' +
                            bordaTopo + ' ' +
                            (auto ? 'bg-emerald-50 font-semibold ' : TIPO_CELULA[c.tipo] + ' ') +
                            (forte && !auto ? 'font-bold ' : '') +
                            (pct ? 'text-[10px] ' : '') +
                            corTexto
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
        Base: {base.origem}. A partir de setembro/2026 a receita bruta por canal (células em
        verde) é puxada do New Forecast, com o showroom/fábricas separado por cliente
        (franquia × multimarcas). Jan–ago seguem com os números da planilha.
      </p>
    </div>
  );
}
