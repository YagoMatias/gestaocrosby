// Página: Solicitações Crosby → Transferências de Mercadoria
// Mesmo desenho das Devoluções de Mercadoria, para transferir mercadoria entre
// filiais. Três abas:
//   1. Solicitações — pedidos de transferência (o formulário de abertura ainda
//      não existe; a aba já lista, filtra, cancela e leva para o RFID). Os
//      pedidos de TRANSFERÊNCIA ENTRE LOJAS do Dryland (cards TR### e
//      TRU-<LOJA>-<BJ|MAX> do varejo) entram aqui sozinhos, com as peças
//   2. Transferência RFID — leitura pelo portal, embutida e pré-preenchida com
//      a solicitação escolhida; operação travada pelo POP (7272/7273/7280)
//   3. Transações — transferências já geradas no TOTVS (TRAFP005)
// Transferência SAINDO DA EMPRESA 99 não usa o TRAFP005: a NF-e sai pelo
// HeadCoach e a transação vai para a 990 como documento interno já atendida
// (TransferenciaNota99.jsx), com as peças do pedido conferidas pelo portal.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowsLeftRight,
  ArrowsClockwise,
  Spinner,
  MagnifyingGlass,
  ClipboardText,
  Broadcast,
  Receipt,
  X,
  Prohibit,
  CheckCircle,
  Warning,
  Package,
  CaretRight,
  Copy,
  Tag,
  ListMagnifyingGlass,
  ArrowRight,
  Printer,
  FloppyDisk,
  DownloadSimple,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { getSetoresDoUsuario } from '../services/setoresService';
import TransferenciaRFID from './TransferenciaRFID';
import TransferenciaNota99 from './TransferenciaNota99';
import { imprimirDanfe, salvarDanfePdf, avisoDoPdf } from '../utils/danfeAcoes';

// transferência saindo desta empresa tem a nota emitida pelo HeadCoach
const EMPRESA_NOTA_HEADCOACH = 99;

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) : '—');
const hojeBR = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const OPERACOES_POP = {
  7272: 'TRANSFERÊNCIA CR X CR',
  7273: 'VENDA FABIO X CR',
  7280: 'VENDA CR X IRMÃOS',
};

