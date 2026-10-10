// Página: Tecnologia → Devolução RFID
// Mescla o ORÇAMENTO RFID com o PDV VAREJO para registrar devoluções:
//   • peças lidas pelo PORTAL RFID (1 etiqueta = 1 peça) ou por código manual
//   • preço pela MESMA REGRA DO ORÇAMENTO: tabela do cliente quando houver,
//     senão VENDA ATACADO (código 4)
//   • os EPCs ficam VISÍVEIS por item e podem ser exportados em CSV
//   • operação de devolução digitada pelo operador (campo livre)
//   • gera a transação "em andamento" no TOTVS e acompanha até ATENDIDA —
//     o caixa finaliza no TRAFP005 (Continuar Transação → Encerrar → Receber)
// Devoluções em andamento ficam salvas por usuário (localStorage).
//
// MODO NOTA FISCAL DO CLIENTE: quando o cliente (franquia = empresa no TOTVS)
// já emitiu a nota de devolução, a tela busca essa nota (mesma origem do
// FISFP082), confere peça a peça o que foi lido contra os itens da nota e gera
// a transação de entrada SÓ COM AS PEÇAS CONFERIDAS, pelo valor da nota (não
// da tabela de preço). O que falta ou sobra NÃO entra na transação — fica
// registrado em Devoluções de Mercadoria → Transações (recebido / faltando /
// sobrando). O recebimento/encerramento continua no TOTVS (TRAFM060/TRAFP005).
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  ArrowUUpLeft,
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
  Receipt,
  Gear,
  DownloadSimple,
  Copy,
  ClockCounterClockwise,
  UserPlus,
  Broadcast,
  WifiHigh,
  FileText,
  XCircle,
  SpeakerHigh,
  SpeakerSlash,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import PortalPotenciaModal from '../components/PortalPotenciaModal';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import {
  portalConnect,
  portalDisconnect,
  portalTags,
  portalClear,
  portalSetBeep,
} from '../utils/portalApi';

