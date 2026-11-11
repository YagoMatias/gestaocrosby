// Transferências de Mercadoria → transferência SAINDO DA EMPRESA 99 com a nota
// pelo HeadCoach (mesmo desenho e mesmas regras do Faturamento da expedição):
//   • as peças do pedido de transferência já vêm na tela (o "carrinho") e o
//     PORTAL RFID confere: conferido / faltando / a mais. Só o conferido entra.
//   • peça lida que não é do pedido fica de fora; dá para tirar uma a uma
//   • sem pedido (transferência avulsa da 99): entra tudo o que for lido
//   • EMITIR: a NF-e de transferência sai pelo HeadCoach (empresa 99) e o TOTVS
//     recebe a transação na empresa 990 como documento interno, sem nota e sem
//     financeiro, já atendida
// Backend: /api/transferencias/nota (services/transferenciaNota.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsLeftRight,
  ArrowsClockwise,
  Spinner,
  PlugsConnected,
  Plugs,
  WifiHigh,
  Trash,
  Minus,
  Tag,
  Barcode,
  X,
  Receipt,
  CheckCircle,
  Warning,
  Printer,
  DownloadSimple,
  Package,
  Broadcast,
  LockKey,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { portalConnect, portalDisconnect, portalTags, portalClear } from '../utils/portalApi';
import PortalPotenciaModal from '../components/PortalPotenciaModal';
import { imprimirDanfe, salvarDanfePdf, avisoDoPdf } from '../utils/danfeAcoes';

const EMPRESA = 99;
// Preço da transferência quando o pedido não traz: tabela 4 (atacado) menos 25%,
// a mesma regra que a expedição usa nos pedidos de transferência do Dryland
// ("preço = tabela 4 -25%"). Na avulsa o valor pode ser corrigido na linha.
const DESCONTO_SOBRE_ATACADO = 0.25;
const precoTransferencia = (precoAtacado) => Math.round((Number(precoAtacado) || 0) * (1 - DESCONTO_SOBRE_ATACADO) * 100) / 100;
const API = `${API_BASE_URL}/api/transferencias`;
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500';

function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, ok ? 90 : 260);
  } catch {
    /* sem áudio */
  }
}


