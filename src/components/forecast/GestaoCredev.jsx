// Gestão de Credev — admin pode desconsiderar credev de NFs específicas
// para que sejam contabilizadas integralmente como faturamento.
// Lista NFs com credev no período + lista de overrides ativos.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Trash,
  CheckCircle,
  Receipt,
  Funnel,
  ArrowsClockwise,
  Plus,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { Card, CardContent } from '../ui/cards';
import { API_BASE_URL } from '../../config/constants';

const CANAIS = [
  { key: 'franquia', label: 'Franquia' },
  { key: 'showroom', label: 'Showroom (Fábrica/Kleiton)' },
  { key: 'novidadesfranquia', label: 'Novidades Franquia' },
  { key: 'business', label: 'Business' },
  { key: 'bazar', label: 'Bazar' },
  { key: 'ricardoeletro', label: 'Ricardo Eletro' },
  { key: 'varejo', label: 'Varejo' },
  { key: 'revenda', label: 'Revenda' },
  { key: 'multimarcas', label: 'Multimarcas' },
  { key: 'inbound_david', label: 'MTM Inbound David' },
  { key: 'inbound_rafael', label: 'MTM Inbound Rafael' },
];

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDataBr = (iso) => {
  if (!iso) return '—';
  const d = String(iso).slice(0, 10);
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

const formatDataHoraBr = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
};

