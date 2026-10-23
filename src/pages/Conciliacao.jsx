// Página: Financeiro → Conciliação → Conciliação
// Contas bancárias do grupo (planilha CONTAS BANCARIAS, 10/2026) ligadas aos
// extratos importados na tela Extrato Bancário (/api/fluxo-caixa-ext):
//   • só aparecem contas com extrato importado (as demais da planilha ficam
//     ocultas até alguém importar o extrato delas);
//   • contas importadas que não estão na planilha entram automaticamente,
//     na empresa deduzida pelo CNPJ/titular, e ganham o CTA ao clicar;
//   • filtro de período (datas + chips de mês) e de banco (um ou mais);
//   • clique na conta abre o extrato linha a linha.
// O CTA (código da conta no TOTVS) fica salvo na própria conta importada
// (fluxo_caixa_contas.cta_totvs) e vale para todos os meses.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import {
  Bank,
  MagnifyingGlass,
  CalendarBlank,
  ArrowsClockwise,
  ArrowDown,
  ArrowUp,
  ArrowsLeftRight,
  X,
  Export,
  Warning,
  Info,
  PencilSimple,
  Check,
  CheckCircle,
  Lightning,
  ArrowCounterClockwise,
  ChatText,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const API = `${API_BASE_URL}/api/fluxo-caixa-ext`;

