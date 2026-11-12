// ============================================================================
// HEADCOACH › TRANSAÇÕES — consulta de tudo o que o HeadCoach emite, no estilo
// do TRAFL016 do TOTVS (Yago, 12/11/2026: etapa 1 da saída do TOTVS).
//   • filtros: empresa, período, nº da transação, cliente, vendedor, operação,
//     valor, desconto, data de encerramento, tipo (entrada/saída), situação
//     (EM ANDAMENTO / ATENDIDA / CANCELADA), origem e NF;
//   • lista com o resumo do que foi filtrado e exportação em CSV;
//   • detalhe em modal: dados da transação, peças com as etiquetas RFID,
//     pagamento, nota fiscal (imprimir / salvar PDF / XML), quem fez e quando.
// Fontes: PDV Crosby, Faturamento (pedidos, Brejinho, avulso), Transferências
// e Devoluções — GET /api/hc/transacoes (exige login).
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ListMagnifyingGlass,
  MagnifyingGlass,
  Spinner,
  X,
  Eraser,
  DownloadSimple,
  Printer,
  FloppyDisk,
  Tag,
  CaretLeft,
  CaretRight,
  Package,
  CreditCard,
  FileText,
  User,
  Clock,
  ArrowDown,
  ArrowUp,
  Info,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { apiJson } from '../utils/apiAuth';
import { imprimirDanfe, salvarDanfePdf, avisoDoPdf } from '../utils/danfeAcoes';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR');
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
const hojeIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(d);
};
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';

