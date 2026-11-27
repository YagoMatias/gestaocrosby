// ============================================================================
// HEADCOACH › FINANCEIRO › CONTAS A PAGAR › CONTAS FIXAS DAS LOJAS (Yago, 26/11/2026)
// Uma página só no lugar de três: Controle de Filiais (despesas fixas e dados
// cadastrais das lojas) e CTO.
//   • PLANILHA DO MÊS: uma linha por loja, uma coluna por despesa (aluguel,
//     condomínio, energia, água, internet, outras). Cada célula mostra o
//     fornecedor, COMO PEGAR a conta para pagar e o que aconteceu no mês (pago,
//     em aberto, pendente). O que ainda não tem cadastro aparece como "Sem
//     cadastro" — é só clicar e cadastrar aos poucos.
//     DE ONDE VEM O MÊS (26/11/2026): até outubro/2026 são os títulos do TOTVS, conferidos com a
//     baixa do TOTVS e com as baixas do HeadCoach (conciliação, Liberação); de novembro em diante,
//     só o Contas a Pagar HeadCoach.
//   • LOJAS: dados cadastrais das lojas e imóveis, guardados no HeadCoach.
//   • CTO: custo total de ocupação (a mesma tela do CTO).
// API: /api/contas-fixas-lojas — services/contasFixasLojas.js
// ============================================================================
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Storefront, Table, Buildings, ChartBar, Spinner, X, Plus, PencilSimple, Trash, FileXls, MagnifyingGlass, Robot, EnvelopeSimple, WhatsappLogo, Globe, HandCoins, Receipt, Question, Prohibit, ShoppingBagOpen, Copy, CheckCircle, Warning, CaretLeft, CaretRight, NotePencil, ArrowsClockwise, Scales } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';

const CTO = lazy(() => import('./CTO'));

const API = '/api/contas-fixas-lojas';
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDia = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtCNPJ = (c) => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : c || '—';
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeDoMes = (m) => (m ? `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}` : '');
const mesVizinho = (m, passo) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + passo, 1));
  return d.toISOString().slice(0, 7);
};
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';

// situação da célula → cores e rótulo (as mesmas da planilha de 23/11)
const SITUACOES = {
  pago: { rotulo: 'Pago no mês', cel: 'bg-emerald-50 ring-emerald-200', txt: 'text-emerald-800', ponto: 'bg-emerald-500' },
  aberto: { rotulo: 'Em aberto', cel: 'bg-amber-50 ring-amber-200', txt: 'text-amber-800', ponto: 'bg-amber-500' },
  vencido: { rotulo: 'Vencido', cel: 'bg-rose-50 ring-rose-200', txt: 'text-rose-800', ponto: 'bg-rose-500' },
  pendente: { rotulo: 'Pendente (conta ainda não lançada)', cel: 'bg-orange-50 ring-orange-200', txt: 'text-orange-800', ponto: 'bg-orange-500' },
  sem_cadastro: { rotulo: 'Sem cadastro', cel: 'bg-gray-50 ring-transparent outline-dashed outline-1 -outline-offset-1 outline-gray-300', txt: 'text-gray-500', ponto: 'bg-gray-400' },
  nao_se_aplica: { rotulo: 'Não se aplica', cel: 'bg-white ring-gray-200', txt: 'text-gray-400', ponto: 'bg-gray-300' },
  fora_do_controle: { rotulo: 'Fora do controle', cel: 'bg-violet-50 ring-violet-200', txt: 'text-violet-800', ponto: 'bg-violet-500' },
  vazio: { rotulo: 'Sem movimento', cel: 'bg-white ring-gray-200', txt: 'text-gray-500', ponto: 'bg-gray-300' },
};
// como a conta chega → ícone
const ICONE_DO_CANAL = { robo_whatsapp: Robot, email_automatico: EnvelopeSimple, email: EnvelopeSimple, whatsapp: WhatsappLogo, site: Globe, loja_envia: Storefront, pix_direto: HandCoins, boleto: Receipt, sob_demanda: ShoppingBagOpen, fora_do_controle: Prohibit, nao_definido: Question };
const CANAL_CURTO = { robo_whatsapp: 'Robô do WhatsApp', email_automatico: 'E-mail (lança sozinho)', email: 'E-mail', whatsapp: 'WhatsApp', site: 'Site / aplicativo', loja_envia: 'A loja envia', pix_direto: 'Pix ao locador', boleto: 'Boleto do fornecedor', sob_demanda: 'Sob demanda', fora_do_controle: 'Fora do controle', nao_definido: 'A definir' };
const PODE_EDITAR = ['owner', 'admin', 'manager', 'user'];

function Cartao({ rotulo, valor, cls = 'text-[#000638]', sub = null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{valor}</p>
      {sub && <p className="text-[10.5px] text-gray-500">{sub}</p>}
    </div>
  );
}

