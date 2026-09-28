// Página: Varejo → Vendas PDV
// Vendas fechadas no HeadCoach pelo PDV Crosby (modo HEADCOACH), com o
// documento fiscal de cada uma e a movimentação das etiquetas RFID (EPC)
// das peças vendidas, devolvidas em troca ou estornadas por cancelamento.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  ArrowsClockwise,
  Spinner,
  Printer,
  DownloadSimple,
  MagnifyingGlass,
  CaretDown,
  CaretRight,
  Tag,
  Storefront,
  Buildings,
  CurrencyCircleDollar,
  ShoppingCart,
  ArrowsLeftRight,
  Prohibit,
  Copy,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { imprimirDocumento } from '../utils/documentoFiscalHtml';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hojeBR = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const hora = (d) =>
  new Date(d).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Recife',
  });
const dataHora = (d) =>
  new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife' });

const STATUS_CLS = {
  registrada: 'bg-gray-100 text-gray-600 ring-gray-200',
  emitindo: 'bg-amber-50 text-amber-700 ring-amber-200',
  autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejeitada: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-200',
};
const TIPO_LABEL = { nfce: 'NFC-e', nfe: 'NF-e', troca: 'TROCA' };
const FORMA_LABEL = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Crédito',
  debito: 'Débito',
  credito_loja: 'Crédito loja',
  vale_troca: 'Vale troca',
};
const EPC_TIPO = {
  venda: { label: 'Venda', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  devolucao: { label: 'Devolução', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  estorno: { label: 'Estorno', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const inputCls =
  'h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

function Card({ icon: Icon, label, valor, sub, cor = 'text-[#000638]' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {Icon && <Icon size={13} />} {label}
      </div>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

const VendasPDV = () => {
  const [branches, setBranches] = useState([]);
  const [empresa, setEmpresa] = useState(
    () => localStorage.getItem('vendas_pdv_empresa') || '',
  );
  const [de, setDe] = useState(hojeBR());
  const [ate, setAte] = useState(hojeBR());
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState('');
  const [aba, setAba] = useState('vendas'); // vendas | epcs

  const [loading, setLoading] = useState(false);
  const [vendas, setVendas] = useState([]);
  const [totais, setTotais] = useState(null);
  const [aberta, setAberta] = useState(null); // id da venda expandida
  const [busca, setBusca] = useState('');
  const [toast, setToast] = useState(null);

  const [epcs, setEpcs] = useState([]);
  const [epcBusca, setEpcBusca] = useState('');
  const [epcLoading, setEpcLoading] = useState(false);
  const [epcResumo, setEpcResumo] = useState(null);
  const [epcAviso, setEpcAviso] = useState(null);

  const showToast = useCallback((tipoMsg, msg) => {
    setToast({ tipo: tipoMsg, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => localStorage.setItem('vendas_pdv_empresa', empresa), [empresa]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/branches`);
        const j = await r.json();
        setBranches(j?.data?.data || []);
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  const carregarVendas = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ de, ate, detalhes: '1' });
      if (empresa) qs.set('empresa', empresa);
      if (tipo) qs.set('tipo', tipo);
      if (status) qs.set('status', status);
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao carregar');
      setVendas(j.data.items || []);
      setTotais(j.data.totais || null);
    } catch (e) {
      showToast('erro', e.message);
      setVendas([]);
      setTotais(null);
    } finally {
      setLoading(false);
    }
  }, [de, ate, empresa, tipo, status, showToast]);

  const carregarEpcs = useCallback(async () => {
    setEpcLoading(true);
    setEpcAviso(null);
    try {
      const qs = new URLSearchParams({ de, ate });
      if (empresa) qs.set('empresa', empresa);
      if (epcBusca.trim()) qs.set('epc', epcBusca.trim());
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/epcs?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) {
        if (j?.error === 'MIGRATION_PENDING') {
          setEpcAviso(j.message);
          setEpcs([]);
          setEpcResumo(null);
          return;
        }
        throw new Error(j?.message || 'Falha ao carregar etiquetas');
      }
      setEpcs(j.data.items || []);
      setEpcResumo(j.data.resumo || null);
    } catch (e) {
      showToast('erro', e.message);
      setEpcs([]);
    } finally {
      setEpcLoading(false);
    }
  }, [de, ate, empresa, epcBusca, showToast]);

  useEffect(() => {
    carregarVendas();
  }, [carregarVendas]);

  useEffect(() => {
    if (aba === 'epcs') carregarEpcs();
  }, [aba, carregarEpcs]);

  const vendasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return vendas;
    return vendas.filter((v) =>
      [
        v.id,
        v.cliente_nome,
        v.vendedor_nome,
        v.nota?.numero,
        v.nota?.chave,
        v.cliente_cpf_cnpj,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [vendas, busca]);

  const abrirNota = async (notaId) => {
    const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${notaId}`);
    const j = await r.json();
    if (!r.ok || !j.success) {
      showToast('erro', j?.message || 'Falha ao abrir a nota');
      return null;
    }
    return j.data;
  };

  const imprimir = async (v) => {
    if (!v.nota) return;
    const d = await abrirNota(v.nota.id);
    if (d) imprimirDocumento(d);
  };

  const copiar = (texto) => {
    navigator.clipboard?.writeText(String(texto));
    showToast('ok', 'Copiado');
  };

  const nomeEmpresa = (code) =>
    branches.find((b) => String(b.cd_empresa) === String(code))?.nm_grupoempresa || `Empresa ${code}`;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-7xl mx-auto">
        <PageTitle
          title="Vendas PDV"
          subtitle="Vendas fechadas no HeadCoach pelo PDV Crosby, com nota fiscal e rastreio das etiquetas RFID"
          icon={Receipt}
        />

        {/* Filtros */}
        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Empresa
            </label>
            <div className="relative">
              <Buildings size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={`${inputCls} pl-8 w-64`}>
                <option value="">Todas as empresas</option>
                {branches.map((b) => (
                  <option key={b.cd_empresa} value={b.cd_empresa}>
                    {b.cd_empresa} — {b.nm_grupoempresa}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              <option value="nfce">NFC-e</option>
              <option value="nfe">NF-e</option>
              <option value="troca">Troca</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Situação</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              <option value="autorizada">Autorizada</option>
              <option value="rejeitada">Rejeitada</option>
              <option value="registrada">Registrada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <button
            onClick={() => {
              const h = hojeBR();
              setDe(h);
              setAte(h);
            }}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Hoje
          </button>
          <button
            onClick={aba === 'vendas' ? carregarVendas : carregarEpcs}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} className={loading || epcLoading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <div className="flex-1" />
          <div className="relative">
            <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={aba === 'vendas' ? busca : epcBusca}
              onChange={(e) => (aba === 'vendas' ? setBusca(e.target.value) : setEpcBusca(e.target.value))}
              onKeyDown={(e) => aba === 'epcs' && e.key === 'Enter' && carregarEpcs()}
              placeholder={aba === 'vendas' ? 'Cliente, vendedor, nº da nota…' : 'EPC da etiqueta…'}
              className={`${inputCls} pl-8 w-60`}
            />
          </div>
        </div>

        {/* Totais */}
        {totais && aba === 'vendas' && (
          <div className="mb-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Card icon={ShoppingCart} label="Vendas" valor={totais.vendas} sub={`${totais.pecas} peças`} />
            <Card icon={CurrencyCircleDollar} label="Faturamento" valor={fmtBRL(totais.valor)} cor="text-emerald-700" />
            <Card icon={Receipt} label="Ticket médio" valor={fmtBRL(totais.ticketMedio)} />
            <Card icon={ArrowsLeftRight} label="Trocas" valor={totais.trocas} sub={fmtBRL(totais.valorTrocas)} cor="text-blue-700" />
            <Card icon={Tag} label="Etiquetas" valor={totais.epcs} sub="movimentos de EPC" />
            <Card
              icon={Prohibit}
              label="Pendentes / canceladas"
              valor={`${totais.pendentes} / ${totais.canceladas}`}
              sub={`${totais.autorizadas} autorizadas`}
              cor={totais.pendentes > 0 ? 'text-amber-700' : 'text-[#000638]'}
            />
          </div>
        )}

        {totais && aba === 'vendas' && Object.keys(totais.porForma || {}).length > 0 && (
          <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Por forma de pagamento</span>
            {Object.entries(totais.porForma).map(([forma, valor]) => (
              <span key={forma} className="text-sm">
                <span className="text-gray-500">{FORMA_LABEL[forma] || forma}:</span>{' '}
                <b className="text-[#000638] tabular-nums">{fmtBRL(valor)}</b>
              </span>
            ))}
          </div>
        )}

        {/* Abas */}
        <div className="mb-2 inline-flex rounded-xl bg-white ring-1 ring-gray-200 shadow-sm p-1">
          {[
            { id: 'vendas', label: 'Vendas', icon: Receipt },
            { id: 'epcs', label: 'Etiquetas RFID', icon: Tag },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setAba(t.id)}
                className={`h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                  aba === t.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'
                }`}
              >
                <Icon size={14} weight="bold" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Tabela de vendas */}
        {aba === 'vendas' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-2 w-6" />
                    <th className="px-2 py-2 text-left">Venda</th>
                    <th className="px-2 py-2 text-left">Hora</th>
                    {!empresa && <th className="px-2 py-2 text-left">Empresa</th>}
                    <th className="px-2 py-2 text-left">Tipo</th>
                    <th className="px-2 py-2 text-left">Cliente</th>
                    <th className="px-2 py-2 text-left">Vendedor</th>
                    <th className="px-2 py-2 text-right">Peças</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-left">Pagamento</th>
                    <th className="px-2 py-2 text-left">Nota</th>
                    <th className="px-2 py-2 text-left">Situação</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && vendas.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-gray-400">
                        <Spinner size={20} className="animate-spin mx-auto" />
                      </td>
                    </tr>
                  )}
                  {!loading && vendasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-gray-400">
                        <Storefront size={26} className="mx-auto mb-1.5 text-gray-300" />
                        Nenhuma venda no período.
                      </td>
                    </tr>
                  )}
                  {vendasFiltradas.map((v) => (
                    <React.Fragment key={v.id}>
                      <tr className={`hover:bg-gray-50/60 ${v.status === 'cancelada' ? 'opacity-60' : ''}`}>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => setAberta(aberta === v.id ? null : v.id)}
                            className="text-gray-400 hover:text-[#000638]"
                            title="Detalhes"
                          >
                            {aberta === v.id ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 font-mono font-semibold text-[#000638]">#{v.id}</td>
                        <td className="px-2 py-1.5">{hora(v.criado_em)}</td>
                        {!empresa && <td className="px-2 py-1.5 truncate max-w-[130px]">{v.empresa_nome || nomeEmpresa(v.empresa)}</td>}
                        <td className="px-2 py-1.5">
                          <span className={`font-semibold ${v.tipo_venda === 'troca' ? 'text-blue-700' : 'text-[#000638]'}`}>
                            {TIPO_LABEL[v.tipo_venda]}
                          </span>
                          {v.operacao ? <span className="text-gray-400"> · op {v.operacao}</span> : null}
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[170px]">{v.cliente_nome || 'Consumidor não identificado'}</td>
                        <td className="px-2 py-1.5 truncate max-w-[120px]">{v.vendedor_nome || v.vendedor_code}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.qtd_pecas}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(v.total)}</td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]">
                          {(v.pagamentos || []).map((p) => FORMA_LABEL[p.forma] || p.forma).join(', ') || '—'}
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {v.nota ? (
                            <span title={v.nota.chave || ''}>
                              {v.nota.serie}/{v.nota.numero}
                              {Number(v.nota.ambiente) === 2 && <span className="ml-1 text-amber-600">(hom.)</span>}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold ${STATUS_CLS[v.status] || STATUS_CLS.registrada}`}
                            title={v.nota ? `${v.nota.cstat || ''} ${v.nota.xmotivo || ''}` : ''}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {v.nota && (v.nota.status === 'autorizada' || v.nota.status === 'cancelada') && (
                            <span className="inline-flex gap-1">
                              <button onClick={() => imprimir(v)} title="Imprimir" className="p-1 rounded hover:bg-gray-100 text-[#000638]">
                                <Printer size={14} />
                              </button>
                              <a
                                href={`${API_BASE_URL}/api/pdv-crosby/notas/${v.nota.id}/xml`}
                                target="_blank"
                                rel="noreferrer"
                                title="Baixar XML"
                                className="p-1 rounded hover:bg-gray-100 text-[#000638]"
                              >
                                <DownloadSimple size={14} />
                              </a>
                            </span>
                          )}
                        </td>
                      </tr>
                      {aberta === v.id && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={13} className="px-4 py-3">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                                  Itens ({(v.itens || []).length})
                                </p>
                                <table className="w-full text-[11px]">
                                  <thead className="text-gray-400">
                                    <tr>
                                      <th className="text-left font-medium">Produto</th>
                                      <th className="text-right font-medium">Qtd</th>
                                      <th className="text-right font-medium">Unit.</th>
                                      <th className="text-right font-medium">Desc.</th>
                                      <th className="text-right font-medium">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(v.itens || []).map((i) => (
                                      <tr key={i.id} className="border-t border-gray-100">
                                        <td className="py-1">
                                          <p className="font-medium text-[#000638]">{i.nome}</p>
                                          <p className="text-gray-400">
                                            cód. {i.product_code}
                                            {i.sku ? ` · EAN ${i.sku}` : ''}
                                            {i.ncm ? ` · NCM ${i.ncm}` : ''}
                                          </p>
                                          {Array.isArray(i.epcs) && i.epcs.length > 0 && (
                                            <p className="mt-0.5 flex flex-wrap gap-1">
                                              {i.epcs.map((e) => (
                                                <button
                                                  key={e}
                                                  onClick={() => copiar(e)}
                                                  title="Copiar EPC"
                                                  className="inline-flex items-center gap-0.5 px-1.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 font-mono text-[10px] hover:bg-purple-100"
                                                >
                                                  <Tag size={9} /> {e}
                                                </button>
                                              ))}
                                            </p>
                                          )}
                                        </td>
                                        <td className="text-right tabular-nums">{Number(i.quantidade)}</td>
                                        <td className="text-right tabular-nums">{fmtBRL(i.valor_unit)}</td>
                                        <td className="text-right tabular-nums">
                                          {Number(i.desconto_unit) > 0 ? fmtBRL(i.desconto_unit) : '—'}
                                        </td>
                                        <td className="text-right tabular-nums font-semibold">{fmtBRL(i.total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Pagamentos</p>
                                  {(v.pagamentos || []).length === 0 && <p className="text-[11px] text-gray-400">—</p>}
                                  {(v.pagamentos || []).map((p) => (
                                    <div key={p.id} className="flex justify-between text-[11px] py-0.5 border-b border-gray-100">
                                      <span>
                                        {FORMA_LABEL[p.forma] || p.forma}
                                        {p.parcelas > 1 ? ` ${p.parcelas}x` : ''}
                                        {p.bandeira ? ` · ${p.bandeira}` : ''}
                                        {p.nsu ? ` · NSU ${p.nsu}` : ''}
                                        {p.autorizacao ? ` · Aut. ${p.autorizacao}` : ''}
                                      </span>
                                      <b className="tabular-nums">{fmtBRL(p.valor)}</b>
                                    </div>
                                  ))}
                                  {Number(v.cashback_usado) > 0 && (
                                    <div className="flex justify-between text-[11px] text-emerald-700 py-0.5">
                                      <span>Cashback usado</span>
                                      <b className="tabular-nums">{fmtBRL(v.cashback_usado)}</b>
                                    </div>
                                  )}
                                </div>
                                {v.nota && (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Documento fiscal</p>
                                    <p className="text-[11px]">
                                      {Number(v.nota.modelo) === 65 ? 'NFC-e' : 'NF-e'} {v.nota.serie}/{v.nota.numero} ·{' '}
                                      {v.nota.cstat} {v.nota.xmotivo}
                                    </p>
                                    {v.nota.chave && (
                                      <button
                                        onClick={() => copiar(v.nota.chave)}
                                        className="mt-0.5 font-mono text-[10px] text-[#000638] break-all text-left hover:underline inline-flex items-start gap-1"
                                        title="Copiar chave"
                                      >
                                        <Copy size={10} className="mt-0.5 shrink-0" /> {v.nota.chave}
                                      </button>
                                    )}
                                    {v.nota.protocolo && (
                                      <p className="text-[10px] text-gray-500">Protocolo {v.nota.protocolo}</p>
                                    )}
                                  </div>
                                )}
                                {v.nf_referenciada && (
                                  <p className="text-[10px] text-gray-500">
                                    NF de origem: <span className="font-mono">{v.nf_referenciada}</span>
                                  </p>
                                )}
                                {v.criado_por && <p className="text-[10px] text-gray-400">Registrada por {v.criado_por}</p>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Movimentação de EPC */}
        {aba === 'epcs' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {epcAviso && (
              <p className="m-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-amber-200">{epcAviso}</p>
            )}
            {epcResumo && (
              <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-4 text-xs text-gray-600">
                <span>
                  Movimentos: <b className="text-[#000638]">{epcResumo.total}</b>
                </span>
                <span>
                  Etiquetas distintas: <b className="text-[#000638]">{epcResumo.etiquetas}</b>
                </span>
                <span>
                  Vendas: <b className="text-emerald-700">{epcResumo.vendas}</b>
                </span>
                <span>
                  Devoluções: <b className="text-blue-700">{epcResumo.devolucoes}</b>
                </span>
                <span>
                  Estornos: <b className="text-rose-700">{epcResumo.estornos}</b>
                </span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-2 text-left">EPC</th>
                    <th className="px-2 py-2 text-left">Movimento</th>
                    <th className="px-2 py-2 text-left">Quando</th>
                    <th className="px-2 py-2 text-left">Empresa</th>
                    <th className="px-2 py-2 text-left">Produto</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2 text-left">Cliente</th>
                    <th className="px-2 py-2 text-left">Vendedor</th>
                    <th className="px-2 py-2 text-left">Venda</th>
                    <th className="px-2 py-2 text-left">Chave NF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {epcLoading && epcs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-gray-400">
                        <Spinner size={20} className="animate-spin mx-auto" />
                      </td>
                    </tr>
                  )}
                  {!epcLoading && epcs.length === 0 && !epcAviso && (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-gray-400">
                        <Tag size={26} className="mx-auto mb-1.5 text-gray-300" />
                        Nenhuma etiqueta movimentada no período.
                      </td>
                    </tr>
                  )}
                  {epcs.map((m) => {
                    const info = EPC_TIPO[m.tipo] || EPC_TIPO.venda;
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/60">
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => copiar(m.epc)}
                            className="font-mono text-[11px] text-[#000638] hover:underline"
                            title="Copiar EPC"
                          >
                            {m.epc}
                          </button>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold ${info.cls}`}>
                            {info.label}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{dataHora(m.ocorrido_em)}</td>
                        <td className="px-2 py-1.5">{m.empresa}</td>
                        <td className="px-2 py-1.5 truncate max-w-[220px]">
                          <span className="text-[#000638]">{m.produto_nome || m.product_code}</span>
                          {m.sku ? <span className="text-gray-400"> · {m.sku}</span> : null}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{m.valor_unit != null ? fmtBRL(m.valor_unit) : '—'}</td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]">{m.cliente_nome || '—'}</td>
                        <td className="px-2 py-1.5 truncate max-w-[120px]">{m.vendedor_nome || '—'}</td>
                        <td className="px-2 py-1.5 font-mono">#{m.venda_id}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px] truncate max-w-[180px]" title={m.chave_nf || ''}>
                          {m.chave_nf || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {toast && (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendasPDV;
