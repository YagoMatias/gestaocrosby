// ============================================================================
// HEADCOACH › SALDOS DE CLIENTES (Yago, 13/11/2026) — CREDEV e adiantamento
// próprios do HeadCoach, por cliente e empresa. Carga inicial do TOTVS (empresa
// 99, clientes com CREDEV/adiantamento em 2026); o Faturamento e o Faturamento
// Brejinho consomem daqui; devolução atendida soma ao CREDEV do cliente.
// Clicando no cliente: o extrato (carga, usos, estornos, devoluções).
// API: /api/hc/saldos-clientes (exige login) — services/hcSaldosClientes.js
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, MagnifyingGlass, Spinner, X, ArrowsClockwise, Plus, CheckCircle } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';
import { ClientePicker } from './DevolucaoRFID';

const API = '/api/hc/saldos-clientes';
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const TIPOS = { credev: 'Credev', adiantamento: 'Adiantamento' };
const MOVIMENTOS = {
  carga_inicial: { label: 'Carga inicial (TOTVS)', cls: 'text-indigo-700' },
  devolucao: { label: 'Devolução', cls: 'text-emerald-700' },
  devolucao_cancelada: { label: 'Devolução cancelada', cls: 'text-rose-700' },
  uso: { label: 'Usado no faturamento', cls: 'text-rose-700' },
  estorno: { label: 'Estorno (voltou)', cls: 'text-emerald-700' },
  ajuste: { label: 'Gerado manualmente', cls: 'text-indigo-700' },
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
  const [f, setF] = useState({ empresa: '99', busca: '', todos: false });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(null); // { clienteCode, empresa, nome }
  const [gerando, setGerando] = useState(false);
  const podeGerar = ['owner', 'admin'].includes(user?.role);

  const buscar = useCallback(async (filtros) => {
    setCarregando(true);
    setErro('');
    try {
      const qs = new URLSearchParams({ ...(filtros.empresa ? { empresa: filtros.empresa } : {}), ...(filtros.busca ? { busca: filtros.busca } : {}), ...(filtros.todos ? { todos: '1' } : {}) });
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
        <PageTitle title="Saldos de Clientes" subtitle="CREDEV e adiantamento do HeadCoach — usados no Faturamento e no Brejinho; devolução atendida soma ao CREDEV" icon={Wallet} />
        {podeGerar && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setGerando(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
              <Plus size={15} weight="bold" /> GERAR CRÉDITO
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar(f);
          }}
          className="mb-3 grid grid-cols-2 items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-[120px_1fr_auto_auto]"
        >
          <div>
            <label className={labelCls}>Empresa</label>
            <input value={f.empresa} onChange={(e) => setF((x) => ({ ...x, empresa: e.target.value.replace(/\D/g, '') }))} placeholder="todas" inputMode="numeric" className={inputCls} />
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
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Card rotulo="Clientes" valor={tot.clientes} />
              <Card rotulo="Credev" valor={fmtBRL(tot.credev)} cls="text-emerald-700" />
              <Card rotulo="Adiantamento" valor={fmtBRL(tot.adiantamento)} cls="text-sky-700" />
              <Card rotulo="Total" valor={fmtBRL((tot.credev || 0) + (tot.adiantamento || 0))} />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Empresa</th>
                    <th className="px-2 py-2 text-right">Credev (carga)</th>
                    <th className="px-2 py-2 text-right">Credev (saldo)</th>
                    <th className="px-2 py-2 text-right">Adiant. (carga)</th>
                    <th className="px-2 py-2 text-right">Adiant. (saldo)</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2">Atualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dados.lista.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-2 py-10 text-center text-gray-400">
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
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Card rotulo="Credev" valor={fmtBRL(d.saldo.credev)} cls="text-emerald-700" />
              <Card rotulo="Adiantamento" valor={fmtBRL(d.saldo.adiantamento)} cls="text-sky-700" />
              <Card rotulo="Total" valor={fmtBRL(d.saldo.total)} />
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
