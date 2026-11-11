// Página: Transferências de Mercadoria → Transferência RFID
// Mesmo desenho da Devolução RFID, para mandar mercadoria de uma filial para
// outra:
//   • peças lidas pelo PORTAL RFID (1 etiqueta = 1 peça) ou por código manual
//   • EMPRESA = filial de origem (só as vinculadas ao usuário); CLIENTE = a
//     filial de destino (a pessoa cadastrada na criação da empresa no TOTVS,
//     ex.: empresa 1 → cliente 110000001)
//   • operação TRAVADA pelo POP "Transferências entre empresas - Varejo":
//     raiz do CNPJ de origem × destino → 7272 / 7273 / 7280; o que o POP não
//     prevê não deixa gerar. O backend (/api/transferencias/gerar) confere de
//     novo antes de mandar ao TOTVS.
//   • CFOP pela natureza e UF: transferência 5152/6152, venda 5102/6102
//   • preço pela mesma regra do Orçamento: tabela do cliente, senão ATACADO
//   • gera a transação "em andamento" no TOTVS e acompanha até ATENDIDA —
//     o caixa finaliza no TRAFP005 (Continuar Transação → Encerrar → Receber)
// Transferências em andamento ficam salvas por usuário (localStorage).
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowsLeftRight,
  Plugs,
  PlugsConnected,
  Trash,
  Spinner,
  ArrowsClockwise,
  User,
  Buildings,
  X,
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
  Broadcast,
  WifiHigh,
  SpeakerHigh,
  SpeakerSlash,
  Storefront,
  Prohibit,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import PortalPotenciaModal from '../components/PortalPotenciaModal';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { getUserCompanies } from '../services/userCompaniesService';
import { portalConnect, portalDisconnect, portalTags, portalClear, portalSetBeep } from '../utils/portalApi';

// ─── Regra do POP (o backend confere de novo ao gerar) ───────────────────────
const GRUPOS_POP = { 17177680: 'CROSBY', 27728810: 'FÁBIO', 33592092: 'IRMÃOS CR', 53661116: 'IRMÃOS VAREJO' };
const OPERACOES_POP = {
  7272: 'TRANSFERÊNCIA PARA BLUE HOUSE FISCAL CR X CR',
  7273: 'VENDA PARA BLUE HOUSE FISCAL FABIO X CR',
  7280: 'VENDA PARA BLUE HOUSE FISCAL CR X IRMÃOS',
};
function operacaoPop(origem, destino) {
  if (!origem || !destino) return null;
  if (origem.code === destino.code) return { permitido: false, motivo: 'Destino igual à origem' };
  const o = origem.raiz;
  const d = destino.raiz;
  if (!GRUPOS_POP[o] || !GRUPOS_POP[d]) return { permitido: false, motivo: 'CNPJ não contemplado no POP' };
  if (['33592092', '53661116'].includes(o) || ['33592092', '53661116'].includes(d)) return { permitido: true, operacao: 7280 };
  if (o === d) return { permitido: true, operacao: 7272 };
  if (o === '17177680' && d === '27728810') return { permitido: true, operacao: 7273 };
  return { permitido: false, motivo: `O POP não prevê ${GRUPOS_POP[o]} → ${GRUPOS_POP[d]}` };
}
const cfopPop = (operacao, ufO, ufD) => (ufO && ufD && ufO !== ufD ? 6000 : 5000) + (operacao === 7272 ? 152 : 102);

