// Página: Tecnologia → PDV Crosby
// Dois destinos para a venda:
//  • TOTVS     — gera a transação "em andamento" no ERP e o caixa finaliza
//                no TRAFP005 (fluxo original do PDV Varejo).
//  • HEADCOACH — a venda inteira é registrada no HeadCoach (cliente, itens,
//                desconto, pagamentos com NSU/autorização, vendedor, empresa)
//                e a NFC-e / NF-e / NF-e de devolução é emitida direto na
//                SEFAZ com o certificado da matriz (backend /api/pdv-crosby).
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
  Copy,
  Printer,
  Ticket,
  CornersOut,
  CornersIn,
  Moon,
  Sun,
  ChartBar,
  Warning,
  Tag,
  Percent,
  Barcode,
  Plus,
  Minus,
  UserPlus,
  Trophy,
  Phone,
  IdentificationCard,
  Receipt,
  FileText,
  ArrowsLeftRight,
  ListBullets,
  Gear,
  Cloud,
  Database,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import useRfidReader from '../hooks/useRfidReader';
import { useAuth } from '../components/AuthContext';
import { fetchSefaz } from '../utils/fetchSefaz';
import { gerarHtmlCupomNFCe, gerarHtmlCupomTroca, abrirImpressao } from '../utils/documentoFiscalHtml';
import PagamentoModal from '../components/pdv/PagamentoModal';
import ResultadoFiscalModal from '../components/pdv/ResultadoFiscalModal';
import VendasDoDiaModal from '../components/pdv/VendasDoDiaModal';
import FiscalConfigModal from '../components/pdv/FiscalConfigModal';
import CadastroClienteModal from '../components/pdv/CadastroClienteModal';
import TrocaComprasModal from '../components/pdv/TrocaComprasModal';
import MovimentoDiaModal from '../components/pdv/MovimentoDiaModal';
import { getUserCompanies } from '../services/userCompaniesService';

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

// Tipo de venda → operação TOTVS, conforme a empresa.
// Empresas 1 a 99 usam a operação padrão; 95 e 98 têm operações próprias.
const TIPOS_VENDA = [
  { id: 'nfce', label: 'NFCE', icon: Receipt, padrao: 510, especial: 545 },
  { id: 'nfe', label: 'NFE', icon: FileText, padrao: 521, especial: 548 },
  { id: 'troca', label: 'TROCA', icon: ArrowsLeftRight, padrao: 1, especial: 555 },
];
const EMPRESAS_ESPECIAIS = [95, 98];

// A operação vem da configuração da empresa (Administração → Fiscal PDV).
// Sem configuração, cai na regra histórica do TOTVS.
function operacaoPara(tipoId, branch, cfg = null) {
  const tipo = TIPOS_VENDA.find((t) => t.id === tipoId);
  if (!tipo) return '';
  const daConfig = cfg?.[{ nfce: 'operacao_nfce', nfe: 'operacao_nfe', troca: 'operacao_troca' }[tipoId]];
  if (daConfig) return String(daConfig);
  const emp = parseInt(branch, 10);
  if (!emp || emp < 1 || emp > 99) return '';
  return String(EMPRESAS_ESPECIAIS.includes(emp) ? tipo.especial : tipo.padrao);
}