const SITUACOES = [
  { k: 'andamento', label: 'EM ANDAMENTO', cls: 'bg-amber-50 text-amber-800 ring-amber-200', on: 'bg-amber-500 text-white ring-amber-500' },
  { k: 'atendida', label: 'ATENDIDA', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', on: 'bg-emerald-600 text-white ring-emerald-600' },
  { k: 'cancelada', label: 'CANCELADA', cls: 'bg-gray-100 text-gray-500 ring-gray-200', on: 'bg-gray-600 text-white ring-gray-600' },
];
const SIT = Object.fromEntries(SITUACOES.map((s) => [s.k, s]));
const ORIGENS = [
  ['pdv', 'PDV Crosby'],
  ['troca', 'Troca (PDV)'],
  ['faturamento', 'Faturamento'],
  ['brejinho', 'Faturamento Brejinho'],
  ['avulso', 'Faturamento avulso'],
  ['transferencia', 'Transferência'],
  ['devolucao', 'Devolução'],
];
const NF_CLS = {
  autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-200',
  rejeitada: 'bg-rose-50 text-rose-700 ring-rose-200',
  erro: 'bg-rose-50 text-rose-700 ring-rose-200',
  'do cliente': 'bg-sky-50 text-sky-700 ring-sky-200',
};

const FILTROS_INICIAIS = () => ({
  empresa: '',
  de: diasAtras(30),
  ate: hojeIso(),
  numero: '',
  nf: '',
  cliente: '',
  vendedor: '',
  operacao: '',
  origem: '',
  valorMin: '',
  valorMax: '',
  descontoMin: '',
  descontoMax: '',
  encerramentoDe: '',
  encerramentoAte: '',
  tipo: '',
  situacao: [],
});

const Chip = ({ cls = 'bg-gray-100 text-gray-600 ring-gray-200', children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ${cls}`}>
    {children}
  </span>
);
const TipoChip = ({ tipo }) =>
  tipo === 'E' ? (
    <Chip cls="bg-sky-50 text-sky-700 ring-sky-200" title="Entrada">
      <ArrowDown size={10} weight="bold" /> E
    </Chip>
  ) : (
    <Chip cls="bg-indigo-50 text-[#000638] ring-indigo-200" title="Saída">
      <ArrowUp size={10} weight="bold" /> S
    </Chip>
  );

function montarQuery(f, pagina, porPagina) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (k === 'situacao') {
      if (v.length) q.set('situacao', v.join(','));
    } else if (String(v ?? '').trim() !== '') q.set(k, String(v).trim());
  }
  q.set('pagina', String(pagina));
  q.set('porPagina', String(porPagina));
  return q.toString();
}

// ─── Detalhe ─────────────────────────────────────────────────────────────────
function Campo({ rotulo, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{rotulo}</p>
      <div className="break-words text-xs font-semibold text-gray-800">{children ?? '—'}</div>
    </div>
  );
}
function Secao({ titulo, icone: Icone, children, extra }) {
  return (
    <section className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Icone size={14} className="text-[#000638]" />
        <h4 className="flex-1 text-[11px] font-bold uppercase tracking-wide text-[#000638]">{titulo}</h4>
        {extra}
      </div>
      {children}
    </section>
  );
}

function DetalheTransacao({ id, onFechar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    let vivo = true;
    setD(null);
    setErro('');
    apiJson(`/api/hc/transacoes/${encodeURIComponent(id)}`)
      .then((j) => vivo && setD(j.data))
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [id]);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  const S = d ? SIT[d.situacao] : null;
  const totalPecas = (d?.itens || []).reduce((t, i) => t + Number(i.quantidade || 0), 0);
  const totalEtiquetas = (d?.itens || []).reduce((t, i) => t + (i.epcs || []).length, 0);
  const btn = 'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#000638]/50 p-2 backdrop-blur-[2px] sm:p-5" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-200 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400">{d ? `${d.origemNome} · ${d.empresa} — ${d.empresaNome}` : 'Transação'}</p>
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-[#000638]">
              Transação nº {d?.numero || id}
              {d && <TipoChip tipo={d.tipoOperacao} />}
              {S && <Chip cls={S.cls}>{S.label}</Chip>}
            </h3>
          </div>
          {d && <span className={`text-xl font-bold tabular-nums ${d.situacao === 'cancelada' ? 'text-gray-400 line-through' : 'text-[#000638]'}`}>{fmtBRL(d.valor)}</span>}
          <button onClick={onFechar} title="Fechar (Esc)" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-500 ring-1 ring-gray-200 hover:bg-gray-100">
            <X size={15} weight="bold" />
          </button>
        </div>

        {erro ? (
          <p className="m-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>
        ) : !d ? (
          <div className="py-16 text-center text-gray-400">
            <Spinner size={22} className="mx-auto animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {aviso && <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-800 ring-1 ring-blue-200">{aviso}</p>}
            <div className="grid items-start gap-3 lg:grid-cols-3">
              <Secao titulo="Dados da transação" icone={Info}>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Campo rotulo="Empresa">
                    {d.empresa} — {d.empresaNome}
                  </Campo>
                  <Campo rotulo="Data / hora">{fmtDataHora(d.data)}</Campo>
                  <Campo rotulo="Operação" className="col-span-2">
                    {d.operacao ? `${d.operacao} — ${d.operacaoNome}` : '—'}
                  </Campo>
                  <Campo rotulo="Tipo de operação">{d.tipoOperacao === 'E' ? 'Entrada' : 'Saída'}</Campo>
                  <Campo rotulo="Situação">{S?.label}</Campo>
                  <Campo rotulo="Dt. encerramento">{fmtDataHora(d.encerradaEm)}</Campo>
                  <Campo rotulo="Origem">{d.origemNome}</Campo>
                  {d.ref && <Campo rotulo={d.fonte === 'devolucao' ? 'Solicitação' : 'Pedido'}>{d.ref}</Campo>}
                  {d.pedido?.canal && <Campo rotulo="Canal">{d.pedido.canal}</Campo>}
                  {d.dataCaixa && <Campo rotulo="Data do caixa">{fmtData(d.dataCaixa)}</Campo>}
                  {d.pedido?.dataVenda && <Campo rotulo="Venda do dia">{fmtData(d.pedido.dataVenda)}</Campo>}
                </div>
              </Secao>

              <Secao titulo="Cliente e vendedor" icone={User}>
                <div className="grid grid-cols-1 gap-y-2">
                  <Campo rotulo="Cliente">
                    {d.cliente?.code ? `${d.cliente.code} — ` : ''}
                    {d.cliente?.nome || '—'}
                    {d.cliente?.doc && <span className="block font-mono text-[11px] font-normal text-gray-500">{d.cliente.doc}</span>}
                  </Campo>
                  <Campo rotulo="Vendedor">
                    {d.vendedor?.code ? `${d.vendedor.code} — ` : ''}
                    {d.vendedor?.nome || '—'}
                  </Campo>
                  <Campo rotulo="Feita por">{d.criadoPor || '—'}</Campo>
                  {d.observacao && <Campo rotulo="Observação">{d.observacao}</Campo>}
                </div>
              </Secao>

              <Secao titulo="Valores" icone={CreditCard}>
                <div className="space-y-1 text-xs">
                  <p className="flex justify-between">
                    <span className="text-gray-500">Valor bruto ({fmtNum(totalPecas)} pç)</span>
                    <span className="font-semibold tabular-nums">{fmtBRL(d.valorBruto)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-500">Desconto</span>
                    <span className="font-semibold tabular-nums text-amber-700">− {fmtBRL(d.desconto)}</span>
                  </p>
                  {d.frete > 0 && (
                    <p className="flex justify-between">
                      <span className="text-gray-500">Frete</span>
                      <span className="font-semibold tabular-nums">{fmtBRL(d.frete)}</span>
                    </p>
                  )}
                  {d.cashbackUsado > 0 && (
                    <p className="flex justify-between">
                      <span className="text-gray-500">Cashback usado</span>
                      <span className="font-semibold tabular-nums">{fmtBRL(d.cashbackUsado)}</span>
                    </p>
                  )}
                  <p className="flex justify-between border-t border-gray-100 pt-1 text-sm">
                    <span className="font-bold text-[#000638]">Valor da transação</span>
                    <span className="font-bold tabular-nums text-[#000638]">{fmtBRL(d.valor)}</span>
                  </p>
                  {d.pedido?.descontoFaturamento && (
                    <p className="text-[10.5px] text-amber-700">
                      Desconto de {String(d.pedido.descontoFaturamento.pct).replace('.', ',')}% no faturamento
                      {d.pedido.descontoFaturamento.liberadoPor ? ` · liberado por ${d.pedido.descontoFaturamento.liberadoPor}` : ''}
                    </p>
                  )}
                </div>
              </Secao>
            </div>

            {/* Peças */}
            <Secao titulo={`Peças · ${fmtNum(totalPecas)}`} icone={Package} extra={<span className="text-[11px] text-gray-500">{fmtNum(totalEtiquetas)} etiqueta(s) RFID</span>}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-[10px] uppercase tracking-wide text-gray-400">
                      <th className="pb-1 font-semibold">#</th>
                      <th className="pb-1 font-semibold">Produto</th>
                      <th className="pb-1 pl-2 font-semibold">Cód.</th>
                      <th className="pb-1 pl-2 font-semibold">CFOP</th>
                      <th className="pb-1 pl-2 text-right font-semibold">Qtd</th>
                      <th className="pb-1 pl-2 text-right font-semibold">Unitário</th>
                      <th className="pb-1 pl-2 text-right font-semibold">Desc. unit.</th>
                      <th className="pb-1 pl-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.itens.map((it) => (
                      <tr key={`${it.seq}-${it.productCode}`} className="align-top">
                        <td className="py-1.5 text-gray-400">{it.seq}</td>
                        <td className="py-1.5">
                          <p className="font-semibold text-gray-800">{it.nome}</p>
                          {it.referencia && <p className="text-[10.5px] text-gray-400">{it.referencia}</p>}
                          {it.epcs.length > 0 ? (
                            <details>
                              <summary className="cursor-pointer text-[10.5px] font-semibold text-purple-700">
                                {it.epcs.length} etiqueta{it.epcs.length === 1 ? '' : 's'} RFID
                              </summary>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {it.epcs.map((epc) => (
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
                        <td className="py-1.5 pl-2 font-mono text-gray-600">
                          {it.productCode}
                          {it.sku && <span className="block text-[10px] text-gray-400">{it.sku}</span>}
                        </td>
                        <td className="py-1.5 pl-2 text-gray-600">{it.cfop || '—'}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{fmtNum(it.quantidade)}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums text-gray-600">{fmtBRL(it.valorUnit)}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums text-amber-700">{it.descontoUnit > 0 ? fmtBRL(it.descontoUnit) : '—'}</td>
                        <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{fmtBRL(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {d.devolucao && (d.devolucao.faltando.length > 0 || d.devolucao.sobrando.length > 0) && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 ring-1 ring-amber-200">
                  {d.devolucao.faltando.length > 0 && `Faltaram ${d.devolucao.qtdFaltando} peça(s) da nota do cliente (${fmtBRL(d.devolucao.valorFaltando)}). `}
                  {d.devolucao.sobrando.length > 0 && `Vieram ${d.devolucao.qtdSobrando} peça(s) fora da nota.`}
                </p>
              )}
              {d.pedido?.conferencia && (d.pedido.conferencia.qtdFaltando > 0 || d.pedido.conferencia.qtdSobrando > 0) && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 ring-1 ring-amber-200">
                  Conferência do pedido: {d.pedido.conferencia.qtdConferida} de {d.pedido.conferencia.qtdPedido} peça(s) · {d.pedido.conferencia.qtdFaltando} faltando · {d.pedido.conferencia.qtdSobrando} sobrando
                </p>
              )}
              {d.pedido?.trocas?.length > 0 && (
                <p className="mt-2 rounded-lg bg-sky-50 px-2 py-1.5 text-[11px] text-sky-800 ring-1 ring-sky-200">
                  <b>Trocas no faturamento:</b> {d.pedido.trocas.map((t) => `${t.quantidade}x ${t.de} → ${t.para}`).join(' · ')}
                </p>
              )}
            </Secao>

            <div className="grid items-start gap-3 lg:grid-cols-2">
              {/* Pagamento */}
              <Secao titulo="Forma de pagamento" icone={CreditCard}>
                {d.pagamentos.length === 0 ? (
                  <p className="text-xs text-gray-400">{d.fonte === 'devolucao' ? 'Devolução: sem pagamento (o valor volta ao cliente como crédito).' : 'Sem pagamento registrado.'}</p>
                ) : (
                  <ul className="divide-y divide-gray-100 text-xs">
                    {d.pagamentos.map((p, i) => (
                      <li key={`${p.forma}-${i}`} className="flex items-baseline gap-2 py-1">
                        <span className="font-semibold text-gray-800">
                          {p.formaNome}
                          {p.parcelas > 1 ? ` ${p.parcelas}x` : ''}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10.5px] text-gray-500">
                          {[p.cartao?.descricao, p.bandeira, p.nsu && `NSU ${p.nsu}`, p.autorizacao && `aut ${p.autorizacao}`, p.troco > 0 && `troco ${fmtBRL(p.troco)}`].filter(Boolean).join(' · ')}
                        </span>
                        <span className="font-semibold tabular-nums">{fmtBRL(p.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {d.cobranca.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Parcelas do boleto</p>
                    <p className="flex flex-wrap gap-1 text-xs">
                      {d.cobranca.map((x, i) => (
                        <span key={`${x.vencimento}-${i}`} className="rounded bg-gray-50 px-1.5 py-0.5 tabular-nums ring-1 ring-gray-200">
                          {i + 1}ª {fmtData(x.vencimento)} · {fmtBRL(x.valor)}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                {d.comprovantes.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 border-t border-gray-100 pt-2 text-xs">
                    {d.comprovantes.map((c, i) => (
                      <a key={c.path || c.url || i} href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:underline">
                        comprovante {i + 1} <ArrowSquareOut size={10} />
                      </a>
                    ))}
                  </p>
                )}
              </Secao>

              {/* Nota fiscal */}
              <Secao titulo="Nota fiscal" icone={FileText}>
                {d.fonte === 'devolucao' ? (
                  d.devolucao?.nfCliente ? (
                    <div className="text-xs">
                      <p className="font-semibold text-gray-800">
                        NF-e de devolução do cliente {d.devolucao.nfCliente.numero}/{d.devolucao.nfCliente.serie} · {fmtData(d.devolucao.nfCliente.data)} · {fmtBRL(d.devolucao.nfCliente.total)}
                      </p>
                      {d.devolucao.nfCliente.chave && <p className="mt-0.5 break-all font-mono text-[10.5px] text-gray-500">{d.devolucao.nfCliente.chave}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Devolução sem nota do cliente.</p>
                  )
                ) : d.notas.length === 0 ? (
                  <p className="text-xs text-gray-400">A nota não chegou a ser emitida.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.notas.map((n) => (
                      <li key={n.id} className="text-xs">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <b className="text-[#000638]">
                            {n.modelo === 65 ? 'NFC-e' : 'NF-e'} {n.numero}/{n.serie}
                          </b>
                          <Chip cls={NF_CLS[n.status] || 'bg-gray-100 text-gray-600 ring-gray-200'}>{n.status}</Chip>
                          {n.dh_autorizacao && <span className="text-gray-500">autorizada em {fmtDataHora(n.dh_autorizacao)}</span>}
                        </p>
                        {n.chave && <p className="mt-0.5 break-all font-mono text-[10.5px] text-gray-500">{n.chave}</p>}
                        {n.status !== 'autorizada' && n.xmotivo && (
                          <p className="mt-0.5 text-[11px] text-rose-600">
                            {n.cstat} {n.xmotivo}
                          </p>
                        )}
                        {n.cancel_em && (
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            Cancelada em {fmtDataHora(n.cancel_em)}
                            {n.cancel_justificativa ? ` · ${n.cancel_justificativa}` : ''}
                          </p>
                        )}
                        {(n.status === 'autorizada' || n.status === 'cancelada') && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <button
                              onClick={() => imprimirDanfe(n.id, { cancelada: n.status === 'cancelada' }).catch((e) => setAviso(e.message))}
                              className={`${btn} bg-[#000638] text-white hover:bg-[#000638]/90`}
                            >
                              <Printer size={13} /> Imprimir
                            </button>
                            <button
                              onClick={() =>
                                salvarDanfePdf(n.id, { cancelada: n.status === 'cancelada' })
                                  .then((r) => setAviso(avisoDoPdf(r) || ''))
                                  .catch((e) => setAviso(e.message))
                              }
                              className={`${btn} text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50`}
                            >
                              <FloppyDisk size={13} /> Salvar PDF
                            </button>
                            <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${n.id}/xml`} className={`${btn} text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50`}>
                              <DownloadSimple size={13} /> XML
                            </a>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
            </div>

            {/* Histórico + TOTVS (enquanto existir) */}
            <div className="grid items-start gap-3 lg:grid-cols-2">
              <Secao titulo="Histórico" icone={Clock}>
                <ul className="space-y-1 text-xs">
                  <li>
                    <b>{fmtDataHora(d.data)}</b> · transação criada{d.criadoPor ? ` por ${d.criadoPor}` : ''}
                    {d.vendedor?.nome ? ` · vendedor ${d.vendedor.nome}` : ''}
                  </li>
                  {d.notas
                    .filter((n) => n.dh_autorizacao)
                    .map((n) => (
                      <li key={`a${n.id}`}>
                        <b>{fmtDataHora(n.dh_autorizacao)}</b> · nota {n.numero} autorizada
                      </li>
                    ))}
                  {d.notas
                    .filter((n) => n.cancel_em)
                    .map((n) => (
                      <li key={`c${n.id}`}>
                        <b>{fmtDataHora(n.cancel_em)}</b> · nota {n.numero} cancelada
                      </li>
                    ))}
                  {d.encerradaEm && (
                    <li>
                      <b>{fmtDataHora(d.encerradaEm)}</b> · {d.situacao === 'cancelada' ? 'cancelada' : 'atendida'}
                    </li>
                  )}
                  <li className="text-gray-400">Última alteração em {fmtDataHora(d.atualizadoEm)}</li>
                </ul>
              </Secao>
              {d.totvsEspelho && (
                <Secao titulo="TOTVS (enquanto estiver ligado)" icone={ListMagnifyingGlass}>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <Campo rotulo="Empresa / transação">{d.totvsEspelho.transacao ? `${d.totvsEspelho.empresa}/${d.totvsEspelho.transacao}` : 'não aberta'}</Campo>
                    <Campo rotulo="Situação no TOTVS">{d.totvsEspelho.statusNome || '—'}</Campo>
                    {d.totvsEspelho.operacaoDocInterno && (
                      <Campo rotulo="Documento interno" className="col-span-2">
                        {d.totvsEspelho.operacaoDocInterno} — {d.totvsEspelho.operacaoDocInternoNome}
                      </Campo>
                    )}
                  </div>
                  {d.totvsEspelho.erro && <p className="mt-2 text-[11px] text-amber-700">{d.totvsEspelho.erro}</p>}
                  <p className="mt-2 text-[10.5px] text-gray-400">Só informativo: a transação vale pelo HeadCoach.</p>
                </Secao>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
const POR_PAGINA = 100;

export default function HcTransacoes() {
  const [f, setF] = useState(FILTROS_INICIAIS);
  const [consulta, setConsulta] = useState(() => FILTROS_INICIAIS()); // filtros da última consulta
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(null);
  const [exportando, setExportando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const carregar = useCallback(async (filtros, pg) => {
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`/api/hc/transacoes?${montarQuery(filtros, pg, POR_PAGINA)}`);
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar(consulta, pagina);
  }, [consulta, pagina, carregar]);

  const consultar = (e) => {
    e?.preventDefault();
    setPagina(1);
    setConsulta({ ...f });
  };
  const limpar = () => {
    const ini = FILTROS_INICIAIS();
    setF(ini);
    setPagina(1);
    setConsulta(ini);
  };
  const alternarSituacao = (k) => setF((x) => ({ ...x, situacao: x.situacao.includes(k) ? x.situacao.filter((s) => s !== k) : [...x.situacao, k] }));

  // CSV com tudo o que passou no filtro (todas as páginas)
  const exportar = async () => {
    setExportando(true);
    try {
      const linhas = [];
      for (let pg = 1; pg <= 200; pg += 1) {
        const j = await apiJson(`/api/hc/transacoes?${montarQuery(consulta, pg, 500)}`);
        linhas.push(...j.data.items);
        if (pg >= j.data.paginas) break;
      }
      const cab = ['Empresa', 'Nome empresa', 'Nº transação', 'Data', 'Tipo', 'Operação', 'Nome operação', 'Origem', 'Situação', 'Dt encerramento', 'Cliente', 'Nome cliente', 'CPF/CNPJ', 'Vendedor', 'Nome vendedor', 'Peças', 'Valor bruto', 'Desconto', 'Frete', 'Valor', 'Formas', 'NF', 'Pedido', 'Feita por'];
      const cel = (v) => {
        const s = String(v ?? '');
        return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const num = (v) => String(Number(v || 0).toFixed(2)).replace('.', ',');
      const corpo = linhas.map((l) =>
        [
          l.empresa,
          l.empresaNome,
          l.numero,
          fmtDataHora(l.data),
          l.tipoOperacao === 'E' ? 'Entrada' : 'Saída',
          l.operacao,
          l.operacaoNome,
          l.origemNome,
          SIT[l.situacao]?.label,
          l.encerradaEm ? fmtDataHora(l.encerradaEm) : '',
          l.cliente?.code,
          l.cliente?.nome,
          l.cliente?.doc,
          l.vendedor?.code,
          l.vendedor?.nome,
          l.qtdPecas,
          num(l.valorBruto),
          num(l.desconto),
          num(l.frete),
          num(l.valor),
          l.formas,
          l.nf ? `${l.nf.numero}/${l.nf.serie}` : '',
          l.ref,
          l.criadoPor,
        ]
          .map(cel)
          .join(';'),
      );
      const blob = new Blob([`﻿${[cab.join(';'), ...corpo].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `transacoes-headcoach-${consulta.de}-a-${consulta.ate}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setErro(e.message);
    } finally {
      setExportando(false);
    }
  };

  const op = dados?.opcoes || { empresas: [], operacoes: [], vendedores: [] };
  const r = dados?.resumo;
  const quadros = useMemo(
    () =>
      r
        ? [
            { label: 'Transações', valor: fmtNum(r.transacoes), sub: `${fmtNum(r.saidas)} saída(s) · ${fmtNum(r.entradas)} entrada(s)` },
            { label: 'Valor das saídas', valor: fmtBRL(r.valor), sub: `${fmtNum(r.pecas)} peça(s) · sem as canceladas` },
            { label: 'Descontos', valor: fmtBRL(r.desconto), sub: 'nas saídas não canceladas' },
            { label: 'Em andamento', valor: fmtNum(r.porSituacao.andamento), sub: 'nota não autorizada / aberta', cor: 'text-amber-700' },
            { label: 'Atendidas', valor: fmtNum(r.porSituacao.atendida), sub: 'concluídas', cor: 'text-emerald-700' },
            { label: 'Canceladas', valor: fmtNum(r.porSituacao.cancelada), sub: 'nota/venda cancelada', cor: 'text-gray-500' },
          ]
        : [],
    [r],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-7xl">
        <PageTitle
          title="Transações"
          subtitle="Tudo o que o HeadCoach emitiu: PDV Crosby, Faturamento (pedidos, Brejinho e avulso), Transferências e Devoluções"
          icon={ListMagnifyingGlass}
        />

        {/* Filtros (como no TRAFL016) */}
        <form onSubmit={consultar} className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className={labelCls}>Empresa</label>
              <select value={f.empresa} onChange={set('empresa')} className={inputCls}>
                <option value="">Todas</option>
                {op.empresas.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.code} — {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Data de</label>
              <input type="date" value={f.de} onChange={set('de')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Data até</label>
              <input type="date" value={f.ate} onChange={set('ate')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nº transação</label>
              <input value={f.numero} onChange={set('numero')} placeholder="ex.: 45 ou D28" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nº da NF</label>
              <input value={f.nf} onChange={set('nf')} inputMode="numeric" placeholder="ex.: 16528" className={inputCls} />
            </div>

            <div className="lg:col-span-2">
              <label className={labelCls}>Cliente</label>
              <input value={f.cliente} onChange={set('cliente')} placeholder="código, nome ou CPF/CNPJ" className={inputCls} />
            </div>
            <div className="lg:col-span-2">
              <label className={labelCls}>Vendedor</label>
              <select value={f.vendedor} onChange={set('vendedor')} className={inputCls}>
                <option value="">Todos</option>
                {op.vendedores.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.code} — {v.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelCls}>Operação</label>
              <select value={f.operacao} onChange={set('operacao')} className={inputCls}>
                <option value="">Todas</option>
                {op.operacoes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.code} — {o.nome} ({o.tipo === 'E' ? 'entrada' : 'saída'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Valor de</label>
              <input value={f.valorMin} onChange={set('valorMin')} inputMode="decimal" placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valor até</label>
              <input value={f.valorMax} onChange={set('valorMax')} inputMode="decimal" placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Desconto de</label>
              <input value={f.descontoMin} onChange={set('descontoMin')} inputMode="decimal" placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Desconto até</label>
              <input value={f.descontoMax} onChange={set('descontoMax')} inputMode="decimal" placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Encerramento de</label>
              <input type="date" value={f.encerramentoDe} onChange={set('encerramentoDe')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Encerramento até</label>
              <input type="date" value={f.encerramentoAte} onChange={set('encerramentoAte')} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Tipo de operação</label>
              <select value={f.tipo} onChange={set('tipo')} className={inputCls}>
                <option value="">Entrada e saída</option>
                <option value="S">Saída</option>
                <option value="E">Entrada</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Origem</label>
              <select value={f.origem} onChange={set('origem')} className={inputCls}>
                <option value="">Todas</option>
                {ORIGENS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={labelCls}>Situação</label>
              <div className="flex flex-wrap gap-1.5">
                {SITUACOES.map((s) => (
                  <button
                    key={s.k}
                    type="button"
                    onClick={() => alternarSituacao(s.k)}
                    className={`h-9 rounded-lg px-3 text-[11px] font-bold ring-1 ${f.situacao.includes(s.k) ? s.on : `${s.cls} hover:brightness-95`}`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="self-center text-[10.5px] text-gray-400">{f.situacao.length ? '' : 'nenhuma marcada = todas'}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <button type="submit" disabled={carregando} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-4 text-xs font-bold text-white hover:bg-[#000638]/90 disabled:opacity-50">
              {carregando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} Consultar
            </button>
            <button type="button" onClick={limpar} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
              <Eraser size={14} /> Limpar
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={exportar}
              disabled={exportando || !r?.transacoes}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40"
            >
              {exportando ? <Spinner size={14} className="animate-spin" /> : <DownloadSimple size={14} />} Exportar CSV
            </button>
          </div>
        </form>

        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}

        {/* Resumo */}
        {r && (
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {quadros.map((q) => (
              <div key={q.label} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{q.label}</p>
                <p className={`truncate text-xl font-bold leading-tight tabular-nums ${q.cor || 'text-[#000638]'}`}>{q.valor}</p>
                <p className="truncate text-[10.5px] text-gray-500">{q.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Lista */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Emp.</th>
                  <th className="px-2 py-2 text-left">Nº</th>
                  <th className="px-2 py-2 text-left">Data</th>
                  <th className="px-2 py-2 text-left">Tipo</th>
                  <th className="px-2 py-2 text-left">Operação</th>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-left">Vendedor</th>
                  <th className="px-2 py-2 text-right">Pçs</th>
                  <th className="px-2 py-2 text-right">Valor bruto</th>
                  <th className="px-2 py-2 text-right">Desconto</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-left">Situação</th>
                  <th className="px-2 py-2 text-left">Dt. encerr.</th>
                  <th className="px-2 py-2 text-left">NF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!dados && carregando && (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-gray-400">
                      <Spinner size={20} className="mx-auto animate-spin" />
                    </td>
                  </tr>
                )}
                {dados && dados.items.length === 0 && (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-gray-400">
                      Nenhuma transação com esses filtros.
                    </td>
                  </tr>
                )}
                {(dados?.items || []).map((l) => {
                  const S = SIT[l.situacao];
                  return (
                    <tr key={l.id} onClick={() => setAberta(l.id)} className={`cursor-pointer hover:bg-blue-50/50 ${l.situacao === 'cancelada' ? 'text-gray-400' : ''}`} title="Abrir a transação">
                      <td className="px-2 py-1.5 font-semibold tabular-nums" title={l.empresaNome}>
                        {l.empresa}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="font-mono font-bold text-[#000638]">{l.numero}</span>
                        <span className="block text-[10px] text-gray-400">{l.origemNome}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtDataHora(l.data)}</td>
                      <td className="px-2 py-1.5">
                        <TipoChip tipo={l.tipoOperacao} />
                      </td>
                      <td className="max-w-[190px] px-2 py-1.5">
                        <span className="block truncate" title={`${l.operacao || ''} — ${l.operacaoNome}`}>
                          <b className="tabular-nums">{l.operacao || '—'}</b> {l.operacaoNome}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-2 py-1.5">
                        <span className="block truncate font-semibold" title={l.cliente?.nome}>
                          {l.cliente?.nome || '—'}
                        </span>
                        <span className="block text-[10px] text-gray-400">{l.cliente?.code || ''}</span>
                      </td>
                      <td className="max-w-[140px] truncate px-2 py-1.5" title={l.vendedor?.nome}>
                        {l.vendedor?.nome || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(l.qtdPecas)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL(l.valorBruto)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">{l.desconto > 0 ? fmtBRL(l.desconto) : '—'}</td>
                      <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${l.situacao === 'cancelada' ? 'line-through' : 'text-[#000638]'}`}>{fmtBRL(l.valor)}</td>
                      <td className="px-2 py-1.5">
                        <Chip cls={S.cls}>{S.label}</Chip>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{l.encerradaEm ? fmtDataHora(l.encerradaEm) : '—'}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {l.nf ? (
                          <span title={l.nf.status}>
                            {l.nf.numero}
                            {l.nf.status !== 'autorizada' && <span className="ml-1 text-[10px] text-gray-400">{l.nf.status}</span>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {dados && dados.paginas > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-3 py-2 text-xs">
              <span className="text-gray-500">
                Página {dados.pagina} de {dados.paginas}
              </span>
              <button disabled={pagina <= 1 || carregando} onClick={() => setPagina((p) => p - 1)} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-gray-300 disabled:opacity-40">
                <CaretLeft size={13} />
              </button>
              <button disabled={pagina >= dados.paginas || carregando} onClick={() => setPagina((p) => p + 1)} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-gray-300 disabled:opacity-40">
                <CaretRight size={13} />
              </button>
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-[10.5px] text-gray-400">
          Situação: EM ANDAMENTO = nota ainda não autorizada (ou devolução aberta) · ATENDIDA = nota autorizada / devolução atendida · CANCELADA = nota ou venda cancelada.
        </p>
      </div>

      {aberta && <DetalheTransacao id={aberta} onFechar={() => setAberta(null)} />}
    </div>
  );
}
