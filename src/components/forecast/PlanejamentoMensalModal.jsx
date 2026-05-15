// Modal de planejamento mensal de metas (canal x mês x semanas)
// Cadastra de uma vez: meta mensal (prometido) + meta de cada semana ISO do mês
// Grava em forecast_canal_metas (mesma tabela usada por "Faturamento × Meta")
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, CheckCircle, ArrowsClockwise, CurrencyDollar } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const parseNum = (v) => {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// ISO week helpers
function isoWeekKeyOf(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
function weekKeyRange(key) {
  const m = String(key).match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return null;
  const ano = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { datemin: monday.toISOString().slice(0, 10), datemax: sunday.toISOString().slice(0, 10) };
}

// Retorna ISO weeks que intersectam um mês (YYYY-MM)
function isoWeeksInMonth(monthKey) {
  const [ano, mes] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(ano, mes - 1, 1));
  const last = new Date(Date.UTC(ano, mes, 0));
  const set = new Set();
  const out = [];
  const cur = new Date(first);
  while (cur <= last) {
    const k = isoWeekKeyOf(cur);
    if (!set.has(k)) {
      set.add(k);
      out.push(k);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out; // ordenadas (vão crescentes)
}

const fmtDataBr = (iso) => {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

// Header style para canal (alinhado com Faturamento × Meta)
const CANAL_LABELS = {
  varejo: 'Varejo',
  revenda: 'Revenda',
  multimarcas: 'Multimarcas',
  inbound_david: 'MTM Inbound David',
  inbound_rafael: 'MTM Inbound Rafael',
  franquia: 'Franquia',
  bazar: 'Bazar',
  fabrica: 'Fábrica (Kleiton)',
  business: 'Business',
  ricardoeletro: 'Ricardo Eletro',
};

const CANAIS_PADRAO = [
  'varejo', 'revenda', 'multimarcas', 'inbound_david', 'inbound_rafael',
  'franquia', 'bazar', 'fabrica', 'business', 'ricardoeletro',
];

export default function PlanejamentoMensalModal({
  monthKey,
  userRole,
  userLogin,
  onClose,
  onSaved,
}) {
  const semanas = useMemo(() => isoWeeksInMonth(monthKey), [monthKey]);
  const semanasInfo = useMemo(
    () =>
      semanas.map((k) => {
        const r = weekKeyRange(k);
        return { key: k, label: k.split('-W')[1].replace(/^0/, ''), range: r };
      }),
    [semanas],
  );

  const canais = CANAIS_PADRAO;

  // valores[canal] = { mensal: '', sem: { 'YYYY-Www': '' } }
  const [valores, setValores] = useState(() => {
    const init = {};
    for (const c of canais) {
      init[c] = { mensal: '', sem: {} };
      for (const s of semanas) init[c].sem[s] = '';
    }
    return init;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  // Carrega metas já existentes
  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const fetchJson = (url) =>
        fetch(url, { headers: { 'x-api-key': API_KEY } }).then((r) => r.json());

      const reqs = [
        fetchJson(`${API_BASE_URL}/api/crm/canal-metas?period_type=mensal&period_key=${monthKey}`),
        ...semanas.map((wk) =>
          fetchJson(`${API_BASE_URL}/api/crm/canal-metas?period_type=semanal&period_key=${wk}`),
        ),
      ];
      const results = await Promise.all(reqs);
      const mensal = results[0]?.data?.metas || [];
      const semanais = results.slice(1).map((r) => r?.data?.metas || []);

      const next = {};
      for (const c of canais) {
        next[c] = { mensal: '', sem: {} };
        for (const s of semanas) next[c].sem[s] = '';
      }
      for (const m of mensal) {
        if (next[m.canal]) next[m.canal].mensal = String(Number(m.valor_meta) || 0);
      }
      semanais.forEach((arr, idx) => {
        const wk = semanas[idx];
        for (const m of arr) {
          if (next[m.canal]) next[m.canal].sem[wk] = String(Number(m.valor_meta) || 0);
        }
      });
      setValores(next);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [monthKey, semanas, canais]);

  useEffect(() => { carregar(); }, [carregar]);

  const setMensal = (canal, val) =>
    setValores((v) => ({ ...v, [canal]: { ...v[canal], mensal: val } }));
  const setSemanal = (canal, wk, val) =>
    setValores((v) => ({
      ...v,
      [canal]: { ...v[canal], sem: { ...v[canal].sem, [wk]: val } },
    }));

  // Distribui Prometido igualmente entre N semanas
  const distribuirIgual = (canal) => {
    const mensal = parseNum(valores[canal]?.mensal);
    if (!mensal || !semanas.length) return;
    const fatia = mensal / semanas.length;
    const fatiaStr = fatia.toFixed(2);
    setValores((v) => ({
      ...v,
      [canal]: { ...v[canal], sem: Object.fromEntries(semanas.map((s) => [s, fatiaStr])) },
    }));
  };

  const distribuirTodos = () => {
    setValores((v) => {
      const next = { ...v };
      for (const c of canais) {
        const mensal = parseNum(next[c]?.mensal);
        if (!mensal || !semanas.length) continue;
        const fatia = (mensal / semanas.length).toFixed(2);
        next[c] = { ...next[c], sem: Object.fromEntries(semanas.map((s) => [s, fatia])) };
      }
      return next;
    });
  };

  // Soma das semanas por canal (validação visual)
  const somaSemanas = (canal) =>
    semanas.reduce((s, wk) => s + parseNum(valores[canal]?.sem[wk]), 0);

  const salvar = async () => {
    setSaving(true);
    setErro('');
    setMsg('');
    try {
      const reqs = [];
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-role': userRole || '',
        'x-user-login': userLogin || '',
      };

      for (const c of canais) {
        const mensal = parseNum(valores[c]?.mensal);
        // Salva mensal (mesmo que 0 — pra zerar caso intenção seja remover)
        reqs.push(
          fetch(`${API_BASE_URL}/api/crm/canal-metas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              canal: c,
              period_type: 'mensal',
              period_key: monthKey,
              valor_meta: mensal,
              user_login: userLogin || null,
              user_role: userRole || null,
            }),
          }),
        );
        for (const wk of semanas) {
          const sem = parseNum(valores[c]?.sem[wk]);
          reqs.push(
            fetch(`${API_BASE_URL}/api/crm/canal-metas`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                canal: c,
                period_type: 'semanal',
                period_key: wk,
                valor_meta: sem,
                user_login: userLogin || null,
                user_role: userRole || null,
              }),
            }),
          );
        }
      }
      const results = await Promise.all(reqs);
      const falhas = results.filter((r) => !r.ok);
      if (falhas.length > 0) {
        setErro(`${falhas.length} de ${results.length} requisições falharam`);
      } else {
        setMsg(`✓ Salvo ${results.length} metas (${canais.length} canais × ${1 + semanas.length} períodos)`);
        if (onSaved) onSaved();
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalPrometido = canais.reduce((s, c) => s + parseNum(valores[c]?.mensal), 0);
  const totalsPorSemana = semanas.map((wk) =>
    canais.reduce((s, c) => s + parseNum(valores[c]?.sem[wk]), 0),
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Planejamento Mensal — {monthKey}
            </h3>
            <p className="text-xs text-gray-500">
              {semanas.length} semanas ISO no mês. Defina o "Prometido" mensal e a meta de cada semana.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={distribuirTodos}
            className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1"
            title="Distribui o Prometido igualmente entre as semanas (todos os canais)"
          >
            <CurrencyDollar size={12} /> Distribuir Prometido por semanas
          </button>
          <button
            onClick={carregar}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
          >
            <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} /> Recarregar
          </button>
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">{erro}</div>}
        {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded text-sm mb-3">{msg}</div>}

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Carregando metas...</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Canal</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-blue-700 uppercase">Prometido (Mês)</th>
                  {semanasInfo.map((s, idx) => (
                    <th key={s.key} className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      Sem {idx + 1}
                      <span className="block text-[10px] font-normal text-gray-400 normal-case">
                        {fmtDataBr(s.range.datemin)}–{fmtDataBr(s.range.datemax)}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Σ semanas</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {canais.map((c) => {
                  const mensalNum = parseNum(valores[c]?.mensal);
                  const soma = somaSemanas(c);
                  const diff = mensalNum - soma;
                  return (
                    <tr key={c} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                        {CANAL_LABELS[c] || c}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valores[c]?.mensal ?? ''}
                          onChange={(e) => setMensal(c, e.target.value)}
                          placeholder="0"
                          className="w-32 px-2 py-1 border border-blue-200 rounded text-right tabular-nums focus:ring-1 focus:ring-blue-400 outline-none"
                        />
                      </td>
                      {semanas.map((wk) => (
                        <td key={wk} className="px-2 py-1 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={valores[c]?.sem[wk] ?? ''}
                            onChange={(e) => setSemanal(c, wk, e.target.value)}
                            placeholder="0"
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-right tabular-nums focus:ring-1 focus:ring-gray-400 outline-none"
                          />
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right tabular-nums text-xs font-semibold ${
                        Math.abs(diff) < 0.01 ? 'text-emerald-600' : mensalNum > 0 ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        R$ {formatBRL(soma)}
                        {mensalNum > 0 && Math.abs(diff) >= 0.01 && (
                          <span className="block text-[10px] font-normal text-amber-600">
                            (Δ {diff > 0 ? '+' : ''}{formatBRL(diff)})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => distribuirIgual(c)}
                          disabled={!mensalNum}
                          className="text-[11px] px-2 py-1 rounded text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                          title="Distribui Prometido / N semanas"
                        >
                          ÷N
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-3 py-2 text-gray-800">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-700">
                    R$ {formatBRL(totalPrometido)}
                  </td>
                  {totalsPorSemana.map((t, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums">
                      R$ {formatBRL(t)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">
                    R$ {formatBRL(totalsPorSemana.reduce((s, v) => s + v, 0))}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? 'Salvando...' : (<><CheckCircle size={14} /> Salvar todas as metas</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
