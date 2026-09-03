// Página: Tecnologia → Orçamento RFID (pré-venda)
// Monta orçamentos lendo as peças pelo PORTAL RFID (1 etiqueta = 1 peça) ou
// por código manual (SKU/EAN — peças sem tag). Preço vem FIXO da tabela do
// cliente (só o desconto altersa o valor). Itens agrupados por grade (grupo de
// produto) na tela e no PDF. Orçamentos ficam SALVOS POR USUÁRIO (localStorage
// por login): vários em andamento ao mesmo tempo, retomáveis a qualquer hora.
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Broadcast,
  Plugs,
  PlugsConnected,
  Trash,
  Spinner,
  ArrowsClockwise,
  User,
  Buildings,
  X,
  MagnifyingGlass,
  FilePdf,
  WhatsappLogo,
  CheckCircle,
  Warning,
  Tag,
  Percent,
  Barcode,
  Plus,
  Minus,
  ClockCounterClockwise,
  QrCode,
  CreditCard,
  Money,
  Receipt,
  Copy,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const fmtData = (ts) =>
  new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const qtyOf = (i) => i.epcs.length + (i.manualQty || 0);

// ─── Fechar Pré-Venda ────────────────────────────────────────────────────────
// Operação/CFOP e condição de pagamento TOTVS por forma de pagamento.
// AJUSTÁVEL: confirme os códigos de condição com o financeiro.
const PREVENDA_CONFIG = {
  operationCode: 545, // VENDA
  cfop: 5102,
  condicaoPorMetodo: { pix: 36, cartao: 3, dinheiro: 1, boleto: 2 },
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

// ─── Busca de cliente com dropdown ──────────────────────────────────────────
function ClientePicker({ value, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const onClickOut = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOut);
    return () => document.removeEventListener('mousedown', onClickOut);
  }, []);

  const search = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const digits = q.replace(/\D/g, '');
        let param;
        if (digits.length >= 11 && digits.length === q.trim().length)
          param = `cnpj=${digits}`;
        else if (/^\d+$/.test(q.trim())) param = `code=${q.trim()}`;
        else param = `nome=${encodeURIComponent(q)}`;
        const r = await fetch(
          `${API_BASE_URL}/api/totvs/clientes/search-name?${param}`,
        );
        const j = await r.json();
        setResults(j?.data?.clientes || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        Cliente
      </label>
      {value ? (
        <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-lg bg-blue-50 ring-1 ring-blue-200">
          <span className="truncate text-sm font-medium text-[#000638]">
            {value.code} — {value.name}
          </span>
          <button
            onClick={() => {
              onSelect(null);
              setQuery('');
            }}
            className="text-gray-400 hover:text-rose-500 shrink-0"
            title="Trocar cliente"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <MagnifyingGlass
            size={15}
            className="absolute left-2.5 top-1/3 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Nome, código ou CPF/CNPJ…"
            className="w-full h-9 pl-8 pr-8 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
          />
          {loading && (
            <Spinner
              size={15}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
            />
          )}
        </div>
      )}
      {open && !value && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-lg">
          {results.map((p) => (
            <li key={`${p.code}-${p.cpf}`}>
              <button
                onClick={() => {
                  onSelect({ code: p.code, name: p.nm_pessoa });
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
              >
                <span className="font-medium text-[#000638]">{p.code}</span> —{' '}
                {p.nm_pessoa}
                {p.cpf && (
                  <span className="block text-[11px] text-gray-400">
                    {p.cpf}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
const OrcamentoRFID = () => {
  const { user } = useAuth();
  const userKey = user?.email || user?.user_metadata?.login || 'anon';
  const storageKey = `orc_rfid_drafts_${userKey}`;

  // Configuração
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(
    () => localStorage.getItem('orc_rfid_branch') || '',
  );
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState(
    () => localStorage.getItem('orc_rfid_seller') || '',
  );
  const [customer, setCustomer] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [phone, setPhone] = useState('');

  // Portal
  const [portalStatus, setPortalStatus] = useState({ status: 'desconectado' });
  const [portalBusy, setPortalBusy] = useState(false);

  // Itens: { productCode, name, sku, unit, discount, fonte,
  //          referenceCode, referenceName, epcs: [], manualQty }
  const [items, setItems] = useState([]);
  const processedEpcs = useRef(new Set());
  const branchRef = useRef(branch);
  branchRef.current = branch;
  const priceTableRef = useRef(null);
  priceTableRef.current = customerInfo?.priceTableCode ?? null;

  // Orçamentos salvos (por usuário)
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState(null);

  const [globalDiscount, setGlobalDiscount] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [sending, setSending] = useState(false);

  // Fechar Pré-Venda
  const [fecharOpen, setFecharOpen] = useState(false);
  const [fecharMethod, setFecharMethod] = useState(null); // pix|cartao|dinheiro|boleto
  const [fecharBusy, setFecharBusy] = useState(false);
  const [fecharError, setFecharError] = useState('');
  const [fecharResult, setFecharResult] = useState(null); // { transaction, paymentLink, paymentMethod }
  const [payStatus, setPayStatus] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  // Opções do cartão — a parcela escolhida é SEMPRE travada (obrigatória)
  const [cardType, setCardType] = useState('credito'); // credito | debito
  const [cardInstallments, setCardInstallments] = useState(1);

  useEffect(() => localStorage.setItem('orc_rfid_branch', branch), [branch]);
  useEffect(() => localStorage.setItem('orc_rfid_seller', seller), [seller]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Orçamentos salvos: carregar/persistir ───────────────────────────────
  useEffect(() => {
    try {
      setDrafts(JSON.parse(localStorage.getItem(storageKey)) || []);
    } catch {
      setDrafts([]);
    }
  }, [storageKey]);

  const persistDrafts = useCallback(
    (list) => {
      setDrafts(list);
      try {
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {
        /* storage cheio */
      }
    },
    [storageKey],
  );

  const totals = useMemo(() => {
    const qty = items.reduce((s, i) => s + qtyOf(i), 0);
    const subtotal = items.reduce((s, i) => s + qtyOf(i) * i.unit, 0);
    const discounts = items.reduce(
      (s, i) => s + qtyOf(i) * (i.discount || 0),
      0,
    );
    return { qty, subtotal, discounts, total: subtotal - discounts };
  }, [items]);

  // Auto-salva o orçamento atual sempre que muda (cria o ID na 1ª peça/cliente)
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;
  useEffect(() => {
    if (!customer && items.length === 0) return;
    let id = draftIdRef.current;
    if (!id) {
      id = `${Date.now()}`;
      setDraftId(id);
    }
    const draft = {
      id,
      updatedAt: Date.now(),
      branch,
      seller,
      customer,
      customerInfo,
      phone,
      items,
      total: totals.total,
      status: 'em andamento',
    };
    setDrafts((prev) => {
      const existing = prev.find((d) => d.id === id);
      const next = [
        {
          ...existing,
          ...draft,
          status: existing?.status === 'enviado' ? 'enviado' : 'em andamento',
        },
        ...prev.filter((d) => d.id !== id),
      ].slice(0, 30);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage cheio */
      }
      return next;
    });
  }, [
    items,
    customer,
    customerInfo,
    phone,
    branch,
    seller,
    totals.total,
    storageKey,
  ]);

  const novoOrcamento = useCallback(async () => {
    setItems([]);
    setCustomer(null);
    setCustomerInfo(null);
    setPhone('');
    setDraftId(null);
    processedEpcs.current = new Set();
    try {
      await fetch(`${API_BASE_URL}/api/portal-rfid/clear`, { method: 'POST' });
    } catch {
      /* segue */
    }
  }, []);

  const abrirOrcamento = useCallback(async (d) => {
    setDraftId(d.id);
    setBranch(d.branch || '');
    setSeller(d.seller || '');
    setCustomer(d.customer || null);
    setCustomerInfo(d.customerInfo || null);
    setPhone(d.phone || '');
    setItems(d.items || []);
    // EPCs do orçamento retomado não devem re-entrar pela leitura do portal
    processedEpcs.current = new Set(
      (d.items || []).flatMap((i) => i.epcs || []),
    );
    try {
      await fetch(`${API_BASE_URL}/api/portal-rfid/clear`, {
        method: 'POST',
      });
    } catch {
      /* segue */
    }
  }, []);

  const excluirOrcamento = useCallback(
    (id) => {
      persistDrafts(drafts.filter((d) => d.id !== id));
      if (draftId === id) novoOrcamento();
    },
    [drafts, draftId, persistDrafts, novoOrcamento],
  );

  const marcarEnviado = useCallback(
    (id) => {
      persistDrafts(
        drafts.map((d) => (d.id === id ? { ...d, status: 'enviado' } : d)),
      );
    },
    [drafts, persistDrafts],
  );

  // ─── Cargas iniciais ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const b = await fetch(`${API_BASE_URL}/api/totvs/branches`).then((r) =>
          r.json(),
        );
        setBranches(b?.data?.data || []);
      } catch {
        showToast('erro', 'Falha ao carregar empresas');
      }
    })();
  }, [showToast]);

  useEffect(() => {
    if (!branch) {
      setSellers([]);
      return;
    }
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/sellers?branch=${branch}`,
        );
        const j = await r.json();
        const list = j?.data?.items || [];
        setSellers(list);
        setSeller((prev) =>
          list.some((s) => String(s.code) === String(prev)) ? prev : '',
        );
      } catch {
        setSellers([]);
      }
    })();
  }, [branch]);

  // Dados do cliente (tabela de preço + telefone)
  useEffect(() => {
    if (!customer) {
      setCustomerInfo(null);
      setPhone('');
      return;
    }
    if (customerInfo?.code === customer.code) return; // veio de orçamento salvo
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/customer/${customer.code}`,
        );
        const j = await r.json();
        if (j?.data) {
          setCustomerInfo(j.data);
          setPhone((p) => p || j.data.phone || '');
        }
      } catch {
        showToast('erro', 'Falha ao buscar dados do cliente');
      }
    })();
  }, [customer, customerInfo, showToast]);

  // ─── Portal ──────────────────────────────────────────────────────────────
  const portalLigado =
    portalStatus.status === 'lendo' ||
    portalStatus.status === 'conectando' ||
    portalStatus.status === 'reconectando';

  const ligarPortal = useCallback(async () => {
    if (!branchRef.current) {
      beep(false);
      showToast('erro', 'Selecione a empresa antes de ligar o portal');
      return;
    }
    setPortalBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/portal-rfid/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const j = await r.json();
      if (!r.ok || !j.success)
        showToast('erro', j?.message || 'Falha ao ligar');
      else setPortalStatus(j.data);
    } catch (e) {
      showToast('erro', `Backend indisponível: ${e.message}`);
    } finally {
      setPortalBusy(false);
    }
  }, [showToast]);

  const desligarPortal = useCallback(async () => {
    setPortalBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/portal-rfid/disconnect`, {
        method: 'POST',
      });
      const j = await r.json();
      if (j?.data) setPortalStatus(j.data);
    } catch {
      /* segue */
    } finally {
      setPortalBusy(false);
    }
  }, []);

  // Adiciona/mescla produto vindo de EPC (portal) ou de código manual.
  // Regra de preço do ORÇAMENTO: tabela do cliente quando houver; sem tabela,
  // o padrão é VENDA ATACADO (código 4) — varejo/shopping não entram aqui.
  const mergeProduto = useCallback((data, { epc = null, manual = 0 }) => {
    const { product, prices, tablePrice } = data;
    const padrao = (prices || []).find(
      (p) => p.promotionalPrice > 0 || p.price > 0,
    );
    const unit = tablePrice
      ? tablePrice.price
      : padrao?.promotionalPrice > 0
        ? padrao.promotionalPrice
        : padrao?.price || 0;
    const fonte = tablePrice ? 'tabela' : unit > 0 ? 'atacado' : 'sem-preco';

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productCode === product.productCode);
      if (idx >= 0) {
        const next = [...prev];
        const cur = next[idx];
        next[idx] = {
          ...cur,
          epcs: epc && !cur.epcs.includes(epc) ? [...cur.epcs, epc] : cur.epcs,
          manualQty: (cur.manualQty || 0) + manual,
        };
        return next;
      }
      return [
        ...prev,
        {
          productCode: product.productCode,
          name: product.productName,
          sku: product.productSku,
          referenceCode: product.referenceCode || null,
          referenceName: product.referenceName || null,
          unit,
          discount: 0,
          fonte,
          epcs: epc ? [epc] : [],
          manualQty: manual,
        },
      ];
    });
    beep(true);
  }, []);

  const resolverEpc = useCallback(
    async (epc) => {
      const br = branchRef.current;
      if (!br) return;
      try {
        const pt = priceTableRef.current;
        // priceCodes=4 → fallback (sem tabela) é o VENDA ATACADO
        const qs = `?branch=${br}&priceCodes=4${pt ? `&priceTable=${pt}` : ''}`;
        const r = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(epc)}${qs}`,
        );
        const j = await r.json();
        if (!r.ok || !j?.data?.product) return;
        mergeProduto(j.data, { epc });
      } catch {
        /* tenta na próxima varredura */
      }
    },
    [mergeProduto],
  );

  // Adição manual por SKU / código de barras / código interno
  const adicionarManual = useCallback(async () => {
    const code = manualCode.trim();
    if (!code || manualBusy) return;
    if (!branchRef.current) {
      beep(false);
      showToast('erro', 'Selecione a empresa antes');
      return;
    }
    setManualBusy(true);
    try {
      const pt = priceTableRef.current;
      // priceCodes=4 → fallback (sem tabela) é o VENDA ATACADO
      const qs = `?branch=${branchRef.current}&priceCodes=4${pt ? `&priceTable=${pt}` : ''}`;
      const r = await fetch(
        `${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}${qs}`,
      );
      const j = await r.json();
      if (!r.ok || !j?.data?.product) {
        beep(false);
        showToast('erro', j?.message || `Código ${code} não encontrado`);
        return;
      }
      mergeProduto(j.data, { manual: 1 });
      setManualCode('');
    } catch (e) {
      beep(false);
      showToast('erro', `Erro na consulta: ${e.message}`);
    } finally {
      setManualBusy(false);
    }
  }, [manualCode, manualBusy, mergeProduto, showToast]);

  // Polling do portal
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/portal-rfid/tags`);
        const j = await r.json();
        if (!j?.data) return;
        setPortalStatus(j.data.status);
        for (const t of j.data.tags || []) {
          if (!processedEpcs.current.has(t.epc)) {
            processedEpcs.current.add(t.epc);
            resolverEpc(t.epc);
          }
        }
      } catch {
        /* backend fora */
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [resolverEpc]);

  // ─── Itens ───────────────────────────────────────────────────────────────
  const updateItem = useCallback((productCode, patch) => {
    setItems((prev) =>
      prev.map((i) => (i.productCode === productCode ? { ...i, ...patch } : i)),
    );
  }, []);

  const ajustarManualQty = useCallback((productCode, delta) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.productCode === productCode
            ? { ...i, manualQty: Math.max(0, (i.manualQty || 0) + delta) }
            : i,
        )
        .filter((i) => qtyOf(i) > 0),
    );
  }, []);

  const removeItem = useCallback((productCode) => {
    setItems((prev) => prev.filter((i) => i.productCode !== productCode));
  }, []);

  // Desconto máximo permitido no orçamento: 15%
  const MAX_DESCONTO_PCT = 15;

  const aplicarDescontoGeral = useCallback(() => {
    const pct = parseFloat(String(globalDiscount).replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > MAX_DESCONTO_PCT) {
      showToast('erro', `Desconto geral inválido (0 a ${MAX_DESCONTO_PCT}%)`);
      return;
    }
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        discount: Number(((i.unit * pct) / 100).toFixed(2)),
      })),
    );
  }, [globalDiscount, showToast]);

  // Agrupamento por grade (grupo de produto)
  const grupos = useMemo(() => {
    const map = new Map();
    for (const i of items) {
      const key = i.referenceName || 'OUTROS';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }
    return [...map.entries()]
      .map(([nome, its]) => ({
        nome,
        items: its,
        qty: its.reduce((s, i) => s + qtyOf(i), 0),
        total: its.reduce(
          (s, i) => s + qtyOf(i) * (i.unit - (i.discount || 0)),
          0,
        ),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items]);

  // ─── PDF (agrupado por grade) ────────────────────────────────────────────
  const gerarPdf = useCallback(() => {
    const doc = new jsPDF();
    const hoje = new Date().toLocaleDateString('pt-BR');
    const empresaNome =
      branches.find((b) => String(b.cd_empresa) === String(branch))
        ?.nm_grupoempresa || branch;
    const vendedorNome =
      sellers.find((s) => String(s.code) === String(seller))?.name || '—';

    doc.setFontSize(18);
    doc.setTextColor(0, 6, 56);
    doc.text('ORÇAMENTO', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Crosby — ${empresaNome}`, 14, 25);
    doc.text(
      `Data: ${hoje}  ·  Nº ${draftId ? draftId.slice(-6) : '—'}`,
      14,
      30,
    );
    doc.setTextColor(20);
    doc.text(
      `Cliente: ${customer?.code || ''} — ${customer?.name || ''}`,
      14,
      38,
    );
    doc.text(`Vendedor: ${vendedorNome}`, 14, 43);
    if (customerInfo?.priceTableCode) {
      doc.text(
        `Tabela de preço: ${customerInfo.priceTableCode}${customerInfo.priceTableDescription ? ` — ${customerInfo.priceTableDescription}` : ''}`,
        14,
        48,
      );
    }

    let y = 54;
    for (const g of grupos) {
      autoTable(doc, {
        startY: y,
        head: [
          [
            {
              content: `${g.nome}  (${g.qty} pç · ${fmtBRL(g.total)})`,
              colSpan: 5,
              styles: {
                fillColor: [235, 238, 245],
                textColor: [0, 6, 56],
                fontStyle: 'bold',
              },
            },
          ],
          ['Produto', 'Qtd', 'Vl. unit.', 'Desc. unit.', 'Total'],
        ],
        body: g.items.map((i) => [
          i.name,
          qtyOf(i),
          fmtBRL(i.unit),
          fmtBRL(i.discount || 0),
          fmtBRL(qtyOf(i) * (i.unit - (i.discount || 0))),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 6, 56] },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    y += 4;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(`Peças: ${totals.qty}`, 140, y);
    doc.text(`Subtotal: ${fmtBRL(totals.subtotal)}`, 140, y + 5);
    doc.text(`Descontos: ${fmtBRL(totals.discounts)}`, 140, y + 10);
    doc.setFontSize(13);
    doc.setTextColor(0, 6, 56);
    doc.text(`TOTAL: ${fmtBRL(totals.total)}`, 140, y + 18);
    return doc;
  }, [
    branches,
    branch,
    sellers,
    seller,
    customer,
    customerInfo,
    grupos,
    totals,
    draftId,
  ]);

  const baixarPdf = useCallback(() => {
    if (items.length === 0) return;
    const doc = gerarPdf();
    doc.save(
      `orcamento-${customer?.code || 'cliente'}-${draftId ? draftId.slice(-6) : ''}.pdf`,
    );
  }, [items, gerarPdf, customer, draftId]);

  const enviarWhatsapp = useCallback(() => {
    if (items.length === 0 || sending) return;
    let tel = phone.replace(/\D/g, '');
    if (tel.length < 10) {
      showToast('erro', 'Informe o WhatsApp do cliente (DDD + número)');
      return;
    }
    if (!tel.startsWith('55')) tel = `55${tel}`;
    setSending(true);
    try {
      const doc = gerarPdf();
      doc.save(`orcamento-${customer?.code || 'cliente'}.pdf`);

      const primeiroNome = customer?.name
        ? `, ${customer.name.split(' ')[0]}`
        : '';
      const msg = [
        `Olá${primeiroNome}! Segue seu orçamento Crosby 👇`,
        '',
        `*Total: ${fmtBRL(totals.total)}*`,
        totals.discounts > 0
          ? `Desconto aplicado: ${fmtBRL(totals.discounts)}`
          : null,
        '',
        'O orçamento detalhado está no PDF abaixo. 📄',
      ]
        .filter((l) => l !== null)
        .join('\n');

      window.open(
        `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`,
        '_blank',
      );
      if (draftId) marcarEnviado(draftId);
      beep(true);
      showToast(
        'ok',
        'WhatsApp aberto com o orçamento — o PDF foi baixado para anexar!',
      );
    } catch (e) {
      showToast('erro', `Falha ao preparar envio: ${e.message}`);
    } finally {
      setSending(false);
    }
  }, [
    items,
    sending,
    phone,
    gerarPdf,
    customer,
    totals,
    draftId,
    marcarEnviado,
    showToast,
  ]);

  // ─── Fechar Pré-Venda ────────────────────────────────────────────────────
  const abrirFechar = useCallback(() => {
    setFecharMethod(null);
    setFecharError('');
    setFecharResult(null);
    setPayStatus(null);
    setFecharOpen(true);
  }, []);

  const fecharPreVenda = useCallback(async () => {
    if (!fecharMethod || fecharBusy) return;
    setFecharBusy(true);
    setFecharError('');
    try {
      const payload = {
        branchCode: parseInt(branch, 10),
        customerCode: customer.code,
        customerName: customer.name,
        sellerCode: parseInt(seller, 10),
        total: Number(totals.total.toFixed(2)),
        paymentMethod: fecharMethod,
        ...(fecharMethod === 'cartao'
          ? {
              cardType,
              installments: cardInstallments,
              // Trava sempre: o cliente paga exatamente na parcela escolhida
              lockInstallments: true,
            }
          : {}),
        operationCode: PREVENDA_CONFIG.operationCode,
        paymentConditionCode:
          PREVENDA_CONFIG.condicaoPorMetodo[fecharMethod],
        cfop: PREVENDA_CONFIG.cfop,
        orcamentoId: draftId,
        items: items.map((i) => ({
          productCode: i.productCode,
          quantity: qtyOf(i),
          value: i.unit,
          ...(i.discount > 0 ? { discountValue: i.discount } : {}),
        })),
      };
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/prevenda/fechar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setFecharError(
          j?.error === 'SEM_LIMITE_BOLETO'
            ? `⚠️ ${j.message}`
            : j?.message || 'Falha ao fechar a pré-venda',
        );
        return;
      }
      setFecharResult({ ...j.data });
      // Marca o orçamento como fechado, guardando a transação
      if (draftId) {
        persistDrafts(
          drafts.map((d) =>
            d.id === draftId
              ? {
                  ...d,
                  status: 'fechada',
                  transactionCode: j.data.transaction?.transactionCode,
                }
              : d,
          ),
        );
      }
      beep(true);
    } catch (e) {
      setFecharError(`Falha na chamada: ${e.message}`);
    } finally {
      setFecharBusy(false);
    }
  }, [
    fecharMethod,
    fecharBusy,
    branch,
    customer,
    seller,
    totals,
    draftId,
    items,
    drafts,
    persistDrafts,
    cardType,
    cardInstallments,
  ]);

  const verificarPagamento = useCallback(async () => {
    const linkId = fecharResult?.paymentLink?.id;
    if (!linkId || payBusy) return;
    setPayBusy(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/totvs/pdv/prevenda/pagamento/${linkId}`,
      );
      const j = await r.json();
      if (j?.data) setPayStatus(j.data);
    } catch {
      /* tenta de novo */
    } finally {
      setPayBusy(false);
    }
  }, [fecharResult, payBusy]);

  const copiarLink = useCallback(async () => {
    const url = fecharResult?.paymentLink?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  }, [fecharResult]);

  const enviarLinkWhatsapp = useCallback(() => {
    const url = fecharResult?.paymentLink?.url;
    if (!url) return;
    let tel = phone.replace(/\D/g, '');
    if (tel.length < 10) {
      showToast('erro', 'Informe o WhatsApp do cliente');
      return;
    }
    if (!tel.startsWith('55')) tel = `55${tel}`;
    const primeiroNome = customer?.name ? `, ${customer.name.split(' ')[0]}` : '';
    const msg = `Olá${primeiroNome}! Segue o link de pagamento do seu pedido Crosby (${fmtBRL(totals.total)}):\n\n${url}`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  }, [fecharResult, phone, customer, totals, showToast]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-6xl mx-auto">
        {/* 1 — Título padrão HeadCoach */}
        <PageTitle
          title="Orçamento RFID"
          subtitle="Ligue o portal, passe as peças e envie o orçamento ao cliente"
          icon={Tag}
        />

        {/* 2 — Orçamentos em andamento */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <ClockCounterClockwise size={15} className="text-[#000638]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Orçamentos em andamento
            </h2>
            <div className="flex-1" />
            <button
              onClick={novoOrcamento}
              className="inline-flex items-center gap-1 px-3 h-7 rounded-lg text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
            >
              <Plus size={12} weight="bold" /> Novo orçamento
            </button>
          </div>
          {drafts.length === 0 ? (
            <p className="text-xs text-gray-400">
              Nenhum ainda — são salvos automaticamente enquanto você monta.
            </p>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className={`shrink-0 inline-flex items-center gap-1.5 pl-2.5 pr-1.5 h-8 rounded-lg ring-1 text-xs cursor-pointer transition-colors ${
                    d.id === draftId
                      ? 'bg-blue-50 ring-blue-300 text-[#000638]'
                      : 'bg-gray-50 ring-gray-200 text-gray-600 hover:bg-blue-50/60'
                  }`}
                  onClick={() => abrirOrcamento(d)}
                  title={`${fmtData(d.updatedAt)} · ${(d.items || []).reduce((s, i) => s + qtyOf(i), 0)} peças`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      d.status === 'fechada'
                        ? 'bg-blue-500'
                        : d.status === 'enviado'
                          ? 'bg-emerald-500'
                          : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-semibold">#{d.id.slice(-6)}</span>
                  <span className="max-w-[110px] truncate">
                    {d.customer ? d.customer.name.split(' ')[0] : 'sem cliente'}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmtBRL(d.total)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      excluirOrcamento(d.id);
                    }}
                    className="ml-0.5 text-gray-300 hover:text-rose-500"
                    title="Excluir"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3 — Filtros: empresa, vendedor, cliente, telefone, tabela */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-2 lg:grid-cols-5 gap-2 items-start">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Empresa
            </label>
            <div className="relative">
              <Buildings
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full h-9 pl-8 pr-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
              >
                <option value="">Selecione…</option>
                {branches.map((b) => (
                  <option key={b.cd_empresa} value={b.cd_empresa}>
                    {b.cd_empresa} — {b.nm_grupoempresa}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Vendedor
            </label>
            <div className="relative">
              <User
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                disabled={!branch}
                className="w-full h-9 pl-8 pr-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {branch ? 'Selecione…' : 'Escolha a empresa antes'}
                </option>
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
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              WhatsApp
            </label>
            <div className="relative">
              <WhatsappLogo
                size={15}
                className="absolute left-2.5 top-1/3 -translate-y-1/2 text-emerald-600"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="DDD + número"
                disabled={!customer}
                className="w-full h-9 pl-8 pr-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Tabela de preço
            </label>
            <div
              className={`h-9 px-2.5 rounded-lg ring-1 inline-flex items-center gap-1.5 text-xs font-medium w-full truncate ${
                !customer
                  ? 'bg-gray-50 ring-gray-200 text-gray-400'
                  : !customerInfo
                    ? 'bg-gray-50 ring-gray-200 text-gray-500'
                    : customerInfo.priceTableCode
                      ? 'bg-emerald-50 ring-emerald-200 text-emerald-700'
                      : 'bg-blue-50 ring-blue-200 text-blue-700'
              }`}
              title={
                customerInfo?.priceTableDescription ||
                (customerInfo && !customerInfo.priceTableCode
                  ? 'Sem tabela — usando preço ATACADO'
                  : '')
              }
            >
              {!customer ? (
                '—'
              ) : !customerInfo ? (
                <>
                  <Spinner size={13} className="animate-spin" /> Buscando…
                </>
              ) : customerInfo.priceTableCode ? (
                <>
                  <Tag size={13} />
                  <span className="truncate">
                    {customerInfo.priceTableCode} —{' '}
                    {customerInfo.priceTableDescription || 'tabela do cliente'}
                  </span>
                </>
              ) : (
                <>
                  <Tag size={13} /> Sem tabela · ATACADO
                </>
              )}
            </div>
          </div>
        </div>

        {/* 4/5/6 — produtos + coluna de ações/envio */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-2 items-start">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="max-h-[52vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 bg-gray-50">Produto</th>
                    <th className="px-2 py-2 w-24 text-center bg-gray-50">
                      Qtd
                    </th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">
                      Vl. unit.
                    </th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">
                      Desc. unit.
                    </th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">
                      Total
                    </th>
                    <th className="px-2 py-2 w-8 bg-gray-50" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <Broadcast
                          size={28}
                          className="mx-auto mb-1.5 text-gray-300"
                        />
                        <p className="text-gray-400 text-xs">
                          {portalLigado
                            ? 'Portal lendo — passe as peças pelo portal.'
                            : 'Ligue o portal ou adicione por código.'}
                        </p>
                      </td>
                    </tr>
                  )}
                  {grupos.map((g) => (
                    <React.Fragment key={g.nome}>
                      <tr className="bg-gray-100/80">
                        <td
                          colSpan={4}
                          className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#000638]"
                        >
                          {g.nome}
                        </td>
                        <td className="px-2 py-1 text-right text-[10px] font-bold text-[#000638] whitespace-nowrap">
                          {g.qty} pç · {fmtBRL(g.total)}
                        </td>
                        <td />
                      </tr>
                      {g.items.map((i) => (
                        <tr key={i.productCode} className="hover:bg-gray-50/60">
                          <td className="px-3 py-1.5">
                            <p className="font-medium text-[#000638] leading-tight text-[13px]">
                              {i.name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              cód. {i.productCode}
                              {i.sku ? ` · EAN ${i.sku}` : ''}
                              {i.fonte === 'tabela' ? (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                                  tabela do cliente
                                </span>
                              ) : i.fonte === 'sem-preco' ? (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                                  sem preço atacado
                                </span>
                              ) : (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                                  preço atacado
                                </span>
                              )}
                              {i.manualQty > 0 && (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                                  {i.manualQty} manual
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className="inline-flex items-center gap-1">
                              {i.manualQty > 0 && (
                                <button
                                  onClick={() =>
                                    ajustarManualQty(i.productCode, -1)
                                  }
                                  className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                                  title="Diminuir (manual)"
                                >
                                  <Minus size={10} weight="bold" />
                                </button>
                              )}
                              <span className="font-bold text-[#000638] tabular-nums min-w-[1.25rem] text-[13px]">
                                {qtyOf(i)}
                              </span>
                              <button
                                onClick={() =>
                                  ajustarManualQty(i.productCode, 1)
                                }
                                className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                                title="Adicionar 1 (manual)"
                              >
                                <Plus size={10} weight="bold" />
                              </button>
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-gray-700 tabular-nums text-[13px]">
                            {fmtBRL(i.unit)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              max={Number((i.unit * 0.15).toFixed(2))}
                              step="0.01"
                              value={i.discount}
                              title={`Máx. 15%: ${fmtBRL(i.unit * 0.15)}`}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                // Trava: desconto por peça limitado a 15% do preço
                                updateItem(i.productCode, {
                                  discount: Math.min(
                                    Math.max(v, 0),
                                    Number((i.unit * 0.15).toFixed(2)),
                                  ),
                                });
                              }}
                              className="w-20 h-7 rounded-md border border-gray-200 text-right text-[13px] px-1.5 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#000638] text-[13px]">
                            {fmtBRL(qtyOf(i) * (i.unit - (i.discount || 0)))}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => removeItem(i.productCode)}
                              className="text-gray-300 hover:text-rose-500 transition-colors"
                              title="Remover"
                            >
                              <Trash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coluna direita: 5 — ações · 6 — envio */}
          <div className="space-y-2 lg:sticky lg:top-2">
            {/* 5 — Portal, produto manual e desconto */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
              <button
                onClick={portalLigado ? desligarPortal : ligarPortal}
                disabled={portalBusy}
                className={`w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 ${
                  portalLigado
                    ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100'
                    : 'bg-[#000638] text-white hover:bg-[#000638]/90'
                }`}
              >
                {portalBusy ? (
                  <Spinner size={16} className="animate-spin" />
                ) : portalLigado ? (
                  <>
                    <Plugs size={16} /> DESLIGAR PORTAL
                  </>
                ) : (
                  <>
                    <PlugsConnected size={16} /> LIGAR PORTAL
                  </>
                )}
                {portalStatus.status === 'lendo' && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
                {portalStatus.status === 'reconectando' && (
                  <ArrowsClockwise size={13} className="animate-spin ml-1" />
                )}
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  adicionarManual();
                }}
                className="relative"
              >
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Sem tag? SKU / cód. barras"
                  className="w-full h-9 pl-8 pr-8 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
                {manualBusy && (
                  <Spinner
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
                  />
                )}
              </form>

              <div className="flex gap-2">
                <input
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(e.target.value)}
                  placeholder="%"
                  title="Desconto máximo: 15%"
                  className="h-9 w-16 px-1.5 rounded-lg border border-gray-300 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
                <button
                  onClick={aplicarDescontoGeral}
                  disabled={items.length === 0}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40"
                >
                  Aplicar desconto geral
                </button>
              </div>
            </div>

            {/* 6 — Resumo e envio */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
              <h2 className="text-xs font-semibold text-gray-700 mb-2">
                Resumo do orçamento
              </h2>
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between text-gray-500">
                  <span>Peças</span>
                  <span className="tabular-nums">{totals.qty}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {fmtBRL(totals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Descontos</span>
                  <span className="tabular-nums">
                    − {fmtBRL(totals.discounts)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="text-xl font-bold text-[#000638] tabular-nums">
                    {fmtBRL(totals.total)}
                  </span>
                </div>
              </div>

              <button
                onClick={abrirFechar}
                disabled={
                  items.length === 0 || !customer || !seller || !branch
                }
                className="mt-3 w-full h-10 rounded-lg bg-[#000638] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[#000638]/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Receipt size={16} weight="bold" /> Fechar Pré-Venda
              </button>

              <button
                onClick={enviarWhatsapp}
                disabled={items.length === 0 || sending || !customer}
                className="mt-1.5 w-full h-10 rounded-lg bg-emerald-600 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Spinner size={15} className="animate-spin" /> Preparando…
                  </>
                ) : (
                  <>
                    <WhatsappLogo size={16} weight="bold" /> Enviar por WhatsApp
                  </>
                )}
              </button>
              <button
                onClick={baixarPdf}
                disabled={items.length === 0}
                className="mt-1.5 w-full h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 inline-flex items-center justify-center gap-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <FilePdf size={15} /> Baixar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Modal Fechar Pré-Venda */}
        {fecharOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
              {!fecharResult ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-bold text-[#000638]">
                      Fechar Pré-Venda
                    </h3>
                    <button
                      onClick={() => setFecharOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} weight="bold" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {customer?.name} · {totals.qty} peças ·{' '}
                    <b className="text-[#000638]">{fmtBRL(totals.total)}</b>
                  </p>

                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    Forma de pagamento
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { id: 'pix', label: 'PIX', desc: 'link Pagar.me', Icon: QrCode },
                      { id: 'cartao', label: 'Cartão', desc: 'link Pagar.me', Icon: CreditCard },
                      { id: 'dinheiro', label: 'Dinheiro', desc: 'sem link', Icon: Money },
                      { id: 'boleto', label: 'Boleto', desc: 'confere limite', Icon: Receipt },
                    ].map(({ id, label, desc, Icon }) => (
                      <button
                        key={id}
                        onClick={() => setFecharMethod(id)}
                        className={`h-16 rounded-xl ring-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                          fecharMethod === id
                            ? 'bg-[#000638] text-white ring-[#000638]'
                            : 'bg-gray-50 text-gray-700 ring-gray-200 hover:bg-blue-50'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-xs font-bold">{label}</span>
                        <span
                          className={`text-[10px] ${fecharMethod === id ? 'text-white/70' : 'text-gray-400'}`}
                        >
                          {desc}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Opções do cartão: débito/crédito + parcelamento */}
                  {fecharMethod === 'cartao' && (
                    <div className="mb-3 bg-gray-50 rounded-xl p-3 ring-1 ring-gray-200 space-y-2">
                      <div className="flex gap-2">
                        {[
                          { id: 'credito', label: 'Crédito' },
                          { id: 'debito', label: 'Débito' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setCardType(t.id)}
                            className={`flex-1 h-8 rounded-lg text-xs font-bold ring-1 transition-colors ${
                              cardType === t.id
                                ? 'bg-[#000638] text-white ring-[#000638]'
                                : 'bg-white text-gray-600 ring-gray-300 hover:bg-blue-50'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {cardType === 'credito' && (
                        <select
                          value={cardInstallments}
                          onChange={(e) =>
                            setCardInstallments(parseInt(e.target.value, 10))
                          }
                          className="w-full h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}x de {fmtBRL(totals.total / n)}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                      <p className="text-[10px] text-gray-400">
                        {cardType === 'debito'
                          ? 'Link aceita somente cartão de débito.'
                          : `O cliente pagará obrigatoriamente em ${cardInstallments}x de ${fmtBRL(totals.total / cardInstallments)}.`}
                      </p>
                    </div>
                  )}

                  {fecharError && (
                    <p className="mb-2 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg p-2 ring-1 ring-rose-200">
                      {fecharError}
                    </p>
                  )}

                  <button
                    onClick={fecharPreVenda}
                    disabled={!fecharMethod || fecharBusy}
                    className="w-full h-11 rounded-xl bg-[#000638] text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[#000638]/90 disabled:opacity-40"
                  >
                    {fecharBusy ? (
                      <>
                        <Spinner size={16} className="animate-spin" />{' '}
                        Fechando…
                      </>
                    ) : (
                      <>
                        <CheckCircle size={17} weight="bold" /> Confirmar
                        fechamento
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center mb-3">
                    <CheckCircle
                      size={40}
                      weight="fill"
                      className="mx-auto text-emerald-500 mb-1.5"
                    />
                    <h3 className="text-base font-bold text-[#000638]">
                      Pré-venda fechada!
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Transação{' '}
                      <span className="font-mono font-bold text-[#000638] text-lg">
                        {fecharResult.transaction?.transactionCode}
                      </span>
                      <br />
                      Empresa {fecharResult.transaction?.branchCode} — em
                      andamento, pronta para o faturista emitir a nota.
                    </p>
                  </div>

                  {fecharResult.paymentLink && (
                    <div className="mb-3 bg-gray-50 rounded-xl p-3 ring-1 ring-gray-200 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Link de pagamento (
                        {fecharResult.paymentMethod === 'pix'
                          ? 'PIX'
                          : 'Cartão'}
                        )
                      </p>
                      <div className="flex items-center gap-1.5">
                        <input
                          readOnly
                          value={fecharResult.paymentLink.url}
                          className="flex-1 h-8 px-2 rounded-lg border border-gray-200 bg-white text-[11px] font-mono text-gray-600"
                        />
                        <button
                          onClick={copiarLink}
                          className="h-8 w-8 rounded-lg ring-1 ring-gray-300 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100"
                          title="Copiar link"
                        >
                          {linkCopiado ? (
                            <CheckCircle size={15} className="text-emerald-500" />
                          ) : (
                            <Copy size={15} />
                          )}
                        </button>
                        <a
                          href={fecharResult.paymentLink.url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 w-8 rounded-lg ring-1 ring-gray-300 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100"
                          title="Abrir link"
                        >
                          <ArrowSquareOut size={15} />
                        </a>
                      </div>
                      <button
                        onClick={enviarLinkWhatsapp}
                        className="w-full h-9 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-700"
                      >
                        <WhatsappLogo size={15} weight="bold" /> Enviar link
                        por WhatsApp
                      </button>

                      {/* Status do pagamento + conciliação (cartão) */}
                      <div className="pt-1 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-gray-500">
                            {payStatus
                              ? payStatus.paid
                                ? '✅ PAGO'
                                : `Status: ${payStatus.status}`
                              : 'Pagamento ainda não verificado'}
                          </p>
                          <button
                            onClick={verificarPagamento}
                            disabled={payBusy}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-100 disabled:opacity-40 inline-flex items-center gap-1"
                          >
                            {payBusy ? (
                              <Spinner size={11} className="animate-spin" />
                            ) : (
                              <ArrowsClockwise size={11} />
                            )}
                            Verificar
                          </button>
                        </div>
                        {payStatus?.paid && payStatus.method === 'credit_card' && (
                          <div className="mt-1.5 text-[11px] text-gray-600 bg-white rounded-lg p-2 ring-1 ring-emerald-200">
                            <p>
                              <b>Autorização:</b>{' '}
                              <span className="font-mono">
                                {payStatus.authCode || '—'}
                              </span>
                            </p>
                            <p>
                              <b>NSU:</b>{' '}
                              <span className="font-mono">
                                {payStatus.nsu || '—'}
                              </span>
                            </p>
                            {payStatus.cardBrand && (
                              <p>
                                <b>Cartão:</b> {payStatus.cardBrand} ····{' '}
                                {payStatus.cardLast4}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setFecharOpen(false);
                      novoOrcamento();
                    }}
                    className="w-full h-10 rounded-xl bg-[#000638] text-white text-xs font-bold hover:bg-[#000638]/90"
                  >
                    Concluir e iniciar novo orçamento
                  </button>
                  <button
                    onClick={() => setFecharOpen(false)}
                    className="mt-1.5 w-full h-9 rounded-xl text-xs font-semibold text-gray-500 ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    Fechar janela (manter orçamento aberto)
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === 'ok'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {toast.type === 'ok' ? (
              <CheckCircle size={17} weight="bold" />
            ) : (
              <Warning size={17} weight="bold" />
            )}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrcamentoRFID;
