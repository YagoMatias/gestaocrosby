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

// Semanas fixas do mês — 7 em 7 dias, todas dentro do mês.
//   S1: dia 1-7
//   S2: dia 8-14
//   S3: dia 15-21
//   S4: dia 22-28
//   S5: dia 29-fim (existe só se o mês tem 29+ dias)
//
// Chave usada em forecast_canal_metas.period_key = `YYYY-MM-Sn`.
// Não pega dias de mês vizinho (ao contrário das ISO weeks).
function semanasFixasDoMes(monthKey) {
  const [ano, mes] = String(monthKey).split('-').map(Number);
  if (!ano || !mes) return [];
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${ano}-${pad(mes)}-${pad(d)}`;

  const blocos = [
    { n: 1, ini: 1,  fim: 7 },
    { n: 2, ini: 8,  fim: 14 },
    { n: 3, ini: 15, fim: 21 },
    { n: 4, ini: 22, fim: 28 },
    { n: 5, ini: 29, fim: ultimoDia },
  ];
  return blocos
    .filter((b) => b.ini <= ultimoDia)
    .map((b) => ({
      key: `${ano}-${pad(mes)}-S${b.n}`,
      label: `S${b.n}`,
      numero: b.n,
      datemin: ymd(b.ini),
      datemax: ymd(Math.min(b.fim, ultimoDia)),
    }));
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
  bluecard: 'BlueCard (cartões)',
};

// Canais quantitativos — meta é em quantidade, não R$
const CANAIS_QUANTITATIVOS = new Set(['bluecard']);

const CANAIS_PADRAO = [
  'varejo', 'revenda', 'multimarcas', 'inbound_david', 'inbound_rafael',
  'franquia', 'bazar', 'fabrica', 'business', 'ricardoeletro', 'bluecard',
];

export default function PlanejamentoMensalModal({
  monthKey,
  userRole,
  userLogin,
  onClose,
  onSaved,
}) {
  const semanas = useMemo(() => semanasFixasDoMes(monthKey), [monthKey]);

  const canais = CANAIS_PADRAO;

  // valores[canal] = { mensal: '', sem: { 'YYYY-MM-Sn': '' } }
  const [valores, setValores] = useState(() => {
    const init = {};
    for (const c of canais) {
      init[c] = { mensal: '', sem: {} };
      for (const s of semanas) init[c].sem[s.key] = '';
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
        ...semanas.map((s) =>
          fetchJson(`${API_BASE_URL}/api/crm/canal-metas?period_type=semanal&period_key=${s.key}`),
        ),
      ];
      const results = await Promise.all(reqs);
      const mensal = results[0]?.data?.metas || [];
      const semanais = results.slice(1).map((r) => r?.data?.metas || []);

      const next = {};
      for (const c of canais) {
        next[c] = { mensal: '', sem: {} };
        for (const s of semanas) next[c].sem[s.key] = '';
      }
      // Formata pra BR (vírgula decimal) — senão o parseNum BR remove o ponto
      // pensando que é separador de milhar e infla 100x o valor.
      const fmtBR = (n) => {
        const v = Number(n || 0);
        if (!Number.isFinite(v) || v === 0) return '0';
        // só usa decimal se não for inteiro
        return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
      };
      for (const m of mensal) {
        if (next[m.canal]) next[m.canal].mensal = fmtBR(m.valor_meta);
      }
      semanais.forEach((arr, idx) => {
        const s = semanas[idx];
        for (const m of arr) {
          if (next[m.canal]) next[m.canal].sem[s.key] = fmtBR(m.valor_meta);
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
  const setSemanal = (canal, key, val) =>
    setValores((v) => ({
      ...v,
      [canal]: { ...v[canal], sem: { ...v[canal].sem, [key]: val } },
    }));

  // ─── Distribuições ─────────────────────────────────────────────────────────
  // Após qualquer distribuição os valores ficam editáveis. Pode ter semanas
  // com mais e outras com menos — o usuário ajusta o que quiser; o Σ semanas
  // mostra o quanto desvia do mensal.

  // helper: calcula dias de uma semana
  const diasDaSemana = (w) => {
    const d1 = new Date(w.datemin + 'T00:00:00Z');
    const d2 = new Date(w.datemax + 'T00:00:00Z');
    return Math.round((d2 - d1) / 86400000) + 1;
  };

  // Formata número em string PT-BR ("83333.33" vira "83333,33") — evita que o
  // parseNum BR (que remove pontos como separador de milhar) interprete errado
  // e infle o valor 100x.
  const toBR2 = (n) =>
    (Number.isFinite(n) ? n : 0).toFixed(2).replace('.', ',');

  // (1) IGUAL — mensal / N semanas (default; mais previsível)
  const distribuirIgual = (canal) => {
    const mensal = parseNum(valores[canal]?.mensal);
    if (!mensal || !semanas.length) return;
    const fatia = toBR2(mensal / semanas.length);
    const sem = Object.fromEntries(semanas.map((w) => [w.key, fatia]));
    setValores((v) => ({ ...v, [canal]: { ...v[canal], sem } }));
  };

  // (2) POR DIAS — proporcional aos dias de cada semana (S5 leva menos se for curta)
  const distribuirPorDias = (canal) => {
    const mensal = parseNum(valores[canal]?.mensal);
    if (!mensal || !semanas.length) return;
    const totDias = semanas.reduce((s, w) => s + diasDaSemana(w), 0);
    const sem = {};
    for (const w of semanas) {
      sem[w.key] = toBR2((mensal * diasDaSemana(w)) / totDias);
    }
    setValores((v) => ({ ...v, [canal]: { ...v[canal], sem } }));
  };

  // (3) Atalhos: distribuir TODOS canais — modo `igual` ou `dias`
  const distribuirTodos = (modo = 'igual') => {
    setValores((v) => {
      const next = { ...v };
      const totDias = semanas.reduce((s, w) => s + diasDaSemana(w), 0);
      for (const c of canais) {
        const mensal = parseNum(next[c]?.mensal);
        if (!mensal || !semanas.length) continue;
        const sem = {};
        for (const w of semanas) {
          if (modo === 'dias') {
            sem[w.key] = toBR2((mensal * diasDaSemana(w)) / totDias);
          } else {
            sem[w.key] = toBR2(mensal / semanas.length);
          }
        }
        next[c] = { ...next[c], sem };
      }
      return next;
    });
  };

  // Soma das semanas por canal (validação visual)
  const somaSemanas = (canal) =>
    semanas.reduce((s, w) => s + parseNum(valores[canal]?.sem[w.key]), 0);

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
        for (const w of semanas) {
          const sem = parseNum(valores[c]?.sem[w.key]);
          reqs.push(
            fetch(`${API_BASE_URL}/api/crm/canal-metas`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                canal: c,
                period_type: 'semanal',
                period_key: w.key,
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
  const totalsPorSemana = semanas.map((w) =>
    canais.reduce((s, c) => s + parseNum(valores[c]?.sem[w.key]), 0),
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
              {semanas.length} semanas do mês (7 em 7 dias, todas dentro de {monthKey}). Defina o "Prometido" mensal e a meta de cada semana.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mr-1">
            Distribuir Prometido (todos canais):
          </span>
          <button
            onClick={() => distribuirTodos('igual')}
            className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 inline-flex items-center gap-1 font-semibold"
            title="Divide o Prometido mensal igualmente entre as semanas (mensal ÷ N)"
          >
            <CurrencyDollar size={12} /> Igual entre semanas
          </button>
          <button
            onClick={() => distribuirTodos('dias')}
            className="text-xs px-3 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1 font-semibold"
            title="Distribui proporcionalmente aos dias de cada semana — S5 com 1-3 dias recebe menos"
          >
            ÷ Por dias da semana
          </button>
          <span className="text-gray-300 mx-1">|</span>
          <button
            onClick={carregar}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
          >
            <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} /> Recarregar
          </button>
          <span className="ml-auto text-[10px] text-gray-400">
            Dica: após distribuir, edite qualquer célula pra ajustar manualmente. Σ semanas mostra o desvio.
          </span>
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
                  {semanas.map((s) => (
                    <th key={s.key} className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      Sem {s.numero}
                      <span className="block text-[10px] font-normal text-gray-400 normal-case">
                        {fmtDataBr(s.datemin)}–{fmtDataBr(s.datemax)}
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
                  const isQty = CANAIS_QUANTITATIVOS.has(c);
                  const fmtVal = (v) =>
                    isQty
                      ? `${Math.round(Number(v || 0))} un`
                      : `R$ ${formatBRL(v)}`;
                  return (
                    <tr key={c} className={`border-b border-gray-100 hover:bg-gray-50/60 ${isQty ? 'bg-sky-50/30' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                        {CANAL_LABELS[c] || c}
                        {isQty && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wider font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded align-middle">
                            qty
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valores[c]?.mensal ?? ''}
                          onChange={(e) => setMensal(c, e.target.value)}
                          placeholder={isQty ? '0 cartões' : '0'}
                          className="w-32 px-2 py-1 border border-blue-200 rounded text-right tabular-nums focus:ring-1 focus:ring-blue-400 outline-none"
                        />
                      </td>
                      {semanas.map((w) => (
                        <td key={w.key} className="px-2 py-1 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={valores[c]?.sem[w.key] ?? ''}
                            onChange={(e) => setSemanal(c, w.key, e.target.value)}
                            placeholder="0"
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-right tabular-nums focus:ring-1 focus:ring-gray-400 outline-none"
                          />
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right tabular-nums text-xs font-semibold ${
                        Math.abs(diff) < 0.01 ? 'text-emerald-600' : mensalNum > 0 ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {fmtVal(soma)}
                        {mensalNum > 0 && Math.abs(diff) >= 0.01 && (
                          <span className="block text-[10px] font-normal text-amber-600">
                            (Δ {diff > 0 ? '+' : ''}{isQty ? Math.round(diff) : formatBRL(diff)})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">
                        <button
                          onClick={() => distribuirIgual(c)}
                          disabled={!mensalNum}
                          className="text-[11px] px-1.5 py-1 rounded text-blue-700 hover:bg-blue-100 bg-blue-50 disabled:opacity-40 mr-0.5 font-bold"
                          title="Distribui Prometido igualmente: mensal ÷ N semanas"
                        >
                          =
                        </button>
                        <button
                          onClick={() => distribuirPorDias(c)}
                          disabled={!mensalNum}
                          className="text-[11px] px-1.5 py-1 rounded text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 font-bold"
                          title="Distribui proporcional aos dias de cada semana"
                        >
                          ÷d
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
