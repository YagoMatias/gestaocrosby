// Página: Expedição → Faturamento (/expedicao/faturamento?chave=<id do card | SEP:ref>)
// Pedido SEPARADO no Dryland → botão FATURAR na tela Pedido de Venda → aqui:
//   • empresa SEMPRE 99, cliente já marcado pelo pedido, vendedor do pedido
//   • operação escolhida numa LISTA FIXA (OPERACOES_FATURAMENTO)
//   • os produtos do pedido aparecem pelo SKU (código TOTVS) com a quantidade
//   • LIGAR PORTAL: cada etiqueta lida vira SKU (EPC → produto no TOTVS) e é
//     conferida contra o pedido — conferido / faltando / sobrando (fora do pedido)
//   • GERAR TRANSAÇÃO: venda "em andamento" no TOTVS só com as peças
//     conferidas, pelo preço do pedido; acompanha até ATENDIDA (o caixa finaliza
//     no TRAFP005) e fica registrada em pedidos_venda_faturamentos.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Plugs,
  PlugsConnected,
  Spinner,
  ArrowsClockwise,
  ArrowLeft,
  Buildings,
  User,
  Gear,
  CheckCircle,
  Warning,
  Tag,
  Barcode,
  X,
  Trash,
  Broadcast,
  MagnifyingGlass,
  Package,
  Minus,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { ClientePicker } from './DevolucaoRFID';
import { portalConnect, portalDisconnect, portalTags, portalClear } from '../utils/portalApi';

// ─── Configuração ────────────────────────────────────────────────────────────
const EMPRESA = 99; // faturamento sempre pela empresa 99

// LISTA FIXA de operações de venda. Ajuste aqui quando a lista oficial mudar.
// `canais` = canais do pedido em que a operação já vem marcada.
const OPERACOES_FATURAMENTO = [
  { code: '545', label: 'VENDA VAREJO', canais: ['varejo'] },
  { code: '7236', label: 'VENDA REVENDEDOR', canais: ['revenda'] },
  { code: '7235', label: 'VENDA MULTIMARCAS', canais: ['mtm'] },
  { code: '7234', label: 'VENDA FRANQUIA', canais: ['franquias'] },
];

const CONFIG = {
  paymentConditionCode: 1, // provisória; o caixa define a real no TRAFP005
  priceCodes: '4', // só para peça sem preço no pedido
};

