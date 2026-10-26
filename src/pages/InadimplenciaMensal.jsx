import React, { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, ChartBar, TrendDown, TrendUp, Warning } from '@phosphor-icons/react';
import { apiJson } from '../utils/apiAuth';

/**
 * Inadimplência mensal (>60 dias) — pedido do João (Recuperação de Créditos, 26/10/2026).
 * Lê o snapshot diário do backend (GET /api/inadimplencia/mensal): série de
 * fev/2026 até o mês atual, por canal, só com títulos vencidos há mais de 60
 * dias (o índice de inadimplência da marca). Não calcula nada no navegador —
 * o Dashboard antigo fazia isso e não abria.
 */
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (v) => Number(v || 0).toLocaleString('pt-BR');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return `${MESES[(m || 1) - 1]}/${String(y).slice(2)}`;
};
const CANAL_LABEL = { FRANQUIAS: 'Franquias', MTM: 'Multimarcas', REVENDA: 'Revenda', BLUECRED: 'BlueCard' };
const CANAL_COR = { FRANQUIAS: 'bg-violet-500', MTM: 'bg-sky-500', REVENDA: 'bg-amber-500', BLUECRED: 'bg-emerald-500' };

export default function InadimplenciaMensal() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [canal, setCanal] = useState('TODOS');

  const carregar = async (refresh = false) => {
    setCarregando(true);
    setErro(null);
    try {
      const j = await apiJson(`/api/inadimplencia/mensal${refresh ? '?refresh=1' : ''}`, { timeoutMs: 60 * 1000 });
      setDados(j);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar(false);
  }, []);

  // enquanto gera em segundo plano, consulta de novo a cada 20 s
  useEffect(() => {
    if (!dados?.gerando) return undefined;
    const t = setInterval(() => carregar(false), 20 * 1000);
    return () => clearInterval(t);
  }, [dados?.gerando]);

  const serie = useMemo(() => {
    const s = dados?.serie || [];
    if (canal === 'TODOS') return s;
    return s.map((m) => {
      const c = m.por_canal?.[canal] || { titulos: 0, valor: 0, clientes: 0 };
      return { ...m, titulos: c.titulos, valor: c.valor, clientes: c.clientes };
    });
  }, [dados, canal]);
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  const maxValor = Math.max(1, ...serie.map((m) => Number(m.valor) || 0));
  const canais = Object.keys(dados?.canais || {});

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#000638] flex items-center gap-2">
            <ChartBar size={22} weight="bold" className="text-red-600" />
            Inadimplência mensal (&gt; {dados?.dias || 60} dias)
          </h1>
          <p className="text-xs text-gray-500">
            Títulos vencidos há mais de {dados?.dias || 60} dias no fim de cada mês, desde {dados?.mes_inicial ? rotuloMes(dados.mes_inicial) : 'fev/26'} — o índice de inadimplência da marca.
            Mês fechado conta o que estava vencido naquele fim de mês, mesmo que tenha sido pago depois.
            {dados?.gerado_em && (
              <>
                {' '}
                Atualizado em <b>{new Date(dados.gerado_em).toLocaleString('pt-BR')}</b>
                {dados.gerando && <span className="text-amber-700"> · gerando nova versão…</span>}
                {dados.desatualizado && !dados.gerando && <span className="text-red-600"> · desatualizado</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white">
            <option value="TODOS">Todos os canais</option>
            {canais.map((c) => (
              <option key={c} value={c}>
                {CANAL_LABEL[c] || c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => carregar(true)}
            disabled={carregando || dados?.gerando}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#000638] rounded-lg hover:bg-[#fe0000] disabled:opacity-50"
            title="Gera um snapshot novo em segundo plano (demora alguns minutos)"
          >
            <ArrowsClockwise size={14} weight="bold" />
            Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <Warning size={16} weight="bold" /> {erro}
        </div>
      )}
      {!!dados?.avisos?.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {dados.avisos.map((a, i) => (
            <div key={i}>• {a}</div>
          ))}
        </div>
      )}

      {carregando && !dados && <p className="text-sm text-gray-500">Carregando…</p>}

      {atual && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-[11px] text-gray-500">Mês atual ({rotuloMes(atual.mes)}) — valor &gt; {dados?.dias || 60} dias</div>
            <div className="text-xl font-bold text-red-600">{fmtBRL(atual.valor)}</div>
            {anterior && (
              <div className={`text-[11px] flex items-center gap-1 ${atual.valor >= anterior.valor ? 'text-red-600' : 'text-green-700'}`}>
                {atual.valor >= anterior.valor ? <TrendUp size={12} /> : <TrendDown size={12} />}
                {fmtBRL(atual.valor - anterior.valor)} vs {rotuloMes(anterior.mes)}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-[11px] text-gray-500">Títulos</div>
            <div className="text-xl font-bold text-[#000638]">{fmtInt(atual.titulos)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-[11px] text-gray-500">Clientes</div>
            <div className="text-xl font-bold text-[#000638]">{fmtInt(atual.clientes)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-[11px] text-gray-500">Base lida</div>
            <div className="text-sm font-semibold text-gray-700">
              {fmtInt(dados?.clientes_nos_canais)} clientes · {fmtInt(dados?.titulos_lidos)} títulos
            </div>
            <div className="text-[10px] text-gray-400">{canais.map((c) => `${CANAL_LABEL[c] || c} ${fmtInt(dados.canais[c])}`).join(' · ')}</div>
          </div>
        </div>
      )}

      {serie.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-bold text-[#000638] mb-3">Mês a mês — valor vencido há mais de {dados?.dias || 60} dias</div>
          <div className="flex items-end gap-2 h-44">
            {serie.map((m) => {
              const h = Math.max(4, Math.round((Number(m.valor) / maxValor) * 100));
              const ultimo = m.mes === atual?.mes;
              return (
                <div key={m.mes} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${rotuloMes(m.mes)}: ${fmtBRL(m.valor)} · ${m.titulos} títulos · ${m.clientes} clientes`}>
                  <div className="text-[10px] font-semibold text-gray-700">{fmtBRL(m.valor).replace('R$', '').trim()}</div>
                  <div className={`w-full rounded-t ${ultimo ? 'bg-red-500' : 'bg-[#000638]'}`} style={{ height: `${h}%` }} />
                  <div className="text-[10px] text-gray-500">{rotuloMes(m.mes)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {serie.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#000638] text-white">
              <tr>
                <th className="px-3 py-2 text-left">Mês</th>
                <th className="px-3 py-2 text-left">Fim do mês</th>
                <th className="px-3 py-2 text-left">Vencidos até</th>
                <th className="px-3 py-2 text-right">Títulos</th>
                <th className="px-3 py-2 text-right">Clientes</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-right">Variação</th>
                {canal === 'TODOS' && canais.map((c) => (
                  <th key={c} className="px-3 py-2 text-right">
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${CANAL_COR[c] || 'bg-gray-400'}`} />
                    {CANAL_LABEL[c] || c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {serie.map((m) => (
                <tr key={m.mes} className={`border-b border-gray-100 ${m.mes === atual?.mes ? 'bg-red-50 font-semibold' : ''}`}>
                  <td className="px-3 py-2">{rotuloMes(m.mes)}</td>
                  <td className="px-3 py-2 text-gray-500">{m.fim?.split('-').reverse().join('/')}</td>
                  <td className="px-3 py-2 text-gray-500">{m.corte?.split('-').reverse().join('/')}</td>
                  <td className="px-3 py-2 text-right">{fmtInt(m.titulos)}</td>
                  <td className="px-3 py-2 text-right">{fmtInt(m.clientes)}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">{fmtBRL(m.valor)}</td>
                  <td className={`px-3 py-2 text-right ${m.variacao_valor > 0 ? 'text-red-600' : m.variacao_valor < 0 ? 'text-green-700' : 'text-gray-400'}`}>
                    {m.variacao_valor == null ? '—' : `${m.variacao_valor > 0 ? '+' : ''}${fmtBRL(m.variacao_valor)}${m.variacao_pct != null ? ` (${m.variacao_pct > 0 ? '+' : ''}${m.variacao_pct}%)` : ''}`}
                  </td>
                  {canal === 'TODOS' && canais.map((c) => (
                    <td key={c} className="px-3 py-2 text-right">{fmtBRL(m.por_canal?.[c]?.valor || 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
