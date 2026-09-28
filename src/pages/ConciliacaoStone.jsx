// Página: Financeiro → Conciliação Stone × TOTVS
// Puxa o extrato diário da API de Conciliação da Stone (via backend, com
// cache) e bate cada venda de cartão com o título correspondente no TOTVS
// (portador "STONE - <bandeira> (C|D)"). Mostra o que casou, o que só existe
// na Stone e o que só existe no TOTVS, e permite vincular manualmente.
// Backend: /api/conciliacao-stone (routes/conciliacaoStone.routes.js).
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import {
  CreditCard,
  MagnifyingGlass,
  Export,
  Warning,
  Storefront,
  CalendarBlank,
  ArrowsClockwise,
  CaretUp,
  CaretDown,
  Info,
  CheckCircle,
  XCircle,
  LinkSimple,
  LinkBreak,
  Bank,
  Key,
  X,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const API = `${API_BASE_URL}/api/conciliacao-stone`;

const BRAND_COLORS = {
  Visa: 'bg-blue-100 text-blue-800 border-blue-300',
  Mastercard: 'bg-orange-100 text-orange-800 border-orange-300',
  Elo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Amex: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  Hipercard: 'bg-red-100 text-red-800 border-red-300',
};

const NIVEL_COLORS = {
  manual: 'bg-purple-100 text-purple-800 border-purple-300',
  exato: 'bg-green-100 text-green-800 border-green-300',
  bandeira: 'bg-amber-100 text-amber-800 border-amber-300',
  data: 'bg-amber-100 text-amber-800 border-amber-300',
  valor: 'bg-orange-100 text-orange-800 border-orange-300',
};

const fmt = (v) =>
  v != null && !Number.isNaN(Number(v))
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDataHora = (s) => (s ? `${fmtData(s)} ${String(s).slice(11, 16)}`.trim() : '—');

const diasAtrasISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const Badge = ({ className = '', children }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${className}`}>
    {children}
  </span>
);

const BandeiraBadge = ({ bandeira, tipo }) => (
  <span className="inline-flex items-center gap-1">
    <Badge className={BRAND_COLORS[bandeira] || 'bg-gray-100 text-gray-600 border-gray-300'}>{bandeira || '—'}</Badge>
    {tipo && <span className="text-[11px] text-gray-500">{tipo}</span>}
  </span>
);

const Kpi = ({ label, value, sub, tone = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-base md:text-xl font-bold mt-0.5 ${tone}`}>{value}</p>
    {sub && <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const ConciliacaoStone = () => {
  const { user } = useAuth() || {};
  const usuario = user?.name || user?.nome || user?.email || null;

  const [lojas, setLojas] = useState([]);
  const [stonecode, setStonecode] = useState('all');
  const [inicio, setInicio] = useState(diasAtrasISO(7));
  const [fim, setFim] = useState(diasAtrasISO(1));

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [aba, setAba] = useState('conciliadas');
  const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });
  const [lojaFoco, setLojaFoco] = useState(null); // stonecode em foco quando "todas"
  const [vinculando, setVinculando] = useState(null); // transação Stone escolhida p/ vínculo
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/lojas`);
        const j = await r.json();
        // backend novo devolve { lojas, totvsOk }; o antigo devolvia a lista direto
        const lista = Array.isArray(j?.data) ? j.data : j?.data?.lojas || [];
        // tolera backend antigo (sem filiais/temChave) sem quebrar a página
        setLojas(
          lista.map((l) => ({
            ...l,
            filiais: Array.isArray(l.filiais) ? l.filiais : l.filial ? [l.filial] : [],
            temChave: l.temChave !== false,
          })),
        );
      } catch (e) {
        console.error('Erro ao carregar lojas Stone:', e);
      }
    })();
  }, []);

  const consultar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (inicio > fim) {
        setErro('A data inicial não pode ser maior que a final.');
        return;
      }
      if (!silencioso) setLoading(true);
      setErro(null);
      try {
        const params = new URLSearchParams({ stonecode, inicio, fim });
        const r = await fetch(`${API}/batimento?${params}`);
        const j = await r.json();
        if (!j?.success) throw new Error(j?.message || 'Falha na consulta.');
        setResultado(j.data);
        setLojaFoco(null);
      } catch (e) {
        console.error('Erro no batimento:', e);
        setErro(e.message || 'Erro ao consultar conciliação.');
        setResultado(null);
      } finally {
        setLoading(false);
      }
    },
    [stonecode, inicio, fim],
  );

  // ─── dados derivados ───────────────────────────────────────
  const lojasResultado = resultado?.lojas || [];
  const lojasVisiveis = useMemo(
    () => (lojaFoco ? lojasResultado.filter((l) => l.loja.stonecode === lojaFoco) : lojasResultado),
    [lojasResultado, lojaFoco],
  );

  const linhas = useMemo(() => {
    const out = [];
    for (const l of lojasVisiveis) {
      const loja = l.loja;
      if (aba === 'conciliadas' || aba === 'divergencias') {
        for (const p of l.pares) {
          if (aba === 'divergencias' && !p.divergencias.length) continue;
          out.push({
            kind: 'par',
            loja,
            data: p.stone.dataCaptura || p.stone.dataVenda,
            valor: p.stone.valorBruto,
            bandeira: p.stone.bandeira,
            par: p,
          });
        }
      } else if (aba === 'stone') {
        for (const s of l.stoneSemTotvs) {
          out.push({ kind: 'stone', loja, data: s.dataCaptura || s.dataVenda, valor: s.valorBruto, bandeira: s.bandeira, stone: s });
        }
      } else if (aba === 'totvs') {
        for (const t of l.totvsSemStone) {
          out.push({ kind: 'totvs', loja, data: t.dataEmissao, valor: t.valor, bandeira: t.bandeira, totvs: t });
        }
      } else if (aba === 'pagamentos') {
        for (const p of l.pagamentos) {
          out.push({ kind: 'pagamento', loja, data: p.data, valor: p.valorTotal, bandeira: p.carteira, pagamento: p });
        }
      } else if (aba === 'erros') {
        for (const e of l.erros) out.push({ kind: 'erro', loja, data: e.data, valor: null, erro: e });
      }
    }
    const { key, direction } = sortConfig;
    out.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return direction === 'asc' ? -1 : 1;
      if (va > vb) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [lojasVisiveis, aba, sortConfig]);

  const geral = useMemo(() => {
    if (!resultado) return null;
    if (!lojaFoco) return resultado.geral;
    const r = lojasVisiveis[0]?.resumo;
    if (!r) return resultado.geral;
    return {
      ...resultado.geral,
      stoneQtd: r.stone.qtd,
      stoneBruto: r.stone.bruto,
      stoneLiquido: r.stone.liquido,
      stoneTaxa: r.stone.taxa,
      totvsQtd: r.totvs.qtd,
      totvsValor: r.totvs.valor,
      conciliadasQtd: r.conciliadas.qtd,
      conciliadasValor: r.conciliadas.valorStone,
      comDivergencia: r.conciliadas.comDivergencia,
      stoneSemTotvsQtd: r.stoneSemTotvs.qtd,
      stoneSemTotvsValor: r.stoneSemTotvs.valor,
      totvsSemStoneQtd: r.totvsSemStone.qtd,
      totvsSemStoneValor: r.totvsSemStone.valor,
      pagamentosValor: r.pagamentos.valor,
      diferenca: r.diferenca,
      percentualConciliado: r.percentualConciliado,
      diasComErro: r.diasComErro,
    };
  }, [resultado, lojaFoco, lojasVisiveis]);

  const contagem = useMemo(() => {
    const c = { conciliadas: 0, divergencias: 0, stone: 0, totvs: 0, pagamentos: 0, erros: 0 };
    for (const l of lojasVisiveis) {
      c.conciliadas += l.pares.length;
      c.divergencias += l.pares.filter((p) => p.divergencias.length).length;
      c.stone += l.stoneSemTotvs.length;
      c.totvs += l.totvsSemStone.length;
      c.pagamentos += l.pagamentos.length;
      c.erros += l.erros.length;
    }
    return c;
  }, [lojasVisiveis]);

  const handleSort = (key) =>
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

  const SortIcon = ({ col }) =>
    sortConfig.key !== col ? null : sortConfig.direction === 'asc' ? (
      <CaretUp size={12} weight="bold" />
    ) : (
      <CaretDown size={12} weight="bold" />
    );

  // ─── vínculo manual ────────────────────────────────────────
  const candidatosVinculo = useMemo(() => {
    if (!vinculando) return [];
    const l = lojasResultado.find((x) => x.loja.stonecode === vinculando.loja.stonecode);
    if (!l) return [];
    const s = vinculando.stone;
    return [...l.totvsSemStone]
      .map((t) => ({ t, score: Math.abs(t.valor - s.valorBruto) * 10 + (t.dataEmissao === s.dataVenda ? 0 : 5) }))
      .sort((a, b) => a.score - b.score)
      .map((x) => x.t);
  }, [vinculando, lojasResultado]);

  const salvarVinculo = async (t) => {
    if (!vinculando) return;
    setSalvandoVinculo(true);
    try {
      const r = await fetch(`${API}/vinculos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stonecode: vinculando.loja.stonecode,
          nsu: vinculando.stone.nsu,
          filial: t.filial,
          titulo: t.titulo,
          usuario,
        }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao salvar vínculo.');
      setVinculando(null);
      setAviso('Vínculo salvo. Recarregando batimento…');
      await consultar({ silencioso: true });
      setAviso(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvandoVinculo(false);
    }
  };

  const desfazerVinculo = async (par) => {
    if (!par?.vinculo?.id) return;
    if (!window.confirm('Desfazer este vínculo manual?')) return;
    try {
      const r = await fetch(`${API}/vinculos/${par.vinculo.id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao remover vínculo.');
      await consultar({ silencioso: true });
    } catch (e) {
      setErro(e.message);
    }
  };

  // ─── exportação ────────────────────────────────────────────
  const exportarExcel = () => {
    if (!resultado) return;
    const wb = XLSX.utils.book_new();
    const resumoRows = lojasResultado.map((l) => ({
      Loja: l.loja.nome,
      CNPJ: l.loja.cnpj,
      StoneCode: l.loja.stonecode,
      'Filial TOTVS': l.loja.filiais.join(', '),
      'Stone qtd': l.resumo.stone.qtd,
      'Stone bruto': l.resumo.stone.bruto,
      'Stone líquido': l.resumo.stone.liquido,
      'Stone taxas': l.resumo.stone.taxa,
      'TOTVS qtd': l.resumo.totvs.qtd,
      'TOTVS valor': l.resumo.totvs.valor,
      Conciliadas: l.resumo.conciliadas.qtd,
      '% conciliado': l.resumo.percentualConciliado,
      'Só Stone qtd': l.resumo.stoneSemTotvs.qtd,
      'Só Stone valor': l.resumo.stoneSemTotvs.valor,
      'Só TOTVS qtd': l.resumo.totvsSemStone.qtd,
      'Só TOTVS valor': l.resumo.totvsSemStone.valor,
      'Diferença (Stone − TOTVS)': l.resumo.diferenca,
      'Depósitos Stone': l.resumo.pagamentos.valor,
      'Dias c/ erro': l.resumo.diasComErro,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), 'Resumo');

    const pares = lojasResultado.flatMap((l) =>
      l.pares.map((p) => ({
        Loja: l.loja.nome,
        Nível: p.rotulo,
        'Data Stone': p.stone.dataCaptura,
        NSU: p.stone.nsu,
        'Bandeira Stone': p.stone.bandeira,
        'Tipo Stone': p.stone.tipoConta,
        'Parc. Stone': p.stone.parcelas,
        'Bruto Stone': p.stone.valorBruto,
        'Líquido Stone': p.stone.valorLiquido,
        'Taxa Stone': p.stone.taxa,
        Cartão: p.stone.cartao,
        'Filial TOTVS': p.totvs.filial,
        'Título TOTVS': p.totvs.titulo,
        'Data TOTVS': p.totvs.dataEmissao,
        'Portador TOTVS': p.totvs.portador,
        'Parc. TOTVS': p.totvs.parcelas,
        'Valor TOTVS': p.totvs.valor,
        'NF TOTVS': p.totvs.nf,
        'Cliente TOTVS': p.totvs.cliente,
        Divergências: p.divergencias.join('; '),
      })),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pares), 'Conciliadas');

    const soStone = lojasResultado.flatMap((l) =>
      l.stoneSemTotvs.map((s) => ({
        Loja: l.loja.nome,
        Data: s.dataCaptura,
        NSU: s.nsu,
        Bandeira: s.bandeira,
        Tipo: s.tipoConta,
        Parcelas: s.parcelas,
        Bruto: s.valorBruto,
        Líquido: s.valorLiquido,
        Taxa: s.taxa,
        Cartão: s.cartao,
        Autorização: s.codAutorizacao,
        POS: s.serialPos,
        Cancelada: s.cancelada ? 'Sim' : 'Não',
      })),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(soStone), 'Só na Stone');

    const soTotvs = lojasResultado.flatMap((l) =>
      l.totvsSemStone.map((t) => ({
        Loja: l.loja.nome,
        Filial: t.filial,
        Título: t.titulo,
        Emissão: t.dataEmissao,
        Portador: t.portador,
        Bandeira: t.bandeira,
        Tipo: t.tipoConta,
        Parcelas: t.parcelas,
        Valor: t.valor,
        Pago: t.valorPago,
        NF: t.nf,
        Cliente: t.cliente,
        'CPF/CNPJ': t.cpfCnpj,
        Status: t.status,
      })),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(soTotvs), 'Só no TOTVS');

    const pag = lojasResultado.flatMap((l) =>
      l.pagamentos.map((p) => ({
        Loja: l.loja.nome,
        Data: p.data,
        'ID pagamento': p.id,
        Carteira: p.carteira,
        Valor: p.valorTotal,
        'Valor transações': p.valorTransacoes,
        'Saldo negativo anterior': p.saldoNegativoAnterior,
        Banco: p.banco,
        Agência: p.agencia,
        Conta: p.conta,
      })),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pag), 'Depósitos Stone');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `conciliacao_stone_totvs_${inicio}_${fim}.xlsx`);
  };

  const lojasSemChave = lojas.filter((l) => !l.temChave);
  const lojaSelecionada = lojas.find((l) => l.stonecode === stonecode);

  const ABAS = [
    { id: 'conciliadas', label: 'Conciliadas', icon: CheckCircle, n: contagem.conciliadas },
    { id: 'divergencias', label: 'Com divergência', icon: Warning, n: contagem.divergencias },
    { id: 'stone', label: 'Só na Stone', icon: CreditCard, n: contagem.stone },
    { id: 'totvs', label: 'Só no TOTVS', icon: XCircle, n: contagem.totvs },
    { id: 'pagamentos', label: 'Depósitos Stone', icon: Bank, n: contagem.pagamentos },
    { id: 'erros', label: 'Dias com erro', icon: Warning, n: contagem.erros },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle
        title="Conciliação Stone × TOTVS"
        subtitle="Vendas de cartão capturadas na Stone batidas com os títulos de portador STONE no TOTVS"
        icon={CreditCard}
      />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4 mb-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-end md:gap-3">
          <div className="flex-1 min-w-0 md:min-w-[260px]">
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Storefront size={13} /> Loja (StoneCode)
            </label>
            <select
              value={stonecode}
              onChange={(e) => setStonecode(e.target.value)}
              className="w-full px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="all">Todas as lojas com chave ({lojas.filter((l) => l.temChave).length})</option>
              {lojas.map((l) => (
                <option key={l.stonecode} value={l.stonecode} disabled={!l.temChave}>
                  {l.filiais.length ? `${l.filiais.join('/')} · ` : ''}
                  {l.filialTotvs?.nome || l.nome} — {l.cnpjFmt}
                  {!l.temChave ? ' (sem chave Stone)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 md:contents">
            <div className="md:w-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <CalendarBlank size={13} /> Início
              </label>
              <input
                type="date"
                value={inicio}
                max={diasAtrasISO(1)}
                onChange={(e) => setInicio(e.target.value)}
                className="w-full px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:w-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <CalendarBlank size={13} /> Fim
              </label>
              <input
                type="date"
                value={fim}
                max={diasAtrasISO(1)}
                onChange={(e) => setFim(e.target.value)}
                className="w-full px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
            <button
              onClick={() => consultar()}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? <ArrowsClockwise size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
              {loading ? 'Batendo…' : 'Consultar'}
            </button>
            <button
              onClick={exportarExcel}
              disabled={!resultado}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 md:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50"
            >
              <Export size={16} /> Exportar
            </button>
          </div>
        </div>
        {lojaSelecionada?.observacao && (
          <p className="mt-2 text-xs text-amber-700 flex items-start gap-1">
            <Info size={14} className="shrink-0 mt-0.5" /> {lojaSelecionada.observacao}
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 px-3.5 py-2.5 mb-4 bg-blue-50 border border-blue-200 rounded-lg text-xs md:text-sm text-blue-800">
        <Info size={18} className="shrink-0 mt-0.5" />
        <span>
          O arquivo da Stone é <strong>diário</strong>, sai a partir das 5h do dia seguinte e traz só{' '}
          <strong>vendas de maquininha</strong> (PIX e link de pagamento ficam fora). Cada venda é batida com o
          título do TOTVS por <strong>filial + data + valor + parcelas + bandeira</strong>. Os arquivos ficam em cache
          — a Stone permite só 7 downloads por hora para cada loja/dia.
        </span>
      </div>

      {lojasSemChave.length > 0 && (
        <div className="flex items-start gap-2 px-3.5 py-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Key size={16} className="shrink-0 mt-0.5" />
          <span>
            <strong>{lojasSemChave.length} loja(s) ainda sem chave de API da Stone</strong> (gerar no Portal Stone de
            cada CNPJ em Perfil › Chaves de Autenticação › API de Conciliação e cadastrar como{' '}
            <code>STONE_KEY_&lt;stonecode&gt;</code>): {lojasSemChave.map((l) => l.nome).join(', ')}.
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
      {aviso && (
        <div className="px-4 py-2 mb-4 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">{aviso}</div>
      )}

      {/* KPIs */}
      {geral && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-6 md:gap-3 mb-4">
          <Kpi label="Stone (bruto)" value={fmt(geral.stoneBruto)} sub={`${geral.stoneQtd} transações · líq. ${fmt(geral.stoneLiquido)}`} />
          <Kpi label="TOTVS (títulos Stone)" value={fmt(geral.totvsValor)} sub={`${geral.totvsQtd} títulos`} />
          <Kpi
            label="Conciliadas"
            value={geral.percentualConciliado != null ? `${geral.percentualConciliado}%` : '—'}
            sub={`${geral.conciliadasQtd} de ${geral.stoneQtd} · ${fmt(geral.conciliadasValor)}`}
            tone="text-green-600"
          />
          <Kpi label="Só na Stone" value={fmt(geral.stoneSemTotvsValor)} sub={`${geral.stoneSemTotvsQtd} sem título no TOTVS`} tone={geral.stoneSemTotvsQtd ? 'text-red-600' : 'text-gray-900'} />
          <Kpi label="Só no TOTVS" value={fmt(geral.totvsSemStoneValor)} sub={`${geral.totvsSemStoneQtd} sem venda na Stone`} tone={geral.totvsSemStoneQtd ? 'text-orange-600' : 'text-gray-900'} />
          <Kpi
            label="Diferença Stone − TOTVS"
            value={fmt(geral.diferenca)}
            sub={`taxas Stone ${fmt(geral.stoneTaxa)} · depósitos ${fmt(geral.pagamentosValor)}`}
            tone={Math.abs(geral.diferenca || 0) < 0.01 ? 'text-green-600' : 'text-red-600'}
          />
        </div>
      )}

      {/* Quadro por loja */}
      {resultado && lojasResultado.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Por loja</span>
            {lojaFoco && (
              <button onClick={() => setLojaFoco(null)} className="text-xs text-blue-600 hover:underline">
                ver todas as lojas
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <th className="px-3 py-2 text-left font-semibold">Loja</th>
                  <th className="px-3 py-2 text-right font-semibold">Stone</th>
                  <th className="px-3 py-2 text-right font-semibold">TOTVS</th>
                  <th className="px-3 py-2 text-right font-semibold">Conciliado</th>
                  <th className="px-3 py-2 text-right font-semibold">Só Stone</th>
                  <th className="px-3 py-2 text-right font-semibold">Só TOTVS</th>
                  <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                  <th className="px-3 py-2 text-right font-semibold">Depósitos</th>
                  <th className="px-3 py-2 text-center font-semibold">Dias</th>
                </tr>
              </thead>
              <tbody>
                {lojasResultado.map((l) => {
                  const r = l.resumo;
                  const ativo = lojaFoco === l.loja.stonecode;
                  return (
                    <tr
                      key={l.loja.stonecode}
                      onClick={() => setLojaFoco(ativo ? null : l.loja.stonecode)}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 ${ativo ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-800">{l.loja.nome}</div>
                        <div className="text-[10px] text-gray-400">
                          {l.loja.cnpj} · filial {l.loja.filiais.join('/')}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {fmt(r.stone.bruto)} <span className="text-gray-400">({r.stone.qtd})</span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {fmt(r.totvs.valor)} <span className="text-gray-400">({r.totvs.qtd})</span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className={r.percentualConciliado === 100 ? 'text-green-600 font-semibold' : 'text-gray-800'}>
                          {r.percentualConciliado != null ? `${r.percentualConciliado}%` : '—'}
                        </span>{' '}
                        <span className="text-gray-400">({r.conciliadas.qtd})</span>
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap ${r.stoneSemTotvs.qtd ? 'text-red-600' : 'text-gray-400'}`}>
                        {r.stoneSemTotvs.qtd ? `${fmt(r.stoneSemTotvs.valor)} (${r.stoneSemTotvs.qtd})` : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap ${r.totvsSemStone.qtd ? 'text-orange-600' : 'text-gray-400'}`}>
                        {r.totvsSemStone.qtd ? `${fmt(r.totvsSemStone.valor)} (${r.totvsSemStone.qtd})` : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap font-semibold ${Math.abs(r.diferenca) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(r.diferenca)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.pagamentos.valor)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {r.diasOk}/{r.diasConsultados}
                        {r.diasComErro > 0 && <span className="text-red-500"> ({r.diasComErro} erro)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Abas */}
      {resultado && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50">
            {ABAS.map((a) => {
              const Icon = a.icon;
              const ativo = aba === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    ativo ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={14} /> {a.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${ativo ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                    {a.n}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { key: 'loja', label: 'Loja', sortable: false },
                    { key: 'data', label: aba === 'totvs' ? 'Emissão' : 'Data' },
                    ...(aba === 'erros'
                      ? [{ key: 'erro', label: 'Erro', sortable: false }]
                      : aba === 'pagamentos'
                        ? [
                            { key: 'bandeira', label: 'Carteira' },
                            { key: 'id', label: 'ID pagamento', sortable: false },
                            { key: 'conta', label: 'Conta favorecida', sortable: false },
                            { key: 'valor', label: 'Valor depositado' },
                          ]
                        : [
                            { key: 'bandeira', label: 'Bandeira' },
                            { key: 'stoneInfo', label: 'Stone', sortable: false },
                            { key: 'totvsInfo', label: 'TOTVS', sortable: false },
                            { key: 'valor', label: 'Valor' },
                            { key: 'status', label: aba === 'conciliadas' || aba === 'divergencias' ? 'Batimento' : 'Situação', sortable: false },
                            { key: 'acao', label: '', sortable: false },
                          ]),
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label} {col.sortable !== false && <SortIcon col={col.key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      {aba === 'stone' && 'Toda venda da Stone tem título no TOTVS neste período.'}
                      {aba === 'totvs' && 'Todo título Stone do TOTVS tem venda na Stone neste período.'}
                      {aba === 'divergencias' && 'Nenhuma conciliação com divergência.'}
                      {aba === 'conciliadas' && 'Nenhuma transação conciliada.'}
                      {aba === 'pagamentos' && 'Nenhum depósito da Stone no período.'}
                      {aba === 'erros' && 'Todos os dias foram baixados com sucesso.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((ln, i) => <LinhaTabela key={i} ln={ln} onVincular={setVinculando} onDesfazer={desfazerVinculo} podeVincular={resultado.geral.vinculosDisponivel} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden divide-y divide-gray-100">
            {linhas.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm px-6">Nada nesta aba para o período.</div>
            ) : (
              linhas.map((ln, i) => <CardMobile key={i} ln={ln} onVincular={setVinculando} onDesfazer={desfazerVinculo} podeVincular={resultado.geral.vinculosDisponivel} />)
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>{linhas.length} linha(s)</span>
            <span>
              {fmtData(resultado.periodo.inicio)} a {fmtData(resultado.periodo.fim)} · {resultado.periodo.dias} dia(s)
            </span>
            <span>{resultado.geral.tempoMs} ms</span>
            {!resultado.geral.vinculosDisponivel && (
              <span className="text-amber-600">vínculo manual indisponível (tabela stone_conciliacao_vinculos não criada)</span>
            )}
          </div>
        </div>
      )}

      {!resultado && !loading && !erro && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            Selecione a loja e o período e clique em <strong>Consultar</strong>.
          </p>
        </div>
      )}

      {/* Modal de vínculo manual */}
      {vinculando && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4" onClick={() => !salvandoVinculo && setVinculando(null)}>
          <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <LinkSimple size={16} /> Vincular venda Stone a um título do TOTVS
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {vinculando.loja.nome} · {fmtDataHora(vinculando.stone.dataCaptura)} · {vinculando.stone.bandeira} {vinculando.stone.tipoConta} ·{' '}
                  {vinculando.stone.parcelas}x · <strong>{fmt(vinculando.stone.valorBruto)}</strong> · NSU {vinculando.stone.nsu}
                </p>
              </div>
              <button onClick={() => setVinculando(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {candidatosVinculo.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-400">Não há títulos sem vínculo no TOTVS para esta loja no período.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-600">
                      <th className="px-3 py-2 text-left">Emissão</th>
                      <th className="px-3 py-2 text-left">Título</th>
                      <th className="px-3 py-2 text-left">Portador</th>
                      <th className="px-3 py-2 text-center">Parc.</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-right">Δ</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatosVinculo.map((t) => {
                      const delta = +(vinculando.stone.valorBruto - t.valor).toFixed(2);
                      return (
                        <tr key={t.chave} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtData(t.dataEmissao)}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono">
                            {t.filial}/{t.titulo}
                            {t.nf ? <span className="text-gray-400"> NF {t.nf}</span> : null}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{t.portador}</td>
                          <td className="px-3 py-2 text-center">{t.parcelas}x</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(t.valor)}</td>
                          <td className={`px-3 py-2 text-right ${delta === 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(delta)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              disabled={salvandoVinculo}
                              onClick={() => salvarVinculo(t)}
                              className="px-2.5 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                            >
                              Vincular
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── linha da tabela (desktop) ───────────────────────────────
const LinhaTabela = ({ ln, onVincular, onDesfazer, podeVincular }) => {
  const tdc = 'px-3 py-2.5 whitespace-nowrap text-xs';
  const lojaCell = (
    <td className={tdc}>
      <div className="font-medium text-gray-800">{ln.loja.nome}</div>
    </td>
  );

  if (ln.kind === 'erro') {
    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        {lojaCell}
        <td className={tdc}>{fmtData(ln.data)}</td>
        <td className="px-3 py-2.5 text-xs text-red-600">
          {ln.erro.erro} {ln.erro.codigo && <span className="text-gray-400">({ln.erro.codigo})</span>}
        </td>
      </tr>
    );
  }
  if (ln.kind === 'pagamento') {
    const p = ln.pagamento;
    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        {lojaCell}
        <td className={tdc}>{fmtData(ln.data)}</td>
        <td className={tdc}>{p.carteira}</td>
        <td className={`${tdc} font-mono`}>{p.id}</td>
        <td className={tdc}>{p.banco ? `Banco ${p.banco} · ag ${p.agencia} · cc ${p.conta}` : '—'}</td>
        <td className={`${tdc} text-right font-semibold text-green-700`}>{fmt(p.valorTotal)}</td>
      </tr>
    );
  }
  if (ln.kind === 'par') {
    const { stone: s, totvs: t } = ln.par;
    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        {lojaCell}
        <td className={tdc}>{fmtDataHora(s.dataCaptura)}</td>
        <td className={tdc}>
          <BandeiraBadge bandeira={s.bandeira} tipo={s.tipoConta} />
        </td>
        <td className={tdc}>
          <div className="font-mono">NSU {s.nsu}</div>
          <div className="text-gray-400">
            {s.cartao} · {s.parcelas}x · líq. {fmt(s.valorLiquido)}
          </div>
        </td>
        <td className={tdc}>
          <div className="font-mono">
            Tít. {t.filial}/{t.titulo}
            {t.nf ? <span className="text-gray-400"> · NF {t.nf}</span> : null}
          </div>
          <div className="text-gray-400">
            {fmtData(t.dataEmissao)} · {t.portador} · {t.parcelas}x
            {t.cancelado && <span className="text-red-500"> · CANCELADO</span>}
          </div>
        </td>
        <td className={`${tdc} text-right font-semibold`}>
          {fmt(s.valorBruto)}
          {ln.par.diferencaValor !== 0 && <div className="text-red-500 font-normal">Δ {fmt(ln.par.diferencaValor)}</div>}
        </td>
        <td className={tdc}>
          <Badge className={NIVEL_COLORS[ln.par.tipo] || 'bg-gray-100 text-gray-600 border-gray-300'}>{ln.par.rotulo}</Badge>
          {ln.par.divergencias.length > 0 && (
            <div className="text-[10px] text-amber-700 mt-1 max-w-[260px] whitespace-normal">{ln.par.divergencias.join('; ')}</div>
          )}
          {ln.par.vinculo?.usuario && <div className="text-[10px] text-purple-600 mt-0.5">por {ln.par.vinculo.usuario}</div>}
        </td>
        <td className={`${tdc} text-right`}>
          {ln.par.tipo === 'manual' && (
            <button onClick={() => onDesfazer(ln.par)} title="Desfazer vínculo" className="text-purple-600 hover:text-purple-800">
              <LinkBreak size={16} />
            </button>
          )}
        </td>
      </tr>
    );
  }
  if (ln.kind === 'stone') {
    const s = ln.stone;
    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        {lojaCell}
        <td className={tdc}>{fmtDataHora(s.dataCaptura)}</td>
        <td className={tdc}>
          <BandeiraBadge bandeira={s.bandeira} tipo={s.tipoConta} />
        </td>
        <td className={tdc}>
          <div className="font-mono">NSU {s.nsu}</div>
          <div className="text-gray-400">
            {s.cartao} · {s.parcelas}x · aut. {s.codAutorizacao} · POS {s.serialPos}
          </div>
        </td>
        <td className={`${tdc} text-gray-400`}>sem título</td>
        <td className={`${tdc} text-right font-semibold`}>{fmt(s.valorBruto)}</td>
        <td className={tdc}>
          {s.cancelada ? (
            <Badge className="bg-red-100 text-red-700 border-red-300">Cancelada na Stone</Badge>
          ) : (
            <Badge className="bg-red-50 text-red-700 border-red-200">Não lançada no TOTVS</Badge>
          )}
        </td>
        <td className={`${tdc} text-right`}>
          {podeVincular && (
            <button
              onClick={() => onVincular({ loja: ln.loja, stone: s })}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <LinkSimple size={13} /> Vincular
            </button>
          )}
        </td>
      </tr>
    );
  }
  // totvs
  const t = ln.totvs;
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      {lojaCell}
      <td className={tdc}>{fmtData(t.dataEmissao)}</td>
      <td className={tdc}>
        <BandeiraBadge bandeira={t.bandeira} tipo={t.tipoConta} />
      </td>
      <td className={`${tdc} text-gray-400`}>sem venda na Stone</td>
      <td className={tdc}>
        <div className="font-mono">
          Tít. {t.filial}/{t.titulo}
          {t.nf ? <span className="text-gray-400"> · NF {t.nf}</span> : null}
        </div>
        <div className="text-gray-400">
          {t.portador} · {t.parcelas}x · cliente {t.cliente}
          {t.dataPagamento ? ` · pago ${fmtData(t.dataPagamento)}` : ''}
        </div>
      </td>
      <td className={`${tdc} text-right font-semibold`}>{fmt(t.valor)}</td>
      <td className={tdc}>
        {t.cancelado ? (
          <Badge className="bg-gray-200 text-gray-700 border-gray-300">Cancelado no TOTVS</Badge>
        ) : (
          <Badge className="bg-orange-50 text-orange-700 border-orange-200">Sem captura na Stone</Badge>
        )}
      </td>
      <td className={tdc}></td>
    </tr>
  );
};

