// Página: Tecnologia → PDV Varejo
// PDV de loja: bipa as peças no LEITOR RFID DE MESA (USB, .bat R9816 via Web
// Serial) ou por SKU manual, com o layout/organização por grade do Orçamento.
// Preço = VENDA VAREJO (código 1, com promoção quando houver). O botão GERAR
// TRANSAÇÃO cria a transação "em andamento" no TOTVS — o caixa finaliza no
// componente TRAFP005 (Continuar Transação → Encerrar → Receber) — e a tela
// acompanha o status: quando vira ATENDIDA, encerra a venda aqui.
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
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
  CheckCircle,
  Warning,
  Tag,
  Percent,
  Barcode,
  Plus,
  Minus,
  Storefront,
  UserPlus,
  Receipt,
  Gear,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import useRfidReader from '../hooks/useRfidReader';

// ─── Config do PDV Varejo (ajustável) ────────────────────────────────────────
const PDV_VAREJO_CONFIG = {
  cfop: 5102,
  // Condição de pagamento provisória da transação em andamento — o caixa
  // define a forma real ao encerrar/receber no TRAFP005
  paymentConditionCode: 1,
  // Tipo de preço: 1 = VENDA VAREJO (16 = VAREJO SHOPPING, p/ lojas de shopping)
  priceCodes: '1',
  maxDescontoPct: 15,
  // Cashback (saldo bônus): a venda gera 20%; para consumir, a venda deve
  // ser >= 3x o valor usado (ex.: R$ 200 de saldo exigem compra de R$ 600)
  cashbackGerarPct: 20,
  cashbackFatorMinimo: 3,
};

