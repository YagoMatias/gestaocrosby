// ============================================================================
// VAREJO › RECEBIMENTO DE MERCADORIA (Yago, 13/11/2026)
// A loja vê as transferências feitas para ela (tela Transferências: matriz →
// lojas), clica em RECEBER MERCADORIA, confere as peças e finaliza: o que foi
// recebido entra no estoque da loja.
//   • Conferência: leitor RFID de mesa (as etiquetas da transferência dão baixa
//     sozinhas); peça sem etiqueta (ou etiqueta que não leu) pela quantidade.
//     Etiqueta lida que não é da transferência aparece como "de fora".
//   • Faltou peça ou chegou de fora → observação obrigatória.
//   • Aba Estoque: o saldo da loja (por enquanto, só as peças recebidas).
// A conferência em andamento fica salva no navegador (recarregar não perde).
// API: /api/recebimento-mercadoria (exige login) — services/recebimentoTransferencia.js
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  Truck,
  CheckCircle,
  Warning,
  Spinner,
  ArrowsClockwise,
  Broadcast,
  Plugs,
  PlugsConnected,
  Plus,
  Minus,
  X,
  MagnifyingGlass,
  Stack,
  ArrowLeft,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { apiJson } from '../utils/apiAuth';
import useRfidReader from '../hooks/useRfidReader';

