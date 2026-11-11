// Página: Expedição → Faturamento (/expedicao/faturamento?chave=<id do card | SEP:ref>)
// Pedido SEPARADO no Dryland → botão FATURAR na tela Pedido de Venda → aqui:
//   • empresa SEMPRE 99, cliente e vendedor do pedido
//   • os produtos do pedido aparecem pelo SKU; LIGAR PORTAL confere cada
//     etiqueta (EPC → SKU) contra o pedido — conferido / faltando / sobrando
//   • fiscal: cenário (RN / fora com IE / fora sem IE + DIFAL) e CFOP por peça
//     (produção própria × adquirido, aprendido das NF-e do TOTVS)
//   • transporte (transportadora, frete, volumes, peso) e pagamento (formas,
//     parcelas e vencimentos do boleto, NSU/autorização) já vêm do pedido
//   • FATURAR: a NF-e sai pelo HeadCoach (série 3 da 99) e o TOTVS recebe o
//     DOCUMENTO INTERNO (511/7807/7808/7809) + recebimento → contas a receber,
//     na EMPRESA 990 (nas empresas que emitem nota a API não fecha o
//     recebimento), com o caixa do terminal 1 da 990 aberto na data de hoje
//   • aba Transações: NF-e, documento interno, quem emitiu, peças com os EPCs
//     (kardex), valor, pagamento e comprovantes
//   • aba Transações também mostra a MINUTA (pedida ao robô do Dryland:
//     Correios / LATAM / Azul; a etiqueta ou o AWB voltam do card de lá) e a
//     DUPLICATA (venda com boleto: enviada pelo HeadCoach para o cliente
//     assinar, igual à do Dryland)
//   • PEÇA EM FALTA: o pedido tem 6 peças, só existem 5 e o cliente ficou com
//     o crédito → marca "o cliente ficou com crédito": a peça fica fora da nota,
//     o valor dela vira SALDO BÔNUS do cliente no HeadCoach (a API do TOTVS não
//     inclui adiantamento) e abre chamado para o Financeiro no Dryland
//     (services/faturamentoCredito.js)
//   • SALDO BÔNUS: forma de pagamento que gasta esse crédito em outro
//     faturamento (services/saldoBonus.js); no TOTVS o valor é recebido na forma
//     do pagamento que gerou o crédito
// Backend: /api/faturamento-expedicao (services/faturamentoExpedicao.js).
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
  Plus,
  Truck,
  CreditCard,
  Scales,
  CalendarBlank,
  FileText,
  Printer,
  DownloadSimple,
  ListBullets,
  CaretDown,
  CaretRight,
  Storefront,
  ArrowSquareOut,
  Info,
  WifiHigh,
  LockKey,
  ClockCounterClockwise,
  FloppyDisk,
  Wallet,
  Signature,
  PaperPlaneTilt,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { ClientePicker } from './DevolucaoRFID';
import { portalConnect, portalDisconnect, portalTags, portalClear } from '../utils/portalApi';
import PortalPotenciaModal from '../components/PortalPotenciaModal';
import { gerarHtmlDanfeDeXml } from '../utils/danfeHtml';
import { abrirImpressao } from '../utils/documentoFiscalHtml';

// ─── Configuração ────────────────────────────────────────────────────────────
const EMPRESA = 99; // faturamento (NF-e) sempre pela empresa 99
const EMPRESA_TOTVS = 990; // empresa do TOTVS que recebe o documento interno + contas a receber
const API = `${API_BASE_URL}/api/faturamento-expedicao`;
// Desconto dado na tela (Expedição Brejinho): até 20% é livre para quem tem a
// tela; acima disso, senha de owner, admin ou financeiro (perfil "user").
const LIMITE_DESCONTO_LIVRE = 20;
// REGRAS DO YAGO (11/11/2026), valem para o Faturamento dos pedidos do site:
//   1. o total fecha SEMPRE no valor do pedido do Dryland (o do comprovante) e as
//      formas de pagamento vêm exatamente como estão no pedido;
//   2. o PREÇO DE CADA PEÇA é o do pedido do Dryland e o sistema NUNCA o altera:
//      só o OPERADOR muda, digitando o preço na linha;
//   3. o operador pode dar um desconto de ajuste de no máximo 15% (sem senha);
//   4. valores e formas de pagamento são livres para o operador editar.
const LIMITE_DESCONTO_PEDIDOS = 15;
const ROLES_LIBERAM_DESCONTO = ['owner', 'admin', 'user'];
// Troca de peça na conferência (a que falta sai, a que sobra entra pelo MESMO
// valor do pedido): liberada até 11/11/2026 (era só 10/11; o Yago estendeu) —
// pedidos cuja separação se perdeu nas 72 h do Dryland e tiveram peça trocada.
// O servidor também confere a data.
const TROCA_LIBERADA_ATE = '2026-11-11';
// Formas que consomem saldo do cliente no TOTVS → campo do saldo.
// Vale SÓ o saldo da empresa 99 (Yago, 10/11/2026): saldo de outra empresa não
// aparece nem pode ser usado.
const CAMPO_SALDO = { credito_loja: 'credev', adiantamento: 'adiantamento' };

const OPERACOES_DOC_INTERNO = [
  { code: 511, label: '511 - VENDA VAREJO *', canal: 'varejo' },
  { code: 7807, label: '7807 - VENDAS FRANQUIAS N/OFC', canal: 'franquias' },
  { code: 7808, label: '7808 - VENDAS MTM N/OFC', canal: 'mtm' },
  { code: 7809, label: '7809 - VENDA REVENDEDORES N/OFC', canal: 'revenda' },
];

const FORMAS = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  boleto: 'Boleto',
  credito_loja: 'Credev',
  adiantamento: 'Adiantamento',
  dinheiro: 'Dinheiro',
  // crédito do cliente guardado no HeadCoach (peça em falta de outro faturamento)
  saldo_bonus: 'Saldo bônus',
};

const CANAIS = { varejo: 'Varejo', revenda: 'Revenda', mtm: 'Multimarcas', franquias: 'Franquias' };

const CENARIOS = {
  interna: { label: 'Dentro do RN', cfop: '5101 / 5102', icms: 'ICMS 20%' },
  interContrib: { label: 'Fora do RN · cliente com IE', cfop: '6101 / 6102', icms: 'ICMS 12%' },
  interNaoContrib: { label: 'Fora do RN · consumidor final', cfop: '6107 / 6108', icms: 'ICMS 12% + DIFAL' },
};