// Situações da transação no TOTVS
const TRX_STATUS = {
  1: { label: 'Em andamento', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  2: { label: 'Encerrada', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  3: { label: 'Em processo externo', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  4: { label: 'ATENDIDA', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  6: { label: 'CANCELADA', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const qtyOf = (i) => i.epcs.length + (i.manualQty || 0);

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

// ─── Busca de cliente com dropdown (+ atalho p/ cadastro) ────────────────────
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
      <label className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        Cliente
        <button
          onClick={() => window.open('/cadastrar-cliente', '_blank')}
          className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline normal-case font-semibold"
          title="Cadastrar cliente novo (abre em outra aba)"
        >
          <UserPlus size={12} weight="bold" /> cadastrar
        </button>
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
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
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
const PDVVarejo = () => {
  // Filtros
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(
    () => localStorage.getItem('pdv_varejo_branch') || '',
  );
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState(
    () => localStorage.getItem('pdv_varejo_seller') || '',
  );
  const [operations, setOperations] = useState([]);
  const [operation, setOperation] = useState(
    () => localStorage.getItem('pdv_varejo_operation') || '',
  );
  const [customer, setCustomer] = useState(null);

  // Cashback (saldo bônus do cliente na empresa da venda)
  const [cashback, setCashback] = useState(null); // { balance, cpf }
  const [cashbackUsar, setCashbackUsar] = useState(false);
  const cashbackGeradoRef = useRef(false); // evita gerar 2x na mesma venda

  // Itens (mesma organização do Orçamento: por grade, 1 etiqueta = 1 peça)
  const [items, setItems] = useState([]);
  const processedEpcs = useRef(new Set());
  const branchRef = useRef(branch);
  branchRef.current = branch;

  const [globalDiscount, setGlobalDiscount] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [posting, setPosting] = useState(false);
  // Transação gerada: { transactionCode, branchCode, transactionDate, total }
  const [trx, setTrx] = useState(null);
  const [trxStatus, setTrxStatus] = useState(null); // status numérico do TOTVS
  const [trxChecking, setTrxChecking] = useState(false);

  useEffect(() => localStorage.setItem('pdv_varejo_branch', branch), [branch]);
  useEffect(() => localStorage.setItem('pdv_varejo_seller', seller), [seller]);
  useEffect(
    () => localStorage.setItem('pdv_varejo_operation', operation),
    [operation],
  );

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Cargas iniciais
  useEffect(() => {
    (async () => {
      try {
        const [b, o] = await Promise.all([
          fetch(`${API_BASE_URL}/api/totvs/branches`).then((r) => r.json()),
          fetch(`${API_BASE_URL}/api/totvs/pdv/operations`).then((r) =>
            r.json(),
          ),
        ]);
        setBranches(b?.data?.data || []);
        setOperations(o?.data?.items || []);
      } catch {
        showToast('erro', 'Falha ao carregar dados do TOTVS');
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

  // Cashback: ao escolher cliente (e empresa), busca CPF e saldo bônus
  useEffect(() => {
    setCashback(null);
    setCashbackUsar(false);
    if (!customer || !branch) return;
    (async () => {
      try {
        const rc = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/customer/${customer.code}`,
        );
        const jc = await rc.json();
        const cpf = (jc?.data?.cpfCnpj || '').replace(/\D/g, '');
        if (!cpf) {
          setCashback({ balance: 0, cpf: null });
          return;
        }
        const rb = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/bonus?cpf=${cpf}&branch=${branch}`,
        );
        const jb = await rb.json();
        setCashback({ balance: jb?.data?.balance || 0, cpf });
      } catch {
        setCashback({ balance: 0, cpf: null });
      }
    })();
  }, [customer, branch]);

  // ─── Produtos: merge por productCode (grade), preço varejo ───────────────
  const mergeProduto = useCallback((data, { epc = null, manual = 0 }) => {
    const { product, prices } = data;
    const padrao = (prices || []).find(
      (p) => p.promotionalPrice > 0 || p.price > 0,
    );
    const emPromo = padrao?.promotionalPrice > 0;
    const unit = emPromo ? padrao.promotionalPrice : padrao?.price || 0;

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
          referenceName: product.referenceName || null,
          unit,
          discount: 0,
          fonte: emPromo ? 'promo' : unit > 0 ? 'varejo' : 'sem-preco',
          epcs: epc ? [epc] : [],
          manualQty: manual,
        },
      ];
    });
    beep(true);
  }, []);

  const resolverCodigo = useCallback(
    async (code, origem) => {
      const br = branchRef.current;
      if (!br) {
        beep(false);
        showToast('erro', 'Selecione a empresa antes de bipar');
        return false;
      }
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}?branch=${br}&priceCodes=${PDV_VAREJO_CONFIG.priceCodes}`,
        );
        const j = await r.json();
        if (!r.ok || !j?.data?.product) {
          if (origem === 'manual') {
            beep(false);
            showToast('erro', j?.message || `Código ${code} não encontrado`);
          }
          return false;
        }
        mergeProduto(j.data, origem === 'manual' ? { manual: 1 } : { epc: code });
        return true;
      } catch (e) {
        if (origem === 'manual')
          showToast('erro', `Erro na consulta: ${e.message}`);
        return false;
      }
    },
    [mergeProduto, showToast],
  );

  // Leitor RFID de mesa (USB / Web Serial) — 1 etiqueta = 1 peça, sem repetir
  const onEpcLido = useCallback(
    (epc) => {
      if (processedEpcs.current.has(epc)) return;
      processedEpcs.current.add(epc);
      resolverCodigo(epc, 'rfid');
    },
    [resolverCodigo],
  );
  const {
    status: rfidStatus,
    error: rfidError,
    supported: rfidSupported,
    connect: rfidConnect,
    disconnect: rfidDisconnect,
  } = useRfidReader(onEpcLido);

  const adicionarManual = useCallback(async () => {
    const code = manualCode.trim();
    if (!code || manualBusy) return;
    setManualBusy(true);
    const ok = await resolverCodigo(code, 'manual');
    if (ok) setManualCode('');
    setManualBusy(false);
  }, [manualCode, manualBusy, resolverCodigo]);

  // ─── Itens: edição ───────────────────────────────────────────────────────
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

  const aplicarDescontoGeral = useCallback(() => {
    const pct = parseFloat(String(globalDiscount).replace(',', '.'));
    if (
      Number.isNaN(pct) ||
      pct < 0 ||
      pct > PDV_VAREJO_CONFIG.maxDescontoPct
    ) {
      showToast(
        'erro',
        `Desconto geral inválido (0 a ${PDV_VAREJO_CONFIG.maxDescontoPct}%)`,
      );
      return;
    }
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        discount: Number(((i.unit * pct) / 100).toFixed(2)),
      })),
    );
  }, [globalDiscount, showToast]);

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

  const totals = useMemo(() => {
    const qty = items.reduce((s, i) => s + qtyOf(i), 0);
    const subtotal = items.reduce((s, i) => s + qtyOf(i) * i.unit, 0);
    const discounts = items.reduce(
      (s, i) => s + qtyOf(i) * (i.discount || 0),
      0,
    );
    const base = subtotal - discounts;
    // Cashback consumível: limitado pelo saldo E pela regra venda >= 3x o uso
    const saldo = cashback?.balance || 0;
    const maxPelaVenda = base / PDV_VAREJO_CONFIG.cashbackFatorMinimo;
    const cashbackDisponivel = Math.min(saldo, Math.floor(maxPelaVenda * 100) / 100);
    const cashbackAplicado =
      cashbackUsar && cashbackDisponivel > 0 ? cashbackDisponivel : 0;
    return {
      qty,
      subtotal,
      discounts,
      cashbackDisponivel,
      cashbackAplicado,
      total: base - cashbackAplicado,
    };
  }, [items, cashback, cashbackUsar]);

  const novaVenda = useCallback(() => {
    setItems([]);
    setCustomer(null);
    setTrx(null);
    setTrxStatus(null);
    setCashback(null);
    setCashbackUsar(false);
    cashbackGeradoRef.current = false;
    processedEpcs.current = new Set();
  }, []);

  const limpar = useCallback(() => {
    setItems([]);
    processedEpcs.current = new Set();
  }, []);

  // ─── Gerar transação (em andamento, p/ o caixa finalizar no TRAFP005) ────
  const canGenerate =
    !posting &&
    items.length > 0 &&
    branch &&
    customer &&
    seller &&
    operation &&
    items.every((i) => qtyOf(i) > 0 && i.unit > 0);

  const gerarTransacao = useCallback(async () => {
    if (!canGenerate) return;
    setPosting(true);
    try {
      // Distribui o cashback consumido como desconto proporcional nos itens
      // (o TOTVS confere totalAmountTransaction contra a soma dos itens)
      const cb = totals.cashbackAplicado;
      const baseVenda = totals.subtotal - totals.discounts;
      const itensPayload = items.map((i) => {
        const q = qtyOf(i);
        const itemTotal = q * (i.unit - (i.discount || 0));
        const extraUnit =
          cb > 0 && baseVenda > 0
            ? Number(((itemTotal / baseVenda) * cb) / q).toFixed(3) * 1
            : 0;
        const discountValue = Number(
          ((i.discount || 0) + extraUnit).toFixed(3),
        );
        return {
          productCode: i.productCode,
          quantity: q,
          value: Number(Number(i.unit).toFixed(3)),
          ...(discountValue > 0 ? { discountValue } : {}),
          cfop: PDV_VAREJO_CONFIG.cfop,
        };
      });
      // Total exato a partir dos itens já arredondados (conferência do TOTVS)
      const totalExato = Number(
        itensPayload
          .reduce(
            (s, it) => s + it.quantity * (it.value - (it.discountValue || 0)),
            0,
          )
          .toFixed(2),
      );

      const payload = {
        branchCode: parseInt(branch, 10),
        customerCode: customer.code,
        sellerCode: parseInt(seller, 10),
        operationCode: parseInt(operation, 10),
        paymentConditionCode: PDV_VAREJO_CONFIG.paymentConditionCode,
        isPreSale: false,
        status: 1,
        totalAmountTransaction: totalExato,
        items: itensPayload,
      };
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        showToast('erro', j?.message || 'TOTVS recusou a transação');
        return;
      }
      setTrx({
        ...j.data,
        total: totalExato,
        cashbackUsado: cb,
        customerCode: customer.code,
      });
      setTrxStatus(1);
      cashbackGeradoRef.current = false;
      beep(true);

      // Consome o saldo bônus usado (registro no TOTVS/PESFC054)
      if (cb > 0) {
        try {
          const rc = await fetch(`${API_BASE_URL}/api/totvs/pdv/bonus/consume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personCode: customer.code,
              branchCode: parseInt(branch, 10),
              usedValue: cb,
            }),
          });
          const jc = await rc.json();
          if (!rc.ok || !jc.success) {
            showToast(
              'erro',
              `Transação ok, mas o consumo do cashback falhou: ${jc?.message || ''} — baixe manualmente no PESFC054`,
            );
          }
        } catch {
          showToast(
            'erro',
            'Transação ok, mas o consumo do cashback falhou — baixe manualmente no PESFC054',
          );
        }
      }
    } catch (e) {
      showToast('erro', `Falha ao gerar transação: ${e.message}`);
    } finally {
      setPosting(false);
    }
  }, [canGenerate, branch, customer, seller, operation, totals, items, showToast]);

  // ─── Acompanha o status até ATENDIDA (caixa finaliza no TRAFP005) ────────
  const verificarStatus = useCallback(async () => {
    if (!trx || trxChecking) return;
    setTrxChecking(true);
    try {
      const qs = new URLSearchParams({
        branch: trx.branchCode,
        code: trx.transactionCode,
        date: String(trx.transactionDate).slice(0, 10),
      });
      const r = await fetch(
        `${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`,
      );
      const j = await r.json();
      if (j?.data?.status != null) setTrxStatus(j.data.status);
    } catch {
      /* tenta no próximo ciclo */
    } finally {
      setTrxChecking(false);
    }
  }, [trx, trxChecking]);

  // Polling automático a cada 10s enquanto a transação não for atendida
  useEffect(() => {
    if (!trx || trxStatus === 4 || trxStatus === 6) return undefined;
    const t = setInterval(verificarStatus, 10000);
    return () => clearInterval(t);
  }, [trx, trxStatus, verificarStatus]);

  // Venda ATENDIDA → gera o cashback novo (20% do valor pago), uma vez só
  useEffect(() => {
    if (trxStatus !== 4 || !trx || cashbackGeradoRef.current) return;
    cashbackGeradoRef.current = true;
    (async () => {
      const valor = Number(
        ((trx.total * PDV_VAREJO_CONFIG.cashbackGerarPct) / 100).toFixed(2),
      );
      if (!(valor > 0)) return;
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/bonus/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personCode: trx.customerCode,
            branchCode: trx.branchCode,
            value: valor,
            transactionCode: trx.transactionCode,
            transactionDate: trx.transactionDate,
            historic: `Cashback ${PDV_VAREJO_CONFIG.cashbackGerarPct}% - venda ${trx.transactionCode} (PDV Varejo)`,
          }),
        });
        const j = await r.json();
        if (r.ok && j.success) {
          setTrx((prev) => (prev ? { ...prev, cashbackGerado: valor } : prev));
          showToast('ok', `Cashback de ${fmtBRL(valor)} gerado para o cliente! 💰`);
        } else {
          cashbackGeradoRef.current = false; // permite re-tentar no próximo ciclo
          showToast(
            'erro',
            `Venda atendida, mas o cashback não foi gerado: ${j?.message || ''}`,
          );
        }
      } catch {
        cashbackGeradoRef.current = false;
        showToast('erro', 'Venda atendida, mas o cashback não foi gerado');
      }
    })();
  }, [trxStatus, trx, showToast]);

  const stInfo = TRX_STATUS[trxStatus] || {
    label: `status ${trxStatus}`,
    cls: 'bg-gray-100 text-gray-600 ring-gray-200',
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-6xl mx-auto">
        <PageTitle
          title="PDV Varejo"
          subtitle="Bipe as peças, gere a transação e finalize no caixa TOTVS (TRAFP005)"
          icon={Storefront}
        />

        {/* Filtros: empresa, vendedor, operação, cliente */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-2 lg:grid-cols-4 gap-2 items-start">
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
                  {branch ? 'Selecione…' : 'Escolha a empresa'}
                </option>
                {sellers.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Operação
            </label>
            <div className="relative">
              <Gear
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className="w-full h-9 pl-8 pr-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
              >
                <option value="">Selecione…</option>
                {operations.map((o) => (
                  <option key={o.operationCode} value={o.operationCode}>
                    {o.operationCode} — {o.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ClientePicker value={customer} onSelect={setCustomer} />
        </div>

        {/* Cashback do cliente */}
        {customer && cashback && cashback.balance > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 bg-emerald-50 rounded-xl ring-1 ring-emerald-200 px-3 py-2">
            <span className="text-sm text-emerald-800">
              💰 <b>{customer.name.split(' ')[0]}</b> tem{' '}
              <b>{fmtBRL(cashback.balance)}</b> de cashback — para usar tudo, a
              venda precisa ser de pelo menos{' '}
              <b>
                {fmtBRL(
                  cashback.balance * PDV_VAREJO_CONFIG.cashbackFatorMinimo,
                )}
              </b>
              {totals.cashbackDisponivel > 0 &&
                totals.cashbackDisponivel < cashback.balance && (
                  <span className="text-emerald-700">
                    {' '}
                    (nesta venda dá para usar{' '}
                    {fmtBRL(totals.cashbackDisponivel)})
                  </span>
                )}
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={cashbackUsar}
                onChange={(e) => setCashbackUsar(e.target.checked)}
                disabled={totals.cashbackDisponivel <= 0}
                className="accent-emerald-600 w-4 h-4"
              />
              Usar cashback
              {totals.cashbackAplicado > 0 &&
                ` (−${fmtBRL(totals.cashbackAplicado)})`}
            </label>
          </div>
        )}

        {/* Grid: produtos (layout do orçamento) + coluna de ações */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-2 items-start">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="max-h-[52vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 bg-gray-50">Produto</th>
                    <th className="px-2 py-2 w-24 text-center bg-gray-50">Qtd</th>
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
                          {rfidStatus === 'conectado'
                            ? 'Leitor ativo — aproxime as peças.'
                            : 'Conecte o leitor RFID ou adicione por código.'}
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
                              {i.fonte === 'promo' ? (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-purple-50 text-purple-600 ring-1 ring-purple-200">
                                  promoção
                                </span>
                              ) : i.fonte === 'sem-preco' ? (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                                  sem preço varejo
                                </span>
                              ) : null}
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
                              max={Number(
                                (
                                  (i.unit * PDV_VAREJO_CONFIG.maxDescontoPct) /
                                  100
                                ).toFixed(2),
                              )}
                              step="0.01"
                              value={i.discount}
                              title={`Máx. ${PDV_VAREJO_CONFIG.maxDescontoPct}%: ${fmtBRL((i.unit * PDV_VAREJO_CONFIG.maxDescontoPct) / 100)}`}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                updateItem(i.productCode, {
                                  discount: Math.min(
                                    Math.max(v, 0),
                                    Number(
                                      (
                                        (i.unit *
                                          PDV_VAREJO_CONFIG.maxDescontoPct) /
                                        100
                                      ).toFixed(2),
                                    ),
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

          {/* Coluna direita: leitor + ações + resumo */}
          <div className="space-y-2 lg:sticky lg:top-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
              {rfidSupported ? (
                <button
                  onClick={
                    rfidStatus === 'desconectado' ? rfidConnect : rfidDisconnect
                  }
                  className={`w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors ${
                    rfidStatus === 'conectado'
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100'
                      : rfidStatus === 'reconectando'
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                        : 'bg-[#000638] text-white hover:bg-[#000638]/90'
                  }`}
                >
                  {rfidStatus === 'conectado' ? (
                    <>
                      <PlugsConnected size={16} /> LEITOR ATIVO
                      <span className="relative flex h-2 w-2 ml-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    </>
                  ) : rfidStatus === 'reconectando' ? (
                    <>
                      <ArrowsClockwise size={15} className="animate-spin" />{' '}
                      RECONECTANDO…
                    </>
                  ) : (
                    <>
                      <Plugs size={16} /> CONECTAR LEITOR RFID
                    </>
                  )}
                </button>
              ) : (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2 ring-1 ring-amber-200">
                  Navegador sem Web Serial — use Chrome ou Edge.
                </p>
              )}
              {rfidError && (
                <p className="text-[10px] text-amber-600">{rfidError}</p>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  adicionarManual();
                }}
                className="relative"
              >
                <Barcode
                  size={15}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
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

              <div className="flex items-center gap-1.5">
                <Percent size={14} className="text-gray-400 shrink-0" />
                <input
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(e.target.value)}
                  placeholder="%"
                  title={`Desconto máximo: ${PDV_VAREJO_CONFIG.maxDescontoPct}%`}
                  className="h-9 w-14 px-1.5 rounded-lg border border-gray-300 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
                <button
                  onClick={aplicarDescontoGeral}
                  disabled={items.length === 0}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40"
                >
                  Aplicar desconto
                </button>
                <button
                  onClick={limpar}
                  disabled={items.length === 0}
                  className="h-9 px-2.5 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40"
                  title="Limpar itens"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>

            {/* Resumo + gerar transação */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
              <h2 className="text-xs font-semibold text-gray-700 mb-2">
                Resumo da venda
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
                {totals.cashbackAplicado > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>💰 Cashback</span>
                    <span className="tabular-nums">
                      − {fmtBRL(totals.cashbackAplicado)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="text-xl font-bold text-[#000638] tabular-nums">
                    {fmtBRL(totals.total)}
                  </span>
                </div>
              </div>

              <button
                onClick={gerarTransacao}
                disabled={!canGenerate}
                className="mt-3 w-full h-11 rounded-lg bg-[#000638] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[#000638]/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting ? (
                  <>
                    <Spinner size={16} className="animate-spin" /> Gerando…
                  </>
                ) : (
                  <>
                    <Receipt size={16} weight="bold" /> GERAR TRANSAÇÃO
                  </>
                )}
              </button>
              {!canGenerate && items.length > 0 && (
                <p className="mt-1.5 text-[10px] text-gray-400 text-center">
                  Preencha empresa, vendedor, operação e cliente.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal: transação gerada + acompanhamento até ATENDIDA */}
        {trx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
              <CheckCircle
                size={44}
                weight="fill"
                className={`mx-auto mb-2 ${
                  trxStatus === 4
                    ? 'text-emerald-500'
                    : trxStatus === 6
                      ? 'text-rose-500'
                      : 'text-blue-500'
                }`}
              />
              <h3 className="text-lg font-bold text-[#000638]">
                {trxStatus === 4
                  ? 'Venda atendida!'
                  : trxStatus === 6
                    ? 'Transação cancelada'
                    : 'Transação gerada!'}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Nº da transação{' '}
                <span className="font-mono font-bold text-[#000638] text-xl">
                  {trx.transactionCode}
                </span>
                <br />
                Empresa {trx.branchCode} · {fmtBRL(trx.total)}
                {trx.cashbackUsado > 0 && (
                  <>
                    <br />
                    <span className="text-emerald-600 text-xs">
                      💰 {fmtBRL(trx.cashbackUsado)} de cashback consumido
                    </span>
                  </>
                )}
                {trx.cashbackGerado > 0 && (
                  <>
                    <br />
                    <span className="text-emerald-600 text-xs font-semibold">
                      💰 Novo cashback gerado: {fmtBRL(trx.cashbackGerado)}
                    </span>
                  </>
                )}
              </p>

              <div className="mt-3 flex items-center justify-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${stInfo.cls}`}
                >
                  {trxStatus !== 4 && trxStatus !== 6 && (
                    <Spinner size={12} className="animate-spin" />
                  )}
                  {stInfo.label}
                </span>
                <button
                  onClick={verificarStatus}
                  disabled={trxChecking}
                  className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
                  title="Verificar agora"
                >
                  <ArrowsClockwise
                    size={12}
                    className={trxChecking ? 'animate-spin' : ''}
                  />
                  Atualizar
                </button>
              </div>

              {trxStatus !== 4 && trxStatus !== 6 && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 ring-1 ring-gray-200">
                  Finalize no caixa TOTVS: <b>TRAFP005</b> → Continuar
                  Transação nº <b>{trx.transactionCode}</b> → Encerrar →
                  Receber. Esta tela atualiza sozinha a cada 10s.
                </p>
              )}
              {trxStatus === 4 && (
                <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-2.5 ring-1 ring-emerald-200">
                  Recebida e faturada no caixa — venda encerrada aqui também. ✅
                </p>
              )}

              {trxStatus === 4 || trxStatus === 6 ? (
                <button
                  onClick={novaVenda}
                  className="mt-4 w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90"
                >
                  Nova venda
                </button>
              ) : (
                <div className="mt-4 space-y-1.5">
                  <button
                    onClick={() => setTrx(null)}
                    className="w-full h-9 rounded-xl text-xs font-semibold text-gray-500 ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    Fechar e continuar vendendo (transação segue no caixa)
                  </button>
                  <button
                    onClick={novaVenda}
                    className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    Nova venda agora
                  </button>
                </div>
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

export default PDVVarejo;
