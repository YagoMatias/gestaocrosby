import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ArrowsClockwise, CaretDown, CaretRight } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config/constants';

/**
 * Previsão de Recebimento — réplica da aba "Fluxo de Recebíveis" do Dryland
 * (João, Recuperação de Créditos, 27/10/2026). Semana de sábado a sexta; cada
 * cliente com títulos a vencer na semana recebe SIM / TALVEZ / NÃO
 * automaticamente pelo histórico (12 meses de baixas no TOTVS) e pode ser
 * trocado na linha. Dados: GET /api/previsao-recebimento (ver backend).
 */
class ErroBoundary extends React.Component {
  constructor(props) { super(props); this.state = { erro: null }; }
  static getDerivedStateFromError(e) { return { erro: e }; }
  componentDidCatch(e, info) { console.error('Previsão de Recebimento quebrou:', e, info); }
  render() {
    if (this.state.erro) {
      return (
        <div className="w-full max-w-3xl mx-auto my-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <b>A tela de Previsão teve um erro ao desenhar.</b>
          <div className="mt-1 text-xs text-red-700">{String(this.state.erro?.message || this.state.erro)}</div>
          <button className="mt-3 bg-[#000638] text-white px-3 py-1.5 rounded text-xs font-bold" onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const API = `${API_BASE_URL}/api/previsao-recebimento`;
const ST = {
  sim: { label: 'Sim', chip: 'bg-green-100 text-green-800 border-green-300', num: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
  talvez: { label: 'Talvez', chip: 'bg-amber-100 text-amber-800 border-amber-300', num: 'text-amber-600', btn: 'bg-amber-500 hover:bg-amber-600' },
  nao: { label: 'Não', chip: 'bg-red-100 text-red-800 border-red-300', num: 'text-red-600', btn: 'bg-red-600 hover:bg-red-700' },
};
const CANAIS = [
  ['', 'Todos os canais'],
  ['multimarca', 'Multimarca'],
  ['franquia', 'Franquia'],
  ['revenda', 'Revenda'],
  ['bluecred', 'BlueCred'],
];
const DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dbr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const dcurta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const diaSemana = (iso) => DS[new Date(`${iso}T12:00:00`).getDay()];
const addDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function PrevisaoRecebimentoInner() {
  const { user } = useAuth();
  const [semana, setSemana] = useState(0);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [canal, setCanal] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const [aberto, setAberto] = useState(new Set());
  const [marcando, setMarcando] = useState(null);
  const [verRegras, setVerRegras] = useState(false);

  const carregar = useCallback(async (idx, refresh = false) => {
    setLoading(true);
    setErro('');
    try {
      const r = await fetch(`${API}?semana=${idx}${refresh ? '&refresh=1' : ''}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.erro || `HTTP ${r.status}`);
      setDados(j);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(semana);
  }, [semana, carregar]);

  const semanas = useMemo(() => {
    if (dados?.semanas) return dados.semanas;
    // enquanto não carregou: calcula local (sábado a sexta)
    const hoje = new Date().toISOString().slice(0, 10);
    const d = new Date(`${hoje}T12:00:00`);
    const sab = addDias(hoje, -((d.getDay() + 1) % 7));
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const de = addDias(sab, 7 * i);
      return { idx: i, de, ate: addDias(de, 6), label: `${i === 0 ? 'Esta semana: ' : i === 1 ? 'Próxima semana: ' : ''}${dcurta(de)} a ${dcurta(addDias(de, 6))}` };
    });
  }, [dados]);

  const clientesBase = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados?.clientes || []).filter((c) => (!canal || c.canal === canal) && (!q || `${c.nome} ${c.cd}`.toLowerCase().includes(q)));
  }, [dados, canal, busca]);

  const totais = useMemo(() => {
    const t = { sim: { valor: 0, clientes: 0 }, talvez: { valor: 0, clientes: 0 }, nao: { valor: 0, clientes: 0 }, total: 0, titulos: 0, clientes: clientesBase.length };
    for (const c of clientesBase) {
      t[c.status].valor += c.valor;
      t[c.status].clientes++;
      t.total += c.valor;
      t.titulos += c.n_abertos;
    }
    return t;
  }, [clientesBase]);

  // por dia (sáb..sex) com o filtro de canal/busca aplicado
  const dias = useMemo(() => {
    if (!dados?.semana) return [];
    const rec = {};
    for (const r of dados.recebido_dia || []) rec[r.dia] = r;
    const out = [];
    for (let i = 0; i < 7; i++) {
      const dia = addDias(dados.semana.de, i);
      const linha = { dia, sim: 0, talvez: 0, nao: 0, pago: 0, titulos: 0, recebido: rec[dia] || null, fds: [0, 6].includes(new Date(`${dia}T12:00:00`).getDay()) };
      for (const c of clientesBase) for (const t of c.titulos) {
        if (t.venc !== dia) continue;
        if (t.pago) linha.pago += t.vl_pago; else linha[c.status] += t.valor;
        linha.titulos++;
      }
      out.push(linha);
    }
    return out;
  }, [dados, clientesBase]);

  const lista = useMemo(
    () => clientesBase.filter((c) => (!filtroStatus || c.status === filtroStatus) && (!filtroDia || c.titulos.some((t) => t.venc === filtroDia))),
    [clientesBase, filtroStatus, filtroDia],
  );

  const marcar = async (cd, status) => {
    setMarcando(`${cd}:${status}`);
    try {
      const r = await fetch(`${API}/marcar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cd_cliente: cd, status, por: user?.nome || user?.email || null }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.erro || 'Não salvou');
      setDados((d) => {
        if (!d) return d;
        const clientes = d.clientes.map((c) => (c.cd !== cd ? c : { ...c, manual: status !== 'auto', status: status === 'auto' ? c.auto : status, manual_por: status === 'auto' ? null : user?.nome || user?.email || null }));
        return { ...d, clientes };
      });
    } catch (e) {
      alert(`Não salvou: ${e.message}`);
    } finally {
      setMarcando(null);
    }
  };

  const toggle = (cd) =>
    setAberto((s) => {
      const n = new Set(s);
      if (n.has(cd)) n.delete(cd); else n.add(cd);
      return n;
    });

  const recebidoSemana = (dados?.recebido_dia || []).reduce((a, r) => a + r.valor, 0);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 py-3 px-2">
      <PageTitle
        title="Previsão de Recebimento"
        subtitle="Fluxo de recebíveis — semana de sábado a sexta. Sim / Talvez / Não automático pelo histórico; troque na linha se discordar."
        icon={CalendarCheck}
        iconColor="text-emerald-600"
      />

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={semana} onChange={(e) => { setSemana(Number(e.target.value)); setFiltroDia(''); }} disabled={loading} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white">
          {semanas.map((s) => (
            <option key={s.idx} value={s.idx}>{s.label}</option>
          ))}
        </select>
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white">
          {CANAIS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou código" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[200px]" />
        <button onClick={() => carregar(semana, true)} disabled={loading} className="flex items-center gap-1.5 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 text-xs font-bold">
          <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
        {dados?.gerado_em && (
          <span className="text-[11px] text-gray-500">
            calculado {new Date(dados.gerado_em).toLocaleString('pt-BR')}{dados.cache ? ' (cache)' : ''}
          </span>
        )}
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{erro}</div>}
      {dados?.avisos?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{dados.avisos.join(' · ')}</div>
      )}

      {/* KPIs */}
      {dados && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="rounded-lg border border-green-300 bg-white p-3 cursor-pointer" onClick={() => { setFiltroStatus(''); setFiltroDia(dados.hoje); }} title="Baixas no TOTVS hoje (clientes dos canais)">
            <div className="text-lg font-bold text-green-700">{brl(dados.recebido_hoje?.valor)}</div>
            <div className="text-xs font-semibold text-gray-700">Recebido hoje (TOTVS)</div>
            <div className="text-[11px] text-gray-500">{dados.recebido_hoje?.n || 0} baixa(s) · {dados.recebido_hoje?.clientes || 0} cliente(s) · semana {brl(recebidoSemana)}</div>
          </div>
          {['sim', 'talvez', 'nao'].map((st) => (
            <div key={st} className={`rounded-lg border bg-white p-3 cursor-pointer ${filtroStatus === st ? 'ring-2 ring-[#000638]' : 'border-gray-200'}`} onClick={() => setFiltroStatus(filtroStatus === st ? '' : st)}>
              <div className={`text-lg font-bold ${ST[st].num}`}>{brl(totais[st].valor)}</div>
              <div className="text-xs font-semibold text-gray-700">{ST[st].label}</div>
              <div className="text-[11px] text-gray-500">{totais[st].clientes} cliente(s) · {Math.round((totais[st].valor / Math.max(totais.total, 1)) * 100)}% do período</div>
            </div>
          ))}
          <div className={`rounded-lg border bg-white p-3 cursor-pointer ${!filtroStatus && !filtroDia ? 'ring-1 ring-gray-300' : 'border-gray-200'}`} onClick={() => { setFiltroStatus(''); setFiltroDia(''); }}>
            <div className="text-lg font-bold text-[#000638]">{totais.titulos}</div>
            <div className="text-xs font-semibold text-gray-700">Vencendo no período</div>
            <div className="text-[11px] text-gray-500">{brl(totais.total)} · {totais.clientes} cliente(s) · {dbr(dados.semana?.de)} a {dbr(dados.semana?.ate)}</div>
          </div>
        </div>
      )}

      {/* por dia */}
      {dados && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <div className="px-3 py-2 text-xs font-bold text-gray-700 border-b bg-gray-50">
            Previsão de Recebimento por dia <span className="font-normal text-gray-500">— clique no dia para ver quem vence nele</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-2 py-1.5 text-left">Dia</th>
                <th className="px-2 py-1.5 text-right">Recebido no dia (TOTVS)</th>
                <th className="px-2 py-1.5 text-right">Sim</th>
                <th className="px-2 py-1.5 text-right">Talvez</th>
                <th className="px-2 py-1.5 text-right">Não</th>
                <th className="px-2 py-1.5 text-right">Total previsto</th>
                <th className="px-2 py-1.5 text-right">Já pago (vence no dia)</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => (
                <tr key={d.dia} className={`border-b hover:bg-gray-50 cursor-pointer ${filtroDia === d.dia ? 'bg-blue-50' : ''} ${d.dia === dados.hoje ? 'font-semibold' : ''}`} onClick={() => setFiltroDia(filtroDia === d.dia ? '' : d.dia)}>
                  <td className="px-2 py-1.5">{diaSemana(d.dia)} {dcurta(d.dia)}{d.dia === dados.hoje ? <span className="ml-1 text-[10px] bg-blue-100 text-blue-800 rounded px-1">hoje</span> : null}</td>
                  <td className="px-2 py-1.5 text-right">{d.fds || d.dia > dados.hoje ? <span className="text-gray-400">—</span> : <><b>{brl(d.recebido?.valor || 0)}</b>{d.recebido?.n ? <span className="text-gray-500"> · {d.recebido.n} baixa(s)</span> : null}</>}</td>
                  <td
                    className="px-2 py-1.5 text-right text-green-700 cursor-pointer hover:underline"
                    onClick={(ev) => { ev.stopPropagation(); setFiltroDia(d.dia); setFiltroStatus('sim'); }}
                    title="Ver os clientes Sim que vencem neste dia"
                  >{brl(d.sim)}</td>
                  <td
                    className="px-2 py-1.5 text-right text-amber-600 cursor-pointer hover:underline"
                    onClick={(ev) => { ev.stopPropagation(); setFiltroDia(d.dia); setFiltroStatus('talvez'); }}
                    title="Ver os clientes Talvez que vencem neste dia"
                  >{brl(d.talvez)}</td>
                  <td
                    className="px-2 py-1.5 text-right text-red-600 cursor-pointer hover:underline"
                    onClick={(ev) => { ev.stopPropagation(); setFiltroDia(d.dia); setFiltroStatus('nao'); }}
                    title="Ver os clientes Não que vencem neste dia"
                  >{brl(d.nao)}</td>
                  <td className="px-2 py-1.5 text-right font-bold">{brl(d.sim + d.talvez + d.nao)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-600">{d.pago ? brl(d.pago) : '—'}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="px-2 py-1.5">Semana</td>
                <td className="px-2 py-1.5 text-right">{brl(recebidoSemana)}</td>
                <td className="px-2 py-1.5 text-right text-green-700">{brl(totais.sim.valor)}</td>
                <td className="px-2 py-1.5 text-right text-amber-600">{brl(totais.talvez.valor)}</td>
                <td className="px-2 py-1.5 text-right text-red-600">{brl(totais.nao.valor)}</td>
                <td className="px-2 py-1.5 text-right">{brl(totais.total)}</td>
                <td className="px-2 py-1.5 text-right text-gray-600">{brl(dias.reduce((a, d) => a + d.pago, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* clientes */}
      {dados && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <div className="px-3 py-2 text-xs font-bold text-gray-700 border-b bg-gray-50 flex flex-wrap items-center gap-2">
            Clientes <span className="font-normal text-gray-500">{lista.length} cliente(s) · {brl(lista.reduce((a, c) => a + c.valor, 0))}{filtroDia ? ` · vencimento ${dbr(filtroDia)}` : ''}{filtroStatus ? ` · ${ST[filtroStatus].label}` : ''}</span>
            {(filtroDia || filtroStatus) && (
              <button className="text-[11px] text-blue-700 underline" onClick={() => { setFiltroDia(''); setFiltroStatus(''); }}>limpar filtro</button>
            )}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-2 py-1.5 text-left">Cliente</th>
                <th className="px-2 py-1.5 text-left">Próximo venc.</th>
                <th className="px-2 py-1.5 text-right">Títulos</th>
                <th className="px-2 py-1.5 text-right">A vencer</th>
                <th className="px-2 py-1.5 text-right">Já vencido</th>
                <th className="px-2 py-1.5 text-left">Previsão</th>
                <th className="px-2 py-1.5 text-left">Por quê</th>
                <th className="px-2 py-1.5 text-left">Trocar</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <React.Fragment key={c.cd}>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1.5">
                      <button className="flex items-center gap-1 text-left" onClick={() => toggle(c.cd)} title="Ver os títulos">
                        {aberto.has(c.cd) ? <CaretDown size={12} /> : <CaretRight size={12} />}
                        <span><b>{c.nome}</b> <span className="text-gray-500">cód. {c.cd} · {c.canal}</span></span>
                      </button>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{dbr(c.prox)}</td>
                    <td className="px-2 py-1.5 text-right">{c.n_abertos}{c.n > c.n_abertos ? <span className="text-gray-400"> (+{c.n - c.n_abertos} pago)</span> : null}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{brl(c.valor)}</td>
                    <td className="px-2 py-1.5 text-right text-red-600">{c.vencido > 0 ? brl(c.vencido) : '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-bold ${ST[c.status].chip}`}>{ST[c.status].label}</span>
                      {c.manual && <span className="ml-1 text-[10px] text-gray-500">por {c.manual_por || '?'}</span>}
                    </td>
                    <td className="px-2 py-1.5 min-w-[220px] text-gray-700">
                      {c.motivo}
                      {c.manual && c.auto !== c.status && <span className="text-gray-500"> (automático seria {ST[c.auto].label})</span>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {['sim', 'talvez', 'nao'].filter((x) => x !== c.status).map((x) => (
                        <button key={x} disabled={marcando === `${c.cd}:${x}`} onClick={() => marcar(c.cd, x)} className={`mr-1 px-2 py-0.5 rounded text-[11px] font-semibold text-white disabled:opacity-50 ${ST[x].btn}`}>{ST[x].label}</button>
                      ))}
                      {c.manual && (
                        <button disabled={marcando === `${c.cd}:auto`} onClick={() => marcar(c.cd, 'auto')} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50">Automático</button>
                      )}
                    </td>
                  </tr>
                  {aberto.has(c.cd) && (
                    <tr className="bg-gray-50 border-b">
                      <td colSpan={8} className="px-4 py-2">
                        <table className="text-[11px]">
                          <thead><tr className="text-gray-500"><th className="pr-3 text-left">Título</th><th className="pr-3 text-left">Vencimento</th><th className="pr-3 text-right">Valor</th><th className="text-left">Situação</th></tr></thead>
                          <tbody>
                            {c.titulos.map((t) => (
                              <tr key={`${t.e}-${t.f}-${t.p}`}>
                                <td className="pr-3">{t.e}-{t.f}/{t.p}</td>
                                <td className="pr-3">{diaSemana(t.venc)} {dbr(t.venc)}</td>
                                <td className="pr-3 text-right">{brl(t.valor)}</td>
                                <td>{t.pago ? <span className="text-green-700">pago em {dbr(t.dt_liq)} ({brl(t.vl_pago)})</span> : t.venc < dados.hoje ? <span className="text-red-600">vencido</span> : 'a vencer'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!lista.length && (
                <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">{loading ? 'Carregando...' : 'Nenhum título a vencer neste filtro.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* regras */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <button className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 flex items-center gap-1" onClick={() => setVerRegras((v) => !v)}>
          {verRegras ? <CaretDown size={12} /> : <CaretRight size={12} />} Como a classificação automática decide
        </button>
        {verRegras && (
          <div className="px-4 pb-3 text-xs text-gray-700 leading-relaxed">
            <b>Sim:</b> não deve nada vencido e paga em dia (todas as parcelas pagas até 3 dias depois do vencimento), ou tem no máximo 20% das parcelas pagas com mais de 5 dias de atraso.<br />
            <b>Não:</b> tem título com mais de 30 dias de atraso, ou costuma atrasar e já está com título vencido.<br />
            <b>Talvez:</b> todo o resto: está com título vencido há até 30 dias, costuma atrasar, tem histórico irregular ou pouco histórico (menos de 3 parcelas pagas).<br />
            O histórico usa as baixas dos últimos 12 meses no TOTVS. A marcação manual vale até você clicar em "Automático".
          </div>
        )}
      </div>
    </div>
  );
}

export default function PrevisaoRecebimento() {
  return (
    <ErroBoundary>
      <PrevisaoRecebimentoInner />
    </ErroBoundary>
  );
}
