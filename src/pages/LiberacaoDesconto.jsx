// ============================================================================
// HEADCOACH › FINANCEIRO › LIBERAÇÃO DE DESCONTO (Yago, 19/11/2026)
// Limite de desconto que cada vendedor pode dar no PDV Crosby sem pedir a senha
// de um owner/admin. Era 15% fixo para todos; aqui o limite muda por usuário,
// por loja ou para todos de uma vez.
// Quem aparece: usuários do setor VAREJO com loja configurada (Painel Admin).
// Quem nunca teve o limite mudado está no padrão de 15%.
// API: /api/pdv-crosby/descontos (só owner e admin mudam).
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Percent, CheckCircle, Warning, ArrowsClockwise, Storefront, UsersThree, ClockCounterClockwise, MagnifyingGlass, X } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config/constants';
import { apiJson } from '../utils/apiAuth';

const fmtPct = (n) => `${String(Math.round(Number(n) * 100) / 100).replace('.', ',')}%`;
const fmtQuando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
// "12,5" → 12.5; vazio ou inválido → null
const lerPct = (txt) => {
  const t = String(txt ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100) / 100;
  return n >= 0 && n <= 100 ? n : null;
};

function CampoPct({ valor, onChange, onEnter, disabled, largura = 'w-20', ariaLabel }) {
  return (
    <div className={`relative ${largura}`}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 6))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-2 pr-6 text-right text-sm font-semibold text-[#000638] outline-none focus:border-[#000638] focus:ring-1 focus:ring-[#000638] disabled:bg-gray-100"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
    </div>
  );
}