// ─── card (mobile) ───────────────────────────────────────────
const CardMobile = ({ ln, onVincular, onDesfazer, podeVincular }) => {
  const s = ln.kind === 'par' ? ln.par.stone : ln.stone;
  const t = ln.kind === 'par' ? ln.par.totvs : ln.totvs;
  return (
    <div className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gray-700 truncate">{ln.loja.nome}</p>
          <p className="text-[11px] text-gray-500">{ln.kind === 'totvs' ? fmtData(ln.data) : fmtDataHora(ln.data)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">{fmt(ln.valor)}</p>
          {ln.kind === 'par' && <Badge className={NIVEL_COLORS[ln.par.tipo]}>{ln.par.rotulo}</Badge>}
        </div>
      </div>
      {ln.kind === 'erro' && <p className="text-[11px] text-red-600 mt-1">{ln.erro.erro}</p>}
      {ln.kind === 'pagamento' && (
        <p className="text-[11px] text-gray-600 mt-1">
          {ln.pagamento.carteira} · ID {ln.pagamento.id}
        </p>
      )}
      {s && (
        <p className="text-[11px] text-gray-600 mt-1">
          <BandeiraBadge bandeira={s.bandeira} tipo={s.tipoConta} /> {s.parcelas}x · NSU {s.nsu}
        </p>
      )}
      {t && (
        <p className="text-[11px] text-gray-600 mt-1">
          TOTVS tít. {t.filial}/{t.titulo} · {t.portador} · {t.parcelas}x {t.nf ? `· NF ${t.nf}` : ''}
        </p>
      )}
      {ln.kind === 'par' && ln.par.divergencias.length > 0 && (
        <p className="text-[10px] text-amber-700 mt-1">{ln.par.divergencias.join('; ')}</p>
      )}
      <div className="flex justify-end mt-1.5">
        {ln.kind === 'stone' && podeVincular && (
          <button onClick={() => onVincular({ loja: ln.loja, stone: s })} className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-300 text-purple-700">
            <LinkSimple size={12} /> Vincular
          </button>
        )}
        {ln.kind === 'par' && ln.par.tipo === 'manual' && (
          <button onClick={() => onDesfazer(ln.par)} className="text-[11px] inline-flex items-center gap-1 text-purple-700">
            <LinkBreak size={12} /> Desfazer vínculo
          </button>
        )}
      </div>
    </div>
  );
};

export default ConciliacaoStone;
