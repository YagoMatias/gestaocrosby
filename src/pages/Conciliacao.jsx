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
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { supabaseAdmin } from '../lib/supabase';
import {
  Bank,
  MagnifyingGlass,
  Plus,
  FunnelSimple,
  CaretDown,
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
  Paperclip,
  FileText,
  FilePdf,
  UploadSimple,
  Eye,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import DESPESAS_TOTVS from '../config/despesas.json';
import { saveAs } from 'file-saver';

const FormularioSolicitacoes = lazy(() => import('./FormularioSolicitacoes'));

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
  BOLETO_TARIFA: { label: 'Boleto × tarifa', cor: 'bg-teal-100 text-teal-800 border-teal-300' },
  PIX_DEVOLVIDO: { label: 'Pix devolvido', cor: 'bg-rose-100 text-rose-800 border-rose-300' },
  PAGARME_SAQUE: { label: 'Saque Pagar.me', cor: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  CARTAO_ESTORNADO: { label: 'Compra estornada', cor: 'bg-orange-100 text-orange-800 border-orange-300' },
  APLICACAO_STONE: { label: 'Aplicação Stone', cor: 'bg-sky-100 text-sky-800 border-sky-300' },
  PRO_LABORE: { label: 'Pró-labore', cor: 'bg-purple-100 text-purple-800 border-purple-300' },
  LIBERACAO: { label: 'Liberação de Pagamento', cor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  SOLICITACAO: { label: 'Solicitações Crosby', cor: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  TOTVS_CP: { label: 'Contas a Pagar (TOTVS)', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
  STONE: { label: 'Vendas Stone', cor: 'bg-green-100 text-green-800 border-green-300' },
  REDE_DEPOSITO: { label: 'Depósito Rede', cor: 'bg-orange-100 text-orange-800 border-orange-300' },
  TOTVS_CR: { label: 'Contas a Receber (TOTVS)', cor: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  MANUAL: { label: 'Justificado', cor: 'bg-gray-100 text-gray-700 border-gray-300' },
  MULTIPLO: { label: 'Várias duplicatas', cor: 'bg-violet-100 text-violet-800 border-violet-300' },
  TECHFIN: { label: 'Pix Techfin', cor: 'bg-teal-100 text-teal-800 border-teal-300' },
  FOLHA: { label: 'Folha (Dryland)', cor: 'bg-lime-100 text-lime-800 border-lime-300' },
};
const origemCfg = (o) => ORIGENS[o] || { label: o || '—', cor: 'bg-gray-100 text-gray-700 border-gray-300' };
// referência gravada na conciliação (mesmos campos que o backend usa no lote)
const ehPixMaquininha = (l) => l.categoria === 'pix' && /MAQUININHA/i.test(`${l.descricao || ''} ${l.memo || ''}`);
const ehPixTotvs = (l) => l.categoria === 'pix' && /FISERV/i.test(l.contraparte_banco || ''); // QR Code gerado no TOTVS (líquido da taxa 0,79)
const ehPixCliente = (l) => l.valor > 0 && l.categoria === 'pix' && !l.transferencia_id && !/DEVOLU/i.test(l.descricao || '');
const podeConciliarLinha = (l, conta) => l.valor < 0 || ehPixCliente(l) || (String(conta?.banco || '').toUpperCase() === 'STONE' && ['antecipacao', 'cartao'].includes(l.categoria));
const PESSOAS_PRO_LABORE = [
  { id: 'fabio', pessoa: 'FABIO FERREIRA DE LIMA AZEVEDO', cpf: '06704197451', curto: 'Fabio' },
  { id: 'felipe', pessoa: 'FELIPE FERREIRA DE LIMA AZEVEDO', cpf: '06451367435', curto: 'Felipe' },
];
const refDe = (c) => ({ id: c.id, nome: c.nome, doc: c.doc, valor: c.valor, valorDuplicata: c.valorDuplicata ?? c.valor, parcial: !!c.parcial, restanteDepois: c.restanteDepois ?? null, data: c.data, vencimento: c.vencimento, empresa: c.empresa, detalhe: c.detalhe, duplicata: c.duplicata, motivos: c.motivos, ...(c.folha ? { folha: c.folha } : {}) });
const justDe = (c) => [c.parcial ? 'PARCIAL' : null, c.nome, c.detalhe].filter(Boolean).join(' · ');
const STORAGE_BUCKET = 'solicitacoes-crosby';
const uploadAnexo = async (file, prefix) => {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const fileName = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(fileName, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

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
// Seletor com múltipla escolha (checkboxes) — mesmo do Extrato Bancário
const MultiSelect = ({ label, opcoes, valor, onChange, renderOpcao, placeholder = 'Todos', larguraMin = 'min-w-[170px]', busca = false }) => {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aberto]);
  const visiveis = q ? opcoes.filter((o) => String(o.label).toLowerCase().includes(q.toLowerCase())) : opcoes;
  const toggle = (v) => onChange(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);
  const resumo = !valor.length ? placeholder : valor.length === 1 ? opcoes.find((o) => o.value === valor[0])?.label || String(valor[0]) : `${valor.length} selecionados`;
  return (
    <div ref={ref} className={`relative ${larguraMin}`}>
      <label className="block h-4 text-xs font-semibold mb-0.5 text-[#000638] leading-4">{label}</label>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`w-full h-9 flex items-center justify-between gap-2 px-2 text-xs border rounded-lg ${valor.length ? 'border-blue-400 bg-white text-blue-700 font-medium' : 'border-[#000638]/30 bg-[#f8f9fb] text-[#000638] hover:bg-white'}`}
      >
        <span className="truncate">{resumo}</span>
        <CaretDown size={12} className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="absolute z-40 mt-1 left-0 w-72 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-xl p-2 text-[13px] text-gray-800">
          {busca && (
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="w-full mb-2 px-2.5 py-1.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000638]" />
          )}
          <div className="flex justify-between mb-1.5 px-1 text-xs">
            <button type="button" onClick={() => onChange([...new Set([...valor, ...visiveis.map((o) => o.value)])])} className="text-blue-600 font-medium hover:underline">
              Marcar todos
            </button>
            <button type="button" onClick={() => onChange([])} className="text-gray-500 hover:underline">
              Limpar
            </button>
          </div>
          <div className="max-h-64 overflow-auto -mx-1 px-1">
            {visiveis.map((o) => (
              <label key={String(o.value)} className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-blue-50 cursor-pointer text-gray-800 border-b border-gray-50 last:border-0">
                <input type="checkbox" checked={valor.includes(o.value)} onChange={() => toggle(o.value)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0 w-4 h-4" />
                <span className="min-w-0 flex-1">{renderOpcao ? renderOpcao(o) : o.label}</span>
              </label>
            ))}
            {!visiveis.length && <p className="px-2 py-3 text-gray-400">Nada encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
const pontoBanco = (b) => (bancoCfg(b).cor.split(' ')[0] || 'bg-gray-100').replace('-100', '-500');

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
  PAGBANK: { label: 'PagBank', cor: 'bg-amber-100 text-amber-800 border-amber-300' },
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
// "Tarifas e afins" — MESMA regra do backend (services/tarifasConciliacao.js →
// motivoNaoTarifa). Entra tarifa/encargo/IOF/custas/juros e cancelamento de
// venda; fica de fora Pix, boleto, transferência, compra e fatura de cartão.
const semAcentoTar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const motivoNaoTarifa = (l) => {
  if (!l || Number(l.valor) >= 0) return 'não é saída';
  if (l.transferencia_id || l.tipo === 'TRANSFERENCIA') return 'transferência';
  const forma = semAcentoTar(l.forma).toUpperCase();
  const cat = String(l.categoria || '').toLowerCase();
  const txt = semAcentoTar(`${l.descricao || ''} ${l.memo || ''}`).toUpperCase();
  // tarifa vem antes: "TAR PIX" (Caixa) e "TARIFA BOLETO STONE" são tarifas
  if (/TARIFA|ENCARGO/.test(forma) || cat === 'tarifa' || /^TAR(IFA)?\b/.test(txt)) return null;
  if (/PIX/.test(forma) || cat === 'pix' || /\bPIX\b/.test(txt)) return 'Pix';
  if (/BOLETO/.test(forma) || cat === 'boleto' || cat === 'pagamento' || /\bBOLETO\b|PAGAMENTO DE TITULO|PAGTO\.? TITULO|LIQUIDACAO DE TITULO/.test(txt)) return 'pagamento de boleto';
  if (/TRANSFER/.test(forma) || cat === 'transferencia') return 'transferência';
  if (/FATURA/.test(forma) || /FATURA CARTAO|PAGAMENTO FATURA/.test(txt)) return 'fatura de cartão';
  if (/COMPRA CARTAO/.test(forma) || cat === 'cartao_compra' || /COMPRA CARTAO/.test(txt)) return 'compra no cartão';
  if (/TARIFA|ENCARGO/.test(forma) || cat === 'tarifa') return null;
  if (/\b(TARIFA|TAR\b|TAXA|IOF|ENCARGO|ENCARGOS|PROTESTO|CUSTAS|CARTORIO|MENSALIDADE|ANUIDADE|CESTA|MANUTENCAO DE CONTA|JUROS)\b/.test(txt)) return null;
  if (/CANCELAMENTO DE VENDA|ESTORNO DE VENDA|CHARGEBACK/.test(txt)) return null;
  return 'não é tarifa/encargo';
};
const ehTarifa = (l) => motivoNaoTarifa(l) === null;

// ─── janela "Saídas pendentes (todas as contas)" — João, 09/11/2026 ───
// lista TODAS as saídas pendentes de todas as contas com a sugestão de
// fornecedor (código TOTVS) e despesa (estudo do histórico do TOTVS), ambos
// editáveis; qualquer linha pode ser marcada; Excel de tudo que está na tela;
// cria as duplicatas (TOTVS + Solicitação + conciliação). Tarifa sem código
// digitado usa o banco da conta + 7008.
const nomeDespesa = (cod) => (cod ? DESPESAS_TOTVS[String(cod)] || null : null);
const ModalSaidasPendentes = ({ de, ate, onClose, onConcluido }) => {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [sel, setSel] = useState([]);
  const [busca, setBusca] = useState('');
  const [edit, setEdit] = useState({}); // id → { forn, desp }
  const [nomesForn, setNomesForn] = useState({}); // código → nome (consulta TOTVS)
  const [criando, setCriando] = useState(null);
  const [resultado, setResultado] = useState(null);
  const carregar = useCallback(async () => {
    setErro(null);
    setItens(null);
    try {
      const r = await fetch(`${API}/conciliacao/saidas-pendentes?de=${de}&ate=${ate}`, { headers: headersUsuario() });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao carregar as saídas pendentes.');
      const lista = j.data.itens || [];
      setItens(lista);
      setEdit((prev) => {
        const n = { ...prev };
        for (const i of lista) if (!n[i.id]) n[i.id] = { forn: i.sugestao?.fornecedorCodigo ? String(i.sugestao.fornecedorCodigo) : '', desp: i.sugestao?.despesaCodigo ? String(i.sugestao.despesaCodigo) : '' };
        return n;
      });
    } catch (e) {
      setErro(e.message);
      setItens([]);
    }
  }, [de, ate]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && !criando && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, criando]);

  const setCampo = (id, campo, v) => setEdit((p) => ({ ...p, [id]: { ...(p[id] || {}), [campo]: String(v).replace(/\D/g, '').slice(0, 9) } }));
  const buscarNomeForn = async (cod) => {
    const c = String(cod || '').replace(/\D/g, '');
    if (!c || nomesForn[c] !== undefined) return;
    setNomesForn((p) => ({ ...p, [c]: '…' }));
    try {
      const r = await fetch(`${API}/conciliacao/fornecedor/${c}`, { headers: headersUsuario() });
      const j = await r.json();
      setNomesForn((p) => ({
        ...p,
        [c]: j?.success
          ? `${j.data.nome || '(sem nome)'}${j.data.fornecedor === false ? ' ⚠ NÃO é fornecedor no TOTVS' : ''}`
          : 'não encontrado no TOTVS',
      }));
    } catch {
      setNomesForn((p) => ({ ...p, [c]: 'erro ao consultar' }));
    }
  };
  const nomeFornDe = (i) => {
    const c = edit[i.id]?.forn || '';
    if (!c) return i.tarifa ? `${i.banco} (banco da conta)` : '';
    if (nomesForn[c] !== undefined) return nomesForn[c];
    return String(i.sugestao?.fornecedorCodigo || '') === c ? i.sugestao.fornecedorNome : '';
  };
  const prontoParaCriar = (i) => i.tarifa || (edit[i.id]?.forn && edit[i.id]?.desp);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (itens || []).filter((i) => !q || `${i.empresa} ${i.banco} ${i.conta} ${i.descricao} ${i.memo || ''} ${i.contraparte || ''} ${i.valor} ${i.sugestao?.despesaNome || ''}`.toLowerCase().includes(q));
  }, [itens, busca]);
  const tarifas = visiveis.filter((i) => i.tarifa);
  const marcados = (itens || []).filter((i) => sel.includes(i.id));
  const totalSel = marcados.reduce((s, i) => s + i.valor, 0);
  const todasVisMarcadas = visiveis.length > 0 && visiveis.every((i) => sel.includes(i.id));
  const semDados = marcados.filter((i) => !prontoParaCriar(i)).length;

  const baixarExcel = () => {
    const rows = visiveis.map((i) => ({
      Empresa: i.empresa,
      Banco: i.banco,
      Conta: i.conta,
      Data: fmtData(i.data),
      Forma: i.forma,
      Histórico: i.descricao,
      Detalhe: i.memo,
      Contraparte: i.contraparte,
      'CPF/CNPJ contraparte': i.contraparteDoc,
      Valor: i.valor,
      Tipo: i.tarifa ? 'tarifa / afim' : i.motivoBloqueio,
      'Cód. fornecedor': edit[i.id]?.forn || '',
      Fornecedor: nomeFornDe(i),
      'Cód. despesa': edit[i.id]?.desp || '',
      Despesa: nomeDespesa(edit[i.id]?.desp) || '',
      'Sugestão (origem)': i.sugestao?.fonte || '',
      Marcada: sel.includes(i.id) ? 'sim' : '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Saídas pendentes');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `saidas_pendentes_${de}_a_${ate}.xlsx`);
  };

  const criarTodas = async () => {
    const prontos = marcados.filter(prontoParaCriar);
    if (!prontos.length) return;
    const total = prontos.reduce((s, i) => s + i.valor, 0);
    if (!window.confirm(`Criar ${prontos.length} duplicata(s) (total ${fmt(total)}) no TOTVS e na Solicitação Crosby e conciliar cada saída?${semDados ? `\n\n${semDados} marcada(s) sem fornecedor/despesa ficam de fora.` : ''}`)) return;
    const acc = { criadas: [], recusadas: [], total: 0 };
    setResultado(null);
    for (let k = 0; k < prontos.length; k += 10) {
      setCriando({ feitos: k, total: prontos.length });
      const lote = prontos.slice(k, k + 10).map((i) => ({ lancamentoId: i.id, fornecedorCodigo: edit[i.id]?.forn || null, despesaCodigo: edit[i.id]?.desp || null }));
      try {
        const r = await fetch(`${API}/conciliacao/tarifas`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersUsuario() }, body: JSON.stringify({ itens: lote }) });
        const j = await r.json();
        if (!j?.success) throw new Error(j?.message || 'Falha ao criar as duplicatas.');
        acc.criadas.push(...j.data.criadas);
        acc.recusadas.push(...j.data.recusadas);
        acc.total += j.data.total || 0;
      } catch (e) {
        acc.recusadas.push(...lote.map((x) => ({ lancamentoId: x.lancamentoId, motivo: e.message })));
      }
    }
    setCriando(null);
    setResultado(acc);
    setSel([]);
    await carregar();
    if (onConcluido) onConcluido();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 md:p-6 overflow-auto" onClick={() => !criando && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800">Saídas pendentes — todas as contas</h3>
            <p className="text-xs text-gray-500">
              {fmtData(de)} a {fmtData(ate)} · {itens ? `${itens.length} pendente(s) · ${(itens || []).filter((i) => i.tarifa).length} tarifa(s)` : 'carregando…'} · fornecedor e despesa vêm sugeridos pelo histórico do TOTVS — confira/edite antes de criar.
            </p>
          </div>
          <button onClick={() => !criando && onClose()} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap items-center gap-2 text-[11px]">
          <button onClick={() => setSel([...new Set([...sel, ...tarifas.map((i) => i.id)])])} disabled={!tarifas.length || !!criando} className="px-2.5 py-1.5 rounded-md border border-orange-300 text-orange-800 bg-orange-50 hover:bg-orange-100 disabled:opacity-40 font-medium">
            Selecionar tarifas ({tarifas.length})
          </button>
          <button onClick={() => setSel(todasVisMarcadas ? [] : visiveis.map((i) => i.id))} disabled={!visiveis.length || !!criando} className="px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 font-medium">
            {todasVisMarcadas ? 'Desmarcar todas' : `Selecionar todas (${visiveis.length})`}
          </button>
          <span className="text-gray-600">
            {marcados.length} marcada(s) · {fmt(totalSel)}
            {semDados ? <span className="text-amber-700"> · {semDados} sem fornecedor/despesa</span> : null}
          </span>
          <button onClick={baixarExcel} disabled={!visiveis.length} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 font-medium" title="Excel de todas as saídas pendentes na tela, com fornecedor e despesa sugeridos/editados">
            <Export size={12} /> Baixar Excel
          </button>
          <button onClick={criarTodas} disabled={!marcados.length || !!criando || marcados.length === semDados} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 font-medium">
            {criando ? <ArrowsClockwise size={12} className="animate-spin" /> : <Plus size={12} weight="bold" />} {criando ? `Criando ${criando.feitos}/${criando.total}…` : `Criar duplicatas (${marcados.length - semDados})`}
          </button>
          <div className="relative ml-auto">
            <MagnifyingGlass size={13} className="absolute left-2 top-2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar empresa, banco, histórico…" className="pl-7 pr-2 py-1.5 border border-gray-300 rounded-lg w-56" />
          </div>
        </div>
        {(erro || resultado) && (
          <div className={`px-4 py-2 text-[11px] ${erro || resultado?.recusadas?.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
            {erro ||
              `${resultado.criadas.length} duplicata(s) criada(s) e conciliada(s) (${fmt(resultado.total)})${resultado.recusadas.length ? ` · ${resultado.recusadas.length} recusada(s): ${resultado.recusadas.slice(0, 5).map((x) => `${x.valor != null ? fmt(x.valor) + ' ' : ''}${x.motivo}`).join('; ')}${resultado.recusadas.length > 5 ? '…' : ''}` : ''}.`}
          </div>
        )}
        <div className="max-h-[65vh] overflow-auto">
          {!itens ? (
            <p className="p-6 text-sm text-gray-400 flex items-center gap-2">
              <ArrowsClockwise size={14} className="animate-spin" /> Carregando as saídas pendentes e estudando as despesas no TOTVS…
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  <Th className="w-6">
                    <input type="checkbox" checked={todasVisMarcadas} disabled={!visiveis.length || !!criando} onChange={() => setSel(todasVisMarcadas ? [] : visiveis.map((i) => i.id))} className="accent-orange-600" title="Selecionar todas as linhas da tela" />
                  </Th>
                  <Th>Empresa</Th>
                  <Th>Banco / conta</Th>
                  <Th>Data</Th>
                  <Th>Histórico / contraparte</Th>
                  <Th right>Valor</Th>
                  <Th>Fornecedor (cód. TOTVS)</Th>
                  <Th>Despesa (cód.)</Th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => {
                  const e = edit[i.id] || {};
                  const nf = nomeFornDe(i);
                  const nd = nomeDespesa(e.desp);
                  return (
                    <tr key={i.id} className={`border-b border-gray-100 align-top ${sel.includes(i.id) ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={sel.includes(i.id)} disabled={!!criando} onChange={() => setSel((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))} className="accent-orange-600" />
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{i.empresa}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {i.banco} · {i.conta}
                        <div className="text-[10px] text-gray-400">{i.tarifa ? 'tarifa / afim' : i.motivoBloqueio}</div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(i.data)}</td>
                      <td className="px-3 py-1.5 max-w-[260px]">
                        {i.descricao}
                        {i.memo && i.memo !== i.descricao ? <span className="text-gray-400"> · {i.memo}</span> : null}
                        {i.contraparte ? <div className="text-gray-600">{i.contraparte}{i.contraparteDoc ? <span className="text-gray-400"> · {i.contraparteDoc}</span> : null}</div> : null}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-red-600 whitespace-nowrap">{fmt(i.valor)}</td>
                      <td className="px-3 py-1.5 min-w-[170px]">
                        <input value={e.forn || ''} onChange={(ev) => setCampo(i.id, 'forn', ev.target.value)} onBlur={(ev) => buscarNomeForn(ev.target.value)} placeholder={i.tarifa ? 'banco da conta' : 'código'} inputMode="numeric" className="w-24 px-1.5 py-0.5 border border-gray-300 rounded text-gray-800" />
                        <div className="text-[10px] text-gray-500 truncate max-w-[200px]" title={nf}>{nf}</div>
                      </td>
                      <td className="px-3 py-1.5 min-w-[190px]">
                        <input value={e.desp || ''} onChange={(ev) => setCampo(i.id, 'desp', ev.target.value)} placeholder={i.tarifa ? '7008' : 'código'} inputMode="numeric" className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-gray-800" />
                        <div className={`text-[10px] truncate max-w-[220px] ${e.desp && !nd ? 'text-red-600' : 'text-gray-500'}`} title={i.sugestao?.fonte || ''}>
                          {e.desp ? nd || 'código não está no cadastro' : i.tarifa ? 'TARIFAS BANCARIAS' : ''}
                          {i.sugestao?.fonte && String(i.sugestao.despesaCodigo || '') === String(e.desp || '') ? <span className="text-indigo-500"> · sugestão</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!visiveis.length && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400">
                      Nenhuma saída pendente no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── entrada → fatura no contas a receber já baixada (Inefável, 10/11/2026) ───
// contas de baixa do TOTVS (iguais às da Solicitação de Baixa)
const BANCOS_BAIXA_CR = [
  { id: 'confianca', label: 'Confiança (422)' },
  { id: 'sicredi', label: 'Sicredi (748)' },
];
const bancoBaixaPadraoCR = (banco) => (String(banco || '').toUpperCase() === 'SICREDI' ? 'sicredi' : 'confianca');
async function gerarFaturasEntradas(itens) {
  const acc = { criadas: [], recusadas: [], total: 0 };
  for (let k = 0; k < itens.length; k += 10) {
    const lote = itens.slice(k, k + 10);
    try {
      const r = await fetch(`${API}/conciliacao/faturas-entradas`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersUsuario() }, body: JSON.stringify({ itens: lote }) });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao gerar as faturas.');
      acc.criadas.push(...j.data.criadas);
      acc.recusadas.push(...j.data.recusadas);
      acc.total += j.data.total || 0;
    } catch (e) {
      acc.recusadas.push(...lote.map((x) => ({ lancamentoId: x.lancamentoId, motivo: e.message })));
    }
  }
  return acc;
}
const textoResultadoFaturas = (d) =>
  `${d.criadas.length} fatura(s) gerada(s), baixada(s) e conciliada(s) (${fmt(d.total)})${d.criadas.length ? ` — ${d.criadas.map((c) => c.fatura).join(', ')}` : ''}${d.recusadas.length ? ` · ${d.recusadas.length} recusada(s): ${d.recusadas.slice(0, 5).map((x) => `${x.valor != null ? fmt(x.valor) + ' ' : ''}${x.motivo}`).join('; ')}${d.recusadas.length > 5 ? '…' : ''}` : ''}`;
// nome da pessoa pelo código (mesma consulta do fornecedor das saídas)
async function nomePessoaTotvs(cod) {
  const c = String(cod || '').replace(/\D/g, '');
  if (!c) return '';
  try {
    const r = await fetch(`${API}/conciliacao/fornecedor/${c}`, { headers: headersUsuario() });
    const j = await r.json();
    return j?.success ? j.data.nome || '(sem nome)' : 'não encontrado no TOTVS';
  } catch {
    return 'erro ao consultar';
  }
}

// ─── "Entradas pendentes (todas as contas)" (Inefável, 10/11/2026) ───
const ModalEntradasPendentes = ({ de, ate, onClose, onConcluido }) => {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [sel, setSel] = useState([]);
  const [busca, setBusca] = useState('');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [cli, setCli] = useState({}); // id → código do cliente TOTVS
  const [nomesCli, setNomesCli] = useState({}); // código → nome
  const [bancoBaixa, setBancoBaixa] = useState(''); // '' = padrão pelo banco da conta
  const [codTodas, setCodTodas] = useState('');
  const buscarNomeCli = async (cod) => {
    const c = String(cod || '').replace(/\D/g, '');
    if (!c || nomesCli[c] !== undefined) return;
    setNomesCli((p) => ({ ...p, [c]: '…' }));
    const n = await nomePessoaTotvs(c);
    setNomesCli((p) => ({ ...p, [c]: n }));
  };
  const carregar = useCallback(async () => {
    setErro(null);
    setItens(null);
    try {
      const r = await fetch(`${API}/conciliacao/entradas-pendentes?de=${de}&ate=${ate}`, { headers: headersUsuario() });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao carregar as entradas pendentes.');
      setItens(j.data.itens || []);
    } catch (e) {
      setErro(e.message);
      setItens([]);
    }
  }, [de, ate]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && !salvando && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, salvando]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (itens || []).filter((i) => !q || `${i.empresa} ${i.banco} ${i.conta} ${i.forma} ${i.descricao} ${i.memo || ''} ${i.contraparte || ''} ${i.contraparteDoc || ''} ${i.valor}`.toLowerCase().includes(q));
  }, [itens, busca]);
  const totalVis = visiveis.reduce((s, i) => s + i.valor, 0);
  const marcados = (itens || []).filter((i) => sel.includes(i.id));
  const totalSel = marcados.reduce((s, i) => s + i.valor, 0);
  const todasVisMarcadas = visiveis.length > 0 && visiveis.every((i) => sel.includes(i.id));
  const porForma = useMemo(() => {
    const m = new Map();
    for (const i of visiveis) {
      const k = i.forma || 'OUTROS';
      const x = m.get(k) || { qtd: 0, valor: 0 };
      x.qtd += 1;
      x.valor += i.valor;
      m.set(k, x);
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor);
  }, [visiveis]);

  const baixarExcel = () => {
    const rows = visiveis.map((i) => ({
      Empresa: i.empresa,
      Banco: i.banco,
      Conta: i.conta,
      Data: fmtData(i.data),
      Forma: i.forma,
      Histórico: i.descricao,
      Detalhe: i.memo,
      Contraparte: i.contraparte,
      'CPF/CNPJ contraparte': i.contraparteDoc,
      Documento: i.documento,
      Valor: i.valor,
      'Cód. cliente': cli[i.id] || '',
      Cliente: cli[i.id] ? nomesCli[cli[i.id]] || '' : '',
      Marcada: sel.includes(i.id) ? 'sim' : '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Entradas pendentes');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `entradas_pendentes_${de}_a_${ate}.xlsx`);
  };

  const comCliente = marcados.filter((i) => cli[i.id]);
  const gerarFaturas = async () => {
    if (!comCliente.length) return;
    const total = comCliente.reduce((s, i) => s + i.valor, 0);
    const semCli = marcados.length - comCliente.length;
    if (!window.confirm(`Gerar ${comCliente.length} fatura(s) no contas a receber do TOTVS (total ${fmt(total)}), baixar cada uma em conta corrente${bancoBaixa ? ` (${BANCOS_BAIXA_CR.find((b) => b.id === bancoBaixa)?.label})` : ''} na data da entrada e conciliar?${semCli ? `\n\n${semCli} marcada(s) sem código do cliente ficam de fora.` : ''}`)) return;
    setResultado(null);
    setSalvando({ feitos: 0, total: comCliente.length });
    const d = await gerarFaturasEntradas(comCliente.map((i) => ({ lancamentoId: i.id, clienteCodigo: cli[i.id], banco: bancoBaixa || bancoBaixaPadraoCR(i.banco) })));
    setSalvando(null);
    setResultado({ ok: d.criadas.length, falhas: d.recusadas.map((x) => `${x.valor != null ? fmt(x.valor) + ' ' : ''}${x.motivo}`), texto: textoResultadoFaturas(d) });
    setSel([]);
    await carregar();
    if (onConcluido) onConcluido();
  };

  // justifica todas as marcadas com o mesmo texto (conciliação MANUAL, igual ao Justificar da conta)
  const justificarMarcadas = async () => {
    const t = texto.trim();
    if (!t || !marcados.length) return;
    if (!window.confirm(`Justificar ${marcados.length} entrada(s) (total ${fmt(totalSel)}) como:\n\n"${t}"?`)) return;
    const acc = { ok: 0, falhas: [] };
    setResultado(null);
    for (let k = 0; k < marcados.length; k++) {
      setSalvando({ feitos: k, total: marcados.length });
      const i = marcados[k];
      try {
        const r = await fetch(`${API}/conciliacao`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersUsuario() }, body: JSON.stringify({ lancamentoId: i.id, origem: 'MANUAL', referencia: null, justificativa: t }) });
        const j = await r.json();
        if (!j?.success) throw new Error(j?.message || 'falha');
        acc.ok += 1;
      } catch (e) {
        acc.falhas.push(`${fmt(i.valor)} ${fmtData(i.data)}: ${e.message}`);
      }
    }
    setSalvando(null);
    setResultado(acc);
    setSel([]);
    setTexto('');
    await carregar();
    if (onConcluido) onConcluido();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 md:p-6 overflow-auto" onClick={() => !salvando && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800">Entradas pendentes — todas as contas</h3>
            <p className="text-xs text-gray-500">
              {fmtData(de)} a {fmtData(ate)} · {itens ? `${visiveis.length} pendente(s) · ${fmt(totalVis)}` : 'carregando…'} · entradas sem conciliação (mesma regra da tela da conta)
            </p>
            {porForma.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {porForma.map(([f, x]) => (
                  <button key={f} onClick={() => setBusca(f)} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] hover:bg-emerald-100" title="Filtrar por esta forma">
                    {f}: {x.qtd} · {fmt(x.valor)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => !salvando && onClose()} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap items-center gap-2 text-[11px]">
          <button onClick={() => setSel(todasVisMarcadas ? [] : visiveis.map((i) => i.id))} disabled={!visiveis.length || !!salvando} className="px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 font-medium">
            {todasVisMarcadas ? 'Desmarcar todas' : `Selecionar todas (${visiveis.length})`}
          </button>
          <span className="text-gray-600">
            {marcados.length} marcada(s) · {fmt(totalSel)}
          </span>
          <button onClick={baixarExcel} disabled={!visiveis.length} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 font-medium">
            <Export size={12} /> Baixar Excel
          </button>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!!salvando} placeholder="Justificativa para as marcadas (ex.: rendimento, devolução Pix…)" className="px-2 py-1.5 border border-gray-300 rounded-lg w-72" />
          <button onClick={justificarMarcadas} disabled={!marcados.length || !texto.trim() || !!salvando} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 font-medium">
            {salvando ? <ArrowsClockwise size={12} className="animate-spin" /> : <Check size={12} weight="bold" />} {salvando ? `Salvando ${salvando.feitos}/${salvando.total}…` : `Justificar marcadas (${marcados.length})`}
          </button>
          <div className="relative ml-auto">
            <MagnifyingGlass size={13} className="absolute left-2 top-2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar empresa, banco, forma, histórico…" className="pl-7 pr-2 py-1.5 border border-gray-300 rounded-lg w-56" />
          </div>
        </div>
        <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap items-center gap-2 text-[11px] bg-sky-50/50">
          <span className="font-semibold text-sky-900">Gerar contas a receber:</span>
          <input value={codTodas} onChange={(e) => setCodTodas(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="cód. cliente" inputMode="numeric" className="w-24 px-1.5 py-1 border border-gray-300 rounded" />
          <button
            onClick={() => {
              if (!codTodas || !marcados.length) return;
              setCli((p) => ({ ...p, ...Object.fromEntries(marcados.map((i) => [i.id, codTodas])) }));
              buscarNomeCli(codTodas);
            }}
            disabled={!codTodas || !marcados.length || !!salvando}
            className="px-2 py-1 rounded-md border border-sky-300 text-sky-800 bg-white hover:bg-sky-50 disabled:opacity-40"
          >
            Usar nas marcadas ({marcados.length})
          </button>
          <select value={bancoBaixa} onChange={(e) => setBancoBaixa(e.target.value)} disabled={!!salvando} className="px-1.5 py-1 border border-gray-300 rounded">
            <option value="">Baixa: banco padrão da conta</option>
            {BANCOS_BAIXA_CR.map((b) => (
              <option key={b.id} value={b.id}>
                Baixa em {b.label}
              </option>
            ))}
          </select>
          <button onClick={gerarFaturas} disabled={!comCliente.length || !!salvando} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-40 font-medium" title="Cria a fatura no contas a receber do TOTVS no cliente informado, baixa em conta corrente na data da entrada e concilia">
            {salvando ? <ArrowsClockwise size={12} className="animate-spin" /> : <Plus size={12} weight="bold" />} Gerar fatura + baixa ({comCliente.length})
          </button>
          <span className="text-gray-500">fatura doc 1 · portador 1020 · nº 8 + id da linha</span>
        </div>
        {(erro || resultado) && (
          <div className={`px-4 py-2 text-[11px] ${erro || resultado?.falhas?.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
            {erro || resultado.texto || `${resultado.ok} entrada(s) justificada(s)${resultado.falhas.length ? ` · ${resultado.falhas.length} falha(s): ${resultado.falhas.slice(0, 5).join('; ')}${resultado.falhas.length > 5 ? '…' : ''}` : ''}.`}
          </div>
        )}
        <div className="max-h-[65vh] overflow-auto">
          {!itens ? (
            <p className="p-6 text-sm text-gray-400 flex items-center gap-2">
              <ArrowsClockwise size={14} className="animate-spin" /> Carregando as entradas pendentes de todas as contas…
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  <Th className="w-6">
                    <input type="checkbox" checked={todasVisMarcadas} disabled={!visiveis.length || !!salvando} onChange={() => setSel(todasVisMarcadas ? [] : visiveis.map((i) => i.id))} className="accent-emerald-600" />
                  </Th>
                  <Th>Empresa</Th>
                  <Th>Banco / conta</Th>
                  <Th>Data</Th>
                  <Th>Forma</Th>
                  <Th>Histórico / contraparte</Th>
                  <Th right>Valor</Th>
                  <Th>Cliente (cód. TOTVS)</Th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => (
                  <tr key={i.id} className={`border-b border-gray-100 align-top ${sel.includes(i.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={sel.includes(i.id)} disabled={!!salvando} onChange={() => setSel((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))} className="accent-emerald-600" />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{i.empresa}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {i.banco} · {i.conta}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(i.data)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{i.forma}</td>
                    <td className="px-3 py-1.5 max-w-[340px]">
                      {i.descricao}
                      {i.memo && i.memo !== i.descricao ? <span className="text-gray-400"> · {i.memo}</span> : null}
                      {i.contraparte ? (
                        <div className="text-gray-600">
                          {i.contraparte}
                          {i.contraparteDoc ? <span className="text-gray-400"> · {i.contraparteDoc}</span> : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmt(i.valor)}</td>
                    <td className="px-3 py-1.5 min-w-[170px]">
                      <input
                        value={cli[i.id] || ''}
                        onChange={(ev) => setCli((p) => ({ ...p, [i.id]: ev.target.value.replace(/\D/g, '').slice(0, 9) }))}
                        onBlur={(ev) => buscarNomeCli(ev.target.value)}
                        placeholder="código"
                        inputMode="numeric"
                        disabled={!!salvando}
                        className="w-24 px-1.5 py-0.5 border border-gray-300 rounded text-gray-800"
                      />
                      <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{cli[i.id] ? nomesCli[cli[i.id]] || '' : ''}</div>
                    </td>
                  </tr>
                ))}
                {!visiveis.length && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400">
                      Nenhuma entrada pendente no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Importar fatura do cartão (PagBank) — Titia, 11/11/2026 ───
const STATUS_PAG_FATURA = {
  pronta: { t: 'pronta para conciliar', c: 'bg-sky-100 text-sky-800' },
  conciliada: { t: 'conciliada', c: 'bg-green-100 text-green-800' },
  ja_conciliada: { t: 'já conciliada', c: 'bg-gray-100 text-gray-700' },
  aguardando_extrato: { t: 'aguardando extrato', c: 'bg-amber-100 text-amber-800' },
  sem_saida_no_extrato: { t: 'saída não achada', c: 'bg-amber-100 text-amber-800' },
  sem_lancamento: { t: 'compra sem lançamento', c: 'bg-red-100 text-red-700' },
  nao_fecha: { t: 'não fecha', c: 'bg-red-100 text-red-700' },
  erro: { t: 'erro', c: 'bg-red-100 text-red-700' },
};
const ModalFaturaCartao = ({ dados, ocupado, onConfirmar, onClose }) => {
  const f = dados.fatura;
  const prontas = dados.pagamentos.filter((p) => p.status === 'pronta');
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-3 md:p-6 overflow-auto" onClick={() => !ocupado && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800">
              Fatura do cartão {dados.conta.banco} {f.cartao ? `final ${f.cartao}` : ''} · vencimento {fmtData(f.vencimento)} · total {fmt(f.total)}
            </h3>
            <p className="text-xs text-gray-500">
              fatura anterior {fmt(f.faturaAnterior)} + compras {fmt(f.somaCompras)} − pagamentos {fmt(f.somaPagamentos)}{' '}
              {f.confere ? <span className="text-green-700 font-semibold">= total ✓</span> : <span className="text-red-600 font-semibold">≠ total — confira o PDF</span>}
              {dados.pagamentosFaturaAnterior?.length ? ` · ${dados.pagamentosFaturaAnterior.map((p) => `${fmtData(p.data)} ${fmt(p.valor)}`).join(', ')} pagou a fatura anterior (concilie importando a fatura anterior)` : ''}
            </p>
          </div>
          <button onClick={() => !ocupado && onClose()} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-auto p-4 space-y-4 text-xs">
          <div>
            <h4 className="font-semibold text-gray-700 mb-1">Pagamentos desta fatura</h4>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <Th>Pagamento</Th>
                  <Th right>Valor</Th>
                  <Th>Compras (títulos do contas a pagar)</Th>
                  <Th>Situação</Th>
                </tr>
              </thead>
              <tbody>
                {dados.pagamentos.map((p, i) => {
                  const st = STATUS_PAG_FATURA[p.status] || { t: p.status, c: 'bg-gray-100' };
                  return (
                    <tr key={i} className="border-b border-gray-100 align-top">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {fmtData(p.data)}
                        <div className="text-[10px] text-gray-500">{p.tipo === 'total' ? 'pagamento do total' : 'antecipado'}{p.distribuicao ? ` · ${p.distribuicao}` : ''}</div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">{fmt(p.valor)}</td>
                      <td className="px-3 py-1.5">
                        {p.compras.map((c, k) => (
                          <div key={k} className={c.status === 'ok' ? '' : 'text-red-600'}>
                            {fmtData(c.data)} {c.descricao} · {fmt(c.valor)}
                            {c.parcial ? ` (parte de ${fmt(c.valorCompra)})` : ''}
                            <span className="text-gray-400"> → {c.titulo ? `dup ${c.titulo.duplicata}/${c.titulo.parcela} ${c.titulo.fornecedor || ''}` : 'sem título no contas a pagar'}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${st.c}`}>{st.t}</span>
                        {p.motivo && <div className="text-[10px] text-gray-500 mt-0.5 max-w-[260px]">{p.motivo}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="font-semibold text-gray-700 mb-1">Compras da fatura</h4>
            <table className="w-full">
              <tbody>
                {dados.compras.map((c) => (
                  <tr key={c.n} className="border-b border-gray-100">
                    <td className="px-3 py-1 whitespace-nowrap">{fmtData(c.data)}</td>
                    <td className="px-3 py-1">{c.descricao}</td>
                    <td className="px-3 py-1 text-right whitespace-nowrap">{fmt(c.valor)}</td>
                    <td className={`px-3 py-1 ${c.titulo ? 'text-gray-600' : 'text-red-600 font-medium'}`}>
                      {c.titulo ? `empresa ${c.titulo.empresa} · dup ${c.titulo.duplicata}/${c.titulo.parcela} · ${c.titulo.fornecedor || ''}` : c.status === 'credito' ? 'crédito/estorno' : 'NÃO lançada no contas a pagar'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2 justify-end">
          <span className="text-[11px] text-gray-500 mr-auto">Só concilia pagamento com todas as compras lançadas no contas a pagar.</span>
          <button onClick={onClose} disabled={ocupado} className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
            Fechar
          </button>
          {dados.simulado && (
            <button onClick={onConfirmar} disabled={ocupado || !prontas.length} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-40 font-medium">
              {ocupado ? <ArrowsClockwise size={12} className="animate-spin" /> : <Check size={12} weight="bold" />} Conciliar {prontas.length} pagamento(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── lista "Adiantamentos a fornecedor" (Titia, 10/11/2026) ───
const ModalAdiantamentos = ({ onClose }) => {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/conciliacao/adiantamentos`, { headers: headersUsuario() });
        const j = await r.json();
        if (!j?.success) throw new Error(j?.message || 'Falha ao carregar os adiantamentos.');
        setItens(j.data.itens || []);
      } catch (e) {
        setErro(e.message);
        setItens([]);
      }
    })();
  }, []);
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  const visiveis = (itens || []).filter((i) => {
    const q = busca.trim().toLowerCase();
    return !q || `${i.fornecedor} ${i.empresa} ${i.conta} ${i.observacao || ''} ${i.valor}`.toLowerCase().includes(q);
  });
  const total = visiveis.reduce((s, i) => s + i.valor, 0);
  const exportar = () => {
    const rows = visiveis.map((i) => ({ Data: fmtData(i.data), Fornecedor: i.fornecedor, 'CPF/CNPJ': i.fornecedorDoc, Valor: i.valor, Empresa: i.empresa, Banco: i.banco, Conta: i.conta, Observação: i.observacao, 'Marcado por': i.usuario, 'Marcado em': i.marcadoEm ? String(i.marcadoEm).slice(0, 16).replace('T', ' ') : '' }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Adiantamentos');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), 'adiantamentos_a_fornecedor.xlsx');
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 md:p-6 overflow-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800">Adiantamentos a fornecedor</h3>
            <p className="text-xs text-gray-500">Pagamentos justificados na Conciliação como adiantamento (fornecedor ainda sem nota fiscal) · {visiveis.length} lançamento(s) · {fmt(total)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2 text-[11px]">
          <button onClick={exportar} disabled={!visiveis.length} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 font-medium">
            <Export size={12} /> Baixar Excel
          </button>
          <div className="relative ml-auto">
            <MagnifyingGlass size={13} className="absolute left-2 top-2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar fornecedor, empresa…" className="pl-7 pr-2 py-1.5 border border-gray-300 rounded-lg w-56" />
          </div>
        </div>
        {erro && <div className="px-4 py-2 text-[11px] bg-red-50 text-red-700">{erro}</div>}
        <div className="max-h-[65vh] overflow-auto">
          {!itens ? (
            <p className="p-6 text-sm text-gray-400 flex items-center gap-2">
              <ArrowsClockwise size={14} className="animate-spin" /> Carregando…
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <Th>Data</Th>
                  <Th>Fornecedor</Th>
                  <Th right>Valor</Th>
                  <Th>Empresa / conta</Th>
                  <Th>Observação</Th>
                  <Th>Marcado por</Th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => (
                  <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(i.data)}</td>
                    <td className="px-3 py-1.5">
                      {i.fornecedor}
                      {i.fornecedorDoc ? <span className="text-gray-400"> · {i.fornecedorDoc}</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-red-600 whitespace-nowrap">{fmt(i.valor)}</td>
                    <td className="px-3 py-1.5">
                      {i.empresa}
                      <div className="text-[10px] text-gray-400">{i.banco} · {i.conta}</div>
                    </td>
                    <td className="px-3 py-1.5">{i.observacao || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{i.usuario || '—'}</td>
                  </tr>
                ))}
                {!visiveis.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-400">
                      Nenhum adiantamento a fornecedor marcado ainda. No extrato da conta, use Justificar → "Adiantamento a fornecedor".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const Th = ({ children, right, className = '' }) => (
  <th className={`px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${className}`}>{children}</th>
);

// ─── página ────────────────────────────────────────────────────
const Conciliacao = () => {
  const hoje = new Date();
  const [ano] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(MESES[hoje.getMonth()]);
  // formulário (o que o usuário digita) × aplicado (o que foi buscado ao clicar em Buscar)
  const [deForm, setDeForm] = useState(iso(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const [ateForm, setAteForm] = useState(iso(hoje.getFullYear(), hoje.getMonth() + 1, ultimoDia(hoje.getFullYear(), hoje.getMonth() + 1)));
  const [de, setDe] = useState(null);
  const [ate, setAte] = useState(null);
  const [filtrosAplicados, setFiltrosAplicados] = useState({ bancos: [], empresas: [], busca: '' });

  const [busca, setBusca] = useState('');
  const [empresasSel, setEmpresasSel] = useState([]); // [] = todas
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
      setDeForm(iso(ano, 1, 1));
      setAteForm(iso(ano, 12, 31));
      return;
    }
    const n = MESES.indexOf(m) + 1;
    setDeForm(iso(ano, n, 1));
    setAteForm(iso(ano, n, ultimoDia(ano, n)));
  };
  const buscar = () => {
    if (!deForm || !ateForm) return;
    if (deForm > ateForm) {
      setErro('A data inicial não pode ser maior que a final.');
      return;
    }
    setErro(null);
    setDe(deForm);
    setAte(ateForm);
    setFiltrosAplicados({ bancos: bancosSel, empresas: empresasSel, busca });
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

  // aquece as fontes de conciliação do período em segundo plano (a consulta ao
  // TOTVS leva dezenas de segundos na primeira vez; depois fica em cache)
  const [fontesProntas, setFontesProntas] = useState(null);
  useEffect(() => {
    if (!de || !ate || de > ate) return undefined;
    let cancelado = false;
    setFontesProntas(null);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/conciliacao/preparar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ de, ate }) });
        const j = await r.json();
        if (!cancelado && j?.success) setFontesProntas(j.data);
      } catch {
        /* silencioso: a busca por linha carrega sob demanda */
      }
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [de, ate]);

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
    if (!dados) return []; // nada carregado ainda: só depois de Buscar
    const q = filtrosAplicados.busca.trim().toLowerCase();
    const sel = new Set(filtrosAplicados.bancos);
    const empresasSel = filtrosAplicados.empresas;
    return linhasBase
      .map((l) => ({ ...l, resumo: porContaId.get(l.fluxo.id) || null, cta: l.fluxo.cta_totvs || l.ctaPlanilha || null }))
      .filter((l) => {
        if (empresasSel.length && !empresasSel.includes(l.empresa)) return false;
        if (sel.size && !sel.has(l.fluxo.banco)) return false;
        if (q && !`${l.cta || ''} ${l.cnpj} ${l.banco} ${l.codigo} ${l.ag} ${l.conta} ${l.titular || ''} ${l.fluxo.apelido || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [linhasBase, porContaId, dados, filtrosAplicados]);

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
  const [importandoTechfin, setImportandoTechfin] = useState(false);
  const [saidasPendAberta, setSaidasPendAberta] = useState(false);
  const [entradasPendAberta, setEntradasPendAberta] = useState(false); // janela "Entradas pendentes (todas as contas)"
  const [adiantAberto, setAdiantAberto] = useState(false); // lista "Adiantamentos a fornecedor"
  const importarTechfin = async (arquivos) => {
    if (!arquivos?.length) return;
    setImportandoTechfin(true);
    setErro(null);
    try {
      const fd = new FormData();
      for (const f of arquivos) fd.append('arquivos', f);
      const r = await fetch(`${API}/conciliacao/techfin`, { method: 'POST', body: fd, headers: headersUsuario() });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao importar o relatório da Techfin.');
      const d = j.data;
      const partes = [
        `Techfin: ${d.repasses} repasse(s) e ${d.pix} Pix em ${d.arquivos.length} arquivo(s) (${d.periodo.de} a ${d.periodo.ate})`,
        `${d.totais.conciliadas} linha(s) conciliada(s) agora (${fmt(d.totais.valorConciliado)})`,
        `${d.totais.jaConciliadas} já estavam conciliadas`,
        d.totais.semLinha ? `${d.totais.semLinha} repasse(s) sem crédito no extrato: ${d.semLinha.slice(0, 6).map((x) => `${fmtData(x.data)} ${x.conta} ${fmt(x.valor)}`).join('; ')}${d.semLinha.length > 6 ? '…' : ''}` : null,
        d.totais.semConta ? `${d.totais.semConta} repasse(s) sem conta cadastrada` : null,
        d.titulosNaoLocalizados ? `${d.titulosNaoLocalizados} Pix sem título PIX no TOTVS (conciliados como Pix Techfin)` : null,
        ...(d.avisos || []),
      ].filter(Boolean);
      setAviso(partes.join(' · '));
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setImportandoTechfin(false);
    }
  };
  const salvarConciliacao = async (lancamentoId, origem, referencia, justificativa, pontuacao) => {
    const j = await apiConc(`${API}/conciliacao`, { method: 'POST', body: JSON.stringify({ lancamentoId, origem, referencia, justificativa, pontuacao }) });
    await carregar();
    return j?.data || null;
  };
  const desfazerConciliacao = async (id) => {
    await apiConc(`${API}/conciliacao/${id}`, { method: 'DELETE' });
    await carregar();
  };
  const justificarConciliacao = async (id, justificativa) => {
    await apiConc(`${API}/conciliacao/${id}/justificativa`, { method: 'PATCH', body: JSON.stringify({ justificativa }) });
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

      {/* Filtros — mesmo padrão do Extrato Bancário: 1ª linha De/Até + período; 2ª linha Banco, Empresa, pesquisa e Buscar */}
      {(() => {
        const filtrosAtivos = bancosSel.length + empresasSel.length + (busca ? 1 : 0);
        const limparFiltros = () => {
          setBusca('');
          setBancosSel([]);
          setEmpresasSel([]);
          setFiltrosAplicados({ bancos: [], empresas: [], busca: '' });
        };
        const inp = 'w-full h-9 px-2 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]';
        const lbl = 'block h-4 text-xs font-semibold mb-0.5 text-[#000638] leading-4';
        return (
          <div className="bg-white rounded-lg shadow-lg border border-[#000638]/10 p-3 md:p-4 mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm font-bold text-[#000638] flex items-center gap-1.5 mr-auto">
                <FunnelSimple size={16} weight="bold" /> Filtros
                {filtrosAtivos > 0 && (
                  <button onClick={limparFiltros} className="ml-2 text-xs font-normal text-blue-600 hover:underline">
                    limpar ({filtrosAtivos})
                  </button>
                )}
              </span>
              {dados && (
                <span className="text-xs text-gray-500">
                  {linhas.length} conta{linhas.length === 1 ? '' : 's'} · {fmtData(de)} a {fmtData(ate)}
                </span>
              )}
            </div>

            {/* 1ª linha: De, Até e período */}
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-2.5 items-center mb-2.5">
              <div className="lg:col-span-2">
                <label className={lbl}>De</label>
                <input
                  type="date"
                  value={deForm}
                  onChange={(e) => {
                    setDeForm(e.target.value);
                    setMes(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && buscar()}
                  className={inp}
                />
              </div>
              <div className="lg:col-span-2">
                <label className={lbl}>Até</label>
                <input
                  type="date"
                  value={ateForm}
                  onChange={(e) => {
                    setAteForm(e.target.value);
                    setMes(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && buscar()}
                  className={inp}
                />
              </div>
              <div className="col-span-2 lg:col-span-8">
                <label className={lbl}>Período ({ano})</label>
                <div className="flex flex-wrap gap-1 min-h-9 items-center">
                  <button onClick={() => escolherMes('ANO')} className={`${chip(mes === 'ANO')} px-3`}>
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

            {/* 2ª linha: Banco, Empresa, pesquisa e Buscar */}
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-2.5 items-center">
              <MultiSelect
                label="Banco"
                opcoes={bancosDisponiveis.map((b) => ({ value: b, label: bancoCfg(b).label, banco: b }))}
                valor={bancosSel}
                onChange={setBancosSel}
                renderOpcao={(o) => (
                  <span className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${pontoBanco(o.banco)}`} />
                    <span className="truncate">{o.label}</span>
                  </span>
                )}
                placeholder="Todos os bancos"
                larguraMin="w-full lg:col-span-3"
              />
              <MultiSelect
                label="Empresa"
                busca
                opcoes={empresasTodas.map((e) => ({ value: e, label: e }))}
                valor={empresasSel}
                onChange={setEmpresasSel}
                placeholder={`Todas (${linhasBase.length})`}
                larguraMin="w-full lg:col-span-3"
              />
              <div className="col-span-2 lg:col-span-4">
                <label className={lbl}>Pesquisar</label>
                <div className="relative">
                  <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscar()}
                    placeholder="CTA, CNPJ, banco, conta ou titular…"
                    className={`${inp} pl-8 pr-7`}
                  />
                  {busca && (
                    <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="col-span-2 lg:col-span-2">
                <label className={lbl} aria-hidden="true">
                  &nbsp;
                </label>
                <button
                  onClick={buscar}
                  disabled={carregando || !deForm || !ateForm}
                  className="w-full h-9 px-4 text-xs rounded-lg bg-[#000638] text-white hover:bg-[#000638]/90 disabled:opacity-50 flex items-center justify-center gap-1 font-semibold"
                >
                  {carregando ? <ArrowsClockwise size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} {carregando ? 'Buscando…' : 'Buscar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
        <Kpi
          label="Pendências"
          value={totais.pendencias}
          sub={`${totais.pendSaidas} saídas · ${totais.pendEntradas} entradas · ${fontesProntas ? `fontes prontas (${fontesProntas.liberacao} liberações, ${fontesProntas.totvs} pagas no TOTVS)` : 'carregando fontes de pagamento…'}`}
          tone={totais.pendencias ? 'text-amber-700' : 'text-green-700'}
        />
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
                    {!dados ? (carregando ? 'Buscando…' : 'Escolha o período e os filtros e clique em Buscar.') : linhasBase.length ? 'Nenhuma conta com esses filtros.' : 'Nenhuma conta com extrato importado. Importe os extratos na tela Extrato Bancário.'}
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
          <label
            className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100 text-[11px] font-medium cursor-pointer ${importandoTechfin ? 'opacity-50 pointer-events-none' : ''}`}
            title="Relatórios da Techfin Pagamentos (Pix TOTVS): Relatório de Transações e/ou extrato da conta de cada loja (CSV). Cada repasse vira a conciliação do crédito 'RECEBIMENTO PIX … FISERV' com os títulos PIX do contas a receber"
          >
            {importandoTechfin ? <ArrowsClockwise size={12} className="animate-spin" /> : <Lightning size={12} weight="fill" />} Importar relatórios Techfin (Pix TOTVS)
            <input type="file" accept=".csv,text/csv" multiple className="hidden" disabled={importandoTechfin} onChange={(e) => { importarTechfin(Array.from(e.target.files || [])); e.target.value = ''; }} />
          </label>
          <button
            onClick={() => setEntradasPendAberta(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 text-[11px] font-medium"
            title="Todas as entradas sem conciliação de todas as contas no período"
          >
            <ArrowDown size={12} /> Entradas pendentes (todas as contas)
          </button>
          <button
            onClick={() => setAdiantAberto(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 text-[11px] font-medium"
            title="Pagamentos justificados como adiantamento a fornecedor (ainda sem nota fiscal)"
          >
            <FileText size={12} /> Adiantamentos a fornecedor
          </button>
          <button
            onClick={() => setSaidasPendAberta(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-600 text-white hover:bg-orange-700 text-[11px] font-medium"
            title="Abre a lista de saídas pendentes de todas as contas: selecione as tarifas e afins, baixe o Excel e crie as duplicatas (TOTVS + Solicitação Crosby) de uma vez"
          >
            <Plus size={12} weight="bold" /> Saídas pendentes (todas as contas)
          </button>
          <button
            onClick={() => conciliarAutomatico(null)}
            disabled={conciliando || !totais.pendSaidas}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#000638] text-white hover:bg-blue-900 disabled:opacity-40 text-[11px] font-medium"
            title="Procura cada saída pendente de todas as contas em Liberação de Pagamento, Solicitações Crosby e Contas a Pagar; grava só as que batem com segurança"
          >
            {conciliando ? <ArrowsClockwise size={12} className="animate-spin" /> : <Lightning size={12} weight="fill" />} Conciliar saídas pendentes (todas as contas)
          </button>
        </div>
      </div>

      {entradasPendAberta && <ModalEntradasPendentes de={de} ate={ate} onClose={() => setEntradasPendAberta(false)} onConcluido={carregar} />}
      {adiantAberto && <ModalAdiantamentos onClose={() => setAdiantAberto(false)} />}
      {saidasPendAberta && <ModalSaidasPendentes de={de} ate={ate} onClose={() => setSaidasPendAberta(false)} onConcluido={carregar} />}
      {contaAberta && (
        <ModalExtrato
          linha={contaAberta}
          resumo={porContaId.get(contaAberta.fluxo.id)}
          de={de}
          ate={ate}
          onClose={() => setContaAberta(null)}
          onConciliarConta={() => conciliarAutomatico(contaAberta.fluxo.id)}
          onRecarregar={carregar}
          conciliando={conciliando}
          salvar={salvarConciliacao}
          desfazer={desfazerConciliacao}
          justificar={justificarConciliacao}
          buscar={buscarCandidatos}
        />
      )}
    </div>
  );
};

// ─── modal: extrato da conta, linha a linha ────────────────────
const ModalExtrato = ({ linha: c, resumo, de, ate, onClose, onConciliarConta, onRecarregar, conciliando, salvar, desfazer, justificar, buscar }) => {
  const fc = c.fluxo;
  const r = resumo || { lancamentos: [], entradas: 0, saidas: 0, transfEntradas: 0, transfSaidas: 0, qtd: 0, pendencias: 0, pendSaidas: 0, pendEntradas: 0 };
  const [tipo, setTipo] = useState('TODOS');
  const [situacao, setSituacao] = useState('PENDENTES'); // PENDENTES | OK | TODAS | PROLABORE
  const [selLinhas, setSelLinhas] = useState([]); // ids de saídas pendentes marcadas para mandar ao pró-labore
  const proLabore = useMemo(() => (r.lancamentos || []).filter((l) => l.proLabore || l.conciliacao?.origem === 'PRO_LABORE'), [r]);
  const mandarProLabore = async (pessoaId) => {
    const saidasSel = (r.lancamentos || []).filter((l) => selLinhas.includes(l.id) && l.valor < 0).map((l) => l.id);
    if (!saidasSel.length) return;
    const pessoa = PESSOAS_PRO_LABORE.find((p) => p.id === pessoaId);
    setOcupado('lote');
    try {
      for (const id of saidasSel) await salvar(id, 'PRO_LABORE', { pessoaId: pessoa.id, pessoa: pessoa.pessoa, cpf: pessoa.cpf }, null, null);
      setSelLinhas([]);
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const [busca, setBusca] = useState('');
  // conciliar ENTRADAS pelo CSV do extrato Stone (antecipações/recebíveis/Pix) — João, 09/11/2026
  const csvRef = useRef(null);
  const [csvMsg, setCsvMsg] = useState(null); // { ok, texto }
  const [csvOcupado, setCsvOcupado] = useState(false);
  const conciliarEntradasCsv = async (arquivo) => {
    if (!arquivo) return;
    setCsvOcupado(true);
    setCsvMsg(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('contaId', String(c.fluxo.id));
      const resp = await fetch(`${API}/conciliacao/entradas-csv`, { method: 'POST', body: fd, headers: headersUsuario() });
      const j = await resp.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao conciliar pelo extrato.');
      const d = j.data;
      const cats = Object.entries(d.porCategoria || {}).map(([k, v]) => `${k.toLowerCase().replace('_', ' ')} ${fmt(v)}`).join(' · ');
      setCsvMsg({
        ok: true,
        texto: `Extrato ${fmtData(d.periodo.de)} a ${fmtData(d.periodo.ate)}: ${d.conciliadas.length} de ${d.pendentes} entrada(s) pendente(s) conciliada(s) (${fmt(d.valorConciliado)})${cats ? ` — ${cats}` : ''}${d.semLinha.length ? ` · ${d.semLinha.length} sem linha no arquivo` : ''}${d.erros.length ? ` · ${d.erros.length} com erro` : ''}`,
      });
      if (onRecarregar) await onRecarregar();
    } catch (e) {
      setCsvMsg({ ok: false, texto: e.message });
    } finally {
      setCsvOcupado(false);
      if (csvRef.current) csvRef.current.value = '';
    }
  };
  // fatura do cartão (PagBank) → concilia os pagamentos — Titia, 11/11/2026
  const faturaRef = useRef(null);
  const [fatura, setFatura] = useState(null); // { arquivo, dados }
  const [faturaOcupado, setFaturaOcupado] = useState(false);
  const enviarFatura = async (arquivo, simular) => {
    if (!arquivo) return;
    setFaturaOcupado(true);
    setCsvMsg(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('contaId', String(c.fluxo.id));
      fd.append('simular', simular ? 'true' : 'false');
      const resp = await fetch(`${API}/conciliacao/fatura-cartao`, { method: 'POST', body: fd, headers: headersUsuario() });
      const j = await resp.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao ler a fatura.');
      setFatura({ arquivo, dados: j.data });
      if (!simular) {
        const n = j.data.pagamentos.filter((p) => p.status === 'conciliada').length;
        setCsvMsg({ ok: true, texto: `Fatura ${fmtData(j.data.fatura.vencimento)}: ${n} pagamento(s) conciliado(s).` });
        if (onRecarregar) await onRecarregar();
      }
    } catch (e) {
      setCsvMsg({ ok: false, texto: e.message });
      setFatura(null);
    } finally {
      setFaturaOcupado(false);
      if (faturaRef.current) faturaRef.current.value = '';
    }
  };
  // tarifas marcadas → duplicata TOTVS + Solicitação + conciliação (João, 09/11/2026)
  const [criandoTarifas, setCriandoTarifas] = useState(false);
  const criarDuplicatasTarifas = async (ids) => {
    if (!ids.length) return;
    const linhas = (r.lancamentos || []).filter((l) => ids.includes(l.id));
    const total = linhas.reduce((s, l) => s + Math.abs(l.valor), 0);
    if (!window.confirm(`Criar ${ids.length} duplicata(s) de tarifa (total ${fmt(total)}) no TOTVS e na Solicitação Crosby, em nome do banco da conta (despesa 7008 TARIFAS BANCARIAS), e conciliar cada saída?`)) return;
    setCriandoTarifas(true);
    setCsvMsg(null);
    try {
      const resp = await fetch(`${API}/conciliacao/tarifas`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersUsuario() }, body: JSON.stringify({ lancamentoIds: ids }) });
      const j = await resp.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao criar as duplicatas.');
      const d = j.data;
      setCsvMsg({
        ok: !d.recusadas.length,
        texto: `${d.criadas.length} duplicata(s) de tarifa criada(s) e conciliada(s) (${fmt(d.total)})${d.criadas.length ? ` — dup ${d.criadas.map((c) => c.duplicata).join(', ')}` : ''}${d.recusadas.length ? ` · ${d.recusadas.length} recusada(s): ${d.recusadas.map((x) => `${fmt(x.valor || 0)} ${x.motivo}`).join('; ')}` : ''}`,
      });
      setSelLinhas([]);
      if (onRecarregar) await onRecarregar();
    } catch (e) {
      setCsvMsg({ ok: false, texto: e.message });
    } finally {
      setCriandoTarifas(false);
    }
  };
  // entradas marcadas → fatura no contas a receber já baixada (Inefável, 10/11/2026)
  const [cliEnt, setCliEnt] = useState('');
  const [nomeCliEnt, setNomeCliEnt] = useState('');
  const [bancoEnt, setBancoEnt] = useState(bancoBaixaPadraoCR(fc?.banco));
  const [gerandoFat, setGerandoFat] = useState(false);
  const gerarFaturasMarcadas = async (ids) => {
    if (!ids.length || !cliEnt) return;
    const linhas = (r.lancamentos || []).filter((l) => ids.includes(l.id));
    const total = linhas.reduce((s, l) => s + Math.abs(l.valor), 0);
    if (!window.confirm(`Gerar ${ids.length} fatura(s) no contas a receber do TOTVS para o cliente ${cliEnt}${nomeCliEnt ? ` (${nomeCliEnt})` : ''}, total ${fmt(total)}, baixar em conta corrente (${BANCOS_BAIXA_CR.find((b) => b.id === bancoEnt)?.label}) na data de cada entrada e conciliar?`)) return;
    setGerandoFat(true);
    setCsvMsg(null);
    try {
      const d = await gerarFaturasEntradas(ids.map((id) => ({ lancamentoId: id, clienteCodigo: cliEnt, banco: bancoEnt })));
      setCsvMsg({ ok: !d.recusadas.length, texto: textoResultadoFaturas(d) });
      setSelLinhas((prev) => prev.filter((x) => !ids.includes(x)));
      if (onRecarregar) await onRecarregar();
    } finally {
      setGerandoFat(false);
    }
  };
  // ordenar por Entrada/Saída (maior↔menor) — Titia, 09/11/2026. null = ordem do extrato
  const [ordemValor, setOrdemValor] = useState(null); // { col: 'entrada'|'saida', dir: 'desc'|'asc' }
  const [picker, setPicker] = useState(null); // { lancamento, candidatos, avisos, decisao }
  const [selecao, setSelecao] = useState([]); // candidatos marcados (podem somar a saída)
  // busca manual (mesmos filtros das telas Contas a Pagar / Receber): devolve só o que foi pesquisado
  const BUSCA_VAZIA = { aberta: false, duplicata: '', codigo: '', cnpj: '', nome: '', tipoData: 'vencimento', de: '', ate: '', status: 'todos', valorMin: '', valorMax: '', fontes: ['totvs', 'liberacao', 'solicitacoes'], carregando: false, resultados: null, avisos: [] };
  const FONTES_CP = [
    { id: 'totvs', label: 'Contas a Pagar (TOTVS)' },
    { id: 'liberacao', label: 'Liberação de Pagamento' },
    { id: 'solicitacoes', label: 'Solicitações Crosby' },
  ];
  const [buscaCp, setBuscaCp] = useState(BUSCA_VAZIA);
  const keyCand = (c) => `${c.origem}:${c.id}`;
  const toggleSel = (c) => setSelecao((prev) => (prev.some((x) => keyCand(x) === keyCand(c)) ? prev.filter((x) => keyCand(x) !== keyCand(c)) : [...prev, c]));
  const somaSel = selecao.reduce((s, c) => s + Number(c.restante ?? c.valor ?? 0), 0);
  const abrirPicker = (dados) => {
    setPicker(dados);
    setSelecao([]);
    setBuscaCp({ ...BUSCA_VAZIA }); // sem pré-preenchimento: a consulta mostra só o que o usuário pesquisar
  };
  const pesquisarCp = async () => {
    if (!picker) return;
    setBuscaCp((b) => ({ ...b, carregando: true, resultados: null, avisos: [] }));
    try {
      const receber = picker.lancamento.valor > 0;
      const q = new URLSearchParams({ lancamentoId: picker.lancamento.id });
      const nomes = receber ? { duplicata: 'titulo' } : {};
      for (const k of ['duplicata', 'codigo', 'cnpj', 'nome', 'tipoData', 'de', 'ate', 'status', 'valorMin', 'valorMax']) if (String(buscaCp[k] || '').trim()) q.set(nomes[k] || k, String(buscaCp[k]).trim());
      if (!receber) {
        if (!buscaCp.fontes?.length) throw new Error('Marque pelo menos uma fonte: Contas a Pagar, Liberação de Pagamento ou Solicitações Crosby.');
        q.set('fontes', buscaCp.fontes.join(','));
      }
      const r = await fetch(`${API}/conciliacao/${receber ? 'buscar-cr' : 'buscar-cp'}?${q}`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha na busca.');
      setBuscaCp((b) => ({ ...b, carregando: false, resultados: j.data.candidatos, avisos: j.data.avisos || [] }));
    } catch (e) {
      setBuscaCp((b) => ({ ...b, carregando: false, resultados: [], avisos: [e.message] }));
    }
  };
  const conciliarSelecionadas = async () => {
    if (!picker || !selecao.length) return;
    if (!confirmarFornecedor(picker.lancamento, selecao)) return;
    const l = picker.lancamento;
    setOcupado(l.id);
    try {
      const itens = selecao.map((c) => ({ origem: c.origem, id: c.id, nome: c.nome, doc: c.doc, duplicata: c.duplicata, vencimento: c.vencimento, data: c.data, empresa: c.empresa, detalhe: c.detalhe, valorDuplicata: c.valorDuplicata ?? c.valor, valor: c.valor }));
      await salvar(l.id, selecao.length > 1 ? 'MULTIPLO' : selecao[0].origem, { itens }, null, null);
      setPicker(null);
      setSelecao([]);
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const [justificando, setJustificando] = useState(null); // { lancamento, texto }
  const [criandoSol, setCriandoSol] = useState(null); // { lancamento } — formulário de Solicitação Crosby embutido
  const solicitacaoCriada = async (sol) => {
    const l = criandoSol?.lancamento;
    if (!l || !sol) return;
    setOcupado(l.id);
    try {
      const ref = {
        origem: 'SOLICITACAO',
        id: sol.id,
        nome: sol.supplier_name || null,
        doc: sol.supplier_cpf_cnpj || null,
        valor: Number(sol.valor_total) || Math.abs(l.valor),
        valorDuplicata: Number(sol.valor_total) || Math.abs(l.valor),
        data: sol.dt_vencimento ? String(sol.dt_vencimento).slice(0, 10) : l.data,
        vencimento: sol.dt_vencimento ? String(sol.dt_vencimento).slice(0, 10) : null,
        empresa: sol.nm_empresa || null,
        detalhe: [sol.tipo_solicitacao, 'criada na conciliação', sol.forma_pagamento].filter(Boolean).join(' · '),
        duplicata: null,
        motivos: ['duplicata criada a partir desta saída'],
      };
      // Titia, 11/11/2026: não concilia com a Solicitação — a saída fica pendente até
      // o Financeiro aprovar e a Liberação marcar PAGO (aí concilia sozinha).
      void ref;
      setCriandoSol(null);
      setPicker(null);
      setErroModal(`Solicitação criada (${sol.supplier_name || 'fornecedor'}). A saída continua pendente: aprove o pagamento no Financeiro — quando a Liberação marcar PAGO, ela concilia sozinha.`);
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const [ocupado, setOcupado] = useState(null); // id do lançamento em processamento
  const [erroModal, setErroModal] = useState(null);
  const [detalhe, setDetalhe] = useState(null); // { lancamento, carregando, dados }

  const abrirDetalhe = async (l) => {
    if (!l.conciliacao) return;
    let conc = l.conciliacao;
    // pró-labore reconhecido automaticamente ainda não está gravado: grava para
    // poder anexar comprovante e justificar no detalhe
    if (!conc.id && conc.origem === 'PRO_LABORE') {
      try {
        const row = await salvar(l.id, 'PRO_LABORE', { pessoaId: conc.referencia?.pessoaId, cpf: conc.referencia?.cpf }, null, null);
        if (row?.id) conc = { ...conc, id: row.id };
      } catch (e) {
        setErroModal(e.message);
        return;
      }
    }
    if (!conc.id) {
      setDetalhe({ lancamento: l, carregando: false, dados: null, transferencia: conc });
      return;
    }
    setDetalhe({ lancamento: l, carregando: true, dados: null });
    try {
      const r = await fetch(`${API}/conciliacao/${conc.id}/detalhe`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao carregar o detalhe.');
      setDetalhe({ lancamento: l, carregando: false, dados: j.data });
    } catch (e) {
      setErroModal(e.message);
      setDetalhe(null);
    }
  };
  const anexar = async (tipo, file) => {
    if (!file || !detalhe?.dados?.conciliacao?.id) return;
    const cid = detalhe.dados.conciliacao.id;
    setDetalhe((d) => ({ ...d, enviando: tipo }));
    try {
      const url = await uploadAnexo(file, `conciliacao/${cid}`);
      const usuario = headersUsuario()['x-user-name'] || null;
      const anexos = [...(detalhe.dados.conciliacao.anexos || []), { tipo, url, nome: file.name, em: new Date().toISOString(), usuario }];
      const r = await fetch(`${API}/conciliacao/${cid}/anexos`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anexos }) });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao salvar o anexo.');
      setDetalhe((d) => ({ ...d, enviando: null, dados: { ...d.dados, conciliacao: { ...d.dados.conciliacao, anexos: j.data.anexos } } }));
    } catch (e) {
      setErroModal(e.message);
      setDetalhe((d) => (d ? { ...d, enviando: null } : d));
    }
  };
  const removerAnexo = async (idx) => {
    const cid = detalhe?.dados?.conciliacao?.id;
    if (!cid) return;
    const anexos = (detalhe.dados.conciliacao.anexos || []).filter((_, i) => i !== idx);
    const r = await fetch(`${API}/conciliacao/${cid}/anexos`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anexos }) });
    const j = await r.json();
    if (j?.success) setDetalhe((d) => ({ ...d, dados: { ...d.dados, conciliacao: { ...d.dados.conciliacao, anexos: j.data.anexos } } }));
  };

  const conciliarLinha = async (l) => {
    setOcupado(l.id);
    setErroModal(null);
    try {
      const d = await buscar(l.id);
      if (d.decisao?.automatico && d.decisao.lote?.length) {
        await salvar(l.id, 'MULTIPLO', { itens: d.decisao.lote }, d.decisao.justificativa || null, null);
      } else if (d.decisao?.automatico && d.decisao.escolhido) {
        const esc = d.decisao.escolhido;
        await salvar(l.id, esc.origem, refDe(esc), justDe(esc), esc.score);
      } else {
        abrirPicker({ lancamento: l, ...d });
      }
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const escolher = async (cand) => {
    const l = picker.lancamento;
    if (!confirmarFornecedor(l, [cand])) return;
    setOcupado(l.id);
    try {
      await salvar(l.id, cand.origem, refDe(cand), justDe(cand), cand.score);
      setPicker(null);
    } catch (e) {
      setErroModal(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const salvarJustificativa = async () => {
    const { lancamento: l, texto, tipo, fornecedor } = justificando;
    const adiant = tipo === 'adiantamento';
    if (adiant ? !fornecedor?.trim() : !texto?.trim()) return;
    setOcupado(l.id);
    try {
      // Adiantamento a fornecedor (Titia, 10/11/2026): pagamento sem nota fiscal ainda
      // → conciliação MANUAL marcada, listada em "Adiantamentos a fornecedor"
      if (adiant)
        await salvar(
          l.id,
          'MANUAL',
          { tipo: 'ADIANTAMENTO_FORNECEDOR', fornecedor: fornecedor.trim(), fornecedorDoc: l.contraparte_doc || null, observacao: texto?.trim() || null, valor: Math.abs(l.valor), data: l.data },
          `ADIANTAMENTO A FORNECEDOR — ${fornecedor.trim()}${texto?.trim() ? ` · ${texto.trim()}` : ''} (sem nota fiscal)`,
          null,
        );
      else await salvar(l.id, 'MANUAL', null, texto.trim(), null);
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
    const filtrados = (r.lancamentos || []).filter((l) => {
      if (tipo !== 'TODOS' && l.tipo !== tipo) return false;
      if (situacao === 'PROLABORE') return false;
      if (situacao === 'PENDENTES' && !l.pendente) return false;
      if (situacao === 'OK' && l.pendente) return false;
      if (q && !`${l.descricao} ${l.memo} ${l.nomeExibicao || ''} ${l.contraparte_nome || ''} ${l.documento || ''} ${l.forma} ${Math.abs(l.valor)} ${l.conciliacao?.justificativa || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!ordemValor) return filtrados;
    // valor da coluna escolhida; quem não tem valor nela vai para o fim (na ordem do extrato)
    const v = (l) => (ordemValor.col === 'entrada' ? (l.valor > 0 ? l.valor : null) : l.valor < 0 ? -l.valor : null);
    return filtrados
      .map((l, i) => ({ l, i, k: v(l) }))
      .sort((a, b) => {
        if (a.k == null && b.k == null) return a.i - b.i;
        if (a.k == null) return 1;
        if (b.k == null) return -1;
        return ordemValor.dir === 'desc' ? b.k - a.k : a.k - b.k;
      })
      .map((x) => x.l);
  }, [r, tipo, situacao, busca, ordemValor]);
  // clique no cabeçalho: maior→menor, menor→maior, volta à ordem do extrato
  const alternarOrdem = (col) =>
    setOrdemValor((o) => (o?.col !== col ? { col, dir: 'desc' } : o.dir === 'desc' ? { col, dir: 'asc' } : null));
  const setaOrdem = (col) => (ordemValor?.col === col ? (ordemValor.dir === 'desc' ? ' ↓' : ' ↑') : ' ↕');
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
          <button onClick={() => setSituacao('PROLABORE')} className={chip(situacao === 'PROLABORE', 'bg-purple-600 text-white')} title="Transferências para os sócios (pessoa física): Fabio e Felipe">
            Pró-labore ({proLabore.length})
          </button>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          {(r.lancamentos || []).some((l) => selLinhas.includes(l.id) && l.valor < 0) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 border border-purple-200 text-[11px] text-purple-900">
              {(r.lancamentos || []).filter((l) => selLinhas.includes(l.id) && l.valor < 0).length} saída(s) marcada(s) → pró-labore de
              {PESSOAS_PRO_LABORE.map((p) => (
                <button key={p.id} onClick={() => mandarProLabore(p.id)} disabled={ocupado === 'lote'} className="px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 font-medium">
                  {p.curto}
                </button>
              ))}
              <button onClick={() => setSelLinhas([])} className="ml-1 text-purple-700 hover:underline">
                limpar
              </button>
            </span>
          )}
          {(() => {
            const entSel = (r.lancamentos || []).filter((l) => selLinhas.includes(l.id) && l.valor > 0).map((l) => l.id);
            if (!entSel.length) return null;
            return (
              <span className="inline-flex flex-wrap items-center gap-1.5 px-2 py-1 rounded-md bg-sky-50 border border-sky-200 text-[11px] text-sky-900">
                {entSel.length} entrada(s) → contas a receber, cliente
                <input
                  value={cliEnt}
                  onChange={(e) => {
                    setCliEnt(e.target.value.replace(/\D/g, '').slice(0, 9));
                    setNomeCliEnt('');
                  }}
                  onBlur={async (e) => setNomeCliEnt(await nomePessoaTotvs(e.target.value))}
                  placeholder="cód."
                  inputMode="numeric"
                  className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-gray-800"
                />
                {nomeCliEnt && <span className="text-gray-600 max-w-[180px] truncate" title={nomeCliEnt}>{nomeCliEnt}</span>}
                <select value={bancoEnt} onChange={(e) => setBancoEnt(e.target.value)} className="px-1 py-0.5 border border-gray-300 rounded">
                  {BANCOS_BAIXA_CR.map((b) => (
                    <option key={b.id} value={b.id}>
                      baixa {b.label}
                    </option>
                  ))}
                </select>
                <button onClick={() => gerarFaturasMarcadas(entSel)} disabled={gerandoFat || !cliEnt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50 font-medium" title="Cria a fatura no contas a receber do TOTVS no cliente informado, baixa em conta corrente na data da entrada e concilia">
                  {gerandoFat ? <ArrowsClockwise size={11} className="animate-spin" /> : <Plus size={11} weight="bold" />} Gerar fatura + baixa ({entSel.length})
                </button>
              </span>
            );
          })()}
          {(() => {
            const tarifasSel = (r.lancamentos || []).filter((l) => selLinhas.includes(l.id) && ehTarifa(l)).map((l) => l.id);
            const tarifasPend = lancamentos.filter((l) => l.pendente && ehTarifa(l)).map((l) => l.id);
            if (!tarifasPend.length && !tarifasSel.length) return null;
            const fora = selLinhas.length - tarifasSel.length;
            return (
              <>
              <button
                onClick={() => setSelLinhas((prev) => [...new Set([...prev, ...tarifasPend])])}
                className="px-2.5 py-1 rounded-md border border-orange-300 text-orange-800 bg-orange-50 hover:bg-orange-100 text-[11px] font-medium"
                title="Marca todas as tarifas e afins pendentes desta conta"
              >
                Selecionar tarifas ({tarifasPend.length})
              </button>
              <button
                onClick={() => criarDuplicatasTarifas(tarifasSel)}
                disabled={criandoTarifas || !tarifasSel.length}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 text-[11px] font-medium"
                title={`Cria a duplicata de cada tarifa no TOTVS e na Solicitação Crosby (nome do banco da conta, despesa 7008) e concilia a saída.${fora ? ` ${fora} marcada(s) que não são tarifa ficam de fora.` : ''}`}
              >
                {criandoTarifas ? <ArrowsClockwise size={12} className="animate-spin" /> : <Plus size={12} weight="bold" />} Criar duplicatas ({tarifasSel.length})
              </button>
              </>
            );
          })()}
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
          {['STONE', 'SICREDI'].includes(String(c?.fluxo?.banco || '').toUpperCase()) && (
            <>
              <input ref={csvRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => conciliarEntradasCsv(e.target.files?.[0])} />
              <button
                onClick={() => csvRef.current?.click()}
                disabled={csvOcupado}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 text-[11px] font-medium"
                title="Envie o extrato desta conta (CSV da Stone ou Excel da Sicredi): as entradas pendentes que baterem data e valor com o arquivo (antecipação, recebível, boleto, Pix, TED) são conciliadas"
              >
                {csvOcupado ? <ArrowsClockwise size={12} className="animate-spin" /> : <UploadSimple size={12} />} Conciliar entradas pelo extrato (CSV/Excel)
              </button>
            </>
          )}
        </div>
        {String(c?.fluxo?.banco || '').toUpperCase() === 'PAGBANK' && (
          <div className="px-4 py-1.5 border-b border-gray-100 flex items-center gap-2 text-[11px]">
            <input ref={faturaRef} type="file" accept=".pdf" className="hidden" onChange={(e) => enviarFatura(e.target.files?.[0], true)} />
            <button
              onClick={() => faturaRef.current?.click()}
              disabled={faturaOcupado}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-40 font-medium"
              title="Envie o PDF da fatura do cartão PagBank: o HeadCoach acha cada compra no contas a pagar e concilia os pagamentos da fatura (antecipados e o do total)"
            >
              {faturaOcupado ? <ArrowsClockwise size={12} className="animate-spin" /> : <UploadSimple size={12} />} Importar fatura do cartão (PDF)
            </button>
            <span className="text-gray-500">mostra o plano antes de conciliar · senha do PDF = CNPJ do titular (automático)</span>
          </div>
        )}
        {fatura && <ModalFaturaCartao dados={fatura.dados} ocupado={faturaOcupado} onConfirmar={() => enviarFatura(fatura.arquivo, false)} onClose={() => setFatura(null)} />}
        {csvMsg && <div className={`px-4 py-1.5 text-[11px] ${csvMsg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{csvMsg.texto}</div>}

        <div className="flex-1 overflow-auto">
          {situacao === 'PROLABORE' && <PainelProLabore linhas={proLabore} salvar={salvar} justificar={justificar} desfazer={desfazer} setErro={setErroModal} onDetalhe={abrirDetalhe} />}
          <table className={`w-full text-sm hidden ${situacao === 'PROLABORE' ? '' : 'md:table'}`}>
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <Th className="w-6">
                  {(() => {
                    const tarifasPend = lancamentos.filter((l) => l.pendente && ehTarifa(l)).map((l) => l.id);
                    if (!tarifasPend.length) return null;
                    const todas = tarifasPend.every((id) => selLinhas.includes(id));
                    return (
                      <input
                        type="checkbox"
                        checked={todas}
                        onChange={() => setSelLinhas((prev) => (todas ? prev.filter((id) => !tarifasPend.includes(id)) : [...new Set([...prev, ...tarifasPend])]))}
                        className="accent-orange-600"
                        title={`Selecionar todas as tarifas/encargos pendentes (${tarifasPend.length})`}
                      />
                    );
                  })()}
                </Th>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Forma</Th>
                <Th>Histórico</Th>
                <Th>Contraparte / fornecedor</Th>
                <Th>Banco contraparte</Th>
                <Th>Documento</Th>
                <Th right>
                  <button type="button" onClick={() => alternarOrdem('entrada')} className={`hover:text-gray-900 ${ordemValor?.col === 'entrada' ? 'text-green-700' : ''}`} title="Ordenar por entrada (maior ↔ menor)">
                    Entrada{setaOrdem('entrada')}
                  </button>
                </Th>
                <Th right>
                  <button type="button" onClick={() => alternarOrdem('saida')} className={`hover:text-gray-900 ${ordemValor?.col === 'saida' ? 'text-red-700' : ''}`} title="Ordenar por saída (maior ↔ menor)">
                    Saída{setaOrdem('saida')}
                  </button>
                </Th>
                <Th right>Saldo após</Th>
                <Th>Conciliação</Th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => {
                const tcfg = TIPOS[l.tipo] || TIPOS.SAIDA;
                return (
                  <tr key={l.id} className={`border-b border-gray-100 hover:bg-gray-50 text-xs ${l.tipo === 'TRANSFERENCIA' ? 'bg-amber-50/40' : ''} ${!l.pendente ? 'opacity-90' : ''} ${selLinhas.includes(l.id) ? 'bg-purple-50' : ''}`}>
                    <td className="px-2 py-2 text-center">
                      {l.pendente && (l.valor < 0 || (l.valor > 0 && l.tipo !== 'TRANSFERENCIA')) && (
                        <input type="checkbox" checked={selLinhas.includes(l.id)} onChange={() => setSelLinhas((prev) => (prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]))} className={l.valor > 0 ? 'accent-sky-600' : 'accent-purple-600'} title={l.valor > 0 ? 'Marcar para gerar a fatura no contas a receber' : 'Marcar para pró-labore / duplicata'} />
                      )}
                    </td>
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
                      <CelulaConciliacao l={l} podeConciliar={podeConciliarLinha(l, c)} ocupado={ocupado === l.id} onConciliar={() => conciliarLinha(l)} onJustificar={() => setJustificando({ lancamento: l, texto: '', tipo: 'comum', fornecedor: l.contraparte_nome || l.nomeExibicao || '' })} onDesfazer={() => desfazerLinha(l)} onDetalhe={() => abrirDetalhe(l)} />
                    </td>
                  </tr>
                );
              })}
              {!lancamentos.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                    {situacao === 'PENDENTES' ? 'Nenhuma pendência com esses filtros — tudo conciliado.' : situacao === 'PROLABORE' ? '' : 'Nenhum lançamento com esses filtros.'}
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
                    <CelulaConciliacao l={l} podeConciliar={podeConciliarLinha(l, c)} ocupado={ocupado === l.id} onConciliar={() => conciliarLinha(l)} onJustificar={() => setJustificando({ lancamento: l, texto: '', tipo: 'comum', fornecedor: l.contraparte_nome || l.nomeExibicao || '' })} onDesfazer={() => desfazerLinha(l)} onDetalhe={() => abrirDetalhe(l)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* detalhe da conciliação (duplicata, pagamento, anexos) */}
        {detalhe && !picker && !justificando && (
          <DetalheConciliacao detalhe={detalhe} onClose={() => setDetalhe(null)} onAnexar={anexar} onRemoverAnexo={removerAnexo} />
        )}

        {/* escolha de candidato / justificativa */}
        {(picker || justificando) && (
          <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center p-4" onClick={() => (picker ? setPicker(null) : setJustificando(null))}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {picker && !justificando && !criandoSol && (
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
                      <TabelaCandidatos candidatos={picker.candidatos} selecao={selecao} onToggle={toggleSel} onUsar={escolher} ocupado={ocupado} keyCand={keyCand} mostrarPontos />
                    ) : (
                      <p className="p-6 text-center text-sm text-gray-400">{picker.lancamento.valor > 0 ? (ehPixTotvs(picker.lancamento) ? 'Nenhum título PIX do contas a receber com este valor + taxa Fiserv de R$ 0,79 nas empresas desta conta (±5 dias).' : ehPixCliente(picker.lancamento) ? 'Nenhum título do contas a receber (fatura, promissória, Pix, adiantamento) com este valor nas empresas desta conta (±5 dias).' : 'Nenhum depósito da Stone com este valor (±2 dias) no arquivo de conciliação da loja.') : 'Nenhum pagamento com este valor nas três fontes (±5 dias).'}</p>
                    )}

                    {/* busca manual: Contas a Pagar (saídas) ou Contas a Receber (entradas Pix) */}
                    {(picker.lancamento.valor < 0 || ehPixCliente(picker.lancamento)) && <div className="border-t border-gray-200">
                      <button onClick={() => setBuscaCp((b) => ({ ...b, aberta: !b.aberta }))} className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100">
                        <span className="inline-flex items-center gap-1">
                          <MagnifyingGlass size={13} /> {picker.lancamento.valor > 0 ? 'Procurar no Contas a Receber (título, cliente, período, valor)' : 'Procurar no Contas a Pagar, Solicitações Crosby e Liberação de Pagamento'}
                        </span>
                        <span className="text-gray-400">{buscaCp.aberta ? 'ocultar' : 'abrir'}</span>
                      </button>
                      {buscaCp.aberta && (
                        <div className="p-3 space-y-2">
                          {(() => {
                            const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg';
                            const Lbl = ({ children }) => <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">{children}</label>;
                            const set = (k) => (e) => setBuscaCp({ ...buscaCp, [k]: e.target.value });
                            const receber = picker.lancamento.valor > 0;
                            const pessoa = receber ? 'cliente' : 'fornecedor';
                            const toggleFonte = (id) => setBuscaCp((b) => ({ ...b, fontes: b.fontes.includes(id) ? b.fontes.filter((x) => x !== id) : [...b.fontes, id] }));
                            return (
                              <>
                              {!receber && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Procurar em</span>
                                  {FONTES_CP.map((f) => (
                                    <label key={f.id} className="inline-flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                                      <input type="checkbox" checked={buscaCp.fontes.includes(f.id)} onChange={() => toggleFonte(f.id)} className="accent-[#000638]" /> {f.label}
                                    </label>
                                  ))}
                                </div>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                <div>
                                  <Lbl>Código do {pessoa}</Lbl>
                                  <input value={buscaCp.codigo} onChange={set('codigo')} placeholder="código no TOTVS" className={inp} inputMode="numeric" />
                                </div>
                                <div>
                                  <Lbl>CNPJ / CPF</Lbl>
                                  <input value={buscaCp.cnpj} onChange={set('cnpj')} placeholder="só números" className={inp} inputMode="numeric" />
                                </div>
                                <div className="col-span-2">
                                  <Lbl>Nome do {pessoa}</Lbl>
                                  <input value={buscaCp.nome} onChange={set('nome')} placeholder={receber ? 'nome do cliente (exige período)' : 'nome ou parte do nome'} className={inp} />
                                </div>
                                <div>
                                  <Lbl>{receber ? 'Nº título' : 'Nº duplicata'}</Lbl>
                                  <input value={buscaCp.duplicata} onChange={set('duplicata')} placeholder={receber ? 'ex.: 249711' : 'ex.: 160605'} className={inp} inputMode="numeric" />
                                </div>
                                <div>
                                  <Lbl>Status</Lbl>
                                  <select value={buscaCp.status} onChange={set('status')} className={inp}>
                                    <option value="todos">TODOS</option>
                                    <option value="aberto">EM ABERTO</option>
                                    <option value="pago">PAGO</option>
                                  </select>
                                </div>
                                <div>
                                  <Lbl>Tipo de data</Lbl>
                                  <select value={buscaCp.tipoData} onChange={set('tipoData')} className={inp}>
                                    <option value="vencimento">VENCIMENTO</option>
                                    <option value="emissao">EMISSÃO</option>
                                    <option value="pagamento">PAGAMENTO</option>
                                  </select>
                                </div>
                                <div>
                                  <Lbl>Data início</Lbl>
                                  <input type="date" value={buscaCp.de} onChange={set('de')} className={inp} />
                                </div>
                                <div>
                                  <Lbl>Data fim</Lbl>
                                  <input type="date" value={buscaCp.ate} onChange={set('ate')} className={inp} />
                                </div>
                                <div>
                                  <Lbl>Valor mínimo</Lbl>
                                  <input value={buscaCp.valorMin} onChange={set('valorMin')} placeholder="0,00" className={inp} inputMode="decimal" />
                                </div>
                                <div>
                                  <Lbl>Valor máximo</Lbl>
                                  <input value={buscaCp.valorMax} onChange={set('valorMax')} placeholder="0,00" className={inp} inputMode="decimal" />
                                </div>
                              </div>
                              </>
                            );
                          })()}
                          <div className="flex items-center gap-2">
                            <button onClick={pesquisarCp} disabled={buscaCp.carregando} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-[#000638] text-white hover:bg-blue-900 disabled:opacity-50">
                              {buscaCp.carregando ? <ArrowsClockwise size={12} className="animate-spin" /> : <MagnifyingGlass size={12} />} Buscar
                            </button>
                            <button onClick={() => setBuscaCp({ ...BUSCA_VAZIA, aberta: true })} disabled={buscaCp.carregando} className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                              Limpar
                            </button>
                            <span className="text-[11px] text-gray-400">Mostra só o que bate com os filtros (sem sugestão); marque um ou mais para somar o valor {picker.lancamento.valor > 0 ? 'do Pix' : 'da saída'}.</span>
                          </div>
                          {buscaCp.avisos?.length > 0 && <p className="text-[11px] text-amber-700">{buscaCp.avisos.join(' · ')}</p>}
                          {buscaCp.resultados && (buscaCp.resultados.length ? (
                            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                              <div className="px-3 py-1 text-[10px] text-gray-500 bg-gray-50 border-b border-gray-200">{buscaCp.resultados.length} resultado(s) da consulta</div>
                              <TabelaCandidatos candidatos={buscaCp.resultados} selecao={selecao} onToggle={toggleSel} onUsar={escolher} ocupado={ocupado} keyCand={keyCand} />
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 py-2">Nada encontrado com esses filtros.</p>
                          ))}
                        </div>
                      )}
                    </div>}
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center gap-2">
                    <button onClick={() => setJustificando({ lancamento: picker.lancamento, texto: '', tipo: 'comum', fornecedor: picker.lancamento.contraparte_nome || picker.lancamento.nomeExibicao || '' })} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                      <ChatText size={13} /> Justificar manualmente
                    </button>
                    {picker.lancamento.valor < 0 && (
                      <button onClick={() => setCriandoSol({ lancamento: picker.lancamento })} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-indigo-300 text-indigo-800 bg-indigo-50 hover:bg-indigo-100" title="Abre o formulário de Solicitação Crosby já com valor, data e fornecedor desta saída; a saída continua pendente até o Financeiro aprovar e a Liberação marcar PAGO">
                        <Plus size={13} weight="bold" /> Criar duplicata
                      </button>
                    )}
                    <div className="ml-auto flex items-center gap-3">
                      {selecao.length > 0 && (() => {
                        const alvo = Math.abs(picker.lancamento.valor);
                        const dif = Math.round((somaSel - alvo) * 100) / 100;
                        return (
                          <span className={`text-xs ${dif < -0.01 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {selecao.length} selecionada(s) · soma {fmt(somaSel)} / {picker.lancamento.valor > 0 ? 'entrada' : 'saída'} {fmt(alvo)}
                            {dif < -0.01 ? ` · faltam ${fmt(-dif)}` : dif > 0.01 ? ` · sobra ${fmt(dif)} (fica parcial)` : ' · fecha'}
                          </span>
                        );
                      })()}
                      <button
                        disabled={!selecao.length || somaSel < Math.abs(picker.lancamento.valor) - 0.01 || ocupado}
                        onClick={conciliarSelecionadas}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
                        title="Concilia a saída com as duplicatas marcadas (a soma precisa cobrir a saída)"
                      >
                        <Check size={13} weight="bold" /> Conciliar selecionadas
                      </button>
                      <button onClick={() => setPicker(null)} className="px-3 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100">
                        Fechar
                      </button>
                    </div>
                  </div>
                </>
              )}
              {/* criar duplicata (Solicitação Crosby) a partir da saída */}
              {criandoSol && (
                <div className="absolute inset-0 z-30 bg-black/50 overflow-auto p-4" onClick={() => setCriandoSol(null)}>
                  <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl mx-auto my-2" onClick={(e) => e.stopPropagation()}>
                    <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl flex items-start gap-2 sticky top-0 z-10">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-gray-800">
                          Criar duplicata para a saída de {fmt(Math.abs(criandoSol.lancamento.valor))} em {fmtData(criandoSol.lancamento.data)}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">
                          {criandoSol.lancamento.descricao} · {criandoSol.lancamento.nomeExibicao || criandoSol.lancamento.memo} — a saída continua PENDENTE: o Financeiro aprova o pagamento e, quando a Liberação marcar PAGO, ela concilia sozinha.
                        </p>
                      </div>
                      <button onClick={() => setCriandoSol(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                      </button>
                    </div>
                    <Suspense fallback={<p className="p-6 text-sm text-gray-400 flex items-center gap-2"><ArrowsClockwise size={14} className="animate-spin" /> Carregando o formulário…</p>}>
                      <FormularioSolicitacoes
                        embutido
                        inicial={{
                          tipo: 'pagamento',
                          valor: Math.abs(criandoSol.lancamento.valor),
                          dtVencimento: criandoSol.lancamento.data,
                          dtEmissao: criandoSol.lancamento.data,
                          fornecedorNome: criandoSol.lancamento.nomeExibicao || criandoSol.lancamento.contraparte_nome || '',
                          fornecedorCpfCnpj: criandoSol.lancamento.contraparte_doc || '',
                          formaPagamento: criandoSol.lancamento.categoria === 'pix' ? 'pix' : criandoSol.lancamento.categoria === 'boleto' ? 'boleto' : '',
                          descricao: `Pagamento já realizado em ${fmtData(criandoSol.lancamento.data)} (extrato ${c.banco} ${c.apelido || ''}): ${criandoSol.lancamento.memo || criandoSol.lancamento.descricao || ''}`.trim(),
                        }}
                        onCriada={solicitacaoCriada}
                      />
                    </Suspense>
                  </div>
                </div>
              )}

              {justificando && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800">
                      Justificar {justificando.lancamento.valor < 0 ? 'saída' : 'entrada'} de {fmt(Math.abs(justificando.lancamento.valor))} em {fmtData(justificando.lancamento.data)}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{justificando.lancamento.descricao} · {justificando.lancamento.nomeExibicao || justificando.lancamento.memo}</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {justificando.lancamento.valor < 0 && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer ${justificando.tipo !== 'adiantamento' ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-300 text-gray-600'}`}>
                          <input type="radio" checked={justificando.tipo !== 'adiantamento'} onChange={() => setJustificando({ ...justificando, tipo: 'comum' })} /> Justificativa
                        </label>
                        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer ${justificando.tipo === 'adiantamento' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-300 text-gray-600'}`}>
                          <input type="radio" checked={justificando.tipo === 'adiantamento'} onChange={() => setJustificando({ ...justificando, tipo: 'adiantamento' })} /> Adiantamento a fornecedor (sem nota fiscal ainda)
                        </label>
                      </div>
                    )}
                    {justificando.tipo === 'adiantamento' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Fornecedor</label>
                        <input
                          value={justificando.fornecedor || ''}
                          onChange={(e) => setJustificando({ ...justificando, fornecedor: e.target.value })}
                          placeholder="Nome do fornecedor (e CNPJ, se souber)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                    <textarea
                      autoFocus
                      value={justificando.texto}
                      onChange={(e) => setJustificando({ ...justificando, texto: e.target.value })}
                      rows={3}
                      placeholder={justificando.tipo === 'adiantamento' ? 'Observação (opcional): o que foi comprado, previsão da nota…' : 'O que foi este lançamento? (ex.: antecipação Stone, boleto cliente X, tarifa, reembolso…)'}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <button onClick={() => setJustificando(null)} className="px-3 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100">
                      Cancelar
                    </button>
                    <button disabled={(justificando.tipo === 'adiantamento' ? !justificando.fornecedor?.trim() : !justificando.texto.trim()) || ocupado} onClick={salvarJustificativa} className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md text-white disabled:opacity-50 ${justificando.tipo === 'adiantamento' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}>
                      <Check size={13} weight="bold" /> {justificando.tipo === 'adiantamento' ? 'Marcar como adiantamento a fornecedor' : 'Marcar como OK'}
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

// ─── comprovante de saída baixado do portal Stone pelo bot ──────
const abrirComprovanteBot = async (comp) => {
  try {
    const r = await fetch(`${API}/comprovantes/${comp.id}/arquivo`);
    const j = await r.json();
    if (!j?.success) throw new Error(j?.message || 'Falha ao abrir o comprovante');
    window.open(j.data.url, '_blank', 'noopener');
  } catch (e) {
    alert(e.message);
  }
};
const BotaoComprovanteBot = ({ comp }) =>
  comp ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        abrirComprovanteBot(comp);
      }}
      className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 hover:underline whitespace-nowrap"
      title={`Comprovante baixado do portal Stone pelo bot${comp.solicitacaoId ? ' · já anexado na Solicitação Crosby' : ''}`}
    >
      <FilePdf size={12} className="text-red-600" /> comprovante
    </button>
  ) : null;

// fornecedor do candidato × favorecido da saída: avisa quando não há nenhuma
// palavra em comum (REELTEX conciliado com ELIAN — Titia, 12/11/2026)
const PALAVRAS_GENERICAS = new Set(['LTDA', 'EIRELI', 'COMERCIO', 'INDUSTRIA', 'SERVICOS', 'SERVICO', 'BRASIL', 'TEXTIL', 'CONFECCOES', 'CONFECCAO', 'DISTRIBUIDORA', 'TRANSFERENCIA', 'PAGAMENTO', 'TRANSF', 'ENVIADO', 'RECEBIDO']);
const palavrasNome = (s) =>
  new Set(
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !PALAVRAS_GENERICAS.has(w)),
  );
const fornecedorDiferente = (l, nomeCand) => {
  const a = palavrasNome(l?.contraparte_nome || l?.nomeExibicao);
  const b = palavrasNome(nomeCand);
  if (!a.size || !b.size) return false;
  return ![...a].some((w) => b.has(w));
};
const confirmarFornecedor = (l, cands) => {
  const dif = cands.filter((c) => c.nome && fornecedorDiferente(l, c.nome));
  if (!dif.length) return true;
  return window.confirm(`Atenção: a saída foi para "${l.contraparte_nome || l.nomeExibicao}" e você está conciliando com ${dif.map((c) => `"${c.nome}"`).join(', ')}.

Fornecedor diferente — conciliar mesmo assim?`);
};

// nº da(s) duplicata(s) conciliada(s) — "99246637/1" (Titia, 11/11/2026)
const fmtDupConc = (d) => {
  if (!d) return null;
  const [n, p] = String(d).split('|');
  return n ? (p ? `${n}/${p}` : n) : null;
};
const duplicatasDaConciliacao = (c) => {
  const ref = c?.referencia || {};
  const lista = Array.isArray(ref.itens) && ref.itens.length ? ref.itens.map((it) => fmtDupConc(it.duplicata)) : [fmtDupConc(ref.duplicata)];
  return [...new Set(lista.filter(Boolean))];
};

// ─── célula de conciliação (OK / pendente + ações) ─────────────
const CelulaConciliacao = ({ l, podeConciliar = l.valor < 0, ocupado, onConciliar, onJustificar, onDesfazer, onDetalhe }) => {
  if (ocupado) return <ArrowsClockwise size={14} className="animate-spin text-blue-600" />;
  const c = l.conciliacao;
  if (c) {
    const cfg = origemCfg(c.origem);
    const temAnexo = (c.anexos || []).length > 0;
    return (
      <div className="flex items-start gap-1.5">
        <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0 mt-0.5" />
        <div className="min-w-0 cursor-pointer hover:underline decoration-dotted" onClick={onDetalhe} title="Ver detalhes da conciliação">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge cfg={cfg}>{cfg.label}</Badge>
            {c.referencia?.parcial && <span className="px-1 rounded bg-orange-100 text-orange-800 text-[10px]">parcial</span>}
            {temAnexo && <Paperclip size={11} className="text-gray-400" />}
            <BotaoComprovanteBot comp={l.comprovante} />
            {c.automatico && c.id && <span className="text-[10px] text-gray-400">auto {c.pontuacao != null ? `· ${c.pontuacao} pts` : ''}</span>}
            {c.situacao && (c.situacao.pago ? (
              <span className="px-1 rounded bg-green-100 text-green-800 text-[10px] font-semibold" title={c.situacao.detalhe || ''}>PAGO · {c.situacao.via}</span>
            ) : (
              <span className="px-1 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold" title={c.situacao.detalhe || ''}>PENDENTE · {c.situacao.etapa}</span>
            ))}
            {c.referencia?.taxaFixa && !c.referencia?.stone && (
              <span className="px-1 rounded bg-orange-100 text-orange-800 text-[10px]" title="Taxa fixa por Pix descontada pela Fiserv (título do TOTVS = valor recebido + taxa)">
                taxa {fmt(c.referencia.taxaFixa)}
              </span>
            )}
            {c.referencia?.stone && (
              <span className="px-1 rounded bg-orange-100 text-orange-800 text-[10px]" title={`bruto ${fmt(c.referencia.stone.bruto)} · líquido ${fmt(c.referencia.stone.liquido)}`}>
                taxa {fmt(c.referencia.stone.taxa)}{c.referencia.stone.taxaPct != null ? ` (${c.referencia.stone.taxaPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)` : ''}
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-600 truncate max-w-[260px]" title={c.justificativa || ''}>
            {c.justificativa || c.referencia?.nome || ''}
          </div>
          {duplicatasDaConciliacao(c).length > 0 && (
            <div className="text-[10px] text-gray-700 font-medium truncate max-w-[260px]" title={duplicatasDaConciliacao(c).join(', ')}>
              dup {duplicatasDaConciliacao(c).join(', ')}
            </div>
          )}
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
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">Pendente</span>
      <BotaoComprovanteBot comp={l.comprovante} />
      {podeConciliar ? (
        <button onClick={onConciliar} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#000638] text-white hover:bg-blue-900 text-[11px] font-medium" title={l.valor < 0 ? 'Buscar em Liberação de Pagamento, Solicitações Crosby e Contas a Pagar' : ehPixCliente(l) ? 'Buscar o título no contas a receber do TOTVS (fatura, promissória, Pix, adiantamento)' : 'Buscar o depósito no arquivo de conciliação da Stone (antecipação / liquidação de vendas)'}>
          <Lightning size={11} weight="fill" /> Conciliar
        </button>
      ) : null}
      <button onClick={onJustificar} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-[11px]" title="Justificar manualmente">
        <ChatText size={11} /> Justificar
      </button>
    </div>
  );
};

// ─── painel Pró-labore: transferências aos sócios, com justificativa por linha ─
const PainelProLabore = ({ linhas, salvar, justificar, desfazer, setErro, onDetalhe, semCards = false, filtroExterno = null }) => {
  const [textos, setTextos] = useState({});
  const [salvando, setSalvando] = useState(null);
  const [filtroLocal, setFiltroLocal] = useState(null); // 'fabio' | 'felipe' | null
  const filtro = filtroExterno ?? filtroLocal;
  const pessoaDe = (l) => l.proLabore?.pessoaId || l.conciliacao?.referencia?.pessoaId || PESSOAS_PRO_LABORE.find((p) => p.cpf === l.conciliacao?.referencia?.cpf)?.id || null;
  const porPessoa = PESSOAS_PRO_LABORE.map((p) => ({ ...p, linhas: linhas.filter((l) => pessoaDe(l) === p.id) }));
  const total = linhas.reduce((s, l) => s + Math.abs(l.valor), 0);
  const visiveis = filtro ? linhas.filter((l) => pessoaDe(l) === filtro) : linhas;
  const gravarJust = async (l) => {
    const texto = (textos[l.id] ?? '').trim();
    if (!texto) return;
    setSalvando(l.id);
    try {
      const c = l.conciliacao;
      if (c?.id) await justificar(c.id, texto);
      else await salvar(l.id, 'PRO_LABORE', { pessoaId: l.proLabore?.pessoaId || c?.referencia?.pessoaId, cpf: l.proLabore?.cpf || c?.referencia?.cpf }, texto, null);
      setTextos((t) => ({ ...t, [l.id]: undefined }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(null);
    }
  };
  const tirar = async (l) => {
    if (!l.conciliacao?.id) return;
    if (!window.confirm('Tirar esta saída do pró-labore? Ela volta a ficar pendente.')) return;
    setSalvando(l.id);
    try {
      await desfazer(l.conciliacao.id);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(null);
    }
  };
  return (
    <div className={semCards ? 'space-y-3' : 'p-4 space-y-4'}>
      {!semCards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => setFiltroLocal(null)} className={`text-left rounded-lg border px-3 py-2 ${!filtro ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-300' : 'border-purple-200 bg-purple-50/60 hover:bg-purple-50'}`}>
            <p className="text-[10px] uppercase tracking-wide text-purple-700">Pró-labore no período · todos</p>
            <p className="text-lg font-bold text-purple-900">{fmt(total)}</p>
            <p className="text-[11px] text-purple-700">{linhas.length} transferência(s)</p>
          </button>
          {porPessoa.map((p) => (
            <button key={p.id} onClick={() => setFiltroLocal(filtro === p.id ? null : p.id)} className={`text-left rounded-lg border px-3 py-2 ${filtro === p.id ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-300' : 'border-gray-200 bg-white hover:bg-gray-50'}`} title="Clique para ver só este sócio">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{p.pessoa}</p>
              <p className="text-lg font-bold text-gray-800">{fmt(p.linhas.reduce((s, l) => s + Math.abs(l.valor), 0))}</p>
              <p className="text-[11px] text-gray-500">{fmtDoc(p.cpf)} · {p.linhas.length} transferência(s)</p>
            </button>
          ))}
        </div>
      )}
      {visiveis.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Nenhuma transferência para os sócios neste período. Marque saídas na lista (caixa à esquerda) e mande para o pró-labore de Fabio ou Felipe.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Data</Th>
                <Th>Sócio</Th>
                <Th>Forma / histórico</Th>
                <Th>Banco destino</Th>
                <Th right>Valor</Th>
                <Th>Origem</Th>
                <Th>O que foi essa saída (justificativa)</Th>
                <Th>Comprovante</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const c = l.conciliacao || { id: null, origem: null, referencia: {}, justificativa: '' };
                const anexoComp = (c.anexos || []).find((a) => a.tipo === 'comprovante');
                const abrir = () => onDetalhe && c.origem && onDetalhe(l);
                const auto = !c.id;
                const pessoaId = pessoaDe(l);
                const pessoaObj = PESSOAS_PRO_LABORE.find((p) => p.id === pessoaId);
                const ocfg = c.origem ? origemCfg(c.origem) : null;
                const atual = textos[l.id] ?? '';
                return (
                  <tr key={l.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtData(l.data)}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-800">{pessoaObj?.curto || c.referencia?.pessoa || '—'}</span>
                      <span className="block text-[10px] text-gray-400">{pessoaObj?.cpf ? fmtDoc(pessoaObj.cpf) : ''}</span>
                    </td>
                    <td className={`px-3 py-2 max-w-[260px] ${c.origem ? 'cursor-pointer hover:underline decoration-dotted' : ''}`} onClick={abrir} title={c.origem ? 'Ver os detalhes desta conciliação' : l.memo}>
                      <span className="text-gray-700">{l.forma}</span>
                      <span className="block text-[11px] text-gray-500 truncate">{l.descricao} · {l.nomeExibicao || l.contraparte_nome || ''}</span>
                      {!semCards ? null : <span className="block text-[10px] text-gray-400">{bancoCfg(l.banco).label} {l.conta_apelido || ''}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate" title={l.contraparte_banco || ''}>{l.contraparte_banco || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600 whitespace-nowrap">{fmt(Math.abs(l.valor))}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {!c.origem ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800">pendente</span>
                      ) : c.origem === 'PRO_LABORE' ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${auto ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-800'}`}>{auto ? 'pró-labore automático' : `marcado${c.usuario ? ` por ${c.usuario}` : ''}`}</span>
                      ) : (
                        <Badge cfg={ocfg}>{ocfg.label}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[260px]">
                      {c.id && textos[l.id] === undefined ? (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-800 flex-1 cursor-pointer hover:underline decoration-dotted" onClick={abrir} title="Ver os detalhes desta conciliação">{c.justificativa}</span>
                          <button onClick={() => setTextos((t) => ({ ...t, [l.id]: c.justificativa || '' }))} className="text-[11px] text-blue-700 hover:underline shrink-0">
                            editar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            value={atual}
                            onChange={(e) => setTextos((t) => ({ ...t, [l.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && gravarJust(l)}
                            placeholder="ex.: retirada de outubro, reembolso de despesa…"
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md"
                          />
                          <button onClick={() => gravarJust(l)} disabled={salvando === l.id || !atual.trim()} className="px-2 py-1 rounded-md bg-[#000638] text-white text-[11px] disabled:opacity-40">
                            {salvando === l.id ? <ArrowsClockwise size={11} className="animate-spin" /> : 'Salvar'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {l.comprovante ? (
                        <BotaoComprovanteBot comp={l.comprovante} />
                      ) : anexoComp ? (
                        <a href={anexoComp.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline">
                          <Paperclip size={11} /> anexo
                        </a>
                      ) : c.origem ? (
                        <button onClick={abrir} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-700" title="Abrir o detalhe e anexar o comprovante">
                          <UploadSimple size={11} /> anexar
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {c.origem && (
                        <button onClick={abrir} title="Detalhes" className="text-gray-300 hover:text-blue-700 mr-1">
                          <Eye size={13} />
                        </button>
                      )}
                      {c.id && (
                        <button onClick={() => tirar(l)} title="Tirar do pró-labore (volta a pendente)" className="text-gray-300 hover:text-red-600">
                          <ArrowCounterClockwise size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400">Entram aqui, automaticamente, as saídas para o CPF ou o nome completo de Fabio e Felipe (pessoa física). Transferências para as empresas dos sócios ou para contas Stone/Mêntore do grupo não entram. Para incluir outra saída, marque a caixa dela na lista e use o botão do sócio.</p>
    </div>
  );
};

// ─── tabela de candidatos (automáticos ou da busca manual) ─────
const TabelaCandidatos = ({ candidatos, selecao, onToggle, onUsar, ocupado, keyCand, mostrarPontos = false }) => (
  <table className="w-full text-xs">
    <thead className="bg-gray-50 text-gray-600 sticky top-0">
      <tr>
        <Th className="w-8" />
        <Th>Origem</Th>
        <Th>Fornecedor / detalhe</Th>
        <Th>Vencimento</Th>
        <Th>Pagamento</Th>
        <Th right>Valor</Th>
        <Th right>Disponível</Th>
        {mostrarPontos && <Th right>Pontos</Th>}
        <Th />
      </tr>
    </thead>
    <tbody>
      {candidatos.map((cand) => {
        const marcado = selecao.some((x) => keyCand(x) === keyCand(cand));
        const disponivel = cand.restante ?? cand.valor;
        // Solicitação: só consulta — aprovar o pagamento no Financeiro e conciliar com a Liberação (Titia, 11/11/2026)
        // + Liberação sem duplicata lançada no contas a pagar do TOTVS (cand.bloqueio vem do backend)
        const soConsulta = cand.origem === 'SOLICITACAO' || !!cand.bloqueio;
        const travada = !!cand.esgotada || soConsulta;
        const motivoTrava = cand.bloqueio || (soConsulta ? 'Solicitação só para consulta: aprove o pagamento no Financeiro (Liberação de Pagamento) e concilie com a Liberação' : 'Já conciliada em outra linha');
        return (
          <tr key={keyCand(cand)} className={`border-b border-gray-100 hover:bg-gray-50 ${marcado ? 'bg-emerald-50' : ''}`}>
            <td className="px-2 py-2 text-center">
              <input type="checkbox" checked={marcado} disabled={travada} onChange={() => onToggle(cand)} className="accent-green-600" title={travada ? motivoTrava : 'Marcar para somar'} />
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
              <Badge cfg={origemCfg(cand.origem)}>{origemCfg(cand.origem).label}</Badge>
              {cand.pago === false && <span className="block text-[10px] text-amber-700">em aberto</span>}
              {soConsulta && (
                <span className="block text-[10px] text-amber-800 font-medium max-w-[180px]" title={motivoTrava}>
                  {cand.origem === 'SOLICITACAO' ? 'só consulta · aprovar no Financeiro' : 'só consulta · duplicata não lançada no TOTVS'}
                </span>
              )}
            </td>
            <td className="px-3 py-2">
              <div className="font-medium text-gray-800">{cand.nome || '(sem nome)'}{cand.doc ? <span className="text-gray-400 font-normal"> · {fmtDoc(cand.doc)}</span> : null}</div>
              <div className="text-[11px] text-gray-500">{[cand.empresa, cand.detalhe].filter(Boolean).join(' · ')}</div>
              {cand.motivos?.length > 0 && <div className="text-[10px] text-emerald-700">{cand.motivos.join(' · ')}</div>}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{fmtData(cand.vencimento)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{fmtData(cand.data)}</td>
            <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{fmt(cand.valorDuplicata ?? cand.valor)}</td>
            <td className={`px-3 py-2 text-right whitespace-nowrap ${cand.usado > 0 ? 'text-orange-700' : 'text-gray-600'}`}>
              {fmt(disponivel)}
              {cand.usado > 0 && <span className="block text-[10px]">{cand.esgotada ? 'já conciliada' : `já usado ${fmt(cand.usado)}`}</span>}
            </td>
            {mostrarPontos && <td className="px-3 py-2 text-right whitespace-nowrap">{cand.score}</td>}
            <td className="px-3 py-2 text-right">
              <button disabled={ocupado || travada} onClick={() => onUsar(cand)} className="px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" title={travada ? motivoTrava : 'Conciliar só com esta'}>
                Usar
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

// ─── folha do Dryland (contas Mêntore) ─────────────────────────
const fmtComp = (c) => (c ? String(c).slice(0, 7).split('-').reverse().join('/') : '—');
const DetalheFolha = ({ folha, valorLinha }) => {
  const ev = folha.eventos || [];
  const prov = ev.filter((e) => e.tipo === 'P');
  const desc = ev.filter((e) => e.tipo === 'D');
  const somaP = prov.reduce((s, e) => s + Number(e.valor || 0), 0);
  const somaD = desc.reduce((s, e) => s + Number(e.valor || 0), 0);
  const r = folha.rescisao;
  const esperado = folha.esperado;
  const bate = esperado != null && valorLinha != null && Math.abs(Math.abs(valorLinha) - esperado) <= 0.051;
  const tipoLabel = { salario: 'Salário', ferias: 'Férias', adiantamento: 'Adiantamento', decimo: '13º salário', rescisao: 'Rescisão' }[folha.tipo] || folha.tipo;
  return (
    <div className="rounded-lg border border-lime-200 overflow-hidden">
      <div className="px-3 py-2 bg-lime-50 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-lime-900">
        <span className="font-semibold">{tipoLabel} · {folha.nome}</span>
        <span>competência {fmtComp(folha.competencia)}</span>
        {folha.empresa && <span>{folha.empresa}</span>}
        {folha.secao && <span>loja {folha.secao}</span>}
        {folha.funcao && <span>{folha.funcao}</span>}
        {folha.chapa && <span>chapa {folha.chapa}</span>}
        {folha.admissao && <span>admissão {folha.admissao}</span>}
        <span className="ml-auto text-[10px] text-lime-700">fonte: Dryland DP/RH</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
        {folha.tipo !== 'rescisao' && (
          <>
            <Campo label="Salário contratual">{folha.salario != null ? fmt(folha.salario) : '—'}</Campo>
            <Campo label="Proventos">{fmt(folha.proventos)}</Campo>
            <Campo label="Descontos">{fmt(folha.descontos)}</Campo>
            <Campo label="Líquido da folha">{fmt(folha.liquido)}</Campo>
          </>
        )}
        {r && (
          <>
            <Campo label="Verbas líquidas">{fmt(r.valorRescisao)}</Campo>
            <Campo label="Aviso prévio indenizado">{fmt(r.avisoPrevio)}</Campo>
            <Campo label="Multa FGTS (guia, não vai ao funcionário)">{fmt(r.multa)}</Campo>
            <Campo label="Total da rescisão">{fmt(r.total)}</Campo>
          </>
        )}
        <div className="col-span-2 md:col-span-4">
          <Campo label="Valor esperado × pago">
            <span className={bate ? 'text-green-700 font-semibold' : 'text-orange-700 font-semibold'}>
              {esperado != null ? fmt(esperado) : '—'} × {valorLinha != null ? fmt(Math.abs(valorLinha)) : '—'} {bate ? '· bate' : esperado != null ? `· diferença ${fmt(Math.abs(valorLinha) - esperado)}` : ''}
            </span>
            {folha.comoCalculado && <span className="block text-[10px] text-gray-500">{folha.comoCalculado}</span>}
            {folha.nomeExtrato && folha.nomeExtrato !== folha.nome && <span className="block text-[10px] text-gray-500">no extrato: {folha.nomeExtrato}</span>}
          </Campo>
        </div>
      </div>
      {ev.length > 0 && (
        <table className="w-full text-xs border-t border-lime-100">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <Th>Cód.</Th>
              <Th>Rubrica</Th>
              <Th>Ref.</Th>
              <Th right>Provento</Th>
              <Th right>Desconto</Th>
            </tr>
          </thead>
          <tbody>
            {ev.map((e, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-1 font-mono text-gray-500">{e.cod || '—'}</td>
                <td className="px-3 py-1">{e.desc}</td>
                <td className="px-3 py-1 text-gray-500">{e.ref ?? '—'}</td>
                <td className="px-3 py-1 text-right text-green-700">{e.tipo === 'P' ? fmt(e.valor) : ''}</td>
                <td className="px-3 py-1 text-right text-red-700">{e.tipo === 'D' ? fmt(e.valor) : ''}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
              <td className="px-3 py-1" colSpan={3}>Totais {folha.tipo === 'rescisao' ? '(bruto − deduções)' : '(proventos − descontos = líquido)'}</td>
              <td className="px-3 py-1 text-right text-green-700">{fmt(somaP)}</td>
              <td className="px-3 py-1 text-right text-red-700">{fmt(somaD)}</td>
            </tr>
            <tr className="bg-gray-50 font-semibold">
              <td className="px-3 py-1" colSpan={3}>Líquido</td>
              <td className="px-3 py-1 text-right" colSpan={2}>{fmt(somaP - somaD)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {r?.obs && <p className="px-3 py-2 text-[11px] text-gray-500 border-t border-lime-100">{r.obs}</p>}
    </div>
  );
};

// ─── detalhe da conciliação ────────────────────────────────────
const pct = (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const SITUACAO_CRUZ = {
  batida: { label: 'Batida', cor: 'bg-green-100 text-green-800' },
  divergente: { label: 'Divergente', cor: 'bg-amber-100 text-amber-800' },
  sem_titulo: { label: 'Sem título', cor: 'bg-red-100 text-red-800' },
  venda_nao_localizada: { label: 'Venda não localizada', cor: 'bg-gray-100 text-gray-600' },
};
const DetalheStone = ({ o }) => {
  const st = o.stone || {};
  const parcelas = st.parcelas || [];
  const cruz = st.cruzamento || null;
  const cruzPor = new Map((cruz?.parcelas || []).map((q) => [`${q.nsu}|${q.parcela}`, q]));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Campo label="Origem">{o.tipo}</Campo>
        <Campo label="Loja">{o.empresa || '—'}</Campo>
        <Campo label="StoneCode / depósito">{st.stonecode || '—'}{st.paymentId ? <span className="block text-[11px] text-gray-400">pag. {st.paymentId}</span> : null}</Campo>
        <Campo label="Carteira">{st.carteira || '—'}</Campo>
        <Campo label="Data do depósito">{fmtData(o.dataPagamento)}</Campo>
        <Campo label="Valor bruto das vendas">{fmt(st.bruto)}</Campo>
        <Campo label="Valor líquido">{fmt(st.liquido)}</Campo>
        <Campo label="Taxa cobrada">
          <span className="text-orange-700 font-semibold">{fmt(st.taxa)}</span>
          <span className="block text-[11px] text-gray-500">{pct(st.taxaPct)} sobre o bruto</span>
        </Campo>
        <Campo label="Parcelas liquidadas">{st.parcelas != null ? `${parcelas.length || st.parcelas}${st.antecipadas ? ` (${st.antecipadas} antecipada(s))` : ''}` : '—'}</Campo>
        <Campo label="Depositado em">{fmt(o.valor)}</Campo>
        {st.valorEventos ? <Campo label="Eventos financeiros">{fmt(st.valorEventos)}</Campo> : null}
        {st.saldoNegativoAnterior ? <Campo label="Saldo negativo anterior">{fmt(st.saldoNegativoAnterior)}</Campo> : null}
      </div>
      {st.erroParcelas && <p className="text-xs text-amber-700">Não foi possível carregar as parcelas agora: {st.erroParcelas}</p>}
      {cruz?.resumo && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-700">Contas a receber (TOTVS):</span>
          <span className="px-2 py-0.5 rounded bg-green-100 text-green-800">{cruz.resumo.batidas} batida(s)</span>
          {cruz.resumo.divergentes > 0 && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">{cruz.resumo.divergentes} divergente(s)</span>}
          {cruz.resumo.semTitulo > 0 && <span className="px-2 py-0.5 rounded bg-red-100 text-red-800">{cruz.resumo.semTitulo} sem título</span>}
          {cruz.resumo.vendaNaoLocalizada > 0 && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{cruz.resumo.vendaNaoLocalizada} venda não localizada</span>}
          <span className="text-gray-400">de {cruz.resumo.parcelas} parcela(s) · empresas {cruz.filiais?.join(', ')}</span>
        </div>
      )}
      {cruz?.aviso && <p className="text-xs text-amber-700">{cruz.aviso}</p>}
      {parcelas.length > 0 && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-green-50 text-xs font-semibold text-green-900">Vendas que compõem o depósito</div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <Th>NSU</Th>
                  <Th>Venda (captura)</Th>
                  <Th>Entrada</Th>
                  <Th>Parc.</Th>
                  <Th right>Bruto</Th>
                  <Th right>Líquido</Th>
                  <Th right>Taxa</Th>
                  <Th right>%</Th>
                  <Th>Antecipada</Th>
                  {cruz && <Th>Título no TOTVS</Th>}
                </tr>
              </thead>
              <tbody>
                {parcelas.map((x, i) => {
                  const q = cruzPor.get(`${x.nsu}|${x.parcela}`);
                  const sc = q ? SITUACAO_CRUZ[q.situacao] || SITUACAO_CRUZ.venda_nao_localizada : null;
                  return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 font-mono">{x.nsu || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{x.dataCaptura ? `${fmtData(String(x.dataCaptura).slice(0, 10))} ${String(x.dataCaptura).slice(11, 16)}` : '—'}</td>
                    <td className="px-3 py-1.5">{x.formaEntrada || '—'}</td>
                    <td className="px-3 py-1.5">{x.parcela ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(x.bruto)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(x.liquido)}</td>
                    <td className="px-3 py-1.5 text-right text-orange-700 font-semibold">{fmt(x.taxa)}</td>
                    <td className="px-3 py-1.5 text-right">{x.bruto ? pct((x.taxa / x.bruto) * 100) : '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{x.antecipada ? `sim · venceria ${fmtData(x.dataOriginal)}` : 'não'}</td>
                    {cruz && (
                      <td className="px-3 py-1.5">
                        {q ? (
                          <div className="min-w-[180px]">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${sc.cor}`} title={[q.rotulo, ...(q.divergencias || [])].filter(Boolean).join(' · ')}>{sc.label}</span>
                            {q.titulo && (
                              <div className="text-[11px] text-gray-700 mt-0.5">
                                <span className="font-mono">{q.titulo.numero}</span>
                                {q.titulo.parcela ? <span className="text-gray-500"> parc. {q.titulo.parcela.numero} · {fmt(q.titulo.parcela.valor)}</span> : null}
                                <span className="block text-[10px] text-gray-500 truncate max-w-[220px]">{[q.titulo.filial ? `emp. ${q.titulo.filial}` : null, q.titulo.cliente, q.titulo.nf ? `NF ${q.titulo.nf}` : null, q.titulo.portador].filter(Boolean).join(' · ')}</span>
                              </div>
                            )}
                            {q.situacao === 'divergente' && q.divergencias?.length > 0 && <span className="block text-[10px] text-amber-700">{q.divergencias.join(' · ')}</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// detalhe de duplicata/título (Liberação, Solicitação, Contas a Pagar, Contas a Receber)
const KpiDoc = ({ label, children, destaque = false, sub = null }) => (
  <div className="px-3 py-2.5 min-w-0">
    <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
    <p className={`text-sm font-semibold whitespace-nowrap ${destaque ? 'text-[#000638]' : 'text-gray-800'}`}>{children ?? '—'}</p>
    {sub}
  </div>
);
const Linha = ({ label, children }) =>
  children == null || children === '' || children === false ? null : (
    <div className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0 text-xs">
      <span className="w-32 shrink-0 text-gray-400 uppercase tracking-wide text-[10px] pt-0.5">{label}</span>
      <span className="text-gray-800 min-w-0 break-words">{children}</span>
    </div>
  );
const DetalheOrigem = ({ o, l }) => {
  const cliente = !!o.cliente;
  const docTit = o.duplicata ? `${o.duplicata}${o.parcela ? ` / ${o.parcela}` : ''}` : null;
  const recebido = Math.abs(Number(l?.valor) || 0);
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{cliente ? 'Cliente' : 'Fornecedor'}</p>
          <p className="text-base font-bold text-gray-900 leading-tight">{o.fornecedor || '—'}</p>
          <p className="text-[11px] text-gray-500">{[o.doc ? fmtDoc(o.doc) : null, o.fornecedorCodigo ? `cód. ${o.fornecedorCodigo}` : null].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Empresa</p>
          <p className="text-sm font-semibold text-gray-800">{o.empresa || '—'}</p>
        </div>
        {docTit && (
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{cliente ? 'Título / parcela' : 'Duplicata / parcela'}</p>
            <p className="text-sm font-semibold font-mono text-gray-800">{docTit}</p>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Origem</p>
          <p className="text-sm font-semibold text-gray-800">{o.tipo}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-gray-100">
        <KpiDoc label="Emissão">{fmtData(o.emissao)}</KpiDoc>
        <KpiDoc label="Vencimento">{fmtData(o.vencimento)}</KpiDoc>
        <KpiDoc label={cliente ? 'Recebimento' : 'Pagamento'}>{fmtData(o.dataPagamento)}</KpiDoc>
        <KpiDoc label={cliente ? 'Valor do título' : 'Valor da duplicata'}>{fmt(o.valor)}</KpiDoc>
        <KpiDoc
          label={cliente ? 'Recebido' : 'Pago'}
          destaque
          sub={
            o.taxa ? <span className="block text-[11px] text-orange-700">taxa Fiserv {fmt(o.taxa)}</span> : (o.juros || o.desconto) ? (
              <span className="block text-[11px]">
                {o.juros ? <span className="text-orange-700">juros {fmt(o.juros)}</span> : null}
                {o.juros && o.desconto ? ' · ' : null}
                {o.desconto ? <span className="text-emerald-700">desconto {fmt(o.desconto)}</span> : null}
              </span>
            ) : null
          }
        >
          {fmt(o.taxa ? recebido : o.valorPago)}
        </KpiDoc>
        <KpiDoc label="No extrato" destaque>{fmt(recebido)}</KpiDoc>
      </div>
      <div className="px-4 py-2 border-t border-gray-200">
        <Linha label="Despesa">
          {o.despesas?.length ? (
            <span className="space-y-0.5 block">
              {o.despesas.map((d, i) => (
                <span key={i} className="block">
                  {d.nome}
                  <span className="text-gray-400"> · cód. {d.codigo}{d.centroCusto ? ` · CC ${d.centroCusto}` : ''}{d.percentual && d.percentual !== 100 ? ` · ${d.percentual}%` : ''}{o.despesas.length > 1 ? ` · ${fmt(d.valor)}` : ''}</span>
                </span>
              ))}
            </span>
          ) : o.despesa}
        </Linha>
        <Linha label={cliente ? 'Tipo / portador' : 'Forma / banco'}>{[o.forma, o.banco, o.portadorCodigo && !o.banco ? `portador ${o.portadorCodigo}` : null].filter(Boolean).join(' · ') || null}</Linha>
        <Linha label="Centro de custo">{o.centroCusto}</Linha>
        <Linha label="Chave PIX">{o.chavePix}</Linha>
        <Linha label="Código de barras">{o.codigoBarras ? <span className="font-mono text-[11px]">{o.codigoBarras}</span> : null}</Linha>
        <Linha label="Chegada / entrada">{[o.chegada ? `NF ${fmtData(o.chegada)}` : null, o.entrada ? `lançada ${fmtData(o.entrada)}` : null].filter(Boolean).join(' · ') || null}</Linha>
        <Linha label="Pago por">{o.pagoPor}</Linha>
        <Linha label="Incluído por">{o.incluidoPor}</Linha>
        <Linha label="Solicitante">{[o.solicitante, o.setor].filter(Boolean).join(' · ') || null}</Linha>
        <Linha label="Status">{o.status}</Linha>
        <Linha label="Observação">{o.observacao}</Linha>
        {o.aviso && <p className="text-[11px] text-amber-700 pt-1">{o.aviso}</p>}
      </div>
    </div>
  );
};

const Campo = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-sm text-gray-800 break-words">{children ?? '—'}</p>
  </div>
);

const DetalheConciliacao = ({ detalhe, onClose, onAnexar, onRemoverAnexo }) => {
  const { lancamento: l, carregando, dados, transferencia, enviando } = detalhe;
  const c = dados?.conciliacao || l.conciliacao;
  const o = dados?.origem;
  const sol = dados?.solicitacao;
  const anexos = dados?.conciliacao?.anexos || [];
  const compBot = dados?.comprovante || null; // PDF baixado do portal Stone pelo bot
  const temComprovante = !!compBot || anexos.some((a) => a.tipo === 'comprovante') || sol?.comprovante_url || sol?.comprovante_gestor_url || sol?.comprovante_fabio_url;
  const temNota = anexos.some((a) => a.tipo === 'nota_fiscal') || sol?.nota_fiscal_url;
  const cfg = origemCfg(c?.origem);
  const Link = ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline text-xs">
      <Eye size={12} /> {children}
    </a>
  );
  return (
    <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start gap-2">
          <CheckCircle size={20} weight="fill" className="text-green-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 flex-wrap">
              {l.valor < 0 ? 'Saída' : 'Entrada'} de {fmt(Math.abs(l.valor))} em {fmtData(l.data)}
              <Badge cfg={cfg}>{cfg.label}</Badge>
              {duplicatasDaConciliacao(c).length > 0 && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[11px] font-semibold">dup {duplicatasDaConciliacao(c).join(', ')}</span>}
              {c?.referencia?.parcial && <span className="px-1.5 rounded bg-orange-100 text-orange-800 text-[10px]">pagamento parcial</span>}
            </h4>
            <p className="text-xs text-gray-500 truncate">{l.descricao} · {l.nomeExibicao || l.memo}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {carregando && (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <ArrowsClockwise size={14} className="animate-spin" /> Carregando a duplicata…
            </p>
          )}

          {transferencia && transferencia.origem === 'BOLETO_TARIFA' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">{transferencia.referencia?.papel === 'TARIFA' ? 'Tarifa de boleto da Stone (R$ 1,99 por depósito)' : 'Depósito por boleto com tarifa cobrada'}</Campo>
              <Campo label={transferencia.referencia?.papel === 'TARIFA' ? 'Depósito pareado' : 'Tarifa pareada'}>
                {fmt(Math.abs(transferencia.referencia?.parValor))} em {fmtData(transferencia.referencia?.parData)}
                {transferencia.referencia?.parSeq != null ? <span className="block text-[11px] text-gray-500">linha {transferencia.referencia.parSeq} do extrato</span> : null}
              </Campo>
              <Campo label="Regra">Mesmo dia e mesmo saldo após; derivado na leitura do extrato, nada gravado</Campo>
            </div>
          )}

          {transferencia && transferencia.origem === 'PIX_DEVOLVIDO' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">{transferencia.referencia?.papel === 'SAIDA' ? 'Pix enviado que foi devolvido (estorno integral)' : 'Devolução de um Pix enviado'}</Campo>
              <Campo label={transferencia.referencia?.papel === 'SAIDA' ? 'Devolução recebida' : 'Pix enviado'}>
                {fmt(Math.abs(transferencia.referencia?.parValor))} em {fmtData(transferencia.referencia?.parData)}
                {transferencia.referencia?.parSeq != null ? <span className="block text-[11px] text-gray-500">linha {transferencia.referencia.parSeq} do extrato</span> : null}
              </Campo>
              <Campo label="Contraparte">{transferencia.referencia?.contraparte || '—'}</Campo>
              <div className="col-span-2 md:col-span-3">
                <Campo label="Regra">Mesma conta, mesmo valor e mesma contraparte, devolução até 7 dias depois do envio; derivado na leitura do extrato, nada gravado</Campo>
              </div>
            </div>
          )}

          {transferencia && transferencia.origem === 'PAGARME_SAQUE' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">Saque automático da Pagar.me para a conta Stone da mesma empresa</Campo>
              <Campo label="Conta Pagar.me">{transferencia.referencia?.pagarmeApelido || '—'}{transferencia.referencia?.cnpj ? <span className="block text-[11px] text-gray-500">{fmtDoc(transferencia.referencia.cnpj)}</span> : null}</Campo>
              <Campo label="Como aparece no extrato">{transferencia.referencia?.contraparte || '—'}</Campo>
              <div className="col-span-2 md:col-span-3">
                <Campo label="Regra">A Pagar.me transfere o saldo disponível todo dia; o extrato Stone mostra a entrada com o nome do próprio titular. As vendas que compõem o saque estão no extrato Pagar.me da empresa, no Extrato Bancário.</Campo>
              </div>
            </div>
          )}

          {transferencia && transferencia.origem === 'CARTAO_ESTORNADO' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">{transferencia.referencia?.papel === 'COMPRA' ? 'Compra no cartão que foi estornada' : 'Estorno de uma compra no cartão'}</Campo>
              <Campo label={transferencia.referencia?.papel === 'COMPRA' ? 'Estorno' : 'Compra'}>
                {fmt(Math.abs(transferencia.referencia?.parValor))} em {fmtData(transferencia.referencia?.parData)}
                {transferencia.referencia?.parSeq != null ? <span className="block text-[11px] text-gray-500">linha {transferencia.referencia.parSeq} do extrato</span> : null}
              </Campo>
              <Campo label="Estabelecimento">{transferencia.referencia?.estabelecimento || '—'}</Campo>
              <div className="col-span-2 md:col-span-3">
                <Campo label="Regra">Mesma conta, mesmo valor e mesmo estabelecimento, estorno até 60 dias depois da compra; derivado na leitura do extrato, nada gravado</Campo>
              </div>
            </div>
          )}

          {transferencia && transferencia.origem === 'APLICACAO_STONE' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">
                {transferencia.referencia?.papel === 'RESGATE' ? 'Resgate da caixinha Stone (Dinheiro Resgatado)' : 'Aplicação na caixinha Stone (Dinheiro Guardado) para carregar o cartão pré-pago'}
              </Campo>
              <Campo label={transferencia.referencia?.papel === 'RESGATE' ? 'Aplicação de origem' : 'Resgate'}>
                {transferencia.referencia?.parData ? (
                  <>
                    {fmt(Math.abs(transferencia.referencia.parValor))} em {fmtData(transferencia.referencia.parData)}
                    {transferencia.referencia.parSeq != null ? <span className="block text-[11px] text-gray-500">linha {transferencia.referencia.parSeq} do extrato</span> : null}
                  </>
                ) : (
                  <span className="text-amber-700">ainda sem resgate (dinheiro aplicado)</span>
                )}
              </Campo>
              <Campo label="Regra">Mesma conta e mesmo valor, resgate depois da aplicação; derivado na leitura do extrato, nada gravado</Campo>
            </div>
          )}

          {transferencia && transferencia.origem === 'PRO_LABORE' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">Pró-labore (transferência para sócio, pessoa física)</Campo>
              <Campo label="Sócio">{transferencia.referencia?.pessoa || '—'}{transferencia.referencia?.cpf ? <span className="block text-[11px] text-gray-500">{fmtDoc(transferencia.referencia.cpf)}</span> : null}</Campo>
              <Campo label="Justificativa">{transferencia.justificativa}</Campo>
              <div className="col-span-2 md:col-span-3">
                <Campo label="Regra">Reconhecido pelo CPF ou pelo nome completo do sócio na contraparte; para justificar o que foi essa saída, use a aba Pró-labore do extrato</Campo>
              </div>
            </div>
          )}

          {transferencia && transferencia.origem === 'REDE_DEPOSITO' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">Depósito da Rede ({transferencia.referencia?.antecipacao ? 'antecipação de recebíveis' : 'liquidação de vendas'} na maquininha Rede)</Campo>
              <Campo label="Bandeira / loja">{[transferencia.referencia?.bandeira, transferencia.referencia?.loja ? `loja ${transferencia.referencia.loja}` : null].filter(Boolean).join(' · ') || '—'}</Campo>
              <Campo label="Histórico">{transferencia.referencia?.memo || '—'}</Campo>
              <div className="col-span-2 md:col-span-3">
                <Campo label="Conferência">Totais por dia batem com o relatório de recebimentos da Rede; a taxa por depósito depende do relatório detalhado da Rede</Campo>
              </div>
            </div>
          )}

          {transferencia && !['BOLETO_TARIFA', 'PIX_DEVOLVIDO', 'PAGARME_SAQUE', 'CARTAO_ESTORNADO', 'APLICACAO_STONE', 'PRO_LABORE', 'REDE_DEPOSITO'].includes(transferencia.origem) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Tipo">Transferência entre contas do grupo</Campo>
              <Campo label="Outra conta">{transferencia.referencia?.outraConta ? `${transferencia.referencia.outraConta.apelido} (${bancoCfg(transferencia.referencia.outraConta.banco).label})` : '—'}</Campo>
              <Campo label="Sentido">{transferencia.referencia?.sentido === 'SAIDA' ? 'Saiu desta conta' : 'Entrou nesta conta'}</Campo>
              <Campo label="Confiança do casamento">{transferencia.referencia?.confianca ?? '—'}</Campo>
              <Campo label="Justificativa">{transferencia.justificativa}</Campo>
            </div>
          )}

          {dados && !o && ['MANUAL', 'PRO_LABORE', 'REDE_DEPOSITO'].includes(c?.origem) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Campo label="Justificativa">{c.justificativa}</Campo>
              <Campo label="Por">{c.usuario || '—'}</Campo>
              <Campo label="Em">{c.criado_em ? fmtData(c.criado_em) : '—'}</Campo>
            </div>
          )}

          {c?.referencia?.techfin && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
              <p className="font-semibold mb-1">Repasse da Techfin (Pix TOTVS via Fiserv)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                <span><span className="text-teal-700">Liquidado</span> {c.referencia.techfin.liquidacao ? String(c.referencia.techfin.liquidacao).slice(0, 16).replace('T', ' ') : '—'}</span>
                <span><span className="text-teal-700">Pix</span> {c.referencia.techfin.pix}</span>
                <span><span className="text-teal-700">Bruto</span> {fmt(c.referencia.techfin.bruto)}</span>
                <span><span className="text-teal-700">Taxas</span> {fmt(c.referencia.techfin.taxas)} → líquido {fmt(c.referencia.techfin.valor)}</span>
                {c.referencia.techfin.apelido && <span><span className="text-teal-700">Conta Techfin</span> {c.referencia.techfin.apelido}</span>}
                <span className="col-span-2 md:col-span-3 font-mono text-[10px] break-all"><span className="text-teal-700 font-sans">E2E</span> {c.referencia.techfin.repasse}</span>
              </div>
              {c.referencia.techfin.naoLocalizados > 0 && <p className="mt-1 text-orange-800">{c.referencia.techfin.naoLocalizados} Pix sem título PIX correspondente no TOTVS (filial/valor/data).</p>}
            </div>
          )}

          {dados?.itens?.length > 1 && (
            <div className="border border-violet-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-violet-50 text-xs font-semibold text-violet-900">
                {dados.itens.length} {dados.itens.every((it) => it.techfin) ? 'Pix do repasse' : 'duplicatas'} somando {fmt(dados.parcial?.totalUsado)}
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <Th>Origem</Th>
                    <Th>Fornecedor</Th>
                    <Th>Duplicata</Th>
                    <Th>Vencimento</Th>
                    <Th>Pagamento</Th>
                    <Th right>Valor dup.</Th>
                    <Th right>Usado aqui</Th>
                  </tr>
                </thead>
                <tbody>
                  {dados.itens.map((it, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5"><Badge cfg={origemCfg(it.origem)}>{origemCfg(it.origem).label}</Badge></td>
                      <td className="px-3 py-1.5">{it.nome || '—'}{it.doc ? <span className="block text-[10px] text-gray-400">{fmtDoc(it.doc)}</span> : null}</td>
                      <td className="px-3 py-1.5 font-mono">{it.duplicata ? String(it.duplicata).replace('|', '/') : '—'}{it.techfin?.nsu ? <span className="block text-[9px] text-gray-400 break-all font-mono">{it.techfin.nsu}</span> : null}</td>
                      <td className="px-3 py-1.5">{fmtData(it.vencimento)}</td>
                      <td className="px-3 py-1.5">{it.techfin?.pagamento ? <span>{String(it.techfin.pagamento).slice(0, 16).replace('T', ' ')}<span className="block text-[10px] text-gray-400">bruto {fmt(it.techfin.bruto)} − {fmt(it.techfin.taxa)}</span></span> : fmtData(it.data)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(it.valorDuplicata)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{fmt(it.valorUsado)}{it.parcial ? <span className="ml-1 text-[10px] text-orange-700">parcial</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dados?.folha && <DetalheFolha folha={dados.folha} valorLinha={l?.valor} />}

          {o?.stone && <DetalheStone o={o} />}

          {o && !o.stone && (
            <>
              <DetalheOrigem o={o} l={l} />

              {dados.parcial?.valorDuplicata != null && (dados.usos?.length > 0 || c?.referencia?.parcial) && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
                  <p className="font-semibold">Uso da duplicata: {fmt(dados.parcial.totalUsado)} de {fmt(dados.parcial.valorDuplicata)} · restante {fmt(dados.parcial.restante)}</p>
                  {dados.usos.map((u) => (
                    <p key={u.id}>
                      · {fmtData(u.data)} · {fmt(Math.abs(u.valor))} · {u.justificativa}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          {dados && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Comprovante de pagamento e nota fiscal</p>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { tipo: 'comprovante', rotulo: 'Comprovante de pagamento', tem: temComprovante, daSolicitacao: [sol?.comprovante_url, sol?.comprovante_gestor_url, sol?.comprovante_fabio_url].filter(Boolean) },
                  { tipo: 'nota_fiscal', rotulo: 'Nota fiscal', tem: temNota, daSolicitacao: [sol?.nota_fiscal_url].filter(Boolean) },
                ].map((g) => (
                  <div key={g.tipo} className={`rounded-lg border px-3 py-2 ${g.tem ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        <FileText size={13} /> {g.rotulo}
                        {!g.tem && <span className="text-[10px] text-amber-700 font-normal">· falta</span>}
                      </span>
                      <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#000638] text-white text-[11px] cursor-pointer hover:bg-blue-900">
                        {enviando === g.tipo ? <ArrowsClockwise size={11} className="animate-spin" /> : <UploadSimple size={11} />} Anexar
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={!!enviando} onChange={(e) => onAnexar(g.tipo, e.target.files?.[0])} />
                      </label>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {g.tipo === 'comprovante' && compBot && (
                        <div className="flex items-center gap-2">
                          <Link href={compBot.url}>
                            <FilePdf size={12} className="text-red-600" /> {compBot.nome || 'comprovante'} (portal Stone, pelo bot)
                          </Link>
                          {compBot.solicitacaoId && <span className="text-[10px] text-emerald-700">· anexado na Solicitação Crosby</span>}
                        </div>
                      )}
                      {g.daSolicitacao.map((u, i) => (
                        <div key={`s${i}`}>
                          <Link href={u}>abrir (da solicitação)</Link>
                        </div>
                      ))}
                      {anexos
                        .map((a, idx) => ({ ...a, idx }))
                        .filter((a) => a.tipo === g.tipo)
                        .map((a) => (
                          <div key={a.idx} className="flex items-center gap-2">
                            <Link href={a.url}>{a.nome || 'abrir'}</Link>
                            <span className="text-[10px] text-gray-400">{a.usuario ? `por ${a.usuario} · ` : ''}{a.em ? fmtData(a.em) : ''}</span>
                            <button onClick={() => onRemoverAnexo(a.idx)} className="text-gray-300 hover:text-red-600" title="Remover anexo">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c && (
            <p className="text-[11px] text-gray-400">
              Conciliado {c.automatico ? 'automaticamente' : 'manualmente'}
              {c.pontuacao != null ? ` · ${c.pontuacao} pontos` : ''}
              {c.usuario ? ` · por ${c.usuario}` : ''}
              {c.criado_em ? ` · em ${fmtData(c.criado_em)}` : ''}
              {c.referencia?.motivos?.length ? ` · ${c.referencia.motivos.join(', ')}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export { PainelProLabore, DetalheConciliacao, BotaoComprovanteBot, uploadAnexo, headersUsuario, API, fmt, fmtData, fmtDoc, Badge, Th, origemCfg, bancoCfg, PESSOAS_PRO_LABORE, MESES, iso, ultimoDia };
export default Conciliacao;