// Situações da transação no TOTVS
const TRX_STATUS = {
  1: { label: 'Em andamento', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  2: { label: 'Encerrada', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  3: { label: 'Em processo externo', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  4: { label: 'ATENDIDA', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  6: { label: 'CANCELADA', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

// CFOP de entrada (devolução) espelhando o CFOP da venda original
const CFOP_DEVOLUCAO = { 5101: 1201, 5102: 1202, 5405: 1411, 6101: 2201, 6102: 2202, 6404: 2411 };
const cfopTroca = (cfopVenda) => CFOP_DEVOLUCAO[Number(cfopVenda)] || 1202;
const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

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

// ─── Vendedor: digita o nome ou o número, ou escolhe na lista ───────────────
function SellerPicker({ sellers, value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const atual = sellers.find((s) => String(s.code) === String(value));

  useEffect(() => {
    const fora = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const norm = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const lista = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return sellers;
    return sellers.filter((s) => String(s.code).startsWith(q) || norm(s.name).includes(q));
  }, [sellers, query]);

  const escolher = (s) => {
    onChange(String(s.code));
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={open ? query : atual ? `${atual.code} — ${atual.name}` : ''}
        disabled={disabled}
        onFocus={() => {
          setQuery('');
          setHi(0);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHi(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(h + 1, lista.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && lista[hi]) escolher(lista[hi]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={disabled ? 'Escolha a empresa' : 'Vendedor: nome ou número'}
        title="Vendedor"
        className="w-full h-9 pl-8 pr-7 mb-0 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-50 disabled:text-gray-400"
      />
      {atual && !disabled && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            setQuery('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500"
          title="Limpar vendedor"
        >
          <X size={13} weight="bold" />
        </button>
      )}
      {open && !disabled && (
        <ul className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white rounded-lg shadow-lg ring-1 ring-gray-200">
          {lista.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Nenhum vendedor encontrado.</li>}
          {lista.map((s, idx) => (
            <li key={s.code}>
              <button
                type="button"
                onMouseEnter={() => setHi(idx)}
                onClick={() => escolher(s)}
                className={`w-full text-left px-3 py-1.5 text-sm ${idx === hi ? 'bg-blue-50' : ''} ${String(s.code) === String(value) ? 'font-bold text-[#000638]' : 'text-gray-700'}`}
              >
                {s.code} — {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
const PDVCrosby = () => {
  const { user } = useAuth();
  // Destino da venda: 'totvs' (transação no ERP) | 'headcoach' (venda + NF aqui)
  // Só administrador/owner escolhe; os demais operam sempre em TOTVS.
  const podeEscolherDestino = ['admin', 'owner'].includes(user?.role);
  const [destinoEscolhido, setDestino] = useState(
    () => localStorage.getItem('pdv_crosby_destino') || 'totvs',
  );
  const destino = podeEscolherDestino ? destinoEscolhido : 'totvs';
  // Modo HEADCOACH
  const [fiscalCfg, setFiscalCfg] = useState(null); // config fiscal da empresa
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [hcBusy, setHcBusy] = useState(false);
  const [resultado, setResultado] = useState(null); // { venda, nota, emitente, erro }
  const [showVendas, setShowVendas] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const [showMovimento, setShowMovimento] = useState(false);
  // Tela cheia e tema (escuro/claro) do PDV
  const rootRef = useRef(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [escuro, setEscuro] = useState(() => localStorage.getItem('pdv_crosby_tema') === 'escuro');
  useEffect(() => {
    const onFs = () => setTelaCheia(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  useEffect(() => {
    localStorage.setItem('pdv_crosby_tema', escuro ? 'escuro' : 'claro');
    // fora da tela cheia o filtro vai no <html>; em tela cheia, no próprio PDV
    document.documentElement.classList.toggle('pdv-dark', escuro && !telaCheia);
    return () => document.documentElement.classList.remove('pdv-dark');
  }, [escuro, telaCheia]);
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  // Empresas liberadas para o usuário (Painel Admin → usuário do setor Varejo).
  // null = sem restrição (admin/owner ou usuário sem empresa vinculada).
  const [empresasUsuario, setEmpresasUsuario] = useState(null);

  // Filtros
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(
    () => localStorage.getItem('pdv_crosby_branch') || '',
  );
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState(
    () => localStorage.getItem('pdv_crosby_seller') || '',
  );
  const [tipoVenda, setTipoVenda] = useState(
    () => localStorage.getItem('pdv_crosby_tipo') || '',
  );
  // Operação da transação derivada do tipo de venda + empresa + config fiscal
  const operation = operacaoPara(tipoVenda, branch, fiscalCfg);
  const [customer, setCustomer] = useState(null);

  // Cashback (saldo bônus do cliente na empresa da venda)
  const [cashback, setCashback] = useState(null); // { balance, cpf }
  const [cashbackUsar, setCashbackUsar] = useState(false);
  const cashbackGeradoRef = useRef(false); // evita gerar 2x na mesma venda
  // Painel do cliente: cadastro (documento, telefone) e saldos (credev, adiantamento)
  const [clienteInfo, setClienteInfo] = useState(null);
  const [saldos, setSaldos] = useState(null);
  // Ranking de vendedores da empresa no dia (painel de vendas do TOTVS)
  const [ranking, setRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);

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
  // TROCA (destino TOTVS): peças de compras anteriores que estão voltando, pelo
  // valor pago na nota. Vira uma transação própria, separada da venda.
  const [trocaItens, setTrocaItens] = useState([]);
  const [showTroca, setShowTroca] = useState(false);
  const [trxTroca, setTrxTroca] = useState(null); // { transactionCode, branchCode, transactionDate, total, notas }
  const [trxTrocaStatus, setTrxTrocaStatus] = useState(null);
  const operacaoTroca = operacaoPara('troca', branch, fiscalCfg);
  const trocaTotal = useMemo(() => trocaItens.reduce((sm, i) => sm + i.quantity * i.unit, 0), [trocaItens]);
  const trocaQtd = trocaItens.reduce((sm, i) => sm + i.quantity, 0);

  // No destino TOTVS a troca não é um "tipo de venda": é uma transação à parte
  useEffect(() => {
    if (destino === 'totvs' && tipoVenda === 'troca') setTipoVenda('');
  }, [destino, tipoVenda]);
  // Trocou de cliente: as compras marcadas eram do cliente anterior
  // (as que vieram de CUPOM DE TROCA ficam: não dependem de quem está no caixa)
  useEffect(() => {
    setTrocaItens((l) => l.filter((i) => i.cupom));
  }, [customer?.code]);

  useEffect(() => localStorage.setItem('pdv_crosby_branch', branch), [branch]);
  useEffect(() => localStorage.setItem('pdv_crosby_seller', seller), [seller]);
  useEffect(() => localStorage.setItem('pdv_crosby_tipo', tipoVenda), [tipoVenda]);
  useEffect(() => localStorage.setItem('pdv_crosby_destino', destinoEscolhido), [destinoEscolhido]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!user?.id || ['admin', 'owner'].includes(user.role)) return;
    getUserCompanies(user.id).then(({ data }) => {
      if (data && data.length > 0) setEmpresasUsuario(data.map(String));
    });
  }, [user?.id, user?.role]);
  const branchesVisiveis = useMemo(
    () => (empresasUsuario ? branches.filter((b) => empresasUsuario.includes(String(b.cd_empresa))) : branches),
    [branches, empresasUsuario],
  );
  // Empresa fora das liberadas (ou só uma liberada): corrige a seleção
  useEffect(() => {
    if (!empresasUsuario || branchesVisiveis.length === 0) return;
    if (!branchesVisiveis.some((b) => String(b.cd_empresa) === String(branch))) {
      setBranch(String(branchesVisiveis[0].cd_empresa));
    }
  }, [empresasUsuario, branchesVisiveis, branch]);

  // Cargas iniciais
  useEffect(() => {
    (async () => {
      try {
        const b = await fetch(`${API_BASE_URL}/api/totvs/branches`).then((r) =>
          r.json(),
        );
        setBranches(b?.data?.data || []);
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

  // Configuração fiscal da empresa (operações, ambiente, série)
  useEffect(() => {
    setFiscalCfg(null);
    if (!branch) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/config/${branch}`);
        const j = await r.json();
        if (r.ok && j.success) setFiscalCfg(j.data?.config || null);
      } catch {
        setFiscalCfg(null);
      }
    })();
  }, [branch]);

  // Cashback: ao escolher cliente (e empresa), busca CPF e saldo bônus
  useEffect(() => {
    setCashback(null);
    setCashbackUsar(false);
    setClienteInfo(null);
    if (!customer || !branch) return;
    (async () => {
      try {
        const rc = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/customer/${customer.code}`,
        );
        const jc = await rc.json();
        setClienteInfo(jc?.data || null);
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

  // Saldos do cliente na empresa da venda (credev e adiantamento)
  useEffect(() => {
    setSaldos(null);
    if (!customer || !branch) return undefined;
    let vivo = true;
    fetch(`${API_BASE_URL}/api/totvs/pdv/customer-balance?code=${customer.code}&branch=${branch}`)
      .then((r) => r.json())
      .then((j) => {
        if (vivo && j?.success) setSaldos(j.data);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [customer, branch]);

  // Ranking de vendedores da empresa hoje
  const carregarRanking = useCallback(async () => {
    if (!branch) {
      setRanking(null);
      return;
    }
    setRankingLoading(true);
    try {
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Recife' });
      const r = await fetch(`${API_BASE_URL}/api/totvs/sale-panel/sellers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filtroempresa: [parseInt(branch, 10)], datemin: hoje, datemax: hoje }),
      });
      const j = await r.json();
      const linhas = (j?.data?.branches || []).flatMap((b) => b.dataRow || []);
      setRanking(
        linhas
          .map((l) => ({
            code: l.seller_code,
            name: l.seller_name,
            vendas: Number(l.seller_sale_qty) || 0,
            pecas: Number(l.seller_sale_item_qty) || 0,
            valor: Number(l.seller_sale_value) || 0,
          }))
          .sort((a, b) => b.valor - a.valor),
      );
    } catch {
      setRanking([]);
    } finally {
      setRankingLoading(false);
    }
  }, [branch]);

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
    setResultado(null);
    setPagamentoOpen(false);
    setTrx(null);
    setTrxStatus(null);
    setTrocaItens([]);
    setTrxTroca(null);
    setTrxTrocaStatus(null);
    setCashback(null);
    setCashbackUsar(false);
    cashbackGeradoRef.current = false;
    processedEpcs.current = new Set();
  }, []);

  const limpar = useCallback(() => {
    setItems([]);
    setTrocaItens([]);
    processedEpcs.current = new Set();
  }, []);

  // ─── Gerar transação (em andamento, p/ o caixa finalizar no TRAFP005) ────
  const prontoBase =
    !posting &&
    !hcBusy &&
    items.length > 0 &&
    branch &&
    seller &&
    tipoVenda &&
    items.every((i) => qtyOf(i) > 0 && i.unit > 0);
  // TOTVS: exige cliente e operação. HEADCOACH: NFC-e pode ser sem cliente;
  // NF-e e TROCA exigem cliente identificado.
  // TOTVS com troca: gera a transação da troca (só as peças que voltam) e, se
  // houver produtos de venda, a transação da venda. Dá para gerar só a troca.
  const trocaPronta =
    !posting && branch && seller && customer && trocaItens.length > 0 && !!operacaoTroca;
  const canGenerate =
    destino === 'totvs'
      ? trocaItens.length > 0
        ? trocaPronta && (items.length === 0 || (prontoBase && operation))
        : prontoBase && customer && operation
      : prontoBase && (tipoVenda === 'nfce' || customer);

  const gerarTransacao = useCallback(async () => {
    if (!canGenerate) return;
    setPosting(true);
    try {
      // 1) Transação da TROCA: só as peças que voltam, pelo valor pago na nota.
      //    Se já foi gerada (a venda falhou e o operador tentou de novo), não repete.
      if (trocaItens.length > 0 && !trxTroca) {
        const itensTroca = trocaItens.map((i) => ({
          productCode: i.productCode,
          quantity: i.quantity,
          value: Number(Number(i.unit).toFixed(3)),
          cfop: cfopTroca(i.cfop),
        }));
        const totalTroca = Number(itensTroca.reduce((sm, it) => sm + it.quantity * it.value, 0).toFixed(2));
        const notas = [...new Map(trocaItens.map((i) => [`${i.nota.branchCode}-${i.nota.invoiceSequence}`, i.nota])).values()];
        const rt = await fetch(`${API_BASE_URL}/api/totvs/pdv/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchCode: parseInt(branch, 10),
            customerCode: customer.code,
            sellerCode: parseInt(seller, 10),
            operationCode: parseInt(operacaoTroca, 10),
            paymentConditionCode: PDV_VAREJO_CONFIG.paymentConditionCode,
            isPreSale: false,
            status: 1,
            totalAmountTransaction: totalTroca,
            items: itensTroca,
            // nota(s) de origem, para quem for referenciar no TOTVS (máx. 80 por linha)
            observations: notas.flatMap((n) => [
              { observation: `TROCA REF NF ${n.invoiceCode}/${n.serialCode} FAT ${n.invoiceSequence} DE ${fmtData(n.invoiceDate)} EMP ${n.branchCode}`.slice(0, 80) },
              ...(n.accessKey ? [{ observation: `CHAVE ${n.accessKey}`.slice(0, 80) }] : []),
            ]),
          }),
        });
        const jt = await rt.json();
        if (!rt.ok || !jt.success) {
          showToast('erro', `TOTVS recusou a transação da troca: ${jt?.message || ''}`);
          return;
        }
        setTrxTroca({ ...jt.data, total: totalTroca, notas, itens: trocaItens });
        setTrxTrocaStatus(1);
        beep(true);
        // Peças que vieram de cupom de troca: marca como já trocadas no cupom
        const porCupom = new Map();
        for (const i of trocaItens) {
          if (!i.cupom) continue;
          porCupom.set(i.cupom, [...(porCupom.get(i.cupom) || []), { productCode: i.productCode, quantity: i.quantity }]);
        }
        for (const [codigo, itensCupom] of porCupom) {
          fetch(`${API_BASE_URL}/api/pdv-crosby/cupons-troca/${codigo}/uso`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itens: itensCupom,
              transacaoCode: jt.data.transactionCode,
              empresa: parseInt(branch, 10),
              por: user?.name || user?.email || null,
            }),
          }).catch(() => {});
        }
      }
      // Só troca, sem produtos de venda: termina aqui
      if (items.length === 0) return;

      // 2) Transação da VENDA
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
        showToast(
          'erro',
          `${trocaItens.length > 0 ? 'Troca gerada, mas a VENDA foi recusada: ' : ''}${j?.message || 'TOTVS recusou a transação'}`,
        );
        return;
      }
      setTrx({
        ...j.data,
        total: totalExato,
        cashbackUsado: cb,
        customerCode: customer.code,
        tipo: tipoVenda,
      });
      setTrxStatus(1);
      cashbackGeradoRef.current = false;
      beep(true);

      // Toda venda emite um CUPOM DE TROCA (controlado no HeadCoach)
      try {
        const vend = sellers.find((sl) => String(sl.code) === String(seller));
        const rcp = await fetch(`${API_BASE_URL}/api/pdv-crosby/cupons-troca`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa: j.data.branchCode,
            transacaoCode: j.data.transactionCode,
            transacaoDate: String(j.data.transactionDate).slice(0, 10),
            total: totalExato,
            clienteCode: customer.code,
            clienteNome: customer.name,
            vendedorCode: parseInt(seller, 10),
            vendedorNome: vend?.name || null,
            itens: items.map((i) => ({ productCode: i.productCode, name: i.name, quantity: qtyOf(i) })),
            por: user?.name || user?.email || null,
          }),
        });
        const jcp = await rcp.json();
        if (rcp.ok && jcp.success) setTrx((t) => (t ? { ...t, cupom: jcp.data } : t));
        else showToast('erro', `Venda gerada, mas o cupom de troca não: ${jcp?.message || ''}`);
      } catch {
        showToast('erro', 'Venda gerada, mas o cupom de troca não foi criado');
      }

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
  }, [canGenerate, branch, customer, seller, operation, totals, items, showToast, trocaItens, trxTroca, operacaoTroca, sellers, user, tipoVenda]);

  // ─── HEADCOACH: registra a venda aqui e emite a nota na SEFAZ ────────────
  const emitirNota = useCallback(async (vendaId) => {
    try {
      const { r, j } = await fetchSefaz(
        `${API_BASE_URL}/api/pdv-crosby/vendas/${vendaId}/emitir`,
        { method: 'POST' },
      );
      return { ok: r.ok && j.success, data: j?.data, message: j?.message };
    } catch (e) {
      return { ok: false, data: null, message: e.message };
    }
  }, []);

  // Venda ATENDIDA/AUTORIZADA → cashback novo (20%), uma vez por venda
  const gerarCashback = useCallback(
    async ({ total, customerCode, transactionCode, transactionDate, origem }) => {
      if (cashbackGeradoRef.current || !customerCode) return null;
      cashbackGeradoRef.current = true;
      const valor = Number(((total * PDV_VAREJO_CONFIG.cashbackGerarPct) / 100).toFixed(2));
      if (!(valor > 0)) return null;
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/bonus/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personCode: customerCode,
            branchCode: parseInt(branch, 10),
            value: valor,
            transactionCode: transactionCode || undefined,
            transactionDate: transactionDate || undefined,
            historic: `Cashback ${PDV_VAREJO_CONFIG.cashbackGerarPct}% - ${origem}`,
          }),
        });
        const j = await r.json();
        if (r.ok && j.success) {
          showToast('ok', `Cashback de ${fmtBRL(valor)} gerado para o cliente! 💰`);
          return valor;
        }
        cashbackGeradoRef.current = false;
        showToast('erro', `Cashback não gerado: ${j?.message || ''}`);
      } catch {
        cashbackGeradoRef.current = false;
        showToast('erro', 'Cashback não gerado');
      }
      return null;
    },
    [branch, showToast],
  );

  const finalizarHeadcoach = useCallback(
    async ({ pagamentos, nfReferenciada }) => {
      if (!canGenerate) return;
      setHcBusy(true);
      try {
        const cb = totals.cashbackAplicado;
        const baseVenda = totals.subtotal - totals.discounts;
        const empresaSel = branches.find((b) => String(b.cd_empresa) === String(branch));
        const vendedorSel = sellers.find((s) => String(s.code) === String(seller));
        // Cashback usado entra como desconto proporcional nos itens (igual ao TOTVS)
        const itens = items.map((i) => {
          const q = qtyOf(i);
          const itemTotal = q * (i.unit - (i.discount || 0));
          const extraUnit =
            cb > 0 && baseVenda > 0 ? Number((((itemTotal / baseVenda) * cb) / q).toFixed(2)) : 0;
          return {
            productCode: i.productCode,
            sku: i.sku,
            nome: i.name,
            referencia: i.referenceName,
            quantidade: q,
            valorUnit: Number(Number(i.unit).toFixed(2)),
            descontoUnit: Number(((i.discount || 0) + extraUnit).toFixed(2)),
            epcs: i.epcs,
          };
        });
        const payload = {
          empresa: parseInt(branch, 10),
          empresaCnpj: empresaSel?.cnpj || null,
          empresaNome: empresaSel?.nm_grupoempresa || null,
          tipoVenda,
          operacao: operation || null,
          cliente: customer
            ? { code: customer.code, nome: customer.name, cpfCnpj: cashback?.cpf || null }
            : null,
          vendedor: { code: parseInt(seller, 10), nome: vendedorSel?.name || null },
          itens,
          pagamentos,
          cashbackUsado: cb,
          nfReferenciada,
          criadoPor: user?.email || user?.name || null,
        };
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (!r.ok || !j.success) {
          showToast('erro', j?.message || 'Falha ao registrar a venda');
          return;
        }
        const venda = j.data;
        setPagamentoOpen(false);
        cashbackGeradoRef.current = false;
        beep(true);

        // Consome o cashback usado (PESFC054)
        if (cb > 0 && customer) {
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
            if (!rc.ok || !jc.success)
              showToast(
                'erro',
                `Venda ok, mas o consumo do cashback falhou: ${jc?.message || ''} — baixe no PESFC054`,
              );
          } catch {
            showToast('erro', 'Venda ok, mas o consumo do cashback falhou — baixe no PESFC054');
          }
        }

        // Emite a nota
        const em = await emitirNota(venda.id);
        const res = em.data
          ? {
              venda: em.data.venda || venda,
              nota: em.data.nota || null,
              emitente: em.data.emitente || null,
              erro: em.ok ? null : em.message,
            }
          : { venda, nota: null, emitente: null, erro: em.message };
        setResultado(res);
        if (res.nota?.status === 'autorizada') {
          beep(true);
          if (tipoVenda !== 'troca') {
            const gerado = await gerarCashback({
              total: Number(venda.total),
              customerCode: customer?.code,
              origem: `venda HeadCoach ${venda.id} (PDV Crosby)`,
            });
            if (gerado)
              setResultado((prev) =>
                prev ? { ...prev, venda: { ...prev.venda, cashback_gerado: gerado } } : prev,
              );
          }
        } else {
          beep(false);
        }
      } catch (e) {
        showToast('erro', `Falha ao finalizar: ${e.message}`);
      } finally {
        setHcBusy(false);
      }
    },
    [
      canGenerate,
      totals,
      branches,
      branch,
      sellers,
      seller,
      items,
      tipoVenda,
      operation,
      customer,
      cashback,
      user,
      showToast,
      emitirNota,
      gerarCashback,
    ],
  );

  // Reemite (após rejeição) e recarrega o resultado
  const reemitir = useCallback(async () => {
    if (!resultado?.venda?.id) return;
    setHcBusy(true);
    try {
      const em = await emitirNota(resultado.venda.id);
      const res = em.data
        ? {
            venda: em.data.venda || resultado.venda,
            nota: em.data.nota || null,
            emitente: em.data.emitente || resultado.emitente,
            erro: em.ok ? null : em.message,
          }
        : { ...resultado, nota: null, erro: em.message };
      setResultado(res);
      if (res.nota?.status === 'autorizada' && resultado.venda.tipo_venda !== 'troca') {
        await gerarCashback({
          total: Number(res.venda.total),
          customerCode: res.venda.cliente_code,
          origem: `venda HeadCoach ${res.venda.id} (PDV Crosby)`,
        });
      }
    } finally {
      setHcBusy(false);
    }
  }, [resultado, emitirNota, gerarCashback]);

  const recarregarResultado = useCallback(async () => {
    if (!resultado?.nota?.id) return;
    const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${resultado.nota.id}`);
    const j = await r.json();
    if (r.ok && j.success)
      setResultado({ venda: j.data.venda, nota: j.data.nota, emitente: j.data.emitente });
  }, [resultado]);

  // ─── Acompanha o status até ATENDIDA (caixa finaliza no TRAFP005) ────────
  const verificarStatus = useCallback(async () => {
    if ((!trx && !trxTroca) || trxChecking) return;
    setTrxChecking(true);
    const consultar = async (t) => {
      const qs = new URLSearchParams({
        branch: t.branchCode,
        code: t.transactionCode,
        date: String(t.transactionDate).slice(0, 10),
      });
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`);
      const j = await r.json();
      return j?.data?.status;
    };
    try {
      if (trxTroca) {
        const st = await consultar(trxTroca);
        if (st != null) setTrxTrocaStatus(st);
      }
      if (trx) {
        const st = await consultar(trx);
        if (st != null) setTrxStatus(st);
      }
    } catch {
      /* tenta no próximo ciclo */
    } finally {
      setTrxChecking(false);
    }
  }, [trx, trxTroca, trxChecking]);

  // Imprime a nota fiscal gerada pela venda atendida: NFC-e em cupom 80mm
  // (impressora térmica) ou o DANFE em PDF quando a venda foi NF-e.
  const [imprimindo, setImprimindo] = useState(false);
  const imprimirNota = useCallback(async () => {
    if (!trx || imprimindo) return;
    // a janela precisa abrir no clique, antes da busca, senão o navegador bloqueia
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) {
      showToast('erro', 'O navegador bloqueou a janela de impressão. Libere pop-ups para este site.');
      return;
    }
    w.document.write('<p style="font-family:Arial;padding:16px">Buscando a nota fiscal…</p>');
    setImprimindo(true);
    try {
      const qs = new URLSearchParams({
        branch: trx.branchCode,
        code: trx.transactionCode,
        date: String(trx.transactionDate).slice(0, 10),
      });
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-invoice?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Nota fiscal não encontrada');
      if (j.data.danfePdfBase64) {
        const bin = atob(j.data.danfePdfBase64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        w.location.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      } else {
        const vend = sellers.find((sl) => String(sl.code) === String(seller));
        const html = gerarHtmlCupomNFCe({
          nota: j.data.nota,
          venda: { ...j.data.venda, vendedor_nome: vend?.name || null },
          emitente: j.data.emitente,
        });
        w.document.open();
        w.document.write(html);
        w.document.close();
      }
    } catch (e) {
      w.close();
      showToast('erro', e.message);
    } finally {
      setImprimindo(false);
    }
  }, [trx, imprimindo, sellers, seller, showToast]);

  // Polling automático a cada 10s enquanto a transação não for atendida
  useEffect(() => {
    const fim = (st) => st === 4 || st === 6;
    const vendaAberta = trx && !fim(trxStatus);
    const trocaAberta = trxTroca && !fim(trxTrocaStatus);
    if (!vendaAberta && !trocaAberta) return undefined;
    const t = setInterval(verificarStatus, 10000);
    return () => clearInterval(t);
  }, [trx, trxStatus, trxTroca, trxTrocaStatus, verificarStatus]);

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
            historic: `Cashback ${PDV_VAREJO_CONFIG.cashbackGerarPct}% - venda ${trx.transactionCode} (PDV Crosby)`,
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

  useEffect(() => {
    carregarRanking();
  }, [carregarRanking, trxStatus, resultado]);

  const stInfo = TRX_STATUS[trxStatus] || {
    label: `status ${trxStatus}`,
    cls: 'bg-gray-100 text-gray-600 ring-gray-200',
  };

  return (
    <div ref={rootRef} className={`flex-1 min-h-0 relative flex flex-col bg-gray-100 ${escuro && telaCheia ? 'pdv-dark-fs' : ''}`}>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-4">
      <div className={`${telaCheia ? 'max-w-none' : 'max-w-7xl'} mx-auto`}>
        {/* ── Topo: venda (empresa, vendedor, cliente) · dados do cliente · ranking ── */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          {/* Vendedor / cliente / cadastrar */}
          <div className="space-y-2">
            <div className="relative">
              <Buildings size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                title="Empresa da venda"
                className="w-full h-9 pl-8 pr-2 mb-0 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
              >
                {branchesVisiveis.length !== 1 && <option value="">Empresa…</option>}
                {branchesVisiveis.map((b) => (
                  <option key={b.cd_empresa} value={b.cd_empresa}>
                    {b.cd_empresa} — {b.nm_grupoempresa}
                  </option>
                ))}
              </select>
            </div>
            <SellerPicker sellers={sellers} value={seller} onChange={setSeller} disabled={!branch} />
            <ClientePicker value={customer} onSelect={setCustomer} />
            <button
              type="button"
              onClick={() => (branch ? setShowCadastro(true) : showToast('erro', 'Escolha a empresa antes de cadastrar o cliente'))}
              className="w-full h-9 rounded-lg text-xs font-bold text-emerald-700 ring-1 ring-emerald-300 bg-emerald-50 hover:bg-emerald-100 inline-flex items-center justify-center gap-1.5"
            >
              <UserPlus size={14} weight="bold" /> CADASTRAR CLIENTE
            </button>
          </div>

          {/* Dados do cliente, saldo bônus e credev */}
          <div className="rounded-xl ring-1 ring-gray-200 bg-gray-50/60 p-3 flex flex-col">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Cliente</p>
            {!customer ? (
              <p className="flex-1 flex items-center justify-center text-xs text-gray-400 text-center">
                Selecione o cliente para ver os dados e os saldos.
              </p>
            ) : (
              <>
                <p className="font-bold text-[#000638] leading-tight">{customer.name}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                  <span>cód. {customer.code}</span>
                  {clienteInfo?.cpfCnpj && (
                    <span className="inline-flex items-center gap-1">
                      <IdentificationCard size={12} /> {clienteInfo.cpfCnpj}
                    </span>
                  )}
                  {clienteInfo?.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} /> {clienteInfo.phone}
                    </span>
                  )}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Saldo bônus', valor: cashback?.balance, carregando: !cashback, cor: 'text-emerald-700' },
                    { label: 'Credev', valor: saldos?.credev, carregando: !saldos, cor: 'text-blue-700' },
                    { label: 'Adiantamento', valor: saldos?.adiantamento, carregando: !saldos, cor: 'text-purple-700' },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg bg-white ring-1 ring-gray-200 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{c.label}</p>
                      <p className={`text-sm font-bold tabular-nums ${Number(c.valor) > 0 ? c.cor : 'text-gray-400'}`}>
                        {c.carregando ? '…' : fmtBRL(c.valor)}
                      </p>
                    </div>
                  ))}
                </div>
                {cashback && cashback.balance > 0 && (
                  <label className="mt-2 flex items-start gap-1.5 text-[11px] text-emerald-800 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashbackUsar}
                      onChange={(e) => setCashbackUsar(e.target.checked)}
                      disabled={totals.cashbackDisponivel <= 0}
                      className="accent-emerald-600 w-4 h-4 p-0 mb-0 shrink-0"
                    />
                    <span>
                      <b>Usar bônus</b>
                      {totals.cashbackAplicado > 0 && ` (−${fmtBRL(totals.cashbackAplicado)})`} — para usar tudo, a venda precisa ser de pelo menos{' '}
                      {fmtBRL(cashback.balance * PDV_VAREJO_CONFIG.cashbackFatorMinimo)}
                    </span>
                  </label>
                )}
              </>
            )}
          </div>

          {/* Ranking de vendedores da empresa no dia */}
          <div className="rounded-xl ring-1 ring-gray-200 bg-gray-50/60 p-3 flex flex-col min-h-[9.5rem]">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                <Trophy size={13} weight="fill" className="text-amber-500" /> Ranking de hoje
              </p>
              <button onClick={carregarRanking} disabled={!branch} className="text-gray-400 hover:text-[#000638] disabled:opacity-40" title="Atualizar ranking">
                <ArrowsClockwise size={13} className={rankingLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            {!branch ? (
              <p className="flex-1 flex items-center justify-center text-xs text-gray-400">Escolha a empresa.</p>
            ) : !ranking ? (
              <p className="flex-1 flex items-center justify-center text-xs text-gray-400">Carregando…</p>
            ) : ranking.length === 0 ? (
              <p className="flex-1 flex items-center justify-center text-xs text-gray-400">Nenhuma venda hoje nesta empresa.</p>
            ) : (
              <ol className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
                {ranking.map((v, idx) => (
                  <li
                    key={v.code}
                    className={`flex items-center gap-2 text-xs rounded-md px-1.5 py-0.5 ${String(v.code) === String(seller) ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}
                  >
                    <span className={`w-5 text-center font-bold tabular-nums ${idx === 0 ? 'text-amber-600' : 'text-gray-400'}`}>{idx + 1}º</span>
                    <span className="flex-1 truncate font-medium text-[#000638]">{v.name}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{v.pecas} pç</span>
                    <span className="font-bold tabular-nums text-[#000638]">{fmtBRL(v.valor)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* ── Tipo de venda (NFE / NFCE / TROCA) · adicionar produto · leitor RFID ── */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-2 flex flex-wrap items-center gap-2">
          {['nfe', 'nfce', 'troca'].map((id) => {
            const t = TIPOS_VENDA.find((x) => x.id === id);
            const ativo = tipoVenda === t.id;
            const Icon = t.icon;
            // TOTVS: TROCA abre as compras do cliente e não muda o tipo da venda
            if (t.id === 'troca' && destino === 'totvs') {
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (!branch) return showToast('erro', 'Escolha a empresa antes da troca');
                    return setShowTroca(true);
                  }}
                  title={`Compras do cliente ou cupom de troca · operação ${operacaoTroca || '—'}`}
                  className={`h-9 px-3 min-w-[5.5rem] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1 shadow-sm transition-colors ${
                    trocaItens.length > 0 ? 'bg-purple-700 text-white' : 'bg-white text-purple-700 ring-1 ring-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <Icon size={14} weight="bold" /> {t.label}
                  {trocaQtd > 0 && <span className="ml-0.5 px-1.5 rounded-full bg-white/25 tabular-nums">{trocaQtd}</span>}
                </button>
              );
            }
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipoVenda(t.id)}
                title={`Operação ${operacaoPara(t.id, branch, fiscalCfg) || '—'}`}
                className={`h-9 w-[5.5rem] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1 shadow-sm transition-colors ${
                  ativo ? 'bg-[#000638] text-white' : 'bg-white text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} weight="bold" /> {t.label}
              </button>
            );
          })}
          <span className="hidden sm:block w-px h-6 bg-gray-200" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              adicionarManual();
            }}
            className="relative flex-1 min-w-[14rem]"
          >
            <Barcode size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Adicionar produto: SKU / cód. de barras + Enter"
              className="w-full h-9 pl-8 pr-8 mb-0 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
            />
            {manualBusy && <Spinner size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
          </form>
          <span className="hidden sm:block w-px h-6 bg-gray-200" />
          <div className="w-full sm:w-60">
              {rfidSupported ? (
                <button
                  onClick={
                    rfidStatus === 'desconectado' ? rfidConnect : rfidDisconnect
                  }
                  className={`w-full h-9 px-4 inline-flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors ${
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

          </div>
        </div>

        {/* ── Operação da venda · destino (só admin/owner) e atalhos ── */}
        <div className="mb-2 flex flex-wrap items-center gap-2 min-h-[1rem]">
          {operation ? (
            <span className="text-[11px] text-gray-400">operação {operation}</span>
          ) : (
            tipoVenda && branch && <span className="text-[11px] text-rose-600">Empresa {branch} sem operação configurada para este tipo.</span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => (branch ? setShowMovimento(true) : showToast('erro', 'Escolha a empresa'))}
            className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 inline-flex items-center gap-1"
            title="Vendas e devoluções do dia da empresa (inclui o TOTVS)"
          >
            <ChartBar size={14} weight="bold" /> Movimento do dia
          </button>
          <button
            onClick={() => setEscuro((v) => !v)}
            className="h-9 w-9 rounded-lg text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 inline-flex items-center justify-center"
            title={escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
          >
            {escuro ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
          </button>
          <button
            onClick={alternarTelaCheia}
            className="h-9 w-9 rounded-lg text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 inline-flex items-center justify-center"
            title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {telaCheia ? <CornersIn size={16} weight="bold" /> : <CornersOut size={16} weight="bold" />}
          </button>
          {podeEscolherDestino && (
          <div className="inline-flex rounded-lg bg-white ring-1 ring-gray-200 shadow-sm p-0.5">
            {[
              { id: 'totvs', label: 'TOTVS', icon: Database, hint: 'Gera a transação no ERP; o caixa finaliza no TRAFP005' },
              { id: 'headcoach', label: 'HEADCOACH', icon: Cloud, hint: 'Venda e nota fiscal emitidas pelo HeadCoach' },
            ].map((d) => {
              const Icon = d.icon;
              const ativo = destino === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDestino(d.id)}
                  title={d.hint}
                  className={`h-8 px-2.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                    ativo ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'
                  }`}
                >
                  <Icon size={13} weight="bold" /> {d.label}
                </button>
              );
            })}
          </div>
          )}
          {destino === 'headcoach' && (
            <>
              <button
                onClick={() => setShowVendas(true)}
                disabled={!branch}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ListBullets size={14} /> Vendas do dia
              </button>
              <button
                onClick={() => setShowConfig(true)}
                disabled={!branch}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
                title="Ambiente, série, CSC, alíquota"
              >
                <Gear size={14} /> Fiscal
              </button>
            </>
          )}
        </div>

        {/* ── Produtos bipados · desconto, resumo e gerar transação ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-2 items-start">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="min-h-[38vh] max-h-[60vh] overflow-y-auto">
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
                  {items.length === 0 && trocaItens.length === 0 && (
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
                  {trocaItens.length > 0 && (
                    <tr className="bg-purple-100">
                      <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-800">
                        Troca — peças que o cliente está devolvendo
                      </td>
                      <td className="px-2 py-1 text-right text-[10px] font-bold text-purple-800 whitespace-nowrap">
                        {trocaQtd} pç · − {fmtBRL(trocaTotal)}
                      </td>
                      <td />
                    </tr>
                  )}
                  {trocaItens.map((i) => (
                    <tr key={i.key} className="bg-purple-50 border-l-4 border-purple-500">
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-purple-900 leading-tight text-[13px]">
                          <span className="mr-1.5 inline-flex px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold align-middle">TROCA</span>
                          {i.name}
                        </p>
                        <p className="text-[11px] text-purple-700/80">
                          cód. {i.productCode} · {i.nota.documentType === 65 ? 'NFC-e' : 'NF'} {i.nota.invoiceCode}/{i.nota.serialCode} · fatura{' '}
                          {i.nota.invoiceSequence} · {fmtData(i.nota.invoiceDate)} · empresa {i.nota.branchCode}
                          {i.cupom && <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-white text-purple-700 ring-1 ring-purple-300">cupom {i.cupom}</span>}
                        </p>
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-purple-900 tabular-nums text-[13px]">{i.quantity}</td>
                      <td className="px-2 py-1.5 text-right font-medium text-purple-900 tabular-nums text-[13px]">{fmtBRL(i.unit)}</td>
                      <td className="px-2 py-1.5 text-right text-[11px] text-purple-700/80">valor pago</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-purple-900 text-[13px]">− {fmtBRL(i.quantity * i.unit)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => setTrocaItens((l) => l.filter((x) => x.key !== i.key))}
                          className="text-purple-300 hover:text-rose-500 transition-colors"
                          title="Tirar da troca"
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
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


          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2 lg:sticky lg:top-2">
            {/* Desconto */}
            <div className="rounded-lg ring-1 ring-gray-200 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Desconto</p>
              <div className="flex items-center gap-1.5">
                <Percent size={14} className="text-gray-400 shrink-0" />
                <input
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(e.target.value)}
                  placeholder="%"
                  title={`Desconto máximo: ${PDV_VAREJO_CONFIG.maxDescontoPct}%`}
                  className="h-9 w-14 px-1.5 mb-0 rounded-lg border border-gray-300 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
                <button
                  onClick={aplicarDescontoGeral}
                  disabled={items.length === 0}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40"
                >
                  Aplicar
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

            {/* Resumo da transação */}
            <div className="rounded-lg ring-1 ring-gray-200 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Resumo da transação</p>
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
                {totals.cashbackAplicado > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Bônus</span>
                    <span className="tabular-nums">− {fmtBRL(totals.cashbackAplicado)}</span>
                  </div>
                )}
                {trocaItens.length > 0 && (
                  <>
                    <div className="flex justify-between text-gray-700 font-medium pt-1 border-t border-gray-100">
                      <span>Venda</span>
                      <span className="tabular-nums">{fmtBRL(totals.total)}</span>
                    </div>
                    <div className="flex justify-between text-purple-700 font-medium">
                      <span>Troca ({trocaQtd} pç)</span>
                      <span className="tabular-nums">− {fmtBRL(trocaTotal)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                  <span className="font-semibold text-gray-700">
                    {trocaItens.length === 0 ? 'Total' : totals.total - trocaTotal >= 0 ? 'A pagar' : 'Crédito do cliente'}
                  </span>
                  <span className={`text-2xl font-bold tabular-nums ${totals.total - trocaTotal < 0 ? 'text-purple-700' : 'text-[#000638]'}`}>
                    {fmtBRL(Math.abs(totals.total - trocaTotal))}
                  </span>
                </div>
              </div>
            </div>

            {/* Gerar transação */}
            <button
              onClick={destino === 'totvs' ? gerarTransacao : () => setPagamentoOpen(true)}
              disabled={!canGenerate}
              className={`w-full h-14 rounded-lg text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                destino === 'totvs' ? 'bg-[#000638] hover:bg-[#000638]/90' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {posting || hcBusy ? (
                <>
                  <Spinner size={16} className="animate-spin" /> {destino === 'totvs' ? 'Gerando…' : 'Emitindo…'}
                </>
              ) : destino === 'totvs' ? (
                <>
                  <Receipt size={18} weight="bold" />{' '}
                  {trocaItens.length > 0 ? (items.length > 0 ? 'GERAR TROCA + VENDA' : 'GERAR TROCA') : 'GERAR TRANSAÇÃO'}
                </>
              ) : (
                <>
                  <Cloud size={18} weight="bold" /> {tipoVenda === 'troca' ? 'REGISTRAR TROCA' : 'FINALIZAR VENDA'}
                </>
              )}
            </button>
            {!canGenerate && trocaItens.length > 0 && !operacaoTroca && branch && (
              <p className="text-[10px] text-rose-600 text-center">Empresa {branch} sem operação de TROCA configurada.</p>
            )}
            {!canGenerate && items.length > 0 && (
              <p className="text-[10px] text-gray-400 text-center">
                {destino === 'totvs'
                  ? 'Preencha empresa, vendedor, tipo de venda e cliente.'
                  : tipoVenda === 'nfce'
                    ? 'Preencha empresa, vendedor e tipo de venda.'
                    : 'NF-e e TROCA exigem cliente identificado.'}
              </p>
            )}
          </div>
        </div>

      </div>
      </div>

        {/* Modal: transações geradas (troca e/ou venda) + acompanhamento até ATENDIDA */}
        {(trx || trxTroca) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className={`bg-white rounded-2xl shadow-xl w-full p-6 text-center max-h-[92vh] overflow-y-auto ${trxTroca ? 'max-w-lg' : 'max-w-sm'}`}>
              <CheckCircle
                size={44}
                weight="fill"
                className={`mx-auto mb-2 ${
                  trx && trxStatus === 4 ? 'text-emerald-500' : trx && trxStatus === 6 ? 'text-rose-500' : 'text-blue-500'
                }`}
              />
              <h3 className="text-lg font-bold text-[#000638]">
                {trxTroca
                  ? trx
                    ? 'Troca e venda geradas!'
                    : 'Transação da troca gerada!'
                  : trxStatus === 4
                    ? 'Venda atendida!'
                    : trxStatus === 6
                      ? 'Transação cancelada'
                      : 'Transação gerada!'}
              </h3>

              {/* 1 — Troca */}
              {trxTroca && (
                <div className="mt-3 text-left rounded-xl bg-purple-50 ring-1 ring-purple-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-purple-800">1 · Transação da troca</p>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${
                        (TRX_STATUS[trxTrocaStatus] || {}).cls || 'bg-gray-100 text-gray-600 ring-gray-200'
                      }`}
                    >
                      {(TRX_STATUS[trxTrocaStatus] || {}).label || `status ${trxTrocaStatus}`}
                    </span>
                  </div>
                  <p className="text-sm text-purple-900">
                    Nº <span className="font-mono font-bold text-xl">{trxTroca.transactionCode}</span> · empresa {trxTroca.branchCode} ·{' '}
                    <b>{fmtBRL(trxTroca.total)}</b>
                  </p>
                  <ul className="mt-1 text-[11px] text-purple-900/80 list-disc list-inside">
                    {trxTroca.itens.map((i) => (
                      <li key={i.key}>
                        {i.quantity}× {i.name} — {fmtBRL(i.unit)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-purple-800">Nota para referenciar no TOTVS</p>
                  {trxTroca.notas.map((n) => (
                    <div key={`${n.branchCode}-${n.invoiceSequence}`} className="mt-1 rounded-lg bg-white ring-1 ring-purple-200 px-2 py-1.5 text-xs text-[#000638]">
                      <p>
                        <b>
                          {n.documentType === 65 ? 'NFC-e' : 'NF'} {n.invoiceCode}
                        </b>{' '}
                        · série <b>{n.serialCode}</b> · fatura <b>{n.invoiceSequence}</b> · {fmtData(n.invoiceDate)} · empresa <b>{n.branchCode}</b>
                      </p>
                      {n.accessKey && (
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(n.accessKey);
                            showToast('ok', 'Chave copiada');
                          }}
                          className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-purple-700 hover:underline break-all text-left"
                          title="Copiar a chave de acesso"
                        >
                          <Copy size={11} className="shrink-0" /> {n.accessKey}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 2 — Venda */}
              {trx && (
                <div className={trxTroca ? 'mt-2 text-left rounded-xl bg-gray-50 ring-1 ring-gray-200 p-3' : 'mt-2'}>
                  {trxTroca && <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">2 · Transação da venda</p>}
                  <p className="text-sm text-gray-600">
                    {!trxTroca && <>Nº da transação </>}
                    {trxTroca && 'Nº '}
                    <span className="font-mono font-bold text-[#000638] text-xl">{trx.transactionCode}</span>
                    {trxTroca ? ' · ' : <br />}
                    {trxTroca ? 'empresa' : 'Empresa'} {trx.branchCode} · {trxTroca ? <b>{fmtBRL(trx.total)}</b> : fmtBRL(trx.total)}
                    {trx.cashbackUsado > 0 && (
                      <>
                        <br />
                        <span className="text-emerald-600 text-xs">💰 {fmtBRL(trx.cashbackUsado)} de cashback consumido</span>
                      </>
                    )}
                    {trx.cashbackGerado > 0 && (
                      <>
                        <br />
                        <span className="text-emerald-600 text-xs font-semibold">💰 Novo cashback gerado: {fmtBRL(trx.cashbackGerado)}</span>
                      </>
                    )}
                  </p>
                  {trxTroca && (
                    <p className="mt-1 text-xs text-[#000638]">
                      {trx.total - trxTroca.total >= 0 ? 'Cliente paga' : 'Crédito do cliente'}:{' '}
                      <b>{fmtBRL(Math.abs(trx.total - trxTroca.total))}</b> ({fmtBRL(trx.total)} da venda − {fmtBRL(trxTroca.total)} da troca)
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-center gap-2">
                {trx && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${stInfo.cls}`}>
                    {trxStatus !== 4 && trxStatus !== 6 && <Spinner size={12} className="animate-spin" />}
                    {trxTroca ? `Venda: ${stInfo.label}` : stInfo.label}
                  </span>
                )}
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

              {trxTroca && trxTrocaStatus !== 4 && trxTrocaStatus !== 6 && (
                <p className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-xl p-2.5 ring-1 ring-gray-200 text-left">
                  No caixa TOTVS (<b>TRAFP005</b>): primeiro continue a transação da <b>troca nº {trxTroca.transactionCode}</b>, referenciando a nota acima, e
                  encerre.{trx && <> Depois continue a <b>venda nº {trx.transactionCode}</b> → Encerrar → Receber.</>} Esta tela atualiza sozinha a cada 10s.
                </p>
              )}
              {!trxTroca && trxStatus !== 4 && trxStatus !== 6 && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 ring-1 ring-gray-200">
                  Finalize no caixa TOTVS: <b>TRAFP005</b> → Continuar Transação nº <b>{trx.transactionCode}</b> → Encerrar → Receber. Esta tela atualiza
                  sozinha a cada 10s.
                </p>
              )}
              {trx && trxStatus === 4 && (
                <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-2.5 ring-1 ring-emerald-200">
                  Recebida e faturada no caixa — venda encerrada aqui também. ✅
                </p>
              )}
              {trx?.cupom && trxStatus !== 6 && (
                <button
                  onClick={() =>
                    abrirImpressao(
                      gerarHtmlCupomTroca({
                        cupom: trx.cupom,
                        empresaNome: branches.find((b) => String(b.cd_empresa) === String(trx.branchCode))?.nm_grupoempresa,
                      }),
                    )
                  }
                  className="mt-3 w-full h-10 rounded-xl text-sm font-bold text-purple-700 ring-1 ring-purple-300 bg-purple-50 hover:bg-purple-100 inline-flex items-center justify-center gap-2"
                >
                  <Ticket size={18} weight="bold" /> IMPRIMIR CUPOM DE TROCA
                  <span className="font-mono text-xs font-semibold">{trx.cupom.codigo}</span>
                </button>
              )}
              {trx && trxStatus === 4 && (
                <button
                  onClick={imprimirNota}
                  disabled={imprimindo}
                  className="mt-3 w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {imprimindo ? <Spinner size={16} className="animate-spin" /> : <Printer size={18} weight="bold" />}
                  {trx.tipo === 'nfe' ? 'IMPRIMIR NF-E' : 'IMPRIMIR NFCE'}
                </button>
              )}

              {(trx ? trxStatus === 4 || trxStatus === 6 : trxTrocaStatus === 4 || trxTrocaStatus === 6) ? (
                <button onClick={novaVenda} className="mt-4 w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90">
                  Nova venda
                </button>
              ) : (
                <div className="mt-4 space-y-1.5">
                  {trxTroca && !trx && items.length > 0 && (
                    <button
                      onClick={gerarTransacao}
                      disabled={posting}
                      className="w-full h-9 rounded-xl text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-40"
                    >
                      Tentar gerar a venda de novo
                    </button>
                  )}
                  <button onClick={novaVenda} className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                    Nova venda agora (as transações seguem no caixa)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {showTroca && (
          <TrocaComprasModal
            customer={customer}
            branch={branch}
            selecionados={trocaItens}
            onClose={() => setShowTroca(false)}
            onConfirm={(lista, comprador) => {
              // troca por cupom sem cliente no caixa: usa o comprador original
              if (!customer && comprador?.code) {
                setCustomer(comprador);
                showToast('ok', `Cliente da troca: ${comprador.name} (comprador original)`);
              }
              setTrocaItens(lista);
              setShowTroca(false);
            }}
          />
        )}

        {/* HEADCOACH: pagamento, resultado fiscal, vendas do dia, config */}
        {pagamentoOpen && (
          <PagamentoModal
            total={totals.total}
            tipoVenda={tipoVenda}
            busy={hcBusy}
            onConfirm={finalizarHeadcoach}
            onClose={() => !hcBusy && setPagamentoOpen(false)}
          />
        )}
        {resultado && (
          <ResultadoFiscalModal
            resultado={resultado}
            onNovaVenda={novaVenda}
            onFechar={() => setResultado(null)}
            onReemitir={reemitir}
            onAtualizar={recarregarResultado}
            showToast={showToast}
          />
        )}
        {showVendas && branch && (
          <VendasDoDiaModal
            empresa={parseInt(branch, 10)}
            onClose={() => setShowVendas(false)}
            onAbrirResultado={(r) => {
              setShowVendas(false);
              setResultado(r);
            }}
            showToast={showToast}
          />
        )}
        {showCadastro && (
          <CadastroClienteModal
            empresa={branch}
            onClose={() => setShowCadastro(false)}
            onCriado={(c) => {
              setCustomer(c);
              setShowCadastro(false);
              showToast('ok', `Cliente ${c.code} cadastrado e selecionado`);
            }}
          />
        )}
        {showConfig && branch && (
          <FiscalConfigModal
            empresa={parseInt(branch, 10)}
            empresaNome={
              branches.find((b) => String(b.cd_empresa) === String(branch))?.nm_grupoempresa
            }
            onClose={() => setShowConfig(false)}
          />
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
        {showMovimento && branch && (
          <MovimentoDiaModal
            empresa={parseInt(branch, 10)}
            empresaNome={branches.find((b) => String(b.cd_empresa) === String(branch))?.nm_grupoempresa}
            sellers={sellers}
            onClose={() => setShowMovimento(false)}
          />
        )}
    </div>
  );
};

export default PDVCrosby;
