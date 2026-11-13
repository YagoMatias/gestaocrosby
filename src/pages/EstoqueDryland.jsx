// ============================================================================
// HEADCOACH › ESTOQUE › Estoque Dryland (Yago, 13/11/2026). O estoque da Loja
// Virtual é do Dryland (agente Estoquista): esta tela só CONSULTA, pela porta
// estq_gw, via /api/dryland-estoque. Nada aqui grava estoque.
// O saldo vem por código, sem loja: Max (loja.lv_estoque, Blue House) + PE +
// Brejinho = Total. É da empresa 99 — a API só mostra a quem enxerga a 99.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Package, MagnifyingGlass, ArrowsClockwise, ClockCounterClockwise, ListChecks, BookOpen, WarningCircle, CheckCircle, CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { apiJson } from '../utils/apiAuth';

const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const btnCls = 'inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-3 text-sm font-semibold text-white hover:bg-[#000638]/90 disabled:opacity-50';
const btnSec = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const thCls = 'whitespace-nowrap px-2 py-2 font-semibold';
const LIMITE = 100;

const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== '' && v != null && v !== false)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
const num = (v) => (Number(v) || 0).toLocaleString('pt-BR');
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (s) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const Qtd = ({ v, forte }) => {
  const n = Number(v) || 0;
  return <span className={`${n < 0 ? 'font-bold text-rose-600' : n === 0 ? 'text-gray-300' : forte ? 'font-bold text-[#000638]' : 'text-gray-700'}`}>{num(n)}</span>;
};

const Caixa = ({ children, className = '' }) => <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>{children}</div>;
const Erro = ({ msg }) => (msg ? <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{msg}</p> : null);
const Vazio = ({ children }) => <p className="px-3 py-8 text-center text-sm text-gray-500">{children}</p>;

