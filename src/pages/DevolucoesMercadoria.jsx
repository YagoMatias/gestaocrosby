// Página: Solicitações Crosby → Devoluções de Mercadoria
// Três abas:
//   1. Solicitações — o que o cliente abriu no link público /devolucao
//      (fotos por peça, chamado da Produção quando defeito, status)
//   2. Devolução RFID — a página de devolução pelo portal, embutida e
//      pré-preenchida com a solicitação escolhida
//   3. Transações — devoluções já geradas no TOTVS (TRAFP005)
// A sincronização com o Dryland roda ao abrir a página e a cada 5 min no
// backend: chamado concluído libera a solicitação para a Devolução RFID.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUUpLeft,
  ArrowsClockwise,
  Spinner,
  MagnifyingGlass,
  ClipboardText,
  Broadcast,
  Receipt,
  Image as ImageIcon,
  X,
  LinkSimple,
  Prohibit,
  CheckCircle,
  Warning,
  Wrench,
  Package,
  CaretRight,
  ArrowSquareOut,
  Copy,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import DevolucaoRFID from './DevolucaoRFID';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) : '—');
const fmtDoc = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return v || '—';
};
const hojeBR = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const STATUS = {
  aguardando_avaliacao: { label: 'Aguardando Produção', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Wrench },
  aguardando_devolucao: { label: 'Pronta p/ Devolução RFID', cls: 'bg-blue-50 text-blue-700 ring-blue-200', icon: Broadcast },
  em_devolucao: { label: 'No caixa (TRAFP005)', cls: 'bg-purple-50 text-purple-700 ring-purple-200', icon: Receipt },
  concluida: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500 ring-gray-200', icon: Prohibit },
};
const TRX_STATUS = { 1: 'Em andamento', 2: 'Encerrada', 3: 'Processo externo', 4: 'ATENDIDA', 6: 'CANCELADA' };
const inputCls = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

function Badge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600 ring-gray-200' };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold whitespace-nowrap ${s.cls}`}>
      {Icon && <Icon size={10} weight="bold" />} {s.label}
    </span>
  );
}