const STATUS = {
  aguardando_transferencia: { label: 'Pronta p/ Transferência RFID', cls: 'bg-blue-50 text-blue-700 ring-blue-200', icon: Broadcast },
  em_transferencia: { label: 'No caixa (TRAFP005)', cls: 'bg-purple-50 text-purple-700 ring-purple-200', icon: Receipt },
  concluida: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500 ring-gray-200', icon: Prohibit },
};
// Onde está a mercadoria (ciclo do toggle)
const LOCAL_INFO = {
  origem: { label: 'ORIGEM', cls: 'bg-blue-50 text-blue-700 ring-blue-200', prox: 'em_transito' },
  em_transito: { label: 'EM TRÂNSITO', cls: 'bg-amber-50 text-amber-700 ring-amber-200', prox: 'destino' },
  destino: { label: 'DESTINO', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', prox: 'origem' },
};

const TRX_STATUS = { 1: 'Em andamento', 2: 'Encerrada', 3: 'Processo externo', 4: 'ATENDIDA', 6: 'CANCELADA' };
// Transferência com nota pelo HeadCoach (saindo da 99): fica registrada só no HeadCoach,
// sem transação no TOTVS. A situação é a da nota.
const soHeadcoach = (t) => !!t?.venda_id;
const SITUACAO_NOTA = { 1: 'NF pendente', 4: 'CONCLUÍDA', 6: 'CANCELADA' };
const situacaoDe = (t) => (soHeadcoach(t) ? SITUACAO_NOTA[t.transacao_status] || 'NF pendente' : TRX_STATUS[t.transacao_status] || `status ${t.transacao_status}`);
const clsTrx = (st) =>
  st === 4 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : st === 6 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200';
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

const TransferenciasMercadoria = () => {
  const { user } = useAuth();
  const userNome = user?.name || user?.nome || user?.email || 'headcoach';
  const [aba, setAba] = useState('solicitacoes'); // solicitacoes | rfid | transacoes
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [selecionada, setSelecionada] = useState(null); // solicitação levada para o RFID
  const [avulsa99, setAvulsa99] = useState(false); // transferência avulsa saindo da 99 (nota pelo HeadCoach)
  const [toast, setToast] = useState(null);
  const [migracaoPendente, setMigracaoPendente] = useState(null);
  const [avisoDryland, setAvisoDryland] = useState(null);
  // Aba Transações
  const [trxLista, setTrxLista] = useState([]);
  const [trxResumo, setTrxResumo] = useState(null);
  const [trxLoading, setTrxLoading] = useState(false);
  const [trxAviso, setTrxAviso] = useState(null);
  const [trxDe, setTrxDe] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [trxAte, setTrxAte] = useState(hojeBR());
  const [trxBusca, setTrxBusca] = useState('');
  const [trxDetalhe, setTrxDetalhe] = useState(null);
  const [reprocessando, setReprocessando] = useState(null); // id da transação em "Tentar de novo"

  // Local da mercadoria: só owner/admin/user, setor DP ou financeiro alteram
  // (mesma regra das Devoluções)
  const [podeMexerLocal, setPodeMexerLocal] = useState(false);
  useEffect(() => {
    if (['owner', 'admin', 'user'].includes(user?.role)) {
      setPodeMexerLocal(true);
      return;
    }
    if (!user?.id) {
      setPodeMexerLocal(false);
      return;
    }
    getSetoresDoUsuario(user.id).then(({ data }) => {
      setPodeMexerLocal(
        (data || []).some((n) => {
          const u = String(n).toUpperCase();
          return u.startsWith('DP') || u.includes('FINANCEIRO');
        }),
      );
    });
  }, [user?.id, user?.role]);

  const showToast = useCallback((tipo, msg) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const carregar = useCallback(async (opcoes) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filtroStatus) qs.set('status', filtroStatus);
      if (busca.trim()) qs.set('busca', busca.trim());
      // botão Atualizar: relê na hora os pedidos de transferência do Dryland
      if (opcoes?.refresh === true) qs.set('refresh', '1');
      const r = await fetch(`${API_BASE_URL}/api/transferencias?${qs}`);
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
      setAvisoDryland(j.data.dryland?.erro ? `Não consegui ler os pedidos de transferência do Dryland agora: ${j.data.dryland.erro}` : null);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, busca, showToast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarTransacoes = useCallback(async () => {
    setTrxLoading(true);
    setTrxAviso(null);
    try {
      const qs = new URLSearchParams({ de: trxDe, ate: trxAte });
      if (trxBusca.trim()) qs.set('busca', trxBusca.trim());
      const r = await fetch(`${API_BASE_URL}/api/transferencias/transacoes?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) {
        if (j?.error === 'MIGRATION_PENDING') {
          setTrxAviso(j.message);
          setTrxLista([]);
          setTrxResumo(null);
          return;
        }
        throw new Error(j?.message || 'Falha ao carregar as transações');
      }
      setTrxLista(j.data.items || []);
      setTrxResumo(j.data.resumo || null);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setTrxLoading(false);
    }
  }, [trxDe, trxAte, trxBusca, showToast]);

  useEffect(() => {
    if (aba === 'transacoes') carregarTransacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, trxDe, trxAte]);

  const detalharTransacao = async (t) => {
    setTrxDetalhe({ ...t, itens: [], carregando: true });
    try {
      const r = await fetch(`${API_BASE_URL}/api/transferencias/transacoes/${t.id}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir o detalhe');
      setTrxDetalhe(j.data);
    } catch (e) {
      showToast('erro', e.message);
      setTrxDetalhe(null);
    }
  };

  const consultarTransacao = async (t) => {
    try {
      if (!t.transacao_code) throw new Error('A transação do TOTVS ainda não foi aberta: use "Tentar de novo"');
      const qs = new URLSearchParams({ branch: t.empresa_totvs || t.empresa, code: t.transacao_code, date: t.transacao_date });
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`);
      const j = await r.json();
      const st = j?.data?.status;
      if (st == null) throw new Error(j?.message || 'Sem resposta do TOTVS');
      if (st !== t.transacao_status) {
        await fetch(`${API_BASE_URL}/api/transferencias/transacoes/${t.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: st }),
        });
        carregarTransacoes();
        carregar();
        setTrxDetalhe((d) => (d && d.id === t.id ? { ...d, transacao_status: st } : d));
      }
      showToast('ok', `Transação ${t.transacao_code}: ${TRX_STATUS[st] || st}`);
    } catch (e) {
      showToast('erro', e.message);
    }
  };

  const patch = async (id, corpo, msgOk) => {
    const r = await fetch(`${API_BASE_URL}/api/transferencias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao atualizar');
    if (msgOk) showToast('ok', msgOk);
    setDetalhe((d) => (d && d.id === id ? j.data : d));
    carregar();
    return j.data;
  };

  const mudarLocal = async (t) => {
    const atual = t.local || 'origem';
    const prox = LOCAL_INFO[atual].prox;
    setItems((l) => l.map((x) => (x.id === t.id ? { ...x, local: prox } : x)));
    try {
      await patch(t.id, { local: prox, por: userNome });
    } catch (e) {
      setItems((l) => l.map((x) => (x.id === t.id ? { ...x, local: atual } : x)));
      showToast('erro', e.message);
    }
  };

  const cancelar = async (t) => {
    const motivo = window.prompt(`Cancelar a solicitação TRF-${t.id} (${t.empresa_origem} → ${t.empresa_destino})? Motivo:`);
    if (motivo == null) return;
    try {
      await patch(t.id, { status: 'cancelada', motivo }, 'Solicitação cancelada');
    } catch (e) {
      showToast('erro', e.message);
    }
  };

  const consultarTrxSolicitacao = async (t) => {
    if (!t.transacao_code) return;
    try {
      const qs = new URLSearchParams({ branch: t.transacao_branch, code: t.transacao_code, date: t.transacao_date });
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`);
      const j = await r.json();
      const st = j?.data?.status;
      if (st == null) throw new Error(j?.message || 'Sem resposta do TOTVS');
      if (st !== t.transacao_status) {
        await fetch(`${API_BASE_URL}/api/transferencias/${t.id}/transacao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchCode: t.transacao_branch,
            transactionCode: t.transacao_code,
            transactionDate: t.transacao_date,
            total: t.transacao_total,
            operacao: t.transacao_operacao,
            qtdEpcs: t.transacao_qtd_epcs,
            status: st,
            por: userNome,
          }),
        });
        carregar();
      }
      showToast('ok', `Transação ${t.transacao_code}: ${TRX_STATUS[st] || st}`);
    } catch (e) {
      showToast('erro', e.message);
    }
  };

  // Transferência RFID embutida → liga a transação à solicitação
  const vincular = useCallback(
    async (trx, status) => {
      if (!selecionada) return;
      await fetch(`${API_BASE_URL}/api/transferencias/${selecionada.id}/transacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchCode: trx.branchCode,
          transactionCode: trx.transactionCode,
          transactionDate: trx.transactionDate,
          total: trx.total,
          operacao: trx.operacao,
          qtdEpcs: trx.qtdEpcs,
          status,
          por: userNome,
        }),
      });
    },
    [selecionada, userNome],
  );

  const aoGerarTransacao = useCallback(
    async (trx) => {
      if (!selecionada) return;
      try {
        await vincular(trx, 1);
        showToast('ok', `Transação ${trx.transactionCode} vinculada à TRF-${selecionada.id}`);
        carregar();
      } catch (e) {
        showToast('erro', `Transação gerada, mas não vinculei à solicitação: ${e.message}`);
      }
    },
    [selecionada, vincular, carregar, showToast],
  );

  const aoMudarStatusTransacao = useCallback(
    async (trx, status) => {
      if (!selecionada || status === 1) return;
      try {
        await vincular(trx, status);
        if (status === 4) showToast('ok', `TRF-${selecionada.id} concluída: transferência atendida no caixa`);
        carregar();
      } catch {
        /* a aba Transações permite consultar de novo */
      }
    },
    [selecionada, vincular, carregar, showToast],
  );

  // transferência com nota pelo HeadCoach: emite a nota que faltou
  // (com o detalhe aberto, ele continua aberto e é recarregado com o resultado)
  const reprocessarNota = async (t, { manterDetalhe = false } = {}) => {
    if (reprocessando) return;
    setReprocessando(t.id);
    try {
      const r = await fetch(`${API_BASE_URL}/api/transferencias/nota/${t.venda_id}/reprocessar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      showToast(j.success && j.data?.fiscal?.ok ? 'ok' : 'erro', j.message || 'Sem resposta');
      carregarTransacoes();
      carregar();
      if (manterDetalhe) await detalharTransacao(t);
      else setTrxDetalhe(null);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setReprocessando(null);
    }
  };
  // transferência com nota pelo HeadCoach em que a NF-e ainda não saiu (não há transação no TOTVS)
  const podeTentarDeNovo = (t) => soHeadcoach(t) && t.nf_status !== 'cancelada' && t.nf_status !== 'autorizada';

  const irParaRfid = (t) => {
    setAvulsa99(false);
    setSelecionada(t);
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
          title="Transferências de Mercadoria"
          subtitle="Transferência entre filiais pelo POP (7272 · 7273 · 7280): solicitações, Transferência RFID e transações no TOTVS"
          icon={ArrowsLeftRight}
        />

        {/* Abas */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-white ring-1 ring-gray-200 shadow-sm p-1">
            {[
              { id: 'solicitacoes', label: 'Solicitações', icon: ClipboardText, badge: resumo ? resumo.aguardando + resumo.emTransferencia : null },
              { id: 'rfid', label: 'Transferência RFID', icon: Broadcast, badge: selecionada ? `TRF-${selecionada.id}` : null },
              { id: 'transacoes', label: 'Transações', icon: Receipt, badge: trxLista.length || null },
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
        </div>

        {migracaoPendente && <p className="mb-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200">{migracaoPendente}</p>}

        {/* ───────────── Solicitações ───────────── */}
        {aba === 'solicitacoes' && (
          <>
            {resumo && (
              <div className="mb-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                <Card label="Prontas p/ RFID" valor={resumo.aguardando} cor="text-blue-700" />
                <Card label="No caixa" valor={resumo.emTransferencia} cor="text-purple-700" />
                <Card label="Concluídas" valor={resumo.concluidas} cor="text-emerald-700" />
                <Card label="Canceladas" valor={resumo.canceladas} cor="text-gray-500" />
                <Card label="Peças" valor={resumo.pecas} sub="declaradas nas solicitações" />
              </div>
            )}

            <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Situação</label>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={inputCls}>
                  <option value="abertas">Abertas</option>
                  <option value="">Todas</option>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Empresa, solicitante, nº…"
                  className={`${inputCls} pl-8 w-64`}
                />
              </div>
              <button onClick={() => carregar({ refresh: true })} className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5">
                <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
              </button>
              <div className="flex-1" />
              <button
                onClick={() => {
                  setSelecionada(null);
                  setAvulsa99(true);
                  setAba('rfid');
                }}
                className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1.5"
                title={`Transferência avulsa saindo da empresa ${EMPRESA_NOTA_HEADCOACH}: a nota sai pelo HeadCoach`}
              >
                <Receipt size={14} weight="bold" /> Avulsa da {EMPRESA_NOTA_HEADCOACH} (nota pelo HeadCoach)
              </button>
              <button
                onClick={() => {
                  setSelecionada(null);
                  setAvulsa99(false);
                  setAba('rfid');
                }}
                className="h-9 px-3 rounded-lg text-xs font-bold text-[#000638] ring-1 ring-gray-300 bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
                title="Transferência avulsa de outra empresa, sem solicitação (finaliza no TRAFP005)"
              >
                <Broadcast size={14} weight="bold" /> Transferência avulsa
              </button>
            </div>

            {avisoDryland && <p className="mb-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200">{avisoDryland}</p>}
            {items.some((t) => t.origem === 'dryland') && (
              <p className="mb-2 text-xs text-sky-800 bg-sky-50 rounded-xl px-3 py-2 ring-1 ring-sky-200">
                As solicitações marcadas <b>DRYLAND</b> são os pedidos de transferência entre lojas da expedição (TR e TRU). Clique em <b>abrir</b> para ver as peças e em <b>RFID</b> para bipar e gerar a transferência.
              </p>
            )}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Nº</th>
                      <th className="px-2 py-2 text-left">Aberta em</th>
                      <th className="px-2 py-2 text-left">Origem</th>
                      <th className="px-2 py-2 text-left">Destino</th>
                      <th className="px-2 py-2 text-left">Operação</th>
                      <th className="px-2 py-2 text-left">Solicitante</th>
                      <th className="px-2 py-2 text-right">Peças</th>
                      <th className="px-2 py-2 text-left">Transação</th>
                      <th className="px-2 py-2 text-left">Local</th>
                      <th className="px-2 py-2 text-left">Situação</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading && items.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-gray-400">
                          <Spinner size={20} className="animate-spin mx-auto" />
                        </td>
                      </tr>
                    )}
                    {!loading && items.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-gray-400">
                          <Package size={26} className="mx-auto mb-1.5 text-gray-300" />
                          Nenhuma solicitação de transferência. Para transferir agora, use a <b>Transferência avulsa</b>.
                        </td>
                      </tr>
                    )}
                    {items.map((t) => {
                      const info = LOCAL_INFO[t.local || 'origem'];
                      return (
                        <tr key={t.id} className={`hover:bg-gray-50/60 ${t.status === 'cancelada' ? 'opacity-60' : ''}`}>
                          <td className="px-2 py-1.5">
                            <p className="font-mono font-semibold text-[#000638]">TRF-{t.id}</p>
                            {t.origem === 'dryland' && (
                              <p className="mt-0.5 inline-flex items-center whitespace-nowrap rounded-full bg-sky-50 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-700 ring-1 ring-sky-200" title="Pedido de transferência entre lojas do Dryland">
                                DRYLAND · {t.origem_ref || '—'}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(t.criado_em)}</td>
                          <td className="px-2 py-1.5">
                            <p className="font-medium text-[#000638]">{t.empresa_origem}</p>
                            <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{t.empresa_origem_nome || ''}</p>
                          </td>
                          <td className="px-2 py-1.5">
                            <p className={`font-medium ${t.empresa_destino ? 'text-[#000638]' : 'text-amber-700'}`}>{t.empresa_destino || 'a definir'}</p>
                            <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                              {t.empresa_destino_nome || ''}
                              {t.cliente_code ? ` · cliente ${t.cliente_code}` : ''}
                            </p>
                          </td>
                          <td className="px-2 py-1.5" title={OPERACOES_POP[t.operacao] || ''}>
                            {t.operacao || '—'}
                          </td>
                          <td className="px-2 py-1.5 truncate max-w-[140px]">{t.solicitante_nome || t.solicitante_email || '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {t.qtd_pecas}
                            {Number(t.valor) > 0 && <p className="text-[10px] text-gray-400">{fmtBRL(t.valor)}</p>}
                          </td>
                          <td className="px-2 py-1.5">
                            {soHeadcoach(t) ? (
                              <span className="font-semibold text-[#000638]" title="Nota pelo HeadCoach · sem transação no TOTVS">
                                {t.nf_numero ? `NF ${t.nf_numero}` : 'sem NF'}
                              </span>
                            ) : t.transacao_code ? (
                              <button onClick={() => consultarTrxSolicitacao(t)} className="font-mono text-[#000638] hover:underline" title="Consultar a situação no TOTVS">
                                {t.transacao_code}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {podeMexerLocal ? (
                              <button
                                onClick={() => mudarLocal(t)}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold hover:brightness-95 transition ${info.cls}`}
                                title="Clique para alternar: Origem → Em trânsito → Destino"
                              >
                                {info.label}
                              </button>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold ${info.cls}`}>{info.label}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge status={t.status} />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <span className="inline-flex gap-1">
                              <button onClick={() => setDetalhe(t)} className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-[#000638] hover:bg-gray-100">
                                abrir
                              </button>
                              {(t.status === 'aguardando_transferencia' || t.status === 'em_transferencia') && (
                                <button
                                  onClick={() => irParaRfid(t)}
                                  className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-0.5"
                                >
                                  RFID <CaretRight size={10} weight="bold" />
                                </button>
                              )}
                              {t.status !== 'concluida' && t.status !== 'cancelada' && (
                                <button onClick={() => cancelar(t)} className="p-1 rounded hover:bg-rose-50 text-rose-500" title="Cancelar solicitação">
                                  <Prohibit size={14} />
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ───────────── Transferência RFID (embutida) ───────────── */}
        {aba === 'rfid' && (avulsa99 || Number(selecionada?.empresa_origem) === EMPRESA_NOTA_HEADCOACH) && (
          <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-4">
            <TransferenciaNota99
              key={selecionada?.id || 'avulsa'}
              solicitacao={selecionada}
              onConcluida={() => {
                carregar();
                carregarTransacoes();
              }}
              onSair={() => {
                setSelecionada(null);
                setAvulsa99(false);
                setAba('solicitacoes');
              }}
            />
          </div>
        )}
        {aba === 'rfid' && !(avulsa99 || Number(selecionada?.empresa_origem) === EMPRESA_NOTA_HEADCOACH) && (
          <div className="-mx-3 -mb-3 lg:-mx-4 lg:-mb-4">
            {!selecionada && (
              <p className="mx-3 lg:mx-4 mb-2 text-xs text-gray-600 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
                Nenhuma solicitação escolhida: a transferência será avulsa. Para vincular, volte em Solicitações e clique em <b>RFID</b> na linha.
              </p>
            )}
            {selecionada && (
              <div className="mx-3 lg:mx-4 mb-2 flex items-center gap-2">
                <button
                  onClick={() => setSelecionada(null)}
                  className="h-7 px-2 rounded-lg text-[11px] font-semibold text-gray-600 bg-white ring-1 ring-gray-200 hover:bg-gray-50 inline-flex items-center gap-1"
                >
                  <X size={11} weight="bold" /> Desvincular TRF-{selecionada.id}
                </button>
              </div>
            )}
            <TransferenciaRFID embutido solicitacao={selecionada} onTransacaoGerada={aoGerarTransacao} onStatusTransacao={aoMudarStatusTransacao} />
          </div>
        )}

        {/* ───────────── Transações ───────────── */}
        {aba === 'transacoes' && (
          <>
            {trxAviso && <p className="mb-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200">{trxAviso}</p>}
            {trxResumo && (
              <div className="mb-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <Card label="Transações" valor={trxResumo.transacoes} />
                <Card label="Em andamento" valor={trxResumo.emAndamento} cor="text-amber-700" sub="aguardando o caixa" />
                <Card label="Atendidas" valor={trxResumo.atendidas} cor="text-emerald-700" />
                <Card label="Canceladas" valor={trxResumo.canceladas} cor="text-gray-500" />
                <Card label="Peças" valor={trxResumo.pecas} sub="sem as canceladas" />
                <Card label="Total transferido" valor={fmtBRL(trxResumo.total)} />
              </div>
            )}
            <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">De</label>
                <input type="date" value={trxDe} onChange={(e) => setTrxDe(e.target.value)} className={`${inputCls} w-auto`} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Até</label>
                <input type="date" value={trxAte} onChange={(e) => setTrxAte(e.target.value)} className={`${inputCls} w-auto`} />
              </div>
              <div className="relative">
                <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={trxBusca}
                  onChange={(e) => setTrxBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && carregarTransacoes()}
                  placeholder="Empresa, nº da transação, cliente…"
                  className={`${inputCls} pl-8 w-72`}
                />
              </div>
              <button
                onClick={carregarTransacoes}
                className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5"
              >
                <ArrowsClockwise size={14} className={trxLoading ? 'animate-spin' : ''} /> Atualizar
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Transação</th>
                      <th className="px-2 py-2 text-left">Gerada em</th>
                      <th className="px-2 py-2 text-left">Origem → Destino</th>
                      <th className="px-2 py-2 text-left">Operação</th>
                      <th className="px-2 py-2 text-left">Vendedor</th>
                      <th className="px-2 py-2 text-right">Peças</th>
                      <th className="px-2 py-2 text-right">EPCs</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="px-2 py-2 text-left">Situação</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trxLoading && trxLista.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-gray-400">
                          <Spinner size={20} className="animate-spin mx-auto" />
                        </td>
                      </tr>
                    )}
                    {!trxLoading && trxLista.length === 0 && !trxAviso && (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-gray-400">
                          <Receipt size={26} className="mx-auto mb-1.5 text-gray-300" />
                          Nenhuma transferência no período.
                        </td>
                      </tr>
                    )}
                    {trxLista.map((t) => (
                      <tr key={t.id} className={`hover:bg-gray-50/60 ${t.transacao_status === 6 ? 'opacity-60' : ''}`}>
                        <td className="px-2 py-1.5 font-mono font-bold text-[#000638]">
                          {soHeadcoach(t) ? (
                            <span className="font-sans" title="Nota pelo HeadCoach · sem transação no TOTVS">
                              HeadCoach
                            </span>
                          ) : t.transacao_code ? (
                            `${t.empresa_totvs ? `${t.empresa_totvs}/` : ''}${t.transacao_code}`
                          ) : (
                            <span className="font-sans font-semibold text-amber-700">sem transação</span>
                          )}
                          {t.transferencia_id && <span className="ml-1 font-sans font-normal text-[10px] text-gray-400">TRF-{t.transferencia_id}</span>}
                          {t.venda_id && (
                            <span
                              className={`mt-0.5 block w-fit rounded-full px-1.5 py-0.5 font-sans text-[9.5px] font-bold ring-1 ${
                                t.nf_status === 'autorizada' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : t.nf_status === 'cancelada' ? 'bg-gray-100 text-gray-500 ring-gray-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
                              }`}
                            >
                              {t.nf_numero ? `NF ${t.nf_numero}/${t.nf_serie || ''}` : 'sem NF'} · {t.nf_status || 'pendente'}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(t.criado_em)}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#000638]">
                            {t.empresa} <ArrowRight size={11} /> {t.empresa_destino}
                          </span>
                          <span className="block text-[10px] text-gray-400 truncate max-w-[200px]">{t.cliente_nome}</span>
                        </td>
                        <td className="px-2 py-1.5" title={OPERACOES_POP[t.operacao] || ''}>
                          {t.operacao} <span className="text-gray-400">· CFOP {t.cfop ?? '—'}</span>
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]">{t.vendedor_nome || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{t.qtd_pecas}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-purple-700">{t.qtd_epcs}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(t.total)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold ${clsTrx(t.transacao_status)}`}>
                            {situacaoDe(t)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {podeTentarDeNovo(t) && (
                            <button
                              onClick={() => reprocessarNota(t)}
                              disabled={!!reprocessando}
                              className="mr-1 px-2 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                              title="Emite a NF-e que não saiu"
                            >
                              {reprocessando === t.id && <Spinner size={11} className="animate-spin" />} Tentar de novo
                            </button>
                          )}
                          <button
                            onClick={() => detalharTransacao(t)}
                            className="px-2 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 text-white bg-[#000638] hover:bg-[#000638]/90"
                          >
                            <ListMagnifyingGlass size={12} weight="bold" /> detalhar
                          </button>
                          {!soHeadcoach(t) && (
                            <button onClick={() => consultarTransacao(t)} className="ml-1 p-1 rounded hover:bg-gray-100 text-[#000638]" title="Consultar a situação no TOTVS">
                              <ArrowsClockwise size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ───────────── Detalhe da transação ───────────── */}
        {trxDetalhe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTrxDetalhe(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-bold text-[#000638]">
                    {soHeadcoach(trxDetalhe)
                      ? `Transferência ${trxDetalhe.nf_numero ? `NF ${trxDetalhe.nf_numero}` : '(sem nota)'}`
                      : `Transação ${trxDetalhe.transacao_code ? `${trxDetalhe.empresa_totvs ? `${trxDetalhe.empresa_totvs}/` : ''}${trxDetalhe.transacao_code}` : '(ainda não aberta)'}`}{' '}
                    · empresa {trxDetalhe.empresa} → {trxDetalhe.empresa_destino || '—'}
                  </h3>
                  {trxDetalhe.venda_id && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-bold ring-1 ${trxDetalhe.nf_status === 'autorizada' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>
                        {trxDetalhe.nf_numero ? `NF-e ${trxDetalhe.nf_numero}/${trxDetalhe.nf_serie || ''}` : 'sem NF-e'} · {trxDetalhe.nf_status || 'pendente'}
                      </span>
                      <span className="text-gray-500">
                        nota pelo HeadCoach · {trxDetalhe.natureza === 'venda' ? 'venda entre filiais' : 'transferência'} · registrada só no HeadCoach (sem transação no TOTVS)
                      </span>
                    </p>
                  )}
                  {trxDetalhe.venda_id && trxDetalhe.nota_id && (trxDetalhe.nf_status === 'autorizada' || trxDetalhe.nf_status === 'cancelada') && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => imprimirDanfe(trxDetalhe.nota_id, { cancelada: trxDetalhe.nf_status === 'cancelada' }).catch((e) => showToast('erro', e.message))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white hover:bg-[#000638]/90"
                      >
                        <Printer size={13} /> Imprimir DANFE
                      </button>
                      <button
                        onClick={() =>
                          salvarDanfePdf(trxDetalhe.nota_id, { cancelada: trxDetalhe.nf_status === 'cancelada' })
                            .then((r) => {
                              const m = avisoDoPdf(r);
                              if (m) showToast('ok', m);
                            })
                            .catch((e) => showToast('erro', e.message))
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                      >
                        <FloppyDisk size={13} /> Salvar DANFE em PDF
                      </button>
                      <a
                        href={`${API_BASE_URL}/api/pdv-crosby/notas/${trxDetalhe.nota_id}/xml`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                      >
                        <DownloadSimple size={13} /> XML
                      </a>
                    </div>
                  )}
                  {!soHeadcoach(trxDetalhe) && trxDetalhe.totvs_erro && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800 ring-1 ring-amber-200">{trxDetalhe.totvs_erro}</p>}
                  <p className="text-xs text-gray-500">
                    {trxDetalhe.cliente_nome || trxDetalhe.cliente_code} · operação {trxDetalhe.operacao ?? '—'} {OPERACOES_POP[trxDetalhe.operacao] ? `(${OPERACOES_POP[trxDetalhe.operacao]})` : ''} · CFOP{' '}
                    {trxDetalhe.cfop ?? '—'} · {fmtDataHora(trxDetalhe.criado_em)}
                    {trxDetalhe.criado_por ? ` · por ${trxDetalhe.criado_por}` : ''}
                  </p>
                </div>
                <button onClick={() => setTrxDetalhe(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Peças</p>
                  <p className="text-xl font-bold text-emerald-800 tabular-nums">{trxDetalhe.qtd_pecas ?? '—'}</p>
                </div>
                <div className="rounded-xl bg-purple-50 ring-1 ring-purple-200 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-purple-700">Etiquetas (EPC)</p>
                  <p className="text-xl font-bold text-purple-800 tabular-nums">{trxDetalhe.qtd_epcs ?? '—'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-gray-600">Total</p>
                  <p className="text-xl font-bold text-[#000638] tabular-nums">{fmtBRL(trxDetalhe.total)}</p>
                </div>
              </div>

              {trxDetalhe.carregando ? (
                <div className="py-8 text-center text-gray-400">
                  <Spinner size={20} className="animate-spin mx-auto" />
                </div>
              ) : (
                <div className="rounded-xl ring-1 ring-gray-200 overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Produto</th>
                        <th className="px-2 py-1.5 text-right w-16">Qtd</th>
                        <th className="px-2 py-1.5 text-right w-24">Vl. unit.</th>
                        <th className="px-2 py-1.5 text-right w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(trxDetalhe.itens || []).map((i, idx) => (
                        <tr key={`${i.productCode}-${idx}`} className="align-top">
                          <td className="px-2 py-1.5">
                            <p className="font-medium text-[#000638]">{i.name || `Produto ${i.productCode}`}</p>
                            <p className="text-[10px] text-gray-400">cód. {i.productCode}</p>
                            {(i.epcs || []).length > 0 && (
                              <p className="mt-0.5 flex flex-wrap gap-1">
                                {i.epcs.map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => copiar(e)}
                                    title="Copiar EPC"
                                    className="inline-flex items-center gap-0.5 px-1.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 font-mono text-[10px] hover:bg-purple-100"
                                  >
                                    <Tag size={9} /> {e}
                                  </button>
                                ))}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-bold">{i.quantidade}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL(i.unit)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(i.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex px-2 py-1 rounded-full ring-1 text-[11px] font-semibold ${clsTrx(trxDetalhe.transacao_status)}`}>
                  {soHeadcoach(trxDetalhe) ? situacaoDe(trxDetalhe) : `TOTVS: ${TRX_STATUS[trxDetalhe.transacao_status] || trxDetalhe.transacao_status}`}
                </span>
                {!trxDetalhe.carregando && podeTentarDeNovo(trxDetalhe) && (
                  <button
                    onClick={() => reprocessarNota(trxDetalhe, { manterDetalhe: true })}
                    disabled={!!reprocessando}
                    title="Emite a NF-e que não saiu"
                    className="h-8 px-3 rounded-lg text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {reprocessando ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} weight="bold" />} Tentar de novo
                  </button>
                )}
                {!soHeadcoach(trxDetalhe) && (
                  <>
                    <button
                      onClick={() => consultarTransacao(trxDetalhe)}
                      className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
                    >
                      <ArrowsClockwise size={12} /> consultar no TOTVS
                    </button>
                    <button
                      onClick={() => copiar(trxDetalhe.transacao_code)}
                      className="h-8 px-2.5 rounded-lg text-[11px] text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 inline-flex items-center gap-1"
                    >
                      <Copy size={12} /> nº da transação
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ───────────── Detalhe da solicitação ───────────── */}
        {detalhe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetalhe(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-bold text-[#000638]">
                    TRF-{detalhe.id} · empresa {detalhe.empresa_origem} → {detalhe.empresa_destino || 'a definir'}
                    {detalhe.origem === 'dryland' && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 align-middle text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">DRYLAND · {detalhe.origem_ref || '—'}</span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {detalhe.empresa_origem_nome || '—'} → {detalhe.empresa_destino_nome || '—'}
                    {detalhe.cliente_code ? ` · cliente ${detalhe.cliente_code}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={detalhe.status} />
                  <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={18} weight="bold" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2">
                  <p className="text-[10px] text-gray-500 uppercase">Operação</p>
                  <p className="font-semibold">{detalhe.operacao ? `${detalhe.operacao} · ${OPERACOES_POP[detalhe.operacao] || ''}` : '—'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2">
                  <p className="text-[10px] text-gray-500 uppercase">Peças</p>
                  <p className="font-semibold">
                    {detalhe.qtd_pecas}
                    {Number(detalhe.valor) > 0 && <span className="font-normal text-gray-500"> · {fmtBRL(detalhe.valor)}</span>}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2">
                  <p className="text-[10px] text-gray-500 uppercase">Solicitante</p>
                  <p className="font-semibold truncate">{detalhe.solicitante_nome || detalhe.solicitante_email || '—'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2">
                  <p className="text-[10px] text-gray-500 uppercase">Aberta em</p>
                  <p className="font-semibold">{fmtDataHora(detalhe.criado_em)}</p>
                </div>
              </div>

              {detalhe.observacao && (
                <p className="text-xs text-gray-700 bg-amber-50 rounded-xl ring-1 ring-amber-200 px-3 py-2 mb-3">
                  <b>{detalhe.origem === 'dryland' ? 'Pedido:' : 'Solicitante:'}</b> {detalhe.observacao}
                </p>
              )}
              {Array.isArray(detalhe.itens) && detalhe.itens.length > 0 && (
                <div className="mb-3 rounded-xl ring-1 ring-gray-200 overflow-hidden">
                  <p className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Peças do pedido ({detalhe.itens.reduce((n, i) => n + (Number(i.qtd) || 0), 0)})
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-gray-400">
                        <tr>
                          <th className="px-3 py-1 text-left">Ref.</th>
                          <th className="px-2 py-1 text-left">Peça</th>
                          <th className="px-2 py-1 text-left">Cor</th>
                          <th className="px-2 py-1 text-left">Tam.</th>
                          <th className="px-2 py-1 text-right">Qtd</th>
                          <th className="px-2 py-1 text-right">Preço</th>
                          <th className="px-3 py-1 text-left">Pedido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detalhe.itens.map((i, n) => (
                          <tr key={`${i.cod}-${i.cor}-${i.tam}-${n}`}>
                            <td className="px-3 py-1 font-mono text-[#000638]">{i.cod || '—'}</td>
                            <td className="px-2 py-1">{i.descricao || '—'}</td>
                            <td className="px-2 py-1 text-gray-600">{i.cor || '—'}</td>
                            <td className="px-2 py-1 text-gray-600">{i.tam || '—'}</td>
                            <td className="px-2 py-1 text-right tabular-nums font-semibold">{i.qtd}</td>
                            <td className="px-2 py-1 text-right tabular-nums text-gray-600">{Number(i.preco) > 0 ? fmtBRL(i.preco) : '—'}</td>
                            <td className="px-3 py-1 text-gray-500">{i.tr || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {detalhe.motivo_cancelamento && detalhe.status === 'cancelada' && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded-xl ring-1 ring-gray-200 px-3 py-2 mb-3">
                  <b>Cancelada:</b> {detalhe.motivo_cancelamento}
                </p>
              )}

              {soHeadcoach(detalhe) && (
                <div className="text-xs rounded-xl ring-1 ring-emerald-200 bg-emerald-50 p-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1">Transferência com nota pelo HeadCoach</p>
                  <p>
                    {detalhe.nf_numero ? (
                      <>
                        NF-e <b className="font-mono">{detalhe.nf_numero}</b>
                      </>
                    ) : (
                      'NF-e ainda não emitida'
                    )}{' '}
                    · registrada só no HeadCoach (sem transação no TOTVS). DANFE e XML na aba Transações.
                  </p>
                </div>
              )}
              {!soHeadcoach(detalhe) && detalhe.transacao_code && (
                <div className="text-xs rounded-xl ring-1 ring-purple-200 bg-purple-50 p-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700 mb-1">Transação de transferência no TOTVS</p>
                  <p>
                    Nº <b className="font-mono">{detalhe.transacao_code}</b> · empresa {detalhe.transacao_branch} · {fmtBRL(detalhe.transacao_total)} · operação{' '}
                    {detalhe.transacao_operacao ?? '—'} · {TRX_STATUS[detalhe.transacao_status] || '—'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Observação interna</label>
                <textarea
                  defaultValue={detalhe.observacao_interna || ''}
                  rows={2}
                  onBlur={(e) => {
                    if ((e.target.value || '') !== (detalhe.observacao_interna || ''))
                      patch(detalhe.id, { observacao_interna: e.target.value }, 'Observação salva').catch((er) => showToast('erro', er.message));
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-sm mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(detalhe.status === 'aguardando_transferencia' || detalhe.status === 'em_transferencia') && (
                  <button
                    onClick={() => irParaRfid(detalhe)}
                    className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5"
                  >
                    <Broadcast size={14} weight="bold" /> Fazer a transferência RFID
                  </button>
                )}
                {detalhe.status === 'cancelada' && (
                  <button
                    onClick={() => patch(detalhe.id, { status: 'aguardando_transferencia' }, 'Solicitação reaberta').catch((er) => showToast('erro', er.message))}
                    className="h-9 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    Reabrir
                  </button>
                )}
                {detalhe.status !== 'concluida' && detalhe.status !== 'cancelada' && (
                  <button
                    onClick={() => cancelar(detalhe)}
                    className="h-9 px-3 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 inline-flex items-center gap-1"
                  >
                    <Prohibit size={13} /> Cancelar
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => copiar(`TRF-${detalhe.id}`)}
                  className="h-9 px-2.5 rounded-lg text-xs text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 inline-flex items-center gap-1"
                >
                  <Copy size={12} /> protocolo
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.tipo === 'ok' ? <CheckCircle size={17} weight="bold" /> : <Warning size={17} weight="bold" />}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferenciasMercadoria;