// ─── Saldo ──────────────────────────────────────────────────────────────────
function Resumo({ onClassificacao }) {
  const [r, setR] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async (forcar = false) => {
    setCarregando(true);
    setErro('');
    try {
      setR((await apiJson(`/api/dryland-estoque/resumo${forcar ? '?forcar=1' : ''}`)).data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const t = r?.totais;
  const kpis = t
    ? [
        { nome: 'Códigos com saldo', valor: num(t.codigos) },
        { nome: 'Max (Blue House)', valor: num(t.max), sub: 'peças' },
        { nome: 'PE', valor: num(t.pe), sub: 'peças' },
        { nome: 'Brejinho', valor: num(t.bj), sub: 'peças' },
        { nome: 'Total', valor: num(t.total), sub: 'peças', forte: true },
        { nome: 'Valor (preço revenda)', valor: brl(t.valor) },
      ]
    : [];
  return (
    <div className="mb-3">
      <Erro msg={erro} />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">{r ? `Estoque da Loja Virtual · lido às ${dataHora(r.atualizadoEm)}` : carregando ? 'Somando o estoque…' : ''}</p>
        <button type="button" className={btnSec} onClick={() => carregar(true)} disabled={carregando}>
          <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      {t && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => (
              <div key={k.nome} className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">{k.nome}</p>
                <p className={`text-lg font-extrabold ${k.forte ? 'text-[#000638]' : 'text-gray-800'}`}>{k.valor}</p>
                {k.sub && <p className="text-[10.5px] text-gray-400">{k.sub}</p>}
              </div>
            ))}
          </div>
          {t.negativos > 0 && (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">{t.negativos} código(s) com saldo negativo em algum local (inventário sujo — avisar o Estoquista).</p>
          )}
          <details className="mb-1 rounded-xl border border-gray-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700">Por classificação ({r.classificacoes.length}) — clique numa linha para filtrar o saldo</summary>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10.5px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className={`${thCls} text-left`}>Classificação</th>
                    <th className={`${thCls} text-right`}>Códigos</th>
                    <th className={`${thCls} text-right`}>Max</th>
                    <th className={`${thCls} text-right`}>PE</th>
                    <th className={`${thCls} text-right`}>Brejinho</th>
                    <th className={`${thCls} text-right`}>Total</th>
                    <th className={`${thCls} text-right`}>Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {r.classificacoes.map((c) => (
                    <tr key={c.classificacao} className="cursor-pointer hover:bg-indigo-50/50" onClick={() => onClassificacao(c.classificacao === 'SEM CLASSIFICAÇÃO' ? '' : c.classificacao)}>
                      <td className="px-2 py-1.5 font-medium text-gray-800">{c.classificacao}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(c.codigos)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={c.max} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={c.pe} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={c.bj} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={c.total} forte /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{brl(c.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function AbaSaldo({ onMovimentos }) {
  const [f, setF] = useState({ busca: '', cod: '', classificacao: '', so_com_saldo: true });
  const [offset, setOffset] = useState(0);
  const [linhas, setLinhas] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const consultar = useCallback(async (filtros, off = 0) => {
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`/api/dryland-estoque/saldo?${qs({ ...filtros, so_com_saldo: filtros.so_com_saldo ? 1 : '', limite: LIMITE, offset: off })}`);
      setLinhas(Array.isArray(j.data) ? j.data : []);
      setOffset(off);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const qtd = linhas?.length ?? 0;
  return (
    <>
      <Resumo
        onClassificacao={(c) => {
          const nf = { busca: '', cod: '', classificacao: c, so_com_saldo: true };
          setF(nf);
          consultar(nf, 0);
        }}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          consultar(f, 0);
        }}
        className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:grid-cols-6"
      >
        <div className="col-span-2">
          <label className={labelCls}>Busca (descrição)</label>
          <input value={f.busca} onChange={set('busca')} className={inputCls} placeholder="ex.: chino sarja preto" />
        </div>
        <div>
          <label className={labelCls}>Código (exato)</label>
          <input value={f.cod} onChange={set('cod')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Classificação</label>
          <input value={f.classificacao} onChange={set('classificacao')} className={inputCls} placeholder="ex.: CALCA CHINO" />
        </div>
        <label className="mb-0 flex h-9 cursor-pointer items-center gap-2 self-end whitespace-nowrap text-sm text-gray-700">
          <input type="checkbox" checked={f.so_com_saldo} onChange={set('so_com_saldo')} className="mb-0 h-4 w-4" /> Só com saldo
        </label>
        <div className="flex items-end justify-end">
          <button type="submit" className={btnCls} disabled={carregando}>
            <MagnifyingGlass size={15} weight="bold" /> {carregando ? 'Consultando…' : 'Consultar'}
          </button>
        </div>
      </form>
      <Erro msg={erro} />
      {linhas && (
        <Caixa>
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-xs text-gray-500">
            <span>{qtd} código(s) · clique numa linha para ver os movimentos</span>
            <span className="flex items-center gap-1">
              <button type="button" className={btnSec} disabled={carregando || offset === 0} onClick={() => consultar(f, Math.max(0, offset - LIMITE))}>
                <CaretLeft size={14} />
              </button>
              <span className="px-1">{qtd ? `${offset + 1}–${offset + qtd}` : '0'}</span>
              <button type="button" className={btnSec} disabled={carregando || qtd < LIMITE} onClick={() => consultar(f, offset + LIMITE)}>
                <CaretRight size={14} />
              </button>
            </span>
          </div>
          {!qtd ? (
            <Vazio>Nenhum código encontrado.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className={`${thCls} text-left`}>Código</th>
                    <th className={`${thCls} text-left`}>Descrição</th>
                    <th className={`${thCls} text-left`}>Cor</th>
                    <th className={`${thCls} text-left`}>Tam</th>
                    <th className={`${thCls} text-left`}>Classificação</th>
                    <th className={`${thCls} text-right`}>Max</th>
                    <th className={`${thCls} text-right`}>PE</th>
                    <th className={`${thCls} text-right`}>Brejinho</th>
                    <th className={`${thCls} text-right`}>Total</th>
                    <th className={`${thCls} text-right`}>Preço revenda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linhas.map((l) => (
                    <tr key={l.cod} onClick={() => onMovimentos(String(l.cod))} className="cursor-pointer hover:bg-indigo-50/50">
                      <td className="px-2 py-1.5 font-mono text-gray-700">{l.cod}</td>
                      <td className="px-2 py-1.5 text-gray-800">{l.descricao}</td>
                      <td className="px-2 py-1.5 text-gray-600">{l.cor || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-600">{l.tamanho || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-600">{l.classificacao || '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={l.qtd_max} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={l.qtd_pe} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={l.qtd_bj} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums"><Qtd v={l.qtd_atual} forte /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{l.preco_revenda != null ? brl(l.preco_revenda) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Caixa>
      )}
    </>
  );
}

// ─── Movimentos ─────────────────────────────────────────────────────────────
function AbaMovimentos({ codInicial }) {
  const [cod, setCod] = useState(codInicial || '');
  const [desde, setDesde] = useState('');
  const [linhas, setLinhas] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const consultar = useCallback(async (c, d) => {
    if (!c) return;
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`/api/dryland-estoque/movimentos?${qs({ cod: c, desde: d, limite: 500 })}`);
      setLinhas(Array.isArray(j.data) ? j.data : []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    if (codInicial) {
      setCod(codInicial);
      consultar(codInicial, '');
    }
  }, [codInicial, consultar]);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          consultar(cod.trim(), desde);
        }}
        className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
      >
        <div className="w-40">
          <label className={labelCls}>Código do produto</label>
          <input value={cod} onChange={(e) => setCod(e.target.value)} className={inputCls} />
        </div>
        <div className="w-44">
          <label className={labelCls}>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
        </div>
        <button type="submit" className={btnCls} disabled={carregando || !cod.trim()}>
          <MagnifyingGlass size={15} weight="bold" /> {carregando ? 'Consultando…' : 'Ver movimentos'}
        </button>
      </form>
      <Erro msg={erro} />
      {linhas && (
        <Caixa>
          {!linhas.length ? (
            <Vazio>Nenhum movimento para este código{desde ? ' no período' : ''}.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className={`${thCls} text-left`}>Data</th>
                    <th className={`${thCls} text-right`}>Qtd</th>
                    <th className={`${thCls} text-left`}>Motivo</th>
                    <th className={`${thCls} text-left`}>Referência</th>
                    <th className={`${thCls} text-left`}>Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linhas.map((m, i) => {
                    const d = Number(m.delta) || 0;
                    return (
                      <tr key={m.id ?? i}>
                        <td className="whitespace-nowrap px-2 py-1.5 text-gray-600">{dataHora(m.criado_em)}</td>
                        <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-600' : 'text-gray-400'}`}>{d > 0 ? `+${d}` : d}</td>
                        <td className="px-2 py-1.5 text-gray-800">{m.motivo || '—'}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 font-mono text-gray-600">{m.ref || '—'}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-gray-600">{m.por || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Caixa>
      )}
    </>
  );
}

// ─── Fila ───────────────────────────────────────────────────────────────────
function AbaFila() {
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const d = (await apiJson('/api/dryland-estoque/fila')).data;
      setLinhas(Array.isArray(d) ? d : d ? [d] : []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const cols = linhas?.length ? Object.keys(linhas[0]) : [];
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 shadow-sm">
        <span>Pedidos de operação feitos com o token do HeadCoach, com o status e o motivo de recusa. Quem executa é o Estoquista.</span>
        <button type="button" className={btnSec} onClick={carregar} disabled={carregando}>
          <ArrowsClockwise size={14} /> Atualizar
        </button>
      </div>
      <Erro msg={erro} />
      {linhas && (
        <Caixa>
          {!linhas.length ? (
            <Vazio>Nenhum pedido na fila.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide text-gray-500">
                  <tr>{cols.map((c) => <th key={c} className={`${thCls} text-left`}>{c.replace(/_/g, ' ')}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linhas.map((l, i) => (
                    <tr key={l.id ?? i}>
                      {cols.map((c) => (
                        <td key={c} className="px-2 py-1.5 text-gray-700">
                          {l[c] == null ? '—' : typeof l[c] === 'object' ? <span className="font-mono text-[10.5px] text-gray-500">{JSON.stringify(l[c]).slice(0, 160)}</span> : /_em$|^data/.test(c) ? dataHora(l[c]) : String(l[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Caixa>
      )}
    </>
  );
}

// ─── Manual e operações ─────────────────────────────────────────────────────
const RISCO = { baixo: 'bg-emerald-50 text-emerald-700 ring-emerald-200', medio: 'bg-amber-50 text-amber-700 ring-amber-200', alto: 'bg-rose-50 text-rose-700 ring-rose-200' };
function AbaManual() {
  const [titulos, setTitulos] = useState(null);
  const [ops, setOps] = useState(null);
  const [doc, setDoc] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    Promise.all([apiJson('/api/dryland-estoque/manual'), apiJson('/api/dryland-estoque/operacoes')])
      .then(([m, o]) => {
        setTitulos(Array.isArray(m.data) ? m.data : []);
        setOps(Array.isArray(o.data) ? o.data : []);
      })
      .catch((e) => setErro(e.message));
  }, []);
  const abrir = async (id) => {
    setErro('');
    try {
      setDoc((await apiJson(`/api/dryland-estoque/manual?id=${encodeURIComponent(id)}`)).data);
    } catch (e) {
      setErro(e.message);
    }
  };
  return (
    <>
      <Erro msg={erro} />
      <Caixa className="mb-3">
        <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Manual do Estoquista</p>
        {titulos == null ? (
          <Vazio>Carregando…</Vazio>
        ) : (
          <ul className="divide-y divide-gray-100">
            {titulos.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => abrir(t.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50/50">
                  <span className="font-medium text-gray-800">{t.titulo}</span>
                  <span className="shrink-0 text-[11px] text-gray-400">v{t.versao} · {dataHora(t.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Caixa>
      {doc && (
        <Caixa className="mb-3">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p className="text-sm font-bold text-gray-800">{doc.titulo}</p>
            <button type="button" onClick={() => setDoc(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap px-3 py-3 font-sans text-[13px] leading-relaxed text-gray-800">{doc.conteudo_md || doc.conteudo || JSON.stringify(doc, null, 2)}</pre>
        </Caixa>
      )}
      <Caixa>
        <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Operações que podem ser pedidas ao Estoquista ({ops?.length ?? '…'})</p>
        {ops == null ? (
          <Vazio>Carregando…</Vazio>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ops.map((o) => (
              <li key={o.chave} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">{o.nome}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10.5px] text-gray-500">{o.chave}</span>
                  {o.familia && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] text-indigo-700 ring-1 ring-indigo-200">{o.familia}</span>}
                  {o.risco && <span className={`rounded-full px-2 py-0.5 text-[10.5px] ring-1 ${RISCO[o.risco] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>risco {o.risco}</span>}
                  {o.exige_aprov_max && <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10.5px] text-gray-600 ring-1 ring-gray-200">aprova Max</span>}
                  {o.exige_aprov_fabio && <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10.5px] text-gray-600 ring-1 ring-gray-200">aprova Fábio</span>}
                </div>
                {o.descricao && <p className="mt-0.5 text-xs text-gray-600">{o.descricao}</p>}
                {o.regra && <p className="mt-0.5 text-xs text-gray-500"><b>Regra:</b> {o.regra}</p>}
              </li>
            ))}
          </ul>
        )}
      </Caixa>
    </>
  );
}

// ─── página ─────────────────────────────────────────────────────────────────
const ABAS = [
  { id: 'saldo', nome: 'Saldo', icon: Package },
  { id: 'movimentos', nome: 'Movimentos', icon: ClockCounterClockwise },
  { id: 'fila', nome: 'Fila de pedidos', icon: ListChecks },
  { id: 'manual', nome: 'Manual e operações', icon: BookOpen },
];

export default function EstoqueDryland() {
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('saldo');
  const [codMov, setCodMov] = useState('');
  useEffect(() => {
    apiJson('/api/dryland-estoque/status')
      .then((j) => setStatus(j.data))
      .catch((e) => setErro(e.message));
  }, []);
  const pronto = status?.conectado;
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-7xl">
        <PageTitle title="Estoque Dryland" subtitle="Estoque oficial da Loja Virtual (Max, PE e Brejinho) — só consulta" icon={Package} />
        <Erro msg={erro} />
        {status && (
          <div className={`mb-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${pronto ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
            {pronto ? <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0" /> : <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />}
            <span>
              {pronto
                ? 'Conectado ao estoque do Dryland (porta do Estoquista). Só consulta: entradas, baixas, transferências e balanços são pedidos ao Estoquista.'
                : status.configurado
                  ? `O token está configurado, mas o Dryland não respondeu: ${status.erro}`
                  : 'Aguardando o token de acesso ao estoque do Dryland. Assim que ele for configurado no servidor, esta tela passa a funcionar.'}
            </span>
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              disabled={!pronto}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${aba === a.id ? 'bg-[#000638] text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}
            >
              <a.icon size={15} /> {a.nome}
            </button>
          ))}
        </div>
        {pronto && aba === 'saldo' && (
          <AbaSaldo
            onMovimentos={(c) => {
              setCodMov(c);
              setAba('movimentos');
            }}
          />
        )}
        {pronto && aba === 'movimentos' && <AbaMovimentos codInicial={codMov} />}
        {pronto && aba === 'fila' && <AbaFila />}
        {pronto && aba === 'manual' && <AbaManual />}
      </div>
    </div>
  );
}
