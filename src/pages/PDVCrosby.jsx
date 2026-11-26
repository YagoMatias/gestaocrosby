// Página: Tecnologia → PDV Crosby
// A venda é 100% no HeadCoach (Yago, 16/11/2026): cliente, itens, desconto,
// pagamentos com NSU/autorização, vendedor e empresa ficam aqui, e a NFC-e /
// NF-e / NF-e de devolução é emitida direto na SEFAZ (backend /api/pdv-crosby).
// O modo "TOTVS" (gerar a transação para o caixa finalizar no TRAFP005) saiu.
// PDV de loja: bipa as peças no LEITOR RFID DE MESA (USB) ou por SKU manual, com
// o layout por grade do Orçamento. Preço = VENDA VAREJO (código 1, com promoção).
// TROCA: é o único momento em que as vendas do TOTVS são consultadas — o
// sistema procura as compras do cliente (TOTVS + HeadCoach), confere se ele
// comprou a peça que está devolvendo e referencia a nota de origem sozinho
// (POST /api/pdv-crosby/troca/conferir · services/pdvTroca.js).
// TROCA DE PRESENTE (18/11/2026): quem ganhou se cadastra (é o cliente), o
// caixa lê o CUPOM DE TROCA (código ou QR) no modo TROCA, escolhe as peças da
// venda do cupom e a troca confere contra ESSA venda — a NF-e de devolução
// referencia a nota original e o cupom anota o que foi trocado.
import { useAoAtivarAba } from '../components/AppTabs/TabContext';
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
  CornersOut,
  CornersIn,
  Moon,
  Sun,
  ChartBar,
  Warning,
  Prohibit,
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
  LockKey,
  Coins,
  Lock,
  LockOpen,
  Ticket,
} from '@phosphor-icons/react';
import { lerCaixa, CaixaCard, CaixaFechadoModal } from '../components/hc/CaixaHeadcoach';
import { API_BASE_URL } from '../config/constants';
import useRfidReader from '../hooks/useRfidReader';
import LeitorRfidPotencia from '../components/LeitorRfidPotencia';
import { useAuth } from '../components/AuthContext';
import { fetchSefaz } from '../utils/fetchSefaz';
import PagamentoModal from '../components/pdv/PagamentoModal';
import ResultadoFiscalModal from '../components/pdv/ResultadoFiscalModal';
import CancelarTransacao from '../components/pdv/CancelarTransacao';
import VendasDoDiaModal from '../components/pdv/VendasDoDiaModal';
import FiscalConfigModal from '../components/pdv/FiscalConfigModal';
import CadastroClienteModal from '../components/pdv/CadastroClienteModal';
import MovimentoDiaModal from '../components/pdv/MovimentoDiaModal';
import { getUserCompanies } from '../services/userCompaniesService';
import { apiJson } from '../utils/apiAuth';

// ─── Config do PDV Varejo (ajustável) ────────────────────────────────────────
const PDV_VAREJO_CONFIG = {
  cfop: 5102,
  // Condição de pagamento provisória da transação em andamento — o caixa
  // define a forma real ao encerrar/receber no TRAFP005
  paymentConditionCode: 1,
  // Tipo de preço: 1 = VENDA VAREJO (16 = VAREJO SHOPPING, p/ lojas de shopping)
  priceCodes: '1',
  // Desconto acima disso só para owner/admin ou com a senha de um deles
  maxDescontoPct: 15,
  // Cashback (no TOTVS é o "saldo bônus"): a venda gera 20%; para consumir, a venda deve
  // ser >= 3x o valor usado (ex.: R$ 200 de saldo exigem compra de R$ 600).
  // O cashback vale em QUALQUER loja (Yago, 18/11/2026): o saldo é a soma das lojas e
  // o consumo sai primeiro da loja da venda, depois das outras.
  // O cashback NOVO nasce no HeadCoach (18/11/2026): só pode ser usado depois de 3
  // dias (carência) e vale até o dia 93; o saldo antigo do TOTVS segue valendo.
  cashbackGerarPct: 20,
  cashbackFatorMinimo: 3,
};

// ─── Tabela de preço por empresa (Yago, 17/11/2026) ──────────────────────────
// O Midway (95) vende pela tabela VAREJO SHOPPING do TOTVS (tipo de preço 16):
// o varejo + 10%, sempre em valor inteiro, arredondado para cima (134 → 148,
// 209 → 230). Produto sem preço nessa tabela usa a mesma conta sobre o varejo.
const TABELA_SHOPPING = { priceCode: 16, nome: 'VAREJO SHOPPING', empresas: [95], acrescimoPct: 10 };
const usaTabelaShopping = (branch) => TABELA_SHOPPING.empresas.includes(Number(branch));
const priceCodesDa = (branch) =>
  usaTabelaShopping(branch) ? `${TABELA_SHOPPING.priceCode},${PDV_VAREJO_CONFIG.priceCodes}` : PDV_VAREJO_CONFIG.priceCodes;
// sem valor quebrado: sobe para o inteiro (147,40 → 148; 148,00 fica 148)
const semQuebrado = (v) => (Number(v) > 0 ? Math.ceil(Number(v) - 0.005) : 0);
// { price, promotionalPrice, tabela } do produto para a empresa (null = sem preço)
function precoDaEmpresa(prices, branch) {
  const lista = prices || [];
  const temValor = (p) => p && (p.promotionalPrice > 0 || p.price > 0);
  if (!usaTabelaShopping(branch)) {
    const p = lista.find(temValor);
    return p ? { price: p.price || 0, promotionalPrice: p.promotionalPrice || 0, tabela: null } : null;
  }
  const sh = lista.find((p) => Number(p.priceCode) === TABELA_SHOPPING.priceCode && temValor(p));
  if (sh) return { price: semQuebrado(sh.price), promotionalPrice: semQuebrado(sh.promotionalPrice), tabela: TABELA_SHOPPING.nome };
  const varejo = lista.find((p) => Number(p.priceCode) !== TABELA_SHOPPING.priceCode && temValor(p));
  if (!varejo) return null;
  const f = 1 + TABELA_SHOPPING.acrescimoPct / 100;
  return {
    price: semQuebrado(varejo.price * f),
    promotionalPrice: semQuebrado(varejo.promotionalPrice * f),
    tabela: `${TABELA_SHOPPING.nome} (varejo + ${TABELA_SHOPPING.acrescimoPct}%)`,
  };
}

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

const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const qtyOf = (i) => i.epcs.length + (i.manualQty || 0);
// A mesma peça pode estar no carrinho duas vezes: voltando (TROCA) e saindo (VENDA)
const keyDe = (productCode, troca) => `${troca ? 'T' : 'V'}:${productCode}`;
const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

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

// Desconto máximo da peça: o da promoção do PDV + o % permitido sobre o que
// sobra (o limite do vendedor vale para o desconto EXTRA, não para a promoção)
const limiteDescontoItem = (i, pct) => {
  const promo = i.promoDesconto || 0;
  return Number((promo + ((i.unit - promo) * pct) / 100).toFixed(2));
};

