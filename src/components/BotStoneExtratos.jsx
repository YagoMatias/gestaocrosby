// Aba "Bot Stone" do Extrato Bancário (/fluxo-caixa-ext).
// Mostra o agente local (bots/stone-extratos no PC do financeiro), enfileira
// uma execução ("Baixar extratos agora"), acompanha o log em tempo real e
// exibe os saldos por conta Stone capturados (o total vai para a Liberação
// de Pagamento, saldo_bancario.banco = STONE).
// Backend: /api/stone-bot (routes/stoneBot.routes.js).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, CalendarBlank, Check, CloudArrowDown, Robot, Warning, X, Pulse, Bank, CaretDown, CaretRight, Clock, Prohibit } from '@phosphor-icons/react';
import { apiJson } from '../utils/apiAuth';

const fmt = (v) => (v != null && !Number.isNaN(Number(v)) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—');
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtHoraLog = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
const relativo = (iso) => {
  if (!iso) return 'nunca';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `há ${s}s`;
  if (s < 5400) return `há ${Math.round(s / 60)} min`;
  if (s < 172800) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} dias`;
};
const duracao = (a, b) => {
  if (!a) return '';
  const s = Math.round((new Date(b || Date.now()).getTime() - new Date(a).getTime()) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
};

const STATUS = {
  pendente: { label: 'Na fila', cor: 'bg-gray-100 text-gray-700 border-gray-300' },
  rodando: { label: 'Rodando', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
  concluido: { label: 'Concluída', cor: 'bg-green-100 text-green-800 border-green-300' },
  erro: { label: 'Com erro', cor: 'bg-red-100 text-red-700 border-red-300' },
  cancelado: { label: 'Cancelada', cor: 'bg-gray-100 text-gray-500 border-gray-300' },
};
const NIVEL = { ok: 'text-green-700', erro: 'text-red-700 font-medium', aviso: 'text-amber-700', info: 'text-gray-700' };

const Chip = ({ cfg, children }) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${cfg.cor}`}>{children}</span>;

const Log = ({ linhas }) => {
  const fim = useRef(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' });
  }, [linhas?.length]);
  if (!linhas?.length) return <p className="text-xs text-gray-400 px-3 py-2">Sem log ainda.</p>;
  return (
    <div className="max-h-80 overflow-auto bg-gray-900 text-[11px] font-mono rounded-lg p-3 space-y-0.5">
      {linhas.map((l, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gray-500 shrink-0">{fmtHoraLog(l.t)}</span>
          <span className={{ ok: 'text-green-400', erro: 'text-red-400', aviso: 'text-amber-300', info: 'text-gray-200' }[l.nivel] || 'text-gray-200'}>{l.msg}</span>
        </div>
      ))}
      <div ref={fim} />
    </div>
  );
};

