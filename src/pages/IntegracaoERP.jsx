// Página: Administração → Integração ERP (fase 0)
// Painel da transição TOTVS → HeadCoach:
//   - Sincronização: cadastros espelhados do TOTVS (status, totais, rodar full/delta)
//   - Modos: por módulo e empresa (totvs | dual | headcoach)
//   - Fila (outbox): o que o HeadCoach ainda vai mandar ao TOTVS, erros e reprocesso
//   - Cadastros: consulta rápida das tabelas erp_*
//   - Migrations: estado do schema versionado
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Spinner,
  CheckCircle,
  Warning,
  XCircle,
  Play,
  Database,
  Queue,
  Gear,
  Table as TableIcon,
  ListChecks,
  MagnifyingGlass,
  Plug,
  Trash,
  ArrowCounterClockwise,
  Clock,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';

const fmtDt = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));
const fmtMs = (ms) => (ms == null ? '—' : ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 60000)}min`);
const btn = 'inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrim = `${btn} bg-[#000638] text-white hover:bg-[#1a2060]`;
const btnSec = `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
const inputCls = 'h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const MODO_COR = { totvs: 'bg-gray-100 text-gray-700', dual: 'bg-amber-100 text-amber-800', headcoach: 'bg-emerald-100 text-emerald-800' };
const MODO_LABEL = { totvs: 'TOTVS', dual: 'Dual (TOTVS + HeadCoach)', headcoach: 'HeadCoach' };
const MODULO_LABEL = { vendas: 'Vendas', receber: 'Contas a receber', pagar: 'Contas a pagar', estoque: 'Estoque', pessoas: 'Pessoas', produtos: 'Produtos', fiscal: 'Fiscal' };

const TABS = [
  { id: 'sync', label: 'Sincronização', icon: ArrowsClockwise },
  { id: 'modos', label: 'Modos', icon: Gear },
  { id: 'outbox', label: 'Fila TOTVS', icon: Queue },
  { id: 'cadastros', label: 'Cadastros', icon: TableIcon },
  { id: 'log', label: 'Histórico', icon: Clock },
  { id: 'migrations', label: 'Migrations', icon: ListChecks },
];

function StatusPill({ status, rodando }) {
  if (rodando) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700"><Spinner size={12} className="animate-spin" />rodando {rodando.modo}</span>;
  if (status === 'erro') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700"><XCircle size={12} />erro</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle size={12} />ocioso</span>;
}

function Card({ title, value, sub, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{title}</div>
      <div className="text-xl font-bold leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function IntegracaoERP() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'owner'].includes(user?.role);
  const [tab, setTab] = useState('sync');
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [auto, setAuto] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiJson('/api/erp/status');
      setStatus(data);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, [auto, carregar]);

  const aviso = (texto, tipo = 'ok') => {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(null), 5000);
  };

  const acao = async (fn, sucesso) => {
    try {
      const r = await fn();
      aviso(sucesso || r?.message || 'OK');
      carregar();
    } catch (e) {
      aviso(e.message, 'erro');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4">
      <PageTitle title="Integração ERP" subtitle="Transição TOTVS → HeadCoach: cadastros sincronizados, modo por módulo, fila de envio ao TOTVS e schema versionado" icon={Plug} />

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card title="TOTVS" value={status.totvs?.bloqueado ? 'Bloqueado' : status.totvs?.token_valido === false ? 'Sem token' : 'Conectado'} sub={status.totvs?.token_expira_em ? `token até ${fmtDt(status.totvs.token_expira_em)}` : null} tone={status.totvs?.bloqueado ? 'rose' : 'emerald'} />
          <Card title="Fila pendente" value={fmtNum(status.outbox?.pendente)} sub={`${fmtNum(status.outbox?.prontos)} prontos p/ envio`} tone={status.outbox?.pendente ? 'amber' : 'gray'} />
          <Card title="Fila com erro" value={fmtNum(status.outbox?.erro)} sub="precisam de ação" tone={status.outbox?.erro ? 'rose' : 'gray'} />
          <Card title="Enviados" value={fmtNum(status.outbox?.enviado)} sub="confirmados no TOTVS" tone="blue" />
          <Card title="Sync com erro" value={fmtNum(status.sync?.filter((s) => s.status === 'erro').length)} sub={`${status.sync?.filter((s) => s.rodando).length || 0} rodando agora`} tone={status.sync?.some((s) => s.status === 'erro') ? 'rose' : 'gray'} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`${btn} ${tab === t.id ? 'bg-[#000638] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-gray-500 flex items-center gap-1">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> auto 15s
          </label>
          <button type="button" onClick={carregar} className={btnSec} disabled={loading}>
            {loading ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />} Atualizar
          </button>
        </div>
      </div>

      {msg && <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${msg.tipo === 'erro' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{msg.texto}</div>}
      {erro && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
          <Warning size={14} /> {erro}
        </div>
      )}
      {!isAdmin && <div className="mb-3 rounded-lg px-3 py-2 text-xs bg-amber-50 text-amber-800 border border-amber-200">Somente leitura: ações de sync, modos e fila exigem perfil admin/owner.</div>}

      {tab === 'sync' && <AbaSync status={status} isAdmin={isAdmin} acao={acao} />}
      {tab === 'modos' && <AbaModos status={status} isAdmin={isAdmin} acao={acao} />}
      {tab === 'outbox' && <AbaOutbox status={status} isAdmin={isAdmin} acao={acao} />}
      {tab === 'cadastros' && <AbaCadastros />}
      {tab === 'log' && <AbaLog />}
      {tab === 'migrations' && <AbaMigrations status={status} isAdmin={isAdmin} acao={acao} />}
    </div>
  );
}