// ─── Senha de quem tem o desconto liberado (outro vendedor com limite maior,
// gerente, admin ou owner) para desconto acima do limite de quem está vendendo ──
function SenhaDescontoModal({ pct, limite, empresa, por, onLiberado, onCancelar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);

  const liberar = async () => {
    if (!email.trim() || !senha || busy) return;
    setBusy(true);
    setErro(null);
    try {
      // quem autoriza libera até o limite DELE (o servidor confere a senha e o limite)
      const j = await apiJson('/api/pdv-crosby/descontos/autorizar', { method: 'POST', body: { email: email.trim(), senha, pct: Number(pct.toFixed(2)), empresa, por } });
      onLiberado(j.data);
    } catch (e) {
      setErro(e.message);
      setSenha('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2">
          <LockKey size={26} weight="fill" className="text-amber-500" />
          <h3 className="text-lg font-bold text-[#000638]">Liberar desconto</h3>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Desconto de <b>{pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</b> passa do limite de{' '}
          {String(limite ?? PDV_VAREJO_CONFIG.maxDescontoPct).replace('.', ',')}%. Quem tem esse desconto liberado (gerente, admin, owner ou outro usuário com limite maior) digita o e-mail e a senha do HeadCoach.
        </p>
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail de quem autoriza"
            autoComplete="off"
            className="w-full h-10 px-3 mb-0 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
          />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && liberar()}
            placeholder="Senha"
            autoComplete="new-password"
            className="w-full h-10 px-3 mb-0 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
          />
        </div>
        {erro && <p className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-lg p-2 ring-1 ring-rose-200">{erro}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onCancelar} disabled={busy} className="h-10 rounded-lg ring-1 ring-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={liberar}
            disabled={busy || !email.trim() || !senha}
            className="h-10 rounded-lg bg-[#000638] text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {busy ? <Spinner size={14} className="animate-spin" /> : <LockKey size={14} weight="bold" />} Liberar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
const PDVCrosby = () => {
  const { user } = useAuth();
  // Só administrador/owner mexe na configuração fiscal da empresa
  const podeConfigurarFiscal = ['admin', 'owner'].includes(user?.role);
  // Modo HEADCOACH
  const [fiscalCfg, setFiscalCfg] = useState(null); // config fiscal da empresa
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [hcBusy, setHcBusy] = useState(false);
  const [resultado, setResultado] = useState(null); // { venda, nota, emitente, erro }
  const [showVendas, setShowVendas] = useState(false);
  const [showCancelar, setShowCancelar] = useState(false); // cancelar transação EM ANDAMENTO (a atendida é em Financeiro › Cancelamento de Transação)
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

  // Cashback (no TOTVS: saldo bônus do cliente) — soma de todas as lojas
  const [cashback, setCashback] = useState(null); // { balance, cpf, porEmpresa: [{ branchCode, balance }], headcoach: { disponivel, emCarencia, proximaLiberacao, proximoVencimento } }
  const [cashbackUsar, setCashbackUsar] = useState(false);
  // quanto do cashback usar (R$): vazio = tudo o que a venda permite; dá para usar só parte
  const [cashbackValor, setCashbackValor] = useState('');
  const cashbackGeradoRef = useRef(false); // evita gerar 2x na mesma venda
  // Painel do cliente: cadastro (documento, telefone) e saldos (credev, adiantamento)
  const [clienteInfo, setClienteInfo] = useState(null);
  const [saldos, setSaldos] = useState(null);
  // limite do cliente no BlueCard (crediário): aparece junto dos saldos quando o cliente tem CPF
  const [limiteBluecard, setLimiteBluecard] = useState(null); // null = sem consulta · { carregando } · { pode, disponivel, motivo } · { erro }
  // Ranking de vendedores da empresa no dia (painel de vendas do TOTVS)
  const [ranking, setRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  // Itens (mesma organização do Orçamento: por grade, 1 etiqueta = 1 peça)
  const [items, setItems] = useState([]);
  const processedEpcs = useRef(new Set());
  const branchRef = useRef(branch);
  branchRef.current = branch;

  const [globalDiscount, setGlobalDiscount] = useState('');
  // desconto geral digitado em % ou em R$ (como no Faturamento)
  const [descModo, setDescModo] = useState('pct');
  // Desconto: até 15% para todos; acima disso só owner/admin, ou com a senha
  // de um deles (a liberação vale até o fim desta venda)
  const descontoSemLimite = ['admin', 'owner'].includes(user?.role);
  const [descontoLiberado, setDescontoLiberado] = useState(null); // { nome, email, role, pct, semLimite } — pct = até quanto ele liberou
  const [senhaDesconto, setSenhaDesconto] = useState(null); // { pct, aplicar }
  // Limite do vendedor: vem da tela Financeiro › Liberação de Desconto
  // (/api/pdv-crosby/descontos/meu). Sem resposta, vale o padrão de 15%.
  const [limiteDescPct, setLimiteDescPct] = useState(PDV_VAREJO_CONFIG.maxDescontoPct);
  useEffect(() => {
    if (!user?.id || descontoSemLimite) return undefined;
    let vivo = true;
    apiJson('/api/pdv-crosby/descontos/meu')
      .then((j) => {
        const p = Number(j?.data?.pct);
        if (vivo && Number.isFinite(p) && p >= 0 && p <= 100) setLimiteDescPct(p);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user?.id, descontoSemLimite]);
  // com a liberação de outro usuário, vale o limite DELE nesta venda (owner/admin: tudo)
  const liberadoAte = descontoLiberado ? (descontoLiberado.semLimite || descontoLiberado.pct == null ? 100 : Math.max(limiteDescPct, Number(descontoLiberado.pct) || 0)) : null;
  const maxDescPct = descontoSemLimite ? 100 : liberadoAte ?? limiteDescPct;
  // Cashback não usado: pergunta ao finalizar (uma vez por cliente/venda)
  const [perguntaCashback, setPerguntaCashback] = useState(false);
  const [cashbackRecusado, setCashbackRecusado] = useState(false);
  const [continuarFinalizacao, setContinuarFinalizacao] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [toast, setToast] = useState(null);
  // HEADCOACH › CAIXA: só vende com o caixa da empresa aberto
  const [caixaSit, setCaixaSit] = useState(null);
  const [pedirCaixa, setPedirCaixa] = useState(false);
  // TROCA: conferência das peças nas compras do cliente (TOTVS + HeadCoach).
  // porProduto[código] = { ok, mensagem, valorUnit, notas:[{ numero, serie, data, empresa, chave… }] }
  const TROCA_VAZIA = useMemo(() => ({ status: 'parada', porProduto: {}, avisos: [], erro: null }), []);
  const [trocaConf, setTrocaConf] = useState(TROCA_VAZIA);
  // troca de presente pelo CUPOM DE TROCA: { codigo, comprador, origem }
  const [cupomTroca, setCupomTroca] = useState(null);
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupomBusy, setCupomBusy] = useState(false);
  const [cupomModal, setCupomModal] = useState(null); // dados do cupom + escolha { productCode: qtd }
  // TROCA aqui é o MODO de bipar: a peça entra marcada como troca (devolução).
  // O carrinho pode ter as duas coisas — peças de troca e peças de venda — e
  // fecha tudo num atendimento só (VENDA | TROCA).
  const emTroca = tipoVenda === 'troca';
  const emTrocaRef = useRef(emTroca);
  emTrocaRef.current = emTroca;
  // tipo da nota das peças de VENDA: o último NFC-e/NF-e escolhido
  const [ultimoTipoSaida, setUltimoTipoSaida] = useState(() => {
    const t = localStorage.getItem('pdv_crosby_tipo');
    return t && t !== 'troca' ? t : '';
  });
  useEffect(() => {
    if (tipoVenda && tipoVenda !== 'troca') setUltimoTipoSaida(tipoVenda);
  }, [tipoVenda]);
  const tipoSaida = tipoVenda && tipoVenda !== 'troca' ? tipoVenda : ultimoTipoSaida;
  // VENDA | TROCA: troca já autorizada neste atendimento, esperando a venda
  // { venda, nota, emitente, total }
  const [trocaFeita, setTrocaFeita] = useState(null);
  const [pagInicial, setPagInicial] = useState(null); // pagamentos já preenchidos (Credev da troca + diferença)
  const [etapa, setEtapa] = useState(''); // o que está acontecendo no VENDA | TROCA

  useEffect(() => localStorage.setItem('pdv_crosby_branch', branch), [branch]);
  useEffect(() => localStorage.setItem('pdv_crosby_seller', seller), [seller]);
  useEffect(() => localStorage.setItem('pdv_crosby_tipo', tipoVenda), [tipoVenda]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const carregarCaixa = useCallback(async () => {
    if (!branch) {
      setCaixaSit(null);
      return null;
    }
    const sit = await lerCaixa(branch);
    setCaixaSit(sit);
    return sit;
  }, [branch]);
  useEffect(() => {
    setCaixaSit(null);
    carregarCaixa();
    const t = setInterval(carregarCaixa, 60000);
    window.addEventListener('focus', carregarCaixa);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', carregarCaixa);
    };
  }, [carregarCaixa]);
  // em aba: ao voltar para a frente, relê o caixa (pode ter sido aberto/fechado em outra aba)
  useAoAtivarAba(carregarCaixa);

  useEffect(() => {
    if (!user?.id || ['admin', 'owner'].includes(user.role)) return;
    getUserCompanies(user.id).then(({ data }) => {
      if (data && data.length > 0) setEmpresasUsuario(data.map(String));
      // vendedor sem loja vinculada no Painel Admin não vê nenhuma empresa (Yago, 13/11/2026)
      else if (['guest', 'vendedor'].includes(user.role)) setEmpresasUsuario([]);
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
    setCashbackValor('');
    setCashbackRecusado(false);
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
        const rb = await fetch(
          `${API_BASE_URL}/api/totvs/pdv/bonus?${cpf ? `cpf=${cpf}&` : ''}branch=${branch}&cliente=${customer.code}`,
        );
        const jb = await rb.json();
        setCashback({ balance: jb?.data?.balance || 0, cpf: cpf || null, porEmpresa: jb?.data?.porEmpresa || [], headcoach: jb?.data?.headcoach || null });
      } catch {
        setCashback({ balance: 0, cpf: null });
      }
    })();
  }, [customer, branch]);

  // Limite do cliente no BlueCard: consulta quando o cliente (com CPF) é identificado
  useEffect(() => {
    setLimiteBluecard(null);
    const cpf = String(cashback?.cpf || '').replace(/\D/g, '');
    if (!customer || cpf.length !== 11) return undefined;
    let vivo = true;
    setLimiteBluecard({ carregando: true });
    fetch(`${API_BASE_URL}/api/pdv-crosby/bluecard/limite?cpf=${cpf}`)
      .then((r) => r.json())
      .then((j) => vivo && setLimiteBluecard(j?.success ? j.data : { erro: j?.message || true }))
      .catch(() => vivo && setLimiteBluecard({ erro: true }));
    return () => {
      vivo = false;
    };
  }, [customer, cashback?.cpf]);

  // Saldos do cliente NESTA loja: CREDEV e adiantamento do HeadCoach (a troca gera
  // CREDEV; os dois são formas de pagamento). Relê depois de cada venda ou troca.
  useEffect(() => {
    setSaldos(null);
    if (!customer || !branch) return undefined;
    let vivo = true;
    fetch(`${API_BASE_URL}/api/pdv-crosby/saldos-cliente/${customer.code}?empresa=${branch}`)
      .then((r) => r.json())
      .then((j) => {
        if (vivo) setSaldos(j?.success ? j.data : { credev: 0, adiantamento: 0, erro: j?.message || true });
      })
      .catch(() => {
        if (vivo) setSaldos({ credev: 0, adiantamento: 0, erro: true });
      });
    return () => {
      vivo = false;
    };
  }, [customer, branch, resultado?.venda?.id, resultado?.nota?.status]);

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
    const { product, prices, promoPdv } = data;
    // preço pela tabela da empresa (Midway: VAREJO SHOPPING)
    const padrao = precoDaEmpresa(prices, branchRef.current);
    const emPromo = padrao?.promotionalPrice > 0;
    // Promoção do PDV Crosby (tela Preço Promocional → GERAR NO PDV CROSBY):
    // preço cheio + desconto até o valor promocional. Se a promoção do TOTVS
    // já deixa mais barato, fica a do TOTVS.
    const precoCheio = padrao?.price || padrao?.promotionalPrice || 0;
    const usarPromoPdv =
      promoPdv?.precoPromocional > 0 &&
      precoCheio > promoPdv.precoPromocional &&
      !(emPromo && padrao.promotionalPrice <= promoPdv.precoPromocional);
    const unit = usarPromoPdv ? precoCheio : emPromo ? padrao.promotionalPrice : padrao?.price || 0;
    const promoDesconto = usarPromoPdv ? Number((precoCheio - promoPdv.precoPromocional).toFixed(2)) : 0;

    // bipada no modo TROCA → peça que o cliente está devolvendo
    const troca = emTrocaRef.current;
    const key = keyDe(product.productCode, troca);
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const next = [...prev];
        const cur = next[idx];
        const trocaDaEtiqueta = cur.doCupom && epc && !cur.epcs.includes(epc) && !manual && (cur.manualQty || 0) > 0;
        next[idx] = {
          ...cur,
          epcs: epc && !cur.epcs.includes(epc) ? [...cur.epcs, epc] : cur.epcs,
          manualQty: trocaDaEtiqueta ? cur.manualQty - 1 : (cur.manualQty || 0) + manual,
        };
        return next;
      }
      return [
        ...prev,
        {
          key,
          troca,
          productCode: product.productCode,
          name: product.productName,
          sku: product.productSku,
          referenceName: product.referenceName || null,
          unit,
          discount: promoDesconto,
          promoDesconto,
          promoNome: usarPromoPdv ? promoPdv.nome : null,
          fonte: usarPromoPdv ? 'promo-pdv' : emPromo ? 'promo' : unit > 0 ? 'varejo' : 'sem-preco',
          tabela: padrao?.tabela || null,
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
          `${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}?branch=${br}&priceCodes=${priceCodesDa(br)}`,
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
    potencia: rfidPotencia,
    lerPotencia: rfidLerPotencia,
    definirPotencia: rfidDefinirPotencia,
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
  // (a peça é identificada pela `key`: troca e venda da mesma peça são linhas separadas)
  const updateItem = useCallback((key, patch) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
  }, []);

  const ajustarManualQty = useCallback((key, delta) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.key === key
            ? { ...i, manualQty: Math.max(0, (i.manualQty || 0) + delta) }
            : i,
        )
        .filter((i) => qtyOf(i) > 0),
    );
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const aplicarDescontoGeral = useCallback(() => {
    if (!items.some((i) => !i.troca)) {
      showToast('erro', 'Na troca vale o valor pago na nota de origem: não há desconto');
      return;
    }
    const digitado = parseFloat(String(globalDiscount).replace(',', '.'));
    // base do desconto: as peças da venda, já sem o desconto de promoção
    const base = r2(items.filter((i) => !i.troca).reduce((t, i) => t + qtyOf(i) * (i.unit - (i.promoDesconto || 0)), 0));
    const emValor = descModo === 'valor';
    if (Number.isNaN(digitado) || digitado < 0 || (emValor ? digitado > base + 0.004 : digitado > 100)) {
      showToast('erro', emValor ? `Desconto inválido: de R$ 0,00 a ${fmtBRL(base)}` : 'Desconto geral inválido (0 a 100%)');
      return;
    }
    // em R$: vira o percentual equivalente sobre as peças da venda
    const pct = emValor ? (base > 0 ? (digitado / base) * 100 : 0) : digitado;
    // só nas peças da venda: a peça de troca volta pelo valor pago
    const aplicar = () =>
      setItems((prev) => {
        const next = prev.map((i) =>
          i.troca
            ? i
            : {
                ...i,
                discount: limiteDescontoItem(i, pct),
              },
        );
        if (emValor) {
          // centavos que sobram do arredondamento por peça vão para uma peça em que caibam exatos
          const dado = r2(next.filter((i) => !i.troca).reduce((t, i) => t + qtyOf(i) * (i.discount - (i.promoDesconto || 0)), 0));
          const sobraCent = Math.round((digitado - dado) * 100);
          if (sobraCent !== 0) {
            const k = next.findIndex((i) => !i.troca && sobraCent % qtyOf(i) === 0 && i.discount + sobraCent / 100 / qtyOf(i) >= (i.promoDesconto || 0) && i.discount + sobraCent / 100 / qtyOf(i) <= i.unit);
            if (k >= 0) next[k] = { ...next[k], discount: r2(next[k].discount + sobraCent / 100 / qtyOf(next[k])) };
          }
        }
        return next;
      });
    if (pct > maxDescPct + 0.0001) setSenhaDesconto({ pct, aplicar });
    else aplicar();
  }, [globalDiscount, descModo, maxDescPct, showToast, items]);

  // Desconto por peça (R$ no unitário): acima do limite pede a senha
  const mudarDescontoItem = useCallback(
    (item, valor) => {
      const v = Math.min(Math.max(parseFloat(valor) || 0, 0), item.unit);
      const limite = limiteDescontoItem(item, maxDescPct);
      if (v <= limite) {
        updateItem(item.key, { discount: v });
        return;
      }
      updateItem(item.key, { discount: limite });
      const promo = item.promoDesconto || 0;
      setSenhaDesconto({
        pct: ((v - promo) / (item.unit - promo)) * 100,
        aplicar: () => updateItem(item.key, { discount: v }),
      });
    },
    [maxDescPct, updateItem],
  );

  // TROCA: confere as peças nas compras do cliente sempre que muda o cliente,
  // a empresa ou a lista (código + quantidade). O servidor confere de novo ao gravar.
  const itensTroca = useMemo(() => items.filter((i) => i.troca), [items]);
  const itensVenda = useMemo(() => items.filter((i) => !i.troca), [items]);
  const temTroca = itensTroca.length > 0;
  const temVenda = itensVenda.length > 0;
  const combinado = temTroca && temVenda; // VENDA | TROCA no mesmo atendimento
  const trocaChave = useMemo(
    () =>
      branch && (cupomTroca || customer?.code) && itensTroca.length > 0
        ? JSON.stringify([branch, customer?.code || null, itensTroca.map((i) => [i.productCode, qtyOf(i)]), cupomTroca?.codigo || null])
        : null,
    [branch, customer?.code, itensTroca, cupomTroca],
  );
  // sem peça de troca, o cupom sai do atendimento
  useEffect(() => {
    if (itensTroca.length === 0) setCupomTroca(null);
  }, [itensTroca.length]);
  useEffect(() => {
    if (!trocaChave) {
      setTrocaConf(TROCA_VAZIA);
      return undefined;
    }
    let vivo = true;
    setTrocaConf((c) => ({ ...c, status: 'carregando', erro: null }));
    const t = setTimeout(async () => {
      try {
        const [emp, cli, lista, cupom] = JSON.parse(trocaChave);
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/troca/conferir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa: parseInt(emp, 10),
            clienteCode: cli,
            ...(cupom ? { cupom } : {}),
            itens: lista.map(([productCode, quantidade]) => ({ productCode, quantidade })),
          }),
        });
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao conferir as compras do cliente');
        setTrocaConf({
          status: 'ok',
          porProduto: Object.fromEntries((j.data.itens || []).map((i) => [i.productCode, i])),
          avisos: j.data.avisos || [],
          erro: null,
        });
      } catch (e) {
        if (vivo) setTrocaConf({ status: 'erro', porProduto: {}, avisos: [], erro: e.message });
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [trocaChave, TROCA_VAZIA]);

  // Preço da peça na tela e na venda: na TROCA é o valor PAGO na nota de origem
  // (sem desconto); nas vendas, o preço de varejo com o desconto dado.
  const precoDe = useCallback(
    (i) =>
      i.troca
        ? { unit: Number(trocaConf.porProduto[i.productCode]?.valorUnit) || 0, discount: 0 }
        : { unit: i.unit, discount: i.discount || 0 },
    [trocaConf],
  );
  const trocaOk = temTroca && trocaConf.status === 'ok' && itensTroca.every((i) => trocaConf.porProduto[i.productCode]?.ok);
  // notas de origem (sem repetir) que a NF-e de devolução vai referenciar
  const notasDaTroca = useMemo(() => {
    const m = new Map();
    for (const i of itensTroca) for (const nt of trocaConf.porProduto[i.productCode]?.notas || []) if (nt.chave) m.set(nt.chave, nt);
    return [...m.values()];
  }, [itensTroca, trocaConf]);

  // Alguma peça da venda com desconto acima do limite sem liberação (segurança extra)
  const descontoForaDoLimite =
    maxDescPct < 100 && itensVenda.some((i) => (i.discount || 0) > limiteDescontoItem(i, maxDescPct) + 0.005);

  // Carrinho na tela: primeiro as peças da TROCA, depois as da VENDA, cada parte
  // agrupada pela referência
  const grupos = useMemo(() => {
    const agrupar = (lista, troca) => {
      const map = new Map();
      for (const i of lista) {
        const key = i.referenceName || 'OUTROS';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(i);
      }
      return [...map.entries()]
        .map(([nome, its]) => ({
          nome,
          troca,
          items: its,
          qty: its.reduce((s, i) => s + qtyOf(i), 0),
          total: its.reduce((s, i) => {
            const pr = precoDe(i);
            return s + qtyOf(i) * (pr.unit - pr.discount);
          }, 0),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((g, idx) => ({ ...g, primeiro: idx === 0 }));
    };
    return [...agrupar(itensTroca, true), ...agrupar(itensVenda, false)];
  }, [itensTroca, itensVenda, precoDe]);

  // Subtotal, descontos, cashback e total são da VENDA; `troca` é o valor das
  // peças devolvidas (vira Credev e paga a venda). aPagar = o que falta em
  // dinheiro/cartão/Pix; sobra = Credev que fica para o cliente.
  const totals = useMemo(() => {
    const qty = items.reduce((s, i) => s + qtyOf(i), 0);
    const subtotal = itensVenda.reduce((s, i) => s + qtyOf(i) * precoDe(i).unit, 0);
    const discounts = itensVenda.reduce((s, i) => s + qtyOf(i) * precoDe(i).discount, 0);
    const base = subtotal - discounts;
    const troca = r2(itensTroca.reduce((s, i) => s + qtyOf(i) * precoDe(i).unit, 0));
    // Cashback consumível: limitado pelo saldo E pela regra venda >= 3x o uso
    const saldo = cashback?.balance || 0;
    const maxPelaVenda = base / PDV_VAREJO_CONFIG.cashbackFatorMinimo;
    const cashbackDisponivel = Math.min(saldo, Math.floor(maxPelaVenda * 100) / 100);
    // uso PARCIAL: o valor digitado, sempre dentro do que a venda permite
    const pedido = String(cashbackValor).trim() === '' ? cashbackDisponivel : parseFloat(String(cashbackValor).replace(',', '.'));
    const cashbackAplicado =
      cashbackUsar && cashbackDisponivel > 0 && pedido > 0 ? r2(Math.min(pedido, cashbackDisponivel)) : 0;
    const total = base - cashbackAplicado;
    return {
      qty,
      subtotal,
      discounts,
      cashbackDisponivel,
      cashbackAplicado,
      total,
      troca,
      aPagar: r2(Math.max(0, total - troca)),
      sobra: r2(Math.max(0, troca - total)),
    };
  }, [items, itensVenda, itensTroca, cashback, cashbackUsar, cashbackValor, precoDe]);

  const novaVenda = useCallback(() => {
    setItems([]);
    setCustomer(null);
    setResultado(null);
    setPagamentoOpen(false);
    setTrocaFeita(null);
    setPagInicial(null);
    setEtapa('');
    setCashback(null);
    setCashbackUsar(false);
    setCashbackValor('');
    setCashbackRecusado(false);
    setDescontoLiberado(null);
    setGlobalDiscount('');
    cashbackGeradoRef.current = false;
    processedEpcs.current = new Set();
  }, []);

  const limpar = useCallback(() => {
    setItems([]);
    processedEpcs.current = new Set();
  }, []);

  // ─── Pode finalizar? ─────────────────────────────────────────────────────
  // NFC-e pode ser sem cliente; NF-e e TROCA exigem cliente identificado. Na
  // TROCA todas as peças têm que ter sido achadas nas compras do cliente.
  // Com peças de troca E de venda no carrinho, fecha os dois de uma vez (VENDA | TROCA).
  const prontoBase =
    !hcBusy &&
    items.length > 0 &&
    branch &&
    seller &&
    (!temVenda || tipoSaida) &&
    items.every((i) => qtyOf(i) > 0 && (i.troca || i.unit > 0));
  const canGenerate = prontoBase && (!temVenda || tipoSaida === 'nfce' || customer) && (!temTroca || (customer && trocaOk));
  // por que o botão está travado (aparece embaixo dele)
  const motivoBloqueio = !branch || !seller
    ? 'Preencha empresa e vendedor.'
    : temVenda && !tipoSaida
      ? 'Escolha NFC-e ou NF-e para as peças da venda.'
      : temTroca && !customer
        ? cupomTroca
          ? 'Cadastre ou selecione quem está trocando: é o cliente da troca.'
          : 'Selecione o cliente: a troca confere as compras dele.'
        : temTroca && trocaConf.status === 'carregando'
          ? 'Conferindo as compras do cliente…'
          : temTroca && trocaConf.status === 'erro'
            ? 'Não consegui conferir as compras do cliente. Mexa na lista para tentar de novo.'
            : temTroca && !trocaOk
              ? 'Há peça que o cliente não comprou ou já devolveu: tire-a da troca.'
              : temVenda && tipoSaida === 'nfe' && !customer
                ? 'NF-e exige cliente identificado.'
                : itensVenda.some((i) => !(i.unit > 0))
                  ? 'Há peça sem preço de varejo na venda.'
                  : '';
  const trocaTravando = temTroca && customer && trocaConf.status === 'ok' && !trocaOk;

  // mudou o cliente ou a empresa: a troca feita não vale para este atendimento
  useEffect(() => {
    setTrocaFeita(null);
    setPagInicial(null);
  }, [customer?.code, branch]);

  // pagamentos já preenchidos: Credev (da troca) + a diferença numa forma comum
  const pagamentosComCredev = (totalVenda, credev) => {
    const usar = r2(Math.min(credev, totalVenda));
    const resto = r2(totalVenda - usar);
    const vazio = { parcelas: 1, bandeira: '', nsu: '', autorizacao: '' };
    const lista = [];
    if (usar > 0) lista.push({ ...vazio, forma: 'credito_loja', valor: usar });
    if (resto > 0.004) lista.push({ ...vazio, forma: 'pix', valor: resto });
    return lista;
  };

  // ─── Antes de finalizar: desconto dentro do limite e cashback não usado ────
  // VENDA | TROCA vai direto (registra a troca, gera o Credev e fecha a venda);
  // venda com a troca já feita abre o pagamento com o Credev preenchido.
  const finalizarAgora = () => {
    if (combinado) {
      finalizarCombinadoRef.current();
      return;
    }
    if (temVenda && trocaFeita) setPagInicial(pagamentosComCredev(r2(totals.total), Math.min(trocaFeita.total, Number(saldos?.credev) || 0)));
    else setPagInicial(null);
    setPagamentoOpen(true);
  };
  const finalizarAgoraRef = useRef(finalizarAgora);
  finalizarAgoraRef.current = finalizarAgora;
  const finalizarCombinadoRef = useRef(() => {});

  const iniciarFinalizacao = async () => {
    if (!canGenerate) return;
    // só vende com o caixa aberto (confere na hora: alguém pode ter fechado)
    const cx = await carregarCaixa();
    if (!cx || cx.erro) {
      showToast('erro', `Não consegui conferir o caixa${cx?.erro ? `: ${cx.erro}` : ''}. Tente de novo.`);
      return;
    }
    if (!cx.aberto) {
      setPedirCaixa(true);
      return;
    }
    if (descontoForaDoLimite) {
      showToast('erro', `Desconto acima de ${String(maxDescPct).replace('.', ',')}% precisa da senha de quem tem esse desconto liberado`);
      return;
    }
    if (temVenda && !cashbackUsar && !cashbackRecusado && totals.cashbackDisponivel > 0) {
      setPerguntaCashback(true);
      return;
    }
    finalizarAgora();
  };

  // valor do cashback escolhido na pergunta (parcial ou tudo o que a venda permite)
  const cashbackEscolhido = (() => {
    const v = String(cashbackValor).trim() === '' ? totals.cashbackDisponivel : parseFloat(String(cashbackValor).replace(',', '.'));
    return v > 0 ? r2(Math.min(v, totals.cashbackDisponivel)) : 0;
  })();

  // "Sim, usar cashback": espera o total recalcular e segue a finalização
  useEffect(() => {
    if (!continuarFinalizacao) return;
    setContinuarFinalizacao(false);
    finalizarAgoraRef.current();
  }, [continuarFinalizacao]);

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
    async ({ total, customerCode, transactionCode, transactionDate, origem, vendaId = null }) => {
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
            vendaId: vendaId || undefined,
            transactionCode: transactionCode || undefined,
            transactionDate: transactionDate || undefined,
            historic: `Cashback ${PDV_VAREJO_CONFIG.cashbackGerarPct}% - ${origem}`,
          }),
        });
        const j = await r.json();
        if (r.ok && j.success) {
          const dia = (d) => String(d || '').slice(0, 10).split('-').reverse().slice(0, 2).join('/');
          const gerado = Number(j.data?.valor) > 0 ? Number(j.data.valor) : valor;
          showToast(
            'ok',
            j.data?.liberaEm
              ? `Cashback de ${fmtBRL(gerado)} gerado para o cliente! 💰 Pode usar a partir de ${dia(j.data.liberaEm)}, vale até ${dia(j.data.expiraEm)}.`
              : `Cashback de ${fmtBRL(gerado)} gerado para o cliente! 💰`,
          );
          return gerado;
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

  // Espelha a venda HEADCOACH no TOTVS como documento interno + recebimento
  // (ATENDIDA). Atualiza a venda do resultado com os campos totvs_*.
  const espelharNoTotvs = useCallback(
    async (vendaId, { avisar = true } = {}) => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${vendaId}/espelhar-totvs`, { method: 'POST' });
        const j = await r.json();
        const venda = j?.data?.venda || j?.details?.venda || null;
        if (venda) setResultado((prev) => (prev ? { ...prev, venda: { ...prev.venda, ...venda } } : prev));
        if (!r.ok || !j.success) {
          if (avisar) showToast('erro', `TOTVS: ${j?.message || 'falha ao espelhar a venda'}`);
          return false;
        }
        if (avisar && !j.data?.espelho?.ignorado) showToast('ok', j.message || 'Venda recebida no TOTVS');
        return true;
      } catch (e) {
        if (avisar) showToast('erro', `TOTVS: ${e.message}`);
        return false;
      }
    },
    [showToast],
  );

  // Registra UMA transação no HeadCoach (troca ou venda). Devolve a venda gravada
  // ou null (o aviso já foi mostrado).
  const registrar = useCallback(
    async ({ tipo, lista, pagamentos = [], cb = 0, baseVenda = 0, trocaVendaId = null }) => {
      const empresaSel = branches.find((b) => String(b.cd_empresa) === String(branch));
      const vendedorSel = sellers.find((s) => String(s.code) === String(seller));
      // Cashback usado entra como desconto proporcional nos itens (igual ao TOTVS)
      const itens = lista.map((i) => {
        const q = qtyOf(i);
        const pr = precoDe(i);
        const itemTotal = q * (pr.unit - pr.discount);
        const extraUnit =
          cb > 0 && baseVenda > 0 ? Number((((itemTotal / baseVenda) * cb) / q).toFixed(2)) : 0;
        return {
          productCode: i.productCode,
          sku: i.sku,
          nome: i.name,
          referencia: i.referenceName,
          quantidade: q,
          valorUnit: Number(Number(pr.unit).toFixed(2)),
          descontoUnit: Number((pr.discount + extraUnit).toFixed(2)),
          epcs: i.epcs,
        };
      });
      const payload = {
        empresa: parseInt(branch, 10),
        empresaCnpj: empresaSel?.cnpj || null,
        empresaNome: empresaSel?.nm_grupoempresa || null,
        tipoVenda: tipo,
        operacao: operacaoPara(tipo, branch, fiscalCfg) || null,
        cliente: customer
          ? { code: customer.code, nome: customer.name, cpfCnpj: cashback?.cpf || null }
          : null,
        vendedor: { code: parseInt(seller, 10), nome: vendedorSel?.name || null },
        itens,
        pagamentos,
        cashbackUsado: cb,
        // venda feita junto com uma troca (VENDA | TROCA): amarra uma na outra
        trocaVendaId,
        // troca de presente: confere contra a venda do cupom e anota o uso
        ...(tipo === 'troca' && cupomTroca ? { cupomTroca: cupomTroca.codigo } : {}),
        criadoPor: user?.email || user?.name || null,
      };
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        showToast('erro', j?.message || (tipo === 'troca' ? 'Falha ao registrar a troca' : 'Falha ao registrar a venda'));
        // troca recusada no servidor (a compra mudou): mostra o motivo em cada peça
        if (j?.error === 'TROCA_SEM_COMPRA' && j?.details?.itens) {
          setPagamentoOpen(false);
          setTrocaConf({
            status: 'ok',
            porProduto: Object.fromEntries(j.details.itens.map((i) => [i.productCode, i])),
            avisos: j.details.avisos || [],
            erro: null,
          });
        }
        return null;
      }
      return j.data;
    },
    [branches, branch, sellers, seller, fiscalCfg, customer, cashback, user, showToast, precoDe, cupomTroca],
  );

  // ─── CUPOM DE TROCA (presente): lê o código/QR e abre as peças da venda ────
  const lerCupom = useCallback(
    async (e) => {
      e?.preventDefault();
      const cod = cupomCodigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!cod || cupomBusy) return;
      setCupomBusy(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/troca/cupom/${cod}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Cupom não encontrado');
        if (!j.data.itens.some((i) => i.disponivel > 0)) throw new Error(`Todas as peças do cupom ${cod} já foram trocadas`);
        setCupomModal({ ...j.data, escolha: {} });
        setCupomCodigo('');
      } catch (er) {
        beep(false);
        showToast('erro', er.message);
      } finally {
        setCupomBusy(false);
      }
    },
    [cupomCodigo, cupomBusy, showToast],
  );
  const usarCupom = useCallback(() => {
    if (!cupomModal) return;
    const escolhidas = cupomModal.itens.filter((i) => Number(cupomModal.escolha[i.productCode]) > 0);
    if (!escolhidas.length) return;
    // um cupom por troca: outro cupom substitui as peças que vieram do anterior
    const trocaDeCupom = cupomTroca && cupomTroca.codigo !== cupomModal.cupom.codigo;
    setItems((prev) => {
      let next = trocaDeCupom ? prev.filter((i) => !(i.troca && i.doCupom)) : [...prev];
      for (const it of escolhidas) {
        const qtd = Number(cupomModal.escolha[it.productCode]);
        const key = keyDe(it.productCode, true);
        const idx = next.findIndex((x) => x.key === key);
        if (idx >= 0) next[idx] = { ...next[idx], doCupom: true, manualQty: Math.max(0, qtd - (next[idx].epcs || []).length) };
        else
          next = [
            ...next,
            { key, troca: true, doCupom: true, productCode: it.productCode, name: it.nome, sku: null, referenceName: null, unit: Number(it.valorUnit) || 0, discount: 0, promoDesconto: 0, fonte: 'cupom', epcs: [], manualQty: qtd },
          ];
      }
      return next;
    });
    setCupomTroca({ codigo: cupomModal.cupom.codigo, comprador: cupomModal.comprador, origem: cupomModal.origem });
    setTipoVenda('troca');
    setCupomModal(null);
    beep(true);
  }, [cupomModal, cupomTroca]);

  // Emite a nota da transação e devolve o "resultado" que o modal mostra
  const emitirResultado = useCallback(
    async (venda) => {
      const em = await emitirNota(venda.id);
      return em.data
        ? {
            venda: em.data.venda || venda,
            nota: em.data.nota || null,
            emitente: em.data.emitente || null,
            erro: em.ok ? null : em.message,
          }
        : { venda, nota: null, emitente: null, erro: em.message };
    },
    [emitirNota],
  );

  // Credev e adiantamento do cliente nesta loja, lidos na hora (depois da troca
  // autorizada o Credev dela já está no saldo)
  const lerSaldos = useCallback(async () => {
    if (!customer?.code || !branch) return null;
    try {
      const j = await fetch(`${API_BASE_URL}/api/pdv-crosby/saldos-cliente/${customer.code}?empresa=${branch}`).then((r) => r.json());
      if (!j?.success) return null;
      setSaldos(j.data);
      return j.data;
    } catch {
      return null;
    }
  }, [customer?.code, branch]);

  // VENDA: registra, consome o cashback usado, emite a nota, espelha e gera o
  // cashback novo. `troca` = a troca feita neste mesmo atendimento (VENDA | TROCA).
  const concluirVenda = useCallback(
    async ({ pagamentos, troca = null }) => {
      const cb = totals.cashbackAplicado;
      const venda = await registrar({
        tipo: tipoSaida,
        lista: itensVenda,
        pagamentos,
        cb,
        baseVenda: totals.subtotal - totals.discounts,
        trocaVendaId: troca?.venda?.id || null,
      });
      if (!venda) return false;
      setPagamentoOpen(false);
      setPagInicial(null);
      setTrocaFeita(null);
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
              // com o CPF o servidor baixa o cashback de qualquer loja em que o cliente tenha saldo
              cpf: cashback?.cpf || null,
              vendaId: venda.id,
            }),
          });
          const jc = await rc.json();
          if (!rc.ok || !jc.success)
            showToast(
              'erro',
              `Venda ok, mas a baixa do cashback falhou: ${jc?.message || ''} — avise o financeiro`,
            );
        } catch {
          showToast('erro', 'Venda ok, mas a baixa do cashback falhou — avise o financeiro');
        }
      }

      // Emite a nota
      const res = await emitirResultado(venda);
      const credevUsado = r2(
        pagamentos.filter((p) => p.forma === 'credito_loja').reduce((s, p) => s + (Number(p.valor) || 0), 0),
      );
      setResultado(troca ? { ...res, troca: { ...troca, credevUsado } } : res);
      // Espelho no TOTVS (documento interno): independe da nota ter saído —
      // a venda aconteceu; a nota pode ser reemitida depois.
      espelharNoTotvs(venda.id);
      if (res.nota?.status === 'autorizada') {
        beep(true);
        const gerado = await gerarCashback({
          total: Number(venda.total),
          customerCode: customer?.code,
          origem: `venda HeadCoach ${venda.id} (PDV Crosby)`,
          vendaId: venda.id,
        });
        if (gerado)
          setResultado((prev) =>
            prev ? { ...prev, venda: { ...prev.venda, cashback_gerado: gerado } } : prev,
          );
      } else {
        beep(false);
      }
      return true;
    },
    [totals, registrar, tipoSaida, itensVenda, customer, branch, showToast, emitirResultado, espelharNoTotvs, gerarCashback],
  );

  // VENDA | TROCA, 2º passo — a troca foi autorizada e o Credev existe: fecha a
  // venda com ele. Cobriu a venda inteira → fecha sozinho (o que sobrar fica de
  // Credev para o cliente). Faltou → abre o pagamento com o Credev já lançado e
  // a diferença para pagar.
  const seguirParaVenda = useCallback(
    async (troca) => {
      setEtapa('Troca registrada. Conferindo o Credev do cliente…');
      const s = await lerSaldos();
      const credev = r2(Math.min(troca.total, Number(s?.credev) || 0));
      const totalVenda = r2(totals.total);
      setTrocaFeita(troca);
      if (credev >= totalVenda - 0.004) {
        setEtapa('Fechando a venda com o Credev da troca…');
        return concluirVenda({
          pagamentos: [{ forma: 'credito_loja', valor: totalVenda, parcelas: 1, troco: 0 }],
          troca,
        });
      }
      setPagInicial(pagamentosComCredev(totalVenda, credev));
      setPagamentoOpen(true);
      if (credev < troca.total - 0.005)
        showToast('erro', `O Credev da troca (${fmtBRL(troca.total)}) ainda não está no saldo do cliente: confira o pagamento.`);
      else showToast('ok', `Troca registrada: Credev de ${fmtBRL(troca.total)} gerado. Falta pagar ${fmtBRL(r2(totalVenda - credev))}.`);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lerSaldos, totals, concluirVenda, showToast],
  );

  // VENDA | TROCA, 1º passo — registra a troca, emite a NF-e de devolução (o
  // servidor gera o Credev na autorização) e segue para a venda.
  const finalizarCombinado = useCallback(async () => {
    if (!canGenerate || !combinado) return;
    setHcBusy(true);
    try {
      setEtapa('Registrando a troca e emitindo a NF-e de devolução…');
      const vTroca = await registrar({ tipo: 'troca', lista: itensTroca });
      if (!vTroca) return;
      beep(true);
      // a troca está gravada: as peças dela saem do carrinho (ficam as da venda)
      setItems((prev) => prev.filter((i) => !i.troca));
      const res = await emitirResultado(vTroca);
      if (res.nota?.status !== 'autorizada') {
        // sem nota autorizada não há Credev: a venda espera no carrinho
        beep(false);
        setResultado({ ...res, vendaPendente: true });
        return;
      }
      await seguirParaVenda({ venda: res.venda, nota: res.nota, emitente: res.emitente, total: Number(res.venda.total) });
    } catch (e) {
      showToast('erro', `Falha ao finalizar: ${e.message}`);
    } finally {
      setHcBusy(false);
      setEtapa('');
    }
  }, [canGenerate, combinado, registrar, itensTroca, emitirResultado, seguirParaVenda, showToast]);
  finalizarCombinadoRef.current = finalizarCombinado;

  // Confirmação do modal: só TROCA (registra e emite a devolução) ou VENDA
  // (com a troca do atendimento, se houver)
  const finalizarHeadcoach = useCallback(
    async ({ pagamentos }) => {
      if (!canGenerate) return;
      setHcBusy(true);
      try {
        if (!temVenda) {
          const vTroca = await registrar({ tipo: 'troca', lista: itensTroca });
          if (!vTroca) return;
          setPagamentoOpen(false);
          beep(true);
          const res = await emitirResultado(vTroca);
          setResultado(res);
          beep(res.nota?.status === 'autorizada');
          return;
        }
        await concluirVenda({ pagamentos, troca: trocaFeita });
      } catch (e) {
        showToast('erro', `Falha ao finalizar: ${e.message}`);
      } finally {
        setHcBusy(false);
      }
    },
    [canGenerate, temVenda, registrar, itensTroca, emitirResultado, concluirVenda, trocaFeita, showToast],
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
      const autorizou = res.nota?.status === 'autorizada';
      // troca do VENDA | TROCA que tinha sido rejeitada: agora o Credev existe, segue a venda
      if (autorizou && resultado.vendaPendente && res.venda.tipo_venda === 'troca' && temVenda) {
        setResultado(null);
        await seguirParaVenda({ venda: res.venda, nota: res.nota, emitente: res.emitente, total: Number(res.venda.total) });
        return;
      }
      setResultado({ ...res, troca: resultado.troca, vendaPendente: resultado.vendaPendente && !autorizou });
      if (autorizou && resultado.venda.tipo_venda !== 'troca') {
        await gerarCashback({
          total: Number(res.venda.total),
          customerCode: res.venda.cliente_code,
          origem: `venda HeadCoach ${res.venda.id} (PDV Crosby)`,
          vendaId: res.venda.id,
        });
      }
    } finally {
      setHcBusy(false);
      setEtapa('');
    }
  }, [resultado, emitirNota, gerarCashback, temVenda, seguirParaVenda]);

  const recarregarResultado = useCallback(async () => {
    if (!resultado?.nota?.id) return;
    const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${resultado.nota.id}`);
    const j = await r.json();
    if (r.ok && j.success)
      setResultado({ venda: j.data.venda, nota: j.data.nota, emitente: j.data.emitente, troca: resultado.troca, vendaPendente: resultado.vendaPendente });
  }, [resultado]);

  useEffect(() => {
    carregarRanking();
  }, [carregarRanking, resultado]);

  return (
    <div ref={rootRef} className={`flex-1 min-h-0 relative flex flex-col bg-gray-100 ${escuro && telaCheia ? 'pdv-dark-fs' : ''}`}>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-4">
      <div className={`${telaCheia ? 'max-w-none' : 'max-w-7xl'} mx-auto`}>
        {/* ── Topo: venda (empresa, vendedor, cliente) · dados do cliente · ranking ── */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          {/* Vendedor / cliente / cadastrar */}
          <div className="space-y-2">
            <div className="flex gap-2">
            <CaixaCard branch={branch} sit={caixaSit} temItens={items.length > 0} />
            <div className="relative flex-1 min-w-0">
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

          {/* Dados do cliente, cashback e credev */}
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
                <div className={`mt-2 grid gap-1.5 ${limiteBluecard ? 'grid-cols-2' : 'grid-cols-3'}`} data-saldos-cliente>
                  {[
                    { label: 'Cashback', valor: cashback?.balance, carregando: !cashback, cor: 'text-emerald-700' },
                    { label: 'Credev', valor: saldos?.credev, carregando: !saldos, cor: 'text-blue-700' },
                    { label: 'Adiantamento', valor: saldos?.adiantamento, carregando: !saldos, cor: 'text-purple-700' },
                    // crediário BlueCard: quanto o cliente ainda pode comprar (não aparece para quem não tem CPF)
                    ...(limiteBluecard
                      ? [{ label: 'Limite BlueCard', valor: limiteBluecard.disponivel, carregando: !!limiteBluecard.carregando, cor: 'text-sky-700', nota: limiteBluecard.erro ? 'indisponível' : limiteBluecard.pode === false && limiteBluecard.motivo ? limiteBluecard.motivo : null }]
                      : []),
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg bg-white ring-1 ring-gray-200 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{c.label}</p>
                      <p className={`text-sm font-bold tabular-nums ${Number(c.valor) > 0 ? c.cor : 'text-gray-400'}`}>
                        {c.carregando ? '…' : c.nota === 'indisponível' ? '—' : fmtBRL(c.valor)}
                      </p>
                      {c.nota && <p className="truncate text-[9px] leading-tight text-gray-500" title={c.nota}>{c.nota}</p>}
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
                      <b>Usar cashback</b>
                      {totals.cashbackAplicado > 0 && ` (−${fmtBRL(totals.cashbackAplicado)})`} — para usar tudo, a venda precisa ser de pelo menos{' '}
                      {fmtBRL(cashback.balance * PDV_VAREJO_CONFIG.cashbackFatorMinimo)}
                    </span>
                  </label>
                )}
                {cashback?.headcoach?.emCarencia > 0 && (
                  <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800 ring-1 ring-amber-200">
                    <b>{fmtBRL(cashback.headcoach.emCarencia)}</b> de cashback ainda em carência (só pode usar 3 dias depois da compra)
                    {cashback.headcoach.proximaLiberacao?.data &&
                      ` — ${fmtBRL(cashback.headcoach.proximaLiberacao.valor)} libera${cashback.headcoach.proximaLiberacao.valor >= 2 ? 'm' : ''} em ${String(cashback.headcoach.proximaLiberacao.data).split('-').reverse().join('/')}`}
                    .
                  </p>
                )}
                {cashback?.headcoach?.disponivel > 0 && cashback.headcoach.proximoVencimento?.data && (
                  <p className="mt-1 text-[10px] text-emerald-700">
                    {fmtBRL(cashback.headcoach.proximoVencimento.valor)} do cashback vale{cashback.headcoach.proximoVencimento.valor >= 2 ? 'm' : ''} até{' '}
                    {String(cashback.headcoach.proximoVencimento.data).split('-').reverse().join('/')}.
                  </p>
                )}
                {cashback && cashback.balance > 0 && (cashback.porEmpresa || []).some((b) => Number(b.branchCode) !== Number(branch)) && (
                  <p className="mt-1 text-[10px] text-emerald-700">
                    O cashback vale em qualquer loja. Saldo por loja: {cashback.porEmpresa.map((b) => `${b.branchCode} ${fmtBRL(b.balance)}`).join(' · ')}
                    {cashback.headcoach?.disponivel > 0 ? ` · HeadCoach ${fmtBRL(cashback.headcoach.disponivel)}` : ''}
                  </p>
                )}
                {cashback && cashback.balance > 0 && cashbackUsar && totals.cashbackDisponivel > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-800">
                    <span>Usar</span>
                    <span className="font-semibold">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={totals.cashbackDisponivel}
                      value={cashbackValor}
                      onChange={(e) => setCashbackValor(e.target.value)}
                      placeholder={totals.cashbackDisponivel.toFixed(2)}
                      title="Deixe em branco para usar tudo o que a venda permite"
                      className="h-7 w-20 mb-0 rounded-md border border-emerald-300 px-1.5 text-right text-[12px] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                    <span>
                      de <b>{fmtBRL(totals.cashbackDisponivel)}</b> que esta venda permite
                    </span>
                    {parseFloat(String(cashbackValor).replace(',', '.')) > totals.cashbackDisponivel + 0.004 && (
                      <span className="font-semibold text-amber-700">· acima do limite: usa {fmtBRL(totals.cashbackDisponivel)}</span>
                    )}
                  </div>
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
          {emTroca && (
            <form onSubmit={lerCupom} className="relative w-full sm:w-56" title="Troca de presente: digite o código ou leia o QR Code do cupom de troca">
              <Ticket size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-500" />
              <input
                value={cupomCodigo}
                onChange={(e) => setCupomCodigo(e.target.value.toUpperCase())}
                placeholder="Cupom de troca (código ou QR)"
                className="w-full h-9 pl-8 pr-8 mb-0 rounded-lg border border-purple-300 bg-purple-50/40 text-xs font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              {cupomBusy && <Spinner size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-400 animate-spin" />}
            </form>
          )}
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
                  Navegador sem suporte ao leitor USB — use Chrome ou Edge.
                </p>
              )}
              {rfidError && (
                <p className="text-[10px] text-amber-600">{rfidError}</p>
              )}
              {/* potência do leitor: abaixo do botão, como no portal (Yago, 19/11/2026) */}
              {rfidSupported && (
                <LeitorRfidPotencia status={rfidStatus} potencia={rfidPotencia} lerPotencia={rfidLerPotencia} definirPotencia={rfidDefinirPotencia} className="mt-1.5" />
              )}

          </div>
        </div>

        {/* ── Operação da venda e atalhos ── */}
        <div className="mb-2 flex flex-wrap items-center gap-2 min-h-[1rem]">
          {operation ? (
            <span className="text-[11px] text-gray-400">
              operação {operation}
              {usaTabelaShopping(branch) && <b className="ml-2 text-[#000638]">tabela {TABELA_SHOPPING.nome}</b>}
            </span>
          ) : (
            tipoVenda && branch && <span className="text-[11px] text-rose-600">Empresa {branch} sem operação configurada para este tipo.</span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => (branch ? setShowMovimento(true) : showToast('erro', 'Escolha a empresa'))}
            className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 inline-flex items-center gap-1"
            title="Vendas e devoluções do dia da empresa"
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
          <button
            onClick={() => setShowVendas(true)}
            disabled={!branch}
            className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
          >
            <ListBullets size={14} /> Vendas do dia
          </button>
          <button
            onClick={() => setShowCancelar(true)}
            disabled={!branch}
            className="h-9 px-2.5 rounded-lg text-xs font-semibold text-rose-600 bg-white ring-1 ring-rose-200 shadow-sm hover:bg-rose-50 disabled:opacity-40 inline-flex items-center gap-1"
            title="Cancela uma transação que ainda não teve a nota autorizada (registrada ou rejeitada). Venda já atendida: Financeiro › Cancelamento de Transação"
          >
            <Prohibit size={14} weight="bold" /> Cancelar em andamento
          </button>
          {podeConfigurarFiscal && (
            <button
              onClick={() => setShowConfig(true)}
              disabled={!branch}
              className="h-9 px-2.5 rounded-lg text-xs font-semibold text-[#000638] bg-white ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
              title="Ambiente, série, CSC, alíquota"
            >
              <Gear size={14} /> Fiscal
            </button>
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
                    <React.Fragment key={`${g.troca ? 'T' : 'V'}:${g.nome}`}>
                      {g.troca && g.primeiro && (
                        <>
                          <tr className="bg-purple-100">
                            <td colSpan={6} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-800">
                              Troca — peças que o cliente está devolvendo
                              {cupomTroca && (
                                <span className="ml-1 normal-case font-semibold">
                                  · pelo cupom <b className="font-mono">{cupomTroca.codigo}</b>
                                  {cupomTroca.comprador?.nome ? ` (comprado por ${cupomTroca.comprador.nome})` : ''}
                                </span>
                              )}
                              {!customer && !cupomTroca
                                ? ' · selecione o cliente para conferir as compras dele'
                                : !customer
                                  ? ' · cadastre ou selecione quem está trocando'
                                : trocaConf.status === 'carregando'
                                  ? ' · conferindo as compras do cliente…'
                                  : trocaConf.status === 'erro'
                                    ? ` · ${trocaConf.erro}`
                                    : ` · valor pago na nota de origem · vira Credev de ${fmtBRL(totals.troca)}`}
                            </td>
                          </tr>
                          {trocaConf.avisos.map((a) => (
                            <tr key={a} className="bg-amber-50">
                              <td colSpan={6} className="px-3 py-1 text-[11px] text-amber-800">{a}</td>
                            </tr>
                          ))}
                        </>
                      )}
                      {!g.troca && g.primeiro && temTroca && (
                        <tr className="bg-emerald-100">
                          <td colSpan={6} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                            Venda — peças que o cliente está levando · {tipoSaida === 'nfe' ? 'NF-e' : tipoSaida === 'nfce' ? 'NFC-e' : 'escolha NFC-e ou NF-e'}
                          </td>
                        </tr>
                      )}
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
                        <tr
                          key={i.key}
                          className={
                            i.troca
                              ? trocaConf.porProduto[i.productCode]?.ok
                                ? 'bg-purple-50 border-l-4 border-purple-500'
                                : trocaConf.porProduto[i.productCode]
                                  ? 'bg-rose-50 border-l-4 border-rose-500'
                                  : 'hover:bg-gray-50/60'
                              : i.fonte === 'promo-pdv'
                                ? 'bg-emerald-50 border-l-4 border-emerald-500 hover:bg-emerald-100/60'
                                : 'hover:bg-gray-50/60'
                          }
                        >
                          <td className="px-3 py-1.5">
                            <p className="font-medium text-[#000638] leading-tight text-[13px]">
                              {i.troca && (
                                <span className="mr-1.5 inline-flex px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold align-middle">TROCA</span>
                              )}
                              {!i.troca && i.fonte === 'promo-pdv' && (
                                <span
                                  className="mr-1.5 inline-flex px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold align-middle"
                                  title={`${i.promoNome} — de ${fmtBRL(i.unit)} por ${fmtBRL(i.unit - i.promoDesconto)}`}
                                >
                                  PROMOCIONAL
                                </span>
                              )}
                              {i.name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              cód. {i.productCode}
                              {i.sku ? ` · EAN ${i.sku}` : ''}
                              {i.troca ? null : i.fonte === 'promo-pdv' ? (
                                <span className="ml-1.5 text-emerald-700 font-semibold">
                                  {i.promoNome} · de {fmtBRL(i.unit)} por {fmtBRL(i.unit - i.promoDesconto)}
                                </span>
                              ) : i.fonte === 'promo' ? (
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
                            {i.troca &&
                              (() => {
                                const ref = trocaConf.porProduto[i.productCode];
                                if (!ref) return null;
                                if (!ref.ok) return <p className="text-[11px] font-semibold text-rose-700">{ref.mensagem}</p>;
                                return (
                                  <p className="text-[11px] text-purple-800">
                                    {ref.notas.map((nt, k) => (
                                      <span key={nt.chave} title={`Chave ${nt.chave}`}>
                                        {k > 0 && ' · '}
                                        {nt.modelo === 65 ? 'NFC-e' : 'NF'} <b>{nt.numero}/{nt.serie}</b> de {fmtData(nt.data)} · empresa {nt.empresa}
                                        {ref.notas.length > 1 ? ` · ${nt.quantidade} pç` : ''}
                                      </span>
                                    ))}
                                  </p>
                                );
                              })()}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className="inline-flex items-center gap-1">
                              {i.manualQty > 0 && (
                                <button
                                  onClick={() =>
                                    ajustarManualQty(i.key, -1)
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
                                  ajustarManualQty(i.key, 1)
                                }
                                className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                                title="Adicionar 1 (manual)"
                              >
                                <Plus size={10} weight="bold" />
                              </button>
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-gray-700 tabular-nums text-[13px]">
                            {i.troca && !trocaConf.porProduto[i.productCode]?.ok ? '—' : fmtBRL(precoDe(i).unit)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {i.troca ? (
                              <span className="text-[11px] text-purple-700/80">valor pago</span>
                            ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={i.discount}
                              title={
                                maxDescPct < 100
                                  ? `Até ${fmtBRL(limiteDescontoItem(i, maxDescPct))}${i.promoDesconto ? ' (promoção + ' : ' ('}${String(maxDescPct).replace('.', ',')}%); acima disso pede a senha de quem tem o desconto liberado`
                                  : 'Desconto liberado'
                              }
                              onChange={(e) => mudarDescontoItem(i, e.target.value)}
                              className="w-20 h-7 rounded-md border border-gray-200 text-right text-[13px] px-1.5 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                            />
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#000638] text-[13px]">
                            {fmtBRL(qtyOf(i) * (precoDe(i).unit - precoDe(i).discount))}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => removeItem(i.key)}
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
                <div className="inline-flex shrink-0 rounded-lg ring-1 ring-gray-300 overflow-hidden" title="Desconto em percentual ou em reais">
                  {[
                    ['pct', '%'],
                    ['valor', 'R$'],
                  ].map(([m, rot]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        if (m !== descModo) setGlobalDiscount('');
                        setDescModo(m);
                      }}
                      className={`h-9 min-w-[30px] px-1.5 text-xs font-bold ${descModo === m ? 'bg-[#000638] text-white' : 'bg-white text-[#000638] hover:bg-gray-50'}`}
                    >
                      {rot}
                    </button>
                  ))}
                </div>
                <input
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && items.length > 0 && aplicarDescontoGeral()}
                  placeholder={descModo === 'valor' ? '0,00' : '%'}
                  inputMode="decimal"
                  title={maxDescPct < 100 ? `Até ${String(maxDescPct).replace('.', ',')}% da venda; acima disso pede a senha de quem tem o desconto liberado` : 'Desconto liberado'}
                  className="h-9 w-16 px-1.5 mb-0 rounded-lg border border-gray-300 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
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
              {descontoLiberado ? (
                <p className="mt-1 text-[10px] text-amber-700 inline-flex items-center gap-1">
                  <LockKey size={11} weight="fill" /> Liberado por {descontoLiberado.nome} nesta venda{maxDescPct < 100 ? ` (até ${String(maxDescPct).replace('.', ',')}%)` : ''}
                </p>
              ) : (
                !descontoSemLimite && (
                  <p className="mt-1 text-[10px] text-gray-400">Até {String(maxDescPct).replace('.', ',')}% — acima disso pede a senha de quem tem o desconto liberado.</p>
                )
              )}
            </div>

            {/* Resumo da transação */}
            <div className="rounded-lg ring-1 ring-gray-200 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Resumo da transação</p>
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between text-gray-500">
                  <span>Peças</span>
                  <span className="tabular-nums">{totals.qty}</span>
                </div>
                {(temVenda || !temTroca) && (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal{temTroca ? ' da venda' : ''}</span>
                      <span className="tabular-nums">{fmtBRL(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Descontos</span>
                      <span className="tabular-nums">− {fmtBRL(totals.discounts)}</span>
                    </div>
                  </>
                )}
                {totals.cashbackAplicado > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Cashback</span>
                    <span className="tabular-nums">− {fmtBRL(totals.cashbackAplicado)}</span>
                  </div>
                )}
                {combinado ? (
                  <>
                    <div className="flex justify-between font-semibold text-[#000638]">
                      <span>Venda</span>
                      <span className="tabular-nums">{fmtBRL(totals.total)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-purple-700">
                      <span>Troca (vira Credev)</span>
                      <span className="tabular-nums">− {fmtBRL(totals.troca)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                      <span className="font-semibold text-gray-700">A pagar</span>
                      <span className="text-2xl font-bold tabular-nums text-[#000638]">{fmtBRL(totals.aPagar)}</span>
                    </div>
                    {totals.sobra > 0 && (
                      <p className="text-[11px] font-semibold text-purple-700">Sobra {fmtBRL(totals.sobra)} de Credev para o cliente usar nesta loja.</p>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
                    <span className="font-semibold text-gray-700">{temTroca ? 'Valor da troca' : 'Total'}</span>
                    <span className={`text-2xl font-bold tabular-nums ${temTroca ? 'text-purple-700' : 'text-[#000638]'}`}>
                      {fmtBRL(temTroca ? totals.troca : totals.total)}
                    </span>
                  </div>
                )}
                {trocaFeita && temVenda && !temTroca && (
                  <p className="rounded-lg bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-800 ring-1 ring-purple-200">
                    Troca #{trocaFeita.venda?.id} já registrada: Credev de {fmtBRL(trocaFeita.total)} para usar nesta venda.
                  </p>
                )}
              </div>
            </div>

            {/* Finalizar */}
            <button
              onClick={iniciarFinalizacao}
              disabled={!canGenerate}
              className={`w-full h-14 rounded-lg text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                temTroca && !temVenda ? 'bg-purple-700 hover:bg-purple-800' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {hcBusy ? (
                <>
                  <Spinner size={16} className="animate-spin" /> Emitindo…
                </>
              ) : (
                <>
                  <Cloud size={18} weight="bold" /> {combinado ? 'FINALIZAR VENDA | TROCA' : temTroca ? 'REGISTRAR TROCA' : 'FINALIZAR VENDA'}
                </>
              )}
            </button>
            {combinado && canGenerate && (
              <p className="text-[10px] text-center text-gray-500">
                Registra a troca, gera o Credev e fecha a venda com ele
                {totals.aPagar > 0 ? ` — depois abre o pagamento de ${fmtBRL(totals.aPagar)}.` : ' — sem diferença, fecha sozinho.'}
              </p>
            )}
            {branch && caixaSit && !caixaSit.erro && !caixaSit.aberto && (
              <p className="text-[10.5px] font-semibold text-rose-600 text-center inline-flex w-full items-center justify-center gap-1">
                <Lock size={11} weight="fill" /> Caixa fechado: abra o caixa para vender.
              </p>
            )}
            {!canGenerate && items.length > 0 && (
              <p className={`text-[10px] text-center ${trocaTravando ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
                {motivoBloqueio || 'Preencha empresa, vendedor e tipo de venda.'}
              </p>
            )}
          </div>
        </div>

      </div>
      </div>

        {/* Caixa fechado: abrir o caixa antes de vender */}
        {pedirCaixa && (
          <CaixaFechadoModal
            branch={branch}
            sit={caixaSit}
            temItens={items.length > 0}
            onCancelar={() => setPedirCaixa(false)}
            onAberto={async (c) => {
              setPedirCaixa(false);
              await carregarCaixa();
              showToast('ok', `Caixa #${c?.id || ''} aberto — pode finalizar a venda`);
            }}
          />
        )}

        {/* Senha de owner/admin para desconto acima do limite */}
        {senhaDesconto && (
          <SenhaDescontoModal
            pct={senhaDesconto.pct}
            limite={maxDescPct}
            empresa={branch ? parseInt(branch, 10) : null}
            por={user?.email || user?.name || null}
            onCancelar={() => setSenhaDesconto(null)}
            onLiberado={(aut) => {
              setDescontoLiberado(aut);
              senhaDesconto.aplicar();
              setSenhaDesconto(null);
              showToast('ok', `Desconto liberado por ${aut.nome}`);
            }}
          />
        )}

        {/* Cliente com cashback que não foi usado */}
        {perguntaCashback && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
              <Coins size={44} weight="fill" className="mx-auto mb-2 text-emerald-500" />
              <h3 className="text-lg font-bold text-[#000638] uppercase">
                Cliente possui {fmtBRL(cashback?.balance)} de cashback. Deseja utilizar?
              </h3>
              {totals.cashbackDisponivel < (cashback?.balance || 0) - 0.005 && (
                <p className="mt-1 text-xs text-gray-500">
                  Nesta venda dá para usar {fmtBRL(totals.cashbackDisponivel)} (a venda precisa ser de pelo menos{' '}
                  {PDV_VAREJO_CONFIG.cashbackFatorMinimo}× o valor usado).
                </p>
              )}
              <label className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-700">
                Quanto usar? <span className="font-semibold">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={totals.cashbackDisponivel}
                  value={cashbackValor}
                  onChange={(e) => setCashbackValor(e.target.value)}
                  placeholder={totals.cashbackDisponivel.toFixed(2)}
                  className="h-10 w-28 mb-0 rounded-lg border border-emerald-300 px-2 text-right text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </label>
              <p className="mt-0.5 text-[11px] text-gray-400">Em branco usa os {fmtBRL(totals.cashbackDisponivel)} que a venda permite.</p>
              <p className="mt-2 text-sm text-gray-600">
                Total passa de <b>{fmtBRL(totals.total)}</b> para{' '}
                <b className="text-emerald-700">{fmtBRL(totals.total - cashbackEscolhido)}</b>.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setPerguntaCashback(false);
                    setCashbackRecusado(true);
                    finalizarAgora();
                  }}
                  className="h-11 rounded-lg ring-1 ring-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Não usar
                </button>
                <button
                  autoFocus
                  onClick={() => {
                    if (!(cashbackEscolhido > 0)) return;
                    setPerguntaCashback(false);
                    setCashbackUsar(true);
                    setContinuarFinalizacao(true);
                  }}
                  disabled={!(cashbackEscolhido > 0)}
                  className="h-11 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  Sim, usar {fmtBRL(cashbackEscolhido)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagamento, resultado fiscal, vendas do dia, config */}
        {pagamentoOpen && (
          <PagamentoModal
            total={temVenda ? r2(totals.total) : totals.troca}
            tipoVenda={temVenda ? tipoSaida : 'troca'}
            notasTroca={notasDaTroca}
            saldos={saldos}
            temCliente={!!customer}
            bluecard={{
              cpf: cashback?.cpf || null,
              empresa: parseInt(branch, 10) || null,
              empresaNome: branches.find((b) => String(b.cd_empresa) === String(branch))?.nm_grupoempresa || null,
              vendedorCode: parseInt(seller, 10) || null,
              vendedorNome: sellers.find((x) => String(x.code) === String(seller))?.name || null,
              itens: itensVenda.map((i) => ({ productCode: i.productCode, nome: i.name, quantidade: qtyOf(i), valorUnit: Number((precoDe(i).unit - precoDe(i).discount).toFixed(2)) })),
            }}
            inicial={temVenda ? pagInicial : null}
            trocaFeita={temVenda ? trocaFeita : null}
            busy={hcBusy}
            onConfirm={finalizarHeadcoach}
            onClose={() => !hcBusy && setPagamentoOpen(false)}
          />
        )}
        {/* VENDA | TROCA em andamento: trava a tela e diz em que passo está */}
        {etapa && !pagamentoOpen && !resultado && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
              <Spinner size={36} className="mx-auto mb-3 animate-spin text-[#000638]" />
              <h3 className="text-base font-bold text-[#000638]">VENDA | TROCA</h3>
              <p className="mt-1 text-sm text-gray-600">{etapa}</p>
              <p className="mt-2 text-[11px] text-gray-400">Não feche a tela: são duas notas na SEFAZ, uma depois da outra.</p>
            </div>
          </div>
        )}
        {resultado && (
          <ResultadoFiscalModal
            resultado={resultado}
            onNovaVenda={novaVenda}
            onFechar={() => setResultado(null)}
            onReemitir={reemitir}
            onAtualizar={recarregarResultado}
            onEspelhar={() => resultado?.venda?.id && espelharNoTotvs(resultado.venda.id)}
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
        {showCancelar && branch && (
          <CancelarTransacao
            somenteAndamento
            empresa={parseInt(branch, 10)}
            empresaNome={branches.find((b) => String(b.cd_empresa) === String(branch))?.nm_grupoempresa}
            por={user?.email || user?.name || null}
            onClose={() => setShowCancelar(false)}
            onCancelada={() => {
              carregarRanking();
              carregarCaixa();
            }}
            showToast={showToast}
          />
        )}
        {/* Troca de presente: peças da venda do cupom */}
        {cupomModal && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4" onClick={() => setCupomModal(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                  <Ticket size={20} weight="bold" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold leading-tight text-[#000638]">
                    Cupom de troca <span className="font-mono">{cupomModal.cupom.codigo}</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Venda de {String(cupomModal.cupom.data || '').slice(0, 10).split('-').reverse().join('/')} na empresa {cupomModal.cupom.empresa}
                    {cupomModal.comprador?.nome ? ` · comprado por ${cupomModal.comprador.nome}` : ''}
                    {cupomModal.origem?.nota ? ` · nota ${cupomModal.origem.nota.numero}/${cupomModal.origem.nota.serie}` : ''}
                  </p>
                </div>
                <button onClick={() => setCupomModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} weight="bold" />
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-600">Escolha as peças que vão ser trocadas:</p>
              <ul className="mt-1 max-h-[50vh] divide-y divide-gray-100 overflow-y-auto rounded-xl ring-1 ring-gray-200">
                {cupomModal.itens.map((it) => {
                  const q = Number(cupomModal.escolha[it.productCode]) || 0;
                  const setQ = (v) => setCupomModal((m) => ({ ...m, escolha: { ...m.escolha, [it.productCode]: Math.max(0, Math.min(it.disponivel, v)) } }));
                  return (
                    <li key={it.productCode} className={`flex items-center gap-2 px-3 py-2 ${it.disponivel === 0 ? 'opacity-50' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-gray-800">{it.nome || it.productCode}</p>
                        <p className="text-[11px] text-gray-500">
                          cód. {it.productCode}
                          {it.valorUnit ? ` · pago ${fmtBRL(it.valorUnit)}` : ''} · comprou {it.comprado}
                          {it.trocado ? ` · já trocou ${it.trocado}` : ''}
                        </p>
                      </div>
                      {it.disponivel === 0 ? (
                        <span className="text-[11px] font-semibold text-gray-400">já trocada</span>
                      ) : it.disponivel === 1 ? (
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-800">
                          <input type="checkbox" checked={q === 1} onChange={(e) => setQ(e.target.checked ? 1 : 0)} className="h-4 w-4" /> trocar
                        </label>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setQ(q - 1)} disabled={q === 0} className="rounded p-1 ring-1 ring-gray-200 disabled:opacity-30">
                            <Minus size={11} weight="bold" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold tabular-nums">{q}</span>
                          <button type="button" onClick={() => setQ(q + 1)} disabled={q >= it.disponivel} className="rounded p-1 ring-1 ring-gray-200 disabled:opacity-30">
                            <Plus size={11} weight="bold" />
                          </button>
                          <span className="ml-1 text-[10px] text-gray-400">de {it.disponivel}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCupomModal((m) => ({ ...m, escolha: Object.fromEntries(m.itens.map((i) => [i.productCode, i.disponivel])) }))}
                  className="h-8 rounded-lg px-2.5 text-[11px] font-semibold text-purple-800 ring-1 ring-purple-200 hover:bg-purple-50"
                >
                  Marcar todas
                </button>
              </div>
              <p className="mt-3 text-[11px] text-gray-500">
                Quem está trocando precisa estar cadastrado e selecionado como cliente. A nota de devolução referencia a nota da venda original sozinha.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setCupomModal(null)} className="h-11 rounded-lg text-sm font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
                  Voltar
                </button>
                <button
                  onClick={usarCupom}
                  disabled={!Object.values(cupomModal.escolha).some((v) => Number(v) > 0)}
                  className="h-11 rounded-lg bg-purple-700 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-40"
                >
                  COLOCAR NA TROCA
                </button>
              </div>
            </div>
          </div>
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
        {showConfig && branch && podeConfigurarFiscal && (
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