// ─── Config da devolução ─────────────────────────────────────────────────────
const DEVOLUCAO_CONFIG = {
  // CFOP 1202 = devolução de venda de mercadoria adquirida ou recebida de
  // terceiros (entrada). É o mesmo que o TOTVS usa nas operações de troca.
  cfop: 1202,
  // Condição provisória; o caixa define a real ao encerrar no TRAFP005
  paymentConditionCode: 1,
  // Mesma regra de preço do Orçamento: sem tabela do cliente, usa ATACADO
  priceCodes: '4',
  maxDescontoPct: 15,
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
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (ts) =>
  new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
                  <span className="block text-[11px] text-gray-400">{p.cpf}</span>
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
// Props (todas opcionais — a página solta funciona sem nenhuma):
//   embutido            esconde o título (quando vive dentro de outra página)
//   solicitacao         solicitação de devolução (Devoluções de Mercadoria):
//                       pré-preenche empresa, vendedor e cliente
//   onTransacaoGerada   (trx) chamado quando a transação nasce no TOTVS
//   onStatusTransacao   (trx, status) chamado a cada mudança de status
const DevolucaoRFID = ({ embutido = false, solicitacao = null, onTransacaoGerada, onStatusTransacao } = {}) => {
  const { user } = useAuth();
  const storageKey = `devolucao_rfid_drafts_${user?.email || user?.id || 'anon'}`;

  // Filtros
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(
    () => localStorage.getItem('dev_rfid_branch') || '',
  );
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState(
    () => localStorage.getItem('dev_rfid_seller') || '',
  );
  const [customer, setCustomer] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);

  // Operação de devolução: digitada pelo operador (memoriza a última)
  const [operacao, setOperacao] = useState(
    () => localStorage.getItem('dev_rfid_operacao') || '',
  );
  const [cfop, setCfop] = useState(
    () => localStorage.getItem('dev_rfid_cfop') || String(DEVOLUCAO_CONFIG.cfop),
  );
  const [operacaoSugerida, setOperacaoSugerida] = useState(null);

  // Portal RFID
  const [portalStatus, setPortalStatus] = useState({ status: 'desconectado' });
  const [portalBusy, setPortalBusy] = useState(false);
  const [potenciaOpen, setPotenciaOpen] = useState(false);
  // Som do portal (buzzer do aparelho a cada leitura). Preferência salva no
  // navegador e aplicada toda vez que o portal é ligado; o "bip" do HeadCoach
  // continua independente.
  const [somPortal, setSomPortal] = useState(() => localStorage.getItem('portal_som') !== 'off');
  const [somBusy, setSomBusy] = useState(false);

  // Itens
  const [items, setItems] = useState([]);
  const processedEpcs = useRef(new Set());
  const branchRef = useRef(branch);
  branchRef.current = branch;
  const priceTableRef = useRef(null);
  priceTableRef.current = customerInfo?.priceTableCode ?? null;

  // Devoluções salvas (por usuário)
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  const [globalDiscount, setGlobalDiscount] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [posting, setPosting] = useState(false);

  // Nota fiscal emitida pelo cliente (modo conferência)
  const hojeIso = () => new Date().toISOString().slice(0, 10);
  const [nf, setNf] = useState(null); // nota escolhida
  const [nfPainel, setNfPainel] = useState(false);
  const [nfLista, setNfLista] = useState(null); // null = ainda não buscou
  const [nfLoading, setNfLoading] = useState(false);
  const [nfErro, setNfErro] = useState('');
  const [nfDe, setNfDe] = useState(() => new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10));
  const [nfAte, setNfAte] = useState(hojeIso);
  const [forcarDivergencia, setForcarDivergencia] = useState(false);

  // Transação gerada
  const [trx, setTrx] = useState(null);
  const [trxStatus, setTrxStatus] = useState(null);
  const [trxChecking, setTrxChecking] = useState(false);

  useEffect(() => localStorage.setItem('dev_rfid_branch', branch), [branch]);
  useEffect(() => localStorage.setItem('dev_rfid_seller', seller), [seller]);
  useEffect(() => localStorage.setItem('dev_rfid_operacao', operacao), [operacao]);
  useEffect(() => localStorage.setItem('dev_rfid_cfop', cfop), [cfop]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Solicitação de devolução vinda da página Devoluções de Mercadoria:
  // empresa, vendedor e cliente já vêm preenchidos; a leitura começa do zero.
  useEffect(() => {
    if (!solicitacao) return;
    if (solicitacao.cliente_empresa) setBranch(String(solicitacao.cliente_empresa));
    if (solicitacao.vendedor_code) setSeller(String(solicitacao.vendedor_code));
    if (solicitacao.cliente_code) {
      setCustomer({ code: solicitacao.cliente_code, name: solicitacao.cliente_nome || `Cliente ${solicitacao.cliente_code}` });
      setCustomerInfo(null);
    }
    setItems([]);
    setTrx(null);
    setTrxStatus(null);
    setDraftId(null);
    processedEpcs.current = new Set();
  }, [solicitacao]);

  // ─── Cargas ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/branches`);
        const j = await r.json();
        setBranches(j?.data?.data || []);
      } catch {
        showToast('erro', 'Falha ao carregar as empresas do TOTVS');
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

  // Sugestão da operação de devolução cadastrada em Administração → Fiscal PDV
  useEffect(() => {
    setOperacaoSugerida(null);
    if (!branch) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/config/${branch}`);
        const j = await r.json();
        const op = j?.data?.config?.operacao_troca;
        if (op) setOperacaoSugerida(String(op));
      } catch {
        /* sem configuração fiscal: o operador digita */
      }
    })();
  }, [branch]);

  // Trocou de cliente: a nota escolhida e a lista não valem mais
  const clienteDaNota = useRef(null);
  useEffect(() => {
    const code = customer?.code ?? null;
    if (clienteDaNota.current === code) return;
    clienteDaNota.current = code;
    setNfLista(null);
    setNfErro('');
    setNf((atual) => (atual && atual.clienteCode === code ? atual : null));
    setForcarDivergencia(false);
  }, [customer]);

  // Dados do cliente (tabela de preço)
  useEffect(() => {
    if (!customer) {
      setCustomerInfo(null);
      return;
    }
    if (customerInfo?.code === customer.code) return;
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/customer/${customer.code}`,
        );
        const j = await r.json();
        if (j?.data) setCustomerInfo(j.data);
      } catch {
        showToast('erro', 'Falha ao buscar dados do cliente');
      }
    })();
  }, [customer, customerInfo, showToast]);

  // ─── Rascunhos salvos ────────────────────────────────────────────────────
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

  const salvarRascunho = useCallback(() => {
    if (items.length === 0) return;
    const id = draftId || `d${Date.now()}`;
    const registro = {
      id,
      em: Date.now(),
      branch,
      seller,
      operacao,
      cfop,
      customer,
      customerInfo,
      items,
      nf,
    };
    const lista = [registro, ...drafts.filter((d) => d.id !== id)].slice(0, 30);
    persistDrafts(lista);
    setDraftId(id);
    showToast('ok', 'Devolução salva para continuar depois');
  }, [items, draftId, branch, seller, operacao, cfop, customer, customerInfo, nf, drafts, persistDrafts, showToast]);

  const abrirRascunho = useCallback(
    (d) => {
      setBranch(d.branch || '');
      setSeller(d.seller || '');
      setOperacao(d.operacao || '');
      setCfop(d.cfop || String(DEVOLUCAO_CONFIG.cfop));
      setCustomer(d.customer || null);
      setCustomerInfo(d.customerInfo || null);
      setItems(d.items || []);
      clienteDaNota.current = d.customer?.code ?? null;
      setNf(d.nf || null);
      setDraftId(d.id);
      processedEpcs.current = new Set(
        (d.items || []).flatMap((i) => i.epcs || []),
      );
      setHistoricoOpen(false);
      showToast('ok', 'Devolução retomada');
    },
    [showToast],
  );

  const apagarRascunho = useCallback(
    (id) => {
      persistDrafts(drafts.filter((d) => d.id !== id));
      if (draftId === id) setDraftId(null);
    },
    [drafts, draftId, persistDrafts],
  );

  // ─── Portal RFID ─────────────────────────────────────────────────────────
  const portalLigado =
    portalStatus.status === 'lendo' ||
    portalStatus.status === 'conectando' ||
    portalStatus.status === 'reconectando';

  // Som do portal: manda o comando e guarda a preferência
  const aplicarSomPortal = useCallback(
    async (ligado, { avisar = true } = {}) => {
      setSomBusy(true);
      try {
        const j = await portalSetBeep(ligado);
        if (!j?.success) throw new Error(j?.message || 'o portal não aceitou');
        setSomPortal(j.data?.ligado ?? ligado);
        localStorage.setItem('portal_som', (j.data?.ligado ?? ligado) ? 'on' : 'off');
        if (avisar) showToast('ok', (j.data?.ligado ?? ligado) ? 'Som do portal ligado' : 'Som do portal desligado — só o bip do HeadCoach');
        return true;
      } catch (e) {
        if (avisar) showToast('erro', `Não deu para mudar o som do portal: ${e.message}`);
        return false;
      } finally {
        setSomBusy(false);
      }
    },
    [showToast],
  );

  const ligarPortal = useCallback(async () => {
    if (!branchRef.current) {
      beep(false);
      showToast('erro', 'Selecione a empresa antes de ligar o portal');
      return;
    }
    setPortalBusy(true);
    try {
      const j = await portalConnect({});
      if (!j.success) showToast('erro', j?.message || 'Falha ao ligar o portal');
      else {
        setPortalStatus(j.data);
        // o portal volta a apitar quando reinicia: reaplica a preferência de silêncio
        if (localStorage.getItem('portal_som') === 'off') aplicarSomPortal(false, { avisar: false });
      }
    } catch (e) {
      showToast(
        'erro',
        `Portal indisponível — instale/inicie o Agente do Portal nesta máquina (${e.message})`,
      );
    } finally {
      setPortalBusy(false);
    }
  }, [showToast, aplicarSomPortal]);

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

  // ─── Produtos: regra de preço do ORÇAMENTO ───────────────────────────────
  // Tabela do cliente quando houver; sem tabela, VENDA ATACADO (código 4).
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

  const consultarProduto = useCallback(
    async (code) => {
      const br = branchRef.current;
      if (!br) return null;
      const pt = priceTableRef.current;
      const qs = `?branch=${br}&priceCodes=${DEVOLUCAO_CONFIG.priceCodes}${pt ? `&priceTable=${pt}` : ''}`;
      const r = await fetch(
        `${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}${qs}`,
      );
      const j = await r.json();
      return { ok: r.ok && !!j?.data?.product, data: j?.data, message: j?.message };
    },
    [],
  );

  const resolverEpc = useCallback(
    async (epc) => {
      try {
        const res = await consultarProduto(epc);
        if (res?.ok) mergeProduto(res.data, { epc });
      } catch {
        /* tenta na próxima varredura */
      }
    },
    [consultarProduto, mergeProduto],
  );

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
      const res = await consultarProduto(code);
      if (!res?.ok) {
        beep(false);
        showToast('erro', res?.message || `Código ${code} não encontrado`);
        return;
      }
      mergeProduto(res.data, { manual: 1 });
      setManualCode('');
    } catch (e) {
      beep(false);
      showToast('erro', `Erro na consulta: ${e.message}`);
    } finally {
      setManualBusy(false);
    }
  }, [manualCode, manualBusy, consultarProduto, mergeProduto, showToast]);

  // Polling do portal
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const j = await portalTags();
        if (!j?.data) return;
        setPortalStatus(j.data.status);
        for (const t of j.data.tags || []) {
          if (!processedEpcs.current.has(t.epc)) {
            processedEpcs.current.add(t.epc);
            resolverEpc(t.epc);
          }
        }
      } catch {
        /* agente/backend fora */
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
    setItems((prev) => {
      const alvo = prev.find((i) => i.productCode === productCode);
      for (const e of alvo?.epcs || []) processedEpcs.current.delete(e);
      return prev.filter((i) => i.productCode !== productCode);
    });
  }, []);

  // Remove UMA etiqueta (bipada por engano) sem perder o resto do item
  const removerEpc = useCallback((productCode, epc) => {
    processedEpcs.current.delete(epc);
    setItems((prev) =>
      prev
        .map((i) =>
          i.productCode === productCode
            ? { ...i, epcs: i.epcs.filter((e) => e !== epc) }
            : i,
        )
        .filter((i) => qtyOf(i) > 0),
    );
  }, []);

  const aplicarDescontoGeral = useCallback(() => {
    const pct = parseFloat(String(globalDiscount).replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > DEVOLUCAO_CONFIG.maxDescontoPct) {
      showToast(
        'erro',
        `Desconto geral inválido (0 a ${DEVOLUCAO_CONFIG.maxDescontoPct}%)`,
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

  const limpar = useCallback(() => {
    setItems([]);
    processedEpcs.current = new Set();
    portalClear().catch(() => {});
  }, []);

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

  // ─── Nota fiscal do cliente ──────────────────────────────────────────────
  const buscarNotasCliente = useCallback(async () => {
    if (!customer) return;
    setNfLoading(true);
    setNfErro('');
    try {
      const qs = new URLSearchParams({ customer: customer.code, de: nfDe, ate: nfAte });
      if (branch) qs.set('branch', branch);
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/customer-invoices?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao buscar as notas');
      setNfLista(j.data.notas || []);
    } catch (e) {
      setNfErro(e.message);
      setNfLista([]);
    } finally {
      setNfLoading(false);
    }
  }, [customer, branch, nfDe, nfAte]);

  const escolherNota = useCallback(
    (nota) => {
      setNf({ ...nota, clienteCode: customer?.code ?? null, clienteNome: customer?.name ?? null });
      setNfPainel(false);
      setForcarDivergencia(false);
      beep(true);
    },
    [customer],
  );

  const removerNota = useCallback(() => {
    setNf(null);
    setForcarDivergencia(false);
  }, []);

  // Peça prevista na nota e ainda não lida: soma 1 "sem tag"
  const maisUmDaNota = useCallback(
    async (productCode) => {
      const existente = items.find((i) => i.productCode === productCode);
      if (existente) {
        ajustarManualQty(productCode, 1);
        return;
      }
      try {
        const res = await consultarProduto(productCode);
        if (res?.ok) mergeProduto(res.data, { manual: 1 });
        else showToast('erro', res?.message || `Produto ${productCode} não encontrado`);
      } catch (e) {
        showToast('erro', e.message);
      }
    },
    [items, ajustarManualQty, consultarProduto, mergeProduto, showToast],
  );

  // Conferência: o que a nota diz × o que foi lido (por produto)
  const conferencia = useMemo(() => {
    if (!nf) return null;
    const porProduto = new Map();
    for (const it of nf.itens || []) {
      const cur = porProduto.get(it.productCode) || {
        productCode: it.productCode,
        name: it.name,
        esperado: 0,
        totalNf: 0,
        unitNet: it.unitNet,
      };
      cur.esperado += Number(it.quantity);
      cur.totalNf += Number(it.quantity) * Number(it.unitNet);
      porProduto.set(it.productCode, cur);
    }
    const lidos = new Map(items.map((i) => [i.productCode, i]));
    const linhas = [...porProduto.values()]
      .map((l) => {
        const item = lidos.get(l.productCode) || null;
        const lido = item ? qtyOf(item) : 0;
        return {
          ...l,
          lido,
          item,
          situacao: lido === l.esperado ? 'ok' : lido < l.esperado ? 'falta' : 'sobra',
        };
      })
      .sort((a, b) => {
        const peso = { falta: 0, sobra: 1, ok: 2 };
        return peso[a.situacao] - peso[b.situacao] || String(a.name).localeCompare(String(b.name));
      });
    const fora = items.filter((i) => !porProduto.has(i.productCode));
    const esperado = linhas.reduce((s, l) => s + l.esperado, 0);
    const conferidas = linhas.reduce((s, l) => s + Math.min(l.lido, l.esperado), 0);
    const faltando = linhas.reduce((s, l) => s + Math.max(0, l.esperado - l.lido), 0);
    const sobrando = linhas.reduce((s, l) => s + Math.max(0, l.lido - l.esperado), 0) + fora.reduce((s, i) => s + qtyOf(i), 0);
    const totalNf = Number(
      (nf.itens || []).reduce((s, it) => s + Number(it.quantity) * (Number(it.unitGross) - Number(it.unitDiscount)), 0).toFixed(2),
    );

    // Só o que foi conferido entra na transação. A quantidade conferida de cada
    // produto é distribuída pelas linhas da nota na ordem em que aparecem (um
    // mesmo produto pode vir em mais de uma linha, com valores diferentes).
    const restante = new Map(linhas.map((l) => [l.productCode, Math.min(l.lido, l.esperado)]));
    const linhasPayload = [];
    const recebidoPorProduto = new Map();
    const faltaPorProduto = new Map();
    for (const it of nf.itens || []) {
      const disponivel = restante.get(it.productCode) || 0;
      const q = Math.min(Number(it.quantity), disponivel);
      const unitNet = Number(it.unitGross) - Number(it.unitDiscount);
      if (q > 0) {
        restante.set(it.productCode, disponivel - q);
        linhasPayload.push({ productCode: it.productCode, quantity: q, unitGross: Number(it.unitGross), unitDiscount: Number(it.unitDiscount) });
        const r = recebidoPorProduto.get(it.productCode) || { productCode: it.productCode, name: it.name, quantidade: 0, total: 0, unit: unitNet };
        r.quantidade += q;
        r.total += q * unitNet;
        recebidoPorProduto.set(it.productCode, r);
      }
      const naoVeio = Number(it.quantity) - q;
      if (naoVeio > 0) {
        const f = faltaPorProduto.get(it.productCode) || { productCode: it.productCode, name: it.name, quantidade: 0, total: 0, unit: unitNet };
        f.quantidade += naoVeio;
        f.total += naoVeio * unitNet;
        faltaPorProduto.set(it.productCode, f);
      }
    }
    const linhaDe = new Map(linhas.map((l) => [l.productCode, l]));
    const arred = (v) => Number(Number(v).toFixed(2));
    // EPCs do recebido: até o limite conferido (o excedente vai para "sobrando")
    const recebidos = [...recebidoPorProduto.values()].map((r) => {
      const l = linhaDe.get(r.productCode);
      return { ...r, total: arred(r.total), esperado: l.esperado, lido: l.lido, epcs: (l.item?.epcs || []).slice(0, r.quantidade) };
    });
    const faltantes = [...faltaPorProduto.values()].map((f) => {
      const l = linhaDe.get(f.productCode);
      return { ...f, total: arred(f.total), esperado: l.esperado, lido: l.lido, epcs: [] };
    });
    const sobras = [
      ...linhas
        .filter((l) => l.lido > l.esperado)
        .map((l) => ({
          productCode: l.productCode,
          name: l.name,
          quantidade: l.lido - l.esperado,
          esperado: l.esperado,
          lido: l.lido,
          motivo: 'excedente',
          epcs: (l.item?.epcs || []).slice(l.esperado),
        })),
      ...fora.map((i) => ({
        productCode: i.productCode,
        name: i.name,
        quantidade: qtyOf(i),
        esperado: 0,
        lido: qtyOf(i),
        motivo: 'fora_da_nota',
        epcs: i.epcs,
      })),
    ];
    const totalConferido = arred(linhasPayload.reduce((s, l) => s + l.quantity * (l.unitGross - l.unitDiscount), 0));
    return {
      linhas,
      fora,
      esperado,
      conferidas,
      faltando,
      sobrando,
      totalNf,
      totalConferido,
      valorFaltando: arred(faltantes.reduce((s, f) => s + f.total, 0)),
      linhasPayload,
      recebidos,
      faltantes,
      sobras,
      ok: faltando === 0 && sobrando === 0,
    };
  }, [nf, items]);

  const totals = useMemo(() => {
    const qty = items.reduce((s, i) => s + qtyOf(i), 0);
    const subtotal = items.reduce((s, i) => s + qtyOf(i) * i.unit, 0);
    const discounts = items.reduce((s, i) => s + qtyOf(i) * (i.discount || 0), 0);
    const epcs = items.reduce((s, i) => s + i.epcs.length, 0);
    return { qty, subtotal, discounts, epcs, total: subtotal - discounts };
  }, [items]);

  // ─── Exportação da lista de EPC ──────────────────────────────────────────
  const linhasEpc = useMemo(
    () =>
      items.flatMap((i) =>
        i.epcs.map((epc) => ({
          epc,
          productCode: i.productCode,
          nome: i.name,
          sku: i.sku || '',
          referencia: i.referenceName || '',
          unit: i.unit,
          discount: i.discount || 0,
          liquido: Number((i.unit - (i.discount || 0)).toFixed(2)),
        })),
      ),
    [items],
  );

  const exportarEpcsCsv = useCallback(() => {
    if (linhasEpc.length === 0) {
      showToast('erro', 'Nenhuma etiqueta lida para exportar');
      return;
    }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cabecalho = [
      'EPC',
      'Codigo',
      'Produto',
      'SKU',
      'Referencia',
      'Valor unit',
      'Desconto unit',
      'Valor liquido',
    ];
    const corpo = linhasEpc.map((l) =>
      [
        l.epc,
        l.productCode,
        l.nome,
        l.sku,
        l.referencia,
        String(l.unit).replace('.', ','),
        String(l.discount).replace('.', ','),
        String(l.liquido).replace('.', ','),
      ]
        .map(esc)
        .join(';'),
    );
    // BOM para o Excel abrir com acentuação correta
    const csv = `﻿${cabecalho.map(esc).join(';')}\n${corpo.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const quando = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `devolucao-epcs-${branch || 'empresa'}-${quando}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ok', `${linhasEpc.length} etiqueta(s) exportada(s)`);
  }, [linhasEpc, branch, showToast]);

  const copiarEpcs = useCallback(async () => {
    if (linhasEpc.length === 0) {
      showToast('erro', 'Nenhuma etiqueta lida para copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(linhasEpc.map((l) => l.epc).join('\n'));
      showToast('ok', `${linhasEpc.length} EPC(s) copiados`);
    } catch {
      showToast('erro', 'O navegador bloqueou a cópia');
    }
  }, [linhasEpc, showToast]);

  // ─── Gerar transação de devolução no TOTVS ───────────────────────────────
  const novaDevolucao = useCallback(() => {
    setItems([]);
    setCustomer(null);
    setCustomerInfo(null);
    setTrx(null);
    setTrxStatus(null);
    setDraftId(null);
    setNf(null);
    setNfLista(null);
    setForcarDivergencia(false);
    clienteDaNota.current = null;
    processedEpcs.current = new Set();
    portalClear().catch(() => {});
  }, []);

  const operacaoValida = /^\d+$/.test(String(operacao).trim());
  const cfopValido = /^\d{4}$/.test(String(cfop).trim());

  const baseOk = !posting && branch && customer && seller && operacaoValida && cfopValido;
  // Com nota do cliente: entram SÓ as peças conferidas (pelo valor da nota);
  // basta ter ao menos uma. Sem nota: vale o que foi lido, pela tabela.
  const canGenerate = nf
    ? baseOk && !nf.recebida && (conferencia?.conferidas || 0) > 0
    : baseOk && items.length > 0 && items.every((i) => qtyOf(i) > 0 && i.unit > 0);

  const gerarTransacao = useCallback(async () => {
    if (!canGenerate) return;
    setPosting(true);
    try {
      const itensPayload = nf
        ? // só as peças CONFERIDAS, pelo valor da nota do cliente
          conferencia.linhasPayload.map((it) => {
            const discountValue = Number(Number(it.unitDiscount || 0).toFixed(3));
            return {
              productCode: it.productCode,
              quantity: Number(it.quantity),
              value: Number(Number(it.unitGross).toFixed(3)),
              ...(discountValue > 0 ? { discountValue } : {}),
              cfop: parseInt(cfop, 10),
            };
          })
        : items.map((i) => {
            const q = qtyOf(i);
            const discountValue = Number(Number(i.discount || 0).toFixed(3));
            return {
              productCode: i.productCode,
              quantity: q,
              value: Number(Number(i.unit).toFixed(3)),
              ...(discountValue > 0 ? { discountValue } : {}),
              cfop: parseInt(cfop, 10),
            };
          });
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
        operationCode: parseInt(operacao, 10),
        paymentConditionCode: DEVOLUCAO_CONFIG.paymentConditionCode,
        isPreSale: false,
        status: 1,
        totalAmountTransaction: totalExato,
        items: itensPayload,
        // Observação da transação (máx. 80 caracteres por linha no TOTVS):
        // deixa registrado de qual nota do cliente esta entrada veio
        ...(nf
          ? {
              observations: [
                { observation: `REF NF ${nf.invoiceCode}/${nf.serialCode} DE ${nf.invoiceDate.split('-').reverse().join('/')} EMP ${nf.branchCode} - HEADCOACH`.slice(0, 80) },
                ...(nf.accessKey ? [{ observation: `CHAVE ${nf.accessKey}`.slice(0, 80) }] : []),
                ...(conferencia && !conferencia.ok
                  ? [{ observation: `PARCIAL: RECEBIDAS ${conferencia.conferidas} DE ${conferencia.esperado} - FALTAM ${conferencia.faltando} SOBRAM ${conferencia.sobrando}`.slice(0, 80) }]
                  : []),
              ],
            }
          : {}),
      };
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        beep(false);
        showToast('erro', j?.message || 'TOTVS recusou a devolução');
        return;
      }
      const nova = {
        ...j.data,
        total: totalExato,
        operacao: parseInt(operacao, 10),
        cfop: parseInt(cfop, 10),
        qtdEpcs: totals.epcs,
        customerCode: customer.code,
        // com nota, só os EPCs das peças que entraram (sobras ficam de fora)
        epcs: nf ? conferencia.recebidos.flatMap((r) => r.epcs) : items.flatMap((i) => i.epcs),
        nf: nf ? { invoiceCode: nf.invoiceCode, serialCode: nf.serialCode, accessKey: nf.accessKey, branchCode: nf.branchCode } : null,
      };
      setTrx(nova);
      setTrxStatus(1);
      beep(true);
      onTransacaoGerada?.(nova);

      // Registra a transação em Devoluções de Mercadoria → Transações, com o
      // detalhe do que entrou e do que ficou de fora (faltando / sobrando)
      try {
        const vend = sellers.find((sl) => String(sl.code) === String(seller));
        const semNota = items.map((i) => ({
          productCode: i.productCode,
          name: i.name,
          quantidade: qtyOf(i),
          unit: Number((i.unit - (i.discount || 0)).toFixed(2)),
          total: Number((qtyOf(i) * (i.unit - (i.discount || 0))).toFixed(2)),
          epcs: i.epcs,
        }));
        const rr = await fetch(`${API_BASE_URL}/api/devolucoes/transacoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            devolucaoId: solicitacao?.id || null,
            empresa: nova.branchCode,
            transactionCode: nova.transactionCode,
            transactionDate: nova.transactionDate,
            status: 1,
            operacao: nova.operacao,
            cfop: nova.cfop,
            total: totalExato,
            clienteCode: customer.code,
            clienteNome: customer.name,
            vendedorCode: parseInt(seller, 10),
            vendedorNome: vend?.name || null,
            nf: nf
              ? { invoiceCode: nf.invoiceCode, serialCode: nf.serialCode, invoiceDate: nf.invoiceDate, branchCode: nf.branchCode, accessKey: nf.accessKey, totalValue: nf.totalValue, quantity: nf.quantity }
              : null,
            recebidos: nf ? conferencia.recebidos : semNota,
            faltando: nf ? conferencia.faltantes : [],
            sobrando: nf ? conferencia.sobras : [],
            por: user?.name || user?.email || null,
          }),
        });
        const jr = await rr.json();
        if (rr.ok && jr.success) setTrx((t) => (t ? { ...t, registroId: jr.data.id } : t));
        else showToast('erro', `Transação gerada, mas o registro do detalhe falhou: ${jr?.message || ''}`);
      } catch (er) {
        showToast('erro', `Transação gerada, mas o registro do detalhe falhou: ${er.message}`);
      }
      // tira a devolução da lista de pendentes: virou transação
      if (draftId) apagarRascunho(draftId);
    } catch (e) {
      showToast('erro', `Falha ao gerar a devolução: ${e.message}`);
    } finally {
      setPosting(false);
    }
  }, [canGenerate, branch, customer, seller, sellers, operacao, cfop, items, totals.epcs, draftId, apagarRascunho, showToast, onTransacaoGerada, nf, conferencia, solicitacao, user]);

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

  useEffect(() => {
    if (!trx || trxStatus === 4 || trxStatus === 6) return undefined;
    const t = setInterval(verificarStatus, 10000);
    return () => clearInterval(t);
  }, [trx, trxStatus, verificarStatus]);

  const ultimoStatusAvisado = useRef(null);
  useEffect(() => {
    if (!trx || trxStatus == null) return;
    const chave = `${trx.transactionCode}:${trxStatus}`;
    if (ultimoStatusAvisado.current === chave) return;
    ultimoStatusAvisado.current = chave;
    onStatusTransacao?.(trx, trxStatus);
    if (trx.registroId && trxStatus !== 1) {
      fetch(`${API_BASE_URL}/api/devolucoes/transacoes/${trx.registroId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: trxStatus }),
      }).catch(() => {});
    }
  }, [trx, trxStatus, onStatusTransacao]);

  const stInfo = TRX_STATUS[trxStatus] || {
    label: `status ${trxStatus}`,
    cls: 'bg-gray-100 text-gray-600 ring-gray-200',
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-6xl mx-auto">
        {!embutido && (
          <PageTitle
            title="Devolução RFID"
            subtitle="Leia as peças pelo portal, confira os EPCs e gere a devolução no TOTVS (finalize no TRAFP005)"
            icon={ArrowUUpLeft}
          />
        )}
        {solicitacao && (
          <div className="mb-2 flex flex-wrap items-center gap-2 bg-blue-50 rounded-xl ring-1 ring-blue-200 px-3 py-2 text-xs text-[#000638]">
            <ArrowUUpLeft size={14} weight="bold" />
            <span>
              Solicitação <b>DEV-{solicitacao.id}</b> · {solicitacao.cliente_nome} · {solicitacao.qtd_pecas} peça(s) declarada(s) ·{' '}
              {solicitacao.tipo === 'defeito' ? 'peças com defeito (avaliadas pela Produção)' : 'devolução tradicional'}
            </span>
          </div>
        )}

        {/* Devoluções em andamento */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setHistoricoOpen((v) => !v)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 inline-flex items-center gap-1"
          >
            <ClockCounterClockwise size={14} /> Em andamento ({drafts.length})
          </button>
          <button
            onClick={salvarRascunho}
            disabled={items.length === 0}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-40"
          >
            Salvar para continuar depois
          </button>
          {draftId && (
            <span className="text-[11px] text-gray-500">
              Editando uma devolução salva
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={novaDevolucao}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-600 bg-white ring-1 ring-rose-200 shadow-sm hover:bg-rose-50"
          >
            Nova devolução
          </button>
        </div>

        {historicoOpen && (
          <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
            {drafts.length === 0 ? (
              <p className="text-xs text-gray-400">
                Nenhuma devolução salva. Use “Salvar para continuar depois”.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {drafts.map((d) => (
                  <li key={d.id} className="py-1.5 flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-24 shrink-0">{fmtData(d.em)}</span>
                    <span className="font-medium text-[#000638] truncate flex-1">
                      {d.customer?.name || 'Sem cliente'} · empresa {d.branch || '—'} ·{' '}
                      {(d.items || []).reduce((s, i) => s + qtyOf(i), 0)} pç
                    </span>
                    <button
                      onClick={() => abrirRascunho(d)}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      abrir
                    </button>
                    <button
                      onClick={() => apagarRascunho(d.id)}
                      className="text-gray-300 hover:text-rose-500"
                      title="Apagar"
                    >
                      <Trash size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Filtros: empresa, vendedor, cliente, operação, tabela de preço */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-2 lg:grid-cols-5 gap-2 items-start">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Empresa
            </label>
            <div className="relative">
              <Buildings size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
              <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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

          {/* Operação de devolução + CFOP */}
          <div>
            <label className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Operação de devolução
              {operacaoSugerida && operacaoSugerida !== String(operacao) && (
                <button
                  onClick={() => setOperacao(operacaoSugerida)}
                  className="normal-case font-semibold text-emerald-700 hover:underline"
                  title="Operação cadastrada em Administração → Fiscal PDV"
                >
                  usar {operacaoSugerida}
                </button>
              )}
            </label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Gear size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={operacao}
                  onChange={(e) => setOperacao(e.target.value.replace(/\D/g, ''))}
                  placeholder="código"
                  inputMode="numeric"
                  title="Código da operação de devolução no TOTVS"
                  className={`w-full h-9 pl-8 pr-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 ${
                    operacao && !operacaoValida ? 'border-rose-400' : 'border-gray-300'
                  }`}
                />
              </div>
              <input
                value={cfop}
                onChange={(e) => setCfop(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="CFOP"
                inputMode="numeric"
                title="CFOP dos itens (1202 = devolução de venda)"
                className={`h-9 w-16 px-1.5 rounded-lg border bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#000638]/30 ${
                  cfop && !cfopValido ? 'border-rose-400' : 'border-gray-300'
                }`}
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
              {nf ? (
                <>
                  <FileText size={13} /> Valores da nota fiscal
                </>
              ) : !customer ? (
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

        {/* Nota fiscal emitida pelo cliente (conferência + entrada espelhando a nota) */}
        <div className={`mb-2 rounded-xl border shadow-sm p-3 ${nf ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}>
          {nf ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#000638]">
              <span className="inline-flex items-center gap-1.5 font-bold">
                <FileText size={15} weight="bold" /> NF {nf.invoiceCode}/{nf.serialCode}
              </span>
              <span>{nf.invoiceDate.split('-').reverse().join('/')}</span>
              <span>empresa {nf.branchCode}</span>
              <span className="truncate max-w-[280px]" title={nf.operationName || ''}>
                {nf.operationCode} · {nf.operationName}
              </span>
              <span>
                <b>{nf.quantity}</b> peça(s) · <b>{fmtBRL(nf.totalValue)}</b>
              </span>
              {nf.recebida && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 ring-1 ring-rose-200 font-semibold">
                  <Warning size={11} weight="bold" /> já recebida · transação {nf.recebida.transactionCode}
                </span>
              )}
              {nf.paraEstaEmpresa === false && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200 font-semibold">
                  <Warning size={11} weight="bold" /> emitida para a empresa {nf.destinoBranch ?? '?'}
                </span>
              )}
              <div className="flex-1" />
              <button onClick={() => { setNfPainel(true); if (nfLista === null) buscarNotasCliente(); }} className="px-2 py-1 rounded-lg font-semibold ring-1 ring-indigo-300 hover:bg-white">
                trocar nota
              </button>
              <button onClick={removerNota} className="px-2 py-1 rounded-lg font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-white" title="Voltar para a devolução sem nota (preço da tabela)">
                remover
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <FileText size={16} className="text-[#000638]" />
              <div className="flex-1 min-w-[220px]">
                <p className="text-xs font-semibold text-[#000638]">O cliente já emitiu a nota de devolução?</p>
                <p className="text-[11px] text-gray-500">
                  Busque a nota dele para conferir as peças contra os itens e gerar a entrada com os valores da nota.
                </p>
              </div>
              <button
                onClick={() => { setNfPainel((v) => !v); if (!nfPainel && nfLista === null && customer) buscarNotasCliente(); }}
                disabled={!customer}
                className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-40"
                title={customer ? '' : 'Selecione o cliente primeiro'}
              >
                Buscar nota do cliente
              </button>
            </div>
          )}

          {nfPainel && (
            <div className="mt-2 pt-2 border-t border-gray-200/70">
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Emissão de</label>
                  <input type="date" value={nfDe} onChange={(e) => setNfDe(e.target.value)} className="h-8 px-2 rounded-lg border border-gray-300 text-xs mb-0 w-auto" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">até</label>
                  <input type="date" value={nfAte} onChange={(e) => setNfAte(e.target.value)} className="h-8 px-2 rounded-lg border border-gray-300 text-xs mb-0 w-auto" />
                </div>
                <button onClick={buscarNotasCliente} disabled={nfLoading || !customer} className="h-8 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1.5">
                  <ArrowsClockwise size={13} className={nfLoading ? 'animate-spin' : ''} /> Buscar
                </button>
                <div className="flex-1" />
                <button onClick={() => setNfPainel(false)} className="text-gray-400 hover:text-gray-600"><X size={15} weight="bold" /></button>
              </div>
              {nfErro && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200">{nfErro}</p>}
              {nfLoading && <p className="text-xs text-gray-400 py-2 inline-flex items-center gap-1.5"><Spinner size={13} className="animate-spin" /> Buscando as notas do cliente no TOTVS…</p>}
              {!nfLoading && nfLista && nfLista.length === 0 && !nfErro && (
                <p className="text-xs text-gray-500 py-1">Nenhuma nota emitida pelo cliente para a Crosby neste período.</p>
              )}
              {!nfLoading && nfLista && nfLista.length > 0 && (
                <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200 bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">NF</th>
                        <th className="px-2 py-1.5 text-left">Emissão</th>
                        <th className="px-2 py-1.5 text-left">Operação</th>
                        <th className="px-2 py-1.5 text-left">Destino</th>
                        <th className="px-2 py-1.5 text-right">Peças</th>
                        <th className="px-2 py-1.5 text-right">Total</th>
                        <th className="px-2 py-1.5 text-left">Situação</th>
                        <th className="px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {nfLista.map((n) => (
                        <tr key={`${n.invoiceCode}-${n.serialCode}-${n.invoiceSequence}`} className={`hover:bg-gray-50/60 ${n.recebida ? 'opacity-60' : ''}`}>
                          <td className="px-2 py-1.5 font-mono font-bold text-[#000638]">{n.invoiceCode}/{n.serialCode}</td>
                          <td className="px-2 py-1.5">{n.invoiceDate.split('-').reverse().join('/')}</td>
                          <td className="px-2 py-1.5 truncate max-w-[260px]" title={n.operationName || ''}>{n.operationCode} · {n.operationName}</td>
                          <td className="px-2 py-1.5">
                            {n.destinoBranch ?? '—'}
                            {n.paraEstaEmpresa === false && <span className="ml-1 text-amber-600">(outra empresa)</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{n.quantity}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(n.totalValue)}</td>
                          <td className="px-2 py-1.5">
                            {n.recebida ? (
                              <span className="text-rose-600 font-semibold">recebida · trx {n.recebida.transactionCode}</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">não processada</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <button onClick={() => escolherNota(n)} className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90">
                              conferir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid: produtos + coluna de ações */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-2 items-start">
          {nf && conferencia ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-[#000638]">Conferência com a nota</span>
              <span className="text-emerald-700"><b>{conferencia.conferidas}</b> de {conferencia.esperado} conferidas</span>
              {conferencia.faltando > 0 && <span className="text-amber-700"><b>{conferencia.faltando}</b> faltando</span>}
              {conferencia.sobrando > 0 && <span className="text-rose-700"><b>{conferencia.sobrando}</b> sobrando</span>}
              {conferencia.ok && <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle size={14} weight="fill" /> tudo confere</span>}
            </div>
            <div className="max-h-[52vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 bg-gray-50">Produto da nota e etiquetas lidas</th>
                    <th className="px-2 py-2 w-16 text-center bg-gray-50">Nota</th>
                    <th className="px-2 py-2 w-24 text-center bg-gray-50">Lido</th>
                    <th className="px-2 py-2 w-24 text-center bg-gray-50">Situação</th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">Vl. nota</th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {conferencia.linhas.map((l) => (
                    <tr key={l.productCode} className={`align-top ${l.situacao === 'ok' ? '' : l.situacao === 'falta' ? 'bg-amber-50/50' : 'bg-rose-50/50'}`}>
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-[#000638] leading-tight text-[13px]">{l.name}</p>
                        <p className="text-[11px] text-gray-400">cód. {l.productCode}{l.item?.manualQty > 0 ? ` · ${l.item.manualQty} sem tag` : ''}</p>
                        {l.item?.epcs?.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {l.item.epcs.map((epc) => (
                              <span key={epc} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 font-mono text-[10px]">
                                <Tag size={9} />
                                {epc}
                                <button onClick={() => removerEpc(l.productCode, epc)} className="text-purple-300 hover:text-rose-600"><X size={9} weight="bold" /></button>
                              </span>
                            ))}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-[#000638] tabular-nums">{l.esperado}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="inline-flex items-center gap-1">
                          {l.item?.manualQty > 0 && (
                            <button onClick={() => ajustarManualQty(l.productCode, -1)} className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center" title="Diminuir (sem tag)">
                              <Minus size={10} weight="bold" />
                            </button>
                          )}
                          <span className="font-bold tabular-nums min-w-[1.25rem] text-[13px]">{l.lido}</span>
                          <button onClick={() => maisUmDaNota(l.productCode)} className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center" title="Conferir 1 sem etiqueta">
                            <Plus size={10} weight="bold" />
                          </button>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {l.situacao === 'ok' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10px] font-semibold"><CheckCircle size={10} weight="bold" /> ok</span>
                        ) : l.situacao === 'falta' ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-semibold">falta {l.esperado - l.lido}</span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200 text-[10px] font-semibold">sobra {l.lido - l.esperado}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[13px] text-gray-700">{fmtBRL(l.unitNet)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[13px] font-semibold text-[#000638]">{fmtBRL(l.totalNf)}</td>
                    </tr>
                  ))}
                  {conferencia.fora.length > 0 && (
                    <tr className="bg-rose-100/70">
                      <td colSpan={6} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                        Lidas que NÃO estão na nota ({conferencia.fora.reduce((sm, i) => sm + qtyOf(i), 0)})
                      </td>
                    </tr>
                  )}
                  {conferencia.fora.map((i) => (
                    <tr key={`fora-${i.productCode}`} className="bg-rose-50/50 align-top">
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-rose-800 leading-tight text-[13px]">{i.name}</p>
                        <p className="text-[11px] text-gray-400">cód. {i.productCode}</p>
                        {i.epcs.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {i.epcs.map((epc) => (
                              <span key={epc} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white text-rose-700 ring-1 ring-rose-200 font-mono text-[10px]">
                                <Tag size={9} /> {epc}
                                <button onClick={() => removerEpc(i.productCode, epc)} className="text-rose-300 hover:text-rose-600"><X size={9} weight="bold" /></button>
                              </span>
                            ))}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-400">0</td>
                      <td className="px-2 py-1.5 text-center font-bold tabular-nums">{qtyOf(i)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 ring-1 ring-rose-200 text-[10px] font-semibold"><XCircle size={10} weight="bold" /> fora da nota</span>
                      </td>
                      <td />
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => removeItem(i.productCode)} className="text-gray-300 hover:text-rose-500" title="Remover"><Trash size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="max-h-[52vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 bg-gray-50">Produto e etiquetas (EPC)</th>
                    <th className="px-2 py-2 w-24 text-center bg-gray-50">Qtd</th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">Vl. unit.</th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">Desc. unit.</th>
                    <th className="px-2 py-2 w-24 text-right bg-gray-50">Total</th>
                    <th className="px-2 py-2 w-8 bg-gray-50" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <Broadcast size={28} className="mx-auto mb-1.5 text-gray-300" />
                        <p className="text-gray-400 text-xs">
                          {portalLigado
                            ? 'Portal ligado — passe as peças pelo portal.'
                            : 'Ligue o portal ou adicione as peças por código.'}
                        </p>
                      </td>
                    </tr>
                  )}
                  {grupos.map((g) => (
                    <React.Fragment key={g.nome}>
                      <tr className="bg-gray-100/80">
                        <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#000638]">
                          {g.nome}
                        </td>
                        <td className="px-2 py-1 text-right text-[10px] font-bold text-[#000638] whitespace-nowrap">
                          {g.qty} pç · {fmtBRL(g.total)}
                        </td>
                        <td />
                      </tr>
                      {g.items.map((i) => (
                        <tr key={i.productCode} className="hover:bg-gray-50/60 align-top">
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
                              ) : i.fonte === 'atacado' ? (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                                  atacado
                                </span>
                              ) : (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                                  sem preço
                                </span>
                              )}
                              {i.manualQty > 0 && (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-gray-100 text-gray-600 ring-1 ring-gray-200">
                                  {i.manualQty} sem tag
                                </span>
                              )}
                            </p>
                            {/* EPCs lidos — visíveis e removíveis um a um */}
                            {i.epcs.length > 0 && (
                              <p className="mt-1 flex flex-wrap gap-1">
                                {i.epcs.map((epc) => (
                                  <span
                                    key={epc}
                                    className="group inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 font-mono text-[10px]"
                                    title="Clique no x para remover esta etiqueta"
                                  >
                                    <Tag size={9} />
                                    {epc}
                                    <button
                                      onClick={() => removerEpc(i.productCode, epc)}
                                      className="text-purple-300 hover:text-rose-600"
                                    >
                                      <X size={9} weight="bold" />
                                    </button>
                                  </span>
                                ))}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className="inline-flex items-center gap-1">
                              {i.manualQty > 0 && (
                                <button
                                  onClick={() => ajustarManualQty(i.productCode, -1)}
                                  className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                                  title="Diminuir (sem tag)"
                                >
                                  <Minus size={10} weight="bold" />
                                </button>
                              )}
                              <span className="font-bold text-[#000638] tabular-nums min-w-[1.25rem] text-[13px]">
                                {qtyOf(i)}
                              </span>
                              <button
                                onClick={() => ajustarManualQty(i.productCode, 1)}
                                className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                                title="Adicionar 1 (sem tag)"
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
                              max={Number(((i.unit * DEVOLUCAO_CONFIG.maxDescontoPct) / 100).toFixed(2))}
                              step="0.01"
                              value={i.discount}
                              title={`Máx. ${DEVOLUCAO_CONFIG.maxDescontoPct}%: ${fmtBRL((i.unit * DEVOLUCAO_CONFIG.maxDescontoPct) / 100)}`}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                updateItem(i.productCode, {
                                  discount: Math.min(
                                    Math.max(v, 0),
                                    Number(((i.unit * DEVOLUCAO_CONFIG.maxDescontoPct) / 100).toFixed(2)),
                                  ),
                                });
                              }}
                              className="w-20 h-7 rounded-md border border-gray-200 text-right text-[13px] px-1.5 mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#000638] text-[13px]">
                            {fmtBRL(qtyOf(i) * (i.unit - (i.discount || 0)))}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => removeItem(i.productCode)}
                              className="text-gray-300 hover:text-rose-500 transition-colors"
                              title="Remover item"
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
          )}

          {/* Coluna direita */}
          <div className="space-y-2 lg:sticky lg:top-2">
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

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setPotenciaOpen(true)}
                  className="h-8 inline-flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                  title="Alcance de leitura das antenas"
                >
                  <WifiHigh size={13} weight="bold" /> Potência
                </button>
                <button
                  onClick={() => aplicarSomPortal(!somPortal)}
                  disabled={somBusy}
                  className={`h-8 inline-flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold ring-1 disabled:opacity-50 ${
                    somPortal ? 'text-[#000638] ring-gray-300 hover:bg-gray-50' : 'text-rose-700 ring-rose-300 bg-rose-50 hover:bg-rose-100'
                  }`}
                  title={somPortal ? 'Portal apita a cada leitura — clique para silenciar (fica só o bip do HeadCoach)' : 'Portal em silêncio — clique para voltar a apitar'}
                >
                  {somBusy ? <Spinner size={13} className="animate-spin" /> : somPortal ? <SpeakerHigh size={13} weight="bold" /> : <SpeakerSlash size={13} weight="bold" />}
                  {somPortal ? 'Som do portal' : 'Portal mudo'}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  adicionarManual();
                }}
                className="relative"
              >
                <Barcode size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Sem tag? SKU / cód. barras"
                  className="w-full h-9 pl-8 pr-8 rounded-lg border border-gray-300 bg-white text-xs mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
                {manualBusy && (
                  <Spinner size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </form>

              <div className="flex items-center gap-1.5">
                <Percent size={14} className="text-gray-400 shrink-0" />
                <input
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(e.target.value)}
                  placeholder="%"
                  title={`Desconto máximo: ${DEVOLUCAO_CONFIG.maxDescontoPct}%`}
                  className="h-9 w-14 px-1.5 rounded-lg border border-gray-300 text-xs text-center mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
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
                  title="Limpar itens e zerar a leitura do portal"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>

            {/* Exportação dos EPCs */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-gray-700">Etiquetas lidas</h2>
                <span className="text-xs font-bold text-purple-700 tabular-nums">{totals.epcs}</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={exportarEpcsCsv}
                  disabled={totals.epcs === 0}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                >
                  <DownloadSimple size={14} /> Exportar CSV
                </button>
                <button
                  onClick={copiarEpcs}
                  disabled={totals.epcs === 0}
                  className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40"
                  title="Copiar só os códigos EPC"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* Resumo + gerar devolução */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
              <h2 className="text-xs font-semibold text-gray-700 mb-2">Resumo da devolução</h2>
              {nf && conferencia ? (
                <div className="space-y-1 text-[13px]">
                  <div className="flex justify-between text-gray-500">
                    <span>Peças na nota</span>
                    <span className="tabular-nums">{conferencia.esperado}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Conferidas</span>
                    <span className="tabular-nums">{conferencia.conferidas}</span>
                  </div>
                  {conferencia.faltando > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Faltando</span>
                      <span className="tabular-nums">{conferencia.faltando}</span>
                    </div>
                  )}
                  {conferencia.sobrando > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Sobrando / fora da nota</span>
                      <span className="tabular-nums">{conferencia.sobrando}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500 pt-1.5 border-t border-gray-100">
                    <span>Total da nota</span>
                    <span className="tabular-nums">{fmtBRL(conferencia.totalNf)}</span>
                  </div>
                  {conferencia.valorFaltando > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Não conferido (fica fora)</span>
                      <span className="tabular-nums">− {fmtBRL(conferencia.valorFaltando)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                    <span className="font-semibold text-gray-700">Total a receber</span>
                    <span className="text-xl font-bold text-[#000638] tabular-nums">{fmtBRL(conferencia.totalConferido)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Só as peças conferidas entram na transação, pelo valor da nota. O que falta ou sobra fica registrado em
                    Devoluções de Mercadoria, aba Transações.
                  </p>
                </div>
              ) : (
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between text-gray-500">
                  <span>Peças</span>
                  <span className="tabular-nums">{totals.qty}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmtBRL(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Descontos</span>
                  <span className="tabular-nums">− {fmtBRL(totals.discounts)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                  <span className="font-semibold text-gray-700">Total devolvido</span>
                  <span className="text-xl font-bold text-[#000638] tabular-nums">
                    {fmtBRL(totals.total)}
                  </span>
                </div>
              </div>
              )}

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
                    <Receipt size={16} weight="bold" /> {nf ? `RECEBER ${conferencia?.conferidas || 0} PEÇA(S) CONFERIDA(S)` : 'GERAR DEVOLUÇÃO'}
                  </>
                )}
              </button>
              {!canGenerate && (items.length > 0 || nf) && (
                <p className="mt-1.5 text-[10px] text-gray-400 text-center">
                  {nf?.recebida
                    ? `Esta nota já foi recebida na transação ${nf.recebida.transactionCode}.`
                    : !operacaoValida
                      ? 'Digite o código da operação de devolução.'
                      : !cfopValido
                        ? 'CFOP inválido (4 dígitos, ex.: 1202).'
                        : nf && conferencia && conferencia.conferidas === 0
                          ? 'Confira ao menos uma peça da nota.'
                          : 'Preencha empresa, vendedor e cliente.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal: devolução gerada + acompanhamento até ATENDIDA */}
        {trx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
              <CheckCircle
                size={44}
                weight="fill"
                className={`mx-auto mb-2 ${
                  trxStatus === 4 ? 'text-emerald-500' : trxStatus === 6 ? 'text-rose-500' : 'text-blue-500'
                }`}
              />
              <h3 className="text-lg font-bold text-[#000638]">
                {trxStatus === 4
                  ? 'Devolução atendida!'
                  : trxStatus === 6
                    ? 'Transação cancelada'
                    : 'Devolução gerada!'}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Nº da transação{' '}
                <span className="font-mono font-bold text-[#000638] text-xl">
                  {trx.transactionCode}
                </span>
                <br />
                Empresa {trx.branchCode} · operação {trx.operacao} · CFOP {trx.cfop}
                {trx.nf && (
                  <>
                    <br />
                    Ref. NF do cliente {trx.nf.invoiceCode}/{trx.nf.serialCode} (empresa {trx.nf.branchCode})
                  </>
                )}
                <br />
                {fmtBRL(trx.total)} · {trx.qtdEpcs} etiqueta(s)
              </p>

              <div className="mt-3 flex items-center justify-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${stInfo.cls}`}>
                  {trxStatus !== 4 && trxStatus !== 6 && <Spinner size={12} className="animate-spin" />}
                  {stInfo.label}
                </span>
                <button
                  onClick={verificarStatus}
                  disabled={trxChecking}
                  className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
                  title="Verificar agora"
                >
                  <ArrowsClockwise size={12} className={trxChecking ? 'animate-spin' : ''} />
                  Atualizar
                </button>
              </div>

              {trxStatus !== 4 && trxStatus !== 6 && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 ring-1 ring-gray-200">
                  Finalize no caixa TOTVS: <b>TRAFP005</b> → Continuar Transação nº{' '}
                  <b>{trx.transactionCode}</b> → Encerrar → Receber. Esta tela atualiza sozinha a cada
                  10s.
                </p>
              )}
              {trxStatus === 4 && (
                <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-2.5 ring-1 ring-emerald-200">
                  Devolução processada no caixa — encerrada aqui também. ✅
                </p>
              )}

              <div className="mt-4 space-y-1.5">
                <button
                  onClick={exportarEpcsCsv}
                  disabled={totals.epcs === 0}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                >
                  <DownloadSimple size={13} /> Exportar a lista de EPC
                </button>
                {trxStatus === 4 || trxStatus === 6 ? (
                  <button
                    onClick={novaDevolucao}
                    className="w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90"
                  >
                    Nova devolução
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setTrx(null)}
                      className="w-full h-9 rounded-xl text-xs font-semibold text-gray-500 ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      Fechar e continuar (transação segue no caixa)
                    </button>
                    <button
                      onClick={novaDevolucao}
                      className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      Nova devolução agora
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {potenciaOpen && (
          <PortalPotenciaModal
            onClose={() => setPotenciaOpen(false)}
            onSaved={() => showToast('ok', 'Potência do portal gravada')}
          />
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
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

export default DevolucaoRFID;