export default function ContasFixasLojas() {
  const { user } = useAuth();
  const podeEditar = PODE_EDITAR.includes(user?.role);
  const [aba, setAba] = useState('planilha');
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-[1500px]">
        <PageTitle title="Contas Fixas das Lojas" subtitle="Aluguel, condomínio, energia, água e internet de cada loja: quem é o fornecedor, como pegar a conta para pagar e o que já foi pago no mês" icon={Storefront} />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[
            { id: 'planilha', rotulo: 'Planilha do mês', icone: Table },
            { id: 'lojas', rotulo: 'Lojas', icone: Buildings },
            { id: 'cto', rotulo: 'CTO', icone: ChartBar },
          ].map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)} data-aba={a.id} className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ring-1 ${aba === a.id ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'}`}>
              <a.icone size={15} weight="bold" /> {a.rotulo}
            </button>
          ))}
        </div>
        {aba === 'planilha' && <Planilha podeEditar={podeEditar} />}
        {aba === 'lojas' && <Lojas podeEditar={podeEditar} />}
        {aba === 'cto' && (
          <Suspense fallback={<div className="py-16 text-center text-gray-400"><Spinner size={22} className="mx-auto animate-spin" /></div>}>
            <CTO embutido />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── PLANILHA DO MÊS ─────────────────────────────────────────────────────────
function Planilha({ podeEditar }) {
  const [mes, setMes] = useState(() => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7));
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState(''); // situação
  const [aberta, setAberta] = useState(null); // { cdFilial, coluna }
  const [aviso, setAviso] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async (m, quieto = false) => {
    if (!quieto) setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/planilha?mes=${m}`);
      setD(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar(mes);
  }, [mes, carregar]);

  // relê do TOTVS os títulos do mês antigo (as baixas do TOTVS chegam com atraso); roda no servidor e leva ~1 minuto
  const atualizarDoTotvs = async () => {
    setAtualizando(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/atualizar-totvs`, { method: 'POST', body: { de: mes, ate: mes } });
      setAviso(`${j.message}. A planilha é recarregada sozinha em instantes.`);
      setTimeout(() => carregar(mes, true).finally(() => setAtualizando(false)), 20000);
    } catch (e) {
      setErro(e.message);
      setAtualizando(false);
    }
  };

  const lojas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (d?.lojas || []).filter((l) => (!b || `${l.nome} ${l.cdFilial} ${l.cidade || ''} ${l.shopping || ''}`.toLowerCase().includes(b)) && (!filtro || d.colunas.some((c) => l.celulas[c.id].situacao === filtro)));
  }, [d, busca, filtro]);
  const celulaAberta = aberta && d ? { loja: d.lojas.find((l) => l.cdFilial === aberta.cdFilial), coluna: d.colunas.find((c) => c.id === aberta.coluna) } : null;

  const baixarPlanilha = () => {
    if (!d) return;
    const titulo = `Contas fixas das lojas — ${nomeDoMes(d.mes)} (posição em ${fmtDia(d.hoje)})`;
    const textoDaCelula = (x) => {
      const linhas = x.cadastros.map((c) => `${c.fornecedorCurto}: ${c.noMes.resumo} · como pegar: ${CANAL_CURTO[c.comoPegarCanal] || c.comoPegarCanalNome}`);
      if (!x.cadastros.length && x.resumo) linhas.push(`${[...new Set(x.lancamentos.map((l) => l.fornecedorCurto))].join(', ')}: ${x.resumo} (sem cadastro)`);
      if (!linhas.length) linhas.push(SITUACOES[x.situacao]?.rotulo || '');
      if (x.anotacao) linhas.push(`Obs.: ${x.anotacao}`);
      return linhas.join('\n');
    };
    const wb = XLSX.utils.book_new();
    const porLoja = [[titulo], [], ['LOJA', ...d.colunas.map((c) => c.nome.toUpperCase()), 'PAGO NO MÊS', 'EM ABERTO']];
    for (const l of d.lojas) porLoja.push([`${l.nome}\n${/^\d+$/.test(l.cdFilial) ? `Loja ${l.cdFilial}` : l.tipoNome}`, ...d.colunas.map((c) => textoDaCelula(l.celulas[c.id])), l.pago, l.aberto]);
    porLoja.push(['TOTAL', ...d.colunas.map((c) => `Pago ${fmtBRL(d.totais.porColuna[c.id].pago)}\nEm aberto ${fmtBRL(d.totais.porColuna[c.id].aberto)}`), d.totais.pago, d.totais.aberto]);
    const s1 = XLSX.utils.aoa_to_sheet(porLoja);
    s1['!cols'] = [{ wch: 24 }, ...d.colunas.map(() => ({ wch: 46 })), { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, s1, 'Por loja');
    const lanc = [[titulo], [], ['CÓD. LOJA', 'LOJA', 'DESPESA', 'FORNECEDOR', 'SITUAÇÃO', 'VALOR', 'VALOR PAGO', 'VENCIMENTO', 'PAGAMENTO', 'DUPLICATA', 'ORIGEM', 'CONFERÊNCIA (TOTVS × HEADCOACH)', 'OBSERVAÇÃO']];
    for (const l of d.lojas) for (const c of d.colunas) for (const x of l.celulas[c.id].lancamentos) lanc.push([l.cdFilial, l.nome, c.nome, x.fornecedor, x.situacao === 'pago' ? 'Pago' : x.situacao === 'capturada' ? 'Fatura capturada (sem lançamento)' : x.vencimento < d.hoje ? 'Vencido' : 'Em aberto', x.valor, x.valorPago || '', fmtDia(x.vencimento), x.pagamento ? fmtDia(x.pagamento) : '', x.duplicata || '', x.origemNome, x.conferencia?.texto || '', x.observacao || '']);
    const s2 = XLSX.utils.aoa_to_sheet(lanc);
    s2['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 26 }, { wch: 70 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, s2, 'Lançamentos');
    const cad = [[titulo], [], ['CÓD. LOJA', 'LOJA', 'DESPESA', 'FORNECEDOR', 'DIA DO VENCIMENTO', 'FORMA DE PAGAMENTO', 'COMO PEGAR (CANAL)', 'COMO PEGAR (PASSO A PASSO)', 'NO MÊS']];
    for (const l of d.lojas) for (const c of d.colunas) for (const k of l.celulas[c.id].cadastros) cad.push([l.cdFilial, l.nome, k.tipoNome, k.fornecedor, k.vencimentoDia || '', k.formaPagamento || '', k.comoPegarCanalNome, k.comoPegar || '', k.noMes.resumo]);
    const s3 = XLSX.utils.aoa_to_sheet(cad);
    s3['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 90 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, s3, 'Cadastro e como pegar');
    const pend = [[`O que ainda falta — ${nomeDoMes(d.mes)}`], [], ['CÓD. LOJA', 'LOJA', 'DESPESA', 'FORNECEDOR', 'O QUE FALTA']];
    for (const p of d.pendencias) pend.push([p.cdFilial, p.loja, p.despesa, p.fornecedor || '', p.oQueFalta]);
    const s4 = XLSX.utils.aoa_to_sheet(pend);
    s4['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 16 }, { wch: 40 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, s4, 'Pendências');
    XLSX.writeFile(wb, `contas-fixas-das-lojas-${d.mes}.xlsx`);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div>
          <label className={labelCls}>Mês (pelo vencimento da conta)</label>
          <div className="flex items-center gap-1">
            <button onClick={() => setMes((m) => mesVizinho(m, -1))} title="Mês anterior" className="inline-flex h-9 w-8 items-center justify-center rounded-lg ring-1 ring-gray-300 hover:bg-gray-50">
              <CaretLeft size={14} weight="bold" />
            </button>
            <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className={`${inputCls} !w-40`} data-mes />
            <button onClick={() => setMes((m) => mesVizinho(m, 1))} title="Mês seguinte" className="inline-flex h-9 w-8 items-center justify-center rounded-lg ring-1 ring-gray-300 hover:bg-gray-50">
              <CaretRight size={14} weight="bold" />
            </button>
          </div>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className={labelCls}>Loja</label>
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2 top-2.5 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome, código ou cidade" className={`${inputCls} pl-7`} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Mostrar só lojas com</label>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${inputCls} !w-56`}>
            <option value="">todas as lojas</option>
            {['vencido', 'aberto', 'pendente', 'sem_cadastro'].map((s) => (
              <option key={s} value={s}>
                {SITUACOES[s].rotulo}
              </option>
            ))}
          </select>
        </div>
        <button onClick={baixarPlanilha} disabled={!d} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40" data-baixar>
          <FileXls size={15} weight="bold" /> Baixar planilha
        </button>
        {carregando && <Spinner size={18} className="mb-2 animate-spin text-gray-400" />}
      </div>
      {aviso && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{aviso}</p>}
      {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {d && (
        <>
          {/* de onde vêm os números do mês */}
          {d.fonte === 'totvs' ? (
            <div className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-950 ring-1 ring-indigo-200" data-conferencia>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
                <Scales size={15} weight="bold" /> Mês anterior a novembro/2026: contas do TOTVS, conferidas com as baixas do TOTVS e do HeadCoach
                {podeEditar && (
                  <button onClick={atualizarDoTotvs} disabled={atualizando} className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-bold text-indigo-800 ring-1 ring-indigo-300 hover:bg-indigo-100 disabled:opacity-50" data-atualizar-totvs>
                    {atualizando ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} weight="bold" />} Atualizar do TOTVS
                  </button>
                )}
              </p>
              {d.conferencia?.titulos > 0 ? (
                <p className="mt-1">
                  <b>{d.conferencia.titulos}</b> contas ({fmtBRL(d.conferencia.valor)}) · <b className="text-emerald-700">{d.conferencia.baixadosNoTotvs}</b> baixadas no TOTVS
                  {d.conferencia.baixadosNosDois > 0 ? ` (${d.conferencia.baixadosNosDois} delas também conciliadas no HeadCoach)` : ''} · <b className="text-sky-700">{d.conferencia.soNoHeadcoach}</b> sem baixa no TOTVS mas pagas pelo HeadCoach
                  {d.conferencia.soNoHeadcoach > 0 ? ` (${fmtBRL(d.conferencia.valorSoNoHeadcoach)})` : ''} · <b className="text-rose-700">{d.conferencia.emAberto}</b> sem baixa em nenhum dos dois
                  {d.conferencia.emAberto > 0 ? ` (${fmtBRL(d.conferencia.valorEmAberto)})` : ''}
                  {d.conferencia.sincronizadoEm ? <span className="text-indigo-700"> · lido do TOTVS em {new Date(d.conferencia.sincronizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : null}
                </p>
              ) : (
                <p className="mt-1">Nenhuma conta deste mês foi trazida do TOTVS ainda{podeEditar ? ' — use "Atualizar do TOTVS".' : '.'}</p>
              )}
            </div>
          ) : (
            <p className="mb-3 rounded-xl bg-white px-3 py-1.5 text-[11px] text-gray-500 ring-1 ring-gray-200" data-fonte-headcoach>
              De novembro/2026 em diante a planilha considera só o Contas a Pagar do HeadCoach.
            </p>
          )}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Cartao rotulo={`Pago em ${MESES[Number(d.mes.slice(5, 7)) - 1]}`} valor={fmtBRL(d.totais.pago)} cls="text-emerald-700" />
            <Cartao rotulo={d.fonte === 'totvs' ? 'Sem baixa (TOTVS e HeadCoach)' : 'Em aberto'} valor={fmtBRL(d.totais.aberto)} cls="text-amber-700" sub={d.totais.vencido > 0 ? `${fmtBRL(d.totais.vencido)} já vencido` : null} />
            <Cartao rotulo="Pendentes" valor={d.totais.pendentes} cls="text-orange-700" sub="contas do cadastro sem lançamento no mês" />
            <Cartao rotulo="Sem cadastro" valor={d.totais.semCadastro} cls="text-gray-600" sub="loja × despesa ainda sem fornecedor" />
            <Cartao rotulo="Lojas" valor={d.lojas.length} />
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
            {['pago', 'aberto', 'vencido', 'pendente', 'sem_cadastro', 'fora_do_controle'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <i className={`inline-block h-2.5 w-2.5 rounded-full ${SITUACOES[s].ponto}`} /> {SITUACOES[s].rotulo}
              </span>
            ))}
            <span className="text-gray-400">· clique numa célula para ver os detalhes{podeEditar ? ' e cadastrar' : ''}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-0 text-xs" data-planilha>
              <thead>
                <tr className="bg-[#000638] text-left text-[10.5px] uppercase tracking-wide text-white">
                  <th className="sticky left-0 z-10 w-[170px] bg-[#000638] px-2 py-2">Loja</th>
                  {d.colunas.map((c) => (
                    <th key={c.id} className="px-2 py-2">
                      {c.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lojas.length === 0 && (
                  <tr>
                    <td colSpan={d.colunas.length + 1} className="px-2 py-10 text-center text-gray-400">
                      Nenhuma loja com esse filtro.
                    </td>
                  </tr>
                )}
                {lojas.map((l) => (
                  <tr key={l.cdFilial} data-loja={l.cdFilial}>
                    <td className="sticky left-0 z-10 border-t border-gray-100 bg-white px-2 py-1.5 align-top">
                      <p className="font-bold text-[#000638]">{l.nome}</p>
                      <p className="text-[10.5px] text-gray-500">
                        {/^\d+$/.test(l.cdFilial) ? `Loja ${l.cdFilial} · ` : ''}
                        {l.tipoNome}
                      </p>
                      {(l.pago > 0 || l.aberto > 0) && (
                        <p className="mt-0.5 text-[10.5px] tabular-nums text-gray-500">
                          {l.pago > 0 && <span className="text-emerald-700">pago {fmtBRL(l.pago)}</span>}
                          {l.pago > 0 && l.aberto > 0 && ' · '}
                          {l.aberto > 0 && <span className="text-amber-700">aberto {fmtBRL(l.aberto)}</span>}
                        </p>
                      )}
                    </td>
                    {d.colunas.map((c) => (
                      <td key={c.id} className="border-t border-gray-100 p-1 align-top">
                        <Celula x={l.celulas[c.id]} onClick={() => setAberta({ cdFilial: l.cdFilial, coluna: c.id })} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 text-[11px] font-semibold">
                  <td className="sticky left-0 z-10 border-t border-gray-200 bg-gray-50 px-2 py-2 uppercase text-[#000638]">Total do mês</td>
                  {d.colunas.map((c) => (
                    <td key={c.id} className="border-t border-gray-200 px-2 py-2 tabular-nums">
                      <span className="text-emerald-700">pago {fmtBRL(d.totais.porColuna[c.id].pago)}</span>
                      {d.totais.porColuna[c.id].aberto > 0 && <span className="block text-amber-700">aberto {fmtBRL(d.totais.porColuna[c.id].aberto)}</span>}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          {d.semLoja.length > 0 && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
              <b>{d.semLoja.length} lançamento(s) do mês sem loja</b> (centro de custo que não é de loja): {d.semLoja.map((x) => `${x.fornecedorCurto} ${fmtBRL(x.valor)} — ${x.centroCusto || 'sem centro de custo'}`).join(' · ')}
            </p>
          )}
          {(d.desconsiderados || []).length > 0 && (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-200" data-desconsiderados-total>
              <b>{d.desconsiderados.length} lançamento(s) do mês fora da planilha</b> por regra de célula ({fmtBRL(d.desconsiderados.reduce((t, l) => t + l.valor, 0))}): fornecedor fora do cadastro da loja ou despesa marcada como "não se aplica". Abra a célula para ver quais.
            </p>
          )}
          <Pendencias itens={d.pendencias} onAbrir={(p) => setAberta({ cdFilial: p.cdFilial, coluna: p.coluna })} />
        </>
      )}
      {celulaAberta?.loja && celulaAberta.coluna && (
        <DetalheDaCelula
          loja={celulaAberta.loja}
          coluna={celulaAberta.coluna}
          dados={d}
          podeEditar={podeEditar}
          onFechar={() => setAberta(null)}
          onMudou={(msg) => {
            setAviso(msg);
            carregar(mes, true);
          }}
        />
      )}
    </>
  );
}

// uma célula da planilha: fornecedor, o que houve no mês e como pegar a conta
function Celula({ x, onClick }) {
  const s = SITUACOES[x.situacao] || SITUACOES.vazio;
  const avulsos = !x.cadastros.length && x.lancamentos.length ? [...new Set(x.lancamentos.map((l) => l.fornecedorCurto))] : [];
  return (
    <button onClick={onClick} data-celula={x.situacao} className={`block h-full min-h-[58px] w-full rounded-lg px-2 py-1.5 text-left ring-1 transition hover:brightness-95 ${s.cel}`}>
      {x.situacao === 'sem_cadastro' && <span className="text-[11px] font-semibold text-gray-400">Sem cadastro</span>}
      {x.situacao === 'nao_se_aplica' && <span className="text-[11px] text-gray-400">Não se aplica</span>}
      {x.soCadastro && <span className="mb-0.5 block text-[9.5px] font-semibold uppercase tracking-wide text-gray-400">só fornecedores do cadastro</span>}
      {/* célula "não se aplica": o cadastro antigo continua no detalhe, mas não polui a planilha */}
      {(x.situacao === 'nao_se_aplica' ? [] : x.cadastros).map((c) => {
        const Icone = ICONE_DO_CANAL[c.comoPegarCanal] || Question;
        const sc = SITUACOES[c.noMes.situacao] || SITUACOES.vazio;
        return (
          <span key={c.id} className="mb-1 block last:mb-0">
            <span className="flex items-center gap-1 font-bold text-[#000638]">
              <i className={`inline-block h-2 w-2 shrink-0 rounded-full ${sc.ponto}`} />
              <span className="truncate">{c.fornecedorCurto}</span>
            </span>
            {/* "Sob demanda" e "Fora do controle" já são o próprio canal: não repete a linha */}
            {c.noMes.resumo !== (CANAL_CURTO[c.comoPegarCanal] || '') && <span className={`block text-[10.5px] leading-tight ${sc.txt}`}>{c.noMes.resumo}</span>}
            <span className="flex items-center gap-1 text-[10px] leading-tight text-gray-500" title={c.comoPegar || c.comoPegarCanalNome}>
              <Icone size={11} weight="bold" className="shrink-0" /> <span className="truncate">{CANAL_CURTO[c.comoPegarCanal] || c.comoPegarCanalNome}</span>
            </span>
          </span>
        );
      })}
      {avulsos.length > 0 && (
        <span className="block">
          <span className="block truncate font-bold text-[#000638]">{avulsos.join(', ')}</span>
          <span className={`block text-[10.5px] leading-tight ${s.txt}`}>{x.resumo}</span>
          <span className="block text-[10px] font-semibold leading-tight text-gray-500">sem cadastro: falta informar como pegar</span>
        </span>
      )}
      {x.cadastros.length > 0 && x.lancamentosSemCadastro > 0 && <span className="mt-0.5 block text-[10px] leading-tight text-gray-500">+ {x.lancamentosSemCadastro} lançamento(s) de outro fornecedor</span>}
      {x.anotacao && (
        <span className="mt-0.5 flex items-start gap-1 text-[10px] leading-tight text-gray-500" title={x.anotacao}>
          <NotePencil size={11} className="mt-px shrink-0" /> <span className="max-h-[2.2em] overflow-hidden">{x.anotacao}</span>
        </span>
      )}
    </button>
  );
}

function Pendencias({ itens, onAbrir }) {
  const [aberto, setAberto] = useState(false);
  if (!itens.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white shadow-sm" data-pendencias>
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[#000638]">
        <Warning size={16} weight="bold" className="text-orange-600" /> O que ainda falta ({itens.length})
        <span className="ml-auto text-xs font-semibold text-gray-500">{aberto ? 'esconder' : 'mostrar'}</span>
      </button>
      {aberto && (
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-1.5">Loja</th>
              <th className="px-2 py-1.5">Despesa</th>
              <th className="px-2 py-1.5">Fornecedor</th>
              <th className="px-2 py-1.5">O que falta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {itens.map((p, i) => (
              <tr key={i} onClick={() => onAbrir(p)} className="cursor-pointer hover:bg-indigo-50/50">
                <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-[#000638]">{p.loja}</td>
                <td className="px-2 py-1.5">{p.despesa}</td>
                <td className="px-2 py-1.5">{p.fornecedor || '—'}</td>
                <td className="px-2 py-1.5 text-gray-600">{p.oQueFalta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── DETALHE DE UMA CÉLULA (loja + despesa) ──────────────────────────────────
function DetalheDaCelula({ loja, coluna, dados, podeEditar, onFechar, onMudou }) {
  const x = loja.celulas[coluna.id];
  const [form, setForm] = useState(null); // null | { novo: true } | cadastro
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState(x.anotacao || '');
  const [naoSeAplica, setNaoSeAplica] = useState(!!x.naoSeAplica);
  const [soCadastro, setSoCadastro] = useState(!!x.soCadastro);
  const [copiado, setCopiado] = useState(null);
  useEffect(() => {
    setNota(x.anotacao || '');
    setNaoSeAplica(!!x.naoSeAplica);
    setSoCadastro(!!x.soCadastro);
  }, [x.anotacao, x.naoSeAplica, x.soCadastro]);
  const s = SITUACOES[x.situacao] || SITUACOES.vazio;
  const tiposDaColuna = dados.tiposDespesa.filter((t) => t.coluna === coluna.id);
  const copiar = async (texto, id) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      setErro('Não consegui copiar; selecione o texto e copie à mão.');
    }
  };
  const excluir = async (c) => {
    if (!window.confirm(`Excluir ${c.fornecedor} (${c.tipoNome}) do cadastro da loja ${loja.nome}?`)) return;
    setBusy(true);
    setErro('');
    try {
      await apiJson(`${API}/despesas/${c.id}`, { method: 'DELETE' });
      onMudou(`${c.fornecedor} excluído do cadastro de ${loja.nome}`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  const salvarNota = async () => {
    setBusy(true);
    setErro('');
    try {
      await apiJson(`${API}/anotacoes`, { method: 'PUT', body: { cdFilial: loja.cdFilial, coluna: coluna.id, naoSeAplica, soCadastro, observacao: nota } });
      onMudou(`Anotação de ${coluna.nome} — ${loja.nome} salva`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  const mudouNota = (nota || '') !== (x.anotacao || '') || naoSeAplica !== !!x.naoSeAplica || soCadastro !== !!x.soCadastro;
  // lançamentos do mês que a regra desta célula tirou da planilha
  const fora = (dados.desconsiderados || []).filter((l) => l.cdFilial === loja.cdFilial && l.coluna === coluna.id);
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar} data-detalhe>
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[#000638]">
              {coluna.nome} · {loja.nome}
            </h3>
            <p className="text-xs text-gray-500">
              {/^\d+$/.test(loja.cdFilial) ? `Loja ${loja.cdFilial} · ` : ''}
              {loja.tipoNome}
              {loja.shopping ? ` · ${loja.shopping}` : ''} · {nomeDoMes(dados.mes)}
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ${s.cel} ${s.txt}`}>{s.rotulo}</span>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {erro && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}

        {/* cadastro: fornecedores e como pegar */}
        <div className="mb-1 flex items-center gap-2">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Cadastro: de quem é a conta e como pegar</p>
          {podeEditar && !form && (
            <button onClick={() => setForm({ novo: true })} className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg bg-[#000638] px-2 text-[11px] font-bold text-white" data-novo-cadastro>
              <Plus size={12} weight="bold" /> Cadastrar fornecedor
            </button>
          )}
        </div>
        {x.cadastros.length === 0 && !form && (
          <p className="mb-3 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 border border-dashed border-gray-300">
            {x.naoSeAplica ? 'Marcado como "não se aplica" a esta loja.' : x.lancamentos.length ? 'Tem lançamento no mês, mas a despesa ainda não está no cadastro desta loja.' : 'Ainda sem cadastro para esta loja.'}
            {podeEditar ? ' Cadastre o fornecedor e como pegar a conta, ou marque abaixo que não se aplica.' : ''}
          </p>
        )}
        <div className="mb-3 space-y-2">
          {x.cadastros.map((c) => {
            const Icone = ICONE_DO_CANAL[c.comoPegarCanal] || Question;
            const sc = SITUACOES[c.noMes.situacao] || SITUACOES.vazio;
            return form?.id === c.id ? null : (
              <div key={c.id} className="rounded-xl p-3 ring-1 ring-gray-200" data-cadastro>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#000638]">
                      {c.fornecedor} {c.fornecedorCode && <span className="font-normal text-gray-400">· cód. {c.fornecedorCode}</span>}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {c.tipoNome}
                      {c.vencimentoDia ? ` · vence todo dia ${c.vencimentoDia}` : ''}
                      {c.formaPagamento ? ` · ${c.formaPagamento}` : ''}
                      {c.contratoVencimento ? ` · contrato até ${fmtDia(c.contratoVencimento)}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ${sc.cel} ${sc.txt}`}>{c.noMes.resumo}</span>
                  {podeEditar && (
                    <>
                      <button onClick={() => setForm(c)} title="Editar" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" data-editar>
                        <PencilSimple size={15} />
                      </button>
                      <button onClick={() => excluir(c)} disabled={busy} title="Excluir do cadastro" className="rounded-lg p-1 text-rose-500 hover:bg-rose-50">
                        <Trash size={15} />
                      </button>
                    </>
                  )}
                </div>
                <div className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-xs text-sky-950 ring-1 ring-sky-200" data-como-pegar>
                  <p className="flex items-center gap-1 font-bold">
                    <Icone size={14} weight="bold" /> Como pegar: {c.comoPegarCanalNome}
                  </p>
                  {c.comoPegar && <p className="mt-0.5 whitespace-pre-line">{c.comoPegar}</p>}
                </div>
                {c.observacao && <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 px-2.5 py-2 text-[11.5px] text-gray-700 ring-1 ring-gray-200">{c.observacao}</p>}
              </div>
            );
          })}
          {form && (
            <FormDespesa
              inicial={form.novo ? null : form}
              cdFilial={loja.cdFilial}
              tipos={tiposDaColuna}
              canais={dados.canais}
              onCancelar={() => setForm(null)}
              onSalvo={(msg) => {
                setForm(null);
                onMudou(msg);
              }}
            />
          )}
        </div>

        {/* o que aconteceu no mês */}
        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">{dados.fonte === 'totvs' ? `No TOTVS em ${nomeDoMes(dados.mes)}, conferido com as baixas` : `No Contas a Pagar HeadCoach em ${nomeDoMes(dados.mes)}`}</p>
        {x.lancamentos.length === 0 ? (
          <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 ring-1 ring-gray-200">Nenhuma conta com vencimento neste mês.</p>
        ) : (
          <div className="mb-3 overflow-x-auto rounded-xl ring-1 ring-gray-200">
            <table className="w-full text-xs" data-lancamentos>
              <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-1.5">Fornecedor</th>
                  <th className="px-2 py-1.5 text-right">Valor</th>
                  <th className="px-2 py-1.5">Vencimento</th>
                  <th className="px-2 py-1.5">Situação</th>
                  <th className="px-2 py-1.5">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {x.lancamentos.map((l) => (
                  <React.Fragment key={l.chave}>
                    <tr>
                      <td className="px-2 py-1.5">
                        <b className="text-[#000638]">{l.fornecedor}</b>
                        {l.duplicata && <span className="text-gray-400"> · dup. {l.duplicata}</span>}
                        {l.rateado && <span className="text-gray-400"> · rateado</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtBRL(l.valor)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtDia(l.vencimento)}</td>
                      <td className="px-2 py-1.5">
                        {l.situacao === 'pago' ? (
                          <span className="font-semibold text-emerald-700">
                            Pago {fmtBRL(l.valorPago || l.valor)} em {fmtDia(l.pagamento)}
                          </span>
                        ) : l.situacao === 'capturada' ? (
                          <span className="font-semibold text-orange-700">Fatura capturada</span>
                        ) : l.simbolico ? (
                          <span className="font-semibold text-indigo-700">Previsão: aguardando a conta</span>
                        ) : l.previsao ? (
                          <span className="font-semibold text-indigo-700">Previsão (valor do mês anterior)</span>
                        ) : (
                          <span className={`font-semibold ${l.vencimento < dados.hoje ? 'text-rose-700' : 'text-amber-700'}`}>{l.vencimento < dados.hoje ? 'Vencido' : 'Em aberto'}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-500">{l.origemNome}</td>
                    </tr>
                    {l.conferencia && (
                      <tr data-conferencia-linha={l.conferencia.pagoOnde || 'aberto'}>
                        <td colSpan={5} className={`px-2 pb-1.5 text-[11px] ${l.conferencia.pagoOnde === 'headcoach' ? 'text-sky-800' : l.conferencia.pagoOnde ? 'text-gray-500' : 'font-semibold text-rose-700'}`}>
                          <Scales size={11} className="mr-1 inline" />
                          {l.conferencia.texto}
                        </td>
                      </tr>
                    )}
                    {l.situacao !== 'pago' && (l.chavePix || l.codigoBarras) && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-2 py-1.5">
                          {l.chavePix && (
                            <button onClick={() => copiar(l.chavePix, `${l.chave}-pix`)} className="mr-2 inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-100">
                              {copiado === `${l.chave}-pix` ? <CheckCircle size={13} weight="fill" className="text-emerald-600" /> : <Copy size={13} />} Copiar Pix
                            </button>
                          )}
                          {l.codigoBarras && (
                            <button onClick={() => copiar(l.codigoBarras, `${l.chave}-bol`)} className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-100">
                              {copiado === `${l.chave}-bol` ? <CheckCircle size={13} weight="fill" className="text-emerald-600" /> : <Copy size={13} />} Copiar linha do boleto
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fora.length > 0 && (
          <div className="mb-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-200" data-desconsiderados>
            <p className="font-bold text-gray-700">
              {fora.length} lançamento(s) do mês desconsiderado(s) nesta célula ({fmtBRL(fora.reduce((t, l) => t + l.valor, 0))})
            </p>
            <p className="text-[11px]">{fora[0].motivo}</p>
            <ul className="mt-1 space-y-0.5">
              {fora.map((l) => (
                <li key={l.chave} className="tabular-nums">
                  {l.fornecedor} · {fmtBRL(l.valor)} · venc. {fmtDia(l.vencimento)}
                  {l.duplicata ? ` · dup. ${l.duplicata}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* anotação da célula */}
        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Anotação desta despesa na loja</p>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} disabled={!podeEditar} rows={2} placeholder="ex.: a energia vem dentro do boleto do shopping" className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-50" data-nota />
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-700">
              <input type="checkbox" checked={naoSeAplica} onChange={(e) => setNaoSeAplica(e.target.checked)} className="mb-0 !h-4 !w-4" data-nao-se-aplica /> Esta loja não tem essa despesa (não se aplica)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-700" title="Lançamento de outro fornecedor que cair no centro de custo desta loja não conta nesta célula">
              <input type="checkbox" checked={soCadastro} onChange={(e) => setSoCadastro(e.target.checked)} className="mb-0 !h-4 !w-4" data-so-cadastro /> Considerar só os fornecedores do cadastro
            </label>
            <button onClick={salvarNota} disabled={busy || !mudouNota} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white disabled:opacity-40" data-salvar-nota>
              {busy ? <Spinner size={13} className="animate-spin" /> : <CheckCircle size={13} weight="bold" />} Salvar anotação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormDespesa({ inicial, cdFilial, tipos, canais, onCancelar, onSalvo }) {
  const [f, setF] = useState(() => ({
    tipo: inicial?.tipo || tipos[0]?.id || 'OUTRA',
    fornecedor: inicial?.fornecedor || '',
    fornecedorCode: inicial?.fornecedorCode || '',
    vencimentoDia: inicial?.vencimentoDia || '',
    formaPagamento: inicial?.formaPagamento || 'BOLETO',
    comoPegarCanal: inicial?.comoPegarCanal || 'nao_definido',
    comoPegar: inicial?.comoPegar || '',
    observacao: inicial?.observacao || '',
    contratoVencimento: inicial?.contratoVencimento || '',
  }));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const salvar = async () => {
    setBusy(true);
    setErro('');
    try {
      if (inicial) await apiJson(`${API}/despesas/${inicial.id}`, { method: 'PUT', body: f });
      else await apiJson(`${API}/despesas`, { method: 'POST', body: { ...f, cdFilial } });
      onSalvo(`${f.fornecedor} ${inicial ? 'atualizado' : 'cadastrado'}`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  const ehAluguel = f.tipo === 'ALUGUEL' || f.tipo === 'CONDOMINIO';
  return (
    <div className="rounded-xl bg-indigo-50/60 p-3 ring-1 ring-indigo-200" data-form-despesa>
      <p className="mb-2 text-sm font-bold text-[#000638]">{inicial ? 'Editar cadastro' : 'Cadastrar fornecedor'}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tipos.length > 1 && (
          <div>
            <label className={labelCls}>Despesa</label>
            <select value={f.tipo} onChange={campo('tipo')} className={inputCls}>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={tipos.length > 1 ? 'col-span-2' : 'col-span-2 sm:col-span-3'}>
          <label className={labelCls}>Fornecedor</label>
          <input value={f.fornecedor} onChange={campo('fornecedor')} className={inputCls} data-fornecedor />
        </div>
        <div>
          <label className={labelCls}>Código do fornecedor</label>
          <input value={f.fornecedorCode} onChange={(e) => setF((x) => ({ ...x, fornecedorCode: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" placeholder="opcional" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Vence todo dia</label>
          <input value={f.vencimentoDia} onChange={(e) => setF((x) => ({ ...x, vencimentoDia: e.target.value.replace(/\D/g, '').slice(0, 2) }))} inputMode="numeric" placeholder="ex.: 10" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Forma de pagamento</label>
          <select value={f.formaPagamento} onChange={campo('formaPagamento')} className={inputCls}>
            {['BOLETO', 'PIX', 'DEBITO', 'TRANSFERENCIA'].map((p) => (
              <option key={p} value={p}>
                {p === 'DEBITO' ? 'Débito automático' : p === 'TRANSFERENCIA' ? 'Transferência' : p === 'PIX' ? 'Pix' : 'Boleto'}
              </option>
            ))}
          </select>
        </div>
        {ehAluguel && (
          <div className="col-span-2">
            <label className={labelCls}>Contrato vence em</label>
            <input type="date" value={f.contratoVencimento} onChange={campo('contratoVencimento')} className={inputCls} />
          </div>
        )}
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>Como a conta chega (canal)</label>
          <select value={f.comoPegarCanal} onChange={campo('comoPegarCanal')} className={inputCls} data-canal>
            {canais.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>Como pegar a conta para pagar (passo a passo)</label>
          <textarea value={f.comoPegar} onChange={campo('comoPegar')} rows={2} placeholder="ex.: o boleto chega no e-mail de Patrimônio todo dia 5; se não chegar, pedir no WhatsApp (84) 9...." className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30" data-como />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>Observação (código do cliente, matrícula, titular…)</label>
          <textarea value={f.observacao} onChange={campo('observacao')} rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30" />
        </div>
      </div>
      {erro && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancelar} disabled={busy} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-300 hover:bg-white">
          Cancelar
        </button>
        <button onClick={salvar} disabled={busy || !f.fornecedor.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40" data-salvar-despesa>
          {busy ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />} Salvar
        </button>
      </div>
    </div>
  );
}

// ─── LOJAS (dados cadastrais) ────────────────────────────────────────────────
function Lojas({ podeEditar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState(null); // null | { nova: true } | loja
  const carregar = useCallback(async () => {
    setErro('');
    try {
      const j = await apiJson(`${API}/lojas`);
      setD(j.data);
    } catch (e) {
      setErro(e.message);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs text-gray-600">Dados cadastrais das lojas e dos imóveis, guardados no HeadCoach. O centro de custo é o que liga as contas do Contas a Pagar à loja.</p>
        {podeEditar && (
          <button onClick={() => setForm({ nova: true })} className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700" data-nova-loja>
            <Plus size={14} weight="bold" /> Nova loja ou imóvel
          </button>
        )}
      </div>
      {aviso && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{aviso}</p>}
      {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {!d && !erro && (
        <div className="py-16 text-center text-gray-400">
          <Spinner size={22} className="mx-auto animate-spin" />
        </div>
      )}
      {d && (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-lojas>
          {d.lojas.map((l) => (
            <div key={l.cdFilial} className={`rounded-xl border bg-white p-3 shadow-sm ${l.ativo ? 'border-gray-200' : 'border-gray-200 opacity-60'}`} data-loja-card={l.cdFilial}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#000638]">{l.nome}</p>
                  <p className="text-[11px] text-gray-500">
                    {/^\d+$/.test(l.cdFilial) ? `Loja ${l.cdFilial} · ` : ''}
                    {l.tipoNome}
                    {l.shopping ? ` · ${l.shopping}` : ''}
                    {!l.ativo ? ' · inativa' : ''}
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700 ring-1 ring-indigo-200">{l.despesas} despesa(s)</span>
                {podeEditar && (
                  <button onClick={() => setForm(l)} title="Editar" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" data-editar-loja>
                    <PencilSimple size={15} />
                  </button>
                )}
              </div>
              <dl className="mt-2 space-y-0.5 text-[11.5px] text-gray-700">
                {l.razaoSocial && (
                  <div className="truncate">
                    <dt className="inline text-gray-400">Razão social: </dt>
                    <dd className="inline">{l.razaoSocial}</dd>
                  </div>
                )}
                {l.cnpj && (
                  <div>
                    <dt className="inline text-gray-400">CNPJ: </dt>
                    <dd className="inline tabular-nums">{fmtCNPJ(l.cnpj)}</dd>
                    {l.inscricaoEstadual && <span className="text-gray-400"> · IE {l.inscricaoEstadual}</span>}
                  </div>
                )}
                {(l.endereco || l.cidade) && (
                  <div>
                    <dt className="inline text-gray-400">Endereço: </dt>
                    <dd className="inline">{[l.endereco, l.bairro, [l.cidade, l.uf].filter(Boolean).join('/'), l.cep ? `CEP ${l.cep}` : null].filter(Boolean).join(' · ')}</dd>
                  </div>
                )}
                {(l.telefone || l.email || l.responsavel) && (
                  <div>
                    <dt className="inline text-gray-400">Contato: </dt>
                    <dd className="inline">{[l.responsavel, l.telefone, l.email].filter(Boolean).join(' · ')}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline text-gray-400">Centro de custo: </dt>
                  <dd className="inline">{l.centroCustoCode != null ? `${l.centroCustoCode} — ${d.centrosCusto.find((c) => c.code === l.centroCustoCode)?.nome || '?'}` : <span className="text-orange-700">não informado</span>}</dd>
                </div>
                {l.observacao && <div className="whitespace-pre-line text-gray-600">{l.observacao}</div>}
              </dl>
            </div>
          ))}
        </div>
      )}
      {form && d && (
        <FormLoja
          inicial={form.nova ? null : form}
          tipos={d.tipos}
          centrosCusto={d.centrosCusto}
          onFechar={() => setForm(null)}
          onSalvo={(msg) => {
            setForm(null);
            setAviso(msg);
            carregar();
          }}
        />
      )}
    </>
  );
}

function FormLoja({ inicial, tipos, centrosCusto, onFechar, onSalvo }) {
  const [f, setF] = useState(() => ({
    cdFilial: inicial?.cdFilial || '',
    nome: inicial?.nome || '',
    tipo: inicial?.tipo || 'loja_rua',
    empresa: inicial?.empresa ?? '',
    razaoSocial: inicial?.razaoSocial || '',
    nomeFantasia: inicial?.nomeFantasia || '',
    cnpj: inicial?.cnpj || '',
    inscricaoEstadual: inicial?.inscricaoEstadual || '',
    grupo: inicial?.grupo || '',
    endereco: inicial?.endereco || '',
    bairro: inicial?.bairro || '',
    cidade: inicial?.cidade || '',
    uf: inicial?.uf || '',
    cep: inicial?.cep || '',
    shopping: inicial?.shopping || '',
    telefone: inicial?.telefone || '',
    email: inicial?.email || '',
    responsavel: inicial?.responsavel || '',
    centroCustoCode: inicial?.centroCustoCode ?? '',
    observacao: inicial?.observacao || '',
    ordem: inicial?.ordem ?? 500,
    ativo: inicial ? inicial.ativo : true,
  }));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const salvar = async () => {
    setBusy(true);
    setErro('');
    try {
      if (inicial) await apiJson(`${API}/lojas/${encodeURIComponent(inicial.cdFilial)}`, { method: 'PUT', body: f });
      else await apiJson(`${API}/lojas`, { method: 'POST', body: f });
      onSalvo(`${f.nome} ${inicial ? 'atualizada' : 'cadastrada'}`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  const C = ({ k, rotulo, cls = '', ...resto }) => (
    <div className={cls}>
      <label className={labelCls}>{rotulo}</label>
      <input value={f[k] ?? ''} onChange={campo(k)} className={inputCls} {...resto} />
    </div>
  );
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" data-form-loja>
      <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start gap-2">
          <h3 className="flex-1 text-lg font-bold text-[#000638]">{inicial ? `Editar ${inicial.nome}` : 'Nova loja ou imóvel'}</h3>
          <button onClick={onFechar} disabled={busy} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {C({ k: 'cdFilial', rotulo: 'Código', disabled: !!inicial, placeholder: 'ex.: 95 ou CASA_CROSBY' })}
          {C({ k: 'nome', rotulo: 'Nome', cls: 'col-span-2', 'data-nome': true })}
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={f.tipo} onChange={campo('tipo')} className={inputCls}>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          {C({ k: 'razaoSocial', rotulo: 'Razão social', cls: 'col-span-2' })}
          {C({ k: 'cnpj', rotulo: 'CNPJ' })}
          {C({ k: 'inscricaoEstadual', rotulo: 'Inscrição estadual' })}
          {C({ k: 'endereco', rotulo: 'Endereço', cls: 'col-span-2' })}
          {C({ k: 'bairro', rotulo: 'Bairro' })}
          {C({ k: 'cep', rotulo: 'CEP' })}
          {C({ k: 'cidade', rotulo: 'Cidade', cls: 'col-span-2' })}
          {C({ k: 'uf', rotulo: 'UF', maxLength: 2 })}
          {C({ k: 'shopping', rotulo: 'Shopping / condomínio' })}
          {C({ k: 'responsavel', rotulo: 'Responsável na loja', cls: 'col-span-2' })}
          {C({ k: 'telefone', rotulo: 'Telefone' })}
          {C({ k: 'email', rotulo: 'E-mail' })}
          <div className="col-span-2">
            <label className={labelCls}>Centro de custo no Contas a Pagar</label>
            <select value={f.centroCustoCode} onChange={campo('centroCustoCode')} className={inputCls}>
              <option value="">— não informado —</option>
              {centrosCusto.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.nome}
                </option>
              ))}
            </select>
          </div>
          {C({ k: 'empresa', rotulo: 'Código da empresa', inputMode: 'numeric' })}
          {C({ k: 'ordem', rotulo: 'Ordem na planilha', inputMode: 'numeric' })}
          <div className="col-span-2 sm:col-span-4">
            <label className={labelCls}>Observação</label>
            <textarea value={f.observacao} onChange={campo('observacao')} rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30" />
          </div>
          <label className="col-span-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-700 sm:col-span-4">
            <input type="checkbox" checked={!!f.ativo} onChange={(e) => setF((x) => ({ ...x, ativo: e.target.checked }))} className="mb-0 !h-4 !w-4" /> Aparece na planilha (ativa)
          </label>
        </div>
        {erro && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onFechar} disabled={busy} className="h-10 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={salvar} disabled={busy || !f.nome.trim() || !String(f.cdFilial).trim()} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40" data-salvar-loja>
            {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
