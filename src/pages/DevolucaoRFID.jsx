// Página: Tecnologia → Devolução RFID
// Mescla o ORÇAMENTO RFID com o PDV VAREJO para registrar devoluções:
//   • peças lidas pelo PORTAL RFID (1 etiqueta = 1 peça) ou por código manual
//   • preço pela MESMA REGRA DO ORÇAMENTO: tabela do cliente quando houver,
//     senão VENDA ATACADO (código 4)
//   • os EPCs ficam VISÍVEIS por item e podem ser exportados em CSV
//   • operação de devolução escolhida pelo operador (7243 / 7244 / 7245)
// Devoluções em andamento ficam salvas por usuário (localStorage).
//
// DEVOLUÇÃO 100% NO HEADCOACH (Yago, 17/11/2026): a tela NÃO gera mais transação
// no TOTVS. O operador busca as NOTAS DE VENDA do cliente, escolhe as que vai
// referenciar e encerra: o HeadCoach grava a transação (igual ao PDV Crosby e à
// tela de Transações), emite a NF-e de devolução e gera o CREDEV do cliente. O
// valor de cada peça é o que o cliente pagou na nota (não a tabela de preço) e
// peça que não está nas notas escolhidas não entra. Servidor:
// /api/devolucao-rfid (services/devolucaoRfidHc.js).
//
// MODO NOTA FISCAL DO CLIENTE: quando o cliente (franquia = empresa no TOTVS)
// já emitiu a nota de devolução, a tela busca essa nota (mesma origem do
// FISFP082), confere peça a peça o que foi lido contra os itens da nota e gera
// a transação de entrada SÓ COM AS PEÇAS CONFERIDAS, pelo valor da nota (não
// da tabela de preço). O que falta ou sobra NÃO entra na transação — fica
// registrado em Devoluções de Mercadoria → Transações (recebido / faltando /
// sobrando). Esse modo também não gera transação no TOTVS: a entrada da nota
// do cliente é dada à mão no FISFP082.
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
  FileArrowUp,
  Copy,
  ClockCounterClockwise,
  UserPlus,
  Broadcast,
  WifiHigh,
  FileText,
  XCircle,
  SpeakerHigh,
  SpeakerSlash,
  Printer,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import PortalPotenciaModal from '../components/PortalPotenciaModal';
import NotasVendaDevolucao, { OutraNotaModal } from '../components/devolucao/NotasVendaDevolucao';
import { imprimirDocumento } from '../utils/documentoFiscalHtml';
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
// Operações de devolução disponíveis (escolha obrigatória a cada devolução)
const OPERACOES_DEVOLUCAO = [
  { code: '7243', label: 'DEVOLUÇÕES FRANQUIAS' },
  { code: '7244', label: 'DEVOLUÇÕES MULTIMARCAS' },
  { code: '7245', label: 'DEVOLUÇÃO REVENDEDORES' },
];