// cabeçalho com o usuário logado (vai para `usuario` nas conciliações)
const headersUsuario = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || localStorage.getItem('usuario') || 'null');
    const nome = u?.name || u?.nome || u?.email || null;
    return nome ? { 'x-user-name': nome } : {};
  } catch {
    return {};
  }
};
const ORIGENS = {
  TRANSFERENCIA: { label: 'Transferência', cor: 'bg-amber-100 text-amber-800 border-amber-300' },
  LIBERACAO: { label: 'Liberação de Pagamento', cor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  SOLICITACAO: { label: 'Solicitações Crosby', cor: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  TOTVS_CP: { label: 'Contas a Pagar (TOTVS)', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
  MANUAL: { label: 'Justificado', cor: 'bg-gray-100 text-gray-700 border-gray-300' },
};
const origemCfg = (o) => ORIGENS[o] || { label: o || '—', cor: 'bg-gray-100 text-gray-700 border-gray-300' };

// Planilha CONTAS BANCARIAS — CTA = código da conta no TOTVS · CODIGO = banco (FEBRABAN).
// Pagar.me não entra na conciliação bancária.
const CONTAS = [
  // FERREIRA COMERCIO E CONFECCOES LTDA
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10001, cnpj: '17.177.680/0001-16', banco: 'ITAU', codigo: 341, ag: '6530', conta: '27061-7' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10002, cnpj: '17.177.680/0001-16', banco: 'SANTANDER', codigo: 33, ag: '1575', conta: '13000599-5' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10003, cnpj: '17.177.680/0001-16', banco: 'SANTANDER VINCULADA', codigo: 33, ag: '1575', conta: '29000199-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10004, cnpj: '17.177.680/0001-16', banco: 'CAIXA', codigo: 104, ag: '6370', conta: '578136386-2' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10005, cnpj: '17.177.680/0001-16', banco: 'BANCO DO BRASIL', codigo: 1, ag: '1533', conta: '58711-7' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10006, cnpj: '17.177.680/0001-16', banco: 'SICREDI', codigo: 748, ag: '2207', conta: '36733-8' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10007, cnpj: '17.177.680/0001-16', banco: 'BANCO DO NORDESTE 1', codigo: 4, ag: '35', conta: '069919-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10008, cnpj: '17.177.680/0001-16', banco: 'BANCO DO NORDESTE 2', codigo: 4, ag: '35', conta: '069918-1' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10009, cnpj: '17.177.680/0001-16', banco: 'UNICRED', codigo: 136, ag: '6012', conta: '6850-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10010, cnpj: '17.177.680/0001-16', banco: 'BRADESCO', codigo: 237, ag: '2821', conta: '249374-8' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10011, cnpj: '17.177.680/0002-05', banco: 'SANTANDER JOAO PESSOA', codigo: 33, ag: '1575', conta: '13001128-2' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10012, cnpj: '17.177.680/0009-73', banco: 'STONE TERESINA', codigo: 197, ag: '1', conta: '47185882-9' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10018, cnpj: '17.177.680/0010-07', banco: 'STONE BREJINHO', codigo: 197, ag: '1', conta: '71938990-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 60001, cnpj: '17.177.680/0001-16', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47097134-2' },
  // FA MODA & VAREJO LTDA
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20001, cnpj: '27.728.810/0001-15', banco: 'ITAU', codigo: 341, ag: '6530', conta: '33688-9' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20002, cnpj: '27.728.810/0001-15', banco: 'ITAU VINCULADA', codigo: 341, ag: '6530', conta: '56927-3' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20003, cnpj: '27.728.810/0001-15', banco: 'ITAU MIDWAY', codigo: 341, ag: '382', conta: '98141-3' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20007, cnpj: '27.728.810/0001-15', banco: 'SANTANDER', codigo: 33, ag: '4543', conta: '13006882-4' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20008, cnpj: '27.728.810/0001-15', banco: 'CAIXA', codigo: 104, ag: '6370', conta: '578136459-1' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20009, cnpj: '27.728.810/0001-15', banco: 'BANCO DO BRASIL', codigo: 1, ag: '221', conta: '36960-8' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20010, cnpj: '27.728.810/0001-15', banco: 'SICREDI', codigo: 748, ag: '2207', conta: '32693-3' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20011, cnpj: '27.728.810/0001-15', banco: 'BANCO DO NORDESTE 1', codigo: 4, ag: '35', conta: '069922-0' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20012, cnpj: '27.728.810/0001-15', banco: 'BANCO DO NORDESTE 2', codigo: 44, ag: '35', conta: '069921-1' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20013, cnpj: '27.728.810/0001-15', banco: 'UNICRED', codigo: 136, ag: '6012', conta: '7098-0' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20014, cnpj: '27.728.810/0001-15', banco: 'BRADESCO', codigo: 237, ag: '2821', conta: '249286-5' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20020, cnpj: '27.728.810/0009-72', banco: 'STONE CIDADE JARDIM', codigo: 197, ag: '1', conta: '38055887-4' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20021, cnpj: '27.728.810/0006-20', banco: 'STONE CANGUARETAMA', codigo: 197, ag: '1', conta: '44463972-8' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20022, cnpj: '27.728.810/0005-49', banco: 'STONE MIDWAY', codigo: 197, ag: '1', conta: '43413690-9' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20023, cnpj: '27.728.810/0010-06', banco: 'STONE GUARARAPES', codigo: 197, ag: '1', conta: '35482671-1' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 60002, cnpj: '27.728.810/0001-15', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47097409-8' },
  // AZ VESTUARIO LTDA
  { empresa: 'AZ VESTUARIO LTDA', cta: 30001, cnpj: '33.592.092/0001-03', banco: 'ITAU', codigo: 341, ag: '6530', conta: '39046-4' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30002, cnpj: '33.592.092/0001-03', banco: 'SICREDI', codigo: 748, ag: '2207', conta: '36734-6' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30003, cnpj: '33.592.092/0001-03', banco: 'BANCO DO NORDESTE 1', codigo: 4, ag: '35', conta: '069361-2' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30004, cnpj: '33.592.092/0001-03', banco: 'BANCO DO NORDESTE 2', codigo: 4, ag: '35', conta: '069363-9' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30005, cnpj: '33.592.092/0001-03', banco: 'BANCO DO BRASIL', codigo: 1, ag: '221', conta: '370151-7' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30007, cnpj: '33.592.092/0001-03', banco: 'CAIXA', codigo: 104, ag: '6370', conta: '578136635-7' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30008, cnpj: '33.592.092/0001-03', banco: 'BRADESCO', codigo: 237, ag: '2821', conta: '52642-8' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30010, cnpj: '33.592.092/0001-03', banco: 'STONE IRMAOS CR', codigo: 197, ag: '1', conta: '21774800-3' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 60003, cnpj: '33.592.092/0001-03', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47123827-9' },
  // IRMAOS VAREJO COMERCIAL LTDA
  { empresa: 'IRMAOS VAREJO COMERCIAL LTDA', cta: 40001, cnpj: '53.661.116/0001-38', banco: 'ITAU', codigo: 341, ag: '6530', conta: '98073-6' },
  { empresa: 'IRMAOS VAREJO COMERCIAL LTDA', cta: 40002, cnpj: '53.661.116/0001-38', banco: 'STONE IRMAOS VAREJO', codigo: 197, ag: '1', conta: '97340355-3' },
  { empresa: 'IRMAOS VAREJO COMERCIAL LTDA', cta: 60004, cnpj: '53.661.116/0001-38', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47122948-4' },
  // SERVICOS INTEGRADOS
  { empresa: 'SERVICOS INTEGRADOS', cta: 60005, cnpj: '61.469.380/0001-00', banco: 'MENTORE A01', codigo: '-', ag: '1', conta: '47097549-1' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60006, cnpj: '61.469.224/0001-31', banco: 'MENTORE A02', codigo: '-', ag: '1', conta: '47065279-3' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60007, cnpj: '61.469.160/0001-79', banco: 'MENTORE A03', codigo: '-', ag: '1', conta: '47107666-1' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60008, cnpj: '61.480.564/0001-63', banco: 'MENTORE A04', codigo: '-', ag: '1', conta: '47097284-5' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60009, cnpj: '61.504.881/0001-72', banco: 'MENTORE A05', codigo: '-', ag: '-', conta: '-' },
  // CROSBY RECIFE MALL LTDA
  { empresa: 'CROSBY RECIFE MALL LTDA', cta: 957, cnpj: '36.569.459/0001-58', banco: 'ITAU', codigo: 341, ag: '1339', conta: '98391-6' },
  { empresa: 'CROSBY RECIFE MALL LTDA', cta: 7002, cnpj: '36.569.459/0001-58', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47038112-0' },
  { empresa: 'CROSBY RECIFE MALL LTDA', cta: 7004, cnpj: '36.569.459/0001-58', banco: 'STONE', codigo: 197, ag: '1', conta: '49156344-1' },
];

const EMPRESAS = [...new Set(CONTAS.map((c) => c.empresa))];
// empresa pela raiz do CNPJ do titular (contas importadas fora da planilha)
const EMPRESA_POR_RAIZ = {
  17177680: 'FERREIRA COMERCIO E CONFECCOES LTDA',
  27728810: 'FA MODA & VAREJO LTDA',
  33592092: 'AZ VESTUARIO LTDA',
  53661116: 'IRMAOS VAREJO COMERCIAL LTDA',
  36569459: 'CROSBY RECIFE MALL LTDA',
  61469380: 'SERVICOS INTEGRADOS',
  61469224: 'SERVICOS INTEGRADOS',
  61469160: 'SERVICOS INTEGRADOS',
  61480564: 'SERVICOS INTEGRADOS',
  61504881: 'SERVICOS INTEGRADOS',
};
// e pelo nome do titular, quando o extrato não traz CNPJ
const EMPRESA_POR_TITULAR = [
  [/FABIO FERREIRA/i, 'FA MODA & VAREJO LTDA'],
  [/FLAVIO FERREIRA/i, 'IRMAOS VAREJO COMERCIAL LTDA'],
  [/IRMAOS CR|AZ VESTUARIO/i, 'AZ VESTUARIO LTDA'],
  [/IRMAOS VAREJO/i, 'IRMAOS VAREJO COMERCIAL LTDA'],
  [/SERVICOS INTEGRADOS/i, 'SERVICOS INTEGRADOS'],
  [/RECIFE MALL/i, 'CROSBY RECIFE MALL LTDA'],
  [/CROSBY|FERREIRA COMERCIO/i, 'FERREIRA COMERCIO E CONFECCOES LTDA'],
];
const OUTRAS = 'OUTRAS CONTAS IMPORTADAS';
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const BANCOS_FORA = new Set(['PAGARME']); // adquirente, não entra na conciliação bancária

// ─── helpers ───────────────────────────────────────────────────
const fmt = (v) =>
  v != null && !Number.isNaN(Number(v))
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDoc = (d) => {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d || '';
};
const pad2 = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const ultimoDia = (y, m) => new Date(y, m, 0).getDate();

// "36733-8" → "367338" · conta "000578136635" + dv "7" → "5781366357"
const chaveConta = (conta, dv) => {
  const num = String(conta ?? '').replace(/\D/g, '').replace(/^0+/, '');
  const d = String(dv ?? '').replace(/\D/g, '');
  return num ? num + d : null;
};
const chavePlanilha = (c) => {
  if (!c.conta || c.conta === '-') return null;
  const [num, dv = ''] = String(c.conta).split('-');
  return chaveConta(num, dv);
};
// banco da planilha × banco importado: código FEBRABAN quando os dois têm; senão nome
const bancoBate = (c, fc) => {
  const cod = String(c.codigo ?? '').replace(/\D/g, '');
  const fcod = String(fc.banco_codigo ?? '').replace(/\D/g, '');
  if (cod && fcod) return Number(cod) === Number(fcod);
  return String(c.banco).toUpperCase().includes(String(fc.banco).toUpperCase());
};
const empresaDaConta = (fc) =>
  EMPRESA_POR_RAIZ[String(fc.titular_cnpj || '').slice(0, 8)] ||
  EMPRESA_POR_TITULAR.find(([re]) => re.test(String(fc.titular_nome || '')))?.[1] ||
  OUTRAS;

const BANCOS = {
  STONE: { label: 'Stone', cor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  SICREDI: { label: 'Sicredi', cor: 'bg-lime-100 text-lime-800 border-lime-300' },
  CAIXA: { label: 'Caixa', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
  MENTORE: { label: 'Mêntore', cor: 'bg-purple-100 text-purple-800 border-purple-300' },
  BNB: { label: 'BNB', cor: 'bg-red-100 text-red-800 border-red-300' },
  SANTANDER: { label: 'Santander', cor: 'bg-rose-100 text-rose-800 border-rose-300' },
  UNICRED: { label: 'Unicred', cor: 'bg-teal-100 text-teal-800 border-teal-300' },
  DAYCOVAL: { label: 'Daycoval', cor: 'bg-sky-100 text-sky-800 border-sky-300' },
  BRADESCO: { label: 'Bradesco', cor: 'bg-red-100 text-red-900 border-red-300' },
  ITAU: { label: 'Itaú', cor: 'bg-orange-100 text-orange-800 border-orange-300' },
  BB: { label: 'Banco do Brasil', cor: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};
const bancoCfg = (b) => BANCOS[b] || { label: b || '—', cor: 'bg-gray-100 text-gray-700 border-gray-300' };
const TIPOS = {
  ENTRADA: { label: 'Entrada', cor: 'bg-green-100 text-green-800 border-green-300', Icon: ArrowDown },
  SAIDA: { label: 'Saída', cor: 'bg-red-100 text-red-700 border-red-300', Icon: ArrowUp },
  TRANSFERENCIA: { label: 'Transf.', cor: 'bg-amber-100 text-amber-800 border-amber-300', Icon: ArrowsLeftRight },
};

const Badge = ({ cfg, children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${cfg.cor}`}>
    {children}
  </span>
);
const Kpi = ({ label, value, sub, tone = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-base md:text-lg font-bold mt-0.5 ${tone}`}>{value}</p>
    {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
  </div>
);
const Th = ({ children, right, className = '' }) => (
  <th className={`px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${className}`}>{children}</th>
);

// ─── página ────────────────────────────────────────────────────
const Conciliacao = () => {
  const hoje = new Date();
  const [ano] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(MESES[hoje.getMonth()]);
  const [de, setDe] = useState(iso(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const [ate, setAte] = useState(iso(hoje.getFullYear(), hoje.getMonth() + 1, ultimoDia(hoje.getFullYear(), hoje.getMonth() + 1)));

  const [busca, setBusca] = useState('');
  const [empresaFiltro, setEmpresaFiltro] = useState('todas');
  const [bancosSel, setBancosSel] = useState([]); // [] = todos

  const [fluxoContas, setFluxoContas] = useState([]);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [migrationPendente, setMigrationPendente] = useState(false);
  const [contaAberta, setContaAberta] = useState(null); // linha (o resumo é lido ao vivo de porContaId)
  const [editandoCta, setEditandoCta] = useState(null); // { fluxoId, valor }
  const [salvandoCta, setSalvandoCta] = useState(false);
  const [conciliando, setConciliando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const escolherMes = (m) => {
    setMes(m);
    if (m === 'ANO') {
      setDe(iso(ano, 1, 1));
      setAte(iso(ano, 12, 31));
      return;
    }
    const n = MESES.indexOf(m) + 1;
    setDe(iso(ano, n, 1));
    setAte(iso(ano, n, ultimoDia(ano, n)));
  };

  const carregarContas = useCallback(async () => {
    try {
      const r = await fetch(`${API}/contas`);
      const j = await r.json();
      if (j?.success) setFluxoContas((j.data || []).filter((f) => !BANCOS_FORA.has(f.banco)));
      else if (r.status === 503) setMigrationPendente(true);
    } catch (e) {
      console.error('contas do extrato:', e);
    }
  }, []);
  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

  const carregar = useCallback(async () => {
    if (!de || !ate) return;
    if (de > ate) {
      setErro('A data inicial não pode ser maior que a final.');
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`${API}/painel?${new URLSearchParams({ de, ate })}`);
      const j = await r.json();
      if (!j?.success) {
        if (r.status === 503 || j?.error === 'MIGRATION_PENDING') {
          setMigrationPendente(true);
          setDados(null);
          return;
        }
        throw new Error(j?.message || 'Falha ao buscar os extratos.');
      }
      setMigrationPendente(false);
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [de, ate]);
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  // ── planilha × contas importadas → linhas da tela ──
  const linhasBase = useMemo(() => {
    const ligados = new Set();
    const out = [];
    for (const c of CONTAS) {
      const k = chavePlanilha(c);
      if (!k) continue;
      const fc = fluxoContas.find((f) => chaveConta(f.conta, f.conta_dv) === k && bancoBate(c, f));
      if (!fc) continue; // sem extrato importado: fica fora da tela
      ligados.add(fc.id);
      out.push({ key: `P-${c.cta}`, empresa: c.empresa, ctaPlanilha: c.cta, cnpj: c.cnpj, banco: c.banco, codigo: c.codigo, ag: c.ag, conta: c.conta, fluxo: fc });
    }
    for (const f of fluxoContas) {
      if (ligados.has(f.id)) continue;
      out.push({
        key: `E-${f.id}`,
        empresa: empresaDaConta(f),
        ctaPlanilha: null,
        extra: true,
        cnpj: f.titular_cnpj ? fmtDoc(f.titular_cnpj) : '—',
        banco: `${bancoCfg(f.banco).label.toUpperCase()}${f.apelido ? ` · ${f.apelido}` : ''}`,
        codigo: f.banco_codigo && /^\d+$/.test(String(f.banco_codigo)) ? Number(f.banco_codigo) : '-',
        ag: f.agencia ? String(Number(f.agencia) || f.agencia) : '-',
        conta: `${f.conta}${f.conta_dv ? `-${f.conta_dv}` : ''}`,
        titular: f.titular_nome || null,
        fluxo: f,
      });
    }
    return out;
  }, [fluxoContas]);

  const bancosDisponiveis = useMemo(() => [...new Set(linhasBase.map((l) => l.fluxo.banco))].sort(), [linhasBase]);
  const empresasTodas = useMemo(() => {
    const lista = [...EMPRESAS];
    for (const l of linhasBase) if (!lista.includes(l.empresa)) lista.push(l.empresa);
    return lista;
  }, [linhasBase]);

  // resumo e lançamentos por conta importada (no período)
  const porContaId = useMemo(() => {
    const m = new Map();
    for (const a of dados?.porConta || []) m.set(a.contaId, { ...a, lancamentos: [] });
    for (const l of dados?.lancamentos || []) {
      if (!m.has(l.conta_id)) m.set(l.conta_id, { contaId: l.conta_id, entradas: 0, saidas: 0, transfEntradas: 0, transfSaidas: 0, qtd: 0, lancamentos: [] });
      m.get(l.conta_id).lancamentos.push(l);
    }
    return m;
  }, [dados]);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const sel = new Set(bancosSel);
    return linhasBase
      .map((l) => ({ ...l, resumo: porContaId.get(l.fluxo.id) || null, cta: l.fluxo.cta_totvs || l.ctaPlanilha || null }))
      .filter((l) => {
        if (empresaFiltro !== 'todas' && l.empresa !== empresaFiltro) return false;
        if (sel.size && !sel.has(l.fluxo.banco)) return false;
        if (q && !`${l.cta || ''} ${l.cnpj} ${l.banco} ${l.codigo} ${l.ag} ${l.conta} ${l.titular || ''} ${l.fluxo.apelido || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [linhasBase, porContaId, busca, empresaFiltro, bancosSel]);

  // grupos por empresa; dentro do grupo, contas com lançamentos primeiro
  const grupos = useMemo(
    () =>
      empresasTodas
        .map((e) => ({
          empresa: e,
          contas: linhas
            .filter((l) => l.empresa === e)
            .sort((a, b) => {
              const ta = a.resumo?.qtd ? 1 : 0;
              const tb = b.resumo?.qtd ? 1 : 0;
              if (ta !== tb) return tb - ta;
              return String(a.banco).localeCompare(String(b.banco)) || String(a.conta).localeCompare(String(b.conta));
            }),
        }))
        .filter((g) => g.contas.length),
    [linhas, empresasTodas],
  );

  const totais = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let qtd = 0;
    let comExtrato = 0;
    let pendencias = 0;
    let pendEntradas = 0;
    let pendSaidas = 0;
    for (const l of linhas) {
      const r = l.resumo;
      if (!r || !r.qtd) continue;
      comExtrato += 1;
      entradas += r.entradas + r.transfEntradas;
      saidas += r.saidas + r.transfSaidas;
      qtd += r.qtd;
      pendencias += r.pendencias || 0;
      pendEntradas += r.pendEntradas || 0;
      pendSaidas += r.pendSaidas || 0;
    }
    return { entradas, saidas, qtd, comExtrato, pendencias, pendEntradas, pendSaidas };
  }, [linhas]);

  // ── conciliação (chamadas ao backend; depois recarrega o painel) ──
  const apiConc = async (url, opts = {}) => {
    const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...headersUsuario(), ...(opts.headers || {}) } });
    const j = await r.json();
    if (!j?.success) throw new Error(j?.message || 'Falha na conciliação.');
    return j;
  };
  const conciliarAutomatico = async (contaId) => {
    setConciliando(true);
    setErro(null);
    try {
      const j = await apiConc(`${API}/conciliacao/automatica`, { method: 'POST', body: JSON.stringify({ contaId: contaId || null, de, ate }) });
      const r = j.data;
      setAviso(`${r.conciliadas.length} saída(s) conciliada(s) automaticamente · ${r.ambiguas.length} com mais de um candidato (resolva na linha) · ${r.semCandidato} sem candidato${r.avisos?.length ? ` · ${r.avisos.join('; ')}` : ''}`);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setConciliando(false);
    }
  };
  const salvarConciliacao = async (lancamentoId, origem, referencia, justificativa, pontuacao) => {
    await apiConc(`${API}/conciliacao`, { method: 'POST', body: JSON.stringify({ lancamentoId, origem, referencia, justificativa, pontuacao }) });
    await carregar();
  };
  const desfazerConciliacao = async (id) => {
    await apiConc(`${API}/conciliacao/${id}`, { method: 'DELETE' });
    await carregar();
  };
  const buscarCandidatos = async (lancamentoId) => (await apiConc(`${API}/conciliacao/candidatos?lancamentoId=${lancamentoId}`)).data;

  // ── CTA editável (salvo na conta importada) ──
  const salvarCta = async () => {
    if (!editandoCta) return;
    setSalvandoCta(true);
    try {
      const r = await fetch(`${API}/contas/${editandoCta.fluxoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cta_totvs: editandoCta.valor.trim() || null }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao salvar o CTA.');
      setFluxoContas((prev) => prev.map((f) => (f.id === editandoCta.fluxoId ? { ...f, cta_totvs: j.data?.cta_totvs ?? (editandoCta.valor.trim() || null) } : f)));
      setEditandoCta(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvandoCta(false);
    }
  };

  const td = 'px-3 py-2 text-xs whitespace-nowrap';
  const chip = (ativo, cor = 'bg-[#000638] text-white') =>
    `px-2.5 py-1.5 text-[0.7rem] font-medium rounded-md transition-colors border ${ativo ? `${cor} border-transparent` : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300'}`;

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle title="Conciliação" subtitle="Contas bancárias do grupo e o extrato importado de cada uma no período" icon={Bank} />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4 mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <CalendarBlank size={13} /> Data inicial
              </label>
              <input
                type="date"
                value={de}
                onChange={(e) => {
                  setDe(e.target.value);
                  setMes(null);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <CalendarBlank size={13} /> Data final
              </label>
              <input
                type="date"
                value={ate}
                onChange={(e) => {
                  setAte(e.target.value);
                  setMes(null);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Período ({ano})</label>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => escolherMes('ANO')} className={`${chip(mes === 'ANO')} px-4`}>
                ANO
              </button>
              {MESES.map((m) => (
                <button key={m} onClick={() => escolherMes(m)} className={chip(mes === m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Bancos {bancosSel.length ? `(${bancosSel.length} selecionado${bancosSel.length > 1 ? 's' : ''})` : '(todos)'}
            </label>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setBancosSel([])} className={chip(!bancosSel.length)}>
                Todos
              </button>
              {bancosDisponiveis.map((b) => {
                const ativo = bancosSel.includes(b);
                return (
                  <button
                    key={b}
                    onClick={() => setBancosSel((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))}
                    className={`px-2.5 py-1.5 text-[0.7rem] font-medium rounded-md border ${ativo ? `${bancoCfg(b).cor} ring-2 ring-offset-1 ring-blue-400` : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300'}`}
                  >
                    {bancoCfg(b).label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
            <div className="md:w-56">
              <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
              <select
                value={empresaFiltro}
                onChange={(e) => setEmpresaFiltro(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="todas">Todas ({linhasBase.length})</option>
                {empresasTodas.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:w-56">
              <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
              <div className="relative">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="CTA, CNPJ, banco, conta…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {migrationPendente && (
        <div className="flex items-start gap-2 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span>As tabelas do Extrato Bancário ainda não existem no banco. Rode a migration do fluxo de caixa para ligar os extratos.</span>
        </div>
      )}
      {aviso && (
        <div className="flex items-start gap-2 px-4 py-2.5 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          <CheckCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{aviso}</span>
          <button onClick={() => setAviso(null)} className="text-emerald-500 hover:text-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}
      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3 mb-4">
        <Kpi label="Período" value={`${fmtData(de)} a ${fmtData(ate)}`} sub={carregando ? 'carregando…' : `${totais.qtd} lançamentos`} />
        <Kpi label="Pendências" value={totais.pendencias} sub={`${totais.pendSaidas} saídas · ${totais.pendEntradas} entradas · ${totais.comExtrato} contas com lançamentos`} tone={totais.pendencias ? 'text-amber-700' : 'text-green-700'} />
        <Kpi label="Entradas" value={fmt(totais.entradas)} sub="inclui transferências recebidas" tone="text-green-700" />
        <Kpi label="Saídas" value={fmt(totais.saidas)} sub="inclui transferências enviadas" tone="text-red-600" />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <Th>CTA</Th>
                <Th>CNPJ</Th>
                <Th>Banco</Th>
                <Th right>Agência</Th>
                <Th right>Conta</Th>
                <Th right>Pendências</Th>
                <Th right>Saídas pend.</Th>
                <Th right>Entradas pend.</Th>
                <Th right>Entradas</Th>
                <Th right>Saídas</Th>
                <Th right>Saldo final</Th>
                <Th>Extrato</Th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-gray-400">
                    {linhasBase.length ? 'Nenhuma conta com esses filtros.' : 'Nenhuma conta com extrato importado. Importe os extratos na tela Extrato Bancário.'}
                  </td>
                </tr>
              ) : (
                grupos.map((g) => (
                  <React.Fragment key={g.empresa}>
                    <tr className={`border-b ${g.empresa === OUTRAS ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                      <td colSpan={12} className={`px-3 py-2 text-xs font-bold uppercase tracking-wide ${g.empresa === OUTRAS ? 'text-amber-900' : 'text-blue-900'}`}>
                        {g.empresa} <span className="font-normal opacity-70">· {g.contas.length} conta(s)</span>
                      </td>
                    </tr>
                    {g.contas.map((l) => {
                      const r = l.resumo;
                      const temExtrato = !!(r && r.qtd);
                      const abrir = () => temExtrato && setContaAberta(l);
                      const editando = editandoCta?.fluxoId === l.fluxo.id;
                      return (
                        <tr
                          key={l.key}
                          onClick={abrir}
                          className={`border-b border-gray-100 ${temExtrato ? 'cursor-pointer hover:bg-emerald-50' : 'text-gray-500 hover:bg-gray-50'}`}
                          title={temExtrato ? 'Clique para abrir o extrato' : 'Sem lançamentos no período'}
                        >
                          <td className={`${td} font-mono font-medium text-gray-800`} onClick={(e) => e.stopPropagation()}>
                            {editando ? (
                              <span className="inline-flex items-center gap-1">
                                <input
                                  autoFocus
                                  value={editandoCta.valor}
                                  onChange={(e) => setEditandoCta({ ...editandoCta, valor: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') salvarCta();
                                    if (e.key === 'Escape') setEditandoCta(null);
                                  }}
                                  placeholder="CTA"
                                  className="w-20 px-1.5 py-0.5 text-xs border border-blue-400 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <button onClick={salvarCta} disabled={salvandoCta} className="text-green-600 hover:text-green-800" title="Salvar">
                                  {salvandoCta ? <ArrowsClockwise size={14} className="animate-spin" /> : <Check size={14} weight="bold" />}
                                </button>
                                <button onClick={() => setEditandoCta(null)} className="text-gray-400 hover:text-gray-600" title="Cancelar">
                                  <X size={14} />
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setEditandoCta({ fluxoId: l.fluxo.id, valor: l.cta ? String(l.cta) : '' })}
                                className={`inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-blue-50 ${l.cta ? 'text-gray-800' : 'text-amber-700'}`}
                                title={l.cta ? 'Clique para alterar o CTA' : 'Clique para informar o CTA (código da conta no TOTVS)'}
                              >
                                {l.cta || <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[10px] font-sans">+ CTA</span>}
                                <PencilSimple size={11} className="opacity-40" />
                              </button>
                            )}
                          </td>
                          <td className={`${td} font-mono text-gray-600`}>{l.cnpj}</td>
                          <td className={`${td} text-gray-800`} title={l.titular || l.fluxo.titular_nome || ''}>
                            <span className="inline-flex items-center gap-1.5">
                              <Badge cfg={bancoCfg(l.fluxo.banco)}>{bancoCfg(l.fluxo.banco).label}</Badge>
                              {l.banco}
                            </span>
                            {l.extra && l.titular && <span className="block text-[10px] text-gray-400 font-normal">{l.titular}</span>}
                          </td>
                          <td className={`${td} text-right font-mono text-gray-600`}>{l.ag}</td>
                          <td className={`${td} text-right font-mono text-gray-800`}>{l.conta}</td>
                          <td className={`${td} text-right font-bold ${temExtrato ? (r.pendencias ? 'text-amber-700' : 'text-green-700') : 'text-gray-300'}`}>
                            {temExtrato ? (r.pendencias ? r.pendencias : <span className="inline-flex items-center gap-1"><CheckCircle size={13} weight="fill" /> 0</span>) : '—'}
                          </td>
                          <td className={`${td} text-right ${temExtrato && r.pendSaidas ? 'text-red-600' : 'text-gray-300'}`}>{temExtrato ? r.pendSaidas || 0 : '—'}</td>
                          <td className={`${td} text-right ${temExtrato && r.pendEntradas ? 'text-green-700' : 'text-gray-300'}`}>{temExtrato ? r.pendEntradas || 0 : '—'}</td>
                          <td className={`${td} text-right font-semibold ${temExtrato ? 'text-green-700' : 'text-gray-300'}`}>{temExtrato ? fmt(r.entradas + r.transfEntradas) : '—'}</td>
                          <td className={`${td} text-right font-semibold ${temExtrato ? 'text-red-600' : 'text-gray-300'}`}>{temExtrato ? fmt(r.saidas + r.transfSaidas) : '—'}</td>
                          <td className={`${td} text-right ${temExtrato ? 'text-gray-800' : 'text-gray-300'}`}>{temExtrato && r.saldoFinal != null ? fmt(r.saldoFinal) : '—'}</td>
                          <td className={td}>
                            {temExtrato ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrir();
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-[11px] font-medium"
                              >
                                <Bank size={12} /> Ver extrato
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400">sem lançamentos no período</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {linhas.length} conta(s) · {grupos.length} empresa(s)
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <Info size={13} /> Só aparecem contas com extrato importado. O CTA é salvo na conta e vale para todos os meses.
          </span>
          <button
            onClick={() => conciliarAutomatico(null)}
            disabled={conciliando || !totais.pendSaidas}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#000638] text-white hover:bg-blue-900 disabled:opacity-40 text-[11px] font-medium"
            title="Procura cada saída pendente de todas as contas em Liberação de Pagamento, Solicitações Crosby e Contas a Pagar; grava só as que batem com segurança"
          >
            {conciliando ? <ArrowsClockwise size={12} className="animate-spin" /> : <Lightning size={12} weight="fill" />} Conciliar saídas pendentes (todas as contas)
          </button>
        </div>
      </div>

      {contaAberta && (
        <ModalExtrato
          linha={contaAberta}
          resumo={porContaId.get(contaAberta.fluxo.id)}
          de={de}
          ate={ate}
          onClose={() => setContaAberta(null)}
          onConciliarConta={() => conciliarAutomatico(contaAberta.fluxo.id)}
          conciliando={conciliando}
          salvar={salvarConciliacao}
          desfazer={desfazerConciliacao}
          buscar={buscarCandidatos}
        />
      )}
    </div>
  );
};

// ─── modal: extrato da conta, linha a linha ────────────────────
const ModalExtrato = ({ linha: c, resumo, de, ate, onClose, onConciliarConta, conciliando, salvar, desfazer, buscar }) => {
  const fc = c.fluxo;
  const r = resumo || { lancamentos: [], entradas: 0, saidas: 0, transfEntradas: 0, transfSaidas: 0, qtd: 0, pendencias: 0, pendSaidas: 0, pendEntradas: 0 };
  const [tipo, setTipo] = useState('TODOS');
  const [situacao, setSituacao] = useState('PENDENTES'); // PENDENTES | OK | TODAS
  const [busca, setBusca] = useState('');
  const [picker, setPicker] = useState(null); // { lancamento, candidatos, avisos, decisao }
  const [justificando, setJustificando] = useState(null); // { lancamento, texto }
  const [ocupado, setOcupado] = useState(null); // id do lançamento em processamento
  const [erroModal, setErroModal] = useState(null);

  const conciliarLinha = async (l) => {
    setOcupado(l.id);
    setErroModal(null);
    try {
      const d = await buscar(l.id);
      if (d.decisao?.automatico && d.decisao.escolhido) {
        const esc = d.decisao.escolhido;
        await salvar(l.id, esc.origem, { id: esc.id, nome: esc.nome, doc: esc.doc, valor: esc.valor, data: esc.data, empresa: esc.empresa, detalhe: esc.detalhe, motivos: esc.motivos }, [esc.nome, esc.detalhe].filter(Boolean).join(' · '), esc.score);
      } else {
        setPicker({ lancamento: l, ...d });
      }
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const escolher = async (cand) => {
    const l = picker.lancamento;
    setOcupado(l.id);
    try {
      await salvar(l.id, cand.origem, { id: cand.id, nome: cand.nome, doc: cand.doc, valor: cand.valor, data: cand.data, empresa: cand.empresa, detalhe: cand.detalhe, motivos: cand.motivos }, [cand.nome, cand.detalhe].filter(Boolean).join(' · '), cand.score);
      setPicker(null);
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const salvarJustificativa = async () => {
    const { lancamento: l, texto } = justificando;
    if (!texto?.trim()) return;
    setOcupado(l.id);
    try {
      await salvar(l.id, 'MANUAL', null, texto.trim(), null);
      setJustificando(null);
      setPicker(null);
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const desfazerLinha = async (l) => {
    if (!l.conciliacao?.id) return;
    if (!window.confirm('Desfazer a conciliação desta linha?')) return;
    setOcupado(l.id);
    try {
      await desfazer(l.conciliacao.id);
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const lancamentos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (r.lancamentos || []).filter((l) => {
      if (tipo !== 'TODOS' && l.tipo !== tipo) return false;
      if (situacao === 'PENDENTES' && !l.pendente) return false;
      if (situacao === 'OK' && l.pendente) return false;
      if (q && !`${l.descricao} ${l.memo} ${l.nomeExibicao || ''} ${l.contraparte_nome || ''} ${l.documento || ''} ${l.forma} ${Math.abs(l.valor)} ${l.conciliacao?.justificativa || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [r, tipo, situacao, busca]);
  const qtdPend = (r.lancamentos || []).filter((l) => l.pendente).length;
  const qtdOk = (r.lancamentos || []).length - qtdPend;

  const tot = useMemo(
    () => ({
      c: lancamentos.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0),
      d: lancamentos.filter((l) => l.valor < 0).reduce((s, l) => s - l.valor, 0),
    }),
    [lancamentos],
  );

  const exportar = () => {
    const rows = lancamentos.map((l) => ({
      Data: l.data,
      Hora: l.hora || '',
      Tipo: TIPOS[l.tipo]?.label || l.tipo,
      Forma: l.forma,
      Histórico: l.descricao,
      'Contraparte / fornecedor': l.transferencia?.outraConta ? `${l.transferencia.sentido === 'SAIDA' ? '→' : '←'} ${l.transferencia.outraConta.apelido}` : l.nomeExibicao || '',
      'CNPJ/CPF': l.contraparte_doc || '',
      Banco: l.contraparte_banco || '',
      Documento: l.documento || '',
      Entrada: l.valor > 0 ? l.valor : '',
      Saída: l.valor < 0 ? -l.valor : '',
      'Saldo após': l.saldo_apos ?? '',
      Memo: l.memo || '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Extrato');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `extrato_${String(c.banco).replace(/[^\w]+/g, '_')}_${c.conta}_${de}_${ate}.xlsx`);
  };

  const bcfg = bancoCfg(fc.banco);
  const chip = (ativo, cor = 'bg-[#000638] text-white') =>
    `px-2.5 py-1 text-[11px] font-medium rounded-md border ${ativo ? `${cor} border-transparent` : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch md:items-center justify-center md:p-4" onClick={onClose}>
      <div className="relative bg-white w-full h-full md:h-[94vh] md:max-w-[96vw] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge cfg={bcfg}>{bcfg.label}</Badge>
              <h3 className="text-sm md:text-base font-bold text-gray-800">
                {c.banco} · ag {c.ag} · cc {c.conta}
              </h3>
              <span className="text-xs text-gray-500">{c.cta ? `CTA ${c.cta}` : 'sem CTA'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {c.empresa} · {c.cnpj}
              {fc.titular_nome ? ` · titular no extrato: ${fc.titular_nome}` : ''} · {fmtData(de)} a {fmtData(ate)}
            </p>
          </div>
          <button onClick={exportar} className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Export size={14} /> Excel
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" title="Fechar (Esc)">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <Kpi label="Saldo inicial" value={fmt(r.saldoInicial)} />
          <Kpi label="Entradas" value={fmt(r.entradas)} sub={`${r.qtd} lançamentos no total`} tone="text-green-700" />
          <Kpi label="Saídas" value={fmt(r.saidas)} tone="text-red-600" />
          <Kpi label="Transf. recebidas" value={fmt(r.transfEntradas)} tone="text-amber-700" />
          <Kpi label="Transf. enviadas" value={fmt(r.transfSaidas)} tone="text-amber-700" />
          <Kpi label="Saldo final" value={fmt(r.saldoFinal)} sub={r.ultimaData ? `em ${fmtData(r.ultimaData)}` : ''} tone="text-blue-700" />
        </div>
        {erroModal && (
          <div className="flex items-start gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700">
            <Warning size={14} className="shrink-0 mt-0.5" />
            <span className="flex-1">{erroModal}</span>
            <button onClick={() => setErroModal(null)} className="text-red-400">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-200">
          <button onClick={() => setSituacao('PENDENTES')} className={chip(situacao === 'PENDENTES', 'bg-amber-500 text-white')}>
            Pendentes ({qtdPend})
          </button>
          <button onClick={() => setSituacao('OK')} className={chip(situacao === 'OK', 'bg-green-600 text-white')}>
            OK ({qtdOk})
          </button>
          <button onClick={() => setSituacao('TODAS')} className={chip(situacao === 'TODAS')}>
            Todas ({r.lancamentos?.length || 0})
          </button>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={() => setTipo('TODOS')} className={chip(tipo === 'TODOS')}>
            Todos tipos
          </button>
          {Object.entries(TIPOS).map(([k, t]) => (
            <button key={k} onClick={() => setTipo(k)} className={chip(tipo === k, t.cor)}>
              {t.label} ({(r.lancamentos || []).filter((l) => l.tipo === k).length})
            </button>
          ))}
          <div className="relative ml-auto">
            <MagnifyingGlass size={13} className="absolute left-2 top-2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar histórico, nome, valor…"
              className="pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg w-56"
            />
          </div>
          <button
            onClick={onConciliarConta}
            disabled={conciliando || !r.pendSaidas}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#000638] text-white hover:bg-blue-900 disabled:opacity-40 text-[11px] font-medium"
            title="Procura todas as saídas pendentes desta conta nas três fontes e grava as que batem com segurança"
          >
            {conciliando ? <ArrowsClockwise size={12} className="animate-spin" /> : <Lightning size={12} weight="fill" />} Conciliar saídas pendentes ({r.pendSaidas || 0})
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm hidden md:table">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Forma</Th>
                <Th>Histórico</Th>
                <Th>Contraparte / fornecedor</Th>
                <Th>Banco contraparte</Th>
                <Th>Documento</Th>
                <Th right>Entrada</Th>
                <Th right>Saída</Th>
                <Th right>Saldo após</Th>
                <Th>Conciliação</Th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => {
                const tcfg = TIPOS[l.tipo] || TIPOS.SAIDA;
                return (
                  <tr key={l.id} className={`border-b border-gray-100 hover:bg-gray-50 text-xs ${l.tipo === 'TRANSFERENCIA' ? 'bg-amber-50/40' : ''} ${!l.pendente ? 'opacity-90' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtData(l.data)} <span className="text-gray-400">{l.hora?.slice(0, 5)}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge cfg={tcfg}>
                        <tcfg.Icon size={11} weight="bold" /> {tcfg.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{l.forma}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[260px] truncate" title={l.memo}>
                      {l.descricao}
                      {l.bandeira && <span className="ml-1 text-gray-400 font-normal">· {l.bandeira}</span>}
                      {l.loja && <span className="ml-1 text-gray-400 font-normal">· loja {l.loja}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[260px]">
                      {l.transferencia?.outraConta ? (
                        <span className="text-amber-800 font-medium" title={l.transferencia.outraConta.titular}>
                          {l.transferencia.sentido === 'SAIDA' ? '→ ' : '← '}
                          {l.transferencia.outraConta.apelido} ({bancoCfg(l.transferencia.outraConta.banco).label})
                          <span className="text-gray-400 font-normal"> · {l.nomeExibicao || ''}</span>
                        </span>
                      ) : (
                        <>
                          <span className="truncate block">{l.nomeExibicao || <span className="text-gray-300">—</span>}</span>
                          {l.contraparte_doc && <span className="text-gray-400 text-[11px]">{fmtDoc(l.contraparte_doc)}</span>}
                          {l.contraparteGrupo && (
                            <span className="ml-1 px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px]" title="CNPJ de uma empresa do grupo">
                              grupo
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={l.contraparte_banco || ''}>
                      {l.contraparte_banco || ''}
                    </td>
                    <td className="px-3 py-2 text-gray-400 max-w-[140px] truncate" title={l.documento || ''}>
                      {l.documento || ''}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">{l.valor > 0 ? fmt(l.valor) : ''}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600 whitespace-nowrap">{l.valor < 0 ? fmt(-l.valor) : ''}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${l.saldo_apos < 0 ? 'text-red-600' : 'text-gray-500'}`}>{l.saldo_apos != null ? fmt(l.saldo_apos) : ''}</td>
                    <td className="px-3 py-2 max-w-[300px]">
                      <CelulaConciliacao l={l} ocupado={ocupado === l.id} onConciliar={() => conciliarLinha(l)} onJustificar={() => setJustificando({ lancamento: l, texto: '' })} onDesfazer={() => desfazerLinha(l)} />
                    </td>
                  </tr>
                );
              })}
              {!lancamentos.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                    {situacao === 'PENDENTES' ? 'Nenhuma pendência com esses filtros — tudo conciliado.' : 'Nenhum lançamento com esses filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-50">
              <tr className="text-xs font-semibold">
                <td colSpan={7} className="px-3 py-2 text-right text-gray-500">
                  Total do filtro ({lancamentos.length})
                </td>
                <td className="px-3 py-2 text-right text-green-700">{fmt(tot.c)}</td>
                <td className="px-3 py-2 text-right text-red-600">{fmt(tot.d)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>

          <div className="md:hidden divide-y divide-gray-100">
            {lancamentos.map((l) => {
              const tcfg = TIPOS[l.tipo] || TIPOS.SAIDA;
              return (
                <div key={l.id} className="p-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{l.descricao}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {l.transferencia?.outraConta ? `${l.transferencia.sentido === 'SAIDA' ? '→' : '←'} ${l.transferencia.outraConta.apelido}` : l.nomeExibicao || l.memo}
                      </p>
                    </div>
                    <p className={`text-sm font-bold whitespace-nowrap ${l.valor < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {l.valor < 0 ? '−' : '+'}
                      {fmt(Math.abs(l.valor))}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-between gap-1 mt-1 text-[11px] text-gray-400">
                    <span>
                      {fmtData(l.data)} · {l.forma}
                      {l.saldo_apos != null ? ` · saldo ${fmt(l.saldo_apos)}` : ''}
                    </span>
                    <Badge cfg={tcfg}>{tcfg.label}</Badge>
                  </div>
                  <div className="mt-1.5">
                    <CelulaConciliacao l={l} ocupado={ocupado === l.id} onConciliar={() => conciliarLinha(l)} onJustificar={() => setJustificando({ lancamento: l, texto: '' })} onDesfazer={() => desfazerLinha(l)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* escolha de candidato / justificativa */}
        {(picker || justificando) && (
          <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center p-4" onClick={() => (picker ? setPicker(null) : setJustificando(null))}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {picker && !justificando && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800">Conciliar saída de {fmt(Math.abs(picker.lancamento.valor))} em {fmtData(picker.lancamento.data)}</h4>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {picker.lancamento.descricao} · {picker.lancamento.nomeExibicao || picker.lancamento.memo}
                      {picker.lancamento.contraparte_doc ? ` · ${fmtDoc(picker.lancamento.contraparte_doc)}` : ''}
                    </p>
                    {picker.decisao?.motivo && <p className="text-[11px] text-amber-700 mt-1">Não conciliado automaticamente: {picker.decisao.motivo}. Escolha abaixo ou justifique.</p>}
                    {picker.avisos?.length > 0 && <p className="text-[11px] text-red-600 mt-1">{picker.avisos.join(' · ')}</p>}
                  </div>
                  <div className="flex-1 overflow-auto">
                    {picker.candidatos?.length ? (
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <Th>Origem</Th>
                            <Th>Fornecedor / detalhe</Th>
                            <Th>Data</Th>
                            <Th right>Valor</Th>
                            <Th right>Pontos</Th>
                            <Th />
                          </tr>
                        </thead>
                        <tbody>
                          {picker.candidatos.map((cand) => (
                            <tr key={`${cand.origem}-${cand.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap">
                                <Badge cfg={origemCfg(cand.origem)}>{origemCfg(cand.origem).label}</Badge>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-800">{cand.nome || '(sem nome)'}{cand.doc ? <span className="text-gray-400 font-normal"> · {fmtDoc(cand.doc)}</span> : null}</div>
                                <div className="text-[11px] text-gray-500">{[cand.empresa, cand.detalhe].filter(Boolean).join(' · ')}</div>
                                <div className="text-[10px] text-emerald-700">{cand.motivos?.join(' · ')}</div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">{fmtData(cand.data)}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{fmt(cand.valor)}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{cand.score}</td>
                              <td className="px-3 py-2 text-right">
                                <button disabled={ocupado} onClick={() => escolher(cand)} className="px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                                  Usar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="p-6 text-center text-sm text-gray-400">Nenhum pagamento com este valor nas três fontes (±5 dias).</p>
                    )}
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 flex justify-between gap-2">
                    <button onClick={() => setJustificando({ lancamento: picker.lancamento, texto: '' })} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                      <ChatText size={13} /> Justificar manualmente
                    </button>
                    <button onClick={() => setPicker(null)} className="px-3 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100">
                      Fechar
                    </button>
                  </div>
                </>
              )}
              {justificando && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800">
                      Justificar {justificando.lancamento.valor < 0 ? 'saída' : 'entrada'} de {fmt(Math.abs(justificando.lancamento.valor))} em {fmtData(justificando.lancamento.data)}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{justificando.lancamento.descricao} · {justificando.lancamento.nomeExibicao || justificando.lancamento.memo}</p>
                  </div>
                  <div className="p-4">
                    <textarea
                      autoFocus
                      value={justificando.texto}
                      onChange={(e) => setJustificando({ ...justificando, texto: e.target.value })}
                      rows={3}
                      placeholder="O que foi este lançamento? (ex.: antecipação Stone, boleto cliente X, tarifa, reembolso…)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <button onClick={() => setJustificando(null)} className="px-3 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100">
                      Cancelar
                    </button>
                    <button disabled={!justificando.texto.trim() || ocupado} onClick={salvarJustificativa} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                      <Check size={13} weight="bold" /> Marcar como OK
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── célula de conciliação (OK / pendente + ações) ─────────────
const CelulaConciliacao = ({ l, ocupado, onConciliar, onJustificar, onDesfazer }) => {
  if (ocupado) return <ArrowsClockwise size={14} className="animate-spin text-blue-600" />;
  const c = l.conciliacao;
  if (c) {
    const cfg = origemCfg(c.origem);
    return (
      <div className="flex items-start gap-1.5">
        <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge cfg={cfg}>{cfg.label}</Badge>
            {c.automatico && c.origem !== 'TRANSFERENCIA' && <span className="text-[10px] text-gray-400">auto {c.pontuacao != null ? `· ${c.pontuacao} pts` : ''}</span>}
          </div>
          <div className="text-[11px] text-gray-600 truncate max-w-[260px]" title={c.justificativa || ''}>
            {c.justificativa || c.referencia?.nome || ''}
          </div>
          {c.usuario && <div className="text-[10px] text-gray-400">por {c.usuario}</div>}
        </div>
        {c.id && (
          <button onClick={onDesfazer} title="Desfazer conciliação" className="ml-auto text-gray-300 hover:text-red-600 shrink-0">
            <ArrowCounterClockwise size={13} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">Pendente</span>
      {l.valor < 0 ? (
        <button onClick={onConciliar} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#000638] text-white hover:bg-blue-900 text-[11px] font-medium" title="Buscar em Liberação de Pagamento, Solicitações Crosby e Contas a Pagar">
          <Lightning size={11} weight="fill" /> Conciliar
        </button>
      ) : null}
      <button onClick={onJustificar} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-[11px]" title="Justificar manualmente">
        <ChatText size={11} /> Justificar
      </button>
    </div>
  );
};

export default Conciliacao;