// ─── Sincronização ──────────────────────────────────────────────────────────
function AbaSync({ status, isAdmin, acao }) {
  const sync = status?.sync || [];
  const rodar = (entidade, modo) => acao(() => apiJson(`/api/erp/sync/${entidade}/run`, { method: 'POST', body: { modo } }), `Sync ${entidade} (${modo}) disparado`);
  const rodarTudo = (modo) => {
    if (!window.confirm(modo === 'full' ? 'Carga completa de TODOS os cadastros (pessoas e produtos levam ~1h). Continuar?' : 'Rodar delta de todas as entidades?')) return;
    acao(() => apiJson('/api/erp/sync/run-all', { method: 'POST', body: { modo } }), `Sync ${modo} de tudo disparado`);
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <Database size={16} className="text-[#000638]" />
        <span className="text-xs font-semibold text-gray-700">Cadastros espelhados do TOTVS</span>
        <span className="text-[11px] text-gray-400">delta a cada hora (:35) · dimensões 04:30 · custos domingo 05:00</span>
        {isAdmin && (
          <div className="ml-auto flex gap-2">
            <button type="button" className={btnSec} onClick={() => rodarTudo('delta')}><Play size={12} /> Delta de tudo</button>
            <button type="button" className={btnPrim} onClick={() => rodarTudo('full')}><Play size={12} /> Carga completa</button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Entidade</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">TOTVS</th>
              <th className="text-right px-3 py-2">HeadCoach</th>
              <th className="text-right px-3 py-2">Dif.</th>
              <th className="text-left px-3 py-2">Último full</th>
              <th className="text-left px-3 py-2">Último delta</th>
              <th className="text-right px-3 py-2">Duração</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sync.map((s) => {
              const dif = s.total_totvs != null && s.total_local != null ? s.total_local - s.total_totvs : null;
              return (
                <tr key={s.nome} className="border-t border-gray-100 hover:bg-gray-50/60">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-gray-800">{s.nome}</div>
                    <div className="text-[11px] text-gray-500">{s.descricao}</div>
                    {s.ultimo_erro && <div className="text-[11px] text-rose-600 mt-0.5 max-w-md truncate" title={s.ultimo_erro}>{s.ultimo_erro}</div>}
                  </td>
                  <td className="px-3 py-2"><StatusPill status={s.status} rodando={s.rodando} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(s.total_totvs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(s.total_local)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${dif ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>{dif == null ? '—' : dif > 0 ? `+${fmtNum(dif)}` : fmtNum(dif)}</td>
                  <td className="px-3 py-2 text-gray-600">{fmtDt(s.ultimo_full_em)}</td>
                  <td className="px-3 py-2 text-gray-600">{fmtDt(s.ultimo_delta_em)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmtMs(s.ultima_duracao_ms)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isAdmin && (
                      <>
                        {s.temDelta && <button type="button" className={`${btnSec} h-7`} disabled={!!s.rodando} onClick={() => rodar(s.nome, 'delta')}>delta</button>}
                        <button type="button" className={`${btnPrim} h-7 ml-1`} disabled={!!s.rodando} onClick={() => rodar(s.nome, 'full')}>full</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!sync.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Sem dados. Rode as migrations.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Modos ──────────────────────────────────────────────────────────────────
function AbaModos({ status, isAdmin, acao }) {
  const config = status?.config || [];
  const modulos = status?.modulos || Object.keys(MODULO_LABEL);
  const modos = status?.modos || Object.keys(MODO_LABEL);
  const [novo, setNovo] = useState({ empresa: '', modulo: 'vendas', modo: 'totvs', observacao: '' });
  const globais = modulos.map((m) => config.find((c) => c.modulo === m && c.empresa == null) || { modulo: m, modo: 'totvs', empresa: null });
  const porEmpresa = config.filter((c) => c.empresa != null);
  const salvar = (row) => acao(() => apiJson('/api/erp/config', { method: 'PUT', body: row }), `Modo de ${MODULO_LABEL[row.modulo] || row.modulo}${row.empresa ? ` (empresa ${row.empresa})` : ''} salvo`);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-700">Padrão global (vale para toda empresa sem sobreposição)</div>
        <table className="w-full text-xs">
          <tbody>
            {globais.map((g) => (
              <tr key={g.modulo} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold text-gray-800">{MODULO_LABEL[g.modulo] || g.modulo}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${MODO_COR[g.modo]}`}>{MODO_LABEL[g.modo]}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && (
                    <select className={inputCls} value={g.modo} onChange={(e) => salvar({ modulo: g.modulo, empresa: null, modo: e.target.value })}>
                      {modos.map((m) => <option key={m} value={m}>{MODO_LABEL[m]}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 text-[11px] text-gray-500 border-t border-gray-100">
          <b>totvs</b>: tudo nasce no TOTVS (hoje) · <b>dual</b>: HeadCoach grava e manda ao TOTVS pela fila · <b>headcoach</b>: só HeadCoach (TOTVS bloqueado).
          Na fase 0 nenhum módulo lê esta flag ainda; ela passa a valer quando cada módulo da fase 1 for ligado.
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-700">Sobreposição por empresa</div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-gray-500">
            <tr><th className="text-left px-3 py-1">Empresa</th><th className="text-left px-3 py-1">Módulo</th><th className="text-left px-3 py-1">Modo</th><th className="text-left px-3 py-1">Obs.</th><th></th></tr>
          </thead>
          <tbody>
            {porEmpresa.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{c.empresa}</td>
                <td className="px-3 py-2">{MODULO_LABEL[c.modulo] || c.modulo}</td>
                <td className="px-3 py-2">
                  {isAdmin ? (
                    <select className={inputCls} value={c.modo} onChange={(e) => salvar({ modulo: c.modulo, empresa: c.empresa, modo: e.target.value, observacao: c.observacao })}>
                      {modos.map((m) => <option key={m} value={m}>{MODO_LABEL[m]}</option>)}
                    </select>
                  ) : <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${MODO_COR[c.modo]}`}>{MODO_LABEL[c.modo]}</span>}
                </td>
                <td className="px-3 py-2 text-gray-500">{c.observacao || ''}</td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && <button type="button" className={`${btnSec} h-7`} onClick={() => acao(() => apiJson(`/api/erp/config/${c.id}`, { method: 'DELETE' }), 'Sobreposição removida')}><Trash size={12} /></button>}
                </td>
              </tr>
            ))}
            {!porEmpresa.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">Nenhuma empresa com modo próprio — todas seguem o padrão global.</td></tr>}
          </tbody>
        </table>
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2 px-3 py-2 border-t border-gray-100">
            <div><label className="block text-[10px] text-gray-500">Empresa</label><input className={`${inputCls} w-20`} value={novo.empresa} onChange={(e) => setNovo({ ...novo, empresa: e.target.value.replace(/\D/g, '') })} placeholder="95" /></div>
            <div><label className="block text-[10px] text-gray-500">Módulo</label><select className={inputCls} value={novo.modulo} onChange={(e) => setNovo({ ...novo, modulo: e.target.value })}>{modulos.map((m) => <option key={m} value={m}>{MODULO_LABEL[m] || m}</option>)}</select></div>
            <div><label className="block text-[10px] text-gray-500">Modo</label><select className={inputCls} value={novo.modo} onChange={(e) => setNovo({ ...novo, modo: e.target.value })}>{modos.map((m) => <option key={m} value={m}>{MODO_LABEL[m]}</option>)}</select></div>
            <div className="flex-1 min-w-[120px]"><label className="block text-[10px] text-gray-500">Observação</label><input className={`${inputCls} w-full`} value={novo.observacao} onChange={(e) => setNovo({ ...novo, observacao: e.target.value })} /></div>
            <button type="button" className={btnPrim} disabled={!novo.empresa} onClick={() => salvar({ ...novo, empresa: Number(novo.empresa) })}>Adicionar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Outbox ─────────────────────────────────────────────────────────────────
function AbaOutbox({ status, isAdmin, acao }) {
  const [filtro, setFiltro] = useState('pendente');
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [log, setLog] = useState([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiJson(`/api/erp/outbox?limite=200${filtro ? `&status=${filtro}` : ''}`);
      setItens(data.itens || []);
    } catch (e) {
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [filtro]);
  useEffect(() => {
    carregar();
  }, [carregar, status]);

  const abrir = async (item) => {
    setAberto(item);
    try {
      const { data } = await apiJson(`/api/erp/outbox/${item.id}/log`);
      setLog(data.log || []);
    } catch {
      setLog([]);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <Queue size={16} className="text-[#000638]" />
        <span className="text-xs font-semibold text-gray-700">Fila HeadCoach → TOTVS</span>
        {['pendente', 'processando', 'erro', 'enviado', 'cancelado', ''].map((s) => (
          <button key={s || 'todos'} type="button" onClick={() => setFiltro(s)} className={`${btn} h-7 ${filtro === s ? 'bg-[#000638] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {s || 'todos'} {s && status?.outbox?.[s] != null ? `(${status.outbox[s]})` : ''}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {isAdmin && <button type="button" className={btnSec} onClick={() => acao(() => apiJson('/api/erp/outbox/processar', { method: 'POST' }), 'Worker executado')}><Play size={12} /> Processar agora</button>}
          <button type="button" className={btnSec} onClick={carregar}>{loading ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />}</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Operação</th>
              <th className="text-left px-3 py-2">Chave / origem</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Tent.</th>
              <th className="text-left px-3 py-2">Próx. tentativa</th>
              <th className="text-left px-3 py-2">Último erro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => (
              <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50/60 cursor-pointer" onClick={() => abrir(it)}>
                <td className="px-3 py-2 tabular-nums">{it.id}</td>
                <td className="px-3 py-2 font-semibold">{it.operacao}</td>
                <td className="px-3 py-2 text-gray-600">{it.chave || ''}{it.origem_tabela ? <span className="text-gray-400"> · {it.origem_tabela}#{it.origem_id}</span> : null}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${it.status === 'enviado' ? 'bg-emerald-100 text-emerald-800' : it.status === 'erro' ? 'bg-rose-100 text-rose-800' : it.status === 'pendente' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{it.status}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{it.tentativas}/{it.max_tentativas}</td>
                <td className="px-3 py-2 text-gray-600">{it.status === 'pendente' ? fmtDt(it.proxima_tentativa) : it.status === 'enviado' ? fmtDt(it.enviado_em) : '—'}</td>
                <td className="px-3 py-2 text-rose-700 max-w-xs truncate" title={it.ultimo_erro || ''}>{it.ultimo_erro || ''}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {isAdmin && ['erro', 'cancelado'].includes(it.status) && <button type="button" className={`${btnSec} h-7`} onClick={() => acao(() => apiJson(`/api/erp/outbox/${it.id}/reprocessar`, { method: 'POST' }), 'Reenfileirado')}><ArrowCounterClockwise size={12} /></button>}
                  {isAdmin && ['pendente', 'erro'].includes(it.status) && <button type="button" className={`${btnSec} h-7 ml-1`} onClick={() => acao(() => apiJson(`/api/erp/outbox/${it.id}/cancelar`, { method: 'POST' }), 'Cancelado')}><XCircle size={12} /></button>}
                </td>
              </tr>
            ))}
            {!itens.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">{loading ? 'Carregando…' : 'Fila vazia neste filtro. Na fase 0 nada entra automaticamente: os módulos da fase 1 é que vão enfileirar.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setAberto(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="text-sm font-semibold">Outbox #{aberto.id} · {aberto.operacao}</div>
              <button type="button" className={btnSec} onClick={() => setAberto(null)}>Fechar</button>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-semibold text-gray-700 mb-1">Payload</div>
                <pre className="bg-gray-50 rounded-lg p-2 overflow-auto max-h-64 text-[11px]">{JSON.stringify(aberto.payload, null, 2)}</pre>
              </div>
              <div>
                <div className="font-semibold text-gray-700 mb-1">Resposta / erro</div>
                <pre className="bg-gray-50 rounded-lg p-2 overflow-auto max-h-64 text-[11px]">{aberto.ultimo_erro ? `${aberto.ultimo_erro}\n\n` : ''}{JSON.stringify(aberto.resposta, null, 2)}</pre>
              </div>
              <div className="md:col-span-2">
                <div className="font-semibold text-gray-700 mb-1">Tentativas</div>
                <table className="w-full text-[11px]">
                  <tbody>
                    {log.map((l) => (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="py-1 pr-2 tabular-nums">#{l.tentativa}</td>
                        <td className="py-1 pr-2">{l.status}</td>
                        <td className="py-1 pr-2 text-gray-500">{fmtDt(l.criado_em)}</td>
                        <td className="py-1 pr-2 text-gray-500">{l.http_status || ''} {fmtMs(l.duracao_ms)}</td>
                        <td className="py-1 text-rose-700">{l.erro || ''}</td>
                      </tr>
                    ))}
                    {!log.length && <tr><td className="py-2 text-gray-400">Ainda sem tentativas.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cadastros ──────────────────────────────────────────────────────────────
const CADASTROS = ['empresas', 'pessoas', 'representantes', 'vendedores', 'produtos', 'codigos_barras', 'cores', 'grades', 'unidades', 'classificacoes', 'tabelas_preco', 'precos', 'custos', 'operacoes', 'condicoes_pagamento', 'portadores', 'despesas_itens', 'centros_custo', 'estoques', 'contas_pagar', 'contas_pagar_comandos', 'contas_receber', 'contas_receber_comandos', 'vendas', 'transacoes', 'transacoes_comandos', 'bonus_saldo', 'bonus_comandos', 'vouchers', 'vouchers_comandos'];
const OCULTAR = new Set(['dados', 'expense', 'comando', 'items', 'installment', 'origin_destination', 'additional_information', 'related_fiscal_document', 'settlement_code', 'modality', 'transaction_type', 'branchs', 'filters', 'triggers', 'invoice', 'commissions', 'calculated_values', 'check_data', 'charge_account', 'origin_installment', 'payload', 'resposta', 'enderecos', 'telefones', 'emails', 'classificacoes', 'fornecedores', 'categorias', 'valores', 'saldos', 'calculos', 'classificacoes_pedido', 'classificacoes_pessoa', 'condicoes_pagamento', 'endereco', 'promocao', 'tabelas_preco', 'tamanhos', 'dias']);

function AbaCadastros() {
  const [ent, setEnt] = useState('produtos');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const limite = 50;

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiJson(`/api/erp/cadastros/${ent}?limite=${limite}&offset=${offset}&q=${encodeURIComponent(q)}`);
      setRes(data);
    } catch (e) {
      setRes({ itens: [], total: 0, erro: e.message });
    } finally {
      setLoading(false);
    }
  }, [ent, q, offset]);
  useEffect(() => {
    buscar();
  }, [buscar]);

  const colunas = useMemo(() => {
    const first = res?.itens?.[0];
    if (!first) return [];
    return Object.keys(first).filter((k) => !OCULTAR.has(k)).slice(0, 14);
  }, [res]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <select className={inputCls} value={ent} onChange={(e) => { setEnt(e.target.value); setOffset(0); }}>
          {CADASTROS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-2 top-2 text-gray-400" />
          <input className={`${inputCls} pl-7 w-64`} placeholder="buscar (nome, código, CPF/CNPJ, SKU…)" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
        </div>
        <span className="text-[11px] text-gray-500">{res?.total != null ? `${fmtNum(res.total)} registros` : ''}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={`${btnSec} h-7`} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limite))}>‹</button>
          <span className="text-[11px] text-gray-500">{offset + 1}–{Math.min(offset + limite, res?.total || 0)}</span>
          <button type="button" className={`${btnSec} h-7`} disabled={!res || offset + limite >= (res.total || 0)} onClick={() => setOffset(offset + limite)}>›</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {res?.erro && <div className="px-3 py-3 text-xs text-rose-700">{res.erro}</div>}
        <table className="w-full text-[11px]">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
            <tr>{colunas.map((c) => <th key={c} className="text-left px-2 py-1.5 whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody>
            {(res?.itens || []).map((row, i) => (
              <tr key={row.id ?? row.code ?? i} className="border-t border-gray-100 hover:bg-gray-50/60">
                {colunas.map((c) => {
                  const v = row[c];
                  const txt = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 'sim' : 'não') : /_em$|_at$/.test(c) && typeof v === 'string' && v.length > 15 ? fmtDt(v) : String(v);
                  return <td key={c} className="px-2 py-1 whitespace-nowrap max-w-[260px] truncate" title={txt}>{txt}</td>;
                })}
              </tr>
            ))}
            {!loading && !res?.itens?.length && <tr><td className="px-3 py-6 text-center text-gray-400" colSpan={Math.max(colunas.length, 1)}>Nada encontrado. Rode a carga inicial na aba Sincronização.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Histórico de sync ──────────────────────────────────────────────────────
function AbaLog() {
  const [log, setLog] = useState([]);
  const [ent, setEnt] = useState('');
  useEffect(() => {
    apiJson(`/api/erp/sync/log?limite=100${ent ? `&entidade=${ent}` : ''}`).then(({ data }) => setLog(data.log || [])).catch(() => setLog([]));
  }, [ent]);
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <Clock size={16} className="text-[#000638]" />
        <span className="text-xs font-semibold text-gray-700">Execuções do sync</span>
        <input className={`${inputCls} ml-2 w-48`} placeholder="filtrar entidade" value={ent} onChange={(e) => setEnt(e.target.value.trim())} />
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
          <tr><th className="text-left px-3 py-2">Entidade</th><th className="text-left px-3 py-2">Modo</th><th className="text-left px-3 py-2">Início</th><th className="text-left px-3 py-2">Fim</th><th className="text-left px-3 py-2">Status</th><th className="text-right px-3 py-2">Registros</th><th className="text-right px-3 py-2">Páginas</th><th className="text-left px-3 py-2">Disparo</th><th className="text-left px-3 py-2">Erro</th></tr>
        </thead>
        <tbody>
          {log.map((l) => (
            <tr key={l.id} className="border-t border-gray-100">
              <td className="px-3 py-1.5 font-semibold">{l.entidade}</td>
              <td className="px-3 py-1.5">{l.modo}</td>
              <td className="px-3 py-1.5 text-gray-600">{fmtDt(l.iniciado_em)}</td>
              <td className="px-3 py-1.5 text-gray-600">{fmtDt(l.concluido_em)}</td>
              <td className="px-3 py-1.5">{l.status === 'ok' ? <span className="text-emerald-700 font-semibold">ok</span> : l.status === 'erro' ? <span className="text-rose-700 font-semibold">erro</span> : <span className="text-blue-700">rodando</span>}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(l.registros)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(l.paginas)}</td>
              <td className="px-3 py-1.5 text-gray-500">{l.disparado_por || ''}</td>
              <td className="px-3 py-1.5 text-rose-700 max-w-sm truncate" title={l.erro || ''}>{l.erro || ''}</td>
            </tr>
          ))}
          {!log.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Nenhuma execução registrada.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── Migrations ─────────────────────────────────────────────────────────────
function AbaMigrations({ status, isAdmin, acao }) {
  const m = status?.migrations || [];
  const pendentes = m.filter((x) => !x.aplicada);
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <ListChecks size={16} className="text-[#000638]" />
        <span className="text-xs font-semibold text-gray-700">Schema versionado (apigestaocrosby/migrations/erp)</span>
        <span className="text-[11px] text-gray-400">snapshot em docs/schema/TABELAS.md</span>
        {isAdmin && pendentes.length > 0 && (
          <button type="button" className={`${btnPrim} ml-auto`} onClick={() => acao(() => apiJson('/api/erp/migrations/aplicar', { method: 'POST' }), 'Migrations aplicadas')}>
            <Play size={12} /> Aplicar {pendentes.length} pendente(s)
          </button>
        )}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {m.map((x) => (
            <tr key={x.name} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono">{x.name}</td>
              <td className="px-3 py-2">{x.aplicada ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle size={12} /> aplicada</span> : <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><Warning size={12} /> pendente</span>}</td>
              <td className="px-3 py-2 text-gray-500">{fmtDt(x.applied_at)}</td>
              <td className="px-3 py-2 text-amber-700">{x.checksumDiferente ? 'arquivo mudou depois de aplicado' : ''}{x.erro || ''}</td>
            </tr>
          ))}
          {!m.length && <tr><td className="px-3 py-6 text-center text-gray-400">Nenhuma migration encontrada.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