const TransferenciaNota99 = ({ solicitacao = null, onConcluida, onSair }) => {
  const { user } = useAuth();
  const [prep, setPrep] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [filiais, setFiliais] = useState([]);
  const [destino, setDestino] = useState(''); // pessoa da loja de destino (avulsa)
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState('');
  const [terminal, setTerminal] = useState('1');
  // leituras: sku → { sku, nome, epcs[], manual, precoTotvs }
  const [lidos, setLidos] = useState({});
  const [naoResolvidos, setNaoResolvidos] = useState([]);
  const [removidas, setRemovidas] = useState([]);
  const [precoLivre, setPrecoLivre] = useState({}); // avulsa: preço digitado por produto
  const processed = useRef(new Set());
  const [portalStatus, setPortalStatus] = useState({ status: 'desconectado' });
  const [portalBusy, setPortalBusy] = useState(false);
  const [potenciaOpen, setPotenciaOpen] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [posting, setPosting] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const avisar = useCallback((tipo, msg) => {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 6000);
  }, []);

  const limparLeituras = useCallback(() => {
    setLidos({});
    setNaoResolvidos([]);
    setRemovidas([]);
    processed.current = new Set();
    portalClear().catch(() => {});
  }, []);

  // ─── carrega o contexto (solicitação ou destino escolhido) ────────────────
  const pessoaDestino = solicitacao ? null : destino;
  useEffect(() => {
    setPrep(null);
    setErro('');
    setResultado(null);
    limparLeituras();
    if (!solicitacao && !pessoaDestino) return undefined;
    let vivo = true;
    setCarregando(true);
    const qs = solicitacao ? `solicitacao=${solicitacao.id}` : `destino=${pessoaDestino}`;
    fetch(`${API}/nota/preparar?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (!j.success) throw new Error(j.message || 'Não consegui preparar a transferência');
        setPrep(j.data);
      })
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [solicitacao?.id, pessoaDestino, limparLeituras]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/totvs/pdv/sellers?branch=${EMPRESA}`)
      .then((r) => r.json())
      .then((j) => setSellers(j?.data?.items || []))
      .catch(() => setSellers([]));
    fetch(`${API}/filiais`)
      .then((r) => r.json())
      .then((j) => setFiliais((Array.isArray(j?.data) ? j.data : j?.data?.items || j?.data?.filiais || []).filter((f) => Number(f.code) !== EMPRESA)))
      .catch(() => setFiliais([]));
  }, []);

  // ─── peças do pedido (o "carrinho") ───────────────────────────────────────
  const esperados = useMemo(() => {
    const por = new Map();
    for (const i of prep?.solicitacao?.itens || []) {
      const sku = String(i.cod || '').trim();
      if (!sku) continue;
      const l = por.get(sku) || { sku, descricao: i.descricao || '', cor: i.cor || '', tam: i.tam || '', qtd: 0, unidades: [] };
      const q = Number(i.qtd) || 1;
      l.qtd += q;
      for (let k = 0; k < q; k += 1) l.unidades.push({ preco: Number(i.preco) || 0, tr: i.tr || null });
      por.set(sku, l);
    }
    return [...por.values()];
  }, [prep]);
  const temPedido = esperados.length > 0;
  const skusPedido = useMemo(() => new Set(esperados.map((e) => e.sku)), [esperados]);

  // ─── portal RFID ──────────────────────────────────────────────────────────
  const portalLigado = ['lendo', 'conectando', 'reconectando'].includes(portalStatus.status);
  const alternarPortal = async () => {
    setPortalBusy(true);
    try {
      const j = portalLigado ? await portalDisconnect() : await portalConnect({});
      if (j?.data) setPortalStatus(j.data);
      else if (!j?.success) avisar('erro', j?.message || 'Portal não respondeu');
    } catch (e) {
      avisar('erro', `Portal: ${e.message}`);
    } finally {
      setPortalBusy(false);
    }
  };
  const consultarProduto = useCallback(async (code) => {
    const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}?branch=${EMPRESA}&priceCodes=4`);
    const j = await r.json();
    return { ok: r.ok && !!j?.data?.product, data: j?.data, message: j?.message };
  }, []);
  const somar = useCallback(
    (data, { epc = null, manual = 0 }) => {
      const p = data.product;
      const sku = String(p.productCode);
      const padrao = (data.prices || []).find((x) => x.promotionalPrice > 0 || x.price > 0);
      const precoTotvs = padrao ? (padrao.promotionalPrice > 0 ? padrao.promotionalPrice : padrao.price) : 0;
      setLidos((prev) => {
        const cur = prev[sku] || { sku, nome: p.productName, epcs: [], manual: 0, precoTotvs };
        return { ...prev, [sku]: { ...cur, epcs: epc && !cur.epcs.includes(epc) ? [...cur.epcs, epc] : cur.epcs, manual: cur.manual + manual } };
      });
      beep(!temPedido || skusPedido.has(sku));
    },
    [skusPedido, temPedido],
  );
  const resolverEpc = useCallback(
    async (epc) => {
      try {
        const res = await consultarProduto(epc);
        if (res.ok) somar(res.data, { epc });
        else setNaoResolvidos((l) => (l.includes(epc) ? l : [...l, epc]));
      } catch {
        processed.current.delete(epc);
      }
    },
    [consultarProduto, somar],
  );
  useEffect(() => {
    if (!prep || resultado) return undefined;
    const timer = setInterval(async () => {
      try {
        const j = await portalTags();
        if (!j?.data) return;
        setPortalStatus(j.data.status);
        for (const t of j.data.tags || []) {
          if (!processed.current.has(t.epc)) {
            processed.current.add(t.epc);
            resolverEpc(t.epc);
          }
        }
      } catch {
        /* agente fora */
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [prep, resultado, resolverEpc]);
  const adicionarManual = async () => {
    const code = codigoManual.trim();
    if (!code || manualBusy) return;
    setManualBusy(true);
    try {
      const res = await consultarProduto(code);
      if (!res.ok) {
        beep(false);
        avisar('erro', res.message || `Código ${code} não encontrado`);
        return;
      }
      somar(res.data, { manual: 1 });
      setCodigoManual('');
    } catch (e) {
      avisar('erro', `Erro na consulta: ${e.message}`);
    } finally {
      setManualBusy(false);
    }
  };
  // tirar peças uma a uma: a etiqueta tirada continua "já vista" para o portal não devolver
  const removerEpc = (sku, epc) => {
    setRemovidas((l) => (l.includes(epc) ? l : [...l, epc]));
    setLidos((prev) => {
      const cur = prev[sku];
      if (!cur) return prev;
      const novo = { ...cur, epcs: cur.epcs.filter((e) => e !== epc) };
      const next = { ...prev, [sku]: novo };
      if (novo.epcs.length + novo.manual <= 0) delete next[sku];
      return next;
    });
  };
  const removerPeca = (sku) => {
    const cur = lidos[sku];
    if (!cur) return;
    if (cur.manual > 0) {
      setLidos((prev) => {
        const c = prev[sku];
        if (!c) return prev;
        const novo = { ...c, manual: c.manual - 1 };
        const next = { ...prev, [sku]: novo };
        if (novo.epcs.length + novo.manual <= 0) delete next[sku];
        return next;
      });
      return;
    }
    const epc = cur.epcs[cur.epcs.length - 1];
    if (epc) removerEpc(sku, epc);
  };
  const removerTodas = (sku) => {
    const cur = lidos[sku];
    if (!cur) return;
    setRemovidas((l) => [...new Set([...l, ...cur.epcs])]);
    setLidos((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
  };
  const devolverRemovidas = () => {
    for (const epc of removidas) processed.current.delete(epc);
    setRemovidas([]);
  };

  // ─── conferência ──────────────────────────────────────────────────────────
  const conf = useMemo(() => {
    const linhas = esperados.map((e) => {
      const l = lidos[e.sku];
      const lido = l ? l.epcs.length + l.manual : 0;
      const conferido = Math.min(lido, e.qtd);
      const unidades = e.unidades.map((u) => ({ ...u, preco: u.preco > 0 ? u.preco : precoTransferencia(l?.precoTotvs) }));
      return {
        ...e,
        nome: e.descricao || l?.nome || `Produto ${e.sku}`,
        unidades,
        lido,
        conferido,
        falta: e.qtd - conferido,
        sobra: Math.max(0, lido - e.qtd),
        valorConferido: round2(unidades.slice(0, conferido).reduce((s, u) => s + u.preco, 0)),
        epcs: l?.epcs || [],
        manual: l?.manual || 0,
      };
    });
    const fora = Object.values(lidos)
      .filter((l) => !skusPedido.has(l.sku))
      .map((l) => {
        const total = l.epcs.length + l.manual;
        const preco = precoLivre[l.sku] != null && precoLivre[l.sku] !== '' ? round2(precoLivre[l.sku]) : precoTransferencia(l.precoTotvs);
        return { ...l, total, preco, valor: round2(total * preco) };
      });
    const esperado = linhas.reduce((s, l) => s + l.qtd, 0);
    const conferidasPedido = linhas.reduce((s, l) => s + l.conferido, 0);
    const conferidas = temPedido ? conferidasPedido : fora.reduce((s, l) => s + l.total, 0);
    const total = temPedido ? round2(linhas.reduce((s, l) => s + l.valorConferido, 0)) : round2(fora.reduce((s, l) => s + l.valor, 0));
    return {
      linhas,
      fora,
      esperado,
      conferidas,
      faltando: temPedido ? esperado - conferidasPedido : 0,
      sobrando: temPedido ? linhas.reduce((s, l) => s + l.sobra, 0) + fora.reduce((s, l) => s + l.total, 0) : 0,
      total,
    };
  }, [esperados, lidos, skusPedido, precoLivre, temPedido]);

  // itens que vão para a nota: só o conferido (com pedido) ou tudo o que foi lido (avulsa)
  const itensDaNota = () => {
    if (!temPedido) return conf.fora.filter((l) => l.total > 0).map((l) => ({ productCode: Number(l.sku), quantidade: l.total, valorUnit: l.preco, nome: l.nome, epcs: l.epcs }));
    return conf.linhas
      .filter((l) => l.conferido > 0)
      .flatMap((l) => {
        const grupos = [];
        l.unidades.slice(0, l.conferido).forEach((u, k) => {
          let g = grupos.find((x) => x.valorUnit === u.preco);
          if (!g) {
            g = { productCode: Number(l.sku), quantidade: 0, valorUnit: u.preco, nome: l.nome, epcs: [] };
            grupos.push(g);
          }
          g.quantidade += 1;
          if (l.epcs[k]) g.epcs.push(l.epcs[k]);
        });
        return grupos;
      });
  };

  const semPreco = temPedido ? conf.linhas.some((l) => l.unidades.slice(0, l.conferido).some((u) => !(u.preco > 0))) : conf.fora.some((l) => !(l.preco > 0));
  const pendencias = [];
  if (prep?.jaEmitida) pendencias.push(`Esta solicitação já tem a NF-e ${prep.jaEmitida.numero}/${prep.jaEmitida.serie}.`);
  for (const p of prep?.pendencias || []) pendencias.push(p);
  if (!seller) pendencias.push('Escolha o vendedor.');
  if (conf.conferidas === 0) pendencias.push('Ligue o portal e passe as peças.');
  if (semPreco) pendencias.push('Há peça sem preço.');
  const podeEmitir = !!prep && !posting && !resultado && pendencias.length === 0;

  const emitir = async () => {
    if (!podeEmitir) return;
    setPosting(true);
    try {
      const vend = sellers.find((s) => String(s.code) === String(seller));
      const body = {
        solicitacaoId: prep.solicitacao?.id || null,
        destinoClienteCode: prep.destino.personCode,
        vendedorCode: Number(seller),
        vendedorNome: vend?.name || null,
        terminal: Number(terminal) || 1,
        itens: itensDaNota(),
        faltando: conf.linhas.filter((l) => l.falta > 0).map((l) => ({ productCode: l.sku, name: l.nome, quantidade: l.falta })),
        sobrando: temPedido
          ? [...conf.linhas.filter((l) => l.sobra > 0).map((l) => ({ productCode: l.sku, name: l.nome, quantidade: l.sobra })), ...conf.fora.map((l) => ({ productCode: l.sku, name: l.nome, quantidade: l.total }))]
          : [],
        por: user?.name || user?.email || null,
      };
      const r = await fetch(`${API}/nota`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.success) {
        beep(false);
        avisar('erro', j.message || 'Falha ao emitir a transferência');
        return;
      }
      setResultado(j.data);
      setConfirmar(false);
      beep(j.data.fiscal?.ok && j.data.totvs?.ok);
      avisar(j.data.fiscal?.ok && j.data.totvs?.ok ? 'ok' : 'erro', j.message);
      onConcluida?.(j.data);
    } catch (e) {
      avisar('erro', `Falha ao emitir: ${e.message}`);
    } finally {
      setPosting(false);
    }
  };
  const reprocessar = async () => {
    if (!resultado?.vendaId) return;
    setPosting(true);
    try {
      const r = await fetch(`${API}/nota/${resultado.vendaId}/reprocessar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (j.success) setResultado(j.data);
      avisar(j.success && j.data.fiscal?.ok && j.data.totvs?.ok ? 'ok' : 'erro', j.message);
      onConcluida?.(j.data);
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setPosting(false);
    }
  };

  const notaRes = resultado?.nota;
  const btnTirar = 'inline-flex h-6 items-center gap-0.5 rounded-md bg-white px-1.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50';

  return (
    <div className="mx-3 mb-3 lg:mx-4 lg:mb-4">
      {aviso && (
        <div className={`fixed right-4 top-4 z-[60] max-w-md rounded-xl px-3 py-2 text-xs font-semibold shadow-lg ring-1 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{aviso.msg}</div>
      )}
      {/* cabeçalho */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm ring-1 ring-gray-200">
        <span className="inline-flex items-center gap-1.5 font-bold text-[#000638]">
          <ArrowsLeftRight size={15} weight="bold" /> Transferência da empresa {EMPRESA} · nota pelo HeadCoach
        </span>
        {prep?.solicitacao && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 font-bold text-sky-700 ring-1 ring-sky-200">
            TRF-{prep.solicitacao.id}
            {prep.solicitacao.ref ? ` · ${prep.solicitacao.ref}` : ''}
          </span>
        )}
        {prep && (
          <>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-[#000638] ring-1 ring-indigo-200">
              {prep.naturezaNome} · CFOP {prep.cenario.cfops.join(' / ') || '—'} · {prep.cenario.texto}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600 ring-1 ring-gray-200">
              TOTVS: empresa {prep.empresaTotvs} · operação {prep.operacaoDocInterno} (documento interno)
            </span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${Number(prep.numeracao.ambiente) === 1 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
              NF-e série {prep.numeracao.serie} · {Number(prep.numeracao.ambiente) === 1 ? 'PRODUÇÃO' : 'homologação'}
            </span>
          </>
        )}
        <span className="flex-1" />
        {onSair && (
          <button onClick={onSair} className="h-7 rounded-lg px-2 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
            Voltar às solicitações
          </button>
        )}
      </div>

      {!solicitacao && (
        <div className="mb-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
          <label className={labelCls}>Loja de destino (transferência avulsa da {EMPRESA})</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={`${inputCls} max-w-xl`}>
            <option value="">Selecione a loja…</option>
            {filiais.map((f) => (
              <option key={f.code} value={f.personCode}>
                {f.code} — {f.nome} ({f.grupo || '—'}) · cliente {f.personCode}
              </option>
            ))}
          </select>
        </div>
      )}
      {erro && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {carregando && (
        <div className="py-10 text-center text-gray-400">
          <Spinner size={22} className="mx-auto animate-spin" />
        </div>
      )}

      {prep && (
        <>
          {prep.jaEmitida && !resultado && (
            <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-800 ring-1 ring-rose-300">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-600 text-white">
                <LockKey size={18} weight="bold" />
              </span>
              <div>
                <p className="text-sm font-bold">TRANSFERÊNCIA JÁ EMITIDA</p>
                <p>
                  NF-e {prep.jaEmitida.numero}/{prep.jaEmitida.serie}
                  {prep.jaEmitida.transacao ? ` · transação ${prep.empresaTotvs}/${prep.jaEmitida.transacao}` : ''}. Para emitir de novo, cancele a nota (aba Transações).
                </p>
              </div>
            </div>
          )}
          <div className="grid items-start gap-2 lg:grid-cols-[1fr_330px]">
            {/* ── esquerda ── */}
            <div className="space-y-2">
              <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Origem</label>
                    <p className="flex h-9 items-center rounded-lg bg-gray-50 px-2 text-sm font-semibold text-[#000638] ring-1 ring-gray-200">
                      {prep.origem.code} · {prep.origem.uf}
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Destino</label>
                    <p className="flex h-9 items-center truncate rounded-lg bg-blue-50 px-2 text-sm font-semibold text-[#000638] ring-1 ring-blue-200" title={prep.destino.razao}>
                      {prep.destino.code ?? '—'} — {prep.destino.nome}
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Vendedor</label>
                    <select value={seller} onChange={(e) => setSeller(e.target.value)} className={inputCls}>
                      <option value="">Selecione…</option>
                      {sellers.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600 ring-1 ring-gray-200">
                  CNPJ {prep.destino.cnpj} · IE {prep.destino.ie || 'sem IE'} · {prep.destino.cidade || ''}/{prep.destino.uf || ''} · cliente {prep.destino.personCode}
                  {prep.destino.foraDoPop && <b className="ml-1 text-amber-700">· loja fora da lista de filiais do POP: confira o destino</b>}
                </p>
                {prep.solicitacao?.observacao && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 ring-1 ring-amber-200">{prep.solicitacao.observacao}</p>}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#000638]">
                    <Package size={15} /> {temPedido ? 'Peças do pedido' : 'Peças lidas'}
                  </span>
                  {temPedido ? (
                    <>
                      <span className="text-xs text-emerald-700">
                        <b>{conf.conferidas}</b> de {conf.esperado} conferidas
                      </span>
                      {conf.faltando > 0 && (
                        <span className="text-xs text-amber-700">
                          <b>{conf.faltando}</b> faltando
                        </span>
                      )}
                      {conf.sobrando > 0 && (
                        <span className="text-xs text-rose-700">
                          <b>{conf.sobrando}</b> a mais
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">sem pedido: entra tudo o que for lido · preço = tabela 4 (atacado) − 25%, pode corrigir na linha</span>
                  )}
                </div>
                {temPedido && (
                  <ul className="divide-y divide-gray-100 border-t border-gray-100">
                    {conf.linhas.map((l) => {
                      const cor = l.conferido === l.qtd && l.sobra === 0 ? 'border-l-emerald-500 bg-emerald-50/40' : l.sobra > 0 ? 'border-l-rose-500 bg-rose-50/40' : l.conferido > 0 ? 'border-l-amber-400 bg-amber-50/30' : 'border-l-transparent';
                      return (
                        <li key={l.sku} className={`border-l-4 px-3 py-2 ${cor}`}>
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-gray-800">{l.nome}</p>
                              <p className="text-[11px] text-gray-500">
                                SKU <b className="font-mono text-gray-700">{l.sku}</b>
                                {l.cor ? ` · ${l.cor}` : ''}
                                {l.tam ? ` · ${l.tam}` : ''} · {[...new Set(l.unidades.map((u) => u.preco))].map((v) => fmtBRL(v)).join(' / ')}
                                {[...new Set(l.unidades.map((u) => u.tr).filter(Boolean))].length > 0 && <span className="ml-1 text-gray-400">· {[...new Set(l.unidades.map((u) => u.tr).filter(Boolean))].join(', ')}</span>}
                                {l.unidades.some((u) => !(u.preco > 0)) && <span className="font-semibold text-rose-600"> sem preço</span>}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-base font-bold tabular-nums text-[#000638]">
                                {l.lido}
                                <span className="font-normal text-gray-400">/{l.qtd}</span>
                              </p>
                              <p className="text-[10px] font-semibold">
                                {l.conferido === l.qtd && l.sobra === 0 ? <span className="text-emerald-700">ok</span> : l.sobra > 0 ? <span className="text-rose-700">+{l.sobra} a mais</span> : <span className="text-amber-700">falta {l.falta}</span>}
                              </p>
                            </div>
                          </div>
                          {l.lido > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {l.epcs.map((epc) => (
                                <span key={epc} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] text-purple-700 ring-1 ring-purple-200">
                                  <Tag size={9} /> {epc}
                                  {!resultado && (
                                    <button onClick={() => removerEpc(l.sku, epc)} className="text-purple-400 hover:text-rose-600" title="Tirar esta etiqueta">
                                      <X size={11} weight="bold" />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {l.manual > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 ring-1 ring-blue-200">
                                  <Barcode size={10} /> {l.manual} digitada(s)
                                </span>
                              )}
                              {!resultado && (
                                <span className="ml-auto inline-flex gap-1">
                                  <button onClick={() => removerPeca(l.sku)} className={btnTirar} title="Tirar UMA peça deste produto">
                                    <Minus size={10} weight="bold" /> tirar 1
                                  </button>
                                  {l.lido > 1 && (
                                    <button onClick={() => removerTodas(l.sku)} className={btnTirar} title="Tirar todas as peças deste produto">
                                      <Trash size={11} />
                                    </button>
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {conf.fora.length > 0 && (
                  <div className={`border-t ${temPedido ? 'border-rose-200 bg-rose-50/60' : 'border-gray-100'}`}>
                    {temPedido && (
                      <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                        Lidas que NÃO estão no pedido ({conf.fora.reduce((s, l) => s + l.total, 0)}) — não entram na nota
                      </p>
                    )}
                    <ul className={`divide-y ${temPedido ? 'divide-rose-100' : 'divide-gray-100'}`}>
                      {conf.fora.map((l) => (
                        <li key={l.sku} className="px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`min-w-0 flex-1 truncate font-semibold ${temPedido ? 'text-rose-800' : 'text-gray-800'}`}>
                              {l.nome} <span className="font-mono font-normal">· SKU {l.sku}</span>
                            </p>
                            {!temPedido && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                R$
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={precoLivre[l.sku] ?? precoTransferencia(l.precoTotvs)}
                                  onChange={(e) => setPrecoLivre((p) => ({ ...p, [l.sku]: e.target.value }))}
                                  className="mb-0 h-7 w-24 rounded-lg border border-gray-300 px-1.5 text-xs"
                                />
                              </span>
                            )}
                            <span className="font-bold tabular-nums text-[#000638]">{l.total} pç</span>
                            {!resultado && (
                              <>
                                <button onClick={() => removerPeca(l.sku)} className={btnTirar}>
                                  <Minus size={10} weight="bold" /> tirar 1
                                </button>
                                {l.total > 1 && (
                                  <button onClick={() => removerTodas(l.sku)} className={btnTirar}>
                                    <Trash size={11} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!temPedido && conf.fora.length === 0 && <p className="border-t border-gray-100 px-3 py-8 text-center text-xs text-gray-400">Ligue o portal ou digite o código das peças.</p>}
                {removidas.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-3 py-2 text-[11px] text-gray-600">
                    <span>
                      <b>{removidas.length}</b> etiqueta(s) tirada(s) à mão: o portal não lê de novo.
                    </span>
                    <button onClick={devolverRemovidas} className="rounded-md bg-white px-1.5 py-0.5 font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                      Voltar a ler
                    </button>
                  </div>
                )}
                {naoResolvidos.length > 0 && (
                  <p className="border-t border-gray-200 px-3 py-2 text-[11px] text-gray-500">
                    <b>{naoResolvidos.length}</b> etiqueta(s) que o TOTVS não reconheceu: <span className="font-mono">{naoResolvidos.slice(0, 6).join(', ')}</span>
                  </p>
                )}
              </section>
            </div>

            {/* ── direita ── */}
            <div className="space-y-2">
              <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-1.5">
                  <Broadcast size={15} className="text-[#000638]" />
                  <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-[#000638]">Portal RFID</h3>
                </div>
                <p className="mb-2 flex items-center gap-1.5 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${portalStatus.status === 'lendo' ? 'animate-pulse bg-emerald-500' : portalLigado ? 'bg-amber-400' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-700">{portalStatus.status || 'desconectado'}</span>
                </p>
                <button
                  onClick={alternarPortal}
                  disabled={portalBusy || !!resultado}
                  className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${portalLigado ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {portalBusy ? <Spinner size={16} className="animate-spin" /> : portalLigado ? <Plugs size={16} /> : <PlugsConnected size={16} />}
                  {portalLigado ? 'DESLIGAR PORTAL' : 'LIGAR PORTAL'}
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => setPotenciaOpen(true)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                    <WifiHigh size={13} weight="bold" /> Potência
                  </button>
                  <button onClick={limparLeituras} disabled={!!resultado} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40">
                    <Trash size={13} /> Limpar leituras
                  </button>
                </div>
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <label className={labelCls}>Peça sem etiqueta (código / barras)</label>
                  <div className="flex gap-1.5">
                    <input value={codigoManual} onChange={(e) => setCodigoManual(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarManual()} placeholder="SKU ou código de barras" className={inputCls} disabled={!!resultado} />
                    <button onClick={adicionarManual} disabled={manualBusy || !codigoManual.trim() || !!resultado} className="h-9 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white disabled:opacity-40">
                      {manualBusy ? <Spinner size={13} className="animate-spin" /> : '+1'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-sm">
                <div className="space-y-1">
                  {temPedido && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Peças do pedido</span>
                      <span className="tabular-nums">{conf.esperado}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-700">
                    <span>Conferidas (vão na nota)</span>
                    <span className="font-bold tabular-nums">{conf.conferidas}</span>
                  </div>
                  {conf.faltando > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Faltando (ficam fora)</span>
                      <span className="tabular-nums">{conf.faltando}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-gray-100 pt-1">
                    <span className="font-semibold text-[#000638]">Total da NF-e</span>
                    <span className="text-xl font-bold tabular-nums text-[#000638]">{fmtBRL(conf.total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Terminal do TOTVS</span>
                    <input type="number" min="1" value={terminal} onChange={(e) => setTerminal(e.target.value)} className="mb-0 h-7 w-14 rounded-lg border border-gray-300 px-1.5 text-xs" />
                  </div>
                </div>

                {resultado ? (
                  <div className="mt-2 space-y-2">
                    <div className={`rounded-lg p-2 ring-1 ${resultado.fiscal?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
                      <p className={`inline-flex items-center gap-1 font-bold ${resultado.fiscal?.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                        {resultado.fiscal?.ok ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} weight="fill" />}
                        {resultado.fiscal?.ok ? `NF-e ${notaRes?.numero}/${notaRes?.serie} autorizada` : 'NF-e não autorizada'}
                      </p>
                      {!resultado.fiscal?.ok && <p className="text-[11px] text-rose-700">{resultado.fiscal?.mensagem}</p>}
                      {notaRes?.chave && <p className="mt-0.5 break-all font-mono text-[10px] text-gray-500">{notaRes.chave}</p>}
                      {resultado.fiscal?.ok && notaRes?.id && (
                        <div className="mt-1.5 flex gap-1.5">
                          <button onClick={() => imprimirDanfe(notaRes.id).catch((e) => avisar('erro', e.message))} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white">
                            <Printer size={13} /> Imprimir
                          </button>
                          <button
                            onClick={() =>
                              salvarDanfePdf(notaRes.id)
                                .then((r) => avisoDoPdf(r) && avisar('ok', avisoDoPdf(r)))
                                .catch((e) => avisar('erro', e.message))
                            }
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300"
                          >
                            <DownloadSimple size={13} /> Salvar PDF
                          </button>
                          <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${notaRes.id}/xml`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300">
                            <DownloadSimple size={13} /> XML
                          </a>
                        </div>
                      )}
                    </div>
                    <div className={`rounded-lg p-2 ring-1 ${resultado.totvs?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
                      <p className={`inline-flex items-center gap-1 font-bold ${resultado.totvs?.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {resultado.totvs?.ok ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} weight="fill" />}
                        {resultado.totvs?.ok ? `TOTVS: transação ${prep.empresaTotvs}/${resultado.totvs.transactionCode} atendida` : 'TOTVS ainda não atendeu'}
                      </p>
                      {!resultado.totvs?.ok && <p className="text-[11px] text-amber-800">{resultado.totvs?.mensagem}</p>}
                    </div>
                    {!(resultado.fiscal?.ok && resultado.totvs?.ok) && (
                      <button onClick={reprocessar} disabled={posting} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 text-xs font-bold text-white disabled:opacity-50">
                        {posting ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />} Tentar de novo
                      </button>
                    )}
                    {onSair && (
                      <button onClick={onSair} className="h-9 w-full rounded-lg bg-[#000638] text-xs font-bold text-white hover:bg-[#000638]/90">
                        Voltar às solicitações
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <button onClick={() => setConfirmar(true)} disabled={!podeEmitir} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                      <Receipt size={16} weight="bold" /> EMITIR NOTA E TRANSFERIR ({conf.conferidas} pç)
                    </button>
                    {pendencias.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10.5px] text-amber-700">
                        {pendencias.slice(0, 5).map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                    {temPedido && conf.conferidas > 0 && (conf.faltando > 0 || conf.sobrando > 0) && <p className="mt-1 text-[10px] text-gray-500">Só as peças conferidas entram na nota; o que falta ou sobra fica registrado.</p>}
                  </>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {confirmar && prep && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#000638]/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => !posting && setConfirmar(false)}>
          <div className="w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#000638] to-[#1b2a6b] px-5 py-4 text-white">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
                <ArrowsLeftRight size={20} weight="bold" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">{posting ? 'Emitindo…' : 'Confirmar transferência'}</p>
                <p className="truncate text-xs text-white/70">
                  {prep.solicitacao?.ref || (prep.solicitacao ? `TRF-${prep.solicitacao.id}` : 'avulsa')} · {EMPRESA} → {prep.destino.code ?? ''} {prep.destino.nome}
                </p>
              </div>
              {Number(prep.numeracao?.ambiente) === 1 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">produção</span>}
            </div>
            <div className="space-y-1.5 px-5 py-4 text-xs">
              <p>
                <b>NF-e:</b> empresa {EMPRESA}, série {prep.numeracao.serie} · {prep.naturezaNome} · CFOP {prep.cenario.cfops.join(' / ')} · sem pagamento
              </p>
              <p>
                <b>Destino:</b> {prep.destino.razao} · CNPJ {prep.destino.cnpj}
              </p>
              <p>
                <b>TOTVS:</b> empresa {prep.empresaTotvs}, operação {prep.operacaoDocInterno} (documento interno, sem nota e sem financeiro), já atendida
              </p>
              <div className="rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
                <div className="flex justify-between">
                  <span>{conf.conferidas} peça(s)</span>
                  <span className="text-lg font-extrabold tabular-nums text-[#000638]">{fmtBRL(conf.total)}</span>
                </div>
                {temPedido && (conf.faltando > 0 || conf.sobrando > 0) && (
                  <p className="text-[11px] text-amber-700">
                    Ficam fora da nota: {conf.faltando} faltando · {conf.sobrando} a mais.
                  </p>
                )}
              </div>
              <p className="text-[11px] text-gray-500">A nota é real (SEFAZ). Depois dela o TOTVS recebe a transferência na empresa {prep.empresaTotvs}.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setConfirmar(false)} disabled={posting} className="h-11 flex-1 rounded-xl text-sm font-bold text-gray-600 ring-1 ring-gray-300 disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={emitir} disabled={!podeEmitir} className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {posting ? <Spinner size={16} className="animate-spin" /> : <Receipt size={16} weight="bold" />} Emitir NF-e e transferir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {potenciaOpen && <PortalPotenciaModal onClose={() => setPotenciaOpen(false)} onSaved={() => avisar('ok', 'Potência do portal gravada')} />}
    </div>
  );
};

export default TransferenciaNota99;