function Card({ label, valor, cor = 'text-[#000638]', sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

const DevolucoesMercadoria = () => {
  const { user } = useAuth();
  const userNome = user?.name || user?.nome || user?.email || 'headcoach';
  const [aba, setAba] = useState('solicitacoes'); // solicitacoes | rfid | transacoes
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('abertas');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [fotoAberta, setFotoAberta] = useState(null);
  const [selecionada, setSelecionada] = useState(null); // solicitação levada para o RFID
  const [sincronizando, setSincronizando] = useState(false);
  const [toast, setToast] = useState(null);
  const [migracaoPendente, setMigracaoPendente] = useState(null);
  const [statusTrx, setStatusTrx] = useState({}); // devolucao id → status consultado

  const showToast = useCallback((tipo, msg) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filtroStatus) qs.set('status', filtroStatus);
      if (filtroTipo) qs.set('tipo', filtroTipo);
      if (busca.trim()) qs.set('busca', busca.trim());
      const r = await fetch(`${API_BASE_URL}/api/devolucoes?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) {
        if (j?.error === 'MIGRATION_PENDING') {
          setMigracaoPendente(j.message);
          setItems([]);
          return;
        }
        throw new Error(j?.message || 'Falha ao carregar');
      }
      setMigracaoPendente(null);
      setItems(j.data.items || []);
      setResumo(j.data.resumo || null);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, filtroTipo, busca, showToast]);

  const sincronizar = useCallback(
    async (silencioso = false) => {
      setSincronizando(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/devolucoes/sincronizar`, { method: 'POST' });
        const j = await r.json();
        if (r.ok && j.success) {
          if (!silencioso || j.data.liberadas.length || j.data.canceladas.length) {
            showToast('ok', j.message);
          }
          if (j.data.atualizadas.length) carregar();
        } else if (!silencioso) showToast('erro', j?.message || 'Falha na sincronização');
      } catch (e) {
        if (!silencioso) showToast('erro', e.message);
      } finally {
        setSincronizando(false);
      }
    },
    [carregar, showToast],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Ao abrir a página: confere os chamados do Dryland uma vez
  useEffect(() => {
    sincronizar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transacoes = useMemo(() => items.filter((i) => i.transacao_code), [items]);

  const patch = async (id, corpo, msgOk) => {
    const r = await fetch(`${API_BASE_URL}/api/devolucoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao atualizar');
    showToast('ok', msgOk);
    setDetalhe((d) => (d && d.id === id ? j.data : d));
    carregar();
    return j.data;
  };

  const cancelar = async (dev) => {
    const motivo = window.prompt(`Cancelar a solicitação DEV-${dev.id} de ${dev.cliente_nome}? Motivo:`);
    if (motivo == null) return;
    try {
      await patch(dev.id, { status: 'cancelada', motivo }, 'Solicitação cancelada');
    } catch (e) {
      showToast('erro', e.message);
    }
  };

  const reabrirChamado = async (dev) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/devolucoes/${dev.id}/chamado`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir o chamado');
      showToast('ok', j.message);
      carregar();
    } catch (e) {
      showToast('erro', e.message);
    }
  };

  const consultarTrx = async (dev) => {
    if (!dev.transacao_code) return;
    try {
      const qs = new URLSearchParams({ branch: dev.transacao_branch, code: dev.transacao_code, date: dev.transacao_date });
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`);
      const j = await r.json();
      const st = j?.data?.status;
      if (st == null) throw new Error(j?.message || 'Sem resposta do TOTVS');
      setStatusTrx((s) => ({ ...s, [dev.id]: st }));
      if (st !== dev.transacao_status) {
        await fetch(`${API_BASE_URL}/api/devolucoes/${dev.id}/transacao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchCode: dev.transacao_branch, transactionCode: dev.transacao_code, transactionDate: dev.transacao_date, total: dev.transacao_total, operacao: dev.transacao_operacao, qtdEpcs: dev.transacao_qtd_epcs, status: st, por: userNome }),
        });
        carregar();
      }
      showToast('ok', `Transação ${dev.transacao_code}: ${TRX_STATUS[st] || st}`);
    } catch (e) {
      showToast('erro', e.message);
    }
  };

  // Devolução RFID embutida → liga a transação à solicitação
  const aoGerarTransacao = useCallback(
    async (trx) => {
      if (!selecionada) return;
      try {
        await fetch(`${API_BASE_URL}/api/devolucoes/${selecionada.id}/transacao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchCode: trx.branchCode, transactionCode: trx.transactionCode, transactionDate: trx.transactionDate, total: trx.total, operacao: trx.operacao, qtdEpcs: trx.qtdEpcs, status: 1, por: userNome }),
        });
        showToast('ok', `Transação ${trx.transactionCode} vinculada à DEV-${selecionada.id}`);
        carregar();
      } catch (e) {
        showToast('erro', `Transação gerada, mas não vinculei à solicitação: ${e.message}`);
      }
    },
    [selecionada, userNome, carregar, showToast],
  );

  const aoMudarStatusTransacao = useCallback(
    async (trx, status) => {
      if (!selecionada || status === 1) return;
      try {
        await fetch(`${API_BASE_URL}/api/devolucoes/${selecionada.id}/transacao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchCode: trx.branchCode, transactionCode: trx.transactionCode, transactionDate: trx.transactionDate, total: trx.total, operacao: trx.operacao, qtdEpcs: trx.qtdEpcs, status, por: userNome }),
        });
        if (status === 4) showToast('ok', `DEV-${selecionada.id} concluída: devolução atendida no caixa`);
        carregar();
      } catch {
        /* a página Transações permite consultar de novo */
      }
    },
    [selecionada, userNome, carregar, showToast],
  );

  const irParaRfid = (dev) => {
    setSelecionada(dev);
    setDetalhe(null);
    setAba('rfid');
  };

  const copiar = (t) => {
    navigator.clipboard?.writeText(String(t));
    showToast('ok', 'Copiado');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-7xl mx-auto">
        <PageTitle
          title="Devoluções de Mercadoria"
          subtitle="Solicitações dos clientes, avaliação da Produção, Devolução RFID e transações no TOTVS"
          icon={ArrowUUpLeft}
        />

        {/* Abas */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-white ring-1 ring-gray-200 shadow-sm p-1">
            {[
              { id: 'solicitacoes', label: 'Solicitações', icon: ClipboardText, badge: resumo ? resumo.aguardandoAvaliacao + resumo.aguardandoDevolucao : null },
              { id: 'rfid', label: 'Devolução RFID', icon: Broadcast, badge: selecionada ? `DEV-${selecionada.id}` : null },
              { id: 'transacoes', label: 'Transações', icon: Receipt, badge: transacoes.length || null },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setAba(t.id)}
                  className={`h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${aba === t.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'}`}
                >
                  <Icon size={14} weight="bold" /> {t.label}
                  {t.badge != null && t.badge !== 0 && (
                    <span className={`ml-0.5 px-1.5 rounded-full text-[10px] ${aba === t.id ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{t.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => copiar(`${window.location.origin}/devolucao`)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-700 bg-white ring-1 ring-rose-200 shadow-sm hover:bg-rose-50 inline-flex items-center gap-1"
            title="Link que o cliente usa para abrir a devolução"
          >
            <LinkSimple size={14} /> Copiar link público
          </button>
          <button
            onClick={() => sincronizar(false)}
            disabled={sincronizando}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
            title="Confere no Dryland os chamados de avaliação"
          >
            <ArrowsClockwise size={14} className={sincronizando ? 'animate-spin' : ''} /> Sincronizar Dryland
          </button>
        </div>

        {migracaoPendente && (
          <p className="mb-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200">{migracaoPendente}</p>
        )}

        {/* ───────────── Solicitações ───────────── */}
        {aba === 'solicitacoes' && (
          <>
            {resumo && (
              <div className="mb-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <Card label="Aguardando Produção" valor={resumo.aguardandoAvaliacao} cor="text-amber-700" />
                <Card label="Prontas p/ RFID" valor={resumo.aguardandoDevolucao} cor="text-blue-700" />
                <Card label="No caixa" valor={resumo.emDevolucao} cor="text-purple-700" />
                <Card label="Concluídas" valor={resumo.concluidas} cor="text-emerald-700" />
                <Card label="Com defeito" valor={resumo.defeito} />
                <Card label="Peças" valor={resumo.pecas} sub="declaradas pelos clientes" />
              </div>
            )}

            <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Situação</label>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={inputCls}>
                  <option value="abertas">Abertas</option>
                  <option value="">Todas</option>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Tipo</label>
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={inputCls}>
                  <option value="">Todos</option>
                  <option value="tradicional">Tradicional</option>
                  <option value="defeito">Peças com defeito</option>
                </select>
              </div>
              <div className="relative">
                <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, CPF/CNPJ, vendedor, nº…" className={`${inputCls} pl-8 w-64`} />
              </div>
              <button onClick={carregar} className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5">
                <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Nº</th>
                      <th className="px-2 py-2 text-left">Aberta em</th>
                      <th className="px-2 py-2 text-left">Cliente</th>
                      <th className="px-2 py-2 text-left">Vendedor</th>
                      <th className="px-2 py-2 text-left">Tipo</th>
                      <th className="px-2 py-2 text-right">Peças</th>
                      <th className="px-2 py-2 text-center">Fotos</th>
                      <th className="px-2 py-2 text-left">Chamado</th>
                      <th className="px-2 py-2 text-left">Situação</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading && items.length === 0 && (
                      <tr><td colSpan={10} className="py-10 text-center text-gray-400"><Spinner size={20} className="animate-spin mx-auto" /></td></tr>
                    )}
                    {!loading && items.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-gray-400">
                          <Package size={26} className="mx-auto mb-1.5 text-gray-300" />
                          Nenhuma solicitação. Envie o link público aos clientes.
                        </td>
                      </tr>
                    )}
                    {items.map((d) => (
                      <tr key={d.id} className={`hover:bg-gray-50/60 ${d.status === 'cancelada' ? 'opacity-60' : ''}`}>
                        <td className="px-2 py-1.5 font-mono font-semibold text-[#000638]">DEV-{d.id}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(d.criado_em)}</td>
                        <td className="px-2 py-1.5">
                          <p className="font-medium text-[#000638] truncate max-w-[220px]">{d.cliente_nome}</p>
                          <p className="text-[10px] text-gray-400">{fmtDoc(d.cliente_cpf_cnpj)} · cód. {d.cliente_code}{d.cliente_empresa ? ` · emp. ${d.cliente_empresa}` : ''}</p>
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]">{d.vendedor_nome || d.vendedor_code || '—'}</td>
                        <td className="px-2 py-1.5">
                          {d.tipo === 'defeito' ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><Wrench size={11} weight="bold" /> Defeito</span>
                          ) : (
                            'Tradicional'
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{d.qtd_pecas}</td>
                        <td className="px-2 py-1.5 text-center">
                          {(d.fotos || []).length > 0 ? (
                            <button onClick={() => setDetalhe(d)} className="inline-flex items-center gap-0.5 text-[#000638] hover:underline">
                              <ImageIcon size={12} /> {d.fotos.length}
                            </button>
                          ) : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          {d.chamado_dryland_id ? (
                            <span title={d.chamado_status || ''}>#{d.chamado_dryland_numero ?? d.chamado_dryland_id}{d.chamado_status ? <span className="text-gray-400"> · {d.chamado_status}</span> : null}</span>
                          ) : d.tipo === 'defeito' && d.status !== 'cancelada' ? (
                            <button onClick={() => reabrirChamado(d)} className="text-[10px] font-semibold text-rose-700 hover:underline">abrir chamado</button>
                          ) : '—'}
                        </td>
                        <td className="px-2 py-1.5"><Badge status={d.status} /></td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="inline-flex gap-1">
                            <button onClick={() => setDetalhe(d)} className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-[#000638] hover:bg-gray-100">abrir</button>
                            {(d.status === 'aguardando_devolucao' || d.status === 'em_devolucao') && (
                              <button onClick={() => irParaRfid(d)} className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-0.5">
                                RFID <CaretRight size={10} weight="bold" />
                              </button>
                            )}
                            {d.status !== 'concluida' && d.status !== 'cancelada' && (
                              <button onClick={() => cancelar(d)} className="p-1 rounded hover:bg-rose-50 text-rose-500" title="Cancelar solicitação"><Prohibit size={14} /></button>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ───────────── Devolução RFID (embutida) ───────────── */}
        {aba === 'rfid' && (
          <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-4">
            {!selecionada && (
              <p className="mx-3 lg:mx-4 mb-2 text-xs text-gray-600 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
                Nenhuma solicitação escolhida: a devolução será avulsa. Para vincular, volte em Solicitações e clique em <b>RFID</b> na linha do cliente.
              </p>
            )}
            {selecionada && (
              <div className="mx-3 lg:mx-4 mb-2 flex items-center gap-2">
                <button onClick={() => setSelecionada(null)} className="h-7 px-2 rounded-lg text-[11px] font-semibold text-gray-600 bg-white ring-1 ring-gray-200 hover:bg-gray-50 inline-flex items-center gap-1">
                  <X size={11} weight="bold" /> Desvincular DEV-{selecionada.id}
                </button>
              </div>
            )}
            <DevolucaoRFID embutido solicitacao={selecionada} onTransacaoGerada={aoGerarTransacao} onStatusTransacao={aoMudarStatusTransacao} />
          </div>
        )}

        {/* ───────────── Transações ───────────── */}
        {aba === 'transacoes' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 text-[11px] text-gray-500">
              Transações de devolução geradas pela Devolução RFID a partir das solicitações. O caixa finaliza no TRAFP005; consulte para atualizar a situação.
              {filtroStatus === 'abertas' && ' Mostrando só as solicitações abertas — mude a situação para "Todas" na aba Solicitações para ver as concluídas.'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-2 text-left">Solicitação</th>
                    <th className="px-2 py-2 text-left">Cliente</th>
                    <th className="px-2 py-2 text-left">Empresa</th>
                    <th className="px-2 py-2 text-left">Transação</th>
                    <th className="px-2 py-2 text-left">Data</th>
                    <th className="px-2 py-2 text-left">Operação</th>
                    <th className="px-2 py-2 text-right">Etiquetas</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-left">TOTVS</th>
                    <th className="px-2 py-2 text-left">Por</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transacoes.length === 0 && (
                    <tr><td colSpan={11} className="py-10 text-center text-gray-400"><Receipt size={26} className="mx-auto mb-1.5 text-gray-300" />Nenhuma transação de devolução gerada.</td></tr>
                  )}
                  {transacoes.map((d) => {
                    const st = statusTrx[d.id] ?? d.transacao_status;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50/60">
                        <td className="px-2 py-1.5 font-mono font-semibold text-[#000638]">DEV-{d.id}</td>
                        <td className="px-2 py-1.5 truncate max-w-[200px]">{d.cliente_nome}</td>
                        <td className="px-2 py-1.5">{d.transacao_branch}</td>
                        <td className="px-2 py-1.5 font-mono font-bold">{d.transacao_code}</td>
                        <td className="px-2 py-1.5">{d.transacao_date ? new Date(`${d.transacao_date}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="px-2 py-1.5">{d.transacao_operacao ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{d.transacao_qtd_epcs ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(d.transacao_total)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold ${st === 4 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : st === 6 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                            {TRX_STATUS[st] || (st != null ? `status ${st}` : '—')}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[120px]">{d.transacao_por || '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <button onClick={() => consultarTrx(d)} className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-[#000638] hover:bg-gray-100 inline-flex items-center gap-1"><ArrowsClockwise size={11} /> consultar</button>
                          <button onClick={() => setDetalhe(d)} className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-[#000638] hover:bg-gray-100">abrir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ───────────── Detalhe ───────────── */}
        {detalhe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetalhe(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-bold text-[#000638]">DEV-{detalhe.id} · {detalhe.cliente_nome}</h3>
                  <p className="text-xs text-gray-500">
                    {fmtDoc(detalhe.cliente_cpf_cnpj)} · cód. {detalhe.cliente_code}{detalhe.cliente_empresa_nome ? ` · ${detalhe.cliente_empresa_nome}` : detalhe.cliente_empresa ? ` · empresa ${detalhe.cliente_empresa}` : ''}
                    {detalhe.cliente_telefone ? ` · ${detalhe.cliente_telefone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={detalhe.status} />
                  <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600"><X size={18} weight="bold" /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2"><p className="text-[10px] text-gray-500 uppercase">Tipo</p><p className="font-semibold">{detalhe.tipo === 'defeito' ? 'Peças com defeito' : 'Tradicional'}</p></div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2"><p className="text-[10px] text-gray-500 uppercase">Peças</p><p className="font-semibold">{detalhe.qtd_pecas}</p></div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2"><p className="text-[10px] text-gray-500 uppercase">Vendedor</p><p className="font-semibold truncate">{detalhe.vendedor_nome || detalhe.vendedor_code || '—'}</p></div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2"><p className="text-[10px] text-gray-500 uppercase">Aberta em</p><p className="font-semibold">{fmtDataHora(detalhe.criado_em)}</p></div>
              </div>

              {detalhe.observacao && <p className="text-xs text-gray-700 bg-amber-50 rounded-xl ring-1 ring-amber-200 px-3 py-2 mb-3"><b>Cliente:</b> {detalhe.observacao}</p>}

              {detalhe.tipo === 'defeito' && (
                <div className="text-xs rounded-xl ring-1 ring-gray-200 p-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Avaliação da Produção (Dryland)</p>
                  {detalhe.chamado_dryland_id ? (
                    <>
                      <p>
                        Chamado <b>#{detalhe.chamado_dryland_numero ?? detalhe.chamado_dryland_id}</b> · {detalhe.chamado_status || 'aberto'} · aberto em {fmtDataHora(detalhe.chamado_aberto_em)}
                        {detalhe.chamado_concluido_em ? ` · concluído em ${fmtDataHora(detalhe.chamado_concluido_em)}` : ''}
                      </p>
                      {detalhe.avaliacao_producao && <p className="mt-1 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-2 py-1.5 text-emerald-800">{detalhe.avaliacao_producao}</p>}
                      <div className="mt-2 flex gap-2">
                        <a href={`/tecnologia/chamados-dryland?id=${detalhe.chamado_dryland_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#000638] font-semibold hover:underline"><ArrowSquareOut size={12} /> ver chamado</a>
                        {detalhe.status === 'aguardando_avaliacao' && (
                          <button onClick={() => sincronizar(false)} className="inline-flex items-center gap-1 text-[#000638] font-semibold hover:underline"><ArrowsClockwise size={12} /> conferir agora</button>
                        )}
                      </div>
                    </>
                  ) : (
                    <button onClick={() => reabrirChamado(detalhe)} className="h-8 px-3 rounded-lg text-xs font-bold text-white bg-rose-700 hover:bg-rose-800">Abrir chamado para a Produção</button>
                  )}
                </div>
              )}

              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Fotos ({(detalhe.fotos || []).length})</p>
              {(detalhe.fotos || []).length === 0 ? (
                <p className="text-xs text-gray-400 mb-3">Sem fotos.</p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-3">
                  {detalhe.fotos.map((f) => (
                    <button key={f.path} onClick={() => setFotoAberta(f)} className="rounded-lg overflow-hidden ring-1 ring-gray-200 bg-gray-50 text-left">
                      <img src={f.url} alt={`Peça ${f.peca}`} className="w-full h-24 object-cover" loading="lazy" />
                      <p className="px-1.5 py-0.5 text-[10px] text-gray-600">Peça {f.peca}</p>
                    </button>
                  ))}
                </div>
              )}

              {detalhe.transacao_code && (
                <div className="text-xs rounded-xl ring-1 ring-purple-200 bg-purple-50 p-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700 mb-1">Transação de devolução no TOTVS</p>
                  <p>Nº <b className="font-mono">{detalhe.transacao_code}</b> · empresa {detalhe.transacao_branch} · {fmtBRL(detalhe.transacao_total)} · operação {detalhe.transacao_operacao ?? '—'} · {TRX_STATUS[detalhe.transacao_status] || '—'}</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Observação interna</label>
                <textarea
                  defaultValue={detalhe.observacao_interna || ''}
                  rows={2}
                  onBlur={(e) => {
                    if ((e.target.value || '') !== (detalhe.observacao_interna || '')) patch(detalhe.id, { observacao_interna: e.target.value }, 'Observação salva').catch((er) => showToast('erro', er.message));
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-sm mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(detalhe.status === 'aguardando_devolucao' || detalhe.status === 'em_devolucao') && (
                  <button onClick={() => irParaRfid(detalhe)} className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5"><Broadcast size={14} weight="bold" /> Fazer a devolução RFID</button>
                )}
                {detalhe.status === 'aguardando_avaliacao' && (
                  <button onClick={() => patch(detalhe.id, { status: 'aguardando_devolucao' }, 'Liberada sem esperar a Produção').catch((er) => showToast('erro', er.message))} className="h-9 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50" title="Use só se a Produção já avaliou fora do Dryland">
                    Liberar para RFID mesmo assim
                  </button>
                )}
                {detalhe.status === 'cancelada' && (
                  <button onClick={() => patch(detalhe.id, { status: detalhe.tipo === 'defeito' && detalhe.chamado_dryland_id && !detalhe.chamado_concluido_em ? 'aguardando_avaliacao' : 'aguardando_devolucao' }, 'Solicitação reaberta').catch((er) => showToast('erro', er.message))} className="h-9 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">Reabrir</button>
                )}
                {detalhe.status !== 'concluida' && detalhe.status !== 'cancelada' && (
                  <button onClick={() => cancelar(detalhe)} className="h-9 px-3 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 inline-flex items-center gap-1"><Prohibit size={13} /> Cancelar</button>
                )}
                <div className="flex-1" />
                <button onClick={() => copiar(`DEV-${detalhe.id}`)} className="h-9 px-2.5 rounded-lg text-xs text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 inline-flex items-center gap-1"><Copy size={12} /> protocolo</button>
              </div>
            </div>
          </div>
        )}

        {fotoAberta && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setFotoAberta(null)}>
            <div className="max-w-4xl w-full text-center">
              <img src={fotoAberta.url} alt={`Peça ${fotoAberta.peca}`} className="max-h-[85vh] mx-auto rounded-xl" />
              <p className="mt-2 text-white text-sm">Peça {fotoAberta.peca} · <a href={fotoAberta.url} target="_blank" rel="noreferrer" className="underline">abrir original</a></p>
            </div>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${toast.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
            {toast.tipo === 'ok' ? <CheckCircle size={17} weight="bold" /> : <Warning size={17} weight="bold" />}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevolucoesMercadoria;