export default function GestaoCredev() {
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const ontemIso = ontem.toISOString().slice(0, 10);

  const [datemin, setDatemin] = useState(primeiroDiaMes);
  const [datemax, setDatemax] = useState(ontemIso);
  const [canal, setCanal] = useState('franquia');
  const [nfs, setNfs] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('nfs'); // 'nfs' | 'overrides' | 'log'
  const [log, setLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  // Modal de motivo ao criar override
  const [creating, setCreating] = useState(null); // { nf, canal }
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Carrega NFs do canal selecionado (apenas com credev > 0)
  const carregarNfs = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/crm/transacoes-canal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datemin, datemax, canal }),
        },
      );
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      const todas = j.data?.transacoes || [];
      // Filtra apenas NFs que TÊM credev
      const comCredev = todas.filter((t) => Number(t.credev_amount || 0) > 0);
      setNfs(comCredev);
    } catch (e) {
      setErro(e.message);
      setNfs([]);
    } finally {
      setLoading(false);
    }
  }, [datemin, datemax, canal]);

  const carregarOverrides = useCallback(async () => {
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/forecast/credev-overrides?ativos_only=false`,
      );
      const j = await r.json();
      if (j?.success) setOverrides(j.data?.overrides || []);
    } catch (e) {
      console.warn('Erro ao carregar overrides:', e.message);
    }
  }, []);

  const carregarLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/forecast/credev-overrides/log?limit=200`,
      );
      const j = await r.json();
      if (j?.success) setLog(j.data?.log || []);
    } catch {
      // ignore
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarOverrides();
  }, [carregarOverrides]);

  useEffect(() => {
    if (aba === 'log') carregarLog();
  }, [aba, carregarLog]);

  useEffect(() => {
    carregarNfs();
  }, [carregarNfs]);

  // Lookup rápido: NF está overridden? (por branch+transaction+canal)
  const overrideByKey = useMemo(() => {
    const m = new Map();
    for (const o of overrides) {
      if (!o.ativo) continue;
      m.set(`${o.branch_code}|${o.transaction_code}|${o.canal}`, o);
    }
    return m;
  }, [overrides]);

  const nfsFiltradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return nfs;
    return nfs.filter((n) =>
      [
        n.invoice_code,
        n.person_name,
        n.transaction_code,
        n.operation_code,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t)),
    );
  }, [nfs, busca]);

  const abrirModalCriar = (nf) => {
    setCreating({ nf, canal });
    setMotivo('');
  };

  const submitCriar = async () => {
    if (!creating) return;
    if (motivo.trim().length < 3) {
      alert('Motivo precisa ter pelo menos 3 caracteres');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/forecast/credev-overrides`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch_code: creating.nf.branch_code,
            transaction_code: creating.nf.transaction_code,
            invoice_code: creating.nf.invoice_code,
            issue_date: creating.nf.issue_date,
            canal: creating.canal,
            credev_amount: creating.nf.credev_amount,
            motivo: motivo.trim(),
          }),
        },
      );
      const j = await r.json();
      if (!r.ok || !j?.success) {
        alert(j?.message || 'Erro ao criar override');
      } else {
        setCreating(null);
        setMotivo('');
        await carregarOverrides();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const desativarOverride = async (id) => {
    if (!confirm('Reativar a contagem de credev nesta NF?')) return;
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/forecast/credev-overrides/${id}`,
        { method: 'DELETE' },
      );
      const j = await r.json();
      if (!r.ok || !j?.success) {
        alert(j?.message || 'Erro');
      } else {
        await carregarOverrides();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const overridesAtivos = overrides.filter((o) => o.ativo);

  return (
    <Card className="mb-6">
      <CardContent className="pt-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-blue-700" />
            <h3 className="text-lg font-semibold text-gray-800">
              Gestão de Credev (Admin)
            </h3>
            <span className="text-xs text-gray-500 ml-2">
              Desconsiderar credev de NFs específicas para contabilizar como faturamento
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { carregarNfs(); carregarOverrides(); }}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
            >
              <ArrowsClockwise size={14} /> Atualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
          {[
            { k: 'nfs', label: `NFs com credev (${nfsFiltradas.length})`, icon: Receipt },
            { k: 'overrides', label: `Overrides ativos (${overridesAtivos.length})`, icon: ShieldCheck },
            { k: 'log', label: 'Histórico', icon: ClockCounterClockwise },
          ].map((t) => {
            const Ic = t.icon;
            return (
              <button
                key={t.k}
                onClick={() => setAba(t.k)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
                  aba === t.k
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Ic size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ═════════ ABA NFs ═════════ */}
        {aba === 'nfs' && (
          <>
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Canal
                </label>
                <select
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                >
                  {CANAIS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  De
                </label>
                <input
                  type="date"
                  value={datemin}
                  onChange={(e) => setDatemin(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Até
                </label>
                <input
                  type="date"
                  value={datemax}
                  onChange={(e) => setDatemax(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Busca
                </label>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="NF, cliente, transação..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                />
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="mb-3 text-sm bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">
                ⚠️ {erro}
              </div>
            )}

            {/* Tabela */}
            {loading ? (
              <div className="py-10 text-center text-gray-400 text-sm">Carregando NFs...</div>
            ) : nfsFiltradas.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                Nenhuma NF com credev no período/canal
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">NF</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Op</th>
                      <th className="px-3 py-2 text-right">Valor bruto</th>
                      <th className="px-3 py-2 text-right">Credev</th>
                      <th className="px-3 py-2 text-right">Líquido</th>
                      <th className="px-3 py-2 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nfsFiltradas.map((n) => {
                      const key = `${n.branch_code}|${n.transaction_code}|${canal}`;
                      const ov = overrideByKey.get(key);
                      return (
                        <tr key={key} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{formatDataBr(n.issue_date)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{n.invoice_code}</td>
                          <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">
                            {n.person_name}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{n.operation_code}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            R$ {formatBRL(n.total_bruto)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                            − R$ {formatBRL(n.credev_amount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            R$ {formatBRL(n.total_value)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {ov ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-bold">
                                <CheckCircle size={12} weight="fill" /> Desconsiderado
                              </span>
                            ) : (
                              <button
                                onClick={() => abrirModalCriar(n)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                              >
                                <Plus size={12} /> Desconsiderar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═════════ ABA Overrides Ativos ═════════ */}
        {aba === 'overrides' && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Canal</th>
                  <th className="px-3 py-2 text-left">NF</th>
                  <th className="px-3 py-2 text-left">Data NF</th>
                  <th className="px-3 py-2 text-right">Credev (R$)</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                  <th className="px-3 py-2 text-left">Criado por</th>
                  <th className="px-3 py-2 text-left">Em</th>
                  <th className="px-3 py-2 text-center">Reativar</th>
                </tr>
              </thead>
              <tbody>
                {overridesAtivos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">
                      Nenhum override ativo
                    </td>
                  </tr>
                ) : (
                  overridesAtivos.map((o) => (
                    <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold uppercase text-xs">
                        {o.canal}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {o.invoice_code || o.transaction_code}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{formatDataBr(o.issue_date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-semibold">
                        R$ {formatBRL(o.credev_amount)}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[300px] truncate">
                        {o.motivo}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{o.created_by}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{formatDataHoraBr(o.created_at)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => desativarOverride(o.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 rounded font-semibold"
                        >
                          <Trash size={12} /> Reativar credev
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ═════════ ABA Log ═════════ */}
        {aba === 'log' && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Ação</th>
                  <th className="px-3 py-2 text-left">Canal</th>
                  <th className="px-3 py-2 text-left">NF</th>
                  <th className="px-3 py-2 text-right">Credev</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                  <th className="px-3 py-2 text-left">Por</th>
                </tr>
              </thead>
              <tbody>
                {logLoading ? (
                  <tr><td colSpan={7} className="text-center py-6 text-gray-400">Carregando...</td></tr>
                ) : log.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">Sem registros</td></tr>
                ) : (
                  log.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-600 text-xs">{formatDataHoraBr(l.alterado_em)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          l.acao === 'create' ? 'bg-blue-100 text-blue-700' :
                          l.acao === 'deactivate' ? 'bg-rose-100 text-rose-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {l.acao}
                        </span>
                      </td>
                      <td className="px-3 py-2 uppercase text-xs">{l.canal}</td>
                      <td className="px-3 py-2 font-mono text-xs">{l.invoice_code || l.transaction_code}</td>
                      <td className="px-3 py-2 text-right tabular-nums">R$ {formatBRL(l.credev_amount)}</td>
                      <td className="px-3 py-2 max-w-[280px] truncate text-gray-700">{l.motivo}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{l.alterado_por}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ═════════ MODAL: criar override ═════════ */}
        {creating && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h4 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-700" /> Desconsiderar credev
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Confirma desconsiderar o credev da NF abaixo? O valor bruto passa
                a contar 100% como faturamento do canal.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div><strong>NF:</strong> {creating.nf.invoice_code}</div>
                <div><strong>Cliente:</strong> {creating.nf.person_name}</div>
                <div><strong>Data:</strong> {formatDataBr(creating.nf.issue_date)}</div>
                <div><strong>Canal:</strong> {creating.canal}</div>
                <div><strong>Credev a ignorar:</strong> <span className="text-emerald-700 font-bold">R$ {formatBRL(creating.nf.credev_amount)}</span></div>
              </div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Motivo (obrigatório)
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Ex.: Troca não deve afetar faturamento — cliente trouxe item antigo"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-4 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setCreating(null); setMotivo(''); }}
                  disabled={submitting}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitCriar}
                  disabled={submitting || motivo.trim().length < 3}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