const TOTVS_STATUS = {
  1: { label: 'em andamento', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  4: { label: 'recebido · contas a receber lançado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  6: { label: 'cancelado', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
const NF_STATUS = {
  autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejeitada: 'bg-rose-50 text-rose-700 ring-rose-200',
  erro: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-200',
};

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
const hojeIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500';

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

// parcelas iguais; a diferença de centavos vai na última (igual ao TOTVS)
function parcelasIguais(total, n) {
  const q = Math.max(1, Number(n) || 1);
  const p = round2(total / q);
  return Array.from({ length: q }, (_, i) => (i === q - 1 ? round2(total - p * (q - 1)) : p));
}

// Unidades (uma por peça) de uma lista de itens do Dryland
function unidadesDe(lista) {
  const unidades = [];
  for (const i of lista || []) {
    const sku = String(i.cod || '').trim();
    if (!sku) continue;
    const q = Number(i.qtd) || 1;
    for (let k = 0; k < q; k++) {
      unidades.push({
        sku,
        descricao: i.descricao || '',
        cor: i.cor || '',
        tam: i.tam || i.tamanho || '',
        preco: round2(Number(i.preco) || 0),
        desc: 0,
        black: i.black ? { pct: Number(i.black_pct) || null, antes: Number(i.preco_antes_black) || null } : null,
        troca: i.troca_de ? String(i.troca_de) : null,
        brinde: !!i.brinde,
      });
    }
  }
  return unidades;
}

// Peças que estão no card do Painel e não na separação, e o contrário
// (só informativo: o que vale para faturar é a separação)
function diferencaCardSeparacao(dados) {
  if (dados?.separacaoIncompleta) return null;
  const sep = dados?.itens || [];
  const card = dados?.card?.dados?.itens || [];
  if (!sep.length || !card.length) return null;
  const conta = (lista) => {
    const m = new Map();
    for (const i of lista) {
      const sku = String(i.cod || '').trim();
      if (!sku) continue;
      const cur = m.get(sku) || { sku, nome: i.descricao || '', qtd: 0 };
      cur.qtd += Number(i.qtd) || 1;
      m.set(sku, cur);
    }
    return m;
  };
  const a = conta(sep);
  const b = conta(card);
  const soSeparacao = [];
  const soCard = [];
  for (const [sku, x] of a) if ((b.get(sku)?.qtd || 0) < x.qtd) soSeparacao.push({ ...x, qtd: x.qtd - (b.get(sku)?.qtd || 0) });
  for (const [sku, x] of b) if ((a.get(sku)?.qtd || 0) < x.qtd) soCard.push({ ...x, qtd: x.qtd - (a.get(sku)?.qtd || 0) });
  return soSeparacao.length || soCard.length ? { soSeparacao, soCard } : null;
}

// Itens do pedido agrupados por SKU (código do produto no TOTVS).
// AS PEÇAS vêm da SEPARAÇÃO do Dryland (tela /separar — "Loja Virtual Max",
// pedidos finalizados): é ela que diz o que realmente vai na caixa (trocas,
// peça não achada, crédito). Yago, 10/11/2026: o card do Painel era a tela
// errada para saber o que faturar.
// O PREÇO de cada peça continua o do Detalhar (card da fila: troca, Black e
// ajustes já aplicados — RV1325: 2555 a 17,50 + 16,39) quando o card tem
// aquela peça; peça que só existe na separação usa o preço da separação.
// Sem separação (ex.: Brejinho), valem os itens do card.
// Cada UNIDADE guarda: preço vendido, sua parte do desconto do pedido (rateado
// pelo preço; centavos que sobram na peça mais cara) e as marcas do Dryland
// (Black %, troca, brinde).
//
// O VALOR DO PEDIDO NO DRYLAND MANDA (Yago, 11/11/2026: "sempre tem que
// acompanhar a informação do Dryland"). O pedido foi fechado e pago por
// `valor_pedido` (o do comprovante): a nota tem que dar esse valor. Então o
// desconto das peças não é mais só o que o card declara (desconto + Pix): é o
// que falta para as peças chegarem em valor_pedido − frete (+ CREDEV, só
// quando o próprio card traz o CREDEV usado). Caso PE885: peças 1.142,74 +
// frete 154,54, pedido fechado em 645,09 → desconto de 652,19 nas peças; o
// HeadCoach NÃO presume CREDEV nem outra forma que o Dryland não informou.
// Se as peças + frete somam MENOS que o pedido, não há acréscimo: fica como
// está e a tela avisa que não bate. Brejinho fica fora (o card de lá não é o
// pedido do site).
const numeroDe = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
function descontoDoPedido(dd, somaCard) {
  const declarado = round2((Number(dd?.desconto) || 0) + (Number(dd?.desconto_pix) || 0));
  const pago = Number(dd?.valor_pedido) || 0;
  if (dd?.brejinho || !(pago > 0) || !(somaCard > 0)) return { total: declarado, declarado, ajuste: 0, base: somaCard, pago, alvo: null };
  const frete = Number(dd.valor_frete) || 0;
  const credev = numeroDe(dd.credev);
  const alvo = round2(pago + credev - frete); // quanto as peças valem no pedido do Dryland
  const total = Math.max(0, round2(somaCard - alvo));
  if (total >= somaCard) return { total: declarado, declarado, ajuste: 0, base: somaCard, pago, alvo };
  return { total, declarado, ajuste: round2(total - declarado), base: somaCard, pago, alvo, frete, credev };
}
function itensDoPedido(dados) {
  const doCard = unidadesDe(dados?.card?.dados?.itens);
  const daSep = unidadesDe((dados?.itens || []).map((i) => ({ cod: i.cod, descricao: i.descricao, cor: i.cor, tam: i.tamanho, qtd: i.qtd, preco: i.preco })));
  let unidades = doCard;
  if (daSep.length && !(dados?.separacaoIncompleta && doCard.length)) {
    // fila de unidades do card por SKU, para dar a cada peça separada o preço do Detalhar
    const fila = new Map();
    for (const u of doCard) {
      if (!fila.has(u.sku)) fila.set(u.sku, []);
      fila.get(u.sku).push(u);
    }
    unidades = daSep.map((u) => {
      const c = fila.get(u.sku)?.shift();
      return c ? { ...u, preco: c.preco, black: c.black, troca: c.troca, brinde: c.brinde } : { ...u, soSeparacao: doCard.length > 0 };
    });
  }
  // desconto do pedido rateado nas peças: o que leva as peças ao valor fechado no Dryland.
  // A proporção sai das peças do CARD (é a elas que valor_pedido se refere); se a
  // separação trouxe peças diferentes, cada uma leva a mesma proporção.
  const dd = dados?.card?.dados || {};
  const soma = unidades.reduce((s, u) => s + u.preco, 0);
  const somaCard = doCard.reduce((s, u) => s + u.preco, 0) || soma;
  const dp = descontoDoPedido(dd, round2(somaCard));
  if (dp.total > 0 && soma > 0 && dp.base > 0) {
    unidades.forEach((u) => (u.desc = round2((dp.total * u.preco) / dp.base)));
    // centavos que sobram: só quando as peças são as mesmas do card
    if (Math.abs(soma - dp.base) < 0.01) {
      const sobra = round2(dp.total - unidades.reduce((s, u) => s + u.desc, 0));
      if (sobra !== 0) {
        const k = unidades.reduce((m, u, idx) => (u.preco > unidades[m].preco ? idx : m), 0);
        unidades[k].desc = round2(unidades[k].desc + sobra);
      }
    }
  }
  const porSku = new Map();
  for (const u of unidades) {
    const cur = porSku.get(u.sku) || { sku: u.sku, descricao: u.descricao, cor: u.cor, tam: u.tam, unidades: [] };
    cur.unidades.push(u);
    porSku.set(u.sku, cur);
  }
  return [...porSku.values()]
    .map((x) => ({ ...x, qtd: x.unidades.length, precos: x.unidades.map((u) => u.preco), preco: round2(x.unidades.reduce((s, u) => s + u.preco, 0) / x.unidades.length) }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao));
}

// Resumo dos descontos do pedido (para a tela)
function resumoDescontos(dados, itens) {
  const dd = dados?.card?.dados || {};
  const unidades = itens.flatMap((i) => i.unidades);
  const total = unidades.length;
  const out = [];
  const pix = Number(dd.desconto_pix) || 0;
  const geral = Number(dd.desconto) || 0;
  const base = Number(dd.valor_cheio) || unidades.reduce((s, u) => s + u.preco, 0);
  const somaCard = round2(unidadesDe(dd.itens).reduce((s, u) => s + u.preco, 0)) || round2(unidades.reduce((s, u) => s + u.preco, 0));
  const dp = descontoDoPedido(dd, somaCard);
  if (Math.abs(dp.ajuste) > 0.01) {
    // o card não declara (ou declara diferente) o desconto que fecha no valor do pedido
    if (dp.total > 0) {
      out.push({
        tipo: 'Desconto para fechar no valor do pedido (Dryland)',
        pct: dp.base ? (dp.total / dp.base) * 100 : null,
        valor: dp.total,
        pecas: total,
        total,
        nota: `Peças somam ${fmtBRL(dp.base)}${dp.frete ? ` + frete ${fmtBRL(dp.frete)}` : ''}; o pedido foi fechado em ${fmtBRL(dp.pago)}${dp.credev ? ` + CREDEV ${fmtBRL(dp.credev)} do card` : ''}.`,
      });
    }
  } else {
    if (pix > 0) out.push({ tipo: 'Desconto Pix', pct: base ? (pix / base) * 100 : null, valor: pix, pecas: total, total });
    if (geral > 0) out.push({ tipo: 'Desconto do pedido', pct: base ? (geral / base) * 100 : null, valor: geral, pecas: total, total });
  }
  const porPct = {};
  for (const u of unidades.filter((x) => x.black)) {
    let k = u.black.pct;
    if (k == null) k = u.black.antes ? round2((1 - u.preco / u.black.antes) * 100) : 0;
    porPct[k] = porPct[k] || { n: 0, valor: 0 };
    porPct[k].n += 1;
    porPct[k].valor += u.black.antes ? u.black.antes - u.preco : 0;
  }
  for (const [pct, v] of Object.entries(porPct)) out.push({ tipo: 'Black', pct: Number(pct) || null, valor: round2(v.valor), pecas: v.n, total });
  const trocas = unidades.filter((u) => u.troca).length;
  if (trocas) out.push({ tipo: 'Troca (preço pago mantido)', pct: null, valor: null, pecas: trocas, total });
  const brindes = unidades.filter((u) => u.brinde).length;
  if (brindes) out.push({ tipo: 'Brinde', pct: null, valor: null, pecas: brindes, total });
  return out;
}

async function imprimirDanfe(notaId, { cancelada = false } = {}) {
  const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${notaId}/xml`);
  if (!r.ok) throw new Error('XML da nota não encontrado');
  abrirImpressao(gerarHtmlDanfeDeXml(await r.text(), { cancelada }));
}

function Bloco({ titulo, icone: Icone, children, extra }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <Icone size={15} className="text-[#000638]" />
        <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-[#000638]">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Chip({ children, cls = 'bg-gray-100 text-gray-600 ring-gray-200' }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${cls}`}>{children}</span>;
}

// ─── Busca de transportadora (taxista ou outra pessoa do TOTVS) ─────────────
function BuscaPessoa({ onEscolher }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const buscar = async () => {
    const t = q.trim();
    if (!t) return;
    setBusy(true);
    try {
      const param = /^\d+$/.test(t) ? `code=${t}` : `nome=${encodeURIComponent(t)}`;
      const r = await fetch(`${API_BASE_URL}/api/totvs/clientes/search-name?${param}`);
      const j = await r.json();
      setRes(j?.data?.clientes || []);
    } catch {
      setRes([]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} placeholder="Código ou nome no TOTVS" className={inputCls} />
        <button onClick={buscar} disabled={busy} className="h-9 shrink-0 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white disabled:opacity-40">
          {busy ? <Spinner size={13} className="animate-spin" /> : <MagnifyingGlass size={13} />}
        </button>
      </div>
      {res && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg ring-1 ring-gray-200">
          {res.length === 0 && <li className="px-2 py-1.5 text-xs text-gray-400">Ninguém encontrado</li>}
          {res.slice(0, 20).map((c) => (
            <li key={c.code}>
              <button
                onClick={() => {
                  onEscolher({ code: c.code, nome: c.name });
                  setRes(null);
                  setQ('');
                }}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50"
              >
                <b className="text-[#000638]">{c.code}</b> — {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Lista dos pedidos a faturar (tela sem pedido escolhido) ────────────────
// QUAIS pedidos: os "a faturar" do Painel do frete (pago e sem nota; não some
// depois de 72 h como os Finalizados da tela Separar). QUAIS peças: a separação.
// Situação da separação de cada linha da lista:
const situacaoSeparacao = (p) => {
  const sp = p.separacao;
  const semSep = { k: 'sem', label: 'sem separação · peças do card', cls: 'bg-gray-100 text-gray-600 ring-gray-200', pode: true };
  if (!sp) return semSep;
  // ainda na tela Separar do Dryland com peça por achar: não libera
  if (sp.viva && sp.status !== 'separado') return { k: 'andamento', label: `em separação ${sp.qtd_separada || 0}/${sp.qtd_pecas || 0}`, cls: 'bg-amber-50 text-amber-700 ring-amber-200', pode: false };
  if (sp.incompleta) return { k: 'antiga', label: 'separação antiga · peças do card', cls: 'bg-gray-100 text-gray-600 ring-gray-200', pode: true };
  if (sp.status === 'separado') return { k: 'ok', label: 'separação finalizada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', pode: true };
  // saiu da tela sem nenhuma linha separada (linhas tiradas do pedido)
  return semSep;
};
const pecasDaLinha = (p) => {
  const st = situacaoSeparacao(p);
  return Number(st.k === 'ok' || st.k === 'andamento' ? p.separacao?.qtd_pecas : p.pecas_card ?? p.separacao?.qtd_pecas) || 0;
};

function ListaSeparados({ onEscolher, origem = 'pedidos' }) {
  const brejinho = origem === 'brejinho';
  const [itens, setItens] = useState(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    setItens(null);
    setErro('');
    try {
      const r = await fetch(
        brejinho
          ? `${API_BASE_URL}/api/brejinho?status=${encodeURIComponent('aguardando pagamento')}`
          : `${API_BASE_URL}/api/pedidos-venda?status=${encodeURIComponent('a faturar')}`,
      );
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || `HTTP ${r.status}`);
      setItens(
        brejinho
          ? (j.data.items || []).map((p) => ({
              chave: p.chave,
              numero_site: p.pedido,
              cliente: p.cliente,
              canal: 'franquias',
              separacao: { qtd_pecas: p.qtd_pecas },
              valor: p.valor,
              faturamento: p.faturamento,
            }))
          : j.data.items || [],
      );
    } catch (e) {
      setErro(e.message);
      setItens([]);
    }
  }, [brejinho]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const filtrados = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return (itens || [])
      .filter((p) => brejinho || tipo === 'todos' || p.canal === tipo)
      .filter((p) => !b || [p.numero_site, p.cliente, p.titulo, p.vendedor].filter(Boolean).some((v) => String(v).toUpperCase().includes(b)))
      // os já faturados (nota emitida) ficam no fim da lista
      .sort((x, y) => Number(!!x.faturamento?.nf) - Number(!!y.faturamento?.nf));
  }, [itens, busca, tipo, brejinho]);
  // mesmos tipos da tela Separar do Dryland (transferência não é venda: não fatura aqui)
  const tipos = useMemo(() => {
    const conta = (k) => {
      const l = (itens || []).filter((p) => k === 'todos' || p.canal === k);
      return { pedidos: l.length, pecas: l.reduce((s, p) => s + pecasDaLinha(p), 0) };
    };
    return [
      ['todos', 'Todos'],
      ['mtm', 'Multimarcas'],
      ['revenda', 'Revendedor'],
      ['franquias', 'Franquia'],
      ['varejo', 'Varejo'],
    ].map(([k, label]) => ({ k, label, ...conta(k) }));
  }, [itens]);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-bold text-[#000638]">{brejinho ? 'Pedidos do Brejinho aguardando pagamento' : 'Pedidos a faturar (Painel do frete) · peças pela separação do Dryland'}</p>
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="pedido, cliente, vendedor…" className="mb-0 h-9 w-56 rounded-lg border border-gray-300 pl-8 pr-2 text-sm" />
        </div>
        <button onClick={carregar} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
          <ArrowsClockwise size={13} className={itens === null ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      {!brejinho && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tipos.map((t) => (
            <button
              key={t.k}
              onClick={() => setTipo(t.k)}
              className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold ring-1 transition ${
                tipo === t.k ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'
              }`}
            >
              {t.label} · {t.pedidos} pedido{t.pedidos === 1 ? '' : 's'} · {t.pecas} pçs
            </button>
          ))}
        </div>
      )}
      {erro && <p className="mb-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {itens === null ? (
        <div className="py-8 text-center text-gray-400">
          <Spinner size={20} className="mx-auto animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">{brejinho ? 'Nenhum pedido aguardando pagamento.' : 'Nenhum pedido a faturar.'}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filtrados.map((p) => {
            // nota emitida = pedido FATURADO: só volta a faturar com a NF-e e a transação do TOTVS canceladas
            const faturado = !!p.faturamento?.nf;
            const semSeparacao = !brejinho && !situacaoSeparacao(p).pode;
            return (
            <li key={p.chave} className={`flex flex-wrap items-center gap-2 py-2 text-xs ${faturado ? 'bg-emerald-50/40' : ''}`}>
              <span className="w-20 font-mono font-bold text-[#000638]">{p.numero_site || '—'}</span>
              <span className="min-w-[160px] flex-1 truncate font-medium text-gray-800">{p.cliente || p.titulo}</span>
              <span className="text-gray-500">{CANAIS[p.canal] || p.canal}</span>
              <span className="tabular-nums text-gray-500">{brejinho ? p.separacao?.qtd_pecas || 0 : pecasDaLinha(p)} pç</span>
              {!brejinho && <Chip cls={situacaoSeparacao(p).cls}>{situacaoSeparacao(p).label}</Chip>}
              <span className="w-24 text-right font-semibold tabular-nums">{fmtBRL(p.valor)}</span>
              {p.faturamento && (
                <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  {faturado ? (
                    <>
                      <CheckCircle size={11} weight="fill" /> FATURADO · NF {p.faturamento.nf}
                    </>
                  ) : (
                    `tx ${p.faturamento.transacao}`
                  )}
                </Chip>
              )}
              {faturado ? (
                <span
                  title={`Pedido já faturado (NF ${p.faturamento.nf}). Para faturar de novo, cancele a NF-e e a transação do TOTVS.`}
                  className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-lg bg-gray-100 px-3 text-[11px] font-bold text-gray-400 ring-1 ring-gray-200"
                >
                  <LockKey size={12} weight="bold" /> FATURADO
                </span>
              ) : (
                <button
                  onClick={() => onEscolher(p.chave)}
                  disabled={semSeparacao}
                  title={semSeparacao ? 'A separação deste pedido ainda não foi finalizada no Dryland' : ''}
                  className="h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  FATURAR
                </button>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Duplicata e minuta (aba Transações) ────────────────────────────────────
const DUP_STATUS = {
  enviando: { label: 'duplicata sendo enviada', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  enviada: { label: 'duplicata enviada · aguardando assinatura', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  assinada: { label: 'duplicata assinada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  erro: { label: 'duplicata não enviada', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  cancelada: { label: 'duplicata cancelada', cls: 'bg-gray-100 text-gray-500 ring-gray-200' },
};
// resumo da minuta lida do card do Dryland
function resumoMinuta(m) {
  if (!m) return null;
  if (m.entregue) return { label: 'entregue', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  if (m.correiosObjeto) return { label: `Correios ${m.correiosObjeto}`, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  if (m.latamAwb) return { label: `LATAM ${m.latamAwb}`, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  if (m.azulAwb) return { label: `Azul ${m.azulAwb}`, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  const erro = m.solicitada === 'correios' ? m.etiquetaErro : m.solicitada === 'latam' ? m.latamErro : m.solicitada === 'azul' ? m.azulErro : null;
  if (erro) return { label: 'minuta parada', cls: 'bg-rose-50 text-rose-700 ring-rose-200', erro };
  if (m.solicitada) return { label: `minuta ${m.solicitada} na fila`, cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return null;
}

function BlocoDuplicata({ v, dup, nota, onAcao, busy }) {
  const st = dup ? DUP_STATUS[dup.status] : null;
  const podeEnviar = nota?.status === 'autorizada' && v?.status !== 'cancelada';
  return (
    <div className="rounded-xl bg-white p-3 text-xs ring-1 ring-gray-200">
      <p className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Signature size={14} className="text-[#000638]" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-[#000638]">Duplicata</span> {st ? <Chip cls={st.cls}>{st.label}</Chip> : <Chip cls="bg-gray-100 text-gray-600 ring-gray-200">ainda não enviada</Chip>}
      </p>
      {dup?.erro && dup.status === 'erro' && <p className="mt-1 text-[11px] text-rose-600">{dup.erro}</p>}
      {dup?.link && (
        <p className="mt-1 text-[11px] text-gray-600">
          Link de assinatura:{' '}
          <a href={dup.link} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:underline">
            {dup.link}
          </a>
          {dup.telefone ? ` · enviado para ${dup.telefone}` : ''}
          {dup.enviada_em ? ` em ${fmtDataHora(dup.enviada_em)}` : ''}
        </p>
      )}
      {dup?.assinada_em && (
        <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
          Assinada em {fmtDataHora(dup.assinada_em)}
          {dup.assinada_url && (
            <a href={dup.assinada_url} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-blue-700 hover:underline">
              PDF assinado <ArrowSquareOut size={10} className="inline" />
            </a>
          )}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <a
          href={`${API}/vendas/${v.id}/duplicata/pdf`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
        >
          <FileText size={13} /> Ver o documento
        </a>
        {podeEnviar && (!dup || dup.status === 'erro') && (
          <button
            onClick={() => onAcao(`${API}/vendas/${v.id}/duplicata`, {})}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {busy ? <Spinner size={13} className="animate-spin" /> : <PaperPlaneTilt size={13} />} Enviar duplicata
          </button>
        )}
        {podeEnviar && dup?.status === 'enviada' && (
          <>
            <button
              onClick={() => onAcao(`${API}/vendas/${v.id}/duplicata/conferir`, {})}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowsClockwise size={13} /> Conferir assinatura
            </button>
            <button
              onClick={() => window.confirm('Gerar um documento NOVO e mandar outra mensagem para o cliente? O link anterior continua valendo no Autentique.') && onAcao(`${API}/vendas/${v.id}/duplicata`, { forcar: true })}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-300 hover:bg-amber-50 disabled:opacity-50"
            >
              <PaperPlaneTilt size={13} /> Reenviar
            </button>
          </>
        )}
      </div>
      <p className="mt-1 text-[10.5px] text-gray-400">Mesmo documento e mesma mensagem do Dryland. O lembrete de 3 h e o alerta de 24 h continuam saindo pelo robô de lá.</p>
    </div>
  );
}

function BlocoMinuta({ v, m, dup, temCard, temBoleto, nota, onAcao, busy }) {
  const [dims, setDims] = useState({ altura: '', largura: '', comprimento: '' });
  const r = resumoMinuta(m);
  const emitida = !!(m?.correiosObjeto || m?.latamAwb || m?.azulAwb);
  // o card do Dryland já tem nota de fora do HeadCoach: o pedido já tinha sido faturado no TOTVS
  const outraNota = m?.nfNoCard && !m.nfDoHeadcoach && nota?.chave && m.nfNoCard !== nota.chave;
  const travaDup = temBoleto && dup?.status !== 'assinada' && !(m?.duplicataAssinadaEm && m?.duplicataDoHeadcoach);
  const motivo = !temCard
    ? 'Este pedido não tem card na fila do Dryland, que é por onde o robô emite a minuta.'
    : outraNota
      ? `O card do Dryland já tem a NF ${m.nfNumeroNoCard || '?'}, emitida fora do HeadCoach: este pedido já tinha sido faturado. Resolva a nota em duplicidade antes de pedir a minuta.`
    : nota?.status !== 'autorizada'
      ? 'A NF-e precisa estar autorizada.'
      : travaDup
        ? 'Pagamento em boleto: a minuta só é liberada depois que o cliente assinar a duplicata.'
        : null;
  const pedir = (body) => onAcao(`${API}/vendas/${v.id}/minuta`, body);
  const btn = 'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold ring-1 disabled:opacity-40';
  return (
    <div className="rounded-xl bg-white p-3 text-xs ring-1 ring-gray-200">
      <p className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Truck size={14} className="text-[#000638]" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-[#000638]">Minuta</span> {r ? <Chip cls={r.cls}>{r.label}</Chip> : <Chip cls="bg-gray-100 text-gray-600 ring-gray-200">não pedida</Chip>}
        {m?.rastreioStatus && <span className="text-[11px] text-gray-600">· {m.rastreioStatus}</span>}
      </p>
      {r?.erro && <p className="mt-1 text-[11px] text-rose-600">{r.erro}</p>}
      {m?.latamSemEntrega && <p className="mt-1 text-[11px] text-amber-700">LATAM: o destino não tem entrega em domicílio — retirada na base.</p>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {m?.etiquetaUrl && (
          <a href={m.etiquetaUrl} target="_blank" rel="noreferrer" className={`${btn} bg-[#000638] text-white ring-[#000638]`}>
            <Printer size={13} /> Etiqueta dos Correios
          </a>
        )}
        {m?.azulPdfUrl && (
          <a href={m.azulPdfUrl} target="_blank" rel="noreferrer" className={`${btn} bg-[#000638] text-white ring-[#000638]`}>
            <Printer size={13} /> Minuta da Azul (PDF)
          </a>
        )}
      </div>
      {!emitida && (
        <>
          {motivo ? (
            <p className="mt-1 text-[11px] text-amber-700">{motivo}</p>
          ) : (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <button onClick={() => pedir({ tipo: 'correios', servico: 'PAC' })} disabled={busy} className={`${btn} text-[#000638] ring-gray-300 hover:bg-gray-50`}>
                  Correios PAC
                </button>
                <button onClick={() => pedir({ tipo: 'correios', servico: 'SEDEX' })} disabled={busy} className={`${btn} text-[#000638] ring-gray-300 hover:bg-gray-50`}>
                  Correios SEDEX
                </button>
                <button onClick={() => pedir({ tipo: 'azul' })} disabled={busy} className={`${btn} text-[#000638] ring-gray-300 hover:bg-gray-50`}>
                  Azul
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {['altura', 'largura', 'comprimento'].map((k) => (
                  <input
                    key={k}
                    type="number"
                    min="1"
                    value={dims[k]}
                    onChange={(e) => setDims((x) => ({ ...x, [k]: e.target.value }))}
                    placeholder={`${k} cm${m?.dimensoes?.[k] ? ` (${m.dimensoes[k]})` : ''}`}
                    className="mb-0 h-8 w-28 rounded-lg border border-gray-300 px-1.5 text-[11px]"
                  />
                ))}
                <button onClick={() => pedir({ tipo: 'latam', ...dims })} disabled={busy} className={`${btn} text-[#000638] ring-gray-300 hover:bg-gray-50`}>
                  LATAM
                </button>
              </div>
              {m?.solicitada && !r?.erro && <p className="mt-1 text-[11px] text-gray-500">Pedido feito: o robô do Dryland emite em até 10 minutos e o resultado aparece aqui.</p>}
            </>
          )}
        </>
      )}
      <p className="mt-1 text-[10.5px] text-gray-400">
        Quem emite é o robô do Dryland (Correios, LATAM e Azul). BEE, Baraúnas e taxistas não têm minuta.
        {v?.transporte?.nome ? ` Transportadora do faturamento: ${v.transporte.nome}.` : ''}
      </p>
    </div>
  );
}

// ─── Aba Transações ─────────────────────────────────────────────────────────
// Situação do faturamento numa palavra só: cor da linha, filtros e resumo
const SITUACOES = {
  ok: { label: 'Faturado', plural: 'Faturados', barra: 'border-l-emerald-500', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', num: 'text-emerald-700' },
  totvs: { label: 'TOTVS pendente', plural: 'TOTVS pendente', barra: 'border-l-amber-500', cls: 'bg-amber-50 text-amber-800 ring-amber-200', num: 'text-amber-700' },
  nf: { label: 'NF-e com problema', plural: 'NF-e com problema', barra: 'border-l-rose-500', cls: 'bg-rose-50 text-rose-700 ring-rose-200', num: 'text-rose-700' },
  cancelado: { label: 'Cancelado', plural: 'Cancelados', barra: 'border-l-gray-300', cls: 'bg-gray-100 text-gray-500 ring-gray-200', num: 'text-gray-500' },
};
function situacaoFat(nota, venda) {
  if (venda?.status === 'cancelada' || nota?.status === 'cancelada') return 'cancelado';
  if (nota?.status !== 'autorizada') return 'nf';
  if (venda?.totvs_status !== 4) return 'totvs';
  return 'ok';
}
const empresaTotvsDe = (v) => Number(v?.pedido_info?.empresaTotvs) || EMPRESA;
const formasTexto = (s) =>
  String(s || '')
    .split(' + ')
    .filter(Boolean)
    .map((x) => FORMAS[x] || x)
    .join(' + ');
const TOTVS_CURTO = { 1: 'em andamento', 4: 'atendida · contas a receber lançado', 6: 'cancelada' };
// colunas da lista (a mesma grade no cabeçalho e nas linhas)
const GRADE_TRX =
  'flex flex-wrap items-center gap-x-3 gap-y-1 lg:grid lg:grid-cols-[14px_92px_84px_minmax(170px,1fr)_124px_150px_minmax(110px,200px)_48px_104px]';

function Cartao({ titulo, icone: Icone, chip, children, className = '' }) {
  return (
    <section className={`rounded-xl bg-white p-3 text-xs ring-1 ring-gray-200 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Icone size={14} className="text-[#000638]" />
        <h4 className="flex-1 text-[11px] font-bold uppercase tracking-wide text-[#000638]">{titulo}</h4>
        {chip}
      </div>
      {children}
    </section>
  );
}

function Campo({ rotulo, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="truncate text-xs font-semibold text-gray-800">{children}</p>
    </div>
  );
}

function DetalheTransacao({ id, onReprocessar, reprocessando }) {
  const { user } = useAuth();
  const [acaoBusy, setAcaoBusy] = useState(false);
  const [avisoAcao, setAvisoAcao] = useState('');
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  const [terminalNovo, setTerminalNovo] = useState('');
  const [faturaNova, setFaturaNova] = useState(null); // null = mantém o que está na venda
  const [operacaoNova, setOperacaoNova] = useState(''); // '' = mantém; outra = abre nova transação no TOTVS
  const [cancelar, setCancelar] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [avisoCancel, setAvisoCancel] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch(`${API}/transacoes/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (!j.success) throw new Error(j.message);
        setD(j.data);
      })
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [id, versao]);
  const cancelarNota = async (notaId) => {
    setCancelando(true);
    setAvisoCancel('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${notaId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });
      const j = await r.json();
      setAvisoCancel(j.message || (j.success ? 'Nota cancelada' : 'Falha ao cancelar'));
      if (j.success) {
        setCancelar(false);
        setVersao((v) => v + 1);
      }
    } catch (e) {
      setAvisoCancel(e.message);
    } finally {
      setCancelando(false);
    }
  };
  const acao = async (url, body) => {
    setAcaoBusy(true);
    setAvisoAcao('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, por: user?.name || user?.email || null }) });
      const j = await r.json();
      setAvisoAcao(j.message || (j.success ? 'Feito' : 'Falhou'));
      setVersao((x) => x + 1);
    } catch (e) {
      setAvisoAcao(e.message);
    } finally {
      setAcaoBusy(false);
    }
  };
  if (erro) return <p className="border-t border-gray-100 bg-slate-50 px-4 py-3 text-xs text-rose-600">{erro}</p>;
  if (!d)
    return (
      <div className="border-t border-gray-100 bg-slate-50 py-6 text-center text-gray-400">
        <Spinner size={18} className="mx-auto animate-spin" />
      </div>
    );
  const v = d.venda;
  const fat = d.faturamento;
  const vendaTemBoleto = (v?.pagamentos || []).some((p) => p.forma === 'boleto');
  const nota = v?.notas?.find((n) => n.status === 'autorizada') || v?.notas?.[0];
  const empTotvs = empresaTotvsDe(v);
  const sit = situacaoFat(nota, v);
  // nota cancelada com a transação do TOTVS ainda de pé: o pedido continua travado
  const totvsAberta = sit === 'cancelado' && !!v?.totvs_transacao_code && v?.totvs_status !== 6;
  const podeTentar = nota?.status !== 'cancelada' && v?.status !== 'cancelada' && (nota?.status !== 'autorizada' || v?.totvs_status !== 4);
  const porProduto = {};
  for (const k of d.kardex) {
    porProduto[k.product_code] = porProduto[k.product_code] || { nome: k.produto_nome, epcs: [] };
    porProduto[k.product_code].epcs.push(k.epc);
  }
  const itens = v?.itens || [];
  const totalPecas = itens.reduce((t, it) => t + Number(it.quantidade || 0), 0);
  const totalItens = itens.reduce((t, it) => t + Number(it.quantidade || 0) * Number(it.valor_unit || 0), 0);
  const min = resumoMinuta(d.minuta);
  const minutaEmitida = !!(d.minuta?.correiosObjeto || d.minuta?.latamAwb || d.minuta?.azulAwb || d.minuta?.entregue);
  const anteriores = v?.pedido_info?.transacoesAnteriores || [];
  const credito = Number(v?.pedido_info?.creditoFalta?.valor) > 0 ? v.pedido_info.creditoFalta : null;
  // trilha do faturamento: o que já foi e o que falta
  const etapas = [
    {
      nome: 'NF-e',
      texto: nota ? `${nota.numero}/${nota.serie}${nota.status !== 'autorizada' ? ` · ${nota.status}` : ''}` : 'sem nota',
      tom: nota?.status === 'autorizada' ? 'ok' : nota?.status === 'cancelada' ? 'cancel' : 'ruim',
    },
    {
      nome: 'TOTVS',
      texto: v?.totvs_transacao_code ? `${empTotvs}/${v.totvs_transacao_code}${v.totvs_status === 6 ? ' · cancelada' : v.totvs_status === 4 ? '' : ' · aberta'}` : 'não aberta',
      tom: v?.totvs_status === 4 ? (totvsAberta ? 'falta' : 'ok') : v?.totvs_status === 6 ? 'cancel' : sit === 'cancelado' && !v?.totvs_transacao_code ? 'cancel' : v?.totvs_erro ? 'ruim' : 'falta',
    },
    ...(vendaTemBoleto
      ? [
          {
            nome: 'Duplicata',
            texto: d.duplicata ? { assinada: 'assinada', enviada: 'aguardando assinatura', enviando: 'enviando', erro: 'não enviada', cancelada: 'cancelada' }[d.duplicata.status] || d.duplicata.status : 'não enviada',
            tom: d.duplicata?.status === 'assinada' ? 'ok' : d.duplicata?.status === 'erro' ? 'ruim' : 'falta',
          },
        ]
      : []),
    ...(d.temCard
      ? [{ nome: 'Minuta', texto: min?.label || 'não pedida', tom: minutaEmitida ? 'ok' : min?.erro ? 'ruim' : 'falta' }]
      : []),
    ...(credito
      ? [
          {
            nome: 'Crédito',
            texto: `${fmtBRL(credito.valor)} · ${credito.status === 'gerado' ? `saldo bônus${credito.chamado?.numero ? ` · chamado #${credito.chamado.numero}` : ''}` : credito.status === 'erro' ? 'incompleto' : 'a gerar'}`,
            tom: credito.status === 'erro' ? 'ruim' : credito.status === 'gerado' ? 'ok' : 'falta',
          },
        ]
      : []),
  ];
  const TOM = {
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    falta: 'bg-amber-50 text-amber-800 ring-amber-200',
    ruim: 'bg-rose-50 text-rose-700 ring-rose-200',
    cancel: 'bg-gray-100 text-gray-500 ring-gray-200',
  };
  const btn = 'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold';
  return (
    <div className="border-t border-gray-100 bg-slate-50 px-3 py-3">
      {/* trilha */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {etapas.map((e, i) => (
          <React.Fragment key={e.nome}>
            {i > 0 && <CaretRight size={11} className="text-gray-300" />}
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] ring-1 ${TOM[e.tom]}`}>
              {e.tom === 'ok' ? <CheckCircle size={13} weight="fill" /> : e.tom === 'ruim' ? <Warning size={13} weight="fill" /> : e.tom === 'cancel' ? <X size={12} weight="bold" /> : <Info size={13} />}
              <span className="font-bold uppercase tracking-wide">{e.nome}</span>
              <span>{e.texto}</span>
            </span>
          </React.Fragment>
        ))}
      </div>
      {totvsAberta && (
        <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-300">
          <LockKey size={14} weight="bold" className="mt-0.5 shrink-0" />
          <span>
            A NF-e foi cancelada, mas a transação <b>{empTotvs}/{v.totvs_transacao_code}</b> do TOTVS continua aberta. Cancele-a no TOTVS: enquanto ela existir, o pedido segue travado como faturado.
          </span>
        </p>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-3">
        {/* ── Nota fiscal ── */}
        <Cartao titulo="Nota fiscal" icone={FileText} chip={nota ? <Chip cls={NF_STATUS[nota.status]}>{nota.status}</Chip> : <Chip cls={NF_STATUS.erro}>sem nota</Chip>}>
          {nota ? (
            <>
              <p className="text-lg font-bold leading-tight text-[#000638]">
                NF-e {nota.numero}
                <span className="text-xs font-semibold text-gray-400"> · série {nota.serie}</span>
              </p>
              {nota.chave && <p className="mt-0.5 break-all font-mono text-[10.5px] text-gray-500">{nota.chave}</p>}
              {nota.status !== 'autorizada' && nota.xmotivo && (
                <p className="mt-1.5 rounded-lg bg-rose-50 px-2 py-1 text-[11px] text-rose-700 ring-1 ring-rose-200">
                  {nota.cstat} {nota.xmotivo}
                </p>
              )}
            </>
          ) : (
            <p className="text-gray-400">A nota não chegou a ser emitida.</p>
          )}
          {(nota?.status === 'autorizada' || nota?.status === 'cancelada') && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => imprimirDanfe(nota.id, { cancelada: nota.status === 'cancelada' }).catch((e) => alert(e.message))} className={`${btn} bg-[#000638] text-white`}>
                <Printer size={13} /> DANFE
              </button>
              <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${nota.id}/xml`} className={`${btn} text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50`}>
                <DownloadSimple size={13} /> XML
              </a>
              {nota.status === 'autorizada' && !cancelar && (
                <button onClick={() => setCancelar(true)} className={`${btn} ml-auto text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50`}>
                  <X size={13} weight="bold" /> Cancelar NF-e
                </button>
              )}
            </div>
          )}
          {cancelar && nota?.status === 'autorizada' && (
            <div className="mt-2 rounded-lg bg-rose-50 p-2 ring-1 ring-rose-200">
              <p className="text-[11px] font-bold text-rose-700">
                Cancelar a NF-e {nota.numero}/{nota.serie} na SEFAZ
              </p>
              <p className="text-[10.5px] text-rose-700">
                Não tem volta. A transação do TOTVS não é cancelada por aqui: cancele-a no TOTVS. O pedido só volta a poder ser faturado com a nota e a transação canceladas.
              </p>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Justificativa (mínimo 15 caracteres)"
                rows={2}
                className="mb-0 mt-1 w-full rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs"
              />
              <div className="mt-1 flex gap-1.5">
                <button onClick={() => setCancelar(false)} className={`${btn} bg-white text-gray-600 ring-1 ring-gray-300`}>
                  Voltar
                </button>
                <button onClick={() => cancelarNota(nota.id)} disabled={cancelando || justificativa.trim().length < 15} className={`${btn} bg-rose-600 text-white disabled:opacity-40`}>
                  {cancelando ? <Spinner size={13} className="animate-spin" /> : <X size={13} weight="bold" />} Confirmar cancelamento
                </button>
              </div>
            </div>
          )}
          {avisoCancel && <p className="mt-2 rounded-lg bg-blue-50 px-2 py-1 text-[11px] text-blue-800 ring-1 ring-blue-200">{avisoCancel}</p>}
        </Cartao>

        {/* ── TOTVS ── */}
        <Cartao
          titulo="TOTVS · documento interno"
          icone={Buildings}
          chip={
            v?.totvs_status ? (
              <Chip cls={TOTVS_STATUS[v.totvs_status]?.cls}>{TOTVS_CURTO[v.totvs_status] || v.totvs_status}</Chip>
            ) : (
              <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">não aberta</Chip>
            )
          }
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Campo rotulo="Transação">{v?.totvs_transacao_code || '—'}</Campo>
            <Campo rotulo="Empresa">{v?.totvs_transacao_code ? empTotvs : '—'}</Campo>
            <Campo rotulo="Operação">{v?.operacao_doc_interno || '—'}</Campo>
            <Campo rotulo="Data">{v?.totvs_transacao_code ? fmtData(v.totvs_transacao_date) : '—'}</Campo>
          </div>
          {v?.totvs_erro && <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-[11px] text-rose-700 ring-1 ring-rose-200">{v.totvs_erro}</p>}
          {v?.totvs_status !== 4 && v?.status !== 'cancelada' && empTotvs !== EMPRESA_TOTVS && (
            <p className="mt-2 text-[11px] text-amber-700">
              "Tentar de novo" abre a transação na empresa {EMPRESA_TOTVS}, onde o recebimento pela API funciona
              {v?.totvs_transacao_code ? `; a ${v.totvs_transacao_code} da ${EMPRESA} fica para cancelar no TOTVS` : ''}.
            </p>
          )}
          {anteriores.length > 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 ring-1 ring-amber-200">
              <p className="font-bold">Transações antigas para cancelar no TOTVS</p>
              <p className="mt-0.5 flex flex-wrap gap-1">
                {anteriores.map((t) => (
                  <span key={`${t.empresa}-${t.code}`} className="rounded bg-white px-1.5 py-0.5 font-mono ring-1 ring-amber-200">
                    {t.empresa ? `${t.empresa}/` : ''}
                    {t.code} · op {t.operacao}
                  </span>
                ))}
              </p>
            </div>
          )}
          {podeTentar && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
              <button onClick={() => onReprocessar(v.id, terminalNovo, faturaNova ?? undefined, operacaoNova)} disabled={reprocessando} className={`${btn} bg-amber-600 text-white disabled:opacity-50`}>
                {reprocessando ? <Spinner size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />} Tentar de novo
              </button>
              <span className="text-[11px] text-gray-500">terminal</span>
              <input
                type="number"
                min="1"
                value={terminalNovo}
                onChange={(e) => setTerminalNovo(e.target.value)}
                placeholder={String(v?.pedido_info?.terminal || 1)}
                className="mb-0 h-8 w-14 rounded-lg border border-gray-300 px-1.5 text-xs"
              />
              <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-gray-600">
                <input type="checkbox" checked={faturaNova ?? !!v?.pedido_info?.receberComoFatura} onChange={(e) => setFaturaNova(e.target.checked)} className="mb-0 !h-3.5 !w-3.5" />
                como fatura
              </label>
              <select
                value={operacaoNova}
                onChange={(e) => setOperacaoNova(e.target.value)}
                className="mb-0 h-8 rounded-lg border border-gray-300 px-1 text-[11px]"
                title="Trocar a operação abre uma NOVA transação no TOTVS; a anterior fica para cancelar"
              >
                <option value="">operação {v?.operacao_doc_interno || ''}</option>
                {OPERACOES_DOC_INTERNO.filter((o) => o.code !== Number(v?.operacao_doc_interno)).map((o) => (
                  <option key={o.code} value={o.code}>
                    trocar p/ {o.code}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Cartao>

        {/* ── Pagamento ── */}
        <Cartao titulo="Pagamento" icone={CreditCard} chip={<span className="text-sm font-bold tabular-nums text-[#000638]">{fmtBRL(v?.total ?? fat.total)}</span>}>
          {(v?.pagamentos || []).length === 0 ? (
            <p className="text-gray-400">Sem pagamento registrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {v.pagamentos.map((p, i) => (
                <li key={`${p.forma}-${i}`} className="flex items-baseline gap-2 py-1">
                  <span className="font-semibold text-gray-800">
                    {FORMAS[p.forma] || p.forma}
                    {p.parcelas > 1 ? ` ${p.parcelas}x` : ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-gray-500">{[p.nsu && `NSU ${p.nsu}`, p.autorizacao && `aut ${p.autorizacao}`].filter(Boolean).join(' · ')}</span>
                  <span className="font-semibold tabular-nums text-gray-800">{fmtBRL(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          {(v?.cobranca?.parcelas || []).length > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Boleto · vencimentos</p>
              <p className="flex flex-wrap gap-1">
                {v.cobranca.parcelas.map((x, i) => (
                  <span key={`${x.vencimento}-${i}`} className="rounded bg-gray-50 px-1.5 py-0.5 tabular-nums ring-1 ring-gray-200">
                    {fmtData(x.vencimento)} · {fmtBRL(x.valor)}
                  </span>
                ))}
              </p>
            </div>
          )}
          {(v?.comprovantes || []).length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 border-t border-gray-100 pt-2">
              {v.comprovantes.map((c, i) => (
                <a key={c.path || i} href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:underline">
                  comprovante {i + 1} <ArrowSquareOut size={10} />
                </a>
              ))}
            </p>
          )}
        </Cartao>

        {/* ── Duplicata e minuta ── */}
        {v && vendaTemBoleto && <BlocoDuplicata v={v} dup={d.duplicata} nota={nota} onAcao={acao} busy={acaoBusy} />}
        {v && <BlocoMinuta v={v} m={d.minuta} dup={d.duplicata} temCard={d.temCard} temBoleto={vendaTemBoleto} nota={nota} onAcao={acao} busy={acaoBusy} />}
        {v && credito && <BlocoCredito v={v} credito={credito} nota={nota} onAcao={acao} busy={acaoBusy} />}

        {/* ── Transporte e emissão ── */}
        <Cartao titulo="Transporte e emissão" icone={Truck}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Campo rotulo="Transportadora">{v?.transporte ? `${v.transporte.nome}${v.transporte.servico ? ` · ${v.transporte.servico}` : ''}` : 'retirada / sem transportadora'}</Campo>
            <Campo rotulo="Frete">{fmtBRL(v?.frete)}</Campo>
            <Campo rotulo="Volumes e peso">{v?.transporte ? `${v.transporte.volumes} vol · ${v.transporte.pesoB || 0} kg` : '—'}</Campo>
            <Campo rotulo="Emitido por">{fat.criado_por || '—'}</Campo>
            <Campo rotulo="Emitido em">{fmtDataHora(fat.criado_em)}</Campo>
            <Campo rotulo="Vendedor">{v?.vendedor_nome || '—'}</Campo>
          </div>
          {(v?.pedido_info?.dataVenda || (v?.pedido_info?.trocas || []).length > 0 || Number(v?.pedido_info?.descontoFaturamento?.pct) > 0 || fat.qtd_faltando > 0 || fat.qtd_sobrando > 0) && (
            <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-[11px]">
              {v?.pedido_info?.dataVenda && <p className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">Venda do dia {fmtData(v.pedido_info.dataVenda)}</p>}
              {(v?.pedido_info?.trocas || []).length > 0 && (
                <p className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-800">
                  <b>Troca no faturamento:</b> {v.pedido_info.trocas.map((t) => `${t.quantidade}x ${t.de} → ${t.para}`).join(' · ')}
                </p>
              )}
              {Number(v?.pedido_info?.descontoFaturamento?.pct) > 0 && (
                <p className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                  <b>Desconto de {String(v.pedido_info.descontoFaturamento.pct).replace('.', ',')}% no faturamento</b>
                  {v.pedido_info.descontoFaturamento.liberadoPor ? ` · liberado por ${v.pedido_info.descontoFaturamento.liberadoPor}` : ''}
                </p>
              )}
              {(fat.qtd_faltando > 0 || fat.qtd_sobrando > 0) && (
                <p className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                  Ficaram fora da nota: {fat.qtd_faltando} faltando · {fat.qtd_sobrando} sobrando
                </p>
              )}
            </div>
          )}
        </Cartao>

        {avisoAcao && <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-800 ring-1 ring-blue-200 lg:col-span-3">{avisoAcao}</p>}

        {/* ── Peças ── */}
        <Cartao titulo={`Peças da nota · ${totalPecas}`} icone={Package} className="lg:col-span-3" chip={<span className="text-[11px] text-gray-500">{d.kardex.length} etiqueta(s) RFID no kardex</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="pb-1 font-semibold">Peça</th>
                  <th className="pb-1 pl-2 font-semibold">SKU</th>
                  <th className="pb-1 pl-2 font-semibold">CFOP</th>
                  <th className="pb-1 pl-2 text-right font-semibold">Qtd</th>
                  <th className="pb-1 pl-2 text-right font-semibold">Unitário</th>
                  <th className="pb-1 pl-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itens.map((it) => {
                  const epcs = porProduto[it.product_code]?.epcs || [];
                  return (
                    <tr key={it.id} className="align-top">
                      <td className="py-1.5">
                        <p className="font-semibold text-gray-800">{it.nome}</p>
                        {epcs.length > 0 ? (
                          <details>
                            <summary className="cursor-pointer text-[10.5px] font-semibold text-purple-700">
                              {epcs.length} etiqueta{epcs.length === 1 ? '' : 's'} RFID
                            </summary>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {epcs.map((epc) => (
                                <span key={epc} className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] text-purple-700 ring-1 ring-purple-200">
                                  <Tag size={9} /> {epc}
                                </span>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <p className="text-[10.5px] text-gray-400">sem etiqueta (digitada)</p>
                        )}
                      </td>
                      <td className="py-1.5 pl-2 font-mono text-gray-600">{it.product_code}</td>
                      <td className="py-1.5 pl-2 text-gray-600">
                        {it.cfop || '—'}
                        <span className="block text-[10px] text-gray-400">{it.tipo_fiscal === 'adquirido' ? 'adquirido' : 'produção'}</span>
                      </td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{it.quantidade}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-gray-600">{fmtBRL(it.valor_unit)}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{fmtBRL(Number(it.quantidade || 0) * Number(it.valor_unit || 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-bold text-[#000638]">
                  <td className="pt-1.5" colSpan={3}>
                    Total das peças
                  </td>
                  <td className="pl-2 pt-1.5 text-right tabular-nums">{totalPecas}</td>
                  <td />
                  <td className="pl-2 pt-1.5 text-right tabular-nums">{fmtBRL(totalItens)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Cartao>
      </div>
    </div>
  );
}

function AbaTransacoes() {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hojeIso);
  const [filtro, setFiltro] = useState('todos'); // todos | ok | totvs | nf | cancelado
  const [aberto, setAberto] = useState(null);
  const [reprocessando, setReprocessando] = useState(false);
  const [aviso, setAviso] = useState('');
  const carregar = useCallback(async () => {
    setLista(null);
    try {
      const qs = new URLSearchParams({ de, ate, ...(busca.trim() ? { busca: busca.trim() } : {}) });
      const r = await fetch(`${API}/transacoes?${qs}`);
      const j = await r.json();
      setLista(j.success ? j.data : []);
    } catch {
      setLista([]);
    }
  }, [de, ate, busca]);
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate]);
  const reprocessar = async (vendaId, terminalNovo, faturaNova, operacaoNova) => {
    setReprocessando(true);
    setAviso('');
    try {
      const r = await fetch(`${API}/vendas/${vendaId}/reprocessar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(Number(terminalNovo) > 0 ? { terminal: Number(terminalNovo) } : {}),
          ...(typeof faturaNova === 'boolean' ? { comoFatura: faturaNova } : {}),
          ...(Number(operacaoNova) > 0 ? { operacaoDocInterno: Number(operacaoNova) } : {}),
        }),
      });
      const j = await r.json();
      setAviso(j.message || '');
      await carregar();
      setAberto(null);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setReprocessando(false);
    }
  };
  const linhas = useMemo(() => (lista || []).map((f) => ({ ...f, sit: situacaoFat(f.nota, f.venda) })), [lista]);
  const resumo = useMemo(() => {
    const r = { todos: { n: linhas.length, valor: 0 }, ok: { n: 0, valor: 0 }, totvs: { n: 0, valor: 0 }, nf: { n: 0, valor: 0 }, cancelado: { n: 0, valor: 0 } };
    for (const f of linhas) {
      r[f.sit].n += 1;
      r[f.sit].valor += Number(f.total) || 0;
      // o total do período só conta nota autorizada (faturado ou com o TOTVS pendente)
      if (f.sit === 'ok' || f.sit === 'totvs') r.todos.valor += Number(f.total) || 0;
    }
    return r;
  }, [linhas]);
  const visiveis = filtro === 'todos' ? linhas : linhas.filter((f) => f.sit === filtro);
  const quadros = [
    { k: 'todos', label: 'No período', num: 'text-[#000638]', sub: `${fmtBRL(resumo.todos.valor)} com nota autorizada` },
    { k: 'ok', label: SITUACOES.ok.plural, num: SITUACOES.ok.num, sub: fmtBRL(resumo.ok.valor) },
    { k: 'totvs', label: SITUACOES.totvs.plural, num: SITUACOES.totvs.num, sub: resumo.totvs.n ? `${fmtBRL(resumo.totvs.valor)} sem contas a receber` : 'nenhuma nota esperando' },
    { k: 'nf', label: SITUACOES.nf.plural, num: SITUACOES.nf.num, sub: resumo.nf.n ? 'rejeitada ou não emitida' : 'nenhuma' },
    { k: 'cancelado', label: SITUACOES.cancelado.plural, num: SITUACOES.cancelado.num, sub: resumo.cancelado.n ? fmtBRL(resumo.cancelado.valor) : 'nenhum' },
  ];
  return (
    <div className="space-y-2">
      {/* resumo, que também filtra */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        {quadros.map((q) => (
          <button
            key={q.k}
            onClick={() => setFiltro(q.k)}
            className={`rounded-xl bg-white p-3 text-left shadow-sm transition ${filtro === q.k ? 'ring-2 ring-[#000638]' : 'ring-1 ring-gray-200 hover:ring-gray-300'}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{q.label}</p>
            <p className={`text-2xl font-bold leading-tight tabular-nums ${q.num}`}>{lista === null ? '—' : resumo[q.k].n}</p>
            <p className="truncate text-[10.5px] text-gray-500">{lista === null ? ' ' : q.sub}</p>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 p-3">
          <div className="relative min-w-[200px] flex-1">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregar()} placeholder="Pedido, cliente, NF, transação, quem emitiu…" className={`${inputCls} pl-8`} />
          </div>
          <div>
            <label className={labelCls}>De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputCls} w-auto`} />
          </div>
          <div>
            <label className={labelCls}>Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputCls} w-auto`} />
          </div>
          <button onClick={carregar} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-3 text-xs font-semibold text-white hover:bg-[#000638]/90">
            <ArrowsClockwise size={13} className={lista === null ? 'animate-spin' : ''} /> Buscar
          </button>
        </div>
        {aviso && <p className="mx-3 mt-2 rounded-lg bg-blue-50 px-2 py-1.5 text-xs text-blue-800 ring-1 ring-blue-200">{aviso}</p>}
        {lista === null ? (
          <div className="py-10 text-center text-gray-400">
            <Spinner size={20} className="mx-auto animate-spin" />
          </div>
        ) : visiveis.length === 0 ? (
          <p className="py-10 text-center text-xs text-gray-400">{linhas.length === 0 ? 'Nenhum faturamento no período.' : 'Nenhum faturamento nesta situação.'}</p>
        ) : (
          <>
            <div className={`${GRADE_TRX} hidden border-b border-l-4 border-gray-100 border-l-transparent bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 lg:grid`}>
              <span />
              <span>Emissão</span>
              <span>Pedido</span>
              <span>Cliente</span>
              <span>NF-e</span>
              <span>TOTVS</span>
              <span>Duplicata · minuta</span>
              <span className="text-right">Peças</span>
              <span className="text-right">Valor</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {visiveis.map((f) => {
                const nf = f.nota;
                const v = f.venda;
                const st = v?.totvs_status;
                const S = SITUACOES[f.sit];
                const emp = empresaTotvsDe(v);
                const min = resumoMinuta(f.minuta);
                const totvsAberta = f.sit === 'cancelado' && !!v?.totvs_transacao_code && st !== 6;
                return (
                  <li key={f.id} className={`border-l-4 ${S.barra} ${aberto === f.id ? 'bg-slate-50/70' : ''}`}>
                    <button onClick={() => setAberto(aberto === f.id ? null : f.id)} className={`${GRADE_TRX} w-full px-3 py-2.5 text-left text-xs hover:bg-gray-50 ${f.sit === 'cancelado' ? 'text-gray-400' : ''}`}>
                      <span className="text-gray-400">{aberto === f.id ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}</span>
                      <span className="tabular-nums text-gray-500">{fmtDataHora(f.criado_em)}</span>
                      <span className="font-mono font-bold text-[#000638]">{f.numero_site || '—'}</span>
                      <span className="min-w-[160px] flex-1 lg:min-w-0">
                        <span className={`block truncate font-semibold ${f.sit === 'cancelado' ? 'text-gray-500' : 'text-gray-800'}`}>{f.cliente_nome || '—'}</span>
                        <span className="block truncate text-[10.5px] text-gray-400">
                          {[formasTexto(f.forma_pagamento), f.criado_por && `por ${f.criado_por}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span>
                        {nf ? (
                          <Chip cls={NF_STATUS[nf.status]}>
                            NF {nf.numero}
                            {nf.status !== 'autorizada' ? ` · ${nf.status}` : ''}
                          </Chip>
                        ) : (
                          <Chip cls={NF_STATUS.erro}>sem NF</Chip>
                        )}
                      </span>
                      <span>
                        {totvsAberta ? (
                          <Chip cls="bg-amber-50 text-amber-800 ring-amber-200">
                            <Warning size={11} weight="fill" /> cancelar {emp}/{v.totvs_transacao_code}
                          </Chip>
                        ) : st === 4 ? (
                          <Chip cls={TOTVS_STATUS[4].cls}>
                            <CheckCircle size={11} weight="fill" /> {emp}/{v.totvs_transacao_code}
                          </Chip>
                        ) : st === 6 ? (
                          <Chip cls="bg-gray-100 text-gray-500 ring-gray-200">cancelada</Chip>
                        ) : f.sit === 'cancelado' ? (
                          <span className="text-gray-300">—</span>
                        ) : v?.totvs_transacao_code ? (
                          <Chip cls="bg-amber-50 text-amber-800 ring-amber-200">
                            {emp}/{v.totvs_transacao_code} · aberta
                          </Chip>
                        ) : (
                          <Chip cls="bg-rose-50 text-rose-700 ring-rose-200">pendente</Chip>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {f.duplicata && DUP_STATUS[f.duplicata.status] && (
                          <Chip cls={DUP_STATUS[f.duplicata.status].cls}>{f.duplicata.status === 'assinada' ? 'dup. assinada' : f.duplicata.status === 'erro' ? 'dup. não enviada' : 'dup. enviada'}</Chip>
                        )}
                        {min && <Chip cls={min.cls}>{min.label}</Chip>}
                        {Number(v?.pedido_info?.creditoFalta?.valor) > 0 && (
                          <Chip cls={(CREDITO_STATUS[v.pedido_info.creditoFalta.status] || CREDITO_STATUS.pendente).cls}>crédito {fmtBRL(v.pedido_info.creditoFalta.valor)}</Chip>
                        )}
                      </span>
                      <span className="text-right tabular-nums text-gray-500">{f.qtd_conferida} pç</span>
                      <span className={`text-right font-bold tabular-nums ${f.sit === 'cancelado' ? 'text-gray-400 line-through' : 'text-[#000638]'}`}>{fmtBRL(f.total)}</span>
                    </button>
                    {aberto === f.id && <DetalheTransacao id={f.id} onReprocessar={reprocessar} reprocessando={reprocessando} />}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Crédito de peça em falta ───────────────────────────────────────────────
// peças do pedido que não apareceram na conferência e quanto o cliente pagou por elas
function pecasEmFalta(conf) {
  const pecas = conf.linhas
    .filter((l) => l.falta > 0)
    .map((l) => ({ productCode: l.sku, nome: l.descricao, quantidade: l.falta, valor: round2(l.valorTotal - l.valorConferido) }));
  return { pecas, valor: round2(pecas.reduce((t, x) => t + x.valor, 0)) };
}
const CREDITO_STATUS = {
  pendente: { label: 'saldo bônus a gerar', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  gerado: { label: 'saldo bônus gerado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  erro: { label: 'crédito incompleto', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
// formas que o cliente pagou de fato: só elas geram crédito de peça em falta
const FORMAS_QUE_GERAM_CREDITO = ['pix', 'credito', 'debito', 'dinheiro'];

function BlocoCredito({ v, credito, nota, onAcao, busy }) {
  const st = CREDITO_STATUS[credito.status] || CREDITO_STATUS.pendente;
  const feito = !!credito.chamado?.id && credito.status !== 'erro';
  const pronto = nota?.status === 'autorizada' && v?.totvs_status === 4 && v?.status !== 'cancelada';
  return (
    <div className="rounded-xl bg-white p-3 text-xs ring-1 ring-gray-200">
      <p className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Wallet size={14} className="text-[#000638]" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-[#000638]">Crédito de peça em falta</span>
        <Chip cls={st.cls}>{st.label}</Chip>
      </p>
      <p className="text-lg font-bold leading-tight tabular-nums text-[#000638]">
        {fmtBRL(credito.valor)}
        <span className="text-xs font-semibold text-gray-400"> · saldo bônus do cliente {v?.cliente_code}</span>
      </p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-gray-600">
        {(credito.pecas || []).map((x) => (
          <li key={x.productCode}>
            {x.quantidade}× <span className="font-mono">{x.productCode}</span> {x.nome} · {fmtBRL(x.valor)}
          </li>
        ))}
      </ul>
      {credito.chamado?.id && (
        <p className="mt-1.5 text-[11px] text-gray-700">
          Chamado no Dryland (Financeiro): <b>{credito.chamado.numero ? `#${credito.chamado.numero}` : `id ${credito.chamado.id}`}</b>
          {credito.chamado.abertoEm ? ` · aberto em ${fmtDataHora(credito.chamado.abertoEm)}` : ''}
        </p>
      )}
      {credito.bonus?.id && <p className="mt-1 text-[11px] text-emerald-700">Saldo bônus lançado para o cliente: pode ser usado como pagamento em outro faturamento.</p>}
      {credito.erro && <p className="mt-1 text-[11px] text-rose-600">{credito.erro}</p>}
      {!feito &&
        (pronto ? (
          <button
            onClick={() => onAcao(`${API}/vendas/${v.id}/credito-falta`, {})}
            disabled={busy}
            className="mt-1.5 inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {busy ? <Spinner size={13} className="animate-spin" /> : <Wallet size={13} />} Gerar o crédito e abrir o chamado
          </button>
        ) : (
          <p className="mt-1 text-[11px] text-amber-700">Sai sozinho quando a NF-e estiver autorizada e a transação do TOTVS atendida.</p>
        ))}
    </div>
  );
}

// ─── Senha de owner/admin/financeiro para desconto acima do limite ──────────
function SenhaDescontoModal({ pct, pedido, por, onLiberado, onCancelar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const liberar = async () => {
    if (!email.trim() || !senha || busy) return;
    setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`${API}/autorizar-desconto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), senha, pct, pedido, por }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Não autorizado');
      onLiberado({ ...j.data, pct });
    } catch (e) {
      setErro(e.message);
      setSenha('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <LockKey size={26} weight="fill" className="text-amber-500" />
          <h3 className="text-lg font-bold text-[#000638]">Liberar desconto</h3>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Desconto de <b>{pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</b> passa do limite de {LIMITE_DESCONTO_LIVRE}%. Um <b>owner</b>, <b>admin</b> ou alguém do{' '}
          <b>financeiro</b> precisa digitar o e-mail e a senha do HeadCoach.
        </p>
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail de quem autoriza"
            autoComplete="off"
            className="mb-0 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
          />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && liberar()}
            placeholder="Senha"
            autoComplete="new-password"
            className="mb-0 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
          />
        </div>
        {erro && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onCancelar} disabled={busy} className="h-10 rounded-lg text-sm font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={liberar} disabled={busy || !email.trim() || !senha} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#000638] text-sm font-bold text-white disabled:opacity-40">
            {busy ? <Spinner size={14} className="animate-spin" /> : <LockKey size={14} weight="bold" />} Liberar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
const FaturamentoPedido = ({ origem = 'pedidos' }) => {
  const brejinho = origem === 'brejinho';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const chave = params.get('chave') || '';
  const aba = params.get('aba') || 'faturar';

  const [toast, setToast] = useState(null);
  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Pedido
  const [pedido, setPedido] = useState(null); // { card, separacao, itens, faturamentos }
  const [prep, setPrep] = useState(null); // sugestões do /preparar
  const [carregando, setCarregando] = useState(false);
  const [erroPedido, setErroPedido] = useState('');

  // Cabeçalho
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState('');
  const [customer, setCustomer] = useState(null);
  const [consumidorFinal, setConsumidorFinal] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [previaErro, setPreviaErro] = useState('');
  const [operacao, setOperacao] = useState('');
  const [comoFatura, setComoFatura] = useState(() => {
    try {
      return localStorage.getItem('fat_como_fatura') === '1';
    } catch {
      return false;
    }
  });
  const [terminal, setTerminal] = useState(() => {
    try {
      return localStorage.getItem('fat_terminal') || '1';
    } catch {
      return '1';
    }
  });
  // Transação do TOTVS sempre na data de hoje (a API só recebe com caixa do
  // dia). Venda de outro dia: "transação com data diferente" → a data real vai
  // na observação da transação (VENDA DO DIA dd/mm/aaaa).
  const [dataDiferente, setDataDiferente] = useState(false);
  const [dataVenda, setDataVenda] = useState('');

  // Transporte e pagamento
  const [transp, setTransp] = useState({ id: 'RETIRADA', code: null, nome: null, servico: '', frete: 0, modFrete: 0, volumes: 0, pesoB: 0 });
  const [pagamentos, setPagamentos] = useState([]);
  const [vencimentos, setVencimentos] = useState([]);
  // Operadoras/parcelamentos de cartão do cadastro do TOTVS (como na FGRFM003)
  const [cartoes, setCartoes] = useState(null);
  useEffect(() => {
    fetch(`${API}/cartoes`)
      .then((r) => r.json())
      .then((j) => setCartoes(j.success ? j.data : { credito: [], debito: [], padrao: {} }))
      .catch(() => setCartoes({ credito: [], debito: [], padrao: {} }));
  }, []);
  // Cartão efetivo de um pagamento: o que o vendedor escolheu ou o padrão
  // (Pagar.me) com o parcelamento do pedido
  const cartaoDe = useCallback(
    (p) => {
      if (!cartoes || (p.forma !== 'credito' && p.forma !== 'debito')) return null;
      const grupos = cartoes[p.forma] || [];
      const grupo = grupos.find((g) => g.chave === p.cartaoChave) || grupos.find((g) => g.chave === cartoes.padrao?.[p.forma]) || null;
      if (!grupo) return { grupos, grupo: null, opcao: null };
      const n = p.forma === 'debito' ? 1 : Number(p.parcelas) || 1;
      const opcao = grupo.opcoes.find((o) => o.seq === p.cartaoSeq) || grupo.opcoes.find((o) => o.parcelas === n) || null;
      return { grupos, grupo, opcao };
    },
    [cartoes],
  );

  // Portal / leituras
  const [portalStatus, setPortalStatus] = useState({ status: 'desconectado' });
  const [portalBusy, setPortalBusy] = useState(false);
  const [potenciaOpen, setPotenciaOpen] = useState(false);
  const [lidos, setLidos] = useState({}); // sku → { sku, nome, epcs[], manual, precoTotvs }
  const [naoResolvidos, setNaoResolvidos] = useState([]);
  const processed = useRef(new Set());
  const [codigoManual, setCodigoManual] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  // Faturamento
  const [confirmaDuplicar, setConfirmaDuplicar] = useState(false);
  // peça em falta: o cliente ficou com o crédito (vira adiantamento + chamado no Dryland)
  const [gerarCredito, setGerarCredito] = useState(false);
  // etiquetas tiradas à mão, uma a uma: continuam "já vistas" para o portal não
  // devolver a peça na leitura seguinte (ele guarda as etiquetas até limpar)
  const [removidas, setRemovidas] = useState([]);
  const [posting, setPosting] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modalFat, setModalFat] = useState(false); // confirmação → andamento → resultado

  // Desconto dado na tela (Brejinho): % sobre as peças; acima do limite pede senha
  const [descPct, setDescPct] = useState('');
  // preço digitado pelo operador por produto (sku → valor); vazio = preço do pedido do Dryland
  const [precoManual, setPrecoManual] = useState({});
  const [editandoPreco, setEditandoPreco] = useState(null);
  const [descLiberado, setDescLiberado] = useState(null); // { nome, email, role, pct }
  const [senhaDescOpen, setSenhaDescOpen] = useState(false);
  // Trocas na conferência: { skuLidoForaDoPedido: skuDoPedidoQueFalta }
  const [trocas, setTrocas] = useState({});
  const trocaLiberada = hojeIso() <= TROCA_LIBERADA_ATE;
  // Saldos do cliente no TOTVS (CREDEV e adiantamento), por empresa
  const [saldos, setSaldos] = useState(null);
  // Faturamentos em andamento: salvos neste computador, por usuário (como na Devolução)
  const chaveRascunhos = `fat_andamento_${brejinho ? 'brj' : 'ped'}_${user?.id || user?.email || 'anon'}`;
  const [rascunhos, setRascunhos] = useState([]);
  const [rascunhosOpen, setRascunhosOpen] = useState(false);
  const rascunhoPendente = useRef(null);
  useEffect(() => {
    try {
      setRascunhos(JSON.parse(localStorage.getItem(chaveRascunhos)) || []);
    } catch {
      setRascunhos([]);
    }
  }, [chaveRascunhos]);
  const gravarRascunhos = useCallback(
    (fn) => {
      setRascunhos((atual) => {
        const lista = fn(atual);
        try {
          localStorage.setItem(chaveRascunhos, JSON.stringify(lista));
        } catch {
          /* storage cheio */
        }
        return lista;
      });
    },
    [chaveRascunhos],
  );
  const tirarRascunho = useCallback((k) => gravarRascunhos((l) => l.filter((d) => d.chave !== k)), [gravarRascunhos]);
  // devolve à tela o que estava salvo (leituras, pagamento, transporte, desconto…)
  const aplicarRascunho = useCallback((r) => {
    const e = r?.estado || {};
    setLidos(e.lidos || {});
    setNaoResolvidos(e.naoResolvidos || []);
    setRemovidas(e.removidas || []);
    processed.current = new Set([...Object.values(e.lidos || {}).flatMap((l) => l.epcs || []), ...(e.naoResolvidos || []), ...(e.removidas || [])]);
    if (e.customer) setCustomer(e.customer);
    if (e.seller) setSeller(e.seller);
    setConsumidorFinal(!!e.consumidorFinal);
    if (e.operacao) setOperacao(e.operacao);
    setDataDiferente(!!e.dataDiferente);
    setDataVenda(e.dataVenda || '');
    if (e.transp) setTransp(e.transp);
    if (Array.isArray(e.pagamentos) && e.pagamentos.length) setPagamentos(e.pagamentos);
    if (Array.isArray(e.vencimentos)) setVencimentos(e.vencimentos);
    setDescPct(e.descPct || '');
    setPrecoManual(e.precoManual || {});
    setDescLiberado(e.descLiberado || null);
    setTrocas(e.trocas || {});
    setGerarCredito(!!e.gerarCredito);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('fat_terminal', terminal);
      localStorage.setItem('fat_como_fatura', comoFatura ? '1' : '0');
    } catch {
      /* sem storage */
    }
  }, [terminal, comoFatura]);

  const limparLeituras = useCallback(() => {
    setLidos({});
    setNaoResolvidos([]);
    setRemovidas([]);
    processed.current = new Set();
    portalClear().catch(() => {});
  }, []);

  // ─── Carrega o pedido + sugestões ────────────────────────────────────────
  useEffect(() => {
    setPedido(null);
    setPrep(null);
    setErroPedido('');
    setResultado(null);
    setConfirmaDuplicar(false);
    setGerarCredito(false);
    setConsumidorFinal(false);
    setDataDiferente(false);
    setDataVenda('');
    setLidos({});
    setNaoResolvidos([]);
    setRemovidas([]);
    processed.current = new Set();
    setDescPct('');
    setPrecoManual({});
    setEditandoPreco(null);
    setDescLiberado(null);
    setTrocas({});
    // etiquetas que o portal ainda guarda são do pedido anterior: sem limpar,
    // elas entravam no pedido seguinte como "sobrando"
    portalClear().catch(() => {});
    if (!chave) return undefined;
    let vivo = true;
    setCarregando(true);
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE_URL}/api/pedidos-venda/${encodeURIComponent(chave)}`).then((r) => r.json()),
          fetch(`${API}/preparar/${encodeURIComponent(chave)}`).then((r) => r.json()),
        ]);
        if (!r1.success) throw new Error(r1.message || 'Pedido não encontrado');
        if (!r2.success) throw new Error(r2.message || 'Não consegui preparar o faturamento');
        if (!vivo) return;
        const d = r1.data;
        const p = r2.data;
        setPedido(d);
        setPrep(p);
        setCustomer(p.cliente?.code ? { code: p.cliente.code, name: p.cliente.nome || `Cliente ${p.cliente.code}` } : null);
        setSeller(p.vendedorCode ? String(p.vendedorCode) : '');
        setOperacao(String(p.operacaoDocInterno || ''));
        const tr = p.transportadoras.find((t) => t.id === p.transporte.id);
        setTransp({
          id: p.transporte.id,
          code: p.transporte.code,
          nome: tr && tr.code ? tr.label : null,
          servico: p.transporte.servico || '',
          frete: p.transporte.frete || 0,
          modFrete: p.transporte.modFrete,
          volumes: p.transporte.volumes,
          pesoB: p.transporte.pesoB || 0,
        });
        const formasPedido = p.pagamento.formas.length ? p.pagamento.formas : ['pix'];
        // CREDEV só quando o próprio card do Dryland informa o valor usado
        const credevCard = Number(String(p.pagamento.credev ?? '').replace(',', '.')) || 0;
        const formas = credevCard > 0 && !formasPedido.includes('credito_loja') ? [...formasPedido, 'credito_loja'] : formasPedido;
        setPagamentos(
          formas.map((f, i) => ({
            forma: f,
            valor: f === 'credito_loja' && credevCard > 0 && formas.length > 1 ? credevCard : 0,
            parcelas: f === 'boleto' || f === 'credito' ? p.pagamento.parcelas || 1 : 1,
            nsu: f === 'credito' || f === 'debito' ? p.pagamento.nsu || '' : '',
            autorizacao: f === 'credito' || f === 'debito' ? p.pagamento.autorizacao || '' : '',
            bandeira: f === 'credito' || f === 'debito' ? String(p.pagamento.bandeira || '').toLowerCase() : '',
            auto: i === 0,
          })),
        );
        setVencimentos(p.pagamento.vencimentos || []);
        // faturamento salvo "em andamento" deste pedido: devolve as leituras e o resto
        const salvo = rascunhoPendente.current;
        if (salvo && salvo.chave === chave) {
          rascunhoPendente.current = null;
          aplicarRascunho(salvo);
        }
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

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/totvs/pdv/sellers?branch=${EMPRESA}`)
      .then((r) => r.json())
      .then((j) => setSellers(j?.data?.items || []))
      .catch(() => setSellers([]));
  }, []);

  // Saldos do cliente no TOTVS: CREDEV e adiantamento, só da empresa 99
  useEffect(() => {
    setSaldos(null);
    if (!customer?.code) return undefined;
    let vivo = true;
    fetch(`${API_BASE_URL}/api/totvs/pdv/customer-balance?code=${customer.code}&branch=${EMPRESA}`)
      .then((r) => r.json())
      .then((j) => vivo && setSaldos(j?.success ? j.data : { erro: j?.message || 'não consegui consultar' }))
      .catch((e) => vivo && setSaldos({ erro: e.message }));
    return () => {
      vivo = false;
    };
  }, [customer?.code]);
  // Saldo bônus do cliente no HeadCoach (crédito de peça em falta de outro faturamento)
  const [bonus, setBonus] = useState(null);
  useEffect(() => {
    setBonus(null);
    if (!customer?.code) return undefined;
    let vivo = true;
    fetch(`${API}/saldo-bonus/${customer.code}`)
      .then((r) => r.json())
      .then((j) => vivo && setBonus(j?.success ? j.data : { erro: j?.message || 'não consegui consultar', total: 0 }))
      .catch((e) => vivo && setBonus({ erro: e.message, total: 0 }));
    return () => {
      vivo = false;
    };
  }, [customer?.code]);
  const saldoInfo = useCallback(
    (forma) => {
      const campo = CAMPO_SALDO[forma];
      if (!campo || !saldos || saldos.erro) return null;
      // saldos.credev / saldos.adiantamento já são os da empresa consultada (99)
      return { total: Math.max(0, round2(Number(saldos[campo]) || 0)) };
    },
    [saldos],
  );

  const itensPedido = useMemo(() => (pedido ? itensDoPedido(pedido) : []), [pedido]);
  const difCard = useMemo(() => (pedido ? diferencaCardSeparacao(pedido) : null), [pedido]);
  const descontos = useMemo(() => (pedido ? resumoDescontos(pedido, itensPedido) : []), [pedido, itensPedido]);
  const skusPedido = useMemo(() => new Set(itensPedido.map((i) => i.sku)), [itensPedido]);

  // ─── Prévia fiscal (cenário + CFOP por peça) ─────────────────────────────
  useEffect(() => {
    setPrevia(null);
    setPreviaErro('');
    if (!customer?.code || !itensPedido.length) return undefined;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/previa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clienteCode: customer.code, consumidorFinal, itens: itensPedido.map((i) => ({ productCode: Number(i.sku), referencia: i.descricao })) }),
        });
        const j = await r.json();
        if (!vivo) return;
        if (!j.success) throw new Error(j.message);
        setPrevia(j.data);
      } catch (e) {
        if (vivo) setPreviaErro(e.message);
      }
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [customer, consumidorFinal, itensPedido]);
  const cfopPor = useMemo(() => new Map((previa?.itens || []).map((i) => [String(i.productCode), i])), [previa]);

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
        processed.current.delete(epc);
      }
    },
    [consultarProduto, somar],
  );
  useEffect(() => {
    if (!chave || aba !== 'faturar') return undefined;
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
  }, [chave, aba, resolverEpc]);
  const adicionarManual = useCallback(async () => {
    const code = codigoManual.trim();
    if (!code || manualBusy) return;
    setManualBusy(true);
    setCodigoManual('');
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
    setRemovidas((l) => (l.includes(epc) ? l : [...l, epc]));
    setLidos((prev) => {
      const cur = prev[sku];
      if (!cur) return prev;
      const novo = { ...cur, epcs: cur.epcs.filter((e) => e !== epc) };
      const next = { ...prev, [sku]: novo };
      if (novo.epcs.length + novo.manual <= 0) delete next[sku];
      return next;
    });
  }, []);
  // tira UMA peça da linha: primeiro uma digitada; senão, a última etiqueta lida
  const removerPeca = (sku) => {
    const cur = lidos[sku];
    if (!cur) return;
    if (cur.manual > 0) {
      setLidos((prev) => {
        const c = prev[sku];
        if (!c || c.manual <= 0) return prev;
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
  // tira todas as peças de um produto, sem mexer nos outros
  const removerTodasDaPeca = (sku) => {
    const cur = lidos[sku];
    if (!cur) return;
    setRemovidas((l) => [...new Set([...l, ...cur.epcs])]);
    setLidos((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
  };
  // desfaz: o portal volta a ler as etiquetas que foram tiradas à mão
  const devolverRemovidas = () => {
    for (const epc of removidas) processed.current.delete(epc);
    setRemovidas([]);
  };
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

  // desconto dado na tela (só Brejinho), em % sobre o valor de cada peça
  const pctDesc = Math.min(100, Math.max(0, round2(Number(String(descPct).replace(',', '.')) || 0)));

  // ─── Conferência: SKU do pedido × SKU lido ───────────────────────────────
  const conf = useMemo(() => {
    // 1ª passada: quanto foi lido de cada SKU do pedido
    const base = itensPedido.map((i) => {
      const l = lidos[i.sku];
      const lido = l ? l.epcs.length + l.manual : 0;
      return { i, l, lido, proprio: Math.min(lido, i.qtd) };
    });
    // trocas (só no dia liberado): a peça lida que NÃO está no pedido entra no
    // lugar de uma que falta, pelo valor (e desconto) da que estava no pedido
    const subs = new Map(); // sku do pedido → [{ sku, nome, epc }]
    const usado = new Map(); // sku lido → quantas unidades entraram por troca
    if (trocaLiberada) {
      for (const [para, de] of Object.entries(trocas)) {
        const lp = lidos[para];
        const b = base.find((x) => x.i.sku === de);
        if (!lp || !b || skusPedido.has(para)) continue;
        const vagas = b.i.qtd - b.proprio - (subs.get(de)?.length || 0);
        const pecas = [...lp.epcs.map((epc) => ({ sku: para, nome: lp.nome, epc })), ...Array.from({ length: lp.manual }, () => ({ sku: para, nome: lp.nome, epc: null }))].slice(0, Math.max(0, vagas));
        if (!pecas.length) continue;
        subs.set(de, [...(subs.get(de) || []), ...pecas]);
        usado.set(para, pecas.length);
      }
    }
    const linhas = base.map(({ i, l, lido, proprio }) => {
      const substitutos = subs.get(i.sku) || [];
      const conferido = proprio + substitutos.length;
      // PREÇO = o do pedido do Dryland, sempre. Só muda se o OPERADOR digitar outro
      // na linha (aí vale o que ele digitou, sem o desconto do pedido por cima).
      // Unidade que veio sem preço no pedido usa o do TOTVS.
      const pmTxt = precoManual[i.sku];
      const pm = pmTxt != null && pmTxt !== '' ? round2(Number(String(pmTxt).replace(',', '.')) || 0) : 0;
      const unidades = i.unidades.map((u) => {
        const preco = pm > 0 ? pm : u.preco > 0 ? u.preco : round2(l?.precoTotvs || 0);
        const descPedido = pm > 0 ? 0 : u.desc;
        // desconto do operador neste faturamento, por cima do que o pedido já trouxe
        const extra = pctDesc > 0 ? round2(((preco - descPedido) * pctDesc) / 100) : 0;
        return { ...u, preco, precoPedido: u.preco, alterado: pm > 0 && pm !== u.preco, desc: round2(descPedido + extra), descExtra: extra };
      });
      const precos = unidades.map((u) => u.preco);
      const preco = round2(precos.reduce((s, v) => s + v, 0) / precos.length);
      const confU = unidades.slice(0, conferido);
      const brutoConferido = round2(confU.reduce((s, u) => s + u.preco, 0));
      const descConferido = round2(confU.reduce((s, u) => s + u.desc, 0));
      const valorConferido = round2(brutoConferido - descConferido);
      const valorTotal = round2(unidades.reduce((s, u) => s + u.preco - u.desc, 0));
      return {
        ...i,
        descExtraConferido: round2(confU.reduce((s, u) => s + (u.descExtra || 0), 0)),
        unidades,
        precos,
        preco,
        brutoConferido,
        descConferido,
        valorConferido,
        valorTotal,
        lido,
        proprio,
        substitutos,
        conferido,
        falta: i.qtd - conferido,
        sobra: Math.max(0, lido - i.qtd),
        epcs: l?.epcs || [],
        manual: l?.manual || 0,
      };
    });
    // lidas fora do pedido: "lido" é o que ainda sobra depois das trocas
    const fora = Object.values(lidos)
      .filter((l) => !skusPedido.has(l.sku))
      .map((l) => {
        const total = l.epcs.length + l.manual;
        const u = usado.get(l.sku) || 0;
        return { ...l, total, usado: u, lido: total - u, trocaPor: trocaLiberada ? trocas[l.sku] || null : null };
      });
    const esperado = linhas.reduce((s, l) => s + l.qtd, 0);
    const conferidas = linhas.reduce((s, l) => s + l.conferido, 0);
    const faltando = esperado - conferidas;
    const sobrando = linhas.reduce((s, l) => s + l.sobra, 0) + fora.reduce((s, l) => s + l.lido, 0);
    const totalPedido = round2(linhas.reduce((s, l) => s + l.valorTotal, 0));
    const brutoConferido = round2(linhas.reduce((s, l) => s + l.brutoConferido, 0));
    const descConferido = round2(linhas.reduce((s, l) => s + l.descConferido, 0));
    const totalConferido = round2(brutoConferido - descConferido);
    const descExtraConferido = round2(linhas.reduce((s, l) => s + l.descExtraConferido, 0));
    return { linhas, fora, esperado, conferidas, faltando, sobrando, totalPedido, brutoConferido, descConferido, descExtraConferido, totalConferido, ok: esperado > 0 && faltando === 0 && sobrando === 0 };
  }, [itensPedido, lidos, skusPedido, pctDesc, trocas, trocaLiberada, precoManual]);
  // resumo das trocas feitas (para o servidor e para a confirmação)
  const trocasFeitas = conf.linhas.flatMap((l) => {
    const por = new Map();
    for (const sb of l.substitutos) por.set(sb.sku, { de: l.sku, deNome: l.descricao, para: sb.sku, paraNome: sb.nome, quantidade: (por.get(sb.sku)?.quantidade || 0) + 1 });
    return [...por.values()];
  });

  // ─── Totais e pagamento ──────────────────────────────────────────────────
  const temTransportadora = transp.id !== 'RETIRADA' && !!transp.code;
  const frete = temTransportadora ? round2(transp.frete) : 0;
  const totalNota = round2(conf.totalConferido + frete);
  // forma "automática" (a primeira) acompanha o total: total − as outras formas
  useEffect(() => {
    setPagamentos((ps) => {
      if (!ps.length) return ps;
      const outras = round2(ps.filter((p) => !p.auto).reduce((s, p) => s + Number(p.valor || 0), 0));
      const alvo = round2(Math.max(0, totalNota - outras));
      return ps.map((p) => (p.auto && p.valor !== alvo ? { ...p, valor: alvo } : p));
    });
  }, [totalNota, pagamentos.map((p) => (p.auto ? '' : p.valor)).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const somaPag = round2(pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0));
  const pBoleto = pagamentos.find((p) => p.forma === 'boleto');
  const parcelasBoleto = pBoleto ? parcelasIguais(Number(pBoleto.valor || 0), pBoleto.parcelas) : [];
  const setPag = (i, patch) => setPagamentos((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  // Peça em falta com o cliente ficando com o crédito: a peça já fica fora da nota
  // (só o conferido entra); o valor dela vira crédito de adiantamento
  const falta = pecasEmFalta(conf);
  const creditoPossivel = conf.conferidas > 0 && conf.faltando > 0 && falta.valor > 0;
  const creditoAtivo = gerarCredito && creditoPossivel;

  // ─── Validação ───────────────────────────────────────────────────────────
  const card = pedido?.card || null;
  const ref =
    prep?.ref ||
    card?.numero_site ||
    pedido?.separacao?.ref ||
    (chave.startsWith('SEP:') ? chave.slice(4) : null) ||
    (card?.dados?.brejinho ? `BRJ ${card.dados.brejinho.pedido_showroom || card.dados.brejinho.id}` : null);
  const fatsVivos = (pedido?.faturamentos || []).filter((f) => f.venda_id && f.nf_status === 'autorizada');
  // Pedido FATURADO (nota autorizada; ou nota cancelada com a transação do TOTVS ainda
  // aberta): não fatura de novo. O servidor repete a conferência na hora de faturar.
  const bloqueio = resultado
    ? null
    : prep?.bloqueio ||
      (fatsVivos[0]
        ? {
            motivo: 'faturado',
            texto: `Pedido já FATURADO: NF-e ${fatsVivos[0].nf_numero}/${fatsVivos[0].nf_serie}. Para faturar de novo é preciso cancelar a NF-e e a transação do TOTVS.`,
          }
        : null);
  const jaNoTotvs = prep?.jaNoTotvs || [];
  const precisaConfirmar = !bloqueio && jaNoTotvs.length > 0;
  const semPreco = conf.linhas.some((l) => l.conferido > 0 && l.unidades.slice(0, l.conferido).some((u) => !(u.preco > 0)));
  const pendencias = [];
  if (bloqueio) pendencias.push(bloqueio.texto);
  if (creditoAtivo && pagamentos.some((p) => p.forma === 'boleto'))
    pendencias.push('Crédito de peça em falta só vale para pedido já pago: com boleto, basta faturar o valor das peças que existem.');
  else if (creditoAtivo && !pagamentos.some((p) => FORMAS_QUE_GERAM_CREDITO.includes(p.forma) && Number(p.valor) > 0))
    pendencias.push('Crédito de peça em falta só vale quando o pedido foi pago em Pix, cartão ou dinheiro.');
  if (!customer) pendencias.push('Escolha o cliente.');
  if (previa && !previa.cliente.temEndereco) pendencias.push('Cliente sem endereço completo no TOTVS (a NF-e exige).');
  if (previa && !previa.difalOk) pendencias.push(`DIFAL de ${previa.cenario.destUf} ainda não conferido — fature esta pelo TOTVS ou marque se o cliente tem IE.`);
  if (previaErro) pendencias.push(previaErro);
  if (!seller) pendencias.push('Escolha o vendedor.');
  if (!operacao) pendencias.push('Escolha a operação do documento interno.');
  if (dataDiferente && !/^\d{4}-\d{2}-\d{2}$/.test(dataVenda)) pendencias.push('Informe a data da venda (transação com data diferente).');
  if (dataDiferente && dataVenda > hojeIso()) pendencias.push('A data da venda não pode ser depois de hoje.');
  if (conf.conferidas === 0) pendencias.push('Ligue o portal e passe as peças do pedido.');
  if (semPreco) pendencias.push('Há peça conferida sem preço.');
  if (transp.id !== 'RETIRADA' && !transp.code) pendencias.push('Escolha a transportadora (em "Outro", pesquise pelo nome ou código).');
  if (!pagamentos.length) pendencias.push('Informe o pagamento.');
  if (!comoFatura && pagamentos.some((p) => (p.forma === 'credito' || p.forma === 'debito') && !cartaoDe(p)?.opcao))
    pendencias.push('Escolha a operadora e o parcelamento do cartão (cadastro do TOTVS).');
  if (Math.abs(somaPag - totalNota) > 0.01) pendencias.push(`Pagamento (${fmtBRL(somaPag)}) não fecha com o total da nota (${fmtBRL(totalNota)}).`);
  // desconto acima do limite: quem é owner/admin/financeiro passa direto; os demais pedem a senha
  const descSemLimite = ROLES_LIBERAM_DESCONTO.includes(user?.role);
  const descPrecisaSenha = brejinho && pctDesc > LIMITE_DESCONTO_LIVRE && !descSemLimite && !(descLiberado && Number(descLiberado.pct) >= pctDesc);
  if (!brejinho && pctDesc > LIMITE_DESCONTO_PEDIDOS) pendencias.push(`O desconto do operador é de no máximo ${LIMITE_DESCONTO_PEDIDOS}%.`);
  if (descPrecisaSenha) pendencias.push(`Desconto de ${pctDesc.toLocaleString('pt-BR')}% passa de ${LIMITE_DESCONTO_LIVRE}%: precisa da senha de owner, admin ou financeiro.`);
  if (pctDesc >= 100) pendencias.push('O desconto não pode ser de 100%.');
  // CREDEV / adiantamento: não pode usar mais do que o cliente tem no TOTVS
  const usoSaldo = (forma) => round2(pagamentos.filter((p) => p.forma === forma).reduce((t, p) => t + Number(p.valor || 0), 0));
  for (const forma of Object.keys(CAMPO_SALDO)) {
    const uso = usoSaldo(forma);
    if (!(uso > 0)) continue;
    if (!saldos) pendencias.push(`Aguarde a consulta do saldo de ${FORMAS[forma]} do cliente no TOTVS.`);
    else if (saldos.erro) pendencias.push(`Não consegui consultar o saldo de ${FORMAS[forma]} no TOTVS (${saldos.erro}).`);
    else if (uso > (saldoInfo(forma)?.total || 0) + 0.005)
      pendencias.push(`${FORMAS[forma]} usado (${fmtBRL(uso)}) é maior que o saldo do cliente na empresa ${EMPRESA} (${fmtBRL(saldoInfo(forma)?.total || 0)}).`);
  }
  // saldo bônus: não pode usar mais do que o cliente tem no HeadCoach
  const usoBonus = usoSaldo('saldo_bonus');
  if (usoBonus > 0) {
    if (!bonus) pendencias.push('Aguarde a consulta do saldo bônus do cliente.');
    else if (bonus.erro) pendencias.push(`Não consegui consultar o saldo bônus do cliente (${bonus.erro}).`);
    else if (usoBonus > (bonus.total || 0) + 0.005) pendencias.push(`Saldo bônus usado (${fmtBRL(usoBonus)}) é maior que o saldo do cliente (${fmtBRL(bonus.total || 0)}).`);
  }
  if (pBoleto && parcelasBoleto.some((_, i) => !/^\d{4}-\d{2}-\d{2}$/.test(vencimentos[i] || ''))) pendencias.push('Informe o vencimento de cada parcela do boleto.');
  if (precisaConfirmar && !confirmaDuplicar) pendencias.push('Confirme o aviso de lançamento já existente.');
  const podeFaturar = !posting && !resultado && pendencias.length === 0;

  // ─── Faturamento em andamento: salvar e retomar depois ───────────────────
  const salvarRascunho = () => {
    if (!chave || !pedido) return;
    const registro = {
      chave,
      em: Date.now(),
      ref: ref || null,
      cliente: customer?.name || card?.dados?.nome_cliente || pedido.separacao?.cliente || null,
      lidas: conf.conferidas + conf.sobrando,
      esperado: conf.esperado,
      estado: { lidos, naoResolvidos, customer, seller, consumidorFinal, operacao, dataDiferente, dataVenda, transp, pagamentos, vencimentos, descPct, descLiberado, trocas, gerarCredito, removidas, precoManual },
    };
    gravarRascunhos((l) => [registro, ...l.filter((d) => d.chave !== chave)].slice(0, 30));
    showToast('ok', 'Faturamento salvo — está em "Em andamento" para continuar depois');
  };
  const abrirRascunho = (d) => {
    setRascunhosOpen(false);
    if (d.chave === chave && pedido) {
      aplicarRascunho(d);
      showToast('ok', 'Faturamento retomado');
      return;
    }
    rascunhoPendente.current = d;
    setParams({ chave: d.chave });
  };
  const rascunhoAtual = rascunhos.find((d) => d.chave === chave) || null;

  // ─── FATURAR ─────────────────────────────────────────────────────────────
  const faturar = useCallback(async () => {
    if (!podeFaturar) return;
    setPosting(true);
    try {
      const vend = sellers.find((s) => String(s.code) === String(seller));
      const body = {
        chave,
        numeroSite: ref,
        canal: prep?.canal,
        clienteCode: customer.code,
        vendedorCode: Number(seller),
        vendedorNome: vend?.name || null,
        operacaoDocInterno: Number(operacao),
        consumidorFinal,
        dataVenda: dataDiferente && dataVenda ? dataVenda : null,
        terminal: Number(terminal) || 1,
        receberComoFatura: comoFatura,
        descontoFaturamento:
          pctDesc > 0
            ? { pct: pctDesc, liberadoPor: brejinho && pctDesc > LIMITE_DESCONTO_LIVRE ? descLiberado?.nome || (descSemLimite ? user?.name || user?.email : null) : null }
            : null,
        // cada unidade conferida vai com o valor da unidade do pedido; quando houve
        // troca, o produto (e a etiqueta) é o da peça que realmente está na caixa
        itens: conf.linhas
          .filter((l) => l.conferido > 0)
          .flatMap((l) => {
            const grupos = [];
            l.unidades.slice(0, l.conferido).forEach((u, idx) => {
              const sb = idx >= l.proprio ? l.substitutos[idx - l.proprio] : null;
              const productCode = Number(sb ? sb.sku : l.sku);
              const epc = sb ? sb.epc : l.epcs[idx] || null;
              let g = grupos.find((x) => x.productCode === productCode && x.valorUnit === u.preco && x.descontoUnit === u.desc);
              if (!g) {
                g = { productCode, quantidade: 0, valorUnit: u.preco, descontoUnit: u.desc, nome: sb ? sb.nome : l.descricao, epcs: [], ...(sb ? { trocaDe: Number(l.sku) } : {}) };
                grupos.push(g);
              }
              g.quantidade += 1;
              if (epc) g.epcs.push(epc);
            });
            return grupos;
          }),
        trocas: trocasFeitas,
        transporte: temTransportadora
          ? { code: transp.code, servico: transp.servico || null, frete, modFrete: Number(transp.modFrete), volumes: Number(transp.volumes) || 1, pesoB: Number(transp.pesoB) || 0 }
          : { code: null, frete: 0 },
        pagamentos: pagamentos.map((p) => {
          const c = cartaoDe(p);
          return {
            forma: p.forma,
            valor: round2(p.valor),
            parcelas: c?.opcao ? c.opcao.parcelas : Number(p.parcelas) || 1,
            nsu: p.nsu || null,
            autorizacao: p.autorizacao || null,
            bandeira: p.bandeira || null,
            cartao: c?.opcao
              ? { seq: c.opcao.seq, descricao: c.opcao.descricao, parcelas: c.opcao.parcelas, portador: c.grupo.portador, operadora: c.grupo.operadora, bandeira: c.grupo.bandeira }
              : null,
          };
        }),
        vencimentos: pBoleto ? parcelasBoleto.map((_, i) => vencimentos[i]) : [],
        comprovantes: prep?.comprovantes || [],
        pedidoInfo: {
          forma: prep?.pagamento?.formaTexto,
          nsu: prep?.pagamento?.nsu,
          autorizacao: prep?.pagamento?.autorizacao,
          pix: prep?.pagamento?.pix || null,
          // preço mudado pelo operador (o padrão é sempre o do pedido do Dryland)
          ...(conf.linhas.some((l) => l.unidades.some((u) => u.alterado))
            ? {
                precosAlterados: conf.linhas
                  .filter((l) => l.unidades.some((u) => u.alterado))
                  .map((l) => ({ sku: l.sku, de: l.unidades[0].precoPedido, para: l.unidades[0].preco, por: user?.name || user?.email || null })),
              }
            : {}),
        },
        qtdPedido: conf.esperado,
        faltando: conf.linhas.filter((l) => l.falta > 0).map((l) => ({ productCode: l.sku, name: l.descricao, quantidade: l.falta })),
        // peça em falta com o cliente ficando com o crédito
        creditoFalta: (() => {
          const f = pecasEmFalta(conf);
          return gerarCredito && conf.conferidas > 0 && conf.faltando > 0 && f.valor > 0 ? { valor: f.valor, pecas: f.pecas } : null;
        })(),
        sobrando: [
          ...conf.linhas.filter((l) => l.sobra > 0).map((l) => ({ productCode: l.sku, name: l.descricao, quantidade: l.sobra, epcs: l.epcs.slice(l.qtd) })),
          ...conf.fora.filter((l) => l.lido > 0).map((l) => ({ productCode: l.sku, name: l.nome, quantidade: l.lido, epcs: l.epcs.slice(Math.min(l.epcs.length, l.usado)) })),
        ],
        por: user?.name || user?.email || null,
      };
      const r = await fetch(`${API}/faturar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.success) {
        beep(false);
        showToast('erro', j.message || 'Falha ao faturar');
        return;
      }
      setResultado(j.data);
      if (j.data.fiscal?.ok) tirarRascunho(chave); // virou nota: sai da lista "em andamento"
      beep(j.data.fiscal?.ok && j.data.totvs?.ok);
      showToast(j.data.fiscal?.ok && j.data.totvs?.ok ? 'ok' : 'erro', j.message);
    } catch (e) {
      showToast('erro', `Falha ao faturar: ${e.message}`);
    } finally {
      setPosting(false);
    }
  }, [gerarCredito, podeFaturar, prep, customer, conf, frete, operacao, dataDiferente, dataVenda, terminal, comoFatura, sellers, seller, chave, ref, consumidorFinal, temTransportadora, transp, pagamentos, cartaoDe, pBoleto, parcelasBoleto, vencimentos, user, showToast, pctDesc, descLiberado, descSemLimite, tirarRascunho, trocasFeitas]);

  const reprocessar = useCallback(async () => {
    if (!resultado?.vendaId) return;
    setPosting(true);
    try {
      const r = await fetch(`${API}/vendas/${resultado.vendaId}/reprocessar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminal: Number(terminal) || 1, comoFatura }),
      });
      const j = await r.json();
      if (j.success) setResultado(j.data);
      showToast(j.data?.fiscal?.ok && j.data?.totvs?.ok ? 'ok' : 'erro', j.message);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setPosting(false);
    }
  }, [resultado, terminal, comoFatura, showToast]);

  const escolherPedido = (k) => setParams(k ? { chave: k } : {});
  const irAba = (a) => setParams(a === 'transacoes' ? { aba: 'transacoes' } : chave ? { chave } : {});

  // ─── Render ──────────────────────────────────────────────────────────────
  const cen = previa ? CENARIOS[previa.cenario.chave] : null;
  const notaRes = resultado?.nota;
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <PageTitle
          title={brejinho ? 'Faturamento — Brejinho' : 'Faturamento'}
          subtitle="NF-e emitida pelo HeadCoach (empresa 99) + documento interno e contas a receber no TOTVS (empresa 990)"
          icon={Receipt}
        />

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(brejinho ? '/expedicao/brejinho/pedidos' : '/expedicao/pedidos-venda')}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
          >
            <ArrowLeft size={13} /> {brejinho ? 'Pedidos Brejinho' : 'Pedido de Venda'}
          </button>
          <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-gray-200">
            {[
              { id: 'faturar', label: 'Faturar', icon: Receipt },
              { id: 'transacoes', label: 'Transações', icon: ListBullets },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => irAba(t.id)}
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-bold ${aba === t.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'}`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>
          {chave && aba === 'faturar' && (
            <button onClick={() => escolherPedido('')} className="h-8 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">
              Escolher outro pedido
            </button>
          )}
        </div>

        {aba === 'faturar' && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRascunhosOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
              >
                <ClockCounterClockwise size={14} /> Em andamento ({rascunhos.length})
              </button>
              {chave && pedido && !resultado && (
                <button
                  onClick={salvarRascunho}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  <FloppyDisk size={14} /> Salvar para continuar depois
                </button>
              )}
              {rascunhoAtual && !resultado && <span className="text-[11px] text-gray-500">Este pedido tem um faturamento salvo em {fmtDataHora(rascunhoAtual.em)}</span>}
            </div>
            {rascunhosOpen && (
              <div className="mb-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                {rascunhos.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum faturamento salvo. Abra um pedido, leia as peças e use “Salvar para continuar depois”.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {rascunhos.map((d) => (
                      <li key={d.chave} className="flex items-center gap-2 py-1.5 text-xs">
                        <span className="w-24 shrink-0 text-gray-400">{fmtDataHora(d.em)}</span>
                        <span className="w-20 shrink-0 font-mono font-bold text-[#000638]">{d.ref || '—'}</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{d.cliente || 'Sem cliente'}</span>
                        <span className="shrink-0 tabular-nums text-gray-500">
                          {d.lidas || 0} de {d.esperado || 0} pç lidas
                        </span>
                        <button onClick={() => abrirRascunho(d)} className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                          abrir
                        </button>
                        <button onClick={() => tirarRascunho(d.chave)} className="text-gray-300 hover:text-rose-500" title="Apagar">
                          <Trash size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-[10.5px] text-gray-400">Fica salvo neste computador, no seu usuário. Sai da lista sozinho quando a nota é emitida.</p>
              </div>
            )}
          </>
        )}

        {aba === 'transacoes' ? (
          <AbaTransacoes />
        ) : !chave ? (
          <ListaSeparados onEscolher={escolherPedido} origem={origem} />
        ) : carregando ? (
          <div className="py-16 text-center text-gray-400">
            <Spinner size={22} className="mx-auto animate-spin" />
          </div>
        ) : erroPedido ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erroPedido}</p>
        ) : pedido && prep ? (
          <>
            {/* Pedido */}
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-[#000638] shadow-sm">
              <span className="font-mono text-sm font-bold">{ref || '—'}</span>
              <span className="font-semibold">{card?.dados?.nome_cliente || pedido.separacao?.cliente || card?.titulo}</span>
              <span className="text-gray-500">{CANAIS[prep.canal] || prep.canal}</span>
              <span className="text-gray-500">{prep.pagamento.formaTexto || ''}</span>
              <span>
                <b>{conf.esperado}</b> peça(s) · <b>{fmtBRL(conf.totalPedido)}</b>
              </span>
              {card?.status && <Chip>{card.status}</Chip>}
              <span className="flex-1" />
              {prep.numeracao?.serie != null && (
                <Chip cls={Number(prep.numeracao.ambiente) === 1 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                  NF-e série {prep.numeracao.serie} · {Number(prep.numeracao.ambiente) === 1 ? 'PRODUÇÃO' : 'homologação'}
                </Chip>
              )}
            </div>

            {bloqueio && (
              <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-800 ring-1 ring-rose-300">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-600 text-white">
                  <LockKey size={18} weight="bold" />
                </span>
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-bold">{bloqueio.motivo === 'transacao_aberta' ? 'TRANSAÇÃO DO TOTVS AINDA ABERTA' : 'PEDIDO FATURADO'}</p>
                  <p>{bloqueio.texto}</p>
                </div>
                <button onClick={() => irAba('transacoes')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100">
                  <ListBullets size={13} /> Ver em Transações
                </button>
              </div>
            )}

            {precisaConfirmar && !resultado && (
              <div className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-300">
                <p className="inline-flex items-center gap-1 font-semibold">
                  <Warning size={14} weight="bold" /> Atenção: este pedido já tem lançamento
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {jaNoTotvs.length > 0 && <li>O Dryland já abriu no TOTVS: {jaNoTotvs.join(', ')} — confira para não faturar duas vezes.</li>}
                </ul>
                <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={confirmaDuplicar} onChange={(e) => setConfirmaDuplicar(e.target.checked)} className="mb-0 !h-4 !w-4 shrink-0 accent-amber-600" />
                  Conferi e quero faturar mesmo assim
                </label>
              </div>
            )}

            <div className="grid items-start gap-2 lg:grid-cols-[1fr_330px]">
              {/* ── Coluna esquerda ── */}
              <div className="space-y-2">
                {/* Cliente / fiscal */}
                <Bloco titulo="Cliente e fiscal" icone={FileText}>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className={labelCls}>Empresa</label>
                      <div className="flex h-9 items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 text-sm font-semibold text-[#000638] ring-1 ring-gray-200">
                        <Buildings size={15} className="text-gray-400" /> {EMPRESA} · {prep.emitente.uf}
                      </div>
                    </div>
                    <ClientePicker
                      value={customer}
                      onSelect={(c) => {
                        setCustomer(c);
                        setConsumidorFinal(false);
                      }}
                    />
                    <div>
                      <label className={labelCls}>Vendedor</label>
                      <div className="relative">
                        <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select value={seller} onChange={(e) => setSeller(e.target.value)} className={`${inputCls} pl-8 ${seller ? '' : 'border-amber-400'}`}>
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
                  </div>
                  {customer && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-2.5 py-2 text-xs ring-1 ring-gray-200">
                      {!previa && !previaErro && (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Spinner size={12} className="animate-spin" /> conferindo cadastro e tributação…
                        </span>
                      )}
                      {previa && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            {previa.cliente.cnpj ? `CNPJ ${previa.cliente.cnpj}` : `CPF ${previa.cliente.cpf || '—'}`} · {previa.cliente.ie ? `IE ${previa.cliente.ie}` : 'sem IE'} ·{' '}
                            {previa.cliente.cidade}/{previa.cliente.uf}
                          </span>
                          <Chip cls="bg-indigo-50 text-[#000638] ring-indigo-200">
                            {cen?.label} · CFOP {cen?.cfop} · {cen?.icms}
                            {previa.aliqDifal ? ` (${previa.cenario.destUf} ${previa.aliqDifal}%)` : ''}
                          </Chip>
                          {(previa.cliente.ie || consumidorFinal) && previa.cenario.interestadual && (
                            <label className="inline-flex cursor-pointer items-center gap-1 text-gray-600" title="Use quando o cliente tem IE mas o TOTVS o trata como consumidor final (ex.: MEI): vira CFOP 6107/6108 com DIFAL">
                              <input type="checkbox" checked={consumidorFinal} onChange={(e) => setConsumidorFinal(e.target.checked)} className="mb-0 !h-3.5 !w-3.5" />
                              tratar como consumidor final
                            </label>
                          )}
                        </div>
                      )}
                      {previaErro && <span className="text-rose-600">{previaErro}</span>}
                    </div>
                  )}
                </Bloco>

                {/* Conferência */}
                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-bold text-[#000638]">
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
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <CheckCircle size={14} weight="fill" /> tudo confere
                      </span>
                    )}
                  </div>
                  <p className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-[10.5px] text-gray-500">
                    {pedido?.separacaoIncompleta
                      ? 'Pedido antigo: a separação saiu da tela do Dryland antes de o HeadCoach guardar todas as linhas. Peças do card do pedido (com as trocas registradas nele).'
                      : (pedido?.itens || []).length > 0
                        ? 'Peças da separação do Dryland (tela Separar · Loja Virtual Max).'
                        : 'Este pedido não tem separação no Dryland: peças do card do pedido.'}
                  </p>
                  {difCard && (
                    <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
                      <b>O card do Painel está diferente da separação.</b> Vale a separação.
                      {difCard.soSeparacao.length > 0 && <span className="block">Só na separação (entra na nota): {difCard.soSeparacao.map((x) => `${x.qtd}x ${x.sku} ${x.nome}`).join(' · ')}</span>}
                      {difCard.soCard.length > 0 && <span className="block">Só no card (fica fora da nota): {difCard.soCard.map((x) => `${x.qtd}x ${x.sku} ${x.nome}`).join(' · ')}</span>}
                    </div>
                  )}
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
                        const fx = cfopPor.get(l.sku);
                        return (
                          <li key={l.sku} className={`border-l-4 px-3 py-2 ${cor}`}>
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-800">{l.descricao || `SKU ${l.sku}`}</p>
                                <p className="text-[11px] text-gray-500">
                                  SKU <b className="font-mono text-[#000638]">{l.sku}</b>
                                  {l.cor ? ` · ${l.cor}` : ''}
                                  {l.tam ? ` · ${l.tam}` : ''} · {[...new Set(l.precos)].map((v) => fmtBRL(v)).join(' + ')}
                                  {!resultado &&
                                    (editandoPreco === l.sku ? (
                                      <span className="ml-1 inline-flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          autoFocus
                                          value={precoManual[l.sku] ?? ''}
                                          onChange={(e) => setPrecoManual((pm) => ({ ...pm, [l.sku]: e.target.value }))}
                                          onKeyDown={(e) => e.key === 'Enter' && setEditandoPreco(null)}
                                          placeholder={String(l.unidades[0]?.precoPedido ?? '')}
                                          className="mb-0 h-6 w-20 rounded border border-gray-300 px-1 text-[11px]"
                                        />
                                        <button type="button" onClick={() => setEditandoPreco(null)} className="font-bold text-emerald-700">
                                          ok
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPrecoManual((pm) => {
                                              const n = { ...pm };
                                              delete n[l.sku];
                                              return n;
                                            });
                                            setEditandoPreco(null);
                                          }}
                                          className="text-gray-500 underline"
                                        >
                                          voltar ao do pedido
                                        </button>
                                      </span>
                                    ) : (
                                      <button type="button" onClick={() => setEditandoPreco(l.sku)} className="ml-1 text-[10.5px] font-semibold text-blue-700 underline" title="O preço é sempre o do pedido do Dryland. Só o operador altera.">
                                        alterar preço
                                      </button>
                                    ))}
                                  {l.unidades.some((u) => u.alterado) && (
                                    <span className="ml-1 rounded bg-fuchsia-50 px-1 font-semibold text-fuchsia-700">preço alterado pelo operador (pedido: {fmtBRL(l.unidades[0].precoPedido)})</span>
                                  )}
                                  {l.unidades.some((u) => u.black) && (
                                    <span className="ml-1 rounded bg-rose-50 px-1 font-semibold text-rose-700">
                                      Black −{l.unidades.find((u) => u.black).black.pct ?? '?'}%
                                      {l.unidades.find((u) => u.black).black.antes ? ` (de ${fmtBRL(l.unidades.find((u) => u.black).black.antes)})` : ''}
                                      {l.unidades.filter((u) => u.black).length < l.qtd ? ` em ${l.unidades.filter((u) => u.black).length} de ${l.qtd}` : ''}
                                    </span>
                                  )}
                                  {l.unidades.some((u) => u.troca) && <span className="ml-1 rounded bg-sky-50 px-1 font-semibold text-sky-700">troca de {l.unidades.find((u) => u.troca).troca}</span>}
                                  {l.unidades.some((u) => u.desc > 0) && (
                                    <span className="ml-1 rounded bg-amber-50 px-1 font-semibold text-amber-700">
                                      − {fmtBRL(l.unidades.reduce((s, u) => s + u.desc, 0))} desc. pedido
                                    </span>
                                  )}
                                  {fx && (
                                    <span className="ml-1 rounded bg-indigo-50 px-1 font-semibold text-[#000638]" title={fx.tipo === 'adquirido' ? 'mercadoria adquirida de terceiros' : 'produção do estabelecimento'}>
                                      CFOP {fx.cfop}
                                    </span>
                                  )}
                                  {!(l.preco > 0) && <span className="font-semibold text-rose-600"> sem preço</span>}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-base font-bold tabular-nums text-[#000638]">
                                  {l.substitutos.length > 0 ? l.conferido : l.lido}
                                  <span className="font-normal text-gray-400">/{l.qtd}</span>
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
                            {l.substitutos.length > 0 && (
                              <p className="mt-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
                                Trocada no faturamento: entra {[...new Set(l.substitutos.map((sb) => sb.sku))].map((k) => `${l.substitutos.filter((sb) => sb.sku === k).length}x ${k} ${l.substitutos.find((sb) => sb.sku === k).nome}`).join(' · ')} — pelo
                                mesmo valor desta peça
                              </p>
                            )}
                            {(l.epcs.length > 0 || l.manual > 0) && (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {l.epcs.map((epc) => (
                                  <span key={epc} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] text-purple-700 ring-1 ring-purple-200">
                                    <Tag size={9} /> {epc}
                                    <button onClick={() => removerEpc(l.sku, epc)} className="text-purple-400 hover:text-rose-600" title="Tirar esta etiqueta">
                                      <X size={11} weight="bold" />
                                    </button>
                                  </span>
                                ))}
                                {l.manual > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 ring-1 ring-blue-200">
                                    <Barcode size={10} /> {l.manual} digitada(s)
                                    <button onClick={() => tirarManual(l.sku)} className="text-blue-300 hover:text-rose-600" title="Tirar uma">
                                      <Minus size={9} weight="bold" />
                                    </button>
                                  </span>
                                )}
                                {!resultado && (
                                  <span className="ml-auto inline-flex gap-1">
                                    <button
                                      onClick={() => removerPeca(l.sku)}
                                      title="Tirar UMA peça deste produto (as outras leituras ficam)"
                                      className="inline-flex h-6 items-center gap-0.5 rounded-md bg-white px-1.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                                    >
                                      <Minus size={10} weight="bold" /> tirar 1
                                    </button>
                                    {l.lido > 1 && (
                                      <button
                                        onClick={() => removerTodasDaPeca(l.sku)}
                                        title="Tirar todas as peças deste produto"
                                        className="inline-flex h-6 items-center rounded-md bg-white px-1.5 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                                      >
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
                    <div className="border-t border-rose-200 bg-rose-50/60">
                      <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                        Lidas que NÃO estão no pedido ({conf.fora.reduce((s, l) => s + l.lido, 0)}) — não entram na nota
                      </p>
                      {trocaLiberada && (
                        <p className="px-3 text-[11px] text-sky-800">
                          Liberado até {fmtData(TROCA_LIBERADA_ATE)}: se a peça foi trocada, escolha abaixo qual peça que falta ela substitui. Ela entra na nota pelo valor da peça do pedido, e o total não muda.
                        </p>
                      )}
                      <ul className="divide-y divide-rose-100">
                        {conf.fora.map((l) => (
                          <li key={l.sku} className="px-3 py-1.5 text-xs">
                            <p className="font-semibold text-rose-800">
                              {l.nome} <span className="font-mono font-normal">· SKU {l.sku}</span> · {l.total} pç
                            </p>
                            {trocaLiberada && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-[#000638]">Trocar: entra no lugar de</span>
                                <select
                                  value={trocas[l.sku] || ''}
                                  onChange={(e) =>
                                    setTrocas((t) => {
                                      const n = { ...t };
                                      if (e.target.value) n[l.sku] = e.target.value;
                                      else delete n[l.sku];
                                      return n;
                                    })
                                  }
                                  className="mb-0 h-8 max-w-full rounded-lg border border-sky-300 bg-white px-1.5 text-xs"
                                >
                                  <option value="">— não trocar (fica fora da nota) —</option>
                                  {conf.linhas
                                    .filter((x) => x.falta > 0 || trocas[l.sku] === x.sku)
                                    .map((x) => (
                                      <option key={x.sku} value={x.sku}>
                                        {x.sku} · {x.descricao} · {fmtBRL(x.preco)}
                                      </option>
                                    ))}
                                </select>
                                {l.usado > 0 && (
                                  <span className="text-[11px] font-semibold text-emerald-700">
                                    {l.usado} pç entra{l.usado > 1 ? 'm' : ''} na nota pelo valor do pedido{l.lido > 0 ? ` · ${l.lido} continua${l.lido > 1 ? 'm' : ''} de fora` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              {!resultado && (
                                <>
                                  <button
                                    onClick={() => removerPeca(l.sku)}
                                    title="Tirar UMA peça deste produto"
                                    className="inline-flex h-6 items-center gap-0.5 rounded-md bg-white px-1.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100"
                                  >
                                    <Minus size={10} weight="bold" /> tirar 1
                                  </button>
                                  {l.total > 1 && (
                                    <button
                                      onClick={() => removerTodasDaPeca(l.sku)}
                                      title="Tirar todas as peças deste produto"
                                      className="inline-flex h-6 items-center rounded-md bg-white px-1.5 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100"
                                    >
                                      <Trash size={11} />
                                    </button>
                                  )}
                                </>
                              )}
                              {l.epcs.map((epc) => (
                                <span key={epc} className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 font-mono text-[10px] text-rose-700 ring-1 ring-rose-200">
                                  <Tag size={9} /> {epc}
                                  <button onClick={() => removerEpc(l.sku, epc)} className="text-rose-400 hover:text-rose-600" title="Tirar esta etiqueta">
                                    <X size={11} weight="bold" />
                                  </button>
                                </span>
                              ))}
                              {l.manual > 0 && (
                                <button onClick={() => tirarManual(l.sku)} className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">
                                  {l.manual} digitada(s) · tirar uma
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {removidas.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-3 py-2 text-[11px] text-gray-600">
                      <span>
                        <b>{removidas.length}</b> etiqueta(s) tirada(s) à mão: o portal não lê de novo enquanto este pedido estiver aberto.
                      </span>
                      <button onClick={devolverRemovidas} className="rounded-md bg-white px-1.5 py-0.5 font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                        Voltar a ler
                      </button>
                    </div>
                  )}
                  {naoResolvidos.length > 0 && (
                    <div className="border-t border-gray-200 px-3 py-2 text-[11px] text-gray-500">
                      <b>{naoResolvidos.length}</b> etiqueta(s) que o TOTVS não reconheceu:{' '}
                      <span className="font-mono">
                        {naoResolvidos.slice(0, 6).join(', ')}
                        {naoResolvidos.length > 6 ? '…' : ''}
                      </span>
                    </div>
                  )}
                </section>

                {/* Transporte */}
                <Bloco titulo="Transporte" icone={Truck}>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label className={labelCls}>Transportadora</label>
                      <select
                        value={transp.id}
                        onChange={(e) => {
                          const t = prep.transportadoras.find((x) => x.id === e.target.value);
                          setTransp((s) => ({
                            ...s,
                            id: t.id,
                            code: t.code,
                            nome: t.code ? t.label : null,
                            volumes: t.id === 'RETIRADA' ? 0 : s.volumes || 1,
                            frete: t.id === 'RETIRADA' ? 0 : s.frete,
                            servico: t.id === 'CORREIOS' ? s.servico : '',
                          }));
                        }}
                        className={inputCls}
                      >
                        {prep.transportadoras.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                            {t.code ? ` (${t.code})` : ''}
                          </option>
                        ))}
                      </select>
                      {transp.id === 'TAXISTA' &&
                        (transp.code ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-[#000638]">
                            <b>{transp.code}</b> — {transp.nome}
                            <button onClick={() => setTransp((s) => ({ ...s, code: null, nome: null }))} className="text-gray-400 hover:text-rose-600">
                              <X size={11} weight="bold" />
                            </button>
                          </p>
                        ) : (
                          <BuscaPessoa onEscolher={(p) => setTransp((s) => ({ ...s, code: p.code, nome: p.nome }))} />
                        ))}
                    </div>
                    {transp.id !== 'RETIRADA' && (
                      <>
                        <div>
                          <label className={labelCls}>Valor do frete (R$)</label>
                          <input type="number" min="0" step="0.01" value={transp.frete} onChange={(e) => setTransp((s) => ({ ...s, frete: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Quem paga o frete</label>
                          <select value={transp.modFrete} onChange={(e) => setTransp((s) => ({ ...s, modFrete: Number(e.target.value) }))} className={inputCls}>
                            <option value={1}>Cliente (destinatário · FOB)</option>
                            <option value={0}>Crosby (remetente · CIF)</option>
                          </select>
                        </div>
                        {transp.id === 'CORREIOS' && (
                          <div>
                            <label className={labelCls}>Serviço</label>
                            <select value={transp.servico} onChange={(e) => setTransp((s) => ({ ...s, servico: e.target.value }))} className={inputCls}>
                              <option value="">—</option>
                              <option value="PAC">PAC</option>
                              <option value="SEDEX">SEDEX</option>
                            </select>
                          </div>
                        )}
                        <div>
                          <label className={labelCls}>Volumes</label>
                          <input type="number" min="1" step="1" value={transp.volumes} onChange={(e) => setTransp((s) => ({ ...s, volumes: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>
                            <Scales size={11} className="mr-0.5 inline" /> Peso bruto (kg)
                          </label>
                          <input type="number" min="0" step="0.001" value={transp.pesoB} onChange={(e) => setTransp((s) => ({ ...s, pesoB: e.target.value }))} className={inputCls} />
                        </div>
                      </>
                    )}
                  </div>
                  {transp.id === 'RETIRADA' && <p className="mt-1 text-[11px] text-gray-500">Sem transportadora: a NF-e sai com "sem frete" (modFrete 9).</p>}
                </Bloco>

                {/* Pagamento */}
                <Bloco
                  titulo="Pagamento"
                  icone={CreditCard}
                  extra={
                    <button
                      onClick={() => setPagamentos((ps) => [...ps, { forma: 'pix', valor: 0, parcelas: 1, nsu: '', autorizacao: '', bandeira: '', auto: ps.length === 0 }])}
                      className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      <Plus size={11} weight="bold" /> forma
                    </button>
                  }
                >
                  {prep.pagamento.formaTexto && (
                    <p className="mb-2 text-[11px] text-gray-500">
                      No pedido: <b>{prep.pagamento.formaTexto}</b>
                      {prep.pagamento.pix ? ` · Pix ${prep.pagamento.pix}` : ''}
                      {prep.pagamento.credev ? ` · Credev ${prep.pagamento.credev}` : ''}
                    </p>
                  )}
                  <div className="mb-2 rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900 ring-1 ring-blue-200">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1 font-bold">
                        <Wallet size={13} weight="bold" /> Saldos do cliente no TOTVS (empresa {EMPRESA})
                      </span>
                      {!customer ? (
                        <span className="text-blue-700">escolha o cliente</span>
                      ) : !saldos ? (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <Spinner size={11} className="animate-spin" /> consultando…
                        </span>
                      ) : saldos.erro ? (
                        <span className="text-rose-700">não consegui consultar: {saldos.erro}</span>
                      ) : (
                        Object.keys(CAMPO_SALDO).map((forma) => {
                          const si = saldoInfo(forma);
                          const livre = round2((si?.total || 0) - usoSaldo(forma));
                          const falta = round2(totalNota - round2(pagamentos.filter((x) => !x.auto).reduce((t, x) => t + Number(x.valor || 0), 0)));
                          return (
                            <span key={forma} className="inline-flex items-center gap-1">
                              {FORMAS[forma]}: <b className="tabular-nums">{fmtBRL(si?.total || 0)}</b>
                              {livre > 0.005 && falta > 0.005 && (
                                <button
                                  onClick={() =>
                                    setPagamentos((ps) => [...ps, { forma, valor: round2(Math.min(livre, falta)), parcelas: 1, nsu: '', autorizacao: '', bandeira: '', auto: ps.length === 0 }])
                                  }
                                  className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-blue-700"
                                >
                                  usar
                                </button>
                              )}
                            </span>
                          );
                        })
                      )}
                    </p>
                  </div>
                  {customer && Number(bonus?.total) > 0 && (
                    <div className="mb-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-900 ring-1 ring-emerald-200">
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1 font-bold">
                          <Wallet size={13} weight="bold" /> Saldo bônus do cliente (HeadCoach)
                        </span>
                        <b className="tabular-nums">{fmtBRL(bonus.total)}</b>
                        {(() => {
                          const livre = round2(bonus.total - pagamentos.filter((x) => x.forma === 'saldo_bonus').reduce((t, x) => t + Number(x.valor || 0), 0));
                          const faltaPagar = round2(totalNota - round2(pagamentos.filter((x) => !x.auto).reduce((t, x) => t + Number(x.valor || 0), 0)));
                          return (
                            livre > 0.005 &&
                            faltaPagar > 0.005 &&
                            !resultado && (
                              <button
                                onClick={() =>
                                  setPagamentos((ps) => [...ps, { forma: 'saldo_bonus', valor: round2(Math.min(livre, faltaPagar)), parcelas: 1, nsu: '', autorizacao: '', bandeira: '', auto: ps.length === 0 }])
                                }
                                className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                              >
                                usar
                              </button>
                            )
                          );
                        })()}
                        <span className="text-emerald-800">
                          {(bonus.creditos || [])
                            .filter((c) => c.disponivel > 0)
                            .map((c) => `${fmtBRL(c.disponivel)} do pedido ${c.numero_site || `venda ${c.venda_id}`}`)
                            .join(' · ')}
                        </span>
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {pagamentos.map((p, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div>
                            <label className={labelCls}>Forma</label>
                            <select value={p.forma} onChange={(e) => setPag(i, { forma: e.target.value, parcelas: 1 })} className={inputCls}>
                              {Object.entries(FORMAS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>
                              Valor {p.auto && <span className="normal-case text-gray-400">(acompanha o total)</span>}
                              {!p.auto && (
                                <button
                                  type="button"
                                  onClick={() => setPagamentos((ps) => ps.map((x, k) => ({ ...x, auto: k === i })))}
                                  className="ml-1 normal-case font-semibold text-blue-700 underline"
                                  title="Este valor volta a acompanhar o total da nota (total menos as outras formas)"
                                >
                                  fechar o total
                                </button>
                              )}
                            </label>
                            {/* o operador digita o valor que quiser: ao digitar, a forma deixa de acompanhar o total */}
                            <input type="number" min="0" step="0.01" value={p.valor} onChange={(e) => setPag(i, { valor: e.target.value, auto: false })} className={inputCls} />
                          </div>
                          {CAMPO_SALDO[p.forma] &&
                            (() => {
                              const si = saldoInfo(p.forma);
                              const passou = si && usoSaldo(p.forma) > si.total + 0.005;
                              return (
                                <div className="flex flex-col justify-end text-[11px] sm:col-span-2">
                                  <span className={passou ? 'font-semibold text-rose-600' : 'text-gray-600'}>
                                    Saldo de {FORMAS[p.forma]} na empresa {EMPRESA}: <b className="tabular-nums">{si ? fmtBRL(si.total) : '…'}</b>
                                    {passou ? ' — o valor usado passa do saldo.' : ' — o valor usado é consumido do saldo do cliente.'}
                                  </span>
                                </div>
                              );
                            })()}
                          {p.forma === 'saldo_bonus' &&
                            (() => {
                              const passou = bonus && !bonus.erro && round2(pagamentos.filter((x) => x.forma === 'saldo_bonus').reduce((t, x) => t + Number(x.valor || 0), 0)) > (bonus.total || 0) + 0.005;
                              return (
                                <div className="flex flex-col justify-end text-[11px] sm:col-span-2">
                                  <span className={passou ? 'font-semibold text-rose-600' : 'text-gray-600'}>
                                    Saldo bônus do cliente no HeadCoach: <b className="tabular-nums">{bonus ? fmtBRL(bonus.total || 0) : '…'}</b>
                                    {passou ? ' — o valor usado passa do saldo.' : ' — crédito de peça em falta de outro pedido; o valor usado sai do saldo.'}
                                  </span>
                                </div>
                              );
                            })()}
                          {p.forma === 'boleto' && (
                            <div>
                              <label className={labelCls}>Parcelas</label>
                              <input type="number" min="1" max="24" value={p.parcelas} onChange={(e) => setPag(i, { parcelas: Math.max(1, parseInt(e.target.value, 10) || 1) })} className={inputCls} />
                            </div>
                          )}
                          {(p.forma === 'credito' || p.forma === 'debito') &&
                            (() => {
                              const c = cartaoDe(p);
                              if (!cartoes) return <div className="flex items-end text-[11px] text-gray-400">carregando cartões do TOTVS…</div>;
                              return (
                                <>
                                  <div>
                                    <label className={labelCls}>Operadora *</label>
                                    <select
                                      value={c?.grupo?.chave || ''}
                                      onChange={(e) => setPag(i, { cartaoChave: e.target.value, cartaoSeq: null })}
                                      className={`${inputCls} ${c?.grupo ? '' : 'border-amber-400'}`}
                                    >
                                      <option value="">Selecione…</option>
                                      {(c?.grupos || []).map((g) => (
                                        <option key={g.chave} value={g.chave}>
                                          {g.operadora} · {g.bandeira} ({g.portador})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className={labelCls}>Parcelamento *</label>
                                    <select
                                      value={c?.opcao?.seq ?? ''}
                                      onChange={(e) => {
                                        const o = c?.grupo?.opcoes.find((x) => String(x.seq) === e.target.value);
                                        if (o) setPag(i, { cartaoChave: c.grupo.chave, cartaoSeq: o.seq, parcelas: o.parcelas });
                                      }}
                                      className={`${inputCls} ${c?.opcao ? '' : 'border-amber-400'}`}
                                    >
                                      <option value="">Selecione…</option>
                                      {(c?.grupo?.opcoes || []).map((o) => (
                                        <option key={o.seq} value={o.seq}>
                                          {o.descricao}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              );
                            })()}
                          {(p.forma === 'credito' || p.forma === 'debito') && (
                            <>
                              <div>
                                <label className={labelCls}>Nr. documento (NSU) *</label>
                                <input value={p.nsu} onChange={(e) => setPag(i, { nsu: e.target.value })} className={inputCls} />
                              </div>
                              <div>
                                <label className={labelCls}>Autorização *</label>
                                <input value={p.autorizacao} onChange={(e) => setPag(i, { autorizacao: e.target.value })} className={inputCls} />
                              </div>
                            </>
                          )}
                          {pagamentos.length > 1 && (
                            <div className="flex items-end">
                              <button
                                onClick={() =>
                                  setPagamentos((ps) => {
                                    const n = ps.filter((_, k) => k !== i);
                                    if (n.length && !n.some((x) => x.auto)) n[0] = { ...n[0], auto: true };
                                    return n;
                                  })
                                }
                                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                              >
                                <Trash size={13} /> tirar
                              </button>
                            </div>
                          )}
                        </div>
                        {p.forma === 'boleto' && (
                          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                            {parcelasBoleto.map((v, k) => (
                              <div key={k} className="flex items-center gap-1.5 text-xs">
                                <span className="w-8 shrink-0 font-semibold text-gray-500">{k + 1}ª</span>
                                <input
                                  type="date"
                                  value={vencimentos[k] || ''}
                                  onChange={(e) =>
                                    setVencimentos((vs) => {
                                      const n = [...vs];
                                      n[k] = e.target.value;
                                      return n;
                                    })
                                  }
                                  className={`${inputCls} ${vencimentos[k] ? '' : 'border-amber-400'}`}
                                />
                                <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{fmtBRL(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {prep.comprovantes.length > 0 && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <b className="text-gray-500">Comprovantes do Dryland:</b>
                      {prep.comprovantes.map((c, i) => (
                        <a key={c.path} href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:underline">
                          comprovante {i + 1} <ArrowSquareOut size={10} />
                        </a>
                      ))}
                    </p>
                  )}
                </Bloco>
              </div>

              {/* ── Coluna direita ── */}
              <div className="space-y-2 lg:sticky lg:top-2">
                <Bloco titulo="Portal RFID" icone={Broadcast}>
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className={`h-2.5 w-2.5 rounded-full ${portalStatus.status === 'lendo' ? 'animate-pulse bg-emerald-500' : portalLigado ? 'bg-amber-400' : 'bg-gray-300'}`} />
                    <span className="font-medium text-gray-700">{portalStatus.status || 'desconectado'}</span>
                    {portalStatus.erro && (
                      <span className="truncate text-rose-600" title={portalStatus.erro}>
                        {portalStatus.erro}
                      </span>
                    )}
                  </div>
                  {portalLigado ? (
                    <button onClick={desligarPortal} disabled={portalBusy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                      {portalBusy ? <Spinner size={16} className="animate-spin" /> : <Plugs size={16} weight="bold" />} DESLIGAR PORTAL
                    </button>
                  ) : (
                    <button onClick={ligarPortal} disabled={portalBusy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {portalBusy ? <Spinner size={16} className="animate-spin" /> : <PlugsConnected size={16} weight="bold" />} LIGAR PORTAL
                    </button>
                  )}
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPotenciaOpen(true)}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                      title="Alcance de leitura das antenas"
                    >
                      <WifiHigh size={13} weight="bold" /> Potência
                    </button>
                    <button onClick={limparLeituras} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50">
                      <Trash size={13} /> Limpar leituras
                    </button>
                  </div>
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Peça sem etiqueta (código / barras)</label>
                    <div className="flex gap-1">
                      <input
                        value={codigoManual}
                        onChange={(e) => setCodigoManual(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && adicionarManual()}
                        placeholder="SKU ou código de barras"
                        className="mb-0 h-9 min-w-0 flex-1 rounded-lg border border-gray-300 px-2 text-sm"
                      />
                      <button onClick={adicionarManual} disabled={manualBusy || !codigoManual.trim()} className="h-9 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white disabled:opacity-40">
                        {manualBusy ? <Spinner size={13} className="animate-spin" /> : '+1'}
                      </button>
                    </div>
                  </div>
                </Bloco>

                <Bloco titulo="Descontos do pedido" icone={Tag}>
                  {!brejinho && (
                    <div className="mb-2 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200">
                      <label className={labelCls}>Desconto do operador (%) · máximo {LIMITE_DESCONTO_PEDIDOS}%</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={LIMITE_DESCONTO_PEDIDOS}
                          step="0.5"
                          value={descPct}
                          onChange={(e) => setDescPct(e.target.value)}
                          placeholder="0"
                          className={`${inputCls} w-24 ${pctDesc > LIMITE_DESCONTO_PEDIDOS ? 'border-rose-500' : ''}`}
                        />
                        <span className="text-xs tabular-nums text-amber-800">{pctDesc > 0 ? `− ${fmtBRL(conf.descExtraConferido)} nas peças conferidas` : 'sem desconto do operador'}</span>
                      </div>
                      <p className={`mt-1 text-[10.5px] ${pctDesc > LIMITE_DESCONTO_PEDIDOS ? 'font-semibold text-rose-600' : 'text-amber-800'}`}>
                        {pctDesc > LIMITE_DESCONTO_PEDIDOS
                          ? `Passou de ${LIMITE_DESCONTO_PEDIDOS}%: reduza o desconto.`
                          : 'Use só para acertar o valor quando ele não fechou com o pedido. Entra no valor de cada peça da NF-e.'}
                      </p>
                    </div>
                  )}
                  {brejinho && (
                    <div className="mb-2 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200">
                      <label className={labelCls}>Desconto neste faturamento (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          step="0.5"
                          value={descPct}
                          onChange={(e) => setDescPct(e.target.value)}
                          placeholder="0"
                          className={`${inputCls} w-24 ${descPrecisaSenha ? 'border-amber-500' : ''}`}
                        />
                        <span className="text-xs tabular-nums text-amber-800">{pctDesc > 0 ? `− ${fmtBRL(conf.descExtraConferido)} nas peças conferidas` : 'sem desconto extra'}</span>
                      </div>
                      {descPrecisaSenha ? (
                        <button
                          onClick={() => setSenhaDescOpen(true)}
                          className="mt-1.5 inline-flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-2.5 text-[11px] font-bold text-white hover:bg-amber-600"
                        >
                          <LockKey size={12} weight="fill" /> Liberar com senha (owner, admin ou financeiro)
                        </button>
                      ) : pctDesc > LIMITE_DESCONTO_LIVRE ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                          <LockKey size={11} weight="fill" /> {descLiberado && Number(descLiberado.pct) >= pctDesc ? `Liberado por ${descLiberado.nome}` : 'Seu perfil libera acima do limite'}
                        </p>
                      ) : (
                        <p className="mt-1 text-[10.5px] text-amber-800">Até {LIMITE_DESCONTO_LIVRE}% é livre; acima disso pede a senha de owner, admin ou financeiro. Entra no valor de cada peça da NF-e.</p>
                      )}
                    </div>
                  )}
                  {descontos.length === 0 ? (
                    <p className="text-xs text-gray-500">Sem desconto — peças no preço do Detalhar.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {descontos.map((d) => (
                        <li key={d.tipo + d.pct} className="rounded-lg bg-gray-50 px-2 py-1.5 ring-1 ring-gray-200">
                          <p className="font-semibold text-[#000638]">
                            {d.tipo}
                            {d.pct != null ? ` · ${d.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : ''}
                            {d.valor ? ` · ${fmtBRL(d.valor)}` : ''}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {d.pecas === d.total ? `em todas as ${d.total} peças` : d.pecas === 1 ? `em 1 peça de ${d.total}` : `em ${d.pecas} de ${d.total} peças`}
                            {d.tipo.startsWith('Desconto') ? ' — rateado no valor de cada peça da NF-e' : ''}
                          </p>
                          {d.nota && <p className="text-[11px] text-amber-700">{d.nota}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Bloco>

                <Bloco titulo={`TOTVS (documento interno · empresa ${EMPRESA_TOTVS})`} icone={Storefront}>
                  <label className={labelCls}>Operação</label>
                  <select value={operacao} onChange={(e) => setOperacao(e.target.value)} className={inputCls}>
                    <option value="">Selecione…</option>
                    {OPERACOES_DOC_INTERNO.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 grid grid-cols-[1fr_5rem] gap-2">
                    <div>
                      <label className={labelCls}>
                        <CalendarBlank size={11} className="mr-0.5 inline" /> Data da transação
                      </label>
                      <div className="flex h-9 items-center rounded-lg bg-gray-50 px-2.5 text-sm font-semibold text-[#000638] ring-1 ring-gray-200">Hoje · {fmtData(hojeIso())}</div>
                    </div>
                    <div>
                      <label className={labelCls}>Terminal</label>
                      <input type="number" min="1" value={terminal} onChange={(e) => setTerminal(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDataDiferente((v) => !v)}
                    className={`mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold ring-1 transition ${
                      dataDiferente ? 'bg-amber-500 text-white ring-amber-500' : 'bg-white text-amber-700 ring-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <CalendarBlank size={13} weight="bold" /> TRANSAÇÃO COM DATA DIFERENTE
                  </button>
                  {dataDiferente && (
                    <div className="mt-1.5 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200">
                      <label className={labelCls}>Data da venda</label>
                      <input type="date" value={dataVenda} max={hojeIso()} onChange={(e) => setDataVenda(e.target.value)} className={`${inputCls} ${dataVenda ? '' : 'border-amber-400'}`} />
                      <p className="mt-1 text-[10.5px] text-amber-800">
                        A transação continua com a data de hoje. No TOTVS ela leva a observação{' '}
                        <b>VENDA DO DIA {dataVenda ? fmtData(dataVenda) : 'dd/mm/aaaa'}</b>.
                      </p>
                    </div>
                  )}
                  <label className={`${labelCls} mt-2`}>Recebimento no TOTVS</label>
                  <select value={comoFatura ? 'fatura' : 'forma'} onChange={(e) => setComoFatura(e.target.value === 'fatura')} className={inputCls}>
                    <option value="forma">Pela forma de pagamento (cartão, Pix…)</option>
                    <option value="fatura">Tudo como FATURA (título a receber)</option>
                  </select>
                  <p className="mt-1 flex items-start gap-1 text-[10.5px] text-gray-500">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    {comoFatura
                      ? 'Cada pagamento vira fatura no contas a receber (cartão em N vezes = N faturas a cada 30 dias), sem movimento de caixa.'
                      : `O caixa desse terminal da empresa ${EMPRESA_TOTVS} precisa estar aberto no TOTVS com a data de hoje. O contas a receber sai com as parcelas e vencimentos acima.`}
                  </p>
                </Bloco>

                <section className="space-y-1 rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Peças do pedido</span>
                    <span className="tabular-nums">{conf.esperado}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Conferidas (vão na nota)</span>
                    <span className="font-semibold tabular-nums">{conf.conferidas}</span>
                  </div>
                  {conf.faltando > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Faltando (ficam fora)</span>
                      <span className="tabular-nums">{conf.faltando}</span>
                    </div>
                  )}
                  {conf.sobrando > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Sobrando (ficam fora)</span>
                      <span className="tabular-nums">{conf.sobrando}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Produtos</span>
                    <span className="tabular-nums">{fmtBRL(conf.brutoConferido)}</span>
                  </div>
                  {conf.descConferido > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Desconto (vai na NF-e)</span>
                      <span className="tabular-nums">− {fmtBRL(conf.descConferido)}</span>
                    </div>
                  )}
                  {pctDesc > 0 && (
                    <div className="flex justify-between text-[11px] text-amber-700">
                      <span>↳ {pctDesc.toLocaleString('pt-BR')}% dado neste faturamento</span>
                      <span className="tabular-nums">{fmtBRL(conf.descExtraConferido)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Frete</span>
                    <span className="tabular-nums">{fmtBRL(frete)}</span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-gray-100 pt-1">
                    <span className="font-semibold text-[#000638]">Total da NF-e</span>
                    <span className="text-xl font-bold tabular-nums text-[#000638]">{fmtBRL(totalNota)}</span>
                  </div>
                  {Number(card?.dados?.valor_pedido) > 0 && (
                    <div className={`flex justify-between ${conf.ok && Math.abs(Number(card.dados.valor_pedido) - totalNota) > 0.01 ? 'font-semibold text-rose-600' : 'text-gray-500'}`}>
                      <span>Pago no pedido{conf.ok && Math.abs(Number(card.dados.valor_pedido) - totalNota) > 0.01 ? ' — não bate!' : ''}</span>
                      <span className="tabular-nums">{fmtBRL(card.dados.valor_pedido)}</span>
                    </div>
                  )}
                  {creditoPossivel && !resultado && !bloqueio && (
                    <label className={`mt-2 flex cursor-pointer items-start gap-2 rounded-lg p-2 text-[11px] ring-1 ${gerarCredito ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-gray-50 text-gray-700 ring-gray-200'}`}>
                      <input type="checkbox" checked={gerarCredito} onChange={(e) => setGerarCredito(e.target.checked)} className="mb-0 mt-0.5 !h-4 !w-4 shrink-0 accent-sky-700" />
                      <span>
                        <b>
                          Peça em falta: o cliente ficou com crédito de {fmtBRL(falta.valor)}
                        </b>
                        <span className="block">
                          {conf.faltando} peça{conf.faltando === 1 ? '' : 's'} fora da nota. Ao faturar, o valor vira saldo bônus do cliente (para usar em outro faturamento) e abre um chamado para o Financeiro no Dryland.
                        </span>
                        {gerarCredito && (
                          <span className="mt-0.5 block font-semibold tabular-nums">
                            Nota {fmtBRL(totalNota)} + crédito {fmtBRL(falta.valor)} = {fmtBRL(round2(totalNota + falta.valor))}
                          </span>
                        )}
                      </span>
                    </label>
                  )}

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
                            <button onClick={() => imprimirDanfe(notaRes.id).catch((e) => showToast('erro', e.message))} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white">
                              <Printer size={13} /> DANFE
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
                          {resultado.totvs?.ok ? `TOTVS: documento interno ${resultado.totvs.transactionCode}` : 'TOTVS ainda não recebeu'}
                        </p>
                        <p className="text-[11px] text-gray-700">
                          {resultado.totvs?.ok ? `${TOTVS_STATUS[resultado.totvs.status]?.label || ''} · ${fmtData(resultado.totvs.transactionDate)}` : resultado.totvs?.mensagem}
                        </p>
                      </div>
                      {Number(resultado.credito?.valor) > 0 && (
                        <div className="rounded-lg bg-sky-50 p-2 ring-1 ring-sky-200">
                          <p className="inline-flex items-center gap-1 font-bold text-sky-900">
                            <Wallet size={14} weight="fill" /> Saldo bônus de {fmtBRL(resultado.credito.valor)} para o cliente
                          </p>
                          <p className="text-[11px] text-gray-700">
                            {resultado.credito.aguardandoTotvs
                              ? 'Sai quando a transação do TOTVS for atendida (Tentar de novo).'
                              : 'Peça em falta: o valor virou saldo bônus do cliente e o chamado para o Financeiro está sendo aberto no Dryland. Acompanhe na aba Transações.'}
                          </p>
                        </div>
                      )}
                      {!(resultado.fiscal?.ok && resultado.totvs?.ok) && (
                        <button onClick={reprocessar} disabled={posting} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 text-xs font-bold text-white disabled:opacity-50">
                          {posting ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />} Tentar de novo
                        </button>
                      )}
                      <button onClick={() => escolherPedido('')} className="h-9 w-full rounded-lg bg-[#000638] text-xs font-bold text-white hover:bg-[#000638]/90">
                        Faturar outro pedido
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setModalFat(true)}
                        disabled={!podeFaturar}
                        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        {posting ? <Spinner size={16} className="animate-spin" /> : <Receipt size={16} weight="bold" />}
                        {posting ? 'FATURANDO…' : `FATURAR (${conf.conferidas} pç)`}
                      </button>
                      {posting && <p className="text-[10.5px] text-gray-500">Emitindo a NF-e na SEFAZ e gravando no TOTVS — pode levar até 1 minuto.</p>}
                      {!posting && pendencias.length > 0 && (
                        <ul className="list-disc space-y-0.5 pl-4 text-[10.5px] text-amber-700">
                          {pendencias.slice(0, 4).map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      )}
                      {conf.conferidas > 0 && !conf.ok && <p className="text-[10px] text-gray-500">Só as peças conferidas entram na nota; o que falta ou sobra fica registrado.</p>}
                    </>
                  )}
                </section>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {modalFat && pedido && prep && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#000638]/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => !posting && setModalFat(false)}>
          <div className="w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#000638] to-[#1b2a6b] px-5 py-4 text-white">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
                <Receipt size={20} weight="bold" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">{resultado ? 'Faturamento' : posting ? 'Faturando…' : 'Confirmar faturamento'}</p>
                <p className="truncate text-xs text-white/70">
                  Pedido {ref || '—'} · {customer?.name}
                </p>
              </div>
              {Number(prep.numeracao?.ambiente) === 1 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">produção</span>}
              {!posting && (
                <button onClick={() => setModalFat(false)} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white">
                  <X size={18} weight="bold" />
                </button>
              )}
            </div>

            {resultado ? (
              <div className="space-y-3 p-5">
                <div className={`rounded-xl p-3 ring-1 ${resultado.fiscal?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
                  <p className={`flex items-center gap-1.5 text-sm font-bold ${resultado.fiscal?.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                    {resultado.fiscal?.ok ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
                    {resultado.fiscal?.ok ? 'NF-e autorizada' : 'NF-e não autorizada'}
                  </p>
                  {resultado.fiscal?.ok ? (
                    <>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-800">
                        Nº {notaRes?.numero}
                        <span className="text-sm font-semibold text-emerald-700"> · série {notaRes?.serie}</span>
                      </p>
                      {notaRes?.chave && <p className="mt-0.5 break-all font-mono text-[10.5px] text-gray-500">{notaRes.chave}</p>}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-rose-700">{resultado.fiscal?.mensagem}</p>
                  )}
                </div>
                <div className={`rounded-xl p-3 ring-1 ${resultado.totvs?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
                  <p className={`flex items-center gap-1.5 text-sm font-bold ${resultado.totvs?.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {resultado.totvs?.ok ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
                    {resultado.totvs?.ok ? 'Transação no TOTVS (documento interno)' : 'TOTVS ainda não recebeu'}
                  </p>
                  {resultado.totvs?.ok ? (
                    <>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-800">
                        Nº {resultado.totvs.transactionCode}
                        <span className="text-sm font-semibold text-emerald-700"> · {fmtData(resultado.totvs.transactionDate)}</span>
                      </p>
                      <p className="text-xs text-gray-600">
                        Operação {operacao} · empresa {resultado.venda?.pedido_info?.empresaTotvs || EMPRESA} · {TOTVS_STATUS[resultado.totvs.status]?.label || ''}
                      </p>
                    </>
                  ) : (
                    <>
                      {resultado.venda?.totvs_transacao_code && (
                        <p className="mt-1 text-sm font-bold tabular-nums text-amber-800">Transação {resultado.venda.totvs_transacao_code} aberta, sem recebimento</p>
                      )}
                      <p className="mt-1 text-xs text-amber-800">{resultado.totvs?.mensagem}</p>
                    </>
                  )}
                </div>
                {Number(resultado.credito?.valor) > 0 && (
                  <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-200">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-sky-900">
                      <Wallet size={18} weight="fill" /> Saldo bônus de {fmtBRL(resultado.credito.valor)} para o cliente
                    </p>
                    <p className="mt-1 text-xs text-gray-700">
                      {resultado.credito.aguardandoTotvs
                        ? 'O crédito e o chamado saem quando a transação do TOTVS for atendida (Tentar de novo).'
                        : 'Peça em falta: o valor virou saldo bônus do cliente e o chamado para o Financeiro está sendo aberto no Dryland. Acompanhe na aba Transações.'}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {resultado.fiscal?.ok && notaRes?.id && (
                    <>
                      <button onClick={() => imprimirDanfe(notaRes.id).catch((e) => showToast('erro', e.message))} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#000638] px-3 text-sm font-bold text-white">
                        <Printer size={15} /> DANFE
                      </button>
                      <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${notaRes.id}/xml`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#000638] ring-1 ring-gray-300">
                        <DownloadSimple size={15} /> XML
                      </a>
                    </>
                  )}
                  {!(resultado.fiscal?.ok && resultado.totvs?.ok) && (
                    <button onClick={reprocessar} disabled={posting} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 text-sm font-bold text-white disabled:opacity-50">
                      {posting ? <Spinner size={15} className="animate-spin" /> : <ArrowsClockwise size={15} />} Tentar de novo
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setModalFat(false);
                    escolherPedido('');
                  }}
                  className="h-10 w-full rounded-xl text-sm font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                >
                  Faturar outro pedido
                </button>
              </div>
            ) : posting ? (
              <div className="p-8 text-center">
                <Spinner size={34} className="mx-auto animate-spin text-[#000638]" />
                <p className="mt-3 text-sm font-semibold text-[#000638]">Emitindo a NF-e na SEFAZ e gravando no TOTVS…</p>
                <p className="mt-1 text-xs text-gray-500">Pode levar até 1 minuto. Não feche esta janela.</p>
              </div>
            ) : (
              <div className="p-5">
                <dl className="divide-y divide-gray-100 text-sm">
                  {[
                    ['NF-e', `série ${prep.numeracao?.serie ?? 3} · próximo nº ${prep.numeracao?.proximo ?? '—'} (conferido com o TOTVS na hora)`],
                    ['Empresa', `${EMPRESA} · ${prep.emitente?.nome || ''}`],
                    ['Cliente', `${customer?.code} — ${customer?.name}`],
                    ['Fiscal', cen ? `${cen.label} · CFOP ${cen.cfop} · ${cen.icms}${previa?.aliqDifal ? ` (${previa.cenario.destUf} ${previa.aliqDifal}%)` : ''}` : '—'],
                    ['Transporte', temTransportadora ? `${transp.nome || transp.id}${transp.servico ? ` · ${transp.servico}` : ''} · ${transp.volumes} vol · ${transp.pesoB} kg` : 'Retirada (sem transportadora)'],
                    ['Pagamento', pagamentos.map((p) => `${FORMAS[p.forma]} ${fmtBRL(p.valor)}${Number(p.parcelas) > 1 ? ` em ${p.parcelas}x` : ''}`).join(' + ')],
                    ['TOTVS', `documento interno ${operacao} · empresa ${EMPRESA_TOTVS} · data de hoje (${fmtData(hojeIso())}) · terminal ${terminal}`],
                    ...(trocasFeitas.length ? [['Trocas', trocasFeitas.map((t) => `${t.quantidade}x ${t.de} → ${t.para} ${t.paraNome || ''}`).join(' · ') + ' (mesmo valor)']] : []),
                    ...(dataDiferente && dataVenda ? [['Data diferente', `observação na transação: VENDA DO DIA ${fmtData(dataVenda)}`]] : []),
                    ...(card?.dados?.transacao || card?.dados?.pedido_totvs
                      ? [['Transação no TOTVS (aberta pelo Dryland)', [card.dados.transacao && `transação ${card.dados.transacao}`, card.dados.pedido_totvs && `pedido ${card.dados.pedido_totvs}`].filter(Boolean).join(' · ')]]
                      : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-1.5">
                      <dt className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">{k}</dt>
                      <dd className="min-w-0 flex-1 text-[13px] text-gray-800">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{conf.conferidas} peça(s)</span>
                    <span className="tabular-nums">{fmtBRL(conf.brutoConferido)}</span>
                  </div>
                  {conf.descConferido > 0 && (
                    <div className="flex justify-between text-xs text-amber-700">
                      <span>Desconto</span>
                      <span className="tabular-nums">− {fmtBRL(conf.descConferido)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Frete</span>
                    <span className="tabular-nums">{fmtBRL(frete)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between border-t border-gray-200 pt-1">
                    <span className="text-sm font-bold text-[#000638]">Total da NF-e</span>
                    <span className="text-2xl font-extrabold tabular-nums text-[#000638]">{fmtBRL(totalNota)}</span>
                  </div>
                </div>
                {(conf.faltando > 0 || conf.sobrando > 0) && (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Ficam fora da nota: {conf.faltando} faltando · {conf.sobrando} sobrando.
                  </p>
                )}
                {creditoAtivo && (
                  <div className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-200">
                    <p className="flex items-center justify-between gap-2 font-bold">
                      <span className="inline-flex items-center gap-1">
                        <Wallet size={14} weight="fill" /> Saldo bônus para o cliente
                      </span>
                      <span className="tabular-nums">{fmtBRL(falta.valor)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px]">
                      {falta.pecas.map((x) => `${x.quantidade}× ${x.nome}`).join(' · ')} — fora da nota. Abre chamado para o Financeiro no Dryland com o cliente, a transação e o valor.
                    </p>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-gray-500">A nota é real (SEFAZ, produção). Depois dela, o TOTVS recebe o documento interno e o contas a receber na empresa {EMPRESA_TOTVS}.</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setModalFat(false)} className="h-11 flex-1 rounded-xl text-sm font-bold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button onClick={faturar} disabled={!podeFaturar} className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                    <Receipt size={16} weight="bold" /> Emitir NF-e e gravar no TOTVS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {senhaDescOpen && (
        <SenhaDescontoModal
          pct={pctDesc}
          pedido={ref}
          por={user?.name || user?.email || null}
          onCancelar={() => setSenhaDescOpen(false)}
          onLiberado={(a) => {
            setDescLiberado(a);
            setSenhaDescOpen(false);
            showToast('ok', `Desconto de ${pctDesc.toLocaleString('pt-BR')}% liberado por ${a.nome}`);
          }}
        />
      )}
      {potenciaOpen && (
        <PortalPotenciaModal onClose={() => setPotenciaOpen(false)} onSaved={() => showToast('ok', 'Potência do portal gravada')} />
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-[60] inline-flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-lg ${
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
