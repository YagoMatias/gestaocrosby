// ============================================================================
// HEADCOACH › ESTOQUE › TRANSFERÊNCIA ENTRE LOJAS (Yago, 19/11/2026)
// A tela de Transferências feita para o varejo: a própria loja manda mercadoria
// para outra loja.
//   • EMPRESA DE ORIGEM = a loja de quem está logado (owner/admin escolhem);
//   • EMPRESA DE DESTINO = uma das lojas ativas (2, 5, 55, 65, 87, 93, 94, 95,
//     97, 98), diferente da origem;
//   • operação travada pelo POP "Transferências entre empresas - Varejo" (a
//     mesma regra da tela Transferências): 7272 transferência no mesmo grupo,
//     7273 / 7280 venda entre empresas; o que o POP não prevê não emite;
//   • peças bipadas com o LEITOR RFID de mesa (a loja não tem portal) — 1
//     etiqueta = 1 peça; peça sem etiqueta entra pelo código, com quantidade;
//   • preço = tabela 4 (atacado) − 25%, a regra das transferências;
//   • FINALIZAR emite a NF-e pela loja de origem (nada vai ao TOTVS). A
//     transferência aparece em HeadCoach › Transações e, com a nota autorizada,
//     em Recebimento de Transferência da loja de destino.
// API: /api/transferencias/varejo (exige login) — services/transferenciaVarejo.js
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsLeftRight,
  ArrowRight,
  Plugs,
  PlugsConnected,
  Spinner,
  Trash,
  Minus,
  Tag,
  Barcode,
  CheckCircle,
  Warning,
  Prohibit,
  Printer,
  ArrowsClockwise,
  Storefront,
  X,
  Eraser,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { apiJson } from '../utils/apiAuth';
import useRfidReader from '../hooks/useRfidReader';
import { imprimirDanfe } from '../utils/danfeAcoes';

const API = '/api/transferencias';
// preço da transferência: tabela 4 (atacado) menos 25% — a mesma regra da tela Transferências
const TABELA_ATACADO = 4;
const DESCONTO_SOBRE_ATACADO = 0.25;
const precoTransferencia = (precoAtacado) => Math.round((Number(precoAtacado) || 0) * (1 - DESCONTO_SOBRE_ATACADO) * 100) / 100;

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const inputCls = 'mb-0 h-10 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-100 disabled:text-gray-500';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const qtdDe = (l) => l.epcs.length + (l.manual || 0);