const DEVOLUCAO_CONFIG = {
  // CFOP 1202 = devolução de venda de mercadoria adquirida ou recebida de
  // terceiros (entrada). É o mesmo que o TOTVS usa nas operações de troca.
  cfop: 1202,
  // Mesma regra de preço do Orçamento: sem tabela do cliente, usa ATACADO
  priceCodes: '4',
  maxDescontoPct: 15,
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
export function ClientePicker({ value, onSelect }) {
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
  // Operação de devolução: sempre escolhida na hora (não fica salva)
  const [operacao, setOperacao] = useState('');
  // CFOP fixo pela UF: cliente no mesmo estado da empresa → 1202; outro estado → 2202
  const [ufEmpresa, setUfEmpresa] = useState(null);
  const ufCliente = customerInfo?.uf || null;
  const cfop = ufEmpresa && ufCliente ? (ufEmpresa === ufCliente ? '1202' : '2202') : String(DEVOLUCAO_CONFIG.cfop);

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
  const [importBusy, setImportBusy] = useState(false);
  const txtInputRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [posting, setPosting] = useState(false);

  // Nota fiscal emitida pelo cliente (modo conferência)
  const hojeIso = () => new Date().toISOString().slice(0, 10);
  // Notas do cliente em conferência (pode ser mais de uma de uma vez)
  const [nfs, setNfs] = useState([]);
  const chaveNf = (n) => `${n.branchCode}-${n.invoiceSequence ?? `${n.invoiceCode}/${n.serialCode}`}`;
  // "nf" é a visão combinada das notas escolhidas: itens de todas, totais
  // somados, dados de referência da primeira (quem usa nf não precisa saber
  // se é uma ou várias)
  const nf = useMemo(() => {
    if (!nfs.length) return null;
    const [primeira] = nfs;
    return {
      ...primeira,
      notas: nfs,
      itens: nfs.flatMap((n) => (n.itens || []).map((it) => ({ ...it, nfRef: `${n.invoiceCode}/${n.serialCode}` }))),
      quantity: nfs.reduce((sm, n) => sm + Number(n.quantity || 0), 0),
      totalValue: nfs.reduce((sm, n) => sm + Number(n.totalValue || 0), 0),
      recebida: nfs.find((n) => n.recebida)?.recebida || null,
      paraEstaEmpresa: nfs.every((n) => n.paraEstaEmpresa !== false),
      destinoBranch: nfs.find((n) => n.paraEstaEmpresa === false)?.destinoBranch,
    };
  }, [nfs]);
  const [nfPainel, setNfPainel] = useState(false);
  const [nfLista, setNfLista] = useState(null); // null = ainda não buscou
  const [nfLoading, setNfLoading] = useState(false);
  const [nfErro, setNfErro] = useState('');
  const [nfDe, setNfDe] = useState(() => new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10));
  const [nfAte, setNfAte] = useState(hojeIso);
  const [forcarDivergencia, setForcarDivergencia] = useState(false);

  // Notas de VENDA do cliente que a devolução referencia (fluxo 100% HeadCoach)
  const [refNotas, setRefNotas] = useState([]);
  const [confRef, setConfRef] = useState(null); // conferência do servidor: peça × notas
  const [confBusy, setConfBusy] = useState(false);
  const [confErro, setConfErro] = useState('');
  const manterRefNotas = useRef(null); // rascunho retomado: não limpar as notas dele
  // Peça que não achou nas notas: outra nota só para ela { [productCode]: { chave, numero, serie } }
  const [avulsas, setAvulsas] = useState({});
  const [pecaOutraNota, setPecaOutraNota] = useState(null);

  // Transação gerada
  const [trx, setTrx] = useState(null);
  const [reemitindo, setReemitindo] = useState(false);

  useEffect(() => localStorage.setItem('dev_rfid_branch', branch), [branch]);
  useEffect(() => localStorage.setItem('dev_rfid_seller', seller), [seller]);
  useEffect(() => {
    setUfEmpresa(null);
    if (!branch) return undefined;
    let vivo = true;
    fetch(`${API_BASE_URL}/api/totvs/pdv/branch/${branch}`)
      .then((r) => r.json())
      .then((j) => {
        if (vivo && j?.success) setUfEmpresa(j.data?.uf || null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [branch]);

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


  // Trocou de cliente: a nota escolhida e a lista não valem mais
  const clienteDaNota = useRef(null);
  useEffect(() => {
    const code = customer?.code ?? null;
    if (clienteDaNota.current === code) return;
    clienteDaNota.current = code;
    setNfLista(null);
    setNfErro('');
    setNfs((atual) => atual.filter((n) => n.clienteCode === code));
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
      nfs,
      refNotas,
      avulsas,
    };
    const lista = [registro, ...drafts.filter((d) => d.id !== id)].slice(0, 30);
    persistDrafts(lista);
    setDraftId(id);
    showToast('ok', 'Devolução salva para continuar depois');
  }, [items, draftId, branch, seller, operacao, cfop, customer, customerInfo, nfs, refNotas, avulsas, drafts, persistDrafts, showToast]);

  const abrirRascunho = useCallback(
    (d) => {
      setBranch(d.branch || '');
      setSeller(d.seller || '');
      setOperacao(d.operacao || '');
      setCustomer(d.customer || null);
      setCustomerInfo(d.customerInfo || null);
      setItems(d.items || []);
      clienteDaNota.current = d.customer?.code ?? null;
      setNfs(d.nfs || (d.nf ? [d.nf] : []));
      manterRefNotas.current = `${d.customer?.code ?? ''}|${d.branch || ''}`;
      setRefNotas(d.refNotas || []);
      setAvulsas(d.avulsas || {});
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
  const mergeProduto = useCallback((data, { epc = null, manual = 0, silent = false }) => {
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
    if (!silent) beep(true);
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

  // Importa um .txt com os códigos (um por linha; repetido = +1 peça)
  const importarCodigosTxt = useCallback(
    async (file) => {
      if (!file) return;
      if (!branchRef.current) {
        beep(false);
        showToast('erro', 'Selecione a empresa antes de importar os códigos');
        return;
      }
      setImportBusy(true);
      try {
        const texto = await file.text();
        const codigos = texto
          .split(/[\s,;]+/)
          .map((c) => c.trim())
          .filter(Boolean);
        if (!codigos.length) {
          showToast('erro', 'O arquivo não tem códigos.');
          return;
        }
        // repetições viram quantidade
        const contagem = new Map();
        for (const c of codigos) contagem.set(c, (contagem.get(c) || 0) + 1);
        let okQtd = 0;
        const naoAchou = [];
        for (const [code, qtd] of contagem) {
          try {
            const res = await consultarProduto(code);
            if (res?.ok) {
              mergeProduto(res.data, { manual: qtd, silent: true });
              okQtd += qtd;
            } else {
              naoAchou.push(code);
            }
          } catch {
            naoAchou.push(code);
          }
        }
        if (okQtd > 0) beep(true);
        else beep(false);
        if (naoAchou.length) {
          showToast(
            'erro',
            `${okQtd} de ${codigos.length} peça(s) adicionada(s). Não encontrados (${naoAchou.length}): ${naoAchou.slice(0, 12).join(', ')}${naoAchou.length > 12 ? '…' : ''}`,
          );
        } else {
          showToast('ok', `${okQtd} peça(s) adicionadas do arquivo.`);
        }
      } catch (e) {
        showToast('erro', `Falha ao ler o arquivo: ${e.message}`);
      } finally {
        setImportBusy(false);
        if (txtInputRef.current) txtInputRef.current.value = '';
      }
    },
    [consultarProduto, mergeProduto, showToast],
  );

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

  // Adiciona a nota à conferência (ou tira, se já estava): várias notas podem
  // ser conferidas de uma vez — os itens de todas entram na mesma conferência
  const escolherNota = useCallback(
    (nota) => {
      setNfs((atual) => {
        const k = chaveNf(nota);
        if (atual.some((n) => chaveNf(n) === k)) return atual.filter((n) => chaveNf(n) !== k);
        return [...atual, { ...nota, clienteCode: customer?.code ?? null, clienteNome: customer?.name ?? null }];
      });
      setForcarDivergencia(false);
      beep(true);
    },
    [customer],
  );

  // Sem argumento tira todas; com a nota, só aquela
  const removerNota = useCallback((nota) => {
    setNfs((atual) => (nota ? atual.filter((n) => chaveNf(n) !== chaveNf(nota)) : []));
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

  // ─── Notas de venda referenciadas: o servidor confere peça × nota ────────
  // trocou de cliente ou de empresa: as notas escolhidas não valem mais
  useEffect(() => {
    const par = `${customer?.code ?? ''}|${branch || ''}`;
    if (manterRefNotas.current === par) {
      manterRefNotas.current = null;
      return;
    }
    setRefNotas([]);
    setAvulsas({});
    setConfRef(null);
    setConfErro('');
  }, [customer?.code, branch]);

  const itensConf = useMemo(
    () => items.map((i) => ({ productCode: i.productCode, quantidade: qtyOf(i) })).filter((i) => i.quantidade > 0),
    [items],
  );
  // outra nota por peça: só das peças que ainda estão na lista; valor = tabela do cliente
  const avulsasPayload = useMemo(
    () =>
      Object.entries(avulsas)
        .map(([cod, a]) => {
          const it = items.find((i) => String(i.productCode) === String(cod));
          return it ? { productCode: Number(cod), chave: a.chave, valorUnit: Number(it.unit) || 0 } : null;
        })
        .filter(Boolean),
    [avulsas, items],
  );
  const temRef = refNotas.length > 0 || avulsasPayload.length > 0;
  const assinaturaConf = useMemo(
    () => JSON.stringify([branch, customer?.code ?? null, refNotas.map((n) => n.chave), itensConf, avulsasPayload]),
    [branch, customer?.code, refNotas, itensConf, avulsasPayload],
  );
  const semNotaDoCliente = nfs.length === 0;
  useEffect(() => {
    if (!semNotaDoCliente || !branch || !customer?.code || !temRef || itensConf.length === 0) {
      setConfRef(null);
      setConfErro('');
      setConfBusy(false);
      return undefined;
    }
    let vivo = true;
    setConfBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/devolucao-rfid/conferir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa: parseInt(branch, 10), clienteCode: customer.code, itens: itensConf, chaves: refNotas.map((n) => n.chave), avulsas: avulsasPayload }),
        });
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok || !j.success) {
          setConfRef(null);
          setConfErro(j?.message || 'Não consegui conferir as peças nas notas');
        } else {
          setConfRef(j.data);
          setConfErro('');
        }
      } catch (e) {
        if (vivo) {
          setConfRef(null);
          setConfErro(e.message);
        }
      } finally {
        if (vivo) setConfBusy(false);
      }
    }, 450);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // a assinatura resume empresa, cliente, notas e peças
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinaturaConf, semNotaDoCliente]);
  const confPorProduto = useMemo(() => new Map((confRef?.itens || []).map((i) => [Number(i.productCode), i])), [confRef]);

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

  // ─── Encerrar a devolução (HeadCoach) ────────────────────────────────────
  const novaDevolucao = useCallback(() => {
    setItems([]);
    setCustomer(null);
    setCustomerInfo(null);
    setTrx(null);
    setDraftId(null);
    setRefNotas([]);
    setAvulsas({});
    setConfRef(null);
    setConfErro('');
    setNfs([]);
    setNfLista(null);
    setForcarDivergencia(false);
    clienteDaNota.current = null;
    processedEpcs.current = new Set();
    portalClear().catch(() => {});
  }, []);

  const operacaoValida = /^\d+$/.test(String(operacao).trim());
  const cfopValido = /^\d{4}$/.test(String(cfop).trim());

  const baseOk = !posting && branch && customer && seller && operacaoValida && cfopValido;
  // Com nota EMITIDA PELO CLIENTE: entram só as peças conferidas (valor da nota
  // dele). Sem ela (o normal): precisa das NOTAS DE VENDA referenciadas e de
  // todas as peças lidas dentro delas — o servidor confere.
  const canGenerate = nf
    ? baseOk && !nf.recebida && (conferencia?.conferidas || 0) > 0
    : baseOk && items.length > 0 && items.every((i) => qtyOf(i) > 0) && temRef && !!confRef?.ok && !confBusy;

  const gerarTransacao = useCallback(async () => {
    if (!canGenerate) return;
    setPosting(true);
    try {
      // Devolução com nota do cliente (FISFP082): NÃO gera transação no TOTVS.
      // O HeadCoach só confere as peças e registra o recebimento; a entrada é
      // feita manualmente no FISFP082. Registra direto na aba Transações.
      if (nf) {
        const vend = sellers.find((sl) => String(sl.code) === String(seller));
        const totalRecebido = Number(
          conferencia.recebidos.reduce((sm, r) => sm + Number(r.total || 0), 0).toFixed(2),
        );
        const epcsRecebidos = conferencia.recebidos.flatMap((r) => r.epcs);
        const rr = await fetch(`${API_BASE_URL}/api/devolucoes/transacoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origem: 'fisfp082',
            devolucaoId: solicitacao?.id || null,
            empresa: parseInt(branch, 10),
            operacao: parseInt(operacao, 10),
            cfop: parseInt(cfop, 10),
            total: totalRecebido,
            clienteCode: customer.code,
            clienteNome: customer.name,
            vendedorCode: parseInt(seller, 10),
            vendedorNome: vend?.name || null,
            nf: {
              invoiceCode: nf.invoiceCode,
              serialCode: nf.notas.length > 1 ? `${nf.serialCode} +${nf.notas.length - 1}` : nf.serialCode,
              invoiceDate: nf.invoiceDate,
              branchCode: nf.branchCode,
              accessKey: nf.notas.map((n) => n.accessKey).filter(Boolean).join(','),
              totalValue: nf.totalValue,
              quantity: nf.quantity,
            },
            recebidos: conferencia.recebidos,
            faltando: conferencia.faltantes,
            sobrando: conferencia.sobras,
            por: user?.name || user?.email || null,
          }),
        });
        const jr = await rr.json();
        if (!rr.ok || !jr.success) {
          beep(false);
          showToast('erro', jr?.message || 'Falha ao registrar o recebimento');
          return;
        }
        beep(true);
        const nova = {
          fisfp082: true,
          registroId: jr.data.id,
          branchCode: parseInt(branch, 10),
          operacao: parseInt(operacao, 10),
          cfop: parseInt(cfop, 10),
          total: totalRecebido,
          qtdEpcs: epcsRecebidos.length,
          customerCode: customer.code,
          epcs: epcsRecebidos,
          nf: { invoiceCode: nf.invoiceCode, serialCode: nf.serialCode, accessKey: nf.accessKey, branchCode: nf.branchCode, notas: nf.notas },
          conf: { conferidas: conferencia.conferidas, esperado: conferencia.esperado, faltando: conferencia.faltando, sobrando: conferencia.sobrando },
        };
        setTrx(nova);
        onTransacaoGerada?.(nova);
        if (draftId) apagarRascunho(draftId);
        return;
      }

      // Devolução pelas NOTAS DE VENDA do cliente — 100% HeadCoach: grava a
      // transação, emite a NF-e de devolução e gera o CREDEV. Nada vai ao TOTVS.
      const vend = sellers.find((sl) => String(sl.code) === String(seller));
      const emp = branches.find((b) => String(b.cd_empresa) === String(branch));
      const r = await fetch(`${API_BASE_URL}/api/devolucao-rfid/encerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: parseInt(branch, 10),
          empresaNome: emp?.nm_grupoempresa || null,
          cliente: { code: customer.code, nome: customer.name },
          vendedor: { code: parseInt(seller, 10), nome: vend?.name || null },
          operacao: parseInt(operacao, 10),
          itens: items.map((i) => ({ productCode: i.productCode, quantidade: qtyOf(i), epcs: i.epcs })),
          chaves: refNotas.map((n) => n.chave),
          avulsas: avulsasPayload,
          solicitacaoId: solicitacao?.id || null,
          criadoPor: user?.name || user?.email || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        beep(false);
        showToast('erro', j?.message || 'Não consegui encerrar a devolução');
        // o servidor refez a conferência: mostra o que ele recusou
        if (j?.details?.itens) setConfRef((c) => (c ? { ...c, ok: false, itens: j.details.itens } : c));
        return;
      }
      const d = j.data;
      const nova = {
        hc: true,
        vendaId: d.venda.id,
        venda: d.venda,
        nota: d.nota,
        emitente: d.emitente || null,
        autorizada: !!d.autorizada,
        erroEmissao: d.erroEmissao || null,
        credev: d.credev || null,
        branchCode: parseInt(branch, 10),
        transactionCode: d.venda.id,
        transactionDate: new Date().toISOString().slice(0, 10),
        total: Number(d.venda.total),
        operacao: parseInt(operacao, 10),
        qtdEpcs: totals.epcs,
        qtdPecas: Number(d.venda.qtd_pecas) || totals.qty,
        customerCode: customer.code,
        customerName: customer.name,
        epcs: items.flatMap((i) => i.epcs),
        notasRef: refNotas.map((n) => ({ numero: n.numero, serie: n.serie })),
      };
      setTrx(nova);
      beep(nova.autorizada);
      onTransacaoGerada?.(nova);
      if (nova.autorizada) onStatusTransacao?.(nova, 4);
      // tira a devolução da lista de pendentes: virou transação
      if (draftId) apagarRascunho(draftId);
    } catch (e) {
      showToast('erro', `Falha ao encerrar a devolução: ${e.message}`);
    } finally {
      setPosting(false);
    }
  }, [canGenerate, branch, branches, customer, seller, sellers, operacao, cfop, items, totals.epcs, totals.qty, draftId, apagarRascunho, showToast, onTransacaoGerada, onStatusTransacao, nf, conferencia, solicitacao, user, refNotas, avulsasPayload]);

  // ─── NF-e de devolução rejeitada: tentar de novo ou cancelar a transação ──
  const reemitirDevolucao = useCallback(async () => {
    if (!trx?.hc || trx.autorizada || reemitindo) return;
    setReemitindo(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${trx.vendaId}/emitir`, { method: 'POST' });
      const j = await r.json();
      const d = j.data || {};
      const autorizada = r.ok && d.nota?.status === 'autorizada';
      const nova = {
        ...trx,
        venda: d.venda || trx.venda,
        nota: d.nota || trx.nota,
        emitente: d.emitente || trx.emitente,
        autorizada,
        erroEmissao: autorizada ? null : j?.message || 'A nota não foi autorizada',
        credev: autorizada ? { gerado: trx.total, saldo: null } : null,
      };
      setTrx(nova);
      beep(autorizada);
      if (autorizada) onStatusTransacao?.(nova, 4);
    } catch (e) {
      showToast('erro', `Falha ao emitir: ${e.message}`);
    } finally {
      setReemitindo(false);
    }
  }, [trx, reemitindo, onStatusTransacao, showToast]);

  const cancelarDevolucao = useCallback(async () => {
    if (!trx?.hc || trx.autorizada || reemitindo) return;
    if (!window.confirm(`Cancelar a transação ${trx.vendaId}? A nota não foi emitida; as peças ficam livres para outra devolução.`)) return;
    setReemitindo(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${trx.vendaId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Devolução RFID: NF-e não emitida', por: user?.name || user?.email || null }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Não consegui cancelar');
      onStatusTransacao?.(trx, 6);
      setTrx(null);
      showToast('ok', `Transação ${trx.vendaId} cancelada`);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setReemitindo(false);
    }
  }, [trx, reemitindo, user, onStatusTransacao, showToast]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-6xl mx-auto">
        {!embutido && (
          <PageTitle
            title="Devolução RFID"
            subtitle="Leia as peças pelo portal, escolha as notas de venda do cliente e encerre: o HeadCoach emite a NF-e de devolução e gera o Credev"
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

          {/* Operação de devolução (sempre escolhida) + CFOP fixo pela UF */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Operação de devolução
            </label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Gear size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={operacao}
                  onChange={(e) => setOperacao(e.target.value)}
                  title="Operação da devolução — escolha a cada devolução"
                  className={`w-full h-9 pl-8 pr-2 mb-0 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 ${
                    operacao ? 'border-gray-300' : 'border-amber-400'
                  }`}
                >
                  <option value="">Selecione a operação…</option>
                  {OPERACOES_DEVOLUCAO.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.code} - {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={`h-9 w-[4.5rem] px-1.5 rounded-lg border bg-gray-50 text-sm text-center leading-9 font-semibold ${
                  ufEmpresa && ufCliente ? 'border-gray-300 text-[#000638]' : 'border-amber-300 text-amber-700'
                }`}
                title={
                  ufEmpresa && ufCliente
                    ? `CFOP ${cfop}: empresa em ${ufEmpresa}, cliente em ${ufCliente} (${ufEmpresa === ufCliente ? 'mesmo estado' : 'outro estado'})`
                    : !branch
                      ? 'CFOP definido pela UF da empresa e do cliente'
                      : !customer
                        ? 'Selecione o cliente para definir o CFOP'
                        : 'UF da empresa ou do cliente não encontrada no TOTVS — confira o cadastro'
                }
              >
                {cfop}
              </div>
            </div>
            {branch && customer && !(ufEmpresa && ufCliente) && (
              <p className="mt-1 text-[10px] text-amber-700">UF {!ufEmpresa ? 'da empresa' : 'do cliente'} não encontrada — usando CFOP {cfop}; confira o cadastro.</p>
            )}
            {ufEmpresa && ufCliente && (
              <p className="mt-1 text-[10px] text-gray-400">
                {nf
                  ? `Empresa ${ufEmpresa} · cliente ${ufCliente} → CFOP ${cfop}`
                  : 'Na NF-e de devolução o CFOP de cada peça vem da nota de venda (5101 → 1201, 5102 → 1202, 6101/6107 → 2201, 6102/6108 → 2202).'}
              </p>
            )}
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
              {nf || temRef ? (
                <>
                  <FileText size={13} /> {nf ? 'Valores da nota fiscal' : 'Valor pago na nota de venda'}
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

        {/* Notas de VENDA do cliente: o que a NF-e de devolução referencia */}
        {!nf && (
          <NotasVendaDevolucao
            empresa={branch}
            cliente={customer}
            itens={itensConf}
            selecionadas={refNotas}
            onChange={setRefNotas}
            conferencia={confRef}
            conferindo={confBusy}
            erroConferencia={confErro}
          />
        )}

        {/* Nota fiscal emitida pelo cliente (conferência + entrada espelhando a nota) */}
        <div className={`mb-2 rounded-xl border shadow-sm p-3 ${nf ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}>
          {nf ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#000638]">
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <FileText size={15} weight="bold" />
                  {nf.notas.length === 1 ? `NF ${nf.invoiceCode}/${nf.serialCode}` : `${nf.notas.length} notas em conferência`}
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
                    <Warning size={11} weight="bold" /> nota emitida para a empresa {nf.destinoBranch ?? '?'}
                  </span>
                )}
                <div className="flex-1" />
                <button onClick={() => { setNfPainel(true); if (nfLista === null) buscarNotasCliente(); }} className="px-2 py-1 rounded-lg font-semibold ring-1 ring-indigo-300 hover:bg-white">
                  + adicionar nota
                </button>
                <button onClick={() => removerNota()} className="px-2 py-1 rounded-lg font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-white" title="Voltar para a devolução sem nota (preço da tabela)">
                  remover todas
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {nf.notas.map((n) => (
                  <span key={chaveNf(n)} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white ring-1 text-[11px] text-[#000638] ${n.recebida ? 'ring-rose-300' : 'ring-indigo-200'}`} title={n.operationName || ''}>
                    <b className="font-mono">NF {n.invoiceCode}/{n.serialCode}</b>
                    <span className="text-gray-500">{n.invoiceDate.split('-').reverse().join('/')} · emp {n.branchCode} · {n.quantity} pç · {fmtBRL(n.totalValue)}</span>
                    {n.recebida && <span className="text-rose-600 font-semibold">já recebida</span>}
                    <button onClick={() => removerNota(n)} className="text-gray-400 hover:text-rose-500" title="Tirar esta nota da conferência">
                      <X size={12} weight="bold" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <FileText size={16} className="text-[#000638]" />
              <div className="flex-1 min-w-[220px]">
                <p className="text-xs font-semibold text-[#000638]">O cliente já emitiu a nota de devolução dele?</p>
                <p className="text-[11px] text-gray-500">
                  Só nesse caso: busque a nota dele para conferir as peças. O HeadCoach registra o recebimento e a entrada da nota é dada no FISFP082 (não emite outra nota nem gera Credev aqui).
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
                        <tr key={`${n.invoiceCode}-${n.serialCode}-${n.invoiceSequence}`} className={`hover:bg-gray-50/60 ${n.recebida ? 'opacity-60' : ''} ${nfs.some((x) => chaveNf(x) === chaveNf(n)) ? 'bg-indigo-50/60' : ''}`}>
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
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            {nfs.some((x) => chaveNf(x) === chaveNf(n)) ? (
                              <button onClick={() => escolherNota(n)} className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-300 hover:bg-emerald-100 inline-flex items-center gap-1">
                                <CheckCircle size={12} weight="fill" /> na conferência
                              </button>
                            ) : (
                              <button onClick={() => escolherNota(n)} className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90">
                                + conferir
                              </button>
                            )}
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
              <button
                onClick={limpar}
                disabled={items.length === 0}
                className="ml-auto h-7 px-2.5 rounded-lg text-[11px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40 inline-flex items-center gap-1"
                title="Remover todos os produtos e zerar a leitura do portal"
              >
                <Trash size={13} weight="bold" /> REMOVER TODOS OS PRODUTOS
              </button>
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
            <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-3 text-xs">
              <span className="font-bold text-[#000638]">Produtos</span>
              <span className="text-gray-500">{totals.qty} peça(s)</span>
              <button
                onClick={limpar}
                disabled={items.length === 0}
                className="ml-auto h-7 px-2.5 rounded-lg text-[11px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40 inline-flex items-center gap-1"
                title="Remover todos os produtos e zerar a leitura do portal"
              >
                <Trash size={13} weight="bold" /> REMOVER TODOS OS PRODUTOS
              </button>
            </div>
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
                          {g.qty} pç ·{' '}
                          {fmtBRL(temRef ? g.items.reduce((sm, i) => sm + Number(confPorProduto.get(Number(i.productCode))?.total || 0), 0) : g.total)}
                        </td>
                        <td />
                      </tr>
                      {g.items.map((i) => {
                        // conferência com as notas de venda escolhidas (quando há)
                        const cf = temRef ? confPorProduto.get(Number(i.productCode)) || null : null;
                        const av = avulsas[i.productCode] || null;
                        const unitMostrado = cf?.ok ? cf.valorUnit : i.unit;
                        return (
                        <tr key={i.productCode} className={`align-top ${cf && !cf.ok ? 'bg-rose-50/60' : 'hover:bg-gray-50/60'}`}>
                          <td className="px-3 py-1.5">
                            <p className="font-medium text-[#000638] leading-tight text-[13px]">
                              {i.name}
                            </p>
                            {cf &&
                              (cf.ok ? (
                                <p className="text-[11px] font-semibold text-violet-700">
                                  NF {cf.notas.map((n) => `${n.numero}/${n.serie}${n.avulsa ? ' (avulsa)' : ''}`).join(', ')} · {fmtBRL(cf.valorUnit)} por peça (
                                  {cf.notas.some((n) => n.avulsa) ? 'valor da tabela do cliente' : 'valor pago na nota'})
                                </p>
                              ) : (
                                <p className="text-[11px] font-semibold text-rose-600 inline-flex items-start gap-1">
                                  <Warning size={12} weight="bold" className="mt-0.5 shrink-0" /> {cf.mensagem}
                                </p>
                              ))}
                            {/* não achou nas notas escolhidas: outra nota só para esta peça */}
                            {cf && (!cf.ok || av) && (
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {av && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-[10px] font-semibold">
                                    <FileText size={10} weight="bold" /> outra nota: NF {av.numero}/{av.serie}
                                    <button
                                      onClick={() =>
                                        setAvulsas((m) => {
                                          const n = { ...m };
                                          delete n[i.productCode];
                                          return n;
                                        })
                                      }
                                      className="text-amber-500 hover:text-rose-600"
                                      title="Tirar esta referência"
                                    >
                                      <X size={9} weight="bold" />
                                    </button>
                                  </span>
                                )}
                                <button
                                  onClick={() => setPecaOutraNota(i)}
                                  className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-bold text-violet-700 ring-1 ring-violet-300 bg-white hover:bg-violet-50"
                                >
                                  <FileText size={11} weight="bold" /> {av ? 'Trocar a nota' : 'Referenciar outra nota'}
                                </button>
                              </p>
                            )}
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
                          <td className={`px-2 py-1.5 text-right font-medium tabular-nums text-[13px] ${cf?.ok ? 'text-violet-700' : 'text-gray-700'}`}>
                            {cf && !cf.ok ? '—' : fmtBRL(unitMostrado)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {temRef ? (
                              <span className="text-[11px] text-gray-300" title="O valor vem da nota de venda">—</span>
                            ) : (
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
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#000638] text-[13px]">
                            {cf ? (cf.ok ? fmtBRL(cf.total) : '—') : fmtBRL(qtyOf(i) * (i.unit - (i.discount || 0)))}
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
                        );
                      })}
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

              <input
                ref={txtInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => importarCodigosTxt(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => txtInputRef.current?.click()}
                disabled={importBusy}
                title="Importar um .txt com os códigos dos produtos (um por linha; código repetido soma 1 peça)"
                className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                {importBusy ? <Spinner size={13} className="animate-spin" /> : <FileArrowUp size={13} weight="bold" />}
                {importBusy ? 'Importando…' : 'Importar .txt de códigos'}
              </button>

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
                  className="h-9 px-2.5 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40 inline-flex items-center gap-1"
                  title="Remover todos os produtos e zerar a leitura do portal"
                >
                  <Trash size={14} /> Remover todos
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
                  <span>Peças lidas</span>
                  <span className="tabular-nums">{totals.qty}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Notas de venda referenciadas</span>
                  <span className={`tabular-nums ${temRef ? '' : 'text-amber-600 font-semibold'}`}>{refNotas.length || (temRef ? '—' : 'nenhuma')}</span>
                </div>
                {avulsasPayload.length > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Peças com outra nota</span>
                    <span className="tabular-nums">{avulsasPayload.length}</span>
                  </div>
                )}
                {confRef && !confRef.ok && (
                  <div className="flex justify-between text-rose-700">
                    <span>Peças fora das notas</span>
                    <span className="tabular-nums">{confRef.itens.filter((i) => !i.ok).reduce((sm, i) => sm + Number(i.quantidade || 0), 0)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                  <span className="font-semibold text-gray-700">Total da devolução</span>
                  <span className="text-xl font-bold text-[#000638] tabular-nums">
                    {confBusy ? <Spinner size={16} className="animate-spin inline" /> : confRef ? fmtBRL(confRef.totais.valor) : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">
                  Valor que o cliente pagou em cada peça, pelas notas de venda. Ao encerrar, o HeadCoach emite a NF-e de devolução e esse total vira{' '}
                  <b>Credev do cliente</b> na empresa {branch || '—'}. Nada vai para o TOTVS.
                </p>
              </div>
              )}

              <button
                onClick={gerarTransacao}
                disabled={!canGenerate}
                className="mt-3 w-full h-11 rounded-lg bg-[#000638] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[#000638]/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting ? (
                  <>
                    <Spinner size={16} className="animate-spin" /> {nf ? 'Gravando…' : 'Emitindo a NF-e de devolução…'}
                  </>
                ) : (
                  <>
                    <Receipt size={16} weight="bold" /> {nf ? `RECEBER ${conferencia?.conferidas || 0} PEÇA(S) CONFERIDA(S)` : 'ENCERRAR TRANSAÇÃO'}
                  </>
                )}
              </button>
              {!canGenerate && !posting && (
                <p className="mt-1.5 text-[10px] text-gray-400 text-center">
                  {nf?.recebida
                    ? `Esta nota já foi recebida na transação ${nf.recebida.transactionCode}.`
                    : !branch || !seller || !customer
                      ? 'Preencha empresa, vendedor e cliente.'
                      : !operacaoValida
                        ? 'Escolha a operação da devolução.'
                        : nf && conferencia && conferencia.conferidas === 0
                          ? 'Confira ao menos uma peça da nota.'
                          : nf
                            ? 'Confira os dados da devolução.'
                            : items.length === 0
                              ? 'Leia as peças que estão voltando.'
                              : !temRef
                                ? 'Busque e escolha a(s) nota(s) de venda do cliente.'
                                : confBusy
                                  ? 'Conferindo as peças nas notas…'
                                  : confErro
                                    ? confErro
                                    : confRef && !confRef.ok
                                      ? 'Há peça fora das notas escolhidas: escolha a nota dela, use “Referenciar outra nota” na peça ou tire-a.'
                                      : 'Confira os dados da devolução.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal: resultado — FISFP082 (nota emitida pelo cliente) */}
        {trx && trx.fisfp082 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
              <CheckCircle size={44} weight="fill" className="mx-auto mb-2 text-emerald-500" />
              <h3 className="text-lg font-bold text-[#000638]">Peças recebidas no HeadCoach</h3>
              <p className="mt-2 text-sm text-gray-600">
                {trx.conf.conferidas} peça(s) conferida(s){' '}
                {trx.conf.faltando > 0 && <span className="text-amber-700">· {trx.conf.faltando} faltando </span>}
                {trx.conf.sobrando > 0 && <span className="text-rose-700">· {trx.conf.sobrando} sobrando </span>}
                <br />
                Empresa {trx.branchCode} · operação {trx.operacao} · CFOP {trx.cfop}
                <br />
                Ref. {(trx.nf.notas || [trx.nf]).length > 1 ? 'NFs do cliente' : 'NF do cliente'}{' '}
                {(trx.nf.notas || [trx.nf]).map((n) => `${n.invoiceCode}/${n.serialCode}`).join(', ')} (empresa {trx.nf.branchCode})
                <br />
                <b>{fmtBRL(trx.total)}</b> · {trx.qtdEpcs} etiqueta(s)
              </p>

              <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-xl p-2.5 ring-1 ring-amber-200 text-left">
                Esta devolução <b>não gera transação no TOTVS</b>. Dê entrada da(s) nota(s) do cliente pelo{' '}
                <b>FISFP082</b>. O recebimento, com o que foi conferido, faltou e sobrou, ficou salvo em{' '}
                <b>Devoluções de Mercadoria → aba Transações</b>.
              </p>

              <div className="mt-4 space-y-1.5">
                <button
                  onClick={exportarEpcsCsv}
                  disabled={trx.qtdEpcs === 0}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                >
                  <DownloadSimple size={13} /> Exportar a lista de EPC
                </button>
                <button
                  onClick={novaDevolucao}
                  className="w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90"
                >
                  Nova devolução
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal: devolução encerrada no HeadCoach — NF-e de devolução + Credev */}
        {trx && trx.hc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
              {trx.autorizada ? (
                <CheckCircle size={44} weight="fill" className="mx-auto mb-2 text-emerald-500" />
              ) : (
                <XCircle size={44} weight="fill" className="mx-auto mb-2 text-rose-500" />
              )}
              <h3 className="text-lg font-bold text-[#000638]">{trx.autorizada ? 'Devolução encerrada!' : 'A NF-e de devolução não saiu'}</h3>
              <p className="mt-2 text-sm text-gray-600">
                Transação do HeadCoach nº <span className="font-mono font-bold text-[#000638] text-xl">{trx.vendaId}</span>
                <br />
                Empresa {trx.branchCode} · operação {trx.operacao}
                <br />
                {trx.customerName}
                <br />
                Ref. {trx.notasRef.length > 1 ? 'notas de venda' : 'nota de venda'} {trx.notasRef.map((n) => `${n.numero}/${n.serie}`).join(', ')}
                <br />
                <b>{fmtBRL(trx.total)}</b> · {trx.qtdPecas} peça(s) · {trx.qtdEpcs} etiqueta(s)
              </p>

              {trx.autorizada ? (
                <div className="mt-3 text-sm text-emerald-800 bg-emerald-50 rounded-xl p-3 ring-1 ring-emerald-200 text-left space-y-1">
                  <p>
                    <b>
                      NF-e de devolução {trx.nota?.numero}/{trx.nota?.serie}
                    </b>{' '}
                    autorizada pela SEFAZ.
                  </p>
                  <p>
                    <b>Credev de {fmtBRL(trx.credev?.gerado ?? trx.total)}</b> gerado para o cliente na empresa {trx.branchCode}
                    {trx.credev?.saldo != null ? ` — saldo de Credev agora: ${fmtBRL(trx.credev.saldo)}` : ''}.
                  </p>
                  <p className="text-[11px] text-emerald-700">A transação está em HeadCoach › Transações. Nada foi lançado no TOTVS.</p>
                </div>
              ) : (
                <div className="mt-3 text-xs text-rose-800 bg-rose-50 rounded-xl p-3 ring-1 ring-rose-200 text-left space-y-1">
                  <p className="font-semibold">{trx.erroEmissao || 'A SEFAZ não autorizou a nota.'}</p>
                  <p>A transação ficou gravada <b>em andamento</b> e o Credev só é gerado quando a nota for autorizada. Corrija o que a mensagem pede e tente de novo, ou cancele a transação.</p>
                </div>
              )}

              <div className="mt-4 space-y-1.5">
                {trx.autorizada && trx.nota && (
                  <button
                    onClick={() => imprimirDocumento({ nota: trx.nota, venda: trx.venda, emitente: trx.emitente })}
                    className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <Printer size={13} /> Imprimir o DANFE da devolução
                  </button>
                )}
                {!trx.autorizada && (
                  <>
                    <button
                      onClick={reemitirDevolucao}
                      disabled={reemitindo}
                      className="w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      {reemitindo ? <Spinner size={15} className="animate-spin" /> : <ArrowsClockwise size={15} weight="bold" />} Tentar emitir de novo
                    </button>
                    <button
                      onClick={cancelarDevolucao}
                      disabled={reemitindo}
                      className="w-full h-9 rounded-xl text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Cancelar esta transação
                    </button>
                  </>
                )}
                <button
                  onClick={exportarEpcsCsv}
                  disabled={totals.epcs === 0}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                >
                  <DownloadSimple size={13} /> Exportar a lista de EPC
                </button>
                {trx.autorizada ? (
                  <button onClick={novaDevolucao} className="w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90">
                    Nova devolução
                  </button>
                ) : (
                  <button onClick={() => setTrx(null)} disabled={reemitindo} className="w-full h-9 rounded-xl text-xs font-semibold text-gray-500 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                    Fechar (a transação continua em andamento em HeadCoach › Transações)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {pecaOutraNota && (
          <OutraNotaModal
            empresa={branch}
            cliente={customer}
            peca={pecaOutraNota}
            atual={avulsas[pecaOutraNota.productCode] || null}
            onFechar={() => setPecaOutraNota(null)}
            onEscolher={(nota) => {
              setAvulsas((m) => ({ ...m, [pecaOutraNota.productCode]: nota }));
              setPecaOutraNota(null);
            }}
          />
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
