// Página: Administração → Conferência ERP
// Compara, registro a registro, o que está no TOTVS com o que o HeadCoach
// guardou nas tabelas da fase 1 (contas a pagar, contas a receber, transações).
// O TOTVS é consultado ao vivo no período escolhido; o HeadCoach vem das
// tabelas accounts_payable_duplicates, accounts_receivable_documents e
// general_transactions. Mostra totais, gráfico por dia, por empresa e a lista
// do que só existe de um lado ou está diferente, campo a campo.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowsLeftRight, Spinner, CheckCircle, Warning, XCircle, MagnifyingGlass, ArrowsClockwise, CaretDown, CaretRight, Wrench } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';

const btn = 'inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrim = `${btn} bg-[#000638] text-white hover:bg-[#1a2060]`;
const btnSec = `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
const inputCls = 'h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const lbl = 'block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1';

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));
const fmtBRL = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtDia = (d) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d || '—');
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const diasAtras = (n) => new Date(Date.now() - 3 * 3600000 - n * 86400000).toISOString().slice(0, 10);

const TIPO = {
  so_totvs: { rotulo: 'Só no TOTVS', cls: 'bg-rose-100 text-rose-800' },
  so_headcoach: { rotulo: 'Só no HeadCoach', cls: 'bg-amber-100 text-amber-800' },
  diferente: { rotulo: 'Diferente', cls: 'bg-orange-100 text-orange-800' },
};
const STATUS = {
  contas_pagar: { N: 'Normal', C: 'Cancelada', A: 'Agrupada', D: 'Devolvida', L: 'Comissão liq.', Q: 'Quebrada' },
  contas_receber: { 1: 'Normal', 3: 'Cancelado' },
  transacoes: { 1: 'Em andamento', 2: 'Encerrada', 4: 'Atendida', 5: '5', 6: 'Cancelada' },
};

const fmtValor = (c, v) => {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  if (/_value$|valor|value$/.test(c)) return fmtBRL(v);
  return String(v);
};

export default function ConferenciaERP() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'owner'].includes(user?.role);
  const [meta, setMeta] = useState({ modulos: [], empresas: [] });
  const [modulo, setModulo] = useState('contas_pagar');
  const [de, setDe] = useState(diasAtras(7));
  const [ate, setAte] = useState(hoje());
  const [empresas, setEmpresas] = useState('proprias');
  const [codigos, setCodigos] = useState('');
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [aberto, setAberto] = useState(null);
  const [corrigindo, setCorrigindo] = useState(false);

  useEffect(() => {
    apiJson('/api/erp/comparacao/modulos').then(({ data }) => setMeta(data)).catch((e) => setErro(e.message));
  }, []);

  // transações: a API consulta 1 empresa × 1 dia por vez — por padrão, só as próprias e 3 dias
  useEffect(() => {
    if (modulo === 'transacoes') {
      setDe(diasAtras(2));
      if (empresas === 'todas') setEmpresas('proprias');
    } else {
      setDe(diasAtras(7));
    }
    setRes(null);
    setFiltroTipo('');
  }, [modulo]); // eslint-disable-line react-hooks/exhaustive-deps

  const empresasParam = empresas === 'codigos' ? codigos : empresas;

  const comparar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setMsg(null);
    setAberto(null);
    try {
      const { data } = await apiJson(`/api/erp/comparacao/${modulo}?de=${de}&ate=${ate}&empresas=${encodeURIComponent(empresasParam)}`, { timeoutMs: 600000 });
      setRes(data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [modulo, de, ate, empresasParam]);

  const corrigir = async () => {
    if (!window.confirm(`Regravar no HeadCoach tudo que o TOTVS devolver em ${fmtDia(de)}–${fmtDia(ate)} (${res?.rotulo})? O TOTVS vence; nada é apagado.`)) return;
    setCorrigindo(true);
    try {
      const r = await apiJson(`/api/erp/comparacao/${modulo}/corrigir`, { method: 'POST', body: { de, ate, empresas: empresasParam }, timeoutMs: 600000 });
      setMsg(r.message);
      await comparar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setCorrigindo(false);
    }
  };

  const divergencias = useMemo(() => (res?.divergencias || []).filter((d) => !filtroTipo || d.tipo === filtroTipo), [res, filtroTipo]);
  const r = res?.resumo;
  const stRot = (v) => (v == null ? '—' : STATUS[modulo]?.[v] || String(v));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4">
      <PageTitle title="Conferência ERP" subtitle="TOTVS × HeadCoach, registro a registro: o que bate, o que só existe de um lado e o que está diferente" icon={ArrowsLeftRight} />

      {/* filtros */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className={lbl}>Módulo</span>
            <div className="flex gap-1">
              {(meta.modulos.length ? meta.modulos : [{ id: 'contas_pagar', rotulo: 'Contas a pagar' }, { id: 'contas_receber', rotulo: 'Contas a receber' }, { id: 'transacoes', rotulo: 'Transações' }]).map((m) => (
                <button key={m.id} type="button" onClick={() => setModulo(m.id)} className={`${btn} ${modulo === m.id ? 'bg-[#000638] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{m.rotulo}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>De</label>
            <input type="date" className={inputCls} value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Até</label>
            <input type="date" className={inputCls} value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Empresas</label>
            <select className={inputCls} value={empresas} onChange={(e) => setEmpresas(e.target.value)}>
              <option value="proprias">20 próprias</option>
              <option value="todas">Todas ({meta.empresas.length || 290})</option>
              <option value="codigos">Códigos…</option>
              {meta.empresas.filter((e) => e.propria).map((e) => <option key={e.code} value={String(e.code)}>{e.code} · {e.descricao}</option>)}
            </select>
          </div>
          {empresas === 'codigos' && (
            <div>
              <label className={lbl}>Códigos (vírgula)</label>
              <input className={`${inputCls} w-48`} placeholder="95, 99, 6156" value={codigos} onChange={(e) => setCodigos(e.target.value)} />
            </div>
          )}
          <button type="button" className={btnPrim} onClick={comparar} disabled={loading}>
            {loading ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} />} Comparar
          </button>
          {res && isAdmin && (
            <button type="button" className={btnSec} onClick={corrigir} disabled={corrigindo || loading || !r?.divergencias}>
              {corrigindo ? <Spinner size={14} className="animate-spin" /> : <Wrench size={14} />} Corrigir pelo TOTVS
            </button>
          )}
          {res && <span className="text-[11px] text-gray-400">{Math.round(res.duracaoMs / 1000)}s · chave {res.chave.join(' + ')}</span>}
        </div>
        <div className="text-[11px] text-gray-500 mt-2">
          {modulo === 'transacoes'
            ? 'Transações: o TOTVS responde uma empresa e um dia por consulta. Com as 20 próprias e 3 dias são 60 consultas (~1 min); as 290 só cabem em 1 ou 2 dias.'
            : 'Contas a pagar e a receber são buscadas por data de emissão; até 62 dias por conferência.'}
        </div>
      </div>

      {erro && <div className="mb-3 rounded-lg px-3 py-2 text-xs bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2"><Warning size={14} /> {erro}</div>}
      {msg && <div className="mb-3 rounded-lg px-3 py-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">{msg}</div>}
      {loading && <div className="mb-3 rounded-lg px-3 py-6 text-center text-xs text-gray-500 bg-white border border-gray-200"><Spinner size={18} className="animate-spin inline mr-2" />Consultando o TOTVS e o HeadCoach…</div>}

      {res && !loading && (
        <>
          {/* cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            <Card titulo="TOTVS" valor={fmtNum(r.totvs.qtd)} sub={fmtBRL(r.totvs.valor)} tone="blue" />
            <Card titulo="HeadCoach" valor={fmtNum(r.headcoach.qtd)} sub={fmtBRL(r.headcoach.valor)} tone="indigo" />
            <Card titulo="Iguais" valor={fmtNum(r.iguais)} sub={r.aderencia != null ? `${r.aderencia}% do TOTVS` : null} tone="emerald" icon={CheckCircle} onClick={() => setFiltroTipo('')} />
            <Card titulo="Diferentes" valor={fmtNum(r.diferentes)} sub="mesma chave, campos diferentes" tone={r.diferentes ? 'orange' : 'gray'} icon={Warning} onClick={() => setFiltroTipo('diferente')} ativo={filtroTipo === 'diferente'} />
            <Card titulo="Só no TOTVS" valor={fmtNum(r.so_totvs)} sub="faltam no HeadCoach" tone={r.so_totvs ? 'rose' : 'gray'} icon={XCircle} onClick={() => setFiltroTipo('so_totvs')} ativo={filtroTipo === 'so_totvs'} />
            <Card titulo="Só no HeadCoach" valor={fmtNum(r.so_headcoach)} sub="não vieram do TOTVS" tone={r.so_headcoach ? 'amber' : 'gray'} icon={XCircle} onClick={() => setFiltroTipo('so_headcoach')} ativo={filtroTipo === 'so_headcoach'} />
          </div>

          {/* barra de aderência */}
          <div className="rounded-xl border border-gray-200 bg-white p-3 mb-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">{res.rotulo} · {fmtDia(de)} a {fmtDia(ate)} · {res.empresas ? `${res.empresas.length} empresa(s)` : 'todas as empresas'}</span>
              <span className="text-gray-500">{fmtNum(r.divergencias)} divergência(s) em {fmtNum(Math.max(r.totvs.qtd, r.headcoach.qtd))} registros</span>
            </div>
            <Barra r={r} />
            <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-gray-500">
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1" />iguais</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400 mr-1" />diferentes</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500 mr-1" />só no TOTVS</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1" />só no HeadCoach</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            {/* gráfico por dia */}
            <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">Registros por dia</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={res.porDia.map((d) => ({ ...d, dia: fmtDia(d.dia), divergencias: d.diferentes + d.so_totvs + d.so_headcoach }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={(v, n) => [fmtNum(v), n]} contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="totvs_qtd" name="TOTVS" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="headcoach_qtd" name="HeadCoach" fill="#000638" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="divergencias" name="Divergências" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* campos mais divergentes */}
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">Campos que mais divergem</div>
              {res.camposDivergentes.length ? (
                <table className="w-full text-xs">
                  <tbody>
                    {res.camposDivergentes.slice(0, 12).map((c) => (
                      <tr key={c.campo} className="border-t border-gray-100">
                        <td className="py-1 font-mono text-[11px]">{c.campo}</td>
                        <td className="py-1 text-right tabular-nums">{fmtNum(c.qtd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-xs text-gray-400 py-6 text-center">Nenhum campo diferente nos registros em comum.</div>
              )}
            </div>
          </div>

          {/* por empresa */}
          <div className="rounded-xl border border-gray-200 bg-white mb-4 overflow-x-auto">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-700">Por empresa</div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr><th className="text-left px-3 py-2">Empresa</th><th className="text-right px-3 py-2">TOTVS</th><th className="text-right px-3 py-2">Valor TOTVS</th><th className="text-right px-3 py-2">HeadCoach</th><th className="text-right px-3 py-2">Valor HeadCoach</th><th className="text-right px-3 py-2">Iguais</th><th className="text-right px-3 py-2">Diferentes</th><th className="text-right px-3 py-2">Só TOTVS</th><th className="text-right px-3 py-2">Só HC</th></tr>
              </thead>
              <tbody>
                {res.porEmpresa.map((e) => (
                  <tr key={e.empresa} className={`border-t border-gray-100 ${e.divergencias ? 'bg-rose-50/40' : ''}`}>
                    <td className="px-3 py-1.5"><span className="font-semibold">{e.empresa}</span> <span className="text-gray-500">{e.nome || ''}</span></td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(e.totvs_qtd)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(e.totvs_valor)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(e.headcoach_qtd)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(e.headcoach_valor)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{fmtNum(e.iguais)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${e.diferentes ? 'text-orange-700 font-semibold' : 'text-gray-400'}`}>{fmtNum(e.diferentes)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${e.so_totvs ? 'text-rose-700 font-semibold' : 'text-gray-400'}`}>{fmtNum(e.so_totvs)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${e.so_headcoach ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>{fmtNum(e.so_headcoach)}</td>
                  </tr>
                ))}
                {!res.porEmpresa.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Nenhum registro no período, nem no TOTVS nem no HeadCoach.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* divergências */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700">Divergências</span>
              {['', 'diferente', 'so_totvs', 'so_headcoach'].map((t) => (
                <button key={t || 'todas'} type="button" onClick={() => setFiltroTipo(t)} className={`${btn} h-7 ${filtroTipo === t ? 'bg-[#000638] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                  {t ? TIPO[t].rotulo : 'todas'} ({t ? (res.divergencias || []).filter((d) => d.tipo === t).length : res.divergencias.length})
                </button>
              ))}
              {res.divergenciasTruncadas && <span className="text-[11px] text-amber-700 ml-2">mostrando as primeiras {res.divergencias.length} de {fmtNum(r.divergencias)}</span>}
              {res.puladas?.length > 0 && <span className="text-[11px] text-rose-700 ml-2">{res.puladas.length} consulta(s) ao TOTVS falharam</span>}
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr><th className="w-6" /><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Chave</th><th className="text-left px-3 py-2">Empresa</th><th className="text-left px-3 py-2">Pessoa</th><th className="text-left px-3 py-2">Data</th><th className="text-right px-3 py-2">Valor TOTVS</th><th className="text-right px-3 py-2">Valor HeadCoach</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Campos</th></tr>
              </thead>
              <tbody>
                {divergencias.map((d, i) => {
                  const k = JSON.stringify(d.chave);
                  const open = aberto === k;
                  return (
                    <React.Fragment key={k + i}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50/60 cursor-pointer" onClick={() => setAberto(open ? null : k)}>
                        <td className="pl-2 text-gray-400">{d.campos?.length ? (open ? <CaretDown size={12} /> : <CaretRight size={12} />) : null}</td>
                        <td className="px-3 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${TIPO[d.tipo].cls}`}>{TIPO[d.tipo].rotulo}</span></td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{Object.values(d.chave).join(' / ')}</td>
                        <td className="px-3 py-1.5">{d.empresa}</td>
                        <td className="px-3 py-1.5">{d.pessoa ?? '—'}</td>
                        <td className="px-3 py-1.5">{fmtDia(d.data)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(d.valor_totvs)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(d.valor_headcoach)}</td>
                        <td className="px-3 py-1.5 text-gray-600">{d.tipo === 'diferente' ? `${stRot(d.status_totvs)} → ${stRot(d.status_headcoach)}` : stRot(d.status_totvs ?? d.status_headcoach)}{d.origem_headcoach === 'headcoach' ? <span className="ml-1 text-[10px] text-indigo-700">(criado no HeadCoach)</span> : null}</td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-xs truncate">{(d.campos || []).map((c) => c.campo).join(', ')}</td>
                      </tr>
                      {open && d.campos?.length > 0 && (
                        <tr className="bg-gray-50/70">
                          <td />
                          <td colSpan={9} className="px-3 py-2">
                            <table className="w-full text-[11px]">
                              <thead><tr className="text-gray-500"><th className="text-left py-1 w-48">Campo</th><th className="text-left py-1">TOTVS</th><th className="text-left py-1">HeadCoach</th></tr></thead>
                              <tbody>
                                {d.campos.map((c) => (
                                  <tr key={c.campo} className="border-t border-gray-200">
                                    <td className="py-1 font-mono">{c.campo}</td>
                                    <td className="py-1 text-blue-800 break-all">{fmtValor(c.campo, c.totvs)}</td>
                                    <td className="py-1 text-[#000638] break-all">{fmtValor(c.campo, c.headcoach)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {!divergencias.length && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-emerald-700"><CheckCircle size={18} className="inline mr-1" />{r.divergencias ? 'Nenhuma divergência neste filtro.' : 'Tudo bate: HeadCoach igual ao TOTVS no período.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!res && !loading && !erro && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-10 text-center text-xs text-gray-500">
          <ArrowsClockwise size={20} className="inline mb-1 text-gray-400" />
          <div>Escolha o módulo, o período e as empresas e clique em Comparar.</div>
        </div>
      )}
    </div>
  );
}

function Card({ titulo, valor, sub, tone = 'gray', icon: Icon, onClick, ativo }) {
  const tones = {
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
  };
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-xl border p-3 ${tones[tone]} ${onClick ? 'hover:shadow-sm' : 'cursor-default'} ${ativo ? 'ring-2 ring-[#000638]/40' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{titulo}</div>
        {Icon && <Icon size={14} className="opacity-60" />}
      </div>
      <div className="text-xl font-bold leading-tight mt-0.5">{valor}</div>
      {sub && <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>}
    </button>
  );
}

function Barra({ r }) {
  const total = r.iguais + r.diferentes + r.so_totvs + r.so_headcoach || 1;
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className="h-4 w-full rounded-full overflow-hidden bg-gray-100 flex">
      <div className="bg-emerald-500" style={{ width: pct(r.iguais) }} title={`iguais: ${r.iguais}`} />
      <div className="bg-orange-400" style={{ width: pct(r.diferentes) }} title={`diferentes: ${r.diferentes}`} />
      <div className="bg-rose-500" style={{ width: pct(r.so_totvs) }} title={`só no TOTVS: ${r.so_totvs}`} />
      <div className="bg-amber-400" style={{ width: pct(r.so_headcoach) }} title={`só no HeadCoach: ${r.so_headcoach}`} />
    </div>
  );
}