const API = '/api/recebimento-mercadoria';
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const btnPri = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white hover:bg-[#000638]/90 disabled:opacity-40';
const btnSec = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40';
const SITUACAO = {
  a_receber: { label: 'A RECEBER', cls: 'bg-amber-50 text-amber-800 ring-amber-300' },
  recebida: { label: 'RECEBIDA', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  recebida_divergencia: { label: 'RECEBIDA COM DIVERGÊNCIA', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
const ABAS = [
  { k: 'a_receber', label: 'A receber', icon: Truck },
  { k: 'recebidas', label: 'Recebidas', icon: CheckCircle },
  { k: 'estoque', label: 'Estoque', icon: Stack },
];
const rascunhoKey = (id) => `receb_mercadoria_${id}`;
const lerRascunho = (id) => {
  try {
    return JSON.parse(localStorage.getItem(rascunhoKey(id)) || 'null');
  } catch {
    return null;
  }
};
const gravarRascunho = (id, v) => {
  try {
    if (v) localStorage.setItem(rascunhoKey(id), JSON.stringify(v));
    else localStorage.removeItem(rascunhoKey(id));
  } catch {
    /* sem storage */
  }
};

export default function RecebimentoMercadoria() {
  const [aba, setAba] = useState('a_receber');
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState(() => {
    try {
      return localStorage.getItem('receb_mercadoria_empresa') || '';
    } catch {
      return '';
    }
  });
  const [lista, setLista] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState(null);
  const [conferindo, setConferindo] = useState(null); // id da transferência em conferência
  const [vendo, setVendo] = useState(null); // id da transferência recebida (detalhe)

  const avisar = useCallback((tipo, msg) => {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 7000);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('receb_mercadoria_empresa', empresa);
    } catch {
      /* sem storage */
    }
  }, [empresa]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/transferencias${empresa ? `?empresa=${empresa}` : ''}`);
      setEmpresas(j.data.empresas || []);
      setLista(j.data.transferencias || []);
    } catch (e) {
      setErro(e.message);
      setLista(null);
    } finally {
      setCarregando(false);
    }
  }, [empresa]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  if (conferindo) {
    return (
      <Conferencia
        id={conferindo}
        onVoltar={() => setConferindo(null)}
        onRecebido={(msg) => {
          setConferindo(null);
          avisar('ok', msg);
          setAba('recebidas');
          carregar();
        }}
      />
    );
  }

  const aReceber = (lista || []).filter((t) => t.situacao === 'a_receber');
  const recebidas = (lista || []).filter((t) => t.situacao !== 'a_receber');
  const mostrar = aba === 'a_receber' ? aReceber : recebidas;
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Recebimento de Mercadoria" subtitle="Transferências da matriz para a loja: confira as peças e elas entram no estoque da loja" icon={Package} />
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="w-full sm:w-80">
            <label className={labelCls}>Loja</label>
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputCls}>
              <option value="">{empresas.length === 1 ? empresas[0].nome : 'Todas as minhas lojas'}</option>
              {empresas.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.code} — {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button onClick={carregar} disabled={carregando} className={btnSec}>
            <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
          </button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {ABAS.map((x) => (
              <button
                key={x.k}
                onClick={() => setAba(x.k)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${aba === x.k ? 'bg-[#000638] text-white' : 'text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50'}`}
              >
                <x.icon size={14} /> {x.label}
                {x.k === 'a_receber' && aReceber.length > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] text-[#000638]">{aReceber.length}</span>}
              </button>
            ))}
          </div>
        </div>
        {aviso && (
          <p className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{aviso.msg}</p>
        )}
        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}

        {aba === 'estoque' ? (
          <Estoque empresa={empresa} />
        ) : !lista ? (
          carregando && (
            <div className="py-16 text-center text-gray-400">
              <Spinner size={22} className="mx-auto animate-spin" />
            </div>
          )
        ) : mostrar.length === 0 ? (
          <p className="rounded-xl bg-white px-3 py-12 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
            {aba === 'a_receber' ? 'Nenhuma transferência esperando recebimento.' : 'Nenhuma transferência recebida ainda.'}
          </p>
        ) : (
          <div className="space-y-2">
            {mostrar.map((t) => {
              const S = SITUACAO[t.situacao];
              const r = t.recebimento;
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[#000638]">
                    <Truck size={20} weight="bold" />
                  </span>
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-bold text-[#000638]">
                      {t.nf_numero ? `NF-e ${t.nf_numero}` : `Transação ${t.transacao_code || t.id}`} · {t.empresa} → {t.empresa_destino} {t.empresa_destino_nome || ''}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Enviada em {fmtDataHora(t.criado_em)}
                      {t.criado_por ? ` por ${t.criado_por}` : ''} · {t.qtd_esperada} peça(s) · {t.qtd_itens} produto(s) · {fmtBRL(t.total)}
                    </p>
                    {r && (
                      <p className="text-[11px] text-gray-600">
                        Recebida por {r.recebido_por} em {fmtDataHora(r.recebido_em)} · {r.qtd_recebida} de {r.qtd_esperada} peça(s)
                        {r.qtd_faltando ? ` · faltaram ${r.qtd_faltando}` : ''}
                        {r.qtd_fora ? ` · ${r.qtd_fora} de fora` : ''}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${S.cls}`}>{S.label}</span>
                  {t.situacao === 'a_receber' ? (
                    <button onClick={() => setConferindo(t.id)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                      <Package size={16} weight="bold" /> RECEBER MERCADORIA
                    </button>
                  ) : (
                    <button onClick={() => setVendo(t.id)} className={btnSec}>
                      Ver recebimento
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {vendo && <DetalheRecebido id={vendo} onFechar={() => setVendo(null)} />}
    </div>
  );
}

// ─── CONFERÊNCIA ─────────────────────────────────────────────────────────────
function Conferencia({ id, onVoltar, onRecebido }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const rascunho = useMemo(() => lerRascunho(id), [id]);
  const [lidos, setLidos] = useState(() => new Set(rascunho?.lidos || []));
  const [manuais, setManuais] = useState(() => rascunho?.manuais || {});
  const [obs, setObs] = useState(() => rascunho?.obs || '');
  const [busca, setBusca] = useState('');
  const [busy, setBusy] = useState(false);
  const [ultimo, setUltimo] = useState(null); // { epc, item }
  const mapaRef = useRef(new Map()); // epc → productCode

  useEffect(() => {
    apiJson(`${API}/transferencias/${id}`)
      .then((j) => {
        setD(j.data);
        const m = new Map();
        for (const i of j.data.transferencia.itens) for (const e of i.epcs) m.set(e, i.productCode);
        mapaRef.current = m;
      })
      .catch((e) => setErro(e.message));
  }, [id]);
  useEffect(() => {
    gravarRascunho(id, { lidos: [...lidos], manuais, obs });
  }, [id, lidos, manuais, obs]);

  const onEpc = useCallback((epc) => {
    const e = String(epc || '').trim().toUpperCase();
    if (!e) return;
    setLidos((s) => {
      if (s.has(e)) return s;
      const n = new Set(s);
      n.add(e);
      return n;
    });
    setUltimo({ epc: e, productCode: mapaRef.current.get(e) ?? null, em: Date.now() });
  }, []);
  const { status: rfid, error: rfidErro, supported, connect, disconnect } = useRfidReader(onEpc);

  const t = d?.transferencia;
  const linhas = useMemo(() => {
    if (!t) return [];
    return t.itens.map((i) => {
      const porEtiqueta = i.epcs.filter((e) => lidos.has(e)).length;
      const resto = Math.max(0, i.quantidade - porEtiqueta);
      const manual = Math.min(resto, Math.max(0, parseInt(manuais[i.productCode] || 0, 10) || 0));
      return { ...i, porEtiqueta, manual, recebido: porEtiqueta + manual, falta: i.quantidade - porEtiqueta - manual };
    });
  }, [t, lidos, manuais]);
  const fora = useMemo(() => [...lidos].filter((e) => !mapaRef.current.has(e)), [lidos, d]); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = linhas.reduce((s, l) => ({ esperado: s.esperado + l.quantidade, recebido: s.recebido + l.recebido, falta: s.falta + l.falta }), { esperado: 0, recebido: 0, falta: 0 });
  const divergencia = tot.falta > 0 || fora.length > 0;
  const visiveis = busca.trim()
    ? linhas.filter((l) => String(l.productCode).includes(busca.trim()) || String(l.name || '').toUpperCase().includes(busca.trim().toUpperCase()))
    : linhas;
  const ordenadas = [...visiveis].sort((a, b) => (a.falta === 0) - (b.falta === 0) || String(a.name || '').localeCompare(String(b.name || '')));
  const ajustar = (pc, delta) => setManuais((m) => ({ ...m, [pc]: Math.max(0, (parseInt(m[pc] || 0, 10) || 0) + delta) }));
  const tudoManual = () => setManuais(Object.fromEntries(linhas.map((l) => [l.productCode, l.quantidade - l.porEtiqueta])));

  const finalizar = async () => {
    if (divergencia && obs.trim().length < 3) {
      setErro('Faltou peça ou chegou peça de fora: escreva uma observação antes de finalizar.');
      return;
    }
    if (!window.confirm(divergencia ? `Finalizar com ${tot.recebido} de ${tot.esperado} peça(s)${fora.length ? ` e ${fora.length} etiqueta(s) de fora` : ''}? Não dá para receber de novo.` : `Finalizar o recebimento das ${tot.recebido} peça(s)?`)) return;
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/transferencias/${id}/receber`, {
        method: 'POST',
        body: { epcs: [...lidos], manuais: Object.fromEntries(linhas.filter((l) => l.manual > 0).map((l) => [l.productCode, l.manual])), observacao: obs },
      });
      gravarRascunho(id, null);
      try {
        await disconnect();
      } catch {
        /* leitor já desligado */
      }
      onRecebido(j.message || 'Mercadoria recebida');
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ultimaLinha = ultimo?.productCode ? linhas.find((l) => l.productCode === ultimo.productCode) : null;
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <button onClick={onVoltar} className={`${btnSec} mb-2`}>
          <ArrowLeft size={14} /> Voltar para a lista
        </button>
        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {!t ? (
          !erro && (
            <div className="py-16 text-center text-gray-400">
              <Spinner size={22} className="mx-auto animate-spin" />
            </div>
          )
        ) : (
          <>
            <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[220px] flex-1">
                  <p className="text-lg font-bold text-[#000638]">
                    Receber {t.nf_numero ? `NF-e ${t.nf_numero}` : `transação ${t.transacao_code || t.id}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.empresa} → {t.empresa_destino} {t.empresa_destino_nome || ''} · enviada em {fmtDataHora(t.criado_em)} · {fmtBRL(t.total)}
                  </p>
                </div>
                {supported ? (
                  <button
                    onClick={rfid === 'desconectado' ? connect : disconnect}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ring-1 ${
                      rfid === 'conectado' ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : rfid === 'reconectando' ? 'bg-amber-50 text-amber-800 ring-amber-300' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {rfid === 'conectado' ? <PlugsConnected size={16} weight="bold" /> : <Plugs size={16} weight="bold" />}
                    {rfid === 'conectado' ? 'LEITOR LIGADO · desligar' : rfid === 'reconectando' ? 'Reconectando o leitor…' : 'LIGAR LEITOR RFID'}
                  </button>
                ) : (
                  <span className="text-[11px] text-amber-700">Este navegador não fala com o leitor RFID (use o app do PDV ou o Chrome).</span>
                )}
              </div>
              {rfidErro && <p className="mt-2 text-[11px] text-rose-600">{rfidErro}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Numero rotulo="Enviadas" valor={tot.esperado} />
                <Numero rotulo="Conferidas" valor={tot.recebido} cls="text-emerald-700" />
                <Numero rotulo="Faltando" valor={tot.falta} cls={tot.falta > 0 ? 'text-amber-700' : 'text-gray-400'} />
                <Numero rotulo="De fora" valor={fora.length} cls={fora.length > 0 ? 'text-rose-700' : 'text-gray-400'} />
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${tot.esperado ? Math.min(100, (tot.recebido / tot.esperado) * 100) : 0}%` }} />
              </div>
              {ultimo && Date.now() - ultimo.em < 15000 && (
                <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${ultimaLinha ? 'text-emerald-700' : 'text-rose-700'}`}>
                  <Broadcast size={14} weight="bold" />
                  {ultimaLinha ? `Leu: ${ultimaLinha.name} (${ultimaLinha.recebido}/${ultimaLinha.quantidade})` : `Etiqueta de fora desta transferência: ${ultimo.epc}`}
                </p>
              )}
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-[1fr_300px]">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-2">
                  <div className="relative min-w-[200px] flex-1">
                    <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar produto" className={`${inputCls} pl-8`} />
                  </div>
                  <button onClick={tudoManual} className={btnSec} title="Marca como conferido tudo o que ainda falta (sem leitor)">
                    Conferir tudo sem leitor
                  </button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-2">Produto</th>
                      <th className="px-2 py-2 text-right">Enviado</th>
                      <th className="px-2 py-2 text-right">Etiquetas</th>
                      <th className="px-2 py-2 text-center">Sem etiqueta</th>
                      <th className="px-2 py-2 text-right">Conferido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordenadas.map((l) => (
                      <tr key={l.productCode} className={l.falta === 0 ? 'bg-emerald-50/50' : ''}>
                        <td className="px-2 py-1.5">
                          <p className="font-semibold text-gray-800">{l.name || l.productCode}</p>
                          <p className="text-[10px] text-gray-400">
                            cód. {l.productCode}
                            {l.epcs.length === 0 ? ' · sem etiqueta' : ''}
                          </p>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.quantidade}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.epcs.length ? `${l.porEtiqueta}/${l.epcs.length}` : '—'}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => ajustar(l.productCode, -1)} disabled={l.manual === 0} className="rounded p-1 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-30">
                              <Minus size={11} weight="bold" />
                            </button>
                            <span className="w-6 text-center tabular-nums">{l.manual}</span>
                            <button onClick={() => ajustar(l.productCode, 1)} disabled={l.falta === 0} className="rounded p-1 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-30">
                              <Plus size={11} weight="bold" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {l.falta === 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                              <CheckCircle size={13} weight="fill" /> {l.recebido}
                            </span>
                          ) : (
                            <span className="font-bold tabular-nums text-amber-700">
                              {l.recebido}/{l.quantidade}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3">
                {fora.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-rose-800">
                      <Warning size={13} weight="fill" /> Etiquetas de fora ({fora.length})
                    </p>
                    <p className="mb-1 text-[10.5px] text-rose-700">Não são desta transferência: não entram no estoque. Separe essas peças.</p>
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[10.5px] text-rose-800">
                      {fora.map((e) => (
                        <li key={e} className="flex items-center gap-1">
                          <span className="min-w-0 flex-1 truncate">{e}</span>
                          <button
                            onClick={() =>
                              setLidos((s) => {
                                const n = new Set(s);
                                n.delete(e);
                                return n;
                              })
                            }
                            title="Tirar da lista"
                            className="rounded p-0.5 hover:bg-rose-100"
                          >
                            <X size={11} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <label className={labelCls}>Observação{divergencia ? ' (obrigatória: faltou peça ou chegou de fora)' : ''}</label>
                  <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="mb-0 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" placeholder={divergencia ? 'explique o que faltou ou sobrou' : 'opcional'} />
                  <button onClick={finalizar} disabled={busy || tot.recebido === 0 || (divergencia && obs.trim().length < 3)} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                    {busy ? <Spinner size={16} className="animate-spin" /> : <CheckCircle size={16} weight="bold" />} FINALIZAR RECEBIMENTO
                  </button>
                  <p className="mt-1 text-[10.5px] text-gray-500">As peças conferidas entram no estoque da loja. A conferência fica salva neste navegador até finalizar.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Numero({ rotulo, valor, cls = 'text-[#000638]' }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className={`text-2xl font-extrabold tabular-nums ${cls}`}>{valor}</p>
    </div>
  );
}

// ─── recebimento já feito ────────────────────────────────────────────────────
function DetalheRecebido({ id, onFechar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    apiJson(`${API}/transferencias/${id}`)
      .then((j) => setD(j.data))
      .catch((e) => setErro(e.message));
  }, [id]);
  const r = d?.recebimento;
  const t = d?.transferencia;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <h3 className="flex-1 text-lg font-bold text-[#000638]">{t ? `Recebimento ${t.nf_numero ? `da NF-e ${t.nf_numero}` : `da transação ${t.transacao_code || t.id}`}` : 'Recebimento'}</h3>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {!r ? (
          !erro && <Spinner size={20} className="mx-auto animate-spin text-gray-400" />
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Recebida por <b>{r.recebido_por}</b> em {fmtDataHora(r.recebido_em)} · {r.qtd_recebida} de {r.qtd_esperada} peça(s)
              {r.qtd_faltando ? ` · faltaram ${r.qtd_faltando}` : ''}
              {r.qtd_fora ? ` · ${r.qtd_fora} etiqueta(s) de fora` : ''}
            </p>
            {r.observacao && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">{r.observacao}</p>}
            <table className="mt-3 w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="py-1">Produto</th>
                  <th className="py-1 text-right">Enviado</th>
                  <th className="py-1 text-right">Recebido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(r.itens || []).map((i) => (
                  <tr key={i.productCode} className={i.recebido < i.esperado ? 'text-amber-800' : ''}>
                    <td className="py-1">
                      {i.name || i.productCode}
                      {i.manual > 0 ? <span className="text-[10px] text-gray-400"> · {i.manual} sem etiqueta</span> : ''}
                    </td>
                    <td className="py-1 text-right tabular-nums">{i.esperado}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{i.recebido}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(r.fora || []).length > 0 && <p className="mt-2 break-all font-mono text-[10.5px] text-rose-700">De fora: {r.fora.join(', ')}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ESTOQUE ─────────────────────────────────────────────────────────────────
// também usado na página HeadCoach › Estoque (HcEstoque.jsx)
export function Estoque({ empresa }) {
  const [busca, setBusca] = useState('');
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const qs = new URLSearchParams({ ...(empresa ? { empresa } : {}), ...(busca.trim() ? { busca: busca.trim() } : {}) }).toString();
      const j = await apiJson(`${API}/estoque${qs ? `?${qs}` : ''}`);
      setD(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [empresa, busca]);
  useEffect(() => {
    carregar();
  }, [empresa]); // eslint-disable-line react-hooks/exhaustive-deps
  const nomes = Object.fromEntries((d?.empresas || []).map((e) => [e.code, e.nome]));
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          carregar();
        }}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
      >
        <div className="min-w-[220px] flex-1">
          <label className={labelCls}>Produto (código ou nome)</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} className={inputCls} />
        </div>
        <button type="submit" disabled={carregando} className={btnPri}>
          {carregando ? <Spinner size={15} className="animate-spin" /> : <MagnifyingGlass size={15} weight="bold" />} BUSCAR
        </button>
        {d && (
          <p className="text-xs text-gray-500">
            {d.totais.produtos} produto(s) · <b className="text-[#000638]">{d.totais.pecas}</b> peça(s)
          </p>
        )}
      </form>
      {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      <p className="text-[11px] text-gray-500">Por enquanto o estoque mostra só as peças que a loja recebeu por transferência (vendas e devoluções entram depois).</p>
      {d && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-2 py-2">Loja</th>
                <th className="px-2 py-2">Produto</th>
                <th className="px-2 py-2 text-right">Quantidade</th>
                <th className="px-2 py-2 text-right">Com etiqueta</th>
                <th className="px-2 py-2">Última entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.produtos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-10 text-center text-gray-400">
                    Nada no estoque ainda.
                  </td>
                </tr>
              )}
              {d.produtos.map((p) => (
                <tr key={`${p.empresa}-${p.productCode}`}>
                  <td className="px-2 py-1.5" title={nomes[p.empresa]}>
                    {p.empresa}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-semibold text-gray-800">{p.nome || p.productCode}</span>
                    <span className="text-[10px] text-gray-400"> · cód. {p.productCode}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums">{p.quantidade}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{p.etiquetas}</td>
                  <td className="px-2 py-1.5 tabular-nums text-gray-500">{fmtDataHora(p.ultimaEntrada)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
