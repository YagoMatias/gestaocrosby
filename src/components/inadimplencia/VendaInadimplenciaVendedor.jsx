// ============================================================================
// INADIMPLÊNCIA MTM › Venda x Inadimplência por Vendedor (João/BRUCE, 25/11/2026)
// Só LÊ a foto semanal gravada pela API (/api/inadimplencia-mtm): não busca mais
// o faturamento no TOTVS a cada abertura. O faturado já soma TOTVS + HeadCoach.
//   • % = inadimplência final / faturado final * 100 (2 casas; faturado zero → "sem faturamento")
//   • variação contra a semana anterior em p.p. (negativo = melhorou, verde)
//   • faixas: < 5% verde · 5% a < 10% laranja · >= 10% vermelho
//   • totais com média ponderada (Σ inadimplência / Σ faturado)
//   • ajustes manuais por vendedor/semana (faturado ou inadimplência), com motivo
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Users, ArrowClockwise, CircleNotch, ArrowDown, ArrowUp, Minus, SlidersHorizontal, X, Trash } from '@phosphor-icons/react';
import { apiJson } from '../../utils/apiAuth';

const API = '/api/inadimplencia-mtm';
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct2 = (v) => `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const dia = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const diaHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const corPct = (p) => (p == null ? 'text-gray-400' : p >= 10 ? 'text-red-600' : p >= 5 ? 'text-orange-500' : 'text-green-700');

function Pct({ valor }) {
  if (valor == null) return <span className="text-[11px] italic text-gray-400">sem faturamento</span>;
  return <span className={`font-bold ${corPct(Number(valor))}`}>{pct2(valor)}</span>;
}

// De onde veio o faturado (João, 25/11/2026): parte do TOTVS e parte do HeadCoach
function Origem({ l }) {
  if (l?.faturado_totvs == null || l?.faturado_headcoach == null) return null;
  return (
    <div className="text-[10px] font-normal text-gray-500" title="Faturado do sistema dividido por origem (antes dos ajustes)">
      TOTVS {brl(l.faturado_totvs)} · HeadCoach {brl(l.faturado_headcoach)}
    </div>
  );
}

function Variacao({ v }) {
  if (!v || v.pp == null) return <span className="text-gray-300">—</span>;
  const pp = Number(v.pp);
  const estavel = Math.abs(pp) < 0.005;
  const melhorou = pp < 0;
  const cls = estavel ? 'text-gray-500' : melhorou ? 'text-green-700' : 'text-red-600';
  const Icone = estavel ? Minus : melhorou ? ArrowDown : ArrowUp;
  const sinal = (n) => (n > 0 ? '+' : '');
  return (
    <div className={`text-right ${cls}`}>
      <div className="inline-flex items-center gap-0.5 font-bold">
        <Icone size={11} weight="bold" />
        {estavel ? 'estável' : `${sinal(pp)}${pp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`}
      </div>
      <div className="text-[10px] font-normal text-gray-500" title="Variação em R$ da inadimplência e do faturado contra a semana anterior">
        inad. {sinal(v.inadimplencia)}
        {brl(v.inadimplencia)} · fat. {sinal(v.faturado)}
        {brl(v.faturado)}
      </div>
    </div>
  );
}

export default function VendaInadimplenciaVendedor({ onVerClientes }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [apurando, setApurando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [ajustesAbertos, setAjustesAbertos] = useState(false);
  const timer = useRef(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const j = await apiJson(`${API}/painel`);
      setDados(j.data);
      setApurando(Boolean(j.data?.apuracao?.rodando));
      return j.data;
    } catch (e) {
      setErro(e.message);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  // enquanto a apuração roda, confere a cada 5 s
  const acompanhar = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const s = (await apiJson(`${API}/apurar/status`)).data;
        if (s.rodando) return acompanhar();
        setApurando(false);
        setAviso(s.erro ? `A apuração não gravou: ${s.erro}` : 'Foto da semana atualizada.');
        await carregar();
      } catch (e) {
        setApurando(false);
        setErro(e.message);
      }
    }, 5000);
  }, [carregar]);

  useEffect(() => {
    carregar().then((d) => d?.apuracao?.rodando && acompanhar());
    return () => clearTimeout(timer.current);
  }, [carregar, acompanhar]);

  const apurar = async () => {
    setAviso('');
    setErro('');
    try {
      await apiJson(`${API}/apurar`, { method: 'POST', body: {} });
      setApurando(true);
      setAviso('Apurando: o faturamento vem do TOTVS e do HeadCoach e pode levar alguns minutos. Pode continuar usando a tela.');
      acompanhar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const linhas = dados?.vendedores || [];
  const totais = dados?.totais;
  const temFoto = Boolean(dados?.semana);

  const LinhaTotal = ({ rotulo, t, destaque }) =>
    t ? (
      <tr className={`${destaque ? 'bg-gray-100' : 'bg-gray-50'} font-bold text-[#000638]`}>
        <td className="px-3 py-2">{rotulo}</td>
        <td className="px-3 py-2 text-right">
          {brl(t.faturado_final)}
          <Origem l={t} />
        </td>
        <td className="px-3 py-2 text-right text-red-600">{brl(t.inadimplencia_final)}</td>
        <td className="px-3 py-2 text-right">
          <Pct valor={t.pct_inadimplencia} />
        </td>
        <td className="px-3 py-2">
          <Variacao v={t.variacao} />
        </td>
        <td className="px-3 py-2 text-right">{brl(t.carteira_vencida)}</td>
        <td className="px-3 py-2 text-center">{t.clientes}</td>
      </tr>
    ) : null;

  return (
    <div className="rounded-xl bg-white shadow-lg">
      <div className="px-4 pb-2 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#000638]" />
            <h3 className="text-sm font-bold text-[#000638]">Venda x Inadimplência por Vendedor</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAjustesAbertos(true)} className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-[#000638] hover:bg-gray-200">
              <SlidersHorizontal size={14} weight="bold" /> Ajustes
            </button>
            <button onClick={apurar} disabled={apurando} className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-[#000638] hover:bg-gray-200 disabled:opacity-50" title="Refaz a foto desta semana">
              {apurando ? <CircleNotch size={14} className="animate-spin" /> : <ArrowClockwise size={14} weight="bold" />}
              {apurando ? 'Apurando...' : 'Atualizar'}
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Faturado de cada vendedor (TOTVS + HeadCoach) desde a data de entrada dele, contra a carteira inadimplente (clientes com mais de 60 dias de atraso). % = inadimplência / faturado × 100, já com os ajustes. Total = média ponderada. Clique no valor da inadimplência para ver os clientes.
        </p>
        {temFoto && (
          <p className="mt-1 text-[11px] text-gray-400">
            Foto da semana de {dia(dados.semana)} · apurada em {diaHora(dados.apuradoEm)}
            {dados.semanaAnterior ? ` · comparando com a semana de ${dia(dados.semanaAnterior)}` : ' · ainda sem semana anterior para comparar'} · foto automática toda segunda às 06:10
          </p>
        )}
      </div>
      <div className="px-4 pb-4">
        {aviso && <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{aviso}</div>}
        {erro && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Não foi possível carregar: {erro}</div>}
        {carregando ? (
          <div className="flex items-center gap-2 py-6 text-xs text-gray-500">
            <CircleNotch size={14} className="animate-spin" /> Carregando a foto da semana...
          </div>
        ) : !temFoto ? (
          <div className="py-6 text-center text-xs text-gray-500">Ainda não há foto gravada. Clique em Atualizar para apurar a semana.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#000638] text-white">
                  <th className="px-3 py-2 text-left font-semibold">Vendedor</th>
                  <th className="px-3 py-2 text-right font-semibold">Faturado</th>
                  <th className="px-3 py-2 text-right font-semibold">Inadimplência (+60d)</th>
                  <th className="px-3 py-2 text-right font-semibold">% Inadimplência</th>
                  <th className="px-3 py-2 text-right font-semibold">Variação semanal</th>
                  <th className="px-3 py-2 text-right font-semibold">Carteira vencida</th>
                  <th className="px-3 py-2 text-center font-semibold">Clientes</th>
                </tr>
              </thead>
              {[
                { id: 'ativos', titulo: 'Principais', lista: linhas.filter((v) => v.ativo), total: totais?.ativos },
                { id: 'outros', titulo: 'Outros (desligados — carteira continua)', lista: linhas.filter((v) => !v.ativo), total: totais?.outros },
              ].map((g) => (
              <tbody key={g.id}>
                <tr className="bg-[#000638]/5">
                  <td colSpan={7} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#000638]">
                    {g.titulo}
                  </td>
                </tr>
                {g.lista.map((v) => {
                  const a = v.atual;
                  if (!a) return null;
                  const ajF = Number(a.ajuste_faturado) || 0;
                  const ajI = Number(a.ajuste_inadimplencia) || 0;
                  const lista = a.clientes_inadimplentes || [];
                  return (
                    <tr key={v.code} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-bold text-[#000638]">{v.chave}</div>
                        <div className="text-[10px] text-gray-500">
                          {v.nome} - cod. {v.code}
                        </div>
                        <div className="text-[10px] text-gray-400">desde {dia(v.desde)}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div>{brl(a.faturado_final)}</div>
                        <Origem l={a} />
                        {ajF !== 0 && (
                          <div className="text-[10px] text-indigo-600" title="Sistema + ajustes">
                            sistema {brl(a.faturado)} {ajF > 0 ? '+' : '−'} ajuste {brl(Math.abs(ajF))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {lista.length > 0 ? (
                          <button onClick={() => onVerClientes?.(v, lista)} className="font-semibold text-red-600 underline decoration-dotted underline-offset-2 hover:text-red-700" title={`Ver os ${lista.length} cliente(s) acima de 60 dias`}>
                            {brl(a.inadimplencia_final)}
                          </button>
                        ) : (
                          <span className="font-semibold text-gray-400">{brl(a.inadimplencia_final)}</span>
                        )}
                        {ajI !== 0 && (
                          <div className="text-[10px] text-indigo-600" title="Sistema + ajustes">
                            sistema {brl(a.inadimplencia_60d)} {ajI > 0 ? '+' : '−'} ajuste {brl(Math.abs(ajI))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Pct valor={a.pct_inadimplencia} />
                        {v.anterior && <div className="text-[10px] text-gray-400">antes {v.anterior.pct_inadimplencia == null ? '—' : pct2(v.anterior.pct_inadimplencia)}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Variacao v={v.variacao} />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{brl(a.carteira_vencida)}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{a.clientes}</td>
                    </tr>
                  );
                })}
                <LinhaTotal rotulo={`TOTAL ${g.id === 'ativos' ? 'PRINCIPAIS' : 'OUTROS'} (${g.total?.rotulo || ''})`} t={g.total} />
              </tbody>
              ))}
              <tfoot>
                <LinhaTotal rotulo="TOTAL GERAL" t={totais?.geral} destaque />
              </tfoot>
            </table>
            <p className="mt-2 text-[10px] text-gray-400">
              <span className="font-semibold text-green-700">● abaixo de 5%</span> · <span className="font-semibold text-orange-500">● 5% a 10%</span> · <span className="font-semibold text-red-600">● 10% ou mais</span> · variação negativa = melhorou
            </p>
          </div>
        )}
      </div>
      {ajustesAbertos && (
        <Ajustes
          vendedores={dados?.vendedoresMtm || []}
          onFechar={() => setAjustesAbertos(false)}
          onMudou={async () => {
            await carregar();
          }}
        />
      )}
    </div>
  );
}

function Ajustes({ vendedores, onFechar, onMudou }) {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ vendedorCod: vendedores.find((v) => v.ativo)?.code || '', tipo: 'FATURADO', valor: '', motivo: '' });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const nomeDe = (cod) => vendedores.find((v) => v.code === Number(cod))?.chave || cod;
  const num = (t) => {
    const s = String(t || '').trim().replace(/\s/g, '');
    return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  };

  const carregar = useCallback(async () => {
    try {
      setLista((await apiJson(`${API}/ajustes`)).data || []);
    } catch (e) {
      setErro(e.message);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const lancar = async (e) => {
    e.preventDefault();
    setErro('');
    setBusy(true);
    try {
      await apiJson(`${API}/ajustes`, { method: 'POST', body: { ...form, valor: num(form.valor) } });
      setForm((f) => ({ ...f, valor: '', motivo: '' }));
      await carregar();
      await onMudou();
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setBusy(false);
    }
  };
  const excluir = async (id) => {
    setErro('');
    setBusy(true);
    try {
      await apiJson(`${API}/ajustes/${id}`, { method: 'DELETE' });
      await carregar();
      await onMudou();
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };

  const campo = 'h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
  const rot = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#000638]">Ajustes manuais (faturado e inadimplência)</h3>
          <button onClick={onFechar} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">O ajuste soma (ou subtrai, com valor negativo) no número do sistema, sem apagá-lo. Vale a partir da semana em que é lançado e já entra na foto desta semana.</p>
        <form onSubmit={lancar} className="mb-4 grid grid-cols-2 items-end gap-2 sm:grid-cols-[130px_150px_130px_1fr_auto]">
          <div>
            <label className={rot}>Vendedor</label>
            <select value={form.vendedorCod} onChange={(e) => setForm((f) => ({ ...f, vendedorCod: Number(e.target.value) }))} className={campo}>
              {vendedores.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.chave}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rot}>Ajustar</label>
            <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className={campo}>
              <option value="FATURADO">Faturado</option>
              <option value="INADIMPLENCIA">Inadimplência</option>
            </select>
          </div>
          <div>
            <label className={rot}>Valor (R$, ± )</label>
            <input value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="9.000,00 ou -9.000,00" className={campo} />
          </div>
          <div>
            <label className={rot}>Motivo</label>
            <input value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} className={campo} />
          </div>
          <button type="submit" disabled={busy} className="h-9 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white disabled:opacity-40">
            {busy ? <CircleNotch size={14} className="animate-spin" /> : 'Lançar'}
          </button>
        </form>
        {erro && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">{erro}</p>}
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-2 py-2">Semana</th>
              <th className="px-2 py-2">Vendedor</th>
              <th className="px-2 py-2">Tipo</th>
              <th className="px-2 py-2 text-right">Valor</th>
              <th className="px-2 py-2">Motivo</th>
              <th className="px-2 py-2">Por</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-gray-400">
                  Nenhum ajuste lançado.
                </td>
              </tr>
            )}
            {lista.map((a) => (
              <tr key={a.id}>
                <td className="px-2 py-1.5">{dia(a.semana_ref)}</td>
                <td className="px-2 py-1.5 font-semibold">{nomeDe(a.vendedor_cod)}</td>
                <td className="px-2 py-1.5">{a.tipo === 'FATURADO' ? 'Faturado' : 'Inadimplência'}</td>
                <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${Number(a.valor) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{brl(a.valor)}</td>
                <td className="max-w-[220px] truncate px-2 py-1.5" title={a.motivo}>
                  {a.motivo}
                </td>
                <td className="px-2 py-1.5 text-gray-500">{a.usuario || '—'}</td>
                <td className="px-2 py-1.5 text-right">
                  <button onClick={() => excluir(a.id)} disabled={busy} className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600" title="Excluir o ajuste (o histórico fica guardado)">
                    <Trash size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