const TRX_STATUS = {
  1: { label: 'Em andamento', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  2: { label: 'Encerrada', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  3: { label: 'Em processo externo', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  4: { label: 'ATENDIDA', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  6: { label: 'CANCELADA', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const CANAIS = {
  varejo: 'Varejo',
  revenda: 'Revenda',
  mtm: 'Multimarcas',
  franquias: 'Franquias',
};

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const arred3 = (n) => Number(Number(n || 0).toFixed(3));

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

// Itens do pedido agrupados por SKU (código do produto no TOTVS).
// Separação do Dryland quando houver (pedido do site); senão, itens do card.
function itensDoPedido(dados) {
  const brutos = (dados?.itens || []).length
    ? dados.itens.map((i) => ({ cod: i.cod, descricao: i.descricao, cor: i.cor, tam: i.tamanho, qtd: i.qtd, preco: i.preco }))
    : (dados?.card?.dados?.itens || []).map((i) => ({ cod: i.cod, descricao: i.descricao, cor: i.cor, tam: i.tam, qtd: i.qtd, preco: i.preco }));
  const porSku = new Map();
  for (const i of brutos) {
    const sku = String(i.cod || '').trim();
    if (!sku) continue;
    const q = Number(i.qtd) || 1;
    const cur = porSku.get(sku);
    if (cur) {
      // preço médio ponderado quando o mesmo SKU aparece em mais de uma linha
      const totalAnt = cur.preco * cur.qtd;
      cur.qtd += q;
      cur.preco = (totalAnt + (Number(i.preco) || 0) * q) / cur.qtd;
    } else {
      porSku.set(sku, { sku, descricao: i.descricao || '', cor: i.cor || '', tam: i.tam || '', qtd: q, preco: Number(i.preco) || 0 });
    }
  }
  return [...porSku.values()].sort((a, b) => a.descricao.localeCompare(b.descricao));
}

// ─── Lista dos pedidos separados (quando a tela abre sem pedido) ────────────
function ListaSeparados({ onEscolher }) {
  const [itens, setItens] = useState(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setItens(null);
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda?separacao=separado`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || `HTTP ${r.status}`);
      setItens(j.data.items || []);
    } catch (e) {
      setErro(e.message);
      setItens([]);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const b = busca.trim().toUpperCase();
    if (!b) return itens || [];
    return (itens || []).filter((p) =>
      [p.numero_site, p.cliente, p.titulo, p.vendedor].filter(Boolean).some((v) => String(v).toUpperCase().includes(b)),
    );
  }, [itens, busca]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <p className="text-sm font-bold text-[#000638] flex-1">Pedidos separados prontos para faturar</p>
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="pedido, cliente, vendedor…"
            className="h-9 pl-8 pr-2 rounded-lg border border-gray-300 text-sm mb-0 w-56"
          />
        </div>
        <button onClick={carregar} className="h-9 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center gap-1.5">
          <ArrowsClockwise size={13} className={itens === null ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      {erro && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200 mb-2">{erro}</p>}
      {itens === null ? (
        <div className="py-8 text-center text-gray-400">
          <Spinner size={20} className="animate-spin mx-auto" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">Nenhum pedido separado.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filtrados.map((p) => (
            <li key={p.chave} className="py-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold text-[#000638] w-20">{p.numero_site || '—'}</span>
              <span className="flex-1 min-w-[160px] truncate font-medium text-gray-800">{p.cliente || p.titulo}</span>
              <span className="text-gray-500">{CANAIS[p.canal] || p.canal}</span>
              <span className="text-gray-500 tabular-nums">{p.separacao?.qtd_pecas || 0} pç</span>
              <span className="font-semibold tabular-nums w-24 text-right">{fmtBRL(p.valor)}</span>
              {p.faturamento ? (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-semibold">tx {p.faturamento.transacao}</span>
              ) : null}
              <button
                onClick={() => onEscolher(p.chave)}
                className="h-8 px-3 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700"
              >
                FATURAR
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
const FaturamentoPedido = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const chave = params.get('chave') || '';

  const [toast, setToast] = useState(null);
  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Pedido
  const [pedido, setPedido] = useState(null); // { card, separacao, itens, faturamentos }
  const [carregando, setCarregando] = useState(false);
  const [erroPedido, setErroPedido] = useState('');

  // Cabeçalho da transação
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [operacao, setOperacao] = useState('');
  const [ufEmpresa, setUfEmpresa] = useState(null);
  const ufCliente = customerInfo?.uf || null;
  const cfop = ufEmpresa && ufCliente ? (ufEmpresa === ufCliente ? '5102' : '6102') : '5102';

  // Portal / leituras
  const [portalStatus, setPortalStatus] = useState({ status: 'desconectado' });
  const [portalBusy, setPortalBusy] = useState(false);
  const [lidos, setLidos] = useState({}); // sku → { sku, nome, epcs[], manual, preco }
  const [naoResolvidos, setNaoResolvidos] = useState([]); // EPCs que o TOTVS não reconheceu
  const processed = useRef(new Set());
  const [codigoManual, setCodigoManual] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  // Transação
  const [confirmaDuplicar, setConfirmaDuplicar] = useState(false);
  const [posting, setPosting] = useState(false);
  const [trx, setTrx] = useState(null);
  const [trxStatus, setTrxStatus] = useState(null);

  const limparLeituras = useCallback(() => {
    setLidos({});
    setNaoResolvidos([]);
    processed.current = new Set();
    portalClear().catch(() => {});
  }, []);

  // ─── Carrega o pedido ────────────────────────────────────────────────────
  useEffect(() => {
    setPedido(null);
    setErroPedido('');
    setTrx(null);
    setTrxStatus(null);
    setConfirmaDuplicar(false);
    setLidos({});
    setNaoResolvidos([]);
    processed.current = new Set();
    if (!chave) return undefined;
    let vivo = true;
    setCarregando(true);
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/${encodeURIComponent(chave)}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || `HTTP ${r.status}`);
        if (!vivo) return;
        const d = j.data;
        setPedido(d);
        const dd = d.card?.dados || {};
        const sep = d.separacao;
        const codCli = parseInt(dd.codigo_cliente, 10);
        setCustomer(Number.isFinite(codCli) && codCli > 0 ? { code: codCli, name: dd.nome_cliente || sep?.cliente || `Cliente ${codCli}` } : null);
        setCustomerInfo(null);
        const vend = sep?.vendedor_code || parseInt(dd.cod_vendedor, 10) || null;
        setSeller(vend ? String(vend) : '');
        const canal = d.card?.canal || ({ revenda: 'revenda', varejo: 'varejo', multimarca: 'mtm', franquia: 'franquias' })[sep?.canal] || '';
        const op = OPERACOES_FATURAMENTO.find((o) => o.canais.includes(canal));
        setOperacao(op ? op.code : '');
      } catch (e) {
        if (vivo) setErroPedido(e.message);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [chave]);

  // UF da empresa 99 e vendedores dela
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/totvs/pdv/branch/${EMPRESA}`)
      .then((r) => r.json())
      .then((j) => j?.success && setUfEmpresa(j.data?.uf || null))
      .catch(() => {});
    fetch(`${API_BASE_URL}/api/totvs/pdv/sellers?branch=${EMPRESA}`)
      .then((r) => r.json())
      .then((j) => setSellers(j?.data?.items || []))
      .catch(() => setSellers([]));
  }, []);

  // Dados do cliente (UF → CFOP)
  useEffect(() => {
    if (!customer) {
      setCustomerInfo(null);
      return undefined;
    }
    let vivo = true;
    fetch(`${API_BASE_URL}/api/totvs/pdv/customer/${customer.code}`)
      .then((r) => r.json())
      .then((j) => vivo && j?.data && setCustomerInfo(j.data))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [customer]);

  const itensPedido = useMemo(() => (pedido ? itensDoPedido(pedido) : []), [pedido]);
  const skusPedido = useMemo(() => new Set(itensPedido.map((i) => i.sku)), [itensPedido]);

  // ─── Portal RFID ─────────────────────────────────────────────────────────
  const portalLigado = ['lendo', 'conectando', 'reconectando'].includes(portalStatus.status);

  const ligarPortal = useCallback(async () => {
    setPortalBusy(true);
    try {
      const j = await portalConnect({});
      if (!j?.success) showToast('erro', j?.message || 'Falha ao ligar o portal');
      else setPortalStatus(j.data);
    } catch (e) {
      showToast('erro', `Portal indisponível — instale/inicie o Agente do Portal nesta máquina (${e.message})`);
    } finally {
      setPortalBusy(false);
    }
  }, [showToast]);

  const desligarPortal = useCallback(async () => {
    setPortalBusy(true);
    try {
      const j = await portalDisconnect();
      if (j?.data) setPortalStatus(j.data);
    } catch {
      /* segue */
    } finally {
      setPortalBusy(false);
    }
  }, []);

  const consultarProduto = useCallback(async (code) => {
    const r = await fetch(
      `${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}?branch=${EMPRESA}&priceCodes=${CONFIG.priceCodes}`,
    );
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
        return {
          ...prev,
          [sku]: {
            ...cur,
            epcs: epc && !cur.epcs.includes(epc) ? [...cur.epcs, epc] : cur.epcs,
            manual: cur.manual + manual,
          },
        };
      });
      beep(skusPedido.has(sku));
    },
    [skusPedido],
  );

  const resolverEpc = useCallback(
    async (epc) => {
      try {
        const res = await consultarProduto(epc);
        if (res.ok) somar(res.data, { epc });
        else setNaoResolvidos((l) => (l.includes(epc) ? l : [...l, epc]));
      } catch {
        processed.current.delete(epc); // tenta de novo na próxima varredura
      }
    },
    [consultarProduto, somar],
  );

  useEffect(() => {
    if (!chave) return undefined;
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
        /* agente/backend fora */
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [chave, resolverEpc]);

  const adicionarManual = useCallback(async () => {
    const code = codigoManual.trim();
    if (!code || manualBusy) return;
    setManualBusy(true);
    setCodigoManual(''); // libera o campo já (a consulta no TOTVS demora)
    try {
      const res = await consultarProduto(code);
      if (!res.ok) {
        beep(false);
        showToast('erro', res.message || `Código ${code} não encontrado`);
        return;
      }
      somar(res.data, { manual: 1 });
    } catch (e) {
      beep(false);
      showToast('erro', `Erro na consulta: ${e.message}`);
    } finally {
      setManualBusy(false);
    }
  }, [codigoManual, manualBusy, consultarProduto, somar, showToast]);

  const removerEpc = useCallback((sku, epc) => {
    processed.current.delete(epc);
    setLidos((prev) => {
      const cur = prev[sku];
      if (!cur) return prev;
      const novo = { ...cur, epcs: cur.epcs.filter((e) => e !== epc) };
      const next = { ...prev, [sku]: novo };
      if (novo.epcs.length + novo.manual <= 0) delete next[sku];
      return next;
    });
  }, []);

  const tirarManual = useCallback((sku) => {
    setLidos((prev) => {
      const cur = prev[sku];
      if (!cur || cur.manual <= 0) return prev;
      const novo = { ...cur, manual: cur.manual - 1 };
      const next = { ...prev, [sku]: novo };
      if (novo.epcs.length + novo.manual <= 0) delete next[sku];
      return next;
    });
  }, []);

  // ─── Conferência: SKU do pedido × SKU lido pelo portal ───────────────────
  const conf = useMemo(() => {
    const linhas = itensPedido.map((i) => {
      const l = lidos[i.sku];
      const lido = l ? l.epcs.length + l.manual : 0;
      const conferido = Math.min(lido, i.qtd);
      const preco = i.preco > 0 ? i.preco : l?.precoTotvs || 0;
      return { ...i, preco, lido, conferido, falta: i.qtd - conferido, sobra: Math.max(0, lido - i.qtd), epcs: l?.epcs || [], manual: l?.manual || 0 };
    });
    const fora = Object.values(lidos)
      .filter((l) => !skusPedido.has(l.sku))
      .map((l) => ({ ...l, lido: l.epcs.length + l.manual }));
    const esperado = linhas.reduce((s, l) => s + l.qtd, 0);
    const conferidas = linhas.reduce((s, l) => s + l.conferido, 0);
    const faltando = esperado - conferidas;
    const sobrando = linhas.reduce((s, l) => s + l.sobra, 0) + fora.reduce((s, l) => s + l.lido, 0);
    const totalPedido = linhas.reduce((s, l) => s + l.qtd * l.preco, 0);
    const totalConferido = linhas.reduce((s, l) => s + l.conferido * l.preco, 0);
    return { linhas, fora, esperado, conferidas, faltando, sobrando, totalPedido, totalConferido, ok: esperado > 0 && faltando === 0 && sobrando === 0 };
  }, [itensPedido, lidos, skusPedido]);

  // ─── Gerar a transação de venda no TOTVS ─────────────────────────────────
  const card = pedido?.card || null;
  const ref = card?.numero_site || pedido?.separacao?.ref || (chave.startsWith('SEP:') ? chave.slice(4) : null);
  const jaNoTotvs = [card?.transacao && `transação ${card.transacao}`, card?.pedido_totvs && `pedido ${card.pedido_totvs}`]
    .concat((pedido?.separacao?.totvs_pedidos || []).map((p) => `pedido ${p}`))
    .filter(Boolean);
  const fatsVivos = (pedido?.faturamentos || []).filter((f) => f.transacao_status !== 6);
  const precisaConfirmar = jaNoTotvs.length > 0 || fatsVivos.length > 0;
  const semPreco = conf.linhas.some((l) => l.conferido > 0 && !(l.preco > 0));

  const podeGerar =
    !posting &&
    !trx &&
    customer &&
    seller &&
    operacao &&
    conf.conferidas > 0 &&
    !semPreco &&
    (!precisaConfirmar || confirmaDuplicar);

  const gerarTransacao = useCallback(async () => {
    if (!podeGerar) return;
    setPosting(true);
    try {
      const cf = parseInt(cfop, 10);
      const itens = conf.linhas
        .filter((l) => l.conferido > 0)
        .map((l) => ({ productCode: parseInt(l.sku, 10), quantity: l.conferido, value: arred3(l.preco), cfop: cf }));
      // 3 casas: o TOTVS soma as linhas com 3 decimais (mesma regra da Devolução)
      const total = arred3(itens.reduce((s, it) => s + it.quantity * it.value, 0));
      const observations = [
        { observation: `PEDIDO DRYLAND ${ref || chave} - FATURAMENTO HEADCOACH`.slice(0, 80) },
        ...(!conf.ok
          ? [{ observation: `CONFERIDAS ${conf.conferidas} DE ${conf.esperado} - FALTAM ${conf.faltando} SOBRAM ${conf.sobrando}`.slice(0, 80) }]
          : []),
      ];
      const payload = {
        branchCode: EMPRESA,
        customerCode: customer.code,
        sellerCode: parseInt(seller, 10),
        operationCode: parseInt(operacao, 10),
        paymentConditionCode: CONFIG.paymentConditionCode,
        isPreSale: false,
        status: 1,
        totalAmountTransaction: total,
        items: itens,
        observations,
      };
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        beep(false);
        showToast('erro', j?.message || 'O TOTVS recusou a transação');
        return;
      }
      const nova = { ...j.data, total };
      setTrx(nova);
      setTrxStatus(1);
      beep(true);

      // registra no HeadCoach (conferidos / faltando / sobrando)
      try {
        const rr = await fetch(`${API_BASE_URL}/api/pedidos-venda/${encodeURIComponent(chave)}/faturamentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numeroSite: ref,
            empresa: EMPRESA,
            transactionCode: nova.transactionCode,
            transactionDate: nova.transactionDate,
            status: 1,
            operacao: parseInt(operacao, 10),
            cfop: cf,
            total,
            clienteCode: customer.code,
            clienteNome: customer.name,
            vendedorCode: parseInt(seller, 10),
            qtdPedido: conf.esperado,
            conferidos: conf.linhas
              .filter((l) => l.conferido > 0)
              .map((l) => ({ productCode: l.sku, name: l.descricao, quantidade: l.conferido, unit: Number(l.preco.toFixed(2)), total: Number((l.conferido * l.preco).toFixed(2)), epcs: l.epcs.slice(0, l.conferido) })),
            faltando: conf.linhas
              .filter((l) => l.falta > 0)
              .map((l) => ({ productCode: l.sku, name: l.descricao, quantidade: l.falta, unit: Number(l.preco.toFixed(2)) })),
            sobrando: [
              ...conf.linhas.filter((l) => l.sobra > 0).map((l) => ({ productCode: l.sku, name: l.descricao, quantidade: l.sobra, epcs: l.epcs.slice(l.qtd) })),
              ...conf.fora.map((l) => ({ productCode: l.sku, name: l.nome, quantidade: l.lido, epcs: l.epcs })),
            ],
            por: user?.name || user?.email || null,
          }),
        });
        const jr = await rr.json();
        if (rr.ok && jr.success) setTrx((t) => (t ? { ...t, registroId: jr.data.id } : t));
        else showToast('erro', `Transação gerada, mas o registro no HeadCoach falhou: ${jr?.message || ''}`);
      } catch (er) {
        showToast('erro', `Transação gerada, mas o registro no HeadCoach falhou: ${er.message}`);
      }
    } catch (e) {
      showToast('erro', `Falha ao gerar a transação: ${e.message}`);
    } finally {
      setPosting(false);
    }
  }, [podeGerar, cfop, conf, ref, chave, customer, seller, operacao, showToast, user]);

  // ─── Acompanha a transação até ATENDIDA / CANCELADA ──────────────────────
  const verificarStatus = useCallback(async () => {
    if (!trx) return;
    try {
      const qs = new URLSearchParams({ branch: trx.branchCode, code: trx.transactionCode, date: String(trx.transactionDate).slice(0, 10) });
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`);
      const j = await r.json();
      if (j?.data?.status != null) setTrxStatus(j.data.status);
    } catch {
      /* próximo ciclo */
    }
  }, [trx]);

  useEffect(() => {
    if (!trx || trxStatus === 4 || trxStatus === 6) return undefined;
    const t = setInterval(verificarStatus, 10000);
    return () => clearInterval(t);
  }, [trx, trxStatus, verificarStatus]);

  const ultimoAvisado = useRef(null);
  useEffect(() => {
    if (!trx?.registroId || trxStatus == null || trxStatus === 1) return;
    const k = `${trx.registroId}:${trxStatus}`;
    if (ultimoAvisado.current === k) return;
    ultimoAvisado.current = k;
    fetch(`${API_BASE_URL}/api/pedidos-venda/faturamentos/${trx.registroId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: trxStatus }),
    }).catch(() => {});
  }, [trx, trxStatus]);

  const escolherPedido = (k) => setParams(k ? { chave: k } : {});

  // ─── Render ──────────────────────────────────────────────────────────────
  const opAtual = OPERACOES_FATURAMENTO.find((o) => o.code === operacao);
  const st = TRX_STATUS[trxStatus] || { label: `status ${trxStatus}`, cls: 'bg-gray-100 text-gray-600 ring-gray-200' };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-6xl mx-auto">
        <PageTitle
          title="Faturamento"
          subtitle="Pedido separado no Dryland: confira as peças pelo portal RFID e gere a venda no TOTVS (empresa 99)"
          icon={Receipt}
        />

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/expedicao/pedidos-venda')}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 inline-flex items-center gap-1"
          >
            <ArrowLeft size={13} /> Pedido de Venda
          </button>
          {chave && (
            <button
              onClick={() => escolherPedido('')}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50"
            >
              Escolher outro pedido
            </button>
          )}
        </div>

        {!chave ? (
          <ListaSeparados onEscolher={escolherPedido} />
        ) : carregando ? (
          <div className="py-16 text-center text-gray-400">
            <Spinner size={22} className="animate-spin mx-auto" />
          </div>
        ) : erroPedido ? (
          <p className="text-sm text-rose-700 bg-rose-50 rounded-xl px-3 py-2 ring-1 ring-rose-200">{erroPedido}</p>
        ) : pedido ? (
          <>
            {/* Pedido */}
            <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#000638]">
              <span className="font-mono text-sm font-bold">{ref || '—'}</span>
              <span className="font-semibold">{card?.dados?.nome_cliente || pedido.separacao?.cliente || card?.titulo}</span>
              <span className="text-gray-500">{CANAIS[card?.canal] || pedido.separacao?.canal || ''}</span>
              <span className="text-gray-500">{card?.forma_pagamento || pedido.separacao?.pagamento || ''}</span>
              <span>
                <b>{conf.esperado}</b> peça(s) · <b>{fmtBRL(conf.totalPedido)}</b>
              </span>
              {card?.status && <span className="px-1.5 py-0.5 rounded-full bg-gray-100 ring-1 ring-gray-200 text-gray-600">{card.status}</span>}
            </div>

            {precisaConfirmar && !trx && (
              <div className="mb-2 rounded-xl bg-amber-50 ring-1 ring-amber-300 px-3 py-2 text-xs text-amber-800">
                <p className="font-semibold inline-flex items-center gap-1">
                  <Warning size={14} weight="bold" /> Atenção: este pedido já tem lançamento no TOTVS
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {jaNoTotvs.length > 0 && <li>O Dryland já abriu: {jaNoTotvs.join(', ')}.</li>}
                  {fatsVivos.map((f) => (
                    <li key={f.id}>
                      Faturado aqui em {fmtDataHora(f.criado_em)}: transação {f.transacao_code} ({TRX_STATUS[f.transacao_status]?.label || f.transacao_status}) · {f.qtd_conferida} pç · {fmtBRL(f.total)}
                    </li>
                  ))}
                </ul>
                <label className="mt-1.5 flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmaDuplicar}
                    onChange={(e) => setConfirmaDuplicar(e.target.checked)}
                    className="mb-0 !w-4 !h-4 shrink-0 accent-amber-600"
                  />
                  Conferi e quero gerar outra transação mesmo assim
                </label>
              </div>
            )}

            {/* Cabeçalho da transação */}
            <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-start">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Empresa</label>
                <div className="h-9 px-2.5 rounded-lg bg-gray-50 ring-1 ring-gray-200 inline-flex items-center gap-1.5 text-sm font-semibold text-[#000638] w-full">
                  <Buildings size={15} className="text-gray-400" /> {EMPRESA}
                  {ufEmpresa && <span className="text-xs font-normal text-gray-500">· {ufEmpresa}</span>}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Vendedor</label>
                <div className="relative">
                  <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    className={`w-full h-9 pl-8 pr-2 mb-0 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 ${seller ? 'border-gray-300' : 'border-amber-400'}`}
                  >
                    <option value="">Selecione…</option>
                    {seller && !sellers.some((s) => String(s.code) === seller) && <option value={seller}>{seller} — vendedor do pedido</option>}
                    {sellers.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ClientePicker value={customer} onSelect={setCustomer} />

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Operação</label>
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <Gear size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      value={operacao}
                      onChange={(e) => setOperacao(e.target.value)}
                      className={`w-full h-9 pl-8 pr-2 mb-0 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 ${operacao ? 'border-gray-300' : 'border-amber-400'}`}
                    >
                      <option value="">Selecione a operação…</option>
                      {OPERACOES_FATURAMENTO.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.code} - {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="h-9 w-[4.2rem] rounded-lg border border-gray-300 bg-gray-50 text-sm text-center leading-9 font-semibold text-[#000638]"
                    title={ufEmpresa && ufCliente ? `Empresa ${ufEmpresa} · cliente ${ufCliente}` : 'CFOP pela UF da empresa e do cliente'}
                  >
                    {cfop}
                  </div>
                </div>
                {customer && !ufCliente && <p className="mt-1 text-[10px] text-amber-700">UF do cliente não encontrada — usando CFOP {cfop}.</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-2 items-start">
              {/* Conferência */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-bold text-[#000638] inline-flex items-center gap-1">
                    <Package size={14} /> Produtos do pedido
                  </span>
                  <span className="text-emerald-700">
                    <b>{conf.conferidas}</b> de {conf.esperado} conferidas
                  </span>
                  {conf.faltando > 0 && (
                    <span className="text-amber-700">
                      <b>{conf.faltando}</b> faltando
                    </span>
                  )}
                  {conf.sobrando > 0 && (
                    <span className="text-rose-700">
                      <b>{conf.sobrando}</b> sobrando
                    </span>
                  )}
                  {conf.ok && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                      <CheckCircle size={14} weight="fill" /> tudo confere
                    </span>
                  )}
                </div>

                {conf.linhas.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-gray-400">Este pedido não tem itens no Dryland.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {conf.linhas.map((l) => {
                      const cor =
                        l.conferido === l.qtd && l.sobra === 0
                          ? 'border-l-emerald-500 bg-emerald-50/40'
                          : l.sobra > 0
                            ? 'border-l-rose-500 bg-rose-50/40'
                            : l.conferido > 0
                              ? 'border-l-amber-400 bg-amber-50/30'
                              : 'border-l-gray-200';
                      return (
                        <li key={l.sku} className={`px-3 py-2 border-l-4 ${cor}`}>
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{l.descricao || `SKU ${l.sku}`}</p>
                              <p className="text-[11px] text-gray-500">
                                SKU <b className="font-mono text-[#000638]">{l.sku}</b>
                                {l.cor ? ` · ${l.cor}` : ''}
                                {l.tam ? ` · ${l.tam}` : ''} · {fmtBRL(l.preco)}
                                {!(l.preco > 0) && <span className="text-rose-600 font-semibold"> sem preço</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold tabular-nums text-[#000638]">
                                {l.lido}
                                <span className="text-gray-400 font-normal">/{l.qtd}</span>
                              </p>
                              <p className="text-[10px] font-semibold">
                                {l.conferido === l.qtd && l.sobra === 0 ? (
                                  <span className="text-emerald-700">ok</span>
                                ) : l.sobra > 0 ? (
                                  <span className="text-rose-700">+{l.sobra} a mais</span>
                                ) : (
                                  <span className="text-amber-700">falta {l.falta}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          {(l.epcs.length > 0 || l.manual > 0) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {l.epcs.map((epc) => (
                                <span key={epc} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 font-mono text-[10px]">
                                  <Tag size={9} /> {epc}
                                  <button onClick={() => removerEpc(l.sku, epc)} className="text-purple-300 hover:text-rose-600" title="Tirar esta etiqueta">
                                    <X size={9} weight="bold" />
                                  </button>
                                </span>
                              ))}
                              {l.manual > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 text-[10px]">
                                  <Barcode size={10} /> {l.manual} digitada(s)
                                  <button onClick={() => tirarManual(l.sku)} className="text-blue-300 hover:text-rose-600" title="Tirar uma">
                                    <Minus size={9} weight="bold" />
                                  </button>
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
                  <div className="border-t border-rose-200 bg-rose-50/60">
                    <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                      Lidas que NÃO estão no pedido ({conf.fora.reduce((s, l) => s + l.lido, 0)}) — não entram na transação
                    </p>
                    <ul className="divide-y divide-rose-100">
                      {conf.fora.map((l) => (
                        <li key={l.sku} className="px-3 py-1.5 text-xs">
                          <p className="font-semibold text-rose-800">
                            {l.nome} <span className="font-mono font-normal">· SKU {l.sku}</span> · {l.lido} pç
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {l.epcs.map((epc) => (
                              <span key={epc} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white text-rose-700 ring-1 ring-rose-200 font-mono text-[10px]">
                                <Tag size={9} /> {epc}
                                <button onClick={() => removerEpc(l.sku, epc)} className="text-rose-300 hover:text-rose-600">
                                  <X size={9} weight="bold" />
                                </button>
                              </span>
                            ))}
                            {l.manual > 0 && (
                              <button onClick={() => tirarManual(l.sku)} className="px-1.5 py-0.5 rounded-full bg-white ring-1 ring-rose-200 text-[10px] text-rose-700">
                                {l.manual} digitada(s) · tirar uma
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {naoResolvidos.length > 0 && (
                  <div className="border-t border-gray-200 px-3 py-2 text-[11px] text-gray-500">
                    <b>{naoResolvidos.length}</b> etiqueta(s) que o TOTVS não reconheceu:{' '}
                    <span className="font-mono">{naoResolvidos.slice(0, 6).join(', ')}{naoResolvidos.length > 6 ? '…' : ''}</span>
                  </div>
                )}
              </div>

              {/* Coluna de ações */}
              <div className="space-y-2 lg:sticky lg:top-2">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5 inline-flex items-center gap-1">
                    <Broadcast size={13} /> Portal RFID
                  </p>
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <span className={`w-2.5 h-2.5 rounded-full ${portalStatus.status === 'lendo' ? 'bg-emerald-500 animate-pulse' : portalLigado ? 'bg-amber-400' : 'bg-gray-300'}`} />
                    <span className="font-medium text-gray-700">{portalStatus.status || 'desconectado'}</span>
                    {portalStatus.erro && <span className="text-rose-600 truncate" title={portalStatus.erro}>{portalStatus.erro}</span>}
                  </div>
                  {portalLigado ? (
                    <button
                      onClick={desligarPortal}
                      disabled={portalBusy}
                      className="w-full h-10 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {portalBusy ? <Spinner size={16} className="animate-spin" /> : <Plugs size={16} weight="bold" />} DESLIGAR PORTAL
                    </button>
                  ) : (
                    <button
                      onClick={ligarPortal}
                      disabled={portalBusy}
                      className="w-full h-10 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {portalBusy ? <Spinner size={16} className="animate-spin" /> : <PlugsConnected size={16} weight="bold" />} LIGAR PORTAL
                    </button>
                  )}
                  <button
                    onClick={limparLeituras}
                    className="mt-1.5 w-full h-8 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <Trash size={13} /> Limpar leituras
                  </button>

                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Peça sem etiqueta (código / barras)</label>
                    <div className="flex gap-1">
                      <input
                        value={codigoManual}
                        onChange={(e) => setCodigoManual(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && adicionarManual()}
                        placeholder="SKU ou código de barras"
                        className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-gray-300 text-sm mb-0"
                      />
                      <button
                        onClick={adicionarManual}
                        disabled={manualBusy || !codigoManual.trim()}
                        className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#000638] disabled:opacity-40"
                      >
                        {manualBusy ? <Spinner size={13} className="animate-spin" /> : '+1'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Peças do pedido</span>
                    <span className="tabular-nums">{conf.esperado}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Conferidas</span>
                    <span className="tabular-nums font-semibold">{conf.conferidas}</span>
                  </div>
                  {conf.faltando > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Faltando (não entram)</span>
                      <span className="tabular-nums">{conf.faltando}</span>
                    </div>
                  )}
                  {conf.sobrando > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Sobrando (não entram)</span>
                      <span className="tabular-nums">{conf.sobrando}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor do pedido</span>
                    <span className="tabular-nums">{fmtBRL(conf.totalPedido)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-gray-100">
                    <span className="font-semibold text-[#000638]">Total da transação</span>
                    <span className="text-xl font-bold text-[#000638] tabular-nums">{fmtBRL(conf.totalConferido)}</span>
                  </div>

                  {trx ? (
                    <div className="mt-2 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-2 space-y-1">
                      <p className="font-bold text-emerald-800 inline-flex items-center gap-1">
                        <CheckCircle size={14} weight="fill" /> Transação {trx.transactionCode} gerada
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Empresa {trx.branchCode} · {fmtBRL(trx.total)} · operação {operacao}
                        {opAtual ? ` (${opAtual.label})` : ''}
                      </p>
                      <span className={`inline-block px-1.5 py-0.5 rounded-full ring-1 font-semibold ${st.cls}`}>{st.label}</span>
                      {trxStatus === 1 && <p className="text-[11px] text-gray-600">Finalize no TOTVS (TRAFP005 → Continuar Transação → Encerrar). A tela confere a cada 10 s.</p>}
                      <button
                        onClick={() => escolherPedido('')}
                        className="mt-1 w-full h-8 rounded-lg text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90"
                      >
                        Faturar outro pedido
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={gerarTransacao}
                        disabled={!podeGerar}
                        className="mt-2 w-full h-11 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center justify-center gap-2"
                      >
                        {posting ? <Spinner size={16} className="animate-spin" /> : <Receipt size={16} weight="bold" />}
                        GERAR TRANSAÇÃO ({conf.conferidas} pç)
                      </button>
                      {!podeGerar && !posting && (
                        <p className="text-[10px] text-amber-700">
                          {!customer
                            ? 'Escolha o cliente.'
                            : !seller
                              ? 'Escolha o vendedor.'
                              : !operacao
                                ? 'Escolha a operação.'
                                : conf.conferidas === 0
                                  ? 'Ligue o portal e passe as peças do pedido.'
                                  : semPreco
                                    ? 'Há peça conferida sem preço.'
                                    : precisaConfirmar && !confirmaDuplicar
                                      ? 'Confirme o aviso de lançamento no TOTVS acima.'
                                      : ''}
                        </p>
                      )}
                      {conf.conferidas > 0 && !conf.ok && (
                        <p className="text-[10px] text-gray-500">Só as peças conferidas entram; o que falta ou sobra fica registrado.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] px-4 py-2 rounded-xl shadow-lg text-sm font-medium inline-flex items-center gap-2 ${
            toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle size={16} weight="fill" /> : <Warning size={16} weight="fill" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default FaturamentoPedido;