const SITUACAO = {
  nota_pendente: { label: 'Nota não saiu', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  a_receber: { label: 'A caminho · loja ainda não recebeu', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  recebida: { label: 'Recebida pela loja', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500 ring-gray-200' },
};

function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 1200 : 320;
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    osc.onended = () => ctx.close();
  } catch {
    /* sem áudio */
  }
}

export default function TransferenciaVarejo() {
  const [ctx, setCtx] = useState(null); // { origens, destinos }
  const [erroCtx, setErroCtx] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [prep, setPrep] = useState(null);
  const [prepErro, setPrepErro] = useState('');
  const [prepCarregando, setPrepCarregando] = useState(false);
  const [vendedores, setVendedores] = useState([]);
  const [vendedor, setVendedor] = useState('');
  const [lidos, setLidos] = useState({}); // sku → { sku, nome, epcs: [], manual, preco }
  const [naoAchadas, setNaoAchadas] = useState(0);
  const [codigo, setCodigo] = useState('');
  const [qtdManual, setQtdManual] = useState('1');
  const [buscando, setBuscando] = useState(false);
  const [obs, setObs] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [ultimas, setUltimas] = useState(null);
  const [tentando, setTentando] = useState(null);
  const [toast, setToast] = useState(null);
  const vistas = useRef(new Set()); // etiquetas já tratadas (não soma a mesma duas vezes)
  const origemRef = useRef('');
  origemRef.current = origem;
  const travadoRef = useRef(false);
  travadoRef.current = enviando || !!resultado;

  const avisar = useCallback((tipo, msg) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ─── lojas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    apiJson(`${API}/varejo/contexto`)
      .then((j) => {
        setCtx(j.data);
        // loja única (vendedor): já entra com ela como origem
        if ((j.data.origens || []).length === 1) setOrigem(String(j.data.origens[0].code));
      })
      .catch((e) => setErroCtx(e.message));
  }, []);
  const lojaOrigem = useMemo(() => (ctx?.origens || []).find((l) => String(l.code) === String(origem)) || null, [ctx, origem]);
  const destinos = useMemo(() => (ctx?.destinos || []).filter((l) => String(l.code) !== String(origem)), [ctx, origem]);

  const carregarUltimas = useCallback(() => {
    if (!origemRef.current) return setUltimas(null);
    return apiJson(`${API}/varejo/ultimas?origem=${origemRef.current}`)
      .then((j) => setUltimas(j.data.itens))
      .catch(() => setUltimas([]));
  }, []);

  // trocar a origem zera a leitura (o preço e a nota são da loja de origem)
  useEffect(() => {
    setLidos({});
    setNaoAchadas(0);
    vistas.current = new Set();
    setVendedor('');
    setVendedores([]);
    setResultado(null);
    if (String(destino) === String(origem)) setDestino('');
    if (!origem) return;
    fetch(`${API_BASE_URL}/api/totvs/pdv/sellers?branch=${origem}`)
      .then((r) => r.json())
      .then((j) => setVendedores(j?.data?.items || []))
      .catch(() => setVendedores([]));
    carregarUltimas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem]);

  // regra do POP e situação fiscal do par origem → destino
  useEffect(() => {
    setPrep(null);
    setPrepErro('');
    if (!origem || !destino) return undefined;
    let vivo = true;
    setPrepCarregando(true);
    apiJson(`${API}/varejo/preparar?origem=${origem}&destino=${destino}`)
      .then((j) => vivo && setPrep(j.data))
      .catch((e) => vivo && setPrepErro(e.message))
      .finally(() => vivo && setPrepCarregando(false));
    return () => {
      vivo = false;
    };
  }, [origem, destino]);

  // ─── peças ────────────────────────────────────────────────────────────────
  const consultar = useCallback(async (code) => {
    const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}?branch=${origemRef.current}&priceCodes=${TABELA_ATACADO}`);
    const j = await r.json().catch(() => null);
    return r.ok && j?.data?.product ? j.data : null;
  }, []);
  const somar = useCallback((data, { epc = null, manual = 0 }) => {
    const p = data.product;
    const sku = String(p.productCode);
    const tab = (data.prices || []).find((x) => x.promotionalPrice > 0 || x.price > 0);
    const atacado = tab ? (tab.promotionalPrice > 0 ? tab.promotionalPrice : tab.price) : 0;
    setLidos((prev) => {
      const cur = prev[sku] || { sku, nome: p.productName || p.name || `Produto ${sku}`, epcs: [], manual: 0, preco: precoTransferencia(atacado) };
      return { ...prev, [sku]: { ...cur, epcs: epc && !cur.epcs.includes(epc) ? [...cur.epcs, epc] : cur.epcs, manual: cur.manual + manual } };
    });
  }, []);
  const onEpc = useCallback(
    async (bruto) => {
      const epc = String(bruto || '').trim().toUpperCase();
      if (!epc || travadoRef.current || !origemRef.current) return;
      if (vistas.current.has(epc)) return;
      vistas.current.add(epc);
      try {
        const data = await consultar(epc);
        if (!data) {
          setNaoAchadas((n) => n + 1);
          beep(false);
          return;
        }
        somar(data, { epc });
        beep(true);
      } catch {
        vistas.current.delete(epc); // falha de rede: deixa o leitor tentar de novo
      }
    },
    [consultar, somar],
  );
  const { status: rfid, error: rfidErro, supported, connect, disconnect } = useRfidReader(onEpc);

  const incluirManual = async (e) => {
    e?.preventDefault();
    const code = codigo.trim();
    const q = Math.max(1, Math.floor(Number(qtdManual) || 1));
    if (!code || buscando) return;
    if (!origem) return avisar('erro', 'Escolha a loja de origem antes de incluir peças');
    setBuscando(true);
    try {
      const data = await consultar(code);
      if (!data) {
        beep(false);
        avisar('erro', `Código ${code} não encontrado`);
        return;
      }
      somar(data, { manual: q });
      beep(true);
      setCodigo('');
      setQtdManual('1');
    } catch (err) {
      avisar('erro', `Erro na consulta: ${err.message}`);
    } finally {
      setBuscando(false);
    }
  };
  // tira uma peça da linha: primeiro as digitadas, depois a última etiqueta (que fica "já vista")
  const tirarUma = (sku) =>
    setLidos((prev) => {
      const l = prev[sku];
      if (!l) return prev;
      const novo = l.manual > 0 ? { ...l, manual: l.manual - 1 } : { ...l, epcs: l.epcs.slice(0, -1) };
      const out = { ...prev };
      if (qtdDe(novo) <= 0) delete out[sku];
      else out[sku] = novo;
      return out;
    });
  const tirarLinha = (sku) =>
    setLidos((prev) => {
      const out = { ...prev };
      delete out[sku];
      return out;
    });
  const limpar = () => {
    setLidos({});
    setNaoAchadas(0);
    vistas.current = new Set();
    setObs('');
    setConfirmando(false);
  };
  const nova = () => {
    limpar();
    setResultado(null);
    setDestino('');
  };

  const linhas = useMemo(() => Object.values(lidos).sort((a, b) => a.nome.localeCompare(b.nome)), [lidos]);
  const totalPecas = linhas.reduce((s, l) => s + qtdDe(l), 0);
  const totalEtiquetas = linhas.reduce((s, l) => s + l.epcs.length, 0);
  const totalValor = Math.round(linhas.reduce((s, l) => s + qtdDe(l) * l.preco, 0) * 100) / 100;
  const semPreco = linhas.filter((l) => !(l.preco > 0));
  const vend = vendedores.find((v) => String(v.code) === String(vendedor)) || null;

  const pendencias = [];
  if (!origem) pendencias.push('Escolha a loja de origem.');
  else if (lojaOrigem?.impedimento) pendencias.push(lojaOrigem.impedimento);
  if (origem && !destino) pendencias.push('Escolha a loja de destino.');
  if (prepErro) pendencias.push(prepErro);
  for (const p of prep?.pendencias || []) pendencias.push(p);
  if (origem && destino && !vendedor) pendencias.push('Escolha quem está fazendo a transferência.');
  if (origem && destino && totalPecas === 0) pendencias.push('Ligue o leitor e bipe as peças.');
  if (semPreco.length) pendencias.push(`Sem preço na tabela de atacado: ${semPreco.map((l) => l.sku).join(', ')}. Tire da transferência ou peça para cadastrarem o preço.`);
  const podeFinalizar = pendencias.length === 0 && !!prep?.podeTransferir && !prepCarregando;

  const finalizar = async () => {
    if (!podeFinalizar || enviando) return;
    setEnviando(true);
    try {
      const j = await apiJson(`${API}/varejo`, {
        method: 'POST',
        timeoutMs: 180000,
        body: {
          origem: Number(origem),
          destino: Number(destino),
          vendedorCode: Number(vendedor),
          vendedorNome: vend?.name || null,
          observacao: obs.trim() || undefined,
          itens: linhas.map((l) => ({ productCode: Number(l.sku), quantidade: qtdDe(l), valorUnit: l.preco, nome: l.nome, epcs: l.epcs })),
        },
      });
      setResultado(j.data);
      setConfirmando(false);
      if (rfid !== 'desconectado') disconnect().catch(() => {});
      carregarUltimas();
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setEnviando(false);
    }
  };
  const tentarDeNovo = async (vendaId) => {
    setTentando(vendaId);
    try {
      const j = await apiJson(`${API}/nota/${vendaId}/reprocessar`, { method: 'POST', timeoutMs: 180000 });
      avisar(j.data?.fiscal?.ok ? 'ok' : 'erro', j.message);
      if (resultado?.vendaId === vendaId) setResultado((r) => ({ ...r, ...j.data }));
      carregarUltimas();
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setTentando(null);
    }
  };

  const regra = prep?.regra;
  const notaRes = resultado?.nota;
  const notaOk = !!resultado?.fiscal?.ok && notaRes?.status === 'autorizada';
  const card = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4">
      <PageTitle title="Transferência entre Lojas" subtitle="Mande mercadoria da sua loja para outra loja: bipe as peças com o leitor RFID e finalize. A nota sai na hora e a loja de destino recebe pela tela Recebimento de Transferência." icon={ArrowsLeftRight} iconColor="text-sky-600" />

      {toast && (
        <div className={`fixed right-4 top-4 z-[70] max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ${toast.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-800 ring-rose-200'}`}>{toast.msg}</div>
      )}
      {erroCtx && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erroCtx}</p>}
      {ctx && ctx.origens.length === 0 && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          <Warning size={18} className="mt-0.5 shrink-0" />
          Seu usuário não está ligado a nenhuma das lojas ativas. Peça a um administrador para vincular a sua loja.
        </p>
      )}

      {/* ─── resultado ─────────────────────────────────────────────────────── */}
      {resultado && (
        <div className={`${card} mb-4 p-4 ${notaOk ? 'ring-2 ring-emerald-300' : 'ring-2 ring-amber-300'}`}>
          <div className="flex flex-wrap items-start gap-3">
            {notaOk ? <CheckCircle size={34} weight="fill" className="shrink-0 text-emerald-600" /> : <Warning size={34} weight="fill" className="shrink-0 text-amber-500" />}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-[#000638]">{notaOk ? `Transferência concluída — NF-e ${notaRes.numero}/${notaRes.serie}` : 'A transferência foi gravada, mas a nota ainda não saiu'}</p>
              <p className="text-sm text-gray-600">
                {resultado.origem?.code} — {resultado.origem?.nome} <ArrowRight size={13} className="inline" /> {resultado.destino?.code} — {resultado.destino?.nome} · {fmtBRL(resultado.venda?.total)} · transação nº {resultado.vendaId}
              </p>
              {notaOk ? (
                <p className="mt-1 text-xs text-gray-500">A loja de destino já vê a mercadoria em Recebimento de Transferência. Mande a nota impressa junto com as peças.</p>
              ) : (
                <p className="mt-1 text-xs text-amber-800">{resultado.fiscal?.mensagem || 'A SEFAZ não autorizou a nota.'} As peças NÃO podem sair sem a nota: use "Tentar de novo".</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {notaOk && notaRes?.id && (
                <button onClick={() => imprimirDanfe(notaRes.id).catch((e) => avisar('erro', e.message))} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#000638] px-4 text-xs font-bold text-white hover:bg-[#000638]/90">
                  <Printer size={16} /> IMPRIMIR A NOTA
                </button>
              )}
              {!notaOk && (
                <button onClick={() => tentarDeNovo(resultado.vendaId)} disabled={tentando === resultado.vendaId} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50">
                  {tentando === resultado.vendaId ? <Spinner size={16} className="animate-spin" /> : <ArrowsClockwise size={16} />} TENTAR DE NOVO
                </button>
              )}
              <button onClick={nova} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                NOVA TRANSFERÊNCIA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── origem, destino e regra ───────────────────────────────────────── */}
      <div className={`${card} mb-4 p-4`}>
        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_1fr]">
          <div>
            <label className={labelCls}>Empresa de origem (sua loja)</label>
            {ctx && ctx.origens.length === 1 ? (
              <p className="flex h-10 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-[#000638] ring-1 ring-gray-200">
                <Storefront size={16} /> {ctx.origens[0].code} — {ctx.origens[0].nome}
              </p>
            ) : (
              <select value={origem} onChange={(e) => setOrigem(e.target.value)} disabled={!ctx || !!resultado || enviando} className={inputCls}>
                <option value="">{ctx ? 'Escolha a loja…' : 'Carregando…'}</option>
                {(ctx?.origens || []).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.code} — {l.nome}
                    {l.impedimento ? ' (ainda não emite)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <ArrowRight size={22} className="mb-2 hidden text-gray-400 md:block" />
          <div>
            <label className={labelCls}>Empresa de destino</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)} disabled={!origem || !!resultado || enviando} className={inputCls}>
              <option value="">{origem ? 'Escolha a loja de destino…' : 'Escolha a origem primeiro'}</option>
              {destinos.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code} — {l.nome}
                  {l.uf ? ` (${l.uf})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Quem está transferindo</label>
            <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} disabled={!origem || !!resultado || enviando} className={inputCls}>
              <option value="">{origem ? 'Escolha…' : '—'}</option>
              {vendedores.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lojaOrigem?.impedimento && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
            <Prohibit size={18} className="mt-0.5 shrink-0" /> {lojaOrigem.impedimento}
          </p>
        )}
        {prepCarregando && (
          <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Spinner size={14} className="animate-spin" /> Conferindo a regra da transferência…
          </p>
        )}
        {regra && !regra.permitido && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
            <Prohibit size={18} className="mt-0.5 shrink-0" />
            <span>
              <b>Transferência não permitida.</b> {regra.motivo}
            </span>
          </p>
        )}
        {regra?.permitido && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-200">
            <span className="font-bold uppercase">{prep.naturezaNome}</span>
            {regra.operacao && (
              <span>
                operação do POP <b>{regra.operacao}</b>
              </span>
            )}
            {prep.cfop && (
              <span>
                CFOP <b>{prep.cfop}</b>
              </span>
            )}
            {prep.cenario && <span>{prep.cenario}</span>}
            {regra.aplicacao && <span className="text-sky-700">{regra.aplicacao}</span>}
          </div>
        )}
      </div>

      {/* ─── leitura das peças ─────────────────────────────────────────────── */}
      {!resultado && (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
          <div className={card}>
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
              <Tag size={17} className="text-[#000638]" />
              <h3 className="min-w-0 flex-1 text-sm font-bold text-[#000638]">
                Peças da transferência · {totalPecas} peça(s) · {totalEtiquetas} etiqueta(s)
              </h3>
              {linhas.length > 0 && (
                <button onClick={limpar} disabled={enviando} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                  <Eraser size={13} /> Limpar tudo
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-2 py-2 text-right">Qtd</th>
                    <th className="px-2 py-2 text-right">Unitário</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.sku} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-4 py-2">
                        <p className="font-semibold text-[#000638]">{l.nome}</p>
                        <p className="text-[11px] text-gray-500">
                          cód. {l.sku} · {l.epcs.length} etiqueta(s){l.manual > 0 ? ` · ${l.manual} digitada(s)` : ''}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-right text-base font-bold tabular-nums text-[#000638]">{qtdDe(l)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${l.preco > 0 ? 'text-gray-700' : 'font-bold text-rose-600'}`}>{l.preco > 0 ? fmtBRL(l.preco) : 'sem preço'}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-800">{fmtBRL(qtdDe(l) * l.preco)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <button onClick={() => tirarUma(l.sku)} disabled={enviando} title="Tirar uma peça" className="mr-1 inline-grid h-8 w-8 place-items-center rounded-lg text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                          <Minus size={14} weight="bold" />
                        </button>
                        <button onClick={() => tirarLinha(l.sku)} disabled={enviando} title="Tirar o produto" className="inline-grid h-8 w-8 place-items-center rounded-lg text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50">
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {linhas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                        Nenhuma peça lida. Ligue o leitor RFID e passe as peças, ou digite o código.
                      </td>
                    </tr>
                  )}
                </tbody>
                {linhas.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-slate-50 text-sm font-bold text-[#000638]">
                      <td className="px-4 py-2">Total da transferência</td>
                      <td className="px-2 py-2 text-right tabular-nums">{totalPecas}</td>
                      <td />
                      <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(totalValor)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {naoAchadas > 0 && <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-amber-700">{naoAchadas} etiqueta(s) lida(s) não são de produto cadastrado e ficaram de fora.</p>}
            <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500">Preço da transferência = tabela de atacado − 25%.</p>
          </div>

          <div className="space-y-4">
            <div className={`${card} p-4`}>
              <h3 className="mb-2 text-sm font-bold text-[#000638]">Leitor RFID</h3>
              {supported ? (
                <button
                  onClick={rfid === 'desconectado' ? connect : disconnect}
                  disabled={!origem || enviando}
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold disabled:opacity-50 ${
                    rfid === 'conectado' ? 'bg-rose-600 text-white hover:bg-rose-700' : rfid === 'reconectando' ? 'bg-amber-400 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {rfid === 'conectado' ? <Plugs size={17} /> : <PlugsConnected size={17} />}
                  {rfid === 'conectado' ? 'DESLIGAR LEITOR' : rfid === 'reconectando' ? 'Reconectando…' : 'LIGAR LEITOR RFID'}
                </button>
              ) : (
                <p className="text-[11px] text-amber-700">Este navegador não fala com o leitor RFID: use o app do PDV ou o Chrome. Dá para incluir as peças pelo código.</p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`h-2 w-2 rounded-full ${rfid === 'conectado' ? 'animate-pulse bg-emerald-500' : rfid === 'reconectando' ? 'bg-amber-400' : 'bg-gray-300'}`} />
                {rfid === 'conectado' ? 'Lendo: passe as peças no leitor' : rfid === 'reconectando' ? 'reconectando' : 'desligado'}
              </p>
              {rfidErro && <p className="mt-1 text-[11px] text-rose-600">{rfidErro}</p>}

              <form onSubmit={incluirManual} className="mt-3 border-t border-gray-100 pt-3">
                <label className={labelCls}>Peça sem etiqueta (código)</label>
                <div className="flex gap-2">
                  <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código da peça" disabled={!origem || enviando} className={inputCls} />
                  <input value={qtdManual} onChange={(e) => setQtdManual(e.target.value.replace(/\D/g, ''))} inputMode="numeric" title="Quantidade" disabled={!origem || enviando} className={`${inputCls} w-16 text-center`} />
                </div>
                <button type="submit" disabled={!origem || !codigo.trim() || buscando || enviando} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                  {buscando ? <Spinner size={14} className="animate-spin" /> : <Barcode size={15} />} INCLUIR
                </button>
              </form>
            </div>

            <div className={`${card} p-4`}>
              <label className={labelCls}>Observação (opcional)</label>
              <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} disabled={enviando} placeholder="Ex.: reposição de grade" className={inputCls} />
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Peças</span>
                  <b className="tabular-nums text-[#000638]">{totalPecas}</b>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Valor da nota</span>
                  <b className="tabular-nums text-[#000638]">{fmtBRL(totalValor)}</b>
                </div>
              </div>
              {pendencias.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 ring-1 ring-amber-200">
                  {pendencias.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              )}
              <button onClick={() => setConfirmando(true)} disabled={!podeFinalizar || enviando} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#000638] text-sm font-bold text-white hover:bg-[#000638]/90 disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowsLeftRight size={18} weight="bold" /> FINALIZAR TRANSFERÊNCIA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── últimas transferências da loja ────────────────────────────────── */}
      {origem && (
        <div className={`${card} mt-4`}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <h3 className="min-w-0 flex-1 text-sm font-bold text-[#000638]">Últimas transferências desta loja</h3>
            <button onClick={carregarUltimas} title="Atualizar" className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50">
              <ArrowsClockwise size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2">Quando</th>
                  <th className="px-2 py-2">Destino</th>
                  <th className="px-2 py-2 text-right">Peças</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2">Nota</th>
                  <th className="px-2 py-2">Situação</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {(ultimas || []).map((t) => {
                  const s = SITUACAO[t.situacao] || SITUACAO.nota_pendente;
                  return (
                    <tr key={t.id} className="border-b border-gray-50 last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-2 text-gray-600">{fmtDataHora(t.criadoEm)}</td>
                      <td className="px-2 py-2 font-semibold text-[#000638]">
                        {t.destino.code} — {t.destino.nome}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{t.qtdPecas}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(t.total)}</td>
                      <td className="whitespace-nowrap px-2 py-2">{t.nf.numero ? `NF-e ${t.nf.numero}/${t.nf.serie}` : '—'}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {t.nf.status === 'autorizada' && t.nf.id && (
                          <button onClick={() => imprimirDanfe(t.nf.id).catch((e) => avisar('erro', e.message))} title="Imprimir a nota" className="inline-grid h-8 w-8 place-items-center rounded-lg text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                            <Printer size={14} />
                          </button>
                        )}
                        {t.situacao === 'nota_pendente' && (
                          <button onClick={() => tentarDeNovo(t.vendaId)} disabled={tentando === t.vendaId} className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-2.5 text-[11px] font-bold text-white hover:bg-amber-600 disabled:opacity-50">
                            {tentando === t.vendaId ? <Spinner size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />} Tentar de novo
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {ultimas && ultimas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                      Esta loja ainda não fez transferência por aqui.
                    </td>
                  </tr>
                )}
                {!ultimas && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                      <Spinner size={16} className="mx-auto animate-spin" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── confirmação ───────────────────────────────────────────────────── */}
      {confirmando && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#000638]/60 p-3" onMouseDown={(e) => e.target === e.currentTarget && !enviando && setConfirmando(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
              <ArrowsLeftRight size={18} className="text-[#000638]" />
              <h4 className="min-w-0 flex-1 text-sm font-bold text-[#000638]">Confirmar a transferência</h4>
              <button onClick={() => setConfirmando(false)} disabled={enviando} className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 ring-1 ring-gray-200 hover:bg-gray-100 disabled:opacity-50">
                <X size={15} weight="bold" />
              </button>
            </div>
            <div className="space-y-2 p-4 text-sm text-gray-700">
              <p>
                De <b className="text-[#000638]">{lojaOrigem?.code} — {lojaOrigem?.nome}</b>
              </p>
              <p>
                Para <b className="text-[#000638]">{prep?.destino?.code} — {prep?.destino?.nome}</b>
              </p>
              <p>
                <b className="text-[#000638]">{totalPecas} peça(s)</b> · {fmtBRL(totalValor)} · {prep?.naturezaNome}
              </p>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 ring-1 ring-amber-200">Ao confirmar, a nota fiscal é emitida na hora. Confira as peças antes: depois só o financeiro cancela.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-slate-50 px-4 py-3">
              <button onClick={() => setConfirmando(false)} disabled={enviando} className="h-10 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-300 hover:bg-white disabled:opacity-50">
                Voltar
              </button>
              <button onClick={finalizar} disabled={enviando} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#000638] px-4 text-xs font-bold text-white hover:bg-[#000638]/90 disabled:opacity-50">
                {enviando ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />}
                {enviando ? 'Emitindo a nota…' : 'CONFIRMAR E EMITIR A NOTA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