// ─── Confirmação das mudanças em grupo (loja ou todos) ───────────────────────
function ConfirmarModal({ titulo, pct, afetados, salvando, onConfirmar, onCancelar }) {
  const mudam = afetados.filter((u) => u.pct !== pct);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#000638]/60 p-2 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onCancelar()}>
      <div className="mt-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[#000638]">{titulo}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {mudam.length === 0
                ? `Todos já estão em ${fmtPct(pct)}: nada muda.`
                : `${mudam.length} ${mudam.length > 1 ? 'usuários passam' : 'usuário passa'} a poder dar até ${fmtPct(pct)} de desconto no PDV sem pedir senha.`}
            </p>
          </div>
          <button onClick={onCancelar} disabled={salvando} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
          {afetados.map((u) => (
            <div key={u.userId} className="flex items-center justify-between gap-3 border-b border-gray-100 py-1.5 text-xs last:border-b-0">
              <div className="min-w-0">
                <div className="truncate font-semibold text-gray-800">{u.nome}</div>
                <div className="truncate text-[11px] text-gray-500">Loja {u.empresas.join(', ')}</div>
              </div>
              <div className="shrink-0 text-right">
                {u.pct === pct ? (
                  <span className="text-gray-400">já está em {fmtPct(pct)}</span>
                ) : (
                  <span>
                    <span className="text-gray-500">{fmtPct(u.pct)}</span> <span className="text-gray-400">→</span> <b className="text-[#000638]">{fmtPct(pct)}</b>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button onClick={onCancelar} disabled={salvando} className="h-9 rounded-lg border border-gray-300 px-4 text-xs font-bold text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={salvando || mudam.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-4 text-xs font-bold text-white hover:bg-[#000638]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? 'Gravando…' : `Aplicar ${fmtPct(pct)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiberacaoDesconto() {
  const { user } = useAuth();
  const podeMudar = ['owner', 'admin'].includes(user?.role);

  const [dados, setDados] = useState(null); // { padrao, usuarios, lojas }
  const [nomesLojas, setNomesLojas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [toast, setToast] = useState(null);

  const [novos, setNovos] = useState({}); // userId → texto digitado
  const [pctTodos, setPctTodos] = useState('');
  const [pctLoja, setPctLoja] = useState({}); // empresa → texto digitado
  const [filtroLoja, setFiltroLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [salvandoId, setSalvandoId] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { escopo, empresa, pct, titulo, afetados }
  const [salvandoGrupo, setSalvandoGrupo] = useState(false);

  const [historico, setHistorico] = useState(null);
  const [verHistorico, setVerHistorico] = useState(false);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const carregar = useCallback(
    async (atualizar = false) => {
      setCarregando(true);
      setErro(null);
      try {
        const j = await apiJson(`/api/pdv-crosby/descontos${atualizar ? '?atualizar=1' : ''}`);
        setDados(j.data);
        setNovos({});
      } catch (e) {
        setErro(e.status === 403 ? 'Só owner e admin veem e mudam o limite de desconto.' : e.message);
      } finally {
        setCarregando(false);
      }
    },
    [],
  );
  const carregarHistorico = useCallback(async () => {
    try {
      const j = await apiJson('/api/pdv-crosby/descontos/historico');
      setHistorico(j.data?.itens || []);
    } catch {
      setHistorico([]);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/totvs/branches`)
      .then((r) => r.json())
      .then((b) => setNomesLojas(Object.fromEntries((b?.data?.data || []).map((x) => [Number(x.cd_empresa), x.nm_grupoempresa]))))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (verHistorico) carregarHistorico();
  }, [verHistorico, carregarHistorico]);

  const nomeLoja = useCallback((e) => (nomesLojas[e] ? `${e} · ${nomesLojas[e]}` : `Loja ${e}`), [nomesLojas]);
  const usuarios = dados?.usuarios || [];
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return usuarios.filter((u) => (!filtroLoja || u.empresas.includes(Number(filtroLoja))) && (!t || `${u.nome} ${u.email}`.toLowerCase().includes(t)));
  }, [usuarios, filtroLoja, busca]);

  const depoisDeGravar = async (msg) => {
    showToast('ok', msg);
    await carregar();
    if (verHistorico) carregarHistorico();
  };

  const salvarUsuario = async (u) => {
    const pct = lerPct(novos[u.userId]);
    if (pct === null) return showToast('erro', 'Digite o limite entre 0 e 100%');
    if (pct === u.pct && u.proprio) return showToast('erro', `${u.nome} já está em ${fmtPct(pct)}`);
    setSalvandoId(u.userId);
    try {
      const j = await apiJson('/api/pdv-crosby/descontos', { method: 'PUT', body: { escopo: 'usuario', userId: u.userId, pct } });
      await depoisDeGravar(j.data?.alterados?.length ? `${u.nome}: limite de desconto em ${fmtPct(pct)}` : j.message);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setSalvandoId(null);
    }
  };

  const pedirGrupo = (escopo, empresa = null) => {
    const pct = lerPct(escopo === 'todos' ? pctTodos : pctLoja[empresa]);
    if (pct === null) return showToast('erro', 'Digite o limite entre 0 e 100%');
    // por loja: quem tem várias lojas (supervisor) fica de fora — o servidor faz igual
    const afetados = escopo === 'todos' ? usuarios : usuarios.filter((u) => u.empresas.includes(empresa) && !u.variasLojas);
    setConfirmar({ escopo, empresa, pct, afetados, titulo: escopo === 'todos' ? `Aplicar ${fmtPct(pct)} a todos` : `Aplicar ${fmtPct(pct)} à loja ${nomeLoja(empresa)}` });
  };
  const gravarGrupo = async () => {
    if (!confirmar) return;
    setSalvandoGrupo(true);
    try {
      const j = await apiJson('/api/pdv-crosby/descontos', { method: 'PUT', body: { escopo: confirmar.escopo, empresa: confirmar.empresa, pct: confirmar.pct } });
      setConfirmar(null);
      setPctTodos('');
      setPctLoja({});
      await depoisDeGravar(j.message);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setSalvandoGrupo(false);
    }
  };

  const faixa = (l) => (l.menor === l.maior ? fmtPct(l.menor) : `${fmtPct(l.menor)} a ${fmtPct(l.maior)}`);
  const faixaGeral = usuarios.length ? faixa({ menor: Math.min(...usuarios.map((u) => u.pct)), maior: Math.max(...usuarios.map((u) => u.pct)) }) : '—';
  const botao = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white hover:bg-[#000638]/90 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="mx-auto w-full max-w-6xl p-3 lg:p-4">
      <PageTitle
        title="Liberação de Desconto"
        subtitle="Até quanto de desconto cada vendedor pode dar no PDV Crosby sem pedir a senha de um owner ou admin. Mude um a um, por loja ou todos de uma vez."
        icon={Percent}
        iconColor="text-indigo-600"
      />

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <Warning size={18} weight="bold" className="mt-0.5 shrink-0" />
          <div>
            {erro}{' '}
            <button onClick={() => carregar()} className="font-bold underline">
              Tentar de novo
            </button>
          </div>
        </div>
      )}
      {carregando && !dados && <div className="py-16 text-center text-sm text-gray-500">Carregando os vendedores…</div>}

      {dados && (
        <>
          {!podeMudar && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">Só owner e admin mudam o limite de desconto. Você pode consultar.</div>
          )}

          {/* Todos de uma vez */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-indigo-50 p-2 text-indigo-600">
                  <UsersThree size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#000638]">Todos os vendedores</div>
                  <div className="text-xs text-gray-500">
                    {usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'} do setor Varejo com loja configurada · hoje em <b className="text-gray-700">{faixaGeral}</b>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CampoPct valor={pctTodos} onChange={setPctTodos} onEnter={() => pedirGrupo('todos')} disabled={!podeMudar} ariaLabel="Limite para todos" />
                <button onClick={() => pedirGrupo('todos')} disabled={!podeMudar || lerPct(pctTodos) === null} className={botao}>
                  Aplicar a todos
                </button>
                <button onClick={() => carregar(true)} disabled={carregando} title="Recarregar a lista de usuários" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <ArrowsClockwise size={16} className={carregando ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
              Acima do limite o PDV continua pedindo o e-mail e a senha de um owner ou admin. Vendedor que nunca teve o limite mudado (e quem entrar depois) fica no padrão de {fmtPct(dados.padrao)}. Owner e admin
              não têm limite. O vendedor passa a ver o limite novo ao abrir o PDV de novo.
            </p>
          </div>

          {/* Por loja */}
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              <Storefront size={15} /> Por loja
            </div>
            {usuarios.some((u) => u.variasLojas) && (
              <p className="mb-2 text-[11px] text-gray-500">Quem tem mais de 3 lojas configuradas (supervisor) não entra na mudança por loja: mude na linha dele ou em “Aplicar a todos”.</p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dados.lojas.map((l) => (
                <div key={l.empresa} className={`rounded-xl border bg-white p-3 shadow-sm ${String(filtroLoja) === String(l.empresa) ? 'border-[#000638]' : 'border-gray-200'}`}>
                  <button onClick={() => setFiltroLoja(String(filtroLoja) === String(l.empresa) ? '' : String(l.empresa))} className="block w-full text-left" title="Mostrar só os usuários desta loja">
                    <div className="truncate text-sm font-bold text-[#000638]">{nomeLoja(l.empresa)}</div>
                    <div className="text-xs text-gray-500">
                      {l.usuarios} {l.usuarios === 1 ? 'usuário' : 'usuários'} · hoje em <b className="text-gray-700">{faixa(l)}</b>
                    </div>
                  </button>
                  <div className="mt-2 flex items-center gap-2">
                    <CampoPct
                      valor={pctLoja[l.empresa] ?? ''}
                      onChange={(v) => setPctLoja((p) => ({ ...p, [l.empresa]: v }))}
                      onEnter={() => pedirGrupo('loja', l.empresa)}
                      disabled={!podeMudar}
                      ariaLabel={`Limite para a loja ${l.empresa}`}
                    />
                    <button onClick={() => pedirGrupo('loja', l.empresa)} disabled={!podeMudar || lerPct(pctLoja[l.empresa]) === null} className={`${botao} flex-1`}>
                      Aplicar à loja
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Um a um */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="text-sm font-bold text-[#000638]">
                Vendedores <span className="font-normal text-gray-500">({visiveis.length}{visiveis.length !== usuarios.length ? ` de ${usuarios.length}` : ''})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)} className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700" aria-label="Filtrar por loja">
                  <option value="">Todas as lojas</option>
                  {dados.lojas.map((l) => (
                    <option key={l.empresa} value={l.empresa}>
                      {nomeLoja(l.empresa)}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <MagnifyingGlass size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou e-mail" className="h-9 w-44 rounded-lg border border-gray-300 pl-7 pr-2 text-xs outline-none focus:border-[#000638]" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="sticky left-0 z-[1] bg-white px-4 py-2 font-semibold">Vendedor</th>
                    <th className="px-2 py-2 font-semibold">Loja</th>
                    <th className="px-2 py-2 text-right font-semibold">Limite hoje</th>
                    <th className="px-2 py-2 font-semibold">Novo limite</th>
                    <th className="px-4 py-2 font-semibold">Última mudança</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((u) => {
                    const digitado = novos[u.userId] ?? '';
                    const pct = lerPct(digitado);
                    const muda = pct !== null && pct !== u.pct;
                    return (
                      <tr key={u.userId} className="border-b border-gray-50 last:border-b-0">
                        {/* o nome fica preso à esquerda quando a tabela rola para o lado (celular) */}
                        <td className="sticky left-0 z-[1] max-w-[11rem] bg-white px-4 py-2 sm:max-w-none">
                          <div className="truncate font-semibold text-gray-800">{u.nome}</div>
                          <div className="truncate text-[11px] text-gray-500">{u.email}</div>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-700">
                          {u.variasLojas ? (
                            <span title={u.empresas.map(nomeLoja).join('\n')}>
                              {u.empresas.length} lojas
                              <span className="block text-[10px] text-gray-400">supervisor: fora do “por loja”</span>
                            </span>
                          ) : (
                            u.empresas.map((e) => <div key={e}>{nomeLoja(e)}</div>)
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span className={`text-base font-bold ${u.pct === dados.padrao ? 'text-[#000638]' : u.pct > dados.padrao ? 'text-emerald-700' : 'text-amber-700'}`}>{fmtPct(u.pct)}</span>
                          {u.semLimite ? <div className="text-[10px] text-gray-400">{u.role}: sem limite no PDV</div> : !u.proprio ? <div className="text-[10px] text-gray-400">padrão</div> : null}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <CampoPct valor={digitado} onChange={(v) => setNovos((p) => ({ ...p, [u.userId]: v }))} onEnter={() => muda && salvarUsuario(u)} disabled={!podeMudar || salvandoId === u.userId} ariaLabel={`Novo limite de ${u.nome}`} />
                            <button onClick={() => salvarUsuario(u)} disabled={!podeMudar || !muda || salvandoId === u.userId} className={botao}>
                              {salvandoId === u.userId ? 'Gravando…' : 'Salvar'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-[11px] text-gray-500">
                          {u.atualizadoEm ? (
                            <>
                              <div>{fmtQuando(u.atualizadoEm)}</div>
                              <div className="truncate">{u.atualizadoPor || ''}</div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visiveis.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                        {usuarios.length === 0 ? 'Nenhum usuário do setor Varejo tem loja configurada. Configure a loja de cada vendedor no Painel Admin.' : 'Nenhum vendedor com esse filtro.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico */}
          <div className="mt-4">
            <button onClick={() => setVerHistorico((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#000638] hover:underline">
              <ClockCounterClockwise size={15} /> {verHistorico ? 'Esconder o histórico' : 'Ver o histórico das mudanças'}
            </button>
            {verHistorico && (
              <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                {historico === null ? (
                  <div className="px-4 py-6 text-center text-xs text-gray-500">Carregando…</div>
                ) : historico.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-gray-500">Nenhuma mudança ainda: todos estão no padrão de {fmtPct(dados.padrao)}.</div>
                ) : (
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-2 font-semibold">Quando</th>
                        <th className="px-2 py-2 font-semibold">Vendedor</th>
                        <th className="px-2 py-2 font-semibold">Mudança</th>
                        <th className="px-2 py-2 font-semibold">Como</th>
                        <th className="px-4 py-2 font-semibold">Por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((h) => (
                        <tr key={h.id} className="border-b border-gray-50 last:border-b-0">
                          <td className="whitespace-nowrap px-4 py-1.5 text-gray-600">{fmtQuando(h.em)}</td>
                          <td className="px-2 py-1.5 font-semibold text-gray-800">{h.nome}</td>
                          <td className="whitespace-nowrap px-2 py-1.5">
                            {fmtPct(h.de)} <span className="text-gray-400">→</span> <b className="text-[#000638]">{fmtPct(h.para)}</b>
                          </td>
                          <td className="px-2 py-1.5 text-gray-600">{h.escopo === 'todos' ? 'Todos' : h.escopo === 'loja' ? nomeLoja(h.escopoEmpresa) : 'Só este usuário'}</td>
                          <td className="px-4 py-1.5 text-gray-600">{h.por || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {confirmar && <ConfirmarModal titulo={confirmar.titulo} pct={confirmar.pct} afetados={confirmar.afetados} salvando={salvandoGrupo} onConfirmar={gravarGrupo} onCancelar={() => setConfirmar(null)} />}

      {toast && (
        <div className={`fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.type === 'ok' ? <CheckCircle size={17} weight="bold" /> : <Warning size={17} weight="bold" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
