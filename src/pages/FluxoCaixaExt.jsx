// Página: Financeiro → Fluxo de Caixa Ext (extratos bancários)
// Importa os PDFs de extrato dos bancos do grupo (Stone, Sicredi, Caixa,
// Mêntore) e mostra, de forma gerencial, tudo que entrou (por forma de
// pagamento), tudo que saiu (por fornecedor) e o que foi transferido entre
// as próprias contas (saiu da conta A e entrou na conta B).
// Backend: /api/fluxo-caixa-ext (routes/fluxoCaixaExt.routes.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import {
  Wallet,
  UploadSimple,
  Warning,
  Info,
  X,
  ArrowsClockwise,
  MagnifyingGlass,
  ArrowsLeftRight,
  ArrowDown,
  ArrowUp,
  Bank,
  Export,
  Trash,
  PencilSimple,
  Check,
  CalendarBlank,
  FunnelSimple,
  Receipt,
  CreditCard,
  Storefront,
  CaretDown,
  Robot,
  FilePdf,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import BotStoneExtratos from '../components/BotStoneExtratos';

// Escopo dos extratos: 'crosby' (padrão, Extrato Bancário do grupo) ou
// 'dr_ygor' (Financeiro → Dr Ygor → Extratos Bancários, página DrYgorExtratosBancarios).
const API_POR_ESCOPO = {
  crosby: `${API_BASE_URL}/api/fluxo-caixa-ext`,
  dr_ygor: `${API_BASE_URL}/api/dr-ygor/extratos-bancarios`,
};
const SUBTITULO_PADRAO = 'Extratos dos bancos do grupo (Stone, Sicredi, Caixa, Mêntore): tudo que foi recebido por forma de pagamento, tudo que foi pago por fornecedor e o que foi transferido entre as contas';

