// Aba do Forecast pra marcar NFs de credev/devolução como "adiantamento".
// NFs marcadas NÃO são subtraídas do faturamento em nenhum card do Forecast.
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/constants';
import { MagnifyingGlass, ArrowsClockwise, Check, X } from '@phosphor-icons/react';

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toLocalIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Mapa op → canal (pra label)
const OP_CANAL = {
  7244: 'Franquia', 7245: 'MTM', 1214: 'Revenda', 7790: 'Revenda',
  66: 'Varejo', 555: 'Varejo', 1152: 'Varejo', 360: 'Varejo', 20: 'Varejo',
  5153: 'Ricardo Eletro', 5152: 'Ricardo Eletro',
};

export default function AjustesCredev() {
  const hoje = new Date();
  const iniMesIso = toLocalIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [datemin, setDatemin] = useState(iniMesIso);
  const [datemax, setDatemax] = useState(toLocalIso(hoje));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filter, setFilter] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos | pendentes | adiantamento
  const [filtroCanal, setFiltroCanal] = useState('todos'); // todos | Varejo | MTM | Revenda | Franquia | Ricardo Eletro
  const [salvando, setSalvando] = useState(null); // "invoice|branch" em salvamento

  const carregar = useCallback(async () => {
    // Guard: datas invertidas retornam vazio silencioso no backend — UX ruim.
    if (datemin && datemax && datemin > datemax) {
      setRows([]);
      setErro('Periodo invalido: data inicial maior que data final.');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const url = `${API_BASE_URL}/api/forecast/credev-ajustes/candidatos?datemin=${datemin}&datemax=${datemax}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Erro');
      setRows(j.data?.rows || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [datemin, datemax]);

  useEffect(() => { carregar(); }, [carregar]);

  const toggleAdiant = async (row, novoValor) => {
    const key = `${row.invoice_code}|${row.branch_code}`;
    setSalvando(key);
    try {
      let r;
      if (novoValor) {
        // marcar como adiantamento
        r = await fetch(`${API_BASE_URL}/api/forecast/credev-ajustes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_code: row.invoice_code,
            branch_code: row.branch_code,
            is_adiantamento: true,
          }),
        });
      } else {
        // desmarcar (remove)
        r = await fetch(
          `${API_BASE_URL}/api/forecast/credev-ajustes/${row.invoice_code}/${row.branch_code}`,
          { method: 'DELETE' },
        );
      }
      // Antes ignorava r.ok — 500 do backend passava despercebido, UI mostrava
      // marcado localmente mas persistencia falhou. Proximo carregar() desmarcava
      // silenciosamente. Agora falha explicita.
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}${txt ? ': ' + txt.slice(0, 200) : ''}`);
      }
      // Atualiza local
      setRows((prev) =>
        prev.map((r) =>
          r.invoice_code === row.invoice_code && r.branch_code === row.branch_code
            ? { ...r, is_adiantamento: novoValor }
            : r,
        ),
      );
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(null);
    }
  };

  const rowsFiltradas = rows.filter((r) => {
    if (filtroStatus === 'pendentes' && r.is_adiantamento) return false;
    if (filtroStatus === 'adiantamento' && !r.is_adiantamento) return false;
    if (filtroCanal !== 'todos') {
      const canalNF = OP_CANAL[r.operation_code] || '-';
      if (canalNF !== filtroCanal) return false;
    }
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      String(r.invoice_code).includes(q) ||
      String(r.dealer_code).includes(q) ||
      String(r.person_code).includes(q) ||
      String(r.person_name || '').toLowerCase().includes(q) ||
      String(r.branch_code).includes(q) ||
      String(r.operation_code).includes(q)
    );
  });

  const totalGeral = rowsFiltradas.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const totalAdiant = rowsFiltradas.filter((r) => r.is_adiantamento).reduce((s, r) => s + Number(r.total_value || 0), 0);
  const totalCredev = totalGeral - totalAdiant;

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-rose-800 via-rose-900 to-rose-800 text-white px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Ajustes Credev ↔ Adiantamento</h2>
            <p className="text-xs text-rose-200 mt-0.5">
              Marque NFs de devolução que na verdade são adiantamento — elas não serão subtraídas
              do faturamento em nenhum card do Forecast.
            </p>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/30 rounded inline-flex items-center gap-2 transition"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-600 font-medium">De:</span>
            <input
              type="date"
              value={datemin}
              onChange={(e) => setDatemin(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-gray-600 font-medium">Até:</span>
            <input
              type="date"
              value={datemax}
              onChange={(e) => setDatemax(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            />
          </label>
          <span className="text-gray-300">|</span>
          <div className="inline-flex items-center bg-white border border-gray-300 rounded overflow-hidden">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'pendentes', label: 'Não marcadas' },
              { key: 'adiantamento', label: 'Adiantamento' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setFiltroStatus(s.key)}
                className={`px-2.5 py-1 transition ${
                  filtroStatus === s.key ? 'bg-rose-100 text-rose-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-gray-300">|</span>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-gray-600 font-medium">Canal:</span>
            <select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 bg-white cursor-pointer hover:border-gray-400"
            >
              <option value="todos">Todos</option>
              <option value="Varejo">Varejo</option>
              <option value="MTM">MTM</option>
              <option value="Revenda">Revenda</option>
              <option value="Franquia">Franquia</option>
              <option value="Ricardo Eletro">Ricardo Eletro</option>
            </select>
          </label>
          <div className="flex-1 min-w-[200px] relative">
            <MagnifyingGlass size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar NF/dealer/cliente/branch/op..."
              className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded"
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3 border-b border-gray-200">
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <p className="text-[10px] uppercase text-gray-500 font-bold">NFs listadas</p>
            <p className="text-base font-bold text-gray-900">{rowsFiltradas.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <p className="text-[10px] uppercase text-blue-700 font-bold">Total geral</p>
            <p className="text-base font-bold text-blue-900 tabular-nums">R$ {formatBRL(totalGeral)}</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2">
            <p className="text-[10px] uppercase text-rose-700 font-bold">Credev real</p>
            <p className="text-base font-bold text-rose-900 tabular-nums">R$ {formatBRL(totalCredev)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            <p className="text-[10px] uppercase text-emerald-700 font-bold">Adiantamento</p>
            <p className="text-base font-bold text-emerald-900 tabular-nums">R$ {formatBRL(totalAdiant)}</p>
          </div>
        </div>

        {erro && (
          <div className="mx-5 my-3 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
            Erro: {erro}
          </div>
        )}

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500">
                <th className="text-left py-2 px-3">NF</th>
                <th className="text-left py-2 px-3">Data</th>
                <th className="text-left py-2 px-3">Filial</th>
                <th className="text-left py-2 px-3">Op</th>
                <th className="text-left py-2 px-3">Canal</th>
                <th className="text-left py-2 px-3">Dealer</th>
                <th className="text-left py-2 px-3">Cliente</th>
                <th className="text-right py-2 px-3">Valor</th>
                <th className="text-center py-2 px-3 w-[180px]">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading && rowsFiltradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">Carregando NFs...</td>
                </tr>
              )}
              {!loading && rowsFiltradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Nenhuma NF de credev no período.
                  </td>
                </tr>
              )}
              {rowsFiltradas.map((r) => {
                const key = `${r.invoice_code}|${r.branch_code}`;
                const isSaving = salvando === key;
                return (
                  <tr
                    key={key}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      r.is_adiantamento ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-xs">#{r.invoice_code}</td>
                    <td className="py-2.5 px-3 text-xs">{r.issue_date}</td>
                    <td className="py-2.5 px-3 text-xs">{r.branch_code}</td>
                    <td className="py-2.5 px-3 text-xs">{r.operation_code}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{OP_CANAL[r.operation_code] || '-'}</td>
                    <td className="py-2.5 px-3 text-xs">{r.dealer_code}</td>
                    <td className="py-2.5 px-3 text-xs">
                      {r.person_name ? (
                        <>
                          <div className="text-gray-800 font-medium truncate max-w-[200px]" title={r.person_name}>
                            {r.person_name}
                          </div>
                          <div className="text-[10px] text-gray-400">#{r.person_code}</div>
                        </>
                      ) : (
                        <span className="text-gray-500">#{r.person_code || '-'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-900">
                      R$ {formatBRL(r.total_value)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {r.is_adiantamento ? (
                        <button
                          onClick={() => toggleAdiant(r, false)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded hover:bg-emerald-200 disabled:opacity-50 transition font-semibold"
                        >
                          <Check size={12} weight="bold" />
                          Adiantamento
                          <X size={11} className="ml-1 opacity-60 hover:opacity-100" />
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleAdiant(r, true)}
                          disabled={isSaving}
                          className="text-[11px] px-2.5 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition"
                        >
                          {isSaving ? '...' : 'Marcar como adiantamento'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500">
          💡 A marcação é aplicada em <b>todos os cards do Forecast</b> (Por Canal, Métricas
          Diárias, Métricas Diretoria, Orçamento). Cache backend é invalidado após 5 minutos.
        </div>
      </div>
    </div>
  );
}