const TRANSF_CONFIG = {
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

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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

// ─── Página ──────────────────────────────────────────────────────────────────
// Props (todas opcionais):
//   embutido            esconde o título (dentro de Transferências de Mercadoria)
//   solicitacao         solicitação de transferência: pré-preenche origem e destino
//   onTransacaoGerada   (trx) chamado quando a transação nasce no TOTVS
//   onStatusTransacao   (trx, status) chamado a cada mudança de status
// Inclusão manual de peça (sem etiqueta): o operador informa a QUANTIDADE e
// entram todas de uma vez, até 1000 por inclusão (Yago, 11/11/2026).
const LIMITE_INCLUSAO_MANUAL = 1000;
const qtdDaInclusao = (txt) => {
  const n = Math.floor(Number(String(txt ?? '').replace(',', '.')) || 0);
  if (n > LIMITE_INCLUSAO_MANUAL) return null;
  return Math.max(1, n);
};

const TransferenciaRFID = ({ embutido = false, solicitacao = null, onTransacaoGerada, onStatusTransacao } = {}) => {
  const { user } = useAuth();
  const storageKey = `transf_rfid_drafts_${user?.email || user?.id || 'anon'}`;

  // Filiais dos grupos do POP e empresas do usuário
  const [filiais, setFiliais] = useState([]);
  const [filiaisErro, setFiliaisErro] = useState(null);
  const [empresasUsuario, setEmpresasUsuario] = useState(null); // null = sem restrição
  const [branch, setBranch] = useState(() => localStorage.getItem('transf_rfid_branch') || '');
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState(() => localStorage.getItem('transf_rfid_seller') || '');
  const [destinoCode, setDestinoCode] = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);

  const origem = useMemo(() => filiais.find((f) => String(f.code) === String(branch)) || null, [filiais, branch]);
  const destino = useMemo(() => filiais.find((f) => String(f.code) === String(destinoCode)) || null, [filiais, destinoCode]);
  const regra = useMemo(() => operacaoPop(origem, destino), [origem, destino]);
  const operacao = regra?.permitido ? regra.operacao : null;
  const cfop = operacao ? cfopPop(operacao, origem?.uf, destino?.uf) : null;
  // "cliente" da transação = pessoa da filial de destino
  const customer = destino ? { code: destino.personCode, name: `${destino.code} — ${destino.nome}` } : null;

  // Portal RFID
  const [portalStatus, setPortalStatus] = useState({ status: 'desconectado' });
  const [portalBusy, setPortalBusy] = useState(false);
  const [potenciaOpen, setPotenciaOpen] = useState(false);
  const [somPortal, setSomPortal] = useState(() => localStorage.getItem('portal_som') !== 'off');
  const [somBusy, setSomBusy] = useState(false);

  // Itens
  const [items, setItems] = useState([]);
  const processedEpcs = useRef(new Set());
  const branchRef = useRef(branch);
  branchRef.current = branch;
  const priceTableRef = useRef(null);
  priceTableRef.current = customerInfo?.priceTableCode ?? null;

  // Transferências salvas (por usuário)
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  const [globalDiscount, setGlobalDiscount] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualQtd, setManualQtd] = useState('1');
  const [manualBusy, setManualBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const txtInputRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [posting, setPosting] = useState(false);

  // Transação gerada
  const [trx, setTrx] = useState(null);
  const [trxStatus, setTrxStatus] = useState(null);
  const [trxChecking, setTrxChecking] = useState(false);

  useEffect(() => localStorage.setItem('transf_rfid_branch', branch), [branch]);
  useEffect(() => localStorage.setItem('transf_rfid_seller', seller), [seller]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ─── Cargas ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/transferencias/filiais`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao carregar as filiais');
        setFiliais(j.data.filiais || []);
        setFiliaisErro(null);
      } catch (e) {
        setFiliaisErro(e.message);
      }
    })();
  }, []);

  // Empresas vinculadas ao usuário (Painel Admin); owner/admin veem todas
  useEffect(() => {
    if (!user?.id || ['admin', 'owner'].includes(user.role)) {
      setEmpresasUsuario(null);
      return;
    }
    getUserCompanies(user.id).then(({ data }) => {
      setEmpresasUsuario(data && data.length > 0 ? data.map(String) : null);
    });
  }, [user?.id, user?.role]);

  const empresasOrigem = useMemo(
    () => (empresasUsuario ? filiais.filter((f) => empresasUsuario.includes(String(f.code))) : filiais),
    [filiais, empresasUsuario],
  );
  // Empresa salva que não é mais do usuário (ou fora do POP): limpa
  useEffect(() => {
    if (!filiais.length || !branch) return;
    if (!empresasOrigem.some((f) => String(f.code) === String(branch))) setBranch('');
  }, [filiais, empresasOrigem, branch]);
  useEffect(() => {
    if (!branch && empresasOrigem.length === 1) setBranch(String(empresasOrigem[0].code));
  }, [branch, empresasOrigem]);

  // Destinos: todas as filiais do POP menos a origem; as que o POP não prevê
  // aparecem desabilitadas, com o motivo
  const destinos = useMemo(
    () =>
      filiais
        .filter((f) => !origem || f.code !== origem.code)
        .map((f) => ({ ...f, regra: origem ? operacaoPop(origem, f) : null })),
    [filiais, origem],
  );
  useEffect(() => {
    if (destinoCode && destino && regra && !regra.permitido) setDestinoCode('');
  }, [destinoCode, destino, regra]);

  // Solicitação vinda da página Transferências de Mercadoria
  useEffect(() => {
    if (!solicitacao) return;
    if (solicitacao.empresa_origem) setBranch(String(solicitacao.empresa_origem));
    if (solicitacao.empresa_destino) setDestinoCode(String(solicitacao.empresa_destino));
    setCustomerInfo(null);
    setItems([]);
    setTrx(null);
    setTrxStatus(null);
    setDraftId(null);
    processedEpcs.current = new Set();
  }, [solicitacao]);

  useEffect(() => {
    if (!branch) {
      setSellers([]);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/sellers?branch=${branch}`);
        const j = await r.json();
        const list = j?.data?.items || [];
        setSellers(list);
        setSeller((prev) => (list.some((s) => String(s.code) === String(prev)) ? prev : ''));
      } catch {
        setSellers([]);
      }
    })();
  }, [branch]);

  // Dados do cliente (tabela de preço da filial de destino)
  const customerCode = customer?.code ?? null;
  useEffect(() => {
    if (!customerCode) {
      setCustomerInfo(null);
      return;
    }
    if (customerInfo?.code === customerCode) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/customer/${customerCode}`);
        const j = await r.json();
        if (j?.data) setCustomerInfo(j.data);
      } catch {
        showToast('erro', 'Falha ao buscar dados da filial de destino');
      }
    })();
  }, [customerCode, customerInfo, showToast]);

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
    const id = draftId || `t${Date.now()}`;
    const registro = { id, em: Date.now(), branch, seller, destinoCode, customerInfo, items };
    persistDrafts([registro, ...drafts.filter((d) => d.id !== id)].slice(0, 30));
    setDraftId(id);
    showToast('ok', 'Transferência salva para continuar depois');
  }, [items, draftId, branch, seller, destinoCode, customerInfo, drafts, persistDrafts, showToast]);

  const abrirRascunho = useCallback(
    (d) => {
      setBranch(d.branch || '');
      setSeller(d.seller || '');
      setDestinoCode(d.destinoCode || '');
      setCustomerInfo(d.customerInfo || null);
      setItems(d.items || []);
      setDraftId(d.id);
      processedEpcs.current = new Set((d.items || []).flatMap((i) => i.epcs || []));
      setHistoricoOpen(false);
      showToast('ok', 'Transferência retomada');
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
  const portalLigado = portalStatus.status === 'lendo' || portalStatus.status === 'conectando' || portalStatus.status === 'reconectando';

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
        if (localStorage.getItem('portal_som') === 'off') aplicarSomPortal(false, { avisar: false });
      }
    } catch (e) {
      showToast('erro', `Portal indisponível — instale/inicie o Agente do Portal nesta máquina (${e.message})`);
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
  const mergeProduto = useCallback((data, { epc = null, manual = 0, silent = false }) => {
    const { product, prices, tablePrice } = data;
    const padrao = (prices || []).find((p) => p.promotionalPrice > 0 || p.price > 0);
    const unit = tablePrice ? tablePrice.price : padrao?.promotionalPrice > 0 ? padrao.promotionalPrice : padrao?.price || 0;
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

  const consultarProduto = useCallback(async (code) => {
    const br = branchRef.current;
    if (!br) return null;
    const pt = priceTableRef.current;
    const qs = `?branch=${br}&priceCodes=${TRANSF_CONFIG.priceCodes}${pt ? `&priceTable=${pt}` : ''}`;
    const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}${qs}`);
    const j = await r.json();
    return { ok: r.ok && !!j?.data?.product, data: j?.data, message: j?.message };
  }, []);

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
    const qtd = qtdDaInclusao(manualQtd);
    if (qtd == null) {
      beep(false);
      showToast('erro', `No máximo ${LIMITE_INCLUSAO_MANUAL} peças por inclusão`);
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
      mergeProduto(res.data, { manual: qtd });
      setManualCode('');
      setManualQtd('1');
    } catch (e) {
      beep(false);
      showToast('erro', `Erro na consulta: ${e.message}`);
    } finally {
      setManualBusy(false);
    }
  }, [manualCode, manualQtd, manualBusy, consultarProduto, mergeProduto, showToast]);

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
        const codigos = (await file.text())
          .split(/[\s,;]+/)
          .map((c) => c.trim())
          .filter(Boolean);
        if (!codigos.length) {
          showToast('erro', 'O arquivo não tem códigos.');
          return;
        }
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
            } else naoAchou.push(code);
          } catch {
            naoAchou.push(code);
          }
        }
        beep(okQtd > 0);
        if (naoAchou.length) {
          showToast(
            'erro',
            `${okQtd} de ${codigos.length} peça(s) adicionada(s). Não encontrados (${naoAchou.length}): ${naoAchou.slice(0, 12).join(', ')}${naoAchou.length > 12 ? '…' : ''}`,
          );
        } else showToast('ok', `${okQtd} peça(s) adicionadas do arquivo.`);
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
    setItems((prev) => prev.map((i) => (i.productCode === productCode ? { ...i, ...patch } : i)));
  }, []);

  const ajustarManualQty = useCallback((productCode, delta) => {
    setItems((prev) =>
      prev
        .map((i) => (i.productCode === productCode ? { ...i, manualQty: Math.max(0, (i.manualQty || 0) + delta) } : i))
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

  const removerEpc = useCallback((productCode, epc) => {
    processedEpcs.current.delete(epc);
    setItems((prev) =>
      prev.map((i) => (i.productCode === productCode ? { ...i, epcs: i.epcs.filter((e) => e !== epc) } : i)).filter((i) => qtyOf(i) > 0),
    );
  }, []);

  const aplicarDescontoGeral = useCallback(() => {
    const pct = parseFloat(String(globalDiscount).replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > TRANSF_CONFIG.maxDescontoPct) {
      showToast('erro', `Desconto geral inválido (0 a ${TRANSF_CONFIG.maxDescontoPct}%)`);
      return;
    }
    setItems((prev) => prev.map((i) => ({ ...i, discount: Number(((i.unit * pct) / 100).toFixed(2)) })));
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
        total: its.reduce((s, i) => s + qtyOf(i) * (i.unit - (i.discount || 0)), 0),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items]);

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
    const cabecalho = ['EPC', 'Codigo', 'Produto', 'SKU', 'Referencia', 'Valor unit', 'Desconto unit', 'Valor liquido'];
    const corpo = linhasEpc.map((l) =>
      [l.epc, l.productCode, l.nome, l.sku, l.referencia, String(l.unit).replace('.', ','), String(l.discount).replace('.', ','), String(l.liquido).replace('.', ',')]
        .map(esc)
        .join(';'),
    );
    const csv = `﻿${cabecalho.map(esc).join(';')}\n${corpo.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const quando = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `transferencia-epcs-${branch || 'empresa'}-para-${destinoCode || 'destino'}-${quando}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ok', `${linhasEpc.length} etiqueta(s) exportada(s)`);
  }, [linhasEpc, branch, destinoCode, showToast]);

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

  // ─── Gerar a transferência no TOTVS ──────────────────────────────────────
  const novaTransferencia = useCallback(() => {
    setItems([]);
    setDestinoCode('');
    setCustomerInfo(null);
    setTrx(null);
    setTrxStatus(null);
    setDraftId(null);
    processedEpcs.current = new Set();
    portalClear().catch(() => {});
  }, []);

  const canGenerate =
    !posting && origem && destino && seller && operacao && cfop && items.length > 0 && items.every((i) => qtyOf(i) > 0 && i.unit > 0);

  const gerarTransacao = useCallback(async () => {
    if (!canGenerate) return;
    setPosting(true);
    try {
      const itensPayload = items.map((i) => {
        const discountValue = Number(Number(i.discount || 0).toFixed(3));
        return {
          productCode: i.productCode,
          quantity: qtyOf(i),
          value: Number(Number(i.unit).toFixed(3)),
          ...(discountValue > 0 ? { discountValue } : {}),
          cfop,
        };
      });
      // 3 casas: o TOTVS soma as linhas com 3 decimais (ver Devolução RFID)
      const totalExato = Number(itensPayload.reduce((s, it) => s + it.quantity * (it.value - (it.discountValue || 0)), 0).toFixed(3));
      const payload = {
        branchCode: origem.code,
        customerCode: destino.personCode,
        sellerCode: parseInt(seller, 10),
        operationCode: operacao,
        paymentConditionCode: TRANSF_CONFIG.paymentConditionCode,
        isPreSale: false,
        status: 1,
        totalAmountTransaction: totalExato,
        items: itensPayload,
        observations: [
          { observation: `TRANSFERENCIA EMP ${origem.code} PARA EMP ${destino.code} - HEADCOACH${solicitacao ? ` TRF-${solicitacao.id}` : ''}`.slice(0, 80) },
        ],
      };
      const r = await fetch(`${API_BASE_URL}/api/transferencias/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        beep(false);
        showToast('erro', j?.message || 'TOTVS recusou a transferência');
        return;
      }
      const nova = {
        ...j.data,
        branchCode: origem.code,
        destinoCode: destino.code,
        total: totalExato,
        operacao: j.data.operacao ?? operacao,
        cfop: j.data.cfop ?? cfop,
        qtdEpcs: totals.epcs,
        customerCode: destino.personCode,
        epcs: items.flatMap((i) => i.epcs),
      };
      setTrx(nova);
      setTrxStatus(1);
      beep(true);
      onTransacaoGerada?.(nova);

      // Registra em Transferências de Mercadoria → Transações
      try {
        const vend = sellers.find((sl) => String(sl.code) === String(seller));
        const rr = await fetch(`${API_BASE_URL}/api/transferencias/transacoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transferenciaId: solicitacao?.id || null,
            empresa: origem.code,
            empresaDestino: destino.code,
            transactionCode: nova.transactionCode,
            transactionDate: nova.transactionDate,
            status: 1,
            operacao: nova.operacao,
            cfop: nova.cfop,
            total: totalExato,
            clienteCode: destino.personCode,
            clienteNome: `${destino.code} — ${destino.nome}`,
            vendedorCode: parseInt(seller, 10),
            vendedorNome: vend?.name || null,
            itens: items.map((i) => ({
              productCode: i.productCode,
              name: i.name,
              quantidade: qtyOf(i),
              unit: Number((i.unit - (i.discount || 0)).toFixed(2)),
              total: Number((qtyOf(i) * (i.unit - (i.discount || 0))).toFixed(2)),
              epcs: i.epcs,
            })),
            por: user?.name || user?.email || null,
          }),
        });
        const jr = await rr.json();
        if (rr.ok && jr.success) setTrx((t) => (t ? { ...t, registroId: jr.data.id } : t));
        else showToast('erro', `Transferência gerada, mas o registro falhou: ${jr?.message || ''}`);
      } catch (er) {
        showToast('erro', `Transferência gerada, mas o registro falhou: ${er.message}`);
      }
      if (draftId) apagarRascunho(draftId);
    } catch (e) {
      showToast('erro', `Falha ao gerar a transferência: ${e.message}`);
    } finally {
      setPosting(false);
    }
  }, [canGenerate, items, cfop, origem, destino, seller, sellers, operacao, totals.epcs, solicitacao, draftId, apagarRascunho, showToast, onTransacaoGerada, user]);

  // ─── Acompanha o status até ATENDIDA (caixa finaliza no TRAFP005) ────────
  const verificarStatus = useCallback(async () => {
    if (!trx || trxChecking) return;
    setTrxChecking(true);
    try {
      const qs = new URLSearchParams({ branch: trx.branchCode, code: trx.transactionCode, date: String(trx.transactionDate).slice(0, 10) });
      const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/transaction-status?${qs}`);
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
      fetch(`${API_BASE_URL}/api/transferencias/transacoes/${trx.registroId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: trxStatus }),
      }).catch(() => {});
    }
  }, [trx, trxStatus, onStatusTransacao]);

  const stInfo = TRX_STATUS[trxStatus] || { label: `status ${trxStatus}`, cls: 'bg-gray-100 text-gray-600 ring-gray-200' };
  const selCls =
    'w-full h-9 pl-8 pr-2 mb-0 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-6xl mx-auto">
        {!embutido && (
          <PageTitle
            title="Transferência RFID"
            subtitle="Leia as peças pelo portal e gere a transferência entre filiais no TOTVS (operação pelo POP; finalize no TRAFP005)"
            icon={ArrowsLeftRight}
          />
        )}
        {solicitacao && (
          <div className="mb-2 flex flex-wrap items-center gap-2 bg-blue-50 rounded-xl ring-1 ring-blue-200 px-3 py-2 text-xs text-[#000638]">
            <ArrowsLeftRight size={14} weight="bold" />
            <span>
              Solicitação <b>TRF-{solicitacao.id}</b>
              {solicitacao.origem === 'dryland' ? ` (Dryland ${solicitacao.origem_ref || ''})` : ''} · empresa {solicitacao.empresa_origem} →{' '}
              {solicitacao.empresa_destino || 'destino a definir'} · {solicitacao.qtd_pecas} peça(s) declarada(s)
            </span>
            {Array.isArray(solicitacao.itens) && solicitacao.itens.length > 0 && (
              <details className="basis-full">
                <summary className="cursor-pointer font-semibold">Ver as peças do pedido ({solicitacao.itens.length} linha(s))</summary>
                <ul className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                  {solicitacao.itens.map((i, n) => (
                    <li key={`${i.cod}-${i.cor}-${i.tam}-${n}`} className="truncate">
                      <b>{i.qtd}×</b> <span className="font-mono">{i.cod}</span> {i.descricao} · {i.cor} · {i.tam}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {filiaisErro && (
          <p className="mb-2 text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-2 ring-1 ring-rose-200">
            Não consegui carregar as filiais do POP: {filiaisErro}
          </p>
        )}

        {/* Transferências em andamento */}
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
          {draftId && <span className="text-[11px] text-gray-500">Editando uma transferência salva</span>}
          <div className="flex-1" />
          <button
            onClick={novaTransferencia}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-600 bg-white ring-1 ring-rose-200 shadow-sm hover:bg-rose-50"
          >
            Nova transferência
          </button>
        </div>

        {historicoOpen && (
          <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
            {drafts.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma transferência salva. Use “Salvar para continuar depois”.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {drafts.map((d) => (
                  <li key={d.id} className="py-1.5 flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-24 shrink-0">{fmtData(d.em)}</span>
                    <span className="font-medium text-[#000638] truncate flex-1">
                      empresa {d.branch || '—'} → {d.destinoCode || '—'} · {(d.items || []).reduce((s, i) => s + qtyOf(i), 0)} pç
                    </span>
                    <button
                      onClick={() => abrirRascunho(d)}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      abrir
                    </button>
                    <button onClick={() => apagarRascunho(d.id)} className="text-gray-300 hover:text-rose-500" title="Apagar">
                      <Trash size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Filtros: empresa (origem), vendedor, cliente filial (destino), operação do POP, tabela de preço */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-2 lg:grid-cols-5 gap-2 items-start">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Empresa (origem)</label>
            <div className="relative">
              <Buildings size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className={selCls}>
                <option value="">{filiais.length ? 'Selecione…' : 'Carregando…'}</option>
                {empresasOrigem.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} — {f.nome} ({f.grupo})
                  </option>
                ))}
              </select>
            </div>
            {origem && (
              <p className="mt-1 text-[10px] text-gray-400">
                CNPJ {origem.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} · {origem.uf || '—'}
              </p>
            )}
            {empresasUsuario && filiais.length > 0 && empresasOrigem.length === 0 && (
              <p className="mt-1 text-[10px] text-rose-600">Nenhuma empresa sua está nos grupos do POP de transferência.</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Vendedor</label>
            <div className="relative">
              <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={seller} onChange={(e) => setSeller(e.target.value)} disabled={!branch} className={selCls}>
                <option value="">{branch ? 'Selecione…' : 'Escolha a empresa antes'}</option>
                {sellers.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cliente = filial de destino (só as filiais do POP) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Cliente (filial de destino)</label>
            <div className="relative">
              <Storefront size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={destinoCode} onChange={(e) => setDestinoCode(e.target.value)} disabled={!origem} className={selCls}>
                <option value="">{origem ? 'Selecione…' : 'Escolha a empresa antes'}</option>
                {destinos.map((f) => (
                  <option key={f.code} value={f.code} disabled={!f.regra?.permitido}>
                    {f.personCode} — empresa {f.code} {f.nome} ({f.grupo}){f.regra?.permitido ? ` · ${f.regra.operacao}` : ' · fora do POP'}
                  </option>
                ))}
              </select>
            </div>
            {destino && (
              <p className="mt-1 text-[10px] text-gray-400">
                Cliente {destino.personCode} · CNPJ {destino.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} · {destino.uf || '—'}
              </p>
            )}
          </div>

          {/* Operação travada pelo POP + CFOP pela natureza e UF */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Operação (POP)</label>
            <div className="flex gap-1">
              <div
                className={`relative flex-1 h-9 pl-8 pr-2 rounded-lg border text-xs flex items-center font-semibold truncate ${
                  operacao ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : regra && !regra.permitido ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-300 bg-gray-50 text-gray-400'
                }`}
                title={operacao ? `${operacao} - ${OPERACOES_POP[operacao]}` : regra?.motivo || 'Definida pelo POP ao escolher origem e destino'}
              >
                {operacao ? <Gear size={15} className="absolute left-2.5 text-emerald-600" /> : <Prohibit size={15} className="absolute left-2.5" />}
                {operacao ? `${operacao} - ${OPERACOES_POP[operacao]}` : regra && !regra.permitido ? 'Bloqueada pelo POP' : 'Automática'}
              </div>
              <div
                className={`h-9 w-[4.5rem] px-1.5 rounded-lg border bg-gray-50 text-sm text-center leading-9 font-semibold ${cfop ? 'border-gray-300 text-[#000638]' : 'border-gray-200 text-gray-300'}`}
                title={cfop ? `CFOP ${cfop}: ${operacao === 7272 ? 'transferência' : 'venda'} · origem ${origem?.uf} → destino ${destino?.uf}` : 'CFOP definido pela operação e pela UF'}
              >
                {cfop || '—'}
              </div>
            </div>
            {regra && !regra.permitido && <p className="mt-1 text-[10px] text-rose-600">{regra.motivo}</p>}
            {operacao && (
              <p className="mt-1 text-[10px] text-gray-400">
                {GRUPOS_POP[origem.raiz]} → {GRUPOS_POP[destino.raiz]} · {origem.uf} → {destino.uf} · CFOP {cfop}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Tabela de preço</label>
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
              title={customerInfo?.priceTableDescription || (customerInfo && !customerInfo.priceTableCode ? 'Sem tabela — usando preço ATACADO' : '')}
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
                    {customerInfo.priceTableCode} — {customerInfo.priceTableDescription || 'tabela do cliente'}
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

        {/* Grid: produtos + coluna de ações */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-2 items-start">
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
                          {portalLigado ? 'Portal ligado — passe as peças pelo portal.' : 'Ligue o portal ou adicione as peças por código.'}
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
                            <p className="font-medium text-[#000638] leading-tight text-[13px]">{i.name}</p>
                            <p className="text-[11px] text-gray-400">
                              cód. {i.productCode}
                              {i.sku ? ` · EAN ${i.sku}` : ''}
                              {i.fonte === 'tabela' ? (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">tabela do cliente</span>
                              ) : i.fonte === 'atacado' ? (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">atacado</span>
                              ) : (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">sem preço</span>
                              )}
                              {i.manualQty > 0 && (
                                <span className="ml-1.5 inline-flex px-1.5 rounded-full bg-gray-100 text-gray-600 ring-1 ring-gray-200">{i.manualQty} sem tag</span>
                              )}
                            </p>
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
                                    <button onClick={() => removerEpc(i.productCode, epc)} className="text-purple-300 hover:text-rose-600">
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
                              <span className="font-bold text-[#000638] tabular-nums min-w-[1.25rem] text-[13px]">{qtyOf(i)}</span>
                              <button
                                onClick={() => ajustarManualQty(i.productCode, 1)}
                                className="w-5 h-5 rounded ring-1 ring-gray-300 text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                                title="Adicionar 1 (sem tag)"
                              >
                                <Plus size={10} weight="bold" />
                              </button>
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-gray-700 tabular-nums text-[13px]">{fmtBRL(i.unit)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              max={Number(((i.unit * TRANSF_CONFIG.maxDescontoPct) / 100).toFixed(2))}
                              step="0.01"
                              value={i.discount}
                              title={`Máx. ${TRANSF_CONFIG.maxDescontoPct}%: ${fmtBRL((i.unit * TRANSF_CONFIG.maxDescontoPct) / 100)}`}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                updateItem(i.productCode, {
                                  discount: Math.min(Math.max(v, 0), Number(((i.unit * TRANSF_CONFIG.maxDescontoPct) / 100).toFixed(2))),
                                });
                              }}
                              className="w-20 h-7 rounded-md border border-gray-200 text-right text-[13px] px-1.5 mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#000638] text-[13px]">{fmtBRL(qtyOf(i) * (i.unit - (i.discount || 0)))}</td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => removeItem(i.productCode)} className="text-gray-300 hover:text-rose-500 transition-colors" title="Remover item">
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

          {/* Coluna direita */}
          <div className="space-y-2 lg:sticky lg:top-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
              <button
                onClick={portalLigado ? desligarPortal : ligarPortal}
                disabled={portalBusy}
                className={`w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 ${
                  portalLigado ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100' : 'bg-[#000638] text-white hover:bg-[#000638]/90'
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
                {portalStatus.status === 'reconectando' && <ArrowsClockwise size={13} className="animate-spin ml-1" />}
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
                  title={somPortal ? 'Portal apita a cada leitura — clique para silenciar' : 'Portal em silêncio — clique para voltar a apitar'}
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
                className="flex items-center gap-1"
              >
                <div className="relative min-w-0 flex-1">
                  <Barcode size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Sem tag? SKU / cód. barras"
                    className="w-full h-9 pl-8 pr-8 rounded-lg border border-gray-300 bg-white text-xs mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                  />
                  {manualBusy && <Spinner size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                </div>
                <input
                  type="number"
                  min="1"
                  max={LIMITE_INCLUSAO_MANUAL}
                  step="1"
                  value={manualQtd}
                  onChange={(e) => setManualQtd(e.target.value)}
                  title={`Quantidade desta peça (até ${LIMITE_INCLUSAO_MANUAL} por inclusão)`}
                  aria-label="Quantidade"
                  className="h-9 w-14 shrink-0 rounded-lg border border-gray-300 bg-white px-1 text-center text-xs mb-0 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
                <button type="submit" disabled={manualBusy || !manualCode.trim()} className="h-9 shrink-0 rounded-lg bg-[#000638] px-2.5 text-xs font-bold text-white disabled:opacity-40">
                  +{qtdDaInclusao(manualQtd) ?? '?'}
                </button>
              </form>

              <input ref={txtInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => importarCodigosTxt(e.target.files?.[0])} />
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
                  title={`Desconto máximo: ${TRANSF_CONFIG.maxDescontoPct}%`}
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

            {/* Resumo + gerar transferência */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
              <h2 className="text-xs font-semibold text-gray-700 mb-2">Resumo da transferência</h2>
              <div className="space-y-1 text-[13px]">
                {origem && destino && (
                  <div className="flex justify-between text-[#000638] font-semibold">
                    <span>Empresa {origem.code} → {destino.code}</span>
                    <span className="tabular-nums">{operacao || '—'}</span>
                  </div>
                )}
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
                  <span className="font-semibold text-gray-700">Total transferido</span>
                  <span className="text-xl font-bold text-[#000638] tabular-nums">{fmtBRL(totals.total)}</span>
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
                    <Receipt size={16} weight="bold" /> GERAR TRANSFERÊNCIA
                  </>
                )}
              </button>
              {!canGenerate && items.length > 0 && (
                <p className="mt-1.5 text-[10px] text-gray-400 text-center">
                  {regra && !regra.permitido
                    ? `Bloqueada pelo POP: ${regra.motivo}.`
                    : !origem || !destino
                      ? 'Escolha a empresa de origem e a filial de destino.'
                      : !seller
                        ? 'Escolha o vendedor.'
                        : 'Há produto sem preço.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal: transferência gerada no TOTVS + acompanhamento até ATENDIDA */}
        {trx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
              <CheckCircle
                size={44}
                weight="fill"
                className={`mx-auto mb-2 ${trxStatus === 4 ? 'text-emerald-500' : trxStatus === 6 ? 'text-rose-500' : 'text-blue-500'}`}
              />
              <h3 className="text-lg font-bold text-[#000638]">
                {trxStatus === 4 ? 'Transferência atendida!' : trxStatus === 6 ? 'Transação cancelada' : 'Transferência gerada!'}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Nº da transação <span className="font-mono font-bold text-[#000638] text-xl">{trx.transactionCode}</span>
                <br />
                Empresa {trx.branchCode} → {trx.destinoCode} · operação {trx.operacao} · CFOP {trx.cfop}
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
                  <ArrowsClockwise size={12} className={trxChecking ? 'animate-spin' : ''} /> Atualizar
                </button>
              </div>

              {trxStatus !== 4 && trxStatus !== 6 && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 ring-1 ring-gray-200">
                  Finalize no caixa TOTVS da empresa {trx.branchCode}: <b>TRAFP005</b> → Continuar Transação nº <b>{trx.transactionCode}</b> → Encerrar →
                  Receber. Esta tela atualiza sozinha a cada 10s.
                </p>
              )}
              {trxStatus === 4 && (
                <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-2.5 ring-1 ring-emerald-200">
                  Transferência processada no caixa — encerrada aqui também. ✅
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
                  <button onClick={novaTransferencia} className="w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90">
                    Nova transferência
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
                      onClick={novaTransferencia}
                      className="w-full h-9 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      Nova transferência agora
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {potenciaOpen && <PortalPotenciaModal onClose={() => setPotenciaOpen(false)} onSaved={() => showToast('ok', 'Potência do portal gravada')} />}

        {toast && (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.type === 'ok' ? <CheckCircle size={17} weight="bold" /> : <Warning size={17} weight="bold" />}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferenciaRFID;
