// ============================================================================
// ENTRE CONTAS (Stone) — janela aberta pelo card de saldos da Liberação de
// Pagamento do HeadCoach. Yago, 24/11/2026.
//
// Escolhe a(s) conta(s) de origem e a conta de destino e clica em TRANSFERIR: o
// pedido entra na fila do bot, que inclui o Pix para a chave aleatória da conta
// de destino; o Fábio aprova no app da Stone e o HeadCoach marca como FEITA
// quando a saída aparece no extrato. "Todo o saldo" de várias contas para uma
// só = uma transferência por conta de origem.
//
// O destino é sempre uma conta do grupo com a chave guardada (aba "Chaves" desta
// janela). Rotas: /api/stone-bot/transferencias e /api/stone-bot/contas/:id/chave.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsLeftRight, Spinner, X, Key, CheckCircle, Warning, Clock, ArrowsClockwise } from '@phosphor-icons/react';
import { apiJson } from '../utils/apiAuth';

const API = '/api/stone-bot';
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const fmtQuando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500';
const COR = {
  fila: 'bg-gray-100 text-gray-700 border-gray-300',
  processando: 'bg-blue-100 text-blue-800 border-blue-300',
  incluido: 'bg-amber-100 text-amber-800 border-amber-300',
  efetivada: 'bg-green-100 text-green-800 border-green-300',
  erro: 'bg-rose-100 text-rose-800 border-rose-300',
  bloqueado: 'bg-rose-100 text-rose-800 border-rose-300',
  verificar: 'bg-orange-100 text-orange-800 border-orange-300',
  cancelada: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function StoneEntreContasModal({ onFechar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState('transferir'); // transferir | chaves
  const [destino, setDestino] = useState('');
  const [origens, setOrigens] = useState(() => new Set());
  const [tudo, setTudo] = useState(true);
  const [valor, setValor] = useState('');
  const [senha, setSenha] = useState('');
  const [chaves, setChaves] = useState({}); // id da conta → texto colado

  const carregar = useCallback(async () => {
    try {
      const j = await apiJson(`${API}/transferencias`);
      setDados(j.data);
      setErro('');
    } catch (e) {
      setErro(e.message);
    }
  }, []);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 20000); // acompanha a fila enquanto a janela está aberta
    return () => clearInterval(t);
  }, [carregar]);

  const contas = dados?.contas || [];
  const semChave = contas.filter((c) => !c.temChave).length;
  const candidatas = useMemo(() => contas.filter((c) => c.id !== destino), [contas, destino]);
  const marcadas = candidatas.filter((c) => origens.has(c.id));
  const totalMarcado = marcadas.reduce((t, c) => t + Number(c.saldo || 0), 0);
  const umaSo = marcadas.length === 1;
  const valorNum = num(valor);
  const podeTransferir = !!destino && marcadas.length > 0 && !!senha && (tudo || (umaSo && valorNum > 0));
  const alternar = (id) =>
    setOrigens((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const transferir = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      const j = await apiJson(`${API}/transferencias`, { method: 'POST', body: { origens: marcadas.map((c) => c.id), destino, tudo, valor: tudo ? undefined : valorNum, senha } });
      setAviso({ tipo: 'ok', msg: `${j.message || 'Transferência na fila'}. O bot inclui na Stone e avisa o Fábio no grupo para aprovar.` });
      setSenha('');
      setOrigens(new Set());
      setValor('');
      await carregar();
    } catch (e) {
      setAviso({ tipo: 'erro', msg: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const salvarChave = async (c) => {
    setOcupado(true);
    setAviso(null);
    try {
      await apiJson(`${API}/contas/${encodeURIComponent(c.id)}/chave`, { method: 'PUT', body: { chave: chaves[c.id] } });
      setChaves((x) => ({ ...x, [c.id]: '' }));
      setAviso({ tipo: 'ok', msg: `Chave da conta ${c.final} guardada.` });
      await carregar();
    } catch (e) {
      setAviso({ tipo: 'erro', msg: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const cancelar = async (t) => {
    setOcupado(true);
    try {
      await apiJson(`${API}/transferencias/${t.id}/cancelar`, { method: 'POST' });
      await carregar();
    } catch (e) {
      setAviso({ tipo: 'erro', msg: e.message });
    } finally {
      setOcupado(false);
    }
  };

  const contaDestino = contas.find((c) => c.id === destino);
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <ArrowsLeftRight size={20} weight="bold" className="text-[#000638]" />
          <h3 className="flex-1 text-lg font-bold text-[#000638]">Entre contas · Stone</h3>
          <button onClick={carregar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" title="Atualizar">
            <ArrowsClockwise size={16} />
          </button>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {aviso && <p className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{aviso.msg}</p>}
        {dados && dados.ativo === false && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">A transferência entre contas está desligada no servidor.</p>}

        <div className="mb-3 inline-flex overflow-hidden rounded-lg ring-1 ring-gray-300">
          {[
            { k: 'transferir', rotulo: 'Transferir', Icone: ArrowsLeftRight },
            { k: 'chaves', rotulo: `Chaves Pix das contas${semChave ? ` (${semChave} sem chave)` : ''}`, Icone: Key },
          ].map((v) => (
            <button key={v.k} type="button" onClick={() => setAba(v.k)} className={`inline-flex h-8 items-center gap-1.5 px-3 text-xs font-bold ${aba === v.k ? 'bg-[#000638] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <v.Icone size={14} weight="bold" /> {v.rotulo}
            </button>
          ))}
        </div>

        {!dados ? (
          <div className="py-10 text-center text-sm text-gray-400">Carregando as contas…</div>
        ) : aba === 'chaves' ? (
          <div>
            <p className="mb-2 text-xs text-gray-600">
              A transferência vai por Pix para a <b>chave aleatória</b> da conta de destino. Cole aqui a chave de cada conta (no app da Stone: Pix › Minhas chaves). Só conta com a chave guardada pode receber.
            </p>
            <div className="max-h-[55vh] overflow-auto rounded-lg ring-1 ring-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5">Conta</th>
                    <th className="px-2 py-1.5">Titular</th>
                    <th className="px-2 py-1.5">Chave guardada</th>
                    <th className="px-2 py-1.5">Colar chave aleatória</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-2 py-1.5 font-bold">Stone {c.final}</td>
                      <td className="px-2 py-1.5 text-gray-600">{c.titular}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {c.temChave ? (
                          <span className="inline-flex items-center gap-1 text-green-700" title={`${c.chaveOrigem === 'portal' ? 'Lida no portal' : 'Colada na tela'} em ${fmtQuando(c.chaveEm)}`}>
                            <CheckCircle size={13} weight="fill" /> {c.chave}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Warning size={13} weight="bold" /> sem chave
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1.5">
                          <input value={chaves[c.id] || ''} onChange={(e) => setChaves((x) => ({ ...x, [c.id]: e.target.value }))} placeholder="00000000-0000-0000-0000-000000000000" className="h-8 w-full min-w-[260px] rounded border border-gray-300 px-2 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#000638]/40" />
                          <button type="button" disabled={ocupado || !(chaves[c.id] || '').trim()} onClick={() => salvarChave(c)} className="h-8 rounded bg-[#000638] px-2.5 text-[11px] font-bold text-white hover:bg-indigo-900 disabled:opacity-40">
                            {c.temChave ? 'Trocar' : 'Guardar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr]">
              {/* origem */}
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className={labelCls}>De (origem)</span>
                  <button type="button" onClick={() => setOrigens(new Set(candidatas.filter((c) => Number(c.saldo) > 0).map((c) => c.id)))} className="text-[11px] font-semibold text-indigo-700 underline">
                    todas com saldo
                  </button>
                  {origens.size > 0 && (
                    <button type="button" onClick={() => setOrigens(new Set())} className="text-[11px] font-semibold text-gray-500 underline">
                      limpar
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-gray-200">
                  {candidatas.map((c) => (
                    <label key={c.id} className={`flex cursor-pointer items-center gap-2 border-b border-gray-100 px-2 py-1.5 text-xs last:border-0 ${origens.has(c.id) ? 'bg-indigo-50/70' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={origens.has(c.id)} onChange={() => alternar(c.id)} />
                      <span className="w-[78px] font-bold">Stone {c.final}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-500" title={c.titular}>
                        {c.titular}
                      </span>
                      <b className={`tabular-nums ${Number(c.saldo) > 0 ? 'text-gray-900' : 'font-medium text-gray-400'}`}>{c.saldo == null ? '—' : fmtBRL(c.saldo)}</b>
                    </label>
                  ))}
                </div>
              </div>
              <div className="hidden items-center md:flex">
                <ArrowsLeftRight size={22} className="text-gray-300" />
              </div>
              {/* destino */}
              <div>
                <label className={labelCls}>Para (destino)</label>
                <select
                  value={destino}
                  onChange={(e) => {
                    setDestino(e.target.value);
                    setOrigens((a) => new Set([...a].filter((id) => id !== e.target.value)));
                  }}
                  className={inputCls}
                >
                  <option value="">Escolha a conta…</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.temChave}>
                      Stone {c.final} · {c.titular}
                      {c.temChave ? '' : ' (sem chave Pix)'}
                    </option>
                  ))}
                </select>
                {contaDestino && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Saldo hoje: <b className="text-gray-800">{fmtBRL(contaDestino.saldo)}</b> · chave {contaDestino.chave}
                  </p>
                )}
                <div className="mt-3">
                  <span className={labelCls}>Quanto</span>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="inline-flex items-center gap-1.5">
                      <input type="radio" checked={tudo} onChange={() => setTudo(true)} /> Todo o saldo de cada conta
                    </label>
                    <label className={`inline-flex items-center gap-1.5 ${umaSo ? '' : 'text-gray-400'}`} title={umaSo ? '' : 'Valor digitado só com uma conta de origem'}>
                      <input type="radio" checked={!tudo} disabled={!umaSo} onChange={() => setTudo(false)} /> Um valor
                    </label>
                    {!tudo && umaSo && <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="h-8 w-32 rounded border border-gray-300 px-2 text-sm" />}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {marcadas.length} conta(s) de origem
                    {tudo ? (
                      <>
                        {' '}
                        · cerca de <b className="text-gray-800">{fmtBRL(totalMarcado)}</b> pelo saldo da última consulta (o bot usa o saldo que estiver na conta na hora)
                      </>
                    ) : umaSo && valorNum > 0 ? (
                      <>
                        {' '}
                        · <b className="text-gray-800">{fmtBRL(valorNum)}</b>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="mt-3">
                  <label className={labelCls}>Sua senha do HeadCoach</label>
                  <input type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
                </div>
                <button type="button" disabled={ocupado || !podeTransferir || dados.ativo === false} onClick={transferir} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#000638] text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-40">
                  {ocupado ? <Spinner size={16} className="animate-spin" /> : <ArrowsLeftRight size={16} weight="bold" />} TRANSFERIR
                </button>
                <p className="mt-1.5 text-[11px] text-gray-500">O bot inclui o Pix na Stone e o dinheiro só sai quando o Fábio aprova no app. Precisa do bot ligado e logado na Stone.</p>
              </div>
            </div>

            {/* fila e histórico */}
            <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-gray-500">Últimas transferências (15 dias)</p>
            <div className="max-h-52 overflow-auto rounded-lg ring-1 ring-gray-200">
              {dados.transferencias.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">Nenhuma transferência pedida.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5">Pedida em</th>
                      <th className="px-2 py-1.5">De → Para</th>
                      <th className="px-2 py-1.5 text-right">Valor</th>
                      <th className="px-2 py-1.5">Situação</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {dados.transferencias.map((t) => (
                      <tr key={t.id} className="border-t border-gray-100 align-top">
                        <td className="whitespace-nowrap px-2 py-1.5 text-gray-600" title={t.solicitadoPor || ''}>
                          {fmtQuando(t.criadoEm)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 font-bold">
                          {t.origem} → {t.destino}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{t.valor != null ? fmtBRL(t.valor) : t.tudo ? 'todo o saldo' : '—'}</td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${COR[t.status] || ''}`}>
                            {t.status === 'efetivada' ? <CheckCircle size={11} weight="fill" /> : t.status === 'incluido' || t.status === 'fila' || t.status === 'processando' ? <Clock size={11} weight="bold" /> : <Warning size={11} weight="bold" />}
                            {t.situacao}
                          </span>
                          {t.status === 'efetivada' && <span className="ml-1 text-[10px] text-gray-500">{t.entradaConfirmada ? 'saída e entrada no extrato' : 'saída no extrato'}</span>}
                          {t.erro && <div className="mt-0.5 text-[10px] text-rose-700">{t.erro}</div>}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {t.status === 'fila' && (
                            <button type="button" disabled={ocupado} onClick={() => cancelar(t)} className="text-[11px] font-semibold text-rose-700 underline disabled:opacity-40">
                              cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