const BotStoneExtratos = ({ onImportou }) => {
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  const [migracao, setMigracao] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [aberta, setAberta] = useState(null); // id da execução expandida
  const [detalhe, setDetalhe] = useState(null); // execução com log
  const ultimaConcluida = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const j = await apiJson('/api/stone-bot/status');
      setStatus(j.data);
      setErro(null);
      setMigracao(false);
      // terminou uma execução desde a última leitura → recarrega o painel do extrato
      const ult = j.data?.execucoes?.find((e) => ['concluido', 'erro'].includes(e.status));
      if (ult && ultimaConcluida.current && ultimaConcluida.current !== ult.id) onImportou?.();
      if (ult) ultimaConcluida.current = ult.id;
    } catch (e) {
      if (e.status === 503 && /MIGRATION/i.test(e.body?.error || '')) setMigracao(true);
      else setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [onImportou]);

  const carregarDetalhe = useCallback(async (id) => {
    try {
      const j = await apiJson(`/api/stone-bot/execucoes/${id}`);
      setDetalhe(j.data);
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const emAndamento = status?.emAndamento;
  useEffect(() => {
    const ms = emAndamento ? 4000 : 30000;
    const t = setInterval(carregar, ms);
    return () => clearInterval(t);
  }, [emAndamento, carregar]);

  useEffect(() => {
    if (!aberta) return undefined;
    carregarDetalhe(aberta);
    const rodando = status?.execucoes?.find((e) => e.id === aberta && ['pendente', 'rodando'].includes(e.status));
    if (!rodando) return undefined;
    const t = setInterval(() => carregarDetalhe(aberta), 3000);
    return () => clearInterval(t);
  }, [aberta, status, carregarDetalhe]);

  const solicitar = async () => {
    setEnviando(true);
    try {
      const body = de && ate ? { de, ate } : {};
      const j = await apiJson('/api/stone-bot/execucoes', { method: 'POST', body });
      setAberta(j.data?.execucao?.id || null);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const [pagarmeRodando, setPagarmeRodando] = useState(false);
  const atualizarPagarme = async () => {
    setPagarmeRodando(true);
    try {
      const j = await apiJson('/api/stone-bot/pagarme/executar', { method: 'POST', body: de && ate ? { de, ate } : {}, timeoutMs: 300000 });
      if (j.data?.falhas) setErro(j.message || 'Pagar.me: houve falhas (veja o log do servidor).');
      await carregar();
      onImportou?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setPagarmeRodando(false);
    }
  };

  const cancelar = async (id) => {
    if (!window.confirm('Cancelar esta execução pendente?')) return;
    try {
      await apiJson(`/api/stone-bot/execucoes/${id}`, { method: 'DELETE' });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const agente = status?.agentes?.[0];
  const online = !!status?.online;

  return (
    <div className="p-3 md:p-4 space-y-4">
      {migracao && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span>
            As tabelas do bot ainda não existem. Rode <code className="font-mono">migrations/stone_bot.sql</code> no Supabase.
          </span>
        </div>
      )}
      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Cabeçalho: agente + saldo + ação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 flex items-center gap-1">
            <Robot size={12} /> Agente no PC do financeiro
          </p>
          <p className={`text-base font-bold mt-0.5 flex items-center gap-2 ${online ? 'text-green-700' : 'text-red-600'}`}>
            <Pulse size={16} weight="bold" className={online ? 'animate-pulse' : ''} /> {online ? 'Online' : 'Offline'}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {agente ? (
              <>
                {agente.host} · ping {relativo(agente.ultimo_ping)} · v{agente.versao || '?'}
                {agente.proxima_agendada ? ` · todo dia às ${agente.proxima_agendada}` : ''}
                {agente.sessao_ok === false ? <span className="text-red-600 font-medium"> · sessão da Stone expirada (rodar login.bat)</span> : ''}
              </>
            ) : (
              'Nenhum agente se conectou ainda — instale bots/stone-extratos no PC e rode iniciar.bat.'
            )}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 flex items-center gap-1">
            <Bank size={12} /> Na Liberação de Pagamento
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 items-baseline">
            <span>
              <span className="text-[10px] text-gray-500">STONE </span>
              <span className="text-base font-bold text-gray-800">{fmt(status?.saldoLiberacao?.valor)}</span>
            </span>
            <span>
              <span className="text-[10px] text-gray-500">PAGARME </span>
              <span className="text-base font-bold text-fuchsia-800">{fmt(status?.saldoPagarme?.valor)}</span>
            </span>
            <span>
              <span className="text-[10px] text-gray-500">a receber </span>
              <span className="text-sm font-semibold text-fuchsia-600">{fmt(status?.saldoPagarmeReceber?.valor)}</span>
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {status?.saldoLiberacao ? `Stone ${relativo(status.saldoLiberacao.atualizadoEm)}` : 'Stone: ainda não informado'}
            {status?.saldoPagarme ? ` · Pagar.me ${relativo(status.saldoPagarme.atualizadoEm)}` : ' · Pagar.me: ainda não informado'}
          </p>
          <button
            onClick={atualizarPagarme}
            disabled={pagarmeRodando}
            className="mt-2 px-2.5 py-1 text-[11px] rounded-lg border border-fuchsia-300 text-fuchsia-800 bg-fuchsia-50 hover:bg-fuchsia-100 disabled:opacity-50 flex items-center gap-1"
            title="Consulta a API da Pagar.me no servidor (não depende do PC do bot): saldo disponível, a receber e extrato dos últimos dias"
          >
            {pagarmeRodando ? <ArrowsClockwise size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />} Atualizar Pagar.me agora
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500">De (opcional)</label>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500">Até</label>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg" />
            </div>
          </div>
          <button
            onClick={solicitar}
            disabled={enviando || !!emAndamento}
            className="w-full px-3 py-2 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5 font-semibold"
            title={emAndamento ? 'Já existe uma execução em andamento' : 'Enfileira uma execução: o bot baixa os extratos, importa e atualiza o saldo'}
          >
            {enviando || emAndamento ? <ArrowsClockwise size={14} className="animate-spin" /> : <CloudArrowDown size={14} weight="bold" />}
            {emAndamento ? (emAndamento.status === 'rodando' ? 'Bot rodando…' : 'Na fila — aguardando o agente') : 'Baixar extratos agora'}
          </button>
          <p className="text-[10px] text-gray-400 text-center">Sem período, o bot pega os últimos dias configurados no PC (padrão 3).</p>
        </div>
      </div>

      {!online && !migracao && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Warning size={16} className="shrink-0 mt-0.5" />
          <span>
            O agente está offline: o botão enfileira a execução, mas ela só roda quando o PC do financeiro estiver ligado com o bot aberto (<code className="font-mono">iniciar.bat</code>).
          </span>
        </div>
      )}

      {/* Saldos por conta */}
      {status?.saldos?.contas?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-between">
            <span>Saldo por conta em {fmtData(status.saldos.data)}</span>
            <span className="text-gray-800 flex flex-wrap gap-3">
              {Object.values(status.saldos.porBanco || {}).map((b) => (
                <span key={b.banco}>
                  {b.banco} {fmt(b.total)}
                  {b.aReceber ? <span className="text-fuchsia-600 font-normal"> (+{fmt(b.aReceber)} a receber)</span> : ''}
                </span>
              ))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="px-3 py-1.5 text-left font-semibold">Banco</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Titular</th>
                  <th className="px-3 py-1.5 text-left font-semibold">CNPJ</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Ag / Conta</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Saldo</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Bloqueado</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Agendado</th>
                  <th className="px-3 py-1.5 text-right font-semibold">A receber</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Capturado</th>
                </tr>
              </thead>
              <tbody>
                {status.saldos.contas.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${s.banco === 'PAGARME' ? 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>{s.banco === 'PAGARME' ? 'Pagar.me' : 'Stone'}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-800">{s.titular_nome || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500">{s.titular_cnpj || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                      {s.agencia || '—'} / {s.conta}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-medium ${Number(s.saldo) < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmt(s.saldo)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{s.saldo_bloqueado != null ? fmt(s.saldo_bloqueado) : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{s.saldo_agendado != null ? fmt(s.saldo_agendado) : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-fuchsia-700">{s.saldo_a_receber != null ? fmt(s.saldo_a_receber) : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{fmtHora(s.capturado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execuções */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center gap-2">
          <Clock size={14} /> Execuções
          {carregando && <ArrowsClockwise size={12} className="animate-spin text-blue-600" />}
          <button onClick={carregar} className="ml-auto text-blue-600 hover:underline font-normal">
            Atualizar
          </button>
        </div>
        {!status?.execucoes?.length && <p className="px-3 py-6 text-center text-xs text-gray-400">Nenhuma execução ainda. Clique em “Baixar extratos agora”.</p>}
        <div className="divide-y divide-gray-100">
          {(status?.execucoes || []).map((e) => {
            const st = STATUS[e.status] || STATUS.pendente;
            const r = e.resumo || {};
            const abertaAqui = aberta === e.id;
            return (
              <div key={e.id}>
                <button onClick={() => setAberta(abertaAqui ? null : e.id)} className="w-full text-left px-3 py-2 flex flex-wrap items-center gap-2 hover:bg-gray-50 text-xs">
                  {abertaAqui ? <CaretDown size={12} /> : <CaretRight size={12} />}
                  <span className="font-mono text-gray-400">#{e.id}</span>
                  <Chip cfg={st}>{st.label}</Chip>
                  <span className="text-gray-500">{e.origem === 'agendado' ? 'automática' : 'manual'}</span>
                  <span className="text-gray-700">{fmtHora(e.criado_em)}</span>
                  {e.parametros?.de && (
                    <span className="text-gray-500 flex items-center gap-1">
                      <CalendarBlank size={11} /> {fmtData(e.parametros.de)} – {fmtData(e.parametros.ate)}
                    </span>
                  )}
                  {r.periodo && !e.parametros?.de && <span className="text-gray-400">{fmtData(r.periodo.de)} – {fmtData(r.periodo.ate)}</span>}
                  {e.status !== 'pendente' && e.iniciado_em && <span className="text-gray-400">{duracao(e.iniciado_em, e.concluido_em)}</span>}
                  {r.contas != null && (
                    <span className="text-gray-600">
                      {r.importados}/{r.contas} extrato(s) · {r.pdfs} PDF · {r.viaApi} API{r.falhas ? <span className="text-red-600"> · {r.falhas} falha(s)</span> : ''}
                    </span>
                  )}
                  {r.saldoTotal != null && <span className="text-emerald-700 font-medium">saldo {fmt(r.saldoTotal)}</span>}
                  {e.erro && <span className="text-red-600 truncate max-w-[360px]" title={e.erro}>{e.erro}</span>}
                  <span className="ml-auto text-gray-400">{e.solicitado_por || ''}</span>
                  {e.status === 'pendente' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        cancelar(e.id);
                      }}
                      onKeyDown={(ev) => ev.key === 'Enter' && cancelar(e.id)}
                      className="text-gray-400 hover:text-red-600"
                      title="Cancelar"
                    >
                      <Prohibit size={14} />
                    </span>
                  )}
                </button>
                {abertaAqui && (
                  <div className="px-3 pb-3">
                    {detalhe?.id === e.id ? (
                      <>
                        <Log linhas={detalhe.log} />
                        {detalhe.resumo?.avisos?.length > 0 && (
                          <ul className="mt-2 text-[11px] text-amber-700 list-disc pl-5">
                            {detalhe.resumo.avisos.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        )}
                        {detalhe.status === 'concluido' && (
                          <p className="mt-2 text-[11px] text-green-700 flex items-center gap-1">
                            <Check size={12} weight="bold" /> Extratos importados — veja a aba Importações e o painel do período.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">Carregando log…</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BotStoneExtratos;