const fmt = (v) =>
  v != null && !Number.isNaN(Number(v))
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
const fmtN = (v) => (v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDoc = (d) => {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d || '';
};
const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaMes = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

const BANCOS = {
  STONE: { label: 'Stone', cor: 'bg-emerald-100 text-emerald-800 border-emerald-300', ponto: 'bg-emerald-500' },
  SICREDI: { label: 'Sicredi', cor: 'bg-lime-100 text-lime-800 border-lime-300', ponto: 'bg-lime-500' },
  CAIXA: { label: 'Caixa', cor: 'bg-blue-100 text-blue-800 border-blue-300', ponto: 'bg-blue-500' },
  MENTORE: { label: 'Mêntore', cor: 'bg-purple-100 text-purple-800 border-purple-300', ponto: 'bg-purple-500' },
  BNB: { label: 'BNB', cor: 'bg-red-100 text-red-800 border-red-300', ponto: 'bg-red-500' },
  SANTANDER: { label: 'Santander', cor: 'bg-rose-100 text-rose-800 border-rose-300', ponto: 'bg-rose-500' },
  UNICRED: { label: 'Unicred', cor: 'bg-teal-100 text-teal-800 border-teal-300', ponto: 'bg-teal-500' },
  DAYCOVAL: { label: 'Daycoval', cor: 'bg-sky-100 text-sky-800 border-sky-300', ponto: 'bg-sky-500' },
  PAGBANK: { label: 'PagBank', cor: 'bg-amber-100 text-amber-800 border-amber-300', ponto: 'bg-amber-500' },
  PAGARME: { label: 'Pagar.me', cor: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300', ponto: 'bg-fuchsia-500' },
  BB: { label: 'Banco do Brasil', cor: 'bg-yellow-100 text-yellow-800 border-yellow-300', ponto: 'bg-yellow-500' },
  ITAU: { label: 'Itaú', cor: 'bg-orange-100 text-orange-800 border-orange-300', ponto: 'bg-orange-500' },
};
const bancoCfg = (b) => BANCOS[b] || { label: b || '—', cor: 'bg-gray-100 text-gray-700 border-gray-300', ponto: 'bg-gray-400' };

const TIPOS = {
  ENTRADA: { label: 'Entrada', cor: 'bg-green-100 text-green-800 border-green-300', Icon: ArrowDown },
  SAIDA: { label: 'Saída', cor: 'bg-red-100 text-red-700 border-red-300', Icon: ArrowUp },
  TRANSFERENCIA: { label: 'Transf.', cor: 'bg-amber-100 text-amber-800 border-amber-300', Icon: ArrowsLeftRight },
};

const Kpi = ({ label, value, sub, tone = 'text-gray-800', Icon, accent = 'bg-gray-100 text-gray-500' }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
    <div className="flex items-center gap-2 mb-1.5">
      {Icon && (
        <div className={`p-1.5 rounded-lg ${accent}`}>
          <Icon size={16} weight="bold" />
        </div>
      )}
      <p className="text-[10px] md:text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
    </div>
    <p className={`text-lg md:text-2xl font-bold ${tone}`}>{value}</p>
    {sub && <p className="text-[10px] md:text-[11px] text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const Badge = ({ cfg, children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${cfg.cor}`}>
    {children}
  </span>
);

const Th = ({ children, right, className = '' }) => (
  <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : 'text-left'} ${className}`}>{children}</th>
);

// Seletor com múltipla escolha (checkboxes) usado nos filtros
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
  const resumo = !valor.length
    ? placeholder
    : valor.length === 1
      ? opcoes.find((o) => o.value === valor[0])?.label || String(valor[0])
      : `${valor.length} selecionados`;
  return (
    <div ref={ref} className={`relative ${larguraMin}`}>
      <label className="block text-xs font-semibold mb-0.5 text-[#000638]">{label}</label>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs border rounded-lg ${valor.length ? 'border-blue-400 bg-white text-blue-700 font-medium' : 'border-[#000638]/30 bg-[#f8f9fb] text-[#000638] hover:bg-white'}`}
      >
        <span className="truncate">{resumo}</span>
        <CaretDown size={12} className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="absolute z-40 mt-1 left-0 w-72 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs text-gray-800">
          {busca && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="w-full mb-2 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          )}
          <div className="flex justify-between mb-1 px-1 text-[11px]">
            <button type="button" onClick={() => onChange([...new Set([...valor, ...visiveis.map((o) => o.value)])])} className="text-blue-600 hover:underline">
              Marcar todos
            </button>
            <button type="button" onClick={() => onChange([])} className="text-gray-500 hover:underline">
              Limpar
            </button>
          </div>
          <div className="max-h-60 overflow-auto">
            {visiveis.map((o) => (
              <label key={String(o.value)} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-gray-800">
                <input type="checkbox" checked={valor.includes(o.value)} onChange={() => toggle(o.value)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-gray-800">{renderOpcao ? renderOpcao(o) : o.label}</span>
              </label>
            ))}
            {!visiveis.length && <p className="px-1.5 py-2 text-gray-400">Nada encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const FluxoCaixaExt = ({ escopo = 'crosby', titulo = 'Extrato Bancário', subtitulo = SUBTITULO_PADRAO, mostrarBot = true } = {}) => {
  const API = API_POR_ESCOPO[escopo] || API_POR_ESCOPO.crosby;
  const inputRef = useRef(null);
  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(hoje());
  const [bancos, setBancos] = useState([]); // filtro
  const [contasSel, setContasSel] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [formas, setFormas] = useState([]);
  const [contraparte, setContraparte] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaDeb, setBuscaDeb] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(true);

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [migrationPendente, setMigrationPendente] = useState(false);
  const [aba, setAba] = useState('lancamentos');
  const [subPag, setSubPag] = useState('fornecedores');

  // importação
  const [modalImport, setModalImport] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [importacoes, setImportacoes] = useState(null);

  // edição de conta
  const [editConta, setEditConta] = useState(null); // { id, apelido, titular_cnpj }

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(async () => {
    if (!de || !ate) return;
    setCarregando(true);
    setErro(null);
    try {
      const p = new URLSearchParams({ de, ate });
      if (bancos.length) p.set('bancos', bancos.join(','));
      if (contasSel.length) p.set('contas', contasSel.join(','));
      if (tipos.length) p.set('tipos', tipos.join(','));
      if (tipos.length === 1) p.set('tipo', tipos[0]); // compat. com API sem suporte a 'tipos'
      if (formas.length) p.set('formas', formas.join(','));
      if (contraparte) p.set('contraparte', contraparte);
      if (buscaDeb.trim()) p.set('busca', buscaDeb.trim());
      const r = await fetch(`${API}/painel?${p.toString()}`);
      const j = await r.json();
      if (!j?.success) {
        if (j?.error === 'MIGRATION_PENDING' || j?.code === 'MIGRATION_PENDING' || r.status === 503) {
          setMigrationPendente(true);
          setDados(null);
          return;
        }
        throw new Error(j?.message || 'Falha ao carregar o fluxo de caixa.');
      }
      setMigrationPendente(false);
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [de, ate, bancos, contasSel, tipos, formas, contraparte, buscaDeb]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarImportacoes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/importacoes`);
      const j = await r.json();
      if (j?.success) setImportacoes(j.data);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (aba === 'importacoes') carregarImportacoes();
  }, [aba, carregarImportacoes]);

  // ─── importação de PDFs ────────────────────────────────────
  const importar = async (files) => {
    const lista = Array.from(files || []).filter((f) => /\.pdf$/i.test(f.name));
    if (!lista.length) return setErro('Selecione os PDFs dos extratos.');
    setImportando(true);
    setResultadoImport(null);
    setErro(null);
    try {
      const fd = new FormData();
      lista.forEach((f) => fd.append('arquivos', f));
      const r = await fetch(`${API}/importar`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!j?.success) {
        if (r.status === 503) {
          setMigrationPendente(true);
          throw new Error(j?.message || 'Migration pendente.');
        }
        throw new Error(j?.message || 'Falha ao importar.');
      }
      setResultadoImport(j.data);
      // amplia o período para cobrir os extratos importados
      const p = j.data?.periodo;
      if (p?.de && p.de < de) setDe(p.de);
      if (p?.ate && p.ate > ate) setAte(p.ate);
      carregar();
      if (importacoes) carregarImportacoes();
    } catch (e) {
      setErro(e.message);
    } finally {
      setImportando(false);
    }
  };

  const excluirImportacao = async (imp) => {
    if (!window.confirm(`Remover a importação "${imp.arquivo_nome}" (${imp.qtd_lancamentos} lançamentos)?`)) return;
    try {
      const r = await fetch(`${API}/importacoes/${imp.id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message);
      carregarImportacoes();
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  // PDF guardado pelo bot Stone (Storage): abre um link temporário
  const baixarArquivo = async (imp) => {
    try {
      const r = await fetch(`${API}/importacoes/${imp.id}/arquivo`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message);
      window.open(j.data.url, '_blank', 'noopener');
    } catch (e) {
      setErro(e.message);
    }
  };

  // chamado pela aba Bot Stone quando uma execução termina
  const aposBot = useCallback(() => {
    carregar();
    carregarImportacoes();
  }, [carregar, carregarImportacoes]);

  const salvarConta = async () => {
    if (!editConta) return;
    try {
      const r = await fetch(`${API}/contas/${editConta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apelido: editConta.apelido, titular_cnpj: editConta.titular_cnpj }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message);
      setEditConta(null);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const recasar = async () => {
    try {
      const r = await fetch(`${API}/transferencias/recasar?de=${de}&ate=${ate}`, { method: 'POST' });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  // ─── helpers de filtro ─────────────────────────────────────
  const limparFiltros = () => {
    setBancos([]);
    setContasSel([]);
    setTipos([]);
    setFormas([]);
    setContraparte('');
    setBusca('');
  };
  const filtrosAtivos = bancos.length + contasSel.length + tipos.length + formas.length + (contraparte ? 1 : 0) + (busca ? 1 : 0);

  const contas = dados?.contas || [];
  const lancamentos = dados?.lancamentos || [];
  const resumo = dados?.resumo;
  const bancosPresentes = useMemo(() => [...new Set(contas.map((c) => c.banco))], [contas]);
  const saldoFinalTotal = useMemo(() => (dados?.porConta || []).reduce((s, c) => s + (c.saldoFinal || 0), 0), [dados]);
  const bancosDoPorForma = useMemo(() => {
    const s = new Set();
    (dados?.porForma || []).forEach((f) => Object.keys(f.porBanco || {}).forEach((b) => s.add(b)));
    return [...s];
  }, [dados]);

  // ─── exportação ────────────────────────────────────────────
  const exportarExcel = () => {
    if (!dados) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        lancamentos.map((l) => ({
          Data: fmtData(l.data),
          Hora: l.hora || '',
          Banco: bancoCfg(l.banco).label,
          Conta: l.conta_apelido,
          'Titular da conta': l.conta_titular,
          Tipo: TIPOS[l.tipo]?.label || l.tipo,
          'Forma de pagamento': l.forma,
          Histórico: l.descricao,
          Contraparte: l.nomeExibicao || '',
          'CNPJ/CPF': fmtDoc(l.contraparte_doc),
          Documento: l.documento || '',
          Entrada: l.valor > 0 ? l.valor : '',
          Saída: l.valor < 0 ? -l.valor : '',
          'Saldo após': l.saldo_apos ?? '',
          'Transferência para/de': l.transferencia?.outraConta?.apelido || '',
          'Texto do extrato': l.memo,
        })),
      ),
      'Lançamentos',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet((dados.porForma || []).map((f) => ({ 'Forma de pagamento': f.forma, Recebido: f.entradas, 'Qtd recebimentos': f.qtdEntradas, Pago: f.saidas, 'Qtd pagamentos': f.qtdSaidas }))),
      'Por forma',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet((dados.fornecedores || []).map((f) => ({ Fornecedor: f.nome, 'CNPJ/CPF': fmtDoc(f.doc), Qtd: f.qtd, Total: f.total, Formas: Object.entries(f.formas).map(([k, v]) => `${k}: ${fmtN(v)}`).join('; ') }))),
      'Fornecedores',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet((dados.transferencias || []).map((t) => ({ Data: fmtData(t.data), Valor: t.valor, 'Saiu de': `${t.origem.conta} (${bancoCfg(t.origem.banco).label})`, 'Entrou em': `${t.destino.conta} (${bancoCfg(t.destino.banco).label})`, Confiança: t.confianca }))),
      'Transferências',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet((dados.porConta || []).map((c) => ({ Conta: c.conta, Banco: bancoCfg(c.banco).label, Titular: c.titular, CNPJ: fmtDoc(c.cnpj), 'Saldo inicial': c.saldoInicial, Entradas: c.entradas, Saídas: c.saidas, 'Transf. recebidas': c.transfEntradas, 'Transf. enviadas': c.transfSaidas, 'Saldo final': c.saldoFinal }))),
      'Por conta',
    );
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `fluxo_caixa_ext_${de}_${ate}.xlsx`);
  };

  const abas = [
    { id: 'lancamentos', label: `Lançamentos (${lancamentos.length})` },
    { id: 'recebimentos', label: 'Por forma de pagamento' },
    { id: 'pagamentos', label: `Fornecedores (${dados?.fornecedores?.length || 0})` },
    { id: 'transferencias', label: `Transferências entre contas (${dados?.transferencias?.length || 0})` },
    { id: 'contas', label: `Contas (${dados?.porConta?.length || 0})` },
    { id: 'dias', label: 'Por dia' },
    { id: 'importacoes', label: 'Importações' },
    { id: 'bot', label: 'Bot Stone' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle title={titulo} subtitle={subtitulo} icon={Wallet} />

      {/* Barra: período + ações */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-3 flex flex-wrap items-center gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">De</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar nome, CNPJ/CPF, histórico, documento ou valor…"
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setMostrarFiltros((v) => !v)}
          className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1 ${filtrosAtivos ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}
        >
          <FunnelSimple size={14} /> Filtros {filtrosAtivos ? `(${filtrosAtivos})` : ''}
        </button>
        <button onClick={carregar} disabled={carregando} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1">
          <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
        <button onClick={exportarExcel} disabled={!dados} className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
          <Export size={14} /> Excel
        </button>
        <button onClick={() => setModalImport(true)} className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 font-medium">
          <UploadSimple size={14} weight="bold" /> Importar extratos
        </button>
        {mostrarBot && (
          <button
            onClick={() => setAba('bot')}
            className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 font-medium ${aba === 'bot' ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            title="Bot que baixa os extratos das contas Stone, importa aqui e atualiza o saldo na Liberação de Pagamento"
          >
            <Robot size={14} weight="bold" /> Bot Stone
          </button>
        )}
      </div>

      {/* Filtros */}
      {mostrarFiltros && (
        <div className="bg-white rounded-lg shadow-lg border border-[#000638]/10 p-3 mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-bold text-[#000638] flex items-center gap-1.5">
              <FunnelSimple size={16} weight="bold" /> Filtros
            </span>
            {filtrosAtivos > 0 && (
              <button onClick={limparFiltros} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <MultiSelect
              label="Banco"
              opcoes={(bancosPresentes.length ? bancosPresentes : Object.keys(BANCOS)).map((b) => ({ value: b, label: bancoCfg(b).label, banco: b }))}
              valor={bancos}
              onChange={setBancos}
              renderOpcao={(o) => (
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${bancoCfg(o.banco).ponto}`} />
                  {o.label}
                </span>
              )}
              larguraMin="w-full"
            />
            <MultiSelect
              label="Conta"
              busca
              opcoes={contas
                .filter((c) => !bancos.length || bancos.includes(c.banco))
                .map((c) => ({ value: c.id, label: c.apelido, banco: c.banco, sub: c.titular_nome }))}
              valor={contasSel}
              onChange={setContasSel}
              renderOpcao={(o) => (
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${bancoCfg(o.banco).ponto}`} />
                  <span className="whitespace-nowrap text-gray-800">{o.label}</span>
                  <span className="text-gray-400 truncate">{o.sub}</span>
                </span>
              )}
              placeholder={contas.length ? 'Todas as contas' : 'Nenhuma conta importada'}
              larguraMin="w-full"
            />
            <MultiSelect
              label="Tipo"
              opcoes={[
                { value: 'ENTRADA', label: 'Entradas' },
                { value: 'SAIDA', label: 'Saídas' },
                { value: 'TRANSFERENCIA', label: 'Transferências' },
              ]}
              valor={tipos}
              onChange={setTipos}
              larguraMin="w-full"
            />
            <MultiSelect
              label="Forma de pagamento"
              busca
              opcoes={(dados?.opcoes?.formas?.length ? dados.opcoes.formas : dados?.opcoes?.todasFormas || []).map((f) => ({ value: f, label: f }))}
              valor={formas}
              onChange={setFormas}
              placeholder="Todas as formas"
              larguraMin="w-full"
            />
            <div className="w-full">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Fornecedor / contraparte</label>
              <input
                list="fc-contrapartes"
                value={contraparte}
                onChange={(e) => setContraparte(e.target.value)}
                placeholder="Digite para escolher…"
                className="w-full px-2 py-1.5 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
              <datalist id="fc-contrapartes">
                {(dados?.opcoes?.contrapartes || []).map((c) => (
                  <option key={c.chave} value={c.nome}>
                    {c.doc ? fmtDoc(c.doc) : ''}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
        </div>
      )}

      {migrationPendente && (
        <div className="flex items-start gap-2 px-4 py-3 mb-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span>
            As tabelas do Fluxo de Caixa Ext ainda não existem no banco. Rode <code className="font-mono">migrations/fluxo_caixa_ext.sql</code> no SQL Editor do Supabase e atualize a página.
          </span>
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
      {resumo && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6 md:gap-3 mb-4">
          <Kpi label="Recebido (entradas)" value={fmt(resumo.entradas)} sub={`${resumo.qtdEntradas} lançamentos`} tone="text-green-600" Icon={ArrowDown} accent="bg-green-50 text-green-600" />
          <Kpi label="Pago (saídas)" value={fmt(resumo.saidas)} sub={`${resumo.qtdSaidas} lançamentos`} tone="text-red-600" Icon={ArrowUp} accent="bg-red-50 text-red-600" />
          <Kpi label="Resultado" value={fmt(resumo.resultado)} sub="entradas − saídas (sem transferências)" tone={resumo.resultado >= 0 ? 'text-blue-700' : 'text-red-700'} Icon={Receipt} accent="bg-blue-50 text-blue-600" />
          <Kpi label="Transferido entre contas" value={fmt(resumo.transfSaidas)} sub={`${dados.transferencias.length} transferência(s) casada(s)`} tone="text-amber-700" Icon={ArrowsLeftRight} accent="bg-amber-50 text-amber-600" />
          <Kpi label="Saldo final (contas)" value={fmt(saldoFinalTotal)} sub={`${dados.porConta.length} conta(s) com movimento`} Icon={Bank} accent="bg-slate-100 text-slate-600" />
          <Kpi label="Período" value={`${fmtData(de)} – ${fmtData(ate)}`} sub={`${resumo.qtd} lançamentos · ${contas.length} contas`} Icon={CalendarBlank} accent="bg-gray-100 text-gray-500" />
        </div>
      )}

      {/* Abas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-200 bg-gray-50">
          {abas.map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${aba === a.id ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
          {carregando && <ArrowsClockwise size={14} className="animate-spin text-blue-600 ml-2" />}
        </div>

        {mostrarBot && aba === 'bot' && <BotStoneExtratos onImportou={aposBot} />}

        {!dados && !carregando && !migrationPendente && aba !== 'bot' && aba !== 'importacoes' && (
          <div className="p-12 text-center text-gray-400">
            <Bank size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum dado no período. Importe os PDFs dos extratos para começar.</p>
          </div>
        )}

        {/* ── Lançamentos ── */}
        {dados && aba === 'lancamentos' && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                    <Th>Data</Th>
                    <Th>Conta</Th>
                    <Th>Tipo</Th>
                    <Th>Forma</Th>
                    <Th>Histórico</Th>
                    <Th>Contraparte / fornecedor</Th>
                    <Th>Documento</Th>
                    <Th right>Entrada</Th>
                    <Th right>Saída</Th>
                    <Th right>Saldo após</Th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => {
                    const tcfg = TIPOS[l.tipo] || TIPOS.SAIDA;
                    const bcfg = bancoCfg(l.banco);
                    return (
                      <tr key={l.id} className={`border-b border-gray-100 hover:bg-gray-50 text-xs ${l.tipo === 'TRANSFERENCIA' ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fmtData(l.data)} <span className="text-gray-400">{l.hora?.slice(0, 5)}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge cfg={bcfg} title={l.conta_titular}>
                            {l.conta_apelido}
                          </Badge>
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
                              {l.contraparteGrupo && <span className="ml-1 px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px]" title="CNPJ de uma empresa do grupo (conta não importada ou sem par)">grupo</span>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-400 max-w-[140px] truncate" title={l.documento || ''}>
                          {l.documento || ''}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">{l.valor > 0 ? fmt(l.valor) : ''}</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600 whitespace-nowrap">{l.valor < 0 ? fmt(-l.valor) : ''}</td>
                        <td className={`px-3 py-2 text-right whitespace-nowrap ${l.saldo_apos < 0 ? 'text-red-600' : 'text-gray-500'}`}>{l.saldo_apos != null ? fmt(l.saldo_apos) : ''}</td>
                      </tr>
                    );
                  })}
                  {!lancamentos.length && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                        Nenhum lançamento com esses filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
                {resumo && (
                  <tfoot>
                    <tr className="bg-gray-50 text-xs font-semibold">
                      <td colSpan={7} className="px-3 py-2 text-right text-gray-500">
                        Total do filtro ({lancamentos.length}) · transferências: +{fmt(resumo.transfEntradas)} / −{fmt(resumo.transfSaidas)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-700">{fmt(resumo.entradas + resumo.transfEntradas)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{fmt(resumo.saidas + resumo.transfSaidas)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
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
                      </span>
                      <span className="flex gap-1">
                        <Badge cfg={bancoCfg(l.banco)}>{l.conta_apelido}</Badge>
                        <Badge cfg={tcfg}>{tcfg.label}</Badge>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Por forma de pagamento ── */}
        {dados && aba === 'recebimentos' && (
          <div className="p-3 grid gap-4 lg:grid-cols-2">
            {[
              { titulo: 'Recebido por forma de pagamento', campo: 'entradas', qtd: 'qtdEntradas', tone: 'text-green-700', Icon: ArrowDown },
              { titulo: 'Pago por forma de pagamento', campo: 'saidas', qtd: 'qtdSaidas', tone: 'text-red-600', Icon: ArrowUp },
            ].map(({ titulo, campo, qtd, tone, Icon }) => {
              const linhas = dados.porForma.filter((f) => f[campo] > 0).sort((a, b) => b[campo] - a[campo]);
              const total = linhas.reduce((s, f) => s + f[campo], 0);
              return (
                <div key={campo} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Icon size={16} className={tone} weight="bold" /> {titulo}
                    <span className={`ml-auto ${tone}`}>{fmt(total)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-100">
                          <Th>Forma</Th>
                          <Th right>Qtd</Th>
                          {bancosDoPorForma.map((b) => (
                            <Th key={b} right>
                              {bancoCfg(b).label}
                            </Th>
                          ))}
                          <Th right>Total</Th>
                          <Th right>%</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map((f) => (
                          <tr key={f.forma} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => { setFormas([f.forma]); setTipos([campo === 'entradas' ? 'ENTRADA' : 'SAIDA']); setAba('lancamentos'); }}>
                            <td className="px-3 py-2 font-medium text-gray-800">{f.forma}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{f[qtd]}</td>
                            {bancosDoPorForma.map((b) => (
                              <td key={b} className="px-3 py-2 text-right text-gray-600">
                                {f.porBanco?.[b]?.[campo] ? fmtN(f.porBanco[b][campo]) : ''}
                              </td>
                            ))}
                            <td className={`px-3 py-2 text-right font-semibold ${tone}`}>{fmt(f[campo])}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{total ? ((f[campo] / total) * 100).toFixed(1) : '0.0'}%</td>
                          </tr>
                        ))}
                        {!linhas.length && (
                          <tr>
                            <td colSpan={4 + bancosDoPorForma.length} className="px-3 py-6 text-center text-gray-400">
                              Nada no período.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Fornecedores / pagadores ── */}
        {dados && aba === 'pagamentos' && (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-xs">
              {[
                ['fornecedores', `Fornecedores — a quem pagamos (${dados.fornecedores.length})`],
                ['pagadores', `Pagadores — de quem recebemos (${dados.pagadores.length})`],
              ].map(([k, l]) => (
                <button key={k} onClick={() => setSubPag(k)} className={`px-3 py-1.5 rounded-full border font-medium ${subPag === k ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {l}
                </button>
              ))}
              <span className="ml-auto text-gray-400">Clique numa linha para ver os lançamentos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <Th>#</Th>
                    <Th>{subPag === 'fornecedores' ? 'Fornecedor / favorecido' : 'Pagador'}</Th>
                    <Th>CNPJ / CPF</Th>
                    <Th right>Qtd</Th>
                    <Th>Formas de pagamento</Th>
                    <Th>Contas</Th>
                    <Th>Período</Th>
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {(subPag === 'fornecedores' ? dados.fornecedores : dados.pagadores).map((f, i) => (
                    <tr key={f.chave || i} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => { setContraparte(f.doc || f.nome); setTipos([subPag === 'fornecedores' ? 'SAIDA' : 'ENTRADA']); setAba('lancamentos'); }}>
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {f.nome}
                        {f.grupo && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-normal">empresa do grupo</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{f.doc ? fmtDoc(f.doc) : '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{f.qtd}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(f.formas).map(([k, v]) => (
                            <span key={k} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap">
                              {k}: {fmtN(v)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{Object.keys(f.bancos).join(', ')}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {fmtData(f.primeiraData)}
                        {f.primeiraData !== f.ultimaData ? ` – ${fmtData(f.ultimaData)}` : ''}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${subPag === 'fornecedores' ? 'text-red-600' : 'text-green-700'}`}>{fmt(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Transferências entre contas ── */}
        {dados && aba === 'transferencias' && (
          <div>
            <div className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 text-xs text-gray-600 bg-amber-50/50">
              <Info size={14} className="shrink-0 mt-0.5 text-amber-700" />
              <span>
                Casamento automático: uma <strong>saída</strong> numa conta do grupo e uma <strong>entrada</strong> de mesmo valor em outra conta, no mesmo dia ou no dia seguinte, com a contraparte batendo com o titular (CNPJ, nome ou banco). Essas linhas ficam fora de "Recebido" e "Pago".
              </span>
              <button onClick={recasar} className="ml-auto px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-50 whitespace-nowrap flex items-center gap-1">
                <ArrowsClockwise size={12} /> Recasar período
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <Th>Data</Th>
                    <Th right>Valor</Th>
                    <Th>Saiu da conta</Th>
                    <Th />
                    <Th>Entrou na conta</Th>
                    <Th>Como aparece nos extratos</Th>
                    <Th>Confiança</Th>
                  </tr>
                </thead>
                <tbody>
                  {dados.transferencias.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fmtData(t.data)}
                        {t.dataEntrada && t.dataEntrada !== t.data && <span className="text-gray-400"> → {fmtData(t.dataEntrada)}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-800 whitespace-nowrap">{fmt(t.valor)}</td>
                      <td className="px-3 py-2">
                        <Badge cfg={bancoCfg(t.origem.banco)} title={t.origem.titular}>
                          {t.origem.conta}
                        </Badge>
                        <div className="text-gray-400 text-[11px] mt-0.5">{t.origem.titular}</div>
                      </td>
                      <td className="px-1 py-2 text-amber-600">
                        <ArrowsLeftRight size={16} />
                      </td>
                      <td className="px-3 py-2">
                        <Badge cfg={bancoCfg(t.destino.banco)} title={t.destino.titular}>
                          {t.destino.conta}
                        </Badge>
                        <div className="text-gray-400 text-[11px] mt-0.5">{t.destino.titular}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        <div>
                          <span className="text-red-600">−</span> {t.origem.forma} · {t.origem.descricao} {t.origem.contraparte ? `· ${t.origem.contraparte}` : ''}
                        </div>
                        <div>
                          <span className="text-green-700">+</span> {t.destino.forma} · {t.destino.descricao} {t.destino.contraparte ? `· ${t.destino.contraparte}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] ${t.confianca === 'alta' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{t.confianca}</span>
                      </td>
                    </tr>
                  ))}
                  {!dados.transferencias.length && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                        Nenhuma transferência entre contas identificada no período.
                      </td>
                    </tr>
                  )}
                </tbody>
                {dados.transferencias.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-2 text-gray-500">Total ({dados.transferencias.length})</td>
                      <td className="px-3 py-2 text-right text-amber-800">{fmt(dados.transferencias.reduce((s, t) => s + t.valor, 0))}</td>
                      <td colSpan={5} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── Contas ── */}
        {dados && aba === 'contas' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <Th>Conta</Th>
                  <Th>Titular</Th>
                  <Th>CNPJ</Th>
                  <Th>Agência / conta</Th>
                  <Th right>Saldo inicial</Th>
                  <Th right>Entradas</Th>
                  <Th right>Saídas</Th>
                  <Th right>Transf. recebidas</Th>
                  <Th right>Transf. enviadas</Th>
                  <Th right>Saldo final</Th>
                  <Th>Último extrato</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => {
                  const m = dados.porConta.find((x) => x.contaId === c.id) || {};
                  const editando = editConta?.id === c.id;
                  return (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        {editando ? (
                          <input value={editConta.apelido || ''} onChange={(e) => setEditConta({ ...editConta, apelido: e.target.value })} className="px-2 py-1 border border-gray-300 rounded w-36" />
                        ) : (
                          <Badge cfg={bancoCfg(c.banco)}>{c.apelido}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{c.titular_nome || '—'}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {editando ? (
                          <input value={editConta.titular_cnpj || ''} onChange={(e) => setEditConta({ ...editConta, titular_cnpj: e.target.value })} placeholder="só números" className="px-2 py-1 border border-gray-300 rounded w-40" />
                        ) : (
                          fmtDoc(c.titular_cnpj) || <span className="text-amber-600">não informado</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {c.agencia} / {c.conta}
                        {c.conta_dv ? `-${c.conta_dv}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{m.saldoInicial != null ? fmt(m.saldoInicial) : '—'}</td>
                      <td className="px-3 py-2 text-right text-green-700">{m.entradas ? fmt(m.entradas) : ''}</td>
                      <td className="px-3 py-2 text-right text-red-600">{m.saidas ? fmt(m.saidas) : ''}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{m.transfEntradas ? fmt(m.transfEntradas) : ''}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{m.transfSaidas ? fmt(m.transfSaidas) : ''}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${m.saldoFinal < 0 ? 'text-red-600' : 'text-gray-800'}`}>{m.saldoFinal != null ? fmt(m.saldoFinal) : '—'}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {c.ultimaImportacao ? `${fmtData(c.ultimaImportacao.periodoInicio)} – ${fmtData(c.ultimaImportacao.periodoFim)}` : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {editando ? (
                          <>
                            <button onClick={salvarConta} className="text-green-600 hover:text-green-800 mr-2" title="Salvar">
                              <Check size={16} weight="bold" />
                            </button>
                            <button onClick={() => setEditConta(null)} className="text-gray-400 hover:text-gray-600" title="Cancelar">
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setEditConta({ id: c.id, apelido: c.apelido, titular_cnpj: c.titular_cnpj || '' })} className="text-gray-400 hover:text-blue-600" title="Editar apelido / CNPJ">
                            <PencilSimple size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-gray-400">
              O CNPJ do titular é usado para casar transferências entre contas (o extrato do Sicredi não traz o CNPJ do associado — informe aqui).
            </p>
          </div>
        )}

        {/* ── Por dia ── */}
        {dados && aba === 'dias' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <Th>Dia</Th>
                  <Th right>Lançamentos</Th>
                  <Th right>Recebido</Th>
                  <Th right>Pago</Th>
                  <Th right>Resultado do dia</Th>
                  <Th right>Acumulado</Th>
                  <Th right>Transferido entre contas</Th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let acum = 0;
                  return dados.porDia.map((d) => {
                    const res = d.entradas - d.saidas;
                    acum += res;
                    return (
                      <tr key={d.data} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{fmtData(d.data)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{d.qtd}</td>
                        <td className="px-3 py-2 text-right text-green-700">{fmt(d.entradas)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{fmt(d.saidas)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${res < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmt(res)}</td>
                        <td className={`px-3 py-2 text-right ${acum < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmt(acum)}</td>
                        <td className="px-3 py-2 text-right text-amber-700">{d.transf ? fmt(d.transf) : ''}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Importações ── */}
        {aba === 'importacoes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <Th>Quando</Th>
                  <Th>Arquivo</Th>
                  <Th>Conta</Th>
                  <Th>Período</Th>
                  <Th right>Lançamentos</Th>
                  <Th right>Saldo inicial</Th>
                  <Th right>Saldo final</Th>
                  <Th>Avisos</Th>
                  <Th>Por</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {(importacoes || []).map((i) => (
                  <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{new Date(i.importado_em).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-gray-800">
                      {i.arquivo_path ? (
                        <button onClick={() => baixarArquivo(i)} className="inline-flex items-center gap-1 text-blue-700 hover:underline" title="Abrir o PDF guardado">
                          <FilePdf size={14} className="text-red-600 shrink-0" /> {i.arquivo_nome}
                        </button>
                      ) : (
                        i.arquivo_nome
                      )}
                      {i.origem?.startsWith('bot-stone') && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-700" title={i.origem === 'bot-stone-pdf' ? 'PDF baixado pelo bot' : 'Lançamentos pela API do portal (bot, sem PDF)'}>
                          <Robot size={11} /> {i.origem === 'bot-stone-pdf' ? 'bot' : 'bot·API'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{i.conta ? <Badge cfg={bancoCfg(i.conta.banco)}>{i.conta.apelido}</Badge> : i.conta_id}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtData(i.periodo_inicio)} – {fmtData(i.periodo_fim)}
                    </td>
                    <td className="px-3 py-2 text-right">{i.qtd_lancamentos}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(i.saldo_inicial)}</td>
                    <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmt(i.saldo_final)}</td>
                    <td className="px-3 py-2 text-amber-700 max-w-[260px] truncate" title={(i.avisos || []).join(' · ')}>
                      {i.inconsistencias ? `${i.inconsistencias} inconsistência(s) de saldo · ` : ''}
                      {(i.avisos || []).join(' · ')}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{i.usuario || '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => excluirImportacao(i)} className="text-gray-400 hover:text-red-600" title="Remover importação e seus lançamentos">
                        <Trash size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {importacoes && !importacoes.length && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                      Nenhum extrato importado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de importação */}
      {modalImport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !importando && setModalImport(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <UploadSimple size={18} /> Importar extratos (PDF)
              </h3>
              <button onClick={() => !importando && setModalImport(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  importar(e.dataTransfer?.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${arrastando ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
              >
                <input ref={inputRef} type="file" accept=".pdf,.xlsx" multiple className="hidden" onChange={(e) => importar(e.target.files)} />
                {importando ? <ArrowsClockwise size={30} className="animate-spin text-blue-600 mb-2" /> : <UploadSimple size={30} className="text-blue-600 mb-2" />}
                <p className="text-sm font-medium text-gray-700">{importando ? 'Lendo e gravando os extratos…' : 'Arraste os PDFs dos extratos aqui (pode ser vários de uma vez), ou clique para escolher'}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Aceita o <strong>Extrato de conta corrente</strong> da Stone, o extrato do <strong>Sicredi</strong>, o extrato da <strong>Caixa</strong> e o da <strong>Mêntore</strong>. O banco e a conta são
                  reconhecidos pelo próprio PDF. Reimportar o mesmo período substitui os lançamentos.
                </p>
              </div>

              {resultadoImport && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Resultado: {resultadoImport.resultados.filter((r) => r.ok).length} de {resultadoImport.resultados.length} importado(s)
                    {resultadoImport.transferencias ? ` · ${resultadoImport.transferencias.criadas} transferência(s) entre contas casada(s)` : ''}
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg text-xs">
                    {resultadoImport.resultados.map((r, i) => (
                      <div key={i} className="px-3 py-2 flex items-start gap-2">
                        {r.ok ? <Check size={14} className="text-green-600 mt-0.5 shrink-0" weight="bold" /> : <Warning size={14} className="text-red-600 mt-0.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 truncate">{r.arquivo}</p>
                          {r.ok ? (
                            <p className="text-gray-500">
                              <Badge cfg={bancoCfg(r.banco)}>{r.conta}</Badge> {r.titular} · {fmtData(r.periodo.inicio)} – {fmtData(r.periodo.fim)} · {r.qtd} lançamentos · saldo {fmt(r.saldo.inicial)} → {fmt(r.saldo.final)}
                              {r.inconsistencias ? <span className="text-amber-700"> · {r.inconsistencias} inconsistência(s) de saldo</span> : ''}
                              {r.avisos?.length ? <span className="text-amber-700"> · {r.avisos.join(' · ')}</span> : ''}
                            </p>
                          ) : (
                            <p className="text-red-600">{r.erro}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FluxoCaixaExt;
