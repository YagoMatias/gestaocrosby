// Página: PDV RFID — tela de venda estilo PDV TOTVS, moderna.
// Bipagem por leitor RFID de mesa (.bat R9816, hook useRfidReader) ou por
// código digitado (EAN / código interno / EPC). Consulta produto+preço no
// backend (/api/totvs/pdv/*), monta o carrinho e inclui a transação no TOTVS
// (POST general/v2/transactions via backend).
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
  MagnifyingGlass,
  Trash,
  Spinner,
  CheckCircle,
  Warning,
  X,
  User,
  Storefront,
  Buildings,
  CreditCard,
  ShoppingCartSimple,
  Barcode,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import useRfidReader from '../hooks/useRfidReader';

// Enum oficial DocumentType (FCRFM001) — cuidado: 26=PIX, 20=CREDEV
const DOC_TYPES = [
  { code: 3, label: '3 — Dinheiro' },
  { code: 26, label: '26 — PIX' },
  { code: 4, label: '4 — Cartão de crédito' },
  { code: 5, label: '5 — Cartão de débito' },
  { code: 1, label: '1 — Fatura' },
  { code: 20, label: '20 — Credev' },
];

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 1200 : 320;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => ctx.close();
  } catch {
    /* sem áudio */
  }
}

// ─── Busca de pessoa (cliente/vendedor) com dropdown ────────────────────────
function PersonPicker({ label, icon: Icon, value, onSelect, placeholder }) {
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
        if (digits.length >= 11 && digits.length === q.trim().length) {
          param = `cnpj=${digits}`;
        } else if (/^\d+$/.test(q.trim())) {
          param = `code=${q.trim()}`;
        } else {
          param = `nome=${encodeURIComponent(q)}`;
        }
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
        {label}
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
            title="Trocar"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Icon
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
            placeholder={placeholder}
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
                <span className="font-medium text-[#000638]">{p.code}</span>{' '}
                — {p.nm_pessoa}
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
const PDVRfid = () => {
  // Configuração da venda
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(
    () => localStorage.getItem('pdv_rfid_branch') || '',
  );
  const [operations, setOperations] = useState([]);
  const [operation, setOperation] = useState(
    () => localStorage.getItem('pdv_rfid_operation') || '',
  );
  const [conditions, setConditions] = useState([]);
  const [condition, setCondition] = useState(
    () => localStorage.getItem('pdv_rfid_condition') || '',
  );
  const [cfop, setCfop] = useState(
    () => localStorage.getItem('pdv_rfid_cfop') || '5102',
  );
  // Pré-venda DESLIGADA por padrão: pré-venda fica aguardando um caixa
  // físico "continuar" — o recebimento via API trava nela
  const [isPreSale, setIsPreSale] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState(
    () => localStorage.getItem('pdv_rfid_seller') || '',
  );
  const [customer, setCustomer] = useState(null);

  // Carrinho e status
  const [items, setItems] = useState([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'ok'|'erro', msg }
  const [posting, setPosting] = useState(false);
  const [saleResult, setSaleResult] = useState(null); // TransactionResponseModel + total
  // Recebimento do pagamento (transforma a transação em "atendida")
  const [receiveDocType, setReceiveDocType] = useState('3');
  const [receiving, setReceiving] = useState(false);
  const [receiveDone, setReceiveDone] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  // Etapa "Encerrar venda": confirma no TOTVS que o plano de pagamento foi
  // gravado (parcelas existem) antes de liberar o recebimento
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const branchRef = useRef(branch);
  branchRef.current = branch;

  // Persistência das escolhas
  useEffect(() => localStorage.setItem('pdv_rfid_branch', branch), [branch]);
  useEffect(
    () => localStorage.setItem('pdv_rfid_operation', operation),
    [operation],
  );
  useEffect(
    () => localStorage.setItem('pdv_rfid_condition', condition),
    [condition],
  );
  useEffect(() => localStorage.setItem('pdv_rfid_cfop', cfop), [cfop]);
  useEffect(() => localStorage.setItem('pdv_rfid_seller', seller), [seller]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Carrega selects na montagem
  useEffect(() => {
    (async () => {
      try {
        const [b, o, c] = await Promise.all([
          fetch(`${API_BASE_URL}/api/totvs/branches`).then((r) => r.json()),
          fetch(`${API_BASE_URL}/api/totvs/pdv/operations`).then((r) =>
            r.json(),
          ),
          fetch(`${API_BASE_URL}/api/totvs/pdv/payment-conditions`).then((r) =>
            r.json(),
          ),
        ]);
        setBranches(b?.data?.data || []);
        setOperations(o?.data?.items || []);
        setConditions(c?.data?.items || []);
      } catch {
        showToast('erro', 'Falha ao carregar dados do TOTVS');
      }
    })();
  }, [showToast]);

  // Vendedores da empresa selecionada (sale-panel/v2/sellers-list)
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
        // Mantém o vendedor salvo se ele existir na empresa nova
        setSeller((prev) =>
          list.some((s) => String(s.code) === String(prev)) ? prev : '',
        );
      } catch {
        setSellers([]);
      }
    })();
  }, [branch]);

  // ─── Bipagem: consulta produto e adiciona ao carrinho ────────────────────
  const addByCode = useCallback(
    async (code) => {
      const br = branchRef.current;
      if (!br) {
        beep(false);
        showToast('erro', 'Selecione a empresa antes de bipar');
        return;
      }
      setLookupBusy(true);
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}?branch=${br}`,
        );
        const j = await r.json();
        if (!r.ok || !j?.data?.product) {
          beep(false);
          showToast('erro', j?.message || `Código ${code} não encontrado`);
          return;
        }
        const { product, prices } = j.data;
        const priceEntry = (prices || []).find(
          (p) => p.promotionalPrice > 0 || p.price > 0,
        );
        const unit =
          priceEntry?.promotionalPrice > 0
            ? priceEntry.promotionalPrice
            : priceEntry?.price || 0;

        setItems((prev) => {
          const idx = prev.findIndex(
            (i) => i.productCode === product.productCode,
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
            return next;
          }
          return [
            ...prev,
            {
              key: `${product.productCode}-${Date.now()}`,
              productCode: product.productCode,
              productName: product.productName,
              sku: product.productSku,
              readCode: code,
              isRfid: !!product.isRfid,
              qty: 1,
              unitValue: unit,
              discount: 0,
            },
          ];
        });
        beep(true);
      } catch (err) {
        beep(false);
        showToast('erro', `Erro na consulta: ${err.message}`);
      } finally {
        setLookupBusy(false);
      }
    },
    [showToast],
  );

  // Leitor RFID
  const {
    status: rfidStatus,
    error: rfidError,
    supported: rfidSupported,
    connect: rfidConnect,
    disconnect: rfidDisconnect,
  } = useRfidReader(addByCode);

  const submitManual = useCallback(
    (e) => {
      e.preventDefault();
      const code = manualCode.trim();
      if (!code) return;
      setManualCode('');
      addByCode(code);
    },
    [manualCode, addByCode],
  );

  const updateItem = useCallback((key, patch) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  // Totais
  const totals = useMemo(() => {
    const qty = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * (i.unitValue || 0), 0);
    const discounts = items.reduce((s, i) => s + i.qty * (i.discount || 0), 0);
    return { qty, subtotal, discounts, total: subtotal - discounts };
  }, [items]);

  // ─── Finalizar venda ─────────────────────────────────────────────────────
  const canFinish =
    !posting &&
    items.length > 0 &&
    branch &&
    customer &&
    seller &&
    operation &&
    condition &&
    cfop &&
    items.every((i) => i.qty > 0 && i.unitValue > 0);

  const finalizar = useCallback(async () => {
    if (!canFinish) return;
    setPosting(true);
    try {
      const payload = {
        branchCode: parseInt(branch, 10),
        customerCode: customer.code,
        sellerCode: parseInt(seller, 10),
        operationCode: parseInt(operation, 10),
        paymentConditionCode: parseInt(condition, 10),
        isPreSale,
        // O insert só aceita status 1 (Em andamento) — validado por sonda:
        // 2..6 retornam "Invalid Status value". O recebimento atua sobre a
        // transação em andamento e a leva direto a atendida.
        status: 1,
        totalAmountTransaction: Number(totals.total.toFixed(2)),
        // Plano de pagamento — equivale ao "encerramento" do PDV físico:
        // a forma de recebimento fica definida já na inclusão, e o
        // recebimento posterior só liquida o que já está previsto
        paymentPlanItems: [
          {
            documentType: parseInt(receiveDocType, 10),
            documentTypeSequence: 1,
            installmentValue: Number(totals.total.toFixed(2)),
            expirationDate: new Date().toISOString().slice(0, 10),
          },
        ],
        items: items.map((i) => ({
          productCode: i.productCode,
          quantity: i.qty,
          value: Number(Number(i.unitValue).toFixed(3)),
          ...(i.discount > 0
            ? { discountValue: Number(Number(i.discount).toFixed(3)) }
            : {}),
          cfop: parseInt(cfop, 10),
        })),
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
      setSaleResult({
        ...j.data,
        total: payload.totalAmountTransaction,
        isPreSale,
      });
      setReceiveDone(false);
      setReceiveError('');
      setClosed(false);
      setCloseError('');
      setItems([]);
      setCustomer(null);
      beep(true);
    } catch (err) {
      showToast('erro', `Falha ao incluir transação: ${err.message}`);
    } finally {
      setPosting(false);
    }
  }, [
    canFinish,
    branch,
    customer,
    seller,
    operation,
    condition,
    isPreSale,
    receiveDocType,
    totals,
    items,
    cfop,
    showToast,
  ]);

  // "Encerrar venda": confere no TOTVS se a transação está com o plano de
  // pagamento gravado (parcelas). Sem isso o recebimento trava no servidor
  // e cancela a transação — este gate evita queimar a venda.
  const encerrarVenda = useCallback(async () => {
    if (!saleResult || closing) return;
    setClosing(true);
    setCloseError('');
    try {
      const qs = new URLSearchParams({
        branch: saleResult.branchCode,
        code: saleResult.transactionCode,
        date: String(saleResult.transactionDate).slice(0, 10),
      });
      const r = await fetch(
        `${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`,
      );
      const j = await r.json();
      if (!r.ok || !j.success) {
        setCloseError(j?.message || 'Falha ao consultar a transação');
        return;
      }
      const { status, hasPaymentPlan, installment } = j.data;
      if (status === 6) {
        setCloseError('Transação foi cancelada no TOTVS — faça a venda de novo.');
        return;
      }
      if (!hasPaymentPlan) {
        setCloseError(
          'O TOTVS não gravou o plano de pagamento desta transação — recebimento bloqueado (iria travar e cancelar a venda). Confira a forma de recebimento e refaça a venda.',
        );
        return;
      }
      console.log('[PDV] Encerramento ok — parcelas:', installment);
      setClosed(true);
      beep(true);
    } catch (err) {
      setCloseError(`Falha na consulta: ${err.message}`);
    } finally {
      setClosing(false);
    }
  }, [saleResult, closing]);

  // Recebe o pagamento da transação recém-incluída (gera contas a receber
  // e dispara o faturamento — a transação vira "atendida")
  const receberPagamento = useCallback(async () => {
    if (!saleResult || receiving) return;
    setReceiving(true);
    setReceiveError('');
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/totvs/pdv/transaction-receiving`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchCode: saleResult.branchCode,
            transactionCode: saleResult.transactionCode,
            transactionDate: saleResult.transactionDate,
            totalAmount: saleResult.total,
            documentType: parseInt(receiveDocType, 10),
          }),
        },
      );
      const j = await r.json();
      if (!r.ok || !j.success) {
        setReceiveError(j?.message || 'TOTVS recusou o recebimento');
        return;
      }
      setReceiveDone(true);
      beep(true);
    } catch (err) {
      setReceiveError(`Falha na chamada: ${err.message}`);
    } finally {
      setReceiving(false);
    }
  }, [saleResult, receiving, receiveDocType]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        <PageTitle
          title="PDV RFID"
          subtitle="Bipe as peças com o leitor RFID e inclua a transação direto no TOTVS"
          icon={ShoppingCartSimple}
        />

        {/* Barra de configuração da venda */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <PersonPicker
            label="Cliente"
            icon={Storefront}
            value={customer}
            onSelect={setCustomer}
            placeholder="Nome, código ou CPF/CNPJ…"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Operação
              </label>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
              >
                <option value="">—</option>
                {operations.map((o) => (
                  <option key={o.operationCode} value={o.operationCode}>
                    {o.operationCode} — {o.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                CFOP
              </label>
              <input
                value={cfop}
                onChange={(e) => setCfop(e.target.value.replace(/\D/g, ''))}
                className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
              />
            </div>
          </div>
        </div>

        {/* Bipagem */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch gap-3">
          <form onSubmit={submitManual} className="flex-1 relative">
            <Barcode
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Digite ou bipe um código (EAN, código interno ou EPC RFID) e Enter…"
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-gray-300 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
            />
            {lookupBusy && (
              <Spinner
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
              />
            )}
          </form>

          {rfidSupported && (
            <button
              onClick={
                rfidStatus === 'desconectado' ? rfidConnect : rfidDisconnect
              }
              className={`h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl font-medium text-sm shadow-sm transition-colors ${
                rfidStatus === 'conectado'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100'
                  : rfidStatus === 'reconectando'
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                    : 'bg-[#000638] text-white hover:bg-[#000638]/90'
              }`}
            >
              {rfidStatus === 'conectado' ? (
                <>
                  <PlugsConnected size={18} /> Leitor RFID ativo
                </>
              ) : rfidStatus === 'reconectando' ? (
                <>
                  <ArrowsClockwise size={18} className="animate-spin" />{' '}
                  Reconectando…
                </>
              ) : (
                <>
                  <Plugs size={18} /> Conectar leitor RFID
                </>
              )}
            </button>
          )}
        </div>
        {rfidError && (
          <p className="mt-1 text-xs text-amber-600">{rfidError}</p>
        )}

        {/* Grid principal: itens + resumo */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4 items-start">
          {/* Tabela de itens */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 w-10">#</th>
                  <th className="px-2 py-2.5">Produto</th>
                  <th className="px-2 py-2.5 w-20 text-center">Qtde</th>
                  <th className="px-2 py-2.5 w-28 text-right">Vl. unit.</th>
                  <th className="px-2 py-2.5 w-28 text-right">Desc. unit.</th>
                  <th className="px-2 py-2.5 w-28 text-right">Total</th>
                  <th className="px-2 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <Broadcast
                        size={34}
                        className="mx-auto mb-2 text-gray-300"
                      />
                      <p className="text-gray-400 text-sm">
                        Nenhum item ainda — aproxime uma peça do leitor ou
                        digite o código acima.
                      </p>
                    </td>
                  </tr>
                )}
                {items.map((i, idx) => (
                  <tr key={i.key} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <p className="font-medium text-[#000638] leading-tight">
                        {i.productName}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        cód. {i.productCode}
                        {i.sku ? ` · EAN ${i.sku}` : ''}
                        {i.isRfid && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                            <Broadcast size={10} /> RFID
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={i.qty}
                        onChange={(e) =>
                          updateItem(i.key, {
                            qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-16 h-8 rounded-lg border border-gray-200 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={i.unitValue}
                        onChange={(e) =>
                          updateItem(i.key, {
                            unitValue: parseFloat(e.target.value) || 0,
                          })
                        }
                        className={`w-24 h-8 rounded-lg border text-right text-sm px-2 focus:outline-none focus:ring-2 focus:ring-[#000638]/30 ${
                          i.unitValue > 0
                            ? 'border-gray-200'
                            : 'border-rose-300 bg-rose-50'
                        }`}
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={i.discount}
                        onChange={(e) =>
                          updateItem(i.key, {
                            discount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-24 h-8 rounded-lg border border-gray-200 text-right text-sm px-2 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-[#000638]">
                      {fmtBRL(i.qty * (i.unitValue - (i.discount || 0)))}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => removeItem(i.key)}
                        className="text-gray-300 hover:text-rose-500 transition-colors"
                        title="Remover item"
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumo / fechamento */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:sticky lg:top-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <CreditCard size={17} /> Fechamento
            </h2>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Condição de pagamento
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
            >
              <option value="">Selecione…</option>
              {conditions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Forma de recebimento
            </label>
            <select
              value={receiveDocType}
              onChange={(e) => setReceiveDocType(e.target.value)}
              className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-600 mb-4 select-none">
              <input
                type="checkbox"
                checked={isPreSale}
                onChange={(e) => setIsPreSale(e.target.checked)}
                className="accent-[#000638]"
              />
              Gerar como pré-venda
            </label>

            <div className="space-y-1.5 text-sm border-t border-gray-100 pt-3">
              <div className="flex justify-between text-gray-500">
                <span>Itens</span>
                <span className="tabular-nums">{totals.qty}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmtBRL(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Descontos</span>
                <span className="tabular-nums">
                  − {fmtBRL(totals.discounts)}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="text-2xl font-bold text-[#000638] tabular-nums">
                  {fmtBRL(totals.total)}
                </span>
              </div>
            </div>

            <button
              onClick={finalizar}
              disabled={!canFinish}
              className="mt-4 w-full h-12 rounded-xl bg-[#000638] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#000638]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {posting ? (
                <>
                  <Spinner size={18} className="animate-spin" /> Enviando ao
                  TOTVS…
                </>
              ) : (
                <>
                  <CheckCircle size={18} weight="bold" /> Finalizar venda
                </>
              )}
            </button>
            {!canFinish && items.length > 0 && (
              <p className="mt-2 text-[11px] text-gray-400 text-center">
                Preencha empresa, vendedor, cliente, operação, condição e
                valores dos itens.
              </p>
            )}
          </div>
        </div>

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

        {/* Modal de venda concluída + recebimento */}
        {saleResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
              <CheckCircle
                size={48}
                weight="fill"
                className={`mx-auto mb-3 ${
                  receiveDone ? 'text-emerald-500' : 'text-blue-500'
                }`}
              />
              <h3 className="text-lg font-bold text-[#000638]">
                {receiveDone
                  ? 'Venda atendida!'
                  : saleResult.isPreSale
                    ? 'Pré-venda gerada — finalize no caixa TOTVS'
                    : 'Transação incluída — aguardando recebimento'}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Nº da transação{' '}
                <span className="font-mono font-bold text-[#000638]">
                  {saleResult.transactionCode}
                </span>
                <br />
                Empresa {saleResult.branchCode} ·{' '}
                {fmtBRL(saleResult.total)}
                {saleResult.preSaleCode ? (
                  <>
                    <br />
                    Pré-venda{' '}
                    <span className="font-mono font-bold">
                      {saleResult.preSaleCode}
                    </span>
                  </>
                ) : null}
              </p>

              {!receiveDone && !saleResult.isPreSale && (
                <div className="mt-4 text-left bg-gray-50 rounded-xl p-3 ring-1 ring-gray-200 space-y-2">
                  {/* Etapa 1 — Encerrar venda: confirma no TOTVS que o plano
                      de pagamento foi gravado antes de liberar o recebimento */}
                  <button
                    onClick={encerrarVenda}
                    disabled={closing || closed}
                    className={`w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                      closed
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300 cursor-default'
                        : 'bg-[#000638] text-white hover:bg-[#000638]/90 disabled:opacity-50'
                    }`}
                  >
                    {closing ? (
                      <>
                        <Spinner size={16} className="animate-spin" />{' '}
                        Encerrando…
                      </>
                    ) : closed ? (
                      <>
                        <CheckCircle size={16} weight="bold" /> Venda
                        encerrada
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} /> Encerrar venda
                      </>
                    )}
                  </button>
                  {closeError && (
                    <p className="text-xs text-rose-600">{closeError}</p>
                  )}

                  {/* Etapa 2 — Receber pagamento (habilita após encerrar) */}
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">
                    Forma de recebimento
                  </div>
                  <select
                    value={receiveDocType}
                    disabled={!closed}
                    onChange={(e) => setReceiveDocType(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={receberPagamento}
                    disabled={!closed || receiving}
                    title={closed ? '' : 'Encerre a venda primeiro'}
                    className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {receiving ? (
                      <>
                        <Spinner size={16} className="animate-spin" />{' '}
                        Recebendo… (pode levar minutos)
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} weight="bold" /> Receber
                        pagamento
                      </>
                    )}
                  </button>
                  {receiveError && (
                    <p className="text-xs text-rose-600">{receiveError}</p>
                  )}
                </div>
              )}

              {receiveDone && (
                <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3 ring-1 ring-emerald-200">
                  Pagamento recebido — contas a receber gerado e faturamento
                  disparado no TOTVS.
                </p>
              )}

              <button
                onClick={() => {
                  setSaleResult(null);
                  setReceiveDone(false);
                  setReceiveError('');
                  setClosed(false);
                  setCloseError('');
                }}
                className="mt-4 w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-semibold hover:bg-[#000638]/90"
              >
                {receiveDone ? 'Nova venda' : 'Fechar sem receber'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDVRfid;
