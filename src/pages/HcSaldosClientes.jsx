// ============================================================================
// HEADCOACH › SALDOS DE CLIENTES (Yago, 13/11/2026) — CREDEV e adiantamento
// próprios do HeadCoach, por cliente e empresa. Carga inicial do TOTVS (empresa
// 99, clientes com CREDEV/adiantamento em 2026); o Faturamento e o Faturamento
// Brejinho consomem daqui; devolução atendida soma ao CREDEV do cliente.
// Clicando no cliente: o extrato (carga, usos, estornos, devoluções).
// API: /api/hc/saldos-clientes (exige login) — services/hcSaldosClientes.js
// Aba CASHBACK DO HEADCOACH (18/11/2026): o cashback gerado nas vendas do PDV
// Crosby (20%, carência de 3 dias, vale até o dia 93). Histórico de geração e
// uso por cliente; o vencido não é apagado e pode ser REATIVADO (owner/admin).
// API: /api/hc/saldos-clientes/cashback — services/cashbackHc.js
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, MagnifyingGlass, Spinner, X, ArrowsClockwise, Plus, CheckCircle, Gift, ClockCounterClockwise } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';
import { ClientePicker } from './DevolucaoRFID';

const API = '/api/hc/saldos-clientes';
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDia = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const TIPOS = { credev: 'Credev', adiantamento: 'Adiantamento', cashback: 'Cashback' };
const MOVIMENTOS = {
  carga_inicial: { label: 'Carga inicial (TOTVS)', cls: 'text-indigo-700' },
  devolucao: { label: 'Devolução', cls: 'text-emerald-700' },
  devolucao_cancelada: { label: 'Devolução cancelada', cls: 'text-rose-700' },
  uso: { label: 'Usado no faturamento', cls: 'text-rose-700' },
  estorno: { label: 'Estorno (voltou)', cls: 'text-emerald-700' },
  ajuste: { label: 'Gerado manualmente', cls: 'text-indigo-700' },
  // cashback: acerto diário pelo saldo bônus do TOTVS
  sinc_totvs: { label: 'Acerto pelo TOTVS', cls: 'text-amber-700' },
};
// cashback do HeadCoach
const SITUACOES_CB = {
  disponivel: { label: 'Disponível', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  carencia: { label: 'Em carência', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  vencido: { label: 'Vencido', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  usado: { label: 'Usado', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500 ring-gray-200 line-through' },
};
const MOVIMENTOS_CB = {
  geracao: { label: 'Gerado', cls: 'text-emerald-700' },
  uso: { label: 'Usado', cls: 'text-rose-700' },
  estorno_uso: { label: 'Voltou (venda cancelada)', cls: 'text-emerald-700' },
  cancelamento: { label: 'Cancelado (venda cancelada)', cls: 'text-gray-500' },
  reativacao: { label: 'Reativado', cls: 'text-indigo-700' },
};

function Card({ rotulo, valor, cls = 'text-[#000638]' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{valor}</p>
    </div>
  );
}

export default function HcSaldosClientes() {
  const { user } = useAuth();
  const [f, setF] = useState({ empresa: '99', busca: '', todos: false, tipo: '' });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(null); // { clienteCode, empresa, nome }
  const [gerando, setGerando] = useState(false);
  const [aba, setAba] = useState('saldos'); // saldos | cashback
  const podeGerar = ['owner', 'admin'].includes(user?.role);

  const buscar = useCallback(async (filtros) => {
    setCarregando(true);
    setErro('');
    try {
      const qs = new URLSearchParams({ ...(filtros.empresa ? { empresa: filtros.empresa } : {}), ...(filtros.busca ? { busca: filtros.busca } : {}), ...(filtros.todos ? { todos: '1' } : {}), ...(filtros.tipo ? { tipo: filtros.tipo } : {}) });
      const j = await apiJson(`${API}?${qs}`);
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    buscar(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sincronizar = async () => {
    setCarregando(true);
    try {
      const j = await apiJson(`${API}/sincronizar-devolucoes`, { method: 'POST', body: {} });
      setAviso(j.message);
      await buscar(f);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  const tot = dados?.totais || {};
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Saldos de Clientes" subtitle="CREDEV e adiantamento do HeadCoach (usados no Faturamento e no Brejinho; devolução atendida soma ao CREDEV) e CASHBACK das lojas, copiado todo dia do saldo bônus do TOTVS" icon={Wallet} />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[
            { id: 'saldos', rotulo: 'Saldos (Credev, adiantamento, cashback antigo)', icone: Wallet },
            { id: 'cashback', rotulo: 'Cashback do HeadCoach', icone: Gift },
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ring-1 ${aba === a.id ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'}`}
            >
              <a.icone size={15} weight="bold" /> {a.rotulo}
            </button>
          ))}
          {podeGerar && aba === 'saldos' && (
            <button onClick={() => setGerando(true)} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
              <Plus size={15} weight="bold" /> GERAR CRÉDITO
            </button>
          )}
        </div>
        {aba === 'cashback' && <CashbackHeadcoach podeReativar={podeGerar} />}
        {aba === 'saldos' && (
        <>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar(f);
          }}
          className="mb-3 grid grid-cols-2 items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-[120px_150px_1fr_auto_auto]"
        >
          <div>
            <label className={labelCls}>Empresa</label>
            <input value={f.empresa} onChange={(e) => setF((x) => ({ ...x, empresa: e.target.value.replace(/\D/g, '') }))} placeholder="todas" inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Saldo</label>
            <select value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value }))} className={inputCls}>
              <option value="">Todos</option>
              <option value="credev">Credev</option>
              <option value="adiantamento">Adiantamento</option>
              <option value="cashback">Cashback</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Cliente (código ou nome)</label>
            <input value={f.busca} onChange={(e) => setF((x) => ({ ...x, busca: e.target.value }))} className={inputCls} />
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={f.todos} onChange={(e) => setF((x) => ({ ...x, todos: e.target.checked }))} className="mb-0 !h-3.5 !w-3.5" /> mostrar zerados
          </label>
          <button type="submit" disabled={carregando} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white disabled:opacity-40">
            {carregando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} BUSCAR
          </button>
        </form>
        {aviso && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{aviso}</p>}
        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {dados && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Card rotulo="Clientes" valor={tot.clientes} />
              <Card rotulo="Credev" valor={fmtBRL(tot.credev)} cls="text-emerald-700" />
              <Card rotulo="Adiantamento" valor={fmtBRL(tot.adiantamento)} cls="text-sky-700" />
              <Card rotulo="Cashback antigo (TOTVS)" valor={fmtBRL(tot.cashback)} cls="text-amber-700" />
              <Card rotulo="Total" valor={fmtBRL((tot.credev || 0) + (tot.adiantamento || 0) + (tot.cashback || 0))} />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Empresa</th>
                    <th className="px-2 py-2 text-right">Credev (carga)</th>
                    <th className="px-2 py-2 text-right">Credev (saldo)</th>
                    <th className="px-2 py-2 text-right">Adiant. (carga)</th>
                    <th className="px-2 py-2 text-right">Adiant. (saldo)</th>
                    <th className="px-2 py-2 text-right">Cashback</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2">Atualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dados.lista.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-2 py-10 text-center text-gray-400">
                        Nenhum cliente com saldo.
                      </td>
                    </tr>
                  )}
                  {dados.lista.map((c) => (
                    <tr key={`${c.empresa}-${c.clienteCode}`} onClick={() => setAberto(c)} className="cursor-pointer hover:bg-indigo-50/50">
                      <td className="max-w-[300px] truncate px-2 py-1.5">
                        <b className="tabular-nums text-[#000638]">{c.clienteCode}</b> · {c.nome || '—'}
                      </td>
                      <td className="px-2 py-1.5">{c.empresa}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{c.credevInicial ? fmtBRL(c.credevInicial) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-emerald-700">{fmtBRL(c.credev)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{c.adiantamentoInicial ? fmtBRL(c.adiantamentoInicial) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-sky-700">{fmtBRL(c.adiantamento)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-700">{c.cashback ? fmtBRL(c.cashback) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtBRL(c.total)}</td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-500">{fmtDataHora(c.atualizadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {['owner', 'admin'].includes(user?.role) && (
              <div className="mt-2 flex justify-end">
                <button onClick={sincronizar} disabled={carregando} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40">
                  <ArrowsClockwise size={13} /> Conferir devoluções que faltam creditar
                </button>
              </div>
            )}
          </>
        )}
        </>
        )}
        {aberto && <Extrato cliente={aberto} onFechar={() => setAberto(null)} />}
        {gerando && (
          <GerarCredito
            empresaPadrao={f.empresa || '99'}
            onFechar={() => setGerando(false)}
            onGerado={(msg) => {
              setGerando(false);
              setAviso(msg);
              buscar(f);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Gerar CREDEV ou adiantamento para um cliente numa empresa (só owner/admin, com senha e motivo)
function GerarCredito({ empresaPadrao, onFechar, onGerado }) {
  const [cliente, setCliente] = useState(null);
  const [empresa, setEmpresa] = useState(String(empresaPadrao || '99'));
  const [tipo, setTipo] = useState('credev');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [atual, setAtual] = useState(null);
  const num = (v) => {
    const t = String(v || '').trim();
    return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) || 0;
  };
  // saldo atual do cliente na empresa escolhida
  useEffect(() => {
    setAtual(null);
    if (!cliente?.code || !(Number(empresa) > 0)) return undefined;
    let vivo = true;
    apiJson(`${API}/cliente/${cliente.code}?empresa=${empresa}`)
      .then((j) => vivo && setAtual(j.data.saldo))
      .catch(() => vivo && setAtual(null));
    return () => {
      vivo = false;
    };
  }, [cliente?.code, empresa]);
  const pronto = cliente?.code && Number(empresa) > 0 && num(valor) > 0 && motivo.trim().length >= 5 && senha;
  const gerar = async () => {
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/gerar`, {
        method: 'POST',
        body: { empresa: Number(empresa), clienteCode: cliente.code, clienteNome: cliente.name, tipo, valor: String(valor), motivo: motivo.trim(), senha },
      });
      onGerado(j.message);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#000638]">Gerar CREDEV ou adiantamento</h3>
            <p className="text-xs text-gray-500">Só owner ou admin. Fica no extrato do cliente com quem gerou e o motivo.</p>
          </div>
          <button onClick={onFechar} disabled={busy} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <ClientePicker value={cliente} onSelect={setCliente} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Empresa</label>
              <input value={empresa} onChange={(e) => setEmpresa(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                <option value="credev">Credev</option>
                <option value="adiantamento">Adiantamento</option>
              </select>
            </div>
          </div>
          {cliente && atual && (
            <p className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 ring-1 ring-gray-200">
              Saldo atual na empresa {empresa}: Credev <b>{fmtBRL(atual.credev)}</b> · Adiantamento <b>{fmtBRL(atual.adiantamento)}</b>
            </p>
          )}
          <div>
            <label className={labelCls}>Valor</label>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="mb-0 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-lg font-bold tabular-nums text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
            />
          </div>
          <div>
            <label className={labelCls}>Motivo</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: acordo comercial, devolução fora do sistema" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sua senha do HeadCoach</label>
            <input type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
          </div>
          {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
          <button onClick={gerar} disabled={busy || !pronto} className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
            {busy ? <Spinner size={16} className="animate-spin" /> : <CheckCircle size={16} weight="bold" />} GERAR {tipo === 'credev' ? 'CREDEV' : 'ADIANTAMENTO'}
            {num(valor) > 0 ? ` DE ${fmtBRL(num(valor))}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function Extrato({ cliente, onFechar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    apiJson(`${API}/cliente/${cliente.clienteCode}?empresa=${cliente.empresa}`)
      .then((j) => setD(j.data))
      .catch((e) => setErro(e.message));
  }, [cliente.clienteCode, cliente.empresa]);
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[#000638]">
              {cliente.clienteCode} · {cliente.nome || 'Cliente'}
            </h3>
            <p className="text-xs text-gray-500">Empresa {cliente.empresa}</p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {!d ? (
          !erro && (
            <div className="py-10 text-center text-gray-400">
              <Spinner size={20} className="mx-auto animate-spin" />
            </div>
          )
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Card rotulo="Credev" valor={fmtBRL(d.saldo.credev)} cls="text-emerald-700" />
              <Card rotulo="Adiantamento" valor={fmtBRL(d.saldo.adiantamento)} cls="text-sky-700" />
              <Card rotulo="Cashback" valor={fmtBRL(d.saldo.cashback)} cls="text-amber-700" />
              <Card rotulo="Credev + adiant." valor={fmtBRL(d.saldo.total)} />
            </div>
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Extrato</p>
            {d.extrato.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">Sem movimentos.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="py-1">Quando</th>
                    <th className="py-1">Saldo</th>
                    <th className="py-1">Movimento</th>
                    <th className="py-1 text-right">Valor</th>
                    <th className="py-1 text-right">Saldo depois</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {d.extrato.map((m) => (
                    <tr key={m.id}>
                      <td className="py-1.5 tabular-nums text-gray-500">{fmtDataHora(m.em)}</td>
                      <td className="py-1.5">{TIPOS[m.tipo] || m.tipo}</td>
                      <td className="py-1.5">
                        <span className={`font-semibold ${MOVIMENTOS[m.movimento]?.cls || ''}`}>{MOVIMENTOS[m.movimento]?.label || m.movimento}</span>
                        <span className="block text-[10.5px] text-gray-500">{[m.observacao, m.referencia, m.por].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className={`py-1.5 text-right font-semibold tabular-nums ${Number(m.valor) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtBRL(m.valor)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtBRL(m.saldo_depois)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── CASHBACK DO HEADCOACH ───────────────────────────────────────────────────
// Totais, clientes, histórico de geração e uso, e reativação do que venceu.
function CashbackHeadcoach({ podeReativar }) {
  const [busca, setBusca] = useState('');
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(null); // cliente
  const [reativar, setReativar] = useState(null); // { todos: true } | { cliente, nome, valor } | { lotes: [id], nome, valor }

  const carregar = useCallback(async (termo) => {
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/cashback${termo ? `?busca=${encodeURIComponent(termo)}` : ''}`);
      setD(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar('');
  }, [carregar]);

  const t = d?.totais || {};
  const regras = d?.regras || { pct: 20, carenciaDias: 3, validadeDias: 90 };
  return (
    <>
      <p className="mb-3 rounded-xl bg-white px-3 py-2 text-xs text-gray-600 shadow-sm ring-1 ring-gray-200">
        Toda venda do <b>PDV Crosby</b> com cliente identificado gera <b>{regras.pct}%</b> de cashback. Ele só pode ser usado depois de <b>{regras.carenciaDias} dias</b> (carência) e vale até o dia{' '}
        <b>{regras.carenciaDias + regras.validadeDias}</b>, em qualquer loja. Depois disso deixa de contar no saldo, mas <b>nada é apagado</b>: o vencido fica guardado e pode ser reativado. O saldo antigo do TOTVS continua valendo e é
        usado primeiro.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          carregar(busca.trim());
        }}
        className="mb-3 grid grid-cols-[1fr_auto] items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto_auto]"
      >
        <div>
          <label className={labelCls}>Cliente (código ou nome)</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} className={inputCls} />
        </div>
        <button type="submit" disabled={carregando} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white disabled:opacity-40">
          {carregando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} BUSCAR
        </button>
        {podeReativar && (
          <button
            type="button"
            onClick={() => setReativar({ todos: true, valor: t.vencido })}
            disabled={!(t.vencido > 0)}
            title={t.vencido > 0 ? 'Faz o cashback vencido de todos os clientes voltar a valer' : 'Não há cashback vencido'}
            className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40 sm:col-span-1"
          >
            <ClockCounterClockwise size={15} weight="bold" /> REATIVAR VENCIDOS
          </button>
        )}
      </form>
      {aviso && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{aviso}</p>}
      {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {d && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Card rotulo="Gerado" valor={fmtBRL(t.gerado)} />
            <Card rotulo="Usado" valor={fmtBRL(t.usado)} cls="text-gray-700" />
            <Card rotulo="Disponível" valor={fmtBRL(t.disponivel)} cls="text-emerald-700" />
            <Card rotulo="Em carência" valor={fmtBRL(t.carencia)} cls="text-amber-700" />
            <Card rotulo="Vencido (guardado)" valor={fmtBRL(t.vencido)} cls="text-rose-700" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2">Cliente</th>
                  <th className="px-2 py-2 text-right">Gerado</th>
                  <th className="px-2 py-2 text-right">Usado</th>
                  <th className="px-2 py-2 text-right">Disponível</th>
                  <th className="px-2 py-2 text-right">Em carência</th>
                  <th className="px-2 py-2 text-right">Vencido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.clientes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-10 text-center text-gray-400">
                      Nenhum cashback gerado no HeadCoach ainda.
                    </td>
                  </tr>
                )}
                {d.clientes.map((c) => (
                  <tr key={c.clienteCode} onClick={() => setAberto(c)} className="cursor-pointer hover:bg-indigo-50/50">
                    <td className="max-w-[320px] truncate px-2 py-1.5">
                      <b className="tabular-nums text-[#000638]">{c.clienteCode}</b> · {c.nome || '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL(c.gerado)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{c.usado ? fmtBRL(c.usado) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-emerald-700">{c.disponivel ? fmtBRL(c.disponivel) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">{c.carencia ? fmtBRL(c.carencia) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-rose-700">{c.vencido ? fmtBRL(c.vencido) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {aberto && (
        <CashbackDoCliente
          cliente={aberto}
          podeReativar={podeReativar}
          onFechar={() => setAberto(null)}
          onReativar={(alvo) => setReativar(alvo)}
        />
      )}
      {reativar && (
        <ReativarCashback
          alvo={reativar}
          diasPadrao={regras.validadeDias}
          onFechar={() => setReativar(null)}
          onFeito={(msg) => {
            setReativar(null);
            setAberto(null);
            setAviso(msg);
            carregar(busca.trim());
          }}
        />
      )}
    </>
  );
}

// Histórico do cliente: cada geração (lote) com o que já foi usado e a validade, e o extrato
function CashbackDoCliente({ cliente, podeReativar, onFechar, onReativar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    apiJson(`${API}/cashback/cliente/${cliente.clienteCode}`)
      .then((j) => setD(j.data))
      .catch((e) => setErro(e.message));
  }, [cliente.clienteCode]);
  const vencidos = (d?.lotes || []).filter((l) => l.situacao === 'vencido');
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-6 w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[#000638]">
              {cliente.clienteCode} · {cliente.nome || 'Cliente'}
            </h3>
            <p className="text-xs text-gray-500">Cashback do HeadCoach — vale em qualquer loja</p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {!d ? (
          !erro && (
            <div className="py-10 text-center text-gray-400">
              <Spinner size={20} className="mx-auto animate-spin" />
            </div>
          )
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Card rotulo="Disponível" valor={fmtBRL(d.saldo.disponivel)} cls="text-emerald-700" />
              <Card rotulo="Em carência" valor={fmtBRL(d.saldo.emCarencia)} cls="text-amber-700" />
              <Card rotulo="Vencido (guardado)" valor={fmtBRL(d.saldo.vencido)} cls="text-rose-700" />
            </div>
            <div className="mb-1 flex items-center gap-2">
              <p className="flex-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Gerações</p>
              {podeReativar && vencidos.length > 0 && (
                <button
                  onClick={() => onReativar({ cliente: cliente.clienteCode, nome: cliente.nome, valor: d.saldo.vencido })}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 text-[11px] font-bold text-white hover:bg-indigo-700"
                >
                  <ClockCounterClockwise size={13} weight="bold" /> REATIVAR O VENCIDO ({fmtBRL(d.saldo.vencido)})
                </button>
              )}
            </div>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="py-1">Gerado em</th>
                    <th className="py-1">Venda</th>
                    <th className="py-1 text-right">Valor</th>
                    <th className="py-1 text-right">Usado</th>
                    <th className="py-1 text-right">Saldo</th>
                    <th className="py-1 pl-3">Libera em</th>
                    <th className="py-1">Vale até</th>
                    <th className="py-1">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {d.lotes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400">
                        Sem cashback gerado.
                      </td>
                    </tr>
                  )}
                  {d.lotes.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1.5 tabular-nums text-gray-500">{fmtDataHora(l.geradoEm)}</td>
                      <td className="py-1.5">
                        {l.vendaId ? (
                          <>
                            nº <b className="tabular-nums">{l.vendaId}</b> <span className="text-gray-400">· emp. {l.empresa}</span>
                          </>
                        ) : (
                          l.observacao || '—'
                        )}
                        {l.base ? <span className="block text-[10.5px] text-gray-400">{l.pct}% de {fmtBRL(l.base)}</span> : null}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{fmtBRL(l.valor)}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-500">{l.usado ? fmtBRL(l.usado) : '—'}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{l.situacao === 'cancelado' ? '—' : fmtBRL(l.saldo)}</td>
                      <td className="py-1.5 pl-3 tabular-nums">{fmtDia(l.liberaEm)}</td>
                      <td className="py-1.5 tabular-nums">{fmtDia(l.expiraEm)}</td>
                      <td className="py-1.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${SITUACOES_CB[l.situacao]?.cls || ''}`}>{SITUACOES_CB[l.situacao]?.label || l.situacao}</span>
                        {l.reativadoEm && <span className="block text-[10px] text-indigo-600">reativado em {fmtDia(l.reativadoEm)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Extrato (geração e uso)</p>
            {d.movimentos.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">Sem movimentos.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="py-1">Quando</th>
                    <th className="py-1">Movimento</th>
                    <th className="py-1">Venda</th>
                    <th className="py-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {d.movimentos.map((m) => (
                    <tr key={m.id}>
                      <td className="py-1.5 tabular-nums text-gray-500">{fmtDataHora(m.em)}</td>
                      <td className="py-1.5">
                        <span className={`font-semibold ${MOVIMENTOS_CB[m.movimento]?.cls || ''}`}>{MOVIMENTOS_CB[m.movimento]?.label || m.movimento}</span>
                        <span className="block text-[10.5px] text-gray-500">{[m.observacao, m.por].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="py-1.5 tabular-nums">{m.vendaId ? `nº ${m.vendaId}${m.empresa ? ` · emp. ${m.empresa}` : ''}` : '—'}</td>
                      <td className={`py-1.5 text-right font-semibold tabular-nums ${Number(m.valor) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtBRL(m.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Reativar cashback vencido (owner/admin, com motivo e senha): volta a valer por N dias a partir de hoje
function ReativarCashback({ alvo, diasPadrao, onFechar, onFeito }) {
  const [dias, setDias] = useState(String(diasPadrao || 90));
  const [motivo, setMotivo] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const n = parseInt(dias, 10) || 0;
  const ate = n > 0 ? new Date(Date.now() + n * 86400000).toLocaleDateString('pt-BR') : null;
  const pronto = n >= 1 && n <= 730 && motivo.trim().length >= 5 && senha;
  const confirmar = async () => {
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/cashback/reativar`, {
        method: 'POST',
        body: { ...(alvo.todos ? { todos: true } : alvo.lotes ? { lotes: alvo.lotes } : { cliente: alvo.cliente }), dias: n, motivo: motivo.trim(), senha },
      });
      onFeito(j.message);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#000638]">Reativar cashback vencido</h3>
            <p className="text-xs text-gray-500">
              {alvo.todos ? 'De TODOS os clientes' : `Do cliente ${alvo.cliente || ''}${alvo.nome ? ` · ${alvo.nome}` : ''}`}
              {alvo.valor > 0 ? ` — ${fmtBRL(alvo.valor)}` : ''}. Só owner ou admin; fica no extrato com quem reativou e o motivo.
            </p>
          </div>
          <button onClick={onFechar} disabled={busy} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Volta a valer por quantos dias (a partir de hoje)</label>
            <input value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={inputCls} />
            {ate && <p className="mt-1 text-[11px] text-gray-500">O cliente pode usar já, até {ate}.</p>}
          </div>
          <div>
            <label className={labelCls}>Motivo</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: campanha de fim de ano" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sua senha do HeadCoach</label>
            <input type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
          </div>
          {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
          <button onClick={confirmar} disabled={busy || !pronto} className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
            {busy ? <Spinner size={16} className="animate-spin" /> : <ClockCounterClockwise size={16} weight="bold" />} REATIVAR{alvo.valor > 0 ? ` ${fmtBRL(alvo.valor)}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
